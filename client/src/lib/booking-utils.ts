// Shared booking utilities for the client (slot generation, status formatting, cutoff math)

export const ALL_TIME_SLOTS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00",
];

// Booking lead-time policy. Mirrors `MIN_ADVANCE_BOOKING_HOURS` in
// server/routes.ts — KEEP THE TWO IN SYNC. The booking cutoff is a
// completely separate system from the cancellation cutoff (which lives
// in `settings.cancellation_cutoff_hours`, default 6h). Do not merge them.
//
// Business rule (per the May 2026 booking-rules brief — see project log):
//
//   cutoff = CEIL_TO_NEXT_FULL_HOUR(currentDubaiTime) + MIN_ADVANCE_HOURS
//
// So at 10:00:00 Dubai → ceil = 10:00 → cutoff = 16:00 → first slot 4 PM.
// At 10:00:01 Dubai     → ceil = 11:00 → cutoff = 17:00 → first slot 5 PM.
// At 11:00:00 Dubai     → ceil = 11:00 → cutoff = 17:00 → first slot 5 PM.
// At 11:00:01 Dubai     → ceil = 12:00 → cutoff = 18:00 → first slot 6 PM.
//
// This applies to ALL users (clients AND admins — no bypass). Same helper
// is mirrored on the server at `bookingCutoffMs` in server/routes.ts so
// the UI and validation can never disagree.
export const MIN_ADVANCE_HOURS = 6;
export const MIN_ADVANCE_MS = MIN_ADVANCE_HOURS * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DUBAI_OFFSET_MS = 4 * HOUR_MS;

/**
 * Returns the absolute epoch-ms cutoff such that any slot whose start
 * time is < cutoff must be disabled. Implements the "round Dubai
 * wall-clock UP to the next full hour, then add MIN_ADVANCE_HOURS"
 * rule. Dubai is fixed UTC+4 (no DST) so the constant offset is safe.
 */
export function bookingCutoffMs(now: number = Date.now()): number {
  const dubaiNow = now + DUBAI_OFFSET_MS;
  const remainder = dubaiNow % HOUR_MS;
  const ceilDubai = remainder === 0 ? dubaiNow : dubaiNow + (HOUR_MS - remainder);
  // shift back to UTC, then add the 6-hour preparation buffer
  return ceilDubai - DUBAI_OFFSET_MS + MIN_ADVANCE_MS;
}

export function formatStatus(status: string): string {
  switch (status) {
    case "upcoming": return "Upcoming";
    case "confirmed": return "Confirmed";
    case "completed": return "Completed";
    case "cancelled": return "Cancelled";
    case "free_cancelled": return "Free Cancellation";
    case "late_cancelled": return "Late Cancellation – Session Charged";
    case "emergency_cancelled": return "Protected Cancellation";
    case "no_show": return "No-Show";
    default: return status;
  }
}

/** i18n-aware status formatter. Pass the t() function from useTranslation. */
export function translateStatus(
  status: string,
  t: (key: string, fallback?: string) => string,
): string {
  switch (status) {
    case "upcoming": return t("admin.status.upcoming");
    case "confirmed": return t("admin.status.confirmed");
    case "completed": return t("admin.status.completed");
    case "cancelled": return t("admin.status.cancelled");
    case "free_cancelled": return t("admin.status.freeCancelled");
    case "late_cancelled": return t("admin.status.lateCancelled");
    case "emergency_cancelled": return t("admin.status.emergencyCancelled");
    case "no_show": return t("admin.status.noShow");
    default: return status;
  }
}

/**
 * Premium status visual language (May 2026 polish pass).
 * --------------------------------------------------------------------
 * One source of truth so admin bookings, client dashboard, session
 * history, package logs and every booking card read identically.
 *
 *   upcoming             → cyan      (Tron primary tone — what's next)
 *   confirmed            → emerald   (locked in)
 *   completed            → emerald   (done & counted)
 *   rescheduled          → indigo    (moved, still alive)
 *   cancelled / free_…   → muted     (cleanly gone, no penalty)
 *   emergency_cancelled  → amber     (caution: special treatment)
 *   no_show / late_…     → soft red  (penalty path)
 */
