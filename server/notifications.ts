/**
 * Notifications service: sends welcome emails / SMS after registration.
 * Safe no-ops when no email or SMS provider is configured. Never throws.
 */

const WHATSAPP = "+971505394754";

function welcomeEmailBody(clientName: string) {
  return `Hi ${clientName},

Welcome to Youssef Fitness — I'm happy to have you here.

Your profile has been created successfully, and your InBody scan has been received. I'll review your details and use them to better understand your current condition, goals, and starting point.

Through Youssef Fitness, the goal is to provide you with structured, safe, and result-driven coaching based on your body, your schedule, and your progress.

You can now use your account to:
- Book your training sessions
- View your upcoming sessions
- Track your session balance
- Upload progress photos
- Follow your InBody history

Please remember that cancellations or rescheduling must be made at least 6 hours before your session time. Late cancellations will be counted as used.

If you have any questions, you can contact me directly on WhatsApp:
${WHATSAPP}

Welcome again,
Youssef Ahmed
Youssef Fitness
Certified Personal Trainer | Physical Education Teacher | Movement & Kinesiology Specialist`;
}

function welcomeShortMessage(clientName: string) {
  return `Hi ${clientName}, welcome to Youssef Fitness. Your profile has been created and your InBody scan has been received. You can now book sessions, track your progress, and manage your training through your account. For any questions, WhatsApp: ${WHATSAPP}`;
}

export async function sendWelcomeNotifications({
  clientName,
  email,
  phone,
}: {
  clientName: string;
  email?: string | null;
  phone?: string | null;
}) {
  // Email — only sends if a provider is configured.
  try {
    if (email && process.env.SMTP_HOST && process.env.SMTP_USER) {
      // Provider not wired up here. Log intent only.
      console.info(
        `[notifications] (email) would send welcome to ${email} for ${clientName}`,
      );
    } else {
      console.info(
        `[notifications] (email) skipped — provider not configured. recipient=${email ?? "n/a"}`,
      );
    }
  } catch (e) {
    console.warn("[notifications] welcome email failed:", e);
  }

  // SMS / WhatsApp — only sends if a provider is configured.
  try {
    if (phone && (process.env.TWILIO_ACCOUNT_SID || process.env.WHATSAPP_API_TOKEN)) {
      console.info(
        `[notifications] (sms) would send welcome to ${phone} for ${clientName}`,
      );
    } else {
      console.info(
        `[notifications] (sms) skipped — provider not configured. recipient=${phone ?? "n/a"}`,
      );
    }
  } catch (e) {
    console.warn("[notifications] welcome sms failed:", e);
  }

  // Surface message bodies in dev logs so they are easy to review.
  if (process.env.NODE_ENV !== "production") {
    console.info("--- Welcome Email Body ---\n" + welcomeEmailBody(clientName));
    console.info("--- Welcome Short Message ---\n" + welcomeShortMessage(clientName));
  }
}

export async function sendPasswordResetNotification({
  email,
  resetToken,
}: {
  email: string;
  resetToken?: string;
}) {
  try {
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      console.info(
        `[notifications] (email) would send password reset to ${email}${
          resetToken ? ` token=${resetToken.slice(0, 8)}...` : ""
        }`,
      );
    } else {
      console.info(
        `[notifications] (email) password reset skipped — provider not configured. recipient=${email}`,
      );
    }
  } catch (e) {
    console.warn("[notifications] password reset email failed:", e);
  }
}
