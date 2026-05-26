/**
 * BrandLogo — Youssef Elite unified brand identity component.
 *
 * Brand hierarchy:
 *  "navbar"  — horizontal logo (icon + "Youssef Elite" text in one PNG).
 *              Desktop height driven by --brand-navbar-h-desktop (default 52px),
 *              mobile by --brand-navbar-h-mobile (default 40px).
 *              Hover: scale(1.04), glow pulse.
 *  "sidebar" — YE icon only, 32 px (compact admin sidebar column).
 *  "footer"  — YE icon only, 22 px (small elegant footer branding).
 *  "icon"    — YE icon only, 36 px (favicon-style compact slot).
 */

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
  if (variant === "navbar") {
    return (
      <span
        className={`inline-flex items-center shrink-0 ${className}`}
        aria-label="Youssef Elite"
        style={{ padding: "var(--brand-logo-padding,0px) 0", gap: "var(--brand-navbar-gap,12px)" }}
      >
        <img
          src="/ye-logo-horizontal.png"
          alt=""
          aria-hidden="true"
          className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] block md:hidden"
          style={{
            height: "var(--brand-navbar-h-mobile,46px)",
            width: "auto",
            maxWidth: "220px",
            filter: GLOW,
            transform: "translateY(var(--brand-logo-voffset,0px))",
          }}
        />
        <img
          src="/ye-logo-horizontal.png"
          alt=""
          aria-hidden="true"
          className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] hidden md:block"
          style={{
            height: "var(--brand-navbar-h-desktop,56px)",
            width: "auto",
            maxWidth: "280px",
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
        src="/ye-logo.png"
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
