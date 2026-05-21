import { useCallback, useEffect, useRef, useState } from "react";

const DRAFT_PREFIX = "yapt:draft:v1:";
const DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;

type StoredDraft<T> = { value: T; savedAt: number };

function readDraft<T>(key: string, ttlMs: number): StoredDraft<T> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(DRAFT_PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredDraft<T>;
    if (!parsed || typeof parsed.savedAt !== "number") return null;
    if (Date.now() - parsed.savedAt > ttlMs) {
      window.localStorage.removeItem(DRAFT_PREFIX + key);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    const payload: StoredDraft<T> = { value, savedAt: Date.now() };
    window.localStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(payload));
  } catch {
    /* quota or disabled — swallow */
  }
}

function clearDraft(key: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(DRAFT_PREFIX + key);
  } catch {
    /* ignore */
  }
}

export interface UseDraftOptions<T> {
  /** Stable key used in localStorage. Keep scoped per-user/form. */
  key: string;
  /** Live form value to persist. */
  value: T;
  /** Whether to capture writes. Defaults to true. */
  enabled?: boolean;
  /** Auto-save debounce. Defaults to 600ms. */
  debounceMs?: number;
  /** Drop the draft if it's older than this. Defaults to 24h. */
  ttlMs?: number;
}

export interface UseDraftResult<T> {
  hasDraft: boolean;
  draft: T | null;
  savedAt: number | null;
  restore: () => T | null;
  clear: () => void;
}

/**
 * Persist a form's in-progress value to localStorage so a hard refresh,
 * tab close, or PWA cold start never costs the user their work.
 *
 * Pattern:
 *   const draft = useDraft({ key: `book:${user.id}`, value: form.watch() });
 *   useEffect(() => { if (draft.hasDraft) showRestoreToast(); }, []);
 */
export function useDraft<T>({
  key,
  value,
  enabled = true,
  debounceMs = 600,
  ttlMs = DEFAULT_TTL_MS,
}: UseDraftOptions<T>): UseDraftResult<T> {
  // Phase 5 review fix — `key` is reactive. Booking/Wizard mount before
  // `user.id` resolves, so the key flips from `book:anon` → `book:<id>`
  // mid-render. Re-read the stored draft whenever the key changes (and
  // reset the de-dupe memo) so cold reload with a logged-in user
  // actually restores the right draft instead of being stuck on the
  // first read.
  const [initial, setInitial] = useState<StoredDraft<T> | null>(() => readDraft<T>(key, ttlMs));
  const lastKey = useRef<string>(key);
  const timer = useRef<number | null>(null);
  const lastSerialized = useRef<string>("");

  useEffect(() => {
    if (lastKey.current === key) return;
    lastKey.current = key;
    lastSerialized.current = "";
    setInitial(readDraft<T>(key, ttlMs));
  }, [key, ttlMs]);

  useEffect(() => {
    if (!enabled) return;
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      try {
        const serialized = JSON.stringify(value);
        if (serialized === lastSerialized.current) return;
        // Skip writing empty objects/arrays — nothing to restore.
        if (serialized === "{}" || serialized === "[]" || serialized === "null") return;
        lastSerialized.current = serialized;
        writeDraft(key, value);
      } catch {
        /* unserialisable value — skip */
      }
    }, debounceMs);
    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
  }, [key, value, enabled, debounceMs]);

  const restore = useCallback(() => initial?.value ?? null, [initial]);
  const clear = useCallback(() => clearDraft(key), [key]);

  return {
    hasDraft: !!initial,
    draft: initial?.value ?? null,
    savedAt: initial?.savedAt ?? null,
    restore,
    clear,
  };
}
