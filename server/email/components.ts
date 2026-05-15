/**
 * Email primitives — YOUSSEF AHMED ELITE cinematic component engine v2.
 *
 * The user should feel: "I just entered an elite transformation system."
 * NOT: "I received a dark-themed notification."
 *
 * Hard contract:
 *   1. Every visual value resolves through tokens.ts. No literals here.
 *   2. Outlook hacks (VML, MSO conditionals) are CONTAINED inside the
 *      single primitive that needs them (ctaButton). They never leak
 *      into other component APIs or call sites.
 *   3. Each primitive owns ONE responsibility. No god components.
 *   4. APIs are rigid by design — visual stability wins over flexibility.
 *      If a builder needs a new variant, evolve a primitive, never a
 *      one-off override.
 *   5. Every primitive is table-based, inline-styled, and degrades
 *      gracefully when images, webfonts, glow shadows, or modern CSS
 *      gradients are stripped.
 *   6. Hero photography is OPTIONAL — the type band always carries the
 *      headline. Image-blocked Gmail, Outlook desktop, and Apple Mail
 *      auto-bypass all render a complete cinematic email.
 *
 * Design language: Tron Legacy + luxury performance club + dark
 * cinematic gym. Cyan is restrained — edge accents, halo bars, CTAs,
 * micro labels. Depth comes from layered surfaces, not decoration.
 */

import {
  COLOR,
  RADIUS,
  SEVERITY,
  SPACE,
  TYPE,
  WIDTH,
  HERO_GRADIENT,
  HERO_BLEND_GRADIENT,
  CARD_GRADIENT,
  CARD_HEADER_GRADIENT,
  CTA_SECTION_GRADIENT,
  CTA_GRADIENT,
  ACCENT_RULE_GRADIENT,
  FOOTER_GRADIENT,
  GLOW,
  fontStack,
  type Lang,
  type Severity,
} from "./tokens";

// ────────────────────────────────────────────────────────────────────────
// Internal helpers
// ────────────────────────────────────────────────────────────────────────

/** Escape arbitrary user content for HTML attribute / text contexts. */
export function esc(s: string | number | null | undefined): string {
  if (s === null || s === undefined) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const TYPE_KEYS = [
  "displayXl", "displayXlMobile", "display", "displayMobile",
  "h1", "h2", "h3",
  "body", "bodyLg", "bodySm", "caption",
  "metric", "micro", "microSm", "pullQuote",
] as const;
type TypeKey = (typeof TYPE_KEYS)[number];

const TEXT_COLOR_CLASS = {
  primary: "email-text-primary",
  secondary: "email-text-secondary",
  tertiary: "email-text-tertiary",
  accent: "email-text-accent",
} as const;

type TextColor = keyof typeof TEXT_COLOR_CLASS;
type Align = "left" | "center" | "right";

function typeStyle(key: TypeKey, color: string): string {
  const t = TYPE[key];
  const tracking = "tracking" in t && t.tracking ? `letter-spacing:${t.tracking};` : "";
  return `margin:0;font-size:${t.size};line-height:${t.lh};font-weight:${t.weight};color:${color};${tracking}`;
}

function colorOf(key: TextColor): string {
  return key === "primary" ? COLOR.text.primary
    : key === "secondary" ? COLOR.text.secondary
    : key === "tertiary" ? COLOR.text.tertiary
    : COLOR.text.accent;
}

// ────────────────────────────────────────────────────────────────────────
// Shell — the only full-document primitive. Locked dark canvas.
// ────────────────────────────────────────────────────────────────────────

export interface ShellOptions {
  lang: Lang;
  /** Inbox-preview text. Hidden from rendered body. */
  preheader: string;
  /** Pre-rendered body HTML (composed from primitives below). */
  bodyHtml: string;
}

export function emailShell({ lang, preheader, bodyHtml }: ShellOptions): string {
  const dir = lang === "ar" ? "rtl" : "ltr";
  const family = fontStack(lang);
  return [
    `<!DOCTYPE html>`,
    `<html lang="${esc(lang)}" dir="${dir}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<meta name="x-apple-disable-message-reformatting">`,
    // Lock to dark — prevents iOS Mail / Outlook web from forcing a light variant.
    `<meta name="color-scheme" content="dark only">`,
    `<meta name="supported-color-schemes" content="dark only">`,
    `<title></title>`,
    // Outlook DPI/anti-blur fix — contained here, never leaks elsewhere.
    `<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->`,
    `<style type="text/css">`,
    // Force dark color-scheme on every element so Gmail web stops proposing inversion.
    `:root { color-scheme: dark; supported-color-schemes: dark; }`,
    // Mobile cliff — single breakpoint per tokens.BREAKPOINT_MOBILE.
    `@media only screen and (max-width:600px){`,
    `.email-shell{width:100% !important;}`,
    `.email-pad{padding-left:18px !important;padding-right:18px !important;}`,
    `.email-pad-tight{padding-left:14px !important;padding-right:14px !important;}`,
    `.email-cta-cell a{display:block !important;width:auto !important;}`,
    `.email-stack-2col>td{display:block !important;width:100% !important;}`,
    `.email-stack-2col>td+td{padding-top:${SPACE.s4} !important;padding-left:0 !important;}`,
    // Mobile-scaled display headlines.
    `.email-display-xl{font-size:${TYPE.displayXlMobile.size} !important;line-height:${TYPE.displayXlMobile.lh} !important;letter-spacing:${TYPE.displayXlMobile.tracking} !important;}`,
    `.email-display{font-size:${TYPE.displayMobile.size} !important;line-height:${TYPE.displayMobile.lh} !important;}`,
    // Mobile hero gets tighter vertical pad.
    `.email-hero-pad{padding:${SPACE.s8} ${SPACE.s4} ${SPACE.s7} !important;}`,
    `.email-cta-section-pad{padding:${SPACE.s8} ${SPACE.s4} !important;}`,
    `}`,
    // Remove default link blueing on iOS (phone numbers, addresses).
    `a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}`,
    // Outlook table cellpadding zero-out.
    `table { border-collapse: collapse; }`,
    // Image hardening — kill ghost gaps + alt-text styling when blocked.
    `img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }`,
    `</style>`,
    `<!-- DARK_MODE_OVERRIDES -->`,
    `</head>`,
    // Inline body bg locks the dark canvas before CSS loads.
    `<body style="margin:0;padding:0;background-color:${COLOR.bg.canvas};font-family:${family};color:${COLOR.text.primary};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;" class="email-canvas">`,
    // Preheader — hidden, but sits in inbox preview.
    `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:transparent;">${esc(preheader)}</div>`,
    // Outer canvas with vertical gradient (degrades to solid #000000).
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.canvas};background-image:linear-gradient(180deg, ${COLOR.bg.canvasTop} 0%, ${COLOR.bg.canvasBottom} 100%);" class="email-canvas">`,
    `<tr><td align="center" style="padding:${SPACE.s7} 0;">`,
    `<table role="presentation" width="${WIDTH.email}" cellspacing="0" cellpadding="0" border="0" class="email-shell" style="width:${WIDTH.email}px;max-width:100%;">`,
    `<tr><td>`,
    bodyHtml,
    `</td></tr>`,
    `</table>`,
    `</td></tr>`,
    `</table>`,
    `</body></html>`,
  ].join("");
}

