/**
 * GOLDEN REFERENCE #2 — Booking confirmation (transactional, medium).
 *
 * Hero discipline: NO hero (booking confirm is operational, not a milestone).
 * CTA discipline: ONE primary "View booking" + secondary text link.
 * Severity: success banner — confirms the lock-in.
 * Above-the-fold: confirmation banner + key details must land first.
 */

import { compose, type ComposedEmail } from "../composer";
import {
  brandHeader,
  card,
  ctaButton,
  ctaTextLink,
  footer,
  heading,
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
  // Optional, additive — additional ops fields surfaced in the details list
  // when present. keyValueList already auto-skips null/empty rows so omitting
  // any of these keeps the email visually identical to the golden reference.
  sessionType?: string | null;       // e.g. "Package · 12 sessions" / "Trial" / "Single"
  packageName?: string | null;
  remainingSessions?: number | null; // e.g. 7
  totalSessions?: number | null;     // pairs with remaining for "7 of 12"
  paymentStatus?: string | null;     // e.g. "Paid" / "Pending"
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

  const bannerTitle = t("Your session is confirmed", "تم تأكيد جلستك");
  const bannerBody = t(
    "We've added it to the calendar. You'll get a reminder 24 hours before, and again 1 hour before.",
    "أضفناها إلى التقويم. ستصلك تذكير قبل 24 ساعة، ومرة أخرى قبل ساعة واحدة.",
  );
  const intro = t(
    `Hi ${recipientName} — see you on the floor. Here are your session details:`,
    `مرحباً ${recipientName} — أراك في النادي. تفاصيل الجلسة:`,
  );
  const ctaLabel = t("View booking", "عرض الحجز");
  const rescheduleLabel = t("Need to reschedule?", "تحتاج إعادة جدولة؟");

  const body = [
    brandHeader(),
    section(
      card({
        children: [
          severityBanner({ severity: "success", title: bannerTitle, body: bannerBody }),
          spacer("s5"),
          textBlock({ text: intro, color: "secondary" }),
          spacer("s4"),
          keyValueList({
            items: [
              { label: t("Date", "التاريخ"), value: date },
              { label: t("Time (Dubai · GST)", "الوقت (دبي · GST)"), value: time12 },
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
              { label: t("Payment status", "حالة الدفع"), value: paymentStatus ?? null },
              { label: t("Location", "المكان"), value: location },
              { label: t("Email", "البريد الإلكتروني"), value: clientEmail ?? null },
              { label: t("Phone", "الهاتف"), value: clientPhone ?? null },
            ],
          }),
          spacer("s6"),
          ctaButton({ href: bookingUrl, label: ctaLabel, variant: "brand" }),
          spacer("s4"),
          ctaTextLink({ href: rescheduleUrl, label: rescheduleLabel }),
        ].join(""),
      }),
    ),
    footer({ lang, supportEmail, manageUrl: rescheduleUrl }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "success", bodyHtml: body });
}
