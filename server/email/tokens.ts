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

/**
 * TRON RGB palette — futuristic athletic interface.
 * Triad: electric cyan (primary action) + magenta (energy accent) +
 * violet (atmospheric depth). Used for dual-edge cards, multi-color
 * glows, and section dividers. Magenta/violet are NEVER used for
 * primary actions or text — only for atmospheric edges and glows.
 */
export const COLOR = {
  brand: {
    cyan: "#5EE7FF",            // Primary cyan — actions, primary accent
    cyanSoft: "#8AF1FF",        // CTA gradient top — almost-white cyan glint
    cyanDeep: "#00B8D4",        // CTA gradient bottom
    cyanMuted: "rgba(94,231,255,0.78)",
    cyanGlow: "rgba(94,231,255,0.16)",
    // RGB energy accents — atmospheric only, never primary action.
    magenta: "#FF3DDA",         // Hot magenta — bottom card edge, glow
    magentaGlow: "rgba(255,61,218,0.18)",
    magentaDeep: "rgba(213,40,180,0.5)",
    violet: "#9D4EDD",          // Violet — distant atmospheric backlight
    violetGlow: "rgba(157,78,221,0.12)",
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
    // Body luminance — readability lift while staying calm against pure
    // black. Reads as composed editorial prose, not as muted helper text.
    secondary: "#C5CCD6",
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
 * Hero canvas — TRON Legacy atmospheric chamber. RGB triad lighting:
 *   1. Strong cyan halo at top-center (0.18 alpha) — headline stage.
 *   2. Magenta off-axis backlight on the right (0.10 alpha) — RGB energy.
 *   3. Violet atmospheric haze bottom-left (0.08) — depth dimension.
 *   4. Linear deep-blue → near-black floor for cinematic anchor.
 * Reads as a futuristic athletic facility lit by RGB stage rig, not a
 * flat backdrop. Cyan dominates (80% of presence), magenta + violet are
 * atmospheric whispers — exactly the TRON Legacy color discipline.
 */
export const HERO_GRADIENT =
  "radial-gradient(ellipse 70% 55% at 50% 0%, rgba(94,231,255,0.18) 0%, rgba(94,231,255,0.07) 30%, rgba(94,231,255,0) 65%), radial-gradient(ellipse 55% 70% at 88% 35%, rgba(255,61,218,0.10) 0%, rgba(255,61,218,0) 70%), radial-gradient(ellipse 60% 75% at 12% 75%, rgba(157,78,221,0.08) 0%, rgba(157,78,221,0) 65%), linear-gradient(180deg, #060B14 0%, #02050B 45%, #000000 100%)";

/**
 * Cinematic image-to-type dissolve. Smooth 4-stop fade so the photo
 * BLEEDS into the type band over a tall band — never a hard line.
 */
export const HERO_BLEND_GRADIENT =
  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.20) 25%, rgba(0,0,0,0.55) 55%, rgba(0,0,0,0.85) 80%, rgba(0,0,0,1) 100%)";

/**
 * Image overlay — sits ON TOP of the hero image to bleed it into the
 * surrounding canvas. Vignettes the corners and dims the bottom 40%
 * so the image reads as cinematography, not a stock photo crop.
 */
export const HERO_IMAGE_OVERLAY =
  "radial-gradient(ellipse 120% 90% at 50% 30%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%), linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0) 50%, rgba(0,0,0,0.6) 100%)";

/**
 * Card surface — frosted glass slab. Stronger top luminance so the
 * card reads as glass catching light from above. 4-stop gradient: bright
 * top (catches the room light), warm mid, deep mid, near-black bottom.
 */
export const CARD_GRADIENT =
  "linear-gradient(180deg, rgba(22,29,40,1) 0%, rgba(15,21,30,1) 30%, rgba(9,13,19,1) 65%, rgba(4,6,10,1) 100%)";

/**
 * Card top edge — 1px luminous cyan line that catches light. Sits as
 * a separate row at the top of the card to read as a glass bevel.
 * Brightened (0.45 → 0.65) for stronger TRON edge presence.
 */
export const CARD_TOP_EDGE =
  "linear-gradient(90deg, rgba(94,231,255,0) 0%, rgba(94,231,255,0.65) 50%, rgba(94,231,255,0) 100%)";

/**
 * Card BOTTOM edge — 1px magenta hairline (RGB triad complement).
 * Faint (0.32) so it reads as an atmospheric undertone, not a second
 * primary edge. Cyan top + magenta bottom = TRON dual-edge signature.
 */
export const CARD_BOTTOM_EDGE =
  "linear-gradient(90deg, rgba(255,61,218,0) 0%, rgba(255,61,218,0.32) 50%, rgba(255,61,218,0) 100%)";

