import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format, formatDistanceToNow, isToday, isTomorrow } from "date-fns";
import {
  ArrowRight,
  CalendarClock,
  Droplets,
  Flame,
  Info,
  Pill,
  Target,
  Trophy,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

function formatNextSession(iso: string): { primary: string; sub: string | null } {
  try {
    const d = new Date(iso);
    if (isToday(d)) return { primary: `Today · ${format(d, "p")}`, sub: null };
    if (isTomorrow(d)) return { primary: `Tomorrow · ${format(d, "p")}`, sub: null };
    return {
      primary: format(d, "EEE p"),
      sub: formatDistanceToNow(d, { addSuffix: true }),
    };
  } catch {
    return { primary: iso, sub: null };
  }
}

/* MiniChip — secondary, intentionally calmer than the primary card.
   Same recipe as the unified glass system used across the dashboard
   (border-white/10, bg-white/[0.03], rounded-2xl) so chips read as
   members of the same family, not competing surfaces. */
function MiniChip({
  icon: Icon,
  label,
  value,
  sub,
  isEmpty = false,
  testId,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  sub?: string | null;
  isEmpty?: boolean;
  testId: string;
}) {
  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-white/[0.025] p-3 sm:p-3.5"
      data-testid={testId}
    >
      <p className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-widest text-white/45">
        <Icon size={11} className="text-white/45" />
        <span className="truncate">{label}</span>
      </p>
      <p
        className={`mt-1 truncate text-base sm:text-[17px] font-semibold ${
          isEmpty ? "text-white/40" : "text-white"
        }`}
        data-testid={`${testId}-value`}
      >
        {value}
      </p>
      {sub ? (
        <p className="mt-0.5 text-[11.5px] text-white/50 line-clamp-1">{sub}</p>
      ) : null}
    </div>
  );
}

