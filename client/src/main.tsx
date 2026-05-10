import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { initAnalytics } from "./lib/analytics";
import { registerServiceWorker } from "./lib/registerSW";
import { isStandalone } from "./lib/pwa";

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
