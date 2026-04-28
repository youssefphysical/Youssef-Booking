import {
  pgTable,
  text,
  serial,
  integer,
  doublePrecision,
  timestamp,
  date,
  boolean,
} from "drizzle-orm/pg-core";
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
  area: text("area"),
  emergencyContactName: text("emergency_contact_name"),
  emergencyContactPhone: text("emergency_contact_phone"),
  fitnessGoal: text("fitness_goal"),
  // Primary goal: 'fat_loss' | 'muscle_gain' | 'recomposition'
  primaryGoal: text("primary_goal"),
  hasUsedFreeTrial: boolean("has_used_free_trial").notNull().default(false),
  // Tracks last calendar month an emergency cancel was used (e.g. "2026-04")
  emergencyCancelLastMonth: text("emergency_cancel_last_month"),
  emergencyCancelLastUsedAt: timestamp("emergency_cancel_last_used_at"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================
// PACKAGES (session credits)
// =============================
// type values: 'single' | '10' | '20' | '25' | 'duo30' | 'trial'
export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  partnerUserId: integer("partner_user_id").references(() => users.id), // for duo
  type: text("type").notNull(), // '10' | '20' | '25' | 'duo30'
  totalSessions: integer("total_sessions").notNull(),
  usedSessions: integer("used_sessions").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  purchasedAt: timestamp("purchased_at").defaultNow(),
});

// =============================
// BOOKINGS
// =============================
// sessionType: 'package' | 'single' | 'trial' | 'duo'
// status:      'upcoming' | 'confirmed' | 'completed' | 'cancelled'
//            | 'free_cancelled' | 'late_cancelled' | 'emergency_cancelled'
//            | 'no_show'
// paymentStatus: 'unpaid' | 'paid' | 'pending' | 'direct_payment_requested' | 'free'
export const bookings = pgTable("bookings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  packageId: integer("package_id").references(() => packages.id),
  date: date("date").notNull(),
  timeSlot: text("time_slot").notNull(), // "HH:MM"
  status: text("status").notNull().default("upcoming"),
  sessionType: text("session_type").notNull().default("package"),
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  workoutCategory: text("workout_category"),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  clientNotes: text("client_notes"),
  isEmergencyCancel: boolean("is_emergency_cancel").notNull().default(false),
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
  bankAccountName: text("bank_account_name").default("Youssef Tarek Hashim Ahmed"),
  bankIban: text("bank_iban").default("AE230260001015917468101"),
  showBankDetailsPublicly: boolean("show_bank_details_publicly").notNull().default(false),
});

