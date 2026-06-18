/**
 * BrandLogo — renders logo images from the Media Manager (MM).
 *
 * SOURCE HIERARCHY (MM-only, no static fallback):
 *  "navbar"  — desktop: logoNavbarUrl  → logoIconUrl → transparent placeholder
 *              mobile:  logoMobileUrl  → logoNavbarUrl → logoIconUrl → transparent placeholder
 *  "sidebar" — logoDashboardUrl → logoIconUrl → transparent placeholder
 *  "footer"  — logoFooterUrl   → logoIconUrl → transparent placeholder
 *  "icon"    — logoIconUrl → transparent placeholder
 *
 * LOADING STATE (settings === undefined):
 *  Returns an aria-busy transparent placeholder with reserved dimensions.
 *  On return visits the boot script restores window.__YE_INITIAL_SETTINGS__
 *  synchronously from localStorage so settings are available on frame 0,
 *  meaning the loading placeholder is never actually shown in practice.
 *
 * EMPTY STATE (all MM slots null after load):
 *  Each img is guarded: {nSrc ? <img> : <placeholder>}.
 *  When a slot is empty, the transparent placeholder holds space.
 *
 * CACHE-BUSTING:
 *  settings.updatedAt is appended as ?v={ms} so browsers re-fetch after
 *  admin uploads, even if the path did not change.
 */

import { useSettings } from "@/hooks/use-settings";

interface BrandLogoProps {
  variant?: "navbar" | "sidebar" | "footer" | "icon";
  className?: string;
}

/** Append ?v=<updatedAt ms> for cache-busting. Returns null when url is falsy. */
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

    // Loading state — transparent aria-busy placeholder (never shown on return visits)
    if (!isLoaded) {
      return (
        <span
          className={`inline-flex items-center justify-center shrink-0 ${className}`}
          aria-label="Youssef Elite"
          aria-busy="true"
          style={{ overflow: "visible" }}
        >
          <span
            aria-busy="true"
            className="block md:hidden shrink-0"
            style={{ height: mH, width: "auto", minWidth: "44px" }}
          />
          <span
            aria-busy="true"
            className="hidden md:block shrink-0"
            style={{ height: dH, width: "auto", minWidth: "60px" }}
          />
        </span>
      );
    }

    const ua      = (settings as any).updatedAt;
    const iconRaw = settings.logoIconUrl    || null;
    const nRaw    = settings.logoNavbarUrl  || iconRaw;
    const mRaw    = settings.logoMobileUrl  || nRaw;

    const nSrc = bustUrl(nRaw, ua);
    const mSrc = bustUrl(mRaw, ua);

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
            alt="Youssef Elite official logo"
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
          <span
            aria-busy="true"
            className="block md:hidden shrink-0"
            style={{ height: mH, width: "auto", minWidth: "44px" }}
          />
        )}
        {/* Desktop slot */}
        {nSrc ? (
          <img
            src={nSrc}
            alt="Youssef Elite official logo"
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
          <span
            aria-busy="true"
            className="hidden md:block shrink-0"
            style={{ height: dH, width: "auto", minWidth: "60px" }}
          />
        )}
      </span>
    );
  }

  // ── FOOTER / SIDEBAR / ICON variants ─────────────────────────────────────
  if (variant === "footer" && isLoaded && (bs.logoShowFooter ?? 1) === 0) return null;

  const heightVar = VARIANT_HEIGHT[variant];

  if (!isLoaded) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        aria-label="Youssef Elite"
        aria-busy="true"
        style={{ overflow: "visible" }}
      >
        <span
          aria-busy="true"
          style={{ height: heightVar, width: heightVar }}
        />
      </span>
    );
  }

  const ua         = (settings as any).updatedAt;
  const iconRaw    = settings.logoIconUrl       || null;
  const sidebarRaw = settings.logoDashboardUrl  || iconRaw;
  const footerRaw  = settings.logoFooterUrl     || iconRaw;

  const variantRaw = variant === "sidebar" ? sidebarRaw
                   : variant === "footer"  ? footerRaw
                   : iconRaw;

  const variantSrc = bustUrl(variantRaw, ua);

  return (
    <span
      className={`inline-flex items-center justify-center ${className}`}
      aria-label="Youssef Elite"
      style={{ overflow: "visible" }}
    >
      {variantSrc ? (
        <img
          src={variantSrc}
          alt="Youssef Elite official logo"
          className="object-contain shrink-0"
          style={{
            height:   heightVar,
            width:    heightVar,
            overflow: "visible",
            filter:   `drop-shadow(0 0 7px rgba(0,212,255,var(--brand-${variant}-glow, var(--brand-logo-glow, 0.35))))`,
          }}
        />
      ) : (
        <span
          aria-busy="true"
          style={{ height: heightVar, width: heightVar }}
        />
      )}
    </span>
  );
}
