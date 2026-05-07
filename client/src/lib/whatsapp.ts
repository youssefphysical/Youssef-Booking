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
// surrounding language follows the client's UI language so the message
// is readable to both client and trainer in the channel they prefer.
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
  /** UI language code, e.g. "en", "ar", "fa", "ur", "de", "fr", "ru". */
  lang?: string | null;
}

// Inline i18n table for WhatsApp messages. Kept small + dependency-free
// rather than reaching into the React i18n context so this helper can
// be called from event handlers, server-rendered code, or any context
// without a Provider in the tree. EN is the source of truth and the
// guaranteed fallback for any language not listed below.
type Phrasebook = {
  greetingNamed: (name: string) => string;
  greetingPlain: string;
  closing: string;
  renewal: (pkg: string) => string;
  extension: (pkg: string, days: string, reason: string) => string;
  extensionDays: (n: number) => string;
  extensionReason: (r: string) => string;
  contact: string;
};

const PHRASES: Record<string, Phrasebook> = {
  en: {
    greetingNamed: (name) => `Hello Coach Youssef, this is ${name}.`,
    greetingPlain: "Hello Coach Youssef,",
    closing: "Thank you.",
    renewal: (pkg) =>
      `I'd like to renew my training package${pkg}. Please let me know the next steps and how to confirm the payment.`,
    extension: (pkg, days, reason) =>
      `I'd like to request an extension${days}${pkg}.${reason}`,
    extensionDays: (n) => ` of about ${n} days`,
    extensionReason: (r) => `\n\nReason: ${r}`,
    contact:
      "I'd like to ask a quick question about my training. When you have a moment, please let me know.",
  },
  ar: {
    greetingNamed: (name) => `مرحبًا كوتش يوسف، أنا ${name}.`,
    greetingPlain: "مرحبًا كوتش يوسف،",
    closing: "شكرًا لك.",
    renewal: (pkg) =>
      `أرغب في تجديد باقة التدريب الخاصة بي${pkg}. أرجو إخباري بالخطوات التالية وكيفية تأكيد الدفع.`,
    extension: (pkg, days, reason) =>
      `أرغب في طلب تمديد${days}${pkg}.${reason}`,
    extensionDays: (n) => ` لمدة حوالي ${n} يومًا`,
    extensionReason: (r) => `\n\nالسبب: ${r}`,
    contact:
      "لدي سؤال سريع بخصوص تدريبي. عندما يكون لديك وقت، أرجو إعلامي.",
  },
  fa: {
    greetingNamed: (name) => `سلام مربی یوسف، من ${name} هستم.`,
    greetingPlain: "سلام مربی یوسف،",
    closing: "متشکرم.",
    renewal: (pkg) =>
      `مایلم بسته تمرین خود را تمدید کنم${pkg}. لطفاً مراحل بعدی و نحوه تأیید پرداخت را اطلاع دهید.`,
    extension: (pkg, days, reason) =>
      `مایلم درخواست تمدید${days}${pkg} داشته باشم.${reason}`,
    extensionDays: (n) => ` حدود ${n} روز`,
    extensionReason: (r) => `\n\nدلیل: ${r}`,
    contact:
      "می‌خواهم یک سؤال کوتاه درباره تمرینم بپرسم. هر زمان که فرصت داشتید، لطفاً اطلاع دهید.",
  },
  ur: {
    greetingNamed: (name) => `السلام علیکم کوچ یوسف، میں ${name} ہوں۔`,
    greetingPlain: "السلام علیکم کوچ یوسف،",
    closing: "شکریہ۔",
    renewal: (pkg) =>
      `میں اپنا ٹریننگ پیکج رینیو کرنا چاہتا/چاہتی ہوں${pkg}۔ براہ کرم اگلے اقدامات اور ادائیگی کی تصدیق کا طریقہ بتائیں۔`,
    extension: (pkg, days, reason) =>
      `میں توسیع کی درخواست کرنا چاہتا/چاہتی ہوں${days}${pkg}۔${reason}`,
    extensionDays: (n) => ` تقریباً ${n} دن کی`,
    extensionReason: (r) => `\n\nوجہ: ${r}`,
    contact:
      "میں اپنی ٹریننگ کے بارے میں ایک مختصر سوال پوچھنا چاہتا/چاہتی ہوں۔ جب آپ کو وقت ہو، براہ کرم بتائیں۔",
  },
  de: {
    greetingNamed: (name) => `Hallo Coach Youssef, hier ist ${name}.`,
    greetingPlain: "Hallo Coach Youssef,",
    closing: "Vielen Dank.",
    renewal: (pkg) =>
      `Ich möchte mein Trainingspaket verlängern${pkg}. Bitte teile mir die nächsten Schritte und die Zahlungsbestätigung mit.`,
    extension: (pkg, days, reason) =>
      `Ich möchte eine Verlängerung beantragen${days}${pkg}.${reason}`,
    extensionDays: (n) => ` um etwa ${n} Tage`,
    extensionReason: (r) => `\n\nGrund: ${r}`,
    contact:
      "Ich habe eine kurze Frage zu meinem Training. Wenn du Zeit hast, gib mir bitte Bescheid.",
  },
  fr: {
    greetingNamed: (name) => `Bonjour Coach Youssef, c'est ${name}.`,
    greetingPlain: "Bonjour Coach Youssef,",
    closing: "Merci.",
    renewal: (pkg) =>
      `Je souhaite renouveler mon forfait d'entraînement${pkg}. Merci de m'indiquer les prochaines étapes et la confirmation du paiement.`,
    extension: (pkg, days, reason) =>
      `Je souhaite demander une prolongation${days}${pkg}.${reason}`,
    extensionDays: (n) => ` d'environ ${n} jours`,
    extensionReason: (r) => `\n\nRaison : ${r}`,
    contact:
      "J'ai une petite question concernant mon entraînement. Quand tu auras un moment, merci de me répondre.",
  },
  ru: {
    greetingNamed: (name) => `Здравствуйте, тренер Юссеф, это ${name}.`,
    greetingPlain: "Здравствуйте, тренер Юссеф,",
    closing: "Спасибо.",
    renewal: (pkg) =>
      `Я хотел(а) бы продлить свой тренировочный пакет${pkg}. Сообщите, пожалуйста, дальнейшие шаги и как подтвердить оплату.`,
    extension: (pkg, days, reason) =>
      `Я хотел(а) бы запросить продление${days}${pkg}.${reason}`,
    extensionDays: (n) => ` примерно на ${n} дней`,
    extensionReason: (r) => `\n\nПричина: ${r}`,
    contact:
      "У меня есть короткий вопрос по тренировке. Когда будет минутка, дайте знать, пожалуйста.",
  },
};

