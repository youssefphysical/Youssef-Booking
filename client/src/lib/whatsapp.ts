export const DEFAULT_WHATSAPP_NUMBER = "971505394754";

export function whatsappUrl(number?: string | null, message?: string): string {
  const n = (number || DEFAULT_WHATSAPP_NUMBER).replace(/[^\d]/g, "");
  const base = `https://wa.me/${n}`;
  return message ? `${base}?text=${encodeURIComponent(message)}` : base;
}
