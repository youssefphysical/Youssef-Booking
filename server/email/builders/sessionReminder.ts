/**
 * GOLDEN REFERENCE #7 — Session reminder (24h + 1h cadence).
 *
 * Hero discipline: NO hero (operational reminder, not a milestone).
 * CTA discipline: ONE primary "View booking" + text link to reschedule.
 * Severity: info — high-signal nudge, not alarm.
 * Tone: short, calm, premium. The clock matters more than the copy.
 *
 * The `kind` prop drives subject + banner copy. Both kinds share the same
 * cinematic structure so the user feels the same brand both times.
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

  const isOneHour = kind === "1h";
  const subject = isOneHour
    ? t(`Session in 1 hour — ${time12}`, `جلستك بعد ساعة — ${time12}`)
    : t(`Session tomorrow — ${date} at ${time12}`, `جلستك غداً — ${date} في ${time12}`);
  const preheader = isOneHour
    ? t(`See you at ${time12}. Hydrate, warm up, show up.`, `أراك في ${time12}. اشرب الماء، سخّن، استعد.`)
    : t(`Quick heads-up — your session with Coach Youssef is tomorrow.`, `تذكير سريع — جلستك مع المدرب يوسف غداً.`);

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
    section(
      card({
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
          spacer("s7"),
          ctaButton({ href: bookingUrl, label: ctaLabel, variant: "brand" }),
          spacer("s5"),
          `<div style="text-align:center;">${ctaTextLink({ href: rescheduleUrl, label: rescheduleLabel })}</div>`,
        ].join(""),
      }),
    ),
    footer({ lang, supportEmail, manageUrl: rescheduleUrl }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "info", bodyHtml: body });
}
