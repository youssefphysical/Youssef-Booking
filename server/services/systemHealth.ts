// Silent-fail detector. Wrap any write-path side effect (email send,
// notification dispatch, AI extraction) and pipe failures here so the
// admin sees "degraded" instead of nothing.
//
// Storage: single row per `kind` in `system_health`. A failure bumps
// `failure_count_24h` and stamps the last error; a success refreshes
// `last_success_at`. The 24h count is decayed lazily in `getHealth()`
// (we just check `last_failure_at < now-24h` and treat it as zero).

import { pool } from "../db";

export type SystemHealthKind =
  | "email_send"
  | "notification_dispatch"
  | "inbody_extract"
  | "cron_phase"
  | "smart_alerts";

export async function recordFailure(
  kind: SystemHealthKind,
  err: unknown,
): Promise<void> {
  const msg = err instanceof Error ? err.message : String(err);
  try {
    await pool.query(
      `INSERT INTO system_health (kind, failure_count_24h, last_failure_at, last_failure_message, updated_at)
       VALUES ($1, 1, now(), $2, now())
       ON CONFLICT (kind) DO UPDATE SET
         failure_count_24h = CASE
           WHEN system_health.last_failure_at IS NULL OR system_health.last_failure_at < now() - interval '24 hours'
             THEN 1
           ELSE system_health.failure_count_24h + 1
         END,
         last_failure_at = now(),
         last_failure_message = EXCLUDED.last_failure_message,
         updated_at = now()`,
      [kind, msg.slice(0, 2000)],
    );
  } catch (e) {
    // Never let health tracking itself crash a caller.
    console.warn("[systemHealth] recordFailure failed:", (e as Error)?.message);
  }
}

export async function recordSuccess(kind: SystemHealthKind): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO system_health (kind, failure_count_24h, last_success_at, updated_at)
       VALUES ($1, 0, now(), now())
       ON CONFLICT (kind) DO UPDATE SET
         last_success_at = now(),
         updated_at = now()`,
      [kind],
    );
  } catch (e) {
    console.warn("[systemHealth] recordSuccess failed:", (e as Error)?.message);
  }
}

export interface HealthRow {
  kind: string;
  failureCount24h: number;
  lastFailureAt: Date | null;
  lastFailureMessage: string | null;
  lastSuccessAt: Date | null;
  updatedAt: Date;
  degraded: boolean;
}

export async function getHealth(): Promise<HealthRow[]> {
  try {
    const r = await pool.query(
      `SELECT kind,
              CASE
                WHEN last_failure_at IS NULL OR last_failure_at < now() - interval '24 hours'
                  THEN 0
                ELSE failure_count_24h
              END AS failure_count_24h,
              last_failure_at,
              last_failure_message,
              last_success_at,
              updated_at
       FROM system_health
       ORDER BY kind`,
    );
    return (r.rows as any[]).map((row) => ({
      kind: row.kind,
      failureCount24h: Number(row.failure_count_24h ?? 0),
      lastFailureAt: row.last_failure_at,
      lastFailureMessage: row.last_failure_message,
      lastSuccessAt: row.last_success_at,
      updatedAt: row.updated_at,
      degraded: Number(row.failure_count_24h ?? 0) > 0,
    }));
  } catch (e) {
    console.warn("[systemHealth] getHealth failed:", (e as Error)?.message);
    return [];
  }
}

// Convenience wrapper. Awaits the side-effect; logs the failure with
// the given kind and re-throws so caller-side error handling is intact.
export async function track<T>(
  kind: SystemHealthKind,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    const result = await fn();
    await recordSuccess(kind);
    return result;
  } catch (err) {
    await recordFailure(kind, err);
    throw err;
  }
}

// Fire-and-forget wrapper. Use for notifications/email where you don't
// want a failure to surface to the user, but still want it counted.
export function trackSilent<T>(
  kind: SystemHealthKind,
  fn: () => Promise<T>,
): Promise<T | null> {
  return fn()
    .then((r) => {
      void recordSuccess(kind);
      return r;
    })
    .catch((err) => {
      void recordFailure(kind, err);
      console.warn(`[${kind}] silent failure (tracked):`, (err as Error)?.message);
      return null;
    });
}
