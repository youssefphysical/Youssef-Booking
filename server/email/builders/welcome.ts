/**
 * Welcome email — matches PNG reference frame 3.
 *
 * Composition:
 *   - Split hero (text left + gym photo right), "WELCOME TO" white,
 *     "ELITE / COACHING" cyan accent.
 *   - 4-column feature grid (Personalized Coaching, Expert Trainers,
 *     Track & Progress, Support & Accountability).
 *   - "YOUR NEXT STEPS" steps card with 3 chevron-rows.
 *   - Solid cyan CTA: "GO TO DASHBOARD".
 *   - Pull quote attributed to Youssef.
 *   - Centred footer with social icons.
 */

import { compose, type ComposedEmail } from "../composer";
import {
  card,
  ctaButton,
  emailFooter,
  featureGrid,
  hero,
  pullQuote,
  section,
  spacer,
  stepsCard,
} from "../components";
import { deriveBaseUrl, heroImageUrl, type Lang } from "../tokens";

export interface WelcomeInput {
  lang: Lang;
  recipientName: string;
  bookingUrl: string;
  whatsappUrl: string;
  supportEmail: string;
  studioLocation?: string | null;
  trainerName?: string | null;
  dashboardUrl?: string | null;
  instagramUrl?: string | null;
}

export function buildWelcomeEmail(input: WelcomeInput): ComposedEmail {
  const {
    lang, recipientName, bookingUrl, whatsappUrl, supportEmail,
    dashboardUrl, instagramUrl,
  } = input;
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);
  const base = deriveBaseUrl(bookingUrl, whatsappUrl);
  const dashHref = dashboardUrl || bookingUrl;

  const subject = t(
    `Welcome to Elite Coaching, ${recipientName}`,
    `أهلاً بك في إيليت كوتشينج، ${recipientName}`,
  );
  const preheader = t(
    "You've taken the first step. Let's start the transformation.",
    "لقد اتخذت الخطوة الأولى. لنبدأ التحول.",
  );

  const body = [
    hero({
      lang,
      title: t("WELCOME TO", "أهلاً بك في"),
      accentWord: t("ELITE COACHING", "إيليت كوتشينج"),
      subtitle: t(
        "You've just taken the first step towards transforming your life. We're here to guide, support and push you towards becoming the strongest version of yourself.",
        "لقد اتخذت أول خطوة نحو تحويل حياتك. نحن هنا لنرشدك وندعمك ونحفّزك لتصبح أقوى نسخة من نفسك.",
      ),
      imageUrl: heroImageUrl("welcome", base),
      imageAlt: t("Athlete walking through dark gym corridor", "رياضي يمشي في ممر صالة رياضية"),
      // Frame 1 right-side keyword stack — atmospheric brand pillars.
      keywords: [
        t("DISCIPLINE", "انضباط"),
        t("FOCUS", "تركيز"),
        t("CONSISTENCY", "استمرارية"),
        t("RESULTS", "نتائج"),
      ],
    }),
    section(
      featureGrid({
        items: [
          { icon: "person", title: t("Personalized Coaching", "تدريب شخصي"), body: t("Tailored training & nutrition plans just for you.", "خطط تدريب وتغذية مصممة لك.") },
          { icon: "dumbbell", title: t("Expert Trainers", "مدربون خبراء"), body: t("Learn from the best. Always by your side.", "تعلّم من الأفضل، دائماً معك.") },
          { icon: "trendUp", title: t("Track & Progress", "تتبع وتقدّم"), body: t("We track what matters so you see real results.", "نتتبع ما يهم لترى نتائج حقيقية.") },
          { icon: "shield", title: t("Support & Accountability", "دعم ومسؤولية"), body: t("We're with you every step of the way.", "معك في كل خطوة.") },
        ],
      }),
    ),
    spacer("s5"),
    section(
      stepsCard({
        headerLabel: t("YOUR NEXT STEPS", "خطواتك التالية"),
        items: [
          { icon: "clipboard", title: t("Complete your InBody assessment", "أكمل تقييم InBody"), body: t("Help us understand your baseline.", "ساعدنا في فهم نقطة البداية.") },
          { icon: "calendar", title: t("Book your first session", "احجز جلستك الأولى"), body: t("Let's get you started.", "لنبدأ معاً.") },
          { icon: "target", title: t("Follow your personalized plan", "اتبع خطتك الشخصية"), body: t("Stay consistent and trust the process.", "كن ملتزماً وثق بالعملية.") },
        ],
      }),
    ),
    spacer("s5"),
    section(ctaButton({ href: dashHref, label: t("Go to dashboard", "اذهب إلى لوحة التحكم") })),
    spacer("s6"),
    section(card({
      children: pullQuote({
        text: t("The body achieves what the mind believes.", "الجسد يحقق ما يؤمن به العقل."),
        attribution: t("Youssef · Elite Coaching Team", "يوسف · فريق إيليت كوتشينج"),
      }),
    })),
    spacer("s5"),
    emailFooter({ lang, whatsappUrl, instagramUrl: instagramUrl ?? undefined, supportEmail }),
  ].join("");

  return compose({ subject, preheader, lang, severity: "info", bodyHtml: body });
}
