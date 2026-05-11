import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { Quote } from "lucide-react";
import type { TodaySummary } from "@/components/TodayHero";
import { useTranslation } from "@/i18n";

// Coach Insight — a single emotional, coach-voice line. The point is
// to feel like a private message from Youssef, NOT a dashboard widget.
// Computed entirely client-side from data the dashboard already loads
// (TodaySummary). Zero new API surface.

function pickInsight(t: TodaySummary | undefined, firstName: string): string {
  if (!t) return `Welcome back, ${firstName}. Let's get to work.`;
  const streak = t.streakWeeks ?? 0;
  const delta = t.goal?.deltaKg ?? null;
  const goal = t.goal?.primary;
  const nextDate = t.nextSession?.date ? new Date(t.nextSession.date) : null;
  const hoursToNext = nextDate ? (nextDate.getTime() - Date.now()) / 3_600_000 : null;

  // Highest-priority moments first.
  if (hoursToNext !== null && hoursToNext > 0 && hoursToNext < 12) {
    return `Lock in tonight, ${firstName}. Your next session is around the corner — sleep, hydrate, show up sharp.`;
  }
  if (streak >= 8) {
    return `${streak} weeks of unbroken consistency. This is no longer motivation — it's identity.`;
  }
  if (streak >= 4) {
    return `Four weeks in and the rhythm is yours. Protect the streak — momentum compounds.`;
  }
  if (goal === "weight_loss" && delta !== null && delta < -1) {
    return `Down ${Math.abs(delta).toFixed(1)} kg and trending. Discipline over motivation. Keep showing up.`;
  }
  if (goal === "muscle_gain" && delta !== null && delta > 1) {
    return `Up ${delta.toFixed(1)} kg of work. Train heavy, eat clean, rest hard. The body responds to consistency.`;
  }
  if (goal === "athletic_performance") {
    return `Train like an athlete today. Quality over quantity — every rep is the reputation.`;
  }
  if (goal === "body_recomposition") {
    return `Recomposition rewards patience. Your body is rebuilding underneath. Stay the course.`;
  }
  if (streak >= 1) {
    return `One brick at a time, ${firstName}. The streak is alive — don't let today break it.`;
  }
  return `New week, ${firstName}. Your only competition is yesterday. Let's begin.`;
}

export function CoachInsightCard({ firstName }: { firstName: string }) {
  const { t: trans } = useTranslation();
  const { data: today } = useQuery<TodaySummary>({ queryKey: ["/api/me/today"] });
  const message = pickInsight(today, firstName);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative mb-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-[#080808]/85 p-6 sm:p-7"
      data-testid="coach-insight-card"
    >
      <CyanHairline />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-12 h-56 w-56 rounded-full opacity-40"
        style={{
          background: "radial-gradient(circle, hsl(183 100% 60% / 0.18), transparent 70%)",
        }}
      />
      <div className="relative flex items-start gap-4">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/40 text-primary">
          <Quote size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="tron-eyebrow text-[10px] font-semibold mb-2">
            {trans("dashboard.coachInsight", "From your coach")}
          </p>
          <p
            className="text-base sm:text-lg font-display font-medium leading-snug text-foreground/95"
            data-testid="text-coach-insight"
          >
            {message}
          </p>
          <p className="mt-3 text-xs text-muted-foreground">— Youssef</p>
        </div>
      </div>
    </motion.section>
  );
}
