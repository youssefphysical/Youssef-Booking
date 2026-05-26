export interface BrandSettings {
  navbarLogoDesktop: number;
  navbarLogoMobile: number;
  authLogoDesktop: number;
  authLogoMobile: number;
  logoGlow: number;
  logoVerticalOffset: number;
  logoPadding: number;
  navbarLogoGap: number;
}

export const BRAND_DEFAULTS: BrandSettings = {
  navbarLogoDesktop: 52,
  navbarLogoMobile: 40,
  authLogoDesktop: 280,
  authLogoMobile: 210,
  logoGlow: 35,
  logoVerticalOffset: 0,
  logoPadding: 0,
  navbarLogoGap: 12,
};

export function applyBrandCSSVars(raw?: Record<string, number> | null) {
  const s: BrandSettings = { ...BRAND_DEFAULTS, ...(raw ?? {}) };
  const root = document.documentElement;
  root.style.setProperty("--brand-navbar-h-desktop", `${s.navbarLogoDesktop}px`);
  root.style.setProperty("--brand-navbar-h-mobile", `${s.navbarLogoMobile}px`);
  root.style.setProperty("--brand-auth-w-desktop", `${s.authLogoDesktop}px`);
  root.style.setProperty("--brand-auth-w-mobile", `${s.authLogoMobile}px`);
  root.style.setProperty("--brand-logo-glow", String(s.logoGlow / 100));
  root.style.setProperty("--brand-logo-voffset", `${s.logoVerticalOffset}px`);
  root.style.setProperty("--brand-logo-padding", `${s.logoPadding}px`);
  root.style.setProperty("--brand-navbar-gap", `${s.navbarLogoGap}px`);
}
