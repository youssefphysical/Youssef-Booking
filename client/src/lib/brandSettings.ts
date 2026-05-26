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
  navbarLogoDesktop: 56,  // spec: 52–60px
  navbarLogoMobile: 46,   // spec: 42–50px
  authLogoDesktop: 480,   // spec: max 500px desktop
  authLogoMobile: 400,    // spec: max 420px mobile
  logoGlow: 35,
  logoVerticalOffset: 0,
  logoPadding: 0,
  navbarLogoGap: 10,      // spec: 8–12px
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
