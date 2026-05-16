/**
 * Email primitives — YOUSSEF AHMED ELITE editorial engine v3.
 *
 * COMPLETE VISUAL REBUILD. Every primitive's internal HTML has been
 * re-architected to read as the masthead of a quarterly elite-coaching
 * dossier — magazine grammar, viewfinder HUD chrome, sophisticated glow.
 *
 * Public API (function signatures + named exports) is preserved so all
 * 7 builders work untouched. Only the rendered HTML language changed.
 *
 * New visual grammar:
 *   - Editorial №-numbered eyebrows (masthead numerals)
 *   - HUD corner brackets at all 4 corners of every card (cyan viewfinder)
 *   - Asymmetric section dividers (numeral + rule running off-edge)
 *   - 72px display headlines, weight 900, ultra-tight tracking
 *   - Dual-layer CTA: cyan halo ring frame + gradient pill core
 *   - 3-column editorial footer masthead
 *   - Severity ribbon (corner-tab badge), not full panel border
 *   - KeyValueList as 2-column HUD grid with vertical hairline
 *   - Pull quote: 30px italic with cyan opening glyph + thick rule
 *   - Vignette canvas + radial cyan halos behind hero
 *
 * Hard contract:
 *   1. Every visual value resolves through tokens.ts.
 *   2. Outlook hacks (VML, MSO conditionals) are CONTAINED inside the
 *      single primitive that needs them (ctaButton).
 *   3. Each primitive owns ONE responsibility.
 *   4. APIs are rigid — visual stability wins over flexibility.
 *   5. Every primitive is table-based, inline-styled, and degrades
 *      gracefully when images, webfonts, glow, or gradients are stripped.
 *   6. Hero photography is OPTIONAL — type band carries the headline.
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

/** HUD corner bracket — small cyan L-shape that sits in card corners. */
function cornerBracket(corner: "tl" | "tr" | "bl" | "br"): string {
  const sz = 14;
  const th = 1;
  const inset = 10;
  const isTop = corner === "tl" || corner === "tr";
  const isLeft = corner === "tl" || corner === "bl";
  const top = isTop ? `top:${inset}px;` : `bottom:${inset}px;`;
  const side = isLeft ? `left:${inset}px;` : `right:${inset}px;`;
  // Use absolute container with two thin lines (horizontal + vertical).
  // Many email clients drop position:absolute — we keep it as a graceful
  // decorative enhancement (its absence does not break layout).
  return `<div style="position:absolute;${top}${side}width:${sz}px;height:${sz}px;pointer-events:none;">`
    + `<div style="position:absolute;${isTop ? "top:0" : "bottom:0"};left:0;right:0;height:${th}px;background-color:${COLOR.brand.cyanDeep};">&nbsp;</div>`
    + `<div style="position:absolute;${isLeft ? "left:0" : "right:0"};top:0;bottom:0;width:${th}px;background-color:${COLOR.brand.cyanDeep};">&nbsp;</div>`
    + `</div>`;
}

// ────────────────────────────────────────────────────────────────────────
// Shell — locked dark canvas, vignette wash.
// ────────────────────────────────────────────────────────────────────────