// ────────────────────────────────────────────────────────────────────────
// Brand header — wordmark with cinematic letter-spacing.
// Editorial framing: bracketed wordmark sits within thin cyan accent rules.
// ────────────────────────────────────────────────────────────────────────

export function brandHeader(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-pad" align="center" style="padding:${SPACE.s8} ${SPACE.s7} ${SPACE.s2};">`
    // Cyan halo bar above wordmark (48px × 1px, gradient-faded, decorative).
    // Bottom pad is tight (s2) so the wordmark sits AGAINST the next
    // section (hero image / type band) — luxury wordmark plate, not floating.
    + `<div style="width:48px;height:1px;background-color:${COLOR.brand.cyan};background-image:${ACCENT_RULE_GRADIENT};margin:0 auto ${SPACE.s4};font-size:0;line-height:1px;">&nbsp;</div>`
    + `<div style="font-family:inherit;font-size:11px;line-height:1;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:${COLOR.brand.cyan};" class="email-text-accent">YOUSSEF AHMED</div>`
    + `<div style="font-family:inherit;font-size:10px;line-height:1;font-weight:500;letter-spacing:0.42em;text-transform:uppercase;color:${COLOR.text.tertiary};padding-top:8px;" class="email-text-tertiary">ELITE PERSONAL TRAINING · DUBAI</div>`
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Cinematic Hero — luxury transformation moment.
//
// Composition (per cinematic v2 brief):
//   - Optional cinematic image band (full-width photograph with
//     fade-to-black bottom edge for seamless continuation).
//   - Dark gradient type band beneath the image with:
//       · Cyan halo bar (decorative editorial framing)
//       · Eyebrow tag (uppercase, tracked, cyan)
//       · MASSIVE display headline (56px desktop / 38px mobile, weight 800)
//       · Optional cyan accent word
//       · Optional subtitle (muted, max-480px constrained for legibility)
//       · Optional trailing meta line (location · date — atmospheric specificity)
//
// The image is OPTIONAL — when absent or blocked, the type band still
// carries the cinematic weight via typography dominance.
// ────────────────────────────────────────────────────────────────────────

export interface HeroOptions {
  eyebrow?: string;
  /**
   * Headline text. Supports a single optional `accentWord` rendered in
   * brand cyan. Pattern: title="WELCOME TO THE", accentWord="ECOSYSTEM".
   */
  title: string;
  accentWord?: string;
  subtitle?: string;
  /** Atmospheric specificity line — e.g. "DUBAI MARINA · MAR 2026". */
  trailingMeta?: string;
  /**
   * Cinematic backdrop photograph. Pass a fully-qualified URL (use
   * `heroImageUrl()` from tokens). When omitted, the hero renders type-only.
   */
  imageUrl?: string | null;
  /** Alt text for the hero image — kept short for image-blocked clients. */
  imageAlt?: string;
  align?: Align;
}

export function hero({ eyebrow, title, accentWord, subtitle, trailingMeta, imageUrl, imageAlt, align = "center" }: HeroOptions): string {
  // Image band — bulletproof <img> tag. Display:block kills the ghost gap.
  // alt="" with role="presentation" so screen readers and image-blocked
  // clients don't show meaningless filename text. The fade-to-black bottom
  // edge of the photo blends into the type band gradient seamlessly.
  //
  // Cinematic blend strip: 32px atmospheric haze that sits BETWEEN the
  // image bottom and the type band, using HERO_BLEND_GRADIENT (transparent
  // → near-black → pure black). Kills the visible flat-edge break and
  // gives the image a real cinematic dissolve into the type composition.
  const imageBand = imageUrl
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.heroBackdrop};">`
      + `<tr><td style="font-size:0;line-height:0;background-color:${COLOR.bg.heroBackdrop};">`
      + `<img src="${esc(imageUrl)}" alt="${esc(imageAlt ?? "")}" width="${WIDTH.hero}" style="display:block;width:100%;max-width:${WIDTH.hero}px;height:auto;border:0;outline:none;text-decoration:none;" />`
      + `</td></tr>`
      + `<tr><td style="font-size:0;line-height:0;height:32px;background-color:${COLOR.bg.heroBackdrop};background-image:${HERO_BLEND_GRADIENT};">&nbsp;</td></tr>`
      + `</table>`
    : "";

  const eyebrowHtml = eyebrow
    ? `<div style="font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:${COLOR.brand.cyan};padding-bottom:${SPACE.s5};text-align:${align};" class="email-text-accent">${esc(eyebrow)}</div>`
    : "";
  const accentHtml = accentWord
    ? `<span style="color:${COLOR.brand.cyan};" class="email-text-accent">&nbsp;${esc(accentWord)}</span>`
    : "";
  const subtitleHtml = subtitle
    ? `<div style="${typeStyle("bodyLg", COLOR.text.secondary)}padding-top:${SPACE.s5};text-align:${align};max-width:520px;margin-left:auto;margin-right:auto;" class="email-text-secondary">${esc(subtitle)}</div>`
    : "";
  const trailingMetaHtml = trailingMeta
    ? `<div style="${typeStyle("microSm", COLOR.text.tertiary)}text-transform:uppercase;padding-top:${SPACE.s6};text-align:${align};" class="email-text-tertiary">${esc(trailingMeta)}</div>`
    : "";
  // Cinematic halo bar above eyebrow — editorial framing.
  const haloBar = `<div style="width:56px;height:2px;background-color:${COLOR.brand.cyan};background-image:${ACCENT_RULE_GRADIENT};margin:0 auto ${SPACE.s5};font-size:0;line-height:2px;">&nbsp;</div>`;

  // Type band — gradient bg, generous vertical padding for cinematic
  // breathing room. Image band sits above; both share the same #000000
  // backdrop so they read as one composition.
  //
  // Top padding is RHYTHM-AWARE: when an image precedes the type band, the
  // image's own fade-to-black + the 32px blend strip already supply the
  // breathing room — so we tighten the top pad (s7) to bring the headline
  // up into the cinematic moment. Type-only heroes keep the full s10 ceiling.
  const typeTopPad = imageUrl ? SPACE.s7 : SPACE.s10;
  return imageBand
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.heroBackdrop};background-image:${HERO_GRADIENT};">`
    + `<tr><td class="email-pad email-hero-pad" align="${align}" style="padding:${typeTopPad} ${SPACE.s7} ${SPACE.s9};text-align:${align};">`
    + haloBar
    + eyebrowHtml
    + `<h1 class="email-display-xl email-text-primary" style="${typeStyle("displayXl", COLOR.text.primary)}text-align:${align};text-transform:uppercase;">${esc(title)}${accentHtml}</h1>`
    + subtitleHtml
    + trailingMetaHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// HUD Card — layered, art-directed surface.
