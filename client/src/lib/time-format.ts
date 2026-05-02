/**
 * Convert a 24-hour "HH:MM" time slot into a 12-hour display string.
 * Examples:
 *   formatTime12("07:30") -> "07:30 AM"
 *   formatTime12("22:00") -> "10:00 PM"
 *   formatTime12("00:15") -> "12:15 AM"
 *
 * Returns the original string if it can't be parsed (defensive — never throws).
 */
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
