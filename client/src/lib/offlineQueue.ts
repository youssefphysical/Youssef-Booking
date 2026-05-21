/**
 * Phase 5 — durable offline submit queue.
 *
 * When a critical user submission (booking, wizard activation request)
 * fails because the network is down, we enqueue the full payload to
 * localStorage instead of losing it. A background replay loop drains the
 * queue when the browser fires `online`, and the OfflineQueueBanner
 * surfaces the pending count + a manual retry button.
 */

const STORAGE_KEY = "yapt:queue:v1";
const MAX_JOBS = 25;
const MAX_RETRIES = 6;

export type QueueJobKind = "booking" | "wizard_activation" | "wizard_location";

export interface QueueJob {
  id: string;
  kind: QueueJobKind;
  payload: any;
  endpoint: string;
  method: "POST";
  createdAt: number;
  attempts: number;
  lastError?: string;
  // Phase 5 review fix — when the server returns a 4xx the payload is
  // *not* deleted (the user would lose their input). Instead we park it
  // in a "needs attention" state: replayAll() skips these so it doesn't
  // spin, and the banner surfaces them so the user can review/retry
  // manually after fixing the underlying issue (re-login, validation,
  // rate-limit cool-down, etc.).
  needsAttention?: boolean;
  lastStatus?: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();
function emit() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      /* swallow */
    }
  });
}

function safeParse(raw: string | null): QueueJob[] {
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}

function readAll(): QueueJob[] {
  if (typeof localStorage === "undefined") return [];
  return safeParse(localStorage.getItem(STORAGE_KEY));
}

function writeAll(jobs: QueueJob[]) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs.slice(-MAX_JOBS)));
  } catch {
    /* quota — drop silently rather than crash the page */
  }
}

export function getQueue(): QueueJob[] {
  return readAll();
}

export function subscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function genId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function enqueue(
  kind: QueueJobKind,
  endpoint: string,
  payload: any,
): QueueJob {
  const job: QueueJob = {
    id: genId(),
    kind,
    endpoint,
    method: "POST",
    payload,
    createdAt: Date.now(),
    attempts: 0,
  };
  const all = readAll();
  all.push(job);
  writeAll(all);
  emit();
  return job;
}

export function remove(id: string) {
  writeAll(readAll().filter((j) => j.id !== id));
  emit();
}

export function clearAll() {
  writeAll([]);
  emit();
}

let replaying = false;

/**
 * Drain the queue by re-POSTing each job. A job that returns 4xx is
 * considered permanently failed (the server rejected the *content*,
 * not the network) and removed so it doesn't block the rest. 5xx and
 * network failures bump `attempts` and stay queued.
 */
export async function replayAll(): Promise<{
  ok: number;
  failed: number;
  remaining: number;
}> {
  if (replaying) return { ok: 0, failed: 0, remaining: readAll().length };
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    return { ok: 0, failed: 0, remaining: readAll().length };
  }
  replaying = true;
  let ok = 0;
  let failed = 0;
  try {
    const jobs = readAll();
    for (const job of jobs) {
      // Phase 5 review fix — skip jobs the user has been asked to review.
      // They stay in localStorage until manually re-tried (clearAttention)
      // or discarded; we never auto-delete them and lose the payload.
      if (job.needsAttention) continue;
      try {
        const res = await fetch(job.endpoint, {
          method: job.method,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(job.payload),
          credentials: "include",
        });
        if (res.ok) {
          remove(job.id);
          ok += 1;
        } else if (res.status >= 400 && res.status < 500) {
          // Server rejected the *content* (or the session). The payload
          // is preserved and surfaced to the user as "needs attention"
          // so they can re-login (401), wait out a rate-limit (429),
          // fix validation (400/422), etc. and retry manually.
          const txt = await res.text().catch(() => "");
          job.lastError = `HTTP ${res.status}: ${txt.slice(0, 200)}`;
          job.lastStatus = res.status;
          job.needsAttention = true;
          writeAll(readAll().map((j) => (j.id === job.id ? job : j)));
          failed += 1;
        } else {
          // Transient (5xx) — bump attempts and keep.
          job.attempts += 1;
          job.lastError = `HTTP ${res.status}`;
          job.lastStatus = res.status;
          if (job.attempts >= MAX_RETRIES) {
            // Park instead of delete — user can still see + retry.
            job.needsAttention = true;
            failed += 1;
          }
          writeAll(readAll().map((j) => (j.id === job.id ? job : j)));
        }
      } catch (err: any) {
        job.attempts += 1;
        job.lastError = err?.message || "network";
        if (job.attempts >= MAX_RETRIES) {
          job.needsAttention = true;
          failed += 1;
        }
        writeAll(readAll().map((j) => (j.id === job.id ? job : j)));
        // Network is gone again — stop the loop to avoid spinning.
        break;
      }
    }
  } finally {
    replaying = false;
    emit();
  }
  return { ok, failed, remaining: readAll().length };
}

/**
 * Manually re-arm a job that was parked as needs-attention. Resets
 * attempts so the next replayAll() will try it again. The banner's
 * "Retry now" button calls this for every parked job before draining.
 */
export function clearAttention(id?: string) {
  const all = readAll().map((j) => {
    if (id && j.id !== id) return j;
    if (!j.needsAttention) return j;
    return { ...j, needsAttention: false, attempts: 0 };
  });
  writeAll(all);
  emit();
}

/**
 * Returns true when the current environment looks "offline-ish" — either
 * `navigator.onLine` is explicitly false, or the error has a network shape
 * (TypeError/AbortError from fetch). Callers use this to decide whether
 * to enqueue a failed submit instead of toasting an error.
 */
export function isOfflineError(err: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  if (!err) return false;
  const e = err as any;
  const name = e?.name || "";
  const msg: string = e?.message || "";
  if (name === "TypeError" || name === "AbortError") return true;
  return /network|failed to fetch|load failed/i.test(msg);
}
