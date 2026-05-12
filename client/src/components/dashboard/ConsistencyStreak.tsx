import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { Flame } from "lucide-react";
import { useBookings } from "@/hooks/use-bookings";
import type { Booking } from "@shared/schema";
import type { TodaySummary } from "@/components/TodayHero";
import { useTranslation } from "@/i18n";

// Consistency strip — last 12 weeks as soft glowing dots (Apple Fitness
// "rings" energy, but minimal). A glowing dot = 1+ completed/upcoming
// session that ISO-week. Pure client-side derivation from useBookings.
// Streak number comes from /api/me/today (already loaded).

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

function startOfIsoWeek(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  // ISO week starts Monday.
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day);
  return x.getTime();
}

function nextMilestone(streak: number): { target: number; remaining: number; label: string } {
  const milestones = [4, 8, 12, 26, 52];
  for (const m of milestones) {
    if (streak < m) return { target: m, remaining: m - streak, label: `${m}-week mark` };
  }
  return { target: streak + 1, remaining: 1, label: "next milestone" };
}

export function ConsistencyStreak({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data: bookings = [] } = useBookings({ userId });
  const { data: today } = useQuery<TodaySummary>({ queryKey: ["/api/me/today"] });

  const weeks = useMemo(() => {
    const list = bookings as Booking[];
    const counted: number[] = [];
    const todayWeekStart = startOfIsoWeek(new Date());
    for (let i = 11; i >= 0; i--) {
      const ws = todayWeekStart - i * WEEK_MS;
      const we = ws + WEEK_MS;
      const has = list.some((b) => {
        if (!b.date) return false;
        // Booking.date is "YYYY-MM-DD" — anchor to Dubai (+04:00) for consistency.
        const t = new Date(`${b.date}T00:00:00+04:00`).getTime();
        if (t < ws || t >= we) return false;
        const s = (b.status ?? "").toLowerCase();
        return ["completed", "confirmed", "upcoming"].includes(s);
      });
      counted.push(has ? 1 : 0);
    }
    return counted;
  }, [bookings]);

  const streak = today?.streakWeeks ?? 0;
  const milestone = nextMilestone(streak);

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative h-full overflow-hidden rounded-3xl border border-white/[0.08] bg-card/40 p-6"
      data-testid="consistency-streak"
    >
      <CyanHairline />
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="tron-eyebrow text-[10px] font-semibold">
            {t("dashboard.consistency", "Consistency")}
          </p>
          <h3 className="mt-1.5 text-2xl sm:text-3xl font-display font-bold leading-tight">
            <span data-testid="text-streak-weeks">{streak}</span>{" "}
            <span className="text-base sm:text-lg font-normal text-muted-foreground align-middle">
              {streak === 1 ? "week" : "weeks"}
            </span>
          </h3>
        </div>
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-cyan-500/10 ring-1 ring-cyan-400/40 text-cyan-300">
          <Flame size={18} />
        </div>
      </div>

      {/* 12-week dot strip */}
      <div className="mt-5 flex items-center gap-1.5" aria-label="Last 12 weeks attendance">
        {weeks.map((on, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: 0.05 + i * 0.025 }}
            className={`h-2.5 flex-1 rounded-full ${
              on
                ? "bg-primary shadow-[0_0_10px_-1px_hsl(183_100%_60%/0.65)]"
                : "bg-white/[0.06]"
            }`}
            data-testid={`streak-dot-${i}`}
          />
        ))}
      </div>
      <p className="mt-3 text-[11px] text-muted-foreground">
        {t("dashboard.last12Weeks", "Last 12 weeks")}
      </p>

      <div className="mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-foreground/85">
        <span className="text-primary font-semibold">{milestone.remaining}</span>
        <span className="text-muted-foreground">
          {milestone.remaining === 1 ? "week to" : "weeks to"} {milestone.label}
        </span>
      </div>
    </motion.section>
  );
}
