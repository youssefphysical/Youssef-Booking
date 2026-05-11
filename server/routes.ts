import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { setupAuth, hashPassword, sanitizeUser, sanitizeUserAdminView, sanitizeAndEnrich, sanitizeAndEnrichMany, computeIsVerified } from "./auth";
import sharp from "sharp";
import { storage, computePackageStatus, isPackageBlocking } from "./storage";
import { pool } from "./db";
import {
  insertBookingSchema,
  updateBookingSchema,
  updateSettingsSchema,
  insertBlockedSlotSchema,
  updateProfileSchema,
  insertPackageSchema,
  updatePackageSchema,
  insertPackageTemplateSchema,
  updatePackageTemplateSchema,
  insertFoodSchema,
  updateFoodSchema,
  insertMealSchema,
  updateMealSchema,
  insertNutritionPlanSchema,
  updateNutritionPlanSchema,
  insertSupplementSchema,
  updateSupplementSchema,
  insertSupplementStackSchema,
  updateSupplementStackSchema,
  insertClientSupplementSchema,
  updateClientSupplementSchema,
  applyStackToClientSchema,
  insertBodyMetricSchema,
  updateBodyMetricSchema,
  insertWeeklyCheckinSchema,
  updateWeeklyCheckinSchema,
  insertInbodySchema,
  updateInbodySchema,
  insertProgressPhotoSchema,
  insertHeroImageSchema,
  updateHeroImageSchema,
  insertTransformationSchema,
  updateTransformationSchema,
  protectedCancellationQuota,
  sameDayAdjustQuota,
  tierFromFrequency,
  normaliseTier,
  insertAdminUserSchema,
  updateAdminUserSchema,
  insertManualBookingSchema,
  bulkManualBookingSchema,
  hasPermission,
  isEffectiveSuperAdmin,
  SUPER_ADMIN_EMAIL,
  DEFAULT_PERMISSIONS_BY_ROLE,
  SESSION_FOCUS_LABELS_EN,
  BOOKING_TRAINING_GOAL_LABELS_EN,
  SESSION_TYPE_LABELS_EN,
  PACKAGE_STATUS_LABELS_EN,
  insertRenewalRequestSchema,
  insertExtensionRequestSchema,
  renewalDecisionSchema,
  extensionDecisionSchema,
  attendanceUpdateSchema,
  adminClientNotesSchema,
  extendPackageSchema,
  freezePackageSchema,
  updatePackagePaymentSchema,
  adjustPackageSessionsSchema,
  approvePackageSchema,
  evaluateBookingEligibility,
  CLIENT_STATUSES,
  PACKAGE_DEFINITIONS,
  PACKAGE_TYPES,
  type User,
  type Package,
  type Booking,
  type AdminPermissionKey,
  type ClientStatus,
  type AdminAnalytics,
} from "@shared/schema";
import {
  sendEmail,
  trainerEmail,
  emailConfigStatus,
} from "./email";
import {
  buildClientBookingConfirmationEmail,
  buildAdminBookingEmail,
  buildAdminBookingChangeEmail,
  buildAdminInbodyEmail,
  buildAdminPackageExpiringEmail,
  buildPackageExpiringEmail,
  buildPackageFinishedEmail,
  buildSessionReminderEmail,
  type BookingDetails,
} from "./email-templates";
import { z } from "zod";
import { extractInbodyMetricsFromImage } from "./inbody-extract";
import { notifyUser, notifyUserOnce } from "./services/notifications";
import { runAutoCompleteBookings, getLastAutoCompleteRun, getLastCronRunAt } from "./services/autoCompleteBookings";
import { computeClientIntelligence } from "./services/clientIntelligence";
import { optimizeImageFile } from "./image-utils";

function currentMonthKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Auth/role guards — return both `error` (machine-readable) and `message`
// (human-readable) for backwards compatibility with existing clients.
// Friendly 401 for booking-adjacent routes. Mirrors the user-facing
// message from the May 2026 booking-safety brief so anonymous POSTs to
// /api/bookings get an actionable hint instead of a generic "Auth required".
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    // Booking-friendly copy per May 2026 brief — generic "Unauthorized"
    // confused users hitting POST /api/bookings without a session. The
    // `error` field stays machine-readable for clients that branch on it.
    return res.status(401).json({
      error: "Unauthorized",
      message: "Please sign in or create an account before booking your session.",
    });
  }
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Unauthorized", message: "Unauthorized" });
  }
  const u = req.user as User;
  if (u.role !== "admin") {
    return res.status(403).json({ error: "Forbidden", message: "Admins only" });
  }
  if (u.isActive === false) {
    return res.status(403).json({ error: "Forbidden", message: "Your admin access is currently disabled." });
  }
  next();
}

function requireSuperAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Unauthorized", message: "Unauthorized" });
  }
  const u = req.user as User;
  if (!isEffectiveSuperAdmin(u)) {
    return res.status(403).json({ error: "Forbidden", message: "Super admins only" });
  }
  next();
}

function requirePermission(key: AdminPermissionKey) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated() || !req.user) {
      return res.status(401).json({ error: "Unauthorized", message: "Unauthorized" });
    }
    const u = req.user as User;
    if (u.role !== "admin") {
      return res.status(403).json({ error: "Forbidden", message: "Admins only" });
    }
    if (u.isActive === false) {
      return res.status(403).json({ error: "Forbidden", message: "Your admin access is currently disabled." });
    }
    if (hasPermission(u, key)) return next();
    return res.status(403).json({
      error: "Forbidden",
      message: "You do not have permission to perform this action.",
    });
  };
}

// Anchor every session date/time to Asia/Dubai (UTC+4, no DST). Without
// this explicit offset, `new Date("YYYY-MM-DDTHH:MM:00")` is parsed as
// the SERVER'S local time — fine on a Dubai-region box, catastrophic on
// Vercel (which runs in UTC). A booking at "14:00" would compute an
// endTime 4 hours ahead, breaking auto-completion + reminders + lead-time
// checks. Dubai stays on UTC+4 year-round so a string offset is sufficient
// (no Intl/date-fns-tz dep needed).
const DUBAI_TZ_OFFSET = "+04:00";

function buildSessionDate(date: string, timeSlot: string): Date {
  return new Date(`${date}T${timeSlot}:00${DUBAI_TZ_OFFSET}`);
}

// Compute when a session is over (UTC instant) given its date, slot, and
// duration. Used by the auto-complete cron to decide if a booking has
// expired. Falls back to 60 min for legacy rows where durationMinutes
// is somehow missing — should not happen post-ensureSchema but defensive.
function buildSessionEndDate(
  date: string,
  timeSlot: string,
  durationMinutes: number | null | undefined,
): Date {
  const start = buildSessionDate(date, timeSlot);
  const mins = typeof durationMinutes === "number" && durationMinutes > 0 ? durationMinutes : 60;
  return new Date(start.getTime() + mins * 60_000);
}

// Mon-anchored ISO week start (UTC YYYY-MM-DD). Mirrors the streak logic
// used by /api/me/today so missed-checkin nudges line up with the streak.
function mondayOfUtc(d: Date): string {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  const day = x.getUTCDay(); // 0=Sun..6=Sat
  const offset = day === 0 ? -6 : 1 - day;
  x.setUTCDate(x.getUTCDate() + offset);
  return x.toISOString().slice(0, 10);
}

// =============================
// P5b — Cron-driven trigger passes
// =============================
// Both helpers are idempotent: notifyUserOnce keys ensure the same
// (user, kind, window) never fires twice across cron invocations.
// Both swallow per-row errors so one bad record doesn't poison the pass.

const EXPIRY_WINDOWS_DAYS = [7, 3, 1] as const;

async function runPackageExpiryNotifications(): Promise<void> {
  // Pull only active packages — expired/completed/frozen don't need
  // expiry warnings. activeOnly=true filters to status='active' in storage.
  const pkgs = await storage.getPackages({ activeOnly: true });
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  for (const p of pkgs) {
    if (!p.expiryDate) continue;
    const expiry = new Date(`${String(p.expiryDate)}T00:00:00Z`);
    if (isNaN(expiry.getTime())) continue;
    const daysLeft = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
    // Match the closest window the package falls into. Each window only
    // fires once per (package, window) thanks to the dedupeKey.
    const window = EXPIRY_WINDOWS_DAYS.find((w) => daysLeft === w);
    if (window === undefined) continue;
    const label = window === 1 ? "tomorrow" : `in ${window} days`;
    void notifyUserOnce(
      p.userId,
      "package_expiring",
      `pkg-${p.id}-d${window}`,
      "Your package is expiring",
      `Your ${p.type} package expires ${label} (${p.expiryDate}). Tap to renew.`,
      { link: "/dashboard", meta: { packageId: p.id, daysLeft: window } },
    );
  }
}

async function runMissedCheckinNotifications(): Promise<void> {
  // Only nudge from Tuesday onward — Mondays are too early to call a
  // check-in "missed". UTC day: 0=Sun..6=Sat, Tue=2.
  const now = new Date();
  if (now.getUTCDay() < 2 && now.getUTCDay() !== 0) return; // skip Mon (day=1)
  const weekStart = mondayOfUtc(now);
  const clients = await storage.getAllClients();
  for (const u of clients) {
    if ((u as any).clientStatus !== "active") continue;
    try {
      const existing = await storage.getWeeklyCheckinByWeek(u.id, weekStart);
      if (existing) continue;
      void notifyUserOnce(
        u.id,
        "missed_checkin",
        `checkin-${weekStart}`,
        "Weekly check-in pending",
        "Two minutes — log how this week's training, sleep, and nutrition went so we can adjust.",
        { link: "/dashboard", meta: { weekStart } },
      );
    } catch {
      /* per-row best-effort */
    }
  }
}

// Clients must book at least 3 hours before the session starts so the trainer
// has time to prepare and travel to the location. Admins bypass this rule.
// The cancellation cutoff is SEPARATE (default 6h, configurable via
// settings.cancellation_cutoff_hours) — do not conflate.
const MIN_ADVANCE_BOOKING_HOURS = 3;
const MIN_ADVANCE_BOOKING_MS = MIN_ADVANCE_BOOKING_HOURS * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
const DUBAI_OFFSET_MS = 4 * HOUR_MS;
/**
 * Booking lead-time cutoff. Mirrors `bookingCutoffMs` in
 * client/src/lib/booking-utils.ts — keep in sync. Business rule: round the
 * current Dubai wall-clock UP to the next full hour, then add
 * MIN_ADVANCE_BOOKING_HOURS. Any slot starting before the result must be
 * rejected. Dubai is fixed UTC+4 (no DST) so the constant offset is safe.
 */
function bookingCutoffMs(now: number = Date.now()): number {
  const dubaiNow = now + DUBAI_OFFSET_MS;
  const remainder = dubaiNow % HOUR_MS;
  const ceilDubai = remainder === 0 ? dubaiNow : dubaiNow + (HOUR_MS - remainder);
  return ceilDubai - DUBAI_OFFSET_MS + MIN_ADVANCE_BOOKING_MS;
}

// Single source of truth for "this status consumes a session credit". Used
// by every booking-mutation path (PATCH /:id, /:id/cancel, /:id/attendance,
// admin manual create, auto-complete cron) so a transition like
// `no_show → cancelled` decrements consistently regardless of which route
// drove it. Architect-flagged P1: previously PATCH /:id used a 2-element
// list and attendance used a 3-element list, so generic-PATCH transitions
// touching `no_show` could leak credits.
const CONSUMING_STATUSES = ["completed", "late_cancelled", "no_show"] as const;
const CANCELLED_STATUSES = ["cancelled", "free_cancelled", "late_cancelled", "emergency_cancelled"] as const;
const ALLOWED_BOOKING_HOURS = new Set([
  "06:00","07:00","08:00","09:00","10:00","11:00",
  "12:00","13:00","14:00","15:00","16:00","17:00",
  "18:00","19:00","20:00","21:00","22:00",
]);

function todayDateString(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Recompute the client's VIP tier based on their declared weekly frequency.
// Skips silently when an admin has set a manual override on the account.
// Best-effort: never throws.
async function recomputeVipTier(userId: number): Promise<string> {
  try {
    const user = await storage.getUser(userId);
    if (!user) return "foundation";
    if (user.vipTierManualOverride) return user.vipTier || "foundation";
    // Legacy users may not have a weeklyFrequency yet. Don't silently downgrade
    // them to foundation — preserve their current tier (normalised) until they
    // (or an admin) set a frequency explicitly.
    if (user.weeklyFrequency == null) {
      return normaliseTier(user.vipTier);
    }
    const tier = tierFromFrequency(user.weeklyFrequency);
    if (user.vipTier !== tier) {
      await storage.updateUser(userId, {
        vipTier: tier,
        vipUpdatedAt: new Date(),
      } as any);
    }
    return tier;
  } catch (e) {
    console.warn("[vip] recompute failed:", e);
    return "foundation";
  }
}

// =============================
// MULTER SETUP
// =============================
const UPLOAD_ROOT = path.resolve(process.cwd(), "uploads");
for (const sub of ["inbody", "photos"]) {
  const full = path.join(UPLOAD_ROOT, sub);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
}

// Strict MIME allowlists. The InBody flow legitimately accepts PDFs (lab
// reports), but the progress-photo endpoint must only accept images.
const PHOTO_MIME_ALLOWLIST = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
]);
const INBODY_MIME_ALLOWLIST = new Set<string>([
  ...Array.from(PHOTO_MIME_ALLOWLIST),
  "application/pdf",
]);

function makeUploader(subdir: "inbody" | "photos") {
  const allow = subdir === "photos" ? PHOTO_MIME_ALLOWLIST : INBODY_MIME_ALLOWLIST;
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, path.join(UPLOAD_ROOT, subdir)),
      filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}_${safe}`);
      },
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
    // Defense-in-depth: even though the new admin cropper produces WebP and
    // existing clients use accept="image/*", reject anything else server-side
    // before it ever touches disk.
    fileFilter: (_req, file, cb) => {
      if (allow.has((file.mimetype || "").toLowerCase())) {
        cb(null, true);
      } else {
        cb(new Error("Unsupported file type"));
      }
    },
  });
}

const inbodyUploader = makeUploader("inbody");
const photoUploader = makeUploader("photos");

/**
 * Wraps a multer single-file middleware so MIME-filter or size errors are
 * returned as a clean 400 JSON instead of crashing the request with a 500.
 */
function safeSingle(uploader: ReturnType<typeof makeUploader>, field: string) {
  const mw = uploader.single(field);
  return (req: any, res: any, next: any) => {
    mw(req, res, (err: any) => {
      if (!err) return next();
      const msg =
        err?.code === "LIMIT_FILE_SIZE"
          ? "File is too large"
          : err?.message === "Unsupported file type"
            ? "Unsupported file type. Use PNG, JPEG, WebP, or HEIC."
            : "Could not process upload";
      return res.status(400).json({ message: msg });
    });
  };
}

function fileToPublicUrl(file: Express.Multer.File, subdir: "inbody" | "photos"): string {
  return `/uploads/${subdir}/${file.filename}`;
}

// =============================================================
// Booking notifications dispatcher (admin in-app + trainer/client emails).
// Always best-effort. Caller wraps it in try/catch so booking never fails.
// =============================================================
function formatTime12Server(timeSlot: string): string {
  const m = /^(\d{1,2}):(\d{2})/.exec(timeSlot || "");
  if (!m) return timeSlot;
  const h = Number(m[1]);
  const min = m[2];
  if (Number.isNaN(h) || h < 0 || h > 23) return timeSlot;
  const period = h >= 12 ? "PM" : "AM";
  let h12 = h % 12;
  if (h12 === 0) h12 = 12;
  return `${h12}:${min} ${period}`;
}

async function dispatchBookingNotifications(args: {
  booking: Booking;
  targetUserId: number;
  sessionType: string;
  lang: string;
}): Promise<void> {
  const { booking, targetUserId, sessionType, lang } = args;

  // Resolve user + package context (best-effort lookups)
  const user = await storage.getUser(targetUserId).catch(() => undefined);
  const pkg = booking.packageId
    ? await storage.getPackage(booking.packageId).catch(() => undefined)
    : undefined;

  const clientName =
    (user?.fullName?.trim() || user?.username || `Client #${targetUserId}`).trim();

  const focusKey = booking.sessionFocus || "";
  const goalKey = booking.trainingGoal || "";
  const sessionFocusLabel = SESSION_FOCUS_LABELS_EN[focusKey] || focusKey || "—";
  const trainingGoalLabel = BOOKING_TRAINING_GOAL_LABELS_EN[goalKey] || goalKey || "—";
  const sessionTypeLabel = SESSION_TYPE_LABELS_EN[sessionType] || sessionType;
  const time12 = formatTime12Server(booking.timeSlot);

  const remainingSessions =
    pkg && typeof pkg.totalSessions === "number" && typeof pkg.usedSessions === "number"
      ? Math.max(0, pkg.totalSessions - pkg.usedSessions - 1)
      : null;

  // Use admin-controlled startDate/expiryDate when present; fall back to purchase date.
  const packageStartDate = pkg?.startDate
    ? String(pkg.startDate)
    : pkg?.purchasedAt
      ? new Date(pkg.purchasedAt as any).toISOString().slice(0, 10)
      : null;
  const packageExpiryDate = pkg?.expiryDate ? String(pkg.expiryDate) : null;
  const packageName = pkg ? `${pkg.type} (${pkg.totalSessions} sessions)` : null;

  const data = {
    clientName,
    clientEmail: user?.email ?? null,
    clientPhone: user?.phone ?? null,
    date: booking.date,
    timeSlot: booking.timeSlot,
    time12,
    sessionFocusLabel,
    trainingGoalLabel,
    sessionTypeLabel,
    trainingLevel: user?.trainingLevel ?? null,
    clientNotes: booking.clientNotes ?? null,
    packageName,
    packageStartDate,
    packageExpiryDate,
    currentSessionNumber: pkg ? (pkg.usedSessions ?? 0) + 1 : null,
    totalSessions: pkg?.totalSessions ?? null,
    remainingSessions,
  };

  // ---- 1. In-app admin notification ----
  const partnerName = (booking as any).partnerFullName?.toString().trim();
  const partnerSuffix = partnerName ? ` • partner: ${partnerName}` : "";
  try {
    await storage.createAdminNotification({
      kind: "booking_new",
      title: `New booking — ${clientName}`,
      body: `${booking.date} at ${time12} • ${sessionFocusLabel} • ${trainingGoalLabel} • ${sessionTypeLabel}${partnerSuffix}`,
      userId: targetUserId,
      bookingId: booking.id,
    });
  } catch (e) {
    console.warn("[notif] createAdminNotification failed:", e);
  }

  // ---- 1b. P5b: Client-facing in-app booking confirmation ----
  // One-shot, no dedupe needed — booking creation is inherently single-fire.
  void notifyUser(
    targetUserId,
    "system",
    "Session booked",
    `${booking.date} at ${time12} — ${sessionFocusLabel}`,
    { link: "/dashboard", meta: { bookingId: booking.id } },
  );

  const bookingDetails: BookingDetails = {
    clientName,
    date: booking.date,
    time12,
    sessionFocusLabel,
    trainingGoalLabel,
    sessionTypeLabel,
    packageName,
    remainingSessions,
    packageExpiryDate,
    currentSessionNumber: pkg ? (pkg.usedSessions ?? 0) + 1 : null,
    totalSessions: pkg?.totalSessions ?? null,
    // Sanitize partner fields before rendering — defense-in-depth even
    // though the Zod insert schema already trims/validates on write.
    partnerFullName: (booking as any).partnerFullName?.toString().trim() || null,
    partnerPhone: (booking as any).partnerPhone?.toString().trim() || null,
    partnerEmail: (booking as any).partnerEmail?.toString().trim() || null,
  };

  // ---- 2. Trainer email (premium English template, always to TRAINER_EMAIL) ----
  try {
    const trainerMsg = buildAdminBookingEmail({
      d: bookingDetails,
      clientEmail: user?.email ?? null,
      clientPhone: user?.phone ?? null,
      clientNotes: booking.clientNotes ?? null,
    });
    await sendEmail({
      to: trainerEmail(),
      subject: trainerMsg.subject,
      text: trainerMsg.text,
      html: trainerMsg.html,
      replyTo: user?.email ?? undefined,
    });
  } catch (e) {
    console.warn("[notif] trainer email failed:", e);
  }

  // ---- 3. Client email (premium localized template) ----
  if (user?.email) {
    try {
      const clientMsg = buildClientBookingConfirmationEmail({
        data: bookingDetails,
        lang,
      });
      await sendEmail({
        to: user.email,
        subject: clientMsg.subject,
        text: clientMsg.text,
        html: clientMsg.html,
        replyTo: trainerEmail(),
      });
    } catch (e) {
      console.warn("[notif] client email failed:", e);
    }
  }

  // ---- 4. Package "expiring soon" / "finished" emails (best-effort) ----
  // Sent at most once per package per threshold via package.expiring_notified_at
  // / .finished_notified_at timestamps so the client doesn't get spammed every
  // time they book.
  if (pkg && user?.email) {
    try {
      const remainingAfter = remainingSessions ?? null;
      const daysToExpiry = pkg.expiryDate
        ? Math.ceil(
            (new Date(String(pkg.expiryDate)).getTime() - Date.now()) / 86_400_000,
          )
        : null;
      const isFinished = remainingAfter === 0;
      const isLow =
        !isFinished &&
        ((remainingAfter !== null && remainingAfter <= 3) ||
          (daysToExpiry !== null && daysToExpiry > 0 && daysToExpiry <= 7));

      const pkgAny = pkg as any;
      if (isFinished && !pkgAny.finishedNotifiedAt) {
        const built = buildPackageFinishedEmail({
          clientName,
          lang,
          packageName,
        });
        await sendEmail({
          to: user.email,
          subject: built.subject,
          text: built.text,
          html: built.html,
          replyTo: trainerEmail(),
        });
        try { await storage.updatePackage(pkg.id, { finishedNotifiedAt: new Date() } as any); } catch {}
        try {
          const adminMsg = buildAdminPackageExpiringEmail({
            clientName,
            packageName,
            remainingSessions: remainingAfter,
            daysUntilExpiry: daysToExpiry,
          });
          await sendEmail({ to: trainerEmail(), subject: adminMsg.subject, text: adminMsg.text, html: adminMsg.html });
        } catch {}
      } else if (isLow && !pkgAny.expiringNotifiedAt) {
        const built = buildPackageExpiringEmail({
          clientName,
          lang,
          remainingSessions: remainingAfter,
          daysUntilExpiry: daysToExpiry,
          packageName,
        });
        await sendEmail({
          to: user.email,
          subject: built.subject,
          text: built.text,
          html: built.html,
          replyTo: trainerEmail(),
        });
        try { await storage.updatePackage(pkg.id, { expiringNotifiedAt: new Date() } as any); } catch {}
        try {
          const adminMsg = buildAdminPackageExpiringEmail({
            clientName,
            packageName,
            remainingSessions: remainingAfter,
            daysUntilExpiry: daysToExpiry,
          });
          await sendEmail({ to: trainerEmail(), subject: adminMsg.subject, text: adminMsg.text, html: adminMsg.html });
        } catch {}
      }
    } catch (e) {
      console.warn("[notif] package status email failed:", e);
    }
  }
}

/**
 * Notify the trainer when a booking is cancelled or rescheduled. Best-effort
 * — never throws and never blocks the response.
 */
