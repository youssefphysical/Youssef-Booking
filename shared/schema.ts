import {
  pgTable,
  text,
  serial,
  integer,
  doublePrecision,
  timestamp,
  date,
  boolean,
  jsonb,
  uniqueIndex,
  index,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
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
  // Profile picture: stored as base64 data URL (image/webp, ~256x256)
  // Kept in DB so it works on both Replit (disk) and Vercel (read-only FS) without
  // requiring object storage. Compressed to ~10-25KB per user.
  profilePictureUrl: text("profile_picture_url"),
  // Manual verified-badge override by admin. null = auto-compute (default),
  // true = force-verified, false = force-unverified. Admin-only field.
  verifiedOverride: boolean("verified_override"),
  // Self-declared training level: 'beginner' | 'intermediate' | 'advanced'
  trainingLevel: text("training_level"),
  // Self-declared training goal: 'hypertrophy' | 'strength' | 'endurance'
  trainingGoal: text("training_goal"),
  // Admin/staff access fields (only meaningful when role='admin')
  // adminRole: 'super_admin' | 'manager' | 'viewer' (null for clients)
  adminRole: text("admin_role"),
  // Granular permission grid: { [permissionKey]: boolean }. Super admins bypass.
  permissions: jsonb("permissions").$type<Record<string, boolean>>().default(sql`'{}'::jsonb`),
  // Soft-disable an admin/staff account without deleting it
  isActive: boolean("is_active").notNull().default(true),
  // Cumulative no-show count for trainer reference (admin-incremented)
  noShowCount: integer("no_show_count").notNull().default(0),
  // Trainer-only private notes (injuries, preferences, warnings).
  // NEVER returned to the client — server strips this field on UserResponse.
  adminNotes: text("admin_notes"),
  // Client lifecycle status — see CLIENT_STATUSES.
  // Drives booking gating: only 'active' clients can self-book.
  clientStatus: text("client_status").notNull().default("incomplete"),
  // Self-declared health/preference fields used by the admin Health tab.
  preferredTrainingDays: text("preferred_training_days").array(),
  injuries: text("injuries"),
  medicalNotes: text("medical_notes"),
  parqCompleted: boolean("parq_completed").notNull().default(false),
  waiverAccepted: boolean("waiver_accepted").notNull().default(false),
  medicalClearanceNote: text("medical_clearance_note"),
  // Categorised admin notes (separate from `adminNotes` general bucket).
  coachNotes: text("coach_notes"),
  goalNotes: text("goal_notes"),
  communicationNotes: text("communication_notes"),
  // Password reset: short-lived single-use token (sha256 hex of the secret
  // emailed to the user) + expiry. Both null when no reset is in flight.
  // Server NEVER returns these fields to the client.
  passwordResetToken: text("password_reset_token"),
  passwordResetExpires: timestamp("password_reset_expires"),
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================
// PACKAGE TEMPLATES (admin catalog)
// =============================
// Admin-defined catalogue of packages. The admin can create / edit /
// activate / re-order entries here and they'll show up on the public
// packages section as well as in the "Assign package" picker on each
// client's profile. Per-client assignments still live in `packages`
// below — the template is only the *recipe*, never the credits.
export const packageTemplates = pgTable("package_templates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  // 'single' | 'standard' | 'duo' | 'custom'
  type: text("type").notNull().default("standard"),
  paidSessions: integer("paid_sessions").notNull().default(0),
  bonusSessions: integer("bonus_sessions").notNull().default(0),
  totalSessions: integer("total_sessions").notNull().default(0),
  // Money is stored as integer AED (whole dirhams). Avoids float drift.
  pricePerSession: integer("price_per_session").notNull().default(0),
  totalPrice: integer("total_price").notNull().default(0),
  // Validity window per template (admin sets the default lifespan).
  expirationValue: integer("expiration_value").notNull().default(30),
  // 'days' | 'weeks' | 'months'
  expirationUnit: text("expiration_unit").notNull().default("days"),
  description: text("description"),
  isActive: boolean("is_active").notNull().default(true),
  displayOrder: integer("display_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// =============================
// PACKAGES (session credits)
// =============================
// type values (legacy): 'single' | '10' | '20' | '25' | 'duo30' | 'trial'
// type values (new, from templates): 'single' | 'standard' | 'duo' | 'custom'
// The string is intentionally NOT enum-constrained at the DB level so
// future templates can introduce new categories without a migration.
export const packages = pgTable("packages", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  partnerUserId: integer("partner_user_id").references(() => users.id), // for duo
  type: text("type").notNull(),
  totalSessions: integer("total_sessions").notNull(),
  usedSessions: integer("used_sessions").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  notes: text("notes"),
  purchasedAt: timestamp("purchased_at").defaultNow(),
  // Admin-controlled package validity window (additive, nullable for legacy rows)
  startDate: date("start_date"),
  expiryDate: date("expiry_date"),
  // Lifecycle status — see PACKAGE_STATUSES.
  // Auto-recomputed by storage layer; admin can override.
  // 'active' | 'expiring_soon' | 'expired' | 'completed'
  status: text("status"),
  // Snapshot fields captured at assignment time. We deliberately denormalise
  // template fields so editing or deleting a template NEVER mutates a
  // client's existing package — the historical record is preserved.
  templateId: integer("template_id"),
  name: text("name"),
  paidSessions: integer("paid_sessions"),
  bonusSessions: integer("bonus_sessions"),
  pricePerSession: integer("price_per_session"),
  totalPrice: integer("total_price"),
  // Payment tracking — see PACKAGE_PAYMENT_STATUSES. NO payment gateway.
  // Admin manually records the status after WhatsApp/manual settlement.
  paymentStatus: text("payment_status").notNull().default("unpaid"),
  paymentApproved: boolean("payment_approved").notNull().default(false),
  paymentApprovedAt: timestamp("payment_approved_at"),
  paymentApprovedByUserId: integer("payment_approved_by_user_id"),
  paymentNote: text("payment_note"),
  // Freeze: pauses booking on this package without changing balance.
  frozen: boolean("frozen").notNull().default(false),
  frozenAt: timestamp("frozen_at"),
  frozenReason: text("frozen_reason"),
  // Admin must explicitly mark a package "approved" before clients can book it.
  adminApproved: boolean("admin_approved").notNull().default(false),
  adminApprovedAt: timestamp("admin_approved_at"),
  adminApprovedByUserId: integer("admin_approved_by_user_id"),
  // Email notification dedupe — set the first time we email the client about
  // this package being expiring / finished so we never spam them.
  expiringNotifiedAt: timestamp("expiring_notified_at"),
  finishedNotifiedAt: timestamp("finished_notified_at"),
});

// =============================
// PACKAGE SESSION HISTORY (audit trail)
// =============================
// Append-only audit log for every action that affects a package's session
// balance, freeze state, payment, or approval. Used by the admin Sessions
// tab to produce a transparent history.
export const packageSessionHistory = pgTable("package_session_history", {
  id: serial("id").primaryKey(),
  packageId: integer("package_id").notNull(),
  userId: integer("user_id").notNull(),
  // see SESSION_HISTORY_ACTIONS
  action: text("action").notNull(),
  bookingId: integer("booking_id"),
  // signed; positive = added, negative = removed, 0 = non-balance event
  sessionsDelta: integer("sessions_delta").notNull().default(0),
  performedByUserId: integer("performed_by_user_id"),
  reason: text("reason"),
  createdAt: timestamp("created_at").defaultNow(),
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
  // Premium booking fields (additive — nullable for legacy rows)
  // sessionFocus: muscle group / pattern, see SESSION_FOCUS_OPTIONS
  sessionFocus: text("session_focus"),
  // trainingGoal: per-session goal, see BOOKING_TRAINING_GOALS
  trainingGoal: text("training_goal"),
  isEmergencyCancel: boolean("is_emergency_cancel").notNull().default(false),
  // True if a Protected Cancellation was used (counts toward monthly quota; no session deducted)
  protectedCancellation: boolean("protected_cancellation").notNull().default(false),
  // Audit trail: original "YYYY-MM-DD HH:MM" before a Same-Day Adjustment
  rescheduledFrom: text("rescheduled_from"),
  // True for sessions that an admin retroactively logged (i.e. happened before the app was used)
  isManualHistorical: boolean("is_manual_historical").notNull().default(false),
  // Attendance audit (admin marks attended | no_show | late_cancel)
  attendanceMarkedByUserId: integer("attendance_marked_by_user_id"),
  attendanceMarkedAt: timestamp("attendance_marked_at"),
  // Reminder dedupe — set by the cron handler the first time the 24h / 1h
  // reminder email is dispatched for this booking.
  reminder24hSentAt: timestamp("reminder_24h_sent_at"),
  reminder1hSentAt: timestamp("reminder_1h_sent_at"),
  attendanceReason: text("attendance_reason"),
  // ─── Booking-safety hardening (May 2026) ───────────────────────────
  // durationMinutes: how long the session runs from `timeSlot`. Drives
  //   the auto-complete cron's "now > endTime" check. Default 60 so
  //   legacy rows behave correctly without backfill. Admin-mutable.
  // completedAt / autoCompletedAt: stamped exactly once when a booking
  //   transitions into the `completed` state. autoCompletedAt is set
  //   only by the cron — distinguishes admin-marked vs auto-marked
  //   sessions in the audit trail. completedAt is the universal
  //   "completed when?" anchor regardless of source.
  // packageSessionDeductedAt: idempotency anchor for package-credit
  //   consumption. Stamped the first time a deduction (incrementPackage
  //   Usage) runs against this booking, cleared on refund. Every
  //   deducting code path must check IS NULL before incrementing and
  //   IS NOT NULL before decrementing. Prevents double-deduction across
  //   admin attendance toggles + auto-complete races.
  durationMinutes: integer("duration_minutes").notNull().default(60),
  completedAt: timestamp("completed_at"),
  autoCompletedAt: timestamp("auto_completed_at"),
  packageSessionDeductedAt: timestamp("package_session_deducted_at"),
  // P4d Per-Session Coach Notes (admin-logged after each session).
  // 1-10 scales for energy/performance/sleep/adherence; freeform for
  // cardio + pain/injury + notes. clientVisibleCoachNotes surfaces to
  // the client; privateCoachNotes is admin-only (stripped server-side).
  sessionEnergy: integer("session_energy"),
  sessionPerformance: integer("session_performance"),
  sessionSleep: integer("session_sleep"),
  sessionAdherence: integer("session_adherence"),
  sessionCardio: text("session_cardio"),
  sessionPainInjury: text("session_pain_injury"),
  privateCoachNotes: text("private_coach_notes"),
  clientVisibleCoachNotes: text("client_visible_coach_notes"),
  coachNotesUpdatedAt: timestamp("coach_notes_updated_at"),
  // ─── Duo Partner snapshot (Nov 2026) ───────────────────────────────
  // Captured per-booking when sessionType='duo'. The partner does NOT
  // need an account — these fields are a lightweight contact snapshot
  // so the trainer knows who's showing up alongside the primary client.
  // Required: partnerFullName when sessionType='duo'. Phone/email are
  // optional. Future-ready: when admin "links" the partner to a real
  // account, packages.partnerUserId is stamped — these snapshot fields
  // remain as the booking-time record of intent.
  partnerFullName: text("partner_full_name"),
  partnerPhone: text("partner_phone"),
  partnerEmail: text("partner_email"),
  // ─── Linked Partner Account (Nov 2026 follow-up) ────────────────────
  // OPTIONAL admin-only binding from the per-booking partner snapshot
  // above to a real registered user account. When set:
  //   • The linked partner can SEE this booking on their own dashboard
  //     (read-only, sanitized like a primary client view).
  //   • Linked partner does NOT become the package owner — the primary
  //     `userId` remains the owner and the only account whose package
  //     usage is deducted.
  //   • Linked partner CANNOT mutate (cancel/reschedule/edit) the
  //     booking. The existing booking-mutation guards key off
  //     `booking.userId === me.id`, so a linked partner is blocked
  //     by the same auth check that already exists.
  // Nullable on purpose — most duo bookings stay with just the snapshot.
  linkedPartnerUserId: integer("linked_partner_user_id").references(() => users.id),
  // Task #3 (Nov 2026): partner-scoped reminder dedupe stamps so the
  // linked partner gets their own 24h / 1h reminder email exactly once,
  // independent of whether the primary client's reminder has fired.
  linkedPartnerReminder24hSentAt: timestamp("linked_partner_reminder_24h_sent_at"),
  linkedPartnerReminder1hSentAt: timestamp("linked_partner_reminder_1h_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  cancelledAt: timestamp("cancelled_at"),
});

export const COACH_NOTE_FIELDS = [
  "sessionEnergy",
  "sessionPerformance",
  "sessionSleep",
  "sessionAdherence",
  "sessionCardio",
  "sessionPainInjury",
  "privateCoachNotes",
  "clientVisibleCoachNotes",
] as const;

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
// HERO IMAGES (homepage slider)
// =============================
// Images stored as base64 data URLs (image/webp). Same rationale as
// users.profile_picture_url — keeps the feature working on read-only
// filesystems (Vercel) without requiring object storage. Compressed by
// sharp on the server to ~80–150KB per slide.
export const heroImages = pgTable("hero_images", {
  id: serial("id").primaryKey(),
  imageDataUrl: text("image_data_url").notNull(),
  // Optional overlay copy. When all three are null the slide renders the
  // homepage's global hero copy as a fallback (back-compat with pre-May'26
  // slides that have no metadata).
  title: text("title"),
  subtitle: text("subtitle"),
  badge: text("badge"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  // ====== DISPLAY TUNING (per-image render-time controls) ======
  // The cropper bakes the initial framing into the saved image, but the
  // admin often wants to *fine-tune* how a slide renders without having
  // to re-crop. These columns let them nudge focal point, zoom in/out a
  // touch, tilt the frame, or warm the photo up — all applied at render
  // time via inline style on the foreground sharp <img> in HeroSlider.
  // Every column is NULL-safe: pre-existing slides that have no tuning
  // metadata fall back to identity (zoom 1, focal 0/0, rotate 0,
  // brightness 1, contrast 1, overlay default), so adding this feature
  // never visually shifts slides that haven't been touched.
  focalX: doublePrecision("focal_x").default(0),           // -200 → +200 px
  focalY: doublePrecision("focal_y").default(0),           // -200 → +200 px
  zoom: doublePrecision("zoom").default(1.0),              // 0.8 → 2.0
  rotate: doublePrecision("rotate").default(0),            // -10 → +10 deg
  brightness: doublePrecision("brightness").default(1.0),  // 0.9 → 1.2
  contrast: doublePrecision("contrast").default(1.0),      // 0.95 → 1.2
  overlayOpacity: doublePrecision("overlay_opacity").default(35), // 0 → 60 %
  createdAt: timestamp("created_at").defaultNow(),
});

// =============================
// TRANSFORMATIONS (before/after gallery)
// =============================
// Both images stored as base64 WebP data URLs (same rationale as
// heroImages and users.profile_picture_url — works on Vercel's read-only
// filesystem). Server pipes uploads through sharp at 1600px max long edge.
export const transformations = pgTable("transformations", {
  id: serial("id").primaryKey(),
  beforeImageDataUrl: text("before_image_data_url").notNull(),
  afterImageDataUrl: text("after_image_data_url").notNull(),
  displayName: text("display_name"),       // empty / null = "Anonymous"
  goal: text("goal"),                       // e.g. "Fat loss"
  duration: text("duration"),               // free text e.g. "12 weeks"
  result: text("result"),                   // e.g. "-9 kg / -7% body fat"
  testimonial: text("testimonial"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
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
// viewAngle: 'front' | 'side' | 'back' (P4c — comparison slider pairing)
export const progressPhotos = pgTable("progress_photos", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  photoUrl: text("photo_url").notNull(),
  type: text("type").notNull().default("current"),
  viewAngle: text("view_angle").notNull().default("front"),
  notes: text("notes"),
  recordedAt: timestamp("recorded_at").defaultNow(),
});

export const PROGRESS_VIEW_ANGLES = ["front", "side", "back"] as const;
export type ProgressViewAngle = (typeof PROGRESS_VIEW_ANGLES)[number];

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
  user: one(users, { fields: [bookings.userId], references: [users.id], relationName: "bookingOwner" }),
  linkedPartnerUser: one(users, { fields: [bookings.linkedPartnerUserId], references: [users.id], relationName: "bookingLinkedPartner" }),
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
      .enum(["fat_loss", "muscle_gain", "recomposition", "general_fitness"])
      .optional(),
    weeklyFrequency: z
      .number()
      .int()
      .min(1, "Choose your preferred weekly training frequency")
      .max(6),
    notes: z.string().optional(),
    // Optional package template the client picked during signup. Snapshotted
    // server-side into a `packages` row with adminApproved=false; the trainer
    // confirms payment + grants access from the Pending Requests panel.
    packageTemplateId: z.number().int().positive().optional(),
  });

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });

export const updateProfileSchema = createInsertSchema(users)
  .omit({ id: true, createdAt: true, role: true, username: true })
  .partial()
  .extend({
    // Admin-only: manual verified-badge override (null = auto-compute)
    verifiedOverride: z.boolean().nullable().optional(),
  });

export const SESSION_TYPES = [
  "package",
  "single",
  "trial",
  "duo",
  "manual_historical",
] as const;
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

// =============================
// SESSION FOCUS — per-booking required pick (premium booking flow)
// Grouped into Upper / Lower / Conditioning on the UI side.
// =============================
export const SESSION_FOCUS_OPTIONS = [
  // Upper body
  "chest",
  "back",
  "shoulders",
  "arms",
  "front_upper",
  "back_upper",
  "push",
  "pull",
  // Lower body
  "legs",
  "front_lower",
  "back_lower",
  // Conditioning
  "core",
  "full_body",
  "crossfit",
] as const;

export const SESSION_FOCUS_GROUPS: Record<
  "upper" | "lower" | "conditioning",
  ReadonlyArray<(typeof SESSION_FOCUS_OPTIONS)[number]>
> = {
  upper: ["chest", "back", "shoulders", "arms", "front_upper", "back_upper", "push", "pull"],
  lower: ["legs", "front_lower", "back_lower"],
  conditioning: ["core", "full_body", "crossfit"],
};

// =============================
// BOOKING TRAINING GOAL — per-booking required pick
// (Distinct from users.trainingGoal which is a long-term self-declared goal.)
// =============================
export const BOOKING_TRAINING_GOALS = [
  "hypertrophy",
  "strength",
  "endurance",
  "fat_loss",
  "conditioning",
] as const;

// English fallback labels — used by trainer-facing notifications and as
// stable English source strings the i18n layer translates from.
export const SESSION_FOCUS_LABELS_EN: Record<string, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  front_upper: "Front Upper Body",
  back_upper: "Back Upper Body",
  push: "Push",
  pull: "Pull",
  legs: "Legs",
  front_lower: "Front Lower Body",
  back_lower: "Back Lower Body",
  core: "Core",
  full_body: "Full Body",
  crossfit: "CrossFit",
};

export const BOOKING_TRAINING_GOAL_LABELS_EN: Record<string, string> = {
  hypertrophy: "Hypertrophy",
  strength: "Strength",
  endurance: "Endurance",
  fat_loss: "Fat Loss",
  conditioning: "Conditioning",
};

export const SESSION_TYPE_LABELS_EN: Record<string, string> = {
  package: "Package Session",
  single: "Single Session",
  trial: "Free Trial Session — BMI Assessment + Technical Assessment",
  duo: "Duo Session",
  manual_historical: "Manual / Historical",
};

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
    // Optional at the schema level so admin manual bookings still work.
    // The POST /api/bookings route enforces both for non-admin users.
    sessionFocus: z.enum(SESSION_FOCUS_OPTIONS).nullable().optional(),
    trainingGoal: z.enum(BOOKING_TRAINING_GOALS).nullable().optional(),
    // Duo partner snapshot. Server-side superRefine below enforces
    // partnerFullName when sessionType='duo'. Email accepts empty string
    // OR a valid email so the optional field can be cleared from the UI.
    // NOTE: required-when-duo is enforced in the POST /api/bookings route
    // rather than via .superRefine here, so this stays a ZodObject and
    // downstream `.extend(...)` callers (routes.ts, shared/routes.ts) work.
    partnerFullName: z.string().trim().min(2).max(120).nullable().optional(),
    partnerPhone: z.string().trim().max(40).nullable().optional(),
    partnerEmail: z
      .union([z.literal(""), z.string().trim().email().max(254)])
      .nullable()
      .optional(),
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
  sessionFocus: z.enum(SESSION_FOCUS_OPTIONS).nullable().optional(),
  trainingGoal: z.enum(BOOKING_TRAINING_GOALS).nullable().optional(),
  // P4d coach-notes fields. All nullable; numeric 1-10 sliders.
  sessionEnergy: z.number().int().min(1).max(10).nullable().optional(),
  sessionPerformance: z.number().int().min(1).max(10).nullable().optional(),
  sessionSleep: z.number().int().min(1).max(10).nullable().optional(),
  sessionAdherence: z.number().int().min(1).max(10).nullable().optional(),
  sessionCardio: z.string().max(500).nullable().optional(),
  sessionPainInjury: z.string().max(500).nullable().optional(),
  privateCoachNotes: z.string().max(2000).nullable().optional(),
  clientVisibleCoachNotes: z.string().max(2000).nullable().optional(),
});

