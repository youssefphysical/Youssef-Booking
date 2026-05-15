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
import type { Lang } from "../server/email/tokens";

const OUT_DIR = resolve(process.cwd(), "client/public/_email_preview");
mkdirSync(OUT_DIR, { recursive: true });

const SUPPORT = "support@youssefahmed.training";
const APP = "https://youssefahmed.training";
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

console.log("[golden] EN");
for (const { name, html } of renderAll("en")) {
  emit(`${name}`, html);
  emit(`${name}.dark`, forceDark(html));
}
console.log("[golden] AR");
for (const { name, html } of renderAll("ar")) {
  emit(`${name}.ar`, html);
}
console.log("\n[golden] Done. Open at /_email_preview/<file>.html");
