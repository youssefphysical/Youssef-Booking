/**
 * Global Dubai timezone utilities.
 *
 * Asia/Dubai is fixed UTC+4 year-round (no DST). Every date, time,
 * comparison, cutoff, and display in this app must flow through these
 * helpers so behaviour is identical regardless of the user's device
 * timezone or the server's physical region.
 */

export const TIMEZONE = "Asia/Dubai";
export const DUBAI_TZ_OFFSET = "+04:00";
export const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

export const MIN_ADVANCE_HOURS = 3;
export const MIN_ADVANCE_MS = MIN_ADVANCE_HOURS * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;

/** Current instant as a UTC Date whose *local* getters reflect Dubai wall-clock. */
export function nowDubai(now: number = Date.now()): Date {
  return new Date(now + DUBAI_OFFSET_MS);
}

/** YYYY-MM-DD for the current Dubai civil day. */
export function dubaiTodayYMD(now: number = Date.now()): string {
  const d = nowDubai(now);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD for the *next* Dubai civil day (tomorrow). */
export function dubaiTomorrowYMD(now: number = Date.now()): string {
  return dubaiTodayYMD(now + 86_400_000);
}

/** Booking lead-time cutoff. Mirrors `bookingCutoffMs` in server/routes.ts. */
export function bookingCutoffMs(now: number = Date.now()): number {
  const dubaiNow = now + DUBAI_OFFSET_MS;
  const remainder = dubaiNow % HOUR_MS;
  const ceilDubai = remainder === 0 ? dubaiNow : dubaiNow + (HOUR_MS - remainder);
  return ceilDubai - DUBAI_OFFSET_MS + MIN_ADVANCE_MS;
}

/** Parse a Dubai-anchored YYYY-MM-DD + HH:MM into a true UTC Date. */
export function buildSessionDate(date: string, timeSlot: string): Date {
  return new Date(`${date}T${timeSlot}:00${DUBAI_TZ_OFFSET}`);
}

/** Compute session end time (UTC) given start date/slot and duration. */
export function sessionEndTime(
  date: string,
  timeSlot: string,
  durationMinutes: number | null | undefined,
): Date {
  const start = buildSessionDate(date, timeSlot);
  const mins = typeof durationMinutes === "number" && durationMinutes > 0 ? durationMinutes : 60;
  return new Date(start.getTime() + mins * 60_000);
}

/** Hours until a Dubai-anchored session from an arbitrary instant. */
export function hoursUntil(date: string, timeSlot: string, now: number = Date.now()): number {
  const d = buildSessionDate(date, timeSlot);
  return (d.getTime() - now) / (1000 * 60 * 60);
}

export function isCancellable(date: string, timeSlot: string, cutoffHours: number): boolean {
  return hoursUntil(date, timeSlot) >= cutoffHours;
}

/**
 * Build a Date object that, when formatted by the calendar (which uses the
 * browser's local TZ), highlights the Dubai civil date. Anchored to Dubai
 * noon (12:00 +04:00) — the safest hour because no realistic browser TZ can
 * shift noon-Dubai across a calendar boundary.
 */
export function dubaiTodayAsLocalDate(): Date {
  return new Date(`${dubaiTodayYMD()}T12:00:00${DUBAI_TZ_OFFSET}`);
}

/** YYYY-MM-DD for an arbitrary instant as seen from Dubai. */
export function formatYMDInDubai(d: Date | number): string {
  const t = typeof d === "number" ? d : d.getTime();
  const dubai = nowDubai(t);
  const y = dubai.getUTCFullYear();
  const m = String(dubai.getUTCMonth() + 1).padStart(2, "0");
  const day = String(dubai.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Is the given YYYY-MM-DD the same as today in Dubai? */
export function isTodayDubai(ymd: string, now: number = Date.now()): boolean {
  return ymd === dubaiTodayYMD(now);
}

/** Is the given YYYY-MM-DD tomorrow in Dubai? */
export function isTomorrowDubai(ymd: string, now: number = Date.now()): boolean {
  return ymd === dubaiTomorrowYMD(now);
}

/** Compare two YYYY-MM-DD strings as Dubai civil dates. */
export function isSameDayDubai(a: string, b: string): boolean {
  return a === b;
}

/** Format a full weekday + short date (e.g. "Saturday, May 23") for Dubai. */
export function formatWeekdayShortDate(dubaiYmd: string): string {
  const d = new Date(`${dubaiYmd}T12:00:00${DUBAI_TZ_OFFSET}`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Format a full weekday + long date (e.g. "Saturday, May 23, 2026") for Dubai. */
export function formatWeekdayLongDate(dubaiYmd: string): string {
  const d = new Date(`${dubaiYmd}T12:00:00${DUBAI_TZ_OFFSET}`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(d);
}

/** Format month abbreviation (e.g. "May") for a Dubai YYYY-MM-DD. */
export function formatMonthDubai(dubaiYmd: string): string {
  const d = new Date(`${dubaiYmd}T12:00:00${DUBAI_TZ_OFFSET}`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "short",
  }).format(d);
}

/** Format day of month (e.g. "23") for a Dubai YYYY-MM-DD. */
export function formatDayDubai(dubaiYmd: string): string {
  const d = new Date(`${dubaiYmd}T12:00:00${DUBAI_TZ_OFFSET}`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    day: "numeric",
  }).format(d);
}

/** Format weekday name (e.g. "Saturday") for a Dubai YYYY-MM-DD. */
export function formatWeekdayDubai(dubaiYmd: string): string {
  const d = new Date(`${dubaiYmd}T12:00:00${DUBAI_TZ_OFFSET}`);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    weekday: "long",
  }).format(d);
}

/** Format a 24-hour slot "HH:MM" to 12-hour display. */
export function formatTime12(timeSlot: string | null | undefined): string {
  if (!timeSlot) return "";
  const m = /^(\d{1,2}):(\d{2})/.exec(timeSlot);
  if (!m) return timeSlot;
  const h24 = Number(m[1]);
  const min = m[2];
  if (Number.isNaN(h24) || h24 < 0 || h24 > 23) return timeSlot;
  const period = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return `${String(h12).padStart(2, "0")}:${min} ${period}`;
}

/** Format an ISO timestamp as Dubai-local date + time. */
export function formatTimestampDubai(
  iso: string | Date | number | null | undefined,
  opts: { dateStyle?: "short" | "medium" | "long"; timeStyle?: "short" | "medium" } = {},
): string {
  if (!iso) return "";
  const d = typeof iso === "number" ? new Date(iso) : typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    dateStyle: opts.dateStyle ?? "medium",
    timeStyle: opts.timeStyle,
  }).format(d);
}

