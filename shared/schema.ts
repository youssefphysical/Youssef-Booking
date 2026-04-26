import { pgTable, text, serial, integer, boolean, timestamp, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// =============================
// USERS (Admin & Clients)
// =============================
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role").notNull().default("client"), // 'admin' | 'client'
  fitnessGoal: text("fitness_goal"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================
// BOOKINGS
// =============================
// status values:
//   'upcoming'             - awaiting admin approval
//   'confirmed'            - confirmed by admin (or auto after cutoff)
//   'completed'            - session done
//   'cancelled'            - free cancellation by admin
//   'free_cancelled'       - cancelled in time by client (>= cutoff)
//   'late_cancelled'       - cancelled after cutoff (charged)
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  timeSlot: text("time_slot").notNull(), // "HH:MM"
  status: text("status").notNull().default("upcoming"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
});

// =============================
// SETTINGS (single-row config)
// =============================
export const settings = pgTable("settings", {
  id: serial("id").primaryKey(),
  cancellationCutoffHours: integer("cancellation_cutoff_hours").notNull().default(6),
  profilePhotoUrl: text("profile_photo_url"),
  profileBio: text("profile_bio"),
  whatsappNumber: text("whatsapp_number").default("971505394754"),
});

// =============================
// BLOCKED SLOTS (date or specific time)
// =============================
// If timeSlot is null -> entire date is blocked.
// If timeSlot is set  -> only that hour on that date is blocked.
export const blockedSlots = pgTable("blocked_slots", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  timeSlot: text("time_slot"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================
// RELATIONS
// =============================
export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
}));

// =============================
// SCHEMAS
// =============================
// Public client registration: cannot set role
export const insertClientSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, role: true, username: true })
  .extend({
    fullName: z.string().min(2, "Full name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(7, "Phone number is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    fitnessGoal: z.string().optional(),
    notes: z.string().optional(),
  });

// For seeding/admin (can set role)
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });

// Profile update (no password / role / username)
export const updateProfileSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, role: true, username: true, password: true })
  .partial();

export const insertBookingSchema = createInsertSchema(bookings)
  .omit({ id: true, createdAt: true, status: true, cancelledAt: true })
  .extend({
    date: z.string(),
    timeSlot: z.string(),
  });

export const updateBookingSchema = z.object({
  status: z.enum([
    "upcoming",
    "confirmed",
    "completed",
    "cancelled",
    "free_cancelled",
    "late_cancelled",
  ]).optional(),
  date: z.string().optional(),
  timeSlot: z.string().optional(),
  notes: z.string().optional(),
});

export const insertBlockedSlotSchema = createInsertSchema(blockedSlots)
  .omit({ id: true, createdAt: true })
  .extend({
    date: z.string(),
    timeSlot: z.string().nullable().optional(),
    reason: z.string().nullable().optional(),
  });

export const updateSettingsSchema = z.object({
  cancellationCutoffHours: z.number().int().min(0).max(168).optional(),
  profilePhotoUrl: z.string().nullable().optional(),
  profileBio: z.string().nullable().optional(),
  whatsappNumber: z.string().optional(),
});

// =============================
// TYPES
// =============================
export type User = typeof users.$inferSelect;
export type UserResponse = Omit<User, "password">;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type UpdateBooking = z.infer<typeof updateBookingSchema>;

export type Settings = typeof settings.$inferSelect;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

export type BlockedSlot = typeof blockedSlots.$inferSelect;
export type InsertBlockedSlot = z.infer<typeof insertBlockedSlotSchema>;

export type LoginRequest = { username: string; password: string };
export type AuthResponse = { user: UserResponse };

export type DashboardStats = {
  totalClients: number;
  upcomingBookings: number;
  bookingsToday: number;
  completedThisMonth: number;
};

export type BookingWithUser = Booking & { user: UserResponse };