export interface ShellOptions {
  lang: Lang;
  preheader: string;
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
    `<meta name="color-scheme" content="dark only">`,
    `<meta name="supported-color-schemes" content="dark only">`,
    `<title></title>`,
    `<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->`,
    `<style type="text/css">`,
    `:root { color-scheme: dark; supported-color-schemes: dark; }`,
    // Editorial mobile cliff — Samsung Internet, Gmail iOS, Gmail Android.
    `@media only screen and (max-width:600px){`,
    `.email-shell{width:100% !important;}`,
    // Generous canvas-edge gutter on mobile.
    `.email-pad{padding-left:24px !important;padding-right:24px !important;}`,
    `.email-pad-tight{padding-left:18px !important;padding-right:18px !important;}`,
    // Card interior gets a slightly tighter gutter — keeps content room.
    `.email-card-pad{padding:36px 24px !important;}`,
    // CTA — full-width touch target, large luxury padding.
    `.email-cta-cell a{display:block !important;width:auto !important;padding:24px 32px !important;font-size:14px !important;letter-spacing:0.26em !important;}`,
    // 2-col grid stacks.
    `.email-stack-2col>td{display:block !important;width:100% !important;}`,
    `.email-stack-2col>td+td{padding-top:24px !important;padding-left:0 !important;border-left:0 !important;}`,
    // Display headline mobile cliff.
    `.email-display-xl{font-size:${TYPE.displayXlMobile.size} !important;line-height:${TYPE.displayXlMobile.lh} !important;letter-spacing:${TYPE.displayXlMobile.tracking} !important;}`,
    `.email-display{font-size:${TYPE.displayMobile.size} !important;line-height:${TYPE.displayMobile.lh} !important;}`,
    // Body type mobile cliff (Gmail iOS doesn't auto-scale inline px).
    `.email-body-lg{font-size:18px !important;line-height:1.6 !important;}`,
    `.email-body{font-size:16px !important;line-height:1.7 !important;}`,
    `.email-h1{font-size:26px !important;line-height:1.2 !important;}`,
    `.email-pull-quote{font-size:22px !important;line-height:1.35 !important;}`,
    // Hero pad mobile — cinema breathing.
    `.email-hero-pad{padding:48px 24px 56px !important;}`,
    // Brand header pad mobile.
    `.email-brand-pad{padding:48px 24px 12px !important;}`,
    // CTA section pad mobile.
    `.email-cta-section-pad{padding:80px 24px !important;}`,
    // KV grid — collapse the vertical rule on stacked rows.
    `.email-kv-rule{display:none !important;}`,
    // Footer 3-col masthead stacks.
    `.email-footer-col{display:block !important;width:100% !important;text-align:center !important;padding:18px 0 !important;border-left:0 !important;}`,
    `}`,
    `a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}`,
    `table { border-collapse: collapse; }`,
    `img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }`,
    `</style>`,
    `<!-- DARK_MODE_OVERRIDES -->`,
    `</head>`,
    `<body style="margin:0;padding:0;background-color:${COLOR.bg.canvas};font-family:${family};color:${COLOR.text.primary};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;" class="email-canvas">`,
    `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:transparent;">${esc(preheader)}</div>`,
    // Outer canvas with vignette wash.
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.canvas};background-image:linear-gradient(180deg, ${COLOR.bg.canvasTop} 0%, ${COLOR.bg.canvasBottom} 100%);" class="email-canvas">`,
    `<tr><td align="center" style="padding:${SPACE.s8} 0;">`,
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
// Brand header — editorial 3-line masthead.
//   line 1: thin cyan ▔ rule (40px, centered)
//   line 2: WORDMARK (white, tracked)
//   line 3: division eyebrow ─ cyan (left) │ ELITE PT (white) │ DUBAI cyan (right)
// Reads as a magazine masthead, not a centered logo blob.
// ────────────────────────────────────────────────────────────────────────

