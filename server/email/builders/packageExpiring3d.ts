/**
 * GOLDEN REFERENCE #4 — Package expiring in 3 days (warning).
 *
 * Hero discipline: NO hero (warning, not celebration).
 * CTA discipline: ONE primary "Renew" + one text link to WhatsApp Youssef.
 * Severity: warning banner leads — must surface above the fold.
 * Tone: helpful nudge, not alarm. Keep copy short.
 */

import { compose, type ComposedEmail } from "../composer";
import {
  brandHeader,
  card,
  ctaButton,
  ctaTextLink,
  footer,
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
    section(
      card({
        children: [
          severityBanner({ severity: "warning", title: bannerTitle, body: bannerBody }),
          spacer("s5"),
          textBlock({ text: intro, color: "secondary" }),
          spacer("s4"),
          keyValueList({
            items: [
              { label: t("Package", "الباقة"), value: packageName },
              { label: t("Sessions remaining", "الجلسات المتبقية"), value: String(sessionsRemaining) },
              { label: t("Expires on", "تنتهي في"), value: expiryDate },
            ],
          }),
          spacer("s6"),
          ctaButton({ href: renewUrl, label: t("Renew package", "جدّد الباقة"), variant: "warning" }),
          spacer("s4"),
          ctaTextLink({ href: whatsappUrl, label: t("Need to extend? Message Youssef", "تحتاج تمديد؟ راسل يوسف") }),
        ].join(""),
      }),
    ),
    footer({ lang, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "warning", bodyHtml: body });
}
