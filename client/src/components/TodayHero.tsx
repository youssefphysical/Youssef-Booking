import { useQuery } from "@tanstack/react-query";
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
  tone = "text-white",
  testId,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  sub?: string | null;
  tone?: string;
  testId: string;
}) {
  return (
    <div
      className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 hover:bg-white/[0.07] transition"
      data-testid={testId}
    >
      <span className="mt-0.5 grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-500/20 to-indigo-500/20 ring-1 ring-white/10">
        <Icon size={16} className={tone} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-widest text-white/50">{label}</p>
        <p className={`mt-0.5 truncate text-lg font-semibold ${tone}`} data-testid={`${testId}-value`}>
          {value}
        </p>
        {sub ? <p className="text-xs text-white/55">{sub}</p> : null}
      </div>
    </div>
  );
}

export function TodayHero({ name }: { name?: string | null }) {
  const { data, isLoading } = useQuery<TodaySummary>({ queryKey: ["/api/me/today"] });

  if (isLoading || !data) {
    return (
      <div
        className="rounded-3xl border border-white/10 bg-gradient-to-br from-white/[0.05] to-white/[0.02] p-6"
        data-testid="today-hero-loading"
      >
        <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-20 animate-pulse rounded-2xl bg-white/5" />
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
      className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-sky-950/40 via-black/30 to-indigo-950/40 p-5 sm:p-6"
      data-testid="today-hero"
    >
      <header className="flex items-end justify-between gap-3">
        <div>
          <p className="text-[11px] uppercase tracking-widest text-white/50">Today</p>
          <h2 className="text-xl font-semibold text-white sm:text-2xl">
            {name ? `Hey ${name.split(" ")[0]},` : "Welcome back,"}{" "}
            <span className="text-white/70">here's your snapshot</span>
          </h2>
        </div>
        {data.streakWeeks >= 4 ? (
          <span
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200"
            data-testid="badge-streak-flame"
          >
            <Flame size={12} /> {data.streakWeeks}-week streak
          </span>
        ) : null}
      </header>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat
          icon={CalendarClock}
          label="Next session"
          value={sessionValue}
          sub={sessionSub}
          tone="text-sky-200"
          testId="stat-next-session"
        />
        <Stat
          icon={Pill}
          label="Supplements"
          value={suppValue}
          sub={suppSub}
          tone="text-emerald-200"
          testId="stat-supplements-today"
        />
        <Stat
          icon={Droplets}
          label="Water target"
          value={waterValue}
          sub={waterSub}
          tone="text-cyan-200"
          testId="stat-water-target"
        />
        <Stat
          icon={Trophy}
          label="Streak"
          value={streakValue}
          sub={streakSub}
          tone="text-amber-200"
          testId="stat-streak"
        />
      </div>

      <div
        className="mt-4 flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.03] p-3"
        data-testid="goal-progress-badge"
      >
        <Target size={14} className="text-fuchsia-300" />
        <p className="text-sm text-white">
          <span className="text-white/60">Goal:</span> {goalLabel}
        </p>
        {goalSub ? <p className="ms-auto text-xs text-white/55">{goalSub}</p> : null}
      </div>
    </section>
  );
}
