// Cron tick orchestrator. Single entrypoint shared by:
//   - the HTTP route /api/cron/reminders (production trigger)
//   - the local script `npx tsx scripts/cron-test.ts` (dev repro)
//
// SCOPE — locked. Do NOT expand without sign-off:
//   * No new tables. No DLQ. No retry framework. No dashboards.
//   * Validates env BEFORE any DB / network call (fail-fast).
//   * Each phase wrapped by phase() — logs start/end, classifies failures,
//     never throws past the runner boundary.
//   * In-process overlap lock (module-scoped). Two concurrent ticks
//     landing in the same Vercel instance refuse to double-run; lock
//     auto-releases after MAX_TICK_MS in case a phase silently hangs.
//   * Admin summary email is OPT-IN via CRON_ADMIN_EMAIL. Never sent
//     for env / db-connect / overlap failures (operator concerns, would
//     just spam). Sent for activity (>0 reminders / auto-completes) or
//     for post-DB-connect failures.

// NOTE: do NOT static-import "../db" here — server/db.ts throws at module
// load if DATABASE_URL is missing, which would prevent validateCronEnvironment
// from ever running and short-circuit the operator-clear ENV_FAILURE path.
// We lazy-import inside the db-connect phase, AFTER env validation passes.

export type CronFailureCode =
  | "ENV_FAILURE"        // missing or malformed required env (validate-env)
  | "DB_FAILURE"         // pool query rejected at connection level
  | "EMAIL_PROVIDER"     // resend rejected the send (4xx/5xx from API)
  | "QUERY_FAILURE"      // SELECT/UPDATE rejected (constraint, syntax, etc.)
  | "TIMEOUT"            // phase exceeded its time budget
  | "OVERLAP"            // a previous tick is still running
  | "UNKNOWN_RUNTIME";   // fallthrough — anything not matched above

export interface PhaseResult {
  name: string;
  ok: boolean;
  ms: number;
  result?: unknown;
  error?: { code: CronFailureCode; message: string };
}

export interface CronTickSummary {
  tickId: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  ok: boolean;
  envValid: boolean;
  phases: PhaseResult[];
  failureCode: CronFailureCode | null;
  // Aggregates surfaced from phase results — best-effort.
  remindersSent: number;
  remindersFailed: number;
  remindersCapped: boolean;       // hit cronGuards.maxEmailsPerTick this tick
  remindersAttempts: number;      // total recipients attempted (sent+failed+capped)
  bookingsAutoCompleted: number;
}

export interface CronEnvValidation {
  ok: boolean;
  errors: { field: string; reason: string }[];
}

// ---------- env validation ----------

const REQUIRED = [
  "DATABASE_URL",
  "RESEND_API_KEY",
  "CRON_SECRET",
  "PUBLIC_APP_URL",
  "OPENAI_API_KEY",
] as const;

export function validateCronEnvironment(): CronEnvValidation {
  const errors: { field: string; reason: string }[] = [];
  for (const k of REQUIRED) {
    const v = process.env[k];
    if (!v || v.trim() === "") {
      errors.push({ field: k, reason: "missing or empty" });
    }
  }
  const dbUrl = process.env.DATABASE_URL;
  if (dbUrl && !/^postgres(ql)?:\/\//.test(dbUrl)) {
    errors.push({ field: "DATABASE_URL", reason: "must start with postgres:// or postgresql://" });
  }
  const appUrl = process.env.PUBLIC_APP_URL;
  if (appUrl) {
    try {
      const u = new URL(appUrl);
      if (!u.protocol.startsWith("http")) throw new Error("bad protocol");
    } catch {
      errors.push({ field: "PUBLIC_APP_URL", reason: "must be a valid http(s) URL" });
    }
  }
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey && !resendKey.startsWith("re_")) {
    errors.push({ field: "RESEND_API_KEY", reason: 'must start with "re_"' });
  }
  return { ok: errors.length === 0, errors };
}

// ---------- failure classification ----------

export function classifyFailure(err: unknown): CronFailureCode {
  if (err && typeof err === "object" && (err as any).__cronFailureCode) {
    return (err as any).__cronFailureCode as CronFailureCode;
  }
  const msg = err instanceof Error ? err.message : String(err);
  const code = (err as any)?.code;
  if (typeof code === "string") {
    if (code === "ECONNREFUSED" || code === "ETIMEDOUT" || code === "ENOTFOUND" || code === "EAI_AGAIN") {
      return "DB_FAILURE";
    }
    if (code.startsWith("08") || code.startsWith("57")) return "DB_FAILURE";
    if (code.startsWith("42") || code.startsWith("23")) return "QUERY_FAILURE";
  }
  if (/timeout|timed out/i.test(msg)) return "TIMEOUT";
  if (/(connect ECONNREFUSED|ENOTFOUND|EAI_AGAIN)/.test(msg)) return "DB_FAILURE";
  if (/resend/i.test(msg) && /(429|5\d\d|rate)/i.test(msg)) return "EMAIL_PROVIDER";
  return "UNKNOWN_RUNTIME";
}

