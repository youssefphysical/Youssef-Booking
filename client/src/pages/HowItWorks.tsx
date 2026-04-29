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

const STEPS = [
  {
    icon: UserPlus,
    title: "1. Create your account",
    body: "Sign up with your name, contact, area of Dubai, and your training goal (Fat Loss, Muscle Gain, or Body Recomposition). Takes about a minute.",
  },
  {
    icon: ClipboardCheck,
    title: "2. Upload your InBody",
    body: "Add a recent InBody scan during sign-up. We use it as your starting point so every change in fat, muscle, and water is tracked accurately.",
  },
  {
    icon: CalendarDays,
    title: "3. Book a session",
    body: "Pick any available slot from 6 AM to 10 PM. Sessions deduct from your active plan automatically. No active plan? Message Youssef to set one up.",
  },
  {
    icon: ShieldCheck,
    title: "4. Cancel safely if life happens",
    body: "Cancel for free up to 6 hours before. Inside that window, Momentum members and the Elite tiers (Elite, Pro Elite, Diamond Elite) can use a Protected Cancellation, plus Same-Day Adjustments to shift today's session to a different time.",
  },
  {
    icon: TrendingUp,
    title: "5. Watch your progress",
    body: "Your dashboard shows InBody trends, progress photos, and session history. Green means improving, yellow means stable, red means it's slipping — clear signals every week.",
  },
  {
    icon: CreditCard,
    title: "6. Pay your way",
    body: "Confirm payment privately on WhatsApp. Bank details are shared only when needed — never on the public site.",
  },
];

const PLANS = [
  { name: "Single Session", desc: "One session, no commitment" },
  { name: "Essential Plan", desc: "10 sessions" },
  { name: "Progress Plan", desc: "20 sessions" },
  { name: "Elite Plan", desc: "25 sessions" },
  { name: "Duo Performance Plan", desc: "30 sessions, train with a partner" },
  { name: "Intro Assessment Session", desc: "First-time clients only" },
];

const TIERS = [
  {
    name: "Foundation",
    rule: "1 session per week",
    tagline: "A simple starting point to build consistency.",
    perks: [
      "Standard 6-hour cancellation policy",
      "0 Protected Cancellations per month",
      "0 Same-Day Adjustments per month",
    ],
    priority: false,
  },
  {
    name: "Starter",
    rule: "2 sessions per week",
    tagline: "A steady entry level for structured training.",
    perks: [
      "Standard 6-hour cancellation policy",
      "0 Protected Cancellations per month",
      "0 Same-Day Adjustments per month",
    ],
    priority: false,
  },
  {
    name: "Momentum",
    rule: "3 sessions per week",
    tagline: "A strong rhythm for visible progress.",
    perks: [
      "1 Protected Cancellation per month",
      "1 Same-Day Adjustment per month",
      "Standard 6-hour cancellation policy",
    ],
    priority: false,
  },
  {
    name: "Elite",
    rule: "4 sessions per week",
    tagline: "High consistency with priority training support.",
    perks: [
      "2 Protected Cancellations per month",
      "2 Same-Day Adjustments per month",
      "Priority booking",
    ],
    priority: true,
  },
  {
    name: "Pro Elite",
    rule: "5 sessions per week",
    tagline: "Advanced commitment and stronger weekly structure.",
    perks: [
      "2 Protected Cancellations per month",
      "2 Same-Day Adjustments per month",
      "Priority booking",
      "Higher consistency status",
    ],
    priority: true,
  },
  {
    name: "Diamond Elite",
    rule: "6 sessions per week",
    tagline: "The highest consistency level for serious transformation.",
    perks: [
      "2 Protected Cancellations per month",
      "2 Same-Day Adjustments per month",
      "Priority booking",
      "Highest consistency status",
    ],
    priority: true,
  },
];

