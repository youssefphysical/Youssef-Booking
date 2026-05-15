/**
 * GOLDEN REFERENCE #6 — Welcome email (cinematic onboarding milestone).
 *
 * The first emotional touchpoint of the elite coaching ecosystem. Maximum
 * cinematic treatment — large hero with cyan accent word, an ecosystem
 * orientation card, and a single decisive primary CTA.
 *
 * Hero discipline: HERO with accent word — welcome is one of the highest-
 *   emotional moments in the brand journey.
 * CTA discipline: ONE primary "Book your first session" + WhatsApp text link.
 * Severity: info (no banner — the hero carries the welcome).
 */

import { compose, type ComposedEmail } from "../composer";
import {
  brandHeader,
  card,
  ctaButton,
  ctaTextLink,
  footer,
  hero,
  keyValueList,
  section,
  spacer,
  textBlock,
} from "../components";
import type { Lang } from "../tokens";

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

  const expectations = t(
    "What happens next:",
    "الخطوات التالية:",
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
    }),
    section(
      card({
        children: [
          textBlock({ text: intro, color: "secondary" }),
          spacer("s6"),
          textBlock({ text: expectations, color: "primary", size: "bodySm" }),
          spacer("s4"),
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
          spacer("s7"),
          ctaButton({ href: bookingUrl, label: t("Book first session", "احجز الجلسة الأولى"), variant: "brand" }),
          spacer("s5"),
          textBlock({ text: t("Questions before you book?", "لديك أسئلة قبل الحجز؟"), size: "bodySm", color: "tertiary", align: "center" }),
          spacer("s2"),
          `<div style="text-align:center;">${ctaTextLink({ href: whatsappUrl, label: t("Message Youssef on WhatsApp", "راسل يوسف على واتساب") })}</div>`,
        ].join(""),
      }),
    ),
    footer({ lang, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "info", bodyHtml: body });
}
