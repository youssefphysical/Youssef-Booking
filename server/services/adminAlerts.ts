// Admin smart-alerts inbox. Distinct lifecycle from `admin_notifications`:
// an alert is a CONDITION (e.g. "package 42 expires today, no renewal in
// flight") that *resolves* when the condition clears. Re-firing the same
// kind+dedupe_key while still open is a no-op (partial unique index).
//
// Caller pattern:
//   await openAlert({ kind: 'expiring_today', severity: 'warning', ... })
//   await resolveAlerts('expiring_today', dedupeKeysStillOpen) // sweep
//
// The recomputation job (server/cron/runner.ts → smartAlerts phase) opens
// new alerts and resolves the ones whose condition no longer holds.

import { pool } from "../db";
import { storage, computePackageStatus } from "../storage";
import { recordFailure } from "./systemHealth";

export type AlertSeverity = "info" | "warning" | "critical";

export interface OpenAlertInput {
  kind: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  link?: string | null;
  entityType?: string | null;
  entityId?: number | null;
  dedupeKey: string; // required — used by partial unique index
}

export async function openAlert(a: OpenAlertInput): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO admin_alerts
         (kind, severity, title, body, link, entity_type, entity_id, dedupe_key)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (kind, dedupe_key)
         WHERE resolved_at IS NULL AND dedupe_key IS NOT NULL
         DO NOTHING`,
      [
        a.kind,
        a.severity,
        a.title,
        a.body,
        a.link ?? null,
        a.entityType ?? null,
        a.entityId ?? null,
        a.dedupeKey,
      ],
    );
  } catch (e) {
    console.warn("[adminAlerts] openAlert failed:", (e as Error)?.message);
  }
}

export async function resolveById(id: number): Promise<void> {
  await pool.query(
    `UPDATE admin_alerts SET resolved_at = now() WHERE id = $1 AND resolved_at IS NULL`,
    [id],
  );
}

// Resolve every open alert of `kind` whose dedupe_key is NOT in the
// supplied set. Used by the sweep job after recomputing the live set.
export async function resolveStale(kind: string, openDedupeKeys: string[]): Promise<void> {
  try {
    if (openDedupeKeys.length === 0) {
      await pool.query(
        `UPDATE admin_alerts SET resolved_at = now()
         WHERE kind = $1 AND resolved_at IS NULL`,
        [kind],
      );
      return;
    }
    await pool.query(
      `UPDATE admin_alerts SET resolved_at = now()
       WHERE kind = $1 AND resolved_at IS NULL AND NOT (dedupe_key = ANY($2::text[]))`,
      [kind, openDedupeKeys],
    );
  } catch (e) {
    console.warn("[adminAlerts] resolveStale failed:", (e as Error)?.message);
  }
}

export interface AlertRow {
  id: number;
  kind: string;
  severity: AlertSeverity;
  title: string;
  body: string;
  link: string | null;
  entityType: string | null;
  entityId: number | null;
  dedupeKey: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export async function listOpen(): Promise<AlertRow[]> {
  try {
    const r = await pool.query(
      `SELECT id, kind, severity, title, body, link,
              entity_type AS "entityType", entity_id AS "entityId",
              dedupe_key AS "dedupeKey",
              created_at AS "createdAt", resolved_at AS "resolvedAt"
       FROM admin_alerts WHERE resolved_at IS NULL
       ORDER BY
         CASE severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
         created_at DESC
       LIMIT 200`,
    );
    return r.rows as AlertRow[];
  } catch (e) {
    console.warn("[adminAlerts] listOpen failed:", (e as Error)?.message);
    return [];
  }
}

// ============================================================
// Recompute job — invoked from cron/runner.ts via smartAlerts phase
// ============================================================
// Pure read-then-write, no notifications. Rules (additive, idempotent):
//   - silent_email_failure: any system_health row degraded (>0 failures /24h)
//   - expiring_today: package expires within 24h, still active, no pending renewal
//   - expired_active: status='expired' but is_active=true (housekeeping)
//   - low_attendance: active client with attendance < 60% over last 30d (>=4 scheduled)
//   - inbox_no_show_today: bookings marked no_show in last 24h that haven't been actioned
export async function recomputeSmartAlerts(): Promise<{ opened: number; resolved: number }> {
  let opened = 0;
  const resolvedByKind: Record<string, string[]> = {};

  const trackResolved = (kind: string, dedupe: string) => {
    if (!resolvedByKind[kind]) resolvedByKind[kind] = [];
    resolvedByKind[kind].push(dedupe);
  };

  try {
    // ----- system health -----
    const healthRows = await pool.query(
      `SELECT kind, failure_count_24h, last_failure_at, last_failure_message
       FROM system_health
       WHERE last_failure_at >= now() - interval '24 hours' AND failure_count_24h > 0`,
    );
    for (const row of healthRows.rows as any[]) {
      const dedupe = `health:${row.kind}`;
      trackResolved("silent_failure", dedupe);
      await openAlert({
        kind: "silent_failure",
        severity: row.failure_count_24h >= 5 ? "critical" : "warning",
        title: `Silent failure: ${row.kind}`,
        body: `${row.failure_count_24h} failures in last 24h. Last: ${
          row.last_failure_message || "(no message)"
        }`,
        link: "/admin/business-health",
        entityType: "system",
        entityId: null,
        dedupeKey: dedupe,
      });
      opened++;
    }

    // ----- packages -----
    const packages = await storage.getPackages({ activeOnly: true });
    const renewals = await storage.getRenewalRequests({ status: "pending", limit: 1000 }).catch(() => []);
    const pendingRenewalUserIds = new Set<number>(
      (renewals as any[]).map((r) => Number(r.userId)).filter((n) => Number.isFinite(n)),
    );
    const now = new Date();
    const in24h = new Date(now.getTime() + 24 * 3600 * 1000);

    for (const p of packages as any[]) {
      const status = computePackageStatus(p);
      // expiring_today
      if (p.expiryDate) {
        const exp = new Date(`${p.expiryDate}T23:59:59+04:00`);
        if (status === "active" && exp.getTime() <= in24h.getTime() && exp.getTime() >= now.getTime()) {
          if (!pendingRenewalUserIds.has(p.userId)) {
            const dedupe = `pkg:${p.id}`;
            trackResolved("expiring_today", dedupe);
            await openAlert({
              kind: "expiring_today",
              severity: "warning",
              title: "Package expires within 24h",
              body: `Package #${p.id} expires ${p.expiryDate}. No renewal request in flight.`,
              link: `/admin/clients/${p.userId}`,
              entityType: "package",
              entityId: p.id,
              dedupeKey: dedupe,
            });
            opened++;
          }
        }
      }
      // expired_active = lifecycle mismatch
      if (status === "expired" && p.isActive) {
        const dedupe = `pkg:${p.id}`;
        trackResolved("expired_active", dedupe);
        await openAlert({
          kind: "expired_active",
          severity: "warning",
          title: "Expired package still marked active",
          body: `Package #${p.id} is past expiry but is_active=true. Lifecycle sweep didn't catch it.`,
          link: `/admin/clients/${p.userId}`,
          entityType: "package",
          entityId: p.id,
          dedupeKey: dedupe,
        });
        opened++;
      }
    }

    // ----- attendance -----
    const clients = await storage.getAllClients();
    const allBookings = await storage.getBookings();
    const cutoff30 = new Date(now.getTime() - 30 * 86_400_000).getTime();
    for (const c of clients as any[]) {
      if (c.clientStatus !== "active") continue;
      let scheduled = 0;
      let completed = 0;
      for (const b of allBookings as any[]) {
        if (b.userId !== c.id) continue;
        const t = new Date(`${String(b.date)}T00:00:00Z`).getTime();
        if (t < cutoff30 || t > now.getTime()) continue;
        if (!["completed", "no_show", "late_cancelled"].includes(b.status)) continue;
        scheduled++;
        if (b.status === "completed") completed++;
      }
      if (scheduled >= 4) {
        const rate = completed / scheduled;
        if (rate < 0.6) {
          const dedupe = `client:${c.id}`;
          trackResolved("low_attendance", dedupe);
          await openAlert({
            kind: "low_attendance",
            severity: "warning",
            title: `Low attendance: ${c.fullName ?? c.username ?? "client"}`,
            body: `${(rate * 100).toFixed(0)}% attendance over last 30 days (${completed}/${scheduled}).`,
            link: `/admin/clients/${c.id}`,
            entityType: "user",
            entityId: c.id,
            dedupeKey: dedupe,
          });
          opened++;
        }
      }
    }

    // ----- no-shows in last 24h (unactioned = no admin_notes set after marking) -----
    const since24h = new Date(now.getTime() - 24 * 3600 * 1000).getTime();
    for (const b of allBookings as any[]) {
      if (b.status !== "no_show") continue;
      const markedAt = b.attendanceMarkedAt ? new Date(b.attendanceMarkedAt).getTime() : 0;
      if (markedAt < since24h) continue;
      if (b.adminNotes && b.adminNotes.length > 4) continue; // operator already addressed
      const dedupe = `booking:${b.id}`;
      trackResolved("recent_no_show", dedupe);
      await openAlert({
        kind: "recent_no_show",
        severity: "info",
        title: "Recent no-show needs follow-up",
        body: `Booking #${b.id} on ${b.date} ${b.timeSlot} — add an admin note to dismiss.`,
        link: `/admin/clients/${b.userId}`,
        entityType: "booking",
        entityId: b.id,
        dedupeKey: dedupe,
      });
      opened++;
    }

    // ----- resolve everything else for these kinds -----
    let resolved = 0;
    for (const kind of [
      "silent_failure",
      "expiring_today",
      "expired_active",
      "low_attendance",
      "recent_no_show",
    ]) {
      await resolveStale(kind, resolvedByKind[kind] ?? []);
      resolved += (resolvedByKind[kind] ?? []).length;
    }
    return { opened, resolved };
  } catch (e) {
    await recordFailure("smart_alerts", e);
    console.error("[adminAlerts] recomputeSmartAlerts failed:", e);
    return { opened, resolved: 0 };
  }
}
