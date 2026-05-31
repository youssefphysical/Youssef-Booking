/**
 * BrandLogo — Youssef Elite unified brand identity component.
 *
 * Brand hierarchy (all read from settings, fall back to static assets):
 *  "navbar"  — desktop: logoNavbarUrl, driven by --brand-navbar-* slot vars.
 *              mobile:  logoIconUrl,   driven by --brand-mobile-* slot vars.
 *  "sidebar" — logoIconUrl. Size/glow from --brand-sidebar-* (aliased from dashboard slot).
 *  "footer"  — logoIconUrl. Size/glow from --brand-footer-* slot vars.
 *  "icon"    — logoIconUrl. Size from --brand-icon-h-desktop (default 36px).
 *
 * CSS var authorship: applyLogoSlotCSSVars() in lib/brandSettings.ts sets all
 * --brand-{slot}-* vars on every settings load and on every live slider change.
 * Per-slot vars take precedence over the legacy flat vars (--brand-logo-glow etc.)
 * via CSS var() fallback chaining.
 *
 * Cache: shares the /api/settings TanStack Query cache with useSettings() — invalidating
 * that cache (after logo upload or Save All) propagates immediately.
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

  const bs         = (settings?.brandSettings ?? {}) as Record<string, number>;
  const iconSrc    = settings?.logoIconUrl    || "/ye-logo.png";
  const navbarSrc  = settings?.logoNavbarUrl  || settings?.logoIconUrl || "/ye-logo.png";
  const showNavbar = (bs.logoShowNavbar ?? 1) !== 0;
  const showFooter = (bs.logoShowFooter ?? 1) !== 0;

  if (variant === "navbar") {
    if (!showNavbar) return null;
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        aria-label="Youssef Elite"
        style={{ overflow: "visible" }}
      >
        {/* Mobile — icon only, driven by "mobile" logo slot */}
        <img
          src={iconSrc}
          alt=""
          aria-hidden="true"
          className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] block md:hidden"
          style={{
            height:    "var(--brand-mobile-h-mobile, var(--brand-navbar-h-mobile, 52px))",
            width:     "auto",
            filter:    "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-mobile-glow, var(--brand-logo-glow, 0.35))))",
            padding:   "var(--brand-mobile-padding, var(--brand-logo-padding, 4px))",
            transform: "translateY(var(--brand-mobile-vpos, var(--brand-logo-voffset, 0px)))",
          }}
        />
        {/* Desktop — horizontal logo (logoNavbarUrl), driven by "navbar" logo slot */}
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

  if (variant === "footer" && !showFooter) return null;

  const fallbackSize = DEFAULT_SIZES[variant];
  const cssVar       = `var(--brand-${variant}-h-desktop, ${fallbackSize}px)`;

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-label="Youssef Elite"
    >
      <img
        src={iconSrc}
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
