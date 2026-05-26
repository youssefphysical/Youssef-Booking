/**
 * BrandLogo — Youssef Elite unified brand identity component.
 *
 * Brand hierarchy:
 *  "navbar"  — YE icon only. Height driven by CSS vars set by applyBrandCSSVars.
 *  "sidebar" — YE icon only, 32 px.
 *  "footer"  — YE icon only, 22 px.
 *  "icon"    — YE icon only, 36 px.
 *
 * Custom logo: settings.logoIconUrl takes precedence over /ye-logo.png.
 * Visibility: settings.brandSettings.logoShowNavbar / logoShowFooter control rendering.
 * Padding:    settings.brandSettings.logoDesktopPadding / logoMobilePadding applied inline.
 */

import { useQuery } from "@tanstack/react-query";
import type { Settings } from "@shared/schema";

interface BrandLogoProps {
  variant?: "navbar" | "sidebar" | "footer" | "icon";
  className?: string;
}

const ICON_SIZES: Record<Exclude<NonNullable<BrandLogoProps["variant"]>, "navbar">, number> = {
  sidebar: 32,
  footer:  22,
  icon:    36,
};

const GLOW      = "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-logo-glow,0.35)))";
const GLOW_ICON = "drop-shadow(0 0 7px rgba(0,212,255,var(--brand-logo-glow,0.35)))";

export function BrandLogo({ variant = "navbar", className = "" }: BrandLogoProps) {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    staleTime: 5 * 60 * 1000,
  });

  const bs = (settings?.brandSettings ?? {}) as Record<string, number>;
  const iconSrc       = settings?.logoIconUrl || "/ye-logo.png";
  const showNavbar    = (bs.logoShowNavbar  ?? 1) !== 0;
  const showFooter    = (bs.logoShowFooter  ?? 1) !== 0;
  const desktopPad    = `${bs.logoDesktopPadding ?? 5}px`;
  const mobilePad     = `${bs.logoMobilePadding  ?? 4}px`;

  if (variant === "navbar") {
    if (!showNavbar) return null;
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        aria-label="Youssef Elite"
        style={{ overflow: "visible" }}
      >
        {/* Mobile */}
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
        {/* Desktop */}
        <img
          src={iconSrc}
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

  const size = ICON_SIZES[variant];
  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-label="Youssef Elite"
    >
      <img
        src={iconSrc}
        alt=""
        aria-hidden="true"
        width={size}
        height={size}
        className="object-contain shrink-0"
        style={{ filter: GLOW_ICON, width: size, height: size }}
      />
    </span>
  );
}
