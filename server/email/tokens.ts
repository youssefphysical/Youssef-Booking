/**
 * Email design tokens — PNG FRAME MATCH v4.
 *
 * Rebuilt to match the four approved PNG reference frames:
 *   - Dark charcoal canvas (#0c0c10), not pure black.
 *   - Card surface #0f1014 with a subtle cyan hairline border.
 *   - Section labels in cyan small-caps.
 *   - Solid cyan CTA pill (no gradient, no halo ring).
 *   - Reduced display headline scale (48 / 36 mobile).
 *   - Magenta / violet retained as named constants but removed from all
 *     user-facing layers (gradients, edges, dividers).
 */

export type Severity = "success" | "info" | "warning" | "critical";
export type Lang = "en" | "ar";
export type Direction = "ltr" | "rtl";

export const COLOR = {
  brand: {
    cyan: "#5EE7FF",
    cyanSoft: "#8AF1FF",
    cyanDeep: "#00B8D4",
    cyanMuted: "rgba(94,231,255,0.78)",
    cyanGlow: "rgba(94,231,255,0.16)",
    // Retained as named constants only — not used in any active gradient.
    magenta: "#FF3DDA",
    magentaGlow: "rgba(255,61,218,0.10)",
    magentaDeep: "rgba(213,40,180,0.5)",
    violet: "#9D4EDD",
    violetGlow: "rgba(157,78,221,0.10)",
    ink: "#000000",
    paper: "#F4F7FA",
  },
  bg: {
    canvas: "#0c0c10",
    canvasTop: "#0c0c10",
    canvasBottom: "#0c0c10",
    surface: "#0f1014",
    surfaceTop: "#11131a",
    surfaceBottom: "#0c0d12",
    surfaceRaised: "#13141a",
    surfaceHeader: "rgba(94,231,255,0.04)",
    secondary: "#0a0b0f",
    heroBackdrop: "#0c0c10",
    ctaSection: "#0c0c10",
    footer: "#0c0c10",
  },
  border: {
    cyan: "rgba(94,231,255,0.10)",
    cyanSoft: "rgba(255,255,255,0.05)",
    cyanStrong: "rgba(94,231,255,0.34)",
    divider: "rgba(255,255,255,0.07)",
    hairline: "rgba(255,255,255,0.05)",
  },
  text: {
    primary: "#F4F7FA",
    secondary: "#B7BEC9",
    tertiary: "#6B7280",
    accent: "#5EE7FF",
    onAccent: "#06121A",
    link: "#5EE7FF",
  },
  whatsapp: "#25D366",
  warmHighlight: "rgba(255,200,140,0.05)",
} as const;

export const SEVERITY = {
  success: { accent: "#3DDCA8", tint: "rgba(61,220,168,0.08)", border: "rgba(61,220,168,0.30)", label: "Confirmed" },
  info:    { accent: "#7AB7FF", tint: "rgba(122,183,255,0.08)", border: "rgba(122,183,255,0.30)", label: "Notice" },
  warning: { accent: "#FFB861", tint: "rgba(255,184,97,0.08)", border: "rgba(255,184,97,0.30)", label: "Heads-up" },
  critical:{ accent: "#FF8A7A", tint: "rgba(255,138,122,0.08)", border: "rgba(255,138,122,0.30)", label: "Action required" },
} as const satisfies Record<Severity, { accent: string; tint: string; border: string; label: string }>;

/** Spacing — 4px grid. */
export const SPACE = {
  s0: "0",
  s1: "4px",
  s2: "8px",
  s3: "12px",
  s4: "16px",
  s5: "20px",
  s6: "28px",
  s7: "36px",
  s8: "44px",
  s9: "56px",
  s10: "72px",
  s11: "88px",
  s12: "104px",
} as const;

export const RADIUS = {
  sm: "6px",
  md: "12px",
  lg: "16px",
  xl: "20px",
  pill: "999px",
} as const;

export const WIDTH = {
  email: 680,
  content: 616,
  hero: 680,
} as const;

/**
 * Typography — calmer, more practical scale matching the frames.
 * displayXl 48 / 36 mobile (was 72 / 48).
 */
export const TYPE = {
  // Frame-match: massive stacked headlines (WELCOME TO / ELITE COACHING,
  // PAYMENT / CONFIRMED!) read at 60px on desktop, 42px mobile.
  displayXl: { size: "60px", lh: "1.02", weight: "800", tracking: "-0.025em" },
  displayXlMobile: { size: "42px", lh: "1.04", weight: "800", tracking: "-0.02em" },
  display: { size: "40px", lh: "1.05", weight: "800", tracking: "-0.018em" },
  displayMobile: { size: "30px", lh: "1.1", weight: "800", tracking: "-0.012em" },
  h1: { size: "28px", lh: "1.2", weight: "700", tracking: "-0.012em" },
  h2: { size: "22px", lh: "1.3", weight: "700", tracking: "-0.008em" },
  h3: { size: "17px", lh: "1.4", weight: "700", tracking: "-0.004em" },
  body: { size: "15px", lh: "1.6", weight: "400", tracking: "0" },
  bodyLg: { size: "17px", lh: "1.55", weight: "400", tracking: "-0.003em" },
  bodySm: { size: "13px", lh: "1.55", weight: "400", tracking: "0" },
  caption: { size: "12px", lh: "1.4", weight: "500", tracking: "0" },
  metric: { size: "34px", lh: "1.0", weight: "800", tracking: "-0.02em" },
  micro: { size: "11px", lh: "1.2", weight: "700", tracking: "0.22em" },
  microSm: { size: "10px", lh: "1.2", weight: "700", tracking: "0.28em" },
  pullQuote: { size: "20px", lh: "1.45", weight: "500", tracking: "-0.005em" },
} as const;

