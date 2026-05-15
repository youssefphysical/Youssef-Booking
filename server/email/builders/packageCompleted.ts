/**
 * GOLDEN REFERENCE #3 — Package completed (heavy success milestone).
 *
 * Cinematic v2 treatment:
 *   - Real hero photograph (racked dumbbells under warm spotlight at
 *     dawn) — triumph + reflection atmosphere.
 *   - Card with chip header, metric grid (HUD-tile per metric), pull
 *     quote, divider, and "what next" prose.
 *   - Billboard CTA section: "WHAT'S NEXT" with renew/extend action.
 *   - Atmospheric footer.
 *
 * Hero discipline: HERO with image + accent word — package-completed is
 *   the highest-emotional milestone in the system.
 * CTA discipline: ONE primary "Renew or extend" + one text link to history.
 * Severity: success — celebratory, not just operational.
 */

import { compose, type ComposedEmail } from "../composer";
import {
  brandHeader,
  card,
  ctaButton,
  ctaSection,
  divider,
  footer,
  hero,
  metricGrid,
  pullQuote,
  section,
  sectionEyebrow,
  spacer,
  textBlock,
} from "../components";
import { deriveBaseUrl, heroImageUrl, type Lang } from "../tokens";

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
  const base = deriveBaseUrl(renewUrl, historyUrl);

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
      eyebrow: t("MILESTONE COMPLETE", "إنجاز مكتمل"),
      title: t("PACKAGE", "اكتملت"),
      accentWord: t("COMPLETE", "الباقة"),
      subtitle: t(
        "Consistency, not intensity, builds the body you want. You showed up.",
        "الاستمرار، وليس الشدة، هو ما يبني الجسد الذي تريده. لقد التزمت.",
      ),
      trailingMeta: t(`${packageName.toUpperCase()} · WRAPPED`, `${packageName} · مكتملة`),
      imageUrl: heroImageUrl("triumph", base),
      imageAlt: t(
        "Premium gym at dawn with racked dumbbells under warm spotlight",
        "نادٍ راقٍ في الفجر، أوزان مرتبة تحت إضاءة دافئة",
      ),
    }),
    section(
      card({
        headerLabel: t("YOUR BLOCK · BY THE NUMBERS", "كتلتك التدريبية · بالأرقام"),
        children: [
          textBlock({ text: intro, color: "secondary", size: "bodyLg" }),
          spacer("s6"),
          metricGrid({
            items: [
              { label: t("Sessions", "الجلسات"), value: String(sessionsCompleted) },
              { label: t("Weeks active", "أسابيع التدريب"), value: String(weeksActive) },
              { label: t("Attendance", "الحضور"), value: `${attendanceRate}%` },
              { label: t("Best streak", "أطول سلسلة"), value: `${streakWeeks}w` },
            ],
          }),
          spacer("s6"),
          pullQuote({
            text: t(
              "You didn't outsource the work. You showed up and the body responded.",
              "لم تفوّض العمل. حضرت، فاستجاب الجسد.",
            ),
            attribution: t("COACH YOUSSEF", "المدرب يوسف"),
          }),
          spacer("s5"),
          divider(),
          spacer("s6"),
          sectionEyebrow({ label: t("WHAT'S NEXT", "ما التالي") }),
          spacer("s5"),
          textBlock({ text: next, color: "secondary" }),
        ].join(""),
      }),
    ),
    spacer("s7"),
    ctaSection({
      eyebrow: t("KEEP THE MOMENTUM", "حافظ على الزخم"),
      ctaHtml: ctaButton({ href: renewUrl, label: t("Renew or extend", "جدّد أو مدّد"), variant: "brand" }),
      supportingLink: { href: historyUrl, label: t("View full package history", "عرض سجل الباقات") },
    }),
    footer({ lang, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "success", bodyHtml: body });
}
