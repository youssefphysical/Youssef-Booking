import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnalytics } from "./lib/analytics";
import { registerServiceWorker } from "./lib/registerSW";
import { isStandalone } from "./lib/pwa";

// ── Nuclear cache wipe on every startup ──────────────────────────────────────
// Unregisters every old SW and deletes every cache bucket so stale logo assets
// can never survive into the current session. Runs fire-and-forget; failures
// are silent so the app always mounts regardless.
(function nukeStaleCaches() {
  try {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker
        .getRegistrations()
        .then((regs) => regs.forEach((r) => r.unregister()))
        .catch(() => {});
    }
  } catch { /* swallow */ }
  try {
    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
    }
  } catch { /* swallow */ }
})();

// Tag the document root when the app is launched in standalone mode
// (installed PWA on Android, Add-to-Home-Screen on iOS) so CSS rules
// in `@media (display-mode: standalone)` AND the legacy iOS branch
// `html.is-standalone` both activate. Set BEFORE first paint so the
// AMOLED bg + overscroll-lock land on frame 0 — no visible swap.
if (isStandalone()) {
  document.documentElement.classList.add("is-standalone");
}

initAnalytics();
createRoot(document.getElementById("root")!).render(<App />);
registerServiceWorker();
