import { pgTable, text, serial, integer, boolean, timestamp, jsonb, decimal, date } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// === TABLE DEFINITIONS ===

// Users (Clients & Admins)
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(), // Used for login
  password: text("password").notNull(),
  fullName: text("full_name").notNull(),
  email: text("email"),
  phone: text("phone"),
  role: text("role").notNull().default("client"), // 'admin' | 'client'
  membershipTier: text("membership_tier").default("standard"), // 'silver' | 'gold' | 'platinum'
  sessionsRemaining: integer("sessions_remaining").default(0),
  avatarUrl: text("avatar_url"),
  language: text("language").default("en"), // 'en' | 'ar'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Packages (Training packages)
export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // e.g., "10 Sessions", "Monthly Gold"
  description: text("description"),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  sessionCount: integer("session_count").notNull(),
  tier: text("tier").default("standard"), // 'silver' | 'gold' | 'platinum'
  isActive: boolean("is_active").default(true),
});

// Bookings (Training sessions)
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: date("date").notNull(), // YYYY-MM-DD
  timeSlot: text("time_slot").notNull(), // e.g., "10:00"
  status: text("status").notNull().default("booked"), // 'booked' | 'completed' | 'no_show' | 'cancelled'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Payments (Receipts/Transactions)
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  packageId: integer("package_id").references(() => packages.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'approved' | 'rejected'
  receiptUrl: text("receipt_url"), // Image of bank transfer
  paymentMethod: text("payment_method").default("bank_transfer"),
  reviewedBy: integer("reviewed_by").references(() => users.id), // Admin who approved
  createdAt: timestamp("created_at").defaultNow(),
});

// Nutrition Plans (AI generated or manual)
export const nutritionPlans = pgTable("nutrition_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(), // Markdown or JSON structure of the plan
  macros: jsonb("macros"), // { protein: 150, carbs: 200, fat: 60 }
  assignedBy: text("assigned_by").default("ai"), // 'ai' | 'admin'
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Intake Logs (Daily food tracking)
export const intakeLogs = pgTable("intake_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  date: date("date").notNull(),
  mealType: text("meal_type").notNull(), // 'breakfast' | 'lunch' | 'dinner' | 'snack'
  description: text("description").notNull(),
  calories: integer("calories"),
  protein: integer("protein"),
  carbs: integer("carbs"),
  fats: integer("fats"),
  imageUrl: text("image_url"), // Photo of meal
  createdAt: timestamp("created_at").defaultNow(),
});

// === RELATIONS ===
export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  payments: many(payments),
  nutritionPlans: many(nutritionPlans),
  intakeLogs: many(intakeLogs),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, {
    fields: [bookings.userId],
    references: [users.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  user: one(users, {
    fields: [payments.userId],
    references: [users.id],
  }),
  package: one(packages, {
    fields: [payments.packageId],
    references: [packages.id],
  }),
}));

// === BASE SCHEMAS ===
export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true, sessionsRemaining: true, membershipTier: true, role: true }); // Client registration is restricted
export const insertAdminUserSchema = createInsertSchema(users); // For seeding/admin use
export const insertPackageSchema = createInsertSchema(packages).omit({ id: true });
export const insertBookingSchema = createInsertSchema(bookings).omit({ id: true, createdAt: true, status: true });
export const insertPaymentSchema = createInsertSchema(payments).omit({ id: true, createdAt: true, status: true, reviewedBy: true });
export const insertNutritionPlanSchema = createInsertSchema(nutritionPlans).omit({ id: true, createdAt: true });
export const insertIntakeLogSchema = createInsertSchema(intakeLogs).omit({ id: true, createdAt: true });

// === EXPLICIT API CONTRACT TYPES ===

// Users
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpdateUserRequest = Partial<InsertUser>;
export type UserResponse = Omit<User, "password">; // Never return password

// Packages
export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type UpdatePackageRequest = Partial<InsertPackage>;

// Bookings
export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type UpdateBookingRequest = Partial<InsertBooking> & { status?: string }; // Allow status updates

// Payments
export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;
export type UpdatePaymentRequest = Partial<InsertPayment> & { status?: string; reviewedBy?: number };

// Nutrition
export type NutritionPlan = typeof nutritionPlans.$inferSelect;
export type InsertNutritionPlan = z.infer<typeof insertNutritionPlanSchema>;
export type IntakeLog = typeof intakeLogs.$inferSelect;
export type InsertIntakeLog = z.infer<typeof insertIntakeLogSchema>;

// Auth
export type LoginRequest = { username: string; password: string };
export type AuthResponse = { user: UserResponse };

// Stats for Admin Dashboard
export type DashboardStats = {
  activeClients: number;
  totalRevenue: number;
  pendingPayments: number;
  upcomingSessions: number;
};

export * from "./models/chat";