function pickPhrasebook(lang?: string | null): Phrasebook {
  const code = (lang || "en").slice(0, 2).toLowerCase();
  return PHRASES[code] ?? PHRASES.en;
}

export function buildWhatsappMessage(kind: WhatsAppKind, ctx: WhatsAppContext = {}): string {
  const p = pickPhrasebook(ctx.lang);
  const name = (ctx.clientName || "").trim();
  const greeting = name ? p.greetingNamed(name) : p.greetingPlain;

  switch (kind) {
    case "requestRenewal": {
      const wanted = ctx.requestedPackageLabel ? ` (${ctx.requestedPackageLabel})` : "";
      return `${greeting}\n\n${p.renewal(wanted)}\n\n${p.closing}`;
    }
    case "requestExtension": {
      const days = ctx.requestedDays ? p.extensionDays(ctx.requestedDays) : "";
      const pkgRef = ctx.packageLabel ? ` — ${ctx.packageLabel}` : "";
      const reason = ctx.reason ? p.extensionReason(ctx.reason) : "";
      return `${greeting}\n\n${p.extension(pkgRef, days, reason)}\n\n${p.closing}`;
    }
    case "contactCoach":
    default: {
      return `${greeting}\n\n${p.contact}\n\n${p.closing}`;
    }
  }
}
