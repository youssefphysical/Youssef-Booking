import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useBookings } from "@/hooks/use-bookings";
import { useTranslation } from "@/i18n";
import {
  pickMotivationLine,
  type MotivationContext,
} from "@/lib/motivation";

// Task #75 — Smart motivation engine.
// One-line, eyebrow-style tagline mounted above the "What's Next" tile.
// Picks deterministically per Dubai-local day so it doesn't churn on
// every refresh but does refresh tomorrow. Falls back to the neutral
// bucket gracefully when context data is missing/loading.

interface StreakMetrics {
  sessionsThisWeek: number;
  sessionsTargetWeekly: number;
  nutritionStreakDays: number;
  attendanceStreakWeeks: number;
  nutritionPlanActive: boolean;
}

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

function todayDubaiYmd(): string {
  const d = new Date(Date.now() + DUBAI_OFFSET_MS);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(
    d.getUTCDate(),
  ).padStart(2, "0")}`;
}

export function MotivationLine() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const reduced = useReducedMotion();

  const { data: streaks } = useQuery<StreakMetrics>({
    queryKey: ["/api/me/streaks"],
    enabled: !!user && user.role === "client",
    staleTime: 60_000,
  });

  const { data: bookings = [] } = useBookings({ userId: user?.id });

  const ctx = useMemo<MotivationContext>(() => {
    const today = todayDubaiYmd();
    const list = bookings as Array<{
      status?: string;
      date?: string;
      timeSlot?: string | null;
      createdAt?: string | null;
    }>;
    const completed = list.filter((b) => b.status === "completed");
    const lastCompletedMs = completed.length
      ? Math.max(
          ...completed.map((b) =>
            new Date(`${b.date}T${b.timeSlot || "00:00"}:00+04:00`).getTime(),
          ),
        )
      : null;
    const hoursSinceLastSession =
      lastCompletedMs != null && Number.isFinite(lastCompletedMs)
        ? Math.max(0, Math.floor((Date.now() - lastCompletedMs) / 3_600_000))
        : null;

    const hasBookingToday = list.some(
      (b) =>
        (b.status === "confirmed" || b.status === "upcoming" || b.status === "completed") &&
        String(b.date ?? "").slice(0, 10) === today,
    );

    // "Just booked" = a non-cancelled booking was created in the last 24h.
    const justBooked = list.some((b) => {
      if (!b.createdAt) return false;
      if (b.status === "cancelled" || b.status === "no_show") return false;
      const t = new Date(b.createdAt).getTime();
      return Number.isFinite(t) && Date.now() - t < 24 * 3_600_000;
    });

    return {
      hasBookingToday,
      justBooked,
      hoursSinceLastSession,
      attendanceStreakWeeks: streaks?.attendanceStreakWeeks ?? 0,
      sessionsThisWeek: streaks?.sessionsThisWeek ?? 0,
      sessionsTargetWeekly: streaks?.sessionsTargetWeekly ?? 0,
      recoveryLow: false,
    };
  }, [bookings, streaks]);

  if (!user) return null;

  const pick = pickMotivationLine(ctx, user.id);
  const line = t(pick.i18nKey, "");
  if (!line) return null;

  const initial = reduced ? { opacity: 1 } : { opacity: 0, y: 4 };
  const animate = { opacity: 1, y: 0 };
  const transition = reduced ? { duration: 0 } : { duration: 0.9, ease: "easeOut" as const };

  return (
    <motion.p
      key={pick.i18nKey}
      initial={initial}
      animate={animate}
      transition={transition}
      data-testid="text-motivation-line"
      data-motivation-bucket={pick.bucket}
      className="px-1 mb-2 text-[11px] sm:text-xs uppercase tracking-[0.22em] text-primary/85 font-semibold"
    >
      {line}
    </motion.p>
  );
}

export default MotivationLine;
