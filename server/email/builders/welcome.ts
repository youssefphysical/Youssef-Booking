/**
 * GOLDEN REFERENCE #6 — Welcome email (cinematic onboarding milestone).
 *
 * The first emotional touchpoint of the elite coaching ecosystem.
 * Cinematic v2 treatment:
 *   - Real hero photograph (boutique gym at blue hour) — sets the world.
 *   - Section eyebrow rhythm above the orientation list.
 *   - Pull-quote: atmospheric statement of the brand promise.
 *   - Billboard CTA section: "Book your first session" lives in its own
 *     dedicated band, not as a button at the end of a card.
 *   - Atmospheric footer with WhatsApp + studio contact lockup.
 *
 * Hero discipline: HERO with image + accent word — welcome is the highest
 *   emotional moment in the ecosystem.
 * CTA discipline: ONE primary "Book your first session" + WhatsApp text link.
 * Severity: info (no banner — the hero carries the welcome).
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
  pullQuote,
  section,
  sectionEyebrow,
  spacer,
  textBlock,
} from "../components";
import { deriveBaseUrl, heroImageUrl, type Lang } from "../tokens";

export interface WelcomeInput {
  lang: Lang;
  recipientName: string;
  bookingUrl: string;
  whatsappUrl: string;
  supportEmail: string;
  /** Optional first-session orientation details. */
  studioLocation?: string | null;
  trainerName?: string | null;
}

export function buildWelcomeEmail(input: WelcomeInput): ComposedEmail {
  const {
    lang, recipientName, bookingUrl, whatsappUrl, supportEmail,
    studioLocation, trainerName,
  } = input;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const base = deriveBaseUrl(bookingUrl, whatsappUrl);

  const subject = t(
    `Welcome to Youssef Ahmed Elite, ${recipientName}`,
    `أهلاً بك في يوسف أحمد إيليت، ${recipientName}`,
  );
  const preheader = t(
    "Your transformation journey starts here. Book your first session and meet the system.",
    "رحلة التحول تبدأ هنا. احجز جلستك الأولى وتعرّف على النظام.",
  );

  const intro = t(
    `Hi ${recipientName} — you're in. This isn't a generic gym membership. It's a coached, measured, accountable system designed around your transformation.`,
    `مرحباً ${recipientName} — أنت معنا. هذا ليس اشتراك نادٍ تقليدي. إنه نظام مدرَّب ومُقاس ومسؤول، مصمم لتحوّلك.`,
  );

  const body = [
    brandHeader(),
    hero({
      eyebrow: t("YOU'RE IN", "أنت معنا"),
      title: t("WELCOME TO THE", "أهلاً بك في"),
      accentWord: t("ECOSYSTEM", "النظام"),
      subtitle: t(
        "Elite coaching, premium training, measured progress. Your journey starts with one session.",
        "تدريب نخبوي، جلسات متميزة، تقدم مُقاس. رحلتك تبدأ بجلسة واحدة.",
      ),
      trailingMeta: t("DUBAI · ELITE PERSONAL TRAINING", "دبي · تدريب شخصي متميز"),
      imageUrl: heroImageUrl("welcome", base),
      imageAlt: t(
        "Boutique premium gym at blue hour, cinematic dark interior",
        "نادي رياضي راقٍ في الساعة الزرقاء، أجواء داخلية سينمائية",
      ),
    }),
    section(
      card({
        headerLabel: t("ORIENTATION", "التوجيه"),
        children: [
          textBlock({ text: intro, color: "secondary", size: "bodyLg" }),
          spacer("s6"),
          sectionEyebrow({ label: t("WHAT HAPPENS NEXT", "الخطوات التالية") }),
          spacer("s5"),
          keyValueList({
            items: [
              {
                label: t("01 · BOOK", "01 · احجز"),
                value: t(
                  "Pick a slot in the calendar — InBody scan + intake on day one.",
                  "اختر موعداً من التقويم — جلسة InBody واستشارة في اليوم الأول.",
                ),
              },
              {
                label: t("02 · MEET", "02 · قابل"),
                value: t(
                  "We'll set baseline measurements, training goal, and your weekly cadence.",
                  "سنحدد القياسات الأساسية، الهدف التدريبي، وإيقاعك الأسبوعي.",
                ),
              },
              {
                label: t("03 · TRAIN", "03 · تدرّب"),
                value: t(
                  "Coached sessions, tracked progress, monthly check-ins. Show up; we handle the rest.",
                  "جلسات بإشراف مباشر، تتبع للتقدم، مراجعات شهرية. كن حاضراً، ونحن نتولى الباقي.",
                ),
              },
              { label: t("Trainer", "المدرب"), value: trainerName ?? null },
              { label: t("Location", "المكان"), value: studioLocation ?? null },
            ],
          }),
          spacer("s6"),
          pullQuote({
            text: t(
              "Consistency, not intensity, builds the body you want.",
              "الاستمرار، وليس الشدة، هو ما يبني الجسد الذي تريده.",
            ),
            attribution: t("COACH YOUSSEF", "المدرب يوسف"),
          }),
        ].join(""),
      }),
    ),
    spacer("s7"),
    // Billboard CTA — own architectural moment, dedicated band.
    ctaSection({
      eyebrow: t("READY?", "جاهز؟"),
      ctaHtml: ctaButton({
        href: bookingUrl,
        label: t("Book first session", "احجز الجلسة الأولى"),
        variant: "brand",
      }),
      supportingText: t("Questions before you book?", "لديك أسئلة قبل الحجز؟"),
      supportingLink: { href: whatsappUrl, label: t("Message Youssef on WhatsApp", "راسل يوسف على واتساب") },
    }),
    footer({ lang, supportEmail, whatsappUrl, studioLocation: studioLocation ?? undefined }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "info", bodyHtml: body });
}
