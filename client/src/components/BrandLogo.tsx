/**
 * BrandLogo — Youssef Elite unified brand identity component.
 *
 * All compact slots (navbar, sidebar, footer, icon) render the YE icon only
 * (secondary logo — no text). The full-brand primary logo is used only in
 * large premium contexts: auth page hero and loading screen.
 *
 * variants:
 *   "navbar"  — YE icon only, 36 px, navbar optimised
 *   "sidebar" — YE icon only, 32 px, admin sidebar column
 *   "footer"  — YE icon only, 22 px, small elegant branding
 *   "icon"    — YE icon only, 36 px (compact / favicon-style)
 */

interface BrandLogoProps {
  variant?: "navbar" | "sidebar" | "footer" | "icon";
  className?: string;
}

const ICON_SIZES: Record<NonNullable<BrandLogoProps["variant"]>, number> = {
  navbar: 36,  // spec: 34–36 px
  sidebar: 32, // spec: 32 px
  footer: 22,  // spec: small elegant branding
  icon: 36,
};

export function BrandLogo({ variant = "navbar", className = "" }: BrandLogoProps) {
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
          filter: "drop-shadow(0 0 7px hsl(183 100% 74% / 0.55))",
          width: size,
          height: size,
        }}
      />
    </span>
  );
}