//
// Composition (cinematic v2):
//   - 2px cyan accent rule across the top (gradient-faded)
//   - Optional header strip: chip label on cyan-washed bg
//   - Body content area (padded, gradient HUD surface)
//   - 18px radius (luxury HUD shape)
//   - Outer cyan glow + inner highlight (degrades cleanly in Outlook)
// ────────────────────────────────────────────────────────────────────────

export interface CardOptions {
  children: string;
  /** "default" = HUD card. "raised" = deeper panel for nested HUD blocks. */
  variant?: "default" | "raised";
  /**
   * Optional header chip label — sits above the body in a cyan-washed
   * strip. Use for primary cards to introduce the section visually.
   */
  headerLabel?: string;
}

export function card({ children, variant = "default", headerLabel }: CardOptions): string {
  const surfaceClass = variant === "raised" ? "email-surface-raised" : "email-surface";
  const bg = variant === "raised" ? COLOR.bg.surfaceRaised : COLOR.bg.surface;
  const radius = variant === "raised" ? RADIUS.xl : RADIUS.lg;

  // Top accent rule — 2px cyan-faded bar, full width, sits flush with the
  // card's rounded top edge. Decorative editorial framing.
  const topAccent = `<tr><td style="font-size:0;line-height:0;height:2px;background-color:${COLOR.brand.cyan};background-image:${ACCENT_RULE_GRADIENT};border-top-left-radius:${radius};border-top-right-radius:${radius};">&nbsp;</td></tr>`;

  // Optional header chip strip — uppercase tracked label on cyan wash.
  // The chip itself uses data-flip-padding-left for clean RTL mirroring.
  const headerStrip = headerLabel
    ? `<tr><td style="background-color:${COLOR.bg.surfaceHeader};background-image:${CARD_HEADER_GRADIENT};padding:${SPACE.s4} ${SPACE.s6};border-bottom:1px solid ${COLOR.border.cyanSoft};" data-flip-padding-left="cardHeader">`
      + `<div style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;" class="email-text-accent">${esc(headerLabel)}</div>`
      + `</td></tr>`
    : "";

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="${surfaceClass}" style="background-color:${bg};background-image:${CARD_GRADIENT};border:1px solid ${COLOR.border.cyan};border-radius:${radius};box-shadow:${GLOW.card},${GLOW.innerHighlight};">`
    + topAccent
    + headerStrip
    + `<tr><td class="email-pad" style="padding:${SPACE.s7} ${SPACE.s6};">`
    + children
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Section eyebrow — divider with centered tracked label.
// Use to introduce a new visual section inside a builder for rhythm
// (e.g. "WHAT'S NEXT", "YOUR PROGRESS", "ECOSYSTEM").
// ────────────────────────────────────────────────────────────────────────

export function sectionEyebrow({ label }: { label: string }): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr>`
    + `<td width="40%" style="font-size:0;line-height:0;height:1px;background-color:${COLOR.border.divider};">&nbsp;</td>`
    + `<td align="center" style="padding:0 ${SPACE.s4};white-space:nowrap;">`
    + `<div style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;" class="email-text-accent">${esc(label)}</div>`
    + `</td>`
    + `<td width="40%" style="font-size:0;line-height:0;height:1px;background-color:${COLOR.border.divider};">&nbsp;</td>`
    + `</tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Pull quote — atmospheric statement, milestone moments only.
// Use sparingly: welcome, package-completed, transformation moments.
// ────────────────────────────────────────────────────────────────────────

export function pullQuote({ text, attribution }: { text: string; attribution?: string }): string {
  const attribHtml = attribution
    ? `<div style="${typeStyle("microSm", COLOR.text.tertiary)}text-transform:uppercase;padding-top:${SPACE.s5};" class="email-text-tertiary">— ${esc(attribution)}</div>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td style="padding:${SPACE.s5} 0;">`
    // Opening cyan mark — atmospheric editorial opening.
    + `<div style="font-size:48px;line-height:1;color:${COLOR.brand.cyan};font-weight:700;padding-bottom:${SPACE.s2};" class="email-text-accent">&ldquo;</div>`
    + `<div style="${typeStyle("pullQuote", COLOR.text.primary)}font-style:italic;" class="email-text-primary">${esc(text)}</div>`
    + attribHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Typography primitives.
// ────────────────────────────────────────────────────────────────────────

export interface HeadingOptions {
  level: 1 | 2 | 3;
  text: string;
  align?: Align;
  color?: TextColor;
}

export function heading({ level, text, align = "left", color = "primary" }: HeadingOptions): string {
  const typeKey: TypeKey = level === 1 ? "h1" : level === 2 ? "h2" : "h3";
  const tag = `h${level}`;
  return `<${tag} style="${typeStyle(typeKey, colorOf(color))}text-align:${align};" class="${TEXT_COLOR_CLASS[color]}">${esc(text)}</${tag}>`;
}

export interface TextBlockOptions {
  text: string;
  size?: "body" | "bodyLg" | "bodySm" | "caption";
  color?: TextColor;
  align?: Align;
  /** Set to true to allow inline <strong>/<a> tags from caller (already escaped). */
  raw?: boolean;
}

export function textBlock({
  text,
  size = "body",
  color = "secondary",
  align = "left",
  raw = false,
}: TextBlockOptions): string {
  const inner = raw ? text : esc(text);
  return `<p style="${typeStyle(size, colorOf(color))}text-align:${align};" class="${TEXT_COLOR_CLASS[color]}">${inner}</p>`;
}

// ────────────────────────────────────────────────────────────────────────
// Spacer & divider — explicit rhythm primitives.
// ────────────────────────────────────────────────────────────────────────

export type SpaceKey = keyof typeof SPACE;

export function spacer(size: SpaceKey = "s4"): string {
  return `<div style="line-height:${SPACE[size]};height:${SPACE[size]};font-size:1px;mso-line-height-rule:exactly;">&nbsp;</div>`;
}

export function divider(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-divider" style="font-size:0;line-height:0;border-top:1px solid ${COLOR.border.divider};">&nbsp;</td></tr>`
    + `</table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Severity banner — restrained accent line, dark glass tint.
// The ONLY way to communicate severity context.
// ────────────────────────────────────────────────────────────────────────

export interface SeverityBannerOptions {
  severity: Severity;
  title: string;
  body?: string;
}

export function severityBanner({ severity, title, body }: SeverityBannerOptions): string {
  const sev = SEVERITY[severity];
  const tintClass = `email-sev-${severity}-tint`;
  const accentClass = `email-sev-${severity}-accent`;
  const bodyHtml = body
    ? `<div dir="auto" style="${typeStyle("bodySm", COLOR.text.secondary)}padding-top:${SPACE.s2};" class="email-text-secondary">${esc(body)}</div>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="${tintClass}" style="background-color:${sev.tint};border:1px solid ${sev.border};border-radius:${RADIUS.md};">`
    + `<tr><td style="padding:${SPACE.s5} ${SPACE.s5};border-left:3px solid ${sev.accent};" data-flip-padding-left="severity">`
    + `<div style="${typeStyle("micro", sev.accent)}text-transform:uppercase;" class="${accentClass}">${esc(sev.label)}</div>`
    + `<div style="${typeStyle("h3", COLOR.text.primary)}padding-top:${SPACE.s2};" class="email-text-primary">${esc(title)}</div>`
    + bodyHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// CTA button — premium product-design billboard treatment.
//
// Cinematic v2 specs: 18px font, 22/40px padding, 0.2em tracking,
// gradient bg (cyanSoft → cyan → cyanDeep), 2px cyan halo above, glow
// shadow. Outlook desktop strips the gradient + glow but still shows a
// solid cyan high-contrast button — graceful degradation.
//
// Outlook VML is CONTAINED here. Callers never see MSO/VML.
// ────────────────────────────────────────────────────────────────────────

export interface CtaButtonOptions {
  href: string;
  label: string;
  /** "brand" = cinematic cyan (default). Severity variants for action-on-context. */
  variant?: "brand" | Severity;
}

export function ctaButton({ href, label, variant = "brand" }: CtaButtonOptions): string {
  const safeHref = esc(href);
  const safeLabel = esc(label);
  const bg = variant === "brand" ? COLOR.brand.cyan : SEVERITY[variant].accent;
  const bgGradient = variant === "brand" ? CTA_GRADIENT : `linear-gradient(180deg, ${SEVERITY[variant].accent} 0%, ${SEVERITY[variant].accent} 100%)`;
  const textColor = COLOR.text.onAccent;
  const ctaClass = variant === "brand" ? "email-cta-brand" : `email-cta-${variant}`;
  // Outlook VML — contained internal hack so callers never see MSO/VML.
  const vml = [
    `<!--[if mso]>`,
    `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:60px;v-text-anchor:middle;width:300px;" arcsize="20%" stroke="f" fillcolor="${bg}">`,
    `<w:anchorlock/>`,
    `<center style="color:${textColor};font-family:Arial,sans-serif;font-size:14px;font-weight:800;letter-spacing:0.18em;text-transform:uppercase;">${safeLabel}</center>`,
    `</v:roundrect>`,
    `<![endif]-->`,
  ].join("");
  const html = [
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">`,
    `<tr><td class="email-cta-cell" align="center" style="border-radius:${RADIUS.md};background-color:${bg};background-image:${bgGradient};box-shadow:${GLOW.cta};">`,
    vml,
    `<!--[if !mso]><!-- -->`,
    `<a href="${safeHref}" target="_blank" rel="noopener" class="${ctaClass}" style="display:inline-block;padding:22px 40px;font-family:inherit;font-size:14px;line-height:1;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:${textColor};text-decoration:none;border-radius:${RADIUS.md};background-color:${bg};background-image:${bgGradient};mso-hide:all;">${safeLabel}</a>`,
    `<!--<![endif]-->`,
    `</td></tr></table>`,
  ].join("");
  return html;
}

