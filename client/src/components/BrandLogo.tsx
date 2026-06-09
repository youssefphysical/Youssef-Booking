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
 * Flicker prevention — zero-localStorage approach:
 *  index.html boots a fetch("/api/settings") at HTML parse time (before the JS
 *  bundle even downloads).  The resolved data is stored on window.__YE_INITIAL_SETTINGS__
 *  and useSettings() picks it up via initialData — so on fast networks, settings
 *  is non-undefined on the very FIRST React render and the correct logo URL is
 *  known before the component paints.
 *
 *  While settings is loading (slow network / first cold visit):
 *  • The navbar wrapper is rendered with visibility:hidden so it occupies the
 *    correct space (CSS vars are applied synchronously by the index.html boot
 *    script from ye_brand_settings) but nothing is visible — no wrong logo,
 *    no layout shift.
 *  • Static fallbacks (/ye-logo.png) are NEVER shown during loading; they only
 *    activate once settings has fully loaded AND no custom logo was uploaded.
 *
 * Size / glow / offset — CSS vars set by applyLogoSlotCSSVars() (brandSettings.ts):
 *  desktop navbar: --brand-navbar-*   mobile navbar: --brand-mobile-*
 *  sidebar:        --brand-sidebar-*  footer:        --brand-footer-*
 *  icon:           --brand-icon-*
 */

import { useSettings } from "@/hooks/use-settings";

interface BrandLogoProps {
  variant?: "navbar" | "sidebar" | "footer" | "icon";
  className?: string;
}

const DEFAULT_SIZES: Record<Exclude<NonNullable<BrandLogoProps["variant"]>, "navbar">, number> = {
  sidebar: 32,
  footer:  22,
  icon:    36,
};

export function BrandLogo({ variant = "navbar", className = "" }: BrandLogoProps) {
  const { data: settings } = useSettings();

  const isLoaded = settings !== undefined;
  const bs       = (settings?.brandSettings ?? {}) as Record<string, number>;

  // ── Resolve source URLs ──────────────────────────────────────────────────
  // Only populate when settings has arrived from the server.
  // No localStorage, no static-file fallback while loading.
  const iconSrc    = isLoaded ? (settings.logoIconUrl     || "/ye-logo.png")  : null;
  const navbarSrc  = isLoaded ? (settings.logoNavbarUrl   || iconSrc)         : null;
  const mobileSrc  = isLoaded ? (settings.logoMobileUrl   || iconSrc)         : null;
  const sidebarSrc = isLoaded ? (settings.logoDashboardUrl || iconSrc)        : null;
  const footerSrc  = isLoaded ? (settings.logoFooterUrl   || iconSrc)         : null;

  const showNavbar = isLoaded ? ((bs.logoShowNavbar ?? 1) !== 0) : true;
  const showFooter = isLoaded ? ((bs.logoShowFooter ?? 1) !== 0) : true;

  // ── Navbar variant ───────────────────────────────────────────────────────
  if (variant === "navbar") {
    // Settings hidden once loaded + flag false → completely absent
    if (isLoaded && !showNavbar) return null;

    // While settings is loading: invisible wrapper with reserved dimensions
    // (CSS vars already applied by the index.html boot script, so height is
    // correct — no layout shift when the logo appears).
    if (!isLoaded) {
      return (
        <span
          className={`inline-flex items-center justify-center shrink-0 ${className}`}
          aria-hidden="true"
          style={{
            overflow:   "visible",
            visibility: "hidden",
            // Inline fallbacks keep the navbar from collapsing if the CSS
            // vars haven't been written yet (very first cold visit).
            minWidth: "60px",
          }}
        >
          <span className="hidden md:block" style={{ height: "var(--brand-navbar-h-desktop, 60px)", width: "80px" }} />
          <span className="block md:hidden"  style={{ height: "var(--brand-mobile-h-mobile, 44px)",  width: "60px" }} />
        </span>
      );
    }

    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        aria-label="Youssef Elite"
        style={{ overflow: "visible" }}
      >
        {/* Mobile — logoMobileUrl slot, falls back to iconSrc */}
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
      style={!isLoaded ? { visibility: "hidden" } : undefined}
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
