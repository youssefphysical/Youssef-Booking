import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { setupAuth, hashPassword, sanitizeUser, sanitizeUserAdminView, sanitizeAndEnrich, sanitizeAndEnrichMany, computeIsVerified, rateLimit } from "./auth";
import type SharpType from "sharp";
// Resilient sharp loader — the server starts even if native binaries are
// absent (e.g. Vercel cold-start before @img/* is bundled). Every call site
// already lives inside try/catch so a null-throw surfaces a proper 4xx
// instead of crashing the entire serverless function.
let _sharp: typeof SharpType | null = null;
void import("sharp")
  .then((m) => { _sharp = (m.default ?? m) as typeof SharpType; })
  .catch((e: unknown) => { console.warn("[boot] sharp unavailable:", (e as Error)?.message ?? e); });
import { storage, computePackageStatus, isPackageBlocking } from "./storage";
import { pool } from "./db";
import {
  dubaiTodayYMD,
  dubaiTomorrowYMD,
  formatYMDInDubai,
  buildSessionDate,
  sessionEndTime,
  formatTime12 as formatTime12Shared,
  formatTimeDual as formatTimeDualShared,
  nowDubai,
  DUBAI_TZ_OFFSET,
} from "@shared/dates";
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
  insertBodyMetricSchema,
  updateBodyMetricSchema,
  insertWeeklyCheckinSchema,
  insertDailyCheckinSchema,
  updateWeeklyCheckinSchema,
  insertProgressPhotoSchema,
  insertHeroImageSchema,
  updateHeroImageSchema,
  insertTransformationSchema,
  updateTransformationSchema,
  insertTrainingLocationSchema,
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
  FEATURE_FLAG_DEFAULTS,
  FEATURE_FLAG_KEYS,
  insertRenewalRequestSchema,
  insertExtensionRequestSchema,
  renewalDecisionSchema,
  extensionDecisionSchema,
  attendanceUpdateSchema,
  adminClientNotesSchema,
  extendPackageSchema,
  freezePackageSchema,
  updatePackagePaymentSchema,
  addPackagePaymentSchema,
  convertTrialPackageSchema,
  adjustPackageSessionsSchema,
  addBonusSessionsSchema,
  expirationToDays,
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
  type PackagePaymentStatus,
} from "@shared/schema";
import {
  sendEmail,
  trainerEmail,
  emailConfigStatus,
  getRecentEmailSends,
  fromDomain,
  fromAddress,
} from "./email";
import { promises as dns } from "node:dns";
import { buildBookingConfirmationEmail } from "./email/builders/bookingConfirmation";
import { buildAdminNewBookingEmail } from "./email/builders/adminNewBooking";
import { buildSessionReminderEmail as buildSessionReminderEmailPremium } from "./email/builders/sessionReminder";
import { buildWelcomeEmail as buildWelcomeEmailPremium } from "./email/builders/welcome";
import {
  buildClientBookingConfirmationEmail,
  buildAdminBookingEmail,
  buildAdminBookingChangeEmail,
  buildAdminPackageExpiringEmail,
  buildPackageExpiringEmail,
  buildPackageFinishedEmail,
  buildSessionReminderEmail,
  buildAdminAttendanceEmail,
  buildAdminEmergencyCancelEmail,
  buildAdminPaymentEmail,
  buildAdminPackageActivatedEmail,
  buildAdminPackageExpiredEmail,
  buildAdminPackageExtendedEmail,
  buildAdminProfileUpdateEmail,
  buildWelcomeEmail,
  buildPasswordResetEmail,
  buildAdminNewClientEmail,
  type BookingDetails,
} from "./email-templates";
import { z } from "zod";
import { notifyUser, notifyUserOnce, notifyUsers } from "./services/notifications";
import { sendPaymentConfirmedNotification } from "./notifications";
import { runAutoCompleteBookings, getLastAutoCompleteRun, getLastCronRunAt } from "./services/autoCompleteBookings";
import { evaluateAndAwardBadges, computeStreaks } from "./services/badges";
import { runCronTick, cronGuards, classifyFailure } from "./cron/runner";
import { computeClientIntelligence } from "./services/clientIntelligence";
import { recomputeSmartAlerts, listOpen as listOpenAlerts, resolveById as resolveAlertById } from "./services/adminAlerts";
import { getHealth as getSystemHealth } from "./services/systemHealth";
import { optimizeImageFile } from "./image-utils";

function currentMonthKey(d: Date = nowDubai()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// =============================
// Task #55 — Free-trial abuse prevention helpers
// =============================
// Normalisation collapses common evasion tricks into a comparable key:
//   - Email lowercased; Gmail-family addresses strip dots in the local
//     part and drop "+tag" sub-addresses (foo.bar+x@gmail.com → foobar@gmail.com).
//   - Phone stripped to digits only — international prefix variants
//     (00971 vs +971 vs 0 5xxxxxxxx) collapse to the same key.
// These are NEVER used as authentication; they're a soft signal layered
// on top of the existing hasUsedFreeTrial flag and the per-IP rate limit.
function normalizeEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  if (!trimmed.includes("@")) return null;
  const [localRaw, domain] = trimmed.split("@");
  if (!domain) return null;
  const isGmailFamily = domain === "gmail.com" || domain === "googlemail.com";
  let local = localRaw;
  const plus = local.indexOf("+");
  if (plus >= 0) local = local.slice(0, plus);
  if (isGmailFamily) local = local.replace(/\./g, "");
  if (!local) return null;
  return `${local}@${isGmailFamily ? "gmail.com" : domain}`;
}

function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D+/g, "");
  if (digits.length < 6) return null;
  // Strip leading "00" (international dial-out) so 00971... == +971...
  const trimmed = digits.replace(/^00/, "");
  return trimmed;
}

