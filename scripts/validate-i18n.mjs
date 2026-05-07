#!/usr/bin/env node
import { readFileSync } from "node:fs";

const src = readFileSync("client/src/i18n/translations.ts", "utf8");
const lines = src.split("\n");

const langStart = /^\s+(en|ar|ur|fa|fr|es|pt|de|it|ru|tr|zh|hi):\s*\{/;
const blocks = [];
for (let i = 0; i < lines.length; i++) {
  const m = langStart.exec(lines[i]);
  if (m) blocks.push({ code: m[1], start: i });
}
for (let i = 0; i < blocks.length; i++) {
  blocks[i].end = i + 1 < blocks.length ? blocks[i + 1].start : lines.length;
}

const keyRe = /^\s*"([^"]+)":\s*"/;
const sets = {};
for (const { code, start, end } of blocks) {
  const set = new Set();
  for (let i = start; i < end; i++) {
    const m = keyRe.exec(lines[i]);
    if (m) set.add(m[1]);
  }
  sets[code] = set;
}

const en = sets.en;
let ok = true;
console.log(`Reference: en (${en.size} keys)\n`);
for (const { code } of blocks) {
  if (code === "en") continue;
  const missing = [...en].filter((k) => !sets[code].has(k));
  const extra = [...sets[code]].filter((k) => !en.has(k));
  const tag = missing.length || extra.length ? "FAIL" : "OK  ";
  console.log(`  [${tag}] ${code}: ${sets[code].size} keys, missing=${missing.length}, extra=${extra.length}`);
  if (missing.length) {
    ok = false;
    console.log(`         missing:`, missing.slice(0, 10).join(", "), missing.length > 10 ? `... (+${missing.length - 10} more)` : "");
  }
  if (extra.length) {
    ok = false;
    console.log(`         extra:  `, extra.slice(0, 10).join(", "), extra.length > 10 ? `... (+${extra.length - 10} more)` : "");
  }
}

if (!ok) {
  console.error("\ni18n parity check FAILED");
  process.exit(1);
}
console.log(`\ni18n parity check passed: all ${blocks.length} languages share the same keys.`);
