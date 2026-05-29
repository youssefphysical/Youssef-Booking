export interface BrandSettings {
  navbarLogoDesktop: number;
  navbarLogoMobile: number;
  authLogoDesktop: number;
  authLogoMobile: number;
  logoGlow: number;
  logoVerticalOffset: number;
  logoPadding: number;
  navbarLogoGap: number;
  navbarLogoZoom: number;
  navbarLogoHPos: number;
  authLogoHeight: number;
  authLogoMobileHeight: number;
  authLogoZoom: number;
  authLogoVPos: number;
}

export interface ThemeTokens {
  colorPrimary: string;
  colorBackground: string;
  colorCard: string;
  colorBorder: string;
  colorMutedText: string;
}

export const BRAND_DEFAULTS: BrandSettings = {
  navbarLogoDesktop: 60,
  navbarLogoMobile: 52,
  authLogoDesktop: 480,
  authLogoMobile: 400,
  logoGlow: 35,
  logoVerticalOffset: 0,
  logoPadding: 5,
  navbarLogoGap: 0,
  navbarLogoZoom: 100,
  navbarLogoHPos: 0,
  authLogoHeight: 0,
  authLogoMobileHeight: 0,
  authLogoZoom: 100,
  authLogoVPos: 0,
};

export const THEME_DEFAULTS: ThemeTokens = {
  colorPrimary: "#7df9ff",
  colorBackground: "#07090d",
  colorCard: "#11141a",
  colorBorder: "#1c2230",
  colorMutedText: "#aebccc",
};

function hexToHslTriplet(hex: string): string | null {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return null;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function applyBrandCSSVars(raw?: Record<string, number | string> | null) {
  const s: BrandSettings = { ...BRAND_DEFAULTS };
  const t: Partial<ThemeTokens> = {};

  if (raw) {
    for (const [k, v] of Object.entries(raw)) {
      if (k in BRAND_DEFAULTS && typeof v === "number") {
        (s as any)[k] = v;
      }
      if (k in THEME_DEFAULTS && typeof v === "string") {
        (t as any)[k] = v;
      }
    }
  }

  const root = document.documentElement;
  root.style.setProperty("--brand-navbar-h-desktop", `${s.navbarLogoDesktop}px`);
  root.style.setProperty("--brand-navbar-h-mobile", `${s.navbarLogoMobile}px`);
  root.style.setProperty("--brand-auth-w-desktop", `${s.authLogoDesktop}px`);
  root.style.setProperty("--brand-auth-w-mobile", `${s.authLogoMobile}px`);
  root.style.setProperty("--brand-logo-glow", String(s.logoGlow / 100));
  root.style.setProperty("--brand-logo-voffset", `${s.logoVerticalOffset}px`);
  root.style.setProperty("--brand-logo-padding", `${s.logoPadding}px`);
  root.style.setProperty("--brand-navbar-gap", `${s.navbarLogoGap}px`);
  root.style.setProperty("--brand-navbar-zoom", `${s.navbarLogoZoom / 100}`);
  root.style.setProperty("--brand-navbar-hpos", `${s.navbarLogoHPos}px`);
  root.style.setProperty("--brand-auth-h-desktop", s.authLogoHeight > 0 ? `${s.authLogoHeight}px` : "auto");
  root.style.setProperty("--brand-auth-h-mobile", s.authLogoMobileHeight > 0 ? `${s.authLogoMobileHeight}px` : "auto");
  root.style.setProperty("--brand-auth-zoom", `${s.authLogoZoom / 100}`);
  root.style.setProperty("--brand-auth-vpos", `${s.authLogoVPos}px`);

  if (t.colorPrimary) {
    const hsl = hexToHslTriplet(t.colorPrimary);
    if (hsl) {
      root.style.setProperty("--primary", hsl);
      root.style.setProperty("--ring", hsl);
      root.style.setProperty("--accent-foreground", hsl);
    }
  }
  if (t.colorBackground) {
    const hsl = hexToHslTriplet(t.colorBackground);
    if (hsl) root.style.setProperty("--background", hsl);
  }
  if (t.colorCard) {
    const hsl = hexToHslTriplet(t.colorCard);
    if (hsl) {
      root.style.setProperty("--card", hsl);
      root.style.setProperty("--popover", hsl);
    }
  }
  if (t.colorBorder) {
    const hsl = hexToHslTriplet(t.colorBorder);
    if (hsl) {
      root.style.setProperty("--border", hsl);
      root.style.setProperty("--input", hsl);
    }
  }
  if (t.colorMutedText) {
    const hsl = hexToHslTriplet(t.colorMutedText);
    if (hsl) root.style.setProperty("--muted-foreground", hsl);
  }
}
