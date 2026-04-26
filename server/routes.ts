import type { Express, Request, Response, NextFunction } from "express";
import { type Server } from "http";
import { setupAuth, hashPassword, sanitizeUser } from "./auth";
import { storage } from "./storage";
import {
  insertBookingSchema,
  updateBookingSchema,
  updateSettingsSchema,
  insertBlockedSlotSchema,
  updateProfileSchema,
  type User,
} from "@shared/schema";
import { z } from "zod";

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
  // Treat slot times as local server time. Both come in as YYYY-MM-DD and HH:MM
  return new Date(`${date}T${timeSlot}:00`);
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  setupAuth(app);

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

    // attach user info for admin views
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

    // Validate slot is in the future and not blocked / not already taken
    const sessionAt = buildSessionDate(parsed.data.date, parsed.data.timeSlot);
    if (isNaN(sessionAt.getTime())) {
      return res.status(400).json({ message: "Invalid date or time" });
    }
    if (me.role !== "admin" && sessionAt.getTime() < Date.now()) {
      return res.status(400).json({ message: "Cannot book a session in the past" });
    }

    const blocked = await storage.getBlockedSlots();
    const isBlocked = blocked.some(
      (b) => b.date === parsed.data.date && (b.timeSlot === null || b.timeSlot === parsed.data.timeSlot),
    );
    if (isBlocked && me.role !== "admin") {
      return res.status(400).json({ message: "This slot is unavailable" });
    }

    const existing = await storage.getBookingByDateAndSlot(parsed.data.date, parsed.data.timeSlot);
    if (
      existing &&
      !["cancelled", "free_cancelled", "late_cancelled"].includes(existing.status)
    ) {
      return res.status(400).json({ message: "Slot already booked" });
    }

    const booking = await storage.createBooking({
      userId: targetUserId,
      date: parsed.data.date,
      timeSlot: parsed.data.timeSlot,
      notes: parsed.data.notes ?? null,
    });
    res.status(201).json(booking);
  });

  // Cancel: enforces 6h cutoff for clients (admin can override)
  app.post("/api/bookings/:id/cancel", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });
    if (me.role !== "admin" && booking.userId !== me.id) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const settings = await storage.getSettings();
    const cutoffMs = (settings.cancellationCutoffHours ?? 6) * 60 * 60 * 1000;
    const sessionAt = buildSessionDate(booking.date, booking.timeSlot);
    const msUntil = sessionAt.getTime() - Date.now();

    let newStatus: string;
    if (me.role === "admin") {
      newStatus = "cancelled";
    } else if (msUntil >= cutoffMs) {
      newStatus = "free_cancelled";
    } else {
      return res.status(400).json({
        message: `Cancellation locked. Less than ${settings.cancellationCutoffHours} hours remain.`,
      });
    }

    const updated = await storage.updateBooking(id, {
      status: newStatus,
      cancelledAt: new Date(),
    });
    res.json(updated);
  });

  // Update (admin: any field; client: limited)
  app.patch("/api/bookings/:id", requireAuth, async (req, res) => {
    const me = req.user as User;
    const id = Number(req.params.id);
    const booking = await storage.getBooking(id);
    if (!booking) return res.status(404).json({ message: "Booking not found" });

    const parsed = updateBookingSchema.extend({ override: z.boolean().optional() }).safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.errors[0]?.message || "Invalid update" });
    }

    if (me.role !== "admin") {
      // Client can only reschedule their own booking before cutoff (no status change)
      if (booking.userId !== me.id) return res.status(403).json({ message: "Forbidden" });
      if (parsed.data.status) return res.status(403).json({ message: "Cannot change status" });

      const settings = await storage.getSettings();
      const cutoffMs = (settings.cancellationCutoffHours ?? 6) * 60 * 60 * 1000;
      const sessionAt = buildSessionDate(booking.date, booking.timeSlot);
      if (sessionAt.getTime() - Date.now() < cutoffMs) {
        return res.status(400).json({
          message: `Reschedule locked. Less than ${settings.cancellationCutoffHours} hours remain.`,
        });
      }
      // Validate new slot if provided
      const newDate = parsed.data.date ?? booking.date;
      const newSlot = parsed.data.timeSlot ?? booking.timeSlot;
      if (parsed.data.date || parsed.data.timeSlot) {
        const taken = await storage.getBookingByDateAndSlot(newDate, newSlot);
        if (taken && taken.id !== id && !["cancelled", "free_cancelled", "late_cancelled"].includes(taken.status)) {
          return res.status(400).json({ message: "Slot already booked" });
        }
      }
    }

    const { override, ...updateFields } = parsed.data;
    const updated = await storage.updateBooking(id, updateFields as any);
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

  // ============== BLOCKED SLOTS ==============
  app.get("/api/blocked-slots", requireAuth, async (_req, res) => {
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

  // ============== DASHBOARD ==============
  app.get("/api/dashboard/stats", requireAdmin, async (_req, res) => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartStr = monthStart.toISOString().slice(0, 10);

    const [clients, allBookings] = await Promise.all([
      storage.getAllClients(),
      storage.getBookings(),
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
      email: "admin@youssef.fitness",
      password: hashed,
      fullName: "Youssef Tarek",
      phone: "+971505394754",
      role: "admin",
      fitnessGoal: null,
      notes: null,
    });
    console.log("Seeded admin account: admin / change-this-password");
  }

  // Seed default settings + bio
  const s = await storage.getSettings();
  if (!s.profileBio) {
    await storage.updateSettings({
      profileBio:
        "Youssef Tarek Hashim Ahmed is a certified personal trainer and physical education teacher based in Dubai. His journey combines academic education, competitive sports experience, professional coaching, and international client service. With experience in personal training, body transformation, weight management, and physical education, Youssef focuses on building safe, structured, and result-driven programs for every client.",
      whatsappNumber: "971505394754",
    });
  }
}
