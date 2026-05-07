// One-off: extend client/src/i18n/translations.ts to include 12 languages
// (adds Urdu RTL + Portuguese) using the existing OpenAI integration to
// translate the English source dictionary in batches. Idempotent — re-running
// will only fill missing keys for the new languages.

import OpenAI from "openai";
import fs from "fs";

const FILE = "client/src/i18n/translations.ts";

process.on("unhandledRejection", (e) => { console.error("UNHANDLED:", e); process.exit(2); });
process.on("uncaughtException", (e) => { console.error("UNCAUGHT:", e); process.exit(3); });

// New languages we want to add (must match existing META shape).
const NEW_LANGS = [
  { code: "ur", name: "Urdu (Modern Standard, natural Pakistani usage)", label: "اردو", nativeName: "اردو", flag: "🇵🇰", dir: "rtl" },
  { code: "pt", name: "Portuguese (Brazilian, professional)", label: "Português", nativeName: "Português", flag: "🇵🇹", dir: "ltr" },
];

const FULL_META_ORDER = [
  { code: "en", label: "English", nativeName: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "ar", label: "العربية", nativeName: "العربية", flag: "🇦🇪", dir: "rtl" },
  { code: "ur", label: "اردو", nativeName: "اردو", flag: "🇵🇰", dir: "rtl" },
  { code: "fr", label: "Français", nativeName: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "es", label: "Español", nativeName: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "pt", label: "Português", nativeName: "Português", flag: "🇵🇹", dir: "ltr" },
  { code: "de", label: "Deutsch", nativeName: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  { code: "it", label: "Italiano", nativeName: "Italiano", flag: "🇮🇹", dir: "ltr" },
  { code: "ru", label: "Русский", nativeName: "Русский", flag: "🇷🇺", dir: "ltr" },
  { code: "tr", label: "Türkçe", nativeName: "Türkçe", flag: "🇹🇷", dir: "ltr" },
  { code: "zh", label: "中文", nativeName: "中文", flag: "🇨🇳", dir: "ltr" },
  { code: "hi", label: "हिन्दी", nativeName: "हिन्दी", flag: "🇮🇳", dir: "ltr" },
];

// Parse the existing translations.ts by extracting each lang block as JSON.
function parseExisting(src) {
  const lines = src.split("\n");
  // Match lines like `  en: {` or `  ar: {` (any 2-letter code).
  const startRe = /^\s+([a-z]{2}):\s*\{\s*$/;
  const blocks = [];
  for (let i = 0; i < lines.length; i++) {
    const m = startRe.exec(lines[i]);
    if (m) blocks.push({ code: m[1], start: i });
  }
  for (let i = 0; i < blocks.length; i++) {
    // For each lang block, find its closing `},` line by walking from start.
    const startLine = blocks[i].start;
    const upper = i + 1 < blocks.length ? blocks[i + 1].start : lines.length;
    let endLine = upper;
    for (let j = startLine + 1; j < upper; j++) {
      if (/^\},?\s*$/.test(lines[j])) { endLine = j + 1; break; }
    }
    blocks[i].end = endLine;
  }
  const dicts = {};
  for (const { code, start, end } of blocks) {
    const body = lines.slice(start, end).join("\n");
    let trimmed = body.replace(/^\s+[a-z]{2}:\s*/, "").replace(/,\s*$/, "").trim();
    // Strip trailing commas before } (JSON doesn't allow them but the source has them).
    trimmed = trimmed.replace(/,(\s*\})/g, "$1");
    try {
      dicts[code] = JSON.parse(trimmed);
    } catch (e) {
      console.error(`Failed to parse ${code} block:`, e.message);
      console.error("First 200 chars:", trimmed.slice(0, 200));
      throw e;
    }
  }
  return dicts;
}

const src = fs.readFileSync(FILE, "utf8");
const existing = parseExisting(src);
console.log("Parsed existing langs:", Object.keys(existing).map((c) => `${c}=${Object.keys(existing[c]).length}`).join(", "));

const enKeys = Object.keys(existing.en);
console.log(`English source: ${enKeys.length} keys.`);

const client = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "_DUMMY_API_KEY_",
  timeout: 60_000,
  maxRetries: 0,
});

async function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, rej) => setTimeout(() => rej(new Error(`timeout ${label} after ${ms}ms`)), ms)),
  ]);
}

