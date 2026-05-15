/**
 * Email design tokens — the single source of truth for every visual decision
 * across all 28 transactional emails.
 *
 * Hard rules (per Step 2 §1.12 + §2):
 *   - Inline-safe values only (email clients strip CSS variables).
 *   - Light-mode default. Dark-mode pairs declared per token where relevant.
 *   - Severity classification controls accent + tint, never card background.
 *   - All spacing on a 4px scale. No arbitrary pixel gaps anywhere.
 *
 * Components MUST consume from here. Hardcoded hex / px values inside any
 * component is a bug — call it out in code review.
 */

export type Severity = "success" | "info" | "warning" | "critical";
export type Weight = "heavy" | "medium" | "light";
export type Lang = "en" | "ar";
export type Direction = "ltr" | "rtl";

export const COLOR = {
  brand: {
    cyan: "#0BB6CF",
    cyanDark: "#5EE7FF",
    ink: "#050505",
    paper: "#FFFFFF",
  },
  bg: {
    canvas: "#F5F6F8",
    canvasDark: "#050505",
    surface: "#FFFFFF",
    surfaceDark: "#101113",
    surfaceRaised: "#FFFFFF",
    surfaceRaisedDark: "#17181B",
  },
  border: {
    subtle: "#E5E7EB",
    subtleDark: "#1F2125",
    strong: "#CDD0D7",
    strongDark: "#2C2F35",
  },
  text: {
    primary: "#0A0A0B",
    primaryDark: "#F5F6F8",
    secondary: "#4A4F58",
    secondaryDark: "#B6BAC2",
    tertiary: "#7A8090",
    tertiaryDark: "#828896",
    onAccent: "#FFFFFF",
    onAccentDark: "#050505",
    link: "#0BB6CF",
  },
  whatsapp: "#25D366",
} as const;

export const SEVERITY = {
  success: {
    accent: "#0E8F6E",
    accentDark: "#3DDCA8",
    tint: "#E8F8F2",
    tintDark: "#0F2A22",
    icon: "✓",
    label: "Success",
  },
  info: {
    accent: "#1F6FEB",
    accentDark: "#7AB7FF",
    tint: "#EEF4FF",
    tintDark: "#0E1B2E",
    icon: "i",
    label: "Information",
  },
  warning: {
    accent: "#B86E00",
    accentDark: "#FFB861",
    tint: "#FFF6E6",
    tintDark: "#2B1E07",
    icon: "!",
    label: "Heads-up",
  },
  critical: {
    accent: "#B42318",
    accentDark: "#FF8A7A",
    tint: "#FEEDEB",
    tintDark: "#2C0F0C",
    icon: "!!",
    label: "Action required",
  },
} as const satisfies Record<Severity, {
  accent: string;
  accentDark: string;
  tint: string;
  tintDark: string;
  icon: string;
  label: string;
}>;

/** Spacing scale — 4px increments (§1.3). */
export const SPACE = {
  s0: "0",
  s1: "4px",
  s2: "8px",
  s3: "12px",
  s4: "16px",
  s5: "24px",
  s6: "32px",
  s7: "48px",
  s8: "64px",
} as const;

/** Border radius (§1.4). */
export const RADIUS = {
  sm: "6px",
  md: "10px",
  lg: "14px",
  pill: "999px",
} as const;

/** Container widths (§1.5). */
export const WIDTH = {
  email: 600,
  content: 552,
} as const;

/** Typography scale (§1.2). Sizes in px, line-height unitless. */
export const TYPE = {
  display: { size: "28px", lh: "1.2", weight: "600" },
  h1: { size: "22px", lh: "1.3", weight: "600" },
  h2: { size: "18px", lh: "1.35", weight: "600" },
  h3: { size: "15px", lh: "1.4", weight: "600" },
  body: { size: "15px", lh: "1.55", weight: "400" },
  bodySm: { size: "13px", lh: "1.5", weight: "400" },
  caption: { size: "12px", lh: "1.4", weight: "500" },
  metric: { size: "24px", lh: "1.1", weight: "600" },
  mono: {
    size: "13px",
    lh: "1.4",
    weight: "500",
    family: "ui-monospace, Menlo, Consolas, monospace",
  },
} as const;

/** Font stack — system fonts only. RTL appends Arabic system fonts. */
export const FONT_STACK = {
  ltr: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", "Helvetica Neue", Arial, sans-serif',
  rtl: '"SF Arabic", "Tajawal", "Cairo", -apple-system, BlinkMacSystemFont, "Segoe UI", "Inter", Arial, sans-serif',
} as const;

/** Mobile breakpoint (§2.11). Email clients support exactly one cliff. */
export const BREAKPOINT_MOBILE = 480;

/** Brand-cyan whisper gradient for hero containers (§2.8). */
export const HERO_GRADIENT =
  "linear-gradient(180deg, rgba(11,182,207,0.06) 0%, rgba(11,182,207,0.00) 100%)";

/**
 * Resolve a severity to its accent + tint color pair. Caller chooses which
 * mode (light vs dark token) — composer always emits light values inline,
 * dark values are injected via prefers-color-scheme overrides at post-process.
 */
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
