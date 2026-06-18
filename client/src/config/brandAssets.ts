/**
 * BRAND ASSETS — single source of truth for every logo/icon across the app.
 *
 * One final logo (transparent neon barbell mascot). No black background wrapper,
 * no crop, no recolor. Every component imports from here — there are NO hardcoded
 * logo paths anywhere else.
 *
 * Cache-bust token is bumped whenever the master logo is regenerated.
 */
export const BRAND_VERSION = "final-2026-06-reset";

const v = (path: string) => `${path}?v=${BRAND_VERSION}`;

export const BRAND_ASSETS = {
  /** Original master — large areas, transparent, full detail. */
  logoMaster: v("/brand/logo-master.png"),
  /** Navbar — optimized small, transparent, sharp at 72px. */
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
