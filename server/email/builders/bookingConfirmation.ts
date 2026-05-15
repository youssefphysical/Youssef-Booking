/**
 * GOLDEN REFERENCE #2 — Booking confirmation (cinematic milestone).
 *
 * Hero discipline: HERO ALLOWED — booking-confirmed is a moment of
 *   commitment in the user's training journey. Cinematic treatment lifts
 *   the operational confirmation into a brand experience.
 * CTA discipline: ONE primary "View booking" + secondary text link.
 * Severity: success banner — confirms the lock-in.
 * Above-the-fold: hero headline + confirmation banner land first.
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
  severityBanner,
  spacer,
  textBlock,
} from "../components";
import type { Lang } from "../tokens";

export interface BookingConfirmationInput {
  lang: Lang;
  recipientName: string;
  date: string;            // e.g. "Sat, 17 May 2026"
  time12: string;          // e.g. "10:00 AM"
  sessionFocus: string | null;
  trainingGoal: string | null;
  location: string;        // e.g. "Coach Youssef's studio, Dubai Marina"
  bookingUrl: string;
  rescheduleUrl: string;
  supportEmail: string;
  // Optional, additive — surfaced when present, auto-skipped otherwise.
  sessionType?: string | null;
  packageName?: string | null;
  remainingSessions?: number | null;
  totalSessions?: number | null;
  paymentStatus?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
}

export function buildBookingConfirmationEmail(input: BookingConfirmationInput): ComposedEmail {
  const {
    lang, recipientName, date, time12, sessionFocus, trainingGoal, location,
    bookingUrl, rescheduleUrl, supportEmail,
    sessionType, packageName, remainingSessions, totalSessions, paymentStatus,
    clientEmail, clientPhone,
  } = input;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const subject = t(`Session confirmed — ${date} at ${time12}`, `تأكيد الجلسة — ${date} في ${time12}`);
  const preheader = t(
    `Your session with Coach Youssef is locked in. ${date} at ${time12}.`,
    `تم تأكيد جلستك مع المدرب يوسف. ${date} في ${time12}.`,
  );

  const heroEyebrow = t("YOUR NEXT SESSION", "جلستك القادمة");
  const heroTitle = t("SESSION", "تم تأكيد");
  const heroAccent = t("CONFIRMED", "الجلسة");
  const heroSubtitle = t(
    "Locked in. Reminders 24 hours and 1 hour before. See you on the floor.",
    "تم التأكيد. ستصلك تذكيرات قبل 24 ساعة وقبل ساعة. أراك في النادي.",
  );

  const bannerTitle = t(`${date} · ${time12}`, `${date} · ${time12}`);
  const bannerBody = t(
    `Hi ${recipientName} — your session with Coach Youssef is on the schedule.`,
    `مرحباً ${recipientName} — جلستك مع المدرب يوسف مجدولة.`,
  );
  const ctaLabel = t("View booking", "عرض الحجز");
  const rescheduleLabel = t("Need to reschedule?", "إعادة جدولة");

  const body = [
    brandHeader(),
    hero({ eyebrow: heroEyebrow, title: heroTitle, accentWord: heroAccent, subtitle: heroSubtitle }),
    section(
      card({
        children: [
          severityBanner({ severity: "success", title: bannerTitle, body: bannerBody }),
          spacer("s6"),
          keyValueList({
            items: [
              { label: t("Date", "التاريخ"), value: date },
              { label: t("Time · Dubai · GST", "الوقت · دبي · GST"), value: time12 },
              { label: t("Focus", "التركيز"), value: sessionFocus },
              { label: t("Goal", "الهدف"), value: trainingGoal },
              { label: t("Session type", "نوع الجلسة"), value: sessionType ?? null },
              { label: t("Package", "الباقة"), value: packageName ?? null },
              {
                label: t("Sessions remaining", "الجلسات المتبقية"),
                value:
                  remainingSessions != null && totalSessions != null
                    ? `${remainingSessions} ${t("of", "من")} ${totalSessions}`
                    : remainingSessions != null
                      ? String(remainingSessions)
                      : null,
              },
              { label: t("Payment", "الدفع"), value: paymentStatus ?? null },
              { label: t("Location", "المكان"), value: location },
              { label: t("Email", "البريد الإلكتروني"), value: clientEmail ?? null },
              { label: t("Phone", "الهاتف"), value: clientPhone ?? null },
            ],
          }),
          spacer("s7"),
          ctaButton({ href: bookingUrl, label: ctaLabel, variant: "brand" }),
          spacer("s5"),
          textBlock({ text: t("Plans changed?", "تغيرت خططك؟"), size: "bodySm", color: "tertiary", align: "center" }),
          spacer("s2"),
          `<div style="text-align:center;">${ctaTextLink({ href: rescheduleUrl, label: rescheduleLabel })}</div>`,
        ].join(""),
      }),
    ),
    footer({ lang, supportEmail, manageUrl: rescheduleUrl }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "success", bodyHtml: body });
}
