/**
 * Package expiring in 3 days — practical warning, image-free hero.
 *
 * Composition matches the new system: dark hero (text only), 2-col
 * infoCard, solid cyan CTA, support row, centred footer.
 */

import { compose, type ComposedEmail } from "../composer";
import {
  card,
  ctaButton,
  emailFooter,
  hero,
  infoCard,
  section,
  severityBanner,
  spacer,
  supportRow,
} from "../components";
import type { Lang } from "../tokens";

export interface PackageExpiring3dInput {
  lang: Lang;
  recipientName: string;
  packageName: string;
  sessionsRemaining: number;
  expiryDate: string;
  renewUrl: string;
  whatsappUrl: string;
  supportEmail: string;
}

export function buildPackageExpiring3dEmail(input: PackageExpiring3dInput): ComposedEmail {
  const { lang, recipientName, packageName, sessionsRemaining, expiryDate, renewUrl, whatsappUrl, supportEmail } = input;
  void recipientName;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const subject = t(`${packageName} expires in 3 days`, `${packageName} تنتهي خلال 3 أيام`);
  const preheader = t(
    `${sessionsRemaining} sessions left. Renew to keep your momentum.`,
    `تبقى ${sessionsRemaining} جلسة. جدّد للحفاظ على استمراريتك.`,
  );

  const body = [
    hero({
      lang,
      title: t("3 DAYS", "٣ أيام"),
      accentWord: t("LEFT", "متبقية"),
      subtitle: t(
        `${sessionsRemaining} sessions remaining on your ${packageName}. Renew to keep training without a gap.`,
        `تبقى ${sessionsRemaining} جلسة من ${packageName}. جدّد لتستمر في التدريب دون انقطاع.`,
      ),
    }),
    section(
      card({
        headerLabel: t("RENEWAL DETAILS", "تفاصيل التجديد"),
        children: severityBanner({
          severity: "warning",
          title: t("Package expires in 3 days", "تنتهي الباقة خلال 3 أيام"),
          body: t(
            "Renew now to lock in your next block at the same rate. Unused sessions don't roll over.",
            "جدّد الآن للحفاظ على نفس السعر للمرحلة التالية. الجلسات غير المستخدمة لا تُرحَّل.",
          ),
        }),
      }),
    ),
    spacer("s5"),
    section(
      infoCard({
        leftItems: [
          { icon: "package", label: t("Package", "الباقة"), value: packageName },
          { icon: "dumbbell", label: t("Sessions remaining", "الجلسات المتبقية"), value: String(sessionsRemaining) },
          { icon: "calendar", label: t("Expires on", "تنتهي في"), value: expiryDate },
        ],
      }),
    ),
    spacer("s6"),
    section(ctaButton({ href: renewUrl, label: t("Renew package", "جدّد الباقة") })),
    spacer("s6"),
    section(
      supportRow({
        left: {
          icon: "headset",
          title: t("Need help?", "تحتاج مساعدة؟"),
          body: t("Email us at", "راسلنا على"),
          href: `mailto:${supportEmail}`,
          linkLabel: supportEmail,
        },
        right: {
          icon: "whatsapp",
          iconColor: "#25D366",
          title: t("Message Youssef", "راسل يوسف"),
          body: t("Reach Coach Youssef on", "تواصل مع المدرب يوسف على"),
          href: whatsappUrl,
          linkLabel: t("WhatsApp", "واتساب"),
        },
      }),
    ),
    spacer("s5"),
    emailFooter({ lang, whatsappUrl, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "warning", bodyHtml: body });
}