// =============================
// ADMIN NOTIFICATIONS (in-app trainer inbox)
// =============================
// kind: 'booking_new' | 'booking_cancelled' | 'booking_rescheduled' | 'system'
// =============================
// CLIENT-FACING NOTIFICATIONS (P5a)
// =============================
// Distinct from `admin_notifications` (which is the trainer inbox).
// One row per delivery target. Channel-ready architecture: in-app is
// active today, push + email are wired through the same row so future
// dispatchers can fan out without schema churn.
export const NOTIFICATION_KINDS = [
  "session_reminder",
  "package_expiring",
  "missed_checkin",
  "nutrition_update",
  "supplement_reminder",
  "coach_message",
  "payment_reminder",
  "milestone",
  "system",
] as const;
export type NotificationKind = (typeof NOTIFICATION_KINDS)[number];

export const clientNotifications = pgTable(
  "client_notifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull().default("system"),
    title: text("title").notNull(),
    body: text("body").notNull(),
    // Optional deep-link target inside the app (e.g. "/dashboard?tab=activity").
    link: text("link"),
    // Optional structured payload — used by triggers to dedupe (e.g.
    // { bookingId: 123 } or { weekStart: "2026-05-04" }).
    meta: jsonb("meta"),
    // Persisted dedupe key. Mirrors `meta.dedupeKey` and is enforced by a
    // partial unique index `(user_id, kind, dedupe_key) WHERE dedupe_key
    // IS NOT NULL`, so concurrent triggers can race INSERTs and only one
    // wins. NULL for fire-and-forget notifications without a dedupe key.
    dedupeKey: text("dedupe_key"),
    // Channel state — additive, future dispatchers stamp these.
    channelInApp: boolean("channel_in_app").notNull().default(true),
    channelPush: boolean("channel_push").notNull().default(false),
    channelEmail: boolean("channel_email").notNull().default(false),
    pushSentAt: timestamp("push_sent_at"),
    emailSentAt: timestamp("email_sent_at"),
    // null = unread, set on first read.
    readAt: timestamp("read_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (t) => ({
    // Mirrors ensureSchema's `client_notifications_user_unread_idx` so
    // unread-count queries hit a covering index.
    userUnreadIdx: index("client_notifications_user_unread_idx").on(
      t.userId,
      t.readAt,
      t.createdAt,
    ),
    // Partial unique index for atomic dedupe via notifyUserOnce(). The
    // WHERE predicate keeps the constraint scoped to keyed notifications
    // only, so plain notifyUser() rows (dedupeKey=NULL) remain unique-free.
    dedupeUq: uniqueIndex("client_notifications_dedupe_uq")
      .on(t.userId, t.kind, t.dedupeKey)
      .where(sql`${t.dedupeKey} IS NOT NULL`),
  }),
);

export const insertClientNotificationSchema = createInsertSchema(clientNotifications)
  .omit({ id: true, createdAt: true, readAt: true, pushSentAt: true, emailSentAt: true })
  .extend({
    kind: z.enum(NOTIFICATION_KINDS),
    title: z.string().min(1).max(200),
    body: z.string().min(1).max(2000),
    link: z.string().max(500).nullish(),
    meta: z.any().nullish(),
    dedupeKey: z.string().max(200).nullish(),
  });

export type ClientNotification = typeof clientNotifications.$inferSelect;
export type InsertClientNotification = z.infer<typeof insertClientNotificationSchema>;

