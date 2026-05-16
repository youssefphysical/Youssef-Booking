/**
 * Payment confirmed — matches PNG reference frame 2.
 *
 * Composition (frame-spec):
 *   - Split hero "PAYMENT / CONFIRMED!" with cyan accent + photo right.
 *   - TWO separate cards stacked vertically:
 *       1. Payment Details  (Amount, Method, Payment ID, Date)
 *       2. Package Overview (Package, Sessions, Validity, Start date)
 *   - Commitment banner: cyan check icon + motivational line + CTA pill.
 *   - Solid cyan CTA: "VIEW PACKAGE & BOOK FIRST SESSION".
 *   - Support row.
 *   - Large-variant footer (bigger lockup + larger social icons).
 */

import { compose, type ComposedEmail } from "../composer";
import {
  commitmentBanner,
  ctaButton,
  emailFooter,
  hero,
  infoCard,
  section,
  spacer,
  supportRow,
} from "../components";
import { deriveBaseUrl, heroImageUrl, type Lang } from "../tokens";

export interface PaymentConfirmedInput {
  lang: Lang;
  recipientName: string;
  amount: string;             // pre-formatted (e.g. "AED 2,500")
  paymentMethod?: string | null;
  paymentReference?: string | null;
  paymentDate?: string | null; // pre-formatted
  packageName: string;
  totalSessions?: number | null;
  validityLabel?: string | null;   // e.g. "8 weeks"
  startDate?: string | null;       // pre-formatted
  packageUrl: string;
  bookUrl?: string | null;
  whatsappUrl?: string | null;
  supportEmail: string;
}

export function buildPaymentConfirmedEmail(input: PaymentConfirmedInput): ComposedEmail {
  const {
    lang, recipientName, amount, paymentMethod, paymentReference, paymentDate,
    packageName, totalSessions, validityLabel, startDate,
    packageUrl, bookUrl, whatsappUrl, supportEmail,
  } = input;
  void recipientName;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const base = deriveBaseUrl(packageUrl, bookUrl ?? null);
  const whatsHref = whatsappUrl || "https://wa.me/971505394754";
  const primaryCtaHref = bookUrl || packageUrl;

  const subject = t(`Payment confirmed — ${packageName}`, `تم تأكيد الدفع — ${packageName}`);
  const preheader = t(
    "Your investment is locked in. Let's start the transformation.",
    "تم تأكيد استثمارك. لنبدأ التحول.",
  );

  const body = [
    hero({
      lang,
      title: t("PAYMENT", "تم تأكيد"),
      accentWord: t("CONFIRMED!", "الدفع!"),
      subtitle: t(
        "You've taken the most important step. Your investment in yourself is locked in. Now let's get to work.",
        "لقد اتخذت أهم خطوة. تم تأكيد استثمارك في نفسك. لنبدأ العمل الآن.",
      ),
      imageUrl: heroImageUrl("triumph", base),
      imageAlt: t("Athlete pushing through a deadlift in a premium gym", "رياضي يرفع وزناً في نادٍ راقٍ"),
    }),
    // Side-by-side data card: Payment Details (left) + Package Overview (right).
    section(
      infoCard({
        headerLabel: t("PAYMENT DETAILS", "تفاصيل الدفع"),
        rightHeaderLabel: t("PACKAGE OVERVIEW", "نظرة على الباقة"),
        leftItems: [
          { icon: "creditCard", label: t("Amount", "المبلغ"), value: amount },
          { icon: "shield", label: t("Method", "طريقة الدفع"), value: paymentMethod ?? "—" },
          { icon: "clipboard", label: t("Payment ID", "رقم العملية"), value: paymentReference ?? "—" },
          { icon: "calendar", label: t("Date", "التاريخ"), value: paymentDate ?? "—" },
        ],
        rightItems: [
          { icon: "package", label: t("Package", "الباقة"), value: packageName },
          { icon: "dumbbell", label: t("Sessions", "الجلسات"), value: totalSessions != null ? String(totalSessions) : "—" },
          { icon: "stopwatch", label: t("Validity", "الصلاحية"), value: validityLabel ?? "—" },
          { icon: "target", label: t("Start date", "تاريخ البدء"), value: startDate ?? "—" },
        ],
      }),
    ),
    spacer("s5"),
    section(
      commitmentBanner({
        title: t("Your commitment is locked in.", "تم تأكيد التزامك."),
        body: t(
          "Consistency. Discipline. Transformation. The plan is set — your only job is to show up.",
          "استمرار. انضباط. تحول. الخطة جاهزة — كل ما عليك هو الحضور.",
        ),
        ctaHref: primaryCtaHref,
        ctaLabel: t("I'm ready", "أنا جاهز"),
      }),
    ),
    spacer("s6"),
    section(ctaButton({ href: primaryCtaHref, label: t("View package & book first session", "عرض الباقة وحجز الجلسة الأولى") })),
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
    emailFooter({ lang, whatsappUrl: whatsHref, supportEmail, large: true }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "success", bodyHtml: body });
}
