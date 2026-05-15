/**
 * Composer — the single entry point for every email builder.
 *
 * Builders call `compose({...})` with a pre-rendered body string built
 * from primitives in components.ts. The composer:
 *
 *   1. Wraps the body in the locked cinematic shell.
 *   2. Runs post-process: dark-lock overrides + RTL flip.
 *   3. Generates a plain-text fallback (or accepts an explicit one).
 *
 * Builders never touch the shell, never run post-process, and never emit
 * <html>/<body> tags themselves. This is the design lock boundary that
 * keeps every email visually identical at the system level.
 */

import { emailShell } from "./components";
import { applyDarkOverrides, applyRtl } from "./post-process";
import type { Lang, Severity } from "./tokens";

export interface ComposeInput {
  /** Inbox subject line. */
  subject: string;
  /** Inbox preview text (40–90 chars ideal). */
  preheader: string;
  lang: Lang;
  /** Severity classification. Used by quiet-hours decision upstream. */
  severity: Severity;
  /** Pre-rendered body HTML (built from components.ts primitives). */
  bodyHtml: string;
  /**
   * Optional explicit plain-text. When omitted, one is auto-derived from
   * `bodyHtml` via a conservative tag-stripper (good enough for Gmail's
   * plain-text view; builders with strict copy can pass their own).
   */
  text?: string;
}

export interface ComposedEmail {
  subject: string;
  html: string;
  text: string;
}

export function compose(input: ComposeInput): ComposedEmail {
  const { subject, preheader, lang, bodyHtml, text } = input;
  const shellHtml = emailShell({ lang, preheader, bodyHtml });
  const withDark = applyDarkOverrides(shellHtml);
  const finalHtml = applyRtl(withDark, lang);
  const finalText = text ?? deriveText(bodyHtml, preheader);
  return { subject, html: finalHtml, text: finalText };
}

/**
 * Derive a plain-text fallback from rendered HTML. Conservative — turns
 * common block tags into newlines, strips the rest, collapses whitespace.
 */
function deriveText(html: string, preheader: string): string {
  const stripped = html
    .replace(/<div[^>]*display:none[\s\S]*?<\/div>/gi, "")
    .replace(/<(br|p|div|tr|h1|h2|h3|h4|h5|h6|li)[^>]*>/gi, "\n")
    .replace(/<\/(p|div|tr|h1|h2|h3|h4|h5|h6|li)>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, " ")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  return preheader ? `${preheader}\n\n${stripped}` : stripped;
}
