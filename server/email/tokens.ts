/**
 * Email design tokens — cinematic edition v2 (luxury transformation ecosystem).
 *
 * Single source of truth for the YOUSSEF AHMED ELITE COACHING email
 * system. Every visual decision across every transactional email
 * resolves through these tokens.
 *
 * Aesthetic: Tron Legacy + luxury performance club + dark cinematic gym.
 * The user should feel they entered an elite transformation system, not
 * received a dark-themed notification.
 *
 * Discipline:
 *   - Pure-black canvas (#000000) for editorial luxury depth.
 *   - Real cinematic hero photography (with bulletproof image-off
 *     fallback — type band always carries the headline).
 *   - Cyan is restrained: edge accents, halo bars, CTAs, micro labels.
 *     Never decorative everywhere.
 *   - Spacing rhythmic on a 4px scale. Typography dominant.
 *   - Glow degrades gracefully (Outlook desktop strips box-shadow).
 */

export type Severity = "success" | "info" | "warning" | "critical";
export type Lang = "en" | "ar";
export type Direction = "ltr" | "rtl";

/** Cinematic color palette — luxury transformation ecosystem. */
export const COLOR = {
  brand: {
    cyan: "#00E5FF",            // Primary cyan
    cyanSoft: "#3FECFF",        // Brighter highlight cyan (CTA gradient top)
    cyanDeep: "#00B4CC",        // Deeper cyan for borders & CTA bottom
    cyanMuted: "rgba(0,229,255,0.72)",
    cyanGlow: "rgba(0,229,255,0.18)",
    ink: "#000000",             // Outer canvas — pure editorial black
    paper: "#F4F7FA",           // White text
  },
  bg: {
    canvas: "#000000",          // Outer email background — pure black
    canvasTop: "#020306",       // Top of vertical canvas gradient
    canvasBottom: "#000000",    // Bottom — fades to pure black
    surface: "#0B0F14",         // HUD card surface base
    surfaceTop: "rgba(15,21,28,0.96)",      // Card gradient top
    surfaceBottom: "rgba(7,10,14,0.99)",    // Card gradient bottom
    surfaceRaised: "#0E1922",   // Deep panel blue (nested HUD)
    surfaceHeader: "rgba(0,229,255,0.04)",  // Card header strip tint
    secondary: "#06090C",       // Secondary background
    heroBackdrop: "#000000",    // Hero image fallback
    ctaSection: "#04070B",      // Billboard CTA wrapper bg
    footer: "#000000",          // Atmospheric footer bg
  },
  border: {
    cyan: "rgba(0,229,255,0.22)",     // Primary HUD edge
    cyanSoft: "rgba(0,229,255,0.12)", // Quieter HUD edge
    cyanStrong: "rgba(0,229,255,0.42)", // Accent rules / chips
    divider: "rgba(255,255,255,0.06)",  // Hairline between rows
    hairline: "rgba(255,255,255,0.04)", // Even quieter
  },
  text: {
    primary: "#F4F7FA",         // White
    secondary: "#A7B0BA",       // Muted text
    tertiary: "#5A6370",        // Footer / fine print
    accent: "#00E5FF",          // Cyan emphasis word
    onAccent: "#020304",        // Text on cyan CTA
    link: "#00E5FF",
  },
  whatsapp: "#25D366",
  warmHighlight: "rgba(255,200,140,0.06)", // Atmospheric warm wash
} as const;

/**
 * Severity accents — restrained palette for the cinematic dark canvas.
 * Tints are dark+saturated (HUD-glass), accents are luminous.
 */
export const SEVERITY = {
  success: {
    accent: "#3DDCA8",
    tint: "rgba(61,220,168,0.10)",
    border: "rgba(61,220,168,0.32)",
    label: "Confirmed",
  },
  info: {
    accent: "#7AB7FF",
    tint: "rgba(122,183,255,0.10)",
    border: "rgba(122,183,255,0.32)",
    label: "Notice",
  },
  warning: {
    accent: "#FFB861",
    tint: "rgba(255,184,97,0.10)",
    border: "rgba(255,184,97,0.32)",
    label: "Heads-up",
  },
  critical: {
    accent: "#FF8A7A",
    tint: "rgba(255,138,122,0.10)",
    border: "rgba(255,138,122,0.32)",
    label: "Action required",
  },
} as const satisfies Record<Severity, {
  accent: string;
  tint: string;
  border: string;
  label: string;
}>;

/** Spacing scale — 4px increments. */
export const SPACE = {
  s0: "0",
  s1: "4px",
  s2: "8px",
  s3: "12px",
  s4: "16px",
  s5: "22px",
  s6: "28px",
  s7: "36px",
  s8: "48px",
  s9: "64px",
  s10: "80px",   // Hero pad (desktop)
  s11: "96px",   // Hero pad ceiling
} as const;