export function TodayHero({ name }: { name?: string | null }) {
  const { data, isLoading } = useQuery<TodaySummary>({ queryKey: ["/api/me/today"] });

  if (isLoading || !data) {
    return (
      <div
        className="rounded-2xl border border-white/10 bg-card/50 p-4 sm:p-6"
        data-testid="today-hero-loading"
      >
        <div className="h-5 w-40 animate-pulse rounded bg-white/10" />
        <div className="mt-4 h-24 animate-pulse rounded-2xl bg-white/5" />
        <div className="mt-3 grid grid-cols-3 gap-2.5">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-white/5" />
          ))}
        </div>
      </div>
    );
  }

  const goalLabel = data.goal.primary ? (GOAL_LABELS[data.goal.primary] ?? data.goal.primary) : null;
  const goalSub =
    data.goal.deltaKg != null
      ? `${data.goal.deltaKg > 0 ? "+" : ""}${data.goal.deltaKg.toFixed(1)} kg since start`
      : data.goal.weightLatestKg != null
        ? `${data.goal.weightLatestKg.toFixed(1)} kg latest`
        : null;

  /* Premium empty-state copy (May 2026 polish):
     replaces cold system phrases ("No plan yet", "Nothing booked",
     "No active supplements") with supportive coaching language. */
  const session = data.nextSession ? formatNextSession(data.nextSession.date) : null;
  const sessionPrimary = session?.primary ?? "Ready for your first session";
  const sessionSub = session
    ? (session.sub ?? data.nextSession?.sessionType ?? null)
    : null;

  const hasWater = !!data.waterTargetMl;
  const waterValue = hasWater ? `${(data.waterTargetMl! / 1000).toFixed(1)} L` : "—";
  const waterSub = hasWater ? "Daily target" : "Activates with your plan";

  const hasStreak = data.streakWeeks > 0;
  const streakValue = hasStreak ? `${data.streakWeeks} wk` : "—";
  const streakSub = hasStreak ? "Active weeks in a row" : "Begins with your first week";

  const hasSupps = data.supplementsToday > 0;
  const suppValue = hasSupps ? `${data.supplementsToday}` : "—";
  const suppSub = hasSupps ? "Active today" : "Guidance will appear here";

  return (
    <section
      className="overflow-hidden rounded-2xl border border-white/10 bg-card/50 p-4 sm:p-6"
      data-testid="today-hero"
    >
      {/* Header — eyebrow + greeting + (optional) goal sub-line.
          Goal moved out of its own card and folded into the header so
          the eye lands on the greeting first, then absorbs the goal as
          context, then reaches the primary card. */}
      <header className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-white/50">
            Today
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    aria-label="What is this?"
                    className="inline-flex h-4 w-4 items-center justify-center rounded-full text-white/35 hover:text-white/70 transition-colors"
                    data-testid="today-info-tooltip"
                  >
                    <Info size={11} />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="max-w-[220px] text-xs">
                  Your daily snapshot — next session, current goal, and a few signals to keep momentum.
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </p>
          <h2 className="mt-0.5 text-lg sm:text-2xl font-semibold text-white leading-tight">
            {name ? `Hey ${name.split(" ")[0]},` : "Welcome back,"}{" "}
            <span className="text-white/65 font-normal">here's your snapshot</span>
          </h2>
          {goalLabel ? (
            <p className="mt-1.5 inline-flex items-center gap-1.5 text-[12.5px] sm:text-sm text-white/60">
              <Target size={12} className="text-white/45" />
              <span>
                Working on <span className="text-white/80">{goalLabel}</span>
                {goalSub ? <span className="text-white/45"> · {goalSub}</span> : null}
              </span>
            </p>
          ) : null}
        </div>
        {data.streakWeeks >= 4 ? (
          <span
            className="shrink-0 inline-flex items-center gap-1.5 rounded-full border border-amber-400/20 bg-amber-500/[0.07] px-2.5 py-1 text-[11px] font-medium text-amber-200/90"
            data-testid="badge-streak-flame"
          >
            <Flame size={11} /> {data.streakWeeks}-wk
          </span>
        ) : null}
      </header>

      {/* PRIMARY card — Next Session.
          One large card carries the most actionable information.
          Layout: icon block + label/value/sub on the left, CTA pill on
          the right (or full-width below on mobile). The CTA is sized
          and toned to feel integrated, not dominant: h-9, single soft
          shadow, no aggressive double-glow. */}
      <div
        className="mt-4 sm:mt-5 rounded-2xl border border-white/[0.09] bg-white/[0.025] p-4 sm:p-5"
        data-testid="primary-next-session"
      >
        <div className="flex items-start gap-3 sm:gap-4">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.04] ring-1 ring-white/10">
            <CalendarClock size={18} className="text-primary/90" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[10.5px] uppercase tracking-widest text-white/50">
              Next session
            </p>
            <p
              className={`mt-0.5 text-xl sm:text-2xl font-semibold leading-tight truncate ${
                data.nextSession ? "text-white" : "text-white/75"
              }`}
              data-testid="primary-next-session-value"
            >
              {sessionPrimary}
            </p>
            {sessionSub ? (
              <p className="mt-0.5 text-[12.5px] sm:text-sm text-white/55 truncate">
                {sessionSub}
              </p>
            ) : null}
          </div>
        </div>

        {!data.nextSession ? (
          <Link
            href="/book"
            data-testid="link-today-hero-book"
            className="mt-3.5 sm:mt-4 inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl bg-primary/95 px-4 h-9 text-sm font-medium text-primary-foreground hover:bg-primary transition-colors"
          >
            Book your first session
            <ArrowRight size={14} className="rtl:rotate-180" />
          </Link>
        ) : null}
      </div>

      {/* SECONDARY chips — quieter, equal weight, scannable.
          Three chips replace the original four-card grid so the page
          breathes and the primary card retains hierarchy. Each chip is
          a calm glass tile with a single muted icon — no per-chip
          accent colors competing for attention. */}
      <div className="mt-3 grid grid-cols-3 gap-2 sm:gap-2.5">
        <MiniChip
          icon={Trophy}
          label="Streak"
          value={streakValue}
          sub={streakSub}
          isEmpty={!hasStreak}
          testId="stat-streak"
        />
        <MiniChip
          icon={Pill}
          label="Supplements"
          value={suppValue}
          sub={suppSub}
          isEmpty={!hasSupps}
          testId="stat-supplements-today"
        />
        <MiniChip
          icon={Droplets}
          label="Water"
          value={waterValue}
          sub={waterSub}
          isEmpty={!hasWater}
          testId="stat-water-target"
        />
      </div>
    </section>
  );
}