export const adminNotifications = pgTable("admin_notifications", {
  id: serial("id").primaryKey(),
  kind: text("kind").notNull().default("system"),
  title: text("title").notNull(),
  body: text("body").notNull(),
  userId: integer("user_id"),
  bookingId: integer("booking_id"),
  isRead: boolean("is_read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertAdminNotificationSchema = createInsertSchema(adminNotifications).omit({
  id: true,
  createdAt: true,
  isRead: true,
});

export type AdminNotification = typeof adminNotifications.$inferSelect;
export type InsertAdminNotification = z.infer<typeof insertAdminNotificationSchema>;

// =============================
// PACKAGE STATUS
// =============================
export const PACKAGE_STATUSES = [
  "active",
  "expiring_soon",
  "expired",
  "completed",
] as const;
export type PackageStatus = (typeof PACKAGE_STATUSES)[number];

// =============================
// CLIENT LIFECYCLE STATUS
// =============================
// Drives whether a client can self-book and how the admin sees them.
// 'incomplete' = registration not finished (no profile / no consents)
// 'pending'    = waiting on admin onboarding / payment / approval
// 'active'     = fully cleared, can self-book
// 'frozen'     = temporarily paused (vacation, injury, hold)
// 'expired'    = no active package and last package expired
// 'completed'  = finished their journey amicably
// 'cancelled'  = membership ended (refund / quit)
export const CLIENT_STATUSES = [
  "incomplete",
  "pending",
  "active",
  "frozen",
  "expired",
  "completed",
  "cancelled",
] as const;
export type ClientStatus = (typeof CLIENT_STATUSES)[number];

export const CLIENT_STATUS_LABELS: Record<ClientStatus, string> = {
  incomplete: "Profile Incomplete",
  pending: "Pending Approval",
  active: "Active",
  frozen: "Frozen",
  expired: "Expired",
  completed: "Completed",
  cancelled: "Cancelled",
};

// Visual tone hints used by the admin UI badge.
export const CLIENT_STATUS_TONES: Record<ClientStatus, "neutral" | "warning" | "success" | "danger"> = {
  incomplete: "warning",
  pending: "warning",
  active: "success",
  frozen: "neutral",
  expired: "danger",
  completed: "neutral",
  cancelled: "danger",
};

// =============================
// PACKAGE PAYMENT STATUS (admin-recorded; NO online gateway)
// =============================
export const PACKAGE_PAYMENT_STATUSES = [
  "unpaid",
  "pending",
  "partially_paid",
  "paid",
] as const;
export type PackagePaymentStatus = (typeof PACKAGE_PAYMENT_STATUSES)[number];

export const PACKAGE_PAYMENT_STATUS_LABELS: Record<PackagePaymentStatus, string> = {
  unpaid: "Unpaid",
  pending: "Pending",
  partially_paid: "Partially Paid",
  paid: "Paid",
};

// =============================
// SESSION HISTORY ACTIONS (audit log)
// =============================
export const SESSION_HISTORY_ACTIONS = [
  "package_created",
  "package_assigned",
  "package_extended",
  "package_frozen",
  "package_unfrozen",
  "package_approved",
  "payment_updated",
  "session_consumed",
  "session_refunded",
  "session_added_manual",
  "session_removed_manual",
  "package_deleted",
  "package_rejected",
] as const;
export type SessionHistoryAction = (typeof SESSION_HISTORY_ACTIONS)[number];

export const SESSION_HISTORY_ACTION_LABELS: Record<SessionHistoryAction, string> = {
  package_created: "Package created",
  package_assigned: "Package assigned",
  package_extended: "Package extended",
  package_frozen: "Package frozen",
  package_unfrozen: "Package unfrozen",
  package_approved: "Package approved",
  payment_updated: "Payment updated",
  session_consumed: "Session consumed",
  session_refunded: "Session refunded",
  session_added_manual: "Manual session added",
  session_removed_manual: "Manual session removed",
  package_deleted: "Package deleted",
  package_rejected: "Package rejected",
};

// English labels for trainer notifications.
export const PACKAGE_STATUS_LABELS_EN: Record<string, string> = {
  active: "Active",
  expiring_soon: "Expiring Soon",
  expired: "Expired",
  completed: "Completed",
};

// =============================
// RENEWAL REQUESTS
// =============================
// Client requests a new package; admin approves only after manual payment confirmation.
// status: 'pending' | 'approved' | 'rejected'
export const renewalRequests = pgTable("renewal_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  // Package type the client is requesting (matches PACKAGE_TYPES)
  requestedPackageType: text("requested_package_type").notNull(),
  status: text("status").notNull().default("pending"),
  clientNote: text("client_note"),
  adminNote: text("admin_note"),
  decidedByUserId: integer("decided_by_user_id"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertRenewalRequestSchema = createInsertSchema(renewalRequests)
  .omit({ id: true, createdAt: true, status: true, decidedByUserId: true, decidedAt: true, adminNote: true })
  .extend({
    requestedPackageType: z.string().min(1),
    clientNote: z.string().nullable().optional(),
  });

export const RENEWAL_REQUEST_STATUSES = ["pending", "approved", "rejected"] as const;
export type RenewalRequestStatus = (typeof RENEWAL_REQUEST_STATUSES)[number];
export type RenewalRequest = typeof renewalRequests.$inferSelect;
export type InsertRenewalRequest = z.infer<typeof insertRenewalRequestSchema>;
export type RenewalRequestWithUser = RenewalRequest & { user?: UserResponse };

// =============================
// EXTENSION REQUESTS
// =============================
// Client requests extra days on an existing package; admin manually approves.
export const extensionRequests = pgTable("extension_requests", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  packageId: integer("package_id").notNull(),
  requestedDays: integer("requested_days").notNull().default(7),
  reason: text("reason"),
  status: text("status").notNull().default("pending"),
  adminNote: text("admin_note"),
  decidedByUserId: integer("decided_by_user_id"),
  decidedAt: timestamp("decided_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertExtensionRequestSchema = createInsertSchema(extensionRequests)
  .omit({ id: true, createdAt: true, status: true, decidedByUserId: true, decidedAt: true, adminNote: true })
  .extend({
    requestedDays: z.number().int().min(1).max(60),
    reason: z.string().nullable().optional(),
  });

export type ExtensionRequest = typeof extensionRequests.$inferSelect;
export type InsertExtensionRequest = z.infer<typeof insertExtensionRequestSchema>;
export type ExtensionRequestWithDetails = ExtensionRequest & {
  user?: UserResponse;
  package?: Package;
};

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
    // Free string so legacy ("10","20","25","duo30") and template-driven
    // ("single","standard","duo","custom") values both pass.
    type: z.string().min(1),
    totalSessions: z.number().int().min(1),
    usedSessions: z.number().int().min(0).optional(),
    notes: z.string().optional(),
    partnerUserId: z.number().int().nullable().optional(),
    isActive: z.boolean().optional(),
    startDate: z.string().nullable().optional(),
    expiryDate: z.string().nullable().optional(),
    status: z.enum(["active", "expiring_soon", "expired", "completed"]).nullable().optional(),
    templateId: z.number().int().nullable().optional(),
    name: z.string().nullable().optional(),
    paidSessions: z.number().int().min(0).nullable().optional(),
    bonusSessions: z.number().int().min(0).nullable().optional(),
    pricePerSession: z.number().int().min(0).nullable().optional(),
    totalPrice: z.number().int().min(0).nullable().optional(),
  });

export const updatePackageSchema = insertPackageSchema.partial().omit({ userId: true });

// =============================
// PACKAGE TEMPLATE SCHEMAS
// =============================
export const PACKAGE_TEMPLATE_TYPES = ["single", "standard", "duo", "custom"] as const;
export const PACKAGE_TEMPLATE_UNITS = ["days", "weeks", "months"] as const;

export const insertPackageTemplateSchema = createInsertSchema(packageTemplates)
  .omit({ id: true, createdAt: true, updatedAt: true })
  .extend({
    name: z.string().min(1, "Name is required").max(120),
    type: z.enum(PACKAGE_TEMPLATE_TYPES),
    paidSessions: z.number().int().min(0).max(999),
    bonusSessions: z.number().int().min(0).max(999),
    totalSessions: z.number().int().min(1).max(999),
    pricePerSession: z.number().int().min(0).max(1_000_000),
    totalPrice: z.number().int().min(0).max(1_000_000),
    expirationValue: z.number().int().min(1).max(365),
    expirationUnit: z.enum(PACKAGE_TEMPLATE_UNITS),
    description: z.string().max(500).nullish(),
    isActive: z.boolean().optional(),
    displayOrder: z.number().int().min(0).max(999).optional(),
  });

export const updatePackageTemplateSchema = insertPackageTemplateSchema.partial();

export type PackageTemplate = typeof packageTemplates.$inferSelect;
export type InsertPackageTemplate = z.infer<typeof insertPackageTemplateSchema>;
export type UpdatePackageTemplate = z.infer<typeof updatePackageTemplateSchema>;

/** Convert a template's expiration value+unit into a concrete days count. */
export function expirationToDays(value: number, unit: string): number {
  if (unit === "weeks") return value * 7;
  if (unit === "months") return value * 30;
  return value; // days (default)
}

// =============================
// PACKAGE SESSION HISTORY SCHEMAS
// =============================
export const insertPackageSessionHistorySchema = createInsertSchema(packageSessionHistory)
  .omit({ id: true, createdAt: true })
  .extend({
    action: z.enum(SESSION_HISTORY_ACTIONS),
    bookingId: z.number().int().nullable().optional(),
    sessionsDelta: z.number().int().optional(),
    performedByUserId: z.number().int().nullable().optional(),
    reason: z.string().nullable().optional(),
  });
export type PackageSessionHistory = typeof packageSessionHistory.$inferSelect;
export type InsertPackageSessionHistory = z.infer<typeof insertPackageSessionHistorySchema>;

// =============================
// PACKAGE FREEZE / PAYMENT / APPROVE / SESSION-ADJUST SCHEMAS
// =============================
export const freezePackageSchema = z.object({
  frozen: z.boolean(),
  reason: z.string().max(500).nullable().optional(),
});
export type FreezePackageInput = z.infer<typeof freezePackageSchema>;

export const updatePackagePaymentSchema = z.object({
  paymentStatus: z.enum(PACKAGE_PAYMENT_STATUSES),
  paymentApproved: z.boolean().optional(),
  note: z.string().max(500).nullable().optional(),
});
export type UpdatePackagePaymentInput = z.infer<typeof updatePackagePaymentSchema>;

export const adjustPackageSessionsSchema = z.object({
  // signed delta; positive = grant credits, negative = remove credits
  delta: z.number().int().refine((n) => n !== 0, { message: "Delta cannot be zero" }),
  reason: z.string().min(1, "Please describe the adjustment reason").max(500),
});
export type AdjustPackageSessionsInput = z.infer<typeof adjustPackageSessionsSchema>;

export const approvePackageSchema = z.object({
  approved: z.boolean(),
  note: z.string().max(500).nullable().optional(),
});
export type ApprovePackageInput = z.infer<typeof approvePackageSchema>;

// =============================
// BOOKING ELIGIBILITY HELPER
// =============================
// Pure function used by the POST /api/bookings gate AND by the client UI to
// preview why booking might be blocked. Admins bypass this entirely.
export type BookingEligibilityResult =
  | { ok: true }
  | { ok: false; code: string; message: string };

export function evaluateBookingEligibility(
  user: Pick<User, "clientStatus" | "parqCompleted" | "waiverAccepted" | "primaryGoal" | "weeklyFrequency">,
  pkg?: Pick<
    Package,
    | "totalSessions"
    | "usedSessions"
    | "expiryDate"
    | "frozen"
    | "isActive"
    | "paymentStatus"
    | "paymentApproved"
    | "adminApproved"
  > | null,
): BookingEligibilityResult {
  const status = (user.clientStatus ?? "incomplete") as ClientStatus;
  if (status === "frozen") {
    return { ok: false, code: "client_frozen", message: "Your account is currently frozen. Please contact Youssef to resume booking." };
  }
  if (status === "cancelled") {
    return { ok: false, code: "client_cancelled", message: "Your membership has been cancelled. Please contact Youssef to renew." };
  }
  if (status === "completed") {
    return { ok: false, code: "client_completed", message: "Your membership has been marked completed. Contact Youssef to book again." };
  }
  if (status === "incomplete") {
    return { ok: false, code: "profile_incomplete", message: "Please finish your profile (training goal & weekly frequency) before booking." };
  }
  if (status === "expired") {
    return { ok: false, code: "client_expired", message: "Your subscription has expired. Please request a renewal to continue booking." };
  }
  // Profile-completion sanity check
  if (!user.primaryGoal || !user.weeklyFrequency) {
    return { ok: false, code: "profile_incomplete", message: "Please complete your training goal and weekly frequency before booking." };
  }
  if (pkg) {
    if (pkg.frozen) {
      return { ok: false, code: "package_frozen", message: "Your active package is currently frozen. Please contact Youssef to unfreeze it." };
    }
    if (pkg.isActive === false) {
      return { ok: false, code: "package_inactive", message: "Your package is inactive. Please request a renewal." };
    }
    // Note: payment status & admin-approval are tracked for admin visibility
    // but DO NOT block booking — clients can book immediately after signup.
  }
  return { ok: true };
}

// Admin-only: extend a package's expiry by N days (or set explicit new expiry)
export const extendPackageSchema = z.object({
  addDays: z.number().int().min(1).max(365).optional(),
  newExpiryDate: z.string().optional(),
  adminNote: z.string().optional(),
}).refine((d) => d.addDays || d.newExpiryDate, {
  message: "Provide addDays or newExpiryDate",
});

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
    viewAngle: z.enum(PROGRESS_VIEW_ANGLES).optional(),
    notes: z.string().nullable().optional(),
  });

// =============================
// TYPES
// =============================
export type User = typeof users.$inferSelect;
// UserResponse is the public-safe shape served by the API. We strip `password`
// and optionally augment with derived flags like `isVerified` (computed from
// profile completion + InBody/completed-session signals).
export const CLIENT_HEALTH_STATUSES = [
  "healthy",
  "watch",
  "at_risk",
  "inactive",
  "new",
  "frozen",
  "ended",
] as const;
export type ClientHealthStatus = (typeof CLIENT_HEALTH_STATUSES)[number];
export type ClientHealth = {
  status: ClientHealthStatus;
  score: number;
  signals: string[];
};

export type UserResponse = Omit<User, "password"> & {
  isVerified?: boolean;
  health?: ClientHealth;
};

// ===== OI2 Client Command Center / Intelligence =====
export type ClientSnapshot = {
  sessionsLeft: number | null;
  sessionsTotal: number | null;
  packageDaysLeft: number | null;
  attendanceRate30d: number | null;
  checkinAdherence4w: number | null;
  lastCompletedDate: string | null;
  nextBookingDate: string | null;
  nextBookingTimeSlot: string | null;
  weightLatest: number | null;
  weightDelta30d: number | null;
  bodyFatLatest: number | null;
};
export const MOMENTUM_STATES = [
  "improving",
  "stable",
  "slowing",
  "inactive",
  "inconsistent",
] as const;
export type MomentumState = (typeof MOMENTUM_STATES)[number];
export type ClientMomentum = { state: MomentumState; reason: string };
export const ATTENTION_SEVERITIES = ["info", "watch", "warning", "critical"] as const;
export type AttentionSeverity = (typeof ATTENTION_SEVERITIES)[number];
export type AttentionItem = {
  id: string;
  severity: AttentionSeverity;
  title: string;
  body: string;
  tab: string;
};
export const RECENT_CHANGE_KINDS = [
  "session_completed",
  "session_missed",
  "checkin",
  "body_metric",
  "package",
  "coach_note",
  "renewal",
] as const;
export type RecentChangeKind = (typeof RECENT_CHANGE_KINDS)[number];
export type RecentChange = {
  id: string;
  kind: RecentChangeKind;
  label: string;
  sublabel?: string;
  when: string;
};
export type ClientIntelligence = {
  snapshot: ClientSnapshot;
  momentum: ClientMomentum;
  attentionItems: AttentionItem[];
  recentChanges: RecentChange[];
};
export type InsertUser = z.infer<typeof insertUserSchema>;
export type InsertClient = z.infer<typeof insertClientSchema>;
export type UpdateProfile = z.infer<typeof updateProfileSchema>;

export type Booking = typeof bookings.$inferSelect;
export type InsertBooking = z.infer<typeof insertBookingSchema>;
export type UpdateBooking = z.infer<typeof updateBookingSchema>;
export type BookingWithUser = Booking & {
  user: UserResponse;
  // Task #3: optional linked Duo partner (admin-bound). Server returns a
  // minimal {id, fullName} for non-admins to avoid PII leak across
  // clients; admins get the full sanitized user.
  linkedPartnerUser?: UserResponse | { id: number; fullName: string | null } | null;
};

export type Settings = typeof settings.$inferSelect;
export type UpdateSettings = z.infer<typeof updateSettingsSchema>;

export type BlockedSlot = typeof blockedSlots.$inferSelect;
export type InsertBlockedSlot = z.infer<typeof insertBlockedSlotSchema>;

export const insertHeroImageSchema = createInsertSchema(heroImages).omit({
  id: true,
  createdAt: true,
});
// Update schema accepts every editable field; all optional so callers can
// PATCH a single property (e.g. just sortOrder, just isActive, just title).
// Display-tuning fields (focalX/focalY/zoom/rotate/brightness/contrast/
// overlayOpacity) are clamped to safe ranges that match the slider bounds
// in AdminSettings → HeroSlideEditor and the render contract in
// HeroSlider.tsx — values outside these ranges are rejected so the
// homepage cannot be visually broken (e.g. zoom 50 or brightness 0).
export const updateHeroImageSchema = z.object({
  sortOrder: z.number().int().min(0).max(999).optional(),
  isActive: z.boolean().optional(),
  title: z.string().max(140).nullish(),
  subtitle: z.string().max(240).nullish(),
  badge: z.string().max(60).nullish(),
  focalX: z.number().min(-200).max(200).nullish(),
  focalY: z.number().min(-200).max(200).nullish(),
  zoom: z.number().min(0.8).max(2.0).nullish(),
  rotate: z.number().min(-10).max(10).nullish(),
  brightness: z.number().min(0.9).max(1.2).nullish(),
  contrast: z.number().min(0.95).max(1.2).nullish(),
  overlayOpacity: z.number().min(0).max(60).nullish(),
});
export type HeroImage = typeof heroImages.$inferSelect;
export type InsertHeroImage = z.infer<typeof insertHeroImageSchema>;
export type UpdateHeroImage = z.infer<typeof updateHeroImageSchema>;

// ----- Transformations -----
export const insertTransformationSchema = createInsertSchema(transformations).omit({
  id: true,
  createdAt: true,
});
export const updateTransformationSchema = z.object({
  beforeImageDataUrl: z.string().optional(),
  afterImageDataUrl: z.string().optional(),
  displayName: z.string().max(80).nullish(),
  goal: z.string().max(120).nullish(),
  duration: z.string().max(60).nullish(),
  result: z.string().max(160).nullish(),
  testimonial: z.string().max(600).nullish(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).max(999).optional(),
});
export type Transformation = typeof transformations.$inferSelect;
export type InsertTransformation = z.infer<typeof insertTransformationSchema>;
export type UpdateTransformation = z.infer<typeof updateTransformationSchema>;

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
  // Premium business stats (additive)
  expiringPackages: number;
  expiredPackages: number;
  pendingRenewals: number;
  pendingExtensions: number;
  lowSessionClients: number;
};

