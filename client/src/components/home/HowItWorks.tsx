import { motion } from "framer-motion";
import { UserPlus, Calendar, ClipboardList, Target, TrendingUp } from "lucide-react";
import { useTranslation } from "@/i18n";

/**
 * "Your Journey, Simplified" — 5-step premium timeline.
 *
 * Cinematic Refinement Pass (May-2026):
 *   • Section py-16 → py-14 on mobile (scroll-fatigue reduction).
 *   • Larger, tighter-tracked title for editorial cadence.
 *   • Connecting gradient line replaced with a softened cyan beam
 *     (.tron-beam) — sharper at the centre, fading at the edges.
 *   • Step badges quieter — outer ring + glow halved for "premium-quiet".
 *   • Calm subtitle line introduces the journey before the steps.
 */
export function HowItWorks() {
  const { t } = useTranslation();
  const steps = [
    { n: "1", icon: <UserPlus size={20} />, title: t("how.s1.title", "Apply"), body: t("how.s1.body", "Tell me about your goals and lifestyle.") },
    { n: "2", icon: <Calendar size={20} />, title: t("how.s2.title", "Book Session"), body: t("how.s2.body", "We schedule your assessment.") },
    { n: "3", icon: <ClipboardList size={20} />, title: t("how.s3.title", "Assessment"), body: t("how.s3.body", "InBody scan, evaluation & goal setting.") },
    { n: "4", icon: <Target size={20} />, title: t("how.s4.title", "Your Plan"), body: t("how.s4.body", "Training, nutrition & protocols built for you.") },
    { n: "5", icon: <TrendingUp size={20} />, title: t("how.s5.title", "Transform"), body: t("how.s5.body", "Track progress. Stay consistent. Win.") },
  ];

  return (
    <section className="py-14 md:py-24" id="how-it-works" data-testid="how-it-works-section">
      <div className="max-w-6xl mx-auto px-5 text-center">
        <p className="tron-eyebrow text-[11px] mb-3">{t("how.eyebrow", "HOW IT WORKS")}</p>
        <h2 className="font-display font-bold text-3xl md:text-5xl tracking-[-0.02em] leading-[1.05]">
          {t("how.title", "Your Journey, Simplified.")}
        </h2>
        <p className="mt-4 text-sm md:text-base text-muted-foreground/85 max-w-xl mx-auto leading-relaxed">
          {t(
            "how.subtitle",
            "From first message to first result — five calm, deliberate steps.",
          )}
        </p>

        {/* MOBILE — vertical cinematic timeline.
            A glowing cyan rail runs down the start-edge, connecting the
            five step circles. Reads as guided + effortless instead of a
            stack of disconnected cards. */}
        <div className="md:hidden mt-10 max-w-sm mx-auto relative text-start">
          <div
            className="absolute top-7 bottom-7 start-7 w-px bg-gradient-to-b from-primary/0 via-primary/45 to-primary/0"
            aria-hidden
          />
          <div
            className="absolute top-7 bottom-7 start-[27px] w-[3px] bg-primary/20 blur-[3px]"
            aria-hidden
          />
          <ol className="space-y-7">
            {steps.map((s, i) => (
              <motion.li
                key={i}
                initial={{ opacity: 0, x: -8 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, amount: 0.25 }}
                transition={{ delay: i * 0.06 }}
                className="flex gap-5 items-start"
                data-testid={`how-step-${i}`}
              >
                <div className="relative z-10 w-14 h-14 rounded-full bg-[#0a0f1a] border border-primary/35 flex items-center justify-center text-primary shadow-[0_0_22px_-6px_rgba(56,189,248,0.6)] shrink-0">
                  {s.icon}
                </div>
                <div className="flex-1 pt-1">
                  <p className="text-[11px] uppercase tracking-[0.25em] text-primary/85 font-semibold">
                    {s.n}. {s.title}
                  </p>
                  <p className="mt-1.5 text-sm text-muted-foreground/85 leading-relaxed">
                    {s.body}
                  </p>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>

        {/* DESKTOP — horizontal cinematic timeline */}
        <div className="relative mt-16 hidden md:grid grid-cols-5 gap-4">
          <div className="absolute left-[10%] right-[10%] top-7 tron-beam opacity-70" aria-hidden />
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.06 }}
              className="relative flex flex-col items-center text-center"
              data-testid={`how-step-desktop-${i}`}
            >
              <div className="relative z-10 w-14 h-14 rounded-full bg-[#0a0f1a] border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_20px_-6px_rgba(56,189,248,0.5)]">
                {s.icon}
              </div>
              <p className="mt-4 text-[11px] uppercase tracking-[0.25em] text-primary/85 font-semibold">
                {s.n}. {s.title}
              </p>
              <p className="mt-2 text-sm text-muted-foreground/85 max-w-[200px] leading-relaxed">
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
