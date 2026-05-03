import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { setupAuth, hashPassword, sanitizeUser, sanitizeAndEnrich, sanitizeAndEnrichMany, computeIsVerified } from "./auth";
import sharp from "sharp";
import { storage } from "./storage";
import {
  insertBookingSchema,
  updateBookingSchema,
  updateSettingsSchema,
  insertBlockedSlotSchema,
  updateProfileSchema,
  insertPackageSchema,
  updatePackageSchema,
  insertInbodySchema,
  updateInbodySchema,
  insertProgressPhotoSchema,
  insertHeroImageSchema,
  updateHeroImageSchema,
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
  type User,
  type Package,
  type AdminPermissionKey,
} from "@shared/schema";
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

const MIN_ADVANCE_BOOKING_MS = 6 * 60 * 60 * 1000;
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

function makeUploader(subdir: "inbody" | "photos") {
  return multer({
    storage: multer.diskStorage({
      destination: (_req, _file, cb) => cb(null, path.join(UPLOAD_ROOT, subdir)),
      filename: (_req, file, cb) => {
        const safe = file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_");
        cb(null, `${Date.now()}_${Math.round(Math.random() * 1e9)}_${safe}`);
      },
    }),
    limits: { fileSize: 15 * 1024 * 1024 },
  });
}

const inbodyUploader = makeUploader("inbody");
const photoUploader = makeUploader("photos");

function fileToPublicUrl(file: Express.Multer.File, subdir: "inbody" | "photos"): string {
  return `/uploads/${subdir}/${file.filename}`;
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
    if (!includeUser) return res.json(list);

    const userIds = Array.from(new Set(list.map((b) => b.userId)));
    const usersById: Record<number, ReturnType<typeof sanitizeUser>> = {};
    for (const uid of userIds) {
      const u = await storage.getUser(uid);
      if (u) usersById[uid] = sanitizeUser(u);
    }
    res.json(list.map((b) => ({ ...b, user: usersById[b.userId] || null })));
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
        message: "Bookings must be made at least 6 hours in advance.",
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
    });

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

    res.status(201).json(booking);
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
    res.json(updated);
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

    res.json(updated);
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
    const updated = await storage.updateBooking(id, updateFields as any);

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
    res.json(updated);
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
  // Public read — used by HomePage. Returns slides ordered by sortOrder.
  app.get("/api/hero-images", async (_req, res) => {
    const list = await storage.getHeroImages();
    res.json(list);
  });

  // Admin upload. Same sharp pipeline as profile pictures but bigger
  // canvas (1920x1080, cover) and stored as a base64 WebP data URL so it
  // works on Vercel's read-only filesystem without needing object storage.
  app.post("/api/admin/hero-images", requireAdmin, async (req, res) => {
    const schema = z.object({
      imageDataUrl: z
        .string()
        .min(40, "Image data is required")
        .max(20 * 1024 * 1024, "Image is too large"),
    });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid image" });
    }
    const match = parsed.data.imageDataUrl.match(
      /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/,
    );
    if (!match) {
      return res
        .status(400)
        .json({ message: "Image must be a base64 data URL" });
    }
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
    try {
      const buffer = Buffer.from(match[2], "base64");
      if (buffer.byteLength > 15 * 1024 * 1024) {
        return res
          .status(400)
          .json({ message: "Image is too large after decoding" });
      }
      const webp = await sharp(buffer, { failOn: "none", limitInputPixels: 50_000_000 })
        .rotate()
        .resize(1920, 1080, { fit: "cover", position: "center" })
        .webp({ quality: 78, effort: 4 })
        .toBuffer();
      const dataUrl = `data:image/webp;base64,${webp.toString("base64")}`;
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
      const created = await storage.createHeroImage({
        imageDataUrl: dataUrl,
        sortOrder: nextOrder,
      });
      res.status(201).json(created);
    } catch (e) {
      console.error("[hero-images] processing failed:", e);
      res
        .status(400)
        .json({ message: "Could not process image. Try a different photo." });
    }
  });

  app.patch("/api/admin/hero-images/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateHeroImageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res
        .status(400)
        .json({ message: parsed.error.errors[0]?.message || "Invalid order" });
    }
    const updated = await storage.updateHeroImageOrder(id, parsed.data.sortOrder);
    if (!updated) return res.status(404).json({ message: "Hero image not found" });
    res.json(updated);
  });

  app.delete("/api/admin/hero-images/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    await storage.deleteHeroImage(id);
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
    // Validate partner if duo
    if (parsed.data.type === "duo30") {
      if (!parsed.data.partnerUserId) {
        return res.status(400).json({ message: "Duo packages require a partner client" });
      }
      const partner = await storage.getUser(parsed.data.partnerUserId);
      if (!partner || partner.role !== "client") {
        return res.status(400).json({ message: "Partner must be a registered client" });
      }
    }
    const created = await storage.createPackage(parsed.data);
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
    await storage.deletePackage(Number(req.params.id));
    res.sendStatus(204);
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
    inbodyUploader.single("file"),
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
    photoUploader.single("file"),
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
      const created = await storage.createProgressPhoto({
        userId: targetUserId,
        photoUrl,
        type,
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

    const [clients, allBookings, allPackages] = await Promise.all([
      storage.getAllClients(),
      storage.getBookings(),
      storage.getPackages({ activeOnly: true }),
    ]);

    const upcomingBookings = allBookings.filter(
      (b) => ["upcoming", "confirmed"].includes(b.status) && b.date >= todayStr,
    ).length;
    const bookingsToday = allBookings.filter((b) => b.date === todayStr).length;
    const completedThisMonth = allBookings.filter(
      (b) => b.status === "completed" && b.date >= monthStartStr,
    ).length;

    res.json({
      totalClients: clients.length,
      upcomingBookings,
      bookingsToday,
      completedThisMonth,
      activePackages: allPackages.filter((p: Package) => p.usedSessions < p.totalSessions).length,
    });
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
