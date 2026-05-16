/**
 * Password reset — utility security flow.
 *
 * Composition: text-only hero, card with greeting + intro + solid cyan
 * CTA + expiry note, footer. No photo (security flow stays direct).
 */

import { compose, type ComposedEmail } from "../composer";
import {
  card,
  ctaButton,
  ctaTextLink,
  emailFooter,
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
  whatsappUrl?: string | null;
}

export function buildPasswordResetEmail(input: PasswordResetInput): ComposedEmail {
  const { lang, recipientName, resetUrl, expiresInMinutes, supportEmail, whatsappUrl } = input;
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

  const body = [
    hero({
      lang,
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
          spacer("s6"),
          ctaButton({ href: resetUrl, label: t("Reset password", "إعادة تعيين") }),
          spacer("s5"),
          textBlock({ text: expiryNote, size: "bodySm", color: "tertiary" }),
          spacer("s3"),
          `<div>${ctaTextLink({ href: resetUrl, label: t("Open the link manually", "افتح الرابط يدوياً") })}</div>`,
        ].join(""),
      }),
    ),
    spacer("s5"),
    emailFooter({ lang, whatsappUrl: whatsappUrl ?? undefined, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "info", bodyHtml: body });
}