/** Border radius — HUD card shape. */
export const RADIUS = {
  sm: "6px",
  md: "12px",
  lg: "18px",      // Card default
  xl: "22px",      // Card raised
  pill: "999px",
} as const;

/** Container width per brief §CANVAS. */
export const WIDTH = {
  email: 680,      // Cinematic canvas — desktop max
  content: 616,    // Inner content (680 - 2*32)
  hero: 680,       // Hero image native width
} as const;

/**
 * Typography scale — cinematic dominance.
 *
 * displayXl is the hero headline (56px desktop / 38px mobile, weight 800,
 * tight tracking). display is for in-card titles. h1-h3 carry section
 * hierarchy. micro labels are aggressively tracked uppercase tags.
 */
export const TYPE = {
  displayXl: { size: "56px", lh: "1.05", weight: "800", tracking: "-0.025em" },
  displayXlMobile: { size: "38px", lh: "1.08", weight: "800", tracking: "-0.015em" },
  display: { size: "42px", lh: "1.05", weight: "800", tracking: "-0.02em" },
  displayMobile: { size: "30px", lh: "1.08", weight: "800", tracking: "-0.01em" },
  h1: { size: "26px", lh: "1.2", weight: "700", tracking: "-0.01em" },
  h2: { size: "20px", lh: "1.3", weight: "600", tracking: "0" },
  h3: { size: "16px", lh: "1.4", weight: "600", tracking: "0" },
  body: { size: "16px", lh: "1.65", weight: "400", tracking: "0" },
  bodyLg: { size: "17px", lh: "1.6", weight: "400", tracking: "0" },
  bodySm: { size: "14px", lh: "1.6", weight: "400", tracking: "0" },
  caption: { size: "12px", lh: "1.4", weight: "500", tracking: "0" },
  metric: { size: "30px", lh: "1.05", weight: "800", tracking: "-0.015em" },
  micro: {
    // Micro labels (DATE, TIME, LOCATION...) — aggressively tracked
    size: "11px",
    lh: "1.2",
    weight: "700",
    tracking: "0.22em",
  },
  microSm: {
    // Footer + nano labels
    size: "10px",
    lh: "1.2",
    weight: "600",
    tracking: "0.32em",
  },
  pullQuote: {
    // Atmospheric quote block
    size: "22px",
    lh: "1.35",
    weight: "500",
    tracking: "-0.005em",
  },
} as const;

/**
 * Font stack — system stack for safety. Helvetica Neue is the brief
 * preference; degrades to Arial on Windows. RTL adds SF Arabic / Tajawal.
 */
