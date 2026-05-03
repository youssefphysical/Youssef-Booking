/**
 * Email service: sends booking notifications via Resend HTTP API.
 *
 * Behaviour:
 * - If RESEND_API_KEY is set, sends real email via fetch (no SDK).
 * - If not set, logs body to stdout and returns { sent: false }.
 * - NEVER throws — booking flow must succeed even if email fails.
 *
 * Configure via env:
 *   RESEND_API_KEY            (required to actually send)
 *   EMAIL_FROM                (default: "Youssef Fitness <bookings@youssef-ahmed.fit>")
 *   TRAINER_EMAIL             (default: "youssef.physical@gmail.com")
 */

const TRAINER_EMAIL_DEFAULT = "youssef.physical@gmail.com";
const FROM_DEFAULT = "Youssef Fitness <bookings@youssef-ahmed.fit>";

export function trainerEmail(): string {
  return process.env.TRAINER_EMAIL || TRAINER_EMAIL_DEFAULT;
}

export type SendResult = { sent: boolean; provider?: string; id?: string; error?: string };

export async function sendEmail(opts: {
  to: string;
  subject: string;
  text: string;
  html?: string;
  replyTo?: string;
}): Promise<SendResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM || FROM_DEFAULT;

  if (!apiKey) {
    console.info(
      `[email] (skipped — no RESEND_API_KEY) to=${opts.to} subject=${JSON.stringify(opts.subject)}`,
    );
    if (process.env.NODE_ENV !== "production") {
      console.info(`--- Email body to ${opts.to} ---\n${opts.text}`);
    }
    return { sent: false };
  }

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [opts.to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
        reply_to: opts.replyTo,
      }),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.warn(`[email] Resend ${res.status}: ${txt.slice(0, 300)}`);
      return { sent: false, provider: "resend", error: `${res.status}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { sent: true, provider: "resend", id: data.id };
  } catch (e: any) {
    console.warn("[email] Resend request failed:", e?.message || e);
    return { sent: false, provider: "resend", error: e?.message || "unknown" };
  }
}

// =====================================================================
// Booking email builders
// =====================================================================

export type BookingEmailData = {
  clientName: string;
  clientEmail?: string | null;
  clientPhone?: string | null;
  date: string;            // "YYYY-MM-DD"
  timeSlot: string;        // "HH:MM"
  time12: string;          // "9:00 AM"
  sessionFocusLabel: string;
  trainingGoalLabel: string;
  sessionTypeLabel: string;
  trainingLevel?: string | null;
  clientNotes?: string | null;
  packageName?: string | null;
  packageStartDate?: string | null;
  packageExpiryDate?: string | null;
  currentSessionNumber?: number | null;
  totalSessions?: number | null;
  remainingSessions?: number | null;
};

function fmtRow(label: string, value?: string | number | null): string {
  if (value === null || value === undefined || value === "") return "";
  return `${label}: ${value}\n`;
}

export function buildTrainerBookingEmail(d: BookingEmailData): {
  subject: string;
  text: string;
  html: string;
} {
  const subject = `New Session Booking — ${d.clientName} | ${d.date} at ${d.time12}`;

  const text =
    `New session booking received.\n\n` +
    `=== CLIENT ===\n` +
    fmtRow("Name", d.clientName) +
    fmtRow("Email", d.clientEmail) +
    fmtRow("Phone", d.clientPhone) +
    `\n=== SESSION ===\n` +
    fmtRow("Date", d.date) +
    fmtRow("Time", `${d.time12} (1 hour)`) +
    fmtRow("Session Focus", d.sessionFocusLabel) +
    fmtRow("Training Goal", d.trainingGoalLabel) +
    fmtRow("Session Type", d.sessionTypeLabel) +
    fmtRow("Level", d.trainingLevel) +
    (d.clientNotes ? `\nClient Notes:\n${d.clientNotes}\n` : "") +
    `\n=== PACKAGE ===\n` +
    fmtRow("Package", d.packageName) +
    fmtRow("Start Date", d.packageStartDate) +
    fmtRow("Expiry Date", d.packageExpiryDate) +
    fmtRow("Current Session", d.currentSessionNumber) +
    fmtRow("Total Sessions", d.totalSessions) +
    fmtRow("Remaining After This", d.remainingSessions) +
    `\n--\nSession is 1 hour. Booking respects the 6-hour cancellation rule.\n` +
    `Sent automatically by Youssef Fitness booking system.`;

  const html =
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.55;color:#111;max-width:600px">` +
    `<h2 style="margin:0 0 16px;color:#0a7d4f">New Session Booking</h2>` +
    `<p style="margin:0 0 20px;font-size:14px;color:#555">${d.clientName} — ${d.date} at ${d.time12}</p>` +
    htmlSection("Client", [
      ["Name", d.clientName],
      ["Email", d.clientEmail],
      ["Phone", d.clientPhone],
    ]) +
    htmlSection("Session", [
      ["Date", d.date],
      ["Time", `${d.time12} (1 hour)`],
      ["Focus", d.sessionFocusLabel],
      ["Goal", d.trainingGoalLabel],
      ["Type", d.sessionTypeLabel],
      ["Level", d.trainingLevel],
    ]) +
    (d.clientNotes
      ? `<div style="margin:0 0 16px;padding:12px 14px;background:#fffbe6;border-left:3px solid #f0c000;border-radius:6px;font-size:14px"><strong>Client Notes</strong><br>${escapeHtml(d.clientNotes)}</div>`
      : "") +
    htmlSection("Package", [
      ["Package", d.packageName],
      ["Start", d.packageStartDate],
      ["Expiry", d.packageExpiryDate],
      ["Session #", d.currentSessionNumber != null ? `${d.currentSessionNumber} of ${d.totalSessions ?? "?"}` : null],
      ["Remaining After This", d.remainingSessions],
    ]) +
    `<p style="font-size:12px;color:#888;margin-top:24px;border-top:1px solid #eee;padding-top:12px">Session is 1 hour. Booking respects the 6-hour cancellation rule.<br>Sent automatically by Youssef Fitness booking system.</p>` +
    `</div>`;

  return { subject, text, html };
}

