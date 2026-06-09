/**
 * BrandLogo — Youssef Elite unified brand identity component.
 *
 * Image source hierarchy (all read from settings, fall back to static assets):
 *  "navbar"  — desktop: logoNavbarUrl → logoIconUrl → /ye-logo.png
 *              mobile:  logoMobileUrl → logoIconUrl → /ye-logo.png
 *  "sidebar" — logoDashboardUrl → logoIconUrl → /ye-logo.png
 *  "footer"  — logoFooterUrl   → logoIconUrl → /ye-logo.png
 *  "icon"    — logoIconUrl     → /ye-logo.png
 *
 * Flicker prevention:
 *  App.tsx writes `ye_logo_urls` to localStorage after every /api/settings load.
 *  This module reads that cache synchronously at import time so the correct URL
 *  is available on the very first render — before the API response arrives.
 *  While settings is loading, the cache is used; no static fallback is shown.
 *  Static fallbacks (/ye-logo.png) only activate after settings has fully loaded
 *  AND the admin has not uploaded a custom logo for that slot.
 *
 * Size / glow / offset — CSS vars set by applyLogoSlotCSSVars() (brandSettings.ts):
 *  desktop navbar: --brand-navbar-*   mobile navbar: --brand-mobile-*
 *  sidebar:        --brand-sidebar-*  footer:        --brand-footer-*
 *  icon:           --brand-icon-*
 *
 * Cache: shares the /api/settings TanStack Query cache with useSettings() — invalidating
 * that cache (after logo upload or Save All) propagates immediately.
 */

import { useSettings } from "@/hooks/use-settings";
import { readLogoUrlsCache, type LogoUrlsCache } from "@/lib/brandSettings";

interface BrandLogoProps {
  variant?: "navbar" | "sidebar" | "footer" | "icon";
  className?: string;
}

const DEFAULT_SIZES: Record<Exclude<NonNullable<BrandLogoProps["variant"]>, "navbar">, number> = {
  sidebar: 32,
  footer:  22,
  icon:    36,
};

// Read the URL cache once at module load — synchronous, no network wait.
// This value is the localStorage snapshot written by App.tsx after the previous
// session's /api/settings call.  It will be up-to-date on every hard refresh
// because App.tsx always writes it before the React tree unmounts.
const _urlCache: LogoUrlsCache = readLogoUrlsCache();

export function BrandLogo({ variant = "navbar", className = "" }: BrandLogoProps) {
  const { data: settings } = useSettings();

  const isLoaded = settings !== undefined;
  const bs       = (settings?.brandSettings ?? {}) as Record<string, number>;

  // ── Resolve source URLs ──────────────────────────────────────────────────
  // Phase A (isLoaded=false): settings still in flight → use localStorage cache.
  //   If the cache is empty (first ever visit) the src will be null and no <img>
  //   renders at all — blank space is correct per user requirement.
  // Phase B (isLoaded=true): API has responded → use the authoritative URL.
  //   Only now do static fallbacks kick in, because they are the intended default
  //   when no custom logo has been uploaded, NOT a loading placeholder.

  const iconSrc    = isLoaded
    ? (settings.logoIconUrl     || "/ye-logo.png")
    : (_urlCache.icon           ?? null);

  const navbarSrc  = isLoaded
    ? (settings.logoNavbarUrl   || iconSrc)
    : (_urlCache.navbar         ?? iconSrc);

  const mobileSrc  = isLoaded
    ? (settings.logoMobileUrl   || iconSrc)
    : (_urlCache.mobile         ?? iconSrc);

  const sidebarSrc = isLoaded
    ? (settings.logoDashboardUrl || iconSrc)
    : (_urlCache.dashboard       ?? iconSrc);

  const footerSrc  = isLoaded
    ? (settings.logoFooterUrl   || iconSrc)
    : (_urlCache.footer         ?? iconSrc);

  const showNavbar = isLoaded ? ((bs.logoShowNavbar ?? 1) !== 0) : true;
  const showFooter = isLoaded ? ((bs.logoShowFooter ?? 1) !== 0) : true;

  // ── Navbar variant ───────────────────────────────────────────────────────
  if (variant === "navbar") {
    if (isLoaded && !showNavbar) return null;
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        aria-label="Youssef Elite"
        style={{ overflow: "visible" }}
      >
        {/* Mobile — logoMobileUrl slot, falls back to iconSrc.
            Render nothing (no broken-image icon) when src is null. */}
        {mobileSrc && (
          <img
            src={mobileSrc}
            alt=""
            aria-hidden="true"
            className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] block md:hidden"
            style={{
              height:    "var(--brand-mobile-h-mobile, 44px)",
              width:     "auto",
              filter:    "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-mobile-glow, var(--brand-logo-glow, 0.35))))",
              padding:   "var(--brand-mobile-padding, var(--brand-logo-padding, 4px))",
              transform: "translateY(var(--brand-mobile-vpos, var(--brand-logo-voffset, 0px)))",
            }}
          />
        )}
        {/* Desktop — horizontal logo (logoNavbarUrl), driven by "navbar" logo slot */}
        {navbarSrc && (
          <img
            src={navbarSrc}
            alt=""
            aria-hidden="true"
            className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] hidden md:block"
            style={{
              height:    "var(--brand-navbar-h-desktop, 60px)",
              width:     "auto",
              filter:    "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-navbar-glow, var(--brand-logo-glow, 0.35))))",
              padding:   "var(--brand-navbar-padding, var(--brand-logo-padding, 5px))",
              transform: "translateY(var(--brand-navbar-vpos, var(--brand-logo-voffset, 0px)))",
            }}
          />
        )}
      </span>
    );
  }

  // ── Footer / sidebar / icon variants ─────────────────────────────────────
  if (variant === "footer" && isLoaded && !showFooter) return null;

  const fallbackSize = DEFAULT_SIZES[variant];
  const cssVar       = `var(--brand-${variant}-h-desktop, ${fallbackSize}px)`;
  const variantSrc   = variant === "sidebar" ? sidebarSrc
                     : variant === "footer"  ? footerSrc
                     : iconSrc;

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-label="Youssef Elite"
    >
      {variantSrc && (
        <img
          src={variantSrc}
          alt=""
          aria-hidden="true"
          className="object-contain shrink-0"
          style={{
            height: cssVar,
            width:  cssVar,
            filter: `drop-shadow(0 0 7px rgba(0,212,255,var(--brand-${variant}-glow, var(--brand-logo-glow, 0.35))))`,
          }}
        />
      )}
    </span>
  );
}
