/**
 * Phase 5 — post-login route preloading. Dynamic `import()` is cached by
 * the module loader, so calling these helpers from a hover/focus/touch
 * handler (or from the login success callback) primes the chunk before
 * the user actually navigates. The lazy() declarations in App.tsx hit
 * the same cached promise and resolve instantly.
 */
export const preloadDashboard = () => import("@/pages/ClientDashboard");
export const preloadBooking = () => import("@/pages/BookingPage");
export const preloadWizard = () => import("@/pages/TrainingLocationWizard");
export const preloadProfile = () => import("@/pages/ProfilePage");

export function preloadPathForUser(role: string | null | undefined) {
  // Fire-and-forget; failures are silently ignored (offline, etc.).
  preloadDashboard().catch(() => {});
  preloadBooking().catch(() => {});
  preloadWizard().catch(() => {});
  if (role === "client") preloadProfile().catch(() => {});
}

const PRELOAD_MAP: Record<string, () => Promise<unknown>> = {
  "/dashboard": preloadDashboard,
  "/book": preloadBooking,
  "/wizard": preloadWizard,
  "/profile": preloadProfile,
};

export function preloadHref(href: string) {
  const base = href.split("?")[0].split("#")[0];
  const fn = PRELOAD_MAP[base];
  if (fn) fn().catch(() => {});
}
