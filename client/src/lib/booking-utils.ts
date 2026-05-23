// Shared booking utilities for the client (slot generation, status formatting, cutoff math)

// All date/time helpers are anchored to Asia/Dubai via @shared/dates.
export {
  MIN_ADVANCE_HOURS,
  MIN_ADVANCE_MS,
  bookingCutoffMs,
  buildSessionDate,
  dubaiTodayYMD,
  formatYMDInDubai,
  dubaiTodayAsLocalDate,
  hoursUntil,
  isCancellable,
} from "@shared/dates";

export const ALL_TIME_SLOTS = [
  "06:00", "07:00", "08:00", "09:00", "10:00", "11:00",
  "12:00", "13:00", "14:00", "15:00", "16:00", "17:00",
  "18:00", "19:00", "20:00", "21:00", "22:00",
];

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
      return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
    case "no_show":
    case "late_cancelled":
      return "bg-red-500/15 text-red-300 border-red-500/30";
    default:
      return "bg-zinc-500/15 text-zinc-300 border-zinc-500/30";
  }
}

export function paymentColor(payment: string): string {
  switch (payment) {
    case "paid":
      return "bg-emerald-500/15 text-emerald-300 border-emerald-500/30";
    case "unpaid":
      return "bg-cyan-500/15 text-cyan-300 border-cyan-500/30";
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
