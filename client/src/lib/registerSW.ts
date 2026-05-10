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
      .catch(() => {
        // Swallow — a failed SW must not break the app.
      });
  });
}
