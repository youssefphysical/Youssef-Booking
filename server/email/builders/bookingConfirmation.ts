/**
 * GOLDEN REFERENCE #2 — Booking confirmation (cinematic milestone).
 *
 * Cinematic v2 treatment:
 *   - TRON athletic hero (cyan grid floor + rim-lit power rack) —
 *     anticipation/preparation atmosphere.
 *   - Card carries success banner + key-value details (no CTA inside).
 *   - Billboard CTA section ("LOCKED IN") wraps the View-booking action
 *     in its own atmospheric band.
 *   - Atmospheric footer with WhatsApp/studio lockup.
 *
 * Hero discipline: HERO ALLOWED — booking-confirmed is a moment of
 *   commitment in the user's training journey.
 * CTA discipline: ONE primary "View booking" + secondary text link.
 * Severity: success banner — confirms the lock-in.
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
  const base = deriveBaseUrl(bookingUrl, rescheduleUrl);

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
    hero({
      eyebrow: heroEyebrow,
      title: heroTitle,
      accentWord: heroAccent,
      subtitle: heroSubtitle,
      trailingMeta: t(`${date.toUpperCase()} · ${time12}`, `${date} · ${time12}`),
      imageUrl: heroImageUrl("session", base),
      imageAlt: t(
        "Futuristic luxury gym in TRON aesthetic — cyan grid floor with rim-lit matte black power rack",
        "نادٍ رياضي مستقبلي بطراز ترون — أرضية شبكية سيان مع رف طاقة أسود مضاء بحواف نيون",
      ),
    }),
    section(
      card({
        headerLabel: t("SESSION DETAILS", "تفاصيل الجلسة"),
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
        ].join(""),
      }),
    ),
    spacer("s7"),
    ctaSection({
      eyebrow: t("LOCKED IN", "تم التأكيد"),
      ctaHtml: ctaButton({ href: bookingUrl, label: ctaLabel, variant: "brand" }),
      supportingText: t("Plans changed?", "تغيرت خططك؟"),
      supportingLink: { href: rescheduleUrl, label: rescheduleLabel },
    }),
    footer({ lang, supportEmail, manageUrl: rescheduleUrl, studioLocation: location }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "success", bodyHtml: body });
}