/** Format an ISO timestamp as Dubai-local date only (e.g. "May 23, 2026"). */
export function formatDateDubai(iso: string | Date | number | null | undefined): string {
  return formatTimestampDubai(iso, { dateStyle: "medium" });
}

/** Format an ISO timestamp as Dubai-local short date (e.g. "May 23"). */
export function formatShortDateDubai(iso: string | Date | number | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "number" ? new Date(iso) : typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
  }).format(d);
}

/** Format an ISO timestamp as Dubai-local short date + short time (e.g. "May 23, 2:30 PM"). */
export function formatShortDateTimeDubai(iso: string | Date | number | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "number" ? new Date(iso) : typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return String(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(d);
}

/** Day offset between a YYYY-MM-DD and today in Dubai (negative = past, 0 = today, positive = future). */
export function daysFromTodayDubai(ymd: string, now: number = Date.now()): number {
  const today = dubaiTodayYMD(now);
  const d1 = new Date(`${today}T12:00:00${DUBAI_TZ_OFFSET}`);
  const d2 = new Date(`${ymd}T12:00:00${DUBAI_TZ_OFFSET}`);
  return Math.round((d2.getTime() - d1.getTime()) / 86_400_000);
}

/**
 * Human-readable relative time from Dubai-local perspective.
 * Returns strings like "2 hours ago", "in 3 days", "just now", "yesterday".
 */
export function formatRelativeDubai(iso: string | Date | number | null | undefined): string {
  if (!iso) return "";
  const d = typeof iso === "number" ? new Date(iso) : typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return String(iso);
  const diff = Date.now() - d.getTime();
  const abs = Math.abs(diff);
  const seconds = Math.floor(abs / 1000);
  const minutes = Math.floor(abs / (1000 * 60));
  const hours = Math.floor(abs / (1000 * 60 * 60));
  const days = Math.floor(abs / (1000 * 60 * 60 * 24));

  if (diff >= 0) {
    if (seconds < 10) return "just now";
    if (minutes < 1) return `${seconds}s ago`;
    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    if (days === 1) return "yesterday";
    return `${days}d ago`;
  } else {
    if (seconds < 10) return "just now";
    if (minutes < 1) return `in ${seconds}s`;
    if (minutes < 60) return `in ${minutes}m`;
    if (hours < 24) return `in ${hours}h`;
    if (days === 1) return "tomorrow";
    return `in ${days}d`;
  }
}
