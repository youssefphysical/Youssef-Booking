/**
 * Email primitives — PNG FRAME MATCH v4.
 *
 * Rebuilt to match the four approved reference frames. Each primitive
 * renders practical luxury composition: dark charcoal canvas, photo
 * heroes, 2-column data cards with icon rows, solid cyan CTA pills, and
 * a clean centred footer with social icons.
 *
 * Public API is broadly preserved so every builder, route, and preview
 * script keeps working. New primitives have been added:
 *   - infoCard()        — 2-column data card with icon rows.
 *   - whatToBring()     — horizontal 3-item icon row inside a card.
 *   - supportRow()      — 2-column "Need help?" / "WhatsApp" band.
 *   - commitmentBanner()— dark band with check icon + CTA (payment email).
 *   - emailFooter()     — Y logo, wordmark, social icons, copyright.
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
  HERO_IMAGE_OVERLAY,
  CARD_GRADIENT,
  CARD_TOP_EDGE,
  CARD_BOTTOM_EDGE,
  CARD_HEADER_GRADIENT,
  CTA_SECTION_GRADIENT,
  CTA_GRADIENT,
  ACCENT_RULE_GRADIENT,
  FOOTER_GRADIENT,
  CARD_DIVIDER,
  GLOW,
  fontStack,
  type Lang,
  type Severity,
} from "./tokens";

// ────────────────────────────────────────────────────────────────────────
// Helpers
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

// ────────────────────────────────────────────────────────────────────────
// Icon library — small inline SVGs encoded as data URIs.
// Rendered via <img src="data:image/svg+xml;utf8,...">. Falls back to a
// blank space on clients that block data URIs (Outlook desktop). The
// labels remain legible without the glyph.
// ────────────────────────────────────────────────────────────────────────

type IconKey =
  | "calendar" | "clock" | "stopwatch" | "location" | "person"
  | "dumbbell" | "package" | "check" | "creditCard" | "box"
  | "headset" | "whatsapp" | "instagram" | "envelope"
  | "waterBottle" | "towel" | "shoe" | "shield" | "trendUp"
  | "clipboard" | "target" | "chevron" | "arrow" | "logoY";

function svg(body: string, size: number = 22, color: string = COLOR.brand.cyan, fill: "none" | "solid" = "none"): string {
  const stroke = `stroke='${encodeURIComponent(color)}' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round' fill='${fill === "solid" ? encodeURIComponent(color) : "none"}'`;
  const xml = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' width='${size}' height='${size}' ${stroke}>${body}</svg>`;
  return `data:image/svg+xml;utf8,${xml}`;
}

function iconUri(key: IconKey, color: string = COLOR.brand.cyan, size = 22): string {
  switch (key) {
    case "calendar": return svg(`<rect x='3' y='5' width='18' height='16' rx='2'/><path d='M3 9h18M8 3v4M16 3v4'/>`, size, color);
    case "clock": return svg(`<circle cx='12' cy='12' r='9'/><path d='M12 7v5l3 2'/>`, size, color);
    case "stopwatch": return svg(`<circle cx='12' cy='13' r='8'/><path d='M12 9v4l2 2M9 2h6M12 5V2'/>`, size, color);
    case "location": return svg(`<path d='M12 22s7-7.5 7-13a7 7 0 1 0-14 0c0 5.5 7 13 7 13z'/><circle cx='12' cy='9' r='2.5'/>`, size, color);
    case "person": return svg(`<circle cx='12' cy='8' r='4'/><path d='M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8'/>`, size, color);
    case "dumbbell": return svg(`<path d='M3 9v6M6 7v10M18 7v10M21 9v6M6 12h12'/>`, size, color);
    case "package": return svg(`<path d='M3 8l9-5 9 5v8l-9 5-9-5z'/><path d='M3 8l9 5 9-5M12 13v10'/>`, size, color);
    case "box": return svg(`<rect x='3' y='5' width='18' height='14' rx='2'/><path d='M3 9h18M9 5v4'/>`, size, color);
    case "check": return svg(`<circle cx='12' cy='12' r='9'/><path d='M8 12.5l3 3 5-6'/>`, size, color);
    case "creditCard": return svg(`<rect x='3' y='6' width='18' height='12' rx='2'/><path d='M3 10h18M7 15h3'/>`, size, color);
    case "headset": return svg(`<path d='M4 14v-2a8 8 0 0 1 16 0v2'/><rect x='3' y='14' width='4' height='6' rx='1'/><rect x='17' y='14' width='4' height='6' rx='1'/>`, size, color);
    case "whatsapp": return svg(`<path d='M20 12a8 8 0 1 1-3.4-6.5L20 4l-1.5 3.4A7.97 7.97 0 0 1 20 12z'/><path d='M9 10c.5 2 2 3.5 4 4l1.5-1.5 2 1-.5 2c-3 0-7-2-8-7l2-.5z'/>`, size, color);
    case "instagram": return svg(`<rect x='3' y='3' width='18' height='18' rx='5'/><circle cx='12' cy='12' r='4'/><circle cx='17.5' cy='6.5' r='1' fill='${encodeURIComponent(color)}'/>`, size, color);
    case "envelope": return svg(`<rect x='3' y='5' width='18' height='14' rx='2'/><path d='M3 7l9 7 9-7'/>`, size, color);
    case "waterBottle": return svg(`<path d='M9 2h6v3l1 2v12a3 3 0 0 1-3 3h-2a3 3 0 0 1-3-3V7l1-2z'/><path d='M9 11h6'/>`, size, color);
    case "towel": return svg(`<rect x='4' y='5' width='16' height='14' rx='2'/><path d='M8 5v14M4 9h4'/>`, size, color);
    case "shoe": return svg(`<path d='M2 17c0 2 1 3 3 3h14c2 0 3-1 3-3v-1c0-1-1-2-2-2h-4l-2-4-4 2-3-1-4 1-1 2v3z'/>`, size, color);
    case "shield": return svg(`<path d='M12 3l8 3v6c0 5-4 8-8 9-4-1-8-4-8-9V6l8-3z'/><path d='M9 12l2 2 4-4'/>`, size, color);
    case "trendUp": return svg(`<path d='M3 17l6-6 4 4 8-8'/><path d='M14 7h7v7'/>`, size, color);
    case "clipboard": return svg(`<rect x='6' y='4' width='12' height='17' rx='2'/><rect x='9' y='2' width='6' height='4' rx='1'/><path d='M9 11h6M9 15h4'/>`, size, color);
    case "target": return svg(`<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='5'/><circle cx='12' cy='12' r='1.5' fill='${encodeURIComponent(color)}'/>`, size, color);
    case "chevron": return svg(`<path d='M9 6l6 6-6 6'/>`, size, color);
    case "arrow": return svg(`<path d='M5 12h14M13 6l6 6-6 6'/>`, size, color);
    case "logoY": return svg(`<path d='M4 4l8 10v6M20 4l-8 10' stroke-width='2.4'/><circle cx='12' cy='12' r='10' stroke-width='1.2'/>`, size, color);
  }
}

function iconImg(key: IconKey, opts: { color?: string; size?: number; alt?: string } = {}): string {
  const size = opts.size ?? 22;
  const color = opts.color ?? COLOR.brand.cyan;
  return `<img src="${iconUri(key, color, size)}" width="${size}" height="${size}" alt="${esc(opts.alt ?? "")}" style="display:inline-block;width:${size}px;height:${size}px;border:0;outline:none;vertical-align:middle;" />`;
}

// ────────────────────────────────────────────────────────────────────────
// Shell — locked dark canvas.
// ────────────────────────────────────────────────────────────────────────

export interface ShellOptions {
  lang: Lang;
  preheader: string;
  bodyHtml: string;
}

export function emailShell({ lang, preheader, bodyHtml }: ShellOptions): string {
  __sectionEyebrowCounter = 0;
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
    `@media only screen and (max-width:600px){`,
    `.email-shell{width:100% !important;}`,
    `.email-pad{padding-left:18px !important;padding-right:18px !important;}`,
    `.email-pad-tight{padding-left:14px !important;padding-right:14px !important;}`,
    `.email-card-pad{padding:22px 18px !important;}`,
    `.email-cta-cell a{display:block !important;width:auto !important;padding:18px 22px !important;font-size:13px !important;letter-spacing:0.18em !important;}`,
    `.email-stack-2col>td{display:block !important;width:100% !important;}`,
    `.email-stack-2col>td+td{padding-top:18px !important;padding-left:0 !important;border-left:0 !important;}`,
    `.email-hero-split>td{display:block !important;width:100% !important;}`,
    `.email-hero-img{height:200px !important;width:100% !important;}`,
    // Full-bleed hero — keywords column collapses on mobile so the
    // headline + photo overlay retain their cinematic density.
    `.email-hero-keywords{display:none !important;}`,
    `.email-hero-row>td{display:block !important;width:100% !important;}`,
    `.email-display-xl{font-size:${TYPE.displayXlMobile.size} !important;line-height:${TYPE.displayXlMobile.lh} !important;letter-spacing:${TYPE.displayXlMobile.tracking} !important;}`,
    `.email-display{font-size:${TYPE.displayMobile.size} !important;line-height:${TYPE.displayMobile.lh} !important;}`,
    `.email-body-lg{font-size:16px !important;line-height:1.55 !important;}`,
    `.email-body{font-size:15px !important;line-height:1.6 !important;}`,
    `.email-h1{font-size:22px !important;line-height:1.25 !important;}`,
    `.email-pull-quote{font-size:18px !important;line-height:1.4 !important;}`,
    // Hero pad mobile — bigger top pad so the brand lockup breathes,
    // bigger bottom so the headline doesn't crash into the next card.
    `.email-hero-pad{padding:48px 24px 56px !important;}`,
    `.email-brand-pad{padding:22px 18px 4px !important;}`,
    `.email-cta-section-pad{padding:28px 18px !important;}`,
    `.email-footer-pad{padding:30px 18px 26px !important;}`,
    `.email-kv-rule{display:none !important;}`,
    `.email-footer-col{display:block !important;width:100% !important;text-align:center !important;padding:14px 0 !important;border-left:0 !important;}`,
    `}`,
    `a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}`,
    `table { border-collapse: collapse; }`,
    `img { -ms-interpolation-mode: bicubic; border: 0; outline: none; text-decoration: none; display: block; }`,
    `</style>`,
    `<!-- DARK_MODE_OVERRIDES -->`,
    `</head>`,
    `<body style="margin:0;padding:0;background-color:${COLOR.bg.canvas};font-family:${family};color:${COLOR.text.primary};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;" class="email-canvas">`,
    `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:transparent;">${esc(preheader)}</div>`,
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.canvas};" class="email-canvas">`,
    `<tr><td align="center" style="padding:${SPACE.s5} 0;">`,
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
// Brand header — small "Y" mark + "YOUSSEF / ELITE COACHING" lockup.
// Sits ABOVE the hero band (top-left), matches all 4 frames.
// ────────────────────────────────────────────────────────────────────────

function brandLockup(align: "left" | "center" = "left", size: "sm" | "md" = "sm"): string {
  const iconSize = size === "md" ? 30 : 24;
  const wordmarkSize = size === "md" ? 16 : 14;
  const subSize = size === "md" ? 9 : 8;
  const tdAlign = align === "center" ? "center" : "left";
  const wrapAlign = align === "center" ? "0 auto" : "0";
  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="${align}" style="margin:${wrapAlign};">`
    + `<tr>`
    + `<td valign="middle" align="${tdAlign}" style="padding-right:10px;" data-flip-padding-right="brand">${iconImg("logoY", { size: iconSize, alt: "Y" })}</td>`
    + `<td valign="middle" align="${tdAlign}">`
    + `<div style="font-family:inherit;font-size:${wordmarkSize}px;line-height:1;font-weight:700;letter-spacing:0.18em;color:${COLOR.text.primary};text-transform:uppercase;" class="email-text-primary">YOUSSEF</div>`
    + `<div style="font-family:inherit;font-size:${subSize}px;line-height:1;font-weight:600;letter-spacing:0.32em;color:${COLOR.brand.cyan};padding-top:5px;text-transform:uppercase;" class="email-text-accent">ELITE COACHING</div>`
    + `</td>`
    + `</tr></table>`;
}

export function brandHeader(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-pad email-brand-pad" align="left" style="padding:${SPACE.s7} ${SPACE.s7} ${SPACE.s2};" data-flip-text-align="brand-header">`
    + brandLockup("left", "sm")
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Hero — split layout. Text on the left, optional gym photo on the right.
// Brand lockup sits in the top-left corner of the text cell.
// On mobile, the image stacks above the text.
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
  /** Pull the brand lockup into the hero (default true). */
  withBrand?: boolean;
  /**
   * Right-side keyword stack (frame 1: DISCIPLINE / FOCUS / CONSISTENCY /
   * RESULTS). Renders as a vertical cyan-eyebrow list over the photo.
   */
  keywords?: string[];
}

