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
  navbarLogoDesktop: 60,  // icon-only spec: 52–64px desktop
  navbarLogoMobile: 52,   // icon-only spec: 44–52px mobile
  authLogoDesktop: 480,   // auth hero max 500px desktop
  authLogoMobile: 400,    // auth hero max 420px mobile
  logoGlow: 35,
  logoVerticalOffset: 0,
  logoPadding: 5,         // min 5px padding keeps icon away from edges
  navbarLogoGap: 0,       // no gap — icon-only, no adjacent text
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
