#!/usr/bin/env node
// Inserts auth.logout.* keys into every language block in
// client/src/i18n/translations.ts, immediately after that block's
// nav.signOut entry. Idempotent: re-running is a no-op once the keys exist.

import fs from "node:fs";
const FILE = "client/src/i18n/translations.ts";
let src = fs.readFileSync(FILE, "utf8");

const T = {
  en: { title: "Log out?", message: "Are you sure you want to log out?", cancel: "Cancel", confirm: "Yes, log out", loading: "Logging out…" },
  ar: { title: "تسجيل الخروج؟", message: "هل أنت متأكد أنك تريد تسجيل الخروج؟", cancel: "إلغاء", confirm: "نعم، تسجيل الخروج", loading: "جارٍ تسجيل الخروج…" },
  ur: { title: "لاگ آؤٹ کریں؟", message: "کیا آپ واقعی لاگ آؤٹ کرنا چاہتے ہیں؟", cancel: "منسوخ کریں", confirm: "ہاں، لاگ آؤٹ کریں", loading: "لاگ آؤٹ ہو رہا ہے…" },
  fr: { title: "Se déconnecter ?", message: "Voulez-vous vraiment vous déconnecter ?", cancel: "Annuler", confirm: "Oui, se déconnecter", loading: "Déconnexion…" },
  es: { title: "¿Cerrar sesión?", message: "¿Seguro que quieres cerrar sesión?", cancel: "Cancelar", confirm: "Sí, cerrar sesión", loading: "Cerrando sesión…" },
  de: { title: "Abmelden?", message: "Möchten Sie sich wirklich abmelden?", cancel: "Abbrechen", confirm: "Ja, abmelden", loading: "Abmelden…" },
  it: { title: "Disconnettersi?", message: "Sei sicuro di voler uscire?", cancel: "Annulla", confirm: "Sì, esci", loading: "Disconnessione…" },
  ru: { title: "Выйти?", message: "Вы уверены, что хотите выйти?", cancel: "Отмена", confirm: "Да, выйти", loading: "Выход…" },
  zh: { title: "退出登录？", message: "确定要退出登录吗？", cancel: "取消", confirm: "确认退出", loading: "正在退出…" },
  hi: { title: "लॉग आउट करें?", message: "क्या आप वाकई लॉग आउट करना चाहते हैं?", cancel: "रद्द करें", confirm: "हाँ, लॉग आउट करें", loading: "लॉग आउट हो रहा है…" },
  tr: { title: "Çıkış yapılsın mı?", message: "Çıkış yapmak istediğinizden emin misiniz?", cancel: "İptal", confirm: "Evet, çıkış yap", loading: "Çıkış yapılıyor…" },
};

function esc(s) { return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"'); }

let totalInserted = 0;
for (const [lang, k] of Object.entries(T)) {
  // Find the language's block: "  <lang>: {" up to the matching "  }," at column 0+2.
  // Simpler & safer: insert right after THAT block's nav.signOut line.
  // We constrain the search to the lang block by locating its header first.
  const headerRe = new RegExp(`^  ${lang}:\\s*\\{`, "m");
  const headerMatch = headerRe.exec(src);
  if (!headerMatch) { console.warn(`! lang ${lang}: header not found, skip`); continue; }

  // Find end of this block (next "^  <other>: {" or end of file)
  const after = src.slice(headerMatch.index + headerMatch[0].length);
  const nextHeader = /^  [a-z]{2}:\s*\{/m.exec(after);
  const blockEndOffset = headerMatch.index + headerMatch[0].length + (nextHeader ? nextHeader.index : after.length);

  // Idempotency check inside this block
  const block = src.slice(headerMatch.index, blockEndOffset);
  if (block.includes('"auth.logout.title"')) {
    console.log(`= ${lang}: already has auth.logout.* — skip`);
    continue;
  }

  // Find nav.signOut line within this block
  const sosRe = /^( *)"nav\.signOut":\s*"[^"]*",?\s*$/m;
  const sosMatch = sosRe.exec(block);
  if (!sosMatch) { console.warn(`! ${lang}: nav.signOut not found in block, skip`); continue; }
  const indent = sosMatch[1];
  const insertAtRel = sosMatch.index + sosMatch[0].length;
  const insertAtAbs = headerMatch.index + insertAtRel;

  const lines = [
    `${indent}"auth.logout.title": "${esc(k.title)}",`,
    `${indent}"auth.logout.message": "${esc(k.message)}",`,
    `${indent}"auth.logout.cancel": "${esc(k.cancel)}",`,
    `${indent}"auth.logout.confirm": "${esc(k.confirm)}",`,
    `${indent}"auth.logout.loading": "${esc(k.loading)}",`,
  ].join("\n");

  src = src.slice(0, insertAtAbs) + "\n" + lines + src.slice(insertAtAbs);
  totalInserted++;
  console.log(`+ ${lang}: inserted 5 keys`);
}

fs.writeFileSync(FILE, src);
console.log(`Done. Inserted into ${totalInserted} language blocks.`);
