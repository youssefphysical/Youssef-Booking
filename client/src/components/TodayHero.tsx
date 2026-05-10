import { useQuery } from "@tanstack/react-query";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import {
  CalendarClock,
  Droplets,
  Flame,
  Pill,
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

function formatNextSession(iso: string): string {
  try {
    const d = new Date(iso);
    if (isToday(d)) return `Today · ${format(d, "p")}`;
    if (isTomorrow(d)) return `Tomorrow · ${format(d, "p")}`;
    return `${formatDistanceToNow(d, { addSuffix: true })} · ${format(d, "EEE p")}`;
  } catch {
    return iso;
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
  /** Restricted to two cool tones so the snapshot reads as one
   *  unified HUD instead of a rainbow of pastels. */
  tone?: "text-foreground" | "text-primary";
  testId: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4 transition-colors hover:bg-white/[0.06] hover:border-primary/20"
      data-testid={testId}
    >
      <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-primary/[0.08] ring-1 ring-primary/25 text-primary">
        <Icon size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="tron-eyebrow text-[10px] font-semibold">{label}</p>
        <p
          className={`mt-0.5 truncate text-lg font-display font-semibold tabular-nums ${tone}`}
          data-testid={`${testId}-value`}
        >
          {value}
        </p>
        {sub ? <p className="text-xs text-muted-foreground/85 mt-0.5">{sub}</p> : null}
      </div>
    </div>
  );
}

export function TodayHero({ name }: { name?: string | null }) {
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

  const waterValue = data.waterTargetMl ? `${(data.waterTargetMl / 1000).toFixed(1)} L` : "—";
  const waterSub = data.waterTargetMl ? "Daily target" : "No plan yet";

  const streakValue = data.streakWeeks > 0 ? `${data.streakWeeks} wk` : "—";
  const streakSub = data.streakWeeks > 0 ? "Consecutive active weeks" : "Start a streak this week";

  const sessionValue = data.nextSession ? formatNextSession(data.nextSession.date) : "Nothing booked";
  const sessionSub = data.nextSession?.sessionType ?? "Book your next session";

  const suppValue = `${data.supplementsToday}`;
  const suppSub = data.supplementsToday === 0 ? "No active supplements" : "Active today";

  return (
    <section
      className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-card/40 p-5 sm:p-6"
      data-testid="today-hero"
    >
      {/* Cyan top hairline — consistent HUD signature across the app */}
      <CyanHairline intensity="strong" inset="inset-x-6" />
      {/* Soft cyan corner halo — restrained, AMOLED-friendly */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-56 w-56 rounded-full opacity-50"
        style={{
          background:
            "radial-gradient(circle, hsl(183 100% 55% / 0.12), transparent 70%)",
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
        {/* Streak chip stays amber — semantic (achievement / heat metaphor) */}
        {data.streakWeeks >= 4 ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200"
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
          icon={Pill}
          label="Supplements"
          value={suppValue}
          sub={suppSub}
          testId="stat-supplements-today"
        />
        <Stat
          icon={Droplets}
          label="Water target"
          value={waterValue}
          sub={waterSub}
          testId="stat-water-target"
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
