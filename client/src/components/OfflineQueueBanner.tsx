import { useEffect, useState } from "react";
import { CloudOff, RefreshCcw, Loader2, AlertTriangle } from "lucide-react";
import {
  getQueue,
  subscribe,
  replayAll,
  clearAttention,
} from "@/lib/offlineQueue";

/**
 * Phase 5 — sticky banner surfacing the offline-submit queue. Hidden when
 * the queue is empty. Auto-drains when `online` fires and offers a manual
 * Retry button so the user can force a flush without waiting for the
 * browser's offline/online events.
 */
export function OfflineQueueBanner() {
  const [{ total, attention }, setCounts] = useState(() => {
    const q = getQueue();
    return { total: q.length, attention: q.filter((j) => j.needsAttention).length };
  });
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refresh = () => {
      const q = getQueue();
      setCounts({
        total: q.length,
        attention: q.filter((j) => j.needsAttention).length,
      });
    };
    const unsub = subscribe(refresh);
    refresh();
    const onOnline = async () => {
      setBusy(true);
      try {
        await replayAll();
      } finally {
        setBusy(false);
      }
    };
    window.addEventListener("online", onOnline);
    // Best-effort: also try on mount in case the user reloaded the tab
    // while still online but with leftover jobs from a previous session.
    if (typeof navigator !== "undefined" && navigator.onLine) {
      void onOnline();
    }
    return () => {
      unsub();
      window.removeEventListener("online", onOnline);
    };
  }, []);

  if (total === 0) return null;

  const allNeedAttention = attention > 0 && attention === total;
  const palette = allNeedAttention
    ? {
        bg: "#1a0a0a",
        fg: "#ff8a8a",
        border: "rgba(255, 138, 138, 0.3)",
      }
    : {
        bg: "#0a1a1a",
        fg: "#5ee7ff",
        border: "rgba(94, 231, 255, 0.3)",
      };

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="banner-offline-queue"
      className="sticky top-0 z-[60] w-full flex items-center justify-center gap-3 px-4 py-2 text-xs font-medium"
      style={{
        background: palette.bg,
        color: palette.fg,
        borderBottom: `1px solid ${palette.border}`,
      }}
    >
      {allNeedAttention ? (
        <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
      ) : (
        <CloudOff className="h-3.5 w-3.5" aria-hidden />
      )}
      <span data-testid="text-queue-count">
        {total} submission{total === 1 ? "" : "s"} pending
        {attention > 0 ? ` (${attention} need attention)` : ""} — your input
        is saved on this device.
      </span>
      <button
        type="button"
        data-testid="button-queue-retry"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          try {
            // Re-arm any parked jobs so the user's "Retry now" actually
            // re-attempts them instead of being a no-op.
            clearAttention();
            await replayAll();
          } finally {
            setBusy(false);
          }
        }}
        className="ml-2 inline-flex items-center gap-1 rounded-md border border-current/30 px-2 py-0.5 hover:bg-white/5 active:bg-white/10 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : (
          <RefreshCcw className="h-3 w-3" />
        )}
        Retry now
      </button>
    </div>
  );
}
