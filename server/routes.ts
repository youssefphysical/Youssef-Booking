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
import { optimizeImageFile } from "./image-utils";

function currentMonthKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

// Auth/role guards — return both `error` (machine-readable) and `message`
// (human-readable) for backwards compatibility with existing clients.
function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Unauthorized", message: "Unauthorized" });
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

function buildSessionDate(date: string, timeSlot: string): Date {
  return new Date(`${date}T${timeSlot}:00`);
}

// Clients must book at least 3 hours before the session starts so the trainer
// has time to prepare and travel to the location. Admins bypass this rule.
// The 6-hour cutoff still applies to *cancellations* (settings.cancellation_cutoff_hours).
const MIN_ADVANCE_BOOKING_MS = 3 * 60 * 60 * 1000;
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
  try {
    await storage.createAdminNotification({
      kind: "booking_new",
      title: `New booking — ${clientName}`,
      body: `${booking.date} at ${time12} • ${sessionFocusLabel} • ${trainingGoalLabel} • ${sessionTypeLabel}`,
      userId: targetUserId,
      bookingId: booking.id,
    });
  } catch (e) {
    console.warn("[notif] createAdminNotification failed:", e);
  }

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
function sanitizeBookingForUser<T extends { privateCoachNotes?: any }>(
  me: { role?: string } | undefined,
  booking: T,
): T {
  if (!booking) return booking;
  if (me?.role === "admin") return booking;
  const { privateCoachNotes, ...rest } = booking as any;
  return rest as T;
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
    // Batched enrichment — two grouped queries instead of 2*N per-user
    // fetches. Scales gracefully as bookings/inbody history grows.
    const enriched = await sanitizeAndEnrichMany(clients);
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
    const enriched = await sanitizeAndEnrich(user);
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
  app.get("/api/bookings", requireAuth, async (req, res) => {
    const me = req.user as User;
    const userIdQuery = req.query.userId ? Number(req.query.userId) : undefined;
    const from = typeof req.query.from === "string" ? req.query.from : undefined;
    const includeUser = req.query.includeUser === "true";

    const filters: { userId?: number; from?: string } = {};
    if (me.role !== "admin") {
      filters.userId = me.id;
    } else if (userIdQuery) {
      filters.userId = userIdQuery;
    }
    if (from) filters.from = from;

    const list = await storage.getBookings(filters);
    if (!includeUser) return res.json(list.map((b) => sanitizeBookingForUser(me, b)));

    const userIds = Array.from(new Set(list.map((b) => b.userId)));
    const usersById: Record<number, ReturnType<typeof sanitizeUser>> = {};
    for (const uid of userIds) {
      const u = await storage.getUser(uid);
      if (u) usersById[uid] = sanitizeUser(u);
    }
    res.json(list.map((b) => sanitizeBookingForUser(me, { ...b, user: usersById[b.userId] || null })));
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

    const sessionAt = buildSessionDate(parsed.data.date, parsed.data.timeSlot);
    if (isNaN(sessionAt.getTime())) {
      return res.status(400).json({ message: "Invalid date or time" });
    }
    if (me.role !== "admin" && !ALLOWED_BOOKING_HOURS.has(parsed.data.timeSlot)) {
      return res.status(400).json({
        message: "Sessions can only be booked between 06:00 AM and 10:00 PM.",
      });
    }
    if (me.role !== "admin" && sessionAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "Cannot book a session in the past" });
    }
    if (
      me.role !== "admin" &&
      sessionAt.getTime() - Date.now() < MIN_ADVANCE_BOOKING_MS
    ) {
      return res.status(400).json({
        message: "Bookings must be made at least 3 hours in advance.",
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

    const booking = await storage.createBooking({
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
    });

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

  app.post("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (me.role !== "admin" && booking.userId !== me.id) {
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
      const owner = await storage.getUser(booking.userId);
      const monthKey = currentMonthKey();
      const usedThisMonth =
        owner?.protectedCancelMonth === monthKey
          ? (owner.protectedCancelCount ?? 0)
          : 0;
      const quota = protectedCancellationQuota(owner?.vipTier);
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
        const owner = await storage.getUser(booking.userId);
        const monthKey = currentMonthKey();
        const sameMonth = owner?.protectedCancelMonth === monthKey;
        await storage.updateUser(booking.userId, {
          protectedCancelMonth: monthKey,
          protectedCancelCount: sameMonth
            ? (owner?.protectedCancelCount ?? 0) + 1
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
    if (newStatus === "late_cancelled" && booking.packageId) {
      try {
        await storage.incrementPackageUsage(booking.packageId);
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
    if (me.role !== "admin" && booking.userId !== me.id) {
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

    // Quota check (skip for admin)
    if (me.role !== "admin") {
      const owner = await storage.getUser(booking.userId);
      const monthKey = currentMonthKey();
      const usedThisMonth =
        owner?.sameDayAdjustMonth === monthKey ? (owner.sameDayAdjustCount ?? 0) : 0;
      const quota = sameDayAdjustQuota(owner?.vipTier);
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
        const owner = await storage.getUser(booking.userId);
        const monthKey = currentMonthKey();
        const sameMonth = owner?.sameDayAdjustMonth === monthKey;
        await storage.updateUser(booking.userId, {
          sameDayAdjustMonth: monthKey,
          sameDayAdjustCount: sameMonth
            ? (owner?.sameDayAdjustCount ?? 0) + 1
            : 1,
        } as any);
      } catch {
        /* ignore */
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
      if (booking.userId !== me.id) return res.status(403).json({ message: "Forbidden" });
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
    if (
      (updateFields.date && updateFields.date !== booking.date) ||
      (updateFields.timeSlot && updateFields.timeSlot !== booking.timeSlot)
    ) {
      void dispatchBookingChangeNotification({
        kind: "reschedule",
        booking: { ...booking, ...updateFields } as Booking,
        fromDate,
        fromTime12,
      });
    }

    // Package deduction logic on status transition
    const consumingStates = ["completed", "late_cancelled"];
    const wasConsuming = consumingStates.includes(previousStatus);
    const isConsuming = consumingStates.includes(newStatus);
    if (booking.packageId && !wasConsuming && isConsuming) {
      try {
        await storage.incrementPackageUsage(booking.packageId);
      } catch {}
    } else if (booking.packageId && wasConsuming && !isConsuming) {
      try {
        await storage.decrementPackageUsage(booking.packageId);
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

        const dispatch = async (kind: "24h" | "1h") => {
          try {
            // Atomic check-and-claim: stamp the column NOW with a UPDATE ...
            // WHERE col IS NULL RETURNING id. If two cron invocations race,
            // exactly one wins the row. The loser sees rowCount=0 and skips.
            const col = kind === "24h" ? "reminder_24h_sent_at" : "reminder_1h_sent_at";
            const claim = await pool.query(
              `UPDATE bookings SET ${col} = now() WHERE id = $1 AND ${col} IS NULL RETURNING id`,
              [b.id],
            );
            if (claim.rowCount === 0) return; // already claimed by another worker

            const owner = await storage.getUser(b.userId).catch(() => undefined);
            if (!owner?.email) return;
            const ownerLang = (owner as any).preferredLanguage || "en";
            const built = buildSessionReminderEmail({
              kind,
              lang: ownerLang,
              data: {
                clientName: owner.fullName || owner.username || "Client",
                date: b.date,
                time12: formatTime12Server(b.timeSlot),
                sessionFocusLabel: b.sessionFocus || null,
                trainingGoalLabel: b.trainingGoal || null,
              },
            });
            const result = await sendEmail({
              to: owner.email,
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

        if (want24 && !bAny.reminder24hSentAt) await dispatch("24h");
        if (want1 && !bAny.reminder1hSentAt) await dispatch("1h");
      }

      res.json({ ok: true, scanned: all.length, sent, failed });
    } catch (e: any) {
      console.error("[cron/reminders] failed", e);
      res.status(500).json({ ok: false, error: e?.message || "unknown", sent, failed });
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
    const consumingStates = ["completed", "late_cancelled", "no_show"];
    const wasConsuming = consumingStates.includes(previousStatus);

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

    // Package usage reconciliation
    if (booking.packageId) {
      try {
        if (!wasConsuming && consumesSession) {
          await storage.incrementPackageUsage(booking.packageId);
        } else if (wasConsuming && !consumesSession) {
          await storage.decrementPackageUsage(booking.packageId);
        }
      } catch (e) {
        console.warn("[attendance] package reconciliation failed:", e);
      }
    }

    // No-show counter on the user
    if (parsed.data.attendance === "no_show" && previousStatus !== "no_show") {
      try { await storage.incrementUserNoShow(booking.userId); } catch {}
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
      const consumingStates = ["completed", "late_cancelled"];
      const willConsume = !!data.packageId && consumingStates.includes(finalStatus);
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
      if (willConsume) {
        try {
          await storage.incrementPackageUsage(data.packageId!);
        } catch (e) {
          console.error("[manual-booking] increment package usage failed:", e);
          // Roll the booking back so balance stays consistent with bookings.
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
      const consumingStates = ["completed", "late_cancelled"];
      const willConsume = !!data.packageId && consumingStates.includes(finalStatus);
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
      // Atomic single increment for the whole batch.
      if (willConsume) {
        try {
          await storage.incrementPackageUsage(data.packageId!, data.count);
        } catch (e) {
          console.error("[manual-booking-bulk] increment package usage failed:", e);
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