function tagError(code: CronFailureCode, message: string): Error {
  const e: any = new Error(message);
  e.__cronFailureCode = code;
  return e;
}

// ---------- in-process overlap lock ----------

const MAX_TICK_MS = 4 * 60 * 1000; // headroom under Vercel's 5-min function cap

let __activeTick: { tickId: string; startedAt: number } | null = null;

function acquireLock(tickId: string): boolean {
  const now = Date.now();
  if (__activeTick && now - __activeTick.startedAt < MAX_TICK_MS) return false;
  __activeTick = { tickId, startedAt: now };
  return true;
}

function releaseLock(tickId: string) {
  if (__activeTick?.tickId === tickId) __activeTick = null;
}

// ---------- runtime guards (env-tunable, sane defaults) ----------

export const cronGuards = {
  maxEmailsPerTick: Number(process.env.CRON_MAX_EMAILS_PER_TICK || 200),
  maxTickDurationMs: MAX_TICK_MS,
};

// ---------- phase helper ----------

async function phase<T>(name: string, fn: () => Promise<T>): Promise<PhaseResult> {
  const t0 = Date.now();
  console.log(`[cron] ▶ phase=${name} status=start`);
  try {
    const result = await fn();
    const ms = Date.now() - t0;
    const safe = isPlainSummary(result) ? result : undefined;
    console.log(
      `[cron] ✓ phase=${name} status=done ms=${ms}` +
        (safe ? ` result=${JSON.stringify(safe)}` : ""),
    );
    return { name, ok: true, ms, result };
  } catch (err) {
    const ms = Date.now() - t0;
    const code = classifyFailure(err);
    const message = err instanceof Error ? err.message : String(err);
    console.error(
      `[cron] ✗ phase=${name} status=fail ms=${ms} code=${code} message=${JSON.stringify(message)}`,
    );
    return { name, ok: false, ms, error: { code, message } };
  }
}

function isPlainSummary(x: unknown): x is Record<string, number | string | boolean | null> {
  if (!x || typeof x !== "object") return false;
  return Object.values(x as object).every(
    (v) => v === null || ["number", "string", "boolean"].includes(typeof v),
  );
}

// ---------- public entrypoint ----------

export interface ReminderPhaseResult {
  sent: number;
  failed: number;
  attempts: number;
  capped: boolean;
  cap: number;
}

export interface CronPhaseHandlers {
  reminders: () => Promise<ReminderPhaseResult>;
  expiry: () => Promise<void>;
  checkin: () => Promise<void>;
  autoComplete: () => Promise<{ completed: number; deducted: number; notified: number }>;
}

export async function runCronTick(handlers: CronPhaseHandlers): Promise<CronTickSummary> {
  const tickId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const startedAt = new Date();
  const summary: CronTickSummary = {
    tickId,
    startedAt: startedAt.toISOString(),
    completedAt: "",
    durationMs: 0,
    ok: false,
    envValid: false,
    phases: [],
    failureCode: null,
    remindersSent: 0,
    remindersFailed: 0,
    remindersCapped: false,
    remindersAttempts: 0,
    bookingsAutoCompleted: 0,
  };

  console.log(`[cron] === tick start id=${tickId} ===`);

  // Phase 1: overlap guard.
  if (!acquireLock(tickId)) {
    console.warn(`[cron] OVERLAP — previous tick still running, refusing to double-run`);
    summary.completedAt = new Date().toISOString();
    summary.durationMs = Date.now() - startedAt.getTime();
    summary.failureCode = "OVERLAP";
    summary.phases.push({
      name: "overlap-guard",
      ok: false,
      ms: 0,
      error: { code: "OVERLAP", message: "previous tick still running" },
    });
    console.log(`[cron] === tick end id=${tickId} ok=false code=OVERLAP ===`);
    return summary;
  }

  try {
    // Phase 2: env validation. Failures here NEVER trigger admin email
    // (operator concern). Returns 5xx so the GitHub Actions step fails
    // visibly + the operator gets a notification from GitHub itself.
    const envPhase = await phase("validate-env", async () => {
      const r = validateCronEnvironment();
      if (!r.ok) {
        const detail = r.errors.map((e) => `${e.field}: ${e.reason}`).join("; ");
        throw tagError("ENV_FAILURE", `env invalid — ${detail}`);
      }
      return { required: REQUIRED.length, ok: true };
    });
    summary.phases.push(envPhase);
    if (!envPhase.ok) {
      summary.failureCode = "ENV_FAILURE";
      return finalize(summary, startedAt);
    }
    summary.envValid = true;

    // Phase 3: db connect smoke test. Pool is lazy-imported here so a
    // missing DATABASE_URL surfaces in validate-env (above), not as a
    // module-load crash.
    const dbPhase = await phase("db-connect", async () => {
      const { pool } = await import("../db");
      const r = await pool.query("SELECT 1 as ok");
      return { ok: r.rows[0]?.ok === 1 };
    });
    summary.phases.push(dbPhase);
    if (!dbPhase.ok) {
      summary.failureCode = "DB_FAILURE";
      return finalize(summary, startedAt);
    }

    // From here on, admin failure summary is allowed.

    const autoPhase = await phase("auto-complete", handlers.autoComplete);
    summary.phases.push(autoPhase);
    const autoRes = autoPhase.result as { completed?: number } | undefined;
    if (autoPhase.ok && typeof autoRes?.completed === "number") {
      summary.bookingsAutoCompleted = autoRes.completed;
    }

    const remPhase = await phase("reminders", handlers.reminders);
    summary.phases.push(remPhase);
    const remRes = remPhase.result as Partial<ReminderPhaseResult> | undefined;
    if (remPhase.ok && remRes) {
      if (typeof remRes.sent === "number") summary.remindersSent = remRes.sent;
      if (typeof remRes.failed === "number") summary.remindersFailed = remRes.failed;
      if (typeof remRes.attempts === "number") summary.remindersAttempts = remRes.attempts;
      if (typeof remRes.capped === "boolean") summary.remindersCapped = remRes.capped;
    }

    const expPhase = await phase("package-expiry", async () => {
      await handlers.expiry();
      return { ok: true };
    });
    summary.phases.push(expPhase);

    const chkPhase = await phase("missed-checkin", async () => {
      await handlers.checkin();
      return { ok: true };
    });
    summary.phases.push(chkPhase);

    summary.ok = summary.phases.every((p) => p.ok);
    if (!summary.ok) {
      const firstFail = summary.phases.find((p) => !p.ok);
      summary.failureCode = firstFail?.error?.code ?? "UNKNOWN_RUNTIME";
    }
    return finalize(summary, startedAt);
  } finally {
    releaseLock(tickId);
  }
}

