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

// =============================
// Nutrition Plan share builder
// =============================
//
// Builds a premium, mobile-readable WhatsApp summary of a full nutrition
// plan (single day-type) that the trainer or the client can paste into
// the chat. Translated headers/labels for the 7 main languages; food
// names and the trainer's free-text notes are passed through verbatim.
//
// Uses simple ASCII separators (━━━) instead of complex markdown so the
// message renders identically on iOS / Android / Desktop WhatsApp and
// stays clean even after WhatsApp's internal whitespace collapse.

import type { NutritionPlanFull, NutritionPlanDayWithMeals } from "@shared/schema";
import { NUTRITION_PLAN_GOAL_LABELS_EN, NUTRITION_PLAN_DAY_TYPE_LABELS_EN } from "@shared/schema";

type NutritionPhrasebook = {
  header: string;
  goal: string;
  day: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  meal: string;
  water: string;
  coachNotes: string;
  closing: string;
  signature: string;
  forClient: (name: string) => string;
};

const NUTRITION_PHRASES: Record<string, NutritionPhrasebook> = {
  en: {
    header: "YOUR NUTRITION PLAN",
    goal: "Goal",
    day: "Day",
    calories: "Calories",
    protein: "Protein",
    carbs: "Carbs",
    fats: "Fats",
    meal: "MEAL",
    water: "Water Target",
    coachNotes: "Coach Notes",
    closing: "Stay consistent — small daily wins compound.",
    signature: "— Coach Youssef",
    forClient: (n) => `For ${n}`,
  },
  ar: {
    header: "خطتك الغذائية",
    goal: "الهدف",
    day: "اليوم",
    calories: "السعرات",
    protein: "بروتين",
    carbs: "كربوهيدرات",
    fats: "دهون",
    meal: "وجبة",
    water: "هدف الماء",
    coachNotes: "ملاحظات الكوتش",
    closing: "استمر — الانتصارات اليومية الصغيرة تتراكم.",
    signature: "— كوتش يوسف",
    forClient: (n) => `لـ ${n}`,
  },
  fa: {
    header: "برنامه غذایی شما",
    goal: "هدف",
    day: "روز",
    calories: "کالری",
    protein: "پروتئین",
    carbs: "کربوهیدرات",
    fats: "چربی",
    meal: "وعده",
    water: "هدف آب",
    coachNotes: "یادداشت مربی",
    closing: "ادامه بده — موفقیت‌های کوچک روزانه جمع می‌شوند.",
    signature: "— مربی یوسف",
    forClient: (n) => `برای ${n}`,
  },
  ur: {
    header: "آپ کا نیوٹریشن پلان",
    goal: "ہدف",
    day: "دن",
    calories: "کیلوریز",
    protein: "پروٹین",
    carbs: "کاربز",
    fats: "چکنائی",
    meal: "میل",
    water: "پانی کا ہدف",
    coachNotes: "کوچ کے نوٹس",
    closing: "ثابت قدم رہیں — روزانہ کی چھوٹی کامیابیاں بڑی بنتی ہیں۔",
    signature: "— کوچ یوسف",
    forClient: (n) => `${n} کے لیے`,
  },
  de: {
    header: "DEIN ERNÄHRUNGSPLAN",
    goal: "Ziel",
    day: "Tag",
    calories: "Kalorien",
    protein: "Eiweiß",
    carbs: "Kohlenhydrate",
    fats: "Fette",
    meal: "MAHLZEIT",
    water: "Wasser-Ziel",
    coachNotes: "Coach-Notizen",
    closing: "Bleib dran — kleine tägliche Siege summieren sich.",
    signature: "— Coach Youssef",
    forClient: (n) => `Für ${n}`,
  },
  fr: {
    header: "VOTRE PLAN NUTRITION",
    goal: "Objectif",
    day: "Jour",
    calories: "Calories",
    protein: "Protéines",
    carbs: "Glucides",
    fats: "Lipides",
    meal: "REPAS",
    water: "Objectif d'eau",
    coachNotes: "Notes du Coach",
    closing: "Reste constant — les petites victoires quotidiennes s'accumulent.",
    signature: "— Coach Youssef",
    forClient: (n) => `Pour ${n}`,
  },
  ru: {
    header: "ВАШ ПЛАН ПИТАНИЯ",
    goal: "Цель",
    day: "День",
    calories: "Калории",
    protein: "Белки",
    carbs: "Углеводы",
    fats: "Жиры",
    meal: "ПРИЁМ ПИЩИ",
    water: "Цель по воде",
    coachNotes: "Заметки тренера",
    closing: "Продолжай — маленькие ежедневные победы складываются.",
    signature: "— Тренер Юссеф",
    forClient: (n) => `Для ${n}`,
  },
};

