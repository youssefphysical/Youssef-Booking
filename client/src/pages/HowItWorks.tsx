import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  UserPlus,
  ClipboardCheck,
  CalendarDays,
  ShieldCheck,
  TrendingUp,
  CreditCard,
  HeartPulse,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useTranslation } from "@/i18n";

export default function HowItWorks() {
  const { t } = useTranslation();

  const STEPS = [
    { icon: UserPlus, title: t("howItWorks.step1Title"), body: t("howItWorks.step1Body") },
    { icon: ClipboardCheck, title: t("howItWorks.step2Title"), body: t("howItWorks.step2Body") },
    { icon: CalendarDays, title: t("howItWorks.step3Title"), body: t("howItWorks.step3Body") },
    { icon: ShieldCheck, title: t("howItWorks.step4Title"), body: t("howItWorks.step4Body") },
    { icon: TrendingUp, title: t("howItWorks.step5Title"), body: t("howItWorks.step5Body") },
    { icon: CreditCard, title: t("howItWorks.step6Title"), body: t("howItWorks.step6Body") },
  ];

  const PLANS = [
    { name: t("howItWorks.plan1Name"), desc: t("howItWorks.plan1Desc") },
    { name: t("howItWorks.plan2Name"), desc: t("howItWorks.plan2Desc") },
    { name: t("howItWorks.plan3Name"), desc: t("howItWorks.plan3Desc") },
    { name: t("howItWorks.plan4Name"), desc: t("howItWorks.plan4Desc") },
    { name: t("howItWorks.plan5Name"), desc: t("howItWorks.plan5Desc") },
    { name: t("howItWorks.plan6Name"), desc: t("howItWorks.plan6Desc") },
  ];

  const TIERS = [
    { key: "foundation", name: "Foundation", rule: "1", priority: false },
    { key: "starter", name: "Starter", rule: "2", priority: false },
    { key: "momentum", name: "Momentum", rule: "3", priority: false },
    { key: "elite", name: "Elite", rule: "4", priority: true },
    { key: "pro_elite", name: "Pro Elite", rule: "5", priority: true },
    { key: "diamond_elite", name: "Diamond Elite", rule: "6", priority: true },
  ];

  // Tagline + perks per tier (kept in English for now; brand consistency)
  const TIER_DETAILS: Record<string, { tagline: string; perks: string[] }> = {
    foundation: {
      tagline: "A simple starting point to build consistency.",
      perks: ["Standard 6-hour cancellation policy", "0 Protected Cancellations per month", "0 Same-Day Adjustments per month"],
    },
    starter: {
      tagline: "A steady entry level for structured training.",
      perks: ["Standard 6-hour cancellation policy", "0 Protected Cancellations per month", "0 Same-Day Adjustments per month"],
    },
    momentum: {
      tagline: "A strong rhythm for visible progress.",
      perks: ["1 Protected Cancellation per month", "1 Same-Day Adjustment per month", "Standard 6-hour cancellation policy"],
    },
    elite: {
      tagline: "High consistency with priority training support.",
      perks: ["2 Protected Cancellations per month", "2 Same-Day Adjustments per month", "Priority booking"],
    },
    pro_elite: {
      tagline: "Advanced commitment and stronger weekly structure.",
      perks: ["2 Protected Cancellations per month", "2 Same-Day Adjustments per month", "Priority booking", "Higher consistency status"],
    },
    diamond_elite: {
      tagline: "The highest consistency level for serious transformation.",
      perks: ["2 Protected Cancellations per month", "2 Same-Day Adjustments per month", "Priority booking", "Highest consistency status"],
    },
  };

  return (
    <div className="max-w-5xl mx-auto px-5 pt-24 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <p className="text-[10px] uppercase tracking-[0.32em] text-primary/80 font-semibold">
          {t("nav.brand")}
        </p>
        <h1
          className="text-4xl md:text-5xl font-display font-bold text-gradient-blue mt-2"
          data-testid="text-page-title"
        >
          {t("howItWorks.pageTitle")}
        </h1>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
          {t("howItWorks.intro")}
        </p>
      </motion.div>

      <section className="grid sm:grid-cols-2 gap-4 mb-16">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-3xl border border-white/10 bg-card/60 p-6 hover-elevate"
              data-testid={`card-step-${i + 1}`}
            >
              <div className="w-11 h-11 rounded-2xl bg-primary/15 border border-primary/25 text-primary flex items-center justify-center mb-3">
                <Icon size={20} />
              </div>
              <h3 className="font-display font-bold text-lg">{s.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">{s.body}</p>
            </motion.div>
          );
        })}
      </section>

      <section className="rounded-3xl border border-white/10 bg-card/60 p-8 mb-12">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="text-primary" size={20} />
          <h2 className="font-display font-bold text-2xl">{t("howItWorks.plansTitle")}</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLANS.map((p, i) => (
            <div
              key={i}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              data-testid={`card-plan-${i}`}
            >
              <p className="font-semibold text-foreground/90">{p.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-5">{t("howItWorks.plansNote")}</p>
      </section>

      <section
        id="membership-levels"
        className="rounded-3xl border border-white/10 bg-card/60 p-8 mb-12"
      >
        <div className="flex items-center gap-3 mb-2">
          <HeartPulse className="text-primary" size={20} />
          <h2 className="font-display font-bold text-2xl">{t("howItWorks.tiersTitle")}</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">{t("howItWorks.tiersIntro")}</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TIERS.map((tier) => {
            const details = TIER_DETAILS[tier.key];
            return (
              <div
                key={tier.key}
                className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
                data-testid={`card-tier-${tier.key}`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="font-display font-bold text-lg">{tier.name}</p>
                  {tier.priority && (
                    <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-200">
                      {t("howItWorks.priorityBadge")}
                    </span>
                  )}
                </div>
                <p className="text-xs text-primary mt-1">
                  {tier.rule} {tier.rule === "1" ? "session per week" : "sessions per week"}
                </p>
                <p className="text-xs text-muted-foreground mt-2 italic">{details.tagline}</p>
                <ul className="mt-3 space-y-1.5">
                  {details.perks.map((p) => (
                    <li key={p} className="text-xs text-foreground/80 flex gap-2">
                      <span className="text-primary">•</span>
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="rounded-3xl border border-white/10 bg-card/60 p-8 mb-12">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="text-primary" size={20} />
          <h2 className="font-display font-bold text-2xl">{t("howItWorks.cancelTitle")}</h2>
        </div>
        <ul className="space-y-3 text-sm text-foreground/90">
          <li className="flex gap-3">
            <span className="text-primary mt-1">•</span>
            <span>
              <strong>{t("howItWorks.cancelRule1Strong")}</strong> {t("howItWorks.cancelRule1Body")}
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary mt-1">•</span>
            <span>
              <strong>{t("howItWorks.cancelRule2Strong")}</strong> {t("howItWorks.cancelRule2Body")}
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary mt-1">•</span>
            <span>
              <strong>{t("howItWorks.cancelRule3Strong")}</strong> {t("howItWorks.cancelRule3Body")}
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary mt-1">•</span>
            <span>
              <strong>{t("howItWorks.cancelRule4Strong")}</strong> {t("howItWorks.cancelRule4Body")}
            </span>
          </li>
        </ul>
      </section>

      <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
        <h2 className="font-display font-bold text-2xl">{t("howItWorks.ctaTitle")}</h2>
        <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-md mx-auto">
          {t("howItWorks.ctaBody")}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/auth"
            data-testid="link-cta-signup"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 whitespace-nowrap btn-press"
          >
            {t("howItWorks.ctaCreate")} <ArrowRight size={16} />
          </Link>
          <WhatsAppButton label={t("howItWorks.ctaWa")} message={t("howItWorks.ctaWaMsg")} testId="button-cta-whatsapp" />
        </div>
      </div>
    </div>
  );
}
