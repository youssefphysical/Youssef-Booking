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
  // VIP tier: 'elite' | 'progress' | 'foundation' (legacy: 'consistent','developing')
  vipTier: text("vip_tier").default("foundation"),
  vipUpdatedAt: timestamp("vip_updated_at"),
  // True when an admin has manually set the tier — auto-recompute should skip
  vipTierManualOverride: boolean("vip_tier_manual_override").notNull().default(false),
  // 1..6 sessions per week (declared at registration)
  weeklyFrequency: integer("weekly_frequency"),
  // Protected Cancellation monthly quota tracking ("YYYY-MM" / count)
  protectedCancelMonth: text("protected_cancel_month"),
  protectedCancelCount: integer("protected_cancel_count").notNull().default(0),
  // Same-Day Adjustment monthly quota tracking
  sameDayAdjustMonth: text("same_day_adjust_month"),
  sameDayAdjustCount: integer("same_day_adjust_count").notNull().default(0),
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
  workoutNotes: text("workout_notes"),
  notes: text("notes"),
  adminNotes: text("admin_notes"),
  clientNotes: text("client_notes"),
  isEmergencyCancel: boolean("is_emergency_cancel").notNull().default(false),
  // True if a Protected Cancellation was used (counts toward monthly quota; no session deducted)
  protectedCancellation: boolean("protected_cancellation").notNull().default(false),
  // Audit trail: original "YYYY-MM-DD HH:MM" before a Same-Day Adjustment
  rescheduledFrom: text("rescheduled_from"),
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
    weeklyFrequency: z
      .number()
      .int()
      .min(1, "Choose your preferred weekly training frequency")
      .max(6),
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
  workoutNotes: z.string().nullable().optional(),
  packageId: z.number().int().nullable().optional(),
  sessionType: z.enum(SESSION_TYPES).optional(),
  paymentStatus: z.enum(PAYMENT_STATUSES).optional(),
  protectedCancellation: z.boolean().optional(),
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
  { label: string; tagline?: string; sessions: number; isDuo?: boolean; isTrial?: boolean; isSingle?: boolean }
> = {
  single: { label: "Single Session", sessions: 1, isSingle: true },
  "10": { label: "Essential Plan", tagline: "10 sessions", sessions: 10 },
  "20": { label: "Progress Plan", tagline: "20 sessions", sessions: 20 },
  "25": { label: "Elite Plan", tagline: "25 sessions", sessions: 25 },
  duo30: {
    label: "Duo Performance Plan",
    tagline: "30 sessions · train together",
    sessions: 30,
    isDuo: true,
  },
  trial: {
    label: "Intro Assessment Session",
    tagline: "New client only",
    sessions: 1,
    isTrial: true,
  },
};

// Canonical tiers. Legacy values are normalised via `normaliseTier`.
export type VipTier =
  | "foundation"
  | "starter"
  | "momentum"
  | "elite"
  | "pro_elite"
  | "diamond_elite";

export const VIP_TIERS: readonly VipTier[] = [
  "diamond_elite",
  "pro_elite",
  "elite",
  "momentum",
  "starter",
  "foundation",
] as const;

export const VIP_TIER_LABELS: Record<string, string> = {
  diamond_elite: "Diamond Elite",
  pro_elite: "Pro Elite",
  elite: "Elite",
  momentum: "Momentum",
  starter: "Starter",
  foundation: "Foundation",
  // Legacy aliases (older accounts from earlier tier systems)
  progress: "Momentum",
  consistent: "Momentum",
  developing: "Foundation",
};

export const VIP_TIER_DESCRIPTIONS: Record<string, string> = {
  diamond_elite:
    "6 sessions per week. Priority booking, 2 Protected Cancellations and 2 Same-Day Adjustments each month.",
  pro_elite:
    "5 sessions per week. Priority booking, 2 Protected Cancellations and 2 Same-Day Adjustments each month.",
  elite:
    "4 sessions per week. Priority booking, 2 Protected Cancellations and 2 Same-Day Adjustments each month.",
  momentum:
    "3 sessions per week. 1 Protected Cancellation and 1 Same-Day Adjustment each month.",
  starter:
    "2 sessions per week. Standard 6-hour cancellation policy applies; no Protected Cancellations or Same-Day Adjustments.",
  foundation:
    "1 session per week. Standard 6-hour cancellation policy applies; no Protected Cancellations or Same-Day Adjustments.",
  // Legacy aliases
  progress:
    "3 sessions per week. 1 Protected Cancellation and 1 Same-Day Adjustment each month.",
  consistent:
    "3 sessions per week. 1 Protected Cancellation and 1 Same-Day Adjustment each month.",
  developing:
    "1 session per week. Standard 6-hour cancellation policy applies; no Protected Cancellations or Same-Day Adjustments.",
};

export const VIP_TIER_TAGLINES: Record<string, string> = {
  foundation: "A simple starting point to build consistency.",
  starter: "A steady entry level for structured training.",
  momentum: "A strong rhythm for visible progress.",
  elite: "High consistency with priority training support.",
  pro_elite: "Advanced commitment and stronger weekly structure.",
  diamond_elite: "The highest consistency level for serious transformation.",
};

export function normaliseTier(tier: string | null | undefined): VipTier {
  switch (tier) {
    case "diamond_elite":
      return "diamond_elite";
    case "pro_elite":
      return "pro_elite";
    case "elite":
      return "elite";
    case "momentum":
      return "momentum";
    case "starter":
      return "starter";
    case "foundation":
      return "foundation";
    // Legacy aliases (pre-rename data)
    case "progress":
    case "consistent":
      return "momentum";
    case "developing":
      return "foundation";
    default:
      return "foundation";
  }
}

export function tierFromFrequency(freq: number | null | undefined): VipTier {
  if (!freq || freq < 1) return "foundation";
  if (freq >= 6) return "diamond_elite";
  if (freq >= 5) return "pro_elite";
  if (freq >= 4) return "elite";
  if (freq >= 3) return "momentum";
  if (freq >= 2) return "starter";
  return "foundation";
}

export function protectedCancellationQuota(tier: string | null | undefined): number {
  const t = normaliseTier(tier);
  if (t === "elite" || t === "pro_elite" || t === "diamond_elite") return 2;
  if (t === "momentum") return 1;
  return 0;
}

export function sameDayAdjustQuota(tier: string | null | undefined): number {
  const t = normaliseTier(tier);
  if (t === "elite" || t === "pro_elite" || t === "diamond_elite") return 2;
  if (t === "momentum") return 1;
  return 0;
}

// True for tiers that get the "Priority" badge / priority booking benefit.
export function tierHasPriority(tier: string | null | undefined): boolean {
  const t = normaliseTier(tier);
  return t === "elite" || t === "pro_elite" || t === "diamond_elite";
}

// Kept for backward compatibility with older callers; do not use in new code.
export const SAME_DAY_ADJUST_QUOTA = 2;

export const WEEKLY_FREQUENCY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: "1 session / week — Foundation" },
  { value: 2, label: "2 sessions / week — Starter" },
  { value: 3, label: "3 sessions / week — Momentum" },
  { value: 4, label: "4 sessions / week — Elite" },
  { value: 5, label: "5 sessions / week — Pro Elite" },
  { value: 6, label: "6 sessions / week — Diamond Elite" },
];

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
