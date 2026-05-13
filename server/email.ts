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
// Display name uses the elite-coaching brand identity — inboxes show
// "Youssef Ahmed | Elite Coaching" for premium client perception. The
// address half MUST live on a domain that is fully verified in Resend
// (SPF + DKIM + DMARC). Override via EMAIL_FROM. Reply-To defaults to
// trainerEmail() (youssef.physical@gmail.com) so client replies land
// in the trainer's real Gmail inbox.
const FROM_DEFAULT = "Youssef Ahmed | Elite Coaching <bookings@youssef-ahmed.fit>";

/**
 * Returns the bare email address from a "Display <addr@host>" string,
 * or the input unchanged if no angle brackets are present. Used for
 * DNS lookups and bounce-tracking headers.
 */
export function fromAddress(): string {
  const raw = process.env.EMAIL_FROM || FROM_DEFAULT;
  const m = raw.match(/<([^>]+)>/);
  return (m ? m[1] : raw).trim();
}
export function fromDomain(): string {
  const addr = fromAddress();
  const at = addr.lastIndexOf("@");
  return at >= 0 ? addr.slice(at + 1).toLowerCase() : "";
}

export function trainerEmail(): string {
  return process.env.TRAINER_EMAIL || TRAINER_EMAIL_DEFAULT;
}

export type SendResult = { sent: boolean; provider?: string; id?: string; error?: string };

/**
 * In-memory ring buffer of the most recent send attempts. Survives the
 * lifetime of a single Vercel lambda instance (so admins should hit the
 * diagnostic endpoint shortly after a test). Never holds bodies — only
 * recipient, subject, status, and provider error string.
 */
type SendLogEntry = {
  ts: string;
  to: string;
  from: string;
  subject: string;
  sent: boolean;
  provider?: string;
  id?: string;
  error?: string;
};
const SEND_LOG_MAX = 100;
const sendLog: SendLogEntry[] = [];
function pushSendLog(entry: SendLogEntry) {
  sendLog.push(entry);
  if (sendLog.length > SEND_LOG_MAX) sendLog.splice(0, sendLog.length - SEND_LOG_MAX);
}
export function getRecentEmailSends(limit = 50): SendLogEntry[] {
  return sendLog.slice(-Math.max(1, Math.min(SEND_LOG_MAX, limit))).reverse();
}

/**
 * Returns a brief diagnosis of why email might not be deliverable, without
 * exposing any secret values. Safe to surface to admin-only diagnostic
 * endpoints. Returns null when configuration looks complete.
 */
