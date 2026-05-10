/**
 * PWA helpers — install prompt + standalone detection.
 *
 * Lightweight, framework-free. No SDK, no analytics, no tracking — just
 * the native `beforeinstallprompt` + `display-mode: standalone` web
 * standards wrapped into one ergonomic hook.
 */

import { useEffect, useState, useCallback } from "react";

const DISMISS_KEY = "pwa.install.dismissed.v1";
// Re-show the prompt at most every 14 days after a dismissal so we
// never nag, but a returning user who didn't install still discovers
// the option after a fortnight. Hard "Not now" is sticky for the
// session AND persists across reloads via localStorage.
const DISMISS_TTL_MS = 14 * 24 * 60 * 60 * 1000;

/**
 * Subset of the BeforeInstallPromptEvent we actually use. The full
 * type isn't in lib.dom yet because the spec is non-standard — we
 * keep the shape minimal and call .prompt() defensively.
 */
type DeferredPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

/**
 * True when the page is launched in standalone mode (installed PWA on
 * Android/Chrome OS or "Add to Home Screen" on iOS Safari). Both APIs
 * are queried so we cover every browser shipping today.
 */
export function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  // Modern browsers (Chromium, Firefox, Safari 16.4+).
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari legacy — `navigator.standalone` is iOS-only and not in
  // the standard typings, hence the cast.
  const navAny = window.navigator as unknown as { standalone?: boolean };
  return navAny.standalone === true;
}

function readDismissedAt(): number | null {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function isWithinDismissWindow(): boolean {
  const at = readDismissedAt();
  if (at === null) return false;
  return Date.now() - at < DISMISS_TTL_MS;
}

/**
 * useInstallPrompt — premium-banner controller.
 *
 * Returns:
 *   canPrompt   — true when the browser captured a deferred prompt
 *                 AND the user hasn't dismissed within the TTL AND
 *                 the app isn't already running standalone.
 *   promptInstall() — invokes the native prompt; resolves to the
 *                     user's choice. After a successful or dismissed
 *                     prompt, canPrompt flips to false.
 *   dismiss()       — user said "Maybe later"; remembered for TTL.
 *   installed       — true after the OS reports `appinstalled` OR
 *                     when `isStandalone()` becomes true at runtime.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState<DeferredPrompt | null>(null);
  const [installed, setInstalled] = useState<boolean>(() => isStandalone());
  const [dismissedRecently, setDismissedRecently] = useState<boolean>(() =>
    isWithinDismissWindow()
  );

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (installed) return; // nothing to capture once installed

    const onBeforeInstall = (e: Event) => {
      // Stop the browser's default mini-infobar — we render our own
      // premium banner instead.
      e.preventDefault();
      setDeferred(e as DeferredPrompt);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
      // A successful install also means we should clear any prior
      // dismissal so reinstalls (e.g. after uninstall) work cleanly.
      try { localStorage.removeItem(DISMISS_KEY); } catch {}
    };
    // matchMedia change → user installed via browser menu (no
    // beforeinstallprompt fired) or uninstalled.
    const mm = window.matchMedia?.("(display-mode: standalone)");
    const onDisplayChange = () => setInstalled(isStandalone());

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    mm?.addEventListener?.("change", onDisplayChange);

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      mm?.removeEventListener?.("change", onDisplayChange);
    };
  }, [installed]);

  const promptInstall = useCallback(async () => {
    if (!deferred) return { outcome: "dismissed" as const };
    try {
      await deferred.prompt();
      const choice = await deferred.userChoice;
      // Per spec the deferred prompt is single-use.
      setDeferred(null);
      if (choice.outcome === "dismissed") {
        try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
        setDismissedRecently(true);
      }
      return choice;
    } catch {
      setDeferred(null);
      return { outcome: "dismissed" as const };
    }
  }, [deferred]);

  const dismiss = useCallback(() => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setDismissedRecently(true);
  }, []);

  const canPrompt = !!deferred && !installed && !dismissedRecently;

  return { canPrompt, promptInstall, dismiss, installed };
}