// =============================
// P5c — Premium Analytics (admin)
// =============================
// Snapshot KPIs + 12-month trend buckets in one response so the
// AnalyticsTab can render instantly without staggered fetches.
export type AdminAnalytics = {
  generatedAt: string; // ISO
  clients: {
    total: number;        // role='client'
    active: number;       // clientStatus='active'
    frozen: number;       // clientStatus='frozen'
    new30d: number;       // signups in last 30 days
  };
  sessions: {
    completed30d: number;
    completed90d: number;
    upcomingNext7d: number;
    attendanceRate30d: number; // completed / (completed + no_show + late_cancelled), 0..1
    noShowRate30d: number;     // no_show / scheduled-in-window, 0..1
  };
  packages: {
    active: number;
    expiringSoon: number;
    expired: number;
    frozen: number;
    renewals30d: number; // renewal_requests created last 30 days
  };
  revenue: {
    total: number;        // sum totalPrice across all packages
    paid30d: number;      // sum totalPrice where paymentApprovedAt in last 30d
    outstanding: number;  // sum totalPrice where paymentStatus != 'paid' && != 'free'
  };
  retention: {
    multiPackageClients: number; // clients with ≥2 packages
    churn30d: number;            // active clients with 0 bookings in last 30d
    churn60d: number;
    churn90d: number;
  };
  adherence: {
    weeklyCheckinRate30d: number; // checkins / (active clients * weeks-in-window), 0..1
  };
  trends: {
    revenueByMonth: Array<{ month: string; paid: number; total: number }>;
    completedByMonth: Array<{ month: string; count: number }>;
    signupsByMonth: Array<{ month: string; count: number }>;
    bookingsByDow: Array<{ dow: number; count: number }>;
  };
};

// Admin attendance marker payload
export const attendanceUpdateSchema = z.object({
  attendance: z.enum(["attended", "no_show", "late_cancel_charged", "late_cancel_free"]),
  reason: z.string().nullable().optional(),
});
export type AttendanceUpdate = z.infer<typeof attendanceUpdateSchema>;

// Admin: update private notes on a client
export const adminClientNotesSchema = z.object({
  adminNotes: z.string().nullable(),
});
export type AdminClientNotesUpdate = z.infer<typeof adminClientNotesSchema>;

// Renewal decision payload (admin)
export const renewalDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  adminNote: z.string().nullable().optional(),
  // Required when approving — admin assigns concrete package window
  startDate: z.string().optional(),
  expiryDate: z.string().optional(),
  totalSessions: z.number().int().min(1).optional(),
  partnerUserId: z.number().int().nullable().optional(),
});
export type RenewalDecision = z.infer<typeof renewalDecisionSchema>;

// Extension decision payload (admin)
export const extensionDecisionSchema = z.object({
  decision: z.enum(["approved", "rejected"]),
  adminNote: z.string().nullable().optional(),
  // Required when approving — confirmed days to add
  approvedDays: z.number().int().min(1).max(365).optional(),
});
export type ExtensionDecision = z.infer<typeof extensionDecisionSchema>;

export const PACKAGE_DEFINITIONS: Record<
  string,
  {
    label: string;
    tagline?: string;
    sessions: number;
    bonusSessions?: number;
    isDuo?: boolean;
    isTrial?: boolean;
    isSingle?: boolean;
  }
> = {
  single: { label: "Single Session", sessions: 1, isSingle: true },
  "10": {
    label: "Essential Plan",
    tagline: "10 + 1 bonus sessions",
    sessions: 11,
    bonusSessions: 1,
  },
  "20": {
    label: "Progress Plan",
    tagline: "20 + 3 bonus sessions",
    sessions: 23,
    bonusSessions: 3,
  },
  "25": {
    label: "Elite Plan",
    tagline: "25 + 5 bonus sessions",
    sessions: 30,
    bonusSessions: 5,
  },
  duo30: {
    label: "Duo Performance Plan",
    tagline: "30 sessions · train together",
    sessions: 30,
    isDuo: true,
  },
  trial: {
    label: "Free Trial Session — BMI Assessment + Technical Assessment",
    tagline: "New clients only · BMI + Technical Assessment",
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
  { value: "general_fitness", label: "General Fitness & Wellbeing" },
];

export const PRIMARY_GOAL_VALUES = [
  "fat_loss",
  "muscle_gain",
  "recomposition",
  "general_fitness",
] as const;

// =============================
// TRAINING LEVEL & GOAL TYPE
// =============================
// Self-declared by the client. Editable from the profile page at any time.
export const TRAINING_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type TrainingLevel = (typeof TRAINING_LEVELS)[number];
export const TRAINING_LEVEL_LABELS: Record<TrainingLevel, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};
export const TRAINING_LEVEL_DESCRIPTIONS: Record<TrainingLevel, string> = {
  beginner: "New to structured training or returning after a long break.",
  intermediate: "Comfortable with most movements, training consistently for 6+ months.",
  advanced: "Experienced lifter, deep technical knowledge, multi-year training history.",
};

export const TRAINING_GOALS = ["hypertrophy", "strength", "endurance"] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];
export const TRAINING_GOAL_LABELS: Record<TrainingGoal, string> = {
  hypertrophy: "Hypertrophy",
  strength: "Strength",
  endurance: "Endurance",
};
export const TRAINING_GOAL_DESCRIPTIONS: Record<TrainingGoal, string> = {
  hypertrophy: "Build muscle size & shape with high-volume training.",
  strength: "Maximize raw force production through low-rep, heavy-load work.",
  endurance: "Improve work capacity, conditioning and stamina.",
};

// =============================
// VERIFIED CLIENT BADGE
// =============================
// A client earns the verified blue-check when their profile is reasonably
// complete: a profile picture is uploaded AND they have at least one
// InBody scan OR one completed coaching session on file.
//
// This is a pure function so both server (computed in API responses) and
// client (graceful UI fallback when serving lists) can derive the same flag.
export function isVerifiedClient(
  user: Pick<User, "profilePictureUrl" | "role"> | null | undefined,
  hasInbody: boolean,
  hasCompletedSession: boolean,
): boolean {
  if (!user) return false;
  if (user.role !== "client") return false;
  if (!user.profilePictureUrl) return false;
  return hasInbody || hasCompletedSession;
}