export const FONT_STACK = {
  ltr: '"Helvetica Neue", Helvetica, Arial, "Segoe UI", Roboto, sans-serif',
  rtl: '"SF Arabic", "Tajawal", "Cairo", "Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;

export const BREAKPOINT_MOBILE = 600;

/**
 * Hero canvas — simple dark charcoal with the faintest cyan top wash.
 * No RGB triad, no magenta, no violet.
 */
export const HERO_GRADIENT =
  "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(94,231,255,0.06) 0%, rgba(94,231,255,0) 60%), linear-gradient(180deg, #0c0c10 0%, #0c0c10 100%)";

/** Image-to-type dissolve — used when a hero photo bleeds into the type band. */
export const HERO_BLEND_GRADIENT =
  "linear-gradient(180deg, rgba(12,12,16,0) 0%, rgba(12,12,16,0.55) 60%, rgba(12,12,16,1) 100%)";

/**
 * Image overlay — left-to-right dark fade over a full-bleed hero photo.
 * Anchors readability of the white/cyan headline (left third) while
 * letting the photographic atmosphere (right two thirds) carry the
 * cinematic feel from the approved frames.
 */
export const HERO_IMAGE_OVERLAY =
  "linear-gradient(90deg, rgba(8,10,14,0.94) 0%, rgba(8,10,14,0.78) 38%, rgba(8,10,14,0.40) 62%, rgba(8,10,14,0.10) 100%)";

/** RTL mirror — same fade flipped for Arabic hero composition. */
export const HERO_IMAGE_OVERLAY_RTL =
  "linear-gradient(270deg, rgba(8,10,14,0.94) 0%, rgba(8,10,14,0.78) 38%, rgba(8,10,14,0.40) 62%, rgba(8,10,14,0.10) 100%)";

/** Card surface — solid #0f1014 (matches the frames). */
export const CARD_GRADIENT = "linear-gradient(180deg, #11131a 0%, #0f1014 100%)";

/** Card top-edge — softer cyan glow (was 0.65, now 0.25). */
export const CARD_TOP_EDGE =
  "linear-gradient(90deg, rgba(94,231,255,0) 0%, rgba(94,231,255,0.25) 50%, rgba(94,231,255,0) 100%)";

/** Card bottom-edge — removed (no magenta in user-facing layer). Kept as no-op. */
export const CARD_BOTTOM_EDGE =
  "linear-gradient(90deg, rgba(94,231,255,0) 0%, rgba(94,231,255,0) 100%)";

export const CARD_HEADER_GRADIENT =
  "linear-gradient(180deg, rgba(94,231,255,0.04) 0%, rgba(94,231,255,0) 100%)";

/** CTA section — flat dark charcoal. */
export const CTA_SECTION_GRADIENT =
  "linear-gradient(180deg, #0c0c10 0%, #0c0c10 100%)";

/** CTA gradient — flat solid cyan (matches the frame buttons). */
export const CTA_GRADIENT =
  "linear-gradient(180deg, #5EE7FF 0%, #5EE7FF 100%)";

/** Accent rule — single cyan hairline. */
export const ACCENT_RULE_GRADIENT =
  "linear-gradient(90deg, rgba(94,231,255,0) 0%, rgba(94,231,255,0.45) 50%, rgba(94,231,255,0) 100%)";

/** Footer — flat dark charcoal. */
export const FOOTER_GRADIENT =
  "linear-gradient(180deg, #0c0c10 0%, #0c0c10 100%)";

/** New token for hairline dividers between rows. */
export const CARD_DIVIDER = "rgba(255,255,255,0.07)";

export const GLOW = {
  card: "0 24px 56px rgba(0,0,0,0.55), 0 2px 6px rgba(0,0,0,0.4)",
  cardCyan: "0 24px 56px rgba(0,0,0,0.55), 0 0 32px rgba(94,231,255,0.10)",
  cta: "0 10px 28px rgba(0,0,0,0.45), 0 0 24px rgba(94,231,255,0.18)",
  innerHighlight: "inset 0 1px 0 rgba(255,255,255,0.06)",
  hero: "0 18px 56px rgba(0,0,0,0.55)",
} as const;

/** Hero image catalogue. */
export const HERO_IMAGES = {
  welcome: "/email-assets/heroes/welcome_hero.png",
  session: "/email-assets/heroes/session_hero.png",
  discipline: "/email-assets/heroes/discipline_hero.png",
  triumph: "/email-assets/heroes/triumph_hero.png",
} as const;

export type HeroImageKey = keyof typeof HERO_IMAGES;

export function heroImageUrl(key: HeroImageKey, baseUrl: string | null | undefined): string | null {
  if (!baseUrl) return null;
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}${HERO_IMAGES[key]}`;
}

export function deriveBaseUrl(...urls: Array<string | null | undefined>): string | null {
  for (const u of urls) {
    if (!u) continue;
    try {
      const url = new URL(u);
      return `${url.protocol}//${url.host}`;
    } catch {
      // Not absolute — skip.
    }
  }
  return null;
}

export function severityTokens(sev: Severity) {
  return SEVERITY[sev];
}

export function dirFromLang(lang: Lang): Direction {
  return lang === "ar" ? "rtl" : "ltr";
}

export function fontStack(lang: Lang): string {
  return lang === "ar" ? FONT_STACK.rtl : FONT_STACK.ltr;
}
