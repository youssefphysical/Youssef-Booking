// =============================
// Task #74 — Badge evaluator & streak calculator
// =============================
// Pure functions only — no DB access. The wrapper `evaluateAndAwardBadges`
// in this file pulls the inputs via storage, runs the evaluator, awards
// any newly-earned badges, and fires `notifyUserOnce(kind:"badge_earned")`
// for each new earn. Trigger sites (auto-complete cron, /evaluate route)
// always call the wrapper inside try/catch — badge work must NEVER block
// the originating action.

import { storage } from "../storage";
import { notifyUserOnce } from "./notifications";
import {
  BADGE_DEFINITIONS,
  type BadgeKey,
  type Booking,
  type InbodyRecord,
  type WeeklyCheckin,
  type UserBadge,
  type DailyCheckin,
} from "@shared/schema";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DUBAI_TZ_OFFSET = "+04:00";
const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

/**
 * ISO-week Monday in Asia/Dubai (UTC+4, no DST), returned as the epoch ms
 * that corresponds to Dubai-local midnight on that Monday.
 *
 * Implementation note: Dubai is a fixed UTC+4 offset. Shift the input
 * by +4h before reading UTC weekday/date so the result reflects the
 * *Dubai-local* day. Then re-anchor the resulting calendar date to
 * Dubai midnight by parsing with the `+04:00` suffix. Without the
 * shift, e.g. a Monday-Dubai timestamp like 2026-05-25T00:00+04:00
 * (UTC 2026-05-24T20:00) reads as Sunday under `getUTCDay`, putting
 * the session into the *previous* ISO week.
 */
