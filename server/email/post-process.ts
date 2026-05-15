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
 * rewrites only — we don't parse the HTML.
 *
 * Components opt-in any element that carries directional chrome (padding,
 * margin, border, text-align, etc.) by adding ANY `data-flip-*` attribute.
 * For every such element, the entire `style="…"` attribute has every
 * left↔right pair mirrored symmetrically using a placeholder swap so the
 * two sides don't collide mid-replacement. This handles padding-left,
 * padding-right, margin-left, margin-right, border-left, border-right,
 * border-left-color/width/style (and the right-side equivalents),
 * text-align:left/right, and float:left/right — the full set we actually
 * emit from components.ts.
 */
export function applyRtl(html: string, lang: Lang): string {
  if (dirFromLang(lang) !== "rtl") return html;

  let out = html.replace(/<html ([^>]*?)dir="ltr"/i, `<html $1dir="rtl"`);

  // Visit every opening tag carrying any data-flip-* marker and mirror its
  // style attribute. The marker itself is preserved (cheap, no harm) and
  // simply acts as the opt-in signal.
  out = out.replace(
    /<([a-z][a-z0-9]*)\b([^>]*\sdata-flip-[a-z-]+="[^"]*"[^>]*)>/gi,
    (_full, tag, attrs) => {
      const mirroredAttrs = attrs.replace(
        /style="([^"]*)"/i,
        (_m: string, css: string) => `style="${mirrorDirectional(css)}"`,
      );
      return `<${tag}${mirroredAttrs}>`;
    },
  );

  return out;
}

/**
 * Symmetric left↔right swap on a single CSS declaration block. Uses a
 * sentinel placeholder so the second pass doesn't undo the first.
 *
 * We only mirror styles on elements that explicitly opted in via a
 * `data-flip-*` marker — this keeps the global RTL pass surgical and
 * avoids accidentally flipping unrelated CSS that happened to contain
 * the literal "left" or "right".
 */
function mirrorDirectional(css: string): string {
  const swap = (
    src: string,
    leftPattern: RegExp,
    leftToken: string,
    rightToken: string,
  ): string => {
    const SENTINEL = "\u0000FLIP\u0000";
    return src
      .replace(leftPattern, (m) => m.replace(leftToken, SENTINEL))
      .replace(new RegExp(rightToken, "g"), leftToken)
      .replace(new RegExp(SENTINEL, "g"), rightToken);
  };

  let out = css;
  // padding-left ↔ padding-right
  out = swap(out, /padding-left/g, "padding-left", "padding-right");
  // margin-left ↔ margin-right
  out = swap(out, /margin-left/g, "margin-left", "margin-right");
  // border-left, border-left-color, border-left-style, border-left-width
  out = swap(out, /border-left/g, "border-left", "border-right");
  // text-align: left ↔ right (only when value, not the property name)
  out = out.replace(/text-align:\s*left/gi, "text-align:__FLIP_TA_R__")
    .replace(/text-align:\s*right/gi, "text-align: left")
    .replace(/text-align:__FLIP_TA_R__/g, "text-align: right");
  // float: left ↔ right
  out = out.replace(/float:\s*left/gi, "float:__FLIP_F_R__")
    .replace(/float:\s*right/gi, "float: left")
    .replace(/float:__FLIP_F_R__/g, "float: right");
  return out;
}