/** Secondary action — text link only. Rule: max one per email. */
export function ctaTextLink({ href, label }: { href: string; label: string }): string {
  return `<a href="${esc(href)}" target="_blank" rel="noopener" style="font-size:12px;line-height:1.5;font-weight:700;letter-spacing:0.18em;text-transform:uppercase;color:${COLOR.brand.cyan};text-decoration:none;" class="email-text-accent">${esc(label)} →</a>`;
}

// ────────────────────────────────────────────────────────────────────────
// CTA Section — billboard wrapper around a CTA button.
//
// Creates atmospheric framing that reads as a deliberate "moment of
// action" rather than a button stuck at the end of a card. Composition:
//   - Eyebrow tag above (cyan tracked, optional)
//   - The CTA button itself (passed in as pre-rendered HTML)
//   - Supporting microcopy below (optional, tertiary)
//
// Wraps in a dark gradient section with subtle cyan top accent rule
// so the CTA reads as a designed billboard, not an afterthought.
// ────────────────────────────────────────────────────────────────────────

export interface CtaSectionOptions {
  eyebrow?: string;
  ctaHtml: string;          // Pre-rendered ctaButton output
  supportingText?: string;
  supportingLink?: { href: string; label: string };
}

export function ctaSection({ eyebrow, ctaHtml, supportingText, supportingLink }: CtaSectionOptions): string {
  const eyebrowHtml = eyebrow
    ? `<div style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;text-align:center;padding-bottom:${SPACE.s5};" class="email-text-accent">${esc(eyebrow)}</div>`
    : "";
  const supportingHtml = supportingText
    ? `<div style="${typeStyle("bodySm", COLOR.text.tertiary)}text-align:center;padding-top:${SPACE.s5};" class="email-text-tertiary">${esc(supportingText)}</div>`
    : "";
  const linkHtml = supportingLink
    ? `<div style="text-align:center;padding-top:${SPACE.s4};">${ctaTextLink(supportingLink)}</div>`
    : "";
  // Cinematic halo bar — editorial framing above the eyebrow. Matches the
  // hero halo (56px × 2px) so CTA moments share the brand grammar of the
  // hero — billboard rhythm, not a different language.
  const haloBar = `<div style="width:56px;height:2px;background-color:${COLOR.brand.cyan};background-image:${ACCENT_RULE_GRADIENT};margin:0 auto ${SPACE.s6};font-size:0;line-height:2px;">&nbsp;</div>`;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.ctaSection};background-image:${CTA_SECTION_GRADIENT};border-top:1px solid ${COLOR.border.cyanSoft};border-bottom:1px solid ${COLOR.border.cyanSoft};">`
    + `<tr><td class="email-cta-section-pad" align="center" style="padding:${SPACE.s10} ${SPACE.s7};text-align:center;">`
    + haloBar
    + eyebrowHtml
    + ctaHtml
    + supportingHtml
    + linkHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Key-value list — booking details, package details, ops metadata.
