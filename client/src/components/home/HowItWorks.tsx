import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/i18n";

/**
 * Cinematic How-It-Works — three numbered moments, NO cards.
 *
 * Composition: each step is just a giant "01 / 02 / 03" numeral, a thin
 * amber rule, a title, a body paragraph. They float in the void, separated
 * on desktop by a hairline cyan divider. Replaces the previous 3 white-bg
 * card row with editorial film-storyboard typography.
 */
const STEPS = [
  {
    n: "01",
    titleKey: "howItWorks.step1.title",
    titleFallback: "Choose your goal",
    bodyKey: "howItWorks.step1.body",
    bodyFallback:
      "Fat loss, muscle gain, recomposition, or general performance — pick the outcome that matters to you.",
  },
  {
    n: "02",
    titleKey: "howItWorks.step2.title",
    titleFallback: "Book your session",
    bodyKey: "howItWorks.step2.body",
    bodyFallback:
      "Pick any slot 6 AM to 10 PM. Sessions deduct from your active plan automatically — no admin friction.",
  },
  {
    n: "03",
    titleKey: "howItWorks.step3.title",
    titleFallback: "Track your progress",
    bodyKey: "howItWorks.step3.body",
    bodyFallback:
      "InBody trends, progress photos, weekly check-ins, and full session history — all in your private dashboard.",
  },
] as const;

export function HowItWorks() {
  const { t } = useTranslation();
  return (
    <section
      className="relative max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-28"
      id="how-it-works-teaser"
      data-testid="cinematic-how-it-works"
    >
      <div className="mb-14 sm:mb-16">
        <div className="flex items-center gap-3 mb-5 text-[10px] sm:text-[11px] tracking-[0.32em] uppercase text-white/60">
          <span className="hero-eyebrow-rule" aria-hidden="true" />
          <span>{t("howItWorks.eyebrow", "HOW IT WORKS")}</span>
        </div>
        <h2
          className="font-display font-bold text-white leading-[1.05] tracking-[-0.025em] max-w-3xl"
          style={{ fontSize: "clamp(1.875rem, 4.5vw, 3.5rem)" }}
        >
          {t("howItWorks.title", "Three steps. Then everything changes.")}
        </h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 md:gap-x-10 gap-y-14 md:gap-y-0">
        {STEPS.map((s, i) => (
          <motion.div
            key={s.n}
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.3 }}
            transition={{ delay: i * 0.1, duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className={
              "relative" +
              (i > 0 ? " md:ps-10 md:border-s md:border-white/[0.06]" : "")
            }
            data-testid={`step-${s.n}`}
          >
            <div
              className="font-display font-bold leading-none text-transparent bg-clip-text bg-gradient-to-b from-white/85 to-white/15"
              style={{ fontSize: "clamp(3.25rem, 6vw, 4.75rem)" }}
              aria-hidden="true"
            >
              {s.n}
            </div>
            <div
              className="mt-3 mb-5 h-px w-12"
              style={{
                background:
                  "linear-gradient(90deg, hsl(var(--warm-accent)) 0%, transparent 100%)",
                boxShadow: "0 0 6px rgba(255,184,0,0.34)",
              }}
              aria-hidden="true"
            />
            <h3 className="font-display font-bold text-xl sm:text-2xl text-white leading-tight">
              {t(s.titleKey, s.titleFallback)}
            </h3>
            <p className="mt-3 text-sm sm:text-base text-white/65 leading-[1.6] max-w-md">
              {t(s.bodyKey, s.bodyFallback)}
            </p>
          </motion.div>
        ))}
      </div>

      <div className="mt-14 sm:mt-16 flex justify-center">
        <Link
          href="/how-it-works"
          className="inline-flex items-center gap-2 text-sm tracking-[0.18em] uppercase text-white/65 hover:text-primary transition-colors"
          data-testid="link-how-it-works-full"
        >
          {t("howItWorks.seeAll", "See the full 6-step guide")}
          <ArrowRight size={14} />
        </Link>
      </div>
    </section>
  );
}