export const SESSION_TYPE_LABELS: Record<string, string> = {
  package: "Training Session",
  single: "Single Session",
  trial: "Free Trial Session — BMI Assessment + Technical Assessment",
  duo: "Duo Performance Session",
  manual_historical: "Manual Historical Session",
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

// =============================
// ADMIN ROLES & PERMISSIONS
// =============================
// The single super admin email — auto-promoted to super_admin on login or seed.
export const SUPER_ADMIN_EMAIL = "youssef.physical@gmail.com";

export const ADMIN_ROLES = ["super_admin", "manager", "viewer"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];
export const ADMIN_ROLE_LABELS: Record<AdminRole, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  viewer: "Viewer",
};

// Flat list of permission keys. Group prefix (`clients.*`, `bookings.*`, …) is just convention.
export const ADMIN_PERMISSION_KEYS = [
  "clients.view",
  "clients.edit",
  "clients.delete",
  "bookings.view",
  "bookings.add",
  "bookings.edit",
  "bookings.cancel",
  "sessions.view",
  "sessions.addManual",
  "sessions.editManual",
  "sessions.delete",
  "packages.view",
  "packages.assign",
  "packages.editBalance",
  "inbody.view",
  "inbody.edit",
  "inbody.delete",
  "payments.view",
  "payments.edit",
  "progress.view",
  "progress.manage",
  "settings.view",
  "settings.edit",
] as const;
export type AdminPermissionKey = (typeof ADMIN_PERMISSION_KEYS)[number];

export const ADMIN_PERMISSION_LABELS: Record<AdminPermissionKey, string> = {
  "clients.view": "View clients",
  "clients.edit": "Edit clients",
  "clients.delete": "Delete clients",
  "bookings.view": "View bookings",
  "bookings.add": "Add bookings",
  "bookings.edit": "Edit bookings",
  "bookings.cancel": "Cancel bookings",
  "sessions.view": "View session history",
  "sessions.addManual": "Add manual sessions",
  "sessions.editManual": "Edit manual sessions",
  "sessions.delete": "Delete sessions",
  "packages.view": "View plans",
  "packages.assign": "Assign plans",
  "packages.editBalance": "Edit session balance",
  "inbody.view": "View InBody",
  "inbody.edit": "Edit InBody",
  "inbody.delete": "Delete InBody data",
  "payments.view": "View payments",
  "payments.edit": "Edit payment status",
  "progress.view": "View progress photos",
  "progress.manage": "Manage progress photos",
  "settings.view": "View settings",
  "settings.edit": "Edit settings",
};

export const ADMIN_PERMISSION_GROUPS: { key: string; label: string; perms: AdminPermissionKey[] }[] = [
  { key: "clients", label: "Clients", perms: ["clients.view", "clients.edit", "clients.delete"] },
  { key: "bookings", label: "Bookings", perms: ["bookings.view", "bookings.add", "bookings.edit", "bookings.cancel"] },
  { key: "sessions", label: "Sessions", perms: ["sessions.view", "sessions.addManual", "sessions.editManual", "sessions.delete"] },
  { key: "packages", label: "Packages / Plans", perms: ["packages.view", "packages.assign", "packages.editBalance"] },
  { key: "inbody", label: "InBody", perms: ["inbody.view", "inbody.edit", "inbody.delete"] },
  { key: "payments", label: "Payments", perms: ["payments.view", "payments.edit"] },
  { key: "progress", label: "Progress photos", perms: ["progress.view", "progress.manage"] },
  { key: "settings", label: "Settings", perms: ["settings.view", "settings.edit"] },
];

const allTrue: Record<AdminPermissionKey, boolean> = ADMIN_PERMISSION_KEYS.reduce(
  (acc, k) => ((acc[k] = true), acc),
  {} as Record<AdminPermissionKey, boolean>,
);
const viewerOnly: Record<AdminPermissionKey, boolean> = ADMIN_PERMISSION_KEYS.reduce(
  (acc, k) => ((acc[k] = k.endsWith(".view")), acc),
  {} as Record<AdminPermissionKey, boolean>,
);
const managerDefault: Record<AdminPermissionKey, boolean> = ADMIN_PERMISSION_KEYS.reduce((acc, k) => {
  // Managers: everything except destructive deletes and Settings.edit. Cannot manage admins.
  if (k.endsWith(".delete")) acc[k] = false;
  else if (k === "settings.edit") acc[k] = false;
  else acc[k] = true;
  return acc;
}, {} as Record<AdminPermissionKey, boolean>);

export const DEFAULT_PERMISSIONS_BY_ROLE: Record<AdminRole, Record<AdminPermissionKey, boolean>> = {
  super_admin: allTrue,
  manager: managerDefault,
  viewer: viewerOnly,
};

export function hasPermission(
  user: Pick<User, "role" | "adminRole" | "permissions" | "isActive"> | null | undefined,
  key: AdminPermissionKey,
): boolean {
  if (!user) return false;
  if (user.role !== "admin") return false;
  if (user.isActive === false) return false;
  if (user.adminRole === "super_admin") return true;
  // Legacy admins predating the role system: treated as full-access.
  if (user.adminRole == null) return true;
  const perms = (user.permissions ?? {}) as Record<string, boolean>;
  return perms[key] === true;
}

// True for super admins AND legacy admins (no adminRole assigned yet).
export function isEffectiveSuperAdmin(
  user: Pick<User, "role" | "adminRole" | "isActive"> | null | undefined,
): boolean {
  if (!user) return false;
  if (user.role !== "admin") return false;
  if (user.isActive === false) return false;
  return user.adminRole === "super_admin" || user.adminRole == null;
}

// =============================
// ADMIN USER (CRUD) SCHEMAS
// =============================
const permissionsRecord = z.record(z.string(), z.boolean());

