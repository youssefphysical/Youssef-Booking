/**
 * Media Panel Slider — Static Schema-Coupling Guard
 *
 * Verifies two things without a browser:
 *
 * 1. SCHEMA CONTRACT: Every schemaKey in SERVICE_CARD_SLIDER_FIELDS maps to
 *    a real column in shared/schema.ts for all three service card types
 *    (personalTraining, nutrition, supplement).  If you remove a column from
 *    the schema and forget to remove it from service-card-fields.ts, this
 *    test fails immediately.
 *
 * 2. UI CONTRACT: The AdminMedia.tsx source generates SliderRows via
 *    SERVICE_CARD_SLIDER_FIELDS (not by hand), so there are no hardcoded
 *    SliderRow label= props left in the Advanced Settings section.  If
 *    someone adds a one-off hardcoded slider outside the canonical list, this
 *    test catches it.
 *
 * Run: npx tsx tests/media-panel-sliders.test.ts
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import assert from "assert";
import {
  SERVICE_CARD_SLIDER_FIELDS,
  toSchemaColumnSuffix,
} from "../client/src/lib/service-card-fields.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SCHEMA_PATH = join(__dirname, "../shared/schema.ts");
const ADMIN_MEDIA_PATH = join(__dirname, "../client/src/pages/AdminMedia.tsx");

const schemaSrc = readFileSync(SCHEMA_PATH, "utf-8");
const adminMediaSrc = readFileSync(ADMIN_MEDIA_PATH, "utf-8");

// ── Card prefixes (must match `ServiceCard` union in AdminMedia.tsx) ──────────
const CARD_PREFIXES = ["personalTraining", "nutrition", "supplement"] as const;

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗  ${name}\n     ${msg}`);
    failed++;
  }
}

console.log("\nMedia panel — schema-coupling static guard");
console.log("─".repeat(55));

// ── 1. Every schemaKey maps to a real schema column for all cards ─────────────
console.log("\n[1] Schema column presence");
for (const field of SERVICE_CARD_SLIDER_FIELDS) {
  const suffix = `Image${toSchemaColumnSuffix(field.schemaKey)}`;
  for (const prefix of CARD_PREFIXES) {
    const colName = `${prefix}${suffix}`;
    check(
      `${colName} exists in shared/schema.ts`,
      () => {
        assert(
          schemaSrc.includes(colName),
          `Column "${colName}" not found in shared/schema.ts.\n` +
            `     Remove "${field.schemaKey}" from SERVICE_CARD_SLIDER_FIELDS ` +
            `or restore the column.`,
        );
      },
    );
  }
}

// ── 2. AdminMedia.tsx uses SERVICE_CARD_SLIDER_FIELDS (no hardcoded sliders) ──
console.log("\n[2] AdminMedia.tsx generates sliders from canonical list");

check("AdminMedia.tsx imports SERVICE_CARD_SLIDER_FIELDS", () => {
  assert(
    adminMediaSrc.includes("SERVICE_CARD_SLIDER_FIELDS"),
    "AdminMedia.tsx does not import/use SERVICE_CARD_SLIDER_FIELDS.\n" +
      "     Advanced Settings sliders must be generated from the canonical list.",
  );
});

check("No hardcoded SliderRow label= inside the Advanced Settings section", () => {
  const advancedStart = adminMediaSrc.indexOf('{showAdvanced && (');
  assert(
    advancedStart !== -1,
    'Could not find the showAdvanced block in AdminMedia.tsx',
  );
  // The advanced section ends before the next top-level comment block
  const advancedSection = adminMediaSrc.slice(advancedStart, advancedStart + 3000);

  // Any remaining hardcoded SliderRow with a literal label= would be a bug
  const hardcoded = [...advancedSection.matchAll(/<SliderRow\s+label="([^"]+)"/g)];
  assert(
    hardcoded.length === 0,
    `Found ${hardcoded.length} hardcoded SliderRow label= prop(s) in the Advanced Settings panel: ` +
      hardcoded.map((m) => `"${m[1]}"`).join(", ") +
      ".\n     These must be generated via SERVICE_CARD_SLIDER_FIELDS.map(...).",
  );
});

// ── 3. Canonical list is self-consistent ─────────────────────────────────────
console.log("\n[3] Canonical list self-consistency");

check("No duplicate schemaKey values in SERVICE_CARD_SLIDER_FIELDS", () => {
  const keys = SERVICE_CARD_SLIDER_FIELDS.map((f) => f.schemaKey);
  const unique = new Set(keys);
  assert(
    unique.size === keys.length,
    `Duplicate schemaKey(s) detected: ${keys.filter((k, i) => keys.indexOf(k) !== i).join(", ")}`,
  );
});

check("No duplicate label values in SERVICE_CARD_SLIDER_FIELDS", () => {
  const labels = SERVICE_CARD_SLIDER_FIELDS.map((f) => f.label);
  const unique = new Set(labels);
  assert(
    unique.size === labels.length,
    `Duplicate label(s) detected: ${labels.filter((l, i) => labels.indexOf(l) !== i).join(", ")}`,
  );
});

// ── 4. Scoped data-testid prefixes present in the Advanced Settings block ─────
console.log("\n[4] Scoped slider data-testid prefixes");

check('Desktop SliderRows use "slider-row-desktop-" prefix', () => {
  const advancedStart = adminMediaSrc.indexOf('{showAdvanced && (');
  assert(advancedStart !== -1, 'Could not find the showAdvanced block in AdminMedia.tsx');
  const advancedSection = adminMediaSrc.slice(advancedStart, advancedStart + 3000);
  assert(
    advancedSection.includes("slider-row-desktop-"),
    'Desktop SliderRows in Advanced Settings do not use the "slider-row-desktop-" scoped testId prefix.\n' +
    '     Pass testId={`slider-row-desktop-${...}`} to each desktop SliderRow.',
  );
});

check('Mobile SliderRows use "slider-row-mobile-" prefix', () => {
  const advancedStart = adminMediaSrc.indexOf('{showAdvanced && (');
  assert(advancedStart !== -1, 'Could not find the showAdvanced block in AdminMedia.tsx');
  const advancedSection = adminMediaSrc.slice(advancedStart, advancedStart + 3000);
  assert(
    advancedSection.includes("slider-row-mobile-"),
    'Mobile SliderRows in Advanced Settings do not use the "slider-row-mobile-" scoped testId prefix.\n' +
    '     Pass testId={`slider-row-mobile-${...}`} to each mobile SliderRow.',
  );
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(55));
if (failed > 0) {
  console.error(`\n❌  ${failed} assertion(s) failed.\n`);
  process.exit(1);
} else {
  console.log(`\n✅  ${passed} assertion(s) passed.\n`);
}
