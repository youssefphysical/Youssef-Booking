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

/**
 * Canonical parser for time-slot strings.
 * Accepts 24-hour `HH:MM` and 12-hour `HH:MM AM/PM` (case-insensitive,
 * whitespace-tolerant). Returns zero-padded 12-hour and 24-hour strings.
 * 12 AM → 00:00, 12 PM → 12:00.
 */
export function parseTimeSlot(
  timeSlot: string | null | undefined,
): { hour24: number; minute: string; time24: string; time12: string } | null {
  if (!timeSlot) return null;
  const m = /^(\d{1,2}):(\d{2})\s*(AM|PM|am|pm)?$/.exec(timeSlot.trim());
  if (!m) return null;
  let h = Number(m[1]);
  const min = m[2];
  const ampm = m[3]?.toUpperCase();
  if (Number.isNaN(h) || Number.isNaN(Number(min))) return null;
  let h24: number;
  if (ampm) {
    // 12-hour input
    if (h < 1 || h > 12) return null;
    h24 = ampm === "AM" ? (h === 12 ? 0 : h) : (h === 12 ? 12 : h + 12);
  } else {
    // 24-hour input
    if (h < 0 || h > 23) return null;
    h24 = h;
  }
  const mNum = Number(min);
  if (mNum < 0 || mNum > 59) return null;
  const period = h24 >= 12 ? "PM" : "AM";
  let h12 = h24 % 12;
  if (h12 === 0) h12 = 12;
  return {
    hour24: h24,
    minute: String(mNum).padStart(2, "0"),
    time24: `${String(h24).padStart(2, "0")}:${String(mNum).padStart(2, "0")}`,
    time12: `${String(h12).padStart(2, "0")}:${String(mNum).padStart(2, "0")} ${period}`,
  };
}

/** Format any time-slot string to 12-hour display. */
export function formatTime12(timeSlot: string | null | undefined): string {
  return parseTimeSlot(timeSlot)?.time12 ?? (timeSlot || "");
}

/** Format any time-slot string to dual 12h/24h display. */
export function formatTimeDual(timeSlot: string | null | undefined): string {
  const parsed = parseTimeSlot(timeSlot);
  if (!parsed) return timeSlot || "";
  return `${parsed.time12} / ${parsed.time24} — Dubai time`;
}

/** Dual-format parts for styled UI rendering. */
export function formatTimeDualParts(timeSlot: string | null | undefined): {
  time12: string;
  time24: string;
  label: string;
} {
  const parsed = parseTimeSlot(timeSlot);
  if (!parsed) return { time12: timeSlot || "", time24: timeSlot || "", label: "Dubai time" };
  return {
    time12: parsed.time12,
    time24: parsed.time24,
    label: "Dubai time",
  };
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