export default function HowItWorks() {
  return (
    <div className="max-w-5xl mx-auto px-5 pt-24 pb-20">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <p className="text-[10px] uppercase tracking-[0.32em] text-primary/80 font-semibold">
          Personal Training Service
        </p>
        <h1
          className="text-4xl md:text-5xl font-display font-bold text-gradient-blue mt-2"
          data-testid="text-page-title"
        >
          How Youssef Fitness Works
        </h1>
        <p className="text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
          A simple, premium experience from your first sign-up to long-term progress.
          Here's exactly what to expect at every step.
        </p>
      </motion.div>

      {/* Steps */}
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
              <p className="text-sm text-muted-foreground leading-relaxed mt-2">
                {s.body}
              </p>
            </motion.div>
          );
        })}
      </section>

      {/* Plans */}
      <section className="rounded-3xl border border-white/10 bg-card/60 p-8 mb-12">
        <div className="flex items-center gap-3 mb-6">
          <Sparkles className="text-primary" size={20} />
          <h2 className="font-display font-bold text-2xl">Plans</h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-4"
              data-testid={`card-plan-${p.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <p className="font-semibold text-foreground/90">{p.name}</p>
              <p className="text-xs text-muted-foreground mt-1">{p.desc}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-5">
          Pricing is confirmed privately on WhatsApp so Youssef can match the right plan to your goals.
        </p>
      </section>

      {/* Membership Levels */}
      <section
        id="membership-levels"
        className="rounded-3xl border border-white/10 bg-card/60 p-8 mb-12"
      >
        <div className="flex items-center gap-3 mb-2">
          <HeartPulse className="text-primary" size={20} />
          <h2 className="font-display font-bold text-2xl">Membership Levels</h2>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          You choose your level when you sign up by picking your weekly training frequency.
          Each level comes with its own monthly flexibility allowances. To change levels,
          message Youssef on WhatsApp.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {TIERS.map((t) => (
            <div
              key={t.name}
              className="rounded-2xl border border-white/10 bg-white/[0.02] p-5"
              data-testid={`card-tier-${t.name.toLowerCase().replace(/\s+/g, "-")}`}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-display font-bold text-lg">{t.name}</p>
                {t.priority && (
                  <span className="text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-200">
                    Priority
                  </span>
                )}
              </div>
              <p className="text-xs text-primary mt-1">{t.rule}</p>
              <p className="text-xs text-muted-foreground mt-2 italic">{t.tagline}</p>
              <ul className="mt-3 space-y-1.5">
                {t.perks.map((p) => (
                  <li
                    key={p}
                    className="text-xs text-foreground/80 flex gap-2"
                  >
                    <span className="text-primary">•</span>
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Cancellation rules */}
      <section className="rounded-3xl border border-white/10 bg-card/60 p-8 mb-12">
        <div className="flex items-center gap-3 mb-4">
          <ShieldCheck className="text-primary" size={20} />
          <h2 className="font-display font-bold text-2xl">Booking & Cancellation Rules</h2>
        </div>
        <ul className="space-y-3 text-sm text-foreground/90">
          <li className="flex gap-3">
            <span className="text-primary mt-1">•</span>
            <span>
              <strong>6+ hours before your session:</strong> cancel for free, no charge.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary mt-1">•</span>
            <span>
              <strong>Less than 6 hours:</strong> the session is normally counted. Use a{" "}
              <em>Protected Cancellation</em> from your monthly quota to keep it free.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary mt-1">•</span>
            <span>
              <strong>Same-Day Adjustment:</strong> shift today's session to a different time the
              same day, as long as it's at least 1 hour before the original slot. Uses a separate
              monthly quota.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="text-primary mt-1">•</span>
            <span>
              <strong>Sessions run 6 AM – 10 PM.</strong> The very last slot is 10–11 PM.
            </span>
          </li>
        </ul>
      </section>

      {/* CTA */}
      <div className="rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-8 text-center">
        <h2 className="font-display font-bold text-2xl">Ready to start?</h2>
        <p className="text-sm text-muted-foreground mt-2 mb-6 max-w-md mx-auto">
          Create your account and book your first session, or message Youssef directly.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/auth"
            data-testid="link-cta-signup"
            className="inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
          >
            Create Account <ArrowRight size={16} />
          </Link>
          <WhatsAppButton
            label="Talk to Youssef"
            message="Hi Youssef, I read the How it Works guide and I'd like to start training."
            testId="button-cta-whatsapp"
          />
        </div>
      </div>
    </div>
  );
}
