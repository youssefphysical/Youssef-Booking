/**
 * GOLDEN REFERENCE #3 — Package completed (heavy success, milestone).
 *
 * Hero discipline: HERO ALLOWED — package-completed is one of the five
 * approved hero categories. Eyebrow + display title + warm subtitle.
 * CTA discipline: ONE primary "Renew or extend" + one text link.
 * Severity: success — celebratory, not just operational.
 * Mobile: hero copy stays compact; metrics stack 2-up → 1-up.
 */

import { compose, type ComposedEmail } from "../composer";
import {
  brandHeader,
  card,
  ctaButton,
  ctaTextLink,
  divider,
  footer,
  hero,
  metricGrid,
  section,
  spacer,
  textBlock,
} from "../components";
import type { Lang } from "../tokens";

export interface PackageCompletedInput {
  lang: Lang;
  recipientName: string;
  packageName: string;          // e.g. "12-Session Premium"
  sessionsCompleted: number;
  weeksActive: number;
  attendanceRate: number;       // 0-100
  streakWeeks: number;
  renewUrl: string;
  historyUrl: string;
  supportEmail: string;
}

export function buildPackageCompletedEmail(input: PackageCompletedInput): ComposedEmail {
  const { lang, recipientName, packageName, sessionsCompleted, weeksActive, attendanceRate, streakWeeks, renewUrl, historyUrl, supportEmail } = input;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const subject = t(`${packageName} complete — well done`, `${packageName} مكتملة — أحسنت`);
  const preheader = t(
    `${sessionsCompleted} sessions, ${weeksActive} weeks. Here's your package wrap-up.`,
    `${sessionsCompleted} جلسة، ${weeksActive} أسبوع. ملخص باقتك.`,
  );

  const intro = t(
    `Hi ${recipientName} — you wrapped your ${packageName}. Here's what that looked like:`,
    `مرحباً ${recipientName} — أنهيت ${packageName}. إليك ما حققته:`,
  );
  const next = t(
    "When you're ready for the next block, renew or extend below. Same trainer, same standard.",
    "عندما تكون مستعداً للمرحلة التالية، يمكنك التجديد أو التمديد أدناه. نفس المدرب، نفس المعايير.",
  );

  const body = [
    brandHeader(),
    hero({
      eyebrow: t("MILESTONE", "إنجاز"),
      title: t("Package complete.", "اكتملت الباقة."),
      subtitle: t(
        "Consistency, not intensity, builds the body you want. You showed up.",
        "الاستمرار، وليس الشدة، هو ما يبني الجسد الذي تريده. لقد التزمت.",
      ),
    }),
    section(
      card({
        children: [
          textBlock({ text: intro, color: "secondary" }),
          spacer("s5"),
          metricGrid({
            items: [
              { label: t("Sessions", "الجلسات"), value: String(sessionsCompleted) },
              { label: t("Weeks active", "أسابيع التدريب"), value: String(weeksActive) },
              { label: t("Attendance", "الحضور"), value: `${attendanceRate}%` },
              { label: t("Best streak", "أطول سلسلة"), value: `${streakWeeks}w` },
            ],
          }),
          spacer("s5"),
          divider(),
          spacer("s5"),
          textBlock({ text: next, color: "secondary" }),
          spacer("s5"),
          ctaButton({ href: renewUrl, label: t("Renew or extend", "جدّد أو مدّد"), variant: "brand" }),
          spacer("s4"),
          ctaTextLink({ href: historyUrl, label: t("View full package history", "عرض سجل الباقات") }),
        ].join(""),
      }),
    ),
    footer({ lang, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "success", bodyHtml: body });
}