export function buildClientBookingEmail(
  d: BookingEmailData,
  i18n: {
    subject: string;        // "Booking confirmed — {date} at {time}"
    greeting: string;       // "Hi {name},"
    intro: string;          // "Your session is booked. Here are your details:"
    dateLabel: string;
    timeLabel: string;
    focusLabel: string;
    goalLabel: string;
    packageLabel: string;
    remainingLabel: string;
    expiresLabel: string;
    rulesHeading: string;
    rule1: string;          // "Each session is 1 hour."
    rule2: string;          // "Cancel or reschedule at least 6 hours in advance."
    rule3: string;          // "Any extra time requires prior agreement with Youssef."
    closing: string;        // "See you soon, Youssef Fitness"
  },
): { subject: string; text: string; html: string } {
  const subject = i18n.subject
    .replace("{date}", d.date)
    .replace("{time}", d.time12);

  const greeting = i18n.greeting.replace("{name}", d.clientName);

  const text =
    `${greeting}\n\n${i18n.intro}\n\n` +
    fmtRow(i18n.dateLabel, d.date) +
    fmtRow(i18n.timeLabel, d.time12) +
    fmtRow(i18n.focusLabel, d.sessionFocusLabel) +
    fmtRow(i18n.goalLabel, d.trainingGoalLabel) +
    (d.packageName ? fmtRow(i18n.packageLabel, d.packageName) : "") +
    (d.remainingSessions != null ? fmtRow(i18n.remainingLabel, d.remainingSessions) : "") +
    (d.packageExpiryDate ? fmtRow(i18n.expiresLabel, d.packageExpiryDate) : "") +
    `\n${i18n.rulesHeading}\n• ${i18n.rule1}\n• ${i18n.rule2}\n• ${i18n.rule3}\n\n${i18n.closing}`;

  const html =
    `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#111;max-width:600px">` +
    `<p style="margin:0 0 16px">${escapeHtml(greeting)}</p>` +
    `<p style="margin:0 0 16px">${escapeHtml(i18n.intro)}</p>` +
    htmlSection("", [
      [i18n.dateLabel, d.date],
      [i18n.timeLabel, d.time12],
      [i18n.focusLabel, d.sessionFocusLabel],
      [i18n.goalLabel, d.trainingGoalLabel],
      [i18n.packageLabel, d.packageName],
      [i18n.remainingLabel, d.remainingSessions],
      [i18n.expiresLabel, d.packageExpiryDate],
    ]) +
    `<div style="margin-top:18px;padding:14px 16px;background:#f4f7fb;border-radius:8px;font-size:14px">` +
    `<strong>${escapeHtml(i18n.rulesHeading)}</strong>` +
    `<ul style="margin:8px 0 0;padding-left:18px">` +
    `<li>${escapeHtml(i18n.rule1)}</li>` +
    `<li>${escapeHtml(i18n.rule2)}</li>` +
    `<li>${escapeHtml(i18n.rule3)}</li>` +
    `</ul></div>` +
    `<p style="margin-top:22px;color:#444;font-size:14px">${escapeHtml(i18n.closing)}</p>` +
    `</div>`;

  return { subject, text, html };
}

function htmlSection(title: string, rows: Array<[string, string | number | null | undefined]>): string {
  const filled = rows.filter(([, v]) => v !== null && v !== undefined && v !== "");
  if (filled.length === 0) return "";
  const inner = filled
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#666;font-size:13px;vertical-align:top;white-space:nowrap">${escapeHtml(k)}</td><td style="padding:6px 0;font-size:14px;color:#111">${escapeHtml(String(v))}</td></tr>`,
    )
    .join("");
  return `${title ? `<h3 style="margin:18px 0 6px;font-size:13px;text-transform:uppercase;letter-spacing:0.05em;color:#0a7d4f">${escapeHtml(title)}</h3>` : ""}<table style="border-collapse:collapse;width:100%">${inner}</table>`;
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
