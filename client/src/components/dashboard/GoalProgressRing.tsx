import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { InbodyRecord, BookingWithUser, User } from "@shared/schema";
import { Target, TrendingUp, Activity, Award } from "lucide-react";

type Goal = "muscle_gain" | "fat_loss" | "recomposition" | "consistency" | null | undefined;

const GOAL_TARGETS = {
  muscle_gain: { kgDelta: 5, label: "Muscle gain", icon: TrendingUp },
  fat_loss: { kgDelta: -5, label: "Fat loss", icon: Activity, bfDelta: -5 },
  recomposition: { sessions: 16, label: "Consistency", icon: Award },
  consistency: { sessions: 16, label: "Consistency", icon: Award },
} as const;

export function computeGoalProgress(opts: {
  goal: Goal;
  weeklyFrequency: number | null | undefined;
  inbody: InbodyRecord[];
  bookings: BookingWithUser[];
}): { pct: number; label: string; sub: string; goalKey: keyof typeof GOAL_TARGETS } {
  const goalKey = (opts.goal && opts.goal in GOAL_TARGETS ? opts.goal : "consistency") as keyof typeof GOAL_TARGETS;

  if (goalKey === "muscle_gain" || goalKey === "fat_loss") {
    const sorted = [...opts.inbody].sort(
      (a, b) => new Date(a.recordedAt ?? 0).getTime() - new Date(b.recordedAt ?? 0).getTime(),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last || sorted.length < 1) {
      return { pct: 0, label: goalKey === "muscle_gain" ? "Muscle gain" : "Fat loss", sub: "Upload an InBody to start tracking", goalKey };
    }
    if (goalKey === "muscle_gain") {
      const startW = Number(first.weight) || 0;
      const curW = Number(last.weight) || 0;
      const delta = curW - startW;
      const pct = Math.max(0, Math.min(100, Math.round((delta / 5) * 100)));
      return { pct, label: "Muscle gain", sub: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg of +5 kg goal`, goalKey };
    }
    // fat_loss — prefer bodyFat delta; fall back to weight if absent
    const startBf = Number(first.bodyFat);
    const curBf = Number(last.bodyFat);
    if (Number.isFinite(startBf) && Number.isFinite(curBf) && startBf > 0) {
      const delta = curBf - startBf; // expect negative
      const pct = Math.max(0, Math.min(100, Math.round((delta / -5) * 100)));
      return { pct, label: "Fat loss", sub: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}% body fat of -5% goal`, goalKey };
    }
    const startW = Number(first.weight) || 0;
    const curW = Number(last.weight) || 0;
    const delta = curW - startW;
    const pct = Math.max(0, Math.min(100, Math.round((delta / -5) * 100)));
    return { pct, label: "Fat loss", sub: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg of -5 kg goal`, goalKey };
  }

  // consistency / recomposition: completed sessions in last 4 weeks vs target
  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const completed = opts.bookings.filter((b) => {
    if (b.status !== "completed") return false;
    const d = new Date(`${b.date}T${b.timeSlot || "00:00"}:00+04:00`).getTime();
    return d >= cutoff;
  }).length;
  const target = Math.max(1, (opts.weeklyFrequency || 3) * 4);
  const pct = Math.max(0, Math.min(100, Math.round((completed / target) * 100)));
  return {
    pct,
    label: goalKey === "recomposition" ? "Recomposition" : "Consistency",
    sub: `${completed} of ${target} sessions in last 4 weeks`,
    goalKey,
  };
}

interface Props {
  user: Pick<User, "id" | "primaryGoal" | "weeklyFrequency">;
}

export function GoalProgressRing({ user }: Props) {
  const { data: inbody = [] } = useQuery<InbodyRecord[]>({
    queryKey: ["/api/inbody"],
  });
  const { data: bookings = [] } = useQuery<BookingWithUser[]>({
    queryKey: ["/api/bookings"],
    queryFn: async () => {
      const res = await fetch("/api/bookings", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load bookings");
      return res.json();
    },
  });

  const { pct, label, sub, goalKey } = useMemo(
    () =>
      computeGoalProgress({
        goal: user.primaryGoal as Goal,
        weeklyFrequency: user.weeklyFrequency,
        inbody,
        bookings: bookings as BookingWithUser[],
      }),
    [user.primaryGoal, user.weeklyFrequency, inbody, bookings],
  );

  const Icon = GOAL_TARGETS[goalKey]?.icon ?? Target;

  // Ring geometry
  const size = 160;
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
      data-testid="card-goal-ring"
    >
      <div className="flex items-center gap-2 mb-4">
        <Target size={16} className="text-cyan-300" />
        <h3 className="text-sm font-semibold tracking-wide text-white/80 uppercase">Primary goal</h3>
      </div>
      <div className="flex items-center gap-6">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={stroke}
              fill="none"
            />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              stroke="url(#goalRingGrad)"
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={c}
              strokeDashoffset={offset}
              style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)" }}
            />
            <defs>
              <linearGradient id="goalRingGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#5ee7ff" />
                <stop offset="100%" stopColor="#7af0ff" />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-3xl font-bold text-white tabular-nums" data-testid="text-goal-pct">{pct}%</div>
              <div className="text-[10px] uppercase tracking-wider text-white/40 mt-0.5">progress</div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-white">
            <Icon size={16} className="text-cyan-300" />
            <div className="text-base font-semibold" data-testid="text-goal-label">{label}</div>
          </div>
          <p className="text-sm text-white/60 mt-1.5 leading-relaxed" data-testid="text-goal-sub">{sub}</p>
        </div>
      </div>
    </div>
  );
}
