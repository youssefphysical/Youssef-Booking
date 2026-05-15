/**
 * Email primitives — the foundation engine.
 *
 * Hard contract (locked per Phase 3A engineering constraints):
 *   1. Every visual value resolves through tokens.ts. No literals here.
 *   2. Outlook hacks (VML, MSO conditionals) are CONTAINED inside the
 *      single primitive that needs them (ctaButton). They never leak
 *      into other component APIs or call sites.
 *   3. Each primitive owns ONE responsibility. No god components.
 *   4. APIs are rigid by design — visual stability wins over flexibility.
 *      If a builder needs a new variant, evolve a primitive, never a
 *      one-off override.
 *   5. Every primitive is table-based, inline-styled, and degrades
 *      gracefully when images, webfonts, or modern CSS are stripped.
 */

import {
  COLOR,
  RADIUS,
  SEVERITY,
  SPACE,
  TYPE,
  WIDTH,
  HERO_GRADIENT,
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

const TYPE_KEYS = ["display", "h1", "h2", "h3", "body", "bodySm", "caption", "metric"] as const;
type TypeKey = (typeof TYPE_KEYS)[number];

const TEXT_COLOR_CLASS = {
  primary: "email-text-primary",
  secondary: "email-text-secondary",
  tertiary: "email-text-tertiary",
} as const;

type TextColor = keyof typeof TEXT_COLOR_CLASS;
type Align = "left" | "center" | "right";

function typeStyle(key: TypeKey, color: string): string {
  const t = TYPE[key];
  return `margin:0;font-size:${t.size};line-height:${t.lh};font-weight:${t.weight};color:${color};`;
}

// ────────────────────────────────────────────────────────────────────────
// Shell — the only full-document primitive.
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
  // The DARK_MODE_OVERRIDES placeholder is replaced by post-process.applyDarkOverrides.
  return [
    `<!DOCTYPE html>`,
    `<html lang="${esc(lang)}" dir="${dir}" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">`,
    `<head>`,
    `<meta charset="utf-8">`,
    `<meta name="viewport" content="width=device-width,initial-scale=1">`,
    `<meta name="x-apple-disable-message-reformatting">`,
    `<meta name="color-scheme" content="light dark">`,
    `<meta name="supported-color-schemes" content="light dark">`,
    `<title></title>`,
    // Outlook DPI/anti-blur fix — contained here, never leaks elsewhere.
    `<!--[if mso]><xml><o:OfficeDocumentSettings><o:PixelsPerInch>96</o:PixelsPerInch></o:OfficeDocumentSettings></xml><![endif]-->`,
    `<style type="text/css">`,
    // Mobile cliff — single breakpoint per tokens.BREAKPOINT_MOBILE.
    `@media only screen and (max-width:480px){`,
    `.email-shell{width:100% !important;}`,
    `.email-pad{padding-left:20px !important;padding-right:20px !important;}`,
    `.email-cta-cell a{display:block !important;width:auto !important;}`,
    `.email-stack-2col>td{display:block !important;width:100% !important;}`,
    `.email-stack-2col>td+td{padding-top:${SPACE.s4} !important;}`,
    `}`,
    // Remove default link blueing on iOS (phone numbers, addresses).
    `a[x-apple-data-detectors]{color:inherit !important;text-decoration:none !important;}`,
    `</style>`,
    `<!-- DARK_MODE_OVERRIDES -->`,
    `</head>`,
    `<body style="margin:0;padding:0;background-color:${COLOR.bg.canvas};font-family:${family};-webkit-text-size-adjust:100%;-ms-text-size-adjust:100%;" class="email-canvas">`,
    // Preheader — hidden, but sits in inbox preview.
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
// Brand header — wordmark-only. No image dependency (per Hero Discipline:
// utility / transactional / warning emails get a plain header, not a hero).
// ────────────────────────────────────────────────────────────────────────

export function brandHeader(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-pad" style="padding:${SPACE.s5} ${SPACE.s5} ${SPACE.s4};">`
    + `<span style="font-family:inherit;font-size:13px;line-height:1;font-weight:600;letter-spacing:0.18em;text-transform:uppercase;color:${COLOR.brand.cyan};" class="email-text-primary">YOUSSEF AHMED</span>`
    + `<span style="font-family:inherit;font-size:13px;line-height:1;font-weight:500;letter-spacing:0.18em;text-transform:uppercase;color:${COLOR.text.tertiary};" class="email-text-tertiary">&nbsp;·&nbsp;PERSONAL TRAINING</span>`
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Hero — ALLOWED ONLY for: welcome, package-completed, transformation
// milestone, payment-confirmed (light), promo onboarding. Builders for
// reminders / warnings / ops alerts MUST use brandHeader instead.
// ────────────────────────────────────────────────────────────────────────

export interface HeroOptions {
  eyebrow?: string;
  title: string;
  subtitle?: string;
}

export function hero({ eyebrow, title, subtitle }: HeroOptions): string {
  const eyebrowHtml = eyebrow
    ? `<div style="font-size:12px;line-height:1.4;font-weight:600;letter-spacing:0.16em;text-transform:uppercase;color:${COLOR.brand.cyan};padding-bottom:${SPACE.s3};">${esc(eyebrow)}</div>`
    : "";
  const subtitleHtml = subtitle
    ? `<div style="${typeStyle("body", COLOR.text.secondary)}padding-top:${SPACE.s3};" class="email-text-secondary">${esc(subtitle)}</div>`
    : "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:${HERO_GRADIENT};">`
    + `<tr><td class="email-pad" style="padding:${SPACE.s7} ${SPACE.s5} ${SPACE.s6};">`
    + eyebrowHtml
    + `<h1 style="${typeStyle("display", COLOR.text.primary)}" class="email-text-primary">${esc(title)}</h1>`
    + subtitleHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Card — single raised surface. Use ONE per email when possible.
// ────────────────────────────────────────────────────────────────────────

export interface CardOptions {
  children: string;
  /** Default = "default". "raised" lifts onto the canvas with stronger border. */
  variant?: "default" | "raised";
}

export function card({ children, variant = "default" }: CardOptions): string {
  const surfaceClass = variant === "raised" ? "email-surface-raised" : "email-surface";
  const bg = variant === "raised" ? COLOR.bg.surfaceRaised : COLOR.bg.surface;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="${surfaceClass}" style="background-color:${bg};border:1px solid ${COLOR.border.subtle};border-radius:${RADIUS.lg};">`
    + `<tr><td class="email-pad" style="padding:${SPACE.s6} ${SPACE.s5};">`
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
  const colorVal = COLOR.text[color === "primary" ? "primary" : color === "secondary" ? "secondary" : "tertiary"];
  const tag = `h${level}`;
  return `<${tag} style="${typeStyle(typeKey, colorVal)}text-align:${align};" class="${TEXT_COLOR_CLASS[color]}">${esc(text)}</${tag}>`;
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
  const colorVal =
    color === "primary" ? COLOR.text.primary
    : color === "secondary" ? COLOR.text.secondary
    : COLOR.text.tertiary;
  const inner = raw ? text : esc(text);
  return `<p style="${typeStyle(size, colorVal)}text-align:${align};" class="${TEXT_COLOR_CLASS[color]}">${inner}</p>`;
}

// ────────────────────────────────────────────────────────────────────────
// Spacer & divider — explicit rhythm primitives. No margin-collapse drama.
// ────────────────────────────────────────────────────────────────────────

export type SpaceKey = keyof typeof SPACE;

export function spacer(size: SpaceKey = "s4"): string {
  return `<div style="line-height:${SPACE[size]};height:${SPACE[size]};font-size:1px;mso-line-height-rule:exactly;">&nbsp;</div>`;
}

export function divider(): string {
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-divider" style="font-size:0;line-height:0;border-top:1px solid ${COLOR.border.subtle};">&nbsp;</td></tr>`
    + `</table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Severity banner — the ONLY way to communicate severity context.
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
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" class="${tintClass}" style="background-color:${sev.tint};border-radius:${RADIUS.md};">`
    + `<tr><td style="padding:${SPACE.s4} ${SPACE.s5};border-${"left"}:3px solid ${sev.accent};" data-flip-padding-left="severity">`
    + `<div style="font-size:11px;line-height:1;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:${sev.accent};" class="${accentClass}">${esc(sev.label)}</div>`
    + `<div style="${typeStyle("h3", COLOR.text.primary)}padding-top:${SPACE.s2};" class="email-text-primary">${esc(title)}</div>`
    + bodyHtml
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// CTA button — the ONLY action primitive. Outlook VML is CONTAINED here.
// One primary per email; secondary/tertiary live as ctaTextLink below.
// ────────────────────────────────────────────────────────────────────────

export interface CtaButtonOptions {
  href: string;
  label: string;
  /** "brand" = cyan (default). Severity variants for action-on-context emails. */
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
    `<v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="22%" stroke="f" fillcolor="${bg}">`,
    `<w:anchorlock/>`,
    `<center style="color:${textColor};font-family:Arial,sans-serif;font-size:15px;font-weight:600;">${safeLabel}</center>`,
    `</v:roundrect>`,
    `<![endif]-->`,
  ].join("");
  const html = [
    `<table role="presentation" cellspacing="0" cellpadding="0" border="0" align="center" style="margin:0 auto;">`,
    `<tr><td class="email-cta-cell" align="center" style="border-radius:${RADIUS.md};background-color:${bg};">`,
    vml,
    `<!--[if !mso]><!-- -->`,
    `<a href="${safeHref}" target="_blank" rel="noopener" class="${ctaClass}" style="display:inline-block;padding:14px 28px;font-family:inherit;font-size:15px;line-height:1;font-weight:600;color:${textColor};text-decoration:none;border-radius:${RADIUS.md};background-color:${bg};mso-hide:all;">${safeLabel}</a>`,
    `<!--<![endif]-->`,
    `</td></tr></table>`,
  ].join("");
  return html;
}

/** Secondary action — text link only. Rule: max one per email. */
export function ctaTextLink({ href, label }: { href: string; label: string }): string {
  return `<a href="${esc(href)}" target="_blank" rel="noopener" style="font-size:13px;line-height:1.5;font-weight:600;color:${COLOR.text.link};text-decoration:none;">${esc(label)} →</a>`;
}

// ────────────────────────────────────────────────────────────────────────
// Key-value list — booking details, package details, ops metadata.
// Mobile-safe (single column always — no 2-col gymnastics on phones).
// ────────────────────────────────────────────────────────────────────────

export interface KeyValueListOptions {
  items: Array<{ label: string; value: string | null | undefined }>;
}

export function keyValueList({ items }: KeyValueListOptions): string {
  const rows = items
    .filter((it) => it.value !== null && it.value !== undefined && String(it.value).trim() !== "")
    .map((it, i) => {
      const top = i === 0 ? "0" : SPACE.s3;
      // dir="auto" on the value lets mixed-content (phones, times, English
      // package names) render correctly inside RTL documents without bidi
      // reordering bugs (e.g. "+971 50…" becoming "…50 971+").
      return `<tr><td style="padding-top:${top};">`
        + `<div style="font-size:11px;line-height:1.3;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${COLOR.text.tertiary};" class="email-text-tertiary">${esc(it.label)}</div>`
        + `<div dir="auto" style="${typeStyle("body", COLOR.text.primary)}padding-top:2px;" class="email-text-primary">${esc(it.value as string)}</div>`
        + `</td></tr>`;
    })
    .join("");
  if (!rows) return "";
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">${rows}</table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Metric grid — 2-up on desktop, stacks on mobile via .email-stack-2col.
// Use sparingly (max 4 metrics) per Weight Control rule.
// ────────────────────────────────────────────────────────────────────────

export interface MetricGridOptions {
  items: Array<{ label: string; value: string }>;
}

export function metricGrid({ items }: MetricGridOptions): string {
  if (!items.length) return "";
  // Group into rows of 2.
  const rows: Array<typeof items> = [];
  for (let i = 0; i < items.length; i += 2) rows.push(items.slice(i, i + 2));
  const html = rows
    .map((pair, ri) => {
      // Inter-row gap: padding-top on <tr> is ignored — must live on cells.
      const topGap = ri === 0 ? "0" : SPACE.s5;
      const cells = pair
        .map((it, ci) => {
          const padLeft = ci === 0 ? "0" : SPACE.s4;
          return `<td valign="top" width="50%" style="padding-left:${padLeft};padding-top:${topGap};">`
            + `<div style="font-size:11px;line-height:1.3;font-weight:600;letter-spacing:0.1em;text-transform:uppercase;color:${COLOR.text.tertiary};" class="email-text-tertiary">${esc(it.label)}</div>`
            + `<div dir="auto" style="${typeStyle("metric", COLOR.text.primary)}padding-top:${SPACE.s1};" class="email-text-primary">${esc(it.value)}</div>`
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
// Footer — legal + support + unsubscribe. One per email, always.
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
    ? "خدمة تدريب شخصي متميزة في دبي."
    : "Premium personal training in Dubai.";
  const links: string[] = [
    `<a href="mailto:${esc(supportEmail)}" style="color:${COLOR.text.tertiary};text-decoration:underline;">${supportLabel}</a>`,
  ];
  if (manageUrl) {
    links.push(`<a href="${esc(manageUrl)}" style="color:${COLOR.text.tertiary};text-decoration:underline;">${manageLabel}</a>`);
  }
  if (unsubscribeUrl) {
    links.push(`<a href="${esc(unsubscribeUrl)}" style="color:${COLOR.text.tertiary};text-decoration:underline;">${unsubLabel}</a>`);
  }
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-pad" align="center" style="padding:${SPACE.s6} ${SPACE.s5} ${SPACE.s7};">`
    + `<div style="${typeStyle("caption", COLOR.text.tertiary)}text-align:center;" class="email-text-tertiary">${esc(tagline)}</div>`
    + `<div style="font-size:12px;line-height:1.6;color:${COLOR.text.tertiary};text-align:center;padding-top:${SPACE.s3};" class="email-text-tertiary">${links.join(" &nbsp;·&nbsp; ")}</div>`
    + `</td></tr></table>`;
}

// ────────────────────────────────────────────────────────────────────────
// Section wrapper — applies horizontal page padding consistently.
// Use for any block that should sit flush to canvas edges on mobile.
// ────────────────────────────────────────────────────────────────────────

export function section(children: string, opts?: { topGap?: SpaceKey }): string {
  const top = opts?.topGap ? SPACE[opts.topGap] : SPACE.s5;
  return `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0">`
    + `<tr><td class="email-pad" style="padding:${top} ${SPACE.s5} 0;">${children}</td></tr>`
    + `</table>`;
}
