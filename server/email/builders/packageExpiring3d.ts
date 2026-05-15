/**
 * GOLDEN REFERENCE #4 — Package expiring in 3 days (warning).
 *
 * Cinematic v2 treatment:
 *   - NO hero image — warning emails stay direct (image-free, banner-led).
 *     The cinematic atmosphere lives in the type band of the existing
 *     hero primitive, but we lean on a smaller "alert hero" without an
 *     image so the warning banner reads first.
 *   - Card with warning banner + key-value details.
 *   - Billboard CTA section in warning variant.
 *
 * Hero discipline: NO hero image (warning, not celebration).
 * CTA discipline: ONE primary "Renew" (warning variant) + WhatsApp text link.
 * Severity: warning banner leads — must surface above the fold.
 */

import { compose, type ComposedEmail } from "../composer";
import {
  brandHeader,
  card,
  ctaButton,
  ctaSection,
  footer,
  hero,
  keyValueList,
  section,
  severityBanner,
  spacer,
  textBlock,
} from "../components";
import type { Lang } from "../tokens";

export interface PackageExpiring3dInput {
  lang: Lang;
  recipientName: string;
  packageName: string;
  sessionsRemaining: number;
  expiryDate: string;          // e.g. "Sun, 18 May 2026"
  renewUrl: string;
  whatsappUrl: string;
  supportEmail: string;
}

export function buildPackageExpiring3dEmail(input: PackageExpiring3dInput): ComposedEmail {
  const { lang, recipientName, packageName, sessionsRemaining, expiryDate, renewUrl, whatsappUrl, supportEmail } = input;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const subject = t(`${packageName} expires in 3 days`, `${packageName} تنتهي خلال 3 أيام`);
  const preheader = t(
    `${sessionsRemaining} sessions left. Renew to keep your momentum.`,
    `تبقى ${sessionsRemaining} جلسة. جدّد للحفاظ على استمراريتك.`,
  );

  const bannerTitle = t("Package expires in 3 days", "تنتهي الباقة خلال 3 أيام");
  const bannerBody = t(
    "Renew now to lock in your next block at the same rate. Unused sessions don't roll over.",
    "جدّد الآن للحفاظ على نفس السعر للمرحلة التالية. الجلسات غير المستخدمة لا تُرحَّل.",
  );
  const intro = t(
    `Hi ${recipientName} — heads-up before your current block wraps:`,
    `مرحباً ${recipientName} — تنبيه قبل انتهاء باقتك الحالية:`,
  );

  const body = [
    brandHeader(),
    // Lightweight type-only hero — no image, just cinematic typographic
    // anchor for the warning. Keeps urgency front-and-center.
    hero({
      eyebrow: t("HEADS UP", "تنبيه"),
      title: t("3 DAYS", "٣ أيام"),
      accentWord: t("LEFT", "متبقية"),
      subtitle: t(
        `${sessionsRemaining} sessions remaining on your ${packageName}. Renew to keep training without a gap.`,
        `تبقى ${sessionsRemaining} جلسة من ${packageName}. جدّد لتستمر في التدريب دون انقطاع.`,
      ),
      trailingMeta: t(`EXPIRES · ${expiryDate.toUpperCase()}`, `تنتهي · ${expiryDate}`),
    }),
    section(
      card({
        headerLabel: t("RENEWAL DETAILS", "تفاصيل التجديد"),
        children: [
          severityBanner({ severity: "warning", title: bannerTitle, body: bannerBody }),
          spacer("s6"),
          textBlock({ text: intro, color: "secondary" }),
          spacer("s5"),
          keyValueList({
            items: [
              { label: t("Package", "الباقة"), value: packageName },
              { label: t("Sessions remaining", "الجلسات المتبقية"), value: String(sessionsRemaining) },
              { label: t("Expires on", "تنتهي في"), value: expiryDate },
            ],
          }),
        ].join(""),
      }),
    ),
    spacer("s7"),
    ctaSection({
      eyebrow: t("RENEW NOW", "جدّد الآن"),
      ctaHtml: ctaButton({ href: renewUrl, label: t("Renew package", "جدّد الباقة"), variant: "warning" }),
      supportingLink: { href: whatsappUrl, label: t("Message Youssef", "راسل يوسف") },
    }),
    footer({ lang, supportEmail, whatsappUrl }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "warning", bodyHtml: body });
}