export function statusColor(status: string): string {
  switch (status) {
    case "upcoming":
      return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
    case "confirmed":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "completed":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "rescheduled":
      return "bg-indigo-500/15 text-indigo-300 border-indigo-500/30";
    case "cancelled":
    case "free_cancelled":
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
    case "emergency_cancelled":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "no_show":
    case "late_cancelled":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }
}

/**
 * Payment status visual language. Kept separate from session status
 * so a single chip can render either without case-collision.
 * Covers every payment_status value the booking flow can emit:
 *   paid                     → emerald  (settled)
 *   unpaid                   → amber    (owed)
 *   pending                  → cyan     (awaiting confirmation)
 *   direct_payment_requested → violet   (out-of-band path requested)
 *   free                     → muted    (comp / promo, no charge)
 *   refunded                 → muted
 *   failed                   → soft red
 */
export function paymentColor(payment: string): string {
  switch (payment) {
    case "paid":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "unpaid":
      return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "pending":
      return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
    case "direct_payment_requested":
      return "bg-violet-500/15 text-violet-300 border-violet-500/30";
    case "free":
      return "bg-white/5 text-muted-foreground border-white/10";
    case "refunded":
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
    case "failed":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }
}

// Anchor every session date/time to Asia/Dubai (UTC+4, no DST). Without
// this explicit offset, `new Date("YYYY-MM-DDTHH:MM:00")` is parsed as
// the BROWSER'S local time, which silently disagrees with the server's
// Dubai-anchored truth for any visitor outside the UAE — taken/free
// slot computations would shift by hours. Mirrors `DUBAI_TZ_OFFSET` in
// server/routes.ts.
const DUBAI_TZ_OFFSET = "+04:00";

export function buildSessionDate(date: string, timeSlot: string): Date {
  return new Date(`${date}T${timeSlot}:00${DUBAI_TZ_OFFSET}`);
}

// Dubai-anchored "today" as YYYY-MM-DD. Critical: do NOT use
// `format(new Date(), "yyyy-MM-dd")` for booking calendars — that uses the
// BROWSER's local timezone. A user whose device sits east of Dubai (or whose
// phone clock is wrong) would see Dubai-tomorrow's date by default, which then
// makes early-morning slots erroneously appear available because they are
// indeed past the cutoff in absolute terms but not what the user intends to book.
// Dubai is fixed UTC+4 year-round (no DST), so `Intl` with `Asia/Dubai`
// gives the correct civil date with no edge cases.
export function dubaiTodayYMD(): string {
  // en-CA → "YYYY-MM-DD" with no further parsing needed.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

// Same idea for an arbitrary Date: extract Y/M/D as seen from Dubai. Used so
// that when the user clicks a calendar cell the resulting YYYY-MM-DD matches
// the visible Dubai date, not the browser-local date the picker happened to
// produce. Round-trip safe with `dubaiTodayYMD`.
export function formatYMDInDubai(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dubai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

// Build a Date object that, when formatted by the calendar (which uses the
// browser's local TZ), highlights the Dubai civil date. We anchor it to Dubai
// noon (12:00 +04:00) — the safest hour because no realistic browser TZ can
// shift noon-Dubai across a calendar boundary (max ±14h gives 22:00–02:00 of
// the same Dubai day in the most extreme TZs, which `react-day-picker` still
// renders on the correct civil cell).
export function dubaiTodayAsLocalDate(): Date {
  return new Date(`${dubaiTodayYMD()}T12:00:00${DUBAI_TZ_OFFSET}`);
}

export function hoursUntil(date: string, timeSlot: string): number {
  const d = buildSessionDate(date, timeSlot);
  return (d.getTime() - Date.now()) / (1000 * 60 * 60);
}

export function isCancellable(date: string, timeSlot: string, cutoffHours: number): boolean {
  return hoursUntil(date, timeSlot) >= cutoffHours;
}
