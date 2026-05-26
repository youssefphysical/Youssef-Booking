/**
 * BrandLogo — Youssef Elite unified brand identity component.
 *
 * Brand hierarchy:
 *  "navbar"  — YE icon only (micro-branding spec). Height driven by
 *              --brand-navbar-h-desktop (default 60px) /
 *              --brand-navbar-h-mobile (default 52px).
 *              Hover: scale(1.04), glow. No text beside icon.
 *  "sidebar" — YE icon only, 32 px (compact admin sidebar column).
 *  "footer"  — YE icon only, 22 px (small elegant footer branding).
 *  "icon"    — YE icon only, 36 px (favicon-style compact slot).
 *
 * Custom logo: when Youssef uploads a custom icon logo via the Logo Manager
 * (Settings → Media → Branding), it is stored in settings.logoIconUrl and
 * takes precedence over the static /ye-logo.png file. Falls back to static
 * immediately so there is never a missing-image state.
 */

import { useQuery } from "@tanstack/react-query";
import type { Settings } from "@shared/schema";

interface BrandLogoProps {
  variant?: "navbar" | "sidebar" | "footer" | "icon";
  className?: string;
}

const ICON_SIZES: Record<Exclude<NonNullable<BrandLogoProps["variant"]>, "navbar">, number> = {
  sidebar: 32,
  footer: 22,
  icon: 36,
};

const GLOW = "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-logo-glow,0.35)))";
const GLOW_ICON = "drop-shadow(0 0 7px rgba(0,212,255,var(--brand-logo-glow,0.35)))";

export function BrandLogo({ variant = "navbar", className = "" }: BrandLogoProps) {
  const { data: settings } = useQuery<Settings>({
    queryKey: ["/api/settings"],
    staleTime: 5 * 60 * 1000,
  });
  const customSrc = settings?.logoIconUrl ?? null;
  const iconSrc = customSrc || "/ye-logo.png";

  if (variant === "navbar") {
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        aria-label="Youssef Elite"
        style={{
          padding: `max(var(--brand-logo-padding,5px), 5px) 4px`,
          overflow: "visible",
        }}
      >
        {/* Mobile — icon only */}
        <img
          src={iconSrc}
          alt=""
          aria-hidden="true"
          className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] block md:hidden"
          style={{
            height: "var(--brand-navbar-h-mobile,52px)",
            width: "auto",
            filter: GLOW,
            transform: "translateY(var(--brand-logo-voffset,0px))",
          }}
        />
        {/* Desktop — icon only */}
        <img
          src={iconSrc}
          alt=""
          aria-hidden="true"
          className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] hidden md:block"
          style={{
            height: "var(--brand-navbar-h-desktop,60px)",
            width: "auto",
            filter: GLOW,
            transform: "translateY(var(--brand-logo-voffset,0px))",
          }}
        />
      </span>
    );
  }

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
        style={{
          filter: GLOW_ICON,
          width: size,
          height: size,
        }}
      />
    </span>
  );
}
