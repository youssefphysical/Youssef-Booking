/**
 * BrandLogo — Youssef Elite unified brand identity component.
 *
 * Brand hierarchy (all read from settings, fall back to static assets):
 *  "navbar"  — uses logoNavbarUrl (horizontal logo). Falls back to logoIconUrl → /ye-logo.png.
 *              Height driven by CSS vars --brand-navbar-h-desktop / --brand-navbar-h-mobile.
 *  "sidebar" — uses logoIconUrl. Size from --brand-sidebar-h-desktop (default 32px).
 *  "footer"  — uses logoIconUrl. Size from --brand-footer-h-desktop (default 22px).
 *  "icon"    — uses logoIconUrl. Size from --brand-icon-h-desktop (default 36px).
 *
 * Cache: shares the /api/settings TanStack Query cache with useSettings() — invalidating
 * that cache (after logo upload) propagates immediately without any staleTime delay.
 */

import { useSettings } from "@/hooks/use-settings";

interface BrandLogoProps {
  variant?: "navbar" | "sidebar" | "footer" | "icon";
  className?: string;
}

const GLOW      = "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-logo-glow,0.35)))";
const GLOW_ICON = "drop-shadow(0 0 7px rgba(0,212,255,var(--brand-logo-glow,0.35)))";

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
  const desktopPad = `${bs.logoDesktopPadding ?? 5}px`;
  const mobilePad  = `${bs.logoMobilePadding  ?? 4}px`;

  if (variant === "navbar") {
    if (!showNavbar) return null;
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        aria-label="Youssef Elite"
        style={{ overflow: "visible" }}
      >
        {/* Mobile — icon only */}
        <img
          src={iconSrc}
          alt=""
          aria-hidden="true"
          className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] block md:hidden"
          style={{
            height:    "var(--brand-navbar-h-mobile,52px)",
            width:     "auto",
            filter:    GLOW,
            padding:   mobilePad,
            transform: "translateY(var(--brand-logo-voffset,0px))",
          }}
        />
        {/* Desktop — horizontal logo (logoNavbarUrl) or icon fallback */}
        <img
          src={navbarSrc}
          alt=""
          aria-hidden="true"
          className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] hidden md:block"
          style={{
            height:    "var(--brand-navbar-h-desktop,60px)",
            width:     "auto",
            filter:    GLOW,
            padding:   desktopPad,
            transform: "translateY(var(--brand-logo-voffset,0px))",
          }}
        />
      </span>
    );
  }

  if (variant === "footer" && !showFooter) return null;

  const fallbackSize = DEFAULT_SIZES[variant];
  const cssVar = `var(--brand-${variant}-h-desktop, ${fallbackSize}px)`;

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
          filter: GLOW_ICON,
        }}
      />
    </span>
  );
}