async function translateBatch(langName, items, attempt = 1) {
  const prompt = `You are a professional translator for a premium personal training service in Dubai. Translate each English value to ${langName}.

CRITICAL rules:
- Preserve placeholders like {name}, {n}, {date}, {time}, {cutoff}, {hours}, {quota}, {left}, {h}, {total}, {plural}, {count} EXACTLY (do not translate or remove them).
- Keep professional, premium, motivational tone — this is a luxury fitness brand.
- Brand names "Youssef Ahmed", "Coach Youssef", "InBody", "WhatsApp", "Dubai" stay in English/their original spelling.
- Return JSON object with the SAME keys, translated values only.
- For Urdu, use natural modern Urdu (not formal court Urdu).
- For Portuguese, use Brazilian Portuguese.

Input JSON:
${JSON.stringify(items)}

Output ONLY the JSON object — no commentary.`;

  try {
    const resp = await withTimeout(
      client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.2,
      }),
      45_000,
      `batch (${Object.keys(items).length} keys)`,
    );
    return JSON.parse(resp.choices[0].message.content);
  } catch (e) {
    if (attempt < 4) {
      console.warn(`\n  retry ${attempt + 1} (${e.message})`);
      await new Promise((r) => setTimeout(r, 800 * attempt));
      return translateBatch(langName, items, attempt + 1);
    }
    console.warn(`\n  GIVING UP on batch — using English fallback for ${Object.keys(items).length} keys (${e.message})`);
    return items; // fallback: return English values
  }
}

const BATCH_SIZE = 40;
const PARALLEL = 4;

async function buildLang(code, langName) {
  const out = existing[code] ? { ...existing[code] } : {};
  const missing = enKeys.filter((k) => !(k in out));
  console.log(`\n${code}: ${Object.keys(out).length} existing, ${missing.length} missing → batches=${BATCH_SIZE}, parallel=${PARALLEL}…`);
  if (missing.length === 0) return out;

  // Build all batch jobs.
  const jobs = [];
  for (let i = 0; i < missing.length; i += BATCH_SIZE) {
    const slice = missing.slice(i, i + BATCH_SIZE);
    const input = {};
    for (const k of slice) input[k] = existing.en[k];
    jobs.push({ idx: jobs.length + 1, slice, input });
  }
  console.log(`  ${jobs.length} batches total`);

  // Run with limited parallelism.
  let done = 0;
  let cursor = 0;
  async function worker() {
    while (cursor < jobs.length) {
      const my = jobs[cursor++];
      if (!my) return;
      const translated = await translateBatch(langName, my.input);
      for (const k of my.slice) out[k] = typeof translated[k] === "string" ? translated[k] : existing.en[k];
      done++;
      console.log(`  ✓ batch ${my.idx}/${jobs.length} (${done}/${jobs.length} done)`);
    }
  }
  await Promise.all(Array.from({ length: PARALLEL }, () => worker()));
  return out;
}

const allDicts = { ...existing };
for (const { code, name } of NEW_LANGS) {
  allDicts[code] = await buildLang(code, name);
}

// Also fill any missing keys for existing langs (so the full set is parity-clean).
for (const m of FULL_META_ORDER) {
  if (m.code === "en") continue;
  if (!allDicts[m.code]) allDicts[m.code] = {};
  const missing = enKeys.filter((k) => !(k in allDicts[m.code]));
  if (missing.length > 0 && !NEW_LANGS.some((l) => l.code === m.code)) {
    console.log(`\n[parity] ${m.code} missing ${missing.length} keys — filling with English fallback.`);
    for (const k of missing) allDicts[m.code][k] = existing.en[k];
  }
}

// Regenerate translations.ts with the full 12-language meta.
let ts = `// AUTO-GENERATED. Do not edit manually.\n`;
ts += `export type LanguageCode = ${FULL_META_ORDER.map((m) => `"${m.code}"`).join(" | ")};\n\n`;
ts += `export const DEFAULT_LANGUAGE: LanguageCode = "en";\n\n`;
ts += `export const LANGUAGES: { code: LanguageCode; label: string; nativeName: string; flag: string; dir: "ltr" | "rtl" }[] = ${JSON.stringify(FULL_META_ORDER, null, 2)};\n\n`;
ts += `export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {\n`;
for (const { code } of FULL_META_ORDER) {
  ts += `  ${code}: ${JSON.stringify(allDicts[code], null, 2)},\n`;
}
ts += `};\n`;

fs.writeFileSync(FILE, ts);
console.log(`\n✓ ${FILE} regenerated: ${fs.statSync(FILE).size} bytes, ${FULL_META_ORDER.length} languages.`);
