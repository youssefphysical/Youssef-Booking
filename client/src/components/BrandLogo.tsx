/**
 * BrandLogo — renders logo images from Media Manager only.
 *
 * SOURCE HIERARCHY — MM-chain, no static-file fallbacks:
 *  "navbar"  — desktop: logoNavbarUrl → logoIconUrl → (none)
 *              mobile:  logoMobileUrl → logoNavbarUrl → logoIconUrl → (none)
 *  "sidebar" — logoDashboardUrl → logoIconUrl → (none)
 *  "footer"  — logoFooterUrl   → logoIconUrl → (none)
 *  "icon"    — logoIconUrl → (none)
 *
 * LOADING STATE (settings === undefined):
 *  Transparent placeholder with CSS-var-controlled dimensions is rendered.
 *  This reserves the correct layout space without showing any old/stale
 *  static logo asset. The CSS vars are set synchronously at boot by index.html
 *  from localStorage, so dimensions are always correct even on first paint.
 *
 * EMPTY STATE (all MM slots null):
 *  Same transparent placeholder — no image is rendered.
 *  Static /ye-logo.png is NEVER used as a fallback anywhere in this component.
 *
 * CACHE-BUSTING:
 *  settings.updatedAt is appended as ?v={ms} so browsers re-fetch after admin
 *  uploads, even if the path didn't change. Applied to every img src.
 *
 * MOBILE FALLBACK CHAIN:
 *  Mobile slot falls back to navbar slot first (not icon), so an admin who only
 *  uploads a horizontal navbar logo automatically gets it on mobile too.
 */

import { useSettings } from "@/hooks/use-settings";

interface BrandLogoProps {
  variant?: "navbar" | "sidebar" | "footer" | "icon";
  className?: string;
}

/**
 * Append ?v=<updatedAt ms> for cache-busting.
 * Returns null (not a static fallback) when url is falsy.
 */
function bustUrl(url: string | null | undefined, updatedAt: unknown): string | null {
  if (!url) return null;
  const v = updatedAt ? new Date(updatedAt as string).getTime() : NaN;
  if (!v || isNaN(v)) return url;
  return url.includes("?") ? `${url}&v=${v}` : `${url}?v=${v}`;
}

const VARIANT_HEIGHT: Record<Exclude<NonNullable<BrandLogoProps["variant"]>, "navbar">, string> = {
  sidebar: "var(--brand-sidebar-h-desktop, 48px)",
  footer:  "var(--brand-footer-h-desktop,  36px)",
  icon:    "var(--brand-icon-h-desktop,    36px)",
};

export function BrandLogo({ variant = "navbar", className = "" }: BrandLogoProps) {
  const { data: settings } = useSettings();
  const isLoaded = settings !== undefined;
  const bs       = (settings?.brandSettings ?? {}) as Record<string, number>;

  // ── NAVBAR variant ────────────────────────────────────────────────────────
  if (variant === "navbar") {
    if (isLoaded && (bs.logoShowNavbar ?? 1) === 0) return null;

    const mH = "var(--brand-mobile-h-mobile, 44px)";
    const dH = "var(--brand-navbar-h-desktop, 60px)";

    // LOADING — transparent placeholder, correct dims reserved from CSS vars
    if (!isLoaded) {
      return (
        <span
          className={`inline-flex items-center justify-center shrink-0 ${className}`}
          aria-label="Youssef Elite"
          aria-busy="true"
          style={{ overflow: "visible" }}
        >
          <span className="block md:hidden"  style={{ height: mH, minWidth: "1px" }} />
          <span className="hidden md:block"  style={{ height: dH, minWidth: "1px" }} />
        </span>
      );
    }

    // Resolve MM-chain sources (no static file anywhere)
    const ua      = (settings as any).updatedAt;
    const iconRaw = settings.logoIconUrl    || null;
    const nRaw    = settings.logoNavbarUrl  || iconRaw;   // navbar → icon
    const mRaw    = settings.logoMobileUrl  || nRaw;      // mobile → navbar → icon
    const nSrc    = bustUrl(nRaw, ua);
    const mSrc    = bustUrl(mRaw, ua);

    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${className}`}
        aria-label="Youssef Elite"
        style={{ overflow: "visible" }}
      >
        {/* Mobile slot */}
        {mSrc ? (
          <img
            src={mSrc}
            alt=""
            aria-hidden="true"
            className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] block md:hidden"
            style={{
              height:    mH,
              width:     "auto",
              filter:    "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-mobile-glow, var(--brand-logo-glow, 0.35))))",
              padding:   "var(--brand-mobile-padding,  var(--brand-logo-padding, 4px))",
              transform: "translateY(var(--brand-mobile-vpos, var(--brand-logo-voffset, 0px)))",
            }}
          />
        ) : (
          <span className="block md:hidden" style={{ height: mH, minWidth: "1px" }} />
        )}

        {/* Desktop slot */}
        {nSrc ? (
          <img
            src={nSrc}
            alt=""
            aria-hidden="true"
            className="object-contain shrink-0 transition-transform duration-300 ease-out hover:scale-[1.04] hidden md:block"
            style={{
              height:    dH,
              width:     "auto",
              filter:    "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-navbar-glow, var(--brand-logo-glow, 0.35))))",
              padding:   "var(--brand-navbar-padding,  var(--brand-logo-padding, 5px))",
              transform: "translateY(var(--brand-navbar-vpos, var(--brand-logo-voffset, 0px)))",
            }}
          />
        ) : (
          <span className="hidden md:block" style={{ height: dH, minWidth: "1px" }} />
        )}
      </span>
    );
  }

  // ── FOOTER / SIDEBAR / ICON variants ─────────────────────────────────────
  if (variant === "footer" && isLoaded && (bs.logoShowFooter ?? 1) === 0) return null;

  const heightVar = VARIANT_HEIGHT[variant];

  // LOADING — transparent placeholder
  if (!isLoaded) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        aria-label="Youssef Elite"
        aria-busy="true"
        style={{ overflow: "visible" }}
      >
        <span style={{ height: heightVar, width: heightVar, minWidth: "1px" }} />
      </span>
    );
  }

  const ua         = (settings as any).updatedAt;
  const iconRaw    = settings.logoIconUrl       || null;
  const sidebarRaw = settings.logoDashboardUrl  || iconRaw;   // sidebar → icon
  const footerRaw  = settings.logoFooterUrl     || iconRaw;   // footer  → icon

  const variantRaw = variant === "sidebar" ? sidebarRaw
                   : variant === "footer"  ? footerRaw
                   : iconRaw;

  const variantSrc = bustUrl(variantRaw, ua);

  if (!variantSrc) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        aria-label="Youssef Elite"
        style={{ overflow: "visible" }}
      >
        <span style={{ height: heightVar, width: heightVar, minWidth: "1px" }} />
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-label="Youssef Elite"
      style={{ overflow: "visible" }}
    >
      <img
        src={variantSrc}
        alt=""
        aria-hidden="true"
        className="object-contain shrink-0"
        style={{
          height:   heightVar,
          width:    heightVar,
          overflow: "visible",
          filter:   `drop-shadow(0 0 7px rgba(0,212,255,var(--brand-${variant}-glow, var(--brand-logo-glow, 0.35))))`,
        }}
      />
    </span>
  );
}