// =============================
// BLOCKED SLOTS / HOLIDAYS
// =============================
// blockType: 'off-day' | 'emergency' | 'fully-booked' (only for whole-day blocks)
// If timeSlot is null -> entire date is blocked.
export const blockedSlots = pgTable("blocked_slots", {
  id: serial("id").primaryKey(),
  date: date("date").notNull(),
  timeSlot: text("time_slot"),
  blockType: text("block_type").default("off-day"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================
// INBODY RECORDS
// =============================
export const inbodyRecords = pgTable("inbody_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  fileUrl: text("file_url"), // path under /uploads/inbody/
  fileName: text("file_name"),
  mimeType: text("mime_type"),
  weight: doublePrecision("weight"),
  bodyFat: doublePrecision("body_fat"),
  muscleMass: doublePrecision("muscle_mass"),
  bmi: doublePrecision("bmi"),
  visceralFat: doublePrecision("visceral_fat"),
  bmr: doublePrecision("bmr"),
  water: doublePrecision("water"),
  score: doublePrecision("score"),
  aiExtracted: boolean("ai_extracted").notNull().default(false),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// =============================
// PROGRESS PHOTOS
// =============================
// type: 'before' | 'current' | 'after'
export const progressPhotos = pgTable("progress_photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  photoUrl: text("photo_url").notNull(),
  type: text("type").notNull().default("current"),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

// =============================
// CONSENT RECORDS (legal/audit)
// =============================
// consentType: 'registration' | 'booking' | 'inbody' | 'progress'
export const consentRecords = pgTable("consent_records", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  consentType: text("consent_type").notNull(),
  policyVersion: text("policy_version").notNull().default("v1"),
  acceptedItems: text("accepted_items").array(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================
// RELATIONS
// =============================
export const usersRelations = relations(users, ({ many }) => ({
  bookings: many(bookings),
  packages: many(packages),
  inbodyRecords: many(inbodyRecords),
  progressPhotos: many(progressPhotos),
}));

export const bookingsRelations = relations(bookings, ({ one }) => ({
  user: one(users, { fields: [bookings.userId], references: [users.id] }),
  package: one(packages, { fields: [bookings.packageId], references: [packages.id] }),
}));

export const packagesRelations = relations(packages, ({ one, many }) => ({
  user: one(users, { fields: [packages.userId], references: [users.id], relationName: "owner" }),
  partner: one(users, { fields: [packages.partnerUserId], references: [users.id], relationName: "partner" }),
  bookings: many(bookings),
}));

// =============================
// SCHEMAS (Zod)
// =============================
export const insertClientSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, role: true, username: true })
  .extend({
    fullName: z.string().min(2, "Full name is required"),
    email: z.string().email("Valid email is required"),
    phone: z.string().min(7, "Phone number is required"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    area: z.string().optional(),
    emergencyContactName: z.string().optional(),
    emergencyContactPhone: z.string().optional(),
    fitnessGoal: z.string().optional(),
    primaryGoal: z
      .enum(["fat_loss", "muscle_gain", "recomposition"])
      .optional(),
    notes: z.string().optional(),
  });

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });

export const updateProfileSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, role: true, username: true })
  .partial();

export const SESSION_TYPES = ["package", "single", "trial", "duo"] as const;
export const BOOKING_STATUSES = [
  "upcoming",
  "confirmed",
  "completed",
  "cancelled",
  "free_cancelled",
  "late_cancelled",
  "emergency_cancelled",
  "no_show",
] as const;
export const PAYMENT_STATUSES = [
  "unpaid",
  "paid",
  "pending",
  "direct_payment_requested",
  "free",
] as const;
export const WORKOUT_CATEGORIES = [
  "chest",
  "shoulders",
  "back",
  "legs",
  "core",
  "arms",
  "crossfit",
  "cardio",
  "mobility",
  "full_body",
  "other",
] as const;

export const insertBookingSchema = createInsertSchema(bookings)
  .omit({
    id: true,
    createdAt: true,
    status: true,
    cancelledAt: true,
    isEmergencyCancel: true,
  })
  .extend({
    date: z.string(),
    timeSlot: z.string(),
    packageId: z.number().int().nullable().optional(),
    sessionType: z.enum(SESSION_TYPES).optional(),
    paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
    workoutCategory: z.enum(WORKOUT_CATEGORIES).nullable().optional(),
    notes: z.string().nullable().optional(),
    adminNotes: z.string().nullable().optional(),
    clientNotes: z.string().nullable().optional(),
  });

export const updateBookingSchema = z.object({
  status: z.enum(BOOKING_STATUSES).optional(),
  date: z.string().optional(),
  timeSlot: z.string().optional(),
  notes: z.string().nullable().optional(),
  adminNotes: z.string().nullable().optional(),
  clientNotes: z.string().nullable().optional(),
  workoutCategory: z.enum(WORKOUT_CATEGORIES).nullable().optional(),
  packageId: z.number().int().nullable().optional(),
  sessionType: z.enum(SESSION_TYPES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
});

export const insertBlockedSlotSchema = createInsertSchema(blockedSlots)
  .omit({ id: true, createdAt: true })
  .extend({
    date: z.string(),
    timeSlot: z.string().nullable().optional(),
    blockType: z.enum(["off-day", "emergency", "fully-booked"]).optional(),
    reason: z.string().nullable().optional(),
  });

export const updateSettingsSchema = z.object({
  cancellationCutoffHours: z.number().int().min(0).max(168).optional(),
  profilePhotoUrl: z.string().nullable().optional(),
  profileBio: z.string().nullable().optional(),
  whatsappNumber: z.string().optional(),
  bankAccountName: z.string().nullable().optional(),
  bankIban: z.string().nullable().optional(),
  showBankDetailsPublicly: z.boolean().optional(),
});

export const PACKAGE_TYPES = [
  "single",
  "10",
  "20",
  "25",
  "duo30",
  "trial",
] as const;

export const insertPackageSchema = createInsertSchema(packages)
  .omit({ id: true, purchasedAt: true })
  .extend({
    type: z.enum(PACKAGE_TYPES),
    totalSessions: z.number().int().min(1),
    usedSessions: z.number().int().min(0).optional(),
    notes: z.string().optional(),
    partnerUserId: z.number().int().nullable().optional(),
    isActive: z.boolean().optional(),
  });

export const updatePackageSchema = insertPackageSchema.partial().omit({ userId: true });

export const insertInbodySchema = createInsertSchema(inbodyRecords)
  .omit({ id: true, recordedAt: true })
  .extend({
    weight: z.number().positive().nullable().optional(),
    bodyFat: z.number().nullable().optional(),
    muscleMass: z.number().nullable().optional(),
    bmi: z.number().nullable().optional(),
    visceralFat: z.number().nullable().optional(),
    bmr: z.number().nullable().optional(),
    water: z.number().nullable().optional(),
    score: z.number().nullable().optional(),
    notes: z.string().nullable().optional(),
    fileUrl: z.string().nullable().optional(),
    fileName: z.string().nullable().optional(),
    mimeType: z.string().nullable().optional(),
    aiExtracted: z.boolean().optional(),
  });

export const updateInbodySchema = insertInbodySchema.partial().omit({ userId: true });

export const insertProgressPhotoSchema = createInsertSchema(progressPhotos)
  .omit({ id: true, recordedAt: true })
  .extend({
    photoUrl: z.string().min(1),
    type: z.enum(["before", "current", "after"]).optional(),
    notes: z.string().nullable().optional(),
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
export type BookingWithUser = Booking & { user: UserResponse };

export type Settings = typeof settings.$inferSelect;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

export type BlockedSlot = typeof blockedSlots.$inferSelect;
export type InsertBlockedSlot = z.infer<typeof insertBlockedSlotSchema>;

export type Package = typeof packages.$inferSelect;
export type InsertPackage = z.infer<typeof insertPackageSchema>;
export type UpdatePackage = z.infer<typeof updatePackageSchema>;
export type PackageWithUser = Package & {
  user?: UserResponse;
  partner?: UserResponse | null;
};

export type InbodyRecord = typeof inbodyRecords.$inferSelect;
export type InsertInbody = z.infer<typeof insertInbodySchema>;
export type UpdateInbody = z.infer<typeof updateInbodySchema>;

export type ProgressPhoto = typeof progressPhotos.$inferSelect;
export type InsertProgressPhoto = z.infer<typeof insertProgressPhotoSchema>;

export const insertConsentSchema = createInsertSchema(consentRecords)
  .omit({ id: true, createdAt: true })
  .extend({
    consentType: z.enum(["registration", "booking", "inbody", "progress"]),
    policyVersion: z.string().optional(),
    acceptedItems: z.array(z.string()).min(1),
    ipAddress: z.string().nullable().optional(),
    userAgent: z.string().nullable().optional(),
  });

export type ConsentRecord = typeof consentRecords.$inferSelect;
export type InsertConsent = z.infer<typeof insertConsentSchema>;

export const REGISTRATION_CONSENT_ITEMS = [
  "info_accurate",
  "cancellation_policy",
  "terms_conditions",
  "medical_fitness",
  "data_storage",
] as const;

export const POLICY_VERSION = "v1";

export type LoginRequest = { username: string; password: string };
export type AuthResponse = { user: UserResponse };

export type DashboardStats = {
  totalClients: number;
  upcomingBookings: number;
  bookingsToday: number;
  completedThisMonth: number;
  activePackages: number;
};

export const PACKAGE_DEFINITIONS: Record<
  string,
  { label: string; sessions: number; isDuo?: boolean; isTrial?: boolean; isSingle?: boolean }
> = {
  single: { label: "Single Session", sessions: 1, isSingle: true },
  "10": { label: "10 Sessions", sessions: 10 },
  "20": { label: "20 Sessions", sessions: 20 },
  "25": { label: "25 Sessions", sessions: 25 },
  duo30: { label: "Duo Package — 30 Sessions", sessions: 30, isDuo: true },
  trial: { label: "Free Trial Session — New Client Only", sessions: 1, isTrial: true },
};

export const PRIMARY_GOAL_OPTIONS: { value: string; label: string }[] = [
  { value: "fat_loss", label: "Fat Loss" },
  { value: "muscle_gain", label: "Muscle Gain" },
  { value: "recomposition", label: "Body Recomposition – Build Muscle & Lose Fat" },
];

export const SESSION_TYPE_LABELS: Record<string, string> = {
  package: "Package Session",
  single: "Single Session",
  trial: "Free Trial Session – New Client Only",
  duo: "Duo Package Session",
};

export const PAYMENT_STATUS_LABELS: Record<string, string> = {
  unpaid: "Unpaid",
  paid: "Paid",
  pending: "Pending",
  direct_payment_requested: "Direct Payment Requested",
  free: "Free",
};

export const WORKOUT_CATEGORY_LABELS: Record<string, string> = {
  chest: "Chest",
  shoulders: "Shoulders",
  back: "Back",
  legs: "Legs",
  core: "Core",
  arms: "Arms",
  crossfit: "CrossFit",
  cardio: "Cardio",
  mobility: "Mobility",
  full_body: "Full Body",
  other: "Other",
};

export const BOOKING_STATUS_LABELS: Record<string, string> = {
  upcoming: "Upcoming",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
  free_cancelled: "Cancelled (Free)",
  late_cancelled: "Late Cancellation – Session Charged",
  emergency_cancelled: "Emergency Cancel Used",
  no_show: "No Show",
};
