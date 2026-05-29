// ─── Flat legacy brand settings (navbar / auth) ────────────────────────────
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

// ─── Per-logo independent controls ─────────────────────────────────────────
export interface LogoBrandControls {
  wDesktop: number;   // px  (0 = auto)
  hDesktop: number;   // px  (0 = auto)
  wMobile:  number;   // px  (0 = auto)
  hMobile:  number;   // px  (0 = auto)
  zoom:     number;   // %   (100 = 1x)
  hOffset:  number;   // px
  vOffset:  number;   // px
  padding:  number;   // px
  glow:     number;   // 0-100 %
}

export type LogoSlot =
  | "navbar"
  | "mobile"
  | "login"
  | "dashboard"
  | "footer"
  | "favicon"
  | "splash";

export const LOGO_SLOTS: LogoSlot[] = [
  "navbar", "mobile", "login", "dashboard", "footer", "favicon", "splash",
];

export const LOGO_BRAND_SLOT_DEFAULTS: Record<LogoSlot, LogoBrandControls> = {
  navbar:    { wDesktop:   0, hDesktop:  60, wMobile:   0, hMobile:  52, zoom: 100, hOffset: 0, vOffset: 0, padding: 5,  glow: 35 },
  mobile:    { wDesktop:   0, hDesktop:  52, wMobile:   0, hMobile:  44, zoom: 100, hOffset: 0, vOffset: 0, padding: 4,  glow: 25 },
  login:     { wDesktop: 480, hDesktop:   0, wMobile: 360, hMobile:   0, zoom: 100, hOffset: 0, vOffset: 0, padding: 0,  glow: 40 },
  dashboard: { wDesktop:   0, hDesktop:  48, wMobile:   0, hMobile:  40, zoom: 100, hOffset: 0, vOffset: 0, padding: 0,  glow: 20 },
  footer:    { wDesktop:   0, hDesktop:  22, wMobile:   0, hMobile:  20, zoom: 100, hOffset: 0, vOffset: 0, padding: 0,  glow: 25 },
  favicon:   { wDesktop:  32, hDesktop:  32, wMobile:  16, hMobile:  16, zoom: 100, hOffset: 0, vOffset: 0, padding: 0,  glow:  0 },
  splash:    { wDesktop:   0, hDesktop:  80, wMobile:   0, hMobile:  64, zoom: 100, hOffset: 0, vOffset: 0, padding: 0,  glow: 50 },
};

// ─── Theme token overrides ──────────────────────────────────────────────────
export interface ThemeTokens {
  colorPrimary:    string;
  colorBackground: string;
  colorCard:       string;
  colorBorder:     string;
  colorMutedText:  string;
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
  colorPrimary:    "#7df9ff",
  colorBackground: "#07090d",
  colorCard:       "#11141a",
  colorBorder:     "#1c2230",
  colorMutedText:  "#aebccc",
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
    if (max === r)      h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
    else if (max === g) h = ((b - r) / d + 2) / 6;
    else                h = ((r - g) / d + 4) / 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

// ─── Emit one slot's CSS vars (also called live from the admin panel) ───────
export function applyLogoSlotCSSVars(slot: LogoSlot, c: LogoBrandControls) {
  const root = document.documentElement;
  const p = `--brand-${slot}`;
  root.style.setProperty(`${p}-w-desktop`, c.wDesktop > 0 ? `${c.wDesktop}px` : "auto");
  root.style.setProperty(`${p}-h-desktop`, c.hDesktop > 0 ? `${c.hDesktop}px` : "auto");
  root.style.setProperty(`${p}-w-mobile`,  c.wMobile  > 0 ? `${c.wMobile}px`  : "auto");
  root.style.setProperty(`${p}-h-mobile`,  c.hMobile  > 0 ? `${c.hMobile}px`  : "auto");
  root.style.setProperty(`${p}-zoom`,    String(c.zoom / 100));
  root.style.setProperty(`${p}-hpos`,    `${c.hOffset}px`);
  root.style.setProperty(`${p}-vpos`,    `${c.vOffset}px`);
  root.style.setProperty(`${p}-padding`, `${c.padding}px`);
  root.style.setProperty(`${p}-glow`,    String(c.glow / 100));
}

// ─── Full brand CSS var application (called at boot + on settings load) ─────
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

  // Legacy flat vars (consumed by BrandLogo.tsx, AuthPage.tsx, etc.)
  root.style.setProperty("--brand-navbar-h-desktop", `${s.navbarLogoDesktop}px`);
  root.style.setProperty("--brand-navbar-h-mobile",  `${s.navbarLogoMobile}px`);
  root.style.setProperty("--brand-auth-w-desktop",   `${s.authLogoDesktop}px`);
  root.style.setProperty("--brand-auth-w-mobile",    `${s.authLogoMobile}px`);
  root.style.setProperty("--brand-logo-glow",        String(s.logoGlow / 100));
  root.style.setProperty("--brand-logo-voffset",     `${s.logoVerticalOffset}px`);
  root.style.setProperty("--brand-logo-padding",     `${s.logoPadding}px`);
  root.style.setProperty("--brand-navbar-gap",       `${s.navbarLogoGap}px`);
  root.style.setProperty("--brand-navbar-zoom",      `${s.navbarLogoZoom / 100}`);
  root.style.setProperty("--brand-navbar-hpos",      `${s.navbarLogoHPos}px`);
  root.style.setProperty("--brand-auth-h-desktop",   s.authLogoHeight > 0       ? `${s.authLogoHeight}px`       : "auto");
  root.style.setProperty("--brand-auth-h-mobile",    s.authLogoMobileHeight > 0 ? `${s.authLogoMobileHeight}px` : "auto");
  root.style.setProperty("--brand-auth-zoom",        `${s.authLogoZoom / 100}`);
  root.style.setProperty("--brand-auth-vpos",        `${s.authLogoVPos}px`);

  // Per-logo slot vars (new structure stored under raw.logos)
  const logos = (raw as any)?.logos as
    Partial<Record<LogoSlot, Partial<LogoBrandControls>>> | undefined;

  if (logos) {
    for (const slot of LOGO_SLOTS) {
      const def = LOGO_BRAND_SLOT_DEFAULTS[slot];
      const c: LogoBrandControls = { ...def, ...(logos[slot] ?? {}) };
      applyLogoSlotCSSVars(slot, c);
    }
  } else {
    // Emit defaults so CSS vars are always defined
    for (const slot of LOGO_SLOTS) {
      applyLogoSlotCSSVars(slot, LOGO_BRAND_SLOT_DEFAULTS[slot]);
    }
  }

  // Theme colour overrides
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
