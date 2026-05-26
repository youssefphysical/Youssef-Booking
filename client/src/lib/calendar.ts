// =============================
// Add-to-Calendar helpers (Asia/Dubai, UTC+4, no DST)
// =============================
// Builds Google Calendar deep-links and downloadable .ics blobs for
// confirmed bookings + reminder emails. All times are anchored to
// Dubai (UTC+4) — Date objects are constructed from the YYYY-MM-DD +
// HH:MM strings with an explicit "+04:00" suffix so the resulting
// instant is correct regardless of the user's device timezone.

export type CalendarEvent = {
  /** YYYY-MM-DD (Dubai civil date) */
  date: string;
  /** HH:MM (24h, Dubai civil time) */
  timeSlot: string;
  /** Duration in minutes (defaults to 60) */
  durationMinutes?: number;
  title: string;
  description?: string;
  location?: string;
  /** Stable identifier for the .ics UID */
  uid?: string;
};

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Returns the event start + end as Date objects anchored to +04:00. */
function eventInstants(ev: CalendarEvent): { start: Date; end: Date } {
  const start = new Date(`${ev.date}T${ev.timeSlot}:00+04:00`);
  const end = new Date(start.getTime() + (ev.durationMinutes ?? 60) * 60_000);
  return { start, end };
}

/** YYYYMMDDTHHmmssZ — used by both Google Calendar URLs and .ics. */
function fmtUtcStamp(d: Date): string {
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    "T" +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    "Z"
  );
}

/** Google Calendar deep-link — opens the "add event" prefill in a new tab. */
export function buildGoogleCalendarUrl(ev: CalendarEvent): string {
  const { start, end } = eventInstants(ev);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: ev.title,
    dates: `${fmtUtcStamp(start)}/${fmtUtcStamp(end)}`,
    details: ev.description ?? "",
    location: ev.location ?? "",
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

/** Generates a minimal RFC-5545 VEVENT. Apple Calendar / Outlook compatible. */
export function buildIcsString(ev: CalendarEvent): string {
  const { start, end } = eventInstants(ev);
  const now = new Date();
  const uid = ev.uid || `booking-${ev.date}-${ev.timeSlot}-${now.getTime()}@youssefahmed`;
  // Escape per RFC 5545 §3.3.11: backslash, comma, semicolon, newline.
  const esc = (s: string) =>
    s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Youssef Elite//Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${fmtUtcStamp(now)}`,
    `DTSTART:${fmtUtcStamp(start)}`,
    `DTEND:${fmtUtcStamp(end)}`,
    `SUMMARY:${esc(ev.title)}`,
    ev.description ? `DESCRIPTION:${esc(ev.description)}` : "",
    ev.location ? `LOCATION:${esc(ev.location)}` : "",
    "END:VEVENT",
    "END:VCALENDAR",
  ]
    .filter(Boolean)
    .join("\r\n");
}

/** Triggers a download of an .ics file in the browser. */
export function downloadIcs(ev: CalendarEvent, filename = "session.ics"): void {
  const ics = buildIcsString(ev);
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
