import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { InbodyRecord, BookingWithUser, User } from "@shared/schema";
import { Target, TrendingUp, Activity, Award } from "lucide-react";
import { useTranslation } from "@/i18n";

type Goal = "muscle_gain" | "fat_loss" | "recomposition" | "consistency" | null | undefined;

const GOAL_KEYS = ["muscle_gain", "fat_loss", "recomposition", "consistency"] as const;
const GOAL_ICON: Record<(typeof GOAL_KEYS)[number], typeof Target> = {
  muscle_gain: TrendingUp,
  fat_loss: Activity,
  consistency: Award,
  recomposition: Award,
};

export interface GoalProgressResult {
  pct: number;
  goalKey: (typeof GOAL_KEYS)[number];
  sub:
    | { kind: "empty" }
    | { kind: "muscle"; delta: string }
    | { kind: "fatBf"; delta: string }
    | { kind: "fatKg"; delta: string }
    | { kind: "consistency"; done: number; target: number };
}

export function computeGoalProgress(opts: {
  goal: Goal;
  weeklyFrequency: number | null | undefined;
  inbody: InbodyRecord[];
  bookings: BookingWithUser[];
}): GoalProgressResult {
  const goalKey = (opts.goal && (GOAL_KEYS as readonly string[]).includes(opts.goal) ? opts.goal : "consistency") as GoalProgressResult["goalKey"];

  if (goalKey === "muscle_gain" || goalKey === "fat_loss") {
    const sorted = [...opts.inbody].sort(
      (a, b) => new Date(a.recordedAt ?? 0).getTime() - new Date(b.recordedAt ?? 0).getTime(),
    );
    const first = sorted[0];
    const last = sorted[sorted.length - 1];
    if (!first || !last) {
      return { pct: 0, goalKey, sub: { kind: "empty" } };
    }
    if (goalKey === "muscle_gain") {
      const startW = Number(first.weight) || 0;
      const curW = Number(last.weight) || 0;
      const delta = curW - startW;
      const pct = Math.max(0, Math.min(100, Math.round((delta / 5) * 100)));
      return { pct, goalKey, sub: { kind: "muscle", delta: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}` } };
    }
    const startBf = Number(first.bodyFat);
    const curBf = Number(last.bodyFat);
    if (Number.isFinite(startBf) && Number.isFinite(curBf) && startBf > 0) {
      const delta = curBf - startBf;
      const pct = Math.max(0, Math.min(100, Math.round((delta / -5) * 100)));
      return { pct, goalKey, sub: { kind: "fatBf", delta: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}` } };
    }
    const startW = Number(first.weight) || 0;
    const curW = Number(last.weight) || 0;
    const delta = curW - startW;
    const pct = Math.max(0, Math.min(100, Math.round((delta / -5) * 100)));
    return { pct, goalKey, sub: { kind: "fatKg", delta: `${delta >= 0 ? "+" : ""}${delta.toFixed(1)}` } };
  }

  const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
  const completed = opts.bookings.filter((b) => {
    if (b.status !== "completed") return false;
    const d = new Date(`${b.date}T${b.timeSlot || "00:00"}:00+04:00`).getTime();
    return d >= cutoff;
  }).length;
  const target = Math.max(1, (opts.weeklyFrequency || 3) * 4);
  const pct = Math.max(0, Math.min(100, Math.round((completed / target) * 100)));
  return { pct, goalKey, sub: { kind: "consistency", done: completed, target } };
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

interface Props {
  user: Pick<User, "id" | "primaryGoal" | "weeklyFrequency">;
}

export function GoalProgressRing({ user }: Props) {
  const { t } = useTranslation();
  const reduced = useReducedMotion();

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

  const result = useMemo(
    () =>
      computeGoalProgress({
        goal: user.primaryGoal as Goal,
        weeklyFrequency: user.weeklyFrequency,
        inbody,
        bookings: bookings as BookingWithUser[],
      }),
    [user.primaryGoal, user.weeklyFrequency, inbody, bookings],
  );

  const { pct, goalKey, sub } = result;
  const Icon = GOAL_ICON[goalKey] ?? Target;
  const label = t(`dashboard.goalRing.label.${goalKey}`, goalKey);

  const subLine =
    sub.kind === "empty"
      ? t("dashboard.goalRing.empty", "Add your first InBody to track this.")
      : sub.kind === "muscle"
        ? t("dashboard.goalRing.muscleSub", "{delta} kg of +5 kg goal").replace("{delta}", sub.delta)
        : sub.kind === "fatBf"
          ? t("dashboard.goalRing.fatBfSub", "{delta}% body fat of -5% goal").replace("{delta}", sub.delta)
          : sub.kind === "fatKg"
            ? t("dashboard.goalRing.fatKgSub", "{delta} kg of -5 kg goal").replace("{delta}", sub.delta)
            : t("dashboard.goalRing.consistencySub", "{done} of {target} sessions in last 4 weeks")
                .replace("{done}", String(sub.done))
                .replace("{target}", String(sub.target));

  /* Compact ring — 108px keeps vertical footprint small */
  const size = 108;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.02] px-4 py-3.5 sm:px-5 sm:py-4"
      data-testid="card-goal-ring"
    >
      <div className="flex items-center gap-2 mb-3">
        <Target size={14} className="text-cyan-300" />
        <h3 className="text-xs font-semibold tracking-wide text-white/70 uppercase">
          {t("dashboard.goalRing.title", "Primary goal")}
        </h3>
      </div>
      <div className="flex items-center gap-4">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
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
              style={{
                transition: reduced ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
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
              <div className="text-2xl font-bold text-white tabular-nums" data-testid="text-goal-pct">{pct}%</div>
              <div className="text-[9px] uppercase tracking-wider text-white/40 mt-0.5">
                {t("dashboard.goalRing.progressLabel", "progress")}
              </div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 text-white">
            <Icon size={14} className="text-cyan-300 shrink-0" />
            <div className="text-sm font-semibold" data-testid="text-goal-label">{label}</div>
          </div>
          <p className="text-xs text-white/60 mt-1.5 leading-relaxed" data-testid="text-goal-sub">{subLine}</p>
        </div>
      </div>
    </div>
  );
}
