/**
 * Service-worker registration — production only.
 *
 * Why prod-only:
 *  - In Vite dev the JS comes from /src/* and HMR over /@vite. A SW
 *    that intercepts those would break the dev experience and could
 *    serve stale modules. The SW itself bypasses /src/ and /@ routes
 *    defensively, but the cleanest rule is "no SW in dev at all".
 *  - On Replit's *.replit.dev preview the `import.meta.env.PROD` is
 *    false (vite dev), so the SW only ever activates on the deployed
 *    Vercel build — which is exactly what users install to home screen.
 *
 * Failures here MUST be silent. A SW that throws on register must
 * never block the React app from mounting.
 */
export function registerServiceWorker(): void {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  // Defer until after first paint so the SW install never competes
  // with the LCP render — the homepage hero is the LCP element.
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((reg) => {
        // Task #66 follow-up — force-update path. A stale SW that
        // intercepts the wizard JS was leaving real-mobile users on a
        // pre-fix bundle. Polling `reg.update()` makes the browser
        // re-check `/sw.js` on every page load, and if it differs from
        // the active worker, the new one installs in the background.
        // Combined with `skipWaiting` in sw.js, the user gets the
        // fresh bundle on the very next navigation/reload.
        try { reg.update(); } catch {/* defensive */}
        // When an updated worker takes over, reload once so the page
        // is served by the new SW (which has the new cache version).
        // Guarded by sessionStorage to avoid reload loops.
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.addEventListener("controllerchange", () => {
            try {
              if (sessionStorage.getItem("__sw_reloaded__") === "1") return;
              sessionStorage.setItem("__sw_reloaded__", "1");
              window.location.reload();
            } catch {/* private mode etc. */}
          });
        }
      })
      .catch(() => {
        // Swallow — a failed SW must not break the app.
      });
  });
}

/**
 * Nuclear reset helper — unregister every service worker and delete
 * every cache. Used by the wizard's "Diagnostic Reset" button when a
 * user appears to be stuck on a stale bundle. Safe in dev (no SW)
 * because the loops are no-ops.
 */
export async function resetAllCachesAndSW(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister().catch(() => {})));
    }
  } catch {/* swallow */}
  try {
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k).catch(() => {})));
    }
  } catch {/* swallow */}
}
