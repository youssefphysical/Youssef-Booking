// =====================================================================
// Task #75 — Smart motivation engine.
// Pure, dependency-free, framework-agnostic. The picker classifies the
// client's state into one of 6 buckets and returns a deterministic
// per-day line index so the dashboard tagline doesn't churn on every
// refresh but does refresh once per Dubai-local day.
// =====================================================================

export type MotivationBucket =
  | "just_booked"
  | "on_streak"
  | "returning_after_gap"
  | "close_to_badge"
  | "recovery_focus"
  | "neutral";

export interface MotivationContext {
  /** True when the most recent booking was created within the last 24h. */
  justBooked?: boolean;
  /** True when client has any session scheduled for today (Dubai). */
  hasBookingToday?: boolean;
  /** Whole hours since the last completed session, or null if none. */
  hoursSinceLastSession?: number | null;
  /** Attendance streak length in consecutive ISO weeks. */
  attendanceStreakWeeks?: number;
  /** Completed sessions this week. */
  sessionsThisWeek?: number;
  /** Target sessions per week (from weeklyFrequency). */
  sessionsTargetWeekly?: number;
  /** True when recovery/energy scores are flagged low today. */
  recoveryLow?: boolean;
}

export interface MotivationPick {
  bucket: MotivationBucket;
  /** 0..3 deterministic per Dubai-local day + user id. */
  index: number;
  /** Translation key, format: `motivation.<bucket>.<index>`. */
  i18nKey: string;
}

/** Lines per bucket — kept in sync with translations.ts. */
export const MOTIVATION_LINES_PER_BUCKET = 4;

/**
 * Classify a client's current state into a motivation bucket. Ordered
 * by priority — first matching rule wins so the picker reads top-down.
 */
export function classifyMotivationBucket(ctx: MotivationContext): MotivationBucket {
  // Recovery-low always wins: pushing through fatigue is the opposite
  // of the message we want to send.
  if (ctx.recoveryLow) return "recovery_focus";

  // Close to closing the weekly target — one more session away.
  const target = ctx.sessionsTargetWeekly ?? 0;
  const done = ctx.sessionsThisWeek ?? 0;
  if (target > 0 && done > 0 && done >= target - 1 && done < target) {
    return "close_to_badge";
  }

  // Just booked: covers both "client just created a booking" and "they
  // already have one on the calendar for today".
  if (ctx.justBooked || ctx.hasBookingToday) return "just_booked";

  // Currently on an attendance streak ≥ 2 consecutive weeks.
  if ((ctx.attendanceStreakWeeks ?? 0) >= 2) return "on_streak";

  // Coming back after a noticeable gap (≥ 7 days since last completion).
  const hrs = ctx.hoursSinceLastSession;
  if (typeof hrs === "number" && hrs >= 24 * 7) return "returning_after_gap";

  return "neutral";
}

/**
 * Deterministic 0..(N-1) index from (userId, YYYY-MM-DD). Same line all
 * day, different line tomorrow. djb2-ish hash — collision quality is
 * fine for "pick one of 4".
 */
export function dailyLineIndex(
  userId: number | string,
  ymd: string,
  bucketSize = MOTIVATION_LINES_PER_BUCKET,
): number {
  const s = `${userId}|${ymd}`;
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % bucketSize;
}

const DUBAI_OFFSET_MS = 4 * 60 * 60 * 1000;

/** YYYY-MM-DD in Asia/Dubai (UTC+4, no DST). */
export function dubaiYmd(now: Date = new Date()): string {
  const d = new Date(now.getTime() + DUBAI_OFFSET_MS);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/** Main entrypoint. */
export function pickMotivationLine(
  ctx: MotivationContext,
  userId: number | string,
  now: Date = new Date(),
): MotivationPick {
  const bucket = classifyMotivationBucket(ctx);
  const index = dailyLineIndex(userId, dubaiYmd(now));
  return { bucket, index, i18nKey: `motivation.${bucket}.${index}` };
}
