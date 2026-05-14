/**
 * Post-processing pipeline for rendered email HTML.
 *
 *   applyDarkOverrides(html)  — injects @media (prefers-color-scheme: dark)
 *                               + Gmail-mobile [data-ogsc] selectors based
 *                               on the dark tokens declared in tokens.ts.
 *   applyRtl(html, lang)      — flips the document direction + swaps
 *                               directional spacing for Arabic.
 *
 * Both processors are pure: input string → output string. They never throw.
 * They are safe to apply in any order (idempotent up to whitespace).
 */

import { COLOR, SEVERITY, type Lang, dirFromLang } from "./tokens";

/**
 * Inject the dark-mode override block into the <head>. The composer emits
 * a `<!-- DARK_MODE_OVERRIDES -->` placeholder which we replace; if the
 * placeholder is absent, we no-op to avoid corrupting unrelated HTML.
 */
export function applyDarkOverrides(html: string): string {
  if (!html.includes("<!-- DARK_MODE_OVERRIDES -->")) return html;
  const css = buildDarkCss();
  return html.replace(
    "<!-- DARK_MODE_OVERRIDES -->",
    `<style type="text/css">${css}</style>`,
  );
}

function buildDarkCss(): string {
  // We attach `.email-canvas`, `.email-surface`, `.email-text-primary` etc.
  // to components in components.ts. The same class names are referenced in
  // the dark overrides + Gmail-mobile [data-ogsc] selectors below.
  const sevDark = (k: keyof typeof SEVERITY) => SEVERITY[k];
  const blocks: string[] = [];

  // Standard prefers-color-scheme block (Apple Mail, Outlook web, modern Gmail web).
  blocks.push(
    `@media (prefers-color-scheme: dark) {
      body, .email-canvas { background-color: ${COLOR.bg.canvasDark} !important; }
      .email-surface { background-color: ${COLOR.bg.surfaceDark} !important; border-color: ${COLOR.border.subtleDark} !important; }
      .email-surface-raised { background-color: ${COLOR.bg.surfaceRaisedDark} !important; }
      .email-text-primary { color: ${COLOR.text.primaryDark} !important; }
      .email-text-secondary { color: ${COLOR.text.secondaryDark} !important; }
      .email-text-tertiary { color: ${COLOR.text.tertiaryDark} !important; }
      .email-divider { border-color: ${COLOR.border.subtleDark} !important; background-color: ${COLOR.border.subtleDark} !important; }
      .email-sev-success-accent { color: ${sevDark("success").accentDark} !important; }
      .email-sev-info-accent    { color: ${sevDark("info").accentDark} !important; }
      .email-sev-warning-accent { color: ${sevDark("warning").accentDark} !important; }
      .email-sev-critical-accent{ color: ${sevDark("critical").accentDark} !important; }
      .email-sev-success-tint   { background-color: ${sevDark("success").tintDark} !important; }
      .email-sev-info-tint      { background-color: ${sevDark("info").tintDark} !important; }
      .email-sev-warning-tint   { background-color: ${sevDark("warning").tintDark} !important; }
      .email-sev-critical-tint  { background-color: ${sevDark("critical").tintDark} !important; }
      .email-cta-success { background-color: ${sevDark("success").accentDark} !important; color: ${COLOR.text.onAccentDark} !important; }
      .email-cta-info    { background-color: ${sevDark("info").accentDark} !important; color: ${COLOR.text.onAccentDark} !important; }
      .email-cta-warning { background-color: ${sevDark("warning").accentDark} !important; color: ${COLOR.text.onAccentDark} !important; }
      .email-cta-critical{ background-color: ${sevDark("critical").accentDark} !important; color: ${COLOR.text.onAccentDark} !important; }
      .email-cta-brand   { background-color: ${COLOR.brand.cyanDark} !important; color: ${COLOR.text.onAccentDark} !important; }
    }`,
  );

  // Gmail mobile (iOS/Android) auto-invert overrides — must MIRROR the
  // prefers-color-scheme block above. If text inverts but tints/CTAs don't,
  // we get unreadable contrast (white text on light cream banners, etc.).
  blocks.push(
    `[data-ogsc] body, [data-ogsc] .email-canvas { background-color: ${COLOR.bg.canvasDark} !important; }
     [data-ogsc] .email-surface { background-color: ${COLOR.bg.surfaceDark} !important; border-color: ${COLOR.border.subtleDark} !important; }
     [data-ogsc] .email-surface-raised { background-color: ${COLOR.bg.surfaceRaisedDark} !important; }
     [data-ogsc] .email-text-primary { color: ${COLOR.text.primaryDark} !important; }
     [data-ogsc] .email-text-secondary { color: ${COLOR.text.secondaryDark} !important; }
     [data-ogsc] .email-text-tertiary { color: ${COLOR.text.tertiaryDark} !important; }
     [data-ogsc] .email-divider { border-color: ${COLOR.border.subtleDark} !important; background-color: ${COLOR.border.subtleDark} !important; }
     [data-ogsc] .email-sev-success-accent { color: ${sevDark("success").accentDark} !important; }
     [data-ogsc] .email-sev-info-accent    { color: ${sevDark("info").accentDark} !important; }
     [data-ogsc] .email-sev-warning-accent { color: ${sevDark("warning").accentDark} !important; }
     [data-ogsc] .email-sev-critical-accent{ color: ${sevDark("critical").accentDark} !important; }
     [data-ogsc] .email-sev-success-tint   { background-color: ${sevDark("success").tintDark} !important; }
     [data-ogsc] .email-sev-info-tint      { background-color: ${sevDark("info").tintDark} !important; }
     [data-ogsc] .email-sev-warning-tint   { background-color: ${sevDark("warning").tintDark} !important; }
     [data-ogsc] .email-sev-critical-tint  { background-color: ${sevDark("critical").tintDark} !important; }
     [data-ogsc] .email-cta-success { background-color: ${sevDark("success").accentDark} !important; color: ${COLOR.text.onAccentDark} !important; }
     [data-ogsc] .email-cta-info    { background-color: ${sevDark("info").accentDark} !important; color: ${COLOR.text.onAccentDark} !important; }
     [data-ogsc] .email-cta-warning { background-color: ${sevDark("warning").accentDark} !important; color: ${COLOR.text.onAccentDark} !important; }
     [data-ogsc] .email-cta-critical{ background-color: ${sevDark("critical").accentDark} !important; color: ${COLOR.text.onAccentDark} !important; }
     [data-ogsc] .email-cta-brand   { background-color: ${COLOR.brand.cyanDark} !important; color: ${COLOR.text.onAccentDark} !important; }`,
  );

  return blocks.join("\n").replace(/\s+/g, " ");
}

/**
 * Flip the rendered HTML to RTL when the language is Arabic. Cheap textual
 * rewrites only — we don't parse the HTML. The composer pre-emptively emits
 * `data-ltr` markers we can target if a deeper flip is ever needed.
 */
export function applyRtl(html: string, lang: Lang): string {
  if (dirFromLang(lang) !== "rtl") return html;
  // Replace the head-level direction marker.
  return html
    .replace(/<html ([^>]*?)dir="ltr"/i, `<html $1dir="rtl"`)
    .replace(/text-align:\s*left/gi, "text-align: right")
    .replace(/data-flip-padding-left="([^"]+)"[^>]*?padding-left:\s*([^;"]+);/gi,
      (_full, _marker, val) => `padding-right: ${val};`)
    .replace(/data-flip-padding-right="([^"]+)"[^>]*?padding-right:\s*([^;"]+);/gi,
      (_full, _marker, val) => `padding-left: ${val};`);
}
