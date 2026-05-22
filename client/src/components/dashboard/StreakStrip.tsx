import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Flame, Calendar, Apple } from "lucide-react";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { useTranslation } from "@/i18n";

// Task #74 — StreakStrip
// Three live chips above the dashboard tab list:
//   1. Sessions this week      (e.g. "2 / 3 this week")
//   2. Nutrition consistency   (last-4-weeks check-ins, "3 / 4 wks")
//   3. Attendance streak       (consecutive weeks with ≥1 session)
// Data comes from GET /api/me/streaks (single round-trip).

interface StreakMetrics {
  sessionsThisWeek: number;
  sessionsTargetWeekly: number;
  nutritionStreakWeeks: number;
  attendanceStreakWeeks: number;
  nutritionPlanActive: boolean;
}

export function StreakStrip() {
  const { t } = useTranslation();
  const { data, isLoading } = useQuery<StreakMetrics>({
    queryKey: ["/api/me/streaks"],
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  if (isLoading || !data) {
    return (
      <div className="grid grid-cols-3 gap-3 mb-4" aria-hidden="true">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="admin-shimmer h-[78px] rounded-2xl border border-white/[0.06]"
          />
        ))}
      </div>
    );
  }

  // Per Task #74 spec, the strip is gated:
  //   - Sessions chip: always shown (anchor metric).
  //   - Nutrition chip: only when the client has an active nutrition plan.
  //     Without one, the chip would shame clients who haven't opted in.
  //   - Attendance chip: only when the streak is meaningful (> 1 week).
  //     A "1 week" chip on day 1 reads as noise, not momentum.
  const showNutrition = data.nutritionPlanActive;
  const showAttendance = data.attendanceStreakWeeks > 1;
  const allChips = [
    {
      key: "week",
      show: true,
      icon: Flame,
      label: t("dashboard.streak.sessionsThisWeek", "Sessions this week"),
      value: `${data.sessionsThisWeek} / ${data.sessionsTargetWeekly}`,
      hint:
        data.sessionsThisWeek >= data.sessionsTargetWeekly
          ? t("dashboard.streak.onTrack", "On track")
          : t("dashboard.streak.keepGoing", "Keep going"),
      testId: "chip-streak-week",
      tone:
        data.sessionsThisWeek >= data.sessionsTargetWeekly
          ? "good"
          : data.sessionsThisWeek > 0
          ? "mid"
          : "dim",
    },
    {
      key: "nutrition",
      show: showNutrition,
      icon: Apple,
      label: t("dashboard.streak.nutrition", "Nutrition consistency"),
      value: `${data.nutritionStreakWeeks} / 4`,
      hint:
        data.nutritionStreakWeeks >= 4
          ? t("dashboard.streak.perfect", "Perfect")
          : t("dashboard.streak.last4w", "Last 4 weeks"),
      testId: "chip-streak-nutrition",
      tone: data.nutritionStreakWeeks >= 3 ? "good" : data.nutritionStreakWeeks > 0 ? "mid" : "dim",
    },
    {
      key: "attendance",
      show: showAttendance,
      icon: Calendar,
      label: t("dashboard.streak.attendance", "Attendance streak"),
      value:
        data.attendanceStreakWeeks === 1
          ? t("dashboard.streak.oneWeek", "1 week")
          : t("dashboard.streak.nWeeks", "{n} weeks").replace(
              "{n}",
              String(data.attendanceStreakWeeks),
            ),
      hint:
        data.attendanceStreakWeeks > 0
          ? t("dashboard.streak.staying", "Stay consistent")
          : t("dashboard.streak.startToday", "Start today"),
      testId: "chip-streak-attendance",
      tone: data.attendanceStreakWeeks >= 4 ? "good" : data.attendanceStreakWeeks > 0 ? "mid" : "dim",
    },
  ] as const;

  const chips = allChips.filter((c) => c.show);
  if (chips.length === 0) return null;

  const gridCols =
    chips.length === 1 ? "grid-cols-1" : chips.length === 2 ? "grid-cols-2" : "grid-cols-3";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={`grid ${gridCols} gap-3 mb-4`}
      data-testid="strip-streaks"
    >
      {chips.map((c) => {
        const Icon = c.icon;
        const toneRing =
          c.tone === "good"
            ? "ring-cyan-400/40 bg-cyan-500/10 text-cyan-300"
            : c.tone === "mid"
            ? "ring-amber-300/30 bg-amber-400/10 text-amber-200"
            : "ring-white/10 bg-white/5 text-muted-foreground";
        return (
          <div
            key={c.key}
            data-testid={c.testId}
            className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-card/40 p-3 sm:p-4"
          >
            <CyanHairline />
            <div className="flex items-start gap-2.5">
              <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ring-1 ${toneRing}`}>
                <Icon size={14} />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground truncate">
                  {c.label}
                </p>
                <p className="mt-0.5 text-base sm:text-lg font-display font-bold leading-tight">
                  {c.value}
                </p>
                <p className="text-[10px] text-muted-foreground/80 mt-0.5">{c.hint}</p>
              </div>
            </div>
          </div>
        );
      })}
    </motion.div>
  );
}
