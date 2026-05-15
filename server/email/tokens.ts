/**
 * Email design tokens — cinematic edition.
 *
 * This file is the single source of truth for the YOUSSEF ELITE COACHING
 * cinematic email system. Every visual decision across every transactional
 * email resolves through these tokens.
 *
 * Aesthetic: Tron Legacy + luxury performance club + dark cinematic gym.
 * Discipline: dark-first (no light/dark dual mode); cyan is restrained,
 * never decorative; spacing is rhythmic; typography is dominant.
 *
 * Hard rules:
 *   - Inline-safe values only (email clients strip CSS variables).
 *   - Dark-first by design — `color-scheme: dark` is locked at the shell.
 *   - Severity classification controls accent only, never card surface.
 *   - Glow is a *decorative enhancement* — clients that strip box-shadow
 *     (Outlook desktop) still get a complete, beautiful email.
 *   - All spacing on a 4px scale. No arbitrary pixel gaps anywhere.
 */

export type Severity = "success" | "info" | "warning" | "critical";
export type Lang = "en" | "ar";
export type Direction = "ltr" | "rtl";

/** Cinematic color palette per design brief §COLOR SYSTEM. */
export const COLOR = {
  brand: {
    cyan: "#00E5FF",          // Primary cyan
    cyanSoft: "#21C7E8",      // Soft cyan
    cyanMuted: "rgba(0,229,255,0.72)",
    ink: "#030507",           // Outer canvas (deepest black)
    paper: "#F4F7FA",         // White text
  },
  bg: {
    canvas: "#030507",        // Outer email background
    canvasTop: "#05070A",     // Top of vertical gradient
    canvasBottom: "#020304",  // Bottom of vertical gradient
    surface: "#0D1117",       // HUD card surface
    surfaceTop: "rgba(13,17,23,0.96)",     // Card gradient top
    surfaceBottom: "rgba(7,10,14,0.98)",   // Card gradient bottom
    surfaceRaised: "#0B1C2A", // Deep panel blue (used for nested HUD)
    secondary: "#080B0F",     // Secondary background
  },
  border: {
    cyan: "rgba(0,229,255,0.18)",   // Primary HUD edge
    cyanSoft: "rgba(0,229,255,0.10)", // Quieter HUD edge
    divider: "rgba(255,255,255,0.06)", // Hairline between rows
  },
  text: {
    primary: "#F4F7FA",       // White
    secondary: "#A7B0BA",     // Muted text
    tertiary: "#6B7380",      // Even more muted (footer, fine print)
    accent: "#00E5FF",        // Cyan emphasis word
    onAccent: "#020304",      // Text on cyan CTA
    link: "#00E5FF",
  },
  whatsapp: "#25D366",
  warmHighlight: "rgba(255,214,153,0.12)", // cinematic warm light wash
} as const;

/**
 * Severity accents — restrained palette designed for the cinematic dark
 * canvas. Tints are dark+saturated (HUD-glass), accents are luminous.
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
} as const;

/** Border radius — HUD card shape. */
export const RADIUS = {
  sm: "6px",
  md: "12px",
  lg: "18px",      // Card default — per brief §CARD SYSTEM
  xl: "22px",      // Card raised — per brief §CARD SYSTEM
  pill: "999px",
} as const;

/** Container width per brief §CANVAS / STRUCTURE. */
export const WIDTH = {
  email: 680,      // Cinematic canvas — desktop max
  content: 616,    // Inner content width (680 - 2*32)
} as const;

/**
 * Typography scale.
 *
 * Brief §TYPOGRAPHY SYSTEM asks for HUGE display headlines (42-54px desktop
 * / 30-38px mobile). We pick the conservative end of each band so that
 * Outlook 2007/2010 desktop doesn't choke on 54px line-heights, but the
 * cinematic dominance the brief asks for is preserved.
 */
export const TYPE = {
  display: { size: "42px", lh: "1.05", weight: "700", tracking: "-0.02em" },
  displayMobile: { size: "30px", lh: "1.08", weight: "700", tracking: "-0.01em" },
  h1: { size: "26px", lh: "1.2", weight: "700", tracking: "-0.01em" },
  h2: { size: "20px", lh: "1.3", weight: "600", tracking: "0" },
  h3: { size: "16px", lh: "1.4", weight: "600", tracking: "0" },
  body: { size: "16px", lh: "1.55", weight: "400", tracking: "0" },
  bodySm: { size: "14px", lh: "1.55", weight: "400", tracking: "0" },
  caption: { size: "12px", lh: "1.4", weight: "500", tracking: "0" },
  metric: { size: "26px", lh: "1.1", weight: "700", tracking: "-0.01em" },
  micro: {
    // Micro labels per brief §TYPOGRAPHY SYSTEM (DATE, TIME, LOCATION...)
    size: "11px",
    lh: "1.2",
    weight: "600",
    tracking: "0.18em",
  },
} as const;

/**
 * Font stack — system stack for safety. Brief preferred Helvetica Neue,
 * Helvetica, Arial — matches modern macOS/iOS perfectly and degrades to
 * Arial on Windows. We append broader fallbacks for resilience.
 */
export const FONT_STACK = {
  ltr: '"Helvetica Neue", Helvetica, Arial, "Segoe UI", Roboto, sans-serif',
  rtl: '"SF Arabic", "Tajawal", "Cairo", "Helvetica Neue", Helvetica, Arial, sans-serif',
} as const;

/** Mobile breakpoint — single cliff per email-client constraint. */
export const BREAKPOINT_MOBILE = 600;

/**
 * Hero gradient — vertical wash that anchors the cinematic top of the
 * email. Image-free by design (Gmail strips remote images by default).
 * Cinematic depth comes from typography + restrained cyan glow.
 */
export const HERO_GRADIENT =
  "linear-gradient(180deg, #06090E 0%, #04060A 60%, #030507 100%)";

/** HUD card surface gradient per brief §CARD SYSTEM. */
export const CARD_GRADIENT =
  "linear-gradient(180deg, rgba(13,17,23,0.96) 0%, rgba(7,10,14,0.98) 100%)";

/**
 * Glow tokens per brief §GLOW SYSTEM. These are emitted as box-shadow
 * declarations and degrade gracefully in clients that strip them
 * (Outlook desktop): the email remains complete and on-brand without them.
 */
export const GLOW = {
  card: "0 10px 34px rgba(0,0,0,0.42), 0 0 0 1px rgba(0,229,255,0.06)",
  cardCyan: "0 10px 34px rgba(0,0,0,0.42), 0 0 24px rgba(0,229,255,0.10)",
  cta: "0 0 24px rgba(0,229,255,0.32), 0 6px 20px rgba(0,0,0,0.5)",
  innerHighlight: "inset 0 1px 0 rgba(255,255,255,0.04)",
} as const;

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
