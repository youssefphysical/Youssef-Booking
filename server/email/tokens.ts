/**
 * Email design tokens — CINEMATIC v3 (editorial luxury rebuild).
 *
 * Complete visual ground-up: the prior system felt template-shaped. This
 * one reads as the masthead of a quarterly elite-coaching dossier — not
 * a transactional notification.
 *
 * Aesthetic axis: Tron Legacy lighting + Equinox/Hermès editorial spacing
 * + Tesla product chrome + Apple keynote rhythm.
 *
 * Discipline:
 *   - Pure-black canvas with a soft top-vignette (luxury cinema curtain).
 *   - Cyan is editorially restrained — hairlines, brackets, single accent
 *     word, the CTA halo. Never decorative.
 *   - Massive type dominance (displayXl 72/48). Numbers carry meaning.
 *   - Spacing on a 4px grid, but living mostly in the s8–s12 range.
 *   - Glow degrades cleanly (Outlook strips box-shadow safely).
 *
 * Public surface (function names + token keys) is preserved. Only values
 * and visual semantics change — no builder needs to be re-touched.
 */

export type Severity = "success" | "info" | "warning" | "critical";
export type Lang = "en" | "ar";
export type Direction = "ltr" | "rtl";

/** Cinematic palette — editorial luxury. */
export const COLOR = {
  brand: {
    cyan: "#5EE7FF",            // Primary cyan (softer, more luxurious)
    cyanSoft: "#8AF1FF",        // CTA gradient top — almost-white cyan glint
    cyanDeep: "#00B8D4",        // CTA gradient bottom + bracket marks
    cyanMuted: "rgba(94,231,255,0.78)",
    cyanGlow: "rgba(94,231,255,0.16)",
    ink: "#000000",
    paper: "#F4F7FA",
  },
  bg: {
    canvas: "#000000",          // Outer body — pure black
    canvasTop: "#040608",       // Top of vignette wash
    canvasBottom: "#000000",    // Vignette returns to pure black
    surface: "#0A0E13",         // Card surface
    surfaceTop: "rgba(15,21,28,0.96)",
    surfaceBottom: "rgba(5,8,11,0.99)",
    surfaceRaised: "#0E1922",
    surfaceHeader: "rgba(94,231,255,0.035)",
    secondary: "#06090C",
    heroBackdrop: "#000000",
    ctaSection: "#03060A",
    footer: "#000000",
  },
  border: {
    // Card edge: a hint of cyan rather than pure white — adds atmospheric
    // warmth to glass surfaces without becoming a "ring". 0.08 alpha is
    // enough to feel intentional in the right light, invisible otherwise.
    cyan: "rgba(94,231,255,0.10)",
    cyanSoft: "rgba(255,255,255,0.05)",
    cyanStrong: "rgba(94,231,255,0.34)",
    divider: "rgba(255,255,255,0.05)",
    hairline: "rgba(255,255,255,0.04)",
  },
  text: {
    primary: "#F4F7FA",
    // Warmer, more luminous secondary — body copy reads as human writing,
    // not as a SaaS field label. Slightly higher luminance for premium feel.
    secondary: "#B6BEC9",
    tertiary: "#5C6571",
    accent: "#5EE7FF",
    onAccent: "#00131A",
    link: "#5EE7FF",
  },
  whatsapp: "#25D366",
  warmHighlight: "rgba(255,200,140,0.05)",
} as const;

export const SEVERITY = {
  success: {
    accent: "#3DDCA8",
    tint: "rgba(61,220,168,0.08)",
    border: "rgba(61,220,168,0.30)",
    label: "Confirmed",
  },
  info: {
    accent: "#7AB7FF",
    tint: "rgba(122,183,255,0.08)",
    border: "rgba(122,183,255,0.30)",
    label: "Notice",
  },
  warning: {
    accent: "#FFB861",
    tint: "rgba(255,184,97,0.08)",
    border: "rgba(255,184,97,0.30)",
    label: "Heads-up",
  },
  critical: {
    accent: "#FF8A7A",
    tint: "rgba(255,138,122,0.08)",
    border: "rgba(255,138,122,0.30)",
    label: "Action required",
  },
} as const satisfies Record<Severity, {
  accent: string;
  tint: string;
  border: string;
  label: string;
}>;

/**
 * Spacing scale — 4px grid. Living range bumped: most spacing now sits
 * in s8–s12 (the editorial breathing tier). Tight values still exist
 * for micro-rhythm inside type lockups.
 */
export const SPACE = {
  s0: "0",
  s1: "4px",
  s2: "8px",
  s3: "12px",
  s4: "16px",
  s5: "24px",
  s6: "32px",
  s7: "44px",
  s8: "56px",
  s9: "72px",
  s10: "96px",
  s11: "112px",
  s12: "128px",   // Hero pad ceiling — editorial cinema breathing
} as const;

/**
 * Border radius — softer luxury. Cards read as glass slabs, not chips.
 * sm 6 → 8 (chips/brackets), md 16 → 18 (CTA + severity ribbon),
 * lg 22 → 24 (card default), xl 28 → 32 (raised pane).
 */
export const RADIUS = {
  sm: "8px",
  md: "18px",
  lg: "24px",
  xl: "32px",
  pill: "999px",
} as const;

/** Container width — kept at 680 for client-pane safety. */
export const WIDTH = {
  email: 680,
  content: 616,
  hero: 680,
} as const;

/**
 * Typography scale — editorial dominance. displayXl is the cover
 * headline (72px / 48px mobile, weight 900, ultra-tight tracking).
 * h1 is now genuine section architecture, not hint-text.
 */
