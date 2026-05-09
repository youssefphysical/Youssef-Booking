import { motion } from "framer-motion";
import { Dumbbell, Apple, Pill, LineChart, MessageSquare } from "lucide-react";
import { useTranslation } from "@/i18n";

/**
 * "A Complete Coaching System" — 5 calm premium cards summarising
 * what's included. Static (no DB).
 */
export function CompleteSystem() {
  const { t } = useTranslation();
  const cards = [
    { icon: <Dumbbell size={20} />, title: t("system.c1.title", "Structured Training"), body: t("system.c1.body", "Programs designed for your level & goals.") },
    { icon: <Apple size={20} />, title: t("system.c2.title", "Nutrition Guidance"), body: t("system.c2.body", "Flexible nutrition plans that fit your life.") },
    { icon: <Pill size={20} />, title: t("system.c3.title", "Coach-Curated Protocols"), body: t("system.c3.body", "Supplements selected for your body.") },
    { icon: <LineChart size={20} />, title: t("system.c4.title", "Real Data Tracking"), body: t("system.c4.body", "InBody, progress photos & performance tracking.") },
    { icon: <MessageSquare size={20} />, title: t("system.c5.title", "Direct Coach Access"), body: t("system.c5.body", "I'm with you every step of the way.") },
  ];

  return (
    <section className="py-16 md:py-24" id="complete-system" data-testid="complete-system-section">
      <div className="max-w-6xl mx-auto px-5">
        <div className="text-center max-w-2xl mx-auto">
          <p className="tron-eyebrow text-[11px] text-primary/90 mb-3">
            {t("system.eyebrow", "WHAT YOU GET")}
          </p>
          <h2 className="font-display font-bold text-3xl md:text-4xl">
            {t("system.title", "A Complete Coaching System")}
          </h2>
        </div>

        <div className="mt-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {cards.map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl border border-white/10 bg-gradient-to-b from-white/[0.04] to-white/[0.01] p-5 hover:border-primary/30 transition-colors"
              data-testid={`system-card-${i}`}
            >
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mb-3">
                {c.icon}
              </div>
              <h3 className="font-display font-bold text-sm">{c.title}</h3>
              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
