/**
 * BrandLogo — renders logo images from Media Manager, with /brand-logo.png
 * as an immediate synchronous fallback so the logo is ALWAYS visible from
 * the very first React render — no API response required.
 *
 * SOURCE HIERARCHY — MM-chain with static fallback:
 *  "navbar"  — desktop: logoNavbarUrl → logoIconUrl → /brand-logo.png
 *              mobile:  logoMobileUrl → logoNavbarUrl → logoIconUrl → /brand-logo.png
 *  "sidebar" — logoDashboardUrl → logoIconUrl → /brand-logo.png
 *  "footer"  — logoFooterUrl   → logoIconUrl → /brand-logo.png
 *  "icon"    — logoIconUrl → /brand-logo.png
 *
 * LOADING STATE (settings === undefined):
 *  Shows /brand-logo.png immediately — the canonical brand logo is preloaded
 *  by index.html so it is already in the browser cache on first render.
 *  CSS-var-controlled dimensions are set synchronously at boot by index.html
 *  from localStorage, so sizing is always correct on frame 0.
 *
 * EMPTY STATE (all MM slots null after load):
 *  Also shows /brand-logo.png — same treatment as loading state.
 *
 * CACHE-BUSTING:
 *  settings.updatedAt is appended as ?v={ms} so browsers re-fetch after admin
 *  uploads, even if the path didn't change. Applied to every img src.
 *
 * MOBILE FALLBACK CHAIN:
 *  Mobile slot falls back to navbar slot first (not icon), so an admin who only
 *  uploads a horizontal navbar logo automatically gets it on mobile too.
 */

import { useSettings } from "@/hooks/use-settings";

interface BrandLogoProps {
  variant?: "navbar" | "sidebar" | "footer" | "icon";
  className?: string;
}

/**
 * Append ?v=<updatedAt ms> for cache-busting.
 * Falls back to FALLBACK_SRC when url is falsy.
 */
const FALLBACK_SRC = "/brand-logo.png";

function bustUrl(url: string | null | undefined, updatedAt: unknown): string {
  if (!url) return FALLBACK_SRC;
  const v = updatedAt ? new Date(updatedAt as string).getTime() : NaN;
  if (!v || isNaN(v)) return url;
  return url.includes("?") ? `${url}&v=${v}` : `${url}?v=${v}`;
}

const VARIANT_HEIGHT: Record<Exclude<NonNullable<BrandLogoProps["variant"]>, "navbar">, string> = {
  sidebar: "var(--brand-sidebar-h-desktop, 48px)",
  footer:  "var(--brand-footer-h-desktop,  36px)",
  icon:    "var(--brand-icon-h-desktop,    36px)",
};

export function BrandLogo({ variant = "navbar", className = "" }: BrandLogoProps) {
  const { data: settings } = useSettings();
  const isLoaded = settings !== undefined;
  const bs       = (settings?.brandSettings ?? {}) as Record<string, number>;

  // ── NAVBAR variant ────────────────────────────────────────────────────────
  if (variant === "navbar") {
    if (isLoaded && (bs.logoShowNavbar ?? 1) === 0) return null;

    const mH = "var(--brand-mobile-h-mobile, 44px)";
    const dH = "var(--brand-navbar-h-desktop, 60px)";

    // Resolve MM-chain sources — fall back to /brand-logo.png when not loaded
    // or when no custom URL is configured.
    const ua      = isLoaded ? (settings as any).updatedAt : null;
    const iconRaw = isLoaded ? (settings.logoIconUrl    || null) : null;
    const nRaw    = isLoaded ? (settings.logoNavbarUrl  || iconRaw) : null;
    const mRaw    = isLoaded ? (settings.logoMobileUrl  || nRaw)    : null;

    const nSrc = isLoaded ? bustUrl(nRaw, ua) : FALLBACK_SRC;
    const mSrc = isLoaded ? bustUrl(mRaw, ua) : FALLBACK_SRC;

    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        aria-label="Youssef Elite"
        style={{ overflow: "visible" }}
      >
        {/* Mobile slot */}
        <img
          src={mSrc}
          alt="Youssef Elite official logo"
          className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] block md:hidden"
          style={{
            height:    mH,
            width:     "auto",
            filter:    "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-mobile-glow, var(--brand-logo-glow, 0.35))))",
            padding:   "var(--brand-mobile-padding,  var(--brand-logo-padding, 4px))",
            transform: "translateY(var(--brand-mobile-vpos, var(--brand-logo-voffset, 0px)))",
          }}
        />
        {/* Desktop slot */}
        <img
          src={nSrc}
          alt="Youssef Elite official logo"
          className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] hidden md:block"
          style={{
            height:    dH,
            width:     "auto",
            filter:    "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-navbar-glow, var(--brand-logo-glow, 0.35))))",
            padding:   "var(--brand-navbar-padding,  var(--brand-logo-padding, 5px))",
            transform: "translateY(var(--brand-navbar-vpos, var(--brand-logo-voffset, 0px)))",
          }}
        />
      </span>
    );
  }

  // ── FOOTER / SIDEBAR / ICON variants ─────────────────────────────────────
  if (variant === "footer" && isLoaded && (bs.logoShowFooter ?? 1) === 0) return null;

  const heightVar = VARIANT_HEIGHT[variant];

  const ua         = isLoaded ? (settings as any).updatedAt : null;
  const iconRaw    = isLoaded ? (settings.logoIconUrl       || null) : null;
  const sidebarRaw = isLoaded ? (settings.logoDashboardUrl  || iconRaw) : null;
  const footerRaw  = isLoaded ? (settings.logoFooterUrl     || iconRaw) : null;

  const variantRaw = variant === "sidebar" ? sidebarRaw
                   : variant === "footer"  ? footerRaw
                   : iconRaw;

  const variantSrc = isLoaded ? bustUrl(variantRaw, ua) : FALLBACK_SRC;

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-label="Youssef Elite"
      style={{ overflow: "visible" }}
    >
      <img
        src={variantSrc}
        alt="Youssef Elite official logo"
        className="object-contain shrink-0"
        style={{
          height:   heightVar,
          width:    heightVar,
          overflow: "visible",
          filter:   `drop-shadow(0 0 7px rgba(0,212,255,var(--brand-${variant}-glow, var(--brand-logo-glow, 0.35))))`,
        }}
      />
    </span>
  );
}
