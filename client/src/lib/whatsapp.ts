// WhatsApp deep-link helpers. The trainer's number is configurable via
// settings.whatsappNumber; we fall back to this baked-in default so a
// freshly-deployed environment still works.
export const DEFAULT_WHATSAPP_NUMBER = "971505394754";

export function whatsappUrl(number?: string | null, message?: string): string {
  const n = (number || DEFAULT_WHATSAPP_NUMBER).replace(/[^\d]/g, "");
  const base = `https://wa.me/${n}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}

// Pre-filled message builders for trainer-facing client requests.
// Keep "Youssef Ahmed" and "WhatsApp" in Latin per brand rules, but the
// surrounding language is the client's UI language so the message is
// readable to both client and trainer.
export type WhatsAppKind = "requestRenewal" | "requestExtension" | "contactCoach";

export interface WhatsAppContext {
  clientName?: string | null;
  packageLabel?: string | null;
  packageId?: number | null;
  requestedPackageLabel?: string | null;
  requestedDays?: number | null;
  reason?: string | null;
  remaining?: number | null;
  expiryDate?: string | null;
}

export function buildWhatsappMessage(kind: WhatsAppKind, ctx: WhatsAppContext = {}): string {
  const name = (ctx.clientName || "").trim();
  const greeting = name ? `Hello Youssef, this is ${name}.` : "Hello Youssef,";

  switch (kind) {
    case "requestRenewal": {
      const wanted = ctx.requestedPackageLabel ? ` (${ctx.requestedPackageLabel})` : "";
      return `${greeting}\n\nI'd like to renew my training package${wanted}. Please let me know the next steps and how to confirm the payment.\n\nThank you.`;
    }
    case "requestExtension": {
      const days = ctx.requestedDays ? ` of about ${ctx.requestedDays} days` : "";
      const pkgRef = ctx.packageLabel ? ` for my current ${ctx.packageLabel} package` : "";
      const reason = ctx.reason ? `\n\nReason: ${ctx.reason}` : "";
      return `${greeting}\n\nI'd like to request an extension${days}${pkgRef}.${reason}\n\nThank you.`;
    }
    case "contactCoach":
    default: {
      return `${greeting}\n\nI'd like to ask a quick question about my training. When you have a moment, please let me know.\n\nThank you.`;
    }
  }
}
