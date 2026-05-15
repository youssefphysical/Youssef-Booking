/**
 * GOLDEN REFERENCE #7 — Session reminder (24h + 1h cadence).
 *
 * Cinematic v2 treatment:
 *   - Real hero photograph (laced training shoes, dark concrete, morning
 *     light) — discipline + cadence atmosphere.
 *   - Card carries info banner + key-value details.
 *   - Billboard CTA section: "ON THE CLOCK" / "ONE HOUR" framing per kind.
 *   - Atmospheric footer.
 *
 * Hero discipline: HERO with image — both reminder kinds get the same
 *   cinematic discipline-themed photograph (the brand reads as one
 *   coherent ecosystem regardless of cadence).
 * CTA discipline: ONE primary "View booking" + text link to reschedule.
 * Severity: info — high-signal nudge, not alarm.
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
import { deriveBaseUrl, heroImageUrl, type Lang } from "../tokens";

export type ReminderKind = "24h" | "1h";

export interface SessionReminderInput {
  lang: Lang;
  kind: ReminderKind;
  recipientName: string;
  date: string;            // e.g. "Sat, 17 May 2026"
  time12: string;          // e.g. "10:00 AM"
  sessionFocus: string | null;
  location: string;
  bookingUrl: string;
  rescheduleUrl: string;
  supportEmail: string;
}

export function buildSessionReminderEmail(input: SessionReminderInput): ComposedEmail {
  const { lang, kind, recipientName, date, time12, sessionFocus, location, bookingUrl, rescheduleUrl, supportEmail } = input;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const base = deriveBaseUrl(bookingUrl, rescheduleUrl);

  const isOneHour = kind === "1h";
  const subject = isOneHour
    ? t(`Session in 1 hour — ${time12}`, `جلستك بعد ساعة — ${time12}`)
    : t(`Session tomorrow — ${date} at ${time12}`, `جلستك غداً — ${date} في ${time12}`);
  const preheader = isOneHour
    ? t(`See you at ${time12}. Hydrate, warm up, show up.`, `أراك في ${time12}. اشرب الماء، سخّن، استعد.`)
    : t(`Quick heads-up — your session with Coach Youssef is tomorrow.`, `تذكير سريع — جلستك مع المدرب يوسف غداً.`);

  const heroEyebrow = isOneHour
    ? t("ONE HOUR", "ساعة واحدة")
    : t("TOMORROW", "غداً");
  const heroTitle = isOneHour
    ? t("SHOW", "حان")
    : t("ON THE", "على");
  const heroAccent = isOneHour
    ? t("UP", "وقت العرض")
    : t("CLOCK", "الموعد");
  const heroSubtitle = isOneHour
    ? t(
        "Hydrate. Warm up. Leave on time. The clock is set.",
        "اشرب الماء. سخّن. اخرج في الوقت. الساعة جاهزة.",
      )
    : t(
        "Final reminder ships 1 hour before the session. Reschedule below if anything changed.",
        "ستصلك تذكير أخير قبل ساعة من الجلسة. أعد الجدولة أدناه إذا تغيّر شيء.",
      );

  const bannerTitle = isOneHour
    ? t("Your session starts in 1 hour", "جلستك تبدأ خلال ساعة")
    : t("Your session is tomorrow", "جلستك غداً");
  const bannerBody = isOneHour
    ? t("Hydrate, light warm-up, leave on time. The clock is set.", "اشرب الماء، تسخين خفيف، اخرج في الوقت. الساعة جاهزة.")
    : t("Final reminder ships 1 hour before. Reschedule below if anything changed.", "ستصلك تذكير أخير قبل ساعة. أعد الجدولة أدناه إذا تغيّر شيء.");

  const intro = t(
    `Hi ${recipientName} — here's your session at a glance:`,
    `مرحباً ${recipientName} — تفاصيل جلستك:`,
  );
  const ctaLabel = t("View booking", "عرض الحجز");
  const rescheduleLabel = t("Need to reschedule?", "إعادة جدولة");

  const body = [
    brandHeader(),
    hero({
      eyebrow: heroEyebrow,
      title: heroTitle,
      accentWord: heroAccent,
      subtitle: heroSubtitle,
      trailingMeta: t(`${date.toUpperCase()} · ${time12}`, `${date} · ${time12}`),
      imageUrl: heroImageUrl("discipline", base),
      imageAlt: t(
        "Laced training shoes on dark polished concrete, morning light",
        "حذاء تدريب على أرضية خرسانية داكنة، إضاءة الصباح",
      ),
    }),
    section(
      card({
        headerLabel: t("SESSION SNAPSHOT", "ملخص الجلسة"),
        children: [
          severityBanner({ severity: "info", title: bannerTitle, body: bannerBody }),
          spacer("s6"),
          textBlock({ text: intro, color: "secondary" }),
          spacer("s5"),
          keyValueList({
            items: [
              { label: t("Date", "التاريخ"), value: date },
              { label: t("Time · Dubai · GST", "الوقت · دبي · GST"), value: time12 },
              { label: t("Focus", "التركيز"), value: sessionFocus },
              { label: t("Location", "المكان"), value: location },
            ],
          }),
        ].join(""),
      }),
    ),
    spacer("s7"),
    ctaSection({
      eyebrow: isOneHour ? t("THE CLOCK IS RUNNING", "الساعة تعمل") : t("STAY READY", "كن جاهزاً"),
      ctaHtml: ctaButton({ href: bookingUrl, label: ctaLabel, variant: "brand" }),
      supportingLink: { href: rescheduleUrl, label: rescheduleLabel },
    }),
    footer({ lang, supportEmail, manageUrl: rescheduleUrl, studioLocation: location }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "info", bodyHtml: body });
}