export const insertAdminUserSchema = z.object({
  email: z.string().email("Valid email is required"),
  fullName: z.string().min(2, "Full name is required"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  adminRole: z.enum(ADMIN_ROLES),
  permissions: permissionsRecord.optional(),
  isActive: z.boolean().optional(),
});
export type InsertAdminUser = z.infer<typeof insertAdminUserSchema>;

export const updateAdminUserSchema = z.object({
  fullName: z.string().min(2).optional(),
  adminRole: z.enum(ADMIN_ROLES).optional(),
  permissions: permissionsRecord.optional(),
  isActive: z.boolean().optional(),
  password: z.string().min(6).optional(),
});
export type UpdateAdminUser = z.infer<typeof updateAdminUserSchema>;

// =============================
// MANUAL BOOKING (admin-created) SCHEMAS
// =============================
export const insertManualBookingSchema = z.object({
  date: z.string().min(1, "Date is required"),
  timeSlot: z.string().min(1, "Time is required"),
  status: z.enum(BOOKING_STATUSES).default("completed"),
  sessionType: z.enum(SESSION_TYPES).default("manual_historical"),
  workoutCategory: z.enum(WORKOUT_CATEGORIES).nullable().optional(),
  workoutNotes: z.string().nullable().optional(),
  packageId: z.number().int().nullable().optional(),
  adminNotes: z.string().nullable().optional(),
  clientNotes: z.string().nullable().optional(),
  showNoteToClient: z.boolean().optional(),
  isManualHistorical: z.boolean().optional().default(true),
});
export type InsertManualBooking = z.infer<typeof insertManualBookingSchema>;

export const bulkManualBookingSchema = z.object({
  count: z.number().int().min(1).max(50),
  startDate: z.string().min(1, "Start date is required"),
  // Defaults applied to every generated session
  timeSlot: z.string().default("12:00"),
  workoutCategory: z.enum(WORKOUT_CATEGORIES).nullable().optional(),
  packageId: z.number().int().nullable().optional(),
  status: z.enum(BOOKING_STATUSES).default("completed"),
  // One session per day, advancing forward by 1 day per entry
  spacingDays: z.number().int().min(1).max(30).default(1),
  adminNotes: z.string().nullable().optional(),
});
export type BulkManualBooking = z.infer<typeof bulkManualBookingSchema>;

// =============================
// NUTRITION OS — PHASE 2: FOOD LIBRARY
// =============================
// Centralised food / supplement catalogue used by the meal builder
// (Phase 3) and per-client nutrition assignments (Phase 4+).
//
// Design notes:
// - All macros stored per *serving* (not per 100g) so the trainer can
//   work in human units (1 scoop, 1 piece, 100g, 250ml, …). The meal
//   builder multiplies by quantity client-side.
// - `created_by_user_id` is intentionally an int with NO foreign-key
//   constraint so deleting a trainer never cascades and orphans the
//   catalogue. Indexed for future per-trainer scoping.
// - Phase 3's `meal_items` will SNAPSHOT food fields (name, macros,
//   serving) at the moment a food is added to a meal, mirroring the
//   package-template → packages pattern. Therefore deleting / editing
//   a food here is safe and does not mutate historical meals.
// - Numeric columns use `doublePrecision` (not integer) because real
//   nutrition data has fractional grams (e.g. 0.6 g sodium, 23.4 g
//   protein). Money in the rest of the app uses int because cents
//   drift matters; macros do not.
export const foods = pgTable("foods", {
  id: serial("id").primaryKey(),
  // Display name (English / primary). Required.
  name: text("name").notNull(),
  // Optional secondary name (e.g. Arabic) — future search field.
  nameAr: text("name_ar"),
  // FOOD_CATEGORIES — soft-typed at DB level so adding a category
  // never requires a migration.
  category: text("category").notNull().default("other"),
  // Brand / source (e.g. "Optimum Nutrition", "Almarai"). Optional.
  brand: text("brand"),
  // Reference serving the macros refer to.
  servingSize: doublePrecision("serving_size").notNull().default(100),
  // FOOD_SERVING_UNITS
  servingUnit: text("serving_unit").notNull().default("g"),
  // Per-serving macros (not per-100g).
  kcal: doublePrecision("kcal").notNull().default(0),
  proteinG: doublePrecision("protein_g").notNull().default(0),
  carbsG: doublePrecision("carbs_g").notNull().default(0),
  fatsG: doublePrecision("fats_g").notNull().default(0),
  // Optional micros / fibre — used in detailed coaching.
  fiberG: doublePrecision("fiber_g"),
  sugarG: doublePrecision("sugar_g"),
  sodiumMg: doublePrecision("sodium_mg"),
  // Coaching metadata — used by the meal builder hints.
  // FOOD_DIGESTION_SPEEDS: 'fast' | 'medium' | 'slow'
  digestionSpeed: text("digestion_speed"),
  // FOOD_TIMINGS
  bestTiming: text("best_timing"),
  notes: text("notes"),
  // Soft archive — keep the row so historical meal snapshots referring
  // to it by id (if any) still resolve. Hidden from picker when false.
  isActive: boolean("is_active").notNull().default(true),
  // Differentiates supplements from whole foods in the picker UI.
  isSupplement: boolean("is_supplement").notNull().default(false),
  // Author. Nullable, no FK — deleting the user must not break catalog.
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const FOOD_CATEGORIES = [
  "protein",
  "carbs",
  "fats",
  "vegetables",
  "fruits",
  "dairy",
  "grains",
  "nuts_seeds",
  "drinks",
  "condiments",
  "supplements",
  "other",
] as const;

export const FOOD_SERVING_UNITS = [
  "g",
  "ml",
  "piece",
  "scoop",
  "cup",
  "tbsp",
  "tsp",
  "slice",
] as const;

export const FOOD_DIGESTION_SPEEDS = ["fast", "medium", "slow"] as const;

export const FOOD_TIMINGS = [
  "pre_workout",
  "post_workout",
  "morning",
  "afternoon",
  "evening",
  "anytime",
] as const;

// English fallback labels — i18n layer translates these per locale.
export const FOOD_CATEGORY_LABELS_EN: Record<string, string> = {
  protein: "Protein",
  carbs: "Carbs",
  fats: "Fats",
  vegetables: "Vegetables",
  fruits: "Fruits",
  dairy: "Dairy",
  grains: "Grains",
  nuts_seeds: "Nuts & Seeds",
  drinks: "Drinks",
  condiments: "Condiments",
  supplements: "Supplements",
  other: "Other",
};

export const FOOD_SERVING_UNIT_LABELS_EN: Record<string, string> = {
  g: "g",
  ml: "ml",
  piece: "piece",
  scoop: "scoop",
  cup: "cup",
  tbsp: "tbsp",
  tsp: "tsp",
  slice: "slice",
};

export const FOOD_DIGESTION_SPEED_LABELS_EN: Record<string, string> = {
  fast: "Fast",
  medium: "Medium",
  slow: "Slow",
};

export const FOOD_TIMING_LABELS_EN: Record<string, string> = {
  pre_workout: "Pre-workout",
  post_workout: "Post-workout",
  morning: "Morning",
  afternoon: "Afternoon",
  evening: "Evening",
  anytime: "Anytime",
};

export const insertFoodSchema = createInsertSchema(foods)
  .omit({ id: true, createdAt: true, updatedAt: true, createdByUserId: true })
  .extend({
    name: z.string().min(1, "Name is required").max(160),
    nameAr: z.string().max(160).nullish(),
    category: z.enum(FOOD_CATEGORIES),
    brand: z.string().max(120).nullish(),
    servingSize: z.number().min(0.01, "Serving size must be > 0").max(10000),
    servingUnit: z.enum(FOOD_SERVING_UNITS),
    kcal: z.number().min(0).max(10000),
    proteinG: z.number().min(0).max(1000),
    carbsG: z.number().min(0).max(1000),
    fatsG: z.number().min(0).max(1000),
    fiberG: z.number().min(0).max(500).nullish(),
    sugarG: z.number().min(0).max(1000).nullish(),
    sodiumMg: z.number().min(0).max(50000).nullish(),
    digestionSpeed: z.enum(FOOD_DIGESTION_SPEEDS).nullish(),
    bestTiming: z.enum(FOOD_TIMINGS).nullish(),
    notes: z.string().max(500).nullish(),
    isActive: z.boolean().optional(),
    isSupplement: z.boolean().optional(),
  });

export const updateFoodSchema = insertFoodSchema.partial();

export type Food = typeof foods.$inferSelect;
export type InsertFood = z.infer<typeof insertFoodSchema>;
export type UpdateFood = z.infer<typeof updateFoodSchema>;

// =============================
// NUTRITION OS — PHASE 3: MEAL BUILDER
// =============================
// `meals` defines a meal (template by default) made of N rows in
// `meal_items`. Each meal_items row is a SNAPSHOT of the food at the
// moment it was added — name, serving, macros are copied so editing
// or deleting the underlying food NEVER mutates an existing meal
// (mirrors the package_templates → packages snapshot pattern).
//
// `food_id` is kept as a soft reference (no FK) for traceability:
//   1. AI substitution: "swap chicken for turkey" needs the link.
//   2. Future analytics: which foods are most-used across meals.
// We deliberately do not enforce a FK so deleting a food never
// blocks meal cleanup.
//
// Cached totals (`total_kcal` etc.) live on the meals row and are
// recomputed server-side on every write via `computeMealTotals` from
// shared/nutrition.ts — list views, PDF exports, WhatsApp summaries
// and AI inputs all read the cached value without re-joining items.
export const meals = pgTable("meals", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  description: text("description"),
  // MEAL_CATEGORIES — soft-typed at DB level.
  category: text("category").notNull().default("other"),
  notes: text("notes"),
  // True = visible in the trainer's library/picker (default for now).
  // Phase 4 client-specific meals will flip this to false.
  isTemplate: boolean("is_template").notNull().default(true),
  // Soft archive — hidden from default listings but kept so any plan
  // that already references this meal still resolves.
  isActive: boolean("is_active").notNull().default(true),
  // Cached totals. Source of truth = items; recomputed on every write.
  totalKcal: doublePrecision("total_kcal").notNull().default(0),
  totalProteinG: doublePrecision("total_protein_g").notNull().default(0),
  totalCarbsG: doublePrecision("total_carbs_g").notNull().default(0),
  totalFatsG: doublePrecision("total_fats_g").notNull().default(0),
  // Author. Nullable, no FK — deleting a trainer must not break library.
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const mealItems = pgTable("meal_items", {
  id: serial("id").primaryKey(),
  // Hard FK so cascading delete cleans up children when a meal is
  // hard-deleted. (Soft archive still works because we only flip
  // isActive on the parent in that path.)
  mealId: integer("meal_id")
    .notNull()
    .references(() => meals.id, { onDelete: "cascade" }),
  // Soft reference to the originating food for AI/analytics. No FK
  // so deleting a food never blocks anything.
  foodId: integer("food_id"),
  // ===== SNAPSHOT FIELDS (copied from foods at insert time) =====
  name: text("name").notNull(),
  servingSize: doublePrecision("serving_size").notNull().default(100),
  servingUnit: text("serving_unit").notNull().default("g"),
  kcal: doublePrecision("kcal").notNull().default(0),
  proteinG: doublePrecision("protein_g").notNull().default(0),
  carbsG: doublePrecision("carbs_g").notNull().default(0),
  fatsG: doublePrecision("fats_g").notNull().default(0),
  fiberG: doublePrecision("fiber_g"),
  sugarG: doublePrecision("sugar_g"),
  sodiumMg: doublePrecision("sodium_mg"),
  // ===== PER-INSTANCE FIELDS =====
  // How many of `servingSize × servingUnit` the trainer is serving.
  // 1 = one whole snapshot serving; 1.5 = one and a half; 0.5 = half.
  quantity: doublePrecision("quantity").notNull().default(1),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const MEAL_CATEGORIES = [
  "breakfast",
  "lunch",
  "dinner",
  "snack",
  "pre_workout",
  "post_workout",
  "other",
] as const;
export type MealCategory = (typeof MEAL_CATEGORIES)[number];

export const MEAL_CATEGORY_LABELS_EN: Record<MealCategory, string> = {
  breakfast: "Breakfast",
  lunch: "Lunch",
  dinner: "Dinner",
  snack: "Snack",
  pre_workout: "Pre-workout",
  post_workout: "Post-workout",
  other: "Other",
};

// Item input shape — every snapshot field is explicit so the server
// never has to look up a food (saves a round-trip and makes import
// scripts trivial).
export const mealItemInputSchema = z.object({
  foodId: z.number().int().nullish(),
  name: z.string().min(1, "Name is required").max(200),
  servingSize: z.number().min(0.01).max(10000),
  servingUnit: z.string().min(1).max(20),
  kcal: z.number().min(0).max(10000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  fatsG: z.number().min(0).max(1000),
  fiberG: z.number().min(0).max(500).nullish(),
  sugarG: z.number().min(0).max(1000).nullish(),
  sodiumMg: z.number().min(0).max(50000).nullish(),
  quantity: z.number().min(0.01, "Quantity must be > 0").max(100),
  notes: z.string().max(500).nullish(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export const insertMealSchema = createInsertSchema(meals)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdByUserId: true,
    totalKcal: true,
    totalProteinG: true,
    totalCarbsG: true,
    totalFatsG: true,
  })
  .extend({
    name: z.string().min(1, "Name is required").max(200),
    nameAr: z.string().max(200).nullish(),
    description: z.string().max(1000).nullish(),
    category: z.enum(MEAL_CATEGORIES),
    notes: z.string().max(1000).nullish(),
    isTemplate: z.boolean().optional(),
    isActive: z.boolean().optional(),
    items: z.array(mealItemInputSchema).min(1, "At least one item is required").max(50),
  });

// Update accepts every field optional. If `items` is supplied, the
// server treats it as a full replacement (simpler & atomic vs diff).
export const updateMealSchema = insertMealSchema.partial().extend({
  items: z.array(mealItemInputSchema).min(1).max(50).optional(),
});

export type Meal = typeof meals.$inferSelect;
export type MealItem = typeof mealItems.$inferSelect;
export type MealItemInput = z.infer<typeof mealItemInputSchema>;
export type InsertMeal = z.infer<typeof insertMealSchema>;
export type UpdateMeal = z.infer<typeof updateMealSchema>;
export interface MealWithItems extends Meal {
  items: MealItem[];
}

// =============================
// NUTRITION OS — PHASE 4: CLIENT NUTRITION PLANS
// =============================
// A nutrition plan belongs to one client and is the operating
// document the trainer hands them. Each plan has N day types
// (training, rest, high-carb, low-carb, ramadan, custom). Each day
// holds its own macro targets + N meals. Each meal holds N items.
// Meals + items are FULL SNAPSHOTS (mirrors the package_templates →
// packages and meals → meal_items pattern) so editing or deleting a
// food / meal in the library NEVER mutates a delivered plan.
//
// Cached totals live on `nutrition_plan_meals` so the client view,
// PDF export, WhatsApp summary and AI recommendations never JOIN +
// SUM at read time. Day-level totals are derived live from the meals
// (cheap — at most ~10 meals/day).

export const nutritionPlans = pgTable("nutrition_plans", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  // NUTRITION_PLAN_GOALS — soft-typed at DB level.
  goal: text("goal").notNull().default("custom"),
  // NUTRITION_PLAN_STATUSES.
  status: text("status").notNull().default("draft"),
  startDate: text("start_date"),
  reviewDate: text("review_date"),
  waterTargetMl: integer("water_target_ml"),
  publicNotes: text("public_notes"),
  // Trainer-only — never shipped to client view.
  privateNotes: text("private_notes"),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const nutritionPlanDays = pgTable("nutrition_plan_days", {
  id: serial("id").primaryKey(),
  planId: integer("plan_id")
    .notNull()
    .references(() => nutritionPlans.id, { onDelete: "cascade" }),
  // NUTRITION_PLAN_DAY_TYPES.
  dayType: text("day_type").notNull().default("training"),
  // Optional override label — falls back to translated dayType.
  label: text("label"),
  sortOrder: integer("sort_order").notNull().default(0),
  // Per-day macro targets.
  targetKcal: integer("target_kcal").notNull().default(0),
  targetProteinG: integer("target_protein_g").notNull().default(0),
  targetCarbsG: integer("target_carbs_g").notNull().default(0),
  targetFatsG: integer("target_fats_g").notNull().default(0),
  notes: text("notes"),
});

export const nutritionPlanMeals = pgTable("nutrition_plan_meals", {
  id: serial("id").primaryKey(),
  planDayId: integer("plan_day_id")
    .notNull()
    .references(() => nutritionPlanDays.id, { onDelete: "cascade" }),
  // Soft reference to the originating Meal Library row (no FK).
  sourceMealId: integer("source_meal_id"),
  name: text("name").notNull(),
  // MEAL_CATEGORIES (re-used from Phase 3).
  category: text("category").notNull().default("other"),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
  // Cached totals — recomputed every write via shared computeMealTotals.
  totalKcal: doublePrecision("total_kcal").notNull().default(0),
  totalProteinG: doublePrecision("total_protein_g").notNull().default(0),
  totalCarbsG: doublePrecision("total_carbs_g").notNull().default(0),
  totalFatsG: doublePrecision("total_fats_g").notNull().default(0),
});

export const nutritionPlanMealItems = pgTable("nutrition_plan_meal_items", {
  id: serial("id").primaryKey(),
  planMealId: integer("plan_meal_id")
    .notNull()
    .references(() => nutritionPlanMeals.id, { onDelete: "cascade" }),
  // Soft reference to the originating Food (no FK).
  sourceFoodId: integer("source_food_id"),
  // ===== SNAPSHOT FIELDS =====
  name: text("name").notNull(),
  servingSize: doublePrecision("serving_size").notNull().default(100),
  servingUnit: text("serving_unit").notNull().default("g"),
  kcal: doublePrecision("kcal").notNull().default(0),
  proteinG: doublePrecision("protein_g").notNull().default(0),
  carbsG: doublePrecision("carbs_g").notNull().default(0),
  fatsG: doublePrecision("fats_g").notNull().default(0),
  fiberG: doublePrecision("fiber_g"),
  sugarG: doublePrecision("sugar_g"),
  sodiumMg: doublePrecision("sodium_mg"),
  // ===== PER-INSTANCE =====
  quantity: doublePrecision("quantity").notNull().default(1),
  notes: text("notes"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const NUTRITION_PLAN_GOALS = [
  "fat_loss",
  "muscle_gain",
  "recomposition",
  "performance",
  "maintenance",
  "ramadan",
  "custom",
] as const;
export type NutritionPlanGoal = (typeof NUTRITION_PLAN_GOALS)[number];

export const NUTRITION_PLAN_GOAL_LABELS_EN: Record<NutritionPlanGoal, string> = {
  fat_loss: "Fat Loss",
  muscle_gain: "Muscle Gain",
  recomposition: "Recomposition",
  performance: "Performance",
  maintenance: "Maintenance",
  ramadan: "Ramadan",
  custom: "Custom",
};

export const NUTRITION_PLAN_STATUSES = ["draft", "active", "archived"] as const;
export type NutritionPlanStatus = (typeof NUTRITION_PLAN_STATUSES)[number];

export const NUTRITION_PLAN_STATUS_LABELS_EN: Record<NutritionPlanStatus, string> = {
  draft: "Draft",
  active: "Active",
  archived: "Archived",
};

export const NUTRITION_PLAN_DAY_TYPES = [
  "training",
  "rest",
  "high_carb",
  "low_carb",
  "ramadan",
  "custom",
] as const;
export type NutritionPlanDayType = (typeof NUTRITION_PLAN_DAY_TYPES)[number];

export const NUTRITION_PLAN_DAY_TYPE_LABELS_EN: Record<NutritionPlanDayType, string> = {
  training: "Training Day",
  rest: "Rest Day",
  high_carb: "High Carb Day",
  low_carb: "Low Carb Day",
  ramadan: "Ramadan Day",
  custom: "Custom Day",
};

// Item input — explicit snapshot fields, identical shape to
// mealItemInputSchema so the client can pipe the same form data here
// when adding a meal from the library.
export const planMealItemInputSchema = z.object({
  sourceFoodId: z.number().int().nullish(),
  name: z.string().min(1).max(200),
  servingSize: z.number().min(0.01).max(10000),
  servingUnit: z.string().min(1).max(20),
  kcal: z.number().min(0).max(10000),
  proteinG: z.number().min(0).max(1000),
  carbsG: z.number().min(0).max(1000),
  fatsG: z.number().min(0).max(1000),
  fiberG: z.number().min(0).max(500).nullish(),
  sugarG: z.number().min(0).max(1000).nullish(),
  sodiumMg: z.number().min(0).max(50000).nullish(),
  quantity: z.number().min(0.01, "Quantity must be > 0").max(100),
  notes: z.string().max(500).nullish(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
});

export const planMealInputSchema = z.object({
  sourceMealId: z.number().int().nullish(),
  name: z.string().min(1, "Meal name is required").max(200),
  category: z.enum(MEAL_CATEGORIES),
  notes: z.string().max(500).nullish(),
  sortOrder: z.number().int().min(0).max(10000).optional(),
  items: z.array(planMealItemInputSchema).min(1, "Meal needs at least one item").max(50),
});

export const planDayInputSchema = z.object({
  dayType: z.enum(NUTRITION_PLAN_DAY_TYPES),
  label: z.string().max(100).nullish(),
  sortOrder: z.number().int().min(0).max(20).optional(),
  targetKcal: z.number().int().min(0).max(20000),
  targetProteinG: z.number().int().min(0).max(2000),
  targetCarbsG: z.number().int().min(0).max(2000),
  targetFatsG: z.number().int().min(0).max(2000),
  notes: z.string().max(1000).nullish(),
  meals: z.array(planMealInputSchema).max(20).default([]),
});

export const insertNutritionPlanSchema = createInsertSchema(nutritionPlans)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    createdByUserId: true,
  })
  .extend({
    userId: z.number().int().positive(),
    name: z.string().min(1, "Plan needs a name").max(200),
    goal: z.enum(NUTRITION_PLAN_GOALS),
    status: z.enum(NUTRITION_PLAN_STATUSES).optional(),
    startDate: z.string().nullish(),
    reviewDate: z.string().nullish(),
    waterTargetMl: z.number().int().min(0).max(20000).nullish(),
    publicNotes: z.string().max(2000).nullish(),
    privateNotes: z.string().max(2000).nullish(),
    days: z.array(planDayInputSchema).min(1, "Add at least one day type").max(10),
  });

export const updateNutritionPlanSchema = insertNutritionPlanSchema.partial().extend({
  // userId can never be reassigned via update — server enforces.
  userId: z.never().optional(),
  days: z.array(planDayInputSchema).min(1).max(10).optional(),
});

export type NutritionPlan = typeof nutritionPlans.$inferSelect;
export type NutritionPlanDay = typeof nutritionPlanDays.$inferSelect;
export type NutritionPlanMeal = typeof nutritionPlanMeals.$inferSelect;
export type NutritionPlanMealItem = typeof nutritionPlanMealItems.$inferSelect;
export type PlanMealItemInput = z.infer<typeof planMealItemInputSchema>;
export type PlanMealInput = z.infer<typeof planMealInputSchema>;
export type PlanDayInput = z.infer<typeof planDayInputSchema>;
export type InsertNutritionPlan = z.infer<typeof insertNutritionPlanSchema>;
export type UpdateNutritionPlan = z.infer<typeof updateNutritionPlanSchema>;

export interface NutritionPlanMealWithItems extends NutritionPlanMeal {
  items: NutritionPlanMealItem[];
}
export interface NutritionPlanDayWithMeals extends NutritionPlanDay {
  meals: NutritionPlanMealWithItems[];
}
export interface NutritionPlanFull extends NutritionPlan {
  days: NutritionPlanDayWithMeals[];
}

// =============================
// SUPPLEMENT SYSTEM (Phase 3)
// =============================
// Three-layer architecture mirrors the package-template / nutrition-
// plan pattern that has worked elsewhere in the codebase:
//
//   supplements          → admin-curated catalogue (the library)
//   supplement_stacks    → reusable templates (e.g. "Cutting Stack")
//   supplement_stack_items → snapshot rows that compose a stack
//   client_supplements   → SNAPSHOT rows assigned to a single client
//
// Snapshots are critical: editing a library row or stack template
// must NEVER mutate the protocols clients are currently following.
// Every assignment carries its own copy of name / dosage / timings
// so historical data is preserved and admins can fearlessly tidy
// the catalogue.
//
// `timings` is a text array (morning, pre_workout, with_breakfast,
// before_bed, etc.) — leaving it open-ended at the DB layer means
// adding a new timing slot requires zero migration.
//
// Train-vs-rest day differences: each supplement carries TWO boolean
// flags (`trainingDayOnly`, `restDayOnly`). Both false ⇒ take every
// day. We use two booleans rather than an enum so the "Today" view
// can answer "is today a training day?" with a single boolean lookup
// without enum coercion.
export const SUPPLEMENT_CATEGORIES = [
  "vitamin",
  "mineral",
  "protein",
  "creatine",
  "amino",
  "pre_workout",
  "fat_burner",
  "omega",
  "probiotic",
  "herbal",
  "recovery",
  "hormone_support",
  "electrolyte",
  "other",
] as const;
export type SupplementCategory = (typeof SUPPLEMENT_CATEGORIES)[number];
export const SUPPLEMENT_CATEGORY_LABELS_EN: Record<SupplementCategory, string> = {
  vitamin: "Vitamin",
  mineral: "Mineral",
  protein: "Protein",
  creatine: "Creatine",
  amino: "Amino Acid",
  pre_workout: "Pre-Workout",
  fat_burner: "Fat Burner",
  omega: "Omega / EFA",
  probiotic: "Probiotic",
  herbal: "Herbal",
  recovery: "Recovery",
  hormone_support: "Hormone Support",
  electrolyte: "Electrolyte",
  other: "Other",
};

export const SUPPLEMENT_UNITS = [
  "g", "mg", "mcg", "iu", "scoop", "capsule", "tablet", "softgel", "ml", "drop", "sachet",
] as const;
export type SupplementUnit = (typeof SUPPLEMENT_UNITS)[number];

export const SUPPLEMENT_TIMINGS = [
  "morning",
  "with_breakfast",
  "pre_workout",
  "intra_workout",
  "post_workout",
  "with_lunch",
  "with_dinner",
  "before_bed",
  "anytime",
] as const;
export type SupplementTiming = (typeof SUPPLEMENT_TIMINGS)[number];
export const SUPPLEMENT_TIMING_LABELS_EN: Record<SupplementTiming, string> = {
  morning: "Morning",
  with_breakfast: "With Breakfast",
  pre_workout: "Pre-Workout",
  intra_workout: "Intra-Workout",
  post_workout: "Post-Workout",
  with_lunch: "With Lunch",
  with_dinner: "With Dinner",
  before_bed: "Before Bed",
  anytime: "Anytime",
};
// Stable ordering for the "Today" timeline rendering — earliest first.
export const SUPPLEMENT_TIMING_ORDER: Record<SupplementTiming, number> = {
  morning: 1,
  with_breakfast: 2,
  pre_workout: 3,
  intra_workout: 4,
  post_workout: 5,
  with_lunch: 6,
  with_dinner: 7,
  before_bed: 8,
  anytime: 9,
};

export const SUPPLEMENT_STATUSES = ["active", "paused", "stopped"] as const;
export type SupplementStatus = (typeof SUPPLEMENT_STATUSES)[number];

// ---------- TABLES ----------
export const supplements = pgTable("supplements", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  brand: text("brand"),
  category: text("category").notNull().default("other"),
  defaultDosage: doublePrecision("default_dosage").notNull().default(1),
  defaultUnit: text("default_unit").notNull().default("capsule"),
  // Postgres text[] — kept loose at DB level (cf. timings comment above).
  defaultTimings: text("default_timings").array().notNull().default(sql`ARRAY[]::text[]`),
  defaultTrainingDayOnly: boolean("default_training_day_only").notNull().default(false),
  defaultRestDayOnly: boolean("default_rest_day_only").notNull().default(false),
  // Public coach guidance (visible to client when prescribed).
  notes: text("notes"),
  // Health warnings (visible to client; e.g. "do not exceed 3g/day").
  warnings: text("warnings"),
  isPrescription: boolean("is_prescription").notNull().default(false),
  active: boolean("active").notNull().default(true),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supplementStacks = pgTable("supplement_stacks", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  goal: text("goal").notNull().default("custom"),
  description: text("description"),
  notes: text("notes"),
  active: boolean("active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdByUserId: integer("created_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const supplementStackItems = pgTable("supplement_stack_items", {
  id: serial("id").primaryKey(),
  stackId: integer("stack_id")
    .notNull()
    .references(() => supplementStacks.id, { onDelete: "cascade" }),
  // Soft pointer back to the originating library entry — no FK so the
  // stack survives library tidying. Used by the admin UI to show "X
  // edits to library item" affordances; nothing else relies on it.
  sourceSupplementId: integer("source_supplement_id"),
  // ===== SNAPSHOT FIELDS =====
  name: text("name").notNull(),
  brand: text("brand"),
  category: text("category").notNull().default("other"),
  dosage: doublePrecision("dosage").notNull().default(1),
  unit: text("unit").notNull().default("capsule"),
  timings: text("timings").array().notNull().default(sql`ARRAY[]::text[]`),
  trainingDayOnly: boolean("training_day_only").notNull().default(false),
  restDayOnly: boolean("rest_day_only").notNull().default(false),
  notes: text("notes"),
  warnings: text("warnings"),
  sortOrder: integer("sort_order").notNull().default(0),
});

export const clientSupplements = pgTable("client_supplements", {
  id: serial("id").primaryKey(),
  userId: integer("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  // Soft pointers — both nullable; both no FK so library / stack tidying
  // is safe. Useful for "applied from stack X" provenance UI.
  sourceSupplementId: integer("source_supplement_id"),
  sourceStackId: integer("source_stack_id"),
  // ===== SNAPSHOT FIELDS =====
  name: text("name").notNull(),
  brand: text("brand"),
  category: text("category").notNull().default("other"),
  dosage: doublePrecision("dosage").notNull().default(1),
  unit: text("unit").notNull().default("capsule"),
  timings: text("timings").array().notNull().default(sql`ARRAY[]::text[]`),
  trainingDayOnly: boolean("training_day_only").notNull().default(false),
  restDayOnly: boolean("rest_day_only").notNull().default(false),
  notes: text("notes"),
  warnings: text("warnings"),
  // Lifecycle
  status: text("status").notNull().default("active"),
  startDate: date("start_date"),
  endDate: date("end_date"),
  sortOrder: integer("sort_order").notNull().default(0),
  assignedByUserId: integer("assigned_by_user_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// ---------- ZOD ----------
const timingsSchema = z
  .array(z.enum(SUPPLEMENT_TIMINGS))
  .max(SUPPLEMENT_TIMINGS.length)
  .default([]);

// A supplement cannot be flagged as BOTH training-only and rest-only —
// that would silently make it invisible to the client on every day.
// We reject the contradiction at the schema layer so neither the API
// nor any importer can ever persist it.
const noBothDayFlags = (val: { trainingDayOnly?: boolean | null; restDayOnly?: boolean | null }) =>
  !(val.trainingDayOnly && val.restDayOnly);
const noBothDayFlagsDefaults = (val: { defaultTrainingDayOnly?: boolean | null; defaultRestDayOnly?: boolean | null }) =>
  !(val.defaultTrainingDayOnly && val.defaultRestDayOnly);
const BOTH_FLAGS_MSG = "A supplement can be training-day-only OR rest-day-only, not both.";

// Build the raw object first so we can derive both insert (refined) and
// update (.partial() then refined) without losing the contradiction guard.
const supplementBaseShape = createInsertSchema(supplements)
  .omit({ id: true, createdAt: true, updatedAt: true, createdByUserId: true })
  .extend({
    name: z.string().min(1, "Name is required").max(200),
    nameAr: z.string().max(200).nullish(),
    brand: z.string().max(120).nullish(),
    category: z.enum(SUPPLEMENT_CATEGORIES),
    defaultDosage: z.number().min(0).max(10000),
    defaultUnit: z.enum(SUPPLEMENT_UNITS),
    defaultTimings: timingsSchema,
    defaultTrainingDayOnly: z.boolean().optional(),
    defaultRestDayOnly: z.boolean().optional(),
    notes: z.string().max(1000).nullish(),
    warnings: z.string().max(1000).nullish(),
    isPrescription: z.boolean().optional(),
    active: z.boolean().optional(),
  });
export const insertSupplementSchema = supplementBaseShape.refine(noBothDayFlagsDefaults, {
  message: BOTH_FLAGS_MSG,
  path: ["defaultRestDayOnly"],
});
export const updateSupplementSchema = supplementBaseShape
  .partial()
  .refine(noBothDayFlagsDefaults, { message: BOTH_FLAGS_MSG, path: ["defaultRestDayOnly"] });
export type Supplement = typeof supplements.$inferSelect;
export type InsertSupplement = z.infer<typeof insertSupplementSchema>;
export type UpdateSupplement = z.infer<typeof updateSupplementSchema>;

export const stackItemInputSchema = z
  .object({
    sourceSupplementId: z.number().int().nullish(),
    name: z.string().min(1).max(200),
    brand: z.string().max(120).nullish(),
    category: z.enum(SUPPLEMENT_CATEGORIES),
    dosage: z.number().min(0).max(10000),
    unit: z.enum(SUPPLEMENT_UNITS),
    timings: timingsSchema,
    trainingDayOnly: z.boolean().optional(),
    restDayOnly: z.boolean().optional(),
    notes: z.string().max(1000).nullish(),
    warnings: z.string().max(1000).nullish(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .refine(noBothDayFlags, { message: BOTH_FLAGS_MSG, path: ["restDayOnly"] });
export type StackItemInput = z.infer<typeof stackItemInputSchema>;

export const insertSupplementStackSchema = createInsertSchema(supplementStacks)
  .omit({ id: true, createdAt: true, updatedAt: true, createdByUserId: true })
  .extend({
    name: z.string().min(1, "Name is required").max(200),
    goal: z.string().min(1).max(60),
    description: z.string().max(500).nullish(),
    notes: z.string().max(1000).nullish(),
    active: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
    items: z.array(stackItemInputSchema).min(1, "Add at least one supplement").max(40),
  });
export const updateSupplementStackSchema = insertSupplementStackSchema.partial().extend({
  items: z.array(stackItemInputSchema).min(1).max(40).optional(),
});
export type SupplementStack = typeof supplementStacks.$inferSelect;
export type SupplementStackItem = typeof supplementStackItems.$inferSelect;
export type InsertSupplementStack = z.infer<typeof insertSupplementStackSchema>;
export type UpdateSupplementStack = z.infer<typeof updateSupplementStackSchema>;
export interface SupplementStackFull extends SupplementStack {
  items: SupplementStackItem[];
}

export const insertClientSupplementSchema = createInsertSchema(clientSupplements)
  .omit({ id: true, createdAt: true, updatedAt: true, assignedByUserId: true })
  .extend({
    userId: z.number().int().positive(),
    sourceSupplementId: z.number().int().nullish(),
    sourceStackId: z.number().int().nullish(),
    name: z.string().min(1).max(200),
    brand: z.string().max(120).nullish(),
    category: z.enum(SUPPLEMENT_CATEGORIES),
    dosage: z.number().min(0).max(10000),
    unit: z.enum(SUPPLEMENT_UNITS),
    timings: timingsSchema,
    trainingDayOnly: z.boolean().optional(),
    restDayOnly: z.boolean().optional(),
    notes: z.string().max(1000).nullish(),
    warnings: z.string().max(1000).nullish(),
    status: z.enum(SUPPLEMENT_STATUSES).optional(),
    startDate: z.string().nullish(),
    endDate: z.string().nullish(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .refine(noBothDayFlags, { message: BOTH_FLAGS_MSG, path: ["restDayOnly"] });
// .partial() strips the refinement, so we re-apply it on the patch
// schema explicitly. PATCH bodies that omit both flags pass cleanly;
// only an explicit `{trainingDayOnly:true, restDayOnly:true}` is rejected.
export const updateClientSupplementSchema = createInsertSchema(clientSupplements)
  .omit({ id: true, createdAt: true, updatedAt: true, assignedByUserId: true, userId: true })
  .extend({
    sourceSupplementId: z.number().int().nullish(),
    sourceStackId: z.number().int().nullish(),
    name: z.string().min(1).max(200).optional(),
    brand: z.string().max(120).nullish(),
    category: z.enum(SUPPLEMENT_CATEGORIES).optional(),
    dosage: z.number().min(0).max(10000).optional(),
    unit: z.enum(SUPPLEMENT_UNITS).optional(),
    timings: timingsSchema.optional(),
    trainingDayOnly: z.boolean().optional(),
    restDayOnly: z.boolean().optional(),
    notes: z.string().max(1000).nullish(),
    warnings: z.string().max(1000).nullish(),
    status: z.enum(SUPPLEMENT_STATUSES).optional(),
    startDate: z.string().nullish(),
    endDate: z.string().nullish(),
    sortOrder: z.number().int().min(0).max(1000).optional(),
  })
  .partial()
  .refine(noBothDayFlags, { message: BOTH_FLAGS_MSG, path: ["restDayOnly"] });
export type ClientSupplement = typeof clientSupplements.$inferSelect;
export type InsertClientSupplement = z.infer<typeof insertClientSupplementSchema>;
export type UpdateClientSupplement = z.infer<typeof updateClientSupplementSchema>;

// =============================
// BODY METRICS (P4a — Progress Tracking)
// =============================
// One row per dated measurement entry. Designed for charting + trend
// detection: every numeric is `doublePrecision` so partial entries (e.g.
// only weight today) are first-class. `recordedOn` is a date, not a
// timestamp, because clients log "today's weigh-in" not a millisecond.
export const bodyMetrics = pgTable("body_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  recordedOn: date("recorded_on").notNull(),
  weight: doublePrecision("weight"),       // kg
  bodyFat: doublePrecision("body_fat"),    // %
  // Circumferences (cm). All optional — clients log what they measured.
  neck: doublePrecision("neck"),
  shoulders: doublePrecision("shoulders"),
  chest: doublePrecision("chest"),
  arms: doublePrecision("arms"),
  waist: doublePrecision("waist"),
  hips: doublePrecision("hips"),
  thighs: doublePrecision("thighs"),
  calves: doublePrecision("calves"),
  notes: text("notes"),
  loggedByUserId: integer("logged_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

const optionalPositive = z.number().positive().max(1000).nullish();
const optionalPercent = z.number().min(0).max(100).nullish();

export const insertBodyMetricSchema = createInsertSchema(bodyMetrics)
  .omit({ id: true, createdAt: true, updatedAt: true, loggedByUserId: true })
  .extend({
    userId: z.number().int().positive(),
    recordedOn: z.string().min(1, "Date is required"),
    weight: optionalPositive,
    bodyFat: optionalPercent,
    neck: optionalPositive,
    shoulders: optionalPositive,
    chest: optionalPositive,
    arms: optionalPositive,
    waist: optionalPositive,
    hips: optionalPositive,
    thighs: optionalPositive,
    calves: optionalPositive,
    notes: z.string().max(2000).nullish(),
  });
export const updateBodyMetricSchema = createInsertSchema(bodyMetrics)
  .omit({ id: true, createdAt: true, updatedAt: true, loggedByUserId: true, userId: true })
  .extend({
    recordedOn: z.string().min(1).optional(),
    weight: optionalPositive,
    bodyFat: optionalPercent,
    neck: optionalPositive,
    shoulders: optionalPositive,
    chest: optionalPositive,
    arms: optionalPositive,
    waist: optionalPositive,
    hips: optionalPositive,
    thighs: optionalPositive,
    calves: optionalPositive,
    notes: z.string().max(2000).nullish(),
  })
  .partial();
export type BodyMetric = typeof bodyMetrics.$inferSelect;
export type InsertBodyMetric = z.infer<typeof insertBodyMetricSchema>;
export type UpdateBodyMetric = z.infer<typeof updateBodyMetricSchema>;

// The tracked numeric fields, in display order. Re-exported so the UI
// and chart code can iterate without re-listing them and drifting.
export const BODY_METRIC_FIELDS = [
  "weight", "bodyFat",
  "neck", "shoulders", "chest", "arms",
  "waist", "hips", "thighs", "calves",
] as const;
export type BodyMetricField = (typeof BODY_METRIC_FIELDS)[number];

// =============================
// WEEKLY CHECK-INS (P4b — Adherence + Retention)
// =============================
// One row per (userId, weekStart). `weekStart` is the Monday of the
// reporting week (date, not timestamp). Numeric self-reported scales
// are 1..10 (sleep/energy/stress/hunger/digestion/mood). Adherence
// percentages are 0..100. The client owns submission + editing of
// their row; admin can read every row and append `coachResponse`.
export const weeklyCheckins = pgTable("weekly_checkins", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  weekStart: date("week_start").notNull(),
  weight: doublePrecision("weight"),                    // kg, optional
  sleepQuality: integer("sleep_quality"),               // 1..10
  energy: integer("energy"),                            // 1..10
  stress: integer("stress"),                            // 1..10 (high = bad)
  hunger: integer("hunger"),                            // 1..10
  digestion: integer("digestion"),                      // 1..10
  mood: integer("mood"),                                // 1..10
  cardioAdherence: integer("cardio_adherence"),         // 0..100 %
  trainingAdherence: integer("training_adherence"),     // 0..100 %
  waterLitres: doublePrecision("water_litres"),         // litres/day avg
  notes: text("notes"),                                 // client-authored
  coachResponse: text("coach_response"),                // admin-authored
  coachRespondedAt: timestamp("coach_responded_at"),
  coachRespondedByUserId: integer("coach_responded_by_user_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => ({
  userWeekUnique: uniqueIndex("weekly_checkins_user_week_uniq").on(t.userId, t.weekStart),
}));

const scale1to10 = z.number().int().min(1).max(10).nullish();
const pct0to100 = z.number().int().min(0).max(100).nullish();

export const insertWeeklyCheckinSchema = createInsertSchema(weeklyCheckins)
  .omit({
    id: true,
    createdAt: true,
    updatedAt: true,
    coachResponse: true,
    coachRespondedAt: true,
    coachRespondedByUserId: true,
  })
  .extend({
    userId: z.number().int().positive(),
    weekStart: z.string().min(1, "Week start is required"),
    weight: z.number().positive().max(500).nullish(),
    sleepQuality: scale1to10,
    energy: scale1to10,
    stress: scale1to10,
    hunger: scale1to10,
    digestion: scale1to10,
    mood: scale1to10,
    cardioAdherence: pct0to100,
    trainingAdherence: pct0to100,
    waterLitres: z.number().min(0).max(20).nullish(),
    notes: z.string().max(4000).nullish(),
  });

export const updateWeeklyCheckinSchema = createInsertSchema(weeklyCheckins)
  .omit({
    id: true,
    userId: true,
    weekStart: true,
    createdAt: true,
    updatedAt: true,
    coachRespondedAt: true,
    coachRespondedByUserId: true,
  })
  .extend({
    weight: z.number().positive().max(500).nullish(),
    sleepQuality: scale1to10,
    energy: scale1to10,
    stress: scale1to10,
    hunger: scale1to10,
    digestion: scale1to10,
    mood: scale1to10,
    cardioAdherence: pct0to100,
    trainingAdherence: pct0to100,
    waterLitres: z.number().min(0).max(20).nullish(),
    notes: z.string().max(4000).nullish(),
    coachResponse: z.string().max(4000).nullish(),
  })
  .partial();

export type WeeklyCheckin = typeof weeklyCheckins.$inferSelect;
export type InsertWeeklyCheckin = z.infer<typeof insertWeeklyCheckinSchema>;
export type UpdateWeeklyCheckin = z.infer<typeof updateWeeklyCheckinSchema>;

export const WEEKLY_CHECKIN_SCALE_FIELDS = [
  "sleepQuality", "energy", "stress", "hunger", "digestion", "mood",
] as const;
export type WeeklyCheckinScaleField = (typeof WEEKLY_CHECKIN_SCALE_FIELDS)[number];

// Apply-stack body: snapshot all items of a stack onto a client.
export const applyStackToClientSchema = z.object({
  userId: z.number().int().positive(),
  stackId: z.number().int().positive(),
  // Replace existing client supplements (default: append).
  replace: z.boolean().optional(),
  // Optional override start date for every newly-created assignment.
  startDate: z.string().nullish(),
});
export type ApplyStackToClientInput = z.infer<typeof applyStackToClientSchema>;