function finalize(summary: CronTickSummary, startedAt: Date): CronTickSummary {
  summary.completedAt = new Date().toISOString();
  summary.durationMs = Date.now() - startedAt.getTime();
  console.log(
    `[cron] === tick end id=${summary.tickId} ok=${summary.ok}` +
      ` ms=${summary.durationMs} failureCode=${summary.failureCode ?? "-"}` +
      ` reminders=${summary.remindersSent}/${summary.remindersSent + summary.remindersFailed}` +
      ` autoCompleted=${summary.bookingsAutoCompleted} ===`,
  );
  // Fire-and-forget — never blocks the HTTP response.
  void maybeSendAdminSummary(summary).catch((e) =>
    console.warn(`[cron] admin summary send failed: ${e?.message || e}`),
  );
  return summary;
}

// ---------- admin summary (opt-in via CRON_ADMIN_EMAIL) ----------

async function maybeSendAdminSummary(summary: CronTickSummary): Promise<void> {
  const to = process.env.CRON_ADMIN_EMAIL;
  if (!to) return;
  // Operator-concern failures: never admin-email (would just spam).
  if (
    summary.failureCode === "ENV_FAILURE" ||
    summary.failureCode === "OVERLAP"
  ) {
    return;
  }
  // DB_FAILURE on the connect smoke test is also operator-concern
  // (Neon paused, network split). Skip. A DB failure mid-phase will
  // surface as QUERY_FAILURE which we DO email.
  const dbConnectPhase = summary.phases.find((p) => p.name === "db-connect");
  if (summary.failureCode === "DB_FAILURE" && dbConnectPhase && !dbConnectPhase.ok) {
    return;
  }
  // Only email when there's something worth saying.
  const hasActivity =
    summary.remindersSent > 0 ||
    summary.remindersFailed > 0 ||
    summary.bookingsAutoCompleted > 0 ||
    !summary.ok;
  if (!hasActivity) return;

  const lines: string[] = [];
  lines.push(`Cron tick ${summary.ok ? "OK" : `FAIL (${summary.failureCode})`}`);
  lines.push(`Tick id:   ${summary.tickId}`);
  lines.push(`Started:   ${summary.startedAt}`);
  lines.push(`Duration:  ${summary.durationMs} ms`);
  lines.push("");
  lines.push("Activity:");
  lines.push(`  reminders sent:          ${summary.remindersSent}`);
  lines.push(`  reminders failed:        ${summary.remindersFailed}`);
  lines.push(`  reminders attempted:     ${summary.remindersAttempts}`);
  if (summary.remindersCapped) {
    lines.push(`  ⚠ hit per-tick email cap (${cronGuards.maxEmailsPerTick}) — remaining recipients deferred to next tick`);
  }
  lines.push(`  bookings auto-completed: ${summary.bookingsAutoCompleted}`);
  lines.push("");
  lines.push("Phases:");
  for (const p of summary.phases) {
    lines.push(
      `  ${p.ok ? "OK  " : "FAIL"}  ${p.name.padEnd(18)}  ${String(p.ms).padStart(5)} ms` +
        (p.error ? `   [${p.error.code}] ${p.error.message}` : ""),
    );
  }

  const { sendEmail } = await import("../email");
  await sendEmail({
    to,
    subject: summary.ok
      ? `[cron] OK · ${summary.remindersSent} reminders · ${summary.bookingsAutoCompleted} auto-completed`
      : `[cron] FAIL · ${summary.failureCode}`,
    text: lines.join("\n"),
  });
}