export const FONT_STACK = {
  ltr: '"Helvetica Neue", Helvetica, Arial, "Segoe UI", Roboto, sans-serif',
  rtl: '"SF Arabic", "Tajawal", "Cairo", "Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;

/** Mobile breakpoint — single cliff per email-client constraint. */
export const BREAKPOINT_MOBILE = 600;

/**
 * Hero gradient — vertical wash that anchors the type band beneath the
 * cinematic photograph. Top fades from near-black into pure black at the
 * bottom for seamless continuation into the canvas.
 */
export const HERO_GRADIENT =
  "linear-gradient(180deg, #020306 0%, #04070B 45%, #000000 100%)";

/**
 * Hero overlay gradient — sits between hero image and type band. Creates
 * the cinematic "fade-to-black" transition so the photo blends seamlessly
 * into the type composition below.
 */
export const HERO_BLEND_GRADIENT =
  "linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(0,0,0,0.5) 60%, rgba(0,0,0,0.95) 100%)";

/**
 * HUD card surface gradient — matte black glass panel.
 * Top sits at near-surface tone, bottom dissolves into pure black for
 * the cinematic "panel floating in black depth" feeling. Combined with
 * GLOW.innerHighlight (top-edge illumination), the card reads as a
 * milled-glass surface rather than a flat dark rectangle.
 */
export const CARD_GRADIENT =
  "linear-gradient(180deg, rgba(11,16,22,0.98) 0%, rgba(4,7,11,1) 100%)";

/** Card header strip — subtle cyan wash to differentiate the chip area. */
export const CARD_HEADER_GRADIENT =
  "linear-gradient(180deg, rgba(0,229,255,0.06) 0%, rgba(0,229,255,0.0) 100%)";

/** Billboard CTA section background — atmospheric depth around the CTA. */
export const CTA_SECTION_GRADIENT =
  "linear-gradient(180deg, #04070B 0%, #07101A 50%, #04070B 100%)";

/** CTA button gradient — cyan top → cyanDeep bottom for premium product feel. */
export const CTA_GRADIENT =
  "linear-gradient(180deg, #3FECFF 0%, #00E5FF 50%, #00B4CC 100%)";

/**
 * Accent rule gradient — used for the cinematic halo bar above hero
 * eyebrows + as the cyan top accent on cards. Fades from transparent at
 * the edges into the brand cyan in the middle for an editorial framing
 * feel.
 */
export const ACCENT_RULE_GRADIENT =
  "linear-gradient(90deg, rgba(0,229,255,0) 0%, #00E5FF 50%, rgba(0,229,255,0) 100%)";

/** Atmospheric footer gradient. */
export const FOOTER_GRADIENT =
  "linear-gradient(180deg, #000000 0%, #02050A 50%, #000000 100%)";

/**
 * Glow tokens — emitted as box-shadow declarations. Degrade gracefully in
 * Outlook desktop (which strips them) — the email remains complete and
 * on-brand without them.
 */
/**
 * Calibrated glow scale — every cyan opacity and white-inset highlight
 * tuned against a single luxury-restraint axis so the system reads as
 * "calibrated" not "decorative". card cyan ring 0.10 matches
 * innerHighlight 0.10 so card-edge illumination is visually unified
 * across every card surface. CTA inset gloss 0.24 (was 0.32 — too hot)
 * keeps the button reading as expensive product chrome rather than a
 * neon overlay.
 */
export const GLOW = {
  card: "0 16px 48px rgba(0,0,0,0.55), 0 0 0 1px rgba(0,229,255,0.10)",
  cardCyan: "0 16px 48px rgba(0,0,0,0.55), 0 0 32px rgba(0,229,255,0.12)",
  cta: "0 0 32px rgba(0,229,255,0.42), 0 8px 28px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.24), inset 0 -1px 0 rgba(0,0,0,0.18)",
  innerHighlight: "inset 0 1px 0 rgba(255,255,255,0.10)",
  hero: "0 24px 64px rgba(0,0,0,0.8)",
} as const;

/**
 * Hero image catalogue — keyed slugs that resolve to bulletproof URLs
 * served from `/email-assets/heroes/*.png` under PUBLIC_APP_URL.
 *
 * Each photograph is shot/composed with a fade-to-pure-black bottom edge
 * so the image flows seamlessly into the gradient type band beneath it.
 *
 *   welcome    — empty boutique gym at blue hour, squat rack silhouette.
 *                For onboarding & ecosystem-entry milestones.
 *   session    — close-up of a single matte black kettlebell, cyan rim.
 *                For confirmed/upcoming sessions.
 *   discipline — laced training shoes on dark concrete, morning light.
 *                For reminders + cadence/consistency moments.
 *   triumph    — racked dumbbells under warm spotlight at dawn.
 *                For milestone/package-completed moments.
 */
export const HERO_IMAGES = {
  welcome: "/email-assets/heroes/welcome_hero.png",
  session: "/email-assets/heroes/session_hero.png",
  discipline: "/email-assets/heroes/discipline_hero.png",
  triumph: "/email-assets/heroes/triumph_hero.png",
} as const;

export type HeroImageKey = keyof typeof HERO_IMAGES;

/**
 * Build a fully-qualified hero image URL from the catalogue. Returns
 * `null` when no `baseUrl` is provided so the hero primitive can skip the
 * image band entirely (graceful degradation).
 */
export function heroImageUrl(key: HeroImageKey, baseUrl: string | null | undefined): string | null {
  if (!baseUrl) return null;
  const trimmed = baseUrl.replace(/\/+$/, "");
  return `${trimmed}${HERO_IMAGES[key]}`;
}

/**
 * Derive a base URL (protocol + host) from any of the URLs already passed
 * to a builder. Lets builders construct hero image URLs without requiring
 * a new `baseUrl` parameter — keeps the existing builder API stable.
 */
export function deriveBaseUrl(...urls: Array<string | null | undefined>): string | null {
  for (const u of urls) {
    if (!u) continue;
    try {
      const url = new URL(u);
      return `${url.protocol}//${url.host}`;
    } catch {
      // Not an absolute URL — skip.
    }
  }
  return null;
}

/** Resolve a severity to its accent + tint color pair. */
export function severityTokens(sev: Severity) {
  return SEVERITY[sev];
}

/** Resolve direction from a language code. */
export function dirFromLang(lang: Lang): Direction {
  return lang === "ar" ? "rtl" : "ltr";
}

/** Pick the right font stack for the language. */
export function fontStack(lang: Lang): string {
  return lang === "ar" ? FONT_STACK.rtl : FONT_STACK.ltr;
}