export function startOfIsoWeekDubai(d: Date): number {
  const dubai = new Date(d.getTime() + DUBAI_OFFSET_MS);
  const day = dubai.getUTCDay(); // 0=Sun..6=Sat in Dubai-local
  const offset = day === 0 ? -6 : 1 - day;
  const y = dubai.getUTCFullYear();
  const m = String(dubai.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(dubai.getUTCDate()).padStart(2, "0");
  // Anchor to Dubai-midnight of the Sunday/whatever-day, then add the
  // weekday offset in whole days so we land on Dubai-midnight Monday.
  const anchor = new Date(`${y}-${m}-${dd}T00:00:00${DUBAI_TZ_OFFSET}`).getTime();
  return anchor + offset * DAY_MS;
}

function bookingDateMs(b: Booking): number {
  const rawDate: unknown = (b as { date?: unknown }).date;
  const dateStr =
    rawDate instanceof Date
      ? rawDate.toISOString().slice(0, 10)
      : String(rawDate ?? "").slice(0, 10);
  if (!dateStr) return NaN;
  const t = new Date(`${dateStr}T00:00:00${DUBAI_TZ_OFFSET}`).getTime();
  return t;
}

// =============================
// Streak metrics (used by /api/me/streaks + StreakStrip)
// =============================

export interface StreakMetrics {
  /** Completed sessions inside the current ISO week. */
  sessionsThisWeek: number;
  /** Target sessions per week from the user's weekly frequency (1..6). */
  sessionsTargetWeekly: number;
  /**
   * Nutrition consistency over the last 7 Dubai-local days: count of
   * distinct days with a daily check-in row containing at least one
   * tracked field (water, sleep, recovery, energy). 0..7.
   */
  nutritionStreakDays: number;
  /** Consecutive ISO weeks (ending current) with ≥1 completed/upcoming session. */
  attendanceStreakWeeks: number;
  /**
   * Whether the user has an active nutrition plan. The client uses this to
   * gate the nutrition chip — per product spec the chip only appears when
   * a plan is actually assigned, otherwise it'd shame clients who haven't
   * opted into nutrition coaching.
   */
  nutritionPlanActive: boolean;
}

export function computeStreaks(input: {
  bookings: Booking[];
  dailyCheckins: DailyCheckin[];
  weeklyFrequency: number | null;
  nutritionPlanActive?: boolean;
}): StreakMetrics {
  const { bookings, dailyCheckins, weeklyFrequency } = input;
  const now = Date.now();
  const currentWeekStart = startOfIsoWeekDubai(new Date(now));
  const nextWeekStart = currentWeekStart + WEEK_MS;

  // Sessions this ISO week: status === "completed" within [thisWeek, nextWeek).
  let sessionsThisWeek = 0;
  for (const b of bookings) {
    if (b.status !== "completed") continue;
    const t = bookingDateMs(b);
    if (!Number.isFinite(t)) continue;
    if (t >= currentWeekStart && t < nextWeekStart) sessionsThisWeek++;
  }

  // Attendance streak: walk back week-by-week from current week. A week
  // "counts" if it has any completed OR upcoming/confirmed session.
  // Mirrors ConsistencyStreak's client derivation so the chip matches.
  const activeWeeks = new Set<number>();
  for (const b of bookings) {
    const s = (b.status ?? "").toLowerCase();
    if (!["completed", "confirmed", "upcoming"].includes(s)) continue;
    const t = bookingDateMs(b);
    if (!Number.isFinite(t)) continue;
    activeWeeks.add(startOfIsoWeekDubai(new Date(t)));
  }
  let attendanceStreakWeeks = 0;
  for (let i = 0; i < 520; i++) {
    const ws = currentWeekStart - i * WEEK_MS;
    if (activeWeeks.has(ws)) attendanceStreakWeeks++;
    else break;
  }

  // Nutrition consistency: count distinct days in the last 7 Dubai-local
  // days that have a daily check-in row with at least one tracked field
  // populated. Day boundaries are Dubai-anchored midnights (UTC+4 fixed).
  const todayDubaiStart = (() => {
    const dubai = new Date(now + DUBAI_OFFSET_MS);
    const y = dubai.getUTCFullYear();
    const m = String(dubai.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dubai.getUTCDate()).padStart(2, "0");
    return new Date(`${y}-${m}-${dd}T00:00:00${DUBAI_TZ_OFFSET}`).getTime();
  })();
  const sevenDayCutoff = todayDubaiStart - 6 * DAY_MS;
  const trackedDays = new Set<number>();
  for (const c of dailyCheckins) {
    if (!c.date) continue;
    const informative =
      c.waterLiters != null ||
      c.sleepHours != null ||
      c.recoveryScore != null ||
      c.energyScore != null;
    if (!informative) continue;
    const rawCd: unknown = c.date;
    const dateStr =
      rawCd instanceof Date ? rawCd.toISOString().slice(0, 10) : String(rawCd).slice(0, 10);
    const t = new Date(`${dateStr}T00:00:00${DUBAI_TZ_OFFSET}`).getTime();
    if (!Number.isFinite(t)) continue;
    if (t >= sevenDayCutoff && t <= todayDubaiStart) trackedDays.add(t);
  }
  const nutritionStreakDays = trackedDays.size;

  const sessionsTargetWeekly =
    typeof weeklyFrequency === "number" && weeklyFrequency > 0 ? weeklyFrequency : 3;

  return {
    sessionsThisWeek,
    sessionsTargetWeekly,
    nutritionStreakDays,
    attendanceStreakWeeks,
    nutritionPlanActive: Boolean(input.nutritionPlanActive),
  };
}

// =============================
// Badge evaluator (pure)
// =============================

export interface BadgeEvalInput {
  bookings: Booking[];
  inbody: InbodyRecord[];
  checkins: WeeklyCheckin[];
  alreadyEarned: ReadonlySet<BadgeKey>;
}

/**
 * Returns badge keys the user has just newly qualified for, given their
 * current data and the set of badges already on file. Pure — no I/O. Safe
 * to unit-test directly.
 *
 * Criteria:
 *   first_session            — ≥1 completed booking
 *   ten_sessions             — ≥10 completed bookings
 *   fifty_sessions           — ≥50 completed bookings
 *   consistency_champion     — In the last 4 ISO weeks, EVERY week had ≥3
 *                              completed sessions.
 *   elite_discipline         — In the last 12 ISO weeks, ≥3 sessions in
 *                              every single week.
 *   transformation_started   — ≥1 completed session AND ≥1 InBody record
 *                              dated on/after the first completed session.
 */
export function evaluateBadges(input: BadgeEvalInput): BadgeKey[] {
  const { bookings, inbody, alreadyEarned } = input;
  const newly: BadgeKey[] = [];

  const completed = bookings.filter((b) => b.status === "completed");
  const completedCount = completed.length;

  if (completedCount >= 1 && !alreadyEarned.has("first_session")) newly.push("first_session");
  if (completedCount >= 10 && !alreadyEarned.has("ten_sessions")) newly.push("ten_sessions");
  if (completedCount >= 50 && !alreadyEarned.has("fifty_sessions")) newly.push("fifty_sessions");

  // Sessions-per-week buckets (ISO Mon).
  const perWeek = new Map<number, number>();
  for (const b of completed) {
    const t = bookingDateMs(b);
    if (!Number.isFinite(t)) continue;
    const ws = startOfIsoWeekDubai(new Date(t));
    perWeek.set(ws, (perWeek.get(ws) ?? 0) + 1);
  }
  const currentWeekStart = startOfIsoWeekDubai(new Date());

  // consistency_champion: in the last 4 weeks (inclusive of current),
  // EVERY week must have ≥3 completed sessions. Task #74 spec wording is
  // strict: "4 weeks ≥3 sessions/week".
  if (!alreadyEarned.has("consistency_champion")) {
    let allHit4 = true;
    for (let i = 0; i < 4; i++) {
      const ws = currentWeekStart - i * WEEK_MS;
      if ((perWeek.get(ws) ?? 0) < 3) {
        allHit4 = false;
        break;
      }
    }
    if (allHit4) newly.push("consistency_champion");
  }

  // elite_discipline: in the last 12 weeks, EVERY week has ≥3 sessions.
  if (!alreadyEarned.has("elite_discipline")) {
    let allHit = true;
    for (let i = 0; i < 12; i++) {
      const ws = currentWeekStart - i * WEEK_MS;
      if ((perWeek.get(ws) ?? 0) < 3) {
        allHit = false;
        break;
      }
    }
    if (allHit) newly.push("elite_discipline");
  }

  // transformation_started: client has both completed at least one
  // session AND has at least one InBody scan dated on or after that
  // first completed session. Captures the spirit of "transformation
  // started" — they've trained AND committed to measuring progress.
  if (inbody.length >= 1 && completedCount >= 1 && !alreadyEarned.has("transformation_started")) {
    const firstCompletedMs = Math.min(
      ...completed.map(bookingDateMs).filter((t) => Number.isFinite(t)),
    );
    const hasInbodyAfter = inbody.some((r) => {
      const raw: unknown = (r as { recordedAt?: unknown; createdAt?: unknown }).recordedAt
        ?? (r as { createdAt?: unknown }).createdAt;
      if (!raw) return false;
      const t = raw instanceof Date ? raw.getTime() : new Date(String(raw)).getTime();
      return Number.isFinite(t) && t >= firstCompletedMs;
    });
    if (hasInbodyAfter) newly.push("transformation_started");
  }

  return newly;
}

// =============================
// Wrapper: evaluate + persist + notify
// =============================

/**
 * Evaluates badges for a user, awards newly-earned ones (idempotently via
 * the unique index), and fires `badge_earned` notifications. Returns the
 * list of newly-awarded keys (may be empty). Never throws — failures are
 * logged and swallowed so trigger sites (auto-complete cron, completion
 * patch) can call this with a bare `await` and continue.
 */
export async function evaluateAndAwardBadges(userId: number): Promise<BadgeKey[]> {
  try {
    const [bookings, inbody, existing] = await Promise.all([
      storage.getBookings({ userId }).catch(() => []),
      storage.getInbodyRecords({ userId }).catch(() => [] as InbodyRecord[]),
      storage.getUserBadges(userId).catch(() => [] as UserBadge[]),
    ]);

    const alreadyEarned = new Set<BadgeKey>(existing.map((b) => b.badgeKey as BadgeKey));
    const newly = evaluateBadges({
      bookings,
      inbody,
      checkins: [],
      alreadyEarned,
    });

    const actuallyAwarded: BadgeKey[] = [];
    for (const key of newly) {
      try {
        const inserted = await storage.awardUserBadge(userId, key);
        if (!inserted) continue;
        actuallyAwarded.push(key);
        const def = BADGE_DEFINITIONS.find((d) => d.key === key);
        await notifyUserOnce(
          userId,
          "badge_earned",
          `badge-${key}`,
          "Badge unlocked",
          `You earned the ${humanLabel(key)} badge. Tap to view your achievements.`,
          {
            link: "/profile#achievements",
            meta: { badgeKey: key, tier: def?.tier ?? "bronze" },
          },
        );
      } catch (err) {
        console.error("[badges] award/notify failed", { userId, key, err });
      }
    }
    return actuallyAwarded;
  } catch (err) {
    console.error("[badges] evaluateAndAwardBadges failed", { userId, err });
    return [];
  }
}

function humanLabel(key: BadgeKey): string {
  switch (key) {
    case "first_session": return "First Session";
    case "ten_sessions": return "10 Sessions";
    case "fifty_sessions": return "50 Sessions";
    case "consistency_champion": return "Consistency Champion";
    case "elite_discipline": return "Elite Discipline";
    case "transformation_started": return "Transformation Started";
  }
}
