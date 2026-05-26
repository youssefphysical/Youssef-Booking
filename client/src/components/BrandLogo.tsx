/**
 * BrandLogo — Youssef Elite unified brand identity component.
 *
 * Renders the neon-Y icon alongside the "Youssef Elite" wordmark.
 * Use this in every navbar, sidebar and footer slot so brand
 * updates are a single-file change.
 *
 * variants:
 *   "navbar"  — icon + wordmark inline, 64 px nav-bar optimised
 *               (wordmark hidden on mobile, visible sm+)
 *   "sidebar" — icon + wordmark, wider admin-sidebar column
 *   "footer"  — icon + wordmark inline, muted opacity treatment
 *   "icon"    — icon only (compact / favicon-style)
 */

interface BrandLogoProps {
  variant?: "navbar" | "sidebar" | "footer" | "icon";
  className?: string;
}

const ICON_SIZES: Record<NonNullable<BrandLogoProps["variant"]>, number> = {
  navbar: 30,
  sidebar: 32,
  footer: 22,
  icon: 32,
};

export function BrandLogo({ variant = "navbar", className = "" }: BrandLogoProps) {
  const size = ICON_SIZES[variant];

  const icon = (
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
  );

  if (variant === "icon") {
    return (
      <span className={`inline-flex items-center justify-center ${className}`} aria-label="Youssef Elite">
        {icon}
      </span>
    );
  }

  if (variant === "sidebar") {
    return (
      <div className={`flex items-center gap-3 min-w-0 ${className}`}>
        {icon}
        <span className="text-gradient-blue font-display font-bold text-base leading-tight truncate">
          Youssef Elite
        </span>
      </div>
    );
  }

  if (variant === "footer") {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`}>
        {icon}
        <span className="text-gradient-blue font-display font-semibold whitespace-nowrap">
          Youssef Elite
        </span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-2 min-w-0 ${className}`}>
      {icon}
      <span className="text-gradient-blue font-display font-semibold truncate hidden sm:inline whitespace-nowrap">
        Youssef Elite
      </span>
    </span>
  );
}