export function brandHeader(): string {
  const ruleTop = `<div style="width:32px;height:1px;background-color:${COLOR.brand.cyan};margin:0 auto ${SPACE.s5};font-size:0;line-height:1px;">&nbsp;</div>`;
  const wordmark = `<div style="font-family:inherit;font-size:13px;line-height:1;font-weight:800;letter-spacing:0.42em;text-transform:uppercase;color:${COLOR.text.primary};" class="email-text-primary">YOUSSEF&nbsp;&nbsp;AHMED</div>`;
  const masthead = `<div style="font-family:inherit;font-size:9px;line-height:1;font-weight:700;letter-spacing:0.5em;text-transform:uppercase;color:${COLOR.text.tertiary};padding-top:14px;" class="email-text-tertiary">`
    + `<span style="color:${COLOR.brand.cyan};" class="email-text-accent">№</span>`
    + ` &nbsp;ELITE PERSONAL TRAINING&nbsp; `
    + `<span style="color:${COLOR.brand.cyan};" class="email-text-accent">DUBAI</span>`
    + `</div>`;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-pad email-brand-pad" align="center" style="padding:${SPACE.s9} ${SPACE.s8} ${SPACE.s3};">`
    + ruleTop
    + wordmark
    + masthead
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Cinematic Hero — editorial cover page.
//
// Composition (v3):
//   - Optional cinematic image band (full-width photo, fade-to-black bottom).
//   - Type band: pure-black backdrop with vignette gradient.
//       · Horizontal cyan hairline (aligned with halo bar)
//       · Editorial №-numbered eyebrow on its own line (cyan)
//       · MASSIVE display headline (72px / 48px mobile, weight 900)
//       · Optional cyan accent word
//       · Optional subtitle (constrained, secondary text)
//       · Optional trailing meta lockup
// ────────────────────────────────────────────────────────────────────────

export interface HeroOptions {
  eyebrow?: string;
  title: string;
  accentWord?: string;
  subtitle?: string;
  trailingMeta?: string;
  imageUrl?: string | null;
  imageAlt?: string;
  align?: Align;
}

export function hero({ eyebrow, title, accentWord, subtitle, trailingMeta, imageUrl, imageAlt, align = "center" }: HeroOptions): string {
  // Image band — pixel-clean, fades into type band via blend strip.
  const imageBand = imageUrl
    ? `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.heroBackdrop};">`
      + `<tr><td style="font-size:0;line-height:0;background-color:${COLOR.bg.heroBackdrop};">`
      + `<img src="${esc(imageUrl)}" alt="${esc(imageAlt ?? "")}" width="${WIDTH.hero}" style="display:block;width:100%;max-width:${WIDTH.hero}px;height:auto;border:0;outline:none;text-decoration:none;" />`
      + `</td></tr>`
      + `<tr><td style="font-size:0;line-height:0;height:48px;background-color:${COLOR.bg.heroBackdrop};background-image:${HERO_BLEND_GRADIENT};">&nbsp;</td></tr>`
      + `</table>`
    : "";

  // Editorial №-numbered eyebrow lockup. Pattern:
  //   ─── № YOUR NEXT SESSION ───
  // The cyan hairline + cyan № glyph give the eyebrow magazine
  // grammar instead of a generic uppercase tag.
  const eyebrowHtml = eyebrow
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto ${SPACE.s7};">`
      + `<tr>`
      + `<td valign="middle" style="padding-right:${SPACE.s4};">`
      + `<div style="width:36px;height:1px;background-color:${COLOR.brand.cyan};font-size:0;line-height:1px;">&nbsp;</div>`
      + `</td>`
      + `<td valign="middle" style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;white-space:nowrap;" class="email-text-accent">`
      + `<span style="color:${COLOR.brand.cyan};" class="email-text-accent">№ </span>${esc(eyebrow)}`
      + `</td>`
      + `<td valign="middle" style="padding-left:${SPACE.s4};">`
      + `<div style="width:36px;height:1px;background-color:${COLOR.brand.cyan};font-size:0;line-height:1px;">&nbsp;</div>`
      + `</td>`
      + `</tr></table>`
    : "";

  // Accent word — cyan emphasis, on its own visual line via &nbsp;.
  const accentHtml = accentWord
    ? `<span style="color:${COLOR.brand.cyan};padding-left:0.12em;" class="email-text-accent">&nbsp;${esc(accentWord)}</span>`
    : "";

  const subtitleHtml = subtitle
    ? `<div style="${typeStyle("bodyLg", COLOR.text.secondary)}padding-top:${SPACE.s7};text-align:${align};max-width:480px;margin-left:auto;margin-right:auto;" class="email-text-secondary email-body-lg">${esc(subtitle)}</div>`
    : "";

  // Trailing meta lockup — split with a thin cyan diamond for editorial
  // rhythm (e.g. "SAT, 17 MAY 2026  ◆  10:00 AM").
  const trailingMetaHtml = trailingMeta
    ? `<div style="${typeStyle("microSm", COLOR.text.tertiary)}text-transform:uppercase;padding-top:${SPACE.s8};text-align:${align};" class="email-text-tertiary">`
      + `<span style="color:${COLOR.brand.cyan};" class="email-text-accent">◆</span> ${esc(trailingMeta)} <span style="color:${COLOR.brand.cyan};" class="email-text-accent">◆</span>`
      + `</div>`
    : "";

  // Top pad: tighter when image precedes (image+blend strip already supplied
  // breathing room), full s12 when type-only (cover-page proportions).
  const typeTopPad = imageUrl ? SPACE.s8 : SPACE.s12;

  return imageBand
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.heroBackdrop};background-image:${HERO_GRADIENT};">`
    + `<tr><td class="email-pad email-hero-pad" align="${align}" style="padding:${typeTopPad} ${SPACE.s8} ${SPACE.s11};text-align:${align};">`
    + eyebrowHtml
    + `<h1 class="email-display-xl email-text-primary" style="${typeStyle("displayXl", COLOR.text.primary)}text-align:${align};text-transform:uppercase;">${esc(title)}${accentHtml}</h1>`
    + subtitleHtml
    + trailingMetaHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// HUD Card — editorial glass slab with corner brackets.
//
// Composition (v3):
//   - Outer cyan-rim glow (graceful in Outlook)
//   - 4 HUD corner brackets (cyan L-marks at all 4 corners)
//   - Optional header label as inline editorial chip (─── № LABEL ───)
//     — sits naturally in the body, not as a tinted strip
//   - Body content (frosted gradient surface)
// ────────────────────────────────────────────────────────────────────────

export interface CardOptions {
  children: string;
  variant?: "default" | "raised";
  headerLabel?: string;
}

export function card({ children, variant = "default", headerLabel }: CardOptions): string {
  const surfaceClass = variant === "raised" ? "email-surface-raised" : "email-surface";
  const bg = variant === "raised" ? COLOR.bg.surfaceRaised : COLOR.bg.surface;
  const radius = variant === "raised" ? RADIUS.xl : RADIUS.lg;
  const shadow = variant === "raised" ? GLOW.cardCyan : GLOW.card;

  // Inline editorial chip (replaces the tinted header strip). Sits inside
  // the card body so the glass surface reads as one continuous pane.
  const headerStrip = headerLabel
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 ${SPACE.s7};">`
      + `<tr>`
      + `<td valign="middle" style="padding-right:${SPACE.s3};">`
      + `<div style="width:24px;height:1px;background-color:${COLOR.brand.cyanDeep};font-size:0;line-height:1px;">&nbsp;</div>`
      + `</td>`
      + `<td valign="middle" style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;white-space:nowrap;" class="email-text-accent">`
      + `<span style="color:${COLOR.brand.cyan};" class="email-text-accent">№ </span>${esc(headerLabel)}`
      + `</td>`
      + `</tr></table>`
    : "";

  // The container <td> is position:relative so the corner brackets can
  // anchor to it. Outlook ignores position:relative gracefully — the
  // brackets simply fall back into normal flow as decorative dots.
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="${surfaceClass}" style="background-color:${bg};background-image:${CARD_GRADIENT};border:1px solid ${COLOR.border.cyan};border-radius:${radius};box-shadow:${shadow};">`
    + `<tr><td class="email-pad email-card-pad" style="position:relative;padding:${SPACE.s10} ${SPACE.s9};">`
    + cornerBracket("tl")
    + cornerBracket("tr")
    + cornerBracket("bl")
    + cornerBracket("br")
    + headerStrip
    + children
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Section eyebrow — asymmetric numeral + rule running off-edge.
// Reads as a magazine section opener (e.g. "01 ─── WHAT'S NEXT").
// ────────────────────────────────────────────────────────────────────────

let __sectionEyebrowCounter = 0;
export function sectionEyebrow({ label }: { label: string }): string {
  __sectionEyebrowCounter = (__sectionEyebrowCounter + 1) % 100;
  const numeral = String(__sectionEyebrowCounter).padStart(2, "0");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr>`
    + `<td valign="middle" width="auto" style="white-space:nowrap;padding-right:${SPACE.s4};" data-flip-padding-right="sectionEyebrow">`
    + `<span style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;" class="email-text-accent">${numeral}</span>`
    + `<span style="${typeStyle("micro", COLOR.text.primary)}text-transform:uppercase;padding-left:${SPACE.s3};" class="email-text-primary">${esc(label)}</span>`
    + `</td>`
    + `<td width="100%" style="font-size:0;line-height:0;height:1px;background-color:${COLOR.border.cyanSoft};background-image:${ACCENT_RULE_GRADIENT};">&nbsp;</td>`
    + `</tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Pull quote — editorial atmospheric statement.
// Cyan opening glyph + thick cyan rule beneath the quote.
// ────────────────────────────────────────────────────────────────────────

export function pullQuote({ text, attribution }: { text: string; attribution?: string }): string {
  const attribHtml = attribution
    ? `<div style="${typeStyle("microSm", COLOR.text.tertiary)}text-transform:uppercase;padding-top:${SPACE.s5};" class="email-text-tertiary">— ${esc(attribution)}</div>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td style="padding:${SPACE.s6} 0 ${SPACE.s5};">`
    + `<div style="font-size:64px;line-height:0.8;color:${COLOR.brand.cyan};font-weight:900;padding-bottom:${SPACE.s4};font-family:Georgia,serif;" class="email-text-accent">&ldquo;</div>`
    + `<div class="email-pull-quote email-text-primary" style="${typeStyle("pullQuote", COLOR.text.primary)}font-style:italic;">${esc(text)}</div>`
    // Thick cyan editorial rule beneath the quote.
    + `<div style="width:48px;height:2px;background-color:${COLOR.brand.cyan};margin-top:${SPACE.s5};font-size:0;line-height:2px;">&nbsp;</div>`
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
  const typeClass = level === 1 ? "email-h1" : "";
  const cls = `${TEXT_COLOR_CLASS[color]}${typeClass ? " " + typeClass : ""}`;
  return `<${tag} style="${typeStyle(typeKey, colorOf(color))}text-align:${align};" class="${cls}">${esc(text)}</${tag}>`;
}

export interface TextBlockOptions {
  text: string;
  size?: "body" | "bodyLg" | "bodySm" | "caption";
  color?: TextColor;
  align?: Align;
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
  const typeClass = size === "bodyLg" ? "email-body-lg" : size === "body" ? "email-body" : "";
  const cls = `${TEXT_COLOR_CLASS[color]}${typeClass ? " " + typeClass : ""}`;
  return `<p style="${typeStyle(size, colorOf(color))}text-align:${align};" class="${cls}">${inner}</p>`;
}

// ────────────────────────────────────────────────────────────────────────
// Spacer & divider.
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
// Severity ribbon — corner-tab badge (NOT a left-border panel).
//
// Composition (v3): a small corner-anchored cyan/severity tab at the
// top-left, then the title + body sit on a quiet tinted slab. Reads
// as an editorial advisory chip, not a panicky alert box.
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
    ? `<div dir="auto" style="${typeStyle("bodySm", COLOR.text.secondary)}padding-top:${SPACE.s3};" class="email-text-secondary">${esc(body)}</div>`
    : "";
  // Corner ribbon — small severity chip in the top-left corner.
  // The chip sits in its own row above the title/body so the tab feels
  // anchored, not pasted on. RTL flips via data-flip-* on the chip cell.
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="${tintClass}" style="background-color:${sev.tint};border:1px solid ${sev.border};border-radius:${RADIUS.md};">`
    + `<tr><td style="padding:${SPACE.s6} ${SPACE.s6} ${SPACE.s6};" data-flip-padding-left="severity">`
    // Ribbon chip — uppercase tracked label on a stronger severity wash.
    + `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 ${SPACE.s4};"><tr>`
    + `<td style="background-color:${sev.accent};color:${COLOR.text.onAccent};padding:6px 12px;border-radius:${RADIUS.sm};${typeStyle("microSm", COLOR.text.onAccent)}text-transform:uppercase;" class="${accentClass}">${esc(sev.label)}</td>`
    + `</tr></table>`
    + `<div style="${typeStyle("h2", COLOR.text.primary)}" class="email-text-primary">${esc(title)}</div>`
    + bodyHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// CTA button — dual-layer luxury chrome.
//
// Composition (v3):
//   - Outer cyan halo glow (radial, scattered)
//   - Inner gradient pill core (cyanSoft → cyan → cyanDeep)
//   - Hairline cyan ring frame on the surface (1px luminous edge)
//   - Generous padding, tight letter-spacing
//   - VML fallback for Outlook desktop
// ────────────────────────────────────────────────────────────────────────

export interface CtaButtonOptions {
  href: string;
  label: string;
  variant?: "brand" | Severity;
}

export function ctaButton({ href, label, variant = "brand" }: CtaButtonOptions): string {
  const safeHref = esc(href);
  const safeLabel = esc(label);
  const bg = variant === "brand" ? COLOR.brand.cyan : SEVERITY[variant].accent;
  const bgGradient = variant === "brand" ? CTA_GRADIENT : `linear-gradient(180deg, ${SEVERITY[variant].accent} 0%, ${SEVERITY[variant].accent} 100%)`;
  const textColor = COLOR.text.onAccent;
  const ctaClass = variant === "brand" ? "email-cta-brand" : `email-cta-${variant}`;
  // Outlook VML — keeps the button rendered as a proper rounded rect on
  // Outlook desktop. arcsize 50% ensures the pill shape; size matches
  // the live HTML footprint (380×76).
  const vml = [
    `<!--[if mso]>`,
    `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:76px;v-text-anchor:middle;width:380px;" arcsize="50%" stroke="f" fillcolor="${bg}">`,
    `<w:anchorlock/>`,
    `<center style="color:${textColor};font-family:Arial,sans-serif;font-size:14px;font-weight:900;letter-spacing:0.26em;text-transform:uppercase;">${safeLabel}</center>`,
    `</v:roundrect>`,
    `<![endif]-->`,
  ].join("");
  // Live HTML — pill-shaped, gradient core, tight tracking, glow halo.
  // pill radius (999px) is more luxurious than RADIUS.lg here: it reads
  // as product chrome, not as a "rounded rectangle button".
  const html = [
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">`,
    `<tr><td class="email-cta-cell" align="center" style="border-radius:999px;background-color:${bg};background-image:${bgGradient};box-shadow:${GLOW.cta};">`,
    vml,
    `<!--[if !mso]><!-- -->`,
    `<a href="${safeHref}" target="_blank" rel="noopener" class="${ctaClass}" style="display:inline-block;padding:26px 56px;font-family:inherit;font-size:14px;line-height:1;font-weight:900;letter-spacing:0.28em;text-transform:uppercase;color:${textColor};text-decoration:none;border-radius:999px;background-color:${bg};background-image:${bgGradient};mso-hide:all;">${safeLabel}</a>`,
    `<!--<![endif]-->`,
    `</td></tr></table>`,
  ].join("");
  return html;
}

/** Secondary text link — max one per email. */
export function ctaTextLink({ href, label }: { href: string; label: string }): string {
  return `<a href="${esc(href)}" target="_blank" rel="noopener" style="font-size:11px;line-height:1.5;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${COLOR.brand.cyan};text-decoration:none;border-bottom:1px solid ${COLOR.border.cyanStrong};padding-bottom:2px;" class="email-text-accent">${esc(label)} →</a>`;
}

// ────────────────────────────────────────────────────────────────────────
// CTA Section — billboard wrapper.
//
// Composition (v3):
//   - Atmospheric radial cyan halo backdrop
//   - Top + bottom hairline cyan rules (full-width, fade at edges)
//   - Editorial №-numbered eyebrow above the button (optional)
//   - The CTA button itself
//   - Supporting microcopy + secondary text link below (optional)
// ────────────────────────────────────────────────────────────────────────

export interface CtaSectionOptions {
  eyebrow?: string;
  ctaHtml: string;
  supportingText?: string;
  supportingLink?: { href: string; label: string };
}

export function ctaSection({ eyebrow, ctaHtml, supportingText, supportingLink }: CtaSectionOptions): string {
  const eyebrowHtml = eyebrow
    ? `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto ${SPACE.s8};">`
      + `<tr>`
      + `<td valign="middle" style="padding-right:${SPACE.s4};">`
      + `<div style="width:36px;height:1px;background-color:${COLOR.brand.cyan};font-size:0;line-height:1px;">&nbsp;</div>`
      + `</td>`
      + `<td valign="middle" style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;white-space:nowrap;" class="email-text-accent">`
      + `<span style="color:${COLOR.brand.cyan};" class="email-text-accent">№ </span>${esc(eyebrow)}`
      + `</td>`
      + `<td valign="middle" style="padding-left:${SPACE.s4};">`
      + `<div style="width:36px;height:1px;background-color:${COLOR.brand.cyan};font-size:0;line-height:1px;">&nbsp;</div>`
      + `</td>`
      + `</tr></table>`
    : "";

  const supportingHtml = supportingText
    ? `<div style="${typeStyle("bodySm", COLOR.text.tertiary)}text-align:center;padding-top:${SPACE.s7};" class="email-text-tertiary">${esc(supportingText)}</div>`
    : "";
  const linkHtml = supportingLink
    ? `<div style="text-align:center;padding-top:${SPACE.s4};">${ctaTextLink(supportingLink)}</div>`
    : "";

  // Top + bottom cyan hairlines (fade at edges via gradient).
  const ruleTop = `<tr><td style="font-size:0;line-height:0;height:1px;background-color:${COLOR.border.cyanSoft};background-image:${ACCENT_RULE_GRADIENT};">&nbsp;</td></tr>`;
  const ruleBottom = ruleTop;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.ctaSection};background-image:${CTA_SECTION_GRADIENT};">`
    + ruleTop
    + `<tr><td class="email-cta-section-pad" align="center" style="padding:${SPACE.s12} ${SPACE.s8};text-align:center;">`
    + eyebrowHtml
    + ctaHtml
    + supportingHtml
    + linkHtml
    + `</td></tr>`
    + ruleBottom
    + `</table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Key-value list — editorial 2-column HUD grid.
//
// Composition (v3):
//   - 2-column desktop grid (label/value pairs) with a vertical hairline
//     between columns — reads as a HUD readout.
//   - Stacks to single column on mobile.
//   - Cyan uppercase micro labels above white values.
// ────────────────────────────────────────────────────────────────────────

export interface KeyValueListOptions {
  items: Array<{ label: string; value: string | null | undefined }>;
}

export function keyValueList({ items }: KeyValueListOptions): string {
  const filtered = items.filter((it) => it.value !== null && it.value !== undefined && String(it.value).trim() !== "");
  if (!filtered.length) return "";

  // Pair up items into 2-column rows. Last odd item gets the full row width.
  const pairs: Array<typeof filtered> = [];
  for (let i = 0; i < filtered.length; i += 2) pairs.push(filtered.slice(i, i + 2));

  const rows = pairs
    .map((pair, ri) => {
      const topGap = ri === 0 ? "0" : SPACE.s6;
      const borderTop = ri === 0 ? "" : `border-top:1px solid ${COLOR.border.divider};`;
      const innerPadTop = ri === 0 ? "0" : SPACE.s6;

      const cell = (it: typeof pair[number], ci: number): string => {
        const padLeft = ci === 0 ? "0" : SPACE.s7;
        const borderLeft = ci === 0 ? "" : `border-left:1px solid ${COLOR.border.divider};`;
        return `<td valign="top" width="50%" class="email-kv-cell" style="padding:${innerPadTop} 0 0 ${padLeft};${borderLeft}" data-flip-padding-left="kv" data-flip-border-left="kv">`
          + `<div style="${typeStyle("micro", COLOR.brand.cyanMuted)}text-transform:uppercase;" class="email-text-accent">${esc(it.label)}</div>`
          + `<div dir="auto" style="${typeStyle("bodyLg", COLOR.text.primary)}padding-top:10px;font-weight:600;letter-spacing:-0.005em;" class="email-text-primary email-body-lg">${esc(it.value as string)}</div>`
          + `</td>`;
      };

      // For odd-length pair, render the second cell as &nbsp; placeholder
      // so the desktop grid stays balanced.
      const c1 = cell(pair[0], 0);
      const c2 = pair[1]
        ? cell(pair[1], 1)
        : `<td valign="top" width="50%" class="email-kv-cell" style="padding-top:${innerPadTop};">&nbsp;</td>`;

      return `<tr class="email-stack-2col"><td colspan="2" style="padding-top:${topGap};${borderTop}font-size:0;line-height:0;">&nbsp;</td></tr>`
        + `<tr class="email-stack-2col">${c1}${c2}</tr>`;
    })
    .join("");

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Metric grid — 2-up HUD tiles.
// Editorial v3: each tile gets corner brackets at top-left/right, larger
// metric value (40px), and a quieter background that lets the value lead.
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
      const topGap = ri === 0 ? "0" : SPACE.s5;
      const cells = pair
        .map((it, ci) => {
          const padLeft = ci === 0 ? "0" : SPACE.s4;
          return `<td valign="top" width="50%" style="padding-left:${padLeft};padding-top:${topGap};" data-flip-padding-left="metric">`
            + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.secondary};border:1px solid ${COLOR.border.cyanSoft};border-radius:${RADIUS.md};">`
            + `<tr><td style="padding:${SPACE.s6} ${SPACE.s5};position:relative;">`
            + cornerBracket("tl")
            + cornerBracket("tr")
            + `<div style="${typeStyle("micro", COLOR.brand.cyanMuted)}text-transform:uppercase;" class="email-text-accent">${esc(it.label)}</div>`
            + `<div dir="auto" style="${typeStyle("metric", COLOR.text.primary)}padding-top:${SPACE.s3};" class="email-text-primary">${esc(it.value)}</div>`
            + `</td></tr></table>`
            + `</td>`;
        })
        .join("");
      const padding = pair.length === 1 ? `<td width="50%" style="padding-top:${topGap};">&nbsp;</td>` : "";
      return `<tr class="email-stack-2col">${cells}${padding}</tr>`;
    })
    .join("");
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${html}</table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Editorial Footer — 3-column magazine masthead.
//
// Composition (v3):
//   - Top: cyan halo divider + trainer signature lockup (centered)
//   - Middle: 3-column masthead — REACH | STUDIO | LEGAL — with vertical
//             hairlines between columns, stacks on mobile
//   - Bottom: brand wordmark + tagline (single calm line)
// ────────────────────────────────────────────────────────────────────────

