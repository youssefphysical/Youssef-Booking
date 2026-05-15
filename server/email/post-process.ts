/**
 * Post-processing pipeline for rendered email HTML.
 *
 * The cinematic edition is dark-first by design — there is no light-mode
 * variant, and Gmail/iOS auto-invert is intentionally suppressed at the
 * shell level (color-scheme + supported-color-schemes meta + the
 * `[data-ogsc]` selectors below mirror the same dark surface so any
 * forced inversion produces an identical result).
 *
 *   applyDarkLock(html)  — emits the locked-dark Gmail-mobile overrides
 *                          so [data-ogsc] auto-invert produces the same
 *                          cinematic surface as the default render.
 *   applyRtl(html, lang) — flips document direction + swaps directional
 *                          spacing for Arabic.
 *
 * Both processors are pure: input string → output string. They never throw
 * and are safe to apply in any order (idempotent up to whitespace).
 */

import { COLOR, SEVERITY, type Lang, dirFromLang } from "./tokens";

/**
 * Inject the dark-lock override block into the <head>. The composer emits
 * a `<!-- DARK_MODE_OVERRIDES -->` placeholder which we replace; if the
 * placeholder is absent, we no-op to avoid corrupting unrelated HTML.
 */
export function applyDarkOverrides(html: string): string {
  if (!html.includes("<!-- DARK_MODE_OVERRIDES -->")) return html;
  const css = buildDarkLockCss();
  return html.replace(
    "<!-- DARK_MODE_OVERRIDES -->",
    `<style type="text/css">${css}</style>`,
  );
}

function buildDarkLockCss(): string {
  // Gmail mobile auto-invert applies [data-ogsc] selectors when it detects
  // a "light" surface (which Gmail Web sometimes flags incorrectly). We
  // mirror our cinematic dark tokens so even a forced inversion lands on
  // the same surface — no readability regression possible.
  const sev = (k: keyof typeof SEVERITY) => SEVERITY[k];
  return `
    [data-ogsc] body, [data-ogsc] .email-canvas { background-color: ${COLOR.bg.canvas} !important; }
    [data-ogsc] .email-surface { background-color: ${COLOR.bg.surface} !important; border-color: ${COLOR.border.cyan} !important; }
    [data-ogsc] .email-text-primary { color: ${COLOR.text.primary} !important; }
    [data-ogsc] .email-text-secondary { color: ${COLOR.text.secondary} !important; }
    [data-ogsc] .email-text-tertiary { color: ${COLOR.text.tertiary} !important; }
    [data-ogsc] .email-text-accent { color: ${COLOR.text.accent} !important; }
    [data-ogsc] .email-divider { border-color: ${COLOR.border.divider} !important; background-color: ${COLOR.border.divider} !important; }
    [data-ogsc] .email-sev-success-accent { color: ${sev("success").accent} !important; }
    [data-ogsc] .email-sev-info-accent    { color: ${sev("info").accent} !important; }
    [data-ogsc] .email-sev-warning-accent { color: ${sev("warning").accent} !important; }
    [data-ogsc] .email-sev-critical-accent{ color: ${sev("critical").accent} !important; }
    [data-ogsc] .email-cta-brand { background-color: ${COLOR.brand.cyan} !important; color: ${COLOR.text.onAccent} !important; }
    [data-ogsc] .email-cta-success { background-color: ${sev("success").accent} !important; color: ${COLOR.text.onAccent} !important; }
    [data-ogsc] .email-cta-info    { background-color: ${sev("info").accent} !important; color: ${COLOR.text.onAccent} !important; }
    [data-ogsc] .email-cta-warning { background-color: ${sev("warning").accent} !important; color: ${COLOR.text.onAccent} !important; }
    [data-ogsc] .email-cta-critical{ background-color: ${sev("critical").accent} !important; color: ${COLOR.text.onAccent} !important; }
  `.replace(/\s+/g, " ").trim();
}

/**
 * Flip the rendered HTML to RTL when the language is Arabic. Cheap textual
 * rewrites only — we don't parse the HTML. Components mark directional
 * padding with `data-flip-padding-left`/`data-flip-padding-right` so we
 * know exactly which edges to swap (avoids mauling unrelated CSS).
 */
export function applyRtl(html: string, lang: Lang): string {
  if (dirFromLang(lang) !== "rtl") return html;
  return html
    .replace(/<html ([^>]*?)dir="ltr"/i, `<html $1dir="rtl"`)
    .replace(/text-align:\s*left/gi, "text-align: right")
    .replace(/data-flip-padding-left="([^"]+)"[^>]*?padding-left:\s*([^;"]+);/gi,
      (_full, _marker, val) => `padding-right: ${val};`)
    .replace(/data-flip-padding-right="([^"]+)"[^>]*?padding-right:\s*([^;"]+);/gi,
      (_full, _marker, val) => `padding-left: ${val};`);
}
