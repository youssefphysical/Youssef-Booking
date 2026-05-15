/**
 * Email primitives — the YOUSSEF ELITE COACHING cinematic component engine.
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
 *
 * Design language: Tron Legacy + luxury performance club + dark cinematic
 * gym. Cyan glow is *restrained* — used as edge accent and CTA dominance,
 * never decorative everywhere.
 */

import {
  COLOR,
  RADIUS,
  SEVERITY,
  SPACE,
  TYPE,
  WIDTH,
  HERO_GRADIENT,
  CARD_GRADIENT,
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

const TYPE_KEYS = ["display", "displayMobile", "h1", "h2", "h3", "body", "bodySm", "caption", "metric", "micro"] as const;
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
    // Mobile-scaled display headline — brief asks for 30-38px on mobile.
    `.email-display{font-size:${TYPE.displayMobile.size} !important;line-height:${TYPE.displayMobile.lh} !important;}`,
    // Mobile hero gets tighter vertical pad.
    `.email-hero-pad{padding:${SPACE.s8} ${SPACE.s4} ${SPACE.s7} !important;}`,
    `}`,
    // Remove default link blueing on iOS (phone numbers, addresses).
    `a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}`,
    // Outlook table cellpadding zero-out.
    `table { border-collapse: collapse; }`,
    `</style>`,
    `<!-- DARK_MODE_OVERRIDES -->`,
    `</head>`,
    // Inline body bg locks the dark canvas before CSS loads.
    `<body style="margin:0;padding:0;background-color:${COLOR.bg.canvas};font-family:${family};color:${COLOR.text.primary};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;" class="email-canvas">`,
    // Preheader — hidden, but sits in inbox preview.
    `<div style="display:none;font-size:1px;line-height:1px;max-height:0;max-width:0;opacity:0;overflow:hidden;mso-hide:all;color:transparent;">${esc(preheader)}</div>`,
    // Outer canvas with vertical gradient (degrades to solid #030507).
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
// Brand header — wordmark wordmark with cinematic letter-spacing.
// Used on every email (utility, transactional, milestone alike).
// ────────────────────────────────────────────────────────────────────────

export function brandHeader(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-pad" align="center" style="padding:${SPACE.s7} ${SPACE.s7} ${SPACE.s5};">`
    + `<div style="font-family:inherit;font-size:11px;line-height:1;font-weight:700;letter-spacing:0.32em;text-transform:uppercase;color:${COLOR.brand.cyan};" class="email-text-accent">YOUSSEF AHMED</div>`
    + `<div style="font-family:inherit;font-size:10px;line-height:1;font-weight:500;letter-spacing:0.42em;text-transform:uppercase;color:${COLOR.text.tertiary};padding-top:8px;" class="email-text-tertiary">ELITE PERSONAL TRAINING</div>`
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Cinematic Hero — used for milestones, welcomes, transformation moments.
//
// Composition (per brief §HERO SYSTEM, adapted for email-client safety):
//   - Top-down stack (no LEFT/RIGHT split — unreliable across Outlook).
//   - Eyebrow tag (cyan uppercase tracked).
//   - Massive display headline with optional cyan accent word.
//   - Optional subtitle line in muted text.
//   - Background: vertical dark gradient (image-free for Gmail safety).
//
// Cinematic depth comes from typography dominance + edge glow on the
// container card, not from imagery — which keeps the email coherent
// even when remote images are blocked (Gmail default).
// ────────────────────────────────────────────────────────────────────────

export interface HeroOptions {
  eyebrow?: string;
  /**
   * Headline text. Supports a single optional `accentWord` that will be
   * rendered in the brand cyan to create the "white + cyan emphasis word"
   * pattern from the brief (e.g. title="SESSION", accentWord="CONFIRMED").
   * The accent is appended after a space for clean RTL behavior.
   */
  title: string;
  accentWord?: string;
  subtitle?: string;
  align?: Align;
}

export function hero({ eyebrow, title, accentWord, subtitle, align = "center" }: HeroOptions): string {
  const eyebrowHtml = eyebrow
    ? `<div style="font-size:11px;line-height:1.2;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${COLOR.brand.cyan};padding-bottom:${SPACE.s5};text-align:${align};" class="email-text-accent">${esc(eyebrow)}</div>`
    : "";
  const accentHtml = accentWord
    ? `<span style="color:${COLOR.brand.cyan};" class="email-text-accent">&nbsp;${esc(accentWord)}</span>`
    : "";
  const subtitleHtml = subtitle
    ? `<div style="${typeStyle("body", COLOR.text.secondary)}padding-top:${SPACE.s5};text-align:${align};max-width:480px;margin-left:auto;margin-right:auto;" class="email-text-secondary">${esc(subtitle)}</div>`
    : "";
  // The hero gradient + the locked canvas behind it create the
  // "controlled cyan glow" depth without relying on box-shadow (Outlook
  // strips it). Inline gradient degrades to solid #06090E.
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background-color:#06090E;background-image:${HERO_GRADIENT};">`
    + `<tr><td class="email-pad email-hero-pad" align="${align}" style="padding:${SPACE.s9} ${SPACE.s7} ${SPACE.s8};text-align:${align};">`
    + eyebrowHtml
    + `<h1 class="email-display email-text-primary" style="${typeStyle("display", COLOR.text.primary)}text-align:${align};text-transform:uppercase;">${esc(title)}${accentHtml}</h1>`
    + subtitleHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// HUD Card — the cinematic surface. One per email when possible.
//
// Composition:
//   - Cyan border (1px rgba(0,229,255,0.18) — primary HUD edge).
//   - Layered dark gradient bg (degrades to solid #0D1117).
//   - Inner highlight + outer glow shadow (degrades cleanly in Outlook).
//   - 18px radius (luxury HUD shape).
// ────────────────────────────────────────────────────────────────────────

export interface CardOptions {
  children: string;
  /** "default" = HUD card. "raised" = deeper panel for nested HUD blocks. */
  variant?: "default" | "raised";
}

export function card({ children, variant = "default" }: CardOptions): string {
  const surfaceClass = variant === "raised" ? "email-surface-raised" : "email-surface";
  const bg = variant === "raised" ? COLOR.bg.surfaceRaised : COLOR.bg.surface;
  const radius = variant === "raised" ? RADIUS.xl : RADIUS.lg;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="${surfaceClass}" style="background-color:${bg};background-image:${CARD_GRADIENT};border:1px solid ${COLOR.border.cyan};border-radius:${radius};box-shadow:${GLOW.card},${GLOW.innerHighlight};">`
    + `<tr><td class="email-pad" style="padding:${SPACE.s7} ${SPACE.s6};">`
    + children
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
  size?: "body" | "bodySm" | "caption";
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
// CTA button — the ONLY action primitive. Outlook VML is CONTAINED here.
// One primary per email; secondary/tertiary live as ctaTextLink below.
//
// Glow (box-shadow) is a *decorative enhancement* — clients that strip it
// (Outlook desktop) still get a solid, high-contrast cyan button.
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
  const textColor = COLOR.text.onAccent;
  const ctaClass = variant === "brand" ? "email-cta-brand" : `email-cta-${variant}`;
  // Outlook VML — contained internal hack so callers never see MSO/VML.
  const vml = [
    `<!--[if mso]>`,
    `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:52px;v-text-anchor:middle;width:260px;" arcsize="22%" stroke="f" fillcolor="${bg}">`,
    `<w:anchorlock/>`,
    `<center style="color:${textColor};font-family:Arial,sans-serif;font-size:14px;font-weight:700;letter-spacing:0.06em;text-transform:uppercase;">${safeLabel}</center>`,
    `</v:roundrect>`,
    `<![endif]-->`,
  ].join("");
  const html = [
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">`,
    `<tr><td class="email-cta-cell" align="center" style="border-radius:${RADIUS.md};background-color:${bg};box-shadow:${GLOW.cta};">`,
    vml,
    `<!--[if !mso]><!-- -->`,
    `<a href="${safeHref}" target="_blank" rel="noopener" class="${ctaClass}" style="display:inline-block;padding:16px 34px;font-family:inherit;font-size:13px;line-height:1;font-weight:700;letter-spacing:0.16em;text-transform:uppercase;color:${textColor};text-decoration:none;border-radius:${RADIUS.md};background-color:${bg};mso-hide:all;">${safeLabel}</a>`,
    `<!--<![endif]-->`,
    `</td></tr></table>`,
  ].join("");
  return html;
}

/** Secondary action — text link only. Rule: max one per email. */
export function ctaTextLink({ href, label }: { href: string; label: string }): string {
  return `<a href="${esc(href)}" target="_blank" rel="noopener" style="font-size:12px;line-height:1.5;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${COLOR.brand.cyan};text-decoration:none;" class="email-text-accent">${esc(label)} →</a>`;
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
// Footer — tagline + support + unsubscribe. Restrained, cinematic.
// ────────────────────────────────────────────────────────────────────────

export interface FooterOptions {
  lang: Lang;
  supportEmail: string;
  unsubscribeUrl?: string;
  manageUrl?: string;
}

export function footer({ lang, supportEmail, unsubscribeUrl, manageUrl }: FooterOptions): string {
  const isAr = lang === "ar";
  const supportLabel = isAr ? "الدعم" : "Support";
  const unsubLabel = isAr ? "إلغاء الاشتراك" : "Unsubscribe";
  const manageLabel = isAr ? "إدارة الإشعارات" : "Manage notifications";
  const tagline = isAr
    ? "تدريب شخصي متميز في دبي"
    : "ELITE PERSONAL TRAINING · DUBAI";
  const links: string[] = [
    `<a href="mailto:${esc(supportEmail)}" style="color:${COLOR.text.tertiary};text-decoration:none;border-bottom:1px solid ${COLOR.border.divider};padding-bottom:1px;">${supportLabel}</a>`,
  ];
  if (manageUrl) {
    links.push(`<a href="${esc(manageUrl)}" style="color:${COLOR.text.tertiary};text-decoration:none;border-bottom:1px solid ${COLOR.border.divider};padding-bottom:1px;">${manageLabel}</a>`);
  }
  if (unsubscribeUrl) {
    links.push(`<a href="${esc(unsubscribeUrl)}" style="color:${COLOR.text.tertiary};text-decoration:none;border-bottom:1px solid ${COLOR.border.divider};padding-bottom:1px;">${unsubLabel}</a>`);
  }
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-pad" align="center" style="padding:${SPACE.s8} ${SPACE.s7} ${SPACE.s9};">`
    // Hairline divider above footer (full-width).
    + `<div style="height:1px;line-height:1px;font-size:0;background-color:${COLOR.border.divider};margin-bottom:${SPACE.s7};">&nbsp;</div>`
    + `<div style="font-family:inherit;font-size:10px;line-height:1;font-weight:600;letter-spacing:0.32em;text-transform:uppercase;color:${COLOR.brand.cyanMuted};" class="email-text-accent">${esc(tagline)}</div>`
    + `<div style="font-size:12px;line-height:1.6;color:${COLOR.text.tertiary};text-align:center;padding-top:${SPACE.s5};" class="email-text-tertiary">${links.join(" &nbsp;·&nbsp; ")}</div>`
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
