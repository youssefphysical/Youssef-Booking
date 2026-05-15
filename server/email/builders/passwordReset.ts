/**
 * GOLDEN REFERENCE #1 — Password reset (utility, lightweight).
 *
 * Hero discipline: NO hero (security primitive, not a celebration).
 * CTA discipline: ONE primary action. Token text-link as fallback.
 * Severity: info — but no banner needed; the heading carries the intent.
 * Above-the-fold: heading + CTA must land in first viewport on mobile.
 */

import { compose, type ComposedEmail } from "../composer";
import {
  brandHeader,
  card,
  ctaButton,
  ctaTextLink,
  footer,
  heading,
  section,
  spacer,
  textBlock,
} from "../components";
import type { Lang } from "../tokens";

export interface PasswordResetInput {
  lang: Lang;
  recipientName: string;
  resetUrl: string;
  expiresInMinutes: number;
  supportEmail: string;
}

export function buildPasswordResetEmail(input: PasswordResetInput): ComposedEmail {
  const { lang, recipientName, resetUrl, expiresInMinutes, supportEmail } = input;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const subject = t("Reset your password", "إعادة تعيين كلمة المرور");
  const preheader = t(
    `Use the link to set a new password. Expires in ${expiresInMinutes} minutes.`,
    `استخدم الرابط لإعادة تعيين كلمة المرور. تنتهي صلاحيته خلال ${expiresInMinutes} دقيقة.`,
  );

  const greeting = t(`Hi ${recipientName},`, `مرحباً ${recipientName}،`);
  const intro = t(
    "Tap the button below to set a new password. The link expires soon to keep your account secure.",
    "اضغط الزر أدناه لتعيين كلمة مرور جديدة. ينتهي الرابط قريباً للحفاظ على أمان حسابك.",
  );
  const expiryNote = t(
    `For security, this link expires in ${expiresInMinutes} minutes. If you didn't request a reset, you can safely ignore this email.`,
    `لأسباب أمنية، تنتهي صلاحية هذا الرابط خلال ${expiresInMinutes} دقيقة. إذا لم تطلب إعادة التعيين، يمكنك تجاهل هذه الرسالة.`,
  );
  const ctaLabel = t("Reset password", "إعادة تعيين");
  const fallbackLabel = t("Open the link manually", "افتح الرابط يدوياً");

  const body = [
    brandHeader(),
    section(
      card({
        children: [
          heading({ level: 2, text: greeting }),
          spacer("s3"),
          textBlock({ text: intro, color: "secondary" }),
          spacer("s7"),
          ctaButton({ href: resetUrl, label: ctaLabel, variant: "brand" }),
          spacer("s6"),
          textBlock({ text: expiryNote, size: "bodySm", color: "tertiary" }),
          spacer("s4"),
          ctaTextLink({ href: resetUrl, label: fallbackLabel }),
        ].join(""),
      }),
    ),
    footer({ lang, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "info", bodyHtml: body });
}
