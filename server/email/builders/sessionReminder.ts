/**
 * Session reminder — 24h + 1h cadence. Matches PNG reference frame 4.
 *
 * Composition:
 *   - Split hero with photo right. Title shifts per kind.
 *   - 2-column infoCard with session details.
 *   - "What to bring" icon row.
 *   - Solid cyan CTA: "VIEW BOOKING".
 *   - Support row.
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

export type ReminderKind = "24h" | "1h";

export interface SessionReminderInput {
  lang: Lang;
  kind: ReminderKind;
  recipientName: string;
  date: string;
  time12: string;
  sessionFocus: string | null;
  location: string;
  bookingUrl: string;
  rescheduleUrl: string;
  supportEmail: string;
  trainerName?: string | null;
  whatsappUrl?: string | null;
  sessionDurationLabel?: string | null;
  packageName?: string | null;
  remainingSessions?: number | null;
  totalSessions?: number | null;
  // Task #55 — Add-to-Calendar links surfaced in the 24h reminder.
  // `googleCalendarUrl` opens Google Calendar's prefilled "add event" UI;
  // `icsUrl` returns an .ics file (Apple Calendar / Outlook). Both are
  // optional — the email renders gracefully when only one or neither
  // is supplied.
  googleCalendarUrl?: string | null;
  icsUrl?: string | null;
}

export function buildSessionReminderEmail(input: SessionReminderInput): ComposedEmail {
  const { lang, kind, date, time12, sessionFocus, location,
    bookingUrl, rescheduleUrl, supportEmail, trainerName, whatsappUrl, sessionDurationLabel,
    packageName, remainingSessions, totalSessions, googleCalendarUrl, icsUrl,
  } = input;
  void rescheduleUrl;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const base = deriveBaseUrl(bookingUrl, rescheduleUrl);
  const whatsHref = whatsappUrl || "https://wa.me/971505394754";

  const isOneHour = kind === "1h";
  const subject = isOneHour
    ? t(`Session in 1 hour — ${time12}`, `جلستك بعد ساعة — ${time12}`)
    : t(`Session tomorrow — ${date} at ${time12}`, `جلستك غداً — ${date} في ${time12}`);
  const preheader = isOneHour
    ? t(`See you at ${time12}. Hydrate, warm up, show up.`, `أراك في ${time12}. اشرب الماء، سخّن، استعد.`)
    : t(`Quick heads-up — your session with Coach Youssef is tomorrow.`, `تذكير سريع — جلستك مع المدرب يوسف غداً.`);

  const trainer = trainerName || t("Youssef Elite", "Youssef Elite");
  const duration = sessionDurationLabel || t("60 minutes", "٦٠ دقيقة");
  const focus = sessionFocus || t("Strength & conditioning", "قوة ولياقة");
  const pkgLabel = packageName || t("Standard 1-on-1", "خاص 1-إلى-1");
  const sessionsLabel = (remainingSessions != null && totalSessions != null)
    ? `${remainingSessions} / ${totalSessions}`
    : (remainingSessions != null ? String(remainingSessions) : t("—", "—"));

  const body = [
    hero({
      lang,
      title: isOneHour ? t("ONE HOUR", "ساعة واحدة") : t("SESSION", "تذكير"),
      accentWord: isOneHour ? t("TO GO", "متبقية") : t("TOMORROW", "بالجلسة"),
      subtitle: isOneHour
        ? t("Hydrate. Warm up. Leave on time. The clock is set.", "اشرب الماء. سخّن. اخرج في الوقت. الساعة جاهزة.")
        : t("Final reminder ships 1 hour before. Reschedule below if anything changed.",
            "ستصلك تذكير أخير قبل ساعة. أعد الجدولة أدناه إذا تغيّر شيء."),
      imageUrl: heroImageUrl("discipline", base),
      imageAlt: t("Laced training shoes on dark polished concrete", "حذاء تدريب على أرضية خرسانية داكنة"),
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
        items: [
          { icon: "waterBottle", label: t("Water bottle", "زجاجة ماء") },
          { icon: "towel", label: t("Towel", "منشفة") },
          { icon: "shoe", label: t("Training shoes", "حذاء تدريب") },
        ],
      }),
    ),
    spacer("s6"),
    section(ctaButton({ href: bookingUrl, label: t("View session details", "عرض تفاصيل الجلسة") })),
    // Task #55 — Add-to-Calendar link (Google deep-link + .ics download).
    // Single small text row so it never competes with the primary CTA
    // above. Hidden entirely when neither URL is supplied.
    (googleCalendarUrl || icsUrl)
      ? section(
          `<div style="text-align:center;font-family:'Inter',system-ui,sans-serif;font-size:13px;color:#9ca3af">`
          + t("Add to calendar:", "أضف إلى التقويم:")
          + (googleCalendarUrl
            ? ` <a href="${googleCalendarUrl}" style="color:#5ee7ff;text-decoration:underline;margin:0 6px">Google</a>`
            : "")
          + (googleCalendarUrl && icsUrl ? `<span style="color:#374151">·</span>` : "")
          + (icsUrl
            ? ` <a href="${icsUrl}" style="color:#5ee7ff;text-decoration:underline;margin:0 6px">${t("Apple / .ics", "آبل / .ics")}</a>`
            : "")
          + `</div>`,
          { topGap: "s4" },
        )
      : "",
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

  return compose({ subject, preheader, lang, severity: "info", bodyHtml: body });
}