// Mobile-safe (single column always — no 2-col gymnastics on phones).
//
// Cinematic treatment: cyan uppercase micro labels above white values,
// hairline divider between rows for HUD-grid feel.
// ────────────────────────────────────────────────────────────────────────

export interface KeyValueListOptions {
  items: Array<{ label: string; value: string | null | undefined }>;
}

export function keyValueList({ items }: KeyValueListOptions): string {
  const filtered = items.filter((it) => it.value !== null && it.value !== undefined && String(it.value).trim() !== "");
  if (!filtered.length) return "";
  const rows = filtered
    .map((it, i) => {
      const top = i === 0 ? "0" : SPACE.s4;
      const borderTop = i === 0 ? "" : `border-top:1px solid ${COLOR.border.divider};`;
      const innerPadTop = i === 0 ? "0" : SPACE.s4;
      // dir="auto" on the value lets mixed-content (phones, times, English
      // package names) render correctly inside RTL documents.
      return `<tr><td style="padding-top:${top};${borderTop}">`
        + `<div style="padding-top:${innerPadTop};">`
        + `<div style="${typeStyle("micro", COLOR.brand.cyanMuted)}text-transform:uppercase;" class="email-text-accent">${esc(it.label)}</div>`
        + `<div dir="auto" style="${typeStyle("body", COLOR.text.primary)}padding-top:6px;font-weight:500;" class="email-text-primary">${esc(it.value as string)}</div>`
        + `</div>`
        + `</td></tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Metric grid — 2-up on desktop, stacks on mobile.
// HUD-tile treatment: each metric is a mini-panel with cyan label + large
// metric value, aligned to grid rhythm.
// ────────────────────────────────────────────────────────────────────────

export interface MetricGridOptions {
  items: Array<{ label: string; value: string }>;
}

export function metricGrid({ items }: MetricGridOptions): string {
  if (!items.length) return "";
  const rows: Array<typeof items> = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  const html = rows
    .map((pair, ri) => {
      const topGap = ri === 0 ? "0" : SPACE.s4;
      const cells = pair
        .map((it, ci) => {
          const padLeft = ci === 0 ? "0" : SPACE.s3;
          return `<td valign="top" width="50%" style="padding-left:${padLeft};padding-top:${topGap};">`
            + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.secondary};border:1px solid ${COLOR.border.cyanSoft};border-radius:${RADIUS.md};">`
            + `<tr><td style="font-size:0;line-height:0;height:2px;background-color:${COLOR.brand.cyan};background-image:${ACCENT_RULE_GRADIENT};border-top-left-radius:${RADIUS.md};border-top-right-radius:${RADIUS.md};">&nbsp;</td></tr>`
            + `<tr><td style="padding:${SPACE.s5} ${SPACE.s5};">`
            + `<div style="${typeStyle("micro", COLOR.brand.cyanMuted)}text-transform:uppercase;" class="email-text-accent">${esc(it.label)}</div>`
            + `<div dir="auto" style="${typeStyle("metric", COLOR.text.primary)}padding-top:${SPACE.s2};" class="email-text-primary">${esc(it.value)}</div>`
            + `</td></tr></table>`
            + `</td>`;
        })
        .join("");
      // Pad orphan cell so grid stays balanced on desktop.
      const padding = pair.length === 1 ? `<td width="50%" style="padding-top:${topGap};">&nbsp;</td>` : "";
      return `<tr class="email-stack-2col">${cells}${padding}</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${html}</table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Atmospheric Footer — luxury ecosystem closing.
//
// Composition (cinematic v2):
//   - Trainer signature lockup (name + role)
//   - Cyan halo divider
//   - Contact lockup (3 rows: WhatsApp, Email, Studio) with cyan glyphs
//   - Brand wordmark + tagline
//   - Legal microcopy (support / unsubscribe / manage links)
//
// Sits inside its own dark gradient band with hairline top divider so
// it reads as part of the world, not generic legal text.
// ────────────────────────────────────────────────────────────────────────

export interface FooterOptions {
  lang: Lang;
  supportEmail: string;
  unsubscribeUrl?: string;
  manageUrl?: string;
  /** Optional WhatsApp deep-link for the contact lockup. */
  whatsappUrl?: string;
  /** Optional studio location string for the contact lockup. */
  studioLocation?: string;
}

export function footer({ lang, supportEmail, unsubscribeUrl, manageUrl, whatsappUrl, studioLocation }: FooterOptions): string {
  const isAr = lang === "ar";
  const supportLabel = isAr ? "الدعم" : "Support";
  const unsubLabel = isAr ? "إلغاء الاشتراك" : "Unsubscribe";
  const manageLabel = isAr ? "إدارة الإشعارات" : "Manage notifications";
  const tagline = isAr
    ? "تدريب شخصي متميز · دبي"
    : "ELITE PERSONAL TRAINING · DUBAI";
  const trainerLine = isAr
    ? "المدرب يوسف أحمد"
    : "COACH YOUSSEF AHMED";
  const trainerRole = isAr
    ? "مدرب شخصي معتمد"
    : "CERTIFIED PERSONAL TRAINER";
  const reachLabel = isAr ? "للتواصل" : "REACH OUT";
  const whatsappLabel = isAr ? "واتساب" : "WhatsApp";
  const emailLabel = isAr ? "البريد الإلكتروني" : "Email";
  const studioLabelText = isAr ? "الاستوديو" : "Studio";

  // Contact rows — only render when caller supplies the data. Email is
  // always present (already required by the API).
  const contactRows: string[] = [];
  if (whatsappUrl) {
    contactRows.push(
      `<tr><td style="padding:${SPACE.s2} 0;">`
      + `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;"><tr>`
      + `<td valign="middle" style="padding-right:${SPACE.s3};" data-flip-padding-right="contactGlyph">`
      + `<div style="width:6px;height:6px;border-radius:50%;background-color:${COLOR.brand.cyan};font-size:0;line-height:6px;">&nbsp;</div>`
      + `</td>`
      + `<td valign="middle" style="${typeStyle("microSm", COLOR.text.tertiary)}text-transform:uppercase;text-align:left;" data-flip-padding-left="contactRow">`
      + `<a href="${esc(whatsappUrl)}" style="color:${COLOR.text.tertiary};text-decoration:none;">${whatsappLabel} ↗</a>`
      + `</td>`
      + `</tr></table>`
      + `</td></tr>`
    );
  }
  contactRows.push(
    `<tr><td style="padding:${SPACE.s2} 0;">`
    + `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;"><tr>`
    + `<td valign="middle" style="padding-right:${SPACE.s3};" data-flip-padding-right="contactGlyph">`
    + `<div style="width:6px;height:6px;border-radius:50%;background-color:${COLOR.brand.cyan};font-size:0;line-height:6px;">&nbsp;</div>`
    + `</td>`
    + `<td valign="middle" style="${typeStyle("microSm", COLOR.text.tertiary)}text-transform:uppercase;text-align:left;" data-flip-padding-left="contactRow">`
    + `<a href="mailto:${esc(supportEmail)}" style="color:${COLOR.text.tertiary};text-decoration:none;">${emailLabel} · ${esc(supportEmail)}</a>`
    + `</td>`
    + `</tr></table>`
    + `</td></tr>`
  );
  if (studioLocation) {
    contactRows.push(
      `<tr><td style="padding:${SPACE.s2} 0;">`
      + `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 auto;"><tr>`
      + `<td valign="middle" style="padding-right:${SPACE.s3};" data-flip-padding-right="contactGlyph">`
      + `<div style="width:6px;height:6px;border-radius:50%;background-color:${COLOR.brand.cyan};font-size:0;line-height:6px;">&nbsp;</div>`
      + `</td>`
      + `<td valign="middle" style="${typeStyle("microSm", COLOR.text.tertiary)}text-transform:uppercase;text-align:left;" data-flip-padding-left="contactRow">`
      + `${studioLabelText} · ${esc(studioLocation)}`
      + `</td>`
      + `</tr></table>`
      + `</td></tr>`
    );
  }

  const legalLinks: string[] = [
    `<a href="mailto:${esc(supportEmail)}" style="color:${COLOR.text.tertiary};text-decoration:none;border-bottom:1px solid ${COLOR.border.divider};padding-bottom:1px;">${supportLabel}</a>`,
  ];
  if (manageUrl) {
    legalLinks.push(`<a href="${esc(manageUrl)}" style="color:${COLOR.text.tertiary};text-decoration:none;border-bottom:1px solid ${COLOR.border.divider};padding-bottom:1px;">${manageLabel}</a>`);
  }
  if (unsubscribeUrl) {
    legalLinks.push(`<a href="${esc(unsubscribeUrl)}" style="color:${COLOR.text.tertiary};text-decoration:none;border-bottom:1px solid ${COLOR.border.divider};padding-bottom:1px;">${unsubLabel}</a>`);
  }

  // Cinematic halo bar — editorial framing.
  const haloBar = `<div style="width:48px;height:1px;background-color:${COLOR.brand.cyan};background-image:${ACCENT_RULE_GRADIENT};margin:0 auto ${SPACE.s5};font-size:0;line-height:1px;">&nbsp;</div>`;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.footer};background-image:${FOOTER_GRADIENT};">`
    + `<tr><td class="email-pad" align="center" style="padding:${SPACE.s9} ${SPACE.s7} ${SPACE.s10};">`
    // Trainer signature lockup
    + haloBar
    + `<div style="${typeStyle("h3", COLOR.text.primary)}text-align:center;letter-spacing:0.16em;text-transform:uppercase;" class="email-text-primary">${esc(trainerLine)}</div>`
    + `<div style="${typeStyle("microSm", COLOR.text.tertiary)}text-align:center;text-transform:uppercase;padding-top:${SPACE.s2};" class="email-text-tertiary">${esc(trainerRole)}</div>`
    // Hairline scratch divider
    + `<div style="height:1px;line-height:1px;font-size:0;background-color:${COLOR.border.hairline};margin:${SPACE.s7} 0 ${SPACE.s6};">&nbsp;</div>`
    // Reach-out section eyebrow
    + `<div style="${typeStyle("micro", COLOR.brand.cyan)}text-align:center;text-transform:uppercase;padding-bottom:${SPACE.s4};" class="email-text-accent">${esc(reachLabel)}</div>`
    // Contact lockup
    + `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">`
    + contactRows.join("")
    + `</table>`
    // Spacer
    + `<div style="height:${SPACE.s7};line-height:${SPACE.s7};font-size:0;">&nbsp;</div>`
    // Brand wordmark + tagline
    + `<div style="font-family:inherit;font-size:11px;line-height:1;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:${COLOR.brand.cyanMuted};" class="email-text-accent">YOUSSEF AHMED</div>`
    + `<div style="${typeStyle("microSm", COLOR.text.tertiary)}text-align:center;text-transform:uppercase;padding-top:${SPACE.s2};" class="email-text-tertiary">${esc(tagline)}</div>`
    // Legal microcopy
    + `<div style="font-size:11px;line-height:1.6;color:${COLOR.text.tertiary};text-align:center;padding-top:${SPACE.s5};" class="email-text-tertiary">${legalLinks.join(" &nbsp;·&nbsp; ")}</div>`
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Section wrapper — applies horizontal page padding consistently.
// Use for any block that should sit flush to canvas edges on mobile.
// ────────────────────────────────────────────────────────────────────────

export function section(children: string, opts?: { topGap?: SpaceKey }): string {
  const top = opts?.topGap ? SPACE[opts.topGap] : SPACE.s5;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-pad" style="padding:${top} ${SPACE.s7} 0;">${children}</td></tr>`
    + `</table>`;
}
