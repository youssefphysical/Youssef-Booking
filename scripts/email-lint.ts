/* eslint-disable */
import * as T from "../server/email-templates";

const sampleBooking = {
  clientName: "Sara Khalil", date: "2026-05-20", time12: "9:00 AM",
  sessionFocusLabel: "Strength + Conditioning", trainingGoalLabel: "Fat loss",
  sessionTypeLabel: "Package", packageName: "Premium 12 (3×/week)",
  remainingSessions: 8, packageExpiryDate: "2026-06-30",
  currentSessionNumber: 4, totalSessions: 12,
  partnerFullName: null, partnerPhone: null, partnerEmail: null,
};
const jobs: Array<[string, () => { subject: string; html: string; text: string }]> = [
  ["client.welcome", () => T.buildWelcomeEmail({ clientName: "Sara Khalil", lang: "en" })],
  ["client.bookingConfirmation", () => T.buildClientBookingConfirmationEmail({ data: sampleBooking, lang: "en" })],
  ["client.reminder24h", () => T.buildSessionReminderEmail({ data: sampleBooking, lang: "en", kind: "24h" })],
  ["client.reminder1h", () => T.buildSessionReminderEmail({ data: sampleBooking, lang: "en", kind: "1h" })],
  ["client.packageExpiring", () => T.buildPackageExpiringEmail({ clientName: "Sara Khalil", lang: "en", remainingSessions: 2, daysUntilExpiry: 5, packageName: "Premium 12" })],
  ["client.packageFinished", () => T.buildPackageFinishedEmail({ clientName: "Sara Khalil", lang: "en", packageName: "Premium 12" })],
  ["client.passwordReset", () => T.buildPasswordResetEmail({ resetUrl: "https://example.com/reset-password?token=sample", lang: "en" })],
  ["admin.newClient", () => T.buildAdminNewClientEmail({ clientName: "Sara Khalil", email: "sara@example.com", phone: "+971 50 123 4567", primaryGoal: "Fat loss", weeklyFrequency: 3, area: "Dubai Marina", packageName: "Premium 12", packagePrice: 2500 })],
  ["admin.newBooking", () => T.buildAdminBookingEmail({ d: sampleBooking, clientEmail: "sara@example.com", clientPhone: "+971 50 123 4567", clientNotes: "Please focus on hamstrings." } as any)],
  ["admin.bookingCancellation", () => T.buildAdminBookingChangeEmail({ kind: "cancellation", clientName: "Sara Khalil", date: "2026-05-20", time12: "9:00 AM", reason: "Client requested cancellation." })],
  ["admin.bookingReschedule", () => T.buildAdminBookingChangeEmail({ kind: "reschedule", clientName: "Sara Khalil", date: "2026-05-22", time12: "10:00 AM", fromDate: "2026-05-20", fromTime12: "9:00 AM" })],
  ["admin.inbody", () => T.buildAdminInbodyEmail({ clientName: "Sara Khalil", recordedDate: "2026-05-20" })],
  ["admin.packageExpiringAlert", () => (T as any).buildAdminPackageExpiringEmail({ clientName: "Sara Khalil", packageName: "Premium 12", remainingSessions: 2, daysUntilExpiry: 5 })],
  ["admin.attendance", () => T.buildAdminAttendanceEmail({ attendance: "attended", clientName: "Sara Khalil", date: "2026-05-20", time12: "9:00 AM", packageName: "Premium 12", remainingSessions: 7 })],
  ["admin.emergencyCancel", () => T.buildAdminEmergencyCancelEmail({ clientName: "Sara Khalil", date: "2026-05-20", time12: "9:00 AM", monthlyQuotaUsed: 1, monthlyQuotaTotal: 2, reason: "Family emergency." })],
  ["admin.payment", () => T.buildAdminPaymentEmail({ clientName: "Sara Khalil", packageName: "Premium 12", paymentStatus: "paid", amountReceived: 2500, amountPaidTotal: 2500, packageTotal: 2500 })],
  ["admin.packageActivated", () => T.buildAdminPackageActivatedEmail({ clientName: "Sara Khalil", packageName: "Premium 12", totalSessions: 12, paidSessions: 12, bonusSessions: 0, totalPrice: 2500, startDate: "2026-05-15", expiryDate: "2026-06-30", paymentStatus: "paid", source: "new" })],
  ["admin.packageExpired", () => T.buildAdminPackageExpiredEmail({ clientName: "Sara Khalil", packageName: "Premium 12", reason: "sessions_exhausted", totalSessions: 12, expiryDate: "2026-06-30" })],
  ["admin.packageExtended", () => T.buildAdminPackageExtendedEmail({ clientName: "Sara Khalil", packageName: "Premium 12", daysAdded: 7, previousExpiry: "2026-06-30", newExpiry: "2026-07-07", reason: "Client travel." })],
  ["admin.profileUpdate", () => T.buildAdminProfileUpdateEmail({ clientName: "Sara Khalil", changes: [["Phone", "old → new"], ["Weekly frequency", "3 → 4"]] })],
];

const GMAIL_CLIP = 102 * 1024;
const out: any[] = [];
for (const [name, fn] of jobs) {
  try {
    const b = fn();
    const html = b.html || "";
    const bytes = Buffer.byteLength(html, "utf8");
    const openTbl = (html.match(/<table\b/gi) || []).length;
    const closeTbl = (html.match(/<\/table>/gi) || []).length;
    const openTr = (html.match(/<tr\b/gi) || []).length;
    const closeTr = (html.match(/<\/tr>/gi) || []).length;
    const openTd = (html.match(/<td\b/gi) || []).length;
    const closeTd = (html.match(/<\/td>/gi) || []).length;
    const imgs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map(m => m[1]);
    const externalImgs = imgs.filter(s => /^https?:/i.test(s));
    const dataImgs = imgs.filter(s => /^data:/i.test(s));
    const widthAttrs = [...html.matchAll(/width=["']?(\d+)["']?/gi)].map(m => +m[1]);
    const maxWidth = widthAttrs.length ? Math.max(...widthAttrs) : 0;
    const hasViewport = /name=["']viewport/i.test(html);
    const hasDarkColorScheme = /color-scheme/i.test(html);
    const hasMobileMedia = /@media[^{]*max-width/i.test(html);
    const hasButtonTable = /<table[^>]*role=["']?presentation/i.test(html);
    const subjectLen = (b.subject || "").length;
    const subjectHasCRLF = /[\r\n]/.test(b.subject || "");
    out.push({
      name, kb: +(bytes / 1024).toFixed(1),
      gmailClip: bytes >= GMAIL_CLIP ? "CLIP" : (bytes >= GMAIL_CLIP * 0.9 ? "WARN" : "OK"),
      tablesBalanced: openTbl === closeTbl && openTr === closeTr && openTd === closeTd,
      tableCounts: `tbl ${openTbl}/${closeTbl} tr ${openTr}/${closeTr} td ${openTd}/${closeTd}`,
      externalImgs: externalImgs.length, dataImgs: dataImgs.length,
      externalImgUrls: externalImgs.length ? externalImgs : undefined,
      maxWidth, hasViewport, hasDarkColorScheme, hasMobileMedia, hasButtonTable,
      subjectLen, subjectHasCRLF,
    });
  } catch (e: any) {
    out.push({ name, error: String(e?.message || e) });
  }
}
console.log(JSON.stringify(out, null, 2));
