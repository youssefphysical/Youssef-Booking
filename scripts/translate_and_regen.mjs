import OpenAI from "openai";
import fs from "fs";
import path from "path";

const LANGS = [
  { code: "ar", name: "Arabic (Modern Standard, natural)" },
  { code: "fr", name: "French" },
  { code: "es", name: "Spanish" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "ru", name: "Russian" },
  { code: "zh", name: "Simplified Chinese" },
  { code: "hi", name: "Hindi" },
  { code: "tr", name: "Turkish" },
];

const client = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || "_DUMMY_API_KEY_",
});

async function translateBatch(lang, name, items) {
  const prompt = `You are a professional translator for a personal training service in Dubai. Translate each English value to ${name}. Preserve placeholders like {name}, {n}, {date}, {time}, {cutoff}, {hours}, {quota}, {left}, {h}, {total} EXACTLY. Keep professional, natural tone. Brand "Youssef Ahmed" stays as-is. Return JSON object with same keys.

Input JSON:
${JSON.stringify(items, null, 2)}

Output ONLY a JSON object with the same keys and translated values.`;

  const resp = await client.chat.completions.create({
    model: "gpt-4o",
    messages: [{ role: "user", content: prompt }],
    response_format: { type: "json_object" },
    temperature: 0.3,
  });
  return JSON.parse(resp.choices[0].message.content);
}

const newKeys = JSON.parse(fs.readFileSync("/tmp/new_dashboard_keys.json", "utf8"));

// Update en_master: add to dashboard namespace
const en = JSON.parse(fs.readFileSync("/tmp/en_master.json", "utf8"));
en.dashboard = en.dashboard || {};
for (const [k, v] of Object.entries(newKeys)) {
  const sub = k.replace("dashboard.", "");
  en.dashboard[sub] = v;
}
fs.writeFileSync("/tmp/en_master.json", JSON.stringify(en, null, 2));
console.log("en_master updated");

// Translate per language
for (const { code, name } of LANGS) {
  const file = `/tmp/${code}_translated.json`;
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  data.dashboard = data.dashboard || {};
  // Build flat input for translation
  const input = {};
  for (const [fullKey, v] of Object.entries(newKeys)) {
    input[fullKey] = v;
  }
  console.log(`Translating ${Object.keys(input).length} keys → ${code}…`);
  const out = await translateBatch(code, name, input);
  for (const [fullKey, val] of Object.entries(out)) {
    const sub = fullKey.replace("dashboard.", "");
    data.dashboard[sub] = val;
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`  ✓ ${code}`);
}

// Regenerate client/src/i18n/translations.ts
function flatten(obj, prefix = "") {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === "object" && !Array.isArray(v)) {
      Object.assign(out, flatten(v, key));
    } else {
      out[key] = v;
    }
  }
  return out;
}

const ALL = { en };
for (const { code } of LANGS) {
  ALL[code] = JSON.parse(fs.readFileSync(`/tmp/${code}_translated.json`, "utf8"));
}

const META = [
  { code: "en", label: "English", nativeName: "English", flag: "🇬🇧", dir: "ltr" },
  { code: "ar", label: "العربية", nativeName: "العربية", flag: "🇦🇪", dir: "rtl" },
  { code: "fr", label: "Français", nativeName: "Français", flag: "🇫🇷", dir: "ltr" },
  { code: "es", label: "Español", nativeName: "Español", flag: "🇪🇸", dir: "ltr" },
  { code: "de", label: "Deutsch", nativeName: "Deutsch", flag: "🇩🇪", dir: "ltr" },
  { code: "it", label: "Italiano", nativeName: "Italiano", flag: "🇮🇹", dir: "ltr" },
  { code: "ru", label: "Русский", nativeName: "Русский", flag: "🇷🇺", dir: "ltr" },
  { code: "zh", label: "中文", nativeName: "中文", flag: "🇨🇳", dir: "ltr" },
  { code: "hi", label: "हिन्दी", nativeName: "हिन्दी", flag: "🇮🇳", dir: "ltr" },
  { code: "tr", label: "Türkçe", nativeName: "Türkçe", flag: "🇹🇷", dir: "ltr" },
];

let ts = `// AUTO-GENERATED. Do not edit manually.\n`;
ts += `export type LanguageCode = ${META.map((m) => `"${m.code}"`).join(" | ")};\n\n`;
ts += `export const DEFAULT_LANGUAGE: LanguageCode = "en";\n\n`;
ts += `export const LANGUAGES: { code: LanguageCode; label: string; nativeName: string; flag: string; dir: "ltr" | "rtl" }[] = ${JSON.stringify(
  META,
  null,
  2,
)};\n\n`;
ts += `export const TRANSLATIONS: Record<LanguageCode, Record<string, string>> = {\n`;
for (const { code } of META) {
  const flat = flatten(ALL[code]);
  ts += `  ${code}: ${JSON.stringify(flat, null, 2)},\n`;
}
ts += `};\n`;

fs.writeFileSync("client/src/i18n/translations.ts", ts);
console.log("translations.ts regenerated:", fs.statSync("client/src/i18n/translations.ts").size, "bytes");
