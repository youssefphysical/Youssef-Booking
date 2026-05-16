/**
 * Booking confirmation — matches PNG reference frame 1.
 *
 * Composition:
 *   - Split hero "SESSION / CONFIRMED" with gym photo on the right.
 *   - 2-column infoCard with Date / Time on left, Location / Trainer on right.
 *   - "What to bring" icon row (Water, Towel, Training shoes).
 *   - Solid cyan CTA: "VIEW BOOKING DETAILS".
 *   - Support row (Need help? · WhatsApp) inside a card.
 *   - Centred footer.
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
  whatToBring,
} from "../components";
import { deriveBaseUrl, heroImageUrl, type Lang } from "../tokens";

export interface BookingConfirmationInput {
  lang: Lang;
  recipientName: string;
  date: string;
  time12: string;
  sessionFocus: string | null;
  trainingGoal: string | null;
  location: string;
  bookingUrl: string;
  rescheduleUrl: string;
  supportEmail: string;
  sessionType?: string | null;
  packageName?: string | null;
  remainingSessions?: number | null;
  totalSessions?: number | null;
  paymentStatus?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  trainerName?: string | null;
  whatsappUrl?: string | null;
  sessionDurationLabel?: string | null;
}

export function buildBookingConfirmationEmail(input: BookingConfirmationInput): ComposedEmail {
  const {
    lang, recipientName, date, time12, sessionFocus, location,
    bookingUrl, rescheduleUrl, supportEmail,
    trainerName, whatsappUrl, sessionDurationLabel,
    packageName, remainingSessions, totalSessions, sessionType,
  } = input;
  void recipientName;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const base = deriveBaseUrl(bookingUrl, rescheduleUrl);
  const whatsHref = whatsappUrl || "https://wa.me/971505394754";

  const subject = t(`Session confirmed — ${date} at ${time12}`, `تأكيد الجلسة — ${date} في ${time12}`);
  const preheader = t(
    `Your session with Coach Youssef is locked in. ${date} at ${time12}.`,
    `تم تأكيد جلستك مع المدرب يوسف. ${date} في ${time12}.`,
  );

  const trainer = trainerName || t("Youssef Ahmed", "يوسف أحمد");
  const duration = sessionDurationLabel || t("60 minutes", "٦٠ دقيقة");
  const focus = sessionFocus || t("Strength & conditioning", "قوة ولياقة");
  const pkgLabel = packageName || t("Standard 1-on-1", "خاص 1-إلى-1");
  const sessionsLabel = (remainingSessions != null && totalSessions != null)
    ? `${remainingSessions} / ${totalSessions}`
    : (remainingSessions != null ? String(remainingSessions) : t("—", "—"));
  const typeLabel = sessionType || t("1-on-1 personal training", "تدريب شخصي خاص");

  const body = [
    hero({
      lang,
      title: t("SESSION", "تم تأكيد"),
      accentWord: t("CONFIRMED", "الجلسة"),
      subtitle: t(
        "Your session is locked in. Reminders ship 24 hours and 1 hour before. See you on the floor.",
        "تم تأكيد جلستك. ستصلك تذكيرات قبل 24 ساعة وقبل ساعة. أراك في النادي.",
      ),
      imageUrl: heroImageUrl("session", base),
      imageAlt: t("Athlete training in a premium gym studio", "رياضي يتدرب في استوديو راقٍ"),
    }),
    section(
      infoCard({
        headerLabel: t("SESSION DETAILS", "تفاصيل الجلسة"),
        leftItems: [
          { icon: "calendar", label: t("Date", "التاريخ"), value: date },
          { icon: "clock", label: t("Time", "الوقت"), value: time12 },
          { icon: "stopwatch", label: t("Duration", "المدة"), value: duration },
          { icon: "dumbbell", label: t("Focus", "التركيز"), value: focus },
        ],
        rightItems: [
          { icon: "location", label: t("Location", "المكان"), value: location },
          { icon: "person", label: t("Trainer", "المدرب"), value: trainer },
          { icon: "package", label: t("Package", "الباقة"), value: pkgLabel },
          { icon: "target", label: t("Remaining sessions", "الجلسات المتبقية"), value: sessionsLabel },
        ],
      }),
    ),
    spacer("s5"),
    section(
      whatToBring({
        headerLabel: t("WHAT TO BRING", "ماذا تحضر"),
        items: [
          { icon: "waterBottle", label: t("Water bottle", "زجاجة ماء") },
          { icon: "towel", label: t("Towel", "منشفة") },
          { icon: "shoe", label: t("Training shoes", "حذاء تدريب") },
        ],
      }),
    ),
    spacer("s6"),
    section(ctaButton({ href: bookingUrl, label: t("Add to calendar", "أضف إلى التقويم") })),
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
