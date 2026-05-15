/**
 * GOLDEN REFERENCE #1 — Password reset (utility, security primitive).
 *
 * Cinematic v2 treatment (restrained):
 *   - NO hero image (security flow stays direct, not celebratory).
 *   - Type-only hero anchor for brand consistency.
 *   - Card with greeting + intro + inline CTA + expiry note.
 *   - Atmospheric footer.
 *
 * The password reset is a security utility — the brand consistency comes
 * from the shell, brand header, type, and footer. The card stays tight
 * so the action lands above the fold on mobile.
 *
 * Hero discipline: NO hero image (utility flow).
 * CTA discipline: ONE primary action. Token text-link as fallback.
 * Severity: info — but no banner; the heading carries the intent.
 */

import { compose, type ComposedEmail } from "../composer";
import {
  brandHeader,
  card,
  ctaButton,
  ctaTextLink,
  footer,
  heading,
  hero,
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
    // Type-only cinematic anchor — no image, no eyebrow, just the brand
    // typographic discipline so the email feels like part of the world.
    hero({
      eyebrow: t("ACCOUNT SECURITY", "أمان الحساب"),
      title: t("RESET", "إعادة تعيين"),
      accentWord: t("PASSWORD", "كلمة المرور"),
      subtitle: t(
        "A secure link to set a new password.",
        "رابط آمن لتعيين كلمة مرور جديدة.",
      ),
    }),
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
          `<div>${ctaTextLink({ href: resetUrl, label: fallbackLabel })}</div>`,
        ].join(""),
      }),
    ),
    footer({ lang, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "info", bodyHtml: body });
}
