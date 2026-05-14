/**
 * Quiet-hours logic — Asia/Dubai (UTC+4, no DST).
 *
 * Approved per Step 1B Q10: 22:00 → 07:00 GST is quiet.
 * During quiet hours:
 *   - Suppress non-critical reminder emails.
 *   - Defer low-priority sends until the next 07:00 GST.
 *   - Critical transactional emails bypass suppression.
 *
 * Bypass categories (always send, even at 03:00 local):
 *   - "password_reset"  — security primitive, instant
 *   - "session_reminder_1h" — operational urgency, time-sensitive
 *   - any email with severity === "critical"
 */

import type { Severity } from "./tokens";

const DUBAI_OFFSET_MINUTES = 4 * 60; // UTC+4, no DST
const QUIET_START_HOUR = 22;
const QUIET_END_HOUR = 7;

/** Categories that ALWAYS send, regardless of quiet hours. */
const ALWAYS_BYPASS_KINDS = new Set<string>([
  "password_reset",
  "session_reminder_1h",
]);

export interface QuietHoursDecision {
  /** True if the send should proceed immediately. */
  allowNow: boolean;
  /** When to send instead, if allowNow is false. ISO string. */
  scheduledFor: Date | null;
  /** Why the decision was made — for logs. */
  reason: "in_window" | "quiet_critical_bypass" | "quiet_kind_bypass" | "quiet_deferred";
}

/**
 * Returns the current Dubai-local hour (0–23) for an arbitrary instant.
 */
export function dubaiHour(now: Date = new Date()): number {
  const utcMillis = now.getTime();
  const dubaiMillis = utcMillis + DUBAI_OFFSET_MINUTES * 60_000;
  return new Date(dubaiMillis).getUTCHours();
}

/** Returns true if the given instant falls inside quiet hours (Dubai TZ). */
export function isQuietHours(now: Date = new Date()): boolean {
  const hour = dubaiHour(now);
  return hour >= QUIET_START_HOUR || hour < QUIET_END_HOUR;
}

/**
 * Computes the next 07:00 Dubai-local instant from `now`. Returns a UTC Date.
 */
export function nextDeliveryAfterQuiet(now: Date = new Date()): Date {
  const utcMillis = now.getTime();
  const dubaiMillis = utcMillis + DUBAI_OFFSET_MINUTES * 60_000;
  const dubai = new Date(dubaiMillis);
  // Build "next 07:00 Dubai time" as a UTC instant.
  const targetDubai = new Date(
    Date.UTC(
      dubai.getUTCFullYear(),
      dubai.getUTCMonth(),
      dubai.getUTCDate(),
      QUIET_END_HOUR,
      0,
      0,
      0,
    ),
  );
  // If the computed target is already in the past (e.g. it's 23:00 Dubai
  // and we computed today's 07:00), bump to tomorrow.
  if (targetDubai.getTime() - DUBAI_OFFSET_MINUTES * 60_000 <= utcMillis) {
    targetDubai.setUTCDate(targetDubai.getUTCDate() + 1);
  }
  // Convert the Dubai-anchored target back to a UTC instant.
  return new Date(targetDubai.getTime() - DUBAI_OFFSET_MINUTES * 60_000);
}

/**
 * Decide whether to send `kind`/`severity` now, defer, or bypass quiet hours.
 *
 * @param kind Email kind / event identifier (e.g. "session_reminder_24h").
 * @param severity Severity classification from Step 1B §1B.4.
 * @param now Override for testing — defaults to the current instant.
 */
export function decideQuietHours(
  kind: string,
  severity: Severity,
  now: Date = new Date(),
): QuietHoursDecision {
  if (!isQuietHours(now)) {
    return { allowNow: true, scheduledFor: null, reason: "in_window" };
  }
  if (severity === "critical") {
    return {
      allowNow: true,
      scheduledFor: null,
      reason: "quiet_critical_bypass",
    };
  }
  if (ALWAYS_BYPASS_KINDS.has(kind)) {
    return {
      allowNow: true,
      scheduledFor: null,
      reason: "quiet_kind_bypass",
    };
  }
  return {
    allowNow: false,
    scheduledFor: nextDeliveryAfterQuiet(now),
    reason: "quiet_deferred",
  };
}
