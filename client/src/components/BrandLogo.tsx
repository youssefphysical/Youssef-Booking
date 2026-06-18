/**
 * BrandLogo — renders logo images from the Media Manager (MM).
 *
 * CANONICAL LOGO: BRAND_ASSETS.logoNavbar (/brand/logo-navbar.png?v=final-2026-06-reset)
 *  This fixed-version URL is used as the immediate fallback for every render
 *  state — loading, empty slot, and first paint. Using a fixed ?v= string
 *  (not a dynamic timestamp) ensures the URL never changes between the
 *  loading state and the post-settings state, which prevents Chrome from
 *  blanking the <img> element and re-fetching.
 *
 * SOURCE HIERARCHY:
 *  "navbar"  — desktop: logoNavbarUrl  → logoIconUrl → CANONICAL_LOGO
 *              mobile:  logoMobileUrl  → logoNavbarUrl → logoIconUrl → CANONICAL_LOGO
 *  "sidebar" — logoDashboardUrl → logoIconUrl → CANONICAL_LOGO
 *  "footer"  — logoFooterUrl   → logoIconUrl → CANONICAL_LOGO
 *  "icon"    — logoIconUrl → CANONICAL_LOGO
 *
 * LOADING STATE (settings === undefined, !isLoaded):
 *  Returns an aria-busy span containing <img src={CANONICAL_LOGO}> immediately.
 *  Dimensions are reserved via CSS vars set synchronously at boot by index.html
 *  from localStorage, so there is zero layout shift on first render.
 *
 * EMPTY STATE (MM slot null after load):
 *  {nSrc ? <img src={nSrc}> : <img src={CANONICAL_LOGO}>}
 *  The canonical logo fills any empty slot so the navbar never goes blank.
 *
 * CACHE-BUSTING for custom uploads:
 *  settings.updatedAt is appended as ?v={ms} for /uploads/ paths.
 * The canonical logo always uses the fixed BRAND_VERSION token so
 *  the URL is stable across loading→loaded transitions.
 */

import { useSettings } from "@/hooks/use-settings";
import { BRAND_ASSETS } from "@/config/brandAssets";

interface BrandLogoProps {
  variant?: "navbar" | "sidebar" | "footer" | "icon";
  className?: string;
}

/** Fixed canonical logo — single source of truth (BRAND_ASSETS). */
const CANONICAL_LOGO = BRAND_ASSETS.logoNavbar;

/**
 * Append ?v=<updatedAt ms> for cache-busting of custom uploaded paths.
 * Returns CANONICAL_LOGO when url is falsy or when url is the default
 * /brand-logo.png (so the URL stays stable across loading→loaded states).
 */
function bustUrl(url: string | null | undefined, updatedAt: unknown): string | null {
  if (!url) return null;
  // Canonical static file — always use the fixed version string so the URL
  // never changes between the loading placeholder and post-settings render.
  if (url === "/brand-logo.png") return CANONICAL_LOGO;
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

    // Loading state — aria-busy wrapper with canonical logo on both slots.
    // The canonical URL is already in the browser cache (preloaded in index.html)
    // so this renders the logo on frame 0 with no network round-trip.
    //
    // IMPORTANT: styles must be IDENTICAL to the loaded-state img styles
    // (same filter/padding/transform CSS vars) so there is zero visual change
    // when isLoaded flips to true. Any style difference between loading and
    // loaded states causes a visible layout shift the user sees as a logo swap.
    if (!isLoaded) {
      return (
        <span
          className={`inline-flex items-center justify-center shrink-0 ${className}`}
          aria-label="Youssef Elite"
          aria-busy="true"
          style={{ overflow: "visible" }}
        >
          <img
            src={CANONICAL_LOGO}
            alt="Youssef Elite official logo"
            className="object-contain shrink-0 block md:hidden"
            style={{
              height:    mH,
              width:     "auto",
              filter:    "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-mobile-glow, var(--brand-logo-glow, 0.35))))",
              padding:   "var(--brand-mobile-padding,  var(--brand-logo-padding, 4px))",
              transform: "translateY(var(--brand-mobile-vpos, var(--brand-logo-voffset, 0px)))",
            }}
          />
          <img
            src={CANONICAL_LOGO}
            alt="Youssef Elite official logo"
            className="object-contain shrink-0 hidden md:block"
            style={{
              height:    dH,
              width:     "auto",
              filter:    "drop-shadow(0 0 10px rgba(0,212,255,var(--brand-navbar-glow, var(--brand-logo-glow, 0.35))))",
              padding:   "var(--brand-navbar-padding,  var(--brand-logo-padding, 5px))",
              transform: "translateY(var(--brand-navbar-vpos, var(--brand-logo-voffset, 0px)))",
            }}
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
        {/* Mobile slot — canonical logo when MM slot is empty */}
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
          <img
            src={CANONICAL_LOGO}
            alt="Youssef Elite official logo"
            className="object-contain shrink-0 block md:hidden"
            style={{ height: mH, width: "auto" }}
          />
        )}
        {/* Desktop slot — canonical logo when MM slot is empty */}
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
          <img
            src={CANONICAL_LOGO}
            alt="Youssef Elite official logo"
            className="object-contain shrink-0 hidden md:block"
            style={{ height: dH, width: "auto" }}
          />
        )}
      </span>
    );
  }

  // ── FOOTER / SIDEBAR / ICON variants ─────────────────────────────────────
  if (variant === "footer" && isLoaded && (bs.logoShowFooter ?? 1) === 0) return null;

  const heightVar = VARIANT_HEIGHT[variant];

  // Loading state — canonical logo with reserved dimensions
  if (!isLoaded) {
    return (
      <span
        className={`inline-flex items-center justify-center ${className}`}
        aria-label="Youssef Elite"
        aria-busy="true"
        style={{ overflow: "visible" }}
      >
        <img
          src={CANONICAL_LOGO}
          alt="Youssef Elite official logo"
          className="object-contain shrink-0"
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
        <img
          src={CANONICAL_LOGO}
          alt="Youssef Elite official logo"
          className="object-contain shrink-0"
          style={{ height: heightVar, width: heightVar }}
        />
      )}
    </span>
  );
}
