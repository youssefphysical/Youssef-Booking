/**
 * Notifications service: sends transactional emails (welcome, password reset)
 * via the premium template system. Safe no-ops when no provider is
 * configured. NEVER throws — caller wraps in try/catch but we belt-and-brace.
 */

import { sendEmail, trainerEmail } from "./email";
import {
  buildWelcomeEmail,
  buildPasswordResetEmail,
  buildAdminNewClientEmail,
} from "./email-templates";

function publicWebsiteUrl(): string {
  return (
    process.env.PUBLIC_APP_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://youssef-booking.vercel.app"
      : `http://localhost:${process.env.PORT || 5000}`)
  ).replace(/\/+$/, "");
}

export async function sendWelcomeNotifications({
  clientName,
  email,
  phone,
  lang,
}: {
  clientName: string;
  email?: string | null;
  phone?: string | null;
  lang?: string | null;
}) {
  if (!email) {
    console.info(`[notifications] welcome skipped — no email. client=${clientName}`);
    return;
  }
  try {
    const built = buildWelcomeEmail({
      clientName,
      lang: lang || "en",
      websiteUrl: publicWebsiteUrl(),
    });
    await sendEmail({
      to: email,
      subject: built.subject,
      text: built.text,
      html: built.html,
      replyTo: trainerEmail(),
    });
  } catch (e) {
    console.warn("[notifications] welcome email failed:", e);
  }

  // SMS / WhatsApp — only sends if a provider is configured. Stubbed.
  if (phone && (process.env.TWILIO_ACCOUNT_SID || process.env.WHATSAPP_API_TOKEN)) {
    console.info(`[notifications] (sms) provider configured but stubbed for ${phone}`);
  }
}

/**
 * Send the trainer an immediate notification that a new client just signed
 * up. Always English. Never blocks registration.
 */
export async function sendAdminNewClientEmail(opts: {
  clientName: string;
  email?: string | null;
  phone?: string | null;
  primaryGoal?: string | null;
  weeklyFrequency?: number | null;
  area?: string | null;
  packageName?: string | null;
  packagePrice?: number | null;
}) {
  try {
    const built = buildAdminNewClientEmail({
      ...opts,
      websiteUrl: publicWebsiteUrl(),
    });
    await sendEmail({
      to: trainerEmail(),
      subject: built.subject,
      text: built.text,
      html: built.html,
      replyTo: opts.email || undefined,
    });
  } catch (e) {
    console.warn("[notifications] admin new-client email failed:", e);
  }
}

export async function sendPasswordResetNotification({
  email,
  resetUrl,
  lang,
}: {
  email: string;
  resetUrl?: string;
  lang?: string | null;
}) {
  if (!resetUrl) {
    console.info(`[notifications] password reset skipped — no reset URL. recipient=${email}`);
    return;
  }
  try {
    const built = buildPasswordResetEmail({
      resetUrl,
      lang: lang || "en",
      websiteUrl: publicWebsiteUrl(),
    });
    await sendEmail({
      to: email,
      subject: built.subject,
      text: built.text,
      html: built.html,
    });
  } catch (e) {
    console.warn("[notifications] password reset email failed:", e);
  }
}