// Per-IP token bucket for the trial endpoint (separate from the auth
// rate-limiter so abusers can't burn through booking quota under cover
// of a register/login cooldown).
const TRIAL_RATE_BUCKETS = new Map<string, { count: number; resetAt: number }>();
function trialRateCheck(req: Request): { ok: true } | { ok: false; retryAfter: number } {
  const ip =
    req.ip ||
    (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "unknown";
  const key = `trial:${ip}`;
  const now = Date.now();
  // Phase 5 review fix — env-tunable along with the rest of the rate
  // limits. Defaults preserve previous behaviour (3/hr).
  const envWindow = Number(process.env.RL_FREETRIAL_WINDOW_MS);
  const envMax = Number(process.env.RL_FREETRIAL_MAX);
  const windowMs = Number.isFinite(envWindow) && envWindow > 0 ? envWindow : 60 * 60 * 1000;
  const max = Number.isFinite(envMax) && envMax > 0 ? envMax : 3;
  const cur = TRIAL_RATE_BUCKETS.get(key);
  if (!cur || cur.resetAt < now) {
    TRIAL_RATE_BUCKETS.set(key, { count: 1, resetAt: now + windowMs });
    if (TRIAL_RATE_BUCKETS.size > 5000) {
      TRIAL_RATE_BUCKETS.forEach((v, k) => {
        if (v.resetAt < now) TRIAL_RATE_BUCKETS.delete(k);
      });
    }
    return { ok: true };
  }
  if (cur.count >= max) {
    return { ok: false, retryAfter: Math.ceil((cur.resetAt - now) / 1000) };
  }
  cur.count += 1;
  return { ok: true };
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
// buildSessionDate / sessionEndTime / DUBAI_TZ_OFFSET imported from @shared/dates.

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
  const today = nowDubai();
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

// Booking lead-time. Per the May 2026 booking-rules brief the cutoff is:
//   cutoff = CEIL_TO_NEXT_FULL_HOUR(currentDubaiTime) + MIN_ADVANCE_BOOKING_HOURS
// Slots strictly before the cutoff are rejected. Universally enforced for
// every role (clients AND admins — no bypass). The cancellation cutoff is a
// SEPARATE system (default 3h, lives in settings.cancellation_cutoff_hours)
// — do not conflate. Mirrors MIN_ADVANCE_HOURS in client/src/lib/booking-utils.ts.
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

/** Dubai-anchored "today" as YYYY-MM-DD. Never uses server-local timezone. */
function todayDateString(): string {
  return dubaiTodayYMD();
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
for (const sub of ["photos"]) {
  const full = path.join(UPLOAD_ROOT, sub);
  if (!fs.existsSync(full)) fs.mkdirSync(full, { recursive: true });
}

// Strict MIME allowlists. (lab
// reports), but the progress-photo endpoint must only accept images.
const PHOTO_MIME_ALLOWLIST = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
]);
function makeUploader(subdir: "photos") {
  const allow = PHOTO_MIME_ALLOWLIST;
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

function fileToPublicUrl(file: Express.Multer.File, subdir: "photos"): string {
  return `/uploads/${subdir}/${file.filename}`;
}

// =============================================================
// Booking notifications dispatcher (admin in-app + trainer/client emails).
// Always best-effort. Caller wraps it in try/catch so booking never fails.
// =============================================================
function formatTime12Server(timeSlot: string): string {
  return formatTime12Shared(timeSlot);
}
function formatTimeDualServer(timeSlot: string): string {
  return formatTimeDualShared(timeSlot);
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
  const timeDual = formatTimeDualServer(booking.timeSlot);

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
    time12: timeDual,
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
      body: `${booking.date} at ${timeDual} • ${sessionFocusLabel} • ${trainingGoalLabel} • ${sessionTypeLabel}${partnerSuffix}`,
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
    `${booking.date} at ${timeDual} — ${sessionFocusLabel}`,
    { link: "/dashboard", meta: { bookingId: booking.id } },
  );

  const bookingDetails: BookingDetails = {
    clientName,
    date: booking.date,
    time12: timeDual,
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
    // Brief: client confirmation needs Email/Phone/Payment Status; admin
    // ops footer needs Booking Source + Action Timestamp.
    clientEmail: user?.email ?? null,
    clientPhone: (user as any)?.phone ?? null,
    paymentStatus: (booking as any).paymentStatus ?? null,
    bookingSource: (booking as any).adminEntered || (booking as any).createdByAdmin
      ? "Admin entry"
      : sessionType === "trial"
        ? "Trial signup"
        : "Web booking",
    actionTimestamp: new Date().toLocaleString("en-GB", {
      timeZone: "Asia/Dubai",
      day: "2-digit", month: "short", year: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    }) + " GST",
  };

  // ---- 2. Trainer email — NEW design system (server/email/builders) ----
  // Diagnostic log so production logs prove which renderer fired.
  console.log("[email-route] booking-notif → admin renderer = PREMIUM (buildAdminNewBookingEmail)");
  // Wired through the locked composer/components pipeline: brandHeader →
  // severity banner → keyValueList → ctaButton → footer. Dark-mode + RTL
  // post-process applied automatically by `compose()`. Falls back to the
  // legacy stripped builder ONLY if the new builder throws (defence-in-
  // depth — never silently send broken HTML).
  const appUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");
  try {
    let trainerMsg: { subject: string; html: string; text: string };
    try {
      trainerMsg = buildAdminNewBookingEmail({
        lang: "en", // admin emails are always English (operational)
        clientName,
        clientEmail: user?.email ?? null,
        clientPhone: user?.phone ?? null,
        date: booking.date,
        time12: timeDual,
        sessionType: sessionTypeLabel,
        packageName: bookingDetails.packageName ?? null,
        sessionFocus: bookingDetails.sessionFocusLabel ?? null,
        trainingGoal: bookingDetails.trainingGoalLabel ?? null,
        notes: booking.clientNotes ?? null,
        partnerName: bookingDetails.partnerFullName ?? null,
        remainingSessions: bookingDetails.remainingSessions ?? null,
        totalSessions: bookingDetails.totalSessions ?? null,
        paymentStatus: bookingDetails.paymentStatus ?? null,
        bookingSource: bookingDetails.bookingSource ?? null,
        actionTimestamp: bookingDetails.actionTimestamp ?? null,
        adminUrl: appUrl ? `${appUrl}/admin/bookings` : "/admin/bookings",
        supportEmail: trainerEmail(),
      });
    } catch (newBuilderErr) {
      console.warn("[email-route] FALLBACK activated (admin) — premium builder threw:", newBuilderErr);
      trainerMsg = buildAdminBookingEmail({
        d: bookingDetails,
        clientEmail: user?.email ?? null,
        clientPhone: user?.phone ?? null,
        clientNotes: booking.clientNotes ?? null,
      });
    }
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

  // ---- 3. Client email — NEW design system (server/email/builders) ----
  // Premium cinematic shell, success severity banner, full booking +
  // package details, single primary CTA → /dashboard. Same fallback
  // pattern as admin: try-new, fall back to legacy on hard failure.
  if (user?.email) {
    console.log("[email-route] booking-notif → client renderer = PREMIUM (buildBookingConfirmationEmail)");
    try {
      let clientMsg: { subject: string; html: string; text: string };
      try {
        const clientLang: "en" | "ar" = lang === "ar" ? "ar" : "en";
        clientMsg = buildBookingConfirmationEmail({
          lang: clientLang,
          recipientName: clientName,
          date: booking.date,
          time12: timeDual,
          sessionFocus: bookingDetails.sessionFocusLabel ?? null,
          trainingGoal: bookingDetails.trainingGoalLabel ?? null,
          location: "Coach Youssef's studio, Dubai",
          sessionType: sessionTypeLabel,
          packageName: bookingDetails.packageName ?? null,
          remainingSessions: bookingDetails.remainingSessions ?? null,
          totalSessions: bookingDetails.totalSessions ?? null,
          paymentStatus: bookingDetails.paymentStatus ?? null,
          clientEmail: user.email,
          clientPhone: user?.phone ?? null,
          bookingUrl: appUrl ? `${appUrl}/dashboard` : "/dashboard",
          rescheduleUrl: appUrl ? `${appUrl}/dashboard` : "/dashboard",
          supportEmail: trainerEmail(),
        });
      } catch (newBuilderErr) {
        console.warn("[email-route] FALLBACK activated (client) — premium builder threw:", newBuilderErr);
        clientMsg = buildClientBookingConfirmationEmail({
          data: bookingDetails,
          lang,
        });
      }
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
        // Use the dedicated "expired" template (renewal opportunity tone)
        // rather than the generic "expiring" warning. Distinguishes
        // sessions_exhausted vs date_expired in subject + body.
        try {
          const exhausted = (remainingAfter ?? 0) <= 0;
          const adminMsg = buildAdminPackageExpiredEmail({
            clientName,
            packageName: packageName ?? "Training package",
            reason: exhausted ? "sessions_exhausted" : "date_expired",
            totalSessions: pkg.totalSessions ?? null,
            expiryDate: pkg.expiryDate ? String(pkg.expiryDate) : null,
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
  protectedCancel?: boolean;
  monthlyQuotaUsed?: number | null;
  monthlyQuotaTotal?: number | null;
}): Promise<void> {
  try {
    const user = await storage.getUser(opts.booking.userId).catch(() => undefined);
    const clientName = (user?.fullName?.trim() || user?.username || `Client #${opts.booking.userId}`).trim();
    const timeDual = formatTimeDualServer(opts.booking.timeSlot);
    const built =
      opts.kind === "cancellation" && opts.protectedCancel
        ? buildAdminEmergencyCancelEmail({
            clientName,
            date: opts.booking.date,
            time12: timeDual,
            monthlyQuotaUsed: opts.monthlyQuotaUsed ?? null,
            monthlyQuotaTotal: opts.monthlyQuotaTotal ?? null,
            reason: opts.reason ?? null,
          })
        : buildAdminBookingChangeEmail({
            kind: opts.kind,
            clientName,
            date: opts.booking.date,
            time12: timeDual,
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

// Best-effort admin email helpers — never throw, never block. Each wraps
// a builder + sendEmail into one dispatcher so trigger sites stay readable.
async function dispatchAdminAttendanceEmail(opts: {
  attendance: "attended" | "no_show" | "late_cancel_charged" | "late_cancel_free";
  booking: Booking;
  reason?: string | null;
}): Promise<void> {
  try {
    const user = await storage.getUser(opts.booking.userId).catch(() => undefined);
    const clientName = (user?.fullName?.trim() || user?.username || `Client #${opts.booking.userId}`).trim();
    let packageName: string | null = null;
    let remainingSessions: number | null = null;
    if (opts.booking.packageId) {
      const pkg = await storage.getPackage(opts.booking.packageId).catch(() => undefined);
      if (pkg) {
        packageName = pkg.name ?? null;
        remainingSessions = Math.max(0, (pkg.totalSessions ?? 0) - (pkg.usedSessions ?? 0));
      }
    }
    const built = buildAdminAttendanceEmail({
      attendance: opts.attendance,
      clientName,
      date: opts.booking.date,
      time12: formatTimeDualServer(opts.booking.timeSlot),
      packageName,
      remainingSessions,
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
    console.warn("[notif] admin attendance email failed:", e);
  }
}

async function dispatchAdminPaymentEmail(opts: {
  pkg: any;
  amountReceived?: number | null;
}): Promise<void> {
  try {
    const user = await storage.getUser(opts.pkg.userId).catch(() => undefined);
    const clientName = (user?.fullName?.trim() || user?.username || `Client #${opts.pkg.userId}`).trim();
    const built = buildAdminPaymentEmail({
      clientName,
      packageName: opts.pkg.name ?? null,
      paymentStatus: opts.pkg.paymentStatus ?? "pending",
      amountReceived: opts.amountReceived ?? null,
      amountPaidTotal: opts.pkg.amountPaid ?? null,
      packageTotal: opts.pkg.totalPrice ?? null,
      note: opts.pkg.paymentNote ?? null,
    });
    await sendEmail({ to: trainerEmail(), subject: built.subject, text: built.text, html: built.html });
  } catch (e) {
    console.warn("[notif] admin payment email failed:", e);
  }
}

// Client-facing payment confirmation — fires when a package transitions
// into the "paid" state via either /payment (manual mark) or /add-payment
// (running total reaches total_price). Best-effort, never throws.
async function dispatchClientPaymentConfirmedEmail(opts: {
  pkg: any;
  amountReceived?: number | null;
  paymentMethod?: string | null;
}): Promise<void> {
  try {
    const user = await storage.getUser(opts.pkg.userId).catch(() => undefined);
    if (!user?.email) return;
    const clientName = (user.fullName?.trim() || user.username || `Client #${opts.pkg.userId}`).trim();
    const totalPrice = (opts.pkg as any).totalPrice ?? 0;
    const amountNumber = opts.amountReceived ?? totalPrice;
    const amount = `AED ${Number(amountNumber).toLocaleString()}`;
    const paymentDate = new Date().toLocaleDateString("en-GB", {
      timeZone: "Asia/Dubai",
      weekday: "short", day: "numeric", month: "short", year: "numeric",
    });
    const startDate = opts.pkg.startDate
      ? new Date(`${opts.pkg.startDate}T00:00:00+04:00`).toLocaleDateString("en-GB", {
          weekday: "short", day: "numeric", month: "short", year: "numeric",
        })
      : null;
    const expiry = opts.pkg.expiryDate
      ? new Date(`${opts.pkg.expiryDate}T00:00:00+04:00`)
      : null;
    const start = opts.pkg.startDate
      ? new Date(`${opts.pkg.startDate}T00:00:00+04:00`)
      : null;
    const validityLabel = expiry && start
      ? `${Math.max(1, Math.round((expiry.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7)))} weeks`
      : null;
    const base = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "")
      || (process.env.NODE_ENV === "production"
        ? "https://youssef-booking.vercel.app"
        : `http://localhost:${process.env.PORT || 5000}`);
    const userLang = ((user as any).preferredLanguage === "ar" ? "ar" : "en") as "en" | "ar";
    await sendPaymentConfirmedNotification({
      email: user.email,
      clientName,
      lang: userLang,
      amount,
      paymentMethod: opts.paymentMethod ?? null,
      paymentReference: `PKG-${opts.pkg.id}-${Date.now().toString(36).toUpperCase()}`,
      paymentDate,
      packageName: opts.pkg.name ?? "Training package",
      totalSessions: opts.pkg.totalSessions ?? null,
      validityLabel,
      startDate,
      packageUrl: `${base}/dashboard`,
      bookUrl: `${base}/book`,
    });
  } catch (e) {
    console.warn("[notif] client payment-confirmed email failed:", e);
  }
}

async function dispatchAdminPackageActivatedEmail(opts: {
  pkg: any;
  source: "new" | "approved" | "converted_trial";
}): Promise<void> {
  try {
    const user = await storage.getUser(opts.pkg.userId).catch(() => undefined);
    const clientName = (user?.fullName?.trim() || user?.username || `Client #${opts.pkg.userId}`).trim();
    const built = buildAdminPackageActivatedEmail({
      clientName,
      packageName: opts.pkg.name ?? "Training package",
      totalSessions: opts.pkg.totalSessions ?? null,
      paidSessions: opts.pkg.paidSessions ?? null,
      bonusSessions: opts.pkg.bonusSessions ?? null,
      totalPrice: opts.pkg.totalPrice ?? null,
      startDate: opts.pkg.startDate ? String(opts.pkg.startDate) : null,
      expiryDate: opts.pkg.expiryDate ? String(opts.pkg.expiryDate) : null,
      paymentStatus: opts.pkg.paymentStatus ?? null,
      source: opts.source,
    });
    await sendEmail({ to: trainerEmail(), subject: built.subject, text: built.text, html: built.html });
  } catch (e) {
    console.warn("[notif] admin package-activated email failed:", e);
  }
}

async function dispatchAdminPackageExtendedEmail(opts: {
  pkg: any;
  daysAdded: number;
  previousExpiry?: string | null;
  newExpiry: string;
  reason?: string | null;
}): Promise<void> {
  try {
    const user = await storage.getUser(opts.pkg.userId).catch(() => undefined);
    const clientName = (user?.fullName?.trim() || user?.username || `Client #${opts.pkg.userId}`).trim();
    const built = buildAdminPackageExtendedEmail({
      clientName,
      packageName: opts.pkg.name ?? "Training package",
      daysAdded: opts.daysAdded,
      previousExpiry: opts.previousExpiry ?? null,
      newExpiry: opts.newExpiry,
      reason: opts.reason ?? null,
    });
    await sendEmail({ to: trainerEmail(), subject: built.subject, text: built.text, html: built.html });
  } catch (e) {
    console.warn("[notif] admin package-extended email failed:", e);
  }
}

async function dispatchAdminProfileUpdateEmail(opts: {
  user: User;
  changes: Array<[string, string | null]>;
}): Promise<void> {
  try {
    const clientName = (opts.user.fullName?.trim() || opts.user.username || `Client #${opts.user.id}`).trim();
    const built = buildAdminProfileUpdateEmail({ clientName, changes: opts.changes });
    await sendEmail({
      to: trainerEmail(),
      subject: built.subject,
      text: built.text,
      html: built.html,
      replyTo: opts.user.email ?? undefined,
    });
  } catch (e) {
    console.warn("[notif] admin profile-update email failed:", e);
  }
}

// P4d: centralized booking-response sanitizer. Strips admin-private
// coach fields (privateCoachNotes) from any booking payload returned
// to a non-admin user. Apply to every endpoint that returns booking
// objects (list, create, patch, cancel, same-day-adjust). Admin
// responses are returned unchanged.
// P4e: unified activity-feed event shape. The aggregator unions across
// bookings, packages, body metrics, weekly check-ins, and progress photos.
// Keep this lean — no ORM-specific shapes leak.
type ActivityEvent = {
  id: string;
  kind:
    | "session_completed"
    | "session_booked"
    | "session_cancelled"
    | "package_activated"
    | "body_metric"
    | "weekly_checkin"
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

  const [bookings, packagesList, bodyMetrics, checkins, photos, auditRows] = await Promise.all([
    safe(() => storage.getBookings({ userId }), [] as any[]),
    safe(() => storage.getPackages({ userId }), [] as any[]),
    safe(() => storage.listBodyMetrics(userId, { limit: 50 }), [] as any[]),
    safe(() => storage.listWeeklyCheckins(userId, { limit: 25 }), [] as any[]),
    safe(() => storage.getProgressPhotos({ userId }), [] as any[]),
    // Task #57 — fold admin audit entries that touched this client
    // into the same timeline so the Activity tab shows who did what.
    safe(() => (storage as any).listAuditEntries({ userId, limit: 80 }), [] as any[]),
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

  // Task #57 — admin audit entries (approve, freeze, sessions ±, extend,
  // payment update, attendance toggle, notes/medical flag edits, etc.)
  // Rendered as `coach_note` kind so they reuse the existing tile look.
  for (const r of auditRows as any[]) {
    const at = r.createdAt instanceof Date
      ? r.createdAt.toISOString()
      : (r.createdAt ? String(r.createdAt) : null);
    if (!at) continue;
    const action = String(r.action ?? "admin action");
    const title = action
      .replace(/_/g, " ")
      .replace(/\./g, " · ")
      .replace(/^./, (c) => c.toUpperCase());
    events.push({
      id: `audit-${r.id}`,
      kind: "coach_note",
      at,
      title: `Admin: ${title}`,
      subtitle: r.reason ? String(r.reason).slice(0, 160) : null,
    });
  }

  events.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
  return events.slice(0, limit);
}

// =====================================================
// Task #57 — audit-log helper.
// Single seam every admin mutation goes through so we capture
// actor, action verb, entity, before/after, and an optional reason
// in `admin_audit_log`. All failures are swallowed: a missing audit
// row must never break the actual write the user requested.
// =====================================================
async function audit(
  req: any,
  action: string,
  entityType: string,
  entityId: number | null | undefined,
  previousValue: unknown,
  newValue: unknown,
  reason?: string | null,
) {
  try {
    const me = (req?.user ?? {}) as { id?: number };
    await storage.recordAuditLog({
      action,
      entityType,
      entityId: entityId ?? null,
      previousValue: (previousValue ?? null) as any,
      newValue: (newValue ?? null) as any,
      performedByUserId: me.id ?? null,
      reason: reason ?? null,
    } as any);
  } catch (e) {
    console.warn("[audit] record failed:", action, entityType, entityId, e);
  }
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

  // Phase 5 review fix — centralised rate limit applied to *every*
  // admin API. Generous ceiling (300 req / min / IP) so normal usage
  // never trips it, but it caps both abusive scanners and a runaway
  // admin script. Per-route limits below (merge, feature-flags, etc.)
  // are stricter and stack on top of this.
  // Phase 5 review fix — env-configurable rate-limit ceilings. Each
  // route group reads its max from a dedicated env var; defaults match
  // the previous hardcoded values so behaviour is unchanged unless the
  // operator explicitly overrides one. Negative/NaN/0 values fall
  // through to the default so a typo can't accidentally disable a
  // protection.
  const rlMax = (envKey: string, fallback: number): number => {
    const raw = process.env[envKey];
    if (!raw) return fallback;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  const RL = {
    adminBucket: rlMax("RL_ADMIN_MAX", 300),
    booking: rlMax("RL_BOOKING_MAX", 20),
    adminFlag: rlMax("RL_ADMIN_FLAG_MAX", 30),
    adminMerge: rlMax("RL_ADMIN_MERGE_MAX", 10),
    activation: rlMax("RL_ACTIVATION_MAX", 5),
  };

  app.use(
    "/api/admin",
    rateLimit({ windowMs: 60_000, max: RL.adminBucket, key: "admin-bucket" }),
  );

  // ============== HEALTH ==============
  // Public, auth-free liveness probe — used by Vercel's health checks and
  // by the Replit deployment platform. Kept extremely cheap (no DB call).
  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, env: process.env.VERCEL ? "vercel" : "replit" });
  });

  // ============== ADMIN: BROADCAST / DIRECT MESSAGE (Task #56) ==============
  // Single endpoint covers two shapes:
  //   - { userId: number, title, body, link? }  → 1-1 admin push
  //   - { title, body, link?, audience?: "all_active" | "all" }  → broadcast
  // Always emits with kind `admin_message`. Idempotency is intentionally
  // NOT enforced — Youssef may legitimately resend the same message.
  app.post("/api/admin/notifications/broadcast", requireAdmin, async (req, res) => {
    const title = String(req.body?.title ?? "").trim().slice(0, 120);
    const body = String(req.body?.body ?? "").trim().slice(0, 500);
    const link = typeof req.body?.link === "string" && req.body.link.trim()
      ? String(req.body.link).trim().slice(0, 300)
      : "/dashboard";
    if (!title || !body) {
      return res.status(400).json({ message: "title and body are required" });
    }
    try {
      if (req.body?.userId != null) {
        const uid = Number(req.body.userId);
        if (!Number.isFinite(uid)) {
          return res.status(400).json({ message: "Invalid userId" });
        }
        const target = await storage.getUser(uid);
        if (!target || target.role !== "client") {
          return res.status(404).json({ message: "Client not found" });
        }
        await notifyUser(uid, "admin_message", title, body, { link });
        return res.json({ delivered: 1 });
      }
      const audience = String(req.body?.audience ?? "all_active");
      const clients = await storage.getAllClients();
      const ids = clients
        .filter((u: User) =>
          audience === "all" ? true : (u as any).clientStatus === "active",
        )
        .map((u: User) => u.id);
      await notifyUsers(ids, "admin_message", title, body, { link });
      return res.json({ delivered: ids.length });
    } catch (e: any) {
      console.warn("[admin/broadcast] failed:", e);
      return res.status(500).json({ message: "Broadcast failed" });
    }
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
      if (!_sharp) throw new Error("sharp_unavailable");
      const webp = await _sharp(buffer, { failOn: "none", limitInputPixels: 24_000_000 })
        .rotate()
        .resize(256, 256, { fit: "cover", position: "center" })
        .webp({ quality: 75, effort: 4 })
        .toBuffer();
      const dataUrl = `data:image/webp;base64,${webp.toString("base64")}`;
      const updated = await storage.updateUser(id, { profilePictureUrl: dataUrl } as any);
      const enriched = await sanitizeAndEnrich(updated);
      // Best-effort admin email — flag profile photo updates for clients only.
      // Skipped when admin updates an admin's own avatar (no operational value).
      if (updated.role === "client") {
        void dispatchAdminProfileUpdateEmail({
          user: updated,
          changes: [["Change", "Profile photo updated"]],
        });
      }
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
    if (updated.role === "client") {
      void dispatchAdminProfileUpdateEmail({
        user: updated,
        changes: [["Change", "Profile photo removed"]],
      });
    }
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
      // Task #57 — medicalFlags is admin-managed safety metadata. Clients
      // must not be able to set/clear their own flags via the generic
      // profile patch; the only legitimate write path is admin-only
      // PATCH /api/admin/clients/:id/medical-flags (audit-logged).
      delete (updates as any).medicalFlags;
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

    // Snapshot the "before" values on the fields we surface to admin so
    // the diff stays accurate even when the request body shapes are
    // partial. Only the fields actually present in `updates` after the
    // permission filtering above are considered.
    const beforeForDiff: Record<string, unknown> = {
      fullName: me.role === "client" ? me.fullName : null,
      phone: me.role === "client" ? me.phone : null,
      email: me.role === "client" ? me.email : null,
      weeklyFrequency: me.role === "client" ? (me as any).weeklyFrequency : null,
      vipTier: (me as any).vipTier ?? null,
    };
    const targetBefore = me.role === "admin" && me.id !== id
      ? await storage.getUser(id).catch(() => undefined)
      : null;
    if (targetBefore) {
      beforeForDiff.fullName = targetBefore.fullName;
      beforeForDiff.phone = targetBefore.phone;
      beforeForDiff.email = targetBefore.email;
      beforeForDiff.weeklyFrequency = (targetBefore as any).weeklyFrequency ?? null;
      beforeForDiff.vipTier = (targetBefore as any).vipTier ?? null;
    }

    const updated = await storage.updateUser(id, updates as any);

    // Best-effort admin email — fires only when a client's surfaced field
    // actually changed (self-edit OR admin-on-client edit). Skipped for
    // admin-on-admin edits and for no-op writes (same value submitted).
    if (updated.role === "client") {
      const PROFILE_FIELDS: Array<[keyof typeof beforeForDiff, string, (v: unknown) => string]> = [
        ["fullName", "Full name", (v) => String(v ?? "—").trim() || "—"],
        ["phone", "Phone", (v) => String(v ?? "—").trim() || "—"],
        ["email", "Email", (v) => String(v ?? "—").trim() || "—"],
        ["weeklyFrequency", "Weekly frequency", (v) => v == null ? "—" : `${v}×/week`],
        ["vipTier", "VIP tier", (v) => v == null ? "—" : String(v)],
      ];
      const changes: Array<[string, string]> = [];
      for (const [key, label, fmt] of PROFILE_FIELDS) {
        const next = (updated as any)[key];
        const prev = beforeForDiff[key];
        if (next !== undefined && next !== prev) {
          const prevStr = fmt(prev);
          const nextStr = fmt(next);
          if (prevStr !== nextStr) {
            changes.push([label, `${prevStr} → ${nextStr}`]);
          }
        }
      }
      if (changes.length > 0) {
        void dispatchAdminProfileUpdateEmail({ user: updated, changes });
      }
    }

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

  app.post("/api/bookings", rateLimit({ windowMs: 60_000, max: RL.booking, key: "book" }), requireAuth, async (req, res) => {
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
        message:
          "Bookings must be made at least 3 hours in advance so the trainer can prepare and arrive on time.",
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

    // Free trial check: once per lifetime per user + cross-account abuse
    // prevention (Task #55). Admins bypass all of this for manual entry.
    const deviceFpRaw =
      typeof (req.body as any)?.deviceFingerprint === "string"
        ? String((req.body as any).deviceFingerprint).slice(0, 200)
        : null;
    let trialAbuseChecked = false;
    if (sessionType === "trial") {
      const targetUser = await storage.getUser(targetUserId);
      if (!targetUser) return res.status(404).json({ message: "Client not found" });
      if (me.role !== "admin") {
        // 1) Per-IP rate limit so a single host can't farm trial attempts
        //    across rapidly-created accounts.
        const rl = trialRateCheck(req);
        if (!rl.ok) {
          res.setHeader("Retry-After", String(rl.retryAfter));
          return res.status(429).json({
            error: "TooManyRequests",
            message:
              "Too many free-trial attempts from this network. Please wait an hour or contact support.",
          });
        }
        // 2) Direct flag — the user has already used theirs.
        if (targetUser.hasUsedFreeTrial) {
          return res.status(400).json({
            message:
              "Your free trial has already been used. Please choose a Single Session or a Package to continue training.",
          });
        }
        // 3) Cross-account check — does any OTHER user with
        //    hasUsedFreeTrial=true share a normalised email/phone or the
        //    same device fingerprint? If so, block politely.
        const emailNormalized = normalizeEmail(targetUser.email);
        const phoneNormalized = normalizePhone((targetUser as any).phone);
        if (emailNormalized || phoneNormalized || deviceFpRaw) {
          const matches = await storage.findTrialUsersByIdentifiers({
            emailNormalized,
            phoneNormalized,
            deviceFingerprintHash: deviceFpRaw,
            excludeUserId: targetUser.id,
          });
          if (matches.length > 0) {
            console.warn(
              "[booking:anomaly]",
              JSON.stringify({
                kind: "trial_abuse_blocked",
                userId: targetUser.id,
                matchedUserIds: matches.map((u) => u.id),
              }),
            );
            return res.status(400).json({
              message:
                "A free trial has already been used by this contact or device. Please choose a Single Session or a Package to continue training.",
              code: "trial_already_used",
            });
          }
        }
        trialAbuseChecked = true;
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
          "You don't have an active package linked to this booking. Request a new package or contact support through the platform.",
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

    // Mark trial as used if successful (clients only — admin overrides remain).
    // Task #55: also persist normalised identifiers + device fingerprint so
    // future trial attempts from the same person under a new account are
    // caught by the cross-account check above.
    if (sessionType === "trial" && me.role !== "admin") {
      try {
        const targetUser = await storage.getUser(targetUserId);
        const patch: Record<string, any> = { hasUsedFreeTrial: true };
        if (trialAbuseChecked) {
          const en = normalizeEmail(targetUser?.email);
          const pn = normalizePhone((targetUser as any)?.phone);
          if (en) patch.emailNormalized = en;
          if (pn) patch.phoneNormalized = pn;
          if (deviceFpRaw) patch.deviceFingerprintHash = deviceFpRaw;
        }
        await storage.updateUser(targetUserId, patch);
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

  // ============== ADMIN EMAIL DIAGNOSTICS ==============
  // Surfaces Resend config + last 50 send attempts so the trainer can
  // pinpoint why a client didn't receive an email without needing access
  // to Vercel logs. Read-only; safe to call freely.
  app.get("/api/admin/email/status", requireAdmin, (_req, res) => {
    const status = emailConfigStatus();
    const recent = getRecentEmailSends(50);
    const lastFailure = recent.find((e) => !e.sent) ?? null;
    const lastSuccess = recent.find((e) => e.sent) ?? null;
    res.json({
      config: status,
      trainerEmail: trainerEmail(),
      counts: {
        recentTotal: recent.length,
        recentSent: recent.filter((e) => e.sent).length,
        recentFailed: recent.filter((e) => !e.sent).length,
      },
      lastSuccess,
      lastFailure,
      recent,
    });
  });

  // Sends a tiny test email through the same sendEmail() pipeline used
  // by booking confirmations. Returns the raw provider response so the
  // trainer sees the EXACT reason (e.g. "Resend 403: domain not verified").
  app.post("/api/admin/email/test", requireAdmin, async (req, res) => {
    const to = String(req.body?.to ?? "").trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ message: "Provide a valid `to` email address." });
    }
    const subject = String(req.body?.subject ?? "Youssef Fitness email test").slice(0, 200);
    const stamp = new Date().toISOString();
    const result = await sendEmail({
      to,
      subject,
      text:
        `This is a delivery test from the Youssef Fitness booking system.\n\n` +
        `Sent at: ${stamp}\nFrom env EMAIL_FROM: ${process.env.EMAIL_FROM ? "custom" : "default"}\n\n` +
        `If you received this, transactional email is working.`,
      html:
        `<div style="font-family:-apple-system,sans-serif;line-height:1.55;color:#111;max-width:540px">` +
        `<h2 style="margin:0 0 12px;color:#0a7d4f">Email delivery test</h2>` +
        `<p style="margin:0 0 8px">This message was sent through the same pipeline as booking confirmations.</p>` +
        `<p style="margin:0 0 8px;font-size:13px;color:#555">Sent at <code>${stamp}</code></p>` +
        `<p style="margin:16px 0 0;font-size:13px;color:#555">If you received this, transactional email is working.</p>` +
        `</div>`,
      replyTo: trainerEmail(),
    });
    res.json({ to, ...result, config: emailConfigStatus() });
  });

  // POST /api/_debug/send-welcome-email — bearer-token-protected one-shot
  // welcome email tester for production debugging. Identical pipeline to
  // sendWelcomeNotifications() but returns the raw Resend response.
  // Token is hardcoded (not an env var) so we can hit it from outside
  // without admin session. Safe blast radius: only sends one welcome
  // email; no data exposure. Remove after debugging is complete.
  const DEBUG_EMAIL_TOKEN = "tok_d76ea2f034941c543024a6b6015963277bf6aa36c8d86c87";
  app.post("/api/_debug/send-welcome-email", async (req, res) => {
    const auth = String(req.get("authorization") || "");
    const xtok = String(req.get("x-debug-token") || "");
    const qtok = String((req.query?.token as string) || "");
    const btok = String(req.body?.token || "");
    const bearer = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
    const got = bearer || xtok || qtok || btok || "";
    console.info(
      `[_debug/welcome] auth-check authHdrLen=${auth.length} xtokLen=${xtok.length} qtokLen=${qtok.length} btokLen=${btok.length} pickedLen=${got.length}`,
    );
    if (got !== DEBUG_EMAIL_TOKEN) {
      return res.status(401).json({
        ok: false,
        error: "unauthorized",
        hint: "send token via ?token= query or {token:...} body or x-debug-token header or Authorization: Bearer",
        debug: {
          authHdrLen: auth.length,
          xtokLen: xtok.length,
          qtokLen: qtok.length,
          btokLen: btok.length,
        },
      });
    }
    const email = String(req.body?.email ?? "").trim();
    const name = String(req.body?.name ?? "Test User").trim() || "Test User";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ ok: false, error: "invalid email" });
    }
    const cfg = emailConfigStatus();
    console.info(
      `[_debug/welcome] BEGIN to=${email} keyPresent=${cfg.hasApiKey} from=${cfg.from}`,
    );
    try {
      const { buildStripoWelcomeEmail } = await import(
        "./email/builders/stripoWelcome"
      );
      const base =
        process.env.PUBLIC_APP_URL?.replace(/\/+$/, "") ||
        "https://youssef-ahmed.fit";
      const built = buildStripoWelcomeEmail({
        clientName: name,
        dashboardUrl: `${base}/dashboard`,
        supportWhatsappUrl: "https://wa.me/971505394754",
        supportEmail: trainerEmail(),
      });
      const result = await sendEmail({
        to: email,
        subject: built.subject,
        text: built.text,
        html: built.html,
        replyTo: trainerEmail(),
      });
      console.info(
        `[_debug/welcome] DONE to=${email} sent=${result.sent} id=${result.id ?? "-"} error=${JSON.stringify(result.error ?? null)}`,
      );
      return res.json({
        ok: result.sent === true,
        functionCalled: true,
        to: email,
        from: cfg.from,
        subject: built.subject,
        resend: {
          sent: result.sent,
          provider: result.provider ?? null,
          messageId: result.id ?? null,
          error: result.error ?? null,
        },
        config: cfg,
      });
    } catch (e: any) {
      console.error("[_debug/welcome] EXCEPTION:", e?.stack || e?.message || e);
      return res.status(500).json({
        ok: false,
        error: e?.message || String(e),
        stack: e?.stack || null,
        config: cfg,
      });
    }
  });

  // POST /api/admin/test-welcome-email — sends the EXACT Stripo welcome
  // email that a real signup triggers, to an arbitrary address, and
  // returns the raw Resend response. This is the single-shot test for
  // "did my welcome trigger actually work". Mirrors the build+send used
  // inside sendWelcomeNotifications() but returns the result directly
  // so the trainer sees the message id (success) or error string (fail).
  app.post("/api/admin/test-welcome-email", requireAdmin, async (req, res) => {
    const email = String(req.body?.email ?? "").trim();
    const name = String(req.body?.name ?? "Test User").trim() || "Test User";
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res
        .status(400)
        .json({ ok: false, message: "Provide a valid `email`." });
    }
    const lang = (req.body?.lang === "ar" ? "ar" : "en") as "en" | "ar";
    const cfg = emailConfigStatus();
    console.info(
      `[admin/test-welcome-email] BEGIN to=${email} name=${JSON.stringify(name)} lang=${lang} keyPresent=${cfg.hasApiKey} from=${cfg.from}`,
    );

    // Build the Stripo welcome with the exact same builder used by the
    // production signup flow. If for any reason it throws, surface that
    // — we want zero silent swallowing in this test path.
    let built: { subject: string; text: string; html: string };
    try {
      const { buildStripoWelcomeEmail } = await import(
        "./email/builders/stripoWelcome"
      );
      const websiteBase =
        process.env.PUBLIC_APP_URL?.replace(/\/+$/, "") ||
        "https://youssef-ahmed.fit";
      built = buildStripoWelcomeEmail({
        clientName: name,
        dashboardUrl: `${websiteBase}/dashboard`,
        supportWhatsappUrl: "https://wa.me/971505394754",
        supportEmail: trainerEmail(),
      });
    } catch (e: any) {
      console.error("[admin/test-welcome-email] builder threw:", e);
      return res.status(500).json({
        ok: false,
        stage: "build",
        error: e?.message || String(e),
      });
    }

    // Send via the same pipeline (Resend HTTP + retry + ring buffer).
    let result;
    try {
      result = await sendEmail({
        to: email,
        subject: built.subject,
        text: built.text,
        html: built.html,
        replyTo: trainerEmail(),
      });
    } catch (e: any) {
      console.error("[admin/test-welcome-email] sendEmail threw:", e);
      return res.status(500).json({
        ok: false,
        stage: "send",
        error: e?.message || String(e),
        config: cfg,
      });
    }

    console.info(
      `[admin/test-welcome-email] DONE to=${email} sent=${result.sent} provider=${result.provider} id=${result.id ?? "—"} error=${JSON.stringify(result.error ?? null)}`,
    );

    res.json({
      ok: result.sent === true,
      functionCalled: true,
      to: email,
      from: cfg.from,
      subject: built.subject,
      resend: {
        sent: result.sent,
        provider: result.provider ?? null,
        messageId: result.id ?? null,
        error: result.error ?? null,
      },
      config: cfg,
    });
  });

  // GET /api/admin/email/dns — resolves SPF / DKIM / DMARC for the
  // configured From domain and reports pass/fail per record. This is
  // the single endpoint that tells you "is your domain authentication
  // actually wired up correctly". Read-only; safe to call freely.
  app.get("/api/admin/email/dns", requireAdmin, async (_req, res) => {
    const domain = fromDomain();
    const address = fromAddress();
    if (!domain) {
      return res.status(400).json({ message: "EMAIL_FROM has no parseable domain." });
    }

    type Check = {
      record: "SPF" | "DKIM" | "DMARC";
      host: string;
      status: "pass" | "fail" | "warn";
      detail: string;
      raw?: string[];
    };
    const checks: Check[] = [];

    // ---- SPF: TXT @ apex containing "v=spf1" and either "include:_spf.resend.com" or similar ----
    try {
      const txt = await dns.resolveTxt(domain);
      const flat = txt.map((parts) => parts.join(""));
      const spf = flat.find((r) => /v=spf1/i.test(r));
      if (!spf) {
        checks.push({
          record: "SPF",
          host: domain,
          status: "fail",
          detail: `No SPF record found. Add a TXT record at ${domain}: "v=spf1 include:_spf.resend.com ~all"`,
          raw: flat,
        });
      } else if (!/_spf\.resend\.com|amazonses\.com/i.test(spf)) {
        checks.push({
          record: "SPF",
          host: domain,
          status: "warn",
          detail: `SPF exists but does not authorize Resend. Add "include:_spf.resend.com" to: ${spf}`,
          raw: [spf],
        });
      } else {
        checks.push({
          record: "SPF",
          host: domain,
          status: "pass",
          detail: "SPF authorizes Resend.",
          raw: [spf],
        });
      }
    } catch (e: any) {
      checks.push({
        record: "SPF",
        host: domain,
        status: "fail",
        detail: `DNS lookup failed: ${e?.code || e?.message || "unknown"}`,
      });
    }

    // ---- DKIM: Resend uses selector "resend" by default → resend._domainkey.<domain> CNAME ----
    const dkimHost = `resend._domainkey.${domain}`;
    try {
      const cname = await dns.resolveCname(dkimHost).catch(() => null);
      if (cname && cname.length > 0) {
        checks.push({
          record: "DKIM",
          host: dkimHost,
          status: "pass",
          detail: `DKIM CNAME present → ${cname.join(", ")}`,
          raw: cname,
        });
      } else {
        const txt = await dns.resolveTxt(dkimHost).catch(() => null);
        const flat = txt ? txt.map((p) => p.join("")) : null;
        if (flat && flat.length > 0 && flat.some((r) => /v=DKIM1/i.test(r))) {
          checks.push({
            record: "DKIM",
            host: dkimHost,
            status: "pass",
            detail: "DKIM TXT present.",
            raw: flat,
          });
        } else {
          checks.push({
            record: "DKIM",
            host: dkimHost,
            status: "fail",
            detail: `No DKIM record at ${dkimHost}. Copy the CNAME shown in Resend → Domains → ${domain} into your DNS.`,
          });
        }
      }
    } catch (e: any) {
      checks.push({
        record: "DKIM",
        host: dkimHost,
        status: "fail",
        detail: `DNS lookup failed: ${e?.code || e?.message || "unknown"}`,
      });
    }

    // ---- DMARC: TXT @ _dmarc.<domain> with v=DMARC1 ----
    const dmarcHost = `_dmarc.${domain}`;
    try {
      const txt = await dns.resolveTxt(dmarcHost);
      const flat = txt.map((p) => p.join(""));
      const dmarc = flat.find((r) => /v=DMARC1/i.test(r));
      if (!dmarc) {
        checks.push({
          record: "DMARC",
          host: dmarcHost,
          status: "fail",
          detail: `No DMARC record. Add TXT at ${dmarcHost}: "v=DMARC1; p=none; rua=mailto:${trainerEmail()}"`,
          raw: flat,
        });
      } else {
        const policy = /p=(none|quarantine|reject)/i.exec(dmarc)?.[1] ?? "none";
        checks.push({
          record: "DMARC",
          host: dmarcHost,
          status: "pass",
          detail: `DMARC present (policy=${policy}).`,
          raw: [dmarc],
        });
      }
    } catch (e: any) {
      checks.push({
        record: "DMARC",
        host: dmarcHost,
        status: "fail",
        detail: `No DMARC record. Add TXT at ${dmarcHost}: "v=DMARC1; p=none; rua=mailto:${trainerEmail()}"`,
      });
    }

    const overall = checks.every((c) => c.status === "pass")
      ? "pass"
      : checks.some((c) => c.status === "fail")
        ? "fail"
        : "warn";

    res.json({
      from: address,
      domain,
      overall,
      checks,
      next_steps:
        overall === "pass"
          ? "All authentication records pass. Sending should be trusted by Gmail, Outlook, and university gateways."
          : `Fix the records flagged 'fail' above in your DNS provider for ${domain}, then re-run this check.`,
    });
  });

  // GET /api/admin/email/health — single go/no-go verdict combining
  // RESEND_API_KEY presence, From-domain DNS authentication (SPF/DKIM/
  // DMARC), and recent send health. Use this as the production smoke
  // test after wiring DNS records.
  app.get("/api/admin/email/health", requireAdmin, async (_req, res) => {
    const cfg = emailConfigStatus();
    const recent = getRecentEmailSends(20);
    const recentSent = recent.filter((e) => e.sent).length;
    const recentFailed = recent.filter((e) => !e.sent).length;

    let dnsOverall: "pass" | "warn" | "fail" | "unknown" = "unknown";
    let dnsDetail: string[] = [];
    const domain = fromDomain();
    if (domain) {
      try {
        const txt = await dns.resolveTxt(domain).catch(() => [] as string[][]);
        const flat = txt.map((p) => p.join(""));
        const spfPass = flat.some(
          (r) => /v=spf1/i.test(r) && /_spf\.resend\.com|amazonses\.com/i.test(r),
        );
        const dkimCname = await dns.resolveCname(`resend._domainkey.${domain}`).catch(() => null);
        const dkimTxt = await dns.resolveTxt(`resend._domainkey.${domain}`).catch(() => null);
        const dkimPass = !!(
          (dkimCname && dkimCname.length > 0) ||
          (dkimTxt && dkimTxt.some((p) => /v=DKIM1/i.test(p.join(""))))
        );
        const dmarcTxt = await dns.resolveTxt(`_dmarc.${domain}`).catch(() => [] as string[][]);
        const dmarcPass = dmarcTxt.some((p) => /v=DMARC1/i.test(p.join("")));
        if (spfPass && dkimPass && dmarcPass) dnsOverall = "pass";
        else if (!spfPass && !dkimPass && !dmarcPass) dnsOverall = "fail";
        else dnsOverall = "warn";
        dnsDetail = [
          `SPF: ${spfPass ? "pass" : "fail"}`,
          `DKIM: ${dkimPass ? "pass" : "fail"}`,
          `DMARC: ${dmarcPass ? "pass" : "fail"}`,
        ];
      } catch (e: any) {
        dnsOverall = "fail";
        dnsDetail = [`DNS lookup error: ${e?.message || "unknown"}`];
      }
    }

    const ready =
      cfg.ready &&
      dnsOverall === "pass" &&
      (recent.length === 0 || recentFailed === 0 || recentSent > 0);
    res.json({
      ready,
      verdict: ready
        ? "OK — production email delivery is healthy."
        : !cfg.ready
          ? "BLOCKED — RESEND_API_KEY missing in env."
          : dnsOverall !== "pass"
            ? `BLOCKED — domain authentication for ${domain} is not fully configured.`
            : "DEGRADED — recent sends are failing; check /api/admin/email/status.",
      config: cfg,
      from: fromAddress(),
      domain,
      dns: { overall: dnsOverall, detail: dnsDetail },
      recent: { total: recent.length, sent: recentSent, failed: recentFailed },
    });
  });

  // GET /api/admin/email/preview — renders every email builder with
  // realistic sample data and returns name/subject/textLength/htmlLength/
  // ok/error per template. Lets the trainer verify dynamic variables,
  // counters, and branding consistency without sending real mail.
  // POST /api/admin/email/preview { to } sends ALL 18 templates to one
  // recipient as a full delivery + rendering smoke-test.
  const renderAllTemplates = () => {
    const sampleBooking = {
      clientName: "Sara Khalil",
      date: "2026-05-20",
      time12: "9:00 AM",
      sessionFocusLabel: "Strength + Conditioning",
      trainingGoalLabel: "Fat loss",
      sessionTypeLabel: "Package",
      packageName: "Premium 12 (3×/week)",
      remainingSessions: 8,
      packageExpiryDate: "2026-06-30",
      currentSessionNumber: 4,
      totalSessions: 12,
      partnerFullName: null,
      partnerPhone: null,
      partnerEmail: null,
    };
    const items: Array<{ name: string; subject?: string; ok: boolean; htmlLength?: number; textLength?: number; html?: string; text?: string; error?: string }> = [];
    const run = (name: string, fn: () => { subject: string; html: string; text: string }) => {
      try {
        const built = fn();
        items.push({
          name,
          subject: built.subject,
          ok: true,
          htmlLength: built.html.length,
          textLength: built.text.length,
          html: built.html,
          text: built.text,
        });
        return built;
      } catch (e: any) {
        items.push({ name, ok: false, error: e?.message || "render failed" });
        return null;
      }
    };

    // Premium-with-legacy-fallback wrappers — mirror production wiring
    // (server/notifications.ts welcome path, server/routes.ts cron
    // reminders path) so the admin preview reflects what real recipients
    // actually receive.
    const baseUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "") || "https://example.com";
    const buildWelcomePreferPremium = (lang: "en" | "ar" = "en") => {
      try {
        return buildWelcomeEmailPremium({
          lang,
          recipientName: "Sara Khalil",
          bookingUrl: `${baseUrl}/book`,
          whatsappUrl: "https://wa.me/971505394754",
          supportEmail: trainerEmail(),
          trainerName: lang === "ar" ? "المدرب يوسف" : "Coach Youssef",
          studioLocation: lang === "ar" ? "مرسى دبي" : "Dubai Marina studio",
        });
      } catch (e) {
        console.warn("[email/preview] premium welcome failed, falling back to legacy:", e);
        return buildWelcomeEmail({ clientName: "Sara Khalil", lang });
      }
    };
    const buildReminderPreferPremium = (kind: "24h" | "1h", lang: "en" | "ar" = "en") => {
      try {
        return buildSessionReminderEmailPremium({
          kind,
          lang,
          recipientName: "Sara Khalil",
          date: sampleBooking.date,
          time12: sampleBooking.time12,
          sessionFocus: sampleBooking.sessionFocusLabel,
          location: lang === "ar" ? "استوديو المدرب يوسف، مرسى دبي" : "Coach Youssef's studio, Dubai Marina",
          bookingUrl: `${baseUrl}/dashboard`,
          rescheduleUrl: `${baseUrl}/book`,
          supportEmail: trainerEmail(),
        });
      } catch (e) {
        console.warn(`[email/preview] premium reminder ${kind} failed, falling back to legacy:`, e);
        return buildSessionReminderEmail({ data: sampleBooking, lang, kind });
      }
    };

    run("client.welcome", () => buildWelcomePreferPremium("en"));
    run("client.bookingConfirmation", () =>
      buildClientBookingConfirmationEmail({ data: sampleBooking, lang: "en" }),
    );
    run("client.reminder24h", () => buildReminderPreferPremium("24h", "en"));
    run("client.reminder1h", () => buildReminderPreferPremium("1h", "en"));
    run("client.packageExpiring", () =>
      buildPackageExpiringEmail({
        clientName: "Sara Khalil",
        lang: "en",
        remainingSessions: 2,
        daysUntilExpiry: 5,
        packageName: "Premium 12",
      }),
    );
    run("client.packageFinished", () =>
      buildPackageFinishedEmail({
        clientName: "Sara Khalil",
        lang: "en",
        packageName: "Premium 12",
      }),
    );
    run("client.passwordReset", () =>
      buildPasswordResetEmail({
        resetUrl: "https://example.com/reset-password?token=sample",
        lang: "en",
      }),
    );
    run("admin.newClient", () =>
      buildAdminNewClientEmail({
        clientName: "Sara Khalil",
        email: "sara@example.com",
        phone: "+971 50 123 4567",
        primaryGoal: "Fat loss",
        weeklyFrequency: 3,
        area: "Dubai Marina",
        packageName: "Premium 12",
        packagePrice: 2500,
      }),
    );
    run("admin.newBooking", () =>
      buildAdminBookingEmail({
        d: sampleBooking,
        clientEmail: "sara@example.com",
        clientPhone: "+971 50 123 4567",
        clientNotes: "Please focus on hamstrings.",
      }),
    );
    run("admin.bookingCancellation", () =>
      buildAdminBookingChangeEmail({
        kind: "cancellation",
        clientName: "Sara Khalil",
        date: "2026-05-20",
        time12: "9:00 AM",
        reason: "Client requested cancellation.",
      }),
    );
    run("admin.bookingReschedule", () =>
      buildAdminBookingChangeEmail({
        kind: "reschedule",
        clientName: "Sara Khalil",
        date: "2026-05-22",
        time12: "10:00 AM",
        fromDate: "2026-05-20",
        fromTime12: "9:00 AM",
      }),
    );
    run("admin.packageExpiringAlert", () =>
      buildAdminPackageExpiringEmail({
        clientName: "Sara Khalil",
        packageName: "Premium 12",
        remainingSessions: 2,
        daysUntilExpiry: 5,
      } as any),
    );
    run("admin.attendance", () =>
      buildAdminAttendanceEmail({
        attendance: "attended",
        clientName: "Sara Khalil",
        date: "2026-05-20",
        time12: "9:00 AM",
        packageName: "Premium 12",
        remainingSessions: 7,
      }),
    );
    run("admin.emergencyCancel", () =>
      buildAdminEmergencyCancelEmail({
        clientName: "Sara Khalil",
        date: "2026-05-20",
        time12: "9:00 AM",
        monthlyQuotaUsed: 1,
        monthlyQuotaTotal: 2,
        reason: "Family emergency.",
      }),
    );
    run("admin.payment", () =>
      buildAdminPaymentEmail({
        clientName: "Sara Khalil",
        packageName: "Premium 12",
        paymentStatus: "paid",
        amountReceived: 2500,
        amountPaidTotal: 2500,
        packageTotal: 2500,
      }),
    );
    run("admin.packageActivated", () =>
      buildAdminPackageActivatedEmail({
        clientName: "Sara Khalil",
        packageName: "Premium 12",
        totalSessions: 12,
        paidSessions: 12,
        bonusSessions: 0,
        totalPrice: 2500,
        startDate: "2026-05-15",
        expiryDate: "2026-06-30",
        paymentStatus: "paid",
        source: "new",
      }),
    );
    run("admin.packageExpired", () =>
      buildAdminPackageExpiredEmail({
        clientName: "Sara Khalil",
        packageName: "Premium 12",
        reason: "sessions_exhausted",
        totalSessions: 12,
        expiryDate: "2026-06-30",
      }),
    );
    run("admin.packageExtended", () =>
      buildAdminPackageExtendedEmail({
        clientName: "Sara Khalil",
        packageName: "Premium 12",
        daysAdded: 7,
        previousExpiry: "2026-06-30",
        newExpiry: "2026-07-07",
        reason: "Client travel.",
      }),
    );
    run("admin.profileUpdate", () =>
      buildAdminProfileUpdateEmail({
        clientName: "Sara Khalil",
        changes: [
          ["Phone", "+971 50 123 4567 → +971 55 987 6543"],
          ["Weekly frequency", "3×/week → 4×/week"],
        ],
      }),
    );

    return items;
  };

  // GET /api/admin/email/lint — runs structural deliverability checks
  // on every rendered template (Gmail clip risk, table balance, image
  // origins, viewport/dark/mobile media hooks, CTA button tables,
  // subject CRLF). No emails are sent.
  app.get("/api/admin/email/lint", requireAdmin, (_req, res) => {
    const items = renderAllTemplates();
    const GMAIL_CLIP = 102 * 1024;
    const checks = items.map((it) => {
      if (!it.ok) return { name: it.name, ok: false, error: it.error };
      const html = (it as any).html as string | undefined;
      const subject = (it as any).subject as string | undefined;
      const bytes = html ? Buffer.byteLength(html, "utf8") : 0;
      const oTbl = (html?.match(/<table\b/gi) || []).length;
      const cTbl = (html?.match(/<\/table>/gi) || []).length;
      const oTr = (html?.match(/<tr\b/gi) || []).length;
      const cTr = (html?.match(/<\/tr>/gi) || []).length;
      const oTd = (html?.match(/<td\b/gi) || []).length;
      const cTd = (html?.match(/<\/td>/gi) || []).length;
      const imgs = html ? Array.from(html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi), (m) => m[1]) : [];
      const widths = html ? Array.from(html.matchAll(/width=["']?(\d+)["']?/gi), (m) => +m[1]) : [];
      const failures: string[] = [];
      if (bytes >= GMAIL_CLIP) failures.push(`gmail-clip:${bytes}b`);
      if (oTbl !== cTbl || oTr !== cTr || oTd !== cTd) failures.push(`tables-unbalanced:${oTbl}/${cTbl} ${oTr}/${cTr} ${oTd}/${cTd}`);
      if (widths.length && Math.max(...widths) > 640) failures.push(`width>${Math.max(...widths)}`);
      if (html && !/name=["']viewport/i.test(html)) failures.push("no-viewport");
      if (html && !/color-scheme/i.test(html)) failures.push("no-dark-color-scheme");
      if (html && !/@media[^{]*max-width/i.test(html)) failures.push("no-mobile-media");
      if (html && !/<table[^>]*role=["']?presentation/i.test(html)) failures.push("no-button-table");
      if (subject && /[\r\n]/.test(subject)) failures.push("subject-crlf");
      return {
        name: it.name,
        ok: failures.length === 0,
        kb: +(bytes / 1024).toFixed(1),
        gmailClip: bytes >= GMAIL_CLIP ? "CLIP" : bytes >= GMAIL_CLIP * 0.9 ? "WARN" : "OK",
        externalImgs: imgs.filter((s) => /^https?:/i.test(s)).length,
        dataImgs: imgs.filter((s) => /^data:/i.test(s)).length,
        externalImgUrls: imgs.filter((s) => /^https?:/i.test(s)),
        maxWidth: widths.length ? Math.max(...widths) : 0,
        failures,
      };
    });
    const failed = checks.filter((c) => !c.ok);
    res.json({
      total: checks.length,
      passed: checks.length - failed.length,
      failed: failed.length,
      verdict: failed.length === 0 ? "PASS" : "FAIL",
      items: checks,
      failures: failed,
    });
  });

  app.get("/api/admin/email/preview", requireAdmin, (_req, res) => {
    const items = renderAllTemplates().map(({ html, text, ...rest }) => rest);
    const ok = items.filter((i) => i.ok).length;
    const failed = items.filter((i) => !i.ok);
    res.json({
      total: items.length,
      ok,
      failed: failed.length,
      items,
      failures: failed,
    });
  });

  app.post("/api/admin/email/preview", requireAdmin, async (req, res) => {
    const to = String(req.body?.to ?? "").trim();
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ message: "Provide a valid `to` email address." });
    }
    const sendResults: Array<{ name: string; sent: boolean; id?: string; error?: string }> = [];
    const sampleBooking = {
      clientName: "Sara Khalil",
      date: "2026-05-20",
      time12: "9:00 AM",
      sessionFocusLabel: "Strength + Conditioning",
      trainingGoalLabel: "Fat loss",
      sessionTypeLabel: "Package",
      packageName: "Premium 12 (3×/week)",
      remainingSessions: 8,
      packageExpiryDate: "2026-06-30",
      currentSessionNumber: 4,
      totalSessions: 12,
      partnerFullName: null,
      partnerPhone: null,
      partnerEmail: null,
    };

    // Premium-with-legacy-fallback for welcome + reminders so the admin
    // bulk-send preview delivers what production actually dispatches.
    const baseUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "") || "https://example.com";
    const previewWelcome = (lang: "en" | "ar" = "en") => {
      try {
        return buildWelcomeEmailPremium({
          lang, recipientName: "Sara Khalil",
          bookingUrl: `${baseUrl}/book`,
          whatsappUrl: "https://wa.me/971505394754",
          supportEmail: trainerEmail(),
          trainerName: lang === "ar" ? "المدرب يوسف" : "Coach Youssef",
          studioLocation: lang === "ar" ? "مرسى دبي" : "Dubai Marina studio",
        });
      } catch (e) {
        console.warn("[email/send-preview] premium welcome failed, legacy fallback:", e);
        return buildWelcomeEmail({ clientName: "Sara Khalil", lang });
      }
    };
    const previewReminder = (kind: "24h" | "1h", lang: "en" | "ar" = "en") => {
      try {
        return buildSessionReminderEmailPremium({
          kind, lang, recipientName: "Sara Khalil",
          date: sampleBooking.date, time12: sampleBooking.time12,
          sessionFocus: sampleBooking.sessionFocusLabel,
          location: lang === "ar" ? "استوديو المدرب يوسف، مرسى دبي" : "Coach Youssef's studio, Dubai Marina",
          bookingUrl: `${baseUrl}/dashboard`,
          rescheduleUrl: `${baseUrl}/book`,
          supportEmail: trainerEmail(),
        });
      } catch (e) {
        console.warn(`[email/send-preview] premium reminder ${kind} failed, legacy fallback:`, e);
        return buildSessionReminderEmail({ data: sampleBooking, lang, kind });
      }
    };

    type Job = { name: string; build: () => { subject: string; html: string; text: string } };
    const jobs: Job[] = [
      { name: "client.welcome", build: () => previewWelcome("en") },
      { name: "client.bookingConfirmation", build: () => buildClientBookingConfirmationEmail({ data: sampleBooking, lang: "en" }) },
      { name: "client.reminder24h", build: () => previewReminder("24h", "en") },
      { name: "client.reminder1h", build: () => previewReminder("1h", "en") },
      { name: "client.packageExpiring", build: () => buildPackageExpiringEmail({ clientName: "Sara Khalil", lang: "en", remainingSessions: 2, daysUntilExpiry: 5, packageName: "Premium 12" }) },
      { name: "client.packageFinished", build: () => buildPackageFinishedEmail({ clientName: "Sara Khalil", lang: "en", packageName: "Premium 12" }) },
      { name: "client.passwordReset", build: () => buildPasswordResetEmail({ resetUrl: "https://example.com/reset-password?token=sample", lang: "en" }) },
      { name: "admin.newClient", build: () => buildAdminNewClientEmail({ clientName: "Sara Khalil", email: "sara@example.com", phone: "+971 50 123 4567", primaryGoal: "Fat loss", weeklyFrequency: 3, area: "Dubai Marina", packageName: "Premium 12", packagePrice: 2500 }) },
      { name: "admin.newBooking", build: () => buildAdminBookingEmail({ d: sampleBooking, clientEmail: "sara@example.com", clientPhone: "+971 50 123 4567", clientNotes: "Please focus on hamstrings." }) },
      { name: "admin.bookingCancellation", build: () => buildAdminBookingChangeEmail({ kind: "cancellation", clientName: "Sara Khalil", date: "2026-05-20", time12: "9:00 AM", reason: "Client requested cancellation." }) },
      { name: "admin.bookingReschedule", build: () => buildAdminBookingChangeEmail({ kind: "reschedule", clientName: "Sara Khalil", date: "2026-05-22", time12: "10:00 AM", fromDate: "2026-05-20", fromTime12: "9:00 AM" }) },
      { name: "admin.packageExpiringAlert", build: () => buildAdminPackageExpiringEmail({ clientName: "Sara Khalil", packageName: "Premium 12", remainingSessions: 2, daysUntilExpiry: 5 } as any) },
      { name: "admin.attendance", build: () => buildAdminAttendanceEmail({ attendance: "attended", clientName: "Sara Khalil", date: "2026-05-20", time12: "9:00 AM", packageName: "Premium 12", remainingSessions: 7 }) },
      { name: "admin.emergencyCancel", build: () => buildAdminEmergencyCancelEmail({ clientName: "Sara Khalil", date: "2026-05-20", time12: "9:00 AM", monthlyQuotaUsed: 1, monthlyQuotaTotal: 2, reason: "Family emergency." }) },
      { name: "admin.payment", build: () => buildAdminPaymentEmail({ clientName: "Sara Khalil", packageName: "Premium 12", paymentStatus: "paid", amountReceived: 2500, amountPaidTotal: 2500, packageTotal: 2500 }) },
      { name: "admin.packageActivated", build: () => buildAdminPackageActivatedEmail({ clientName: "Sara Khalil", packageName: "Premium 12", totalSessions: 12, paidSessions: 12, bonusSessions: 0, totalPrice: 2500, startDate: "2026-05-15", expiryDate: "2026-06-30", paymentStatus: "paid", source: "new" }) },
      { name: "admin.packageExpired", build: () => buildAdminPackageExpiredEmail({ clientName: "Sara Khalil", packageName: "Premium 12", reason: "sessions_exhausted", totalSessions: 12, expiryDate: "2026-06-30" }) },
      { name: "admin.packageExtended", build: () => buildAdminPackageExtendedEmail({ clientName: "Sara Khalil", packageName: "Premium 12", daysAdded: 7, previousExpiry: "2026-06-30", newExpiry: "2026-07-07", reason: "Client travel." }) },
      { name: "admin.profileUpdate", build: () => buildAdminProfileUpdateEmail({ clientName: "Sara Khalil", changes: [["Phone", "+971 50 123 4567 → +971 55 987 6543"], ["Weekly frequency", "3×/week → 4×/week"]] }) },
    ];

    // Sequential to respect Resend rate limits and produce ordered results.
    for (const job of jobs) {
      try {
        const built = job.build();
        const r = await sendEmail({
          to,
          subject: `[PREVIEW ${job.name}] ${built.subject}`,
          text: built.text,
          html: built.html,
          replyTo: trainerEmail(),
        });
        sendResults.push({ name: job.name, sent: r.sent, id: r.id, error: r.error });
      } catch (e: any) {
        sendResults.push({ name: job.name, sent: false, error: e?.message || "build failed" });
      }
    }

    const ok = sendResults.filter((r) => r.sent).length;
    res.json({
      to,
      total: sendResults.length,
      sent: ok,
      failed: sendResults.length - ok,
      results: sendResults,
    });
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
          const timeDual = formatTimeDualServer(booking.timeSlot);
          const owner = await storage.getUser(booking.userId).catch(() => undefined);
          const ownerName =
            owner?.fullName?.trim() || owner?.username || `Client #${booking.userId}`;

          const details: BookingDetails = {
            clientName: partnerName,
            date: booking.date,
            time12: timeDual,
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
            // Migrated to the NEW design system. Same try/legacy-fallback
            // pattern as the primary client + admin sites so a duo partner
            // link can never silently revert to the plain template.
            console.log("[email-route] duo-partner → renderer = PREMIUM (buildBookingConfirmationEmail)");
            let built: { subject: string; html: string; text: string };
            try {
              const pLang: "en" | "ar" = partnerLang === "ar" ? "ar" : "en";
              built = buildBookingConfirmationEmail({
                lang: pLang,
                recipientName: partnerName,
                date: booking.date,
                time12: timeDual,
                sessionFocus: sessionFocusLabel,
                trainingGoal: trainingGoalLabel,
                location: "Coach Youssef's studio, Dubai",
                sessionType: sessionTypeLabel,
                packageName: null,
                clientEmail: partnerUser.email,
                clientPhone: partnerUser.phone ?? null,
                bookingUrl: ((process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "") || "") + "/dashboard",
                rescheduleUrl: ((process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "") || "") + "/dashboard",
                supportEmail: trainerEmail(),
              });
            } catch (newBuilderErr) {
              console.warn("[email-route] FALLBACK activated (duo-partner) — premium builder threw:", newBuilderErr);
              built = buildClientBookingConfirmationEmail({ data: details, lang: partnerLang });
            }
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
            `${booking.date} at ${timeDual} with ${ownerName} — ${sessionFocusLabel}`,
            { link: "/dashboard", meta: { bookingId: booking.id, partnerOf: booking.userId } },
          );
        } catch (e) {
          console.warn("[link-partner] partner notify failed:", e);
        }
      })();
    }

    await audit(req, "booking.link_partner", "booking", id,
      { userId: booking.userId, linkedPartnerUserId: booking.linkedPartnerUserId ?? null },
      { userId: booking.userId, linkedPartnerUserId: parsed.data.partnerUserId, override: !!parsed.data.override });
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
    await audit(req, "booking.unlink_partner", "booking", id,
      { userId: booking.userId, linkedPartnerUserId: booking.linkedPartnerUserId },
      { userId: booking.userId, linkedPartnerUserId: null });
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
    const cutoffMs = (settings.cancellationCutoffHours ?? 3) * 60 * 60 * 1000;
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
          } for this month. Contact support through the platform for further assistance.`,
        });
      }
      newStatus = "free_cancelled";
      usedProtected = true;
    } else {
      return res.status(400).json({
        message: `Cancellation locked. Less than ${settings.cancellationCutoffHours} hours remain. Use a Protected Cancellation if available, or contact support through the platform.`,
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

    // Best-effort admin email — never blocks the response. Protected
    // cancellations route to the dedicated VIP-styled template with the
    // monthly quota snapshot; everything else uses the generic builder.
    {
      let monthlyQuotaUsed: number | null = null;
      let monthlyQuotaTotal: number | null = null;
      if (usedProtected) {
        try {
          const actorAfter = await storage.getUser(me.id);
          monthlyQuotaUsed = actorAfter?.protectedCancelCount ?? null;
          monthlyQuotaTotal = protectedCancellationQuota(actorAfter?.vipTier);
        } catch { /* ignore */ }
      }
      void dispatchBookingChangeNotification({
        kind: "cancellation",
        booking,
        reason: usedProtected
          ? "Protected cancellation"
          : isWithinCutoff
            ? "Late cancellation"
            : "Free cancellation (outside cutoff)",
        protectedCancel: usedProtected,
        monthlyQuotaUsed,
        monthlyQuotaTotal,
      });
    }

    // P5b / Task #6: Anyone who didn't initiate this cancellation needs
    // to know. That includes the booking owner (when an admin or the
    // partner cancels) AND the linked Duo partner (when an admin or the
    // owner cancels). Self-cancellations are skipped — the actor sees
    // the result in the UI. dedupeKey is recipient-scoped so re-cancels
    // are idempotent for each recipient independently.
    {
      const timeDual = formatTimeDualServer(booking.timeSlot);
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
          `Your session on ${booking.date} at ${timeDual} was cancelled. Tap to rebook.`,
          { link: "/book", meta: { bookingId: booking.id } },
        );
      }
    }

    // Task #55: notify the first eligible waitlist entry for this slot.
    // Only fires if the cancellation actually frees the slot — i.e. the
    // booking transitioned to a status that opens the (date,time_slot)
    // back up for booking. `claimWaitlistEntry` is atomic so concurrent
    // cancel-hooks notify exactly one client. Best-effort, swallowed.
    if (["cancelled", "free_cancelled", "late_cancelled"].includes(newStatus)) {
      void (async () => {
        try {
          const entries = await storage.getWaitlistEntriesForSlot(
            booking.date,
            booking.timeSlot,
          );
          // Skip rows already notified; cancel-hook is idempotent.
          const next = entries.find((e) => e.notifiedAt == null);
          if (!next) return;
          const claimed = await storage.claimWaitlistEntry(next.id);
          if (!claimed) return; // raced — another worker took it
          const timeDualNotif = formatTimeDualServer(booking.timeSlot);
          // Task #56: canonical kind is `waitlist_slot_available`. The
          // dedupeKey is unchanged so an in-flight claim that previously
          // wrote `waitlist_open` is still deduped by the partial index.
          await notifyUserOnce(
            claimed.userId,
            "waitlist_slot_available",
            `waitlist-open-${booking.date}-${booking.timeSlot}-${claimed.userId}`,
            "A spot opened up",
            `Your waitlisted ${booking.date} ${timeDualNotif} slot is free — book it before someone else does.`,
            { link: "/book", meta: { date: booking.date, timeSlot: booking.timeSlot } },
          );
          const recipient = await storage.getUser(claimed.userId).catch(() => undefined);
          if (recipient?.email) {
            const baseUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");
            const bookUrl = baseUrl ? `${baseUrl}/book` : "/book";
            const subject = `A spot opened up — ${booking.date} at ${timeDualNotif}`;
            const text =
              `Hi ${recipient.fullName || recipient.username || "there"},\n\n` +
              `The session you waitlisted just opened up:\n` +
              `  ${booking.date} at ${timeDualNotif} (Dubai time)\n\n` +
              `Spots go fast — book it now: ${bookUrl}\n\n` +
              `If you've changed your mind, you can leave the waitlist from your dashboard.\n\n` +
              `— Youssef Fitness`;
            const html =
              `<div style="font-family:system-ui,-apple-system,sans-serif;background:#050505;color:#e4e4e4;padding:32px;border-radius:16px;max-width:520px;margin:auto">` +
              `<h2 style="color:#5ee7ff;margin:0 0 12px">A spot opened up</h2>` +
              `<p>The session you waitlisted just opened:</p>` +
              `<p style="font-size:18px;font-weight:600">${booking.date} at ${timeDualNotif} <span style="color:#888">(Dubai)</span></p>` +
              `<p><a href="${bookUrl}" style="display:inline-block;background:#5ee7ff;color:#000;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:700">Book it now</a></p>` +
              `<p style="color:#888;font-size:12px;margin-top:24px">Spots go fast — book quickly. You can leave the waitlist from your dashboard at any time.</p>` +
              `</div>`;
            await sendEmail({
              to: recipient.email,
              subject,
              text,
              html,
              replyTo: trainerEmail(),
            });
          }
        } catch (e) {
          console.warn("[waitlist] cancel-hook notify failed:", e);
        }
      })();
    }

    // Task #57 — log every admin-initiated cancellation (force-cancel).
    // Client-initiated cancellations are intentionally NOT audited here:
    // the audit feed is the *admin* mutation trail, not the client
    // activity feed (which already surfaces booking status transitions).
    if (me.role === "admin") {
      await audit(req, "booking.force_cancel", "booking", booking.id,
        { userId: booking.userId, status: booking.status, date: booking.date, timeSlot: booking.timeSlot },
        { userId: booking.userId, status: newStatus, cancelledAt: new Date().toISOString() });
    }

    res.json(sanitizeBookingForUser(me, updated));
  });

  // =========================================================
  // Task #55 — Waitlist (client-facing)
  // =========================================================
  // Clients queue on a specific (date, time_slot). When the cancel hook
  // above fires, the first un-notified entry for that slot is atomically
  // claimed and notified via in-app + email. Self-service join/leave;
  // unique on (user_id, date, time_slot) so duplicates aren't possible.

  app.get("/api/waitlist/mine", requireAuth, async (req, res) => {
    const me = req.user as User;
    const rows = await storage.getWaitlistEntriesForUser(me.id);
    res.json(rows);
  });

  app.post("/api/waitlist", requireAuth, async (req, res) => {
    const me = req.user as User;
    const date = typeof req.body?.date === "string" ? req.body.date : "";
    const timeSlot = typeof req.body?.timeSlot === "string" ? req.body.timeSlot : "";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(timeSlot)) {
      return res.status(400).json({ message: "Invalid date or time slot." });
    }
    // Don't waitlist a slot that's already free — just book it.
    const taken = await storage.getBookingByDateAndSlot(date, timeSlot);
    if (
      !taken ||
      ["cancelled", "free_cancelled", "late_cancelled"].includes(taken.status)
    ) {
      return res.status(400).json({
        message: "This slot is currently free — book it directly instead of waitlisting.",
        code: "slot_free",
      });
    }
    // Slot must be in the future (anchor to Dubai for fairness with the
    // booking grid). A waitlist for a past slot is useless.
    const sessionAt = buildSessionDate(date, timeSlot);
    if (sessionAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "Cannot waitlist a past slot." });
    }
    try {
      const row = await storage.createWaitlistEntry({
        userId: me.id,
        date,
        timeSlot,
      });
      res.status(201).json(row);
    } catch (e: any) {
      // Unique index collision — the user is already queued for this slot.
      if (e?.code === "23505") {
        return res.status(409).json({
          message: "You're already on the waitlist for this slot.",
          code: "already_waitlisted",
        });
      }
      throw e;
    }
  });

  app.delete("/api/waitlist/:id", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    const removed = await storage.deleteWaitlistEntry(id, me.id);
    if (!removed) return res.status(404).json({ message: "Waitlist entry not found" });
    res.json({ ok: true });
  });

  // =========================================================
  // Task #55 — Add to Calendar (.ics)
  // =========================================================
  // Generates an RFC-5545 VEVENT for a confirmed booking. All times are
  // anchored to Dubai (UTC+4, no DST) via the +04:00 suffix on the local
  // datetime string. Auth-gated to the booking owner / linked partner /
  // admin so .ics URLs can't enumerate other clients' sessions.
  app.get("/api/bookings/:id/calendar.ics", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).send("Invalid id");
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).send("Not found");
    const isOwner = booking.userId === me.id;
    const isPartner =
      typeof (booking as any).linkedPartnerUserId === "number" &&
      (booking as any).linkedPartnerUserId === me.id;
    if (me.role !== "admin" && !isOwner && !isPartner) {
      return res.status(403).send("Forbidden");
    }
    const start = new Date(`${booking.date}T${booking.timeSlot}:00+04:00`);
    const end = new Date(start.getTime() + 60 * 60_000);
    const pad = (n: number) => (n < 10 ? `0${n}` : String(n));
    const stamp = (d: Date) =>
      d.getUTCFullYear().toString() +
      pad(d.getUTCMonth() + 1) +
      pad(d.getUTCDate()) +
      "T" +
      pad(d.getUTCHours()) +
      pad(d.getUTCMinutes()) +
      pad(d.getUTCSeconds()) +
      "Z";
    const esc = (s: string) =>
      s.replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
    const focus = (booking as any).sessionFocus || "Training session";
    const title = `Training with Coach Youssef — ${focus}`;
    const description = `Session focus: ${focus}\nBooked via youssefahmed.com\n\nNeed to reschedule? Open your dashboard.`;
    const location = "Coach Youssef's studio, Dubai Marina";
    const ics = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Youssef Elite//Booking//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VEVENT",
      `UID:booking-${booking.id}@youssefahmed`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART:${stamp(start)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(title)}`,
      `DESCRIPTION:${esc(description)}`,
      `LOCATION:${esc(location)}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="session-${booking.id}.ics"`);
    res.send(ics);
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
            "Same-Day Adjustments are not available on your current membership level. Contact support through the platform for assistance.",
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
      const newTimeDual = formatTimeDualServer(newTimeSlot);
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
          `Your session moved to ${newTimeDual} on ${booking.date}.`,
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
        const cutoffMs = (settings.cancellationCutoffHours ?? 3) * 60 * 60 * 1000;
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
    const fromTimeDual = formatTimeDualServer(booking.timeSlot);
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
        fromTime12: fromTimeDual,
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
      const newTimeDual = formatTimeDualServer(newSlot);
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
          `Your session moved from ${fromDate} ${fromTimeDual} → ${newDate} ${newTimeDual}.`,
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
    // Task #74 — re-evaluate badges on any completion transition. Pure
    // fire-and-forget so a slow evaluation never blocks the PATCH; the
    // evaluator wraps all I/O in try/catch internally.
    if (newStatus === "completed" && previousStatus !== "completed") {
      void evaluateAndAwardBadges(booking.userId);
    }
    res.json(sanitizeBookingForUser(me, updated));
  });

  app.delete("/api/bookings/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    // Snapshot before delete so audit retains userId/date/timeSlot/status.
    const before = await storage.getBooking(id).catch(() => null);
    await storage.deleteBooking(id);
    await audit(req, "booking.delete", "booking", id,
      before ? { userId: before.userId, date: before.date, timeSlot: before.timeSlot, status: before.status } : null,
      null);
    res.sendStatus(204);
  });

  // (Task #3 partner-side confirmation email + in-app notify is now
  // wired inline into HEAD's /api/admin/bookings/:id/link-partner above
  // so we only have ONE link route; the duplicate block was removed.)

  // ============== SETTINGS ==============
  // ============== FEATURE FLAGS (Phase 5) ==============
  // Public GET — every client polls this on boot so the maintenance
  // screen and module switches react without a hard refresh. Cheap
  // (one indexed SELECT) and cached on the client via TanStack Query.
  app.get("/api/feature-flags", async (_req, res) => {
    try {
      const rows = await storage.listFeatureFlags();
      const flags: Record<string, boolean> = { ...(FEATURE_FLAG_DEFAULTS as any) };
      for (const r of rows) flags[r.key] = r.enabled;
      res.json(flags);
    } catch (e) {
      // Never let a flags read break the app — fall through to defaults.
      console.warn("[feature-flags] list failed:", (e as Error).message);
      res.json({ ...(FEATURE_FLAG_DEFAULTS as any) });
    }
  });

  // Admin-only flip. Rate-limited so a misbehaving admin script can't
  // hammer the DB. Records an audit-log entry on success.
  app.patch(
    "/api/admin/feature-flags/:key",
    rateLimit({ windowMs: 60_000, max: RL.adminFlag, key: "admin-flag" }),
    requireAdmin,
    async (req, res) => {
      const key = String(req.params.key);
      const allowed = new Set<string>(FEATURE_FLAG_KEYS as any);
      if (!allowed.has(key)) {
        return res.status(400).json({ message: "Unknown feature flag" });
      }
      const enabled = req.body?.enabled === true;
      const me = req.user as User;
      const prev = await storage.getFeatureFlag(key);
      const row = await storage.setFeatureFlag(key, enabled, me.id);
      await audit(req, "feature_flag.toggle", "feature_flag", null,
        { key, enabled: prev?.enabled ?? (FEATURE_FLAG_DEFAULTS as any)[key] ?? false },
        { key, enabled },
        null,
      );
      res.json(row);
    },
  );

  // Phase 5 review fix — merge preview. Returns row counts in every
  // dependent table the loser owns so the admin sees exactly what will
  // move *before* confirming the merge. Read-only.
  app.get(
    "/api/admin/clients/merge-preview",
    requireAdmin,
    async (req, res) => {
      const loserId = Number(req.query.loserId);
      const winnerId = Number(req.query.winnerId);
      if (!Number.isFinite(loserId) || loserId <= 0) {
        return res.status(400).json({ message: "loserId required" });
      }
      const loser = await storage.getUser(loserId);
      if (!loser) return res.status(404).json({ message: "Loser not found" });
      const winner = Number.isFinite(winnerId) && winnerId > 0 ? await storage.getUser(winnerId) : null;
      const preview = await storage.getMergePreview(loserId);
      res.json({
        loser: sanitizeUserAdminView(loser),
        winner: winner ? sanitizeUserAdminView(winner) : null,
        counts: preview.counts,
        total: preview.total,
        warning:
          loser.mergedIntoUserId != null
            ? "This account has already been merged."
            : null,
      });
    },
  );

  // Admin client-merge tool. Folds the loser account into the winner —
  // bookings, packages, body metrics, photos, check-ins, notifications,
  // and notes all move over; loser is marked clientStatus='merged' and
  // isActive=false so they never appear in active lists again. Storage
  // layer is fully transactional + idempotent.
  app.post(
    "/api/admin/clients/merge",
    rateLimit({ windowMs: 60_000, max: RL.adminMerge, key: "admin-merge" }),
    requireAdmin,
    async (req, res) => {
      const schema = z.object({
        winnerId: z.number().int().positive(),
        loserId: z.number().int().positive(),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid merge request" });
      }
      const { winnerId, loserId } = parsed.data;
      if (winnerId === loserId) {
        return res.status(400).json({ message: "Cannot merge a user into themselves" });
      }
      // Phase 5 review fix — explicit role/state validation at the API
      // layer so a malformed admin request gets a clear 400 with the
      // right error code instead of bubbling a generic 400 from
      // storage. Storage still enforces the same invariants as
      // defence-in-depth.
      const [winnerRow, loserRow] = await Promise.all([
        storage.getUser(winnerId),
        storage.getUser(loserId),
      ]);
      if (!winnerRow || !loserRow) {
        return res.status(404).json({ message: "One or both accounts not found" });
      }
      if (winnerRow.role !== "client" || loserRow.role !== "client") {
        return res
          .status(400)
          .json({ message: "Merge is only allowed between two client accounts" });
      }
      if (winnerRow.mergedIntoUserId) {
        return res
          .status(400)
          .json({ message: "Winner account has itself been merged — pick the surviving account" });
      }
      const me = req.user as User;
      try {
        const result = await storage.mergeUsers({ winnerId, loserId, performedByUserId: me.id });
        // Task #66 — surface the structured table report + any audit
        // warning back to the admin UI so partial failures are
        // visible. tableReport is also persisted in the audit log
        // (newValue.tableReport) for forensic review.
        const totalRowsMoved = result.tableReport.reduce(
          (n, r) => n + r.rowsMoved,
          0,
        );
        const skipped = result.tableReport.filter(
          (r) => r.status === "skipped_missing_table",
        );
        res.json({
          winner: sanitizeUserAdminView(result.winner),
          loser: sanitizeUserAdminView(result.loser),
          tableReport: result.tableReport,
          totalRowsMoved,
          skippedTables: skipped.map((r) => r.table),
          auditWarning: result.auditWarning ?? null,
        });
      } catch (e: any) {
        // Task #66 — fail loudly. The storage layer guarantees a full
        // rollback (no partial merge) when this throws, so it is safe
        // to bubble the underlying message to the admin verbatim.
        console.error("[admin/clients/merge] failed:", e);
        res.status(500).json({
          message: e?.message || "Merge failed",
          merged: false,
        });
      }
    },
  );

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
      if (!_sharp) throw new Error("sharp_unavailable");
      let pipeline = _sharp(buffer, { failOn: "none", limitInputPixels: 50_000_000 }).rotate();
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

  // ============== SERVICE-CARD IMAGES ==============
  // Dedicated upload route so images are compressed through the same
  // sharp pipeline as hero/transformation/profile uploads.
  // Accepts a base64 data URL, resizes + converts to WebP, saves the
  // resulting data URL into the matching settings column, and returns
  // ONLY { imageUrl } — not the full settings row — so the response
  // stays small regardless of how many other images are stored.
  //
  // IMPORTANT: This is the ONLY correct way to upload service card images.
  // Do NOT send base64 data URLs via PATCH /api/settings — that route is
  // for small scalar settings (numbers, text) only, and large payloads
  // cause timeouts / Vercel body-size limits.
  const SVC_IMAGE_CARD_KEYS = ["personalTraining", "nutrition", "supplement"] as const;
  type SvcImageCardKey = (typeof SVC_IMAGE_CARD_KEYS)[number];
  const SVC_IMAGE_URL_COLUMNS: Record<SvcImageCardKey, string> = {
    personalTraining: "personalTrainingImageUrl",
    nutrition:        "nutritionImageUrl",
    supplement:       "supplementImageUrl",
  };

  app.post("/api/admin/service-images/:card", requireAdmin, async (req, res) => {
    const card = req.params.card as SvcImageCardKey;
    if (!(SVC_IMAGE_CARD_KEYS as readonly string[]).includes(card)) {
      return res.status(400).json({
        message: "Invalid card. Must be personalTraining, nutrition, or supplement.",
      });
    }
    const schema = z.object({ imageDataUrl: z.string().min(40, "Image data is required") });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid request" });
    }
    const result = await processAdminImageDataUrl(parsed.data.imageDataUrl, {
      width: 1200,
      height: 800,
      fit: "cover",
      quality: 88,
      allowedMime: new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]),
      maxDataUrlBytes: 20 * 1024 * 1024,
      maxDecodedBytes: 15 * 1024 * 1024,
      typeErrorMessage: "Only JPEG, PNG, or WebP images are allowed.",
      sizeErrorMessage: "Image must be under 15 MB.",
    });
    if (!result.ok) {
      return res.status(result.status).json({ message: result.message });
    }
    const urlColumn = SVC_IMAGE_URL_COLUMNS[card];
    await storage.updateSettings({ [urlColumn]: result.dataUrl } as any);
    return res.status(200).json({ imageUrl: result.dataUrl });
  });

  app.delete("/api/admin/service-images/:card", requireAdmin, async (req, res) => {
    const card = req.params.card as SvcImageCardKey;
    if (!(SVC_IMAGE_CARD_KEYS as readonly string[]).includes(card)) {
      return res.status(400).json({ message: "Invalid card key." });
    }
    const urlColumn = SVC_IMAGE_URL_COLUMNS[card];
    await storage.updateSettings({ [urlColumn]: null } as any);
    return res.sendStatus(204);
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
    void dispatchAdminPackageActivatedEmail({ pkg: created, source: "new" });
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

    // Task #57 — freeze/expiry math.
    // On FREEZE: stamp frozen=true + frozenAt=now() + freeze_start_date=today.
    // On UNFREEZE: if the package was previously frozen, compute the
    // exact whole-day duration between frozenAt and now and extend
    // expiryDate by that count. freeze_end_date=today caps the audit
    // trail. Falls back to a no-op extension if either anchor is
    // missing (e.g. legacy rows pre-task-#27 with no frozenAt).
    const todayIso = new Date().toISOString().slice(0, 10);
    const wasFrozen = !!pkg.frozen;
    let frozenDays = 0;
    let nextExpiry: string | null = pkg.expiryDate ? String(pkg.expiryDate) : null;
    let patch: any = {
      frozen: parsed.data.frozen,
      frozenAt: parsed.data.frozen ? new Date() : null,
      frozenReason: parsed.data.frozen ? parsed.data.reason ?? null : null,
    };
    if (parsed.data.frozen) {
      patch.freezeStartDate = todayIso;
      patch.freezeEndDate = null;
    } else if (wasFrozen && pkg.frozenAt) {
      // NOTE: this manual-unfreeze branch is the ONLY code path that flips
      // packages.frozen back to false in this codebase (no scheduled cron
      // auto-unfreeze exists — verified by grep across server/cron/ &
      // server/storage.ts). If a scheduled unfreeze is ever added, route
      // it through the same date-diff math below (or extract into a
      // shared helper) so expiry is always advanced by the exact frozen
      // calendar-day count.
      // EXACT calendar-day diff between the freeze-start date (UTC) and
      // today (UTC). 7 calendar days of freeze => +7 days of expiry,
      // regardless of the partial-day clock offset. Falls back to
      // frozenAt's date portion when freezeStartDate wasn't stamped on
      // legacy rows.
      const startIso = (pkg as any).freezeStartDate
        ? String((pkg as any).freezeStartDate)
        : new Date(pkg.frozenAt as any).toISOString().slice(0, 10);
      const startUtc = Date.UTC(
        Number(startIso.slice(0, 4)),
        Number(startIso.slice(5, 7)) - 1,
        Number(startIso.slice(8, 10)),
      );
      const todayUtc = Date.UTC(
        Number(todayIso.slice(0, 4)),
        Number(todayIso.slice(5, 7)) - 1,
        Number(todayIso.slice(8, 10)),
      );
      frozenDays = Math.max(0, Math.round((todayUtc - startUtc) / 86_400_000));
      if (nextExpiry && frozenDays > 0) {
        const exp = new Date(nextExpiry);
        if (!isNaN(exp.getTime())) {
          exp.setUTCDate(exp.getUTCDate() + frozenDays);
          nextExpiry = exp.toISOString().slice(0, 10);
          patch.expiryDate = nextExpiry;
        }
      }
      patch.freezeEndDate = todayIso;
    }

    const updated = await storage.updatePackage(id, patch);
    try {
      await storage.createPackageSessionHistory({
        packageId: pkg.id,
        userId: pkg.userId,
        action: parsed.data.frozen ? "package_frozen" : "package_unfrozen",
        sessionsDelta: 0,
        performedByUserId: me.id,
        reason: parsed.data.reason
          ?? (!parsed.data.frozen && frozenDays > 0
            ? `Unfrozen — expiry extended by ${frozenDays}d → ${nextExpiry}`
            : null),
      } as any);
    } catch {/* ignore */}
    await audit(
      req,
      parsed.data.frozen ? "package.freeze" : "package.unfreeze",
      "package",
      pkg.id,
      {
        userId: pkg.userId,
        frozen: pkg.frozen,
        expiryDate: pkg.expiryDate,
      },
      {
        userId: pkg.userId,
        frozen: parsed.data.frozen,
        expiryDate: nextExpiry,
        frozenDaysApplied: frozenDays,
      },
      parsed.data.reason ?? null,
    );
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
    const status = parsed.data.paymentStatus;
    const approved =
      parsed.data.paymentApproved ?? (status === "paid" || status === "complimentary");
    // Derive amountPaid when not explicitly provided. "Mark Paid in Full"
    // and "Complimentary" are bookkeeping shortcuts; partial / pending /
    // unpaid leave the running total untouched so the trainer never
    // accidentally wipes out a previously recorded partial payment.
    const totalPrice = (pkg as any).totalPrice ?? 0;
    let nextAmountPaid: number | undefined = parsed.data.amountPaid;
    if (nextAmountPaid === undefined) {
      if (status === "paid") nextAmountPaid = totalPrice;
      else if (status === "complimentary") nextAmountPaid = 0;
    }
    const isFullPayment = status === "paid" && totalPrice > 0;
    const updated = await storage.updatePackage(id, {
      paymentStatus: status,
      paymentApproved: approved,
      paymentApprovedAt: approved ? new Date() : null,
      paymentApprovedByUserId: approved ? me.id : null,
      paymentNote: parsed.data.note ?? null,
      ...(nextAmountPaid !== undefined ? { amountPaid: nextAmountPaid } : {}),
      ...(isFullPayment ? { lastPaymentDate: new Date() } : {}),
    } as any);
    try {
      await storage.createPackageSessionHistory({
        packageId: pkg.id,
        userId: pkg.userId,
        action: "payment_updated",
        sessionsDelta: 0,
        performedByUserId: me.id,
        reason: `${status}${parsed.data.note ? ` — ${parsed.data.note}` : ""}`,
      } as any);
    } catch {/* ignore */}
    void dispatchAdminPaymentEmail({ pkg: updated });
    // Only notify the client when the status actually transitions INTO
    // "paid" — avoids resending on repeated "mark paid" no-ops.
    if (status === "paid" && pkg.paymentStatus !== "paid") {
      void dispatchClientPaymentConfirmedEmail({ pkg: updated, paymentMethod: parsed.data.note ?? null });
    }
    await audit(
      req,
      "package.payment_update",
      "package",
      pkg.id,
      { userId: pkg.userId, paymentStatus: pkg.paymentStatus, amountPaid: (pkg as any).amountPaid ?? 0 },
      { userId: pkg.userId, paymentStatus: status, amountPaid: nextAmountPaid ?? (pkg as any).amountPaid ?? 0 },
      parsed.data.note ?? null,
    );
    res.json(updated);
  });

  // Record a partial payment (delta). Accumulates onto amount_paid; when
  // the running total reaches total_price we auto-promote the status to
  // 'paid' + stamp paymentApproved + lastPaymentDate. Each call writes a
  // payment_received audit entry so the timeline shows every receipt.
  app.post("/api/admin/packages/:id/add-payment", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = addPackagePaymentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const pkg = await storage.getPackage(id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    const me = req.user as User;
    const totalPrice = (pkg as any).totalPrice ?? 0;
    const prevPaid = (pkg as any).amountPaid ?? 0;
    const nextPaid = prevPaid + parsed.data.amount;
    const reachedFull = totalPrice > 0 && nextPaid >= totalPrice;
    const nextStatus: PackagePaymentStatus = reachedFull ? "paid" : "partially_paid";
    const updated = await storage.updatePackage(id, {
      amountPaid: nextPaid,
      lastPaymentDate: new Date(),
      paymentStatus: nextStatus,
      ...(reachedFull
        ? {
            paymentApproved: true,
            paymentApprovedAt: new Date(),
            paymentApprovedByUserId: me.id,
          }
        : {}),
      ...(parsed.data.note ? { paymentNote: parsed.data.note } : {}),
    } as any);
    try {
      await storage.createPackageSessionHistory({
        packageId: pkg.id,
        userId: pkg.userId,
        action: "payment_received",
        sessionsDelta: 0,
        performedByUserId: me.id,
        reason: `AED ${parsed.data.amount.toLocaleString()}${parsed.data.note ? ` — ${parsed.data.note}` : ""}`,
      } as any);
    } catch {/* ignore */}
    void dispatchAdminPaymentEmail({ pkg: updated, amountReceived: parsed.data.amount });
    // Fire client payment-confirmed only on the receipt that pushes the
    // running total over total_price (i.e. just-now reached "paid").
    if (reachedFull && pkg.paymentStatus !== "paid") {
      void dispatchClientPaymentConfirmedEmail({ pkg: updated, amountReceived: parsed.data.amount, paymentMethod: parsed.data.note ?? null });
    }
    res.json(updated);
  });

  // Convert a free trial / zero-price package row into a real paid package
  // by snapshotting a chosen template onto the existing row. Sessions reset
  // (usedSessions=0), expiry is recomputed from the template's window, and
  // payment defaults to 'pending' so the admin records the first payment
  // via /add-payment afterwards. We mutate IN PLACE so historical bookings
  // stay attached to the same packageId.
  app.post("/api/admin/packages/:id/convert-trial", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = convertTrialPackageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const pkg = await storage.getPackage(id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    const tmpl = await storage.getPackageTemplate(parsed.data.templateId);
    if (!tmpl) return res.status(404).json({ message: "Template not found" });
    const me = req.user as User;
    const startStr = parsed.data.startDate ?? new Date().toISOString().slice(0, 10);
    const start = new Date(`${startStr}T00:00:00+04:00`);
    const days = expirationToDays(tmpl.expirationValue, tmpl.expirationUnit);
    const expiry = new Date(start);
    expiry.setDate(expiry.getDate() + days);
    const updated = await storage.updatePackage(id, {
      templateId: tmpl.id,
      name: tmpl.name,
      type: tmpl.type,
      paidSessions: tmpl.paidSessions,
      bonusSessions: tmpl.bonusSessions,
      totalSessions: tmpl.totalSessions,
      pricePerSession: tmpl.pricePerSession,
      totalPrice: tmpl.totalPrice,
      usedSessions: 0,
      isActive: true,
      startDate: startStr as any,
      expiryDate: expiry.toISOString().slice(0, 10) as any,
      paymentStatus: "pending",
      paymentApproved: false,
      paymentApprovedAt: null,
      paymentApprovedByUserId: null,
      amountPaid: 0,
      lastPaymentDate: null,
    } as any);
    try {
      await storage.createPackageSessionHistory({
        packageId: pkg.id,
        userId: pkg.userId,
        action: "trial_converted",
        sessionsDelta: tmpl.totalSessions,
        performedByUserId: me.id,
        reason: `Converted to ${tmpl.name} (${tmpl.totalSessions} sessions, AED ${tmpl.totalPrice.toLocaleString()})`,
      } as any);
    } catch {/* ignore */}
    void dispatchAdminPackageActivatedEmail({ pkg: updated, source: "converted_trial" });
    // Task #56: client-side bell event for the trial-to-paid handoff.
    void notifyUserOnce(
      pkg.userId,
      "package_activated",
      `pkg-activated-${pkg.id}`,
      "Your package is active",
      `Your ${tmpl.name} package is live — ${tmpl.totalSessions} sessions ready to book.`,
      { link: "/dashboard", meta: { packageId: pkg.id } },
    );
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
    await audit(
      req,
      delta > 0 ? "package.session_grant" : "package.session_remove",
      "package",
      pkg.id,
      { userId: pkg.userId, totalSessions: pkg.totalSessions, usedSessions: pkg.usedSessions },
      { userId: pkg.userId, delta, totalSessions: updated?.totalSessions, usedSessions: updated?.usedSessions },
      reason ?? null,
    );
    res.json(updated);
  });

  // ============== ADD BONUS SESSIONS ==============
  // Admin-only. Grants bonus credits that are explicitly tracked as
  // bonus (not paid) sessions. Increments both bonusSessions and
  // totalSessions so the client's remaining balance increases without
  // touching paidSessions or price fields. Optionally extends expiry.
  app.post("/api/admin/packages/:id/add-bonus", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = addBonusSessionsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid input" });
    }
    const pkg = await storage.getPackage(id);
    if (!pkg) return res.status(404).json({ message: "Package not found" });
    const me = req.user as User;
    const { bonusSessions, reason, adminNote, expiryExtension } = parsed.data;

    // Compute optional expiry update.
    let newExpiryDate: string | undefined;
    if (expiryExtension && expiryExtension.type !== "none") {
      if (expiryExtension.type === "date") {
        newExpiryDate = expiryExtension.date;
      } else {
        const base = pkg.expiryDate ? new Date(pkg.expiryDate as any) : new Date();
        const next = new Date(base);
        next.setDate(next.getDate() + expiryExtension.days);
        newExpiryDate = next.toISOString().slice(0, 10);
      }
    }

    const updatePayload: any = {
      bonusSessions: (pkg.bonusSessions ?? 0) + bonusSessions,
      totalSessions: pkg.totalSessions + bonusSessions,
    };
    if (newExpiryDate) updatePayload.expiryDate = newExpiryDate;

    const updated = await storage.updatePackage(id, updatePayload);

    try {
      await storage.createPackageSessionHistory({
        packageId: pkg.id,
        userId: pkg.userId,
        action: "bonus_added",
        sessionsDelta: bonusSessions,
        performedByUserId: me.id,
        reason: adminNote ? `${reason}\n[Admin note: ${adminNote}]` : reason,
      } as any);
      if (newExpiryDate) {
        await storage.createPackageSessionHistory({
          packageId: pkg.id,
          userId: pkg.userId,
          action: "package_extended",
          sessionsDelta: 0,
          performedByUserId: me.id,
          reason: `Expiry extended to ${newExpiryDate} (with bonus grant)`,
        } as any);
      }
    } catch {/* ignore */}

    await audit(
      req,
      "package.bonus_added",
      "package",
      pkg.id,
      { userId: pkg.userId, bonusSessions: pkg.bonusSessions, totalSessions: pkg.totalSessions },
      { userId: pkg.userId, bonusSessions: updatePayload.bonusSessions, totalSessions: updatePayload.totalSessions, newExpiryDate },
      reason,
    );
    res.json(updated);
  });

  // ============== PACKAGE ACTIVATION REQUESTS (self-service) ==============
  // Fitness Zone PT clients submit a package activation request from
  // the /wizard "Existing PT client" flow. Receipt upload was removed
  // per product requirement — admin verifies payment manually outside
  // the platform and then approves via the verification queue. The
  // request is persisted as a `packages` row in `pending_verification`
  // state, gated by `adminApproved=false`, so all existing booking
  // eligibility rules naturally block bookings until the admin
  // approves it.
  app.post("/api/package-verification-requests", rateLimit({ windowMs: 10 * 60_000, max: RL.activation, key: "activation" }), requireAuth, async (req, res) => {
    const me = req.user as User;
    if (me.role !== "client") {
      return res.status(403).json({ message: "Only clients can submit activation requests" });
    }
    const body = req.body ?? {};
    const requestedType = String(body.requestedType ?? "");
    const allowed = new Set(["ten", "twenty", "twentyfive", "duo30", "not_sure"]);
    if (!allowed.has(requestedType)) {
      return res.status(400).json({ message: "Please pick a package option" });
    }
    const notes = typeof body.notes === "string" ? body.notes.trim().slice(0, 1000) : "";

    // Reject if the user already has an in-flight request — admin must
    // resolve the first one before a second can be submitted.
    const existing = await storage.getPackages({ userId: me.id });
    const alreadyPending = existing.find((p) => p.status === "pending_verification");
    if (alreadyPending) {
      return res.status(409).json({
        message: "You already have a pending activation request. Youssef will review it shortly.",
      });
    }

    const typeMap: Record<string, { type: string; totalSessions: number; name: string }> = {
      ten:        { type: "10",    totalSessions: 10, name: "10 Sessions (pending activation)" },
      twenty:     { type: "20",    totalSessions: 20, name: "20 Sessions (pending activation)" },
      twentyfive: { type: "25",    totalSessions: 25, name: "25 Sessions (pending activation)" },
      duo30:      { type: "duo30", totalSessions: 30, name: "Duo 30 (pending activation)" },
      not_sure:   { type: "10",    totalSessions: 10, name: "Fitness Zone package (pending review)" },
    };
    const mapped = typeMap[requestedType];

    const created = await storage.createPackage({
      userId: me.id,
      type: mapped.type,
      name: mapped.name,
      totalSessions: mapped.totalSessions,
      usedSessions: 0,
      isActive: false,
      status: null,
      adminApproved: false,
      paymentStatus: "unpaid",
      source: "fitness_zone_self_request",
      verificationRequestPayload: {
        requestedType,
        notes: notes || undefined,
        submittedAt: new Date().toISOString(),
      } as any,
    } as any);

    // Mark the row as pending_verification (computePackageStatus may
    // otherwise overwrite the status field on insert; setting it
    // explicitly via a follow-up update is the safest path).
    const pending = await storage.updatePackage(created.id, {
      status: "pending_verification",
    } as any);

    try {
      await storage.createPackageSessionHistory({
        packageId: created.id,
        userId: me.id,
        action: "package_created",
        sessionsDelta: 0,
        performedByUserId: me.id,
        reason: "Self-service activation request",
      } as any);
    } catch {/* ignore */}

    // Task #66 follow-up — receipt notification. We dedupe by the
    // package row id so a retry/double-submit can't double-fire.
    try {
      await notifyUserOnce(
        me.id,
        "package_activation_requested",
        `pvr:${created.id}`,
        "Package activation request received",
        "Youssef will review your package and unlock your booking access once activation is complete.",
        {
          link: "/dashboard",
          meta: { packageId: created.id, requestedType },
        },
      );
    } catch {/* notification failure must never block the activation request */}

    // Mirror the receipt notification to every admin so the verification
    // queue isn't the only surface that announces a new request. Dedupe
    // per (admin × package) so retries can't double-fire the bell.
    try {
      const admins = await storage.getAllAdmins();
      const adminLabel = me.fullName || me.email || `client #${me.id}`;
      await Promise.all(
        admins.map((a: any) =>
          notifyUserOnce(
            a.id,
            "admin_message",
            `pvr-admin:${created.id}`,
            "New package activation request",
            `${adminLabel} requested activation for "${mapped.name}". Review it in the verification queue.`,
            {
              link: "/admin/packages",
              meta: { packageId: created.id, clientUserId: me.id, requestedType },
            },
          ),
        ),
      );
    } catch (e) {
      console.error("[pvr:admin-notify] failed:", e);
    }

    console.log(
      `[pvr:created] id=${created.id} userId=${me.id} email=${me.email} type=${mapped.type} sessions=${mapped.totalSessions} source=fitness_zone_self_request status=pending_verification`,
    );

    res.status(201).json(pending ?? created);
  });

  // ──────────────────────────────────────────────────────────────────
  // Training-locations CRUD (Task #66 follow-up bugfix).
  //
  // These routes existed on the storage interface and the wizard
  // already POSTs to them, but the actual Express handlers were
  // never registered. Vite's SPA fallback was returning HTML 200 for
  // every request, so `apiRequest` succeeded, `r.json()` threw on
  // the HTML, the wizard's catch fired with "Unexpected token <" and
  // the FZ existing-PT flow never reached `submitVerification`.
  // ──────────────────────────────────────────────────────────────────
  app.get("/api/training-locations", requireAuth, async (req, res) => {
    try {
      const me = req.user as User;
      const rows = await storage.getUserTrainingLocations(me.id);
      res.json(rows);
    } catch (e: any) {
      console.error("[training-locations:list]", e);
      res.status(500).json({ message: e?.message || "Failed to load training locations" });
    }
  });

  app.post("/api/training-locations", requireAuth, async (req, res) => {
    try {
      const me = req.user as User;
      const parsed = insertTrainingLocationSchema.safeParse({
        ...(req.body ?? {}),
        userId: me.id,
      });
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message || "Invalid training location payload",
          errors: parsed.error.errors,
        });
      }
      const row = await storage.createTrainingLocation(parsed.data);
      res.status(201).json(row);
    } catch (e: any) {
      console.error("[training-locations:create]", e);
      res.status(500).json({ message: e?.message || "Failed to save training location" });
    }
  });

  app.patch("/api/training-locations/:id", requireAuth, async (req, res) => {
    try {
      const me = req.user as User;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const existing = await storage.getTrainingLocation(id);
      if (!existing || existing.userId !== me.id) {
        return res.status(404).json({ message: "Training location not found" });
      }
      const row = await storage.updateTrainingLocation(id, req.body ?? {});
      res.json(row);
    } catch (e: any) {
      console.error("[training-locations:update]", e);
      res.status(500).json({ message: e?.message || "Failed to update training location" });
    }
  });

  app.delete("/api/training-locations/:id", requireAuth, async (req, res) => {
    try {
      const me = req.user as User;
      const id = Number(req.params.id);
      if (!Number.isFinite(id)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const existing = await storage.getTrainingLocation(id);
      if (!existing || existing.userId !== me.id) {
        return res.status(404).json({ message: "Training location not found" });
      }
      await storage.archiveTrainingLocation(id);
      res.json({ ok: true });
    } catch (e: any) {
      console.error("[training-locations:archive]", e);
      res.status(500).json({ message: e?.message || "Failed to archive training location" });
    }
  });

  // Admin queue + decision endpoints powering the verification-queue UI
  // in AdminPackages. Reuse the existing approve flow for "approve".
  app.get("/api/admin/package-verification-requests", requireAdmin, async (req, res) => {
    const rows = await storage.getPendingVerificationPackages();
    const userIds = Array.from(new Set(rows.map((r) => r.userId)));
    const usersById: Record<number, any> = {};
    for (const uid of userIds) {
      const u = await storage.getUser(uid);
      if (u) usersById[uid] = sanitizeUser(u);
    }
    const me = req.user as User;
    console.log(
      `[pvr:admin-list] count=${rows.length} adminUserId=${me?.id ?? "?"} ids=[${rows.map((r) => r.id).join(",")}]`,
    );
    // Disable downstream caching — the verification queue must reflect
    // the latest DB state on every poll/refresh; never serve a stale
    // body from a CDN or browser HTTP cache.
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json(rows.map((r) => ({ ...r, user: usersById[r.userId] ?? null })));
  });

  app.patch("/api/admin/package-verification-requests/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const pkg = await storage.getPackage(id);
    if (!pkg) return res.status(404).json({ message: "Request not found" });
    if (pkg.status !== "pending_verification") {
      return res.status(409).json({ message: "Request is no longer pending" });
    }
    const me = req.user as User;
    // Accept both `action` (new API) and `decision` (existing
    // AdminPackages.tsx VerificationQueue payload) so the legacy admin
    // UI keeps working without a separate client patch.
    const action = String(req.body?.action ?? req.body?.decision ?? "");
    const note = typeof req.body?.note === "string" ? req.body.note.trim().slice(0, 500) : "";

    if (action === "approve") {
      const today = dubaiTodayYMD();
      const updated = await storage.updatePackage(id, {
        status: "active",
        isActive: true,
        adminApproved: true,
        adminApprovedAt: new Date(),
        adminApprovedByUserId: me.id,
        paymentStatus: "paid",
        paymentApproved: true,
        paymentApprovedAt: new Date(),
        paymentApprovedByUserId: me.id,
        startDate: today,
      } as any);
      try {
        await storage.createPackageSessionHistory({
          packageId: id,
          userId: pkg.userId,
          action: "package_approved",
          sessionsDelta: 0,
          performedByUserId: me.id,
          reason: note || "Activation request approved",
        } as any);
      } catch {/* ignore */}
      // Task #56: surface activation in the bell. dedupeKey on packageId
      // so a re-approve / status-reset path can't double-fire.
      void notifyUserOnce(
        pkg.userId,
        "package_activated",
        `pkg-activated-${pkg.id}`,
        "Your package is active",
        `Your ${updated?.name || pkg.name || "training"} package is live — book your next session whenever you're ready.`,
        { link: "/dashboard", meta: { packageId: pkg.id } },
      );
      await audit(
        req,
        "package.verification_approve",
        "package",
        id,
        { userId: pkg.userId, status: "pending_verification" },
        { userId: pkg.userId, status: "active" },
        note || null,
      );
      return res.json(updated);
    }
    if (action === "reject") {
      await storage.deletePackage(id);
      try {
        await storage.createPackageSessionHistory({
          packageId: id,
          userId: pkg.userId,
          action: "package_deleted",
          sessionsDelta: 0,
          performedByUserId: me.id,
          reason: note || "Activation request rejected",
        } as any);
      } catch {/* ignore */}
      await audit(
        req,
        "package.verification_reject",
        "package",
        id,
        { userId: pkg.userId, status: "pending_verification" },
        { userId: pkg.userId, status: "rejected" },
        note || null,
      );
      return res.json({ ok: true, deleted: true });
    }
    return res.status(400).json({ message: "Unknown action" });
  });

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
    await audit(
      req,
      parsed.data.approved ? "package.approve" : "package.unapprove",
      "package",
      pkg.id,
      { userId: pkg.userId, adminApproved: pkg.adminApproved },
      { userId: pkg.userId, adminApproved: parsed.data.approved },
      parsed.data.note ?? null,
    );
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
  // =============================
  // Task #74 — Streak system & achievement badges
  // =============================
  // GET /api/me/badges      — list earned badges (just keys + earnedAt)
  // GET /api/me/streaks     — 3 numbers: sessionsThisWeek, nutritionStreakWeeks, attendanceStreakWeeks
  // POST /api/me/badges/evaluate — manual re-evaluation; same code path the
  //                          auto-complete cron uses. Returns the keys
  //                          newly awarded on this call (may be empty).
  //                          Idempotent: re-running is a no-op once all
  //                          eligible badges are already on file.
  app.get("/api/me/badges", requireAuth, async (req, res) => {
    const me = req.user as User;
    const rows = await storage.getUserBadges(me.id).catch(() => []);
    res.json(rows);
  });

  app.get("/api/me/streaks", requireAuth, async (req, res) => {
    const me = req.user as User;
    const [bookings, dailyCheckins] = await Promise.all([
      storage.getBookings({ userId: me.id }).catch(() => []),
      (storage as any).listRecentDailyCheckins(me.id, 14).catch(() => []),
    ]);
    const metrics = computeStreaks({
      bookings,
      dailyCheckins,
      weeklyFrequency: (me as any).weeklyFrequency ?? null,
      nutritionPlanActive: false,
    });
    res.json(metrics);
  });

  app.post("/api/me/badges/evaluate", requireAuth, async (req, res) => {
    const me = req.user as User;
    const awarded = await evaluateAndAwardBadges(me.id);
    res.json({ awarded });
  });

  app.get("/api/me/today", requireAuth, async (req, res) => {
    const me = req.user as User;
    const safe = async <T,>(fn: () => Promise<T>, fallback: T): Promise<T> => {
      try { return await fn(); } catch { return fallback; }
    };

    const nowMs = Date.now();
    const todayIso = dubaiTodayYMD();

    const [bookings, checkins, bodyMetrics] = await Promise.all([
      safe(() => storage.getBookings({ userId: me.id }), [] as any[]),
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

    const supplementsToday = 0;
    const waterTargetMl: number | null = null;

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

  // ============== DAILY CHECK-INS (Task #73 — Recovery readiness) ==============
  // Lightweight one-row-per-day self-report. Client-only surface — no
  // admin endpoints needed; aggregate is computed client-side for the
  // dashboard readiness card. Dubai date is derived server-side so the
  // (userId, date) upsert is stable across client clocks.
  const dubaiToday = (): string => {
    const now = new Date();
    const dubai = new Date(now.getTime() + (4 * 60 - -now.getTimezoneOffset()) * 60_000);
    return dubai.toISOString().slice(0, 10);
  };

  app.get("/api/me/checkins/today", requireAuth, async (req, res) => {
    const me = req.user as User;
    const row = await storage.getDailyCheckin(me.id, dubaiToday());
    res.json(row ?? null);
  });

  app.get("/api/me/checkins/recent", requireAuth, async (req, res) => {
    const me = req.user as User;
    const limit = Math.min(Math.max(Number(req.query.limit) || 14, 1), 90);
    const rows = await storage.listRecentDailyCheckins(me.id, limit);
    res.json(rows);
  });

  app.post("/api/me/checkins", requireAuth, async (req, res) => {
    const me = req.user as User;
    const body = { ...req.body, userId: me.id, date: req.body?.date || dubaiToday() };
    const parsed = insertDailyCheckinSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const row = await storage.upsertDailyCheckin(parsed.data);
    res.status(200).json(row);
  });

  // ============== CRON ENTRYPOINT ==============
  // Triggered every 15 min by .github/workflows/auto-complete.yml. The
  // orchestration (env validate → db connect → auto-complete → reminders →
  // expiry → checkin) lives in server/cron/runner.ts so production and the
  // local repro script (scripts/cron-test.ts) share one code path.
  // Auth: in production we require Authorization: Bearer <CRON_SECRET>;
  // in dev we accept unauthenticated calls so it's easy to trigger manually.
  // The HTTP body is the structured CronTickSummary (tickId + per-phase
  // results + failureCode), which the GitHub Actions step pretty-prints.

  // Reminder dispatch — extracted from the inline cron handler so the
  // runner can wrap it as a single phase. Behaviour identical to the
  // pre-refactor loop: 24h/1h windows, atomic per-recipient claim via the
  // *_sent_at columns, partner fan-out, in-app mirror via notifyUserOnce,
  // best-effort email via sendEmail. Adds a hard maxEmailsPerTick cap
  // (cronGuards.maxEmailsPerTick) so one tick can never blast the whole
  // user base if a misconfiguration causes the dedupe stamps to be wiped.
  async function runReminderDispatch(): Promise<{
    sent: number;
    failed: number;
    attempts: number;
    capped: boolean;
    cap: number;
  }> {
    const sent: Array<{ id: number; kind: "24h" | "1h" }> = [];
    const failed: Array<{ id: number; kind: "24h" | "1h"; error: string }> = [];
    const todayIso = dubaiTodayYMD();
    const tomorrowIso = dubaiTomorrowYMD();
    // Storage call is OUTSIDE the per-recipient try/catch — if the bookings
    // query itself fails (DB down, schema mismatch), let it throw so the
    // runner classifies the phase as DB_FAILURE / QUERY_FAILURE rather
    // than reporting a silent zero-sent success.
    const all = await storage.getBookings({});
    const now = Date.now();
    const cap = cronGuards.maxEmailsPerTick;
    let attempts = 0;
    let capped = false;

    for (const b of all) {
      if (capped) break;
      if (b.date !== todayIso && b.date !== tomorrowIso) continue;
      if (!["upcoming", "confirmed"].includes(b.status)) continue;
      const sessionAt = buildSessionDate(b.date, b.timeSlot).getTime();
      const minsUntil = Math.round((sessionAt - now) / 60_000);
      const want24 = minsUntil >= 22 * 60 && minsUntil <= 26 * 60;
      const want1 = minsUntil >= 30 && minsUntil <= 90;
      const bAny = b as any;

      const dispatch = async (kind: "24h" | "1h", recipient: "owner" | "partner") => {
        if (attempts >= cap) {
          capped = true;
          return;
        }
        attempts++;
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
          const recipientName = recipientUser.fullName || recipientUser.username || "Client";
          const timeDualStr = formatTimeDualServer(b.timeSlot);
          const baseUrl = (process.env.PUBLIC_APP_URL || "").replace(/\/+$/, "");
          let built: { subject: string; text: string; html: string };
          try {
            // Premium cinematic reminder — preferred path.
            // Task #55: Add-to-Calendar links. Google deep-link is
            // built inline (UTC stamps from the date + slot anchored to
            // +04:00); .ics is served by /api/bookings/:id/calendar.ics.
            const startMs = new Date(`${b.date}T${b.timeSlot}:00+04:00`).getTime();
            const endMs = startMs + 60 * 60_000;
            const padN = (n: number) => (n < 10 ? `0${n}` : String(n));
            const utcStamp = (ms: number) => {
              const d = new Date(ms);
              return (
                d.getUTCFullYear().toString() +
                padN(d.getUTCMonth() + 1) +
                padN(d.getUTCDate()) +
                "T" +
                padN(d.getUTCHours()) +
                padN(d.getUTCMinutes()) +
                padN(d.getUTCSeconds()) +
                "Z"
              );
            };
            const calTitle = `Training with Coach Youssef${b.sessionFocus ? ` — ${b.sessionFocus}` : ""}`;
            const calParams = new URLSearchParams({
              action: "TEMPLATE",
              text: calTitle,
              dates: `${utcStamp(startMs)}/${utcStamp(endMs)}`,
              details: `Session focus: ${b.sessionFocus || "Training session"}\nView details in your dashboard.`,
              location: "Coach Youssef's studio, Dubai Marina",
            });
            const googleCalendarUrl = `https://calendar.google.com/calendar/render?${calParams.toString()}`;
            const icsUrl = baseUrl
              ? `${baseUrl}/api/bookings/${b.id}/calendar.ics`
              : null;
            built = buildSessionReminderEmailPremium({
              kind,
              lang: (recipientLang === "ar" ? "ar" : "en") as "en" | "ar",
              recipientName,
              date: b.date,
              time12: timeDualStr,
              sessionFocus: b.sessionFocus || null,
              location: recipientLang === "ar"
                ? "استوديو المدرب يوسف، مرسى دبي"
                : "Coach Youssef's studio, Dubai Marina",
              bookingUrl: baseUrl ? `${baseUrl}/dashboard` : "/dashboard",
              rescheduleUrl: baseUrl ? `${baseUrl}/book` : "/book",
              supportEmail: trainerEmail(),
              googleCalendarUrl,
              icsUrl,
            });
          } catch (premiumErr) {
            console.warn("[cron/reminders] premium render failed, falling back to legacy:", premiumErr);
            built = buildSessionReminderEmail({
              kind,
              lang: recipientLang,
              data: {
                clientName: recipientName,
                date: b.date,
                time12: timeDualStr,
                sessionFocusLabel: b.sessionFocus || null,
                trainingGoalLabel: b.trainingGoal || null,
              },
            });
          }
          void notifyUserOnce(
            userId,
            "session_reminder",
            `reminder-${b.id}-${kind}-${recipient}`,
            kind === "24h" ? "Session tomorrow" : "Session in 1 hour",
            `${b.date} at ${formatTimeDualServer(b.timeSlot)}`,
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
          if (result.sent) sent.push({ id: b.id, kind });
          else failed.push({ id: b.id, kind, error: result.error || "send returned false" });
        } catch (e: any) {
          // Per-recipient swallow is fine for individual provider errors,
          // but a systemic DB / query failure means EVERY iteration will
          // fail the same way and silently inflate `failed` while the phase
          // returns ok. Re-throw classified DB/query errors so the runner
          // surfaces the phase as DB_FAILURE / QUERY_FAILURE.
          const code = classifyFailure(e);
          if (code === "DB_FAILURE" || code === "QUERY_FAILURE") throw e;
          failed.push({ id: b.id, kind, error: e?.message || "unknown" });
        }
      };

      if (want24 && !bAny.reminder24hSentAt) await dispatch("24h", "owner");
      if (want1 && !bAny.reminder1hSentAt) await dispatch("1h", "owner");
      if (bAny.linkedPartnerUserId) {
        if (want24 && !bAny.linkedPartnerReminder24hSentAt) await dispatch("24h", "partner");
        if (want1 && !bAny.linkedPartnerReminder1hSentAt) await dispatch("1h", "partner");
      }
    }
    if (capped) {
      console.warn(
        `[cron/reminders] hit maxEmailsPerTick=${cap} — remaining recipients deferred to next tick`,
      );
    }
    return { sent: sent.length, failed: failed.length, attempts, capped, cap };
  }

  app.all("/api/cron/reminders", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    // Fail-closed in production: if CRON_SECRET is unset, refuse to serve
    // even though the runner would later flag it as ENV_FAILURE — this
    // prevents the cron endpoint from being publicly callable for the
    // window between deploy and operator setting the secret.
    if (process.env.NODE_ENV === "production") {
      if (!secret) {
        return res.status(503).json({
          ok: false,
          failureCode: "ENV_FAILURE",
          error: "Server misconfigured: CRON_SECRET unset",
        });
      }
      const auth = req.get("authorization") || "";
      if (auth !== `Bearer ${secret}`) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
    }

    const summary = await runCronTick({
      reminders: runReminderDispatch,
      expiry: runPackageExpiryNotifications,
      checkin: runMissedCheckinNotifications,
      autoComplete: async () => {
        const r = await runAutoCompleteBookings("cron");
        return { completed: r.completed, deducted: r.deducted, notified: r.notified };
      },
      smartAlerts: () => recomputeSmartAlerts(),
    });

    // HTTP status mirrors success: 200 on full success or only-activity-failures,
    // 5xx on env / db-connect / overlap so the GitHub Actions step turns red.
    const operatorFailure =
      summary.failureCode === "ENV_FAILURE" ||
      summary.failureCode === "DB_FAILURE" ||
      summary.failureCode === "OVERLAP";
    res.status(operatorFailure ? 503 : 200).json(summary);
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
    const todayStr = dubaiTodayYMD();
    const monthStart = nowDubai();
    monthStart.setUTCDate(1);
    const monthStartStr = formatYMDInDubai(monthStart);

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

    // ----- TRIAL FUNNEL (lifetime) -----
    const clientIds = new Set(clients.map((c) => c.id));
    const trialBookedUsers = new Set<number>();
    const trialCompletedUsers = new Set<number>();
    for (const b of allBookings as any[]) {
      if (b.sessionType !== "trial") continue;
      if (!clientIds.has(b.userId)) continue;
      trialBookedUsers.add(b.userId);
      if (b.status === "completed") trialCompletedUsers.add(b.userId);
    }
    const convertedUsers = new Set<number>();
    for (const p of allPackagesAll as any[]) {
      if (p.type === "trial") continue;
      if (clientIds.has(p.userId)) convertedUsers.add(p.userId);
    }
    const funnel = {
      registered: clientsTotal,
      trialBooked: trialBookedUsers.size,
      trialCompleted: trialCompletedUsers.size,
      converted: convertedUsers.size,
      active: clientsActive,
    };

    // ----- CAPACITY HEATMAP (last 90d, weekday × hour 06..22) -----
    const hours: number[] = [];
    for (let h = 6; h <= 22; h++) hours.push(h);
    const heatmapMap = new Map<string, number>();
    const cutoffHeat = now.getTime() - ms(90);
    for (const b of allBookings as any[]) {
      if (!NON_CANCELLED.has(b.status)) continue;
      const t = new Date(`${String(b.date)}T${String(b.timeSlot ?? "00:00")}:00+04:00`);
      if (t.getTime() < cutoffHeat) continue;
      // Use Dubai-local DOW/hour. Since +04:00 has no DST, getUTC* on a +04:00
      // anchor matches Asia/Dubai wall-clock for both axes.
      const dubaiMs = t.getTime() + 4 * 3600 * 1000;
      const local = new Date(dubaiMs);
      const dow = local.getUTCDay();
      const hr = local.getUTCHours();
      if (hr < 6 || hr > 22) continue;
      const key = `${dow}:${hr}`;
      heatmapMap.set(key, (heatmapMap.get(key) ?? 0) + 1);
    }
    const cells: Array<{ dow: number; hour: number; count: number }> = [];
    for (let d = 0; d < 7; d++) {
      for (const h of hours) {
        cells.push({ dow: d, hour: h, count: heatmapMap.get(`${d}:${h}`) ?? 0 });
      }
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
      funnel,
      capacityHeatmap: { hours, cells },
    };
    res.json(payload);
  });

  // ============================================================
  // Phase 4 (task #58) — Admin BI endpoints
  // ============================================================

  // Daily Brief — one round-trip. Used by the AdminDashboard modal that
  // opens once per day. All computation is in-memory over already-loaded
  // lists; no extra heavy SQL.
  app.get("/api/admin/daily-brief", requireAdmin, async (_req, res) => {
    try {
      const now = new Date();
      // Dubai date (UTC+4, no DST).
      const dubai = new Date(now.getTime() + 4 * 3600 * 1000);
      const dateStr = dubai.toISOString().slice(0, 10);

      const [allBookings, allPackages, allClients, renewals, extensions, alertsOpen, health] =
        await Promise.all([
          storage.getBookings({ from: dateStr }),
          storage.getPackages({ activeOnly: true }),
          storage.getAllClients(),
          storage.getRenewalRequests({ status: "pending", limit: 500 }).catch(() => []),
          storage.getExtensionRequests({ status: "pending", limit: 500 }).catch(() => []),
          listOpenAlerts(),
          getSystemHealth(),
        ]);
      const usersById = new Map<number, any>();
      for (const u of allClients as any[]) usersById.set(u.id, u);

      const todays = (allBookings as any[]).filter((b) => b.date === dateStr);
      const completed = todays.filter((b) => b.status === "completed").length;
      const upcoming = todays.filter((b) => ["upcoming", "confirmed"].includes(b.status)).length;
      const sessions = todays
        .filter((b) => b.status !== "cancelled" && b.status !== "late_cancelled")
        .sort((a, b) => String(a.timeSlot).localeCompare(String(b.timeSlot)))
        .map((b) => {
          const u = usersById.get(b.userId);
          return {
            id: b.id,
            time: formatTimeDualServer(String(b.timeSlot ?? "")),
            userId: b.userId,
            userName: u?.fullName ?? u?.username ?? `Client #${b.userId}`,
            status: b.status,
            vipTier: u?.vipTier ?? null,
            isTrial: b.sessionType === "trial",
            sessionFocus: b.sessionFocus ?? null,
          };
        });

      const paymentApprovals = (allPackages as any[]).filter(
        (p) => p.paymentStatus === "pending",
      ).length;

      const in7 = new Date(now.getTime() + 7 * 86_400_000);
      const expiringClientsMap = new Map<number, { userId: number; userName: string; expiryDate: string }>();
      for (const p of allPackages as any[]) {
        if (!p.expiryDate) continue;
        const exp = new Date(`${p.expiryDate}T23:59:59+04:00`);
        if (exp.getTime() < now.getTime() || exp.getTime() > in7.getTime()) continue;
        if (computePackageStatus(p) === "expired") continue;
        if (!expiringClientsMap.has(p.userId)) {
          const u = usersById.get(p.userId);
          const userName = u?.fullName ?? u?.username ?? `Client #${p.userId}`;
          expiringClientsMap.set(p.userId, { userId: p.userId, userName, expiryDate: p.expiryDate });
        }
      }
      const expiringList = Array.from(expiringClientsMap.values()).sort((a, b) =>
        a.expiryDate.localeCompare(b.expiryDate),
      );

      const critical = alertsOpen.filter((a) => a.severity === "critical").length;
      const degradedKinds = health.filter((h) => h.degraded).map((h) => h.kind);

      const payload = {
        generatedAt: now.toISOString(),
        date: dateStr,
        today: {
          totalSessions: sessions.length,
          completed,
          upcoming,
          sessions,
        },
        pending: {
          renewals: (renewals as any[]).length,
          extensions: (extensions as any[]).length,
          paymentApprovals,
        },
        expiries: {
          next7dPackages: expiringList.length,
          next7dClients: expiringList,
        },
        alerts: { open: alertsOpen.length, critical },
        systemHealth: { degraded: degradedKinds.length > 0, failureKinds: degradedKinds },
      };
      res.json(payload);
    } catch (e: any) {
      console.error("[daily-brief] failed:", e);
      res.status(500).json({ error: e?.message ?? "Daily brief failed" });
    }
  });

  // Smart alerts inbox.
  app.get("/api/admin/alerts", requireAdmin, async (_req, res) => {
    const alerts = await listOpenAlerts();
    res.json(alerts);
  });
  app.post("/api/admin/alerts/:id/resolve", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
    await resolveAlertById(id);
    res.json({ ok: true });
  });
  // Admin trigger for the recompute job (without waiting for the next cron).
  app.post("/api/admin/alerts/recompute", requireAdmin, async (_req, res) => {
    try {
      const r = await recomputeSmartAlerts();
      res.json({ ok: true, ...r });
    } catch (e: any) {
      res.status(500).json({ ok: false, error: e?.message ?? "recompute failed" });
    }
  });

  // System-health (silent-fail) snapshot.
  app.get("/api/admin/system-health", requireAdmin, async (_req, res) => {
    const rows = await getSystemHealth();
    const degraded = rows.some((r) => r.degraded);
    res.json({ degraded, rows });
  });

  // Per-client LTV + burn-rate (last 30d) + projected end date per active package.
  app.get("/api/admin/clients/:id/business", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ error: "invalid id" });
    try {
      const [packages, bookings] = await Promise.all([
        storage.getPackages({ userId: id }),
        storage.getBookings({ userId: id }),
      ]);
      const ltv = (packages as any[])
        .filter((p) => p.paymentStatus === "paid" || p.adminApproved)
        .reduce((s, p) => s + Number(p.totalPrice ?? 0), 0);
      const totalAssigned = (packages as any[]).reduce(
        (s, p) => s + Number(p.totalPrice ?? 0),
        0,
      );
      const now = Date.now();
      const cutoff30 = now - 30 * 86_400_000;
      const completedLast30 = (bookings as any[]).filter((b) => {
        if (b.status !== "completed") return false;
        const t = new Date(`${String(b.date)}T00:00:00Z`).getTime();
        return t >= cutoff30 && t <= now;
      }).length;
      const sessionsPerDay = completedLast30 / 30;
      const burnRate = Number((sessionsPerDay * 7).toFixed(2)); // sessions/week
      // Per active package: projected end date
      const perPackage = (packages as any[])
        .filter((p) => p.isActive)
        .map((p) => {
          const remaining = (p.totalSessions ?? 0) - (p.usedSessions ?? 0);
          let projectedEndDate: string | null = null;
          let daysRemaining: number | null = null;
          if (sessionsPerDay > 0 && remaining > 0) {
            const days = Math.ceil(remaining / sessionsPerDay);
            daysRemaining = days;
            const proj = new Date(now + days * 86_400_000);
            projectedEndDate = proj.toISOString().slice(0, 10);
          }
          return {
            packageId: p.id,
            remaining,
            burnRatePerWeek: burnRate,
            projectedEndDate,
            daysRemaining,
            expiryDate: p.expiryDate ?? null,
            // pace flag: red if projection blows past expiry, amber if within 10%,
            // green otherwise. Used by the UI for an inline chip.
            pace: (() => {
              if (!projectedEndDate || !p.expiryDate) return "unknown";
              const exp = new Date(`${p.expiryDate}T00:00:00Z`).getTime();
              const proj = new Date(`${projectedEndDate}T00:00:00Z`).getTime();
              if (proj > exp) return "behind";
              if (exp - proj < 7 * 86_400_000) return "tight";
              return "ahead";
            })(),
          };
        });
      res.json({
        ltv,
        totalAssigned,
        completedLast30,
        burnRatePerWeek: burnRate,
        packageCount: packages.length,
        perPackage,
      });
    } catch (e: any) {
      console.error("[client-business] failed:", e);
      res.status(500).json({ error: e?.message ?? "failed" });
    }
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

    await audit(
      req,
      `booking.attendance.${parsed.data.attendance}`,
      "booking",
      id,
      { userId: booking.userId, status: previousStatus },
      { userId: booking.userId, status: newStatus, attendance: parsed.data.attendance },
      parsed.data.reason ?? null,
    );

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

    if (newStatus !== previousStatus) {
      void dispatchAdminAttendanceEmail({
        attendance: parsed.data.attendance,
        booking: updated,
        reason: parsed.data.reason ?? null,
      });
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
          // Task #56: canonical kind is `milestone_achieved`. dedupeKey
          // is stable across the rename so the same threshold can't
          // re-fire even if a row with the legacy `milestone` kind
          // exists from before the rename.
          void notifyUserOnce(
            booking.userId,
            "milestone_achieved",
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

    // Approve newest package if one is awaiting approval. The activation
    // email fires only on the actual false→true transition so repeated
    // approve calls (idempotent admin clicks) don't spam Youssef's inbox.
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
        void dispatchAdminPackageActivatedEmail({ pkg: approvedPkg, source: "approved" });
        // Task #56: client-side bell event mirroring the admin email.
        // dedupeKey on packageId so a re-approve cannot double-fire.
        void notifyUserOnce(
          id,
          "package_activated",
          `pkg-activated-${approvedPkg.id}`,
          "Your package is active",
          `Your ${approvedPkg.name || "training"} package is live — book your next session whenever you're ready.`,
          { link: "/dashboard", meta: { packageId: approvedPkg.id } },
        );
      }
    } catch (e) {
      console.warn("[admin/approve] package approval failed:", e);
    }

    await audit(req, "client.approve", "user", id,
      { userId: id, clientStatus: client.clientStatus },
      { userId: id, clientStatus: "active", note });
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

    await audit(req, "client.reject", "user", id,
      { userId: id, clientStatus: client.clientStatus },
      { userId: id, clientStatus: "cancelled", reason });
    res.json(sanitizeUserAdminView(updated));
  });

  app.patch("/api/admin/clients/:id/admin-notes", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = adminClientNotesSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid notes" });
    }
    const prev = await storage.getUser(id);
    const updated = await storage.updateUser(id, { adminNotes: parsed.data.adminNotes });
    await audit(
      req,
      "client.note_update",
      "user",
      id,
      { userId: id, adminNotes: (prev as any)?.adminNotes ?? null },
      { userId: id, adminNotes: parsed.data.adminNotes },
    );
    res.json(sanitizeUserAdminView(updated));
  });

  // Task #57 — fire a single in-app notification to one client.
  // Used by the floating QuickActionsPanel "Send notification" action.
  app.post("/api/admin/clients/:id/notify", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid client id" });
    const target = await storage.getUser(id);
    if (!target || target.role !== "client") {
      return res.status(404).json({ message: "Client not found" });
    }
    const title = typeof req.body?.title === "string" ? req.body.title.trim().slice(0, 120) : "";
    const body = typeof req.body?.body === "string" ? req.body.body.trim().slice(0, 600) : "";
    const link = typeof req.body?.link === "string" ? req.body.link.slice(0, 240) : null;
    if (!body) return res.status(400).json({ message: "Message body is required" });
    try {
      await notifyUser(id, "admin_message", title || "Message from your coach", body, link ? { link } : {});
    } catch (e) {
      console.warn("[admin/clients/notify] failed:", e);
      return res.status(500).json({ message: "Failed to notify client" });
    }
    await audit(req, "client.notify", "user", id, null, { title, body, link });
    res.json({ ok: true });
  });

  // Task #57 — admin-only edit of the structured medical/limitation
  // flags surfaced on the bookings calendar tile and client header.
  // Free-form string array; trimmed, deduped, capped at 10 entries.
  app.patch("/api/admin/clients/:id/medical-flags", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!id) return res.status(400).json({ message: "Invalid client id" });
    const target = await storage.getUser(id);
    if (!target || target.role !== "client") {
      return res.status(404).json({ message: "Client not found" });
    }
    const raw = Array.isArray(req.body?.medicalFlags) ? req.body.medicalFlags : [];
    const cleaned = Array.from(
      new Set(
        raw
          .map((x: any) => (typeof x === "string" ? x.trim() : ""))
          .filter((s: string) => s.length > 0 && s.length <= 40),
      ),
    ).slice(0, 10) as string[];
    const updated = await storage.updateUser(id, { medicalFlags: cleaned } as any);
    await audit(
      req,
      "client.medical_flags_update",
      "user",
      id,
      { userId: id, medicalFlags: (target as any).medicalFlags ?? [] },
      { userId: id, medicalFlags: cleaned },
    );
    res.json(sanitizeUserAdminView(updated));
  });

  // ============== TASK #57 — AUDIT LOG QUERY ENDPOINTS ==============
  // Global feed (used by /admin/audit-log) and a per-client slice (used
  // by the client detail Timeline tab to render audit alongside the
  // existing activity feed).
  app.get("/api/admin/audit-log", requireAdmin, async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const entityType = typeof req.query.entityType === "string" ? req.query.entityType : undefined;
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const rows = await (storage as any).listAuditEntries({
      limit,
      offset,
      entityType,
      userId: Number.isFinite(userId) ? userId : undefined,
    });
    // Enrich with the actor's display name so the UI doesn't have to
    // do an N+1 fetch. Single grouped lookup over distinct actor ids.
    const actorIds = Array.from(
      new Set(
        (rows as any[])
          .map((r) => r.performedByUserId)
          .filter((x): x is number => typeof x === "number"),
      ),
    );
    const actors: Record<number, { id: number; fullName: string | null; email: string | null }> = {};
    for (const aid of actorIds) {
      const u = await storage.getUser(aid);
      if (u) actors[aid] = { id: u.id, fullName: (u as any).fullName ?? null, email: (u as any).email ?? null };
    }
    res.json(
      (rows as any[]).map((r) => ({
        ...r,
        actor: r.performedByUserId ? actors[r.performedByUserId] ?? null : null,
      })),
    );
  });

  app.get("/api/admin/clients/:id/audit-log", requireAdmin, async (req, res) => {
    const userId = Number(req.params.id);
    if (!userId) return res.status(400).json({ message: "Invalid client id" });
    const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 500);
    const rows = await (storage as any).listAuditEntries({ userId, limit });
    const actorIds = Array.from(
      new Set(
        (rows as any[])
          .map((r) => r.performedByUserId)
          .filter((x): x is number => typeof x === "number"),
      ),
    );
    const actors: Record<number, { id: number; fullName: string | null }> = {};
    for (const aid of actorIds) {
      const u = await storage.getUser(aid);
      if (u) actors[aid] = { id: u.id, fullName: (u as any).fullName ?? null };
    }
    res.json(
      (rows as any[]).map((r) => ({
        ...r,
        actor: r.performedByUserId ? actors[r.performedByUserId] ?? null : null,
      })),
    );
  });

  // ============== TASK #57 — VIEW AS CLIENT (IMPERSONATION) ==============
  // Session-scoped. Stores the original admin id + target client id on
  // the express session; the middleware in setupAuth() rewrites req.user
  // and blocks every non-GET while it's set.
  //
  // IMPORTANT: /exit MUST be declared before /:userId so Express doesn't
  // match "exit" as a userId param. During impersonation requireAdmin
  // fails (req.user is the client), so /exit also runs without it — it
  // is gated on the session's own impersonatorUserId.
  app.post("/api/admin/impersonate/exit", async (req, res) => {
    const s: any = req.session;
    const adminId = s?.impersonatorUserId;
    const targetId = s?.impersonatedUserId;
    if (!adminId) return res.json({ ok: true });
    delete s.impersonatorUserId;
    delete s.impersonatedUserId;
    // Restore passport's serialized user id so the next request resolves
    // back to the original admin without forcing a re-login.
    if (s.passport && typeof adminId === "number") {
      s.passport.user = adminId;
    }
    // Best-effort audit — performed by admin even though `req.user` was
    // the client during impersonation; we pass adminId explicitly.
    try {
      await storage.recordAuditLog({
        action: "client.impersonate_end",
        entityType: "user",
        entityId: targetId ?? null,
        previousValue: { adminId, viewingAs: targetId } as any,
        newValue: { adminId } as any,
        performedByUserId: adminId,
        reason: null,
      } as any);
    } catch {/* ignore */}
    s.save?.(() => res.json({ ok: true }));
  });

  app.post("/api/admin/impersonate/:userId", requireAdmin, async (req, res) => {
    const targetId = Number(req.params.userId);
    if (!targetId || !Number.isInteger(targetId)) {
      return res.status(400).json({ message: "Invalid client id" });
    }
    const target = await storage.getUser(targetId);
    if (!target || target.role !== "client") {
      return res.status(404).json({ message: "Client not found" });
    }
    const me = req.user as User;
    const s: any = req.session;
    s.impersonatorUserId = me.id;
    s.impersonatedUserId = targetId;
    await audit(req, "client.impersonate_start", "user", targetId,
      { adminId: me.id }, { adminId: me.id, viewingAs: targetId });
    s.save?.(() => res.json({ ok: true, impersonatedUserId: targetId }));
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

    const previousExpiry = pkg.expiryDate ? String(pkg.expiryDate) : null;
    let newExpiryStr: string;
    let daysAdded: number;
    if (parsed.data.newExpiryDate) {
      newExpiryStr = parsed.data.newExpiryDate;
      const baseMs = previousExpiry ? new Date(previousExpiry).getTime() : Date.now();
      daysAdded = Math.max(
        0,
        Math.round((new Date(newExpiryStr).getTime() - baseMs) / 86_400_000),
      );
    } else {
      const base = pkg.expiryDate ? new Date(pkg.expiryDate as any) : new Date();
      const next = new Date(base);
      daysAdded = parsed.data.addDays ?? 7;
      next.setDate(next.getDate() + daysAdded);
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
    void dispatchAdminPackageExtendedEmail({
      pkg: updated,
      daysAdded,
      previousExpiry,
      newExpiry: newExpiryStr,
    });
    await audit(
      req,
      "package.extend",
      "package",
      pkg.id,
      { userId: pkg.userId, expiryDate: previousExpiry },
      { userId: pkg.userId, expiryDate: newExpiryStr, daysAdded },
      parsed.data.newExpiryDate
        ? `Expiry set to ${newExpiryStr}`
        : `Extended by ${parsed.data.addDays ?? 7} days`,
    );
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
      await audit(req, "booking.manual_create", "booking", created.id,
        null,
        {
          userId,
          packageId: data.packageId ?? null,
          date: data.date,
          timeSlot: data.timeSlot,
          status: finalStatus,
          consumedSession: willConsume,
        });
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
      await audit(req, "booking.manual_create_bulk", "booking", created[0]?.id ?? null,
        null,
        {
          userId,
          packageId: data.packageId ?? null,
          startDate: data.startDate,
          timeSlot: data.timeSlot,
          count: data.count,
          spacingDays: data.spacingDays,
          status: finalStatus,
          consumedSessions: willConsume ? data.count : 0,
          bookingIds: created.map((b) => b.id),
        });
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
      fullName: "Youssef Elite",
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
      fullName: existing.fullName === "Youssef Fitness" || existing.fullName === "Youssef Ahmed" ? "Youssef Elite" : existing.fullName,
    } as any);
    console.log("Admin password reset to: change-this-password (RESEED_ADMIN=1)");
  } else if (existing.fullName === "Youssef Fitness" || existing.fullName === "Youssef Ahmed") {
    // Quietly correct the admin display name without touching the password.
    try {
      await storage.updateUser(existing.id, { fullName: "Youssef Elite" } as any);
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
    "Youssef Elite provides premium personal training services in Dubai, combining academic physical education, movement science, competitive sports experience, and structured coaching systems. His approach focuses on safe, personalized, and result-driven training for adults, beginners, fat-loss clients, muscle-gain clients, and kids & youth fitness.";

  // Only replace the bio when it's empty OR when it still matches one of the
  // known legacy auto-seeded prefixes. A startsWith check prevents clobbering
  // any custom bio an admin may have written that incidentally mentions one of
  // the legacy phrases later in the text.
  const LEGACY_BIO_PREFIXES = [
    "Youssef Tarek Hashim Ahmed is a certified",
    "Certified personal trainer and physical education teacher based in Dubai",
    "Youssef Ahmed provides premium personal training services",
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
