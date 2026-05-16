/**
 * Render the cinematic golden reference emails to /client/public/_email_preview/
 * for visual QA in the dev server.
 *
 * Run: `npx tsx scripts/render-golden-emails.ts`
 *
 * Each email is rendered in three variants for the QA matrix:
 *   - <name>.html         — English, default
 *   - <name>.dark.html    — English, simulates Gmail's [data-ogsc] auto-invert
 *   - <name>.ar.html      — Arabic, RTL
 *
 * The dev server serves them at /_email_preview/<file>.html.
 */

import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { buildPasswordResetEmail } from "../server/email/builders/passwordReset";
import { buildBookingConfirmationEmail } from "../server/email/builders/bookingConfirmation";
import { buildPackageCompletedEmail } from "../server/email/builders/packageCompleted";
import { buildPackageExpiring3dEmail } from "../server/email/builders/packageExpiring3d";
import { buildAdminNewBookingEmail } from "../server/email/builders/adminNewBooking";
import { buildWelcomeEmail } from "../server/email/builders/welcome";
import { buildSessionReminderEmail } from "../server/email/builders/sessionReminder";
import { buildPaymentConfirmedEmail } from "../server/email/builders/paymentConfirmed";
import type { Lang } from "../server/email/tokens";

const OUT_DIR = resolve(process.cwd(), "client/public/_email_preview");
mkdirSync(OUT_DIR, { recursive: true });

const SUPPORT = "support@youssefahmed.training";
// For local golden previews, use the dev server origin so the embedded
// hero <img> tags resolve against the locally-served /email-assets/heroes
// PNGs. In production, builders derive their base from PUBLIC_APP_URL via
// the URLs already passed in (deriveBaseUrl) — no script change needed.
const APP = "http://localhost:5000";
const WHATSAPP = "https://wa.me/971500000000";

function emit(name: string, html: string) {
  const path = resolve(OUT_DIR, `${name}.html`);
  writeFileSync(path, html, "utf8");
  console.log(`  → ${name}.html`);
}

/** Force-dark variant: wrap the body in a div that simulates Gmail's data-ogsc. */
function forceDark(html: string): string {
  return html.replace("<body ", `<body data-ogsc="" `);
}

