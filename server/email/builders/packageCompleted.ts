/**
 * Package completed — milestone success, mandated frame structure:
 *   hero + infoCard + CTA + supportRow + footer.
 *
 * Completion messaging (sessions, weeks, attendance, streak) is surfaced
 * inside the infoCard as 2-column metric rows so we keep the shared
 * primitive language used by booking + payment.
 */

import { compose, type ComposedEmail } from "../composer";
import {
  ctaButton,
  emailFooter,
  hero,
  infoCard,
  section,
  spacer,
  supportRow,
} from "../components";
import { deriveBaseUrl, heroImageUrl, type Lang } from "../tokens";

export interface PackageCompletedInput {
  lang: Lang;
  recipientName: string;
  packageName: string;
  sessionsCompleted: number;
  weeksActive: number;
  attendanceRate: number;
  streakWeeks: number;
  renewUrl: string;
  historyUrl: string;
  supportEmail: string;
  whatsappUrl?: string | null;
}

export function buildPackageCompletedEmail(input: PackageCompletedInput): ComposedEmail {
  const { lang, recipientName, packageName, sessionsCompleted, weeksActive, attendanceRate, streakWeeks, renewUrl, historyUrl, supportEmail, whatsappUrl } = input;
  void recipientName;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const base = deriveBaseUrl(renewUrl, historyUrl);
  const whatsHref = whatsappUrl || "https://wa.me/971505394754";

  const subject = t(`${packageName} complete — well done`, `${packageName} مكتملة — أحسنت`);
  const preheader = t(
    `${sessionsCompleted} sessions, ${weeksActive} weeks. Here's your package wrap-up.`,
    `${sessionsCompleted} جلسة، ${weeksActive} أسبوع. ملخص باقتك.`,
  );

  const body = [
    hero({
      lang,
      title: t("PACKAGE", "اكتملت"),
      accentWord: t("COMPLETE", "الباقة"),
      subtitle: t(
        "Consistency, not intensity, builds the body you want. You showed up — and the body responded.",
        "الاستمرار، وليس الشدة، هو ما يبني الجسد الذي تريده. لقد التزمت، فاستجاب الجسد.",
      ),
      imageUrl: heroImageUrl("triumph", base),
      imageAlt: t("Premium gym at dawn with racked dumbbells under warm spotlight", "نادٍ راقٍ في الفجر، أوزان مرتبة"),
    }),
    section(
      infoCard({
        headerLabel: t("YOUR BLOCK · BY THE NUMBERS", "كتلتك التدريبية · بالأرقام"),
        leftItems: [
          { icon: "dumbbell", label: t("Package", "الباقة"), value: packageName },
          { icon: "check", label: t("Sessions completed", "الجلسات المكتملة"), value: String(sessionsCompleted) },
          { icon: "calendar", label: t("Weeks active", "أسابيع التدريب"), value: String(weeksActive) },
        ],
        rightItems: [
          { icon: "target", label: t("Attendance", "الحضور"), value: `${attendanceRate}%` },
          { icon: "trendUp", label: t("Best streak", "أطول سلسلة"), value: `${streakWeeks} ${t("weeks", "أسبوع")}` },
          { icon: "shield", label: t("Status", "الحالة"), value: t("Block complete", "كتلة مكتملة") },
        ],
      }),
    ),
    spacer("s6"),
    section(ctaButton({ href: renewUrl, label: t("Renew or extend", "جدّد أو مدّد") })),
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
          title: t("WhatsApp", "واتساب"),
          body: t("Reach Coach Youssef on", "تواصل مع المدرب يوسف على"),
          href: whatsHref,
          linkLabel: t("WhatsApp", "واتساب"),
        },
      }),
    ),
    spacer("s5"),
    emailFooter({ lang, whatsappUrl: whatsHref, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "success", bodyHtml: body });
}
