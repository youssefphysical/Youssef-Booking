import { motion } from "framer-motion";
import { UserPlus, Calendar, ClipboardList, Target, TrendingUp } from "lucide-react";
import { useTranslation } from "@/i18n";

/**
 * "Your Journey, Simplified" — 5-step premium timeline. Static (no DB).
 * Desktop: horizontal 5-col grid with thin connecting line.
 * Mobile: vertical stack.
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
    <section className="py-16 md:py-24" id="how-it-works" data-testid="how-it-works-section">
      <div className="max-w-6xl mx-auto px-5 text-center">
        <p className="tron-eyebrow text-[11px] text-primary/90 mb-3">{t("how.eyebrow", "HOW IT WORKS")}</p>
        <h2 className="font-display font-bold text-3xl md:text-4xl">{t("how.title", "Your Journey, Simplified.")}</h2>

        <div className="relative mt-12 grid grid-cols-1 md:grid-cols-5 gap-6 md:gap-4">
          {/* Horizontal connecting line on desktop */}
          <div className="hidden md:block absolute left-[10%] right-[10%] top-7 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" aria-hidden />
          {steps.map((s, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.06 }}
              className="relative flex flex-col items-center text-center"
              data-testid={`how-step-${i}`}
            >
              <div className="relative z-10 w-14 h-14 rounded-full bg-[#0a0f1a] border border-primary/40 flex items-center justify-center text-primary shadow-[0_0_24px_-4px_rgba(56,189,248,0.45)]">
                {s.icon}
              </div>
              <p className="mt-3 text-[11px] uppercase tracking-[0.25em] text-primary/80 font-semibold">
                {s.n}. {s.title}
              </p>
              <p className="mt-2 text-sm text-muted-foreground max-w-[200px] leading-relaxed">
                {s.body}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
