/**
 * Lightweight, env-gated analytics + Search Console glue.
 *
 * Both Google Analytics 4 (GA4) and the Google Search Console site
 * verification meta tag are *opt-in via Vite env vars*. When neither
 * env var is set the module is effectively a no-op — zero network
 * requests, zero global pollution, zero console errors.
 *
 * Env vars (set in Vercel project → Settings → Environment Variables):
 *   - VITE_GA_MEASUREMENT_ID         e.g. "G-XXXXXXXXXX"
 *   - VITE_GOOGLE_SITE_VERIFICATION  e.g. "abc123def456..."
 *
 * Public API:
 *   initAnalytics()                 — call once at app boot
 *   trackPageView(path)             — call on every route change
 *   trackEvent(name, params?)       — call for key user actions
 *
 * The exported event names below match the spec so they can be
 * wired up at the call sites (booking CTA, WhatsApp button, etc.)
 * without typos.
 */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const GA_ID =
  (import.meta.env?.VITE_GA_MEASUREMENT_ID as string | undefined) || "";
const SITE_VERIFICATION =
  (import.meta.env?.VITE_GOOGLE_SITE_VERIFICATION as string | undefined) || "";

let initialised = false;

export function initAnalytics(): void {
  if (initialised || typeof window === "undefined") return;
  initialised = true;

  // --- Google Search Console verification meta (purely additive) ---
  if (SITE_VERIFICATION) {
    try {
      const meta = document.createElement("meta");
      meta.name = "google-site-verification";
      meta.content = SITE_VERIFICATION;
      document.head.appendChild(meta);
    } catch {
      /* never break the app over a meta tag */
    }
  }

  // --- GA4 loader (only when measurement id is present) ---
  if (!GA_ID) return;

  try {
    window.dataLayer = window.dataLayer || [];
    // Use rest-args wrapper so the call stack matches the official snippet.
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
    window.gtag("js", new Date());
    window.gtag("config", GA_ID, {
      // We send page_view manually on route changes so SPA navigation
      // is tracked correctly. Disabling auto send avoids double-counting.
      send_page_view: false,
      anonymize_ip: true,
    });

    const s = document.createElement("script");
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(GA_ID)}`;
    document.head.appendChild(s);
  } catch {
    /* analytics must never break the app */
  }
}

export function trackPageView(path: string): void {
  if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
  try {
    window.gtag("event", "page_view", {
      page_path: path,
      page_location: window.location.href,
      page_title: document.title,
    });
  } catch {
    /* swallow */
  }
}

export function trackEvent(
  name: AnalyticsEvent,
  params?: Record<string, unknown>,
): void {
  if (!GA_ID || typeof window === "undefined" || !window.gtag) return;
  try {
    window.gtag("event", name, params || {});
  } catch {
    /* swallow */
  }
}

export type AnalyticsEvent =
  | "book_session_click"
  | "whatsapp_click"
  | "register_start"
  | "login_success"
  | "booking_created"
  | "package_view";

export const isAnalyticsEnabled = Boolean(GA_ID);