export function emailConfigStatus(): {
  ready: boolean;
  reason?: string;
  from: string;
  hasApiKey: boolean;
  hasCustomFrom: boolean;
} {
  const hasApiKey = !!process.env.RESEND_API_KEY;
  const hasCustomFrom = !!process.env.EMAIL_FROM;
  const from = process.env.EMAIL_FROM || FROM_DEFAULT;
  if (!hasApiKey) {
    return {
      ready: false,
      reason:
        "RESEND_API_KEY missing — set it in Vercel env vars (Settings → Environment Variables) for Production.",
      from,
      hasApiKey,
      hasCustomFrom,
    };
  }
  return { ready: true, from, hasApiKey, hasCustomFrom };
}

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
    // LOUD log — this is the #1 cause of "email never arrived" reports.
    console.warn(
      `[email] NOT SENT — RESEND_API_KEY missing in env. to=${opts.to} subject=${JSON.stringify(opts.subject)}. ` +
        `Set RESEND_API_KEY (and optionally EMAIL_FROM) in Vercel → Project → Settings → Environment Variables.`,
    );
    if (process.env.NODE_ENV !== "production") {
      console.info(`--- Email body to ${opts.to} ---\n${opts.text}`);
    }
    pushSendLog({
      ts: new Date().toISOString(),
      to: opts.to,
      from,
      subject: String(opts.subject).slice(0, 200),
      sent: false,
      error: "RESEND_API_KEY missing",
    });
    return { sent: false, error: "RESEND_API_KEY missing" };
  }

  // Always set Reply-To so client replies route to the trainer's real
  // inbox, not the no-reply sending mailbox. Falls back to the trainer
  // email when the caller didn't supply one (most paths already do).
  const replyTo = opts.replyTo || trainerEmail();

  // Per-send idempotency key so retries cannot deliver duplicates if
  // a transient failure (network blip, Resend 502) caused us to retry
  // after Resend already accepted the message. Resend honours the
  // standard Idempotency-Key HTTP header.
  const idempotencyKey = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

  // Anti-spam / deliverability headers:
  // - Auto-Submitted (RFC 3834): tells receiving servers + clients that
  //   this is an automated transactional message and they should NOT
  //   trigger auto-replies / vacation responders. Improves rep with
  //   Gmail / Outlook + suppresses bounce loops.
  // - X-Entity-Ref-ID: per-send unique id so support can correlate a
  //   user-reported "didn't get the email" with a specific send.
  // - List-Unsubscribe / List-Unsubscribe-Post: even on transactional
  //   mail, Gmail explicitly recommends including these — they unlock
  //   the native one-click unsubscribe UX and improve sender score.
  const refId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const unsubMail = `mailto:${trainerEmail()}?subject=unsubscribe`;
  const headers: Record<string, string> = {
    "Auto-Submitted": "auto-generated",
    "X-Entity-Ref-ID": refId,
    "List-Unsubscribe": `<${unsubMail}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };

  // Retry policy:
  //   - Up to 3 total attempts (initial + 2 retries).
  //   - Backoff: 250ms, 1000ms.
  //   - Retryable: network exception, HTTP 408/425/429/500/502/503/504.
  //   - Non-retryable: any other 4xx (validation, unverified domain,
  //     suppressed recipient) — retrying won't help and wastes quota.
  //   - Idempotency-Key prevents duplicate delivery if Resend accepted
  //     a previous attempt that timed out on our side.
  const safeSubject = String(opts.subject)
    .replace(/[\r\n\u0000-\u001f]+/g, " ")
    .trim()
    .slice(0, 250);
  const payload = JSON.stringify({
    from,
    to: [opts.to],
    subject: safeSubject,
    text: opts.text,
    html: opts.html,
    reply_to: replyTo,
    headers,
    tags: [
      { name: "category", value: "transactional" },
      { name: "app", value: "youssef-fitness" },
    ],
  });
  const MAX_ATTEMPTS = 3;
  const BACKOFF_MS = [250, 1000];
  let lastErr = "unknown";
  let lastStatus: number | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "Idempotency-Key": idempotencyKey,
        },
        body: payload,
      });
      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as { id?: string };
        console.log(
          `[email] sent via Resend id=${data.id ?? "?"} to=${opts.to} attempt=${attempt}`,
        );
        pushSendLog({
          ts: new Date().toISOString(),
          to: opts.to,
          from,
          subject: safeSubject.slice(0, 200),
          sent: true,
          provider: "resend",
          id: data.id,
        });
        return { sent: true, provider: "resend", id: data.id };
      }

      const txt = await res.text().catch(() => "");
      lastStatus = res.status;
      lastErr = `Resend ${res.status}: ${txt.slice(0, 200)}`;
      const retryable =
        res.status === 408 ||
        res.status === 425 ||
        res.status === 429 ||
        (res.status >= 500 && res.status <= 599);
      console.warn(
        `[email] Resend ${res.status} attempt=${attempt}/${MAX_ATTEMPTS} retryable=${retryable} to=${opts.to} from=${from}: ${txt.slice(0, 300)}`,
      );
      if (!retryable || attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    } catch (e: any) {
      // Network / DNS / TLS exception — always retryable.
      lastErr = e?.message || "network error";
      console.warn(
        `[email] Resend request threw attempt=${attempt}/${MAX_ATTEMPTS}: ${lastErr}`,
      );
      if (attempt === MAX_ATTEMPTS) break;
      await new Promise((r) => setTimeout(r, BACKOFF_MS[attempt - 1]));
    }
  }

  pushSendLog({
    ts: new Date().toISOString(),
    to: opts.to,
    from,
    subject: safeSubject.slice(0, 200),
    sent: false,
    provider: "resend",
    error: lastErr + (lastStatus ? ` (final after ${MAX_ATTEMPTS} attempts)` : ""),
  });
  return { sent: false, provider: "resend", error: lastErr };
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


// Legacy buildTrainerBookingEmail / buildClientBookingEmail removed — superseded by
// buildAdminBookingEmail / buildClientBookingConfirmationEmail in ./email-templates.ts


function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
