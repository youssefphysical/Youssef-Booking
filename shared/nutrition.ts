// =============================
// NUTRITION OS — SHARED MATH LAYER
// =============================
// Pure helpers used by every nutrition surface (meal builder,
// client nutrition plans, PDF export, WhatsApp summary, AI
// recommendations). No DB / framework / IO imports — keep it pure
// so it can be re-used safely on the server, in the browser, in a
// worker, or in a Node export script.

export interface MealItemMacroSource {
  /** Multiplier on top of the snapshot serving. 1 = one whole serving. */
  quantity: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  fiberG?: number | null;
  sugarG?: number | null;
  sodiumMg?: number | null;
}

export interface MealTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function safeQty(q: number): number {
  return Number.isFinite(q) && q > 0 ? q : 0;
}

/** Macros for a single line item (quantity already applied). */
export function computeItemMacros(item: MealItemMacroSource): MealTotals {
  const q = safeQty(item.quantity);
  return {
    kcal: round1((item.kcal || 0) * q),
    proteinG: round1((item.proteinG || 0) * q),
    carbsG: round1((item.carbsG || 0) * q),
    fatsG: round1((item.fatsG || 0) * q),
    fiberG: round1((item.fiberG ?? 0) * q),
    sugarG: round1((item.sugarG ?? 0) * q),
    sodiumMg: round1((item.sodiumMg ?? 0) * q),
  };
}

/**
 * Sum item macros into meal totals. THIS is the single source of
 * truth — server stores the result on the meal row, client renders
 * it live, PDF export reads the cached value, AI uses it as input.
 */
export function computeMealTotals(items: MealItemMacroSource[]): MealTotals {
  const totals: MealTotals = {
    kcal: 0,
    proteinG: 0,
    carbsG: 0,
    fatsG: 0,
    fiberG: 0,
    sugarG: 0,
    sodiumMg: 0,
  };
  for (const it of items) {
    const m = computeItemMacros(it);
    totals.kcal += m.kcal;
    totals.proteinG += m.proteinG;
    totals.carbsG += m.carbsG;
    totals.fatsG += m.fatsG;
    totals.fiberG += m.fiberG;
    totals.sugarG += m.sugarG;
    totals.sodiumMg += m.sodiumMg;
  }
  return {
    kcal: round1(totals.kcal),
    proteinG: round1(totals.proteinG),
    carbsG: round1(totals.carbsG),
    fatsG: round1(totals.fatsG),
    fiberG: round1(totals.fiberG),
    sugarG: round1(totals.sugarG),
    sodiumMg: round1(totals.sodiumMg),
  };
}

/** 4/4/9 calorie rule — kcal derived from macro grams. */
export function macroDerivedKcal(proteinG: number, carbsG: number, fatsG: number): number {
  return round1((proteinG || 0) * 4 + (carbsG || 0) * 4 + (fatsG || 0) * 9);
}

/** Macro split as percentages (rounded to whole %). */
export function macroPercentSplit(t: Pick<MealTotals, "proteinG" | "carbsG" | "fatsG">): {
  protein: number;
  carbs: number;
  fats: number;
} {
  const pCal = (t.proteinG || 0) * 4;
  const cCal = (t.carbsG || 0) * 4;
  const fCal = (t.fatsG || 0) * 9;
  const total = pCal + cCal + fCal;
  if (total <= 0) return { protein: 0, carbs: 0, fats: 0 };
  const protein = Math.round((pCal / total) * 100);
  const carbs = Math.round((cCal / total) * 100);
  const fats = Math.max(0, 100 - protein - carbs);
  return { protein, carbs, fats };
}