async function dispatchBookingChangeNotification(opts: {
  kind: "cancellation" | "reschedule";
  booking: Booking;
  fromDate?: string | null;
  fromTime12?: string | null;
  reason?: string | null;
}): Promise<void> {
  try {
    const user = await storage.getUser(opts.booking.userId).catch(() => undefined);
    const clientName = (user?.fullName?.trim() || user?.username || `Client #${opts.booking.userId}`).trim();
    const built = buildAdminBookingChangeEmail({
      kind: opts.kind,
      clientName,
      date: opts.booking.date,
      time12: formatTime12Server(opts.booking.timeSlot),
      fromDate: opts.fromDate ?? null,
      fromTime12: opts.fromTime12 ?? null,
      reason: opts.reason ?? null,
    });
    await sendEmail({
      to: trainerEmail(),
      subject: built.subject,
      text: built.text,
      html: built.html,
      replyTo: user?.email ?? undefined,
    });
  } catch (e) {
    console.warn(`[notif] booking ${opts.kind} email failed:`, e);
  }
}

// P4d: centralized booking-response sanitizer. Strips admin-private
// coach fields (privateCoachNotes) from any booking payload returned
// to a non-admin user. Apply to every endpoint that returns booking
// objects (list, create, patch, cancel, same-day-adjust). Admin
// responses are returned unchanged.
// P4e: unified activity-feed event shape. The aggregator unions across
// bookings, packages, body metrics, weekly check-ins, inbody records,
// and progress photos. Keep this lean — no ORM-specific shapes leak.
type ActivityEvent = {
  id: string;
  kind:
    | "session_completed"
    | "session_booked"
    | "session_cancelled"
    | "package_activated"
    | "body_metric"
    | "weekly_checkin"
    | "inbody"
    | "progress_photo"
    | "coach_note";
  at: string;
  title: string;
  subtitle?: string | null;
};

async function buildActivityFeed(userId: number, limit = 60): Promise<ActivityEvent[]> {
  const events: ActivityEvent[] = [];
  const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
    try { return await fn(); } catch { return fallback; }
  };

  const [bookings, packagesList, bodyMetrics, checkins, inbody, photos] = await Promise.all([
    safe(() => storage.getBookings({ userId }), [] as any[]),
    safe(() => storage.getPackages({ userId }), [] as any[]),
    safe(() => storage.listBodyMetrics(userId, { limit: 50 }), [] as any[]),
    safe(() => storage.listWeeklyCheckins(userId, { limit: 25 }), [] as any[]),
    safe(() => storage.getInbodyRecords({ userId }), [] as any[]),
    safe(() => storage.getProgressPhotos({ userId }), [] as any[]),
  ]);

  // Map our canonical booking statuses (BOOKING_STATUSES in shared/schema.ts)
  // to the three timeline event kinds. Anything not in this map is skipped
  // intentionally so unrecognised statuses never fall back to "booked".
  const BOOKING_STATUS_TO_KIND: Record<
    string,
    { kind: ActivityEvent["kind"]; title: string; idPrefix: string }
  > = {
    upcoming: { kind: "session_booked", title: "Session booked", idPrefix: "booked" },
    confirmed: { kind: "session_booked", title: "Session booked", idPrefix: "booked" },
    completed: { kind: "session_completed", title: "Session completed", idPrefix: "completed" },
    cancelled: { kind: "session_cancelled", title: "Session cancelled", idPrefix: "cancelled" },
    free_cancelled: { kind: "session_cancelled", title: "Session cancelled", idPrefix: "cancelled" },
    late_cancelled: { kind: "session_cancelled", title: "Session cancelled (late)", idPrefix: "cancelled" },
    emergency_cancelled: { kind: "session_cancelled", title: "Session cancelled (protected)", idPrefix: "cancelled" },
    no_show: { kind: "session_cancelled", title: "Session no-show", idPrefix: "noshow" },
  };

  for (const b of bookings as any[]) {
    const when = b.date instanceof Date ? b.date.toISOString() : (b.date ?? null);
    if (!when) continue;
    const map = BOOKING_STATUS_TO_KIND[String(b.status)];
    if (map) {
      events.push({
        id: `booking-${map.idPrefix}-${b.id}`,
        kind: map.kind,
        at: when,
        title: map.title,
        subtitle: b.sessionType ? String(b.sessionType) : null,
      });
    }
    // Coach-note event: emit whenever the coach has touched this booking's
    // notes (regardless of which specific field changed). Subtitle is
    // sourced ONLY from the client-visible portion — privateCoachNotes
    // must never reach this payload.
    if (b.coachNotesUpdatedAt) {
      const nAt = b.coachNotesUpdatedAt instanceof Date
        ? b.coachNotesUpdatedAt.toISOString()
        : String(b.coachNotesUpdatedAt);
      events.push({
        id: `coach-note-${b.id}`,
        kind: "coach_note",
        at: nAt,
        title: "Coach logged a session note",
        subtitle: b.clientVisibleCoachNotes
          ? String(b.clientVisibleCoachNotes).slice(0, 140)
          : "Session reviewed by your coach",
      });
    }
  }

  for (const p of packagesList as any[]) {
    if (!p.adminApproved) continue;
    const when = p.adminApprovedAt ?? p.purchasedAt;
    const at = when instanceof Date ? when.toISOString() : (when ? String(when) : null);
    if (!at) continue;
    events.push({
      id: `package-${p.id}`,
      kind: "package_activated",
      at,
      title: `Package activated${p.name ? ": " + p.name : ""}`,
      subtitle: p.totalSessions ? `${p.totalSessions} sessions` : null,
    });
  }

  for (const m of bodyMetrics as any[]) {
    const at = m.createdAt instanceof Date ? m.createdAt.toISOString() : String(m.createdAt ?? m.recordedOn);
    const bits: string[] = [];
    if (m.weight != null) bits.push(`${m.weight} kg`);
    if (m.bodyFat != null) bits.push(`${m.bodyFat}% BF`);
    events.push({
      id: `body-metric-${m.id}`,
      kind: "body_metric",
      at,
      title: "Body metrics logged",
      subtitle: bits.join(" · ") || null,
    });
  }

  for (const c of checkins as any[]) {
    const at = c.createdAt instanceof Date ? c.createdAt.toISOString() : String(c.createdAt ?? c.weekStart);
    const bits: string[] = [];
    if (c.energy != null) bits.push(`Energy ${c.energy}/10`);
    if (c.trainingAdherence != null) bits.push(`Training ${c.trainingAdherence}%`);
    events.push({
      id: `checkin-${c.id}`,
      kind: "weekly_checkin",
      at,
      title: "Weekly check-in submitted",
      subtitle: bits.join(" · ") || null,
    });
  }

  for (const r of inbody as any[]) {
    const at = r.recordedAt instanceof Date ? r.recordedAt.toISOString() : (r.recordedAt ? String(r.recordedAt) : null);
    if (!at) continue;
    const bits: string[] = [];
    if (r.weight != null) bits.push(`${r.weight} kg`);
    if (r.bodyFat != null) bits.push(`${r.bodyFat}% BF`);
    if (r.muscleMass != null) bits.push(`${r.muscleMass} kg muscle`);
    events.push({
      id: `inbody-${r.id}`,
      kind: "inbody",
      at,
      title: "InBody scan recorded",
      subtitle: bits.join(" · ") || null,
    });
  }

  for (const ph of photos as any[]) {
    const at = ph.recordedAt instanceof Date ? ph.recordedAt.toISOString() : (ph.recordedAt ? String(ph.recordedAt) : null);
    if (!at) continue;
    events.push({
      id: `photo-${ph.id}`,
      kind: "progress_photo",
      at,
      title: ph.type === "before" ? "Before photo uploaded" : "Progress photo uploaded",
      subtitle: ph.viewAngle ? `${ph.viewAngle} view` : null,
    });
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return events.slice(0, limit);
}

