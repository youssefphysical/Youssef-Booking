/**
 * Email override resolver — reads admin-configured subject/preheader overrides
 * from settings.emailSettings and applies them to already-built ComposedEmail
 * objects. Never throws: always falls back gracefully.
 */

import { storage } from "../storage";

export interface EmailOverride {
  subject?: string;
  preheader?: string;
}

/**
 * Fetch the admin-saved subject/preheader override for a given template key.
 * Returns an empty object (no override) on any error.
 */
export async function resolveEmailOverride(key: string): Promise<EmailOverride> {
  try {
    const settings = await storage.getSettings();
    const emailSettings = (settings as any).emailSettings as
      | Record<string, EmailOverride>
      | null
      | undefined;
    return emailSettings?.[key] ?? {};
  } catch {
    return {};
  }
}

/**
 * Apply subject + preheader overrides to an already-built email. Mutates
 * nothing — returns a new object. Preheader is patched via targeted regex
 * replacement of the hidden preheader div that `emailShell()` injects.
 */
export function applyEmailOverride<T extends { subject: string; html: string; text: string }>(
  composed: T,
  override: EmailOverride,
): T {
  let { subject, html, text } = composed;

  if (override.subject) {
    subject = override.subject;
  }

  if (override.preheader) {
    const escaped = override.preheader
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    html = html.replace(
      /(<div style="display:none;[^"]*mso-hide:all[^"]*">)[^<]*(<\/div>)/,
      `$1${escaped}$2`,
    );
  }

  return { ...composed, subject, html, text };
}
