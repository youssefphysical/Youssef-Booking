/**
 * BrandLogo — Youssef Elite unified brand identity component.
 *
 * Image source hierarchy (all read from settings, fall back to static assets):
 *  "navbar"  — desktop: logoNavbarUrl → logoIconUrl → /ye-logo.png
 *              mobile:  logoMobileUrl → logoNavbarUrl → logoIconUrl → /ye-logo.png
 *  "sidebar" — logoDashboardUrl → logoIconUrl → /ye-logo.png
 *  "footer"  — logoFooterUrl   → logoIconUrl → /ye-logo.png
 *  "icon"    — logoIconUrl     → /ye-logo.png
 *
 * Flicker / disappearance prevention:
 *  - Sources are resolved with optional-chaining (`settings?.logoX`), so when
 *    `settings` is undefined the static fallback "/ye-logo.png" is used immediately.
 *  - The component NEVER returns `visibility:hidden` — something always renders.
 *  - Mobile logo falls back to navbar logo first (then icon → static), so an
 *    admin who only uploads a horizontal logo automatically gets it on mobile too.
 *  - On fast networks the boot fetch (started in index.html before JS parses)
 *    means `settings` is defined on the very first React render, so the correct
 *    custom logo is shown from frame 0 with no flicker at all.
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

const STATIC_FALLBACK = "/ye-logo.png";

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
  // Optional-chaining + `||` means sources are always defined — even when
  // `settings` is undefined (first paint, slow network, or TanStack Query's
  // brief initialData→queryFn transition).
  //
  // MOBILE falls back to navbarSrc (not just iconSrc) so an admin who only
  // uploads a horizontal navbar logo automatically gets it on mobile too.
  const iconSrc    = settings?.logoIconUrl    || STATIC_FALLBACK;
  const navbarSrc  = settings?.logoNavbarUrl  || iconSrc;
  const mobileSrc  = settings?.logoMobileUrl  || navbarSrc;   // mobile → navbar → icon → static
  const sidebarSrc = settings?.logoDashboardUrl || iconSrc;
  const footerSrc  = settings?.logoFooterUrl  || iconSrc;

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
        {/* Mobile — logoMobileUrl slot, falls back to navbarSrc → iconSrc → static */}
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
        {/* Desktop — horizontal logo (logoNavbarUrl → iconSrc → static) */}
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
    </span>
  );
}
