import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import express from "express";
import path from "path";
import fs from "fs";
import multer from "multer";
import { setupAuth, hashPassword, sanitizeUser } from "./auth";
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
  type User,
  type Package,
} from "@shared/schema";
import { z } from "zod";
import { extractInbodyMetricsFromImage } from "./inbody-extract";
import { optimizeImageFile } from "./image-utils";

function currentMonthKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Unauthorized" });
  next();
}

function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.isAuthenticated() || !req.user) return res.status(401).json({ message: "Unauthorized" });
  if ((req.user as User).role !== "admin") return res.status(403).json({ message: "Admins only" });
  next();
}

function buildSessionDate(date: string, timeSlot: string): Date {
  return new Date(`${date}T${timeSlot}:00`);
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

  // ============== USERS ==============
  app.get("/api/users", requireAdmin, async (_req, res) => {
    const clients = await storage.getAllClients();
    res.json(clients.map(sanitizeUser));
  });

  app.get("/api/users/:id", requireAuth, async (req, res) => {
    const id = Number(req.params.id);
    const me = req.user as User;
    if (me.role !== "admin" && me.id !== id) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const user = await storage.getUser(id);
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(sanitizeUser(user));
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
    if (me.role !== "admin" && sessionAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "Cannot book a session in the past" });
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

    const useEmergencyCancel = !!(req.body && req.body.useEmergencyCancel);

    const settings = await storage.getSettings();
    const cutoffMs = (settings.cancellationCutoffHours ?? 6) * 60 * 60 * 1000;
    const sessionAt = buildSessionDate(booking.date, booking.timeSlot);
    const msUntil = sessionAt.getTime() - Date.now();
    const isWithinCutoff = msUntil < cutoffMs;

    let newStatus: string;
    let usedEmergency = false;

    if (me.role === "admin") {
      newStatus = "cancelled";
    } else if (!isWithinCutoff) {
      // Plenty of notice — free cancel
      newStatus = "free_cancelled";
    } else if (useEmergencyCancel) {
      // Within cutoff, client requested emergency cancel
      const owner = await storage.getUser(booking.userId);
      const monthKey = currentMonthKey();
      const alreadyUsedThisMonth = owner?.emergencyCancelLastMonth === monthKey;
      if (alreadyUsedThisMonth) {
        return res.status(400).json({
          message:
            "You have already used your Emergency Cancel for this month. Please contact Youssef directly.",
        });
      }
      newStatus = "emergency_cancelled";
      usedEmergency = true;
    } else {
      return res.status(400).json({
        message: `Cancellation locked. Less than ${settings.cancellationCutoffHours} hours remain. You can use your Emergency Cancel if available, or contact Youssef directly.`,
      });
    }

    const updated = await storage.updateBooking(id, {
      status: newStatus,
      cancelledAt: new Date(),
      isEmergencyCancel: usedEmergency,
    });

    if (usedEmergency) {
      try {
        await storage.updateUser(booking.userId, {
          emergencyCancelLastMonth: currentMonthKey(),
          emergencyCancelLastUsedAt: new Date(),
        });
      } catch {
        /* ignore */
      }
    }

    // Only late_cancelled deducts; emergency_cancelled / free_cancelled / cancelled do not.
    if (newStatus === "late_cancelled" && booking.packageId) {
      try {
        await storage.incrementPackageUsage(booking.packageId);
      } catch {
        /* ignore */
      }
    }
    res.json(updated);
  });

  // Admin: clear emergency cancel usage so the client can use it again
  app.post("/api/users/:id/reset-emergency-cancel", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const updated = await storage.updateUser(id, {
      emergencyCancelLastMonth: null,
      emergencyCancelLastUsedAt: null,
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

  app.patch("/api/inbody/:id", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    const parsed = updateInbodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid update" });
    }
    const updated = await storage.updateInbodyRecord(id, parsed.data);
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