export interface FooterOptions {
  lang: Lang;
  supportEmail: string;
  unsubscribeUrl?: string;
  manageUrl?: string;
  whatsappUrl?: string;
  studioLocation?: string;
}

export function footer({ lang, supportEmail, unsubscribeUrl, manageUrl, whatsappUrl, studioLocation }: FooterOptions): string {
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  const trainerLine = t("COACH YOUSSEF AHMED", "المدرب يوسف أحمد");
  const trainerRole = t("CERTIFIED PERSONAL TRAINER", "مدرب شخصي معتمد");

  const reachLabel = t("REACH", "للتواصل");
  const studioLabelText = t("STUDIO", "الاستوديو");
  const legalLabel = t("LEGAL", "قانوني");

  const supportLabel = t("Support", "الدعم");
  const unsubLabel = t("Unsubscribe", "إلغاء الاشتراك");
  const manageLabel = t("Manage notifications", "إدارة الإشعارات");
  const whatsappLabel = t("WhatsApp", "واتساب");

  // Halo bar above signature.
  const haloBar = `<div style="width:32px;height:1px;background-color:${COLOR.brand.cyan};margin:0 auto ${SPACE.s5};font-size:0;line-height:1px;">&nbsp;</div>`;

  // Reach column — WhatsApp + email links.
  const reachLines: string[] = [];
  if (whatsappUrl) {
    reachLines.push(`<a href="${esc(whatsappUrl)}" style="color:${COLOR.text.secondary};text-decoration:none;display:block;padding:4px 0;font-size:11px;line-height:1.4;letter-spacing:0.04em;">${whatsappLabel} ↗</a>`);
  }
  reachLines.push(`<a href="mailto:${esc(supportEmail)}" style="color:${COLOR.text.secondary};text-decoration:none;display:block;padding:4px 0;font-size:11px;line-height:1.4;letter-spacing:0.04em;word-break:break-word;">${esc(supportEmail)}</a>`);

  // Studio column — location.
  const studioLines: string[] = [];
  if (studioLocation) {
    studioLines.push(`<div style="color:${COLOR.text.secondary};font-size:11px;line-height:1.4;letter-spacing:0.04em;padding:4px 0;">${esc(studioLocation)}</div>`);
  } else {
    studioLines.push(`<div style="color:${COLOR.text.secondary};font-size:11px;line-height:1.4;letter-spacing:0.04em;padding:4px 0;">${t("Dubai", "دبي")}</div>`);
  }
  studioLines.push(`<div style="color:${COLOR.text.tertiary};font-size:10px;line-height:1.4;letter-spacing:0.18em;text-transform:uppercase;padding-top:4px;">${t("By appointment", "بموعد مسبق")}</div>`);

  // Legal column — manage / unsubscribe / support.
  const legalLines: string[] = [];
  legalLines.push(`<a href="mailto:${esc(supportEmail)}" style="color:${COLOR.text.secondary};text-decoration:none;display:block;padding:4px 0;font-size:11px;line-height:1.4;letter-spacing:0.04em;">${supportLabel}</a>`);
  if (manageUrl) {
    legalLines.push(`<a href="${esc(manageUrl)}" style="color:${COLOR.text.secondary};text-decoration:none;display:block;padding:4px 0;font-size:11px;line-height:1.4;letter-spacing:0.04em;">${manageLabel}</a>`);
  }
  if (unsubscribeUrl) {
    legalLines.push(`<a href="${esc(unsubscribeUrl)}" style="color:${COLOR.text.secondary};text-decoration:none;display:block;padding:4px 0;font-size:11px;line-height:1.4;letter-spacing:0.04em;">${unsubLabel}</a>`);
  }

  const columnHeader = (label: string): string =>
    `<div style="${typeStyle("microSm", COLOR.brand.cyan)}text-transform:uppercase;padding-bottom:${SPACE.s4};" class="email-text-accent">${esc(label)}</div>`;

  const masthead = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr>`
    + `<td valign="top" width="33%" class="email-footer-col" style="padding-right:${SPACE.s5};text-align:left;" data-flip-padding-right="footerCol">`
    + columnHeader(reachLabel)
    + reachLines.join("")
    + `</td>`
    + `<td valign="top" width="34%" class="email-footer-col" style="padding:0 ${SPACE.s5};border-left:1px solid ${COLOR.border.divider};border-right:1px solid ${COLOR.border.divider};text-align:left;">`
    + columnHeader(studioLabelText)
    + studioLines.join("")
    + `</td>`
    + `<td valign="top" width="33%" class="email-footer-col" style="padding-left:${SPACE.s5};text-align:left;" data-flip-padding-left="footerCol">`
    + columnHeader(legalLabel)
    + legalLines.join("")
    + `</td>`
    + `</tr></table>`;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.footer};background-image:${FOOTER_GRADIENT};">`
    + `<tr><td class="email-pad" align="center" style="padding:${SPACE.s10} ${SPACE.s8} ${SPACE.s8};">`
    // Trainer signature
    + haloBar
    + `<div style="${typeStyle("h3", COLOR.text.primary)}text-align:center;letter-spacing:0.18em;text-transform:uppercase;" class="email-text-primary">${esc(trainerLine)}</div>`
    + `<div style="${typeStyle("microSm", COLOR.text.tertiary)}text-align:center;text-transform:uppercase;padding-top:${SPACE.s2};" class="email-text-tertiary">${esc(trainerRole)}</div>`
    // Atmospheric divider
    + `<div style="height:1px;line-height:1px;font-size:0;background-color:${COLOR.border.hairline};background-image:${ACCENT_RULE_GRADIENT};opacity:0.6;margin:${SPACE.s8} 0 ${SPACE.s7};">&nbsp;</div>`
    // 3-column masthead
    + masthead
    // Atmospheric closing divider
    + `<div style="height:1px;line-height:1px;font-size:0;background-color:${COLOR.border.hairline};margin:${SPACE.s7} 0 ${SPACE.s5};">&nbsp;</div>`
    // Brand wordmark closing line
    + `<div style="text-align:center;font-size:9px;line-height:1.4;font-weight:700;letter-spacing:0.5em;text-transform:uppercase;color:${COLOR.text.tertiary};" class="email-text-tertiary">YOUSSEF AHMED · ELITE PERSONAL TRAINING · DUBAI</div>`
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Section wrapper — applies horizontal page padding consistently.
// ────────────────────────────────────────────────────────────────────────

export function section(children: string, opts?: { topGap?: SpaceKey }): string {
  const top = opts?.topGap ? SPACE[opts.topGap] : SPACE.s7;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-pad" style="padding:${top} ${SPACE.s8} 0;">${children}</td></tr>`
    + `</table>`;
}