export const TYPE = {
  displayXl: { size: "72px", lh: "0.98", weight: "900", tracking: "-0.04em" },
  displayXlMobile: { size: "48px", lh: "1.0", weight: "900", tracking: "-0.03em" },
  display: { size: "52px", lh: "1.0", weight: "900", tracking: "-0.03em" },
  displayMobile: { size: "36px", lh: "1.04", weight: "900", tracking: "-0.02em" },
  h1: { size: "32px", lh: "1.16", weight: "800", tracking: "-0.018em" },
  h2: { size: "24px", lh: "1.25", weight: "700", tracking: "-0.01em" },
  h3: { size: "18px", lh: "1.4", weight: "700", tracking: "-0.005em" },
  body: { size: "17px", lh: "1.7", weight: "400", tracking: "0" },
  bodyLg: { size: "20px", lh: "1.55", weight: "400", tracking: "-0.005em" },
  bodySm: { size: "15px", lh: "1.6", weight: "400", tracking: "0" },
  caption: { size: "12px", lh: "1.4", weight: "500", tracking: "0" },
  metric: { size: "40px", lh: "1.0", weight: "900", tracking: "-0.025em" },
  micro: {
    size: "11px",
    lh: "1.2",
    weight: "700",
    tracking: "0.28em",
  },
  microSm: {
    size: "10px",
    lh: "1.2",
    weight: "700",
    tracking: "0.36em",
  },
  pullQuote: {
    size: "30px",
    lh: "1.3",
    weight: "500",
    tracking: "-0.015em",
  },
} as const;

export const FONT_STACK = {
  ltr: '"Helvetica Neue", Helvetica, Arial, "Segoe UI", Roboto, sans-serif',
  rtl: '"SF Arabic", "Tajawal", "Cairo", "Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;

export const BREAKPOINT_MOBILE = 600;

/**
 * Canvas vignette — soft top wash that gives the email a luxury cinema
 * curtain feel. Returns to pure black quickly so the rest of the
 * composition floats on true black.
 */
export const HERO_GRADIENT =
  "radial-gradient(ellipse 80% 60% at 50% 0%, rgba(94,231,255,0.07) 0%, rgba(94,231,255,0) 55%), linear-gradient(180deg, #050810 0%, #02040A 40%, #000000 100%)";

/** Cinematic image-to-type dissolve gradient. */
export const HERO_BLEND_GRADIENT =
  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.98) 100%)";

/**
 * Card surface — frosted glass slab. Top edge slightly luminous (the
 * inner highlight glow handles that), bottom dissolves into deep black
 * so the card reads as a floating pane, not a stamped rectangle.
 */
export const CARD_GRADIENT =
  "linear-gradient(180deg, rgba(18,24,34,1) 0%, rgba(11,15,22,1) 45%, rgba(5,8,12,1) 100%)";

/** Card header strip — quiet cyan wash. */
export const CARD_HEADER_GRADIENT =
  "linear-gradient(180deg, rgba(94,231,255,0.05) 0%, rgba(94,231,255,0.0) 100%)";

/** CTA section atmospheric backdrop — radial cyan halo on near-black. */
export const CTA_SECTION_GRADIENT =
  "radial-gradient(ellipse 65% 70% at 50% 50%, rgba(94,231,255,0.11) 0%, rgba(94,231,255,0.04) 35%, rgba(3,6,10,0) 70%), linear-gradient(180deg, #03060A 0%, #08121E 50%, #03060A 100%)";

/** CTA gradient — luminous cyan glint top → deep cyan bottom. */
export const CTA_GRADIENT =
  "linear-gradient(180deg, #8AF1FF 0%, #5EE7FF 50%, #00B8D4 100%)";

/** Accent rule — cyan editorial hairline that fades at the edges. */
export const ACCENT_RULE_GRADIENT =
  "linear-gradient(90deg, rgba(94,231,255,0) 0%, #5EE7FF 50%, rgba(94,231,255,0) 100%)";

/** Footer atmospheric vignette. */
export const FOOTER_GRADIENT =
  "linear-gradient(180deg, #000000 0%, #02050A 50%, #000000 100%)";

/**
 * Glow tokens — sophisticated layered system.
 * card: deep drop + thin cyan ring + inner top highlight (glass slab).
 * cardCyan: same + outer cyan halo (used by raised/hero panels).
 * cta: triple-layer — wide cyan radial glow + drop shadow + inset glints.
 * innerHighlight: top-edge bright line for glass surfaces.
 * hero: deep cinema-projection drop shadow under the hero band.
 */
export const GLOW = {
  // Card: deep drop + faint cyan halo for atmospheric warmth + luminous
  // top edge highlight that reads as light catching a glass slab.
  card: "0 24px 56px rgba(0,0,0,0.6), 0 0 32px rgba(94,231,255,0.04), inset 0 1px 0 rgba(255,255,255,0.07)",
  cardCyan: "0 24px 56px rgba(0,0,0,0.6), 0 0 48px rgba(94,231,255,0.08), inset 0 1px 0 rgba(255,255,255,0.08)",
  // CTA: restored elegant halo (48px, midway between flat and neon flare).
  // The pill catches light from above (inset top glint) and casts a soft
  // cyan presence — premium product chrome, not gaming UI flare.
  cta: "0 0 48px rgba(94,231,255,0.32), 0 0 18px rgba(94,231,255,0.20), 0 14px 36px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.30), inset 0 -1px 0 rgba(0,0,0,0.22)",
  innerHighlight: "inset 0 1px 0 rgba(255,255,255,0.08)",
  hero: "0 32px 80px rgba(0,0,0,0.85)",
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