function sanitizeBookingForUser<T extends { privateCoachNotes?: unknown }>(
  me: { role?: string } | undefined,
  booking: T,
): Omit<T, "privateCoachNotes"> {
  if (!booking) return booking as Omit<T, "privateCoachNotes">;
  if (me?.role === "admin") {
    // Admin sees the full payload, including privateCoachNotes — the
    // returned shape still satisfies Omit<T, "privateCoachNotes"> because
    // T may have the property and Omit allows the remaining keys.
    return booking as unknown as Omit<T, "privateCoachNotes">;
  }
  const { privateCoachNotes: _omit, ...rest } = booking;
  return rest;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

  // Serve uploaded files
  app.use("/uploads", express.static(UPLOAD_ROOT));

  // ============== HEALTH ==============
  // Public, auth-free liveness probe — used by Vercel's health checks and
  // by the Replit deployment platform. Kept extremely cheap (no DB call).
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, env: process.env.VERCEL ? "vercel" : "replit" });
  });

  // ============== USERS ==============
  app.get("/api/users", requireAdmin, async (_req, res) => {
    const clients = await storage.getAllClients();
    // Batched enrichment — grouped queries instead of N per-user
    // fetches. `withHealth` adds the operational client-health badge
    // (admin-only surface) computed from booking / check-in / body
    // metric / package signals via storage.getHealthSignalsForUsers.
    const enriched = await sanitizeAndEnrichMany(clients, { withHealth: true });
    res.json(enriched);
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const me = req.user as User;
    if (me.role !== "admin" && me.id !== id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const user = await storage.getUser(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    // Health badge is admin-only — never surfaced to the user themself.
    const enriched = await sanitizeAndEnrich(user, { withHealth: me.role === "admin" });
    res.json(enriched);
  });

  // ============== PROFILE PICTURE ==============
  // Accepts a base64 data-URL produced by the client-side cropper, re-encodes
  // it through sharp into a 256×256 WebP, and persists the result inline on
  // the user row. Storing the picture in the DB (not on disk) keeps the
  // feature working on read-only filesystems like Vercel without needing
  // object storage.
  app.post("/api/users/:id/profile-picture", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const me = req.user as User;
    if (me.role !== "admin" && me.id !== id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const schema = z.object({
      imageDataUrl: z
        .string()
        .min(40, "Image data is required")
        .max(8 * 1024 * 1024, "Image is too large"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid image" });
    }
    const match = parsed.data.imageDataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return res.status(400).json({ message: "Image must be a base64 data URL" });
    }
    // Raster allowlist — explicitly reject SVG (XML parser surface, scriptable)
    // and other non-bitmap image MIME types. The cropper only ever produces
    // png/jpeg/webp anyway, so a strict allowlist is safe.
    const ALLOWED_MIME = new Set([
      "image/png",
      "image/jpeg",
      "image/jpg",
      "image/webp",
      "image/heic",
      "image/heif",
    ]);
    if (!ALLOWED_MIME.has(match[1].toLowerCase())) {
      return res
        .status(400)
        .json({ message: "Unsupported image type. Use PNG, JPEG, WebP, or HEIC." });
    }
    // Confirm the target user exists before doing any heavy image work — both
    // saves CPU and lets us return a clean 404 instead of a 500 from
    // sanitizeAndEnrich(undefined). Owner-or-admin guard above already passed.
    const targetUser = await storage.getUser(id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }
    try {
      const buffer = Buffer.from(match[2], "base64");
      // Hard cap on raw bytes — protects sharp from oversized inputs even when
      // the encoded data-URL slips past the schema-level guard.
      if (buffer.byteLength > 6 * 1024 * 1024) {
        return res.status(400).json({ message: "Image is too large after decoding" });
      }
      // `limitInputPixels` is a hard ceiling on decoded pixel count — protects
      // sharp/libvips from "pixel bomb" inputs (small compressed payloads that
      // expand to massive bitmaps). 24MP is plenty for an avatar source.
      const webp = await sharp(buffer, { failOn: "none", limitInputPixels: 24_000_000 })
        .rotate()
        .resize(256, 256, { fit: "cover", position: "center" })
        .webp({ quality: 75, effort: 4 })
        .toBuffer();
      const dataUrl = `data:image/webp;base64,${webp.toString("base64")}`;
      const updated = await storage.updateUser(id, { profilePictureUrl: dataUrl } as any);
      const enriched = await sanitizeAndEnrich(updated);
      res.json(enriched);
    } catch (e) {
      console.error("[profile-picture] processing failed:", e);
      res.status(400).json({ message: "Could not process image. Try a different photo." });
    }
  });

  // Allow removing the profile picture. Works for the user themselves or admin.
  app.delete("/api/users/:id/profile-picture", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const me = req.user as User;
    if (me.role !== "admin" && me.id !== id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    // Existence check first so a missing id returns 404 instead of crashing
    // through updateUser → sanitizeAndEnrich(undefined).
    const targetUser = await storage.getUser(id);
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }
    const updated = await storage.updateUser(id, { profilePictureUrl: null } as any);
    const enriched = await sanitizeAndEnrich(updated);
    res.json(enriched);
  });

  app.patch("/api/users/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const me = req.user as User;
    if (me.role !== "admin" && me.id !== id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const parsed = updateProfileSchema
      .extend({ password: z.string().min(6).optional() })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid data" });
    }
    const updates: Record<string, unknown> = { ...parsed.data };
    if (parsed.data.password) {
      updates.password = await hashPassword(parsed.data.password);
    }

    // SECURITY: admin role/permission/active fields are managed exclusively
    // through the dedicated /api/admin/admins endpoints (super-admin only).
    // Stripping here prevents privilege escalation via this generic route.
    delete updates.adminRole;
    delete updates.permissions;
    delete updates.isActive;

    // Non-admins cannot toggle their own verified badge
    if (me.role !== "admin") {
      delete updates.verifiedOverride;
    }
    // Non-admins cannot change membership or role fields
    if (me.role !== "admin") {
      delete updates.vipTier;
      delete updates.vipTierManualOverride;
      delete updates.weeklyFrequency;
      delete updates.role;
      // SECURITY: trainer/admin-managed lifecycle, consent, and notes fields
      // must never be self-mutated by clients. Without stripping these, a
      // client could PATCH their own clientStatus to "active" and bypass the
      // booking eligibility gate, or tick PAR-Q / waiver / approval flags.
      delete (updates as any).clientStatus;
      delete (updates as any).parqCompleted;
      delete (updates as any).waiverAccepted;
      delete (updates as any).medicalClearanceNote;
      delete (updates as any).coachNotes;
      delete (updates as any).goalNotes;
      delete (updates as any).communicationNotes;
      delete (updates as any).adminNotes;
      delete (updates as any).injuries;
      delete (updates as any).medicalNotes;
      delete (updates as any).hasUsedFreeTrial;
    } else {
      // Admin override semantics:
      // - if admin sends `vipTier` directly, mark it as a manual override
      // - if admin only changes weeklyFrequency (no vipTier in body), drop
      //   the override so auto-recompute resumes, and refresh the tier now.
      const vipTierInBody = Object.prototype.hasOwnProperty.call(req.body, "vipTier");
      const freqInBody = Object.prototype.hasOwnProperty.call(req.body, "weeklyFrequency");
      if (vipTierInBody) {
        updates.vipTierManualOverride = true;
        updates.vipUpdatedAt = new Date();
      } else if (freqInBody) {
        updates.vipTierManualOverride = false;
        updates.vipTier = tierFromFrequency(parsed.data.weeklyFrequency as number | null | undefined);
        updates.vipUpdatedAt = new Date();
      }
    }

    const updated = await storage.updateUser(id, updates as any);
    res.json(sanitizeUser(updated));
  });

  // ============== BOOKINGS ==============
  // ---- Self-healing auto-complete on read (May 2026 production fix) ----
  // The auto-complete cron lives at /api/cron/reminders + /api/cron/auto-complete
  // and works correctly, but Vercel Hobby plans cap crons at once-per-day so
  // the user has historically had to wire an external scheduler (GitHub
  // Actions, cron-job.org). When that scheduler isn't set up — or quietly
  // fails — expired sessions sit in "Upcoming" indefinitely.
  //
  // This is a backstop: every time anyone loads the bookings list (admin
  // dashboard, client dashboard, both pull from `GET /api/bookings`), we
  // run the auto-complete pass IF the in-memory throttle has elapsed
  // (default 60s). The pass itself is atomic + idempotent, so calling it
  // 1000x/min is safe — but throttling avoids the obvious cost.
  let lastAutoCompleteRunAt = 0;
  const AUTO_COMPLETE_THROTTLE_MS = 60_000;
  const triggerAutoCompleteBackstop = () => {
    const now = Date.now();
    if (now - lastAutoCompleteRunAt < AUTO_COMPLETE_THROTTLE_MS) return;
    lastAutoCompleteRunAt = now;
    // Fire and forget. The route doesn't await — clients see fresh data
    // because the very next /api/bookings request (after this one returns)
    // will reflect the completed state. For the *current* request we'll
    // still see the row as "upcoming" if this is the first hit, but the
    // race is at most ~1s and the user will see it cleared on next refresh.
    runAutoCompleteBookings("backstop")
      .then((summary) => {
        if (summary.completed > 0 || summary.errors.length > 0) {
          console.log("[auto-complete:backstop]", JSON.stringify(summary));
        }
      })
      .catch((e) => console.warn("[auto-complete:backstop] failed:", e?.message || e));
  };

  app.get("/api/bookings", requireAuth, async (req, res) => {
    const me = req.user as User;
    const userIdQuery = req.query.userId ? Number(req.query.userId) : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const includeUser = req.query.includeUser === "true";

    // Backstop: kick the auto-complete pass before reading. Throttled +
    // fire-and-forget so the response time is unaffected.
    triggerAutoCompleteBackstop();

    const filters: {
      userId?: number;
      from?: string;
      orLinkedPartnerUserId?: number;
    } = {};
    if (me.role !== "admin") {
      // Non-admin: see bookings where I'm the primary client OR a
      // linked duo partner. Storage returns the OR-union; sanitization
      // below still strips coach-private fields.
      filters.userId = me.id;
      filters.orLinkedPartnerUserId = me.id;
    } else if (userIdQuery) {
      filters.userId = userIdQuery;
    }
    if (from) filters.from = from;

    const list = await storage.getBookings(filters);
    if (!includeUser) return res.json(list.map((b) => sanitizeBookingForUser(me, b)));

    // Collect both primary owner ids AND linked partner ids so the
    // admin booking row can render "<primary> + <partner>".
    const userIds = Array.from(
      new Set(
        list.flatMap((b) =>
          [b.userId, (b as any).linkedPartnerUserId].filter((x): x is number => typeof x === "number"),
        ),
      ),
    );
    // Privacy: admins get the full sanitized user. Non-admins (including
    // linked partners) get a MINIMAL identity shape — just id + fullName —
    // so a linked partner cannot harvest the primary client's email,
    // phone, status, or other profile PII through the bookings list.
    const usersById: Record<number, { id: number; fullName: string | null } | ReturnType<typeof sanitizeUser>> = {};
    for (const uid of userIds) {
      const u = await storage.getUser(uid);
      if (!u) continue;
      usersById[uid] =
        me.role === "admin"
          ? sanitizeUser(u)
          : { id: u.id, fullName: u.fullName ?? null };
    }
    // For admin rows, also attach a lightweight package digest for
    // duo bookings so the UI can render "Session N of M / X remaining"
    // without an extra round-trip.
    const packageIds = Array.from(
      new Set(
        list
          .map((b) => (b as any).packageId)
          .filter((x): x is number => typeof x === "number"),
      ),
    );
    const packagesById: Record<number, { id: number; usedSessions: number; totalSessions: number; remaining: number } | null> = {};
    if (me.role === "admin" && packageIds.length > 0) {
      for (const pid of packageIds) {
        const pkg = await storage.getPackage(pid);
        if (pkg) {
          const used = pkg.usedSessions ?? 0;
          const total = pkg.totalSessions ?? 0;
          packagesById[pid] = { id: pkg.id, usedSessions: used, totalSessions: total, remaining: Math.max(0, total - used) };
        }
      }
    }
    // Privacy: usersById is already populated above with admin-vs-client
    // shape per uid (admin → full sanitized user, non-admin → {id, fullName}
    // minimal identity). The map is consumed directly below.
    res.json(
      list.map((b) =>
        sanitizeBookingForUser(me, {
          ...b,
          user: usersById[b.userId] || null,
          linkedPartnerUser:
            typeof (b as any).linkedPartnerUserId === "number"
              ? usersById[(b as any).linkedPartnerUserId] || null
              : null,
          package:
            me.role === "admin" && typeof (b as any).packageId === "number"
              ? packagesById[(b as any).packageId] || null
              : null,
        }),
      ),
    );
  });

  app.post("/api/bookings", requireAuth, async (req, res) => {
    const me = req.user as User;
    const schema = insertBookingSchema.extend({
      acceptedPolicy: z.literal(true, {
        errorMap: () => ({ message: "You must accept the cancellation policy" }),
      }),
      userId: z.number().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid booking" });
    }
    const targetUserId = me.role === "admin" && parsed.data.userId ? parsed.data.userId : me.id;

    // Duo bookings must include a partner full name (snapshot, not an account).
    // Admins booking on behalf of clients may omit it. Phone/email stay optional.
    if (
      parsed.data.sessionType === "duo" &&
      me.role !== "admin" &&
      (!parsed.data.partnerFullName || parsed.data.partnerFullName.trim().length < 2)
    ) {
      return res.status(400).json({
        message: "Training partner full name is required for a Duo session.",
      });
    }

    const sessionAt = buildSessionDate(parsed.data.date, parsed.data.timeSlot);
    if (isNaN(sessionAt.getTime())) {
      return res.status(400).json({ message: "Invalid date or time" });
    }
    if (me.role !== "admin" && !ALLOWED_BOOKING_HOURS.has(parsed.data.timeSlot)) {
      return res.status(400).json({
        message: "Sessions can only be booked between 06:00 AM and 10:00 PM.",
      });
    }
    // Past-slot guard. Server-authoritative — protects against stale
    // browser tabs where the slot was selectable on page load but has
    // since slipped into the past, and any client bypassing the UI
    // (curl/Postman). Friendly message matches the user-spec wording.
    if (me.role !== "admin" && sessionAt.getTime() <= Date.now()) {
      // Anomaly log: stale browser tab or curl bypass attempt. Single
      // structured line per event so we can grep frequency without log
      // volume blowing up.
      console.warn("[booking:anomaly]", JSON.stringify({
        kind: "past_slot", userId: me.id, date: parsed.data.date, timeSlot: parsed.data.timeSlot,
      }));
      return res.status(400).json({
        message: "This time is no longer available. Please choose a future slot.",
        code: "slot_in_past",
      });
    }
    if (
      sessionAt.getTime() < bookingCutoffMs()
    ) {
      console.warn("[booking:anomaly]", JSON.stringify({
        kind: "lead_time_too_short", userId: me.id, date: parsed.data.date, timeSlot: parsed.data.timeSlot,
      }));
      return res.status(400).json({
        message: `Bookings must be made at least ${MIN_ADVANCE_BOOKING_HOURS} full hours before the next hour boundary.`,
        code: "lead_time_too_short",
      });
    }

    const blocked = await storage.getBlockedSlots();
    const fullDayBlock = blocked.find(
      (b) => b.date === parsed.data.date && b.timeSlot === null,
    );
    const slotBlock = blocked.find(
      (b) => b.date === parsed.data.date && b.timeSlot === parsed.data.timeSlot,
    );
    if ((fullDayBlock || slotBlock) && me.role !== "admin") {
      const reason = fullDayBlock
        ? "Youssef Fitness is unavailable on this day."
        : "This time slot is unavailable.";
      return res.status(400).json({ message: reason, blockType: fullDayBlock?.blockType ?? null });
    }

    const existing = await storage.getBookingByDateAndSlot(parsed.data.date, parsed.data.timeSlot);
    if (
      existing &&
      !["cancelled", "free_cancelled", "late_cancelled"].includes(existing.status)
    ) {
      return res.status(400).json({ message: "Slot already booked" });
    }

    // Determine session type — defaults to package
    const sessionType = parsed.data.sessionType ?? "package";

    // Free trial check: once per lifetime per user
    if (sessionType === "trial") {
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) return res.status(404).json({ message: "Client not found" });
      if (targetUser.hasUsedFreeTrial && me.role !== "admin") {
        return res.status(400).json({
          message:
            "Your free trial has already been used. Please choose a Single Session or a Package to continue training.",
        });
      }
    }

    // Auto-link active package for package/duo bookings
    let packageId: number | null = parsed.data.packageId ?? null;
    if (!packageId && (sessionType === "package" || sessionType === "duo")) {
      const active = await storage.getActivePackageForUser(targetUserId);
      if (active && active.usedSessions < active.totalSessions) {
        packageId = active.id;
      }
    }

    // Hard-require a resolved package for non-admin package/duo bookings.
    // Without this, evaluateBookingEligibility(user, null) would only check
    // lifecycle and let the client through with paymentStatus auto-set to
    // "paid" further down — bypassing the paid/approved/active package gate.
    if (
      me.role !== "admin" &&
      (sessionType === "package" || sessionType === "duo") &&
      !packageId
    ) {
      return res.status(400).json({
        message:
          "You don't have an active package linked to this booking. Please request a new package or contact Youssef.",
        code: "no_active_package",
      });
    }

    // Block bookings on expired or completed packages (clients only).
    // Admin-overridden bookings can still go through for manual catch-up.
    if (me.role !== "admin" && packageId) {
      const linkedPkg = await storage.getPackage(packageId).catch(() => undefined);
      // SECURITY (IDOR): a client must only be able to book against their own
      // package. Without this, supplying another client's packageId would
      // consume their session credits at attendance reconciliation.
      if (linkedPkg && linkedPkg.userId !== targetUserId) {
        return res.status(403).json({ message: "You cannot book against this package." });
      }
      if (linkedPkg) {
        const status = computePackageStatus(linkedPkg);
        if (status === "expired") {
          return res.status(400).json({
            message:
              "Your package has expired. Please request a renewal or an extension to continue booking.",
            packageStatus: "expired",
          });
        }
        if (status === "completed") {
          return res.status(400).json({
            message:
              "Your package is fully used. Please request a renewal to continue booking.",
            packageStatus: "completed",
          });
        }
      }
    }

    // Client-lifecycle + package-eligibility gate (clients only).
    // Trial sessions skip the package half (no package needed); the client
    // half (clientStatus / profile completion) still applies.
    if (me.role !== "admin") {
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) return res.status(404).json({ message: "Client not found" });
      const linkedPkg =
        sessionType === "trial" || sessionType === "single"
          ? null
          : packageId
          ? await storage.getPackage(packageId).catch(() => undefined)
          : null;
      const verdict = evaluateBookingEligibility(targetUser, linkedPkg ?? null);
      if (!verdict.ok) {
        return res.status(400).json({ message: verdict.message, code: verdict.code });
      }
    }

    // For single & trial sessions, never link to a package.
    if (sessionType === "single" || sessionType === "trial") {
      packageId = null;
    }

    // Default payment status by session type
    let paymentStatus: string =
      parsed.data.paymentStatus ?? (sessionType === "trial" ? "free" : "unpaid");
    if (sessionType === "package" || sessionType === "duo") {
      // Package sessions are pre-paid by virtue of the package.
      paymentStatus = "paid";
    }

    // Premium booking flow: clients must pick a session focus and a training
    // goal. Admin bookings (manual / overrides) may omit them.
    if (me.role !== "admin") {
      if (!parsed.data.sessionFocus) {
        return res.status(400).json({
          message: "Please choose a session focus before continuing.",
          field: "sessionFocus",
        });
      }
      if (!parsed.data.trainingGoal) {
        return res.status(400).json({
          message: "Please choose a training goal before continuing.",
          field: "trainingGoal",
        });
      }
    }

    // Race-safe insert. The pre-check above (`getBookingByDateAndSlot`)
    // closes the common case, but two simultaneous POSTs can both pass
    // it and only the partial UNIQUE INDEX on bookings(date,time_slot)
    // catches the race. `storage.createBooking` re-throws Postgres 23505
    // as a tagged `SLOT_TAKEN` error with `status: 409` — surface it as
    // a clean 409 with the friendly message instead of leaking a 500.
    let booking;
    try {
      // Normalize partner snapshot. ONLY persisted for duo sessions —
      // any partner data sent on a non-duo booking is dropped to prevent
      // cross-type leakage. Trim every field; treat empty strings as null.
      const isDuoBooking = sessionType === "duo";
      const partnerFullName = isDuoBooking
        ? (parsed.data.partnerFullName?.trim() || null)
        : null;
      const partnerPhone = isDuoBooking
        ? (parsed.data.partnerPhone?.trim() || null)
        : null;
      const partnerEmail = isDuoBooking
        ? (parsed.data.partnerEmail?.trim() || null)
        : null;
      booking = await storage.createBooking({
        userId: targetUserId,
        packageId: packageId ?? null,
        date: parsed.data.date,
        timeSlot: parsed.data.timeSlot,
        sessionType,
        paymentStatus: paymentStatus as any,
        workoutCategory: (parsed.data.workoutCategory ?? null) as any,
        notes: parsed.data.notes ?? null,
        adminNotes: null,
        clientNotes: parsed.data.clientNotes ?? null,
        sessionFocus: parsed.data.sessionFocus ?? null,
        trainingGoal: parsed.data.trainingGoal ?? null,
        partnerFullName,
        partnerPhone,
        partnerEmail,
      });
    } catch (err: any) {
      if (err?.code === "SLOT_TAKEN") {
        // Race-collision telemetry. If this fires often we know to add
        // pessimistic locking or move the precheck closer to the insert.
        console.warn("[booking:anomaly]", JSON.stringify({
          kind: "slot_race", userId: targetUserId, date: parsed.data.date, timeSlot: parsed.data.timeSlot,
        }));
        return res.status(409).json({ message: err.message, code: "slot_taken" });
      }
      throw err;
    }

    // ---- Admin notification + emails (best-effort, never blocks booking) ----
    // Reads `lang` from request body for client-facing email localization.
    const requestedLang =
      typeof (req.body as any)?.lang === "string" ? String((req.body as any).lang) : "en";
    try {
      await dispatchBookingNotifications({
        booking,
        targetUserId,
        sessionType,
        lang: requestedLang,
      });
    } catch (e) {
      console.warn("[booking] notification dispatch failed:", e);
    }

    // Mark trial as used if successful (clients only — admin overrides remain)
    if (sessionType === "trial" && me.role !== "admin") {
      try {
        await storage.updateUser(targetUserId, { hasUsedFreeTrial: true });
      } catch {
        /* ignore */
      }
    }

    try {
      await storage.createConsentRecord({
        userId: targetUserId,
        consentType: "booking",
        policyVersion: "v1",
        acceptedItems: ["cancellation_policy"],
        ipAddress: (req.ip || req.socket.remoteAddress || null) as string | null,
        userAgent: (req.get("user-agent") || null) as string | null,
      });
    } catch (e) {
      console.warn("[booking] consent log failed:", e);
    }

    res.status(201).json(sanitizeBookingForUser(me, booking));
  });

  // ============== ADMIN NOTIFICATIONS (in-app trainer inbox) ==============
  app.get("/api/admin/notifications", requireAdmin, async (req, res) => {
    const unreadOnly = req.query.unreadOnly === "true";
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
    const list = await storage.getAdminNotifications({ unreadOnly, limit });
    res.json(list);
  });

  app.get("/api/admin/notifications/unread-count", requireAdmin, async (_req, res) => {
    const count = await storage.getAdminUnreadCount();
    res.json({ count });
  });

  app.post("/api/admin/notifications/:id/read", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const updated = await storage.markAdminNotificationRead(id);
    if (!updated) return res.status(404).json({ message: "Notification not found" });
    res.json(updated);
  });

  app.post("/api/admin/notifications/read-all", requireAdmin, async (_req, res) => {
    await storage.markAllAdminNotificationsRead();
    res.json({ ok: true });
  });

  // ============== ADMIN GLOBAL SEARCH (Cmd+K palette) ==============
  // Federated search across clients, bookings, packages, nutrition plans,
  // and supplement stacks. Read-only, admin-only. Returns at most
  // `perCategory` rows per group (cap 20). Empty query returns empty groups
  // (the palette uses recent/featured fallbacks instead).
  app.get("/api/admin/search", requireAdmin, async (req, res) => {
    const q = String(req.query.q ?? "").slice(0, 200);
    const perCatRaw = Number(req.query.limit ?? 5);
    const perCategory = Number.isFinite(perCatRaw)
      ? Math.min(Math.max(perCatRaw, 1), 20)
      : 5;
    const groups = await storage.searchAdmin(q, perCategory);
    // Enrich bookings + packages + nutrition plans with the client's name
    // so the palette can render "Booking · Apr 12 09:00 · Ahmed Hassan"
    // in a single render pass without per-row roundtrips.
    const userIds = new Set<number>();
    for (const b of groups.bookings) userIds.add(b.userId);
    for (const p of groups.packages) userIds.add(p.userId);
    for (const n of groups.nutritionPlans) userIds.add(n.userId);
    for (const u of groups.clients) userIds.add(u.id);
    const nameMap = new Map<number, string>();
    if (userIds.size > 0) {
      const rows = await Promise.all(
        Array.from(userIds).map(async (id) => {
          const u = await storage.getUser(id);
          return u ? ([id, u.fullName] as const) : null;
        }),
      );
      for (const r of rows) if (r) nameMap.set(r[0], r[1]);
    }
    const decorate = <T extends { userId: number }>(rows: T[]) =>
      rows.map((r) => ({ ...r, _userName: nameMap.get(r.userId) ?? null }));
    res.json({
      query: q,
      clients: groups.clients.map((u) => ({
        id: u.id,
        fullName: u.fullName,
        email: u.email,
        phone: u.phone,
        clientStatus: (u as any).clientStatus ?? null,
        vipTier: u.vipTier ?? null,
      })),
      bookings: decorate(groups.bookings).map((b) => ({
        id: b.id,
        userId: b.userId,
        userName: b._userName,
        date: b.date,
        timeSlot: b.timeSlot,
        status: b.status,
        sessionType: b.sessionType,
      })),
      packages: decorate(groups.packages).map((p) => ({
        id: p.id,
        userId: p.userId,
        userName: p._userName,
        name: p.name,
        type: p.type,
        totalSessions: p.totalSessions,
        usedSessions: p.usedSessions,
        status: (p as any).status ?? null,
      })),
      nutritionPlans: decorate(groups.nutritionPlans).map((n) => ({
        id: n.id,
        userId: n.userId,
        userName: n._userName,
        name: n.name,
        status: n.status,
        goal: n.goal,
      })),
      supplementStacks: groups.supplementStacks.map((s) => ({
        id: s.id,
        name: s.name,
        goal: s.goal,
        active: s.active,
      })),
    });
  });

  // Admin-only email diagnostic. Sends a real test email via the configured
  // provider and returns a clean status — never exposes secret values.
  // Use to verify production email delivery without inspecting logs.
  app.post("/api/admin/test-email", requireAdmin, async (req, res) => {
    const cfg = emailConfigStatus();
    if (!cfg.ready) {
      return res.json({
        ok: false,
        reason: cfg.reason,
        config: {
          hasApiKey: cfg.hasApiKey,
          hasCustomFrom: cfg.hasCustomFrom,
          from: cfg.from,
        },
      });
    }
    const to =
      typeof req.body?.to === "string" && /^\S+@\S+\.\S+$/.test(req.body.to)
        ? (req.body.to as string)
        : trainerEmail();
    const result = await sendEmail({
      to,
      subject: "Youssef Fitness — email delivery test",
      text:
        `This is a test email from the Youssef Fitness admin diagnostic endpoint.\n\n` +
        `If you received this, Resend + EMAIL_FROM are wired correctly.\n\n` +
        `Sent at ${new Date().toISOString()}.`,
      html:
        `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;color:#111;max-width:520px">` +
        `<h2 style="margin:0 0 12px;color:#0a7d4f">Email delivery test</h2>` +
        `<p style="margin:0 0 12px">This is a test email from the Youssef Fitness admin diagnostic endpoint.</p>` +
        `<p style="margin:0;color:#666;font-size:13px">Sent at ${new Date().toISOString()}.</p>` +
        `</div>`,
    });
    if (result.sent) {
      return res.json({
        ok: true,
        provider: result.provider,
        id: result.id,
        to,
        from: cfg.from,
      });
    }
    return res.json({
      ok: false,
      reason: result.error || "send failed",
      provider: result.provider,
      to,
      from: cfg.from,
    });
  });

  // ============== ADMIN: Link / Unlink Duo Partner Account ==============
  // Admin-only. Binds an existing user account to a duo booking's
  // linked_partner_user_id so the partner can SEE the booking on their
  // own dashboard. Does NOT change package ownership or grant any
  // mutation rights — primary userId remains the owner, and the
  // existing booking-mutation guards (`booking.userId === me.id`) keep
  // linked partners read-only.
  //
  // Validation rules enforced server-side only:
  //   • Booking must exist + sessionType must be "duo".
  //   • Cannot self-link (partner !== primary).
  //   • Target user must exist + role must be "client" (no admins as
  //     partners — prevents privilege confusion).
  //   • Partner cannot already be linked to another active duo booking
  //     unless the request body sets `override: true` (admin override).
  app.post("/api/admin/bookings/:id/link-partner", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const schema = z.object({
      partnerUserId: z.number().int().positive(),
      override: z.boolean().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid request" });
    }
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.sessionType !== "duo") {
      return res
        .status(400)
        .json({ message: "Only duo bookings can have a linked partner." });
    }
    if (parsed.data.partnerUserId === booking.userId) {
      return res
        .status(400)
        .json({ message: "Partner cannot be the same as the primary client." });
    }
    const partnerUser = await storage.getUser(parsed.data.partnerUserId);
    if (!partnerUser) {
      return res.status(404).json({ message: "Partner account not found." });
    }
    if (partnerUser.role !== "client") {
      return res
        .status(400)
        .json({ message: "Only client accounts can be linked as a duo partner." });
    }
    if (booking.linkedPartnerUserId === parsed.data.partnerUserId) {
      return res
        .status(409)
        .json({ message: "This partner is already linked to this booking." });
    }
    if (!parsed.data.override) {
      // Per architecture rule #5: prevent linking the same user to
      // multiple ACTIVE DUO PACKAGES simultaneously unless admin overrides.
      // Multiple linked bookings under the SAME package are allowed
      // (same duo couple booking several sessions on one package).
      const conflicts = await storage.countActiveLinkedDuoPackagesExcept(
        parsed.data.partnerUserId,
        booking.packageId ?? null,
      );
      if (conflicts > 0) {
        return res.status(409).json({
          message:
            "This client is already linked as a partner on another active duo package. Pass override:true to force link.",
          code: "active_duo_link_exists",
        });
      }
    }
    const wasAlreadyLinked = booking.linkedPartnerUserId === parsed.data.partnerUserId;
    const updated = await storage.updateBooking(id, {
      linkedPartnerUserId: parsed.data.partnerUserId,
    });

    // Task #3: best-effort partner-side confirmation email + in-app
    // notification on FIRST link only. Reuses
    // buildClientBookingConfirmationEmail so the partner's experience
    // mirrors the primary client. notifyUserOnce dedupes per booking
    // so re-linking the same partner is a no-op on the in-app channel.
    if (!wasAlreadyLinked) {
      void (async () => {
        try {
          const partnerLang = (partnerUser as any).preferredLanguage || "en";
          const partnerName =
            (partnerUser.fullName?.trim() || partnerUser.username || `Client #${partnerUser.id}`).trim();
          const focusKey = booking.sessionFocus || "";
          const goalKey = booking.trainingGoal || "";
          const sessionFocusLabel = SESSION_FOCUS_LABELS_EN[focusKey] || focusKey || "—";
          const trainingGoalLabel = BOOKING_TRAINING_GOAL_LABELS_EN[goalKey] || goalKey || "—";
          const sessionTypeLabel =
            SESSION_TYPE_LABELS_EN[booking.sessionType] || booking.sessionType;
          const time12 = formatTime12Server(booking.timeSlot);
          const owner = await storage.getUser(booking.userId).catch(() => undefined);
          const ownerName =
            owner?.fullName?.trim() || owner?.username || `Client #${booking.userId}`;

          const details: BookingDetails = {
            clientName: partnerName,
            date: booking.date,
            time12,
            sessionFocusLabel,
            trainingGoalLabel,
            sessionTypeLabel,
            packageName: null,
            remainingSessions: null,
            packageExpiryDate: null,
            currentSessionNumber: null,
            totalSessions: null,
            // Surface the *primary* client's name as the partner line
            // on the linked partner's email — mirrors what the primary sees.
            partnerFullName: ownerName,
            partnerPhone: null,
            partnerEmail: null,
          };

          if (partnerUser.email) {
            const built = buildClientBookingConfirmationEmail({ data: details, lang: partnerLang });
            await sendEmail({
              to: partnerUser.email,
              subject: built.subject,
              text: built.text,
              html: built.html,
              replyTo: trainerEmail(),
            });
          }

          void notifyUserOnce(
            partnerUser.id,
            "system",
            `partner-linked-${booking.id}`,
            "You're on a Duo session",
            `${booking.date} at ${time12} with ${ownerName} — ${sessionFocusLabel}`,
            { link: "/dashboard", meta: { bookingId: booking.id, partnerOf: booking.userId } },
          );
        } catch (e) {
          console.warn("[link-partner] partner notify failed:", e);
        }
      })();
    }

    res.json(sanitizeBookingForUser(req.user as User, updated));
  });

  app.post("/api/admin/bookings/:id/unlink-partner", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (booking.linkedPartnerUserId == null) {
      return res
        .status(400)
        .json({ message: "No linked partner on this booking." });
    }
    // Reset partner-scoped reminder dedupe so a future re-link can
    // re-send the partner's 24h / 1h emails.
    const updated = await storage.updateBooking(id, {
      linkedPartnerUserId: null,
      linkedPartnerReminder24hSentAt: null,
      linkedPartnerReminder1hSentAt: null,
    } as any);
    res.json(sanitizeBookingForUser(req.user as User, updated));
  });

  app.post("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    // Task #6: Either the booking owner OR the linked Duo partner can
    // cancel. Both are first-class participants in the session.
    const isOwner = booking.userId === me.id;
    const isPartner =
      typeof (booking as any).linkedPartnerUserId === "number" &&
      (booking as any).linkedPartnerUserId === me.id;
    if (me.role !== "admin" && !isOwner && !isPartner) {
      return res.status(403).json({ message: "Forbidden" });
    }

    // New: useProtectedCancel. Backwards-compatible: also accept the legacy
    // useEmergencyCancel flag from older clients.
    const useProtectedCancel = !!(
      req.body && (req.body.useProtectedCancel || req.body.useEmergencyCancel)
    );

    const settings = await storage.getSettings();
    const cutoffMs = (settings.cancellationCutoffHours ?? 6) * 60 * 60 * 1000;
    const sessionAt = buildSessionDate(booking.date, booking.timeSlot);
    const msUntil = sessionAt.getTime() - Date.now();
    const isWithinCutoff = msUntil < cutoffMs;

    let newStatus: string;
    let usedProtected = false;

    if (me.role === "admin") {
      newStatus = "cancelled";
    } else if (!isWithinCutoff) {
      // Plenty of notice — free cancel
      newStatus = "free_cancelled";
    } else if (useProtectedCancel) {
      // Task #6: attribute quota usage to the ACTING user (owner or
      // partner), not always the booking owner.
      const actor = await storage.getUser(me.id);
      const monthKey = currentMonthKey();
      const usedThisMonth =
        actor?.protectedCancelMonth === monthKey
          ? (actor.protectedCancelCount ?? 0)
          : 0;
      const quota = protectedCancellationQuota(actor?.vipTier);
      if (usedThisMonth >= quota) {
        return res.status(400).json({
          message: `You have used all ${quota} Protected Cancellation${
            quota === 1 ? "" : "s"
          } for this month. Please contact Youssef directly.`,
        });
      }
      newStatus = "free_cancelled";
      usedProtected = true;
    } else {
      return res.status(400).json({
        message: `Cancellation locked. Less than ${settings.cancellationCutoffHours} hours remain. You can use a Protected Cancellation if available, or contact Youssef directly.`,
      });
    }

    const updated = await storage.updateBooking(id, {
      status: newStatus,
      cancelledAt: new Date(),
      isEmergencyCancel: usedProtected, // legacy column, kept in sync
      protectedCancellation: usedProtected,
    } as any);

    if (usedProtected) {
      try {
        // Task #6: attribute the quota burn to the acting user (owner or
        // partner), so each member of the duo has their own monthly count.
        const actor = await storage.getUser(me.id);
        const monthKey = currentMonthKey();
        const sameMonth = actor?.protectedCancelMonth === monthKey;
        await storage.updateUser(me.id, {
          protectedCancelMonth: monthKey,
          protectedCancelCount: sameMonth
            ? (actor?.protectedCancelCount ?? 0) + 1
            : 1,
          // Keep legacy column populated so older admin tooling keeps working
          emergencyCancelLastMonth: monthKey,
          emergencyCancelLastUsedAt: new Date(),
        } as any);
      } catch {
        /* ignore */
      }
    }

    // Only late_cancelled deducts; protected/free/cancelled do not.
    // Idempotency: only increment if `package_session_deducted_at` is NULL,
    // then stamp it. Prevents double-deduction if a race or retry hits the
    // same row, and also defends against the auto-complete cron racing an
    // admin late-cancel on the same booking.
    if (newStatus === "late_cancelled" && booking.packageId && !(booking as any).packageSessionDeductedAt) {
      try {
        await storage.incrementPackageUsage(booking.packageId);
        await pool.query(`UPDATE bookings SET package_session_deducted_at = now() WHERE id = $1`, [booking.id]);
      } catch {
        /* ignore */
      }
    }

    // Best-effort admin email — never blocks the response.
    void dispatchBookingChangeNotification({
      kind: "cancellation",
      booking,
      reason: usedProtected ? "Protected cancellation" : isWithinCutoff ? "Late cancellation" : "Free cancellation (outside cutoff)",
    });

    // P5b / Task #6: Anyone who didn't initiate this cancellation needs
    // to know. That includes the booking owner (when an admin or the
    // partner cancels) AND the linked Duo partner (when an admin or the
    // owner cancels). Self-cancellations are skipped — the actor sees
    // the result in the UI. dedupeKey is recipient-scoped so re-cancels
    // are idempotent for each recipient independently.
    {
      const time12 = formatTime12Server(booking.timeSlot);
      const linkedPartnerId =
        typeof (booking as any).linkedPartnerUserId === "number"
          ? ((booking as any).linkedPartnerUserId as number)
          : null;
      const recipients = new Set<number>();
      if (booking.userId !== me.id) recipients.add(booking.userId);
      if (linkedPartnerId && linkedPartnerId !== me.id) recipients.add(linkedPartnerId);
      for (const uid of Array.from(recipients)) {
        void notifyUserOnce(
          uid,
          "system",
          `booking-cancelled-${booking.id}-${uid}`,
          "Session cancelled",
          `Your session on ${booking.date} at ${time12} was cancelled. Tap to rebook.`,
          { link: "/book", meta: { bookingId: booking.id } },
        );
      }
    }

    res.json(sanitizeBookingForUser(me, updated));
  });

  // Same-Day Adjustment: shift a session to a different time the SAME day.
  // Rules: same calendar day, ≥60 minutes before original slot, target slot
  // must be free, and the user's monthly quota must not be exhausted.
  app.post("/api/bookings/:id/same-day-adjust", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    const newTimeSlot: string | undefined = req.body?.newTimeSlot;
    if (!newTimeSlot || !/^\d{2}:\d{2}$/.test(newTimeSlot)) {
      return res.status(400).json({ message: "Provide a valid new time slot (HH:MM)." });
    }
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    // Task #6: owner OR linked Duo partner may same-day-adjust.
    const isOwner = booking.userId === me.id;
    const isPartner =
      typeof (booking as any).linkedPartnerUserId === "number" &&
      (booking as any).linkedPartnerUserId === me.id;
    if (me.role !== "admin" && !isOwner && !isPartner) {
      return res.status(403).json({ message: "Forbidden" });
    }
    if (
      ["cancelled", "free_cancelled", "late_cancelled", "emergency_cancelled", "completed", "no_show"].includes(
        booking.status,
      )
    ) {
      return res.status(400).json({ message: "This booking can no longer be adjusted." });
    }

    // Must be the same calendar day as today
    if (booking.date !== todayDateString()) {
      return res.status(400).json({
        message: "Same-Day Adjustment is only available for today's bookings.",
      });
    }
    // ≥60 min before the original slot
    const originalAt = buildSessionDate(booking.date, booking.timeSlot);
    if (originalAt.getTime() - Date.now() < 60 * 60 * 1000) {
      return res.status(400).json({
        message: "Same-Day Adjustments must be requested at least 1 hour before your session.",
      });
    }
    // No-op guard: don't burn a quota for an unchanged slot
    if (newTimeSlot === booking.timeSlot) {
      return res.status(400).json({
        message: "Pick a different time slot to adjust your session.",
      });
    }
    // The new slot must also be later today (no day change)
    const newAt = buildSessionDate(booking.date, newTimeSlot);
    if (newAt.getTime() - Date.now() < 30 * 60 * 1000) {
      return res.status(400).json({
        message: "Pick a slot at least 30 minutes from now.",
      });
    }

    // Quota check (skip for admin). Task #6: attribute the quota to the
    // ACTING user (owner or partner), not always the booking owner.
    if (me.role !== "admin") {
      const actor = await storage.getUser(me.id);
      const monthKey = currentMonthKey();
      const usedThisMonth =
        actor?.sameDayAdjustMonth === monthKey ? (actor.sameDayAdjustCount ?? 0) : 0;
      const quota = sameDayAdjustQuota(actor?.vipTier);
      if (quota === 0) {
        return res.status(400).json({
          message:
            "Same-Day Adjustments are not available on your current membership level. Contact Youssef on WhatsApp if you need help.",
        });
      }
      if (usedThisMonth >= quota) {
        return res.status(400).json({
          message: `You have used all ${quota} Same-Day Adjustment${quota === 1 ? "" : "s"} for this month.`,
        });
      }
    }

    // Slot must be free (and not blocked)
    const taken = await storage.getBookingByDateAndSlot(booking.date, newTimeSlot);
    if (
      taken &&
      taken.id !== id &&
      !["cancelled", "free_cancelled", "late_cancelled", "emergency_cancelled"].includes(
        taken.status,
      )
    ) {
      return res.status(400).json({ message: "That slot is already booked." });
    }
    const blocks = await storage.getBlockedSlots();
    const conflict = blocks.find(
      (b) => b.date === booking.date && (b.timeSlot === null || b.timeSlot === newTimeSlot),
    );
    if (conflict && me.role !== "admin") {
      return res.status(400).json({ message: "That time is blocked." });
    }

    const rescheduledFrom = `${booking.date} ${booking.timeSlot}`;
    const updated = await storage.updateBooking(id, {
      timeSlot: newTimeSlot,
      rescheduledFrom,
    } as any);

    if (me.role !== "admin") {
      try {
        // Task #6: attribute quota burn to the acting user.
        const actor = await storage.getUser(me.id);
        const monthKey = currentMonthKey();
        const sameMonth = actor?.sameDayAdjustMonth === monthKey;
        await storage.updateUser(me.id, {
          sameDayAdjustMonth: monthKey,
          sameDayAdjustCount: sameMonth
            ? (actor?.sameDayAdjustCount ?? 0) + 1
            : 1,
        } as any);
      } catch {
        /* ignore */
      }
    }

    // Task #6: notify everyone in the duo who didn't initiate the
    // adjustment. Recipient-scoped dedupe key keyed on the new slot so
    // re-adjusting to a different time also notifies.
    {
      const newTime12 = formatTime12Server(newTimeSlot);
      const linkedPartnerId =
        typeof (booking as any).linkedPartnerUserId === "number"
          ? ((booking as any).linkedPartnerUserId as number)
          : null;
      const recipients = new Set<number>();
      if (booking.userId !== me.id) recipients.add(booking.userId);
      if (linkedPartnerId && linkedPartnerId !== me.id) recipients.add(linkedPartnerId);
      for (const uid of Array.from(recipients)) {
        void notifyUserOnce(
          uid,
          "system",
          `booking-adjust-${booking.id}-${newTimeSlot}-${uid}`,
          "Session time changed",
          `Your session moved to ${newTime12} on ${booking.date}.`,
          { link: "/dashboard", meta: { bookingId: booking.id } },
        );
      }
    }

    res.json(sanitizeBookingForUser(me, updated));
  });

  // Admin: clear protected (legacy: emergency) cancel usage so the client can use it again
  app.post("/api/users/:id/reset-emergency-cancel", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.updateUser(id, {
      emergencyCancelLastMonth: null,
      emergencyCancelLastUsedAt: null,
      protectedCancelMonth: null,
      protectedCancelCount: 0,
    } as any);
    res.json(sanitizeUser(updated));
  });

  // Admin: clear Same-Day Adjustment usage so the client can use it again
  app.post("/api/users/:id/reset-same-day-adjust", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.updateUser(id, {
      sameDayAdjustMonth: null,
      sameDayAdjustCount: 0,
    } as any);
    res.json(sanitizeUser(updated));
  });

  // Admin: clear free trial usage so the client can book a free trial again
  app.post("/api/users/:id/reset-free-trial", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.updateUser(id, { hasUsedFreeTrial: false } as any);
    res.json(sanitizeUser(updated));
  });

  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const parsed = updateBookingSchema
      .extend({ override: z.boolean().optional() })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid update" });
    }

    if (me.role !== "admin") {
      // Task #6: owner OR linked Duo partner may PATCH (reschedule/notes).
      const isOwner = booking.userId === me.id;
      const isPartner =
        typeof (booking as any).linkedPartnerUserId === "number" &&
        (booking as any).linkedPartnerUserId === me.id;
      if (!isOwner && !isPartner) return res.status(403).json({ message: "Forbidden" });
      if (parsed.data.status) return res.status(403).json({ message: "Cannot change status" });
      if (parsed.data.paymentStatus)
        return res.status(403).json({ message: "Cannot change payment status" });
      if (parsed.data.adminNotes !== undefined)
        return res.status(403).json({ message: "Cannot change admin notes" });
      if (parsed.data.workoutCategory !== undefined)
        return res.status(403).json({ message: "Cannot change workout category" });
      // P4d: clients cannot write any coach-note field.
      const coachWrite = [
        "sessionEnergy",
        "sessionPerformance",
        "sessionSleep",
        "sessionAdherence",
        "sessionCardio",
        "sessionPainInjury",
        "privateCoachNotes",
        "clientVisibleCoachNotes",
      ].some((k) => (parsed.data as any)[k] !== undefined);
      if (coachWrite)
        return res.status(403).json({ message: "Cannot change coach notes" });

      // If the client is only adding a personal note, skip cutoff/conflict checks.
      const onlyNoteEdit =
        parsed.data.date === undefined &&
        parsed.data.timeSlot === undefined &&
        parsed.data.notes === undefined &&
        parsed.data.clientNotes !== undefined;

      if (!onlyNoteEdit) {
        const settings = await storage.getSettings();
        const cutoffMs = (settings.cancellationCutoffHours ?? 6) * 60 * 60 * 1000;
        const sessionAt = buildSessionDate(booking.date, booking.timeSlot);
        if (sessionAt.getTime() - Date.now() < cutoffMs) {
          return res.status(400).json({
            message: `Reschedule locked. Less than ${settings.cancellationCutoffHours} hours remain.`,
          });
        }
        const newDate = parsed.data.date ?? booking.date;
        const newSlot = parsed.data.timeSlot ?? booking.timeSlot;
        if (parsed.data.date || parsed.data.timeSlot) {
          const taken = await storage.getBookingByDateAndSlot(newDate, newSlot);
          if (
            taken &&
            taken.id !== id &&
            !["cancelled", "free_cancelled", "late_cancelled", "emergency_cancelled"].includes(
              taken.status,
            )
          ) {
            return res.status(400).json({ message: "Slot already booked" });
          }
        }
      }
    }

    const { override, ...updateFields } = parsed.data;
    const previousStatus = booking.status;
    const newStatus = updateFields.status ?? previousStatus;
    const fromDate = booking.date;
    const fromTime12 = formatTime12Server(booking.timeSlot);
    // P4d: stamp coach-notes timestamp whenever an admin writes any
    // coach-note field, so the UI can show "logged X ago".
    const coachKeys = [
      "sessionEnergy",
      "sessionPerformance",
      "sessionSleep",
      "sessionAdherence",
      "sessionCardio",
      "sessionPainInjury",
      "privateCoachNotes",
      "clientVisibleCoachNotes",
    ] as const;
    const coachTouched =
      me.role === "admin" && coachKeys.some((k) => (updateFields as any)[k] !== undefined);
    const updated = await storage.updateBooking(
      id,
      coachTouched
        ? ({ ...updateFields, coachNotesUpdatedAt: new Date() } as any)
        : (updateFields as any),
    );

    // If date or time changed, email the trainer (best-effort).
    const dateChanged = !!(updateFields.date && updateFields.date !== booking.date);
    const timeChanged = !!(updateFields.timeSlot && updateFields.timeSlot !== booking.timeSlot);
    if (dateChanged || timeChanged) {
      void dispatchBookingChangeNotification({
        kind: "reschedule",
        booking: { ...booking, ...updateFields } as Booking,
        fromDate,
        fromTime12,
      });

      // P5b / Task #6: Notify everyone affected by a reschedule that
      // didn't initiate it themselves. That includes the booking owner
      // (when admin/partner reschedules) and the linked Duo partner
      // (when admin/owner reschedules). Self-actors see the change in
      // the UI immediately. Dedupe key combines booking + new slot +
      // recipient so a second reschedule to a different slot fires
      // again, while replays of the same change are no-ops.
      const newDate = updateFields.date ?? booking.date;
      const newSlot = updateFields.timeSlot ?? booking.timeSlot;
      const newTime12 = formatTime12Server(newSlot);
      const linkedPartnerId =
        typeof (booking as any).linkedPartnerUserId === "number"
          ? ((booking as any).linkedPartnerUserId as number)
          : null;
      const recipients = new Set<number>();
      if (booking.userId !== me.id) recipients.add(booking.userId);
      if (linkedPartnerId && linkedPartnerId !== me.id) recipients.add(linkedPartnerId);
      for (const uid of Array.from(recipients)) {
        void notifyUserOnce(
          uid,
          "system",
          `booking-reschedule-${booking.id}-${newDate}-${newSlot}-${uid}`,
          "Session rescheduled",
          `Your session moved from ${fromDate} ${fromTime12} → ${newDate} ${newTime12}.`,
          { link: "/dashboard", meta: { bookingId: booking.id } },
        );
      }
    }

    // Package deduction logic on status transition. Idempotency anchored
    // on bookings.package_session_deducted_at: only increment when NULL
    // (stamp on success), only decrement when NOT NULL (clear on success).
    // This makes admin status-toggling, the auto-complete cron, and the
    // cancel route mutually safe — none of them can double-deduct.
    // Uses the unified CONSUMING_STATUSES so generic PATCH and the
    // dedicated /attendance route agree on whether `no_show` consumes.
    const wasConsuming = (CONSUMING_STATUSES as readonly string[]).includes(previousStatus);
    const isConsuming = (CONSUMING_STATUSES as readonly string[]).includes(newStatus);
    const alreadyDeducted = !!(booking as any).packageSessionDeductedAt;
    if (booking.packageId && !wasConsuming && isConsuming && !alreadyDeducted) {
      try {
        await storage.incrementPackageUsage(booking.packageId);
        await pool.query(`UPDATE bookings SET package_session_deducted_at = now() WHERE id = $1`, [booking.id]);
      } catch {}
    } else if (booking.packageId && wasConsuming && !isConsuming && alreadyDeducted) {
      try {
        await storage.decrementPackageUsage(booking.packageId);
        await pool.query(`UPDATE bookings SET package_session_deducted_at = NULL WHERE id = $1`, [booking.id]);
      } catch {}
    }
    // Recompute the client's VIP tier whenever a session is marked completed
    // (or unmarked). Best-effort, never throws.
    if (
      previousStatus !== newStatus &&
      (previousStatus === "completed" || newStatus === "completed")
    ) {
      void recomputeVipTier(booking.userId);
    }
    res.json(sanitizeBookingForUser(me, updated));
  });

  app.delete("/api/bookings/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteBooking(id);
    res.sendStatus(204);
  });

  // (Task #3 partner-side confirmation email + in-app notify is now
  // wired inline into HEAD's /api/admin/bookings/:id/link-partner above
  // so we only have ONE link route; the duplicate block was removed.)

  // ============== SETTINGS ==============
  app.get("/api/settings", async (_req, res) => {
    const s = await storage.getSettings();
    res.json(s);
  });

  app.patch("/api/settings", requireAdmin, async (req, res) => {
    const parsed = updateSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid settings" });
    }
    const updated = await storage.updateSettings(parsed.data);
    res.json(updated);
  });

  // ============== HERO IMAGES (homepage slider) ==============

  // Forward-declared sharp pipeline used by both hero-image and
  // profile-photo upload routes. Defined further below so the function
  // hoisting works inside this `registerRoutes` closure.

  // Admin profile photo upload (v9.1, May-2026).
  // Replaces the previous "paste a public URL" workflow with a real upload:
  // accepts a base64 data URL produced client-side from a file picker,
  // re-encodes through the same sharp pipeline used for hero images
  // (1200x1500 cover @ q92 WebP - matches the homepage aspect-[4/5]
  // profile card), persists the resulting data URL inline on the
  // settings row. Stored in the DB (not on disk) so it works on
  // Vercel's read-only filesystem without object storage - same
  // architecture as the client profile picture flow.
  app.post("/api/admin/profile-photo", requireAdmin, async (req, res) => {
    const schema = z.object({
      imageDataUrl: z.string().min(40, "Image data is required"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid image" });
    }
    // Route-specific strict policy per the v9.1 spec: JPG/PNG/WebP
    // ONLY (no HEIC for the profile-photo endpoint), 5 MB hard cap.
    // Hero and transformation upload routes keep their original
    // (more permissive) defaults — those are unchanged.
    const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
    const PROFILE_PHOTO_ALLOWED_MIME = new Set([
      "image/jpeg", "image/jpg", "image/png", "image/webp",
    ]);
    const processed = await processAdminImageDataUrl(parsed.data.imageDataUrl, {
      width: 1200,
      height: 1500,
      fit: "cover",
      quality: 90,
      allowedMime: PROFILE_PHOTO_ALLOWED_MIME,
      // base64 expands ~33% so a 5 MB raw file can produce ~6.7 MB of
      // data-URL text. Cap data-URL length accordingly so the strict
      // 5 MB raw limit is enforced without false-rejecting valid
      // 5 MB files.
      maxDataUrlBytes: Math.ceil(PROFILE_PHOTO_MAX_BYTES * 1.4),
      maxDecodedBytes: PROFILE_PHOTO_MAX_BYTES,
      typeErrorMessage: "Only JPG, PNG, or WebP images are allowed",
      sizeErrorMessage: "Image must be 5 MB or smaller",
    });
    if (!processed.ok) {
      return res.status(processed.status).json({ message: processed.message });
    }
    const updated = await storage.updateSettings({ profilePhotoUrl: processed.dataUrl });
    res.json(updated);
  });
  // Public read — used by HomePage. Returns slides ordered by sortOrder.
  app.get("/api/hero-images", async (_req, res) => {
    const list = await storage.getHeroImages();
    res.json(list);
  });

  // Shared sharp pipeline for admin-supplied data-URL images. Returns a
  // base64 WebP data URL or null if the input is not a parseable image of an
  // allowed MIME type. Used by hero (1920x1080 cover) and transformations
  // (1600px long edge contain) endpoints.
  async function processAdminImageDataUrl(
    dataUrl: string,
    opts: {
      width: number;
      height?: number;
      fit: "cover" | "inside";
      quality?: number;
      // v9.1 (May-2026): route-specific overrides so the profile-photo
      // endpoint can enforce a STRICTER JPG/PNG/WebP-only + 5 MB
      // policy than hero/transformation uploads. Defaults preserve the
      // pre-v9.1 behaviour (PNG/JPEG/WebP/HEIC, ~15 MB decoded /
      // ~20 MB data URL) so hero + transformation flows are unchanged.
      allowedMime?: Set<string>;
      maxDataUrlBytes?: number;
      maxDecodedBytes?: number;
      typeErrorMessage?: string;
      sizeErrorMessage?: string;
    },
  ): Promise<{ ok: true; dataUrl: string } | { ok: false; status: number; message: string }> {
    if (typeof dataUrl !== "string" || dataUrl.length < 40) {
      return { ok: false, status: 400, message: "Image data is required" };
    }
    const maxDataUrlBytes = opts.maxDataUrlBytes ?? 20 * 1024 * 1024;
    if (dataUrl.length > maxDataUrlBytes) {
      return { ok: false, status: 400, message: opts.sizeErrorMessage ?? "Image is too large" };
    }
    const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
    if (!match) {
      return { ok: false, status: 400, message: "Image must be a base64 data URL" };
    }
    const ALLOWED_MIME = opts.allowedMime ?? new Set([
      "image/png", "image/jpeg", "image/jpg", "image/webp", "image/heic", "image/heif",
    ]);
    if (!ALLOWED_MIME.has(match[1].toLowerCase())) {
      return {
        ok: false,
        status: 400,
        message: opts.typeErrorMessage ?? "Unsupported image type. Use PNG, JPEG, WebP, or HEIC.",
      };
    }
    try {
      const buffer = Buffer.from(match[2], "base64");
      const maxDecodedBytes = opts.maxDecodedBytes ?? 15 * 1024 * 1024;
      if (buffer.byteLength > maxDecodedBytes) {
        return { ok: false, status: 400, message: opts.sizeErrorMessage ?? "Image is too large after decoding" };
      }
      let pipeline = sharp(buffer, { failOn: "none", limitInputPixels: 50_000_000 }).rotate();
      if (opts.fit === "cover" && opts.height) {
        pipeline = pipeline.resize(opts.width, opts.height, { fit: "cover", position: "center" });
      } else {
        pipeline = pipeline.resize({ width: opts.width, height: opts.width, fit: "inside", withoutEnlargement: true });
      }
      // Cinematic-tier default quality (92) — was 78. The cropper now
      // emits WebP at 0.95, and the hero/transformation showcase has
      // moved from "clean web" to "movie-poster premium" presentation
      // (twin-image depth-of-field rig, cyan grade, subject key-light
      // — see HeroSlider.tsx). Re-encoding at 78 was throwing away
      // most of that perceptual fidelity. Effort 5 (was 4) gives
      // libwebp ~15% better compression at this quality so the file
      // size doesn't balloon proportionally to the quality bump.
      const webp = await pipeline.webp({ quality: opts.quality ?? 92, effort: 5 }).toBuffer();
      return { ok: true, dataUrl: `data:image/webp;base64,${webp.toString("base64")}` };
    } catch (e) {
      console.error("[admin-image] sharp failed:", e);
      return { ok: false, status: 400, message: "Could not process image. Try a different photo." };
    }
  }

  // Admin upload. Same sharp pipeline as profile pictures but bigger
  // canvas (1920x1080, cover) and stored as a base64 WebP data URL so it
  // works on Vercel's read-only filesystem without needing object storage.
  app.post("/api/admin/hero-images", requireAdmin, async (req, res) => {
    const schema = z.object({
      imageDataUrl: z.string(),
      title: z.string().max(140).nullish(),
      subtitle: z.string().max(240).nullish(),
      badge: z.string().max(60).nullish(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid image" });
    }
    const processed = await processAdminImageDataUrl(parsed.data.imageDataUrl, {
      width: 1920, height: 1080, fit: "cover",
    });
    if (!processed.ok) return res.status(processed.status).json({ message: processed.message });

    // New images go to the end of the slider by default.
    const existing = await storage.getHeroImages();
    // Hard cap on slider length — also matches the UI cap. Prevents
    // table/payload growth if anyone bypasses the admin form.
    const MAX_HERO_IMAGES = 12;
    if (existing.length >= MAX_HERO_IMAGES) {
      return res.status(400).json({
        message: `Maximum of ${MAX_HERO_IMAGES} hero images. Delete one before uploading another.`,
      });
    }
    const nextOrder = existing.length
      ? Math.max(...existing.map((h) => h.sortOrder)) + 1
      : 0;
    // New slides start with identity display tuning so they render
    // exactly as the cropper produced them. The admin can then open
    // the per-slide "Display tuning" panel to nudge focal/zoom/etc.
    const created = await storage.createHeroImage({
      imageDataUrl: processed.dataUrl,
      sortOrder: nextOrder,
      title: parsed.data.title ?? null,
      subtitle: parsed.data.subtitle ?? null,
      badge: parsed.data.badge ?? null,
      isActive: true,
      focalX: 0,
      focalY: 0,
      zoom: 1.0,
      rotate: 0,
      brightness: 1.0,
      contrast: 1.0,
      overlayOpacity: 35,
    });
    res.status(201).json(created);
  });

  // Generic PATCH — accepts any subset of (sortOrder, isActive, title,
  // subtitle, badge). Used by both reorder buttons and the metadata editor.
  app.patch("/api/admin/hero-images/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = updateHeroImageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid update" });
    }
    const updated = await storage.updateHeroImage(id, parsed.data);
    if (!updated) return res.status(404).json({ message: "Hero image not found" });
    res.json(updated);
  });

  app.delete("/api/admin/hero-images/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteHeroImage(id);
    res.sendStatus(204);
  });

  // ============== TRANSFORMATIONS (before/after gallery) ==============
  // Public list — only active rows, sorted by admin order.
  app.get("/api/transformations", async (_req, res) => {
    const list = await storage.getTransformations({ activeOnly: true });
    res.json(list);
  });

  // Admin list — includes inactive (so admin sees everything).
  app.get("/api/admin/transformations", requireAdmin, async (_req, res) => {
    const list = await storage.getTransformations({ activeOnly: false });
    res.json(list);
  });

  app.post("/api/admin/transformations", requireAdmin, async (req, res) => {
    const schema = z.object({
      beforeImageDataUrl: z.string(),
      afterImageDataUrl: z.string(),
      displayName: z.string().max(80).nullish(),
      goal: z.string().max(120).nullish(),
      duration: z.string().max(60).nullish(),
      result: z.string().max(160).nullish(),
      testimonial: z.string().max(600).nullish(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const before = await processAdminImageDataUrl(parsed.data.beforeImageDataUrl, {
      width: 1600, fit: "inside", quality: 90,
    });
    if (!before.ok) return res.status(before.status).json({ message: `Before image: ${before.message}` });
    const after = await processAdminImageDataUrl(parsed.data.afterImageDataUrl, {
      width: 1600, fit: "inside", quality: 90,
    });
    if (!after.ok) return res.status(after.status).json({ message: `After image: ${after.message}` });

    const existing = await storage.getTransformations({ activeOnly: false });
    const MAX_TRANSFORMATIONS = 24;
    if (existing.length >= MAX_TRANSFORMATIONS) {
      return res.status(400).json({
        message: `Maximum of ${MAX_TRANSFORMATIONS} transformations. Delete one first.`,
      });
    }
    const nextOrder = existing.length
      ? Math.max(...existing.map((t) => t.sortOrder)) + 1
      : 0;
    const created = await storage.createTransformation({
      beforeImageDataUrl: before.dataUrl,
      afterImageDataUrl: after.dataUrl,
      displayName: parsed.data.displayName ?? null,
      goal: parsed.data.goal ?? null,
      duration: parsed.data.duration ?? null,
      result: parsed.data.result ?? null,
      testimonial: parsed.data.testimonial ?? null,
      isActive: true,
      sortOrder: nextOrder,
    });
    res.status(201).json(created);
  });

  app.patch("/api/admin/transformations/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = updateTransformationSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid update" });
    }
    // If admin is sending a NEW image data URL (not an existing webp ref),
    // re-pipe it through sharp. We detect "new uploads" by the presence of
    // base64 prefix that isn't already image/webp <under 200KB-ish>.
    const updates: typeof parsed.data = { ...parsed.data };
    for (const key of ["beforeImageDataUrl", "afterImageDataUrl"] as const) {
      const value = updates[key];
      if (typeof value === "string" && value.startsWith("data:")) {
        const processed = await processAdminImageDataUrl(value, {
          width: 1600, fit: "inside", quality: 90,
        });
        if (!processed.ok) {
          return res.status(processed.status).json({ message: `${key}: ${processed.message}` });
        }
        updates[key] = processed.dataUrl;
      }
    }
    const updated = await storage.updateTransformation(id, updates);
    if (!updated) return res.status(404).json({ message: "Transformation not found" });
    res.json(updated);
  });

  app.delete("/api/admin/transformations/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    await storage.deleteTransformation(id);
    res.sendStatus(204);
  });

  // ============== BLOCKED SLOTS / HOLIDAYS ==============
  app.get("/api/blocked-slots", async (_req, res) => {
    const list = await storage.getBlockedSlots();
    res.json(list);
  });

  app.post("/api/blocked-slots", requireAdmin, async (req, res) => {
    const parsed = insertBlockedSlotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid block" });
    }
    const created = await storage.createBlockedSlot(parsed.data);
    res.status(201).json(created);
  });

  app.delete("/api/blocked-slots/:id", requireAdmin, async (req, res) => {
    await storage.deleteBlockedSlot(Number(req.params.id));
    res.sendStatus(204);
  });

  // ============== PACKAGES ==============
  app.get("/api/packages", requireAuth, async (req, res) => {
    const me = req.user as User;
    const userIdQuery = req.query.userId ? Number(req.query.userId) : undefined;
    const filters: { userId?: number } = {};
    if (me.role !== "admin") {
      filters.userId = me.id;
    } else if (userIdQuery) {
      filters.userId = userIdQuery;
    }
    const list = await storage.getPackages(filters);

    const includeUsers = req.query.includeUser === "true" && me.role === "admin";
    if (!includeUsers) return res.json(list);

    const userIds = Array.from(
      new Set(list.flatMap((p) => [p.userId, p.partnerUserId].filter(Boolean) as number[])),
    );
    const usersById: Record<number, any> = {};
    for (const uid of userIds) {
      const u = await storage.getUser(uid);
      if (u) usersById[uid] = sanitizeUser(u);
    }
    res.json(
      list.map((p) => ({
        ...p,
        user: usersById[p.userId] || null,
        partner: p.partnerUserId ? usersById[p.partnerUserId] || null : null,
      })),
    );
  });

  app.post("/api/packages", requireAdmin, async (req, res) => {
    const parsed = insertPackageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid package" });
    }
    // Validate partner if duo (legacy "duo30" or new template type "duo")
    if (parsed.data.type === "duo30" || parsed.data.type === "duo") {
      if (!parsed.data.partnerUserId) {
        return res.status(400).json({ message: "Duo packages require a partner client" });
      }
      const partner = await storage.getUser(parsed.data.partnerUserId);
      if (!partner || partner.role !== "client") {
        return res.status(400).json({ message: "Partner must be a registered client" });
      }
    }
    const created = await storage.createPackage(parsed.data);
    try {
      await storage.createPackageSessionHistory({
        packageId: created.id,
        userId: created.userId,
        action: "package_created",
        sessionsDelta: created.totalSessions ?? 0,
        performedByUserId: (req.user as User).id,
        reason: created.name ?? null,
      } as any);
    } catch {/* ignore */}
    res.status(201).json(created);
  });

  app.patch("/api/packages/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updatePackageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid update" });
    }
    const updated = await storage.updatePackage(id, parsed.data as any);
    res.json(updated);
  });

  app.delete("/api/packages/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const pkg = await storage.getPackage(id).catch(() => undefined);
    await storage.deletePackage(id);
    if (pkg) {
      try {
        await storage.createPackageSessionHistory({
          packageId: pkg.id,
          userId: pkg.userId,
          action: "package_deleted",
          sessionsDelta: -(pkg.totalSessions - pkg.usedSessions),
          performedByUserId: (req.user as User | undefined)?.id ?? null,
          reason: "Package deleted by admin",
        } as any);
      } catch {/* best-effort audit */}
    }
    res.sendStatus(204);
  });

  // ============== ADMIN PACKAGE CONTROLS ==============
  // Freeze / unfreeze a package — pauses booking without altering balance.
  app.post("/api/admin/packages/:id/freeze", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = freezePackageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const pkg = await storage.getPackage(id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    const me = req.user as User;
    const updated = await storage.updatePackage(id, {
      frozen: parsed.data.frozen,
      frozenAt: parsed.data.frozen ? new Date() : null,
      frozenReason: parsed.data.frozen ? parsed.data.reason ?? null : null,
    } as any);
    try {
      await storage.createPackageSessionHistory({
        packageId: pkg.id,
        userId: pkg.userId,
        action: parsed.data.frozen ? "package_frozen" : "package_unfrozen",
        sessionsDelta: 0,
        performedByUserId: me.id,
        reason: parsed.data.reason ?? null,
      } as any);
    } catch {/* ignore */}
    res.json(updated);
  });

  // Update payment status (manual — NO online gateway).
  app.post("/api/admin/packages/:id/payment", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updatePackagePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const pkg = await storage.getPackage(id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    const me = req.user as User;
    const approved =
      parsed.data.paymentApproved ?? parsed.data.paymentStatus === "paid";
    const updated = await storage.updatePackage(id, {
      paymentStatus: parsed.data.paymentStatus,
      paymentApproved: approved,
      paymentApprovedAt: approved ? new Date() : null,
      paymentApprovedByUserId: approved ? me.id : null,
      paymentNote: parsed.data.note ?? null,
    } as any);
    try {
      await storage.createPackageSessionHistory({
        packageId: pkg.id,
        userId: pkg.userId,
        action: "payment_updated",
        sessionsDelta: 0,
        performedByUserId: me.id,
        reason: `${parsed.data.paymentStatus}${parsed.data.note ? ` — ${parsed.data.note}` : ""}`,
      } as any);
    } catch {/* ignore */}
    res.json(updated);
  });

  // Manual session adjustment (positive = grant, negative = remove).
  app.post("/api/admin/packages/:id/sessions-adjust", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = adjustPackageSessionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const pkg = await storage.getPackage(id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    const me = req.user as User;
    const { delta, reason } = parsed.data;
    // Granting credits = increase totalSessions. Removing credits = decrease
    // remaining balance by raising usedSessions (without going negative).
    let updated;
    if (delta > 0) {
      updated = await storage.updatePackage(id, {
        totalSessions: pkg.totalSessions + delta,
      } as any);
    } else {
      const newUsed = Math.min(pkg.totalSessions, pkg.usedSessions + Math.abs(delta));
      updated = await storage.updatePackage(id, { usedSessions: newUsed } as any);
    }
    try {
      await storage.createPackageSessionHistory({
        packageId: pkg.id,
        userId: pkg.userId,
        action: delta > 0 ? "session_added_manual" : "session_removed_manual",
        sessionsDelta: delta,
        performedByUserId: me.id,
        reason,
      } as any);
    } catch {/* ignore */}
    res.json(updated);
  });

  // Approve / unapprove a package (gate for client booking).
  app.post("/api/admin/packages/:id/approve", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = approvePackageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const pkg = await storage.getPackage(id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    const me = req.user as User;
    const updated = await storage.updatePackage(id, {
      adminApproved: parsed.data.approved,
      adminApprovedAt: parsed.data.approved ? new Date() : null,
      adminApprovedByUserId: parsed.data.approved ? me.id : null,
    } as any);
    try {
      await storage.createPackageSessionHistory({
        packageId: pkg.id,
        userId: pkg.userId,
        action: "package_approved",
        sessionsDelta: 0,
        performedByUserId: me.id,
        reason: parsed.data.approved
          ? parsed.data.note ?? "Package approved"
          : parsed.data.note ?? "Approval revoked",
      } as any);
    } catch {/* ignore */}
    res.json(updated);
  });

  // Read the audit trail for a single client (used by the Sessions tab).
  // P4e: Activity feed (admin scoping a specific client).
  // Task #5 (Nov 2026): Linked Duo partners for the admin client detail
  // page. Aggregates BOTH directions of `packages.partnerUserId` and
  // `bookings.linkedPartnerUserId` so the admin sees every account this
  // client shares a duo session with — regardless of who's the "primary"
  // on a given package or booking. Returns minimal sanitized identity
  // shapes plus the source set so the UI can label provenance.
  app.get("/api/admin/clients/:id/linked-partners", requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid client id" });
    const partners = await storage.getLinkedPartnerIds(userId);
    const out: Array<{
      id: number;
      fullName: string | null;
      username: string | null;
      profilePictureUrl: string | null;
      sources: ("package" | "booking")[];
    }> = [];
    for (const p of partners) {
      const u = await storage.getUser(p.id);
      if (!u) continue;
      const su = sanitizeUser(u);
      out.push({
        id: su.id,
        fullName: su.fullName ?? null,
        username: su.username ?? null,
        profilePictureUrl: su.profilePictureUrl ?? null,
        sources: p.sources,
      });
    }
    out.sort((a, b) =>
      (a.fullName || a.username || "").localeCompare(b.fullName || b.username || ""),
    );
    res.json(out);
  });

  app.get("/api/admin/clients/:id/activity", requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid client id" });
    const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 200);
    const events = await buildActivityFeed(userId, limit);
    res.json(events);
  });

  // OI2 — Client Command Center intelligence aggregator. Admin-only.
  // Single endpoint returning snapshot + momentum + attention items + recent
  // changes computed by the pure `computeClientIntelligence` service over
  // 5 bounded queries from `storage.getClientIntelligenceData`.
  app.get("/api/admin/clients/:id/intelligence", requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid client id" });
    try {
      const user = await storage.getUser(userId);
      if (!user || user.role !== "client") {
        return res.status(404).json({ message: "Client not found" });
      }
      const data = await storage.getClientIntelligenceData(userId);
      const intel = computeClientIntelligence({
        now: new Date(),
        clientStatus: user.clientStatus ?? null,
        primaryGoal: user.primaryGoal ?? null,
        joinedAt: (user.createdAt as any) ?? null,
        activePackage: data.activePackage,
        bookings: data.bookings,
        checkins: data.checkins,
        bodyMetrics: data.bodyMetrics,
        pendingRenewalCount: data.pendingRenewalCount,
        pendingExtensionCount: data.pendingExtensionCount,
      });
      res.json(intel);
    } catch (e) {
      console.error("[intelligence] compute failed:", e);
      res.status(500).json({ message: "Failed to compute intelligence" });
    }
  });

  // P4f: Today Hero summary — next session, supplements-today count,
  // water target, current weekly-active streak, goal progress. Self-
  // scoped only; never trust client-supplied userId.
  app.get("/api/me/today", requireAuth, async (req, res) => {
    const me = req.user as User;
    const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try { return await fn(); } catch { return fallback; }
    };

    const nowMs = Date.now();
    const todayIso = new Date().toISOString().slice(0, 10);

    const [bookings, clientSupps, activePlan, checkins, bodyMetrics] = await Promise.all([
      safe(() => storage.getBookings({ userId: me.id }), [] as any[]),
      safe(() => storage.listClientSupplements(me.id, { activeOnly: true }), [] as any[]),
      safe(() => storage.getActiveNutritionPlanForUser(me.id), undefined as any),
      safe(() => storage.listWeeklyCheckins(me.id, { limit: 60 }), [] as any[]),
      safe(() => storage.listBodyMetrics(me.id, { limit: 200 }), [] as any[]),
    ]);

    // Next session: earliest upcoming/confirmed booking strictly after now.
    // Bookings store `date` (YYYY-MM-DD) and `timeSlot` ("HH:MM") separately,
    // so we combine them into a real epoch before comparing — otherwise we
    // would miss same-day future slots and misorder slots within a day.
    let nextSession: { id: number; date: string; sessionType: string | null } | null = null;
    {
      const upcoming = (bookings as any[])
        .filter((b) => b.status === "upcoming" || b.status === "confirmed")
        .map((b) => {
          const dateStr = b.date instanceof Date
            ? b.date.toISOString().slice(0, 10)
            : String(b.date ?? "").slice(0, 10);
          const timeStr = String(b.timeSlot ?? "00:00");
          const iso = dateStr ? `${dateStr}T${timeStr.length === 5 ? timeStr : "00:00"}:00` : "";
          const epoch = iso ? new Date(iso).getTime() : NaN;
          return {
            id: b.id,
            date: iso,
            epoch,
            sessionType: b.sessionType ? String(b.sessionType) : null,
          };
        })
        .filter((b) => Number.isFinite(b.epoch) && b.epoch > nowMs)
        .sort((a, b) => a.epoch - b.epoch);
      const first = upcoming[0];
      nextSession = first ? { id: first.id, date: first.date, sessionType: first.sessionType } : null;
    }

    // Supplements applicable today: active client supplements whose
    // start/end window covers today (nullable = open-ended).
    const supplementsToday = (clientSupps as any[]).filter((s) => {
      if (s.status && s.status !== "active") return false;
      if (s.startDate && String(s.startDate) > todayIso) return false;
      if (s.endDate && String(s.endDate) < todayIso) return false;
      return true;
    }).length;

    const waterTargetMl: number | null = activePlan?.waterTargetMl ?? null;

    // Streak: consecutive ISO weeks (Mon-anchored) ending at the current
    // week, where the user logged ≥1 check-in OR ≥1 completed booking.
    const mondayOf = (d: Date): string => {
      const x = new Date(d);
      x.setUTCHours(0, 0, 0, 0);
      const day = x.getUTCDay(); // 0=Sun..6=Sat
      const offset = day === 0 ? -6 : 1 - day;
      x.setUTCDate(x.getUTCDate() + offset);
      return x.toISOString().slice(0, 10);
    };
    const activeWeeks = new Set<string>();
    for (const c of checkins as any[]) {
      const ws = c.weekStart ? String(c.weekStart) : null;
      if (ws) activeWeeks.add(mondayOf(new Date(ws)));
    }
    for (const b of bookings as any[]) {
      if (b.status !== "completed") continue;
      const d = b.date instanceof Date ? b.date : new Date(String(b.date));
      if (!isNaN(d.getTime())) activeWeeks.add(mondayOf(d));
    }
    let streakWeeks = 0;
    {
      const cursor = new Date();
      while (true) {
        const wk = mondayOf(cursor);
        if (activeWeeks.has(wk)) {
          streakWeeks += 1;
          cursor.setUTCDate(cursor.getUTCDate() - 7);
        } else {
          break;
        }
      }
    }

    // Goal progress: earliest vs latest body-metric weight.
    const sortedMetrics = (bodyMetrics as any[])
      .filter((m) => m.weight != null && m.recordedOn)
      .sort((a, b) => (String(a.recordedOn) < String(b.recordedOn) ? -1 : 1));
    const weightStartKg = sortedMetrics[0]?.weight ?? null;
    const weightLatestKg = sortedMetrics[sortedMetrics.length - 1]?.weight ?? null;
    const deltaKg =
      weightStartKg != null && weightLatestKg != null
        ? Number((weightLatestKg - weightStartKg).toFixed(1))
        : null;

    res.json({
      nextSession,
      supplementsToday,
      waterTargetMl,
      streakWeeks,
      goal: {
        primary: me.primaryGoal ?? null,
        weightStartKg,
        weightLatestKg,
        deltaKg,
      },
    });
  });

  // Task #9: Client-facing Duo partners. Mirrors the admin-only
  // `/api/admin/clients/:id/linked-partners` route but self-scoped (reads
  // userId from the session) and returns only the minimal identity shape
  // — id, fullName, profilePictureUrl — so partners' private fields never
  // leak across accounts. Same privacy shape as the bookings list.
  app.get("/api/me/linked-partners", requireAuth, async (req, res) => {
    const me = req.user as User;
    const partners = await storage.getActiveLinkedPartnerIds(me.id);
    const out: Array<{
      id: number;
      fullName: string | null;
      profilePictureUrl: string | null;
    }> = [];
    for (const p of partners) {
      const u = await storage.getUser(p.id);
      if (!u) continue;
      const su = sanitizeUser(u);
      out.push({
        id: su.id,
        fullName: su.fullName ?? null,
        profilePictureUrl: su.profilePictureUrl ?? null,
      });
    }
    out.sort((a, b) => (a.fullName || "").localeCompare(b.fullName || ""));
    res.json(out);
  });

  // P4e: Activity feed (self-scoped — never trust client-supplied userId).
  app.get("/api/me/activity", requireAuth, async (req, res) => {
    const me = req.user as User;
    const limit = Math.min(Math.max(Number(req.query.limit) || 60, 1), 200);
    const events = await buildActivityFeed(me.id, limit);
    res.json(events);
  });

  // P5a: Client-facing notifications. All routes are self-scoped — the
  // server reads userId from the session, never from the request body
  // or query, so a client can only ever see/mutate its own rows.
  app.get("/api/me/notifications", requireAuth, async (req, res) => {
    const me = req.user as User;
    const unreadOnly = req.query.unreadOnly === "true";
    const limitRaw = Number(req.query.limit ?? 50);
    const limit = Number.isFinite(limitRaw) ? limitRaw : 50;
    const list = await storage.getClientNotifications(me.id, { unreadOnly, limit });
    res.json(list);
  });

  app.get("/api/me/notifications/unread-count", requireAuth, async (req, res) => {
    const me = req.user as User;
    const count = await storage.getClientUnreadNotificationCount(me.id);
    res.json({ count });
  });

  app.post("/api/me/notifications/:id/read", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const updated = await storage.markClientNotificationRead(id, me.id);
    if (!updated) {
      // Either not found, not owned, or already read — all map to 204
      // so clients can call this idempotently without surfacing errors.
      return res.status(204).end();
    }
    res.json(updated);
  });

  app.post("/api/me/notifications/read-all", requireAuth, async (req, res) => {
    const me = req.user as User;
    await storage.markAllClientNotificationsRead(me.id);
    res.json({ ok: true });
  });

  app.get("/api/admin/clients/:id/session-history", requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid client id" });
    const limit = Math.min(Math.max(Number(req.query.limit) || 200, 1), 500);
    const history = await storage.getPackageSessionHistory({ userId, limit });
    res.json(history);
  });

  // ============== PACKAGE TEMPLATES (admin catalogue) ==============
  // GET is intentionally PUBLIC for ?activeOnly=true so the homepage
  // packages section can render without an auth round-trip. Admins
  // querying the full list (including inactive) must be authenticated.
  app.get("/api/package-templates", async (req, res) => {
    const activeOnly = req.query.activeOnly === "true";
    const me = req.user as User | undefined;
    const isAdmin = me?.role === "admin";
    if (!activeOnly && !isAdmin) {
      // Public traffic only ever sees the active list.
      return res.json(await storage.getPackageTemplates({ activeOnly: true }));
    }
    res.json(await storage.getPackageTemplates({ activeOnly }));
  });

  app.post("/api/package-templates", requireAdmin, async (req, res) => {
    const parsed = insertPackageTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid template" });
    }
    const created = await storage.createPackageTemplate(parsed.data);
    res.status(201).json(created);
  });

  app.patch("/api/package-templates/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updatePackageTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid update" });
    }
    const existing = await storage.getPackageTemplate(id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    const updated = await storage.updatePackageTemplate(id, parsed.data);
    res.json(updated);
  });

  app.delete("/api/package-templates/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const existing = await storage.getPackageTemplate(id);
    if (!existing) return res.status(404).json({ message: "Template not found" });
    // Note: per-client `packages` rows store a snapshot copy of every
    // field they need (name/sessions/price), so deleting a template
    // here NEVER affects the historical record on any client.
    await storage.deletePackageTemplate(id);
    res.sendStatus(204);
  });

  // ============== FOODS (Nutrition OS — Phase 2) ==============
  // Admin-only catalogue. List supports server-side search + pagination
  // for scalability (designed for thousands of rows). Per-client read
  // access (Phase 4 nutrition assignments) will route through a
  // different endpoint that enforces snapshot data, so /api/foods stays
  // strictly admin.
  app.get("/api/foods", requireAdmin, async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const category = typeof req.query.category === "string" && req.query.category
      ? req.query.category
      : undefined;
    const supplementParam = req.query.supplement;
    const isSupplement =
      supplementParam === "true" ? true : supplementParam === "false" ? false : undefined;
    const activeOnly = req.query.activeOnly === "true";
    const limit = req.query.limit ? Math.min(Math.max(Number(req.query.limit) || 50, 1), 200) : 50;
    const offset = req.query.offset ? Math.max(Number(req.query.offset) || 0, 0) : 0;
    const result = await storage.getFoods({
      search,
      category,
      isSupplement,
      activeOnly,
      limit,
      offset,
    });
    res.json(result);
  });

  app.get("/api/foods/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const food = await storage.getFood(id);
    if (!food) return res.status(404).json({ message: "Food not found" });
    res.json(food);
  });

  app.post("/api/foods", requireAdmin, async (req, res) => {
    const parsed = insertFoodSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.errors[0]?.message || "Invalid food",
        errors: parsed.error.errors,
      });
    }
    const me = req.user as User;
    const created = await storage.createFood(parsed.data, me.id);
    res.status(201).json(created);
  });

  app.patch("/api/foods/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = updateFoodSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.errors[0]?.message || "Invalid update",
        errors: parsed.error.errors,
      });
    }
    const existing = await storage.getFood(id);
    if (!existing) return res.status(404).json({ message: "Food not found" });
    const updated = await storage.updateFood(id, parsed.data);
    res.json(updated);
  });

  app.delete("/api/foods/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const existing = await storage.getFood(id);
    if (!existing) return res.status(404).json({ message: "Food not found" });
    // Phase 3 meal_items will snapshot food fields, so deleting here
    // does not affect historical meals. Until Phase 3 ships, hard delete
    // is safe (no other table references foods.id yet).
    await storage.deleteFood(id);
    res.sendStatus(204);
  });

  app.post("/api/foods/:id/duplicate", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const me = req.user as User;
    const dup = await storage.duplicateFood(id, me.id);
    if (!dup) return res.status(404).json({ message: "Food not found" });
    res.status(201).json(dup);
  });

  // ============== MEALS (Nutrition OS — Phase 3) ==============
  // Admin-only meal builder. Each meal has N meal_items which
  // SNAPSHOT the food fields, so editing/deleting a food never
  // mutates an existing meal. Cached totals are recomputed
  // server-side on every write via the shared computeMealTotals
  // helper — list views never need to JOIN + SUM.
  app.get("/api/meals", requireAdmin, async (req, res) => {
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const category =
      typeof req.query.category === "string" && req.query.category
        ? req.query.category
        : undefined;
    const templateOnly = req.query.templateOnly === "true";
    const activeOnly = req.query.activeOnly === "true";
    const limit = req.query.limit
      ? Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
      : 50;
    const offset = req.query.offset ? Math.max(Number(req.query.offset) || 0, 0) : 0;
    const result = await storage.getMeals({
      search,
      category,
      templateOnly,
      activeOnly,
      limit,
      offset,
    });
    res.json(result);
  });

  app.get("/api/meals/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const meal = await storage.getMeal(id);
    if (!meal) return res.status(404).json({ message: "Meal not found" });
    res.json(meal);
  });

  app.post("/api/meals", requireAdmin, async (req, res) => {
    const parsed = insertMealSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.errors[0]?.message || "Invalid meal",
        errors: parsed.error.errors,
      });
    }
    const me = req.user as User;
    const { items, ...meal } = parsed.data;
    const created = await storage.createMeal(meal, items, me.id);
    res.status(201).json(created);
  });

  app.patch("/api/meals/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = updateMealSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.errors[0]?.message || "Invalid update",
        errors: parsed.error.errors,
      });
    }
    const existing = await storage.getMeal(id);
    if (!existing) return res.status(404).json({ message: "Meal not found" });
    const { items, ...meal } = parsed.data;
    const updated = await storage.updateMeal(id, meal, items);
    res.json(updated);
  });

  app.delete("/api/meals/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const existing = await storage.getMeal(id);
    if (!existing) return res.status(404).json({ message: "Meal not found" });
    await storage.deleteMeal(id);
    res.sendStatus(204);
  });

  app.post("/api/meals/:id/duplicate", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const me = req.user as User;
    const dup = await storage.duplicateMeal(id, me.id);
    if (!dup) return res.status(404).json({ message: "Meal not found" });
    res.status(201).json(dup);
  });

  // ============== NUTRITION PLANS (Phase 4) ==============
  // Admin-managed client nutrition plans. The full plan tree
  // (plan → days → meals → items) is FULL-snapshotted server-side
  // so editing/deleting library foods or meals never mutates a
  // delivered plan. Cached per-meal totals are recomputed on every
  // write via shared/nutrition.ts. There is exactly one /me/active
  // endpoint for the client view — it strips private trainer notes
  // and enforces ownership at the DB filter level.

  // CLIENT-FACING: must be registered BEFORE the admin /:id route
  // so Express doesn't treat "me" as a numeric id.
  app.get("/api/nutrition-plans/me/active", async (req, res) => {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const me = req.user as User;
    const plan = await storage.getActiveNutritionPlanForUser(me.id);
    if (!plan) return res.status(404).json({ message: "No active nutrition plan" });
    // Trainer-only field — never leak to client surface.
    const { privateNotes: _strip, ...rest } = plan as any;
    res.json(rest);
  });

  app.get("/api/nutrition-plans", requireAdmin, async (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const status =
      typeof req.query.status === "string" && req.query.status ? req.query.status : undefined;
    const limit = req.query.limit
      ? Math.min(Math.max(Number(req.query.limit) || 50, 1), 200)
      : 50;
    const offset = req.query.offset ? Math.max(Number(req.query.offset) || 0, 0) : 0;
    const result = await storage.getNutritionPlans({
      userId: userId && Number.isFinite(userId) ? userId : undefined,
      status,
      limit,
      offset,
    });
    res.json(result);
  });

  app.get("/api/nutrition-plans/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const plan = await storage.getNutritionPlan(id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });
    res.json(plan);
  });

  app.post("/api/nutrition-plans", requireAdmin, async (req, res) => {
    const parsed = insertNutritionPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.errors[0]?.message || "Invalid plan",
        errors: parsed.error.errors,
      });
    }
    // Reject if the target user doesn't exist or isn't a client.
    const target = await storage.getUser(parsed.data.userId);
    if (!target) return res.status(400).json({ message: "Client not found" });
    const me = req.user as User;
    const { days, ...plan } = parsed.data;
    const created = await storage.createNutritionPlan(plan, days, me.id);
    res.status(201).json(created);
  });

  app.patch("/api/nutrition-plans/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = updateNutritionPlanSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: parsed.error.errors[0]?.message || "Invalid update",
        errors: parsed.error.errors,
      });
    }
    const existing = await storage.getNutritionPlan(id);
    if (!existing) return res.status(404).json({ message: "Plan not found" });
    const { days, userId: _ignore, ...rest } = parsed.data as any;
    const updated = await storage.updateNutritionPlan(id, rest, days);
    res.json(updated);
  });

  app.delete("/api/nutrition-plans/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const existing = await storage.getNutritionPlan(id);
    if (!existing) return res.status(404).json({ message: "Plan not found" });
    await storage.deleteNutritionPlan(id);
    res.sendStatus(204);
  });

  app.post("/api/nutrition-plans/:id/duplicate", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const me = req.user as User;
    const dup = await storage.duplicateNutritionPlan(id, me.id);
    if (!dup) return res.status(404).json({ message: "Plan not found" });
    res.status(201).json(dup);
  });

  // ============== SUPPLEMENTS (Phase 3) ==============
  // Library — admin-curated catalogue. Supplements assigned to clients
  // are SNAPSHOTS, so deleting/editing a library row is always safe.
  app.get("/api/supplements", requireAdmin, async (req, res) => {
    const activeOnly = req.query.activeOnly === "true";
    const category = typeof req.query.category === "string" ? req.query.category : undefined;
    const list = await storage.listSupplements({ activeOnly, category });
    res.json(list);
  });
  app.get("/api/supplements/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const row = await storage.getSupplement(id);
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });
  app.post("/api/supplements", requireAdmin, async (req, res) => {
    const parsed = insertSupplementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const me = req.user as User;
    const row = await storage.createSupplement(parsed.data, me.id);
    res.status(201).json(row);
  });
  app.patch("/api/supplements/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = updateSupplementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const row = await storage.updateSupplement(id, parsed.data);
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });
  app.delete("/api/supplements/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const ok = await storage.deleteSupplement(id);
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // Stacks — reusable templates of supplements with snapshotted items.
  app.get("/api/supplement-stacks", requireAdmin, async (req, res) => {
    const activeOnly = req.query.activeOnly === "true";
    const list = await storage.listSupplementStacks({ activeOnly });
    res.json(list);
  });
  app.get("/api/supplement-stacks/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const row = await storage.getSupplementStack(id);
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });
  app.post("/api/supplement-stacks", requireAdmin, async (req, res) => {
    const parsed = insertSupplementStackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const me = req.user as User;
    const row = await storage.createSupplementStack(parsed.data, me.id);
    res.status(201).json(row);
  });
  app.patch("/api/supplement-stacks/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = updateSupplementStackSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const row = await storage.updateSupplementStack(id, parsed.data);
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });
  app.delete("/api/supplement-stacks/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const ok = await storage.deleteSupplementStack(id);
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // Per-client assignments. Clients can only ever read their OWN list
  // via /me. Admin can read by ?userId= and write to any user.
  app.get("/api/client-supplements/me", requireAuth, async (req, res) => {
    const me = req.user as User;
    const list = await storage.listClientSupplements(me.id, { activeOnly: true });
    // Strip warnings? No — clients NEED to see warnings. They are the audience.
    res.json(list);
  });
  app.get("/api/client-supplements", requireAdmin, async (req, res) => {
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    if (!userId || !Number.isFinite(userId)) return res.status(400).json({ message: "userId required" });
    const list = await storage.listClientSupplements(userId);
    res.json(list);
  });
  app.post("/api/client-supplements", requireAdmin, async (req, res) => {
    const parsed = insertClientSupplementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const me = req.user as User;
    const row = await storage.createClientSupplement(parsed.data, me.id);
    res.status(201).json(row);
  });
  app.patch("/api/client-supplements/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = updateClientSupplementSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const row = await storage.updateClientSupplement(id, parsed.data);
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });
  app.delete("/api/client-supplements/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const ok = await storage.deleteClientSupplement(id);
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });
  app.post("/api/client-supplements/apply-stack", requireAdmin, async (req, res) => {
    const parsed = applyStackToClientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const me = req.user as User;
    try {
      const rows = await storage.applyStackToClient(parsed.data, me.id);
      res.status(201).json(rows);
    } catch (err: any) {
      res.status(400).json({ message: err?.message || "Failed to apply stack" });
    }
  });

  // ============== BODY METRICS (P4a) ==============
  // Self-scoped: clients use /me. Admin uses /api/body-metrics?userId= to
  // read any client and to mutate. Non-admin POST/PATCH/DELETE attempts
  // are blocked at the requireAdmin layer; clients log via the public
  // self-create flow below if/when we choose to enable it. For Phase 4a
  // logging is admin-only (mirrors the InBody flow).
  app.get("/api/body-metrics/me", requireAuth, async (req, res) => {
    const me = req.user as User;
    const list = await storage.listBodyMetrics(me.id);
    res.json(list);
  });
  app.get("/api/body-metrics", requireAuth, async (req, res) => {
    const me = req.user as User;
    const userIdQuery = req.query.userId ? Number(req.query.userId) : undefined;
    // Non-admin callers always read their OWN row set. Admin must pass
    // ?userId= to scope to a client.
    const userId = me.role === "admin" ? userIdQuery : me.id;
    if (!userId || !Number.isFinite(userId)) {
      return res.status(400).json({ message: "userId required" });
    }
    const list = await storage.listBodyMetrics(userId);
    res.json(list);
  });
  app.post("/api/body-metrics", requireAdmin, async (req, res) => {
    const parsed = insertBodyMetricSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const me = req.user as User;
    const row = await storage.createBodyMetric(parsed.data, me.id);
    res.status(201).json(row);
  });
  app.patch("/api/body-metrics/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = updateBodyMetricSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const row = await storage.updateBodyMetric(id, parsed.data);
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json(row);
  });
  app.delete("/api/body-metrics/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const ok = await storage.deleteBodyMetric(id);
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // ============== WEEKLY CHECK-INS (P4b) ==============
  // Clients submit + edit their own. Admin reads any, responds with
  // `coachResponse`, and can mutate/delete. The owner can edit fields
  // EXCEPT `coachResponse` (silently stripped on non-admin PATCH).
  app.get("/api/weekly-checkins/me", requireAuth, async (req, res) => {
    const me = req.user as User;
    const list = await storage.listWeeklyCheckins(me.id);
    res.json(list);
  });
  app.get("/api/weekly-checkins/pending", requireAdmin, async (_req, res) => {
    const list = await storage.listPendingWeeklyCheckins();
    res.json(list);
  });
  app.get("/api/weekly-checkins", requireAuth, async (req, res) => {
    const me = req.user as User;
    const userIdQuery = req.query.userId ? Number(req.query.userId) : undefined;
    const userId = me.role === "admin" ? userIdQuery : me.id;
    if (!userId || !Number.isFinite(userId)) {
      return res.status(400).json({ message: "userId required" });
    }
    const list = await storage.listWeeklyCheckins(userId);
    res.json(list);
  });
  app.post("/api/weekly-checkins", requireAuth, async (req, res) => {
    const me = req.user as User;
    // Non-admins can ONLY create rows for themselves; userId in payload
    // is forced to me.id. Admin may target any client.
    const body = me.role === "admin"
      ? req.body
      : { ...req.body, userId: me.id };
    const parsed = insertWeeklyCheckinSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    // Enforce one row per (user, week): if a row exists, return 409 so
    // the client can fall back to PATCH.
    const existing = await storage.getWeeklyCheckinByWeek(parsed.data.userId, parsed.data.weekStart);
    if (existing) {
      return res.status(409).json({ message: "Check-in already exists for this week", id: existing.id });
    }
    try {
      const row = await storage.createWeeklyCheckin(parsed.data);
      res.status(201).json(row);
    } catch (err: any) {
      // Race-safe fallback: the unique index on (user_id, week_start)
      // catches concurrent creates that slipped past the pre-check.
      if (err?.code === "23505") {
        const dup = await storage.getWeeklyCheckinByWeek(parsed.data.userId, parsed.data.weekStart);
        return res.status(409).json({ message: "Check-in already exists for this week", id: dup?.id });
      }
      throw err;
    }
  });
  app.patch("/api/weekly-checkins/:id", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const existing = await storage.getWeeklyCheckin(id);
    if (!existing) return res.status(404).json({ message: "Not found" });
    if (me.role !== "admin" && existing.userId !== me.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    // Strip admin-only fields from non-admin patches.
    const body = me.role === "admin" ? req.body : { ...req.body, coachResponse: undefined };
    const parsed = updateWeeklyCheckinSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const row = await storage.updateWeeklyCheckin(id, parsed.data, me.role === "admin" ? me.id : null);
    res.json(row);
  });
  app.delete("/api/weekly-checkins/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const ok = await storage.deleteWeeklyCheckin(id);
    if (!ok) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  // ============== INBODY ==============
  app.get("/api/inbody", requireAuth, async (req, res) => {
    const me = req.user as User;
    const userIdQuery = req.query.userId ? Number(req.query.userId) : undefined;
    const filters: { userId?: number } = {};
    if (me.role !== "admin") filters.userId = me.id;
    else if (userIdQuery) filters.userId = userIdQuery;
    const list = await storage.getInbodyRecords(filters);
    res.json(list);
  });

  app.get("/api/inbody/:id", requireAuth, async (req, res) => {
    const me = req.user as User;
    const r = await storage.getInbodyRecord(Number(req.params.id));
    if (!r) return res.status(404).json({ message: "Not found" });
    if (me.role !== "admin" && r.userId !== me.id)
      return res.status(403).json({ message: "Forbidden" });
    res.json(r);
  });

  app.post(
    "/api/inbody/upload",
    requireAuth,
    safeSingle(inbodyUploader, "file"),
    async (req, res) => {
      const me = req.user as User;
      if (!req.file) return res.status(400).json({ message: "File is required" });

      const targetUserId =
        me.role === "admin" && req.body.userId ? Number(req.body.userId) : me.id;
      const originalFullPath = path.join(UPLOAD_ROOT, "inbody", req.file.filename);

      // AI extraction first (uses original quality). Best-effort — if it
      // throws or the API key is missing, registration must still succeed.
      let extracted: Awaited<ReturnType<typeof extractInbodyMetricsFromImage>> = null;
      if (req.file.mimetype.startsWith("image/")) {
        try {
          extracted = await extractInbodyMetricsFromImage(
            originalFullPath,
            req.file.mimetype,
          );
        } catch (e) {
          console.warn("[inbody] AI extraction threw, continuing without it:", e);
        }
      }

      // Image optimization is best-effort; never blocks the upload
      let opt: Awaited<ReturnType<typeof optimizeImageFile>> = { optimized: false };
      try {
        opt = await optimizeImageFile(originalFullPath, req.file.mimetype, {
          maxWidth: 1800,
          quality: 86,
        });
      } catch (e) {
        console.warn("[inbody] image optimization failed, keeping original:", e);
      }
      const finalFilename = opt.optimized && opt.optimizedFilename
        ? opt.optimizedFilename
        : req.file.filename;
      const fileUrl = `/uploads/inbody/${finalFilename}`;
      const finalMime = opt.optimized ? "image/webp" : req.file.mimetype;

      const record = await storage.createInbodyRecord({
        userId: targetUserId,
        fileUrl,
        fileName: req.file.originalname,
        mimeType: finalMime,
        weight: extracted?.weight ?? null,
        bodyFat: extracted?.bodyFat ?? null,
        muscleMass: extracted?.muscleMass ?? null,
        bmi: extracted?.bmi ?? null,
        visceralFat: extracted?.visceralFat ?? null,
        bmr: extracted?.bmr ?? null,
        water: extracted?.water ?? null,
        score: extracted?.score ?? null,
        aiExtracted: !!extracted,
        notes: req.body.notes || null,
      });

      // Log upload consent (best-effort)
      try {
        await storage.createConsentRecord({
          userId: targetUserId,
          consentType: "inbody",
          policyVersion: "v1",
          acceptedItems: ["inbody_upload_consent"],
          ipAddress: (req.ip || req.socket.remoteAddress || null) as string | null,
          userAgent: (req.get("user-agent") || null) as string | null,
        });
      } catch (e) {
        console.warn("[inbody] consent log failed:", e);
      }

      res.status(201).json({
        record,
        aiExtracted: !!extracted,
        message: extracted
          ? "Your InBody scan was analyzed automatically. Youssef will review and confirm."
          : "We received your InBody scan. Youssef will review and update your analysis.",
      });
    },
  );

  app.post("/api/inbody", requireAdmin, async (req, res) => {
    const parsed = insertInbodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid record" });
    }
    const created = await storage.createInbodyRecord(parsed.data);
    // Best-effort trainer notification — never blocks the response.
    void (async () => {
      try {
        const owner = await storage.getUser(created.userId).catch(() => undefined);
        if (!owner) return;
        const built = buildAdminInbodyEmail({
          clientName: owner.fullName || owner.username || `Client #${created.userId}`,
          recordedDate: created.recordedAt ? new Date(created.recordedAt).toISOString().slice(0, 10) : null,
        });
        await sendEmail({ to: trainerEmail(), subject: built.subject, text: built.text, html: built.html });
      } catch (e) {
        console.warn("[notif] inbody admin email failed:", e);
      }
    })();
    res.status(201).json(created);
  });

  app.patch("/api/inbody/:id", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    const existing = await storage.getInbodyRecord(id);
    if (!existing) return res.status(404).json({ message: "Record not found" });
    if (me.role !== "admin" && existing.userId !== me.id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const parsed = updateInbodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid update" });
    }
    // Clients can only edit their own metric values + notes — never the file
    // path, ownership, or AI-extraction flag.
    const data: Record<string, unknown> = { ...parsed.data };
    if (me.role !== "admin") {
      delete (data as any).userId;
      delete (data as any).fileUrl;
      delete (data as any).aiExtracted;
      delete (data as any).recordedAt;
    }
    const updated = await storage.updateInbodyRecord(id, data as any);
    res.json(updated);
  });

  app.delete("/api/inbody/:id", requireAdmin, async (req, res) => {
    await storage.deleteInbodyRecord(Number(req.params.id));
    res.sendStatus(204);
  });

  // ============== EMAIL CRON (24h + 1h booking reminders) ==============
  // Vercel cron hits this every 15 minutes (see vercel.json crons). Scans
  // upcoming bookings whose start time is ~24h or ~1h away and sends one
  // reminder email each, deduped via reminder_24h_sent_at / reminder_1h_sent_at.
  //
  // Auth: in production we require Authorization: Bearer <CRON_SECRET>; in dev
  // we accept unauthenticated calls so it's easy to trigger manually.
  app.all("/api/cron/reminders", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === "production" && secret) {
      const auth = req.get("authorization") || "";
      if (auth !== `Bearer ${secret}`) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
    }

    const sent: Array<{ id: number; kind: "24h" | "1h"; error?: string }> = [];
    const failed: Array<{ id: number; kind: "24h" | "1h"; error: string }> = [];
    try {
      const todayIso = new Date().toISOString().slice(0, 10);
      const tomorrowIso = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
      const all = await storage.getBookings({});
      const now = Date.now();

      for (const b of all) {
        if (b.date !== todayIso && b.date !== tomorrowIso) continue;
        if (!["upcoming", "confirmed"].includes(b.status)) continue;
        const sessionAt = buildSessionDate(b.date, b.timeSlot).getTime();
        const minsUntil = Math.round((sessionAt - now) / 60_000);

        // 24h window: 22h–26h ahead
        const want24 = minsUntil >= 22 * 60 && minsUntil <= 26 * 60;
        // 1h window: 30min–90min ahead
        const want1 = minsUntil >= 30 && minsUntil <= 90;
        const bAny = b as any;

        // Generalized dispatch: fans out to either the primary booking
        // owner or the linked Duo partner. Each recipient has its own
        // dedupe column (reminder_*_sent_at vs partner_reminder_*_sent_at)
        // so the partner gets exactly one 24h / 1h email, independent of
        // whether the primary's reminder has already fired.
        const dispatch = async (
          kind: "24h" | "1h",
          recipient: "owner" | "partner",
        ) => {
          try {
            const userId = recipient === "owner" ? b.userId : (b as any).linkedPartnerUserId;
            if (!userId) return;
            const col =
              recipient === "owner"
                ? kind === "24h"
                  ? "reminder_24h_sent_at"
                  : "reminder_1h_sent_at"
                : kind === "24h"
                  ? "linked_partner_reminder_24h_sent_at"
                  : "linked_partner_reminder_1h_sent_at";
            const claim = await pool.query(
              `UPDATE bookings SET ${col} = now() WHERE id = $1 AND ${col} IS NULL RETURNING id`,
              [b.id],
            );
            if (claim.rowCount === 0) return; // already claimed by another worker

            const recipientUser = await storage.getUser(userId).catch(() => undefined);
            if (!recipientUser) return;
            const recipientLang = (recipientUser as any).preferredLanguage || "en";
            const built = buildSessionReminderEmail({
              kind,
              lang: recipientLang,
              data: {
                clientName: recipientUser.fullName || recipientUser.username || "Client",
                date: b.date,
                time12: formatTime12Server(b.timeSlot),
                sessionFocusLabel: b.sessionFocus || null,
                trainingGoalLabel: b.trainingGoal || null,
              },
            });
            // Mirror the reminder in-app FIRST — independent of the email
            // channel. Recipient-scoped dedupe key so primary + partner
            // each get their own in-app notification.
            void notifyUserOnce(
              userId,
              "session_reminder",
              `reminder-${b.id}-${kind}-${recipient}`,
              kind === "24h" ? "Session tomorrow" : "Session in 1 hour",
              `${b.date} at ${formatTime12Server(b.timeSlot)}`,
              { link: "/dashboard", meta: { bookingId: b.id, kind, recipient } },
            );

            if (!recipientUser.email) return;
            const result = await sendEmail({
              to: recipientUser.email,
              subject: built.subject,
              text: built.text,
              html: built.html,
              replyTo: trainerEmail(),
            });
            (result.sent ? sent : failed).push(
              result.sent
                ? { id: b.id, kind }
                : { id: b.id, kind, error: result.error || "send returned false" },
            );
          } catch (e: any) {
            failed.push({ id: b.id, kind, error: e?.message || "unknown" });
          }
        };

        if (want24 && !bAny.reminder24hSentAt) await dispatch("24h", "owner");
        if (want1 && !bAny.reminder1hSentAt) await dispatch("1h", "owner");
        // Task #3: Fan out to the linked Duo partner (if any). Partner-
        // scoped dedupe means the primary's claim above doesn't block
        // the partner's email and vice-versa.
        if (bAny.linkedPartnerUserId) {
          if (want24 && !bAny.linkedPartnerReminder24hSentAt) await dispatch("24h", "partner");
          if (want1 && !bAny.linkedPartnerReminder1hSentAt) await dispatch("1h", "partner");
        }
      }

      // P5b: Package-expiry warnings. For every active package whose
      // expiry falls within 7d / 3d / 1d of today, fire one in-app
      // notification per (package, window). dedupeKey ensures the same
      // window never re-fires across cron invocations.
      // Missed-weekly-check-in: from Tuesday onward, any active client
      // who hasn't logged a check-in for the current Mon-anchored week
      // gets a single nudge.
      try {
        await runPackageExpiryNotifications();
      } catch (e) {
        console.warn("[cron/reminders] expiry pass failed:", e);
      }
      try {
        await runMissedCheckinNotifications();
      } catch (e) {
        console.warn("[cron/reminders] checkin pass failed:", e);
      }
      // May 2026 booking-safety: auto-complete expired sessions in the
      // same cron tick so a single external scheduler covers reminders +
      // expiry + auto-completion. Best-effort — never poisons the
      // reminder response.
      let autoCompleteSummary: any = null;
      try {
        autoCompleteSummary = await runAutoCompleteBookings("cron");
      } catch (e) {
        console.warn("[cron/reminders] auto-complete pass failed:", e);
      }

      res.json({ ok: true, scanned: all.length, sent, failed, autoComplete: autoCompleteSummary });
    } catch (e: any) {
      console.error("[cron/reminders] failed", e);
      res.status(500).json({ ok: false, error: e?.message || "unknown", sent, failed });
    }
  });

  // Admin-callable manual repair (May 2026 production fix). Lets the
  // admin force-run an auto-complete sweep from the dashboard without
  // needing to know CRON_SECRET. Authenticated via session (requireAdmin),
  // not the cron bearer-token pattern. Returns the same summary so the
  // UI can show "X sessions completed, Y package credits deducted".
  app.post("/api/admin/bookings/auto-complete-now", requireAdmin, async (_req, res) => {
    try {
      const summary = await runAutoCompleteBookings("admin-manual");
      res.json({ ok: true, ...summary });
    } catch (e: any) {
      console.error("[auto-complete:admin-manual] failed", e);
      res.status(500).json({ ok: false, error: e?.message || "unknown" });
    }
  });

  // Tiny status endpoint for the admin dashboard's "Repair expired sessions"
  // panel. Returns the last in-memory pass summary + source so the UI can
  // show "Last run: 4m ago via GitHub Actions cron · 3 completed". Reads
  // are cheap (in-memory) — safe to poll.
  app.get("/api/admin/auto-complete-status", requireAdmin, async (_req, res) => {
    const lastRun = getLastAutoCompleteRun();
    // Server time vs Dubai time — single source of truth for the admin
    // diagnostics panel so a misconfigured TZ on a Vercel region is
    // immediately visible. Dubai is UTC+4, no DST.
    const now = new Date();
    const dubaiNow = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Dubai",
      dateStyle: "short",
      timeStyle: "medium",
    }).format(now);
    // Pending count: bookings whose end-time has passed but are still
    // upcoming/confirmed. This is what the next auto-complete pass will
    // pick up. Bounded scan via existing storage helper — fine for the
    // current dataset size; if/when bookings cross 100k we'd push this
    // into a SQL view with the same end-time math.
    let pendingExpired = 0;
    try {
      const all = await storage.getBookings({});
      const cutoff = Date.now();
      for (const b of all) {
        if (!["upcoming", "confirmed"].includes(b.status)) continue;
        if ((b as any).completedAt) continue;
        const dur = (b as any).durationMinutes ?? 60;
        const endMs = new Date(`${b.date}T${b.timeSlot}:00+04:00`).getTime() + dur * 60_000;
        if (endMs <= cutoff) pendingExpired++;
      }
    } catch (e: any) {
      console.warn("[diagnostics] pendingExpired query failed:", e?.message || e);
    }
    // Cron-stale heuristic tracks the *cron* source specifically (not
    // backstop or admin-manual triggers — those would mask a broken
    // scheduler). GH Actions runs every 15 min so >30 min without a
    // cron-source run is suspicious. `null` means we've never seen
    // one since this instance booted (cold-start, not necessarily
    // broken — but worth surfacing).
    const lastCronAt = getLastCronRunAt();
    const cronStale = lastCronAt === null ? null : Date.now() - lastCronAt > 30 * 60_000;
    res.json({
      lastRun,
      lastCronRunAt: lastCronAt,
      pendingExpired,
      serverNow: now.toISOString(),
      dubaiNow,
      cronStale,
      env: {
        cronSecretSet: !!process.env.CRON_SECRET,
        publicAppUrlSet: !!process.env.PUBLIC_APP_URL,
        nodeEnv: process.env.NODE_ENV ?? null,
      },
    });
  });

  // Standalone auto-complete trigger. Same auth pattern as /api/cron/reminders
  // (Bearer CRON_SECRET in production, open in dev). Useful when an admin
  // wants to force a sweep without waiting for the next reminder tick, and
  // gives the test/QA flow a dedicated URL.
  app.all("/api/cron/auto-complete", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    if (process.env.NODE_ENV === "production" && secret) {
      const auth = req.get("authorization") || "";
      if (auth !== `Bearer ${secret}`) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
    }
    try {
      const summary = await runAutoCompleteBookings("cron");
      res.json({ ok: true, ...summary });
    } catch (e: any) {
      console.error("[cron/auto-complete] failed", e);
      res.status(500).json({ ok: false, error: e?.message || "unknown" });
    }
  });

  // ============== PROGRESS PHOTOS ==============
  app.get("/api/progress", requireAuth, async (req, res) => {
    const me = req.user as User;
    const userIdQuery = req.query.userId ? Number(req.query.userId) : undefined;
    const filters: { userId?: number } = {};
    if (me.role !== "admin") filters.userId = me.id;
    else if (userIdQuery) filters.userId = userIdQuery;
    const list = await storage.getProgressPhotos(filters);
    res.json(list);
  });

  app.post(
    "/api/progress/upload",
    requireAuth,
    safeSingle(photoUploader, "file"),
    async (req, res) => {
      const me = req.user as User;
      if (!req.file) return res.status(400).json({ message: "File is required" });
      const targetUserId =
        me.role === "admin" && req.body.userId ? Number(req.body.userId) : me.id;

      const originalFullPath = path.join(UPLOAD_ROOT, "photos", req.file.filename);
      let opt: Awaited<ReturnType<typeof optimizeImageFile>> = { optimized: false };
      try {
        opt = await optimizeImageFile(originalFullPath, req.file.mimetype, {
          maxWidth: 1600,
          quality: 82,
        });
      } catch (e) {
        console.warn("[progress] image optimization failed, keeping original:", e);
      }
      const finalFilename = opt.optimized && opt.optimizedFilename
        ? opt.optimizedFilename
        : req.file.filename;
      const photoUrl = `/uploads/photos/${finalFilename}`;

      const type =
        ["before", "current", "after"].includes(req.body.type) ? req.body.type : "current";
      const viewAngle =
        ["front", "side", "back"].includes(req.body.viewAngle) ? req.body.viewAngle : "front";
      const created = await storage.createProgressPhoto({
        userId: targetUserId,
        photoUrl,
        type,
        viewAngle,
        notes: req.body.notes || null,
      });

      try {
        await storage.createConsentRecord({
          userId: targetUserId,
          consentType: "progress",
          policyVersion: "v1",
          acceptedItems: ["progress_upload_consent"],
          ipAddress: (req.ip || req.socket.remoteAddress || null) as string | null,
          userAgent: (req.get("user-agent") || null) as string | null,
        });
      } catch (e) {
        console.warn("[progress] consent log failed:", e);
      }

      res.status(201).json(created);
    },
  );

  app.post("/api/progress", requireAdmin, async (req, res) => {
    const parsed = insertProgressPhotoSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid record" });
    }
    const created = await storage.createProgressPhoto(parsed.data);
    res.status(201).json(created);
  });

  app.delete("/api/progress/:id", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    if (me.role !== "admin") {
      // allow client to delete their own
      const list = await storage.getProgressPhotos({ userId: me.id });
      const found = list.find((p) => p.id === id);
      if (!found) return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteProgressPhoto(id);
    res.sendStatus(204);
  });

  // ============== CONSENT RECORDS ==============
  app.get("/api/consent", requireAuth, async (req, res) => {
    const me = req.user as User;
    const userIdQuery = req.query.userId ? Number(req.query.userId) : undefined;
    const consentType = (req.query.consentType as string) || undefined;
    const filters: { userId?: number; consentType?: string } = {};
    if (me.role !== "admin") filters.userId = me.id;
    else if (userIdQuery) filters.userId = userIdQuery;
    if (consentType) filters.consentType = consentType;
    const list = await storage.getConsentRecords(filters);
    res.json(list);
  });

  app.post("/api/consent", requireAuth, async (req, res) => {
    const me = req.user as User;
    const schema = z.object({
      consentType: z.enum(["registration", "booking", "inbody", "progress"]),
      acceptedItems: z.array(z.string()).min(1),
      policyVersion: z.string().optional(),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid consent" });
    }
    const created = await storage.createConsentRecord({
      userId: me.id,
      consentType: parsed.data.consentType,
      policyVersion: parsed.data.policyVersion ?? "v1",
      acceptedItems: parsed.data.acceptedItems,
      ipAddress: (req.ip || req.socket.remoteAddress || null) as string | null,
      userAgent: (req.get("user-agent") || null) as string | null,
    });
    res.status(201).json(created);
  });

  // ============== DASHBOARD ==============
  app.get("/api/dashboard/stats", requireAdmin, async (_req, res) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    const [clients, allBookings, allPackages, pendingRenewalsList, pendingExtensionsList] =
      await Promise.all([
        storage.getAllClients(),
        storage.getBookings(),
        storage.getPackages({ activeOnly: true }),
        storage.getRenewalRequests({ status: "pending", limit: 500 }).catch(() => []),
        storage.getExtensionRequests({ status: "pending", limit: 500 }).catch(() => []),
      ]);

    const upcomingBookings = allBookings.filter(
      (b) => ["upcoming", "confirmed"].includes(b.status) && b.date >= todayStr,
    ).length;
    const bookingsToday = allBookings.filter((b) => b.date === todayStr).length;
    const completedThisMonth = allBookings.filter(
      (b) => b.status === "completed" && b.date >= monthStartStr,
    ).length;

    // Lifecycle buckets — auto-computed from current state.
    let expiringPackages = 0;
    let expiredPackages = 0;
    const lowSessionUserIds = new Set<number>();
    for (const p of allPackages) {
      const s = computePackageStatus(p as any);
      if (s === "expiring_soon") expiringPackages++;
      if (s === "expired") expiredPackages++;
      const remaining = (p.totalSessions ?? 0) - (p.usedSessions ?? 0);
      // Low-session = 3 or fewer sessions remaining and still active
      if (s === "active" && remaining > 0 && remaining <= 3) {
        lowSessionUserIds.add(p.userId);
      }
    }

    res.json({
      totalClients: clients.length,
      upcomingBookings,
      bookingsToday,
      completedThisMonth,
      activePackages: allPackages.filter((p: Package) => p.usedSessions < p.totalSessions).length,
      expiringPackages,
      expiredPackages,
      pendingRenewals: pendingRenewalsList.length,
      pendingExtensions: pendingExtensionsList.length,
      lowSessionClients: lowSessionUserIds.size,
    });
  });

  // ============================================================
  // P5c — Premium Analytics
  // ============================================================
  // One endpoint, one round-trip. Computes snapshot KPIs + 12-month
  // trend buckets server-side so the AnalyticsTab renders instantly.
  // All computation is in-memory over already-fetched lists; no extra
  // SQL beyond what /api/dashboard/stats already does. Admin-gated.
  app.get("/api/admin/analytics", requireAdmin, async (_req, res) => {
    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const ms = (days: number) => days * 86_400_000;
    const isoMonth = (d: Date) => d.toISOString().slice(0, 7); // YYYY-MM

    const [clients, allBookings, allPackagesActive, allPackagesAll, renewals30] =
      await Promise.all([
        storage.getAllClients(),
        storage.getBookings(),
        storage.getPackages({ activeOnly: true }),
        storage.getPackages(),
        storage.getRenewalRequests({ limit: 5000 }).catch(() => []),
      ]);

    // ----- CLIENTS -----
    const clientsTotal = clients.length;
    const clientsActive = clients.filter((c) => (c as any).clientStatus === "active").length;
    const clientsFrozen = clients.filter((c) => (c as any).clientStatus === "frozen").length;
    const clientsNew30 = clients.filter((c) => {
      const ca = c.createdAt ? new Date(c.createdAt).getTime() : 0;
      return ca >= now.getTime() - ms(30);
    }).length;

    // ----- SESSIONS -----
    const cutoff30 = new Date(now.getTime() - ms(30));
    const cutoff90 = new Date(now.getTime() - ms(90));
    const next7 = new Date(now.getTime() + ms(7));
    let completed30 = 0, completed90 = 0, upcomingNext7 = 0;
    // Attendance math (30d window): only bookings whose date has passed
    // count as "scheduled" — future sessions are still in flight.
    let scheduled30 = 0, completed30Past = 0, noShow30 = 0;
    for (const b of allBookings) {
      const dStr = String(b.date);
      const d = new Date(`${dStr}T00:00:00Z`);
      const t = d.getTime();
      if (b.status === "completed") {
        if (t >= cutoff30.getTime()) completed30++;
        if (t >= cutoff90.getTime()) completed90++;
      }
      if (["upcoming", "confirmed"].includes(b.status) && dStr >= todayStr && t <= next7.getTime()) {
        upcomingNext7++;
      }
      if (t >= cutoff30.getTime() && t < now.getTime()) {
        if (["completed", "no_show", "late_cancelled"].includes(b.status)) {
          scheduled30++;
          if (b.status === "completed") completed30Past++;
          if (b.status === "no_show") noShow30++;
        }
      }
    }
    const attendanceRate30 = scheduled30 ? completed30Past / scheduled30 : 0;
    const noShowRate30 = scheduled30 ? noShow30 / scheduled30 : 0;

    // ----- PACKAGES -----
    let pkgActive = 0, pkgExpiring = 0, pkgExpired = 0, pkgFrozen = 0;
    for (const p of allPackagesActive) {
      if ((p as any).frozen) pkgFrozen++;
      const s = computePackageStatus(p as any);
      if (s === "active") pkgActive++;
      if (s === "expiring_soon") pkgExpiring++;
      if (s === "expired") pkgExpired++;
    }
    const renewals30d = renewals30.filter((r: any) => {
      const t = r.createdAt ? new Date(r.createdAt).getTime() : 0;
      return t >= now.getTime() - ms(30);
    }).length;

    // ----- REVENUE -----
    let revenueTotal = 0, revenuePaid30 = 0, revenueOutstanding = 0;
    for (const p of allPackagesAll as any[]) {
      const price = Number(p.totalPrice ?? 0);
      revenueTotal += price;
      const paidAt = p.paymentApprovedAt ? new Date(p.paymentApprovedAt).getTime() : 0;
      if (p.paymentStatus === "paid" && paidAt >= now.getTime() - ms(30)) {
        revenuePaid30 += price;
      }
      if (p.paymentStatus !== "paid" && p.paymentStatus !== "free") {
        revenueOutstanding += price;
      }
    }

    // ----- RETENTION / CHURN -----
    const pkgsByUser = new Map<number, number>();
    for (const p of allPackagesAll) {
      pkgsByUser.set(p.userId, (pkgsByUser.get(p.userId) ?? 0) + 1);
    }
    const multiPackageClients = Array.from(pkgsByUser.values()).filter((n) => n >= 2).length;

    const lastBookingByUser = new Map<number, number>();
    for (const b of allBookings) {
      const t = new Date(`${String(b.date)}T00:00:00Z`).getTime();
      const cur = lastBookingByUser.get(b.userId) ?? 0;
      if (t > cur) lastBookingByUser.set(b.userId, t);
    }
    const churn = (days: number) =>
      clients.filter((c) => {
        if ((c as any).clientStatus !== "active") return false;
        const last = lastBookingByUser.get(c.id) ?? 0;
        return last < now.getTime() - ms(days);
      }).length;

    // ----- ADHERENCE -----
    // Pull weekly check-ins for active clients in last 30d. We do this
    // sequentially-bounded with Promise.all to keep the round-trip count
    // low without exhausting the connection pool.
    const activeClientIds = clients
      .filter((c) => (c as any).clientStatus === "active")
      .map((c) => c.id);
    let recentCheckinCount = 0;
    if (activeClientIds.length > 0) {
      const cutoffStr = new Date(now.getTime() - ms(30)).toISOString().slice(0, 10);
      // Single bulk count — avoids N+1 across active clients.
      try {
        const r = await pool.query(
          `SELECT COUNT(*)::int AS n FROM weekly_checkins
           WHERE user_id = ANY($1::int[]) AND week_start >= $2::date`,
          [activeClientIds, cutoffStr],
        );
        recentCheckinCount = Number(r.rows?.[0]?.n ?? 0);
      } catch {
        recentCheckinCount = 0;
      }
    }
    // Expected = active clients * 4.3 weeks (≈30d). Cap at 1.
    const expectedCheckins = activeClientIds.length * 4.3;
    const checkinRate30 = expectedCheckins > 0
      ? Math.min(1, recentCheckinCount / expectedCheckins)
      : 0;

    // ----- TRENDS (last 12 months, oldest first) -----
    const monthsBack: string[] = [];
    {
      const cur = new Date(now.getFullYear(), now.getMonth(), 1);
      for (let i = 11; i >= 0; i--) {
        const d = new Date(cur.getFullYear(), cur.getMonth() - i, 1);
        monthsBack.push(isoMonth(d));
      }
    }
    const revenueByMonth = monthsBack.map((m) => ({ month: m, paid: 0, total: 0 }));
    const completedByMonth = monthsBack.map((m) => ({ month: m, count: 0 }));
    const signupsByMonth = monthsBack.map((m) => ({ month: m, count: 0 }));
    const bookingsByDow = Array.from({ length: 7 }, (_, dow) => ({ dow, count: 0 }));

    const monthIdx = new Map(monthsBack.map((m, i) => [m, i]));
    for (const p of allPackagesAll as any[]) {
      const m = isoMonth(new Date(p.purchasedAt ?? p.adminApprovedAt ?? Date.now()));
      const idx = monthIdx.get(m);
      if (idx !== undefined) {
        const price = Number(p.totalPrice ?? 0);
        revenueByMonth[idx].total += price;
        if (p.paymentStatus === "paid") revenueByMonth[idx].paid += price;
      }
    }
    // Completed-only month buckets, but DOW counts ALL bookings that
    // actually consumed a slot (any non-cancelled status) so demand
    // shape is faithful, not skewed by attendance.
    const NON_CANCELLED = new Set([
      "upcoming",
      "confirmed",
      "completed",
      "no_show",
      "late_cancelled",
    ]);
    for (const b of allBookings) {
      const d = new Date(`${String(b.date)}T00:00:00Z`);
      if (b.status === "completed") {
        const idx = monthIdx.get(isoMonth(d));
        if (idx !== undefined) completedByMonth[idx].count++;
      }
      if (NON_CANCELLED.has(b.status)) {
        bookingsByDow[d.getUTCDay()].count++;
      }
    }
    for (const c of clients) {
      if (!c.createdAt) continue;
      const idx = monthIdx.get(isoMonth(new Date(c.createdAt)));
      if (idx !== undefined) signupsByMonth[idx].count++;
    }

    const payload: AdminAnalytics = {
      generatedAt: now.toISOString(),
      clients: { total: clientsTotal, active: clientsActive, frozen: clientsFrozen, new30d: clientsNew30 },
      sessions: {
        completed30d: completed30,
        completed90d: completed90,
        upcomingNext7d: upcomingNext7,
        attendanceRate30d: attendanceRate30,
        noShowRate30d: noShowRate30,
      },
      packages: {
        active: pkgActive,
        expiringSoon: pkgExpiring,
        expired: pkgExpired,
        frozen: pkgFrozen,
        renewals30d,
      },
      revenue: { total: revenueTotal, paid30d: revenuePaid30, outstanding: revenueOutstanding },
      retention: {
        multiPackageClients,
        churn30d: churn(30),
        churn60d: churn(60),
        churn90d: churn(90),
      },
      adherence: { weeklyCheckinRate30d: checkinRate30 },
      trends: { revenueByMonth, completedByMonth, signupsByMonth, bookingsByDow },
    };
    res.json(payload);
  });

  // ============== RENEWAL REQUESTS ==============
  app.get("/api/renewal-requests", requireAuth, async (req, res) => {
    const me = req.user as User;
    const filters: { userId?: number; status?: string } = {};
    if (me.role !== "admin") {
      filters.userId = me.id;
    } else if (req.query.userId) {
      const uid = Number(req.query.userId);
      if (Number.isFinite(uid)) filters.userId = uid;
    }
    if (typeof req.query.status === "string") filters.status = req.query.status;
    const list = await storage.getRenewalRequests(filters);
    res.json(list);
  });

  app.post("/api/renewal-requests", requireAuth, async (req, res) => {
    const me = req.user as User;
    const parsed = insertRenewalRequestSchema
      .extend({ userId: z.number().optional() })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
    }
    if (!PACKAGE_TYPES.includes(parsed.data.requestedPackageType as any)) {
      return res.status(400).json({ message: "Invalid package type" });
    }
    const targetUserId = me.role === "admin" && parsed.data.userId ? parsed.data.userId : me.id;

    // Throttle — only one pending renewal per user at a time.
    const existing = await storage.getRenewalRequests({ userId: targetUserId, status: "pending", limit: 5 });
    if (existing.length > 0 && me.role !== "admin") {
      return res.status(400).json({ message: "You already have a pending renewal request." });
    }

    const created = await storage.createRenewalRequest({
      userId: targetUserId,
      requestedPackageType: parsed.data.requestedPackageType,
      clientNote: parsed.data.clientNote ?? null,
    });

    // Best-effort admin notification
    try {
      const u = await storage.getUser(targetUserId);
      const def = PACKAGE_DEFINITIONS[parsed.data.requestedPackageType];
      await storage.createAdminNotification({
        kind: "system",
        title: `Renewal request — ${u?.fullName || u?.username || `Client #${targetUserId}`}`,
        body: `Requested: ${def?.label || parsed.data.requestedPackageType}${parsed.data.clientNote ? ` • ${parsed.data.clientNote}` : ""}`,
        userId: targetUserId,
        bookingId: null as any,
      });
    } catch (e) {
      console.warn("[renewal] admin notification failed:", e);
    }
    res.status(201).json(created);
  });

  app.post("/api/admin/renewal-requests/:id/decision", requireAdmin, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = renewalDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid decision" });
    }
    const reqRow = await storage.getRenewalRequest(id);
    if (!reqRow) return res.status(404).json({ message: "Renewal request not found" });
    if (reqRow.status !== "pending") {
      return res.status(400).json({ message: "This request has already been decided." });
    }

    if (parsed.data.decision === "approved") {
      const def = PACKAGE_DEFINITIONS[reqRow.requestedPackageType];
      if (!def) return res.status(400).json({ message: "Unknown package type on the request" });
      // Deactivate any existing active packages for this user before assigning the new one
      const existing = await storage.getPackages({ userId: reqRow.userId, activeOnly: true });
      for (const p of existing) {
        try { await storage.updatePackage(p.id, { isActive: false }); } catch {}
      }
      const totalSessions = parsed.data.totalSessions ?? def.sessions;
      await storage.createPackage({
        userId: reqRow.userId,
        type: reqRow.requestedPackageType as any,
        totalSessions,
        usedSessions: 0,
        isActive: true,
        partnerUserId: parsed.data.partnerUserId ?? null,
        startDate: parsed.data.startDate ?? null,
        expiryDate: parsed.data.expiryDate ?? null,
        status: "active",
      } as any);
    }

    const updated = await storage.updateRenewalRequest(id, {
      status: parsed.data.decision,
      adminNote: parsed.data.adminNote ?? null,
      decidedByUserId: me.id,
      decidedAt: new Date(),
    });
    res.json(updated);
  });

  // ============== EXTENSION REQUESTS ==============
  app.get("/api/extension-requests", requireAuth, async (req, res) => {
    const me = req.user as User;
    const filters: { userId?: number; status?: string } = {};
    if (me.role !== "admin") {
      filters.userId = me.id;
    } else if (req.query.userId) {
      const uid = Number(req.query.userId);
      if (Number.isFinite(uid)) filters.userId = uid;
    }
    if (typeof req.query.status === "string") filters.status = req.query.status;
    const list = await storage.getExtensionRequests(filters);
    res.json(list);
  });

  app.post("/api/extension-requests", requireAuth, async (req, res) => {
    const me = req.user as User;
    const parsed = insertExtensionRequestSchema
      .extend({ userId: z.number().optional() })
      .safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
    }
    const targetUserId = me.role === "admin" && parsed.data.userId ? parsed.data.userId : me.id;
    const pkg = await storage.getPackage(parsed.data.packageId);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    if (pkg.userId !== targetUserId && me.role !== "admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const existing = await storage.getExtensionRequests({ userId: targetUserId, status: "pending", limit: 5 });
    if (existing.some((e) => e.packageId === parsed.data.packageId) && me.role !== "admin") {
      return res.status(400).json({ message: "You already have a pending extension request for this package." });
    }

    const created = await storage.createExtensionRequest({
      userId: targetUserId,
      packageId: parsed.data.packageId,
      requestedDays: parsed.data.requestedDays,
      reason: parsed.data.reason ?? null,
    });

    try {
      const u = await storage.getUser(targetUserId);
      await storage.createAdminNotification({
        kind: "system",
        title: `Extension request — ${u?.fullName || u?.username || `Client #${targetUserId}`}`,
        body: `Package #${pkg.id} (${pkg.type}) • +${parsed.data.requestedDays} days${parsed.data.reason ? ` • ${parsed.data.reason}` : ""}`,
        userId: targetUserId,
        bookingId: null as any,
      });
    } catch (e) {
      console.warn("[extension] admin notification failed:", e);
    }
    res.status(201).json(created);
  });

  app.post("/api/admin/extension-requests/:id/decision", requireAdmin, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const parsed = extensionDecisionSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid decision" });
    }
    const reqRow = await storage.getExtensionRequest(id);
    if (!reqRow) return res.status(404).json({ message: "Extension request not found" });
    if (reqRow.status !== "pending") {
      return res.status(400).json({ message: "This request has already been decided." });
    }

    if (parsed.data.decision === "approved") {
      const days = parsed.data.approvedDays ?? reqRow.requestedDays;
      const pkg = await storage.getPackage(reqRow.packageId);
      if (!pkg) return res.status(404).json({ message: "Package not found" });
      const baseDate = pkg.expiryDate ? new Date(pkg.expiryDate as any) : new Date();
      if (!isFinite(baseDate.getTime())) {
        return res.status(400).json({ message: "Package has no valid current expiry to extend." });
      }
      const newExpiry = new Date(baseDate);
      newExpiry.setDate(newExpiry.getDate() + days);
      await storage.updatePackage(pkg.id, {
        expiryDate: newExpiry.toISOString().slice(0, 10) as any,
        isActive: true,
      });
    }

    const updated = await storage.updateExtensionRequest(id, {
      status: parsed.data.decision,
      adminNote: parsed.data.adminNote ?? null,
      decidedByUserId: me.id,
      decidedAt: new Date(),
    });
    res.json(updated);
  });

  // ============== ATTENDANCE TRACKING ==============
  // Admin marks a booking attended | no_show | late_cancel_charged | late_cancel_free.
  // Drives status, package deduction, and noShowCount on the user.
  app.patch("/api/bookings/:id/attendance", requireAdmin, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    const parsed = attendanceUpdateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid attendance" });
    }
    const previousStatus = booking.status;
    const consumingStates = CONSUMING_STATUSES;
    const wasConsuming = (consumingStates as readonly string[]).includes(previousStatus);

    let newStatus: string = previousStatus;
    let consumesSession = false;
    if (parsed.data.attendance === "attended") {
      newStatus = "completed";
      consumesSession = true;
    } else if (parsed.data.attendance === "no_show") {
      newStatus = "no_show";
      consumesSession = true;
    } else if (parsed.data.attendance === "late_cancel_charged") {
      newStatus = "late_cancelled";
      consumesSession = true;
    } else if (parsed.data.attendance === "late_cancel_free") {
      newStatus = "free_cancelled";
      consumesSession = false;
    }

    const updated = await storage.updateBooking(id, {
      status: newStatus as any,
      attendanceMarkedByUserId: me.id,
      attendanceMarkedAt: new Date(),
      attendanceReason: parsed.data.reason ?? null,
    } as any);

    // Package usage reconciliation. Idempotency anchored on
    // bookings.package_session_deducted_at — see PATCH /api/bookings/:id
    // for the same pattern. Belt-and-braces against auto-complete cron
    // racing an admin attendance toggle on the same booking.
    if (booking.packageId) {
      const alreadyDeducted = !!(booking as any).packageSessionDeductedAt;
      try {
        if (!wasConsuming && consumesSession && !alreadyDeducted) {
          await storage.incrementPackageUsage(booking.packageId);
          await pool.query(`UPDATE bookings SET package_session_deducted_at = now() WHERE id = $1`, [booking.id]);
        } else if (wasConsuming && !consumesSession && alreadyDeducted) {
          await storage.decrementPackageUsage(booking.packageId);
          await pool.query(`UPDATE bookings SET package_session_deducted_at = NULL WHERE id = $1`, [booking.id]);
        }
      } catch (e) {
        console.warn("[attendance] package reconciliation failed:", e);
      }
    }

    // No-show counter on the user
    if (parsed.data.attendance === "no_show" && previousStatus !== "no_show") {
      try { await storage.incrementUserNoShow(booking.userId); } catch {}
    }

    // P5b: Milestone notification on the 5th / 10th / 25th / 50th / 100th
    // completed session. Fired only on the transition INTO `completed`
    // so toggling attendance back-and-forth never re-fires (a) because
    // the count only matches at the boundary, and (b) because dedupeKey
    // pins each milestone to its threshold.
    if (newStatus === "completed" && previousStatus !== "completed") {
      try {
        const all = await storage.getBookings({ userId: booking.userId });
        const completedCount = all.filter((b) => b.status === "completed").length;
        const MILESTONES = [5, 10, 25, 50, 100, 200, 365, 500];
        if (MILESTONES.includes(completedCount)) {
          void notifyUserOnce(
            booking.userId,
            "milestone",
            `sessions-completed-${completedCount}`,
            `${completedCount} sessions completed`,
            completedCount === 5
              ? "Five sessions in. Keep showing up — the work is starting to compound."
              : `That's ${completedCount} sessions logged. Real progress, built one rep at a time.`,
            { link: "/dashboard" },
          );
        }
      } catch (e) {
        console.warn("[milestone] check failed:", e);
      }
    }

    res.json(updated);
  });

  // ============== ADMIN: PENDING CLIENT APPROVALS ==============
  // (Declared BEFORE /api/admin/clients/:id so Express matches the literal
  // "pending" path before the :id param.)
  app.get("/api/admin/clients/pending", requireAdmin, async (_req, res) => {
    try {
      const all = await storage.getAllClients();
      const pending = all.filter((u: User) => u.clientStatus === "pending");
      const enriched = await Promise.all(
        pending.map(async (u) => {
          const pkgs = await storage.getPackages({ userId: u.id });
          const newest = pkgs
            .slice()
            .sort((a, b) => {
              const at = a.purchasedAt ? new Date(a.purchasedAt).getTime() : 0;
              const bt = b.purchasedAt ? new Date(b.purchasedAt).getTime() : 0;
              return bt - at;
            })[0];
          return { client: sanitizeUserAdminView(u), pendingPackage: newest ?? null };
        }),
      );
      res.json(enriched);
    } catch (e) {
      console.warn("[admin/pending] list failed:", e);
      res.status(500).json({ message: "Failed to load pending clients" });
    }
  });

  // ============== ADMIN: PRIVATE CLIENT NOTES ==============
  app.get("/api/admin/clients/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const u = await storage.getUser(id);
    if (!u) return res.status(404).json({ message: "Client not found" });
    res.json(sanitizeUserAdminView(u));
  });

  // Approve a pending client: flips clientStatus -> 'active' and (if a package
  // was snapshotted on signup) marks that package adminApproved + paymentStatus
  // = 'paid'. Also writes to the package_session_history audit log.
  app.post("/api/admin/clients/:id/approve", requireAdmin, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const client = await storage.getUser(id);
    if (!client || client.role !== "client") {
      return res.status(404).json({ message: "Client not found" });
    }
    const note: string | null = (req.body?.note ?? null) || null;
    const updated = await storage.updateUser(id, { clientStatus: "active" } as any);

    // Approve newest package if one is awaiting approval
    try {
      const pkgs = await storage.getPackages({ userId: id });
      const newest = pkgs
        .slice()
        .sort((a, b) => {
          const at = a.purchasedAt ? new Date(a.purchasedAt).getTime() : 0;
          const bt = b.purchasedAt ? new Date(b.purchasedAt).getTime() : 0;
          return bt - at;
        })[0];
      if (newest && newest.adminApproved !== true) {
        const approvedPkg = await storage.updatePackage(newest.id, {
          adminApproved: true,
          adminApprovedAt: new Date(),
          adminApprovedByUserId: me.id,
          paymentStatus: "paid",
          paymentApproved: true,
          paymentApprovedAt: new Date(),
          paymentApprovedByUserId: me.id,
          paymentNote: note,
        } as any);
        try {
          await storage.createPackageSessionHistory({
            packageId: approvedPkg.id,
            userId: id,
            action: "package_approved",
            bookingId: null as any,
            sessionsDelta: 0,
            performedByUserId: me.id,
            reason: note ?? "Client approved by admin",
          } as any);
        } catch {}
      }
    } catch (e) {
      console.warn("[admin/approve] package approval failed:", e);
    }

    res.json(sanitizeUserAdminView(updated));
  });

  // Reject a pending client. Default sets clientStatus='cancelled'. Also
  // marks the snapshotted package (if any) as inactive so it stops showing
  // in the client's dashboard.
  app.post("/api/admin/clients/:id/reject", requireAdmin, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const client = await storage.getUser(id);
    if (!client || client.role !== "client") {
      return res.status(404).json({ message: "Client not found" });
    }
    const reason: string | null = (req.body?.reason ?? null) || null;
    const updated = await storage.updateUser(id, { clientStatus: "cancelled" } as any);

    try {
      const pkgs = await storage.getPackages({ userId: id });
      for (const p of pkgs) {
        if (p.adminApproved !== true && p.isActive !== false) {
          try {
            await storage.updatePackage(p.id, { isActive: false } as any);
            await storage.createPackageSessionHistory({
              packageId: p.id,
              userId: id,
              action: "package_rejected",
              bookingId: null as any,
              sessionsDelta: 0,
              performedByUserId: me.id,
              reason: reason ?? "Client rejected by admin",
            } as any);
          } catch {}
        }
      }
    } catch (e) {
      console.warn("[admin/reject] package deactivation failed:", e);
    }

    res.json(sanitizeUserAdminView(updated));
  });

  app.patch("/api/admin/clients/:id/admin-notes", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = adminClientNotesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid notes" });
    }
    const updated = await storage.updateUser(id, { adminNotes: parsed.data.adminNotes });
    res.json(sanitizeUserAdminView(updated));
  });

  // ============== ADMIN: PACKAGE EXTEND (manual) ==============
  app.post("/api/admin/packages/:id/extend", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = extendPackageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid extension" });
    }
    const pkg = await storage.getPackage(id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });

    let newExpiryStr: string;
    if (parsed.data.newExpiryDate) {
      newExpiryStr = parsed.data.newExpiryDate;
    } else {
      const base = pkg.expiryDate ? new Date(pkg.expiryDate as any) : new Date();
      const next = new Date(base);
      next.setDate(next.getDate() + (parsed.data.addDays ?? 7));
      newExpiryStr = next.toISOString().slice(0, 10);
    }
    const updated = await storage.updatePackage(id, {
      expiryDate: newExpiryStr as any,
      isActive: true,
    });
    try {
      await storage.createPackageSessionHistory({
        packageId: pkg.id,
        userId: pkg.userId,
        action: "package_extended",
        sessionsDelta: 0,
        performedByUserId: (req.user as User).id,
        reason: parsed.data.newExpiryDate
          ? `Expiry set to ${newExpiryStr}`
          : `Extended by ${parsed.data.addDays ?? 7} days → ${newExpiryStr}`,
      } as any);
    } catch {/* ignore */}
    res.json(updated);
  });

  // ============== ADMIN USERS / STAFF ==============
  // Super-admin-only management of admin/staff accounts.
  app.get("/api/admin/admins", requireSuperAdmin, async (_req, res) => {
    const list = await storage.getAllAdmins();
    res.json(list.map(sanitizeUser));
  });

  app.post("/api/admin/admins", requireSuperAdmin, async (req, res) => {
    const parsed = insertAdminUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid admin data" });
    }
    const { email, fullName, password, adminRole, permissions, isActive } = parsed.data;
    const existing =
      (await storage.getUserByEmail(email)) || (await storage.getUserByUsername(email));
    if (existing) {
      return res.status(400).json({ message: "An account with this email already exists." });
    }
    // Only the canonical SUPER_ADMIN_EMAIL can be a super admin.
    if (
      adminRole === "super_admin" &&
      email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()
    ) {
      return res.status(400).json({
        message: `Only ${SUPER_ADMIN_EMAIL} can be assigned the Super Admin role.`,
      });
    }
    const finalPerms = permissions ?? DEFAULT_PERMISSIONS_BY_ROLE[adminRole];
    const hashed = await hashPassword(password);
    const created = await storage.createUser({
      username: email,
      email,
      password: hashed,
      fullName,
      role: "admin",
      adminRole,
      permissions: finalPerms,
      isActive: isActive ?? true,
    } as any);
    res.status(201).json(sanitizeUser(created));
  });

  app.patch("/api/admin/admins/:id", requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const target = await storage.getUser(id);
    if (!target || target.role !== "admin") {
      return res.status(404).json({ message: "Admin not found" });
    }
    const parsed = updateAdminUserSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid update" });
    }
    const updates: any = { ...parsed.data };
    // Protect the canonical super-admin account from being demoted/deactivated.
    const isCanonicalSuperAdmin =
      target.email && target.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    if (isCanonicalSuperAdmin) {
      delete updates.adminRole;
      delete updates.isActive;
    }
    if (updates.password) {
      updates.password = await hashPassword(updates.password);
    }
    if (updates.adminRole && updates.adminRole === "super_admin" && !isCanonicalSuperAdmin) {
      return res.status(400).json({
        message: `Only ${SUPER_ADMIN_EMAIL} can be assigned the Super Admin role.`,
      });
    }
    const updated = await storage.updateUser(id, updates);
    res.json(sanitizeUser(updated));
  });

  app.delete("/api/admin/admins/:id", requireSuperAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const target = await storage.getUser(id);
    if (!target || target.role !== "admin") {
      return res.status(404).json({ message: "Admin not found" });
    }
    if (target.email && target.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return res.status(400).json({ message: "The Super Admin account cannot be deleted." });
    }
    if (target.id === (req.user as User).id) {
      return res.status(400).json({ message: "You cannot delete your own admin account." });
    }
    await storage.deleteUser(id);
    res.sendStatus(204);
  });

  // ============== MANUAL SESSION MANAGEMENT ==============
  // Admin can retroactively log a session that happened before the app was used,
  // or manually backfill any historical session for the client.
  // Helper: validate target is a real client and (if a package is referenced)
  // that the package belongs to that client and has remaining capacity.
  async function validateManualBookingTarget(
    userId: number,
    packageId: number | null | undefined,
    creditsNeeded: number,
  ): Promise<{ ok: true } | { ok: false; status: number; message: string }> {
    const client = await storage.getUser(userId);
    if (!client) return { ok: false, status: 404, message: "Client not found" };
    if (client.role !== "client") {
      return { ok: false, status: 400, message: "Manual sessions can only be added for client accounts" };
    }
    if (packageId) {
      const pkg = await storage.getPackage(packageId);
      if (!pkg) return { ok: false, status: 404, message: "Package not found" };
      if (pkg.userId !== userId) {
        return { ok: false, status: 403, message: "Package does not belong to this client" };
      }
      if (!pkg.isActive) {
        return { ok: false, status: 400, message: "Package is not active" };
      }
      if (pkg.usedSessions + creditsNeeded > pkg.totalSessions) {
        return {
          ok: false,
          status: 400,
          message: `Package only has ${pkg.totalSessions - pkg.usedSessions} session(s) remaining`,
        };
      }
    }
    return { ok: true };
  }

  app.post(
    "/api/admin/clients/:id/manual-bookings",
    requirePermission("sessions.addManual"),
    async (req, res) => {
      const userId = Number(req.params.id);
      const parsed = insertManualBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.errors[0]?.message || "Invalid manual session" });
      }
      const data = parsed.data;
      const finalStatus = data.status ?? "completed";
      const willConsume = !!data.packageId && (CONSUMING_STATUSES as readonly string[]).includes(finalStatus);
      const guard = await validateManualBookingTarget(
        userId,
        data.packageId ?? null,
        willConsume ? 1 : 0,
      );
      if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

      // If the admin chooses to share their note with the client, copy it across
      // and store the same text in clientNotes so it surfaces on the client side.
      const clientNotes = data.showNoteToClient
        ? data.clientNotes ?? data.adminNotes ?? null
        : data.clientNotes ?? null;
      const created = await storage.createBooking({
        userId,
        packageId: data.packageId ?? null,
        date: data.date,
        timeSlot: data.timeSlot,
        sessionType: data.sessionType,
        workoutCategory: data.workoutCategory ?? null,
        workoutNotes: data.workoutNotes ?? null,
        notes: null,
        adminNotes: data.adminNotes ?? null,
        clientNotes,
      } as any);
      // Apply final status (createBooking defaults to 'upcoming') and the manual flag.
      const finalized = await storage.updateBooking(created.id, {
        status: finalStatus,
        isManualHistorical: data.isManualHistorical ?? true,
      } as any);
      // Consume a session credit (atomic SQL increment, capped at totalSessions).
      // Stamp packageSessionDeductedAt so subsequent PATCH/attendance toggles
      // know the credit was already drawn — same idempotency anchor used by
      // PATCH /:id, /:id/cancel, /:id/attendance and the auto-complete cron.
      if (willConsume) {
        let incremented = false;
        try {
          await storage.incrementPackageUsage(data.packageId!);
          incremented = true;
          await pool.query(`UPDATE bookings SET package_session_deducted_at = now() WHERE id = $1`, [created.id]);
        } catch (e) {
          console.error("[manual-booking] increment package usage failed:", e);
          // Roll the booking back so balance stays consistent with bookings.
          // Compensate the package counter if the increment had already
          // landed before the stamp query failed — otherwise the booking
          // disappears but the credit stays consumed.
          if (incremented) {
            await storage.decrementPackageUsage(data.packageId!).catch(() => {});
          }
          await storage.deleteBooking(created.id).catch(() => {});
          return res
            .status(500)
            .json({ message: "Failed to deduct session from package; booking rolled back" });
        }
      }
      res.status(201).json(finalized);
    },
  );

  app.post(
    "/api/admin/clients/:id/manual-bookings/bulk",
    requirePermission("sessions.addManual"),
    async (req, res) => {
      const userId = Number(req.params.id);
      const parsed = bulkManualBookingSchema.safeParse(req.body);
      if (!parsed.success) {
        return res
          .status(400)
          .json({ message: parsed.error.errors[0]?.message || "Invalid bulk request" });
      }
      const data = parsed.data;
      const finalStatus = data.status ?? "completed";
      const willConsume = !!data.packageId && (CONSUMING_STATUSES as readonly string[]).includes(finalStatus);
      const guard = await validateManualBookingTarget(
        userId,
        data.packageId ?? null,
        willConsume ? data.count : 0,
      );
      if (!guard.ok) return res.status(guard.status).json({ message: guard.message });

      const start = new Date(data.startDate + "T00:00:00");
      if (Number.isNaN(start.getTime())) {
        return res.status(400).json({ message: "Invalid start date" });
      }
      const created: any[] = [];
      for (let i = 0; i < data.count; i++) {
        const d = new Date(start);
        d.setDate(d.getDate() + i * data.spacingDays);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const booking = await storage.createBooking({
          userId,
          packageId: data.packageId ?? null,
          date: dateStr,
          timeSlot: data.timeSlot,
          sessionType: "manual_historical",
          workoutCategory: data.workoutCategory ?? null,
          notes: null,
          adminNotes:
            data.adminNotes ?? `Historical session added by admin (bulk entry ${i + 1}/${data.count}).`,
          clientNotes: null,
        } as any);
        await storage.updateBooking(booking.id, {
          status: finalStatus,
          isManualHistorical: true,
        } as any);
        created.push(booking);
      }
      // Atomic single increment for the whole batch + bulk stamp the
      // idempotency anchor on every created row so future PATCH/attendance
      // toggles know the credit was already drawn.
      if (willConsume) {
        let incremented = false;
        try {
          await storage.incrementPackageUsage(data.packageId!, data.count);
          incremented = true;
          await pool.query(
            `UPDATE bookings SET package_session_deducted_at = now() WHERE id = ANY($1::int[])`,
            [created.map((b) => b.id)],
          );
        } catch (e) {
          console.error("[manual-booking-bulk] increment package usage failed:", e);
          // Same compensation pattern as the single-create path — if the
          // bulk increment landed but the stamp UPDATE failed, decrement
          // the package by the same count before deleting the bookings so
          // no credit is leaked.
          if (incremented) {
            for (let n = 0; n < data.count; n++) {
              await storage.decrementPackageUsage(data.packageId!).catch(() => {});
            }
          }
          await Promise.all(created.map((b) => storage.deleteBooking(b.id).catch(() => {})));
          return res
            .status(500)
            .json({ message: "Failed to deduct sessions from package; bookings rolled back" });
        }
      }
      res.status(201).json({ count: created.length });
    },
  );

  // ============== SEED ==============
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const adminUsername = "admin";
  const existing = await storage.getUserByUsername(adminUsername);
  if (!existing) {
    const hashed = await hashPassword("change-this-password");
    await storage.createUser({
      username: adminUsername,
      email: "admin@youssef-ahmed.fit",
      password: hashed,
      fullName: "Youssef Ahmed",
      phone: "+971505394754",
      role: "admin",
      fitnessGoal: null,
      notes: null,
    });
    console.log("Seeded admin account: admin / change-this-password");
  } else if (process.env.RESEED_ADMIN === "1") {
    // Optional safety net: reset admin password to default if explicitly requested.
    const hashed = await hashPassword("change-this-password");
    await storage.updateUser(existing.id, {
      password: hashed,
      fullName: existing.fullName === "Youssef Fitness" ? "Youssef Ahmed" : existing.fullName,
    } as any);
    console.log("Admin password reset to: change-this-password (RESEED_ADMIN=1)");
  } else if (existing.fullName === "Youssef Fitness") {
    // Quietly correct the admin display name without touching the password.
    try {
      await storage.updateUser(existing.id, { fullName: "Youssef Ahmed" } as any);
    } catch {
      /* ignore */
    }
  }

  // Auto-promote the canonical super-admin email if such a user already exists
  // (e.g. they registered as a client first). Best-effort: never throws.
  try {
    const candidate = await storage.getUserByEmail(SUPER_ADMIN_EMAIL);
    if (
      candidate &&
      (candidate.role !== "admin" ||
        candidate.adminRole !== "super_admin" ||
        candidate.isActive === false)
    ) {
      await storage.updateUser(candidate.id, {
        role: "admin",
        adminRole: "super_admin",
        isActive: true,
        permissions: DEFAULT_PERMISSIONS_BY_ROLE.super_admin,
      } as any);
      console.log(`Promoted ${SUPER_ADMIN_EMAIL} to super_admin.`);
    }
  } catch (e) {
    console.warn("[seed] super-admin auto-promotion failed:", e);
  }

  const s = await storage.getSettings();
  const cleanBio =
    "Youssef Ahmed provides premium personal training services in Dubai, combining academic physical education, movement science, competitive sports experience, and structured coaching systems. His approach focuses on safe, personalized, and result-driven training for adults, beginners, fat-loss clients, muscle-gain clients, and kids & youth fitness.";

  // Only replace the bio when it's empty OR when it still matches one of the
  // known legacy auto-seeded prefixes. A startsWith check prevents clobbering
  // any custom bio an admin may have written that incidentally mentions one of
  // the legacy phrases later in the text.
  const LEGACY_BIO_PREFIXES = [
    "Youssef Tarek Hashim Ahmed is a certified",
    "Certified personal trainer and physical education teacher based in Dubai",
  ];
  const trimmedBio = (s.profileBio || "").trim();
  const isLegacySeededBio = LEGACY_BIO_PREFIXES.some((p) => trimmedBio.startsWith(p));
  if (!trimmedBio || isLegacySeededBio) {
    await storage.updateSettings({
      profileBio: cleanBio,
      whatsappNumber: s.whatsappNumber || "971505394754",
    });
  }
}
