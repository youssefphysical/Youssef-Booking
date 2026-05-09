import { motion } from "framer-motion";
import { Dumbbell, Apple, Pill, LineChart, MessageSquare } from "lucide-react";
import { useTranslation } from "@/i18n";

/**
 * "A Complete Coaching System" — Cinematic Refinement Pass (May-2026).
 *
 * Switched from a uniform 5-col card grid to a borderless editorial
 * numbered list. This breaks the dark-card rhythm established by Hero
 * + Philosophy and gives the section a calmer editorial cadence.
 * Items use thin hairline separators and large display numerals
 * instead of full card chrome — luxury through restraint.
 *
 * Other refinements:
 *   • Section py-16 → py-14 on mobile.
 *   • Larger title (text-3xl → md:text-5xl) with tighter tracking.
 *   • Asymmetric ambient glow (right-side) so the section reads as a
 *     fresh visual landmark vs. Philosophy's left-glow.
 */
export function CompleteSystem() {
  const { t } = useTranslation();
  const rows = [
    { icon: <Dumbbell size={22} />, title: t("system.c1.title", "Structured Training"), body: t("system.c1.body", "Programs designed for your level & goals.") },
    { icon: <Apple size={22} />, title: t("system.c2.title", "Nutrition Guidance"), body: t("system.c2.body", "Flexible nutrition plans that fit your life.") },
    { icon: <Pill size={22} />, title: t("system.c3.title", "Coach-Curated Protocols"), body: t("system.c3.body", "Supplements selected for your body.") },
    { icon: <LineChart size={22} />, title: t("system.c4.title", "Real Data Tracking"), body: t("system.c4.body", "InBody, progress photos & performance tracking.") },
    { icon: <MessageSquare size={22} />, title: t("system.c5.title", "Direct Coach Access"), body: t("system.c5.body", "I'm with you every step of the way.") },
  ];

  return (
    <section className="relative py-14 md:py-24" id="complete-system" data-testid="complete-system-section">
      {/* Asymmetric ambient — opposite side from Philosophy for visual rhythm */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_right,rgba(56,189,248,0.10),transparent_55%)]"
        aria-hidden
      />
      <div className="relative max-w-4xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto">
          <p className="tron-eyebrow text-[11px] mb-3">
            {t("system.eyebrow", "WHAT YOU GET")}
          </p>
          <h2 className="font-display font-bold text-3xl md:text-5xl tracking-[-0.02em] leading-[1.05]">
            {t("system.title", "A Complete Coaching System")}
          </h2>
          <p className="mt-4 text-sm md:text-base text-muted-foreground/85 leading-relaxed">
            {t(
              "system.subtitle",
              "Five integrated pillars — quietly engineered, deliberately maintained.",
            )}
          </p>
        </div>

        <ol className="mt-12 md:mt-16">
          {rows.map((r, i) => (
            <motion.li
              key={i}
              initial={{ opacity: 0, y: 10 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.25 }}
              transition={{ delay: i * 0.05, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="group flex items-start gap-4 md:gap-6 py-5 md:py-7 border-b border-white/5 last:border-b-0"
              data-testid={`system-row-${i}`}
            >
              {/* Editorial numeral — hidden on mobile to keep things calm */}
              <span
                className="hidden md:block font-display text-3xl text-primary/45 tabular-nums tracking-tight pt-1 w-12 shrink-0"
                aria-hidden
              >
                {String(i + 1).padStart(2, "0")}
              </span>
              {/* Icon */}
              <span className="w-11 h-11 md:w-12 md:h-12 rounded-xl bg-primary/[0.08] border border-primary/20 flex items-center justify-center text-primary shrink-0">
                {r.icon}
              </span>
              {/* Title + body */}
              <div className="min-w-0 flex-1 pt-0.5">
                <h3 className="font-display font-bold text-base md:text-lg text-foreground/95 leading-snug">
                  {r.title}
                </h3>
                <p className="mt-1.5 text-sm md:text-base text-muted-foreground/85 leading-relaxed">
                  {r.body}
                </p>
              </div>
            </motion.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