/**
 * Hero — full-bleed photo with dark-to-clear gradient overlay and
 * stacked title on the LEFT. Matches the approved Figma frames.
 *
 * Render pipeline (email-safe):
 *   1. VML <v:rect> with <v:fill type="frame"> for Outlook desktop —
 *      the only Outlook-safe way to render a background image.
 *   2. <table background="…"> attribute + CSS background-image for Apple
 *      Mail, Gmail web/iOS, Yahoo, etc.
 *   3. Solid #0c0c10 fallback for Gmail Android (strips bg-image) — the
 *      dark overlay still produces a luxury text-on-dark composition.
 */
export function hero({
  eyebrow, title, accentWord, subtitle, trailingMeta,
  imageUrl, imageAlt, align = "left", withBrand = true, keywords,
}: HeroOptions): string {
  void trailingMeta;
  void HERO_BLEND_GRADIENT;
  void align;

  const brand = withBrand
    ? `<div style="padding-bottom:${SPACE.s8};">${brandLockup("left", "sm")}</div>`
    : "";

  const eyebrowHtml = eyebrow
    ? `<div style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;padding-bottom:${SPACE.s4};" class="email-text-accent">${esc(eyebrow)}</div>`
    : "";

  const accentRule = `<div style="width:64px;height:3px;background-color:${COLOR.brand.cyan};margin:${SPACE.s4} 0 ${SPACE.s5};font-size:0;line-height:0;box-shadow:0 0 16px rgba(94,231,255,0.45);">&nbsp;</div>`;

  const titleHtml = `<div class="email-display-xl email-text-primary" style="${typeStyle("displayXl", COLOR.text.primary)}text-transform:uppercase;">${esc(title)}</div>`;
  const accentHtml = accentWord
    ? `<div class="email-display-xl email-text-accent" style="${typeStyle("displayXl", COLOR.brand.cyan)}text-transform:uppercase;padding-top:4px;">${esc(accentWord)}</div>`
    : "";

  const subtitleHtml = subtitle
    ? `<div style="${typeStyle("body", COLOR.text.secondary)}padding-top:${SPACE.s5};max-width:340px;" class="email-text-secondary email-body">${esc(subtitle)}</div>`
    : "";

  // Right-side keyword column — vertical stack of cyan-eyebrow words
  // (DISCIPLINE / FOCUS / CONSISTENCY / RESULTS in frame 1). Sits over
  // the photo on desktop; hidden on mobile to preserve photo density.
  const keywordsHtml = keywords && keywords.length
    ? `<td valign="middle" align="right" width="38%" class="email-hero-keywords" style="padding:${SPACE.s7} ${SPACE.s7} ${SPACE.s7} 0;" data-flip-text-align="hero-kw">`
      + keywords
        .map(
          (k) =>
            `<div style="${typeStyle("micro", COLOR.brand.cyanSoft)}text-transform:uppercase;letter-spacing:0.30em;font-weight:700;padding:6px 0;text-align:right;" class="email-text-accent" data-flip-text-align="hero-kw">${esc(k)}</div>`,
        )
        .join("")
      + `</td>`
    : "";

  const heroWidth = WIDTH.hero;
  const heroHeight = 420;
  const safeImage = imageUrl ? esc(imageUrl) : "";

  // VML for Outlook desktop. Outlook strips CSS bg-image but renders
  // <v:rect type="frame"> with the source image scaled to cover.
  const vmlOpen = imageUrl
    ? [
        `<!--[if gte mso 9]>`,
        `<v:rect xmlns:v="urn:schemas-microsoft-com:vml" fill="true" stroke="false" style="width:${heroWidth}px;height:${heroHeight}px;mso-position-horizontal:center;">`,
        `<v:fill type="frame" src="${safeImage}" color="${COLOR.bg.heroBackdrop}" />`,
        `<v:textbox inset="0,0,0,0"><div>`,
        `<![endif]-->`,
      ].join("")
    : "";
  const vmlClose = imageUrl ? `<!--[if gte mso 9]></div></v:textbox></v:rect><![endif]-->` : "";

  // Inner content table (text overlay). When the hero has no image,
  // the keywords column collapses and the text cell takes 100%.
  const textCell =
    `<td valign="middle" align="left" class="email-pad email-hero-pad" style="padding:${SPACE.s10} ${SPACE.s9} ${SPACE.s10};" data-flip-text-align="hero" width="${keywordsHtml ? "62%" : "100%"}">`
    + brand
    + eyebrowHtml
    + titleHtml
    + accentHtml
    + accentRule
    + subtitleHtml
    + `</td>`;

  const overlayTable =
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:transparent;background-image:${HERO_IMAGE_OVERLAY};min-height:${heroHeight}px;">`
    + `<tr class="email-hero-row">`
    + textCell
    + keywordsHtml
    + `</tr></table>`;

  // Outer cell — carries the photo via background attribute + CSS, with
  // the solid charcoal fallback. The min-height + valign keep the
  // composition cinematic when text wraps short.
  const bgAttr = imageUrl ? ` background="${safeImage}"` : "";
  const bgCss = imageUrl
    ? `background-image:url('${safeImage}'),${HERO_GRADIENT};background-position:center center;background-size:cover;background-repeat:no-repeat;`
    : `background-image:${HERO_GRADIENT};`;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.heroBackdrop};">`
    + `<tr><td align="center" valign="top"${bgAttr} style="background-color:${COLOR.bg.heroBackdrop};${bgCss}min-height:${heroHeight}px;padding:0;">`
    + (imageAlt ? `<div style="display:none;font-size:1px;line-height:1px;max-height:0;overflow:hidden;color:transparent;">${esc(imageAlt)}</div>` : "")
    + vmlOpen
    + overlayTable
    + vmlClose
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Card — dark rounded surface (#0f1014) with a soft cyan top hairline.
// ────────────────────────────────────────────────────────────────────────

export interface CardOptions {
  children: string;
  variant?: "default" | "raised";
  headerLabel?: string;
}

export function card({ children, variant = "default", headerLabel }: CardOptions): string {
  const surfaceClass = variant === "raised" ? "email-surface-raised" : "email-surface";
  const bg = variant === "raised" ? COLOR.bg.surfaceRaised : COLOR.bg.surface;
  const radius = RADIUS.lg;
  const shadow = variant === "raised" ? GLOW.cardCyan : GLOW.card;

  const headerStrip = headerLabel
    ? `<div style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;padding-bottom:${SPACE.s5};" class="email-text-accent">${esc(headerLabel)}</div>`
    : "";

  const topEdge = `<tr><td style="font-size:0;line-height:0;height:1px;background-color:${COLOR.brand.cyanGlow};background-image:${CARD_TOP_EDGE};border-top-left-radius:${radius};border-top-right-radius:${radius};">&nbsp;</td></tr>`;
  void CARD_BOTTOM_EDGE;

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="${surfaceClass}" style="background-color:${bg};background-image:${CARD_GRADIENT};border:1px solid ${COLOR.border.cyan};border-radius:${radius};box-shadow:${shadow};">`
    + topEdge
    + `<tr><td class="email-pad email-card-pad" style="padding:${SPACE.s7} ${SPACE.s7};">`
    + headerStrip
    + children
    + `</td></tr>`
    + `</table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Info card — 2-column data grid with icon + label + value rows.
// Each item: { icon, label, value }. Rows separated by 1px hairlines.
// ────────────────────────────────────────────────────────────────────────

export interface InfoCardItem {
  icon: IconKey;
  label: string;
  value: string;
}

export interface InfoCardOptions {
  headerLabel?: string;
  /** Optional eyebrow above the right column. When set, the card renders
   *  two distinct column headers (e.g. "Payment Details" + "Package
   *  Overview" in the payment-confirmed frame). */
  rightHeaderLabel?: string;
  leftItems: InfoCardItem[];
  rightItems?: InfoCardItem[];
}

function renderInfoRows(items: InfoCardItem[]): string {
  const rows = items.filter((i) => i.value && String(i.value).trim() !== "");
  if (!rows.length) return "&nbsp;";
  return rows
    .map((it, idx) => {
      const borderTop = idx === 0 ? "" : `border-top:1px solid ${CARD_DIVIDER};`;
      const padTop = idx === 0 ? "0" : SPACE.s5;
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${borderTop}"><tr>`
        + `<td valign="top" width="28" style="padding:${padTop} 12px 0 0;" data-flip-padding-right="info-icon">${iconImg(it.icon, { size: 22 })}</td>`
        + `<td valign="top" style="padding-top:${padTop};">`
        + `<div style="${typeStyle("micro", COLOR.text.tertiary)}text-transform:uppercase;letter-spacing:0.16em;font-weight:600;" class="email-text-tertiary">${esc(it.label)}</div>`
        + `<div dir="auto" style="${typeStyle("bodyLg", COLOR.text.primary)}padding-top:4px;font-weight:600;" class="email-text-primary email-body-lg">${esc(it.value)}</div>`
        + `</td></tr></table>`
        + (idx === rows.length - 1 ? "" : `<div style="height:${SPACE.s5};font-size:0;line-height:0;">&nbsp;</div>`);
    })
    .join("");
}

export function infoCard({ headerLabel, rightHeaderLabel, leftItems, rightItems }: InfoCardOptions): string {
  const eyebrow = (label?: string) => label
    ? `<div style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;padding-bottom:${SPACE.s5};" class="email-text-accent">${esc(label)}</div>`
    : "";
  const sectionLabel = eyebrow(headerLabel);
  const rightSectionLabel = eyebrow(rightHeaderLabel);
  const hasTwoCols = !!rightItems && rightItems.length > 0;
  const hasDualHeaders = hasTwoCols && !!rightHeaderLabel;

  if (hasDualHeaders) {
    // Side-by-side layout with a distinct eyebrow above each column.
    const leftCell = `<td valign="top" width="50%" style="padding:0;">${sectionLabel}${renderInfoRows(leftItems)}</td>`;
    const rightCell = `<td valign="top" width="50%" style="padding-left:${SPACE.s7};" data-flip-padding-left="info-col">${rightSectionLabel}${renderInfoRows(rightItems!)}</td>`;
    const inner = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr class="email-stack-2col">${leftCell}${rightCell}</tr></table>`;
    return card({ children: inner });
  }

  const leftCell = `<td valign="top" width="${hasTwoCols ? "50%" : "100%"}" style="padding:0;">`
    + (hasTwoCols ? "" : sectionLabel)
    + renderInfoRows(leftItems)
    + `</td>`;
  const rightCell = hasTwoCols
    ? `<td valign="top" width="50%" style="padding-left:${SPACE.s7};" data-flip-padding-left="info-col">${renderInfoRows(rightItems!)}</td>`
    : "";
  const inner = hasTwoCols
    ? sectionLabel + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr class="email-stack-2col">${leftCell}${rightCell}</tr></table>`
    : sectionLabel + renderInfoRows(leftItems);

  return card({ children: inner });
}

// ────────────────────────────────────────────────────────────────────────
// What to bring — horizontal icon row inside a card.
// ────────────────────────────────────────────────────────────────────────

export interface WhatToBringOptions {
  headerLabel?: string;
  items: Array<{ icon: IconKey; label: string }>;
}

export function whatToBring({ headerLabel, items }: WhatToBringOptions): string {
  const label = headerLabel ?? "WHAT TO BRING";
  const cells = items
    .map((it) =>
      `<td valign="middle" align="center" width="33%" style="padding:0 ${SPACE.s3};">`
      + `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center"><tr>`
      + `<td valign="middle" style="padding-right:10px;" data-flip-padding-right="wtb">${iconImg(it.icon, { size: 22 })}</td>`
      + `<td valign="middle" style="${typeStyle("body", COLOR.text.primary)}font-weight:600;" class="email-text-primary">${esc(it.label)}</td>`
      + `</tr></table>`
      + `</td>`,
    )
    .join("");
  const inner = `<div style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;padding-bottom:${SPACE.s5};" class="email-text-accent">${esc(label)}</div>`
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>${cells}</tr></table>`;
  return card({ children: inner });
}

// ────────────────────────────────────────────────────────────────────────
// CTA Button — solid cyan pill with right arrow, full content width.
// ────────────────────────────────────────────────────────────────────────

export interface CtaButtonOptions {
  href: string;
  label: string;
  variant?: "brand" | Severity;
  /** Render as full-width block (default) or auto inline-block. */
  fullWidth?: boolean;
}

export function ctaButton({ href, label, variant = "brand", fullWidth = true }: CtaButtonOptions): string {
  const safeHref = esc(href);
  const safeLabel = esc(label);
  const bg = variant === "brand" ? COLOR.brand.cyan : SEVERITY[variant].accent;
  const textColor = COLOR.text.onAccent;
  const ctaClass = variant === "brand" ? "email-cta-brand" : `email-cta-${variant}`;
  void CTA_GRADIENT;

  const arrow = `<span style="display:inline-block;margin-left:10px;font-weight:700;" data-flip-margin-left="cta">→</span>`;
  const vml = [
    `<!--[if mso]>`,
    `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:54px;v-text-anchor:middle;width:${fullWidth ? "440" : "260"}px;" arcsize="14%" stroke="f" fillcolor="${bg}">`,
    `<w:anchorlock/>`,
    `<center style="color:${textColor};font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.20em;text-transform:uppercase;">${safeLabel}</center>`,
    `</v:roundrect>`,
    `<![endif]-->`,
  ].join("");

  return `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" width="${fullWidth ? "100%" : ""}" style="margin:0 auto;${fullWidth ? "width:100%;" : ""}">`
    + `<tr><td class="email-cta-cell" align="center" style="border-radius:10px;background-color:${bg};">`
    + vml
    + `<!--[if !mso]><!-- -->`
    + `<a href="${safeHref}" target="_blank" rel="noopener" class="${ctaClass}" style="display:block;padding:18px 28px;font-family:inherit;font-size:13px;line-height:1;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:${textColor};text-decoration:none;border-radius:10px;background-color:${bg};text-align:center;mso-hide:all;">${safeLabel}${arrow}</a>`
    + `<!--<![endif]-->`
    + `</td></tr></table>`;
}

export function ctaTextLink({ href, label }: { href: string; label: string }): string {
  return `<a href="${esc(href)}" target="_blank" rel="noopener" style="font-size:12px;line-height:1.5;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.brand.cyan};text-decoration:none;border-bottom:1px solid ${COLOR.border.cyanStrong};padding-bottom:2px;" class="email-text-accent">${esc(label)} →</a>`;
}

// ────────────────────────────────────────────────────────────────────────
// CTA Section — flat band wrapping a CTA + optional support text/link.
// Kept for builders that prefer the dedicated billboard composition.
// ────────────────────────────────────────────────────────────────────────

export interface CtaSectionOptions {
  eyebrow?: string;
  ctaHtml: string;
  supportingText?: string;
  supportingLink?: { href: string; label: string };
}

export function ctaSection({ eyebrow, ctaHtml, supportingText, supportingLink }: CtaSectionOptions): string {
  const eyebrowHtml = eyebrow
    ? `<div style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;text-align:center;padding-bottom:${SPACE.s5};" class="email-text-accent">${esc(eyebrow)}</div>`
    : "";
  const supportingHtml = supportingText
    ? `<div style="${typeStyle("bodySm", COLOR.text.secondary)}text-align:center;padding-top:${SPACE.s5};max-width:420px;margin-left:auto;margin-right:auto;" class="email-text-secondary">${esc(supportingText)}</div>`
    : "";
  const linkHtml = supportingLink
    ? `<div style="text-align:center;padding-top:${SPACE.s4};">${ctaTextLink(supportingLink)}</div>`
    : "";

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.ctaSection};background-image:${CTA_SECTION_GRADIENT};">`
    + `<tr><td class="email-pad email-cta-section-pad" align="center" style="padding:${SPACE.s6} ${SPACE.s7};text-align:center;">`
    + eyebrowHtml
    + ctaHtml
    + supportingHtml
    + linkHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Support Row — 2-col band with circular icon + bold label + body + link.
// ────────────────────────────────────────────────────────────────────────

export interface SupportColumn {
  icon: IconKey;
  title: string;
  body: string;
  href: string;
  linkLabel: string;
  /** Tint the icon (e.g. WhatsApp green). */
  iconColor?: string;
}

export interface SupportRowOptions {
  left: SupportColumn;
  right: SupportColumn;
}

function supportColumn(col: SupportColumn): string {
  const iconColor = col.iconColor ?? COLOR.brand.cyan;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>`
    + `<td valign="top" width="48" style="padding-right:14px;" data-flip-padding-right="support">`
    + `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>`
    + `<td valign="middle" align="center" width="44" height="44" style="background-color:rgba(94,231,255,0.08);border:1px solid ${COLOR.border.cyan};border-radius:999px;width:44px;height:44px;">${iconImg(col.icon, { color: iconColor, size: 22 })}</td>`
    + `</tr></table>`
    + `</td>`
    + `<td valign="top">`
    + `<div style="${typeStyle("body", COLOR.text.primary)}font-weight:600;" class="email-text-primary">${esc(col.title)}</div>`
    + `<div style="${typeStyle("bodySm", COLOR.text.secondary)}padding-top:2px;" class="email-text-secondary">${esc(col.body)} <a href="${esc(col.href)}" target="_blank" rel="noopener" style="color:${COLOR.brand.cyan};text-decoration:underline;font-weight:600;" class="email-text-accent">${esc(col.linkLabel)}</a></div>`
    + `</td>`
    + `</tr></table>`;
}

export function supportRow({ left, right }: SupportRowOptions): string {
  const inner = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr class="email-stack-2col">`
    + `<td valign="top" width="50%" style="padding:0 ${SPACE.s4} 0 0;" data-flip-padding-right="support-col">${supportColumn(left)}</td>`
    + `<td valign="top" width="50%" style="padding:0 0 0 ${SPACE.s4};" data-flip-padding-left="support-col">${supportColumn(right)}</td>`
    + `</tr></table>`;
  return card({ children: inner });
}

// ────────────────────────────────────────────────────────────────────────
// Commitment Banner — used in the payment-confirmed email.
// Check icon (left) + motivational text (centre) + CTA pill (right).
// ────────────────────────────────────────────────────────────────────────

export interface CommitmentBannerOptions {
  title: string;
  body: string;
  ctaHref: string;
  ctaLabel: string;
}

export function commitmentBanner({ title, body, ctaHref, ctaLabel }: CommitmentBannerOptions): string {
  const checkCell = `<td valign="middle" width="64" style="padding-right:${SPACE.s5};" data-flip-padding-right="commit">`
    + `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>`
    + `<td valign="middle" align="center" width="56" height="56" style="background-color:rgba(94,231,255,0.10);border:1px solid ${COLOR.brand.cyan};border-radius:999px;width:56px;height:56px;">${iconImg("check", { size: 30 })}</td>`
    + `</tr></table>`
    + `</td>`;
  const textCell = `<td valign="middle">`
    + `<div style="${typeStyle("body", COLOR.text.primary)}font-weight:700;" class="email-text-primary">${esc(title)}</div>`
    + `<div style="${typeStyle("bodySm", COLOR.brand.cyan)}padding-top:4px;" class="email-text-accent">${esc(body)}</div>`
    + `</td>`;
  const ctaCell = `<td valign="middle" align="right" style="padding-left:${SPACE.s5};" data-flip-padding-left="commit-cta" data-flip-text-align="commit-cta">`
    + ctaButton({ href: ctaHref, label: ctaLabel, fullWidth: false })
    + `</td>`;

  const inner = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr class="email-stack-2col">${checkCell}${textCell}${ctaCell}</tr></table>`;
  return card({ children: inner });
}

// ────────────────────────────────────────────────────────────────────────
// Email Footer — centred Y logo + ELITE COACHING wordmark + social icons.
// ────────────────────────────────────────────────────────────────────────

export interface EmailFooterOptions {
  lang: Lang;
  whatsappUrl?: string;
  instagramUrl?: string;
  supportEmail?: string;
  large?: boolean;
}

export const DEFAULT_INSTAGRAM_URL = "https://instagram.com/youssefahmed.training";
export const DEFAULT_WHATSAPP_URL = "https://wa.me/971505394754";

export function emailFooter({ lang, whatsappUrl, instagramUrl, supportEmail, large = false }: EmailFooterOptions): string {
  const isAr = lang === "ar";
  const t = (en: string, ar: string) => (isAr ? ar : en);

  // Frame-spec: the footer ALWAYS surfaces all three reach-out channels
  // (WhatsApp, Instagram, Email). Builders may override the URLs, but
  // the row composition is fixed.
  const whatsHref = whatsappUrl || DEFAULT_WHATSAPP_URL;
  const igHref = instagramUrl || DEFAULT_INSTAGRAM_URL;
  const iconSize = large ? 26 : 22;
  const socials: string[] = [
    `<a href="${esc(whatsHref)}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block;padding:0 14px;">${iconImg("whatsapp", { color: COLOR.text.secondary, size: iconSize, alt: "WhatsApp" })}</a>`,
    `<a href="${esc(igHref)}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block;padding:0 14px;">${iconImg("instagram", { color: COLOR.text.secondary, size: iconSize, alt: "Instagram" })}</a>`,
  ];
  if (supportEmail) {
    socials.push(`<a href="mailto:${esc(supportEmail)}" target="_blank" rel="noopener" style="text-decoration:none;display:inline-block;padding:0 14px;">${iconImg("envelope", { color: COLOR.text.secondary, size: iconSize, alt: "Email" })}</a>`);
  }
  const socialRow = socials.length
    ? `<div style="text-align:center;padding-top:${SPACE.s5};">${socials.join("")}</div>`
    : "";

  const year = new Date().getFullYear();
  const copy = t(
    `© ${year} Youssef Elite Coaching. All rights reserved.`,
    `© ${year} يوسف إيليت كوتشينج. جميع الحقوق محفوظة.`,
  );

  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.footer};background-image:${FOOTER_GRADIENT};">`
    + `<tr><td class="email-pad email-footer-pad" align="center" style="padding:${SPACE.s8} ${SPACE.s7} ${SPACE.s7};text-align:center;">`
    + `<div style="text-align:center;">${brandLockup("center", large ? "md" : "sm")}</div>`
    + socialRow
    + `<div style="${typeStyle("bodySm", COLOR.text.tertiary)}text-align:center;padding-top:${SPACE.s5};" class="email-text-tertiary">${esc(copy)}</div>`
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Legacy footer (kept for builders that still pass FooterOptions).
// Delegates to emailFooter under the new design.
// ────────────────────────────────────────────────────────────────────────

export interface FooterOptions {
  lang: Lang;
  supportEmail: string;
  unsubscribeUrl?: string;
  manageUrl?: string;
  whatsappUrl?: string;
  studioLocation?: string;
}

export function footer(opts: FooterOptions): string {
  void opts.unsubscribeUrl;
  void opts.manageUrl;
  void opts.studioLocation;
  return emailFooter({
    lang: opts.lang,
    whatsappUrl: opts.whatsappUrl,
    supportEmail: opts.supportEmail,
  });
}

// ────────────────────────────────────────────────────────────────────────
// Section eyebrow — quiet uppercase cyan single line.
// ────────────────────────────────────────────────────────────────────────

let __sectionEyebrowCounter = 0;
export function sectionEyebrow({ label }: { label: string }): string {
  void __sectionEyebrowCounter;
  return `<div style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;" class="email-text-accent">${esc(label)}</div>`;
}

// ────────────────────────────────────────────────────────────────────────
// Pull quote — italic with cyan opening glyph + attribution.
// ────────────────────────────────────────────────────────────────────────

export function pullQuote({ text, attribution }: { text: string; attribution?: string }): string {
  const attribHtml = attribution
    ? `<div style="text-align:center;padding-top:${SPACE.s3};"><span style="${typeStyle("bodySm", COLOR.brand.cyan)}font-weight:700;" class="email-text-accent">— ${esc(attribution)}</span></div>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr>`
    + `<td align="center" style="padding:${SPACE.s5} ${SPACE.s4};text-align:center;" data-flip-text-align="pull-quote">`
    + `<div style="text-align:center;"><span style="font-size:22px;font-weight:900;color:${COLOR.brand.cyan};padding-right:6px;" class="email-text-accent">&ldquo;</span>`
    + `<span class="email-pull-quote email-text-primary" style="${typeStyle("pullQuote", COLOR.text.primary)}font-style:italic;">${esc(text)}</span></div>`
    + attribHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Headings + text blocks.
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
  text, size = "body", color = "secondary", align = "left", raw = false,
}: TextBlockOptions): string {
  const inner = raw ? text : esc(text);
  const typeClass = size === "bodyLg" ? "email-body-lg" : size === "body" ? "email-body" : "";
  const cls = `${TEXT_COLOR_CLASS[color]}${typeClass ? " " + typeClass : ""}`;
  return `<p style="${typeStyle(size, colorOf(color))}text-align:${align};" class="${cls}">${inner}</p>`;
}

// ────────────────────────────────────────────────────────────────────────
// Spacer / divider.
// ────────────────────────────────────────────────────────────────────────

export type SpaceKey = keyof typeof SPACE;

export function spacer(size: SpaceKey = "s4"): string {
  return `<div style="line-height:${SPACE[size]};height:${SPACE[size]};font-size:1px;mso-line-height-rule:exactly;">&nbsp;</div>`;
}

export function divider(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-divider" style="font-size:0;line-height:1px;height:1px;border-top:1px solid ${COLOR.border.divider};background-image:${ACCENT_RULE_GRADIENT};">&nbsp;</td></tr>`
    + `</table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Severity banner (kept for backward compat with packageExpiring3d).
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
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="${tintClass}" style="background-color:${sev.tint};border:1px solid ${sev.border};border-radius:${RADIUS.md};">`
    + `<tr><td style="padding:${SPACE.s5} ${SPACE.s5};" data-flip-padding-left="severity">`
    + `<table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:0 0 ${SPACE.s3};"><tr>`
    + `<td style="background-color:${sev.accent};color:${COLOR.text.onAccent};padding:4px 10px;border-radius:${RADIUS.sm};${typeStyle("microSm", COLOR.text.onAccent)}text-transform:uppercase;" class="${accentClass}">${esc(sev.label)}</td>`
    + `</tr></table>`
    + `<div style="${typeStyle("h2", COLOR.text.primary)}" class="email-text-primary">${esc(title)}</div>`
    + bodyHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Key-value list (kept for backward compat).
// ────────────────────────────────────────────────────────────────────────

export interface KeyValueListOptions {
  items: Array<{ label: string; value: string | null | undefined }>;
}

export function keyValueList({ items }: KeyValueListOptions): string {
  const filtered = items.filter((it) => it.value !== null && it.value !== undefined && String(it.value).trim() !== "");
  if (!filtered.length) return "";
  const pairs: Array<typeof filtered> = [];
  for (let i = 0; i < filtered.length; i += 2) pairs.push(filtered.slice(i, i + 2));
  const rows = pairs
    .map((pair, ri) => {
      const topGap = ri === 0 ? "0" : SPACE.s5;
      const borderTop = ri === 0 ? "" : `border-top:1px solid ${COLOR.border.divider};`;
      const innerPadTop = ri === 0 ? "0" : SPACE.s5;
      const cell = (it: typeof pair[number], ci: number): string => {
        const padLeft = ci === 0 ? "0" : SPACE.s6;
        return `<td valign="top" width="50%" class="email-kv-cell" style="padding:${innerPadTop} 0 0 ${padLeft};" data-flip-padding-left="kv">`
          + `<div style="${typeStyle("micro", COLOR.text.tertiary)}text-transform:uppercase;" class="email-text-tertiary">${esc(it.label)}</div>`
          + `<div dir="auto" style="${typeStyle("bodyLg", COLOR.text.primary)}padding-top:6px;font-weight:600;" class="email-text-primary email-body-lg">${esc(it.value as string)}</div>`
          + `</td>`;
      };
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
// Metric grid (kept for packageCompleted).
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
          const padLeft = ci === 0 ? "0" : SPACE.s4;
          return `<td valign="top" width="50%" style="padding-left:${padLeft};padding-top:${topGap};" data-flip-padding-left="metric">`
            + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:${COLOR.bg.secondary};border:1px solid ${COLOR.border.cyanSoft};border-radius:${RADIUS.md};">`
            + `<tr><td style="padding:${SPACE.s6} ${SPACE.s5};">`
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
// Feature grid — 4-column icon row (used in welcome).
// ────────────────────────────────────────────────────────────────────────

export interface FeatureGridOptions {
  items: Array<{ icon: IconKey; title: string; body: string }>;
}

export function featureGrid({ items }: FeatureGridOptions): string {
  const cells = items
    .map((it) =>
      `<td valign="top" align="center" width="25%" style="padding:0 ${SPACE.s2};text-align:center;">`
      + `<div style="text-align:center;padding-bottom:${SPACE.s3};">${iconImg(it.icon, { size: 26 })}</div>`
      + `<div style="${typeStyle("micro", COLOR.text.primary)}text-transform:uppercase;letter-spacing:0.14em;font-weight:700;" class="email-text-primary">${esc(it.title)}</div>`
      + `<div style="${typeStyle("bodySm", COLOR.text.secondary)}padding-top:6px;" class="email-text-secondary">${esc(it.body)}</div>`
      + `</td>`,
    )
    .join("");
  const inner = `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr class="email-stack-2col">${cells}</tr></table>`;
  return card({ children: inner });
}

// ────────────────────────────────────────────────────────────────────────
// Steps card — chevron list of next actions (used in welcome).
// ────────────────────────────────────────────────────────────────────────

export interface StepsCardOptions {
  headerLabel: string;
  items: Array<{ icon: IconKey; title: string; body: string }>;
}

export function stepsCard({ headerLabel, items }: StepsCardOptions): string {
  const rows = items
    .map((it, idx) => {
      const borderTop = idx === 0 ? "" : `border-top:1px solid ${CARD_DIVIDER};`;
      const padTop = idx === 0 ? "0" : SPACE.s4;
      return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="${borderTop}"><tr>`
        + `<td valign="middle" width="50" style="padding:${padTop} 14px ${idx === items.length - 1 ? "0" : SPACE.s4} 0;" data-flip-padding-right="step-icon">`
        + `<table role="presentation" cellspacing="0" cellpadding="0" border="0"><tr>`
        + `<td valign="middle" align="center" width="44" height="44" style="background-color:rgba(94,231,255,0.08);border:1px solid ${COLOR.border.cyan};border-radius:999px;width:44px;height:44px;">${iconImg(it.icon, { size: 22 })}</td>`
        + `</tr></table>`
        + `</td>`
        + `<td valign="middle" style="padding:${padTop} 0 ${idx === items.length - 1 ? "0" : SPACE.s4};">`
        + `<div style="${typeStyle("body", COLOR.text.primary)}font-weight:700;" class="email-text-primary">${esc(it.title)}</div>`
        + `<div style="${typeStyle("bodySm", COLOR.text.secondary)}padding-top:2px;" class="email-text-secondary">${esc(it.body)}</div>`
        + `</td>`
        + `<td valign="middle" width="22" align="right" style="padding:${padTop} 0 ${idx === items.length - 1 ? "0" : SPACE.s4};" data-flip-text-align="step-chev">${iconImg("chevron", { color: COLOR.text.tertiary, size: 18 })}</td>`
        + `</tr></table>`;
    })
    .join("");
  const inner = `<div style="${typeStyle("micro", COLOR.brand.cyan)}text-transform:uppercase;padding-bottom:${SPACE.s5};" class="email-text-accent">${esc(headerLabel)}</div>${rows}`;
  return card({ children: inner });
}

// ────────────────────────────────────────────────────────────────────────
// Section wrapper — applies consistent horizontal page padding.
// ────────────────────────────────────────────────────────────────────────

export function section(children: string, opts?: { topGap?: SpaceKey }): string {
  const top = opts?.topGap ? SPACE[opts.topGap] : SPACE.s6;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-pad" style="padding:${top} ${SPACE.s7} 0;">${children}</td></tr>`
    + `</table>`;
}

// Re-export for builders that referenced CARD_HEADER_GRADIENT.
void CARD_HEADER_GRADIENT;
