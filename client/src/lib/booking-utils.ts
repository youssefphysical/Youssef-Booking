// Shared booking utilities for the client (slot generation, status formatting, cutoff math)

export const ALL_TIME_SLOTS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00",
];

// Clients must book at least 6 hours before the session starts so the trainer
// has time to prepare and travel. Mirrors server `MIN_ADVANCE_BOOKING_HOURS`
// in server/routes.ts — keep the two in sync.
export const MIN_ADVANCE_HOURS = 6;
export const MIN_ADVANCE_MS = MIN_ADVANCE_HOURS * 60 * 60 * 1000;

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

export function statusColor(status: string): string {
  switch (status) {
    case "upcoming": return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "confirmed": return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "completed": return "bg-blue-500/15 text-blue-300 border-blue-500/30";
    case "cancelled":
    case "free_cancelled": return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
    case "emergency_cancelled": return "bg-amber-500/15 text-amber-300 border-amber-500/30";
    case "no_show":
    case "late_cancelled": return "bg-red-500/15 text-red-300 border-red-500/30";
    default: return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
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

export function hoursUntil(date: string, timeSlot: string): number {
  const d = buildSessionDate(date, timeSlot);
  return (d.getTime() - Date.now()) / (1000 * 60 * 60);
}

export function isCancellable(date: string, timeSlot: string, cutoffHours: number): boolean {
  return hoursUntil(date, timeSlot) >= cutoffHours;
}
