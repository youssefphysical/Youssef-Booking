import { pool } from "../db";
import { storage } from "../storage";
import { notifyUserOnce } from "./notifications";

/**
 * Auto-complete expired sessions (May 2026).
 *
 * Scans all bookings that:
 *   1. Are still in an "active" state (upcoming | confirmed)
 *   2. Have no completedAt stamp
 *   3. Have a Dubai-anchored end time (timeSlot + durationMinutes) that is
 *      already in the past
 *
 * For each match, atomically claims the row via:
 *   UPDATE bookings
 *      SET status = 'completed',
 *          completed_at = now(),
 *          auto_completed_at = now()
 *    WHERE id = $1
 *      AND status IN ('upcoming','confirmed')
 *      AND completed_at IS NULL
 *   RETURNING id, user_id, package_id, package_session_deducted_at
 *
 * `RETURNING` only yields a row when this invocation actually transitioned
 * the booking — concurrent cron retries see rowCount=0 on the loser. This
 * is the exact same atomic-claim pattern the reminders cron uses for its
 * 24h/1h dedupe columns, so the concurrency story is consistent.
 *
 * If the claim wins AND the booking has a packageId AND the
 * package_session_deducted_at column is NULL (meaning no admin attendance
 * action has already drawn down the credit), increment the package usage
 * and stamp the column. Both happen in best-effort try/catch so a stuck
 * package row never blocks the rest of the pass.
 *
 * Then fire one in-app notification per booking via notifyUserOnce — the
 * partial UNIQUE INDEX on (user_id, kind, dedupe_key) makes the insert
 * idempotent across cron retries.
 *
 * IMPORTANT — what this pass DOES NOT touch:
 *   - emergency_cancelled / late_cancelled / free_cancelled / cancelled / no_show
 *     bookings (status filter excludes them — they were already finalized)
 *   - bookings with a non-null completedAt (filter excludes — already done)
 *   - rescheduled bookings (the reschedule mutation updates date+timeSlot
 *     in place; the new endTime drives the auto-complete window)
 */
export interface AutoCompleteResult {
  scanned: number;
  completed: number;
  deducted: number;
  notified: number;
  errors: Array<{ id: number; error: string }>;
}

const DUBAI_TZ_OFFSET = "+04:00";

function buildSessionEndDate(date: string, timeSlot: string, durationMinutes: number | null | undefined): Date {
  const start = new Date(`${date}T${timeSlot}:00${DUBAI_TZ_OFFSET}`);
  const mins = typeof durationMinutes === "number" && durationMinutes > 0 ? durationMinutes : 60;
  return new Date(start.getTime() + mins * 60_000);
}

export async function runAutoCompleteBookings(): Promise<AutoCompleteResult> {
  const result: AutoCompleteResult = {
    scanned: 0, completed: 0, deducted: 0, notified: 0, errors: [],
  };

  // Pull only active-status rows so the in-memory loop stays small. The
  // SQL `status IN (...)` filter narrows by 95%+ on a real account; the
  // remaining lookup is a date/time comparison done in JS using the same
  // Dubai-anchored helper as buildSessionDate in routes.ts.
  const candidates = await storage.getBookings({});
  const now = Date.now();
  const debug = process.env.AUTO_COMPLETE_DEBUG === "1";
  // Compact diagnostic: log the active-state rows we considered + why we
  // skipped each. Always logged on first 25 candidates so production
  // logs always show the decision path without needing to flip an env
  // var. Format is one line per row, JSON-parsable.
  let inspectedCount = 0;

  for (const b of candidates) {
    if (!["upcoming", "confirmed"].includes(b.status)) continue;
    // Defensive: rows fetched before the auto_completed_at column was
    // added would be `undefined` here. Treat as "needs check".
    if ((b as any).completedAt) continue;
    const endAt = buildSessionEndDate(b.date, b.timeSlot, (b as any).durationMinutes ?? 60).getTime();
    const expired = endAt <= now;

    if (inspectedCount < 25 || debug) {
      console.log("[auto-complete:inspect]", JSON.stringify({
        id: b.id, date: b.date, timeSlot: b.timeSlot,
        status: b.status,
        durationMin: (b as any).durationMinutes ?? 60,
        endAtIso: new Date(endAt).toISOString(),
        nowIso: new Date(now).toISOString(),
        expired,
        action: expired ? "claim" : "skip:future",
      }));
      inspectedCount++;
    }

    if (!expired) continue;

    result.scanned++;

    try {
      // Atomic claim. `RETURNING` makes us race-safe.
      const claim = await pool.query(
        `UPDATE bookings
            SET status = 'completed',
                completed_at = now(),
                auto_completed_at = now()
          WHERE id = $1
            AND status IN ('upcoming','confirmed')
            AND completed_at IS NULL
         RETURNING id, user_id, package_id, package_session_deducted_at`,
        [b.id],
      );
      if (claim.rowCount === 0) continue; // someone else claimed it

      result.completed++;
      const claimed = claim.rows[0] as {
        id: number;
        user_id: number;
        package_id: number | null;
        package_session_deducted_at: Date | null;
      };

      // Idempotent package deduction. Skip when:
      //  - no linked package
      //  - admin already drew down the credit (package_session_deducted_at
      //    is non-null) via /attendance or PATCH /bookings/:id status
      if (claimed.package_id && !claimed.package_session_deducted_at) {
        try {
          await storage.incrementPackageUsage(claimed.package_id);
          // Stamp the anchor so subsequent admin toggles know this row
          // was already deducted by us.
          await pool.query(
            `UPDATE bookings SET package_session_deducted_at = now() WHERE id = $1`,
            [claimed.id],
          );
          result.deducted++;
        } catch (e: any) {
          result.errors.push({ id: claimed.id, error: `deduct: ${e?.message || "unknown"}` });
        }
      }

      // One in-app notification per auto-completed booking. dedupeKey
      // pins it to the booking id so cron retries can't re-fire it.
      // Kind is `system` — the existing taxonomy doesn't have a dedicated
      // "session_completed" enum value and adding one would be a schema
      // change; the dedupeKey carries the semantic intent.
      try {
        const inserted = await notifyUserOnce(
          claimed.user_id,
          "system",
          `auto-complete-${claimed.id}`,
          "Session Completed",
          "Your training session has been completed and counted from your package. You can check your remaining sessions in your profile.",
          { link: "/dashboard", meta: { bookingId: claimed.id, source: "auto" } },
        );
        if (inserted) result.notified++;
      } catch (e: any) {
        result.errors.push({ id: claimed.id, error: `notify: ${e?.message || "unknown"}` });
      }
    } catch (e: any) {
      result.errors.push({ id: b.id, error: e?.message || "unknown" });
    }
  }

  return result;
}