function pickNutritionPhrasebook(lang?: string | null): NutritionPhrasebook {
  const code = (lang || "en").slice(0, 2).toLowerCase();
  return NUTRITION_PHRASES[code] ?? NUTRITION_PHRASES.en;
}

const SEP = "━━━━━━━━━━━━━━━";

export interface BuildNutritionPlanWhatsAppOptions {
  /** UI language code, e.g. "en", "ar". */
  lang?: string | null;
  /** Optional client display name (greets the recipient). */
  clientName?: string | null;
  /** Which day to include. Defaults to the first day in the plan. */
  dayIndex?: number;
}

function fmtNum(n: number): string {
  return Number.isFinite(n) ? Math.round(n).toString() : "0";
}

function dayTotalsFromMeals(day: NutritionPlanDayWithMeals) {
  return day.meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.totalKcal,
      protein: acc.protein + m.totalProteinG,
      carbs: acc.carbs + m.totalCarbsG,
      fats: acc.fats + m.totalFatsG,
    }),
    { kcal: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

/**
 * Build a premium WhatsApp message summarizing a single day of a
 * nutrition plan. We deliberately summarize ONE day at a time (not the
 * whole plan) because:
 *  - WhatsApp truncates long messages
 *  - Clients usually want to see today's plan, not all variants
 *  - Multiple day-types can be sent as separate messages if needed
 *
 * Privacy: trainer's `privateNotes` are NEVER included. Only
 * `publicNotes` (intentionally shared with the client) and the day's
 * own `notes` are emitted.
 */
export function buildNutritionPlanWhatsApp(
  plan: NutritionPlanFull,
  opts: BuildNutritionPlanWhatsAppOptions = {},
): string {
  const p = pickNutritionPhrasebook(opts.lang);
  const idx = Math.max(0, Math.min(opts.dayIndex ?? 0, plan.days.length - 1));
  const day = plan.days[idx];
  const lines: string[] = [];

  lines.push(SEP);
  lines.push(`🍽  ${p.header}`);
  lines.push(SEP);

  const name = (opts.clientName || "").trim();
  if (name) lines.push(p.forClient(name));
  lines.push(`${p.goal}: ${(NUTRITION_PLAN_GOAL_LABELS_EN as any)[plan.goal] ?? plan.goal}`);

  if (day) {
    const dayLabel = day.label?.trim() ||
      ((NUTRITION_PLAN_DAY_TYPE_LABELS_EN as any)[day.dayType] ?? day.dayType);
    lines.push(`${p.day}: ${dayLabel}`);
    lines.push("");

    // Day-level macro targets
    lines.push(`${p.calories}: ${fmtNum(day.targetKcal)} kcal`);
    lines.push(`${p.protein}: ${fmtNum(day.targetProteinG)}g`);
    lines.push(`${p.carbs}: ${fmtNum(day.targetCarbsG)}g`);
    lines.push(`${p.fats}: ${fmtNum(day.targetFatsG)}g`);

    // Per-meal breakdown
    day.meals.forEach((m, i) => {
      lines.push("");
      lines.push(`${p.meal} ${i + 1} — ${m.name}`);
      m.items.forEach((it) => {
        const qty = (it.servingSize * it.quantity).toFixed(0);
        lines.push(`• ${it.name} (${qty}${it.servingUnit})`);
      });
      lines.push(`   ${fmtNum(m.totalKcal)} kcal`);
    });

    // Day total recap
    const t = dayTotalsFromMeals(day);
    lines.push("");
    lines.push(
      `Σ  ${fmtNum(t.kcal)} kcal · P ${fmtNum(t.protein)}g · C ${fmtNum(t.carbs)}g · F ${fmtNum(t.fats)}g`,
    );

    if (day.notes && day.notes.trim()) {
      lines.push("");
      lines.push(day.notes.trim());
    }
  }

  if (plan.waterTargetMl && plan.waterTargetMl > 0) {
    lines.push("");
    lines.push(`💧 ${p.water}: ${(plan.waterTargetMl / 1000).toFixed(1)}L`);
  }

  if (plan.publicNotes && plan.publicNotes.trim()) {
    lines.push("");
    lines.push(`📝 ${p.coachNotes}`);
    lines.push(plan.publicNotes.trim());
  }

  lines.push("");
  lines.push(p.closing);
  lines.push(p.signature);
  lines.push(SEP);

  return lines.join("\n");
}

// =============================
// Supplements share builder (Phase 3)
// =============================
//
// Builds a WhatsApp summary of a client's supplement protocol for a
// given day-mode (training / rest). Same brand voice + ASCII separators
// as the nutrition share so messages feel like a single product.

import type { ClientSupplement } from "@shared/schema";
import { SUPPLEMENT_TIMING_LABELS_EN, SUPPLEMENT_TIMING_ORDER } from "@shared/schema";

type SupplementsPhrasebook = {
  header: string;
  trainingDay: string;
  restDay: string;
  forClient: (n: string) => string;
  totalLabel: (n: number) => string;
  warnings: string;
  closing: string;
  signature: string;
};

const SUPP_PHRASES: Record<string, SupplementsPhrasebook> = {
  en: {
    header: "YOUR SUPPLEMENT PROTOCOL",
    trainingDay: "Training Day",
    restDay: "Rest Day",
    forClient: (n) => `For ${n}`,
    totalLabel: (n) => `${n} supplement${n === 1 ? "" : "s"}`,
    warnings: "Warnings",
    closing: "Stay consistent — supplements work when sleep, food, and training do.",
    signature: "— Coach Youssef",
  },
  ar: {
    header: "بروتوكول المكملات الخاص بك",
    trainingDay: "يوم تدريب",
    restDay: "يوم راحة",
    forClient: (n) => `لـ ${n}`,
    totalLabel: (n) => `${n} مكمل`,
    warnings: "تحذيرات",
    closing: "استمر — المكملات تعمل عندما يعمل النوم والطعام والتدريب.",
    signature: "— كوتش يوسف",
  },
  fa: {
    header: "پروتکل مکمل‌های شما",
    trainingDay: "روز تمرین",
    restDay: "روز استراحت",
    forClient: (n) => `برای ${n}`,
    totalLabel: (n) => `${n} مکمل`,
    warnings: "هشدارها",
    closing: "ادامه بده — مکمل‌ها زمانی کار می‌کنند که خواب، غذا و تمرین درست باشد.",
    signature: "— مربی یوسف",
  },
  ur: {
    header: "آپ کا سپلیمنٹ پروٹوکول",
    trainingDay: "ٹریننگ دن",
    restDay: "آرام کا دن",
    forClient: (n) => `${n} کے لیے`,
    totalLabel: (n) => `${n} سپلیمنٹس`,
    warnings: "تنبیہات",
    closing: "ثابت قدم رہیں — سپلیمنٹس تب کام کرتے ہیں جب نیند، خوراک اور ٹریننگ درست ہو۔",
    signature: "— کوچ یوسف",
  },
  de: {
    header: "DEIN SUPPLEMENT-PROTOKOLL",
    trainingDay: "Trainingstag",
    restDay: "Ruhetag",
    forClient: (n) => `Für ${n}`,
    totalLabel: (n) => `${n} Supplement${n === 1 ? "" : "e"}`,
    warnings: "Hinweise",
    closing: "Bleib dran — Supplements wirken, wenn Schlaf, Ernährung und Training stimmen.",
    signature: "— Coach Youssef",
  },
  fr: {
    header: "VOTRE PROTOCOLE DE COMPLÉMENTS",
    trainingDay: "Jour d'entraînement",
    restDay: "Jour de repos",
    forClient: (n) => `Pour ${n}`,
    totalLabel: (n) => `${n} complément${n === 1 ? "" : "s"}`,
    warnings: "Avertissements",
    closing: "Reste constant — les compléments fonctionnent quand le sommeil, l'alimentation et l'entraînement sont au point.",
    signature: "— Coach Youssef",
  },
  ru: {
    header: "ВАШ ПРОТОКОЛ ДОБАВОК",
    trainingDay: "Тренировочный день",
    restDay: "День отдыха",
    forClient: (n) => `Для ${n}`,
    totalLabel: (n) => `${n} добавок`,
    warnings: "Предупреждения",
    closing: "Продолжай — добавки работают, когда сон, питание и тренировки в порядке.",
    signature: "— Тренер Юссеф",
  },
};

function pickSuppPhrasebook(lang?: string | null): SupplementsPhrasebook {
  const code = (lang || "en").slice(0, 2).toLowerCase();
  return SUPP_PHRASES[code] ?? SUPP_PHRASES.en;
}

export interface BuildSupplementsWhatsAppOptions {
  lang?: string | null;
  clientName?: string | null;
  /** Which day-context to summarise. Defaults to "training". */
  mode?: "training" | "rest";
}

export function buildSupplementsWhatsApp(
  items: ClientSupplement[],
  opts: BuildSupplementsWhatsAppOptions = {},
): string {
  const p = pickSuppPhrasebook(opts.lang);
  const mode = opts.mode ?? "training";

  // Filter to today's day-mode + active only.
  const todays = items
    .filter((i) => i.status === "active")
    .filter((i) => {
      if (mode === "training" && i.restDayOnly) return false;
      if (mode === "rest" && i.trainingDayOnly) return false;
      return true;
    });

  // Group by canonical timing order.
  const grouped = new Map<string, ClientSupplement[]>();
  for (const it of todays) {
    const slots = it.timings.length > 0 ? it.timings : ["anytime"];
    for (const slot of slots) {
      const arr = grouped.get(slot) ?? [];
      arr.push(it);
      grouped.set(slot, arr);
    }
  }
  const orderedSlots = Array.from(grouped.keys()).sort(
    (a, b) =>
      ((SUPPLEMENT_TIMING_ORDER as Record<string, number>)[a] ?? 99) -
      ((SUPPLEMENT_TIMING_ORDER as Record<string, number>)[b] ?? 99),
  );

  const lines: string[] = [];
  lines.push(SEP);
  lines.push(`💊  ${p.header}`);
  lines.push(SEP);

  const name = (opts.clientName || "").trim();
  if (name) lines.push(p.forClient(name));
  lines.push(`${mode === "training" ? p.trainingDay : p.restDay} · ${p.totalLabel(todays.length)}`);
  lines.push("");

  for (const slot of orderedSlots) {
    const slotLabel =
      (SUPPLEMENT_TIMING_LABELS_EN as Record<string, string>)[slot] ?? slot;
    lines.push(`▸ ${slotLabel.toUpperCase()}`);
    for (const it of grouped.get(slot)!) {
      const brand = it.brand ? ` (${it.brand})` : "";
      lines.push(`  • ${it.name}${brand} — ${it.dosage}${it.unit}`);
      if (it.notes && it.notes.trim()) lines.push(`     ↳ ${it.notes.trim()}`);
    }
    lines.push("");
  }

  // Aggregate warnings — only for the supplements actually in today's
  // schedule, so a Training-Day share never surfaces warnings for items
  // that won't be taken (e.g. rest-day-only formulas).
  const warned = todays.filter((i) => i.warnings && i.warnings.trim());
  if (warned.length > 0) {
    lines.push(`⚠️  ${p.warnings}`);
    for (const w of warned) {
      lines.push(`  • ${w.name}: ${w.warnings!.trim()}`);
    }
    lines.push("");
  }

  lines.push(p.closing);
  lines.push(p.signature);
  lines.push(SEP);

  return lines.join("\n");
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
