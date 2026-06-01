import { useQuery } from "@tanstack/react-query";
import { CyanHairline } from "@/components/ui/CyanHairline";
import {
  formatTimeDual,
  isTodayDubai,
  isTomorrowDubai,
  formatWeekdayDubai,
} from "@shared/dates";
import {
  CalendarClock,
  Flame,
  Layers,
  Repeat2,
  Target,
  Trophy,
} from "lucide-react";

export type TodaySummary = {
  nextSession: {
    id: number;
    date: string;
    sessionType: string | null;
  } | null;
  supplementsToday: number;
  waterTargetMl: number | null;
  streakWeeks: number;
  goal: {
    primary: string | null;
    weightStartKg: number | null;
    weightLatestKg: number | null;
    deltaKg: number | null;
  };
};

const GOAL_LABELS: Record<string, string> = {
  weight_loss: "Weight loss",
  muscle_gain: "Muscle gain",
  body_recomposition: "Recomposition",
  athletic_performance: "Performance",
  general_fitness: "General fitness",
  rehabilitation: "Rehabilitation",
};

function formatNextSession(ymd: string, timeSlot?: string | null): string {
  try {
    if (isTodayDubai(ymd)) return `Today \u00b7 ${timeSlot ? formatTimeDual(timeSlot) : ""}`;
    if (isTomorrowDubai(ymd)) return `Tomorrow \u00b7 ${timeSlot ? formatTimeDual(timeSlot) : ""}`;
    return `${formatWeekdayDubai(ymd)} \u00b7 ${timeSlot ? formatTimeDual(timeSlot) : ""}`;
  } catch {
    return ymd;
  }
}

function Stat({
  icon: Icon,
  label,
  value,
  sub,
  tone = "text-foreground",
  testId,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  sub?: string | null;
  tone?: "text-foreground" | "text-primary";
  testId: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-[1.1rem] min-h-[5.25rem] transition-colors hover:bg-white/[0.06] hover:border-primary/20"
      data-testid={testId}
    >
      <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/[0.08] ring-1 ring-primary/25 text-primary">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="tron-eyebrow text-[10px] font-semibold">{label}</p>
        <p
          className={`mt-0.5 text-base font-display font-semibold tabular-nums leading-tight break-words line-clamp-2 ${tone}`}
          data-testid={`${testId}-value`}
        >
          {value}
        </p>
        {sub ? <p className="text-[11px] text-muted-foreground/80 mt-0.5 leading-snug line-clamp-2">{sub}</p> : null}
      </div>
    </div>
  );
}

interface TodayHeroProps {
  name?: string | null;
  sessionsLeft?: number | null;
  weeklyTarget?: number | null;
}

export function TodayHero({ name, sessionsLeft, weeklyTarget }: TodayHeroProps) {
  const { data, isLoading } = useQuery<TodaySummary>({ queryKey: ["/api/me/today"] });

  if (isLoading || !data) {
    return (
      <div
        className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-card/40 p-6"
        data-testid="today-hero-loading"
      >
        <CyanHairline inset="inset-x-6" />
        <div className="h-5 w-40 admin-shimmer rounded" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 admin-shimmer rounded-2xl" />
          ))}
        </div>
      </div>
    );
  }

  const goalLabel = data.goal.primary ? (GOAL_LABELS[data.goal.primary] ?? data.goal.primary) : "Set your goal";
  const goalSub =
    data.goal.deltaKg != null
      ? `${data.goal.deltaKg > 0 ? "+" : ""}${data.goal.deltaKg.toFixed(1)} kg since start`
      : data.goal.weightLatestKg != null
        ? `${data.goal.weightLatestKg.toFixed(1)} kg latest`
        : null;

  const streakValue = data.streakWeeks > 0 ? `${data.streakWeeks} wk` : "—";
  const streakSub = data.streakWeeks > 0 ? "Consecutive active weeks" : "Start a streak this week";

  const sessionValue = data.nextSession ? formatNextSession(data.nextSession.date, null) : "Nothing booked";
  const sessionSub = data.nextSession?.sessionType ?? "Book your next session";

  const sessLeftValue = sessionsLeft != null ? `${sessionsLeft}` : "—";
  const sessLeftSub = sessionsLeft == null ? "No active package" : sessionsLeft === 1 ? "Session remaining" : "Sessions remaining";

  const weeklyGoalValue = weeklyTarget ? `${weeklyTarget}×/wk` : "—";
  const weeklyGoalSub = weeklyTarget ? "Weekly target" : "Not set";

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-card/40 p-5 sm:p-6"
      data-testid="today-hero"
    >
      <CyanHairline intensity="strong" inset="inset-x-6" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full opacity-40"
        style={{
          background:
            "radial-gradient(circle, hsl(183 100% 55% / 0.10), transparent 70%)",
        }}
      />

      <header className="relative flex items-end justify-between gap-3">
        <div>
          <p className="tron-eyebrow text-[10px] font-semibold">Today</p>
          <h2 className="mt-1 text-xl font-display font-bold sm:text-2xl">
            {name ? `Hey ${name.split(" ")[0]},` : "Welcome back,"}{" "}
            <span className="text-muted-foreground">here's your snapshot</span>
          </h2>
        </div>
        {data.streakWeeks >= 4 ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-200"
            data-testid="badge-streak-flame"
          >
            <Flame size={12} /> {data.streakWeeks}-week streak
          </span>
        ) : null}
      </header>

      <div className="relative mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={CalendarClock}
          label="Next session"
          value={sessionValue}
          sub={sessionSub}
          tone="text-primary"
          testId="stat-next-session"
        />
        <Stat
          icon={Layers}
          label="Sessions left"
          value={sessLeftValue}
          sub={sessLeftSub}
          tone={sessionsLeft != null && sessionsLeft <= 3 ? "text-primary" : "text-foreground"}
          testId="stat-sessions-left"
        />
        <Stat
          icon={Repeat2}
          label="Weekly goal"
          value={weeklyGoalValue}
          sub={weeklyGoalSub}
          testId="stat-weekly-goal"
        />
        <Stat
          icon={Trophy}
          label="Streak"
          value={streakValue}
          sub={streakSub}
          testId="stat-streak"
        />
      </div>

      <div
        className="relative mt-4 flex items-center gap-2 rounded-2xl border border-primary/15 bg-primary/[0.04] p-3"
        data-testid="goal-progress-badge"
      >
        <Target size={14} className="text-primary shrink-0" />
        <p className="text-sm">
          <span className="text-muted-foreground">Goal:</span>{" "}
          <span className="font-medium">{goalLabel}</span>
        </p>
        {goalSub ? (
          <p className="ms-auto text-xs text-muted-foreground tabular-nums">{goalSub}</p>
        ) : null}
      </div>
    </section>
  );
}