/** Card header strip — quiet cyan wash. */
export const CARD_HEADER_GRADIENT =
  "linear-gradient(180deg, rgba(94,231,255,0.05) 0%, rgba(94,231,255,0.0) 100%)";

/**
 * CTA section TRON stage — RGB triad halo composition.
 *   1. Strong cyan central halo (0.22) — primary stage spotlight.
 *   2. Magenta luminous floor (0.10 at 50% 100%) — RGB undertone.
 *   3. Violet ceiling whisper (0.06 at 50% 0%) — atmospheric depth.
 *   4. Deep navy-blue radial canvas — TRON sky.
 * The CTA pill lives at the center of an RGB stage rig, not a button
 * on a band. Reads as the climax of a futuristic athletic interface.
 */
export const CTA_SECTION_GRADIENT =
  "radial-gradient(ellipse 75% 80% at 50% 50%, rgba(94,231,255,0.22) 0%, rgba(94,231,255,0.08) 40%, rgba(3,6,10,0) 80%), radial-gradient(ellipse 100% 35% at 50% 100%, rgba(255,61,218,0.10) 0%, rgba(255,61,218,0) 100%), radial-gradient(ellipse 100% 25% at 50% 0%, rgba(157,78,221,0.06) 0%, rgba(157,78,221,0) 100%), linear-gradient(180deg, #03060A 0%, #0A1622 50%, #03060A 100%)";

/** CTA gradient — luminous cyan glint top → deep cyan bottom. */
export const CTA_GRADIENT =
  "linear-gradient(180deg, #8AF1FF 0%, #5EE7FF 50%, #00B8D4 100%)";

/**
 * Accent rule — TRON RGB hairline. Cyan-dominant with a soft magenta
 * crossover near the right edge. Reads as a futuristic light bar, not
 * a generic divider. Falls back gracefully (Outlook strips gradients
 * → pure cyan border-top defined inline at call sites).
 */
export const ACCENT_RULE_GRADIENT =
  "linear-gradient(90deg, rgba(94,231,255,0) 0%, #5EE7FF 35%, #8AF1FF 55%, #FF3DDA 90%, rgba(255,61,218,0) 100%)";

/**
 * Footer TRON atmospheric vignette — cyan ceiling halo + magenta floor
 * undertone. Continues the RGB stage language from the CTA section into
 * the closing footer so the email reads as one continuous lit chamber.
 */
export const FOOTER_GRADIENT =
  "radial-gradient(ellipse 80% 50% at 50% 0%, rgba(94,231,255,0.06) 0%, rgba(94,231,255,0) 60%), radial-gradient(ellipse 80% 40% at 50% 100%, rgba(255,61,218,0.05) 0%, rgba(255,61,218,0) 70%), linear-gradient(180deg, #000000 0%, #03060B 50%, #000000 100%)";

/**
 * Glow tokens — sophisticated layered system.
 * card: deep drop + thin cyan ring + inner top highlight (glass slab).
 * cardCyan: same + outer cyan halo (used by raised/hero panels).
 * cta: triple-layer — wide cyan radial glow + drop shadow + inset glints.
 * innerHighlight: top-edge bright line for glass surfaces.
 * hero: deep cinema-projection drop shadow under the hero band.
 */
export const GLOW = {
  // Card: TRON dual-color glow — cyan primary halo + faint magenta
  // undertone + deep drop. Reads as a glass slab lit by RGB stage rig.
  card: "0 32px 72px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.5), 0 0 56px rgba(94,231,255,0.10), 0 0 32px rgba(255,61,218,0.05), inset 0 1px 0 rgba(255,255,255,0.10)",
  cardCyan: "0 32px 72px rgba(0,0,0,0.7), 0 8px 24px rgba(0,0,0,0.5), 0 0 72px rgba(94,231,255,0.18), 0 0 40px rgba(255,61,218,0.08), inset 0 1px 0 rgba(255,255,255,0.12)",
  // CTA: TRON disc — wide cyan stage halo (72px) + magenta secondary
  // glow (40px) + tight cyan inner ring + deep drop. The pill reads as
  // a TRON identity disc casting RGB light, not a generic button.
  cta: "0 0 72px rgba(94,231,255,0.45), 0 0 40px rgba(255,61,218,0.22), 0 0 22px rgba(94,231,255,0.32), 0 18px 44px rgba(0,0,0,0.75), inset 0 1px 0 rgba(255,255,255,0.38), inset 0 -2px 4px rgba(0,0,0,0.28)",
  innerHighlight: "inset 0 1px 0 rgba(255,255,255,0.10)",
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
