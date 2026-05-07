#!/usr/bin/env node
// One-shot script: add Urdu ("ur") to translations.ts.
// - Adds "ur" to LanguageCode union
// - Adds Urdu metadata (RTL) to LANGUAGES array (after Arabic)
// - Adds ur block to TRANSLATIONS by cloning the en block (English fallback
//   text under Urdu key — preserves validator parity, t() will still render
//   English until human translations land. Direction is handled via dir:rtl.)
import { readFileSync, writeFileSync } from "node:fs";

const PATH = "client/src/i18n/translations.ts";
let src = readFileSync(PATH, "utf8");

if (src.includes('"ur"')) {
  console.log("Urdu already present — nothing to do.");
  process.exit(0);
}

// 1) LanguageCode type
src = src.replace(
  /export type LanguageCode = "en" \| "ar"/,
  'export type LanguageCode = "en" | "ar" | "ur"',
);

// 2) LANGUAGES array — insert after the Arabic block.
const arBlock = src.match(
  /  \{\n    "code": "ar",[\s\S]*?\n  \},\n/,
);
if (!arBlock) throw new Error("Could not locate Arabic LANGUAGES entry");
const urLangEntry = `  {
    "code": "ur",
    "label": "اردو",
    "nativeName": "اردو",
    "flag": "🇵🇰",
    "dir": "rtl"
  },
`;
src = src.replace(arBlock[0], arBlock[0] + urLangEntry);

// 3) TRANSLATIONS — clone the en block as the ur block, inserted right after en.
//    The en block starts at `  en: {` and ends at the matching closing `  },`
//    that is followed by another lang key or the closing `};`.
const enStart = src.indexOf("\n  en: {\n");
if (enStart < 0) throw new Error("Could not locate en TRANSLATIONS block start");
// Find the next top-level lang key after en:
const arInTrans = src.indexOf("\n  ar: {\n", enStart);
if (arInTrans < 0) throw new Error("Could not locate ar TRANSLATIONS block to anchor en end");
// The en block ends at the `  },` just before `\n  ar: {`
const enBlockText = src.slice(enStart + 1, arInTrans + 1); // includes the trailing newline
// enBlockText starts with "  en: {\n...  },\n"; produce a ur clone.
const urBlockText = enBlockText.replace(/^  en: \{/, "  ur: {");
// Insert ur block right after ar block to keep RTL languages grouped together.
const arBlockEnd = (() => {
  // find the next `\n  <code>: {` after ar (or the closing `};`)
  const after = src.indexOf("\n  ", arInTrans + 5);
  // Walk forward; we want the first lang-key opener after ar.
  const reLang = /\n  ([a-z]{2}): \{\n/g;
  reLang.lastIndex = arInTrans + 5;
  const m = reLang.exec(src);
  if (m) return m.index + 1; // insertion point — keeps newline before `  <code>:`
  // Fallback: insert just before the final `};`
  const closing = src.lastIndexOf("};\n");
  return closing;
})();
src = src.slice(0, arBlockEnd) + urBlockText + src.slice(arBlockEnd);

writeFileSync(PATH, src);
console.log("Urdu language added (cloned from en).");