function renderAll(lang: Lang): Array<{ name: string; html: string }> {
  return [
    {
      name: "01_password_reset",
      html: buildPasswordResetEmail({
        lang,
        recipientName: lang === "ar" ? "أحمد" : "Ahmed",
        resetUrl: `${APP}/auth/reset?token=demo`,
        expiresInMinutes: 30,
        supportEmail: SUPPORT,
      }).html,
    },
    {
      name: "02_booking_confirmation",
      html: buildBookingConfirmationEmail({
        lang,
        recipientName: lang === "ar" ? "أحمد" : "Ahmed",
        date: lang === "ar" ? "السبت، 17 مايو 2026" : "Sat, 17 May 2026",
        time12: lang === "ar" ? "10:00 صباحاً" : "10:00 AM",
        sessionFocus: lang === "ar" ? "الجزء العلوي — صدر وظهر" : "Upper body — chest & back",
        trainingGoal: lang === "ar" ? "بناء العضلات" : "Build muscle",
        location: lang === "ar" ? "استوديو المدرب يوسف، مرسى دبي" : "Coach Youssef's studio, Dubai Marina",
        bookingUrl: `${APP}/dashboard`,
        rescheduleUrl: `${APP}/book`,
        supportEmail: SUPPORT,
        sessionType: lang === "ar" ? "باقة · 12 جلسة" : "Package · 12 sessions",
        packageName: lang === "ar" ? "باقة 12 جلسة بريميوم" : "12-Session Premium",
        remainingSessions: 7,
        totalSessions: 12,
        paymentStatus: lang === "ar" ? "مدفوع" : "Paid",
      }).html,
    },
    {
      name: "03_package_completed",
      html: buildPackageCompletedEmail({
        lang,
        recipientName: lang === "ar" ? "أحمد" : "Ahmed",
        packageName: lang === "ar" ? "باقة 12 جلسة بريميوم" : "12-Session Premium",
        sessionsCompleted: 12,
        weeksActive: 8,
        attendanceRate: 100,
        streakWeeks: 8,
        renewUrl: `${APP}/packages`,
        historyUrl: `${APP}/dashboard`,
        supportEmail: SUPPORT,
      }).html,
    },
    {
      name: "04_package_expiring_3d",
      html: buildPackageExpiring3dEmail({
        lang,
        recipientName: lang === "ar" ? "أحمد" : "Ahmed",
        packageName: lang === "ar" ? "باقة 12 جلسة بريميوم" : "12-Session Premium",
        sessionsRemaining: 2,
        expiryDate: lang === "ar" ? "الأحد، 18 مايو 2026" : "Sun, 18 May 2026",
        renewUrl: `${APP}/packages`,
        whatsappUrl: WHATSAPP,
        supportEmail: SUPPORT,
      }).html,
    },
    {
      name: "05_admin_new_booking",
      html: buildAdminNewBookingEmail({
        lang,
        clientName: "Ahmed Khalil",
        clientPhone: "+971 50 000 0000",
        clientEmail: "ahmed.khalil@example.com",
        date: "Sat, 17 May 2026",
        time12: "10:00 AM",
        sessionType: "Package",
        packageName: "12-Session Premium",
        sessionFocus: "Upper body — chest & back",
        trainingGoal: "Build muscle",
        notes: "Slight shoulder discomfort from last week — keep volume moderate.",
        adminUrl: `${APP}/admin/bookings`,
        supportEmail: SUPPORT,
        paymentStatus: "Paid",
        bookingSource: "Web booking",
        actionTimestamp: "13 May 2026, 02:14 PM GST",
        remainingSessions: 7,
        totalSessions: 12,
      }).html,
    },
    {
      name: "06_welcome",
      html: buildWelcomeEmail({
        lang,
        recipientName: lang === "ar" ? "أحمد" : "Ahmed",
        bookingUrl: `${APP}/book`,
        whatsappUrl: WHATSAPP,
        supportEmail: SUPPORT,
        trainerName: lang === "ar" ? "المدرب يوسف" : "Coach Youssef",
        studioLocation: lang === "ar" ? "مرسى دبي" : "Dubai Marina studio",
      }).html,
    },
    {
      name: "07_session_reminder_24h",
      html: buildSessionReminderEmail({
        lang,
        kind: "24h",
        recipientName: lang === "ar" ? "أحمد" : "Ahmed",
        date: lang === "ar" ? "السبت، 17 مايو 2026" : "Sat, 17 May 2026",
        time12: lang === "ar" ? "10:00 صباحاً" : "10:00 AM",
        sessionFocus: lang === "ar" ? "الجزء العلوي — صدر وظهر" : "Upper body — chest & back",
        location: lang === "ar" ? "استوديو المدرب يوسف، مرسى دبي" : "Coach Youssef's studio, Dubai Marina",
        bookingUrl: `${APP}/dashboard`,
        rescheduleUrl: `${APP}/book`,
        supportEmail: SUPPORT,
      }).html,
    },
    {
      name: "09_payment_confirmed",
      html: buildPaymentConfirmedEmail({
        lang,
        recipientName: lang === "ar" ? "أحمد" : "Ahmed",
        amount: "AED 2,500",
        paymentMethod: lang === "ar" ? "تحويل بنكي" : "Bank transfer",
        paymentReference: "PAY-2026-0517-A1B2",
        paymentDate: lang === "ar" ? "السبت، 17 مايو 2026" : "Sat, 17 May 2026",
        packageName: lang === "ar" ? "باقة 12 جلسة بريميوم" : "12-Session Premium",
        totalSessions: 12,
        validityLabel: lang === "ar" ? "٨ أسابيع" : "8 weeks",
        startDate: lang === "ar" ? "الاثنين، 19 مايو 2026" : "Mon, 19 May 2026",
        packageUrl: `${APP}/packages`,
        bookUrl: `${APP}/book`,
        whatsappUrl: WHATSAPP,
        supportEmail: SUPPORT,
      }).html,
    },
    {
      name: "08_session_reminder_1h",
      html: buildSessionReminderEmail({
        lang,
        kind: "1h",
        recipientName: lang === "ar" ? "أحمد" : "Ahmed",
        date: lang === "ar" ? "السبت، 17 مايو 2026" : "Sat, 17 May 2026",
        time12: lang === "ar" ? "10:00 صباحاً" : "10:00 AM",
        sessionFocus: lang === "ar" ? "الجزء العلوي — صدر وظهر" : "Upper body — chest & back",
        location: lang === "ar" ? "استوديو المدرب يوسف، مرسى دبي" : "Coach Youssef's studio, Dubai Marina",
        bookingUrl: `${APP}/dashboard`,
        rescheduleUrl: `${APP}/book`,
        supportEmail: SUPPORT,
      }).html,
    },
  ];
}

