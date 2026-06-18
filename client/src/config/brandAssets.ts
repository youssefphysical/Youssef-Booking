/**
 * BRAND ASSETS — single source of truth for every logo/icon across the app.
 *
 * Two canonical logo tiers:
 *   logoIcon   — compact YE mark (transparent, cyan-glow). Used for all SMALL
 *                placements: footer, sidebar icon, loading spinner, favicon areas,
 *                mobile navbar, PWA icons. Clear at ≥16px.
 *   logoNavbar — horizontal brand (icon + text). Used for the public desktop
 *                navbar and as the MM-empty fallback for the navbar slot.
 *   logoMaster — full-detail master. Auth hero, large marketing areas.
 *
 * Cache-bust token is bumped whenever any master asset is regenerated.
 */
export const BRAND_VERSION = "ye-icon-2026-06-18";

const v = (path: string) => `${path}?v=${BRAND_VERSION}`;

export const BRAND_ASSETS = {
  /** Compact YE mark — small placements (footer, sidebar, icon). Transparent + cyan glow. */
  logoIcon: v("/brand/logo-icon.png"),
  /** Original master — large areas, transparent, full detail. */
  logoMaster: v("/brand/logo-master.png"),
  /** Navbar — horizontal brand for public desktop navbar. */
  logoNavbar: v("/brand/logo-navbar.png"),
  /** Auth / login / register — large premium display, transparent. */
  logoAuth: v("/brand/logo-auth.png"),
  /** Open Graph / social card — 1200x630 centered. */
  logoOg: v("/brand/logo-og.png"),

  /** Favicon + app icons. */
  favicon: v("/favicon.ico"),
  appleTouchIcon: v("/apple-touch-icon.png"),
  icon192: v("/icon-192.png"),
  icon512: v("/icon-512.png"),
} as const;

export type BrandAssetKey = keyof typeof BRAND_ASSETS;