// Friendly-name aliases so production URLs match the names referenced in
// docs/handoff (e.g. /_email_preview/welcome.html). The prefixed files
// (06_welcome.html, etc.) stay for stable QA ordering.
const FRIENDLY: Record<string, string> = {
  "01_password_reset": "passwordReset",
  "02_booking_confirmation": "bookingConfirmation",
  "03_package_completed": "packageCompleted",
  "04_package_expiring_3d": "packageExpiring3d",
  "05_admin_new_booking": "adminNewBooking",
  "06_welcome": "welcome",
  "07_session_reminder_24h": "sessionReminder",
  "08_session_reminder_1h": "sessionReminder1h",
  "09_payment_confirmed": "paymentConfirmed",
};

console.log("[golden] EN");
const enRendered = renderAll("en");
for (const { name, html } of enRendered) {
  emit(`${name}`, html);
  emit(`${name}.dark`, forceDark(html));
  const alias = FRIENDLY[name];
  if (alias) emit(alias, html);
}
console.log("[golden] AR");
const arRendered = renderAll("ar");
for (const { name, html } of arRendered) {
  emit(`${name}.ar`, html);
  const alias = FRIENDLY[name];
  if (alias) emit(`${alias}.ar`, html);
}

// ─── Index page ────────────────────────────────────────────────────────
// Serves /_email_preview/ (the directory root) so it stops 404-ing on
// Vercel and gives a clickable QA dashboard.
const ordered = enRendered.map(({ name }) => name).sort();
const linkRow = (file: string, label: string) =>
  `<a href="./${file}" style="display:block;padding:14px 18px;background:#0f1014;border:1px solid #1f2230;border-radius:10px;color:#7ee7ff;text-decoration:none;font:14px/1.4 -apple-system,Segoe UI,sans-serif;margin-bottom:10px;transition:border-color .15s;" onmouseover="this.style.borderColor='#5ee7ff'" onmouseout="this.style.borderColor='#1f2230'">${label}<div style="color:#6b7280;font-size:11px;margin-top:4px;letter-spacing:.04em;">${file}</div></a>`;

const sections = ordered
  .map((name) => {
    const alias = FRIENDLY[name];
    const title = name
      .replace(/^\d+_/, "")
      .replace(/_/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    const aliasRow = alias ? linkRow(`${alias}.html`, `${title} — friendly URL`) : "";
    return (
      `<div style="margin-bottom:28px;">`
      + `<div style="color:#a3b1c2;font:600 11px/1 -apple-system;letter-spacing:.18em;text-transform:uppercase;margin-bottom:12px;">${title}</div>`
      + aliasRow
      + linkRow(`${name}.html`, "EN · light")
      + linkRow(`${name}.dark.html`, "EN · forced dark")
      + linkRow(`${name}.ar.html`, "AR · RTL")
      + `</div>`
    );
  })
  .join("");

const indexHtml =
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Email Previews · Youssef Ahmed Training</title></head>`
  + `<body style="margin:0;background:#050505;color:#e6edf3;font:14px/1.5 -apple-system,Segoe UI,sans-serif;padding:48px 24px;">`
  + `<div style="max-width:760px;margin:0 auto;">`
  + `<h1 style="font:700 28px/1.2 -apple-system;color:#fff;letter-spacing:-.01em;margin:0 0 8px;">Email Previews</h1>`
  + `<div style="color:#6b7280;font-size:13px;margin-bottom:36px;letter-spacing:.04em;">TRON-grade golden references · ${ordered.length} flows × 3 variants</div>`
  + sections
  + `</div></body></html>`;
writeFileSync(resolve(OUT_DIR, "index.html"), indexHtml, "utf8");
console.log("  → index.html");

console.log("\n[golden] Done. Open at /_email_preview/");
