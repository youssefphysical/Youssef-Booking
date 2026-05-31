import { db, pool } from "./db";
import {
  users,
  bookings,
  settings,
  blockedSlots,
  packages,
  packageTemplates,
  inbodyRecords,
  progressPhotos,
  consentRecords,
  heroImages,
  transformations,
  adminNotifications,
  clientNotifications,
  renewalRequests,
  extensionRequests,
  packageSessionHistory,
  foods,
  meals,
  mealItems,
  nutritionPlans,
  nutritionPlanDays,
  nutritionPlanMeals,
  nutritionPlanMealItems,
  supplements,
  supplementStacks,
  supplementStackItems,
  clientSupplements,
  bodyMetrics,
  weeklyCheckins,
  userBadges,
  type UserBadge,
  type WeeklyCheckin,
  type InsertWeeklyCheckin,
  type UpdateWeeklyCheckin,
  dailyCheckins,
  type DailyCheckin,
  type InsertDailyCheckin,
  type BodyMetric,
  type InsertBodyMetric,
  type UpdateBodyMetric,
  type Food,
  type InsertFood,
  type UpdateFood,
  type Meal,
  type MealItem,
  type MealItemInput,
  type InsertMeal,
  type UpdateMeal,
  type MealWithItems,
  type NutritionPlan,
  type InsertNutritionPlan,
  type UpdateNutritionPlan,
  type PlanDayInput,
  type NutritionPlanFull,
  type User,
  type InsertUser,
  type UpdateProfile,
  type Booking,
  type InsertBooking,
  type Settings,
  type UpdateSettings,
  type BlockedSlot,
  type InsertBlockedSlot,
  type Package,
  type InsertPackage,
  type UpdatePackage,
  type PackageTemplate,
  type InsertPackageTemplate,
  type UpdatePackageTemplate,
  type InbodyRecord,
  type InsertInbody,
  type UpdateInbody,
  type ProgressPhoto,
  type InsertProgressPhoto,
  type ConsentRecord,
  type InsertConsent,
  type HeroImage,
  type InsertHeroImage,
  type UpdateHeroImage,
  type Transformation,
  type InsertTransformation,
  type UpdateTransformation,
  type AdminNotification,
  type InsertAdminNotification,
  type ClientNotification,
  type InsertClientNotification,
  type RenewalRequest,
  type InsertRenewalRequest,
  type ExtensionRequest,
  type InsertExtensionRequest,
  type PackageSessionHistory,
  type InsertPackageSessionHistory,
  type Supplement,
  type InsertSupplement,
  type UpdateSupplement,
  type SupplementStack,
  type SupplementStackItem,
  type SupplementStackFull,
  type InsertSupplementStack,
  type UpdateSupplementStack,
  type ClientSupplement,
  type InsertClientSupplement,
  type UpdateClientSupplement,
  type ApplyStackToClientInput,
  type StackItemInput,
  // Task #27 foundation
  adminAuditLog,
  featureFlags,
  trainingLocations,
  agreements,
  recoveryRequests,
  FEATURE_FLAG_DEFAULTS,
  type AdminAuditLogEntry,
  type InsertAdminAuditLogEntry,
  type FeatureFlag,
  type TrainingLocation,
  type Agreement,
  type InsertAgreement,
  type RecoveryRequest,
  type InsertRecoveryRequest,
  type UpdateRecoveryRequest,
  // Task #43 — Admin Control Panel
  adminTasks,
  clientTags,
  adminNotificationPrefs,
  adminSavedFilters,
  trainerAssignments,
  type AdminTask,
  type InsertAdminTask,
  type UpdateAdminTask,
  type ClientTag,
  type InsertClientTag,
  type AdminSavedFilter,
  type InsertSavedFilter,
  type TrainerAssignment,
  // Task #55 — Waitlist
  waitlists,
  type Waitlist,
  type InsertWaitlist,
  // Task #111 — Payments
  payments,
  type Payment,
  type InsertPayment,
} from "@shared/schema";
import { eq, and, or, gte, lte, gt, desc, asc, isNull, inArray, notInArray, ilike, sql, getTableColumns } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByPasswordResetToken(tokenHash: string): Promise<User | undefined>;
  consumePasswordResetToken(
    tokenHash: string,
    newPasswordHash: string,
  ): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  deleteUser(id: number): Promise<void>;
  getAllClients(): Promise<User[]>;
  getAllClientsLight(): Promise<Omit<User, 'profilePictureUrl' | 'password' | 'passwordResetToken' | 'passwordResetExpires'>[]>;
  /**
   * Client Data Center dataset — one denormalised row per client with
   * latest active package, default training location, nutrition flag,
   * recovery counts, and last completed session. Admin-only.
   */
  getClientDataCenter(): Promise<Array<Record<string, any>>>;
  /**
   * Management & Analysis Center — aggregated KPIs across clients,
   * packages, bookings, nutrition, recovery, and leads, plus a coach
   * action list. All sub-queries run in parallel against indexed
   * aggregates; no full-table scans. Admin-only.
   */
  getManagementAnalysis(): Promise<Record<string, any>>;
  getAllAdmins(): Promise<User[]>;
  /**
   * Federated admin search across users (clients), bookings, packages,
   * nutrition plans, and supplement stacks. Used by the Cmd+K palette.
   * Each category capped at `perCategory` rows. Pattern is wrapped in
   * `%…%` for ILIKE — caller passes the raw query.
   */
  searchAdmin(q: string, perCategory?: number): Promise<{
    clients: User[];
    bookings: Booking[];
    packages: Package[];
  }>;
  /**
   * Client-focused search used by the Client Search Center.
   * Returns up to `limit` clients matching name/phone/email/username
   * OR whose package name matches, each enriched with their latest
   * package summary. Name matches rank before package matches.
   */
  searchClients(q: string, limit?: number): Promise<Array<{
    id: number;
    fullName: string;
    email: string | null;
    phone: string | null;
    clientStatus: string | null;
    vipTier: string | null;
    pkgName: string | null;
    pkgTotal: number | null;
    pkgUsed: number | null;
    pkgStatus: string | null;
  }>>;
  /**
   * Batched lookup for the verified-badge flag. Returns a Map keyed by userId
   * so callers can enrich a list of users without N+1 queries.
   */
  getVerificationFlagsForUsers(
    userIds: number[],
  ): Promise<Map<number, { hasInbody: boolean; hasCompletedSession: boolean }>>;
  /**
   * Batched health-signal lookup. Single-query-per-signal aggregation
   * (max date, count last 30d, active-package flags) so the admin client
   * list stays O(1) in DB queries regardless of N. Returned signals are
   * fed into `computeClientHealth(s)` to derive the per-client badge.
   */
  getHealthSignalsForUsers(
    userIds: number[],
  ): Promise<
    Map<
      number,
      {
        lastCompletedDate: string | null;
        lastCheckinWeek: string | null;
        lastBodyMetricDate: string | null;
        noShows30d: number;
        completed30d: number;
        hasActivePackage: boolean;
        activePackageFrozen: boolean;
      }
    >
  >;

  /**
   * OI2 — gather all data needed by `computeClientIntelligence` for a single
   * client. 5 lightweight bounded queries (60-day booking window, 12 latest
   * check-ins, 5 latest body metrics, active package, pending requests count).
   */
  getClientIntelligenceData(userId: number): Promise<{
    activePackage:
      | {
          totalSessions: number | null;
          usedSessions: number | null;
          expiryDate: string | null;
          frozen: boolean;
          paymentStatus: string | null;
        }
      | null;
    bookings: Array<{
      id: number;
      date: string;
      timeSlot: string | null;
      status: string;
      coachNotesUpdatedAt: Date | null;
    }>;
    checkins: Array<{ id: number; weekStart: string }>;
    bodyMetrics: Array<{
      id: number;
      recordedOn: string;
      weight: number | null;
      bodyFat: number | null;
    }>;
    pendingRenewalCount: number;
    pendingExtensionCount: number;
  }>;

  // Bookings
  getBookings(filters?: {
    userId?: number;
    from?: string;
    orLinkedPartnerUserId?: number;
  }): Promise<Booking[]>;
  // Counts the number of DISTINCT active duo PACKAGES (not bookings)
  // where the user is currently linked as a partner, EXCLUDING the
  // package the new link would belong to. Used by the admin link
  // endpoint so a partner can be linked to multiple bookings under the
  // SAME package without a conflict, but linking them to bookings
  // across DIFFERENT packages requires `override:true`.
  countActiveLinkedDuoPackagesExcept(
    userId: number,
    excludePackageId: number | null,
  ): Promise<number>;
  getBooking(id: number): Promise<Booking | undefined>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, updates: Partial<Booking>): Promise<Booking>;
  deleteBooking(id: number): Promise<void>;
  getBookingByDateAndSlot(date: string, timeSlot: string): Promise<Booking | undefined>;

  // Settings
  getSettings(): Promise<Settings>;
  updateSettings(updates: UpdateSettings): Promise<Settings>;

  // Blocked slots
  getBlockedSlots(): Promise<BlockedSlot[]>;
  createBlockedSlot(slot: InsertBlockedSlot): Promise<BlockedSlot>;
  deleteBlockedSlot(id: number): Promise<void>;

  // Hero images (homepage slider)
  getHeroImages(): Promise<HeroImage[]>;
  createHeroImage(image: InsertHeroImage): Promise<HeroImage>;
  updateHeroImage(id: number, updates: UpdateHeroImage): Promise<HeroImage | undefined>;
  updateHeroImageOrder(id: number, sortOrder: number): Promise<HeroImage>;
  deleteHeroImage(id: number): Promise<void>;

  // Transformations (before/after gallery)
  getTransformations(opts?: { activeOnly?: boolean }): Promise<Transformation[]>;
  getTransformation(id: number): Promise<Transformation | undefined>;
  createTransformation(t: InsertTransformation): Promise<Transformation>;
  updateTransformation(id: number, updates: UpdateTransformation): Promise<Transformation | undefined>;
  deleteTransformation(id: number): Promise<void>;

  // Packages
  getPackages(filters?: { userId?: number; activeOnly?: boolean }): Promise<Package[]>;
  // Returns the distinct OTHER-user ids that share a duo relationship with
  // `userId` — derived from BOTH directions of `packages.partnerUserId` and
  // `bookings.linkedPartnerUserId`. Each entry carries the set of sources
  // ("package" | "booking") so the UI can label provenance.
  getLinkedPartnerIds(userId: number): Promise<{ id: number; sources: ("package" | "booking")[] }[]>;
  // Task #9: same as getLinkedPartnerIds but scoped to *current* duo
  // relationships only — partners reachable via an active package or an
  // upcoming booking. Used by the client-facing /api/me/linked-partners
  // route so historical/expired/cancelled links don't leak back to the
  // user's dashboard.
  getActiveLinkedPartnerIds(userId: number): Promise<{ id: number; sources: ("package" | "booking")[] }[]>;
  getPackage(id: number): Promise<Package | undefined>;
  getActivePackageForUser(userId: number): Promise<Package | undefined>;
  createPackage(pkg: InsertPackage): Promise<Package>;
  updatePackage(id: number, updates: Partial<Package>): Promise<Package>;
  deletePackage(id: number): Promise<void>;
  incrementPackageUsage(id: number, by?: number): Promise<Package>;
  decrementPackageUsage(id: number, by?: number): Promise<Package>;

  // Package templates (admin-defined catalogue)
  getPackageTemplates(opts?: { activeOnly?: boolean }): Promise<PackageTemplate[]>;
  getPackageTemplate(id: number): Promise<PackageTemplate | undefined>;
  createPackageTemplate(t: InsertPackageTemplate): Promise<PackageTemplate>;
  updatePackageTemplate(id: number, updates: UpdatePackageTemplate): Promise<PackageTemplate>;
  deletePackageTemplate(id: number): Promise<void>;

  // InBody
  getInbodyRecords(filters?: { userId?: number }): Promise<InbodyRecord[]>;
  getInbodyRecord(id: number): Promise<InbodyRecord | undefined>;
  createInbodyRecord(record: InsertInbody): Promise<InbodyRecord>;
  updateInbodyRecord(id: number, updates: UpdateInbody): Promise<InbodyRecord>;
  deleteInbodyRecord(id: number): Promise<void>;

  // Progress photos
  getProgressPhotos(filters?: { userId?: number }): Promise<ProgressPhoto[]>;
  createProgressPhoto(photo: InsertProgressPhoto): Promise<ProgressPhoto>;
  deleteProgressPhoto(id: number): Promise<void>;

  // Consent records
  getConsentRecords(filters?: { userId?: number; consentType?: string }): Promise<ConsentRecord[]>;
  createConsentRecord(record: InsertConsent): Promise<ConsentRecord>;

  // Admin notifications (in-app trainer inbox)
  getAdminNotifications(filters?: { unreadOnly?: boolean; limit?: number }): Promise<AdminNotification[]>;
  getAdminUnreadCount(): Promise<number>;
  createAdminNotification(notif: InsertAdminNotification): Promise<AdminNotification>;
  markAdminNotificationRead(id: number): Promise<AdminNotification | undefined>;
  markAllAdminNotificationsRead(): Promise<void>;

  // Client-facing notifications (P5a)
  getClientNotifications(
    userId: number,
    filters?: { unreadOnly?: boolean; limit?: number },
  ): Promise<ClientNotification[]>;
  getClientUnreadNotificationCount(userId: number): Promise<number>;
  createClientNotification(notif: InsertClientNotification): Promise<ClientNotification>;
  createClientNotificationOnce(
    notif: InsertClientNotification,
  ): Promise<ClientNotification | null>;
  findClientNotificationByDedupeKey(
    userId: number,
    kind: string,
    dedupeKey: string,
  ): Promise<ClientNotification | undefined>;

  // Task #74 — user badges (streak / achievement system).
  getUserBadges(userId: number): Promise<UserBadge[]>;
  /** Returns the inserted row on first award, or null when (userId,badgeKey) already existed. Atomic via unique index. */
  awardUserBadge(userId: number, badgeKey: string): Promise<UserBadge | null>;
  markClientNotificationRead(id: number, userId: number): Promise<ClientNotification | undefined>;
  markAllClientNotificationsRead(userId: number): Promise<void>;

  // Waitlists (Task #55)
  getWaitlistEntriesForUser(userId: number): Promise<Waitlist[]>;
  getWaitlistEntriesForSlot(date: string, timeSlot: string): Promise<Waitlist[]>;
  createWaitlistEntry(entry: InsertWaitlist): Promise<Waitlist>;
  deleteWaitlistEntry(id: number, userId: number): Promise<boolean>;
  /**
   * Atomic claim — stamps `notified_at = now()` only if currently NULL.
   * Returns the row that was claimed, or undefined if another worker
   * already notified it. Safe under concurrent cancel-hook invocations.
   */
  claimWaitlistEntry(id: number): Promise<Waitlist | undefined>;
  /**
   * Lookup of users with hasUsedFreeTrial=true whose normalized
   * email/phone/fingerprint matches any of the supplied identifiers.
   * Used by the trial-abuse check.
   */
  findTrialUsersByIdentifiers(opts: {
    emailNormalized?: string | null;
    phoneNormalized?: string | null;
    deviceFingerprintHash?: string | null;
    excludeUserId?: number;
  }): Promise<User[]>;
  /**
   * Phase 5 — duplicate-account prevention. Returns the first active
   * (non-merged, non-archived) user matching either of the supplied
   * normalised identifiers, or undefined. Used by /api/auth/register
   * to catch evaded duplicates before write.
   */
  findActiveUserByNormalizedIdentifier(opts: {
    emailNormalized?: string | null;
    phoneNormalized?: string | null;
  }): Promise<User | undefined>;
  /**
   * Phase 5 — admin client-merge tool. Folds `loserId` into `winnerId`:
   * reassigns bookings, packages, body metrics, photos, check-ins,
   * notifications, agreements, consent records, session histories,
   * and waitlist entries; appends loser's notes onto winner; marks
   * loser row mergedIntoUserId=winnerId, mergedAt=now, isActive=false,
   * clientStatus='merged'. Idempotent on the row level — re-running with
   * the same pair is a no-op once mergedIntoUserId is already set.
   */
  mergeUsers(opts: {
    winnerId: number;
    loserId: number;
    performedByUserId: number;
  }): Promise<{
    winner: User;
    loser: User;
    tableReport: Array<{
      table: string;
      column: string;
      rowsMoved: number;
      status: "reassigned" | "skipped_missing_table";
      note?: string;
    }>;
    auditWarning?: string;
  }>;
  /**
   * Phase 5 — preview a pending merge by returning the number of rows
   * the loser owns in every dependent table. Admins use this in the
   * merge UI to see exactly what will move before clicking confirm.
   */
  getMergePreview(loserId: number): Promise<{
    counts: Record<string, number>;
    total: number;
  }>;

  // Renewal requests
  getRenewalRequests(filters?: { userId?: number; status?: string; limit?: number }): Promise<RenewalRequest[]>;
  getRenewalRequest(id: number): Promise<RenewalRequest | undefined>;
  createRenewalRequest(req: InsertRenewalRequest): Promise<RenewalRequest>;
  updateRenewalRequest(id: number, updates: Partial<RenewalRequest>): Promise<RenewalRequest>;

  // Extension requests
  getExtensionRequests(filters?: { userId?: number; status?: string; limit?: number }): Promise<ExtensionRequest[]>;
  getExtensionRequest(id: number): Promise<ExtensionRequest | undefined>;
  createExtensionRequest(req: InsertExtensionRequest): Promise<ExtensionRequest>;
  updateExtensionRequest(id: number, updates: Partial<ExtensionRequest>): Promise<ExtensionRequest>;

  // Attendance helper
  incrementUserNoShow(userId: number): Promise<void>;

  // ===== Task #27 — Foundation helpers =====
  // Audit log, feature flags, training locations, agreements.
  // Routes are NOT wired in task #27; the helpers are unit-callable
  // and consumed by the downstream tracks (#3 / #4).
  recordAuditLog(entry: InsertAdminAuditLogEntry): Promise<AdminAuditLogEntry>;
  getFeatureFlag(key: string): Promise<FeatureFlag | undefined>;
  isFeatureEnabled(key: string): Promise<boolean>;
  listFeatureFlags(): Promise<FeatureFlag[]>;
  setFeatureFlag(
    key: string,
    enabled: boolean,
    userId: number | null,
  ): Promise<FeatureFlag>;
  getUserTrainingLocations(userId: number): Promise<TrainingLocation[]>;
  getTrainingLocation(id: number): Promise<TrainingLocation | undefined>;
  createTrainingLocation(input: any): Promise<TrainingLocation>;
  updateTrainingLocation(id: number, patch: Partial<TrainingLocation>): Promise<TrainingLocation | undefined>;
  archiveTrainingLocation(id: number): Promise<void>;
  getPendingVerificationPackages(): Promise<Package[]>;
  getUserPendingVerificationPackages(userId: number): Promise<Package[]>;
  recordAgreement(input: InsertAgreement): Promise<Agreement>;
  getUserAgreements(userId: number): Promise<Agreement[]>;
  hasUserAcceptedAgreement(userId: number, agreementType: string, version: string): Promise<boolean>;

  // ===== Task #31 — Command Center / Lead Pipeline / Integrity =====
  getCommandCenterCounts(): Promise<{
    sessionsToday: number;
    pendingFitnessZoneVerifications: number;
    pendingNutritionRequests: number;
    pendingRecoveryRequests: number;
    expiringPackages: number;
    expiringNutritionPlans: number;
    frozenPackages: number;
    failedEmails: number;
    inactiveClients: number;
    leadsNeedingFollowUp: number;
    integrityWarnings: number;
  }>;
  getLeadPipeline(filters?: { leadStatus?: string; leadSource?: string }): Promise<User[]>;
  setLeadStatus(
    userId: number,
    nextStatus: string,
    adminId: number,
    options?: { manualOverride?: boolean; reason?: string },
  ): Promise<User | undefined>;
  setLeadStatusAuto(userId: number, nextStatus: string): Promise<void>;
  getIntegrityWarnings(): Promise<Array<{
    category: string;
    severity: "info" | "warning" | "critical";
    count: number;
    samples: Array<{ id: number; label: string; link: string }>;
    showAllLink?: string | null;
  }>>;
  markEmailAttempted(notificationId: number): Promise<void>;

  // ===== Task #30 — Recovery requests =====
  createRecoveryRequest(input: InsertRecoveryRequest & { userId: number }): Promise<RecoveryRequest>;
  getRecoveryRequest(id: number): Promise<RecoveryRequest | undefined>;
  listRecoveryRequestsForUser(userId: number): Promise<RecoveryRequest[]>;
  listRecoveryRequests(filters?: { status?: string }): Promise<RecoveryRequest[]>;
  updateRecoveryRequest(id: number, patch: UpdateRecoveryRequest): Promise<RecoveryRequest | undefined>;

  // ===== Nutrition OS — Phase 2: Food Library =====
  // Searchable + paginated catalogue. Designed for thousands of rows
  // (server-side filter + offset/limit). `created_by_user_id` is set by
  // the route handler from the authenticated admin and is intentionally
  // not part of the insert payload.
  getFoods(filters?: {
    search?: string;
    category?: string;
    isSupplement?: boolean;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Food[]; total: number }>;
  getFood(id: number): Promise<Food | undefined>;
  createFood(food: InsertFood, createdByUserId: number | null): Promise<Food>;
  updateFood(id: number, updates: UpdateFood): Promise<Food>;
  deleteFood(id: number): Promise<void>;
  duplicateFood(id: number, createdByUserId: number | null): Promise<Food | undefined>;

  // Meals (Nutrition OS — Phase 3)
  getMeals(filters?: {
    search?: string;
    category?: string;
    templateOnly?: boolean;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ items: Meal[]; total: number }>;
  getMeal(id: number): Promise<MealWithItems | undefined>;
  createMeal(
    meal: Omit<InsertMeal, "items">,
    items: MealItemInput[],
    createdByUserId: number | null,
  ): Promise<MealWithItems>;
  updateMeal(
    id: number,
    updates: Omit<UpdateMeal, "items">,
    items?: MealItemInput[],
  ): Promise<MealWithItems | undefined>;
  deleteMeal(id: number): Promise<void>;
  duplicateMeal(id: number, createdByUserId: number | null): Promise<MealWithItems | undefined>;

  // Nutrition Plans (Phase 4) — full plan tree with snapshots.
  getNutritionPlans(filters?: {
    userId?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ items: NutritionPlan[]; total: number }>;
  getNutritionPlan(id: number): Promise<NutritionPlanFull | undefined>;
  getActiveNutritionPlanForUser(userId: number): Promise<NutritionPlanFull | undefined>;
  createNutritionPlan(
    plan: Omit<InsertNutritionPlan, "days">,
    days: PlanDayInput[],
    createdByUserId: number | null,
  ): Promise<NutritionPlanFull>;
  updateNutritionPlan(
    id: number,
    updates: Omit<UpdateNutritionPlan, "days" | "userId">,
    days?: PlanDayInput[],
  ): Promise<NutritionPlanFull | undefined>;
  deleteNutritionPlan(id: number): Promise<void>;
  duplicateNutritionPlan(
    id: number,
    createdByUserId: number | null,
  ): Promise<NutritionPlanFull | undefined>;

  // Package session-history audit log
  getPackageSessionHistory(filters?: {
    userId?: number;
    packageId?: number;
    limit?: number;
  }): Promise<PackageSessionHistory[]>;
  createPackageSessionHistory(entry: InsertPackageSessionHistory): Promise<PackageSessionHistory>;

  // ===== Task #111 — Payments =====
  getPayments(filters?: {
    userId?: number;
    status?: string;
    method?: string;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<Array<Payment & { user: Pick<User, "id" | "fullName" | "email"> | null }>>;
  getPayment(id: number): Promise<Payment | undefined>;
  createPayment(input: InsertPayment): Promise<Payment>;
  updatePayment(id: number, updates: Partial<Payment>): Promise<Payment>;
  deletePayment(id: number): Promise<void>;
  getPaymentsSummary(): Promise<{
    totalReceived: number;
    totalPending: number;
    countThisMonth: number;
  }>;

  sessionStore: session.Store;
}

/**
 * Compute the lifecycle status of a package from its session usage and
 * expiry window. Pure helper — no DB access. Returns one of PACKAGE_STATUSES.
 *
 * Rules:
 * - usedSessions >= totalSessions  -> "completed"
 * - expiryDate < today             -> "expired"
 * - expiryDate within 7 days       -> "expiring_soon"
 * - otherwise                      -> "active"
 *
 * Packages without an expiryDate fall back to "active" until completed.
 */
export function computePackageStatus(pkg: Pick<Package, "totalSessions" | "usedSessions" | "expiryDate">): "active" | "expiring_soon" | "expired" | "completed" {
  if (typeof pkg.totalSessions === "number" && typeof pkg.usedSessions === "number" && pkg.usedSessions >= pkg.totalSessions) {
    return "completed";
  }
  if (pkg.expiryDate) {
    const todayStr = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const expStr = String(pkg.expiryDate).slice(0, 10);
    if (isFinite(new Date(expStr).getTime())) {
      const diffMs = new Date(`${expStr}T00:00:00Z`).getTime() - new Date(`${todayStr}T00:00:00Z`).getTime();
      const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      if (diffDays < 0) return "expired";
      if (diffDays <= 7) return "expiring_soon";
    }
  }
  return "active";
}

/** Returns true when a package can no longer be used to book new sessions. */
export function isPackageBlocking(pkg: Pick<Package, "totalSessions" | "usedSessions" | "expiryDate">): boolean {
  const s = computePackageStatus(pkg);
  return s === "expired" || s === "completed";
}

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;

  constructor() {
    this.sessionStore = new PostgresSessionStore({
      pool,
      // createTableIfMissing reads table.sql from the package dir, which
      // breaks when the server is bundled with esbuild (dist/index.cjs).
      // ensureSchema.ts creates the "session" table via raw DDL instead.
      createTableIfMissing: false,
    });
  }

  // ===== Users =====
  async getUser(id: number) {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }

  async getUserByUsername(username: string) {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    return u;
  }

  async getUserByEmail(email: string) {
    const [u] = await db.select().from(users).where(eq(users.email, email));
    return u;
  }

  async findActiveUserByNormalizedIdentifier(opts: {
    emailNormalized?: string | null;
    phoneNormalized?: string | null;
  }): Promise<User | undefined> {
    const ors: any[] = [];
    if (opts.emailNormalized) ors.push(eq(users.emailNormalized, opts.emailNormalized));
    if (opts.phoneNormalized) ors.push(eq(users.phoneNormalized, opts.phoneNormalized));
    if (ors.length === 0) return undefined;
    const [u] = await db
      .select()
      .from(users)
      .where(and(isNull(users.mergedIntoUserId), or(...ors)))
      .limit(1);
    return u;
  }

  async mergeUsers(opts: {
    winnerId: number;
    loserId: number;
    performedByUserId: number;
  }): Promise<{
    winner: User;
    loser: User;
    tableReport: Array<{
      table: string;
      column: string;
      rowsMoved: number;
      status: "reassigned" | "skipped_missing_table";
      note?: string;
    }>;
    auditWarning?: string;
  }> {
    const { winnerId, loserId, performedByUserId } = opts;
    if (winnerId === loserId) {
      throw new Error("Cannot merge a user into themselves");
    }
    const winner = await this.getUser(winnerId);
    const loser = await this.getUser(loserId);
    if (!winner) throw new Error("Winner user not found");
    if (!loser) throw new Error("Loser user not found");
    // Phase 5 review fix — defence-in-depth role check at the storage
    // layer. The admin UI filters to clients but a misuse of the API
    // (or a future caller) should not be able to merge admin/staff
    // accounts or fold a client into an admin. Both sides must be
    // clients; the winner must not itself already be merged.
    if (winner.role !== "client" || loser.role !== "client") {
      throw new Error("Merge is only allowed between two client accounts");
    }
    if (winner.mergedIntoUserId) {
      throw new Error("Winner account has itself been merged — pick the surviving account");
    }
    if (loser.mergedIntoUserId) {
      // Idempotent — already merged.
      return { winner, loser, tableReport: [] };
    }

    type ReassignReport = {
      table: string;
      column: string;
      rowsMoved: number;
      status: "reassigned" | "skipped_missing_table";
      note?: string;
    };
    const tableReport: ReassignReport[] = [];

    // Reassign every row referencing the loser's id via raw SQL so the
    // whole merge runs in one round-trip and stays correct even when
    // some optional tables are empty. UPDATE … WHERE user_id = $1 is a
    // no-op when the table has no matching rows.
    //
    // Task #66 — SAVEPOINT-wrapped reassigns. Previously a missing
    // optional table (e.g. package_verification_requests on a fresh
    // dev DB) raised SQLSTATE 42P01, which Postgres treats as a
    // transaction-level abort *before* our JS-level catch can run.
    // Every subsequent statement in the same transaction then returned
    // "current transaction is aborted, commands ignored until end of
    // transaction block" — completely blocking merges. Wrapping each
    // reassign in a SAVEPOINT lets us roll back just that one
    // statement and continue. We still re-throw on any non-missing
    // error so the *outer* transaction aborts and the loser is NEVER
    // marked merged with half their rows left behind.
    await db.transaction(async (tx) => {
      const reassign = async (table: string, col: string = "user_id") => {
        const sp = `sp_merge_${table.replace(/[^a-z0-9_]/gi, "_")}`;
        await tx.execute(sql.raw(`SAVEPOINT ${sp}`));
        try {
          const result: any = await tx.execute(
            sql.raw(
              `UPDATE "${table}" SET "${col}" = ${winnerId} WHERE "${col}" = ${loserId}`,
            ),
          );
          await tx.execute(sql.raw(`RELEASE SAVEPOINT ${sp}`));
          // Drizzle/pg returns rowCount on the underlying result. Be
          // tolerant of either shape (Neon serverless vs node-pg).
          const rows =
            Number(
              result?.rowCount ??
                result?.rows?.length ??
                (Array.isArray(result) ? result.length : 0),
            ) || 0;
          tableReport.push({
            table,
            column: col,
            rowsMoved: rows,
            status: "reassigned",
          });
          if (rows > 0) {
            console.log(
              `[mergeUsers] reassigned ${rows} row(s) in ${table}.${col} (loser=${loserId} → winner=${winnerId})`,
            );
          }
        } catch (e: any) {
          // Roll back ONLY this statement; the outer transaction
          // remains usable (this is exactly what SAVEPOINT is for).
          await tx.execute(sql.raw(`ROLLBACK TO SAVEPOINT ${sp}`));
          await tx.execute(sql.raw(`RELEASE SAVEPOINT ${sp}`));
          const code = e?.code || e?.cause?.code;
          const msg = String(e?.message || "");
          const isMissingTable =
            code === "42P01" || /relation .* does not exist/i.test(msg);
          if (isMissingTable) {
            console.warn(
              `[mergeUsers] reassign ${table}.${col} skipped — table not present in this DB`,
            );
            tableReport.push({
              table,
              column: col,
              rowsMoved: 0,
              status: "skipped_missing_table",
              note: msg,
            });
            return;
          }
          // Any other failure (unique violation, FK conflict, type
          // mismatch) is a real problem. Re-throw so the OUTER
          // transaction rolls back and the loser is NOT marked merged.
          // The admin sees the actual error in the route handler.
          console.error(
            `[mergeUsers] FATAL reassign error on ${table}.${col}:`,
            e,
          );
          throw new Error(
            `Merge aborted while reassigning ${table}.${col}: ${msg}`,
          );
        }
      };
      await reassign("bookings");
      await reassign("packages");
      await reassign("body_metrics");
      await reassign("progress_photos");
      await reassign("weekly_checkins");
      await reassign("client_notifications");
      await reassign("agreements");
      await reassign("consent_records");
      await reassign("package_session_history");
      await reassign("waitlists");
      await reassign("renewal_requests");
      await reassign("extension_requests");
      await reassign("training_locations");
      await reassign("package_verification_requests");
      await reassign("recovery_requests");
      // Phase 5 review fix: tags + adjacent client-scoped tables that
      // were missed in the first pass. Without these the loser's
      // taxonomy/segmentation history would silently vanish.
      await reassign("client_tags");
      await reassign("client_supplements");
      await reassign("inbody_records");

      // Append loser's notes onto winner so nothing is silently dropped.
      const mergedNotes = [winner.notes, loser.notes].filter(Boolean).join("\n\n--- merged from duplicate account ---\n\n") || null;
      const mergedAdminNotes = [winner.adminNotes, loser.adminNotes].filter(Boolean).join("\n\n--- merged from duplicate account ---\n\n") || null;

      await tx
        .update(users)
        .set({
          notes: mergedNotes,
          adminNotes: mergedAdminNotes,
          hasUsedFreeTrial: winner.hasUsedFreeTrial || loser.hasUsedFreeTrial,
          noShowCount: (winner.noShowCount ?? 0) + (loser.noShowCount ?? 0),
          updatedAt: new Date(),
        } as any)
        .where(eq(users.id, winnerId));

      // Phase 5 review fix — scramble the loser's unique identifiers so
      // the original email/phone/username are free to register again
      // (or be assigned to a different client) without tripping the
      // unique indexes on `users`. We preserve the original values in a
      // `merged_*` prefix for audit. createUser / registration paths
      // already ignore rows where `mergedIntoUserId IS NOT NULL`.
      const scrambleSuffix = `__merged_${loserId}_${Date.now()}`;
      const loserScrambled: Record<string, any> = {
        mergedIntoUserId: winnerId,
        mergedAt: new Date(),
        isActive: false,
        clientStatus: "merged",
        updatedAt: new Date(),
        username: `${loser.username ?? loser.email ?? "user"}${scrambleSuffix}`,
        email: loser.email ? `${loser.email}${scrambleSuffix}` : null,
      };
      if (loser.phone) loserScrambled.phone = `${loser.phone}${scrambleSuffix}`;
      if ((loser as any).emailNormalized) loserScrambled.emailNormalized = null;
      if ((loser as any).phoneNormalized) loserScrambled.phoneNormalized = null;

      await tx
        .update(users)
        .set(loserScrambled as any)
        .where(eq(users.id, loserId));
    });

    // Task #66 — audit log is part of the contract (requirement #3
    // "Keep audit logs intact"). If it fails AFTER a successful merge,
    // we cannot undo the merge, but we MUST NOT swallow the failure
    // silently. Surface a warning back to the caller so the admin
    // route can flag it in the UI and Youssef can investigate.
    let auditWarning: string | undefined;
    try {
      await this.recordAuditLog({
        action: "client.merge",
        entityType: "user",
        entityId: loserId,
        previousValue: {
          loserId,
          snapshot: {
            fullName: loser.fullName,
            email: loser.email,
            phone: loser.phone,
          },
        },
        newValue: {
          winnerId,
          mergedAt: new Date().toISOString(),
          tableReport,
        },
        performedByUserId,
        reason: `Merged loser #${loserId} into winner #${winnerId}`,
      });
      console.log(
        `[mergeUsers] complete — loser #${loserId} → winner #${winnerId}; ${tableReport.length} table(s) processed, ${tableReport.reduce((n, r) => n + r.rowsMoved, 0)} row(s) moved`,
      );
    } catch (e: any) {
      auditWarning = `Merge succeeded but audit log write failed: ${e?.message || e}`;
      console.error("[mergeUsers] AUDIT LOG FAILED:", e);
    }

    const fresh = await this.getUser(winnerId);
    const freshLoser = await this.getUser(loserId);
    return { winner: fresh!, loser: freshLoser!, tableReport, auditWarning };
  }

  async getMergePreview(loserId: number) {
    // Tables we reassign in mergeUsers — keep these in lockstep so the
    // preview total matches what actually moves. Friendly labels are
    // surfaced to the admin in the UI.
    const tables: Array<{ key: string; table: string; col?: string }> = [
      { key: "bookings", table: "bookings" },
      { key: "packages", table: "packages" },
      { key: "body_metrics", table: "body_metrics" },
      { key: "progress_photos", table: "progress_photos" },
      { key: "weekly_checkins", table: "weekly_checkins" },
      { key: "client_notifications", table: "client_notifications" },
      { key: "agreements", table: "agreements" },
      { key: "consent_records", table: "consent_records" },
      { key: "package_session_history", table: "package_session_history" },
      { key: "waitlists", table: "waitlists" },
      { key: "renewal_requests", table: "renewal_requests" },
      { key: "extension_requests", table: "extension_requests" },
      { key: "training_locations", table: "training_locations" },
      { key: "package_verification_requests", table: "package_verification_requests" },
      { key: "recovery_requests", table: "recovery_requests" },
      { key: "client_tags", table: "client_tags" },
      { key: "client_supplements", table: "client_supplements" },
      { key: "inbody_records", table: "inbody_records" },
    ];
    const counts: Record<string, number> = {};
    let total = 0;
    for (const t of tables) {
      try {
        const r: any = await db.execute(
          sql.raw(`SELECT COUNT(*)::int AS c FROM "${t.table}" WHERE "${t.col ?? "user_id"}" = ${loserId}`),
        );
        const row = Array.isArray(r) ? r[0] : r?.rows?.[0];
        const c = Number(row?.c ?? 0);
        counts[t.key] = c;
        total += c;
      } catch {
        counts[t.key] = 0;
      }
    }
    return { counts, total };
  }

  async getUserByPasswordResetToken(tokenHash: string) {
    const [u] = await db
      .select()
      .from(users)
      .where(eq(users.passwordResetToken, tokenHash));
    return u;
  }

  /**
   * Atomically consume a password reset token: sets the new password and
   * nulls the token+expiry only if the token is still valid (not expired
   * and not already consumed). Returns the affected user, or undefined if
   * the token was already used / expired — making the operation safe under
   * concurrent reset attempts.
   */
  async consumePasswordResetToken(tokenHash: string, newPasswordHash: string) {
    const [u] = await db
      .update(users)
      .set({
        password: newPasswordHash,
        passwordResetToken: null,
        passwordResetExpires: null,
      })
      .where(
        and(
          eq(users.passwordResetToken, tokenHash),
          gt(users.passwordResetExpires, new Date()),
        ),
      )
      .returning();
    return u;
  }

  async createUser(insertUser: InsertUser) {
    const [u] = await db.insert(users).values(insertUser).returning();
    return u;
  }

  async updateUser(id: number, updates: Partial<User>) {
    // Client Data Center: bump updated_at on every mutation so the admin
    // export reflects the last time this client record changed.
    const [u] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() } as Partial<User>)
      .where(eq(users.id, id))
      .returning();
    return u;
  }

  // ===========================================================
  // Client Data Center — single dataset used by the admin export
  // (`/api/admin/data-center`). Joins each client row to its most
  // recently purchased active package, default training location,
  // nutrition-plan flag, active recovery-request count, and the
  // last completed session. Single round-trip via raw SQL.
  // ===========================================================
  async getClientDataCenter(): Promise<Array<Record<string, any>>> {
    const sqlText = `
      SELECT
        u.id, u.full_name, u.phone, u.email, u.username,
        u.area, u.primary_goal, u.fitness_goal, u.training_goal, u.training_level,
        u.emergency_contact_name, u.emergency_contact_phone,
        u.injuries, u.medical_notes, u.notes,
        u.admin_notes, u.coach_notes, u.goal_notes, u.communication_notes,
        u.lead_source, u.lead_status, u.client_status, u.vip_tier,
        u.weekly_frequency, u.no_show_count, u.archived_at,
        u.created_at, u.updated_at,
        tl.label  AS tl_label,
        tl.kind   AS tl_kind,
        tl.gym_name AS tl_gym,
        tl.address  AS tl_address,
        tl.building_name AS tl_building,
        tl.room_number   AS tl_room,
        p.name        AS pkg_name,
        p.type        AS pkg_type,
        p.total_sessions AS pkg_total,
        p.used_sessions  AS pkg_used,
        p.start_date     AS pkg_start,
        p.expiry_date    AS pkg_expiry,
        p.status         AS pkg_status,
        p.is_active      AS pkg_is_active,
        p.frozen         AS pkg_frozen,
        EXISTS (
          SELECT 1 FROM nutrition_plans np
          WHERE np.user_id = u.id AND np.is_active = true
        ) AS has_nutrition,
        (
          SELECT COUNT(*)::int FROM recovery_requests rr
          WHERE rr.user_id = u.id AND rr.status IN ('pending','scheduled')
        ) AS recovery_active_count,
        (
          SELECT COUNT(*)::int FROM recovery_requests rr
          WHERE rr.user_id = u.id
        ) AS recovery_total_count,
        (
          SELECT MAX(b.completed_at) FROM bookings b
          WHERE b.user_id = u.id AND b.completed_at IS NOT NULL
        ) AS last_session_at
      FROM users u
      LEFT JOIN LATERAL (
        SELECT * FROM training_locations
        WHERE user_id = u.id AND archived_at IS NULL
        ORDER BY is_default DESC, created_at DESC
        LIMIT 1
      ) tl ON true
      LEFT JOIN LATERAL (
        SELECT * FROM packages
        WHERE user_id = u.id AND is_active = true
        ORDER BY purchased_at DESC NULLS LAST
        LIMIT 1
      ) p ON true
      WHERE u.role = 'client'
      ORDER BY u.created_at DESC NULLS LAST
    `;
    const result = await pool.query(sqlText);
    return result.rows;
  }

  async getAllClients() {
    return db
      .select()
      .from(users)
      .where(eq(users.role, "client"))
      .orderBy(desc(users.createdAt));
  }

  async getAllClientsLight() {
    const { profilePictureUrl: _pic, password: _pw, passwordResetToken: _tok, passwordResetExpires: _exp, ...lightCols } = getTableColumns(users);
    return db
      .select(lightCols)
      .from(users)
      .where(eq(users.role, "client"))
      .orderBy(desc(users.createdAt));
  }

  // ===========================================================
  // Management & Analysis Center — single entry point used by the
  // admin page at /admin/management-analysis. Runs ~10 lightweight
  // aggregated queries in parallel; no full-table loads. Every
  // sub-query is wrapped in try/catch so a missing column never
  // crashes the whole payload (the UI shows "no data" for that bucket).
  // ===========================================================
  async getManagementAnalysis(): Promise<Record<string, any>> {
    const safe = async <T>(p: Promise<T>, fallback: T): Promise<T> => {
      try {
        return await p;
      } catch (err) {
        console.warn("[management-analysis] sub-query failed", err);
        return fallback;
      }
    };
    const q = (text: string, params: any[] = []) => pool.query(text, params);

    // All time windows use Asia/Dubai (UTC+4, no DST) to match the
    // booking model.
    const TZ = "Asia/Dubai";

    const [
      execRow,
      clientsByStatusRows,
      clientsBySourceRows,
      clientsByLocationRows,
      clientsByGoalRows,
      recentRegisteredRows,
      recentActiveRows,
      noBookingsCountRow,
      packageRows,
      packageTypeRows,
      bookingRows,
      bookingHourRows,
      nutritionRows,
      recoveryRows,
      leadRows,
      leadSourceRows,
      actionsRows,
    ] = await Promise.all([
      // ---------- Executive overview ----------
      safe(
        q(
          `SELECT
             (SELECT COUNT(*) FROM users WHERE role='client')::int AS total_clients,
             (SELECT COUNT(*) FROM users WHERE role='client' AND client_status='active')::int AS active_clients,
             (SELECT COUNT(*) FROM users
                WHERE role='client'
                  AND created_at >= date_trunc('month', (now() AT TIME ZONE $1))
             )::int AS new_this_month,
             (SELECT COUNT(*) FROM users
                WHERE role='client'
                  AND client_status IN ('expired','cancelled','completed','incomplete')
             )::int AS inactive_clients,
             (SELECT COUNT(*) FROM bookings
                WHERE date = (now() AT TIME ZONE $1)::date
                  AND status IN ('upcoming','confirmed')
             )::int AS sessions_today,
             (SELECT COUNT(*) FROM bookings
                WHERE date >= date_trunc('week', (now() AT TIME ZONE $1))::date
                  AND date <  date_trunc('week', (now() AT TIME ZONE $1))::date + INTERVAL '7 days'
                  AND status IN ('upcoming','confirmed','completed')
             )::int AS sessions_this_week,
             (SELECT COUNT(*) FROM packages
                WHERE is_active=true
                  AND admin_approved=false
                  AND verification_attachments IS NOT NULL
             )::int AS pending_verifications,
             (SELECT COUNT(*) FROM packages
                WHERE is_active=true
                  AND expiry_date IS NOT NULL
                  AND expiry_date <= ((now() AT TIME ZONE $1)::date + INTERVAL '7 days')
                  AND expiry_date >= (now() AT TIME ZONE $1)::date
             )::int AS packages_expiring_soon,
             (SELECT COUNT(*) FROM nutrition_plans
                WHERE status='active'
                  AND review_date IS NOT NULL
                  AND review_date::date <= ((now() AT TIME ZONE $1)::date + INTERVAL '7 days')
                  AND review_date::date >= (now() AT TIME ZONE $1)::date
             )::int AS nutrition_expiring_soon,
             (SELECT COUNT(*) FROM recovery_requests WHERE status='pending')::int AS recovery_pending
          `,
          [TZ],
        ).then((r) => r.rows[0] ?? {}),
        {} as any,
      ),
      // ---------- Client breakdowns ----------
      safe(
        q(
          `SELECT COALESCE(client_status,'unknown') AS k, COUNT(*)::int AS c
             FROM users WHERE role='client'
             GROUP BY 1 ORDER BY c DESC`,
        ).then((r) => r.rows),
        [],
      ),
      safe(
        q(
          `SELECT COALESCE(NULLIF(lead_source,''),'unknown') AS k, COUNT(*)::int AS c
             FROM users WHERE role='client'
             GROUP BY 1 ORDER BY c DESC LIMIT 20`,
        ).then((r) => r.rows),
        [],
      ),
      safe(
        q(
          `SELECT COALESCE(tl.kind,'unassigned') AS k, COUNT(DISTINCT u.id)::int AS c
             FROM users u
             LEFT JOIN training_locations tl
               ON tl.user_id=u.id AND tl.is_default=true AND tl.archived_at IS NULL
            WHERE u.role='client'
            GROUP BY 1 ORDER BY c DESC LIMIT 20`,
        ).then((r) => r.rows),
        [],
      ),
      safe(
        q(
          `SELECT COALESCE(NULLIF(primary_goal,''), NULLIF(fitness_goal,''),'unspecified') AS k,
                  COUNT(*)::int AS c
             FROM users WHERE role='client'
             GROUP BY 1 ORDER BY c DESC LIMIT 20`,
        ).then((r) => r.rows),
        [],
      ),
      safe(
        q(
          `SELECT id, full_name, created_at, lead_source
             FROM users WHERE role='client'
             ORDER BY created_at DESC NULLS LAST LIMIT 10`,
        ).then((r) => r.rows),
        [],
      ),
      safe(
        q(
          `SELECT u.id, u.full_name, MAX(b.completed_at) AS last_at
             FROM users u
             JOIN bookings b ON b.user_id=u.id AND b.completed_at IS NOT NULL
            WHERE u.role='client'
            GROUP BY u.id, u.full_name
            ORDER BY last_at DESC NULLS LAST LIMIT 10`,
        ).then((r) => r.rows),
        [],
      ),
      safe(
        q(
          `SELECT COUNT(*)::int AS c FROM users u
             WHERE u.role='client'
               AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.user_id=u.id)`,
        ).then((r) => r.rows[0]?.c ?? 0),
        0,
      ),
      // ---------- Package management ----------
      safe(
        q(
          `SELECT
             (SELECT COUNT(*) FROM packages WHERE is_active=true)::int AS active_count,
             (SELECT COUNT(*) FROM packages
                WHERE is_active=true AND expiry_date IS NOT NULL
                  AND expiry_date >= (now() AT TIME ZONE $1)::date
                  AND expiry_date <= (now() AT TIME ZONE $1)::date + INTERVAL '7 days'
             )::int AS expiring_7d,
             (SELECT COUNT(*) FROM packages
                WHERE is_active=true AND expiry_date IS NOT NULL
                  AND expiry_date >  (now() AT TIME ZONE $1)::date + INTERVAL '7 days'
                  AND expiry_date <= (now() AT TIME ZONE $1)::date + INTERVAL '14 days'
             )::int AS expiring_14d,
             (SELECT COUNT(*) FROM packages WHERE frozen=true)::int AS frozen_count,
             (SELECT COUNT(*) FROM packages
                WHERE expiry_date IS NOT NULL
                  AND expiry_date < (now() AT TIME ZONE $1)::date
             )::int AS expired_count,
             (SELECT COUNT(*) FROM packages
                WHERE is_active=true
                  AND total_sessions IS NOT NULL
                  AND (total_sessions - COALESCE(used_sessions,0)) <= 3
                  AND (total_sessions - COALESCE(used_sessions,0)) > 0
             )::int AS low_remaining,
             (SELECT COALESCE(AVG(NULLIF(total_sessions,0) - COALESCE(used_sessions,0)),0)
                FROM packages WHERE is_active=true
             )::numeric(10,1) AS avg_remaining,
             (SELECT COUNT(*) FROM packages
                WHERE expiry_date IS NOT NULL
                  AND expiry_date < (now() AT TIME ZONE $1)::date
                  AND expiry_date >= (now() AT TIME ZONE $1)::date - INTERVAL '60 days'
             )::int AS renewal_opportunities
          `,
          [TZ],
        ).then((r) => r.rows[0] ?? {}),
        {} as any,
      ),
      safe(
        q(
          `SELECT COALESCE(NULLIF(type,''),'unknown') AS k, COUNT(*)::int AS c
             FROM packages WHERE is_active=true
             GROUP BY 1 ORDER BY c DESC LIMIT 20`,
        ).then((r) => r.rows),
        [],
      ),
      // ---------- Booking management ----------
      safe(
        q(
          `SELECT
             (SELECT COUNT(*) FROM bookings
                WHERE date = (now() AT TIME ZONE $1)::date
             )::int AS today_total,
             (SELECT COUNT(*) FROM bookings
                WHERE date >= date_trunc('week', (now() AT TIME ZONE $1))::date
                  AND date <  date_trunc('week', (now() AT TIME ZONE $1))::date + INTERVAL '7 days'
             )::int AS this_week,
             (SELECT COUNT(*) FROM bookings
                WHERE date >= date_trunc('month', (now() AT TIME ZONE $1))::date
                  AND date <  date_trunc('month', (now() AT TIME ZONE $1))::date + INTERVAL '1 month'
             )::int AS this_month,
             (SELECT COUNT(*) FROM bookings WHERE status='completed')::int AS completed_total,
             (SELECT COUNT(*) FROM bookings WHERE status='cancelled')::int AS cancelled_total,
             (SELECT COUNT(*) FROM bookings WHERE is_emergency_cancel=true)::int AS late_cancellations
          `,
          [TZ],
        ).then((r) => r.rows[0] ?? {}),
        {} as any,
      ),
      safe(
        q(
          `SELECT time_slot AS k, COUNT(*)::int AS c
             FROM bookings
            WHERE status IN ('completed','upcoming','confirmed')
              AND date >= (now() AT TIME ZONE $1)::date - INTERVAL '90 days'
              AND time_slot IS NOT NULL
            GROUP BY 1 ORDER BY c DESC LIMIT 24`,
          [TZ],
        ).then((r) => r.rows),
        [],
      ),
      // ---------- Nutrition ----------
      safe(
        q(
          `SELECT
             (SELECT COUNT(DISTINCT user_id) FROM nutrition_plans WHERE status='active')::int AS active_clients,
             (SELECT COUNT(*) FROM nutrition_plans WHERE status='active')::int AS active_plans,
             (SELECT COUNT(*) FROM nutrition_plans WHERE status='draft')::int AS draft_plans,
             (SELECT COUNT(*) FROM nutrition_plans
                WHERE status='active' AND review_date IS NOT NULL
                  AND review_date::date >= (now() AT TIME ZONE $1)::date
                  AND review_date::date <= (now() AT TIME ZONE $1)::date + INTERVAL '7 days'
             )::int AS expiring_7d,
             (SELECT COUNT(*) FROM nutrition_plans
                WHERE status='active' AND review_date IS NOT NULL
                  AND review_date::date >  (now() AT TIME ZONE $1)::date + INTERVAL '7 days'
                  AND review_date::date <= (now() AT TIME ZONE $1)::date + INTERVAL '14 days'
             )::int AS expiring_14d,
             (SELECT COUNT(*) FROM nutrition_plans
                WHERE status='active' AND review_date IS NOT NULL
                  AND review_date::date < (now() AT TIME ZONE $1)::date
             )::int AS renewal_opportunities,
             (SELECT COUNT(DISTINCT np.user_id) FROM nutrition_plans np
                WHERE np.status='active'
                  AND NOT EXISTS (
                    SELECT 1 FROM packages p
                     WHERE p.user_id=np.user_id AND p.is_active=true
                  )
             )::int AS nutrition_only
          `,
          [TZ],
        ).then((r) => r.rows[0] ?? {}),
        {} as any,
      ),
      // ---------- Recovery ----------
      safe(
        q(
          `SELECT
             (SELECT COUNT(*) FROM recovery_requests WHERE status='pending')::int AS pending,
             (SELECT COUNT(*) FROM recovery_requests WHERE status='scheduled')::int AS scheduled,
             (SELECT COUNT(DISTINCT user_id) FROM recovery_requests WHERE status IN ('pending','scheduled'))::int AS active_clients,
             (SELECT json_agg(t) FROM (
                SELECT service_type AS k, COUNT(*)::int AS c
                  FROM recovery_requests
                  WHERE status IN ('pending','scheduled')
                  GROUP BY 1 ORDER BY c DESC
             ) t) AS by_type
          `,
        ).then((r) => r.rows[0] ?? {}),
        {} as any,
      ),
      // ---------- Leads ----------
      safe(
        q(
          `SELECT
             (SELECT COUNT(*) FROM users WHERE role='client' AND lead_status='lead')::int AS new_leads,
             (SELECT COUNT(*) FROM users WHERE role='client' AND lead_status='trial_requested')::int AS trial_requested,
             (SELECT COUNT(*) FROM users WHERE role='client' AND lead_status='trial_completed')::int AS trial_completed,
             (SELECT COUNT(*) FROM users WHERE role='client' AND lead_status='package_verification_pending')::int AS pending_verification,
             (SELECT COUNT(*) FROM users WHERE role='client' AND lead_status IN ('lead','trial_requested','registered'))::int AS needing_action,
             (SELECT COUNT(*) FROM users u
                WHERE u.role='client'
                  AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.user_id=u.id)
             )::int AS registered_never_booked
          `,
        ).then((r) => r.rows[0] ?? {}),
        {} as any,
      ),
      safe(
        q(
          `SELECT
             COALESCE(NULLIF(u.lead_source,''),'unknown') AS k,
             COUNT(*)::int AS leads,
             COUNT(*) FILTER (WHERE EXISTS (SELECT 1 FROM packages p WHERE p.user_id=u.id))::int AS converted
            FROM users u
           WHERE u.role='client'
           GROUP BY 1
           ORDER BY leads DESC LIMIT 10`,
        ).then((r) => r.rows),
        [],
      ),
      // ---------- Coach action list ----------
      // Union of follow-up triggers, capped per category, ranked by priority.
      safe(
        q(
          `WITH
           expiring AS (
             SELECT u.id AS user_id, u.full_name,
                    'renew_package'::text AS kind,
                    'high'::text AS priority,
                    'Package' AS service,
                    'Expires ' || to_char(p.expiry_date,'YYYY-MM-DD') AS reason,
                    'Reach out for renewal' AS suggested
               FROM packages p JOIN users u ON u.id=p.user_id
              WHERE p.is_active=true
                AND p.expiry_date IS NOT NULL
                AND p.expiry_date >= (now() AT TIME ZONE $1)::date
                AND p.expiry_date <= (now() AT TIME ZONE $1)::date + INTERVAL '7 days'
              ORDER BY p.expiry_date ASC LIMIT 20
           ),
           verify AS (
             SELECT u.id AS user_id, u.full_name,
                    'verify_fitness_zone'::text AS kind,
                    'high'::text AS priority,
                    'Package' AS service,
                    'Fitness Zone package awaiting verification' AS reason,
                    'Open package and confirm' AS suggested
               FROM packages p JOIN users u ON u.id=p.user_id
              WHERE p.is_active=true
                AND p.admin_approved=false
                AND p.verification_attachments IS NOT NULL
              LIMIT 20
           ),
           recovery AS (
             SELECT u.id AS user_id, u.full_name,
                    'review_recovery'::text AS kind,
                    'medium'::text AS priority,
                    'Recovery' AS service,
                    'Recovery request pending' AS reason,
                    'Schedule or respond' AS suggested
               FROM recovery_requests r JOIN users u ON u.id=r.user_id
              WHERE r.status='pending'
              ORDER BY r.created_at ASC LIMIT 20
           ),
           leads AS (
             SELECT u.id AS user_id, u.full_name,
                    'follow_lead'::text AS kind,
                    'medium'::text AS priority,
                    'Lead' AS service,
                    'Lead status: ' || lead_status AS reason,
                    'Follow up via WhatsApp' AS suggested
               FROM users u
              WHERE u.role='client'
                AND lead_status IN ('lead','trial_requested','registered')
              ORDER BY u.created_at DESC LIMIT 20
           ),
           inactive AS (
             SELECT u.id AS user_id, u.full_name,
                    'reactivate_inactive'::text AS kind,
                    'low'::text AS priority,
                    'PT' AS service,
                    'Status: ' || COALESCE(u.client_status,'unknown') AS reason,
                    'Send reactivation message' AS suggested
               FROM users u
              WHERE u.role='client'
                AND u.client_status IN ('expired','cancelled','completed')
              LIMIT 15
           ),
           never_booked AS (
             SELECT u.id AS user_id, u.full_name,
                    'no_bookings'::text AS kind,
                    'medium'::text AS priority,
                    'PT' AS service,
                    'Registered but never booked' AS reason,
                    'Send booking nudge' AS suggested
               FROM users u
              WHERE u.role='client'
                AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.user_id=u.id)
                AND u.created_at >= (now() AT TIME ZONE $1) - INTERVAL '60 days'
              ORDER BY u.created_at DESC LIMIT 15
           ),
           nutri AS (
             SELECT np.user_id, u.full_name,
                    'contact_nutrition'::text AS kind,
                    'medium'::text AS priority,
                    'Nutrition' AS service,
                    'Nutrition review due ' || COALESCE(to_char(np.review_date::date,'YYYY-MM-DD'),'soon') AS reason,
                    'Check in on nutrition progress' AS suggested
               FROM nutrition_plans np JOIN users u ON u.id=np.user_id
              WHERE np.status='active'
                AND np.review_date IS NOT NULL
                AND np.review_date::date <= (now() AT TIME ZONE $1)::date + INTERVAL '7 days'
              LIMIT 15
           )
           SELECT * FROM expiring
           UNION ALL SELECT * FROM verify
           UNION ALL SELECT * FROM recovery
           UNION ALL SELECT * FROM leads
           UNION ALL SELECT * FROM inactive
           UNION ALL SELECT * FROM never_booked
           UNION ALL SELECT * FROM nutri`,
          [TZ],
        ).then((r) => r.rows),
        [],
      ),
    ]);

    return {
      generatedAt: new Date().toISOString(),
      executive: execRow,
      clients: {
        byStatus: clientsByStatusRows,
        bySource: clientsBySourceRows,
        byLocation: clientsByLocationRows,
        byGoal: clientsByGoalRows,
        recentRegistered: recentRegisteredRows,
        recentActive: recentActiveRows,
        noBookings: noBookingsCountRow,
      },
      packages: { ...packageRows, byType: packageTypeRows },
      bookings: { ...bookingRows, peakHours: bookingHourRows },
      nutrition: nutritionRows,
      recovery: { ...recoveryRows, byType: (recoveryRows as any)?.by_type ?? [] },
      leads: { ...leadRows, bySource: leadSourceRows },
      actions: actionsRows,
    };
  }

  async searchAdmin(q: string, perCategory: number = 5) {
    const trimmed = (q ?? "").trim();
    if (!trimmed) {
      return {
        clients: [],
        bookings: [],
        packages: [],
      };
    }
    const pat = `%${trimmed.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const limit = Math.min(Math.max(perCategory, 1), 20);

    const [clientsR, bookingsR, packagesR] = await Promise.all([
      db
        .select()
        .from(users)
        .where(
          and(
            eq(users.role, "client"),
            or(
              ilike(users.fullName, pat),
              ilike(users.email, pat),
              ilike(users.phone, pat),
              ilike(users.username, pat),
            ),
          ),
        )
        .orderBy(desc(users.createdAt))
        .limit(limit),
      db
        .select()
        .from(bookings)
        .where(
          or(
            sql`${bookings.date}::text ILIKE ${pat}`,
            ilike(bookings.timeSlot, pat),
            ilike(bookings.notes, pat),
            ilike(bookings.adminNotes, pat),
          ),
        )
        .orderBy(desc(bookings.date), desc(bookings.id))
        .limit(limit),
      db
        .select()
        .from(packages)
        .where(
          or(
            ilike(packages.name, pat),
            ilike(packages.type, pat),
            ilike(packages.notes, pat),
          ),
        )
        .orderBy(desc(packages.purchasedAt))
        .limit(limit),
    ]);
    return {
      clients: clientsR,
      bookings: bookingsR,
      packages: packagesR,
    };
  }

  async searchClients(q: string, limit = 8) {
    const trimmed = (q ?? "").trim();
    if (!trimmed) return [];
    const pat = `%${trimmed.replace(/[%_]/g, (m) => `\\${m}`)}%`;
    const cap = Math.min(Math.max(limit, 1), 20);

    const result = await pool.query<{
      id: number;
      full_name: string;
      email: string | null;
      phone: string | null;
      client_status: string | null;
      vip_tier: string | null;
      pkg_name: string | null;
      pkg_total: number | null;
      pkg_used: number | null;
      pkg_status: string | null;
    }>(`
      WITH matched AS (
        SELECT u.id, 0 AS boost
        FROM users u
        WHERE u.role = 'client'
          AND (
            u.full_name ILIKE $1
            OR u.email    ILIKE $1
            OR u.phone    ILIKE $1
            OR u.username ILIKE $1
          )
        UNION
        SELECT DISTINCT p.user_id AS id, 3 AS boost
        FROM packages p
        JOIN users u2 ON u2.id = p.user_id AND u2.role = 'client'
        WHERE p.name ILIKE $1
      ),
      deduped AS (
        SELECT id, MIN(boost) AS boost FROM matched GROUP BY id
      )
      SELECT
        u.id,
        u.full_name,
        u.email,
        u.phone,
        u.client_status,
        u.vip_tier,
        pkg.name            AS pkg_name,
        pkg.total_sessions  AS pkg_total,
        pkg.used_sessions   AS pkg_used,
        pkg.status          AS pkg_status
      FROM users u
      JOIN deduped d ON d.id = u.id
      LEFT JOIN LATERAL (
        SELECT name, total_sessions, used_sessions, status
        FROM packages
        WHERE user_id = u.id
        ORDER BY purchased_at DESC NULLS LAST
        LIMIT 1
      ) pkg ON true
      ORDER BY d.boost ASC, u.full_name ASC
      LIMIT $2
    `, [pat, cap]);

    return result.rows.map((r) => ({
      id: r.id,
      fullName: r.full_name,
      email: r.email,
      phone: r.phone,
      clientStatus: r.client_status,
      vipTier: r.vip_tier,
      pkgName: r.pkg_name,
      pkgTotal: r.pkg_total != null ? Number(r.pkg_total) : null,
      pkgUsed: r.pkg_used != null ? Number(r.pkg_used) : null,
      pkgStatus: r.pkg_status,
    }));
  }

  async getAllAdmins() {
    return db
      .select()
      .from(users)
      .where(eq(users.role, "admin"))
      .orderBy(asc(users.createdAt));
  }

  async deleteUser(id: number) {
    await db.delete(users).where(eq(users.id, id));
  }

  // ===== Bookings =====
  async getBookings(filters?: {
    userId?: number;
    from?: string;
    orLinkedPartnerUserId?: number;
  }) {
    const conds: any[] = [];
    // Identity filter. If `orLinkedPartnerUserId` is set together with
    // `userId`, return bookings where the user is EITHER the primary
    // owner OR a linked duo partner — used by the client GET /api/bookings
    // so a linked partner can see their duo bookings read-only.
    if (filters?.userId && filters.orLinkedPartnerUserId === filters.userId) {
      conds.push(
        or(
          eq(bookings.userId, filters.userId),
          eq(bookings.linkedPartnerUserId, filters.userId),
        )!,
      );
    } else if (filters?.userId) {
      conds.push(eq(bookings.userId, filters.userId));
    }
    if (filters?.from) conds.push(gte(bookings.date, filters.from));
    const q =
      conds.length > 0
        ? db.select().from(bookings).where(and(...conds))
        : db.select().from(bookings);
    return q.orderBy(asc(bookings.date), asc(bookings.timeSlot));
  }

  async countActiveLinkedDuoPackagesExcept(
    userId: number,
    excludePackageId: number | null,
  ): Promise<number> {
    // "Active" = not in any cancelled/completed terminal state. Mirrors
    // the same set used by the slot-availability filter elsewhere.
    // We count DISTINCT packageIds so multiple duo bookings under the
    // same package count as one conflict.
    const rows = await db
      .select({ packageId: bookings.packageId })
      .from(bookings)
      .where(
        and(
          eq(bookings.linkedPartnerUserId, userId),
          eq(bookings.sessionType, "duo"),
          notInArray(bookings.status, [
            "cancelled",
            "free_cancelled",
            "late_cancelled",
            "emergency_cancelled",
            "completed",
            "no_show",
          ]),
        ),
      );
    const distinct = new Set<number>();
    for (const r of rows) {
      if (typeof r.packageId === "number" && r.packageId !== excludePackageId) {
        distinct.add(r.packageId);
      }
    }
    return distinct.size;
  }

  async getBooking(id: number) {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
    return b;
  }

  async createBooking(booking: InsertBooking) {
    try {
      const [b] = await db.insert(bookings).values(booking).returning();
      return b;
    } catch (err: any) {
      // Postgres 23505 = unique_violation. Fired by the partial unique
      // index uniq_booking_active_slot when two clients race for the
      // same slot. Re-throw a tagged error so the route translates it
      // into the user-facing 409 message without leaking SQL details.
      if (err?.code === "23505" && /uniq_booking_active_slot/.test(String(err?.constraint || err?.detail || ""))) {
        const e: any = new Error("This slot was just booked. Please choose another time.");
        e.code = "SLOT_TAKEN";
        e.status = 409;
        throw e;
      }
      throw err;
    }
  }

  // Task #29: atomic booking insert that re-reads the linked package with
  // SELECT … FOR UPDATE so two simultaneous clients sharing one package
  // can't both pass the remaining-sessions check. `checkPackageRule` is the
  // rule layer's `canBookFromPackage` — the storage layer is rule-agnostic,
  // but it accepts the callback so the lock window covers BOTH the
  // remaining-balance recheck AND the slot insert.
  async createBookingWithPackageLock(
    booking: InsertBooking,
    opts: {
      packageId: number | null;
      checkPackageRule?: (pkg: Package) => { ok: true } | { ok: false; code: string; message: string };
    },
  ) {
    return db.transaction(async (tx) => {
      if (opts.packageId) {
        const locked = await tx.execute(
          sql`SELECT * FROM packages WHERE id = ${opts.packageId} FOR UPDATE`,
        );
        const row = (locked as any).rows?.[0];
        if (!row) {
          const e: any = new Error("Package not found.");
          e.code = "PACKAGE_NOT_FOUND";
          e.status = 404;
          throw e;
        }
        // Reshape DB snake_case row into the Package camelCase shape the
        // rule layer expects. We only need fields used by canBookFromPackage.
        const pkg: any = {
          id: row.id,
          userId: row.user_id,
          totalSessions: row.total_sessions,
          usedSessions: row.used_sessions,
          isActive: row.is_active,
          frozen: row.frozen,
          status: row.status,
          expiryDate: row.expiry_date,
        };
        if (opts.checkPackageRule) {
          const verdict = opts.checkPackageRule(pkg as Package);
          if (!verdict.ok) {
            const e: any = new Error(verdict.message);
            e.code = "RULE_BLOCKED";
            e.ruleCode = verdict.code;
            e.status = 400;
            throw e;
          }
        }
      }
      try {
        const [b] = await tx.insert(bookings).values(booking).returning();
        return b;
      } catch (err: any) {
        if (err?.code === "23505" && /uniq_booking_active_slot/.test(String(err?.constraint || err?.detail || ""))) {
          const e: any = new Error("This slot was just booked. Please choose another time.");
          e.code = "SLOT_TAKEN";
          e.status = 409;
          throw e;
        }
        throw err;
      }
    });
  }

  async updateBooking(id: number, updates: Partial<Booking>) {
    const [b] = await db.update(bookings).set(updates).where(eq(bookings.id, id)).returning();
    return b;
  }

  async deleteBooking(id: number) {
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  async getBookingByDateAndSlot(date: string, timeSlot: string) {
    // Filter cancelled-state rows so the slot precheck matches the partial
    // UNIQUE INDEX (`uniq_booking_active_slot`). Without this, a freshly
    // cancelled slot is reported as "already booked" even though the DB
    // would happily accept a re-book — the friendly precheck would fire
    // before the index ever got asked.
    const [b] = await db
      .select()
      .from(bookings)
      .where(
        and(
          eq(bookings.date, date),
          eq(bookings.timeSlot, timeSlot),
          notInArray(bookings.status, [
            "cancelled",
            "free_cancelled",
            "late_cancelled",
            "emergency_cancelled",
          ]),
        ),
      );
    return b;
  }

  // ===== Settings =====
  async getSettings() {
    const [s] = await db.select().from(settings).limit(1);
    if (s) return s;
    const [created] = await db.insert(settings).values({}).returning();
    return created;
  }

  async updateSettings(updates: UpdateSettings) {
    const current = await this.getSettings();
    // Deep-merge JSONB fields so a partial-section save (e.g. only CTA keys)
    // never silently erases keys written by a previous save (e.g. Services keys).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const merged: any = { ...updates };
    if (updates.contentSettings !== undefined) {
      merged.contentSettings = {
        ...((current.contentSettings as Record<string, string>) ?? {}),
        ...updates.contentSettings,
      };
    }
    const [updated] = await db
      .update(settings)
      .set(merged)
      .where(eq(settings.id, current.id))
      .returning();
    return updated;
  }

  // ===== Blocked Slots =====
  async getBlockedSlots() {
    return db.select().from(blockedSlots).orderBy(asc(blockedSlots.date));
  }

  async createBlockedSlot(slot: InsertBlockedSlot) {
    const [b] = await db.insert(blockedSlots).values(slot).returning();
    return b;
  }

  async deleteBlockedSlot(id: number) {
    await db.delete(blockedSlots).where(eq(blockedSlots.id, id));
  }

  // ===== Hero Images =====
  async getHeroImages() {
    return db
      .select()
      .from(heroImages)
      .orderBy(asc(heroImages.sortOrder), asc(heroImages.id));
  }

  async createHeroImage(image: InsertHeroImage) {
    const [created] = await db.insert(heroImages).values(image).returning();
    return created;
  }

  async updateHeroImageOrder(id: number, sortOrder: number) {
    const [updated] = await db
      .update(heroImages)
      .set({ sortOrder })
      .where(eq(heroImages.id, id))
      .returning();
    return updated;
  }

  async updateHeroImage(id: number, updates: UpdateHeroImage) {
    // Strip undefined so we never overwrite a column to NULL by accident
    // when the caller only PATCHes a subset of fields.
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    if (Object.keys(clean).length === 0) {
      const [row] = await db.select().from(heroImages).where(eq(heroImages.id, id));
      return row;
    }
    const [updated] = await db
      .update(heroImages)
      .set(clean as any)
      .where(eq(heroImages.id, id))
      .returning();
    return updated;
  }

  async deleteHeroImage(id: number) {
    await db.delete(heroImages).where(eq(heroImages.id, id));
  }

  // ===== Transformations =====
  async getTransformations(opts: { activeOnly?: boolean } = {}) {
    const q = opts.activeOnly
      ? db.select().from(transformations).where(eq(transformations.isActive, true))
      : db.select().from(transformations);
    return q.orderBy(asc(transformations.sortOrder), asc(transformations.id));
  }

  async getTransformation(id: number) {
    const [row] = await db.select().from(transformations).where(eq(transformations.id, id));
    return row;
  }

  async createTransformation(t: InsertTransformation) {
    const [created] = await db.insert(transformations).values(t).returning();
    return created;
  }

  async updateTransformation(id: number, updates: UpdateTransformation) {
    const clean: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(updates)) {
      if (v !== undefined) clean[k] = v;
    }
    if (Object.keys(clean).length === 0) {
      return this.getTransformation(id);
    }
    const [updated] = await db
      .update(transformations)
      .set(clean as any)
      .where(eq(transformations.id, id))
      .returning();
    return updated;
  }

  async deleteTransformation(id: number) {
    await db.delete(transformations).where(eq(transformations.id, id));
  }

  // ===== Packages =====
  async getPackages(filters?: { userId?: number; activeOnly?: boolean }) {
    const conds: any[] = [];
    if (filters?.userId) conds.push(eq(packages.userId, filters.userId));
    if (filters?.activeOnly) conds.push(eq(packages.isActive, true));
    const q =
      conds.length > 0
        ? db.select().from(packages).where(and(...conds))
        : db.select().from(packages);
    return q.orderBy(desc(packages.purchasedAt));
  }

  async getPackage(id: number) {
    const [p] = await db.select().from(packages).where(eq(packages.id, id));
    return p;
  }

  async getLinkedPartnerIds(userId: number) {
    // Pull both forward (this user is primary) and reverse (this user is the
    // partner) rows in a single query per table. We deliberately keep this
    // narrow — only the id columns we need to derive the relationship.
    const pkgRows = await db
      .select({ userId: packages.userId, partnerUserId: packages.partnerUserId })
      .from(packages)
      .where(or(eq(packages.userId, userId), eq(packages.partnerUserId, userId))!);
    const bkRows = await db
      .select({ userId: bookings.userId, linkedPartnerUserId: bookings.linkedPartnerUserId })
      .from(bookings)
      .where(or(eq(bookings.userId, userId), eq(bookings.linkedPartnerUserId, userId))!);

    const map = new Map<number, Set<"package" | "booking">>();
    const add = (other: number | null | undefined, src: "package" | "booking") => {
      if (typeof other !== "number" || other === userId) return;
      let set = map.get(other);
      if (!set) {
        set = new Set();
        map.set(other, set);
      }
      set.add(src);
    };
    for (const r of pkgRows) {
      add(r.userId === userId ? r.partnerUserId : r.userId, "package");
    }
    for (const r of bkRows) {
      add(r.userId === userId ? r.linkedPartnerUserId : r.userId, "booking");
    }
    return Array.from(map.entries()).map(([id, sources]) => ({
      id,
      sources: Array.from(sources),
    }));
  }

  async getActiveLinkedPartnerIds(userId: number) {
    // Active packages where this user is on either side. We use the same
    // `isActive` boolean the rest of the package surface uses (package
    // builder, dashboard membership card) so "active" stays consistent.
    const pkgRows = await db
      .select({ userId: packages.userId, partnerUserId: packages.partnerUserId })
      .from(packages)
      .where(
        and(
          eq(packages.isActive, true),
          or(eq(packages.userId, userId), eq(packages.partnerUserId, userId))!,
        )!,
      );

    // Upcoming bookings (both directions). "Upcoming" = status is not a
    // terminal one (cancelled/no_show/completed) AND the date is today or
    // later. The booking's intra-day time slot doesn't matter for the
    // partner-link question — being on today's schedule is enough to
    // surface the partner. Same-day past slots are still "upcoming"
    // enough for that purpose; cancelled/completed are excluded by
    // status.
    const todayIso = new Date().toISOString().slice(0, 10);
    const bkRows = await db
      .select({ userId: bookings.userId, linkedPartnerUserId: bookings.linkedPartnerUserId })
      .from(bookings)
      .where(
        and(
          gte(bookings.date, todayIso),
          notInArray(bookings.status, ["cancelled", "no_show", "completed"]),
          or(
            eq(bookings.userId, userId),
            eq(bookings.linkedPartnerUserId, userId),
          )!,
        )!,
      );

    const map = new Map<number, Set<"package" | "booking">>();
    const add = (other: number | null | undefined, src: "package" | "booking") => {
      if (typeof other !== "number" || other === userId) return;
      let set = map.get(other);
      if (!set) {
        set = new Set();
        map.set(other, set);
      }
      set.add(src);
    };
    for (const r of pkgRows) {
      add(r.userId === userId ? r.partnerUserId : r.userId, "package");
    }
    for (const r of bkRows) {
      add(r.userId === userId ? r.linkedPartnerUserId : r.userId, "booking");
    }
    return Array.from(map.entries()).map(([id, sources]) => ({
      id,
      sources: Array.from(sources),
    }));
  }

  async getActivePackageForUser(userId: number) {
    const [p] = await db
      .select()
      .from(packages)
      .where(and(eq(packages.userId, userId), eq(packages.isActive, true)))
      .orderBy(desc(packages.purchasedAt))
      .limit(1);
    return p;
  }

  async createPackage(pkg: InsertPackage) {
    const [p] = await db.insert(packages).values(pkg).returning();
    return p;
  }

  async updatePackage(id: number, updates: Partial<Package>) {
    const [p] = await db.update(packages).set(updates).where(eq(packages.id, id)).returning();
    return p;
  }

  async deletePackage(id: number) {
    await db.delete(packages).where(eq(packages.id, id));
  }

  async incrementPackageUsage(id: number, by = 1) {
    // Atomic SQL increment, capped at total_sessions to avoid lost updates
    // under concurrent manual / bulk operations.
    const result = await pool.query(
      `UPDATE packages
         SET used_sessions = LEAST(total_sessions, used_sessions + $1)
       WHERE id = $2`,
      [by, id],
    );
    if (result.rowCount === 0) throw new Error("Package not found");
    const refreshed = await this.getPackage(id);
    if (!refreshed) throw new Error("Package not found after increment");
    return refreshed;
  }

  async decrementPackageUsage(id: number, by = 1) {
    const pkg = await this.getPackage(id);
    if (!pkg) throw new Error("Package not found");
    const newUsed = Math.max(0, pkg.usedSessions - by);
    return this.updatePackage(id, { usedSessions: newUsed });
  }

  // ===== Package session history (audit log) =====
  async getPackageSessionHistory(filters?: {
    userId?: number;
    packageId?: number;
    limit?: number;
  }) {
    const conds: any[] = [];
    if (filters?.userId) conds.push(eq(packageSessionHistory.userId, filters.userId));
    if (filters?.packageId) conds.push(eq(packageSessionHistory.packageId, filters.packageId));
    const limit = Math.min(Math.max(filters?.limit ?? 200, 1), 500);
    const q =
      conds.length > 0
        ? db.select().from(packageSessionHistory).where(and(...conds))
        : db.select().from(packageSessionHistory);
    return q.orderBy(desc(packageSessionHistory.createdAt)).limit(limit);
  }

  async createPackageSessionHistory(entry: InsertPackageSessionHistory) {
    const [row] = await db.insert(packageSessionHistory).values(entry).returning();
    return row;
  }

  // ===== Package Templates =====
  async getPackageTemplates(opts?: { activeOnly?: boolean }) {
    const q = opts?.activeOnly
      ? db.select().from(packageTemplates).where(eq(packageTemplates.isActive, true))
      : db.select().from(packageTemplates);
    return q.orderBy(asc(packageTemplates.displayOrder), asc(packageTemplates.id));
  }

  async getPackageTemplate(id: number) {
    const [t] = await db.select().from(packageTemplates).where(eq(packageTemplates.id, id));
    return t;
  }

  async createPackageTemplate(t: InsertPackageTemplate) {
    const [created] = await db.insert(packageTemplates).values(t).returning();
    return created;
  }

  async updatePackageTemplate(id: number, updates: UpdatePackageTemplate) {
    const [updated] = await db
      .update(packageTemplates)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(packageTemplates.id, id))
      .returning();
    return updated;
  }

  async deletePackageTemplate(id: number) {
    await db.delete(packageTemplates).where(eq(packageTemplates.id, id));
  }

  // ===== Foods (Nutrition OS — Phase 2) =====
  async getFoods(filters?: {
    search?: string;
    category?: string;
    isSupplement?: boolean;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    const offset = Math.max(filters?.offset ?? 0, 0);
    const conditions = [] as any[];
    if (filters?.search && filters.search.trim().length > 0) {
      // ILIKE uses the `foods_name_lower_idx` index for prefix scans.
      const term = `%${filters.search.trim()}%`;
      conditions.push(ilike(foods.name, term));
    }
    if (filters?.category) {
      conditions.push(eq(foods.category, filters.category));
    }
    if (typeof filters?.isSupplement === "boolean") {
      conditions.push(eq(foods.isSupplement, filters.isSupplement));
    }
    if (filters?.activeOnly) {
      conditions.push(eq(foods.isActive, true));
    }
    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const itemsQuery = whereClause
      ? db.select().from(foods).where(whereClause)
      : db.select().from(foods);
    const items = await itemsQuery
      .orderBy(asc(foods.name), asc(foods.id))
      .limit(limit)
      .offset(offset);

    const totalQuery = whereClause
      ? db.select({ count: sql<number>`count(*)::int` }).from(foods).where(whereClause)
      : db.select({ count: sql<number>`count(*)::int` }).from(foods);
    const [{ count }] = await totalQuery;
    return { items, total: Number(count) || 0 };
  }

  async getFood(id: number) {
    const [f] = await db.select().from(foods).where(eq(foods.id, id));
    return f;
  }

  async createFood(food: InsertFood, createdByUserId: number | null) {
    const [created] = await db
      .insert(foods)
      .values({ ...food, createdByUserId: createdByUserId ?? null })
      .returning();
    return created;
  }

  async updateFood(id: number, updates: UpdateFood) {
    const [updated] = await db
      .update(foods)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(foods.id, id))
      .returning();
    return updated;
  }

  async deleteFood(id: number) {
    await db.delete(foods).where(eq(foods.id, id));
  }

  async duplicateFood(id: number, createdByUserId: number | null) {
    const [src] = await db.select().from(foods).where(eq(foods.id, id));
    if (!src) return undefined;
    const { id: _id, createdAt: _ca, updatedAt: _ua, createdByUserId: _cu, ...rest } = src as any;
    const [dup] = await db
      .insert(foods)
      .values({
        ...rest,
        name: `${src.name} (copy)`,
        createdByUserId: createdByUserId ?? null,
      })
      .returning();
    return dup;
  }

  // ===== Meals (Nutrition OS — Phase 3) =====
  // Meals are composed of N meal_items. Items are SNAPSHOTS of foods,
  // so editing/deleting the underlying food never mutates an existing
  // meal. Cached totals on the meal row are recomputed from items on
  // every write via the shared `computeMealTotals` helper, so list
  // views, PDF exports and AI inputs never need to JOIN+SUM.
  async getMeals(filters?: {
    search?: string;
    category?: string;
    templateOnly?: boolean;
    activeOnly?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    const offset = Math.max(filters?.offset ?? 0, 0);
    const conds: any[] = [];
    if (filters?.search && filters.search.trim().length > 0) {
      conds.push(ilike(meals.name, `%${filters.search.trim()}%`));
    }
    if (filters?.category) conds.push(eq(meals.category, filters.category));
    if (filters?.templateOnly) conds.push(eq(meals.isTemplate, true));
    if (filters?.activeOnly) conds.push(eq(meals.isActive, true));
    const where = conds.length > 0 ? and(...conds) : undefined;

    const itemsQ = where ? db.select().from(meals).where(where) : db.select().from(meals);
    const items = await itemsQ
      .orderBy(asc(meals.name), asc(meals.id))
      .limit(limit)
      .offset(offset);

    const totalQ = where
      ? db.select({ count: sql<number>`count(*)::int` }).from(meals).where(where)
      : db.select({ count: sql<number>`count(*)::int` }).from(meals);
    const [{ count }] = await totalQ;
    return { items, total: Number(count) || 0 };
  }

  async getMeal(id: number): Promise<MealWithItems | undefined> {
    const [m] = await db.select().from(meals).where(eq(meals.id, id));
    if (!m) return undefined;
    const its = await db
      .select()
      .from(mealItems)
      .where(eq(mealItems.mealId, id))
      .orderBy(asc(mealItems.sortOrder), asc(mealItems.id));
    return { ...m, items: its };
  }

  /**
   * Recompute & persist cached totals on the meals row from the
   * authoritative meal_items list. Single source of truth for math
   * lives in `shared/nutrition.ts` so server / client / PDF / AI all
   * agree on the numbers down to the same rounding rule.
   */
  private async recomputeMealTotals(mealId: number) {
    const its = await db.select().from(mealItems).where(eq(mealItems.mealId, mealId));
    const { computeMealTotals } = await import("@shared/nutrition");
    const t = computeMealTotals(
      its.map((i) => ({
        quantity: i.quantity,
        kcal: i.kcal,
        proteinG: i.proteinG,
        carbsG: i.carbsG,
        fatsG: i.fatsG,
        fiberG: i.fiberG,
        sugarG: i.sugarG,
        sodiumMg: i.sodiumMg,
      })),
    );
    await db
      .update(meals)
      .set({
        totalKcal: t.kcal,
        totalProteinG: t.proteinG,
        totalCarbsG: t.carbsG,
        totalFatsG: t.fatsG,
        updatedAt: new Date(),
      })
      .where(eq(meals.id, mealId));
  }

  async createMeal(
    meal: Omit<InsertMeal, "items">,
    items: MealItemInput[],
    createdByUserId: number | null,
  ): Promise<MealWithItems> {
    const [created] = await db
      .insert(meals)
      .values({ ...meal, createdByUserId: createdByUserId ?? null })
      .returning();
    if (items.length > 0) {
      await db.insert(mealItems).values(
        items.map((it, idx) => ({
          mealId: created.id,
          foodId: it.foodId ?? null,
          name: it.name,
          servingSize: it.servingSize,
          servingUnit: it.servingUnit,
          kcal: it.kcal,
          proteinG: it.proteinG,
          carbsG: it.carbsG,
          fatsG: it.fatsG,
          fiberG: it.fiberG ?? null,
          sugarG: it.sugarG ?? null,
          sodiumMg: it.sodiumMg ?? null,
          quantity: it.quantity,
          notes: it.notes ?? null,
          sortOrder: it.sortOrder ?? idx,
        })),
      );
    }
    await this.recomputeMealTotals(created.id);
    const full = await this.getMeal(created.id);
    return full!;
  }

  async updateMeal(
    id: number,
    updates: Omit<UpdateMeal, "items">,
    items?: MealItemInput[],
  ): Promise<MealWithItems | undefined> {
    const [existing] = await db.select().from(meals).where(eq(meals.id, id));
    if (!existing) return undefined;
    if (Object.keys(updates).length > 0) {
      await db
        .update(meals)
        .set({ ...updates, updatedAt: new Date() })
        .where(eq(meals.id, id));
    }
    if (items) {
      // Atomic replace: delete-then-insert is simpler & safer than a
      // diff for what is at most ~50 rows. Cascading FK isn't needed
      // here because we only delete by mealId.
      await db.delete(mealItems).where(eq(mealItems.mealId, id));
      if (items.length > 0) {
        await db.insert(mealItems).values(
          items.map((it, idx) => ({
            mealId: id,
            foodId: it.foodId ?? null,
            name: it.name,
            servingSize: it.servingSize,
            servingUnit: it.servingUnit,
            kcal: it.kcal,
            proteinG: it.proteinG,
            carbsG: it.carbsG,
            fatsG: it.fatsG,
            fiberG: it.fiberG ?? null,
            sugarG: it.sugarG ?? null,
            sodiumMg: it.sodiumMg ?? null,
            quantity: it.quantity,
            notes: it.notes ?? null,
            sortOrder: it.sortOrder ?? idx,
          })),
        );
      }
    }
    await this.recomputeMealTotals(id);
    return this.getMeal(id);
  }

  async deleteMeal(id: number) {
    // ON DELETE CASCADE on meal_items.meal_id cleans up children.
    await db.delete(meals).where(eq(meals.id, id));
  }

  // ===== Nutrition Plans (Phase 4) =====
  // The plan tree (plan → days → meals → items) is FULLY snapshotted
  // at insert time so editing/deleting a food or library meal never
  // mutates a delivered client plan. Cached totals on plan_meals row
  // are recomputed on every write via shared/nutrition.ts.
  async getNutritionPlans(filters?: {
    userId?: number;
    status?: string;
    limit?: number;
    offset?: number;
  }) {
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    const offset = Math.max(filters?.offset ?? 0, 0);
    const conds: any[] = [];
    if (filters?.userId) conds.push(eq(nutritionPlans.userId, filters.userId));
    if (filters?.status) conds.push(eq(nutritionPlans.status, filters.status));
    const where = conds.length > 0 ? and(...conds) : undefined;
    const itemsQ = where
      ? db.select().from(nutritionPlans).where(where)
      : db.select().from(nutritionPlans);
    const items = await itemsQ
      .orderBy(desc(nutritionPlans.updatedAt), desc(nutritionPlans.id))
      .limit(limit)
      .offset(offset);
    const totalQ = where
      ? db.select({ count: sql<number>`count(*)::int` }).from(nutritionPlans).where(where)
      : db.select({ count: sql<number>`count(*)::int` }).from(nutritionPlans);
    const [{ count }] = await totalQ;
    return { items, total: Number(count) || 0 };
  }

  async getNutritionPlan(id: number): Promise<NutritionPlanFull | undefined> {
    const [plan] = await db.select().from(nutritionPlans).where(eq(nutritionPlans.id, id));
    if (!plan) return undefined;
    const days = await db
      .select()
      .from(nutritionPlanDays)
      .where(eq(nutritionPlanDays.planId, id))
      .orderBy(asc(nutritionPlanDays.sortOrder), asc(nutritionPlanDays.id));
    const dayIds = days.map((d) => d.id);
    const allMeals = dayIds.length
      ? await db
          .select()
          .from(nutritionPlanMeals)
          .where(inArray(nutritionPlanMeals.planDayId, dayIds))
          .orderBy(asc(nutritionPlanMeals.sortOrder), asc(nutritionPlanMeals.id))
      : [];
    const mealIds = allMeals.map((m) => m.id);
    const allItems = mealIds.length
      ? await db
          .select()
          .from(nutritionPlanMealItems)
          .where(inArray(nutritionPlanMealItems.planMealId, mealIds))
          .orderBy(asc(nutritionPlanMealItems.sortOrder), asc(nutritionPlanMealItems.id))
      : [];
    const itemsByMeal = new Map<number, typeof allItems>();
    for (const it of allItems) {
      const arr = itemsByMeal.get(it.planMealId) ?? [];
      arr.push(it);
      itemsByMeal.set(it.planMealId, arr);
    }
    const mealsByDay = new Map<number, any[]>();
    for (const m of allMeals) {
      const arr = mealsByDay.get(m.planDayId) ?? [];
      arr.push({ ...m, items: itemsByMeal.get(m.id) ?? [] });
      mealsByDay.set(m.planDayId, arr);
    }
    return {
      ...plan,
      days: days.map((d) => ({ ...d, meals: mealsByDay.get(d.id) ?? [] })),
    };
  }

  async getActiveNutritionPlanForUser(userId: number) {
    const [plan] = await db
      .select()
      .from(nutritionPlans)
      .where(and(eq(nutritionPlans.userId, userId), eq(nutritionPlans.status, "active")))
      .orderBy(desc(nutritionPlans.updatedAt))
      .limit(1);
    if (!plan) return undefined;
    return this.getNutritionPlan(plan.id);
  }

  /**
   * Insert the full days → meals → items tree for a plan, snapshotting
   * everything and recomputing per-meal cached totals via shared math.
   * MUST be called inside a `db.transaction` (or be the only write in
   * its caller) so a mid-tree failure rolls back cleanly. Accepts a
   * tx handle so callers can compose atomic create/update flows.
   */
  private async insertPlanTree(
    tx: typeof db,
    planId: number,
    days: PlanDayInput[],
  ) {
    const { computeMealTotals } = await import("@shared/nutrition");
    for (let dIdx = 0; dIdx < days.length; dIdx++) {
      const d = days[dIdx];
      const [insertedDay] = await tx
        .insert(nutritionPlanDays)
        .values({
          planId,
          dayType: d.dayType,
          label: d.label ?? null,
          sortOrder: d.sortOrder ?? dIdx,
          targetKcal: d.targetKcal,
          targetProteinG: d.targetProteinG,
          targetCarbsG: d.targetCarbsG,
          targetFatsG: d.targetFatsG,
          notes: d.notes ?? null,
        })
        .returning();
      for (let mIdx = 0; mIdx < d.meals.length; mIdx++) {
        const m = d.meals[mIdx];
        const totals = computeMealTotals(
          m.items.map((i) => ({
            quantity: i.quantity,
            kcal: i.kcal,
            proteinG: i.proteinG,
            carbsG: i.carbsG,
            fatsG: i.fatsG,
            fiberG: i.fiberG,
            sugarG: i.sugarG,
            sodiumMg: i.sodiumMg,
          })),
        );
        const [insertedMeal] = await tx
          .insert(nutritionPlanMeals)
          .values({
            planDayId: insertedDay.id,
            sourceMealId: m.sourceMealId ?? null,
            name: m.name,
            category: m.category,
            notes: m.notes ?? null,
            sortOrder: m.sortOrder ?? mIdx,
            totalKcal: totals.kcal,
            totalProteinG: totals.proteinG,
            totalCarbsG: totals.carbsG,
            totalFatsG: totals.fatsG,
          })
          .returning();
        if (m.items.length > 0) {
          await tx.insert(nutritionPlanMealItems).values(
            m.items.map((it, iIdx) => ({
              planMealId: insertedMeal.id,
              sourceFoodId: it.sourceFoodId ?? null,
              name: it.name,
              servingSize: it.servingSize,
              servingUnit: it.servingUnit,
              kcal: it.kcal,
              proteinG: it.proteinG,
              carbsG: it.carbsG,
              fatsG: it.fatsG,
              fiberG: it.fiberG ?? null,
              sugarG: it.sugarG ?? null,
              sodiumMg: it.sodiumMg ?? null,
              quantity: it.quantity,
              notes: it.notes ?? null,
              sortOrder: it.sortOrder ?? iIdx,
            })),
          );
        }
      }
    }
  }

  async createNutritionPlan(
    plan: Omit<InsertNutritionPlan, "days">,
    days: PlanDayInput[],
    createdByUserId: number | null,
  ): Promise<NutritionPlanFull> {
    // Wrap the entire create flow (archive-others + insert plan +
    // insert tree) in one transaction so a partial failure rolls back
    // cleanly — no orphaned plan rows, no archived-but-unreplaced
    // previous active.
    const newId = await db.transaction(async (tx) => {
      if ((plan.status ?? "draft") === "active") {
        await tx
          .update(nutritionPlans)
          .set({ status: "archived", updatedAt: new Date() })
          .where(
            and(
              eq(nutritionPlans.userId, plan.userId),
              eq(nutritionPlans.status, "active"),
            ),
          );
      }
      const [created] = await tx
        .insert(nutritionPlans)
        .values({
          ...plan,
          status: plan.status ?? "draft",
          createdByUserId: createdByUserId ?? null,
        })
        .returning();
      await this.insertPlanTree(tx as any, created.id, days);
      return created.id;
    });
    const full = await this.getNutritionPlan(newId);
    return full!;
  }

  async updateNutritionPlan(
    id: number,
    updates: Omit<UpdateNutritionPlan, "days" | "userId">,
    days?: PlanDayInput[],
  ): Promise<NutritionPlanFull | undefined> {
    const [existing] = await db.select().from(nutritionPlans).where(eq(nutritionPlans.id, id));
    if (!existing) return undefined;
    // Wrap the whole update — promote-to-active archival, header
    // patch, and the days-tree replace — in one transaction. Without
    // this, a mid-tree failure would leave the plan with its old
    // header but ZERO days (cascade-delete already ran), permanently
    // wiping the trainer's work.
    await db.transaction(async (tx) => {
      if (updates.status === "active" && existing.status !== "active") {
        await tx
          .update(nutritionPlans)
          .set({ status: "archived", updatedAt: new Date() })
          .where(
            and(
              eq(nutritionPlans.userId, existing.userId),
              eq(nutritionPlans.status, "active"),
            ),
          );
      }
      const patch: Record<string, unknown> = { ...updates, updatedAt: new Date() };
      if (Object.keys(patch).length > 1) {
        await tx.update(nutritionPlans).set(patch).where(eq(nutritionPlans.id, id));
      }
      if (days) {
        // Atomic replace of the day/meal/item tree. ON DELETE CASCADE on
        // plan_id walks the whole tree down — single delete here.
        await tx.delete(nutritionPlanDays).where(eq(nutritionPlanDays.planId, id));
        await this.insertPlanTree(tx as any, id, days);
      }
    });
    return this.getNutritionPlan(id);
  }

  async deleteNutritionPlan(id: number) {
    await db.delete(nutritionPlans).where(eq(nutritionPlans.id, id));
  }

  async duplicateNutritionPlan(id: number, createdByUserId: number | null) {
    const src = await this.getNutritionPlan(id);
    if (!src) return undefined;
    const days: PlanDayInput[] = src.days.map((d) => ({
      dayType: d.dayType as any,
      label: d.label,
      sortOrder: d.sortOrder,
      targetKcal: d.targetKcal,
      targetProteinG: d.targetProteinG,
      targetCarbsG: d.targetCarbsG,
      targetFatsG: d.targetFatsG,
      notes: d.notes,
      meals: d.meals.map((m) => ({
        sourceMealId: m.sourceMealId,
        name: m.name,
        category: m.category as any,
        notes: m.notes,
        sortOrder: m.sortOrder,
        items: m.items.map((it) => ({
          sourceFoodId: it.sourceFoodId,
          name: it.name,
          servingSize: it.servingSize,
          servingUnit: it.servingUnit,
          kcal: it.kcal,
          proteinG: it.proteinG,
          carbsG: it.carbsG,
          fatsG: it.fatsG,
          fiberG: it.fiberG,
          sugarG: it.sugarG,
          sodiumMg: it.sodiumMg,
          quantity: it.quantity,
          notes: it.notes,
          sortOrder: it.sortOrder,
        })),
      })),
    }));
    return this.createNutritionPlan(
      {
        userId: src.userId,
        name: `${src.name} (copy)`,
        goal: src.goal as any,
        status: "draft",
        startDate: src.startDate,
        reviewDate: src.reviewDate,
        waterTargetMl: src.waterTargetMl,
        publicNotes: src.publicNotes,
        privateNotes: src.privateNotes,
      },
      days,
      createdByUserId,
    );
  }

  async duplicateMeal(id: number, createdByUserId: number | null) {
    const src = await this.getMeal(id);
    if (!src) return undefined;
    const { id: _id, createdAt: _ca, updatedAt: _ua, createdByUserId: _cu, items, ...rest } =
      src as any;
    const items2: MealItemInput[] = (src.items || []).map((it: MealItem) => ({
      foodId: it.foodId,
      name: it.name,
      servingSize: it.servingSize,
      servingUnit: it.servingUnit,
      kcal: it.kcal,
      proteinG: it.proteinG,
      carbsG: it.carbsG,
      fatsG: it.fatsG,
      fiberG: it.fiberG ?? null,
      sugarG: it.sugarG ?? null,
      sodiumMg: it.sodiumMg ?? null,
      quantity: it.quantity,
      notes: it.notes ?? null,
      sortOrder: it.sortOrder,
    }));
    return this.createMeal(
      { ...rest, name: `${src.name} (copy)` },
      items2,
      createdByUserId,
    );
  }

  // ===== InBody =====
  async getInbodyRecords(filters?: { userId?: number }) {
    const q = filters?.userId
      ? db.select().from(inbodyRecords).where(eq(inbodyRecords.userId, filters.userId))
      : db.select().from(inbodyRecords);
    return q.orderBy(desc(inbodyRecords.recordedAt));
  }

  async getInbodyRecord(id: number) {
    const [r] = await db.select().from(inbodyRecords).where(eq(inbodyRecords.id, id));
    return r;
  }

  async createInbodyRecord(record: InsertInbody) {
    const [r] = await db.insert(inbodyRecords).values(record).returning();
    return r;
  }

  async updateInbodyRecord(id: number, updates: UpdateInbody) {
    const [r] = await db
      .update(inbodyRecords)
      .set(updates)
      .where(eq(inbodyRecords.id, id))
      .returning();
    return r;
  }

  async deleteInbodyRecord(id: number) {
    await db.delete(inbodyRecords).where(eq(inbodyRecords.id, id));
  }

  // ===== Progress Photos =====
  async getProgressPhotos(filters?: { userId?: number }) {
    const q = filters?.userId
      ? db.select().from(progressPhotos).where(eq(progressPhotos.userId, filters.userId))
      : db.select().from(progressPhotos);
    return q.orderBy(desc(progressPhotos.recordedAt));
  }

  async createProgressPhoto(photo: InsertProgressPhoto) {
    const [p] = await db.insert(progressPhotos).values(photo).returning();
    return p;
  }

  async deleteProgressPhoto(id: number) {
    await db.delete(progressPhotos).where(eq(progressPhotos.id, id));
  }

  // ===== Consent Records =====
  async getConsentRecords(filters?: { userId?: number; consentType?: string }) {
    const conds: any[] = [];
    if (filters?.userId) conds.push(eq(consentRecords.userId, filters.userId));
    if (filters?.consentType) conds.push(eq(consentRecords.consentType, filters.consentType));
    const q =
      conds.length > 0
        ? db.select().from(consentRecords).where(and(...conds))
        : db.select().from(consentRecords);
    return q.orderBy(desc(consentRecords.createdAt));
  }

  async createConsentRecord(record: InsertConsent) {
    const [r] = await db.insert(consentRecords).values(record).returning();
    return r;
  }

  // ===== Admin notifications =====
  async getAdminNotifications(filters?: { unreadOnly?: boolean; limit?: number }) {
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    const q = filters?.unreadOnly
      ? db.select().from(adminNotifications).where(eq(adminNotifications.isRead, false))
      : db.select().from(adminNotifications);
    return q.orderBy(desc(adminNotifications.createdAt)).limit(limit);
  }

  async getAdminUnreadCount() {
    const rows = await db
      .select({ id: adminNotifications.id })
      .from(adminNotifications)
      .where(eq(adminNotifications.isRead, false));
    return rows.length;
  }

  async createAdminNotification(notif: InsertAdminNotification) {
    const [n] = await db.insert(adminNotifications).values(notif).returning();
    return n;
  }

  async markAdminNotificationRead(id: number) {
    const [n] = await db
      .update(adminNotifications)
      .set({ isRead: true })
      .where(eq(adminNotifications.id, id))
      .returning();
    return n;
  }

  async markAllAdminNotificationsRead() {
    await db.update(adminNotifications).set({ isRead: true }).where(eq(adminNotifications.isRead, false));
  }

  // ===== Client-facing notifications (P5a) =====
  // Task #78 — notification center priority order: Coach > Booking >
  // Package > Tips/Other. Sorted server-side so EVERY consumer (bell
  // dropdown, full list page, unread query) gets the same ordering
  // without each call site re-implementing the bucket logic. Within a
  // bucket we still fall back to createdAt desc so the freshest item
  // wins. Index-friendly: the CASE collapses to a small int and we
  // already have an index on (user_id, created_at desc).
  async getClientNotifications(
    userId: number,
    filters?: { unreadOnly?: boolean; limit?: number },
  ): Promise<ClientNotification[]> {
    const limit = Math.min(Math.max(filters?.limit ?? 50, 1), 200);
    const conds: any[] = [eq(clientNotifications.userId, userId)];
    if (filters?.unreadOnly) conds.push(sql`${clientNotifications.readAt} IS NULL`);
    return db
      .select()
      .from(clientNotifications)
      .where(and(...conds))
      .orderBy(
        sql`CASE
          WHEN ${clientNotifications.kind} IN ('coach_message','admin_message') THEN 0
          WHEN ${clientNotifications.kind} IN ('session_reminder','waitlist_open','waitlist_slot_available') THEN 1
          WHEN ${clientNotifications.kind} IN ('package_expiring','package_activated','package_activation_requested','payment_reminder') THEN 2
          ELSE 3
        END ASC`,
        desc(clientNotifications.createdAt),
      )
      .limit(limit);
  }

  async getClientUnreadNotificationCount(userId: number): Promise<number> {
    const rows = await db
      .select({ id: clientNotifications.id })
      .from(clientNotifications)
      .where(
        and(eq(clientNotifications.userId, userId), sql`${clientNotifications.readAt} IS NULL`),
      );
    return rows.length;
  }

  async createClientNotification(notif: InsertClientNotification): Promise<ClientNotification> {
    const [n] = await db.insert(clientNotifications).values(notif).returning();
    return n;
  }

  // Atomic dedupe variant. Relies on the partial UNIQUE INDEX
  // `client_notifications_dedupe_uq` on (user_id, kind, dedupe_key)
  // WHERE dedupe_key IS NOT NULL. NOTE: Postgres requires the partial
  // index predicate (`WHERE dedupe_key IS NOT NULL`) to be repeated in
  // the ON CONFLICT clause for the arbiter to be matched — Drizzle's
  // `onConflictDoNothing({target:[...]})` omits it, so we drop down to
  // raw SQL via the pg pool. Returning rows means the row was newly
  // inserted; an empty result means a duplicate was atomically
  // suppressed. Safe under racing cron retries / concurrent triggers.
  // Task #74 — user badges.
  async getUserBadges(userId: number): Promise<UserBadge[]> {
    const rows = await db
      .select()
      .from(userBadges)
      .where(eq(userBadges.userId, userId))
      .orderBy(asc(userBadges.earnedAt));
    return rows;
  }

  async awardUserBadge(userId: number, badgeKey: string): Promise<UserBadge | null> {
    // INSERT ... ON CONFLICT (user_id, badge_key) DO NOTHING RETURNING.
    // Atomic via the unique index — concurrent triggers (cron + manual
    // /evaluate + admin attendance) cannot double-award the same badge.
    const result = await pool.query(
      `INSERT INTO user_badges (user_id, badge_key)
       VALUES ($1, $2)
       ON CONFLICT (user_id, badge_key) DO NOTHING
       RETURNING id, user_id AS "userId", badge_key AS "badgeKey", earned_at AS "earnedAt"`,
      [userId, badgeKey],
    );
    return (result.rows[0] as UserBadge) ?? null;
  }

  async createClientNotificationOnce(
    notif: InsertClientNotification,
  ): Promise<ClientNotification | null> {
    const result = await pool.query(
      `INSERT INTO client_notifications
         (user_id, kind, title, body, link, meta, dedupe_key,
          channel_in_app, channel_push, channel_email)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10)
       ON CONFLICT (user_id, kind, dedupe_key)
         WHERE dedupe_key IS NOT NULL
         DO NOTHING
       RETURNING id, user_id   AS "userId",
                 kind, title, body, link, meta, dedupe_key AS "dedupeKey",
                 channel_in_app  AS "channelInApp",
                 channel_push    AS "channelPush",
                 channel_email   AS "channelEmail",
                 push_sent_at    AS "pushSentAt",
                 email_sent_at   AS "emailSentAt",
                 read_at         AS "readAt",
                 created_at      AS "createdAt"`,
      [
        notif.userId,
        notif.kind,
        notif.title,
        notif.body,
        notif.link ?? null,
        notif.meta == null ? null : JSON.stringify(notif.meta),
        notif.dedupeKey ?? null,
        notif.channelInApp ?? true,
        notif.channelPush ?? false,
        notif.channelEmail ?? false,
      ],
    );
    return (result.rows[0] as ClientNotification) ?? null;
  }

  // Dedupe lookup for notifyUserOnce(): finds a previous notification for
  // the same (userId, kind, meta.dedupeKey). Returns the most recent match
  // or undefined. Used by triggers that may be re-invoked (cron passes,
  // attendance toggles) so we never spam the same alert twice.
  async findClientNotificationByDedupeKey(
    userId: number,
    kind: string,
    dedupeKey: string,
  ): Promise<ClientNotification | undefined> {
    const rows = await db
      .select()
      .from(clientNotifications)
      .where(
        and(
          eq(clientNotifications.userId, userId),
          eq(clientNotifications.kind, kind),
          sql`${clientNotifications.meta} ->> 'dedupeKey' = ${dedupeKey}`,
        ),
      )
      .orderBy(desc(clientNotifications.createdAt))
      .limit(1);
    return rows[0];
  }

  async markClientNotificationRead(
    id: number,
    userId: number,
  ): Promise<ClientNotification | undefined> {
    const [n] = await db
      .update(clientNotifications)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(clientNotifications.id, id),
          eq(clientNotifications.userId, userId),
          sql`${clientNotifications.readAt} IS NULL`,
        ),
      )
      .returning();
    return n;
  }

  async markAllClientNotificationsRead(userId: number): Promise<void> {
    await db
      .update(clientNotifications)
      .set({ readAt: new Date() })
      .where(
        and(eq(clientNotifications.userId, userId), sql`${clientNotifications.readAt} IS NULL`),
      );
  }

  // ===== Waitlists (Task #55) =====
  async getWaitlistEntriesForUser(userId: number): Promise<Waitlist[]> {
    return db
      .select()
      .from(waitlists)
      .where(eq(waitlists.userId, userId))
      .orderBy(asc(waitlists.date), asc(waitlists.timeSlot));
  }

  async getWaitlistEntriesForSlot(date: string, timeSlot: string): Promise<Waitlist[]> {
    return db
      .select()
      .from(waitlists)
      .where(and(eq(waitlists.date, date), eq(waitlists.timeSlot, timeSlot)))
      .orderBy(asc(waitlists.createdAt));
  }

  async createWaitlistEntry(entry: InsertWaitlist): Promise<Waitlist> {
    const [row] = await db.insert(waitlists).values(entry).returning();
    return row;
  }

  async deleteWaitlistEntry(id: number, userId: number): Promise<boolean> {
    const result = await db
      .delete(waitlists)
      .where(and(eq(waitlists.id, id), eq(waitlists.userId, userId)))
      .returning({ id: waitlists.id });
    return result.length > 0;
  }

  async claimWaitlistEntry(id: number): Promise<Waitlist | undefined> {
    // Atomic claim — only stamps notified_at if currently NULL. Two
    // concurrent cancel-hooks racing on the same row see exactly one
    // winner.
    const result = await pool.query(
      `UPDATE waitlists
         SET notified_at = now()
       WHERE id = $1 AND notified_at IS NULL
       RETURNING id, user_id AS "userId", date, time_slot AS "timeSlot",
                 created_at AS "createdAt", notified_at AS "notifiedAt"`,
      [id],
    );
    return (result.rows[0] as Waitlist) ?? undefined;
  }

  async findTrialUsersByIdentifiers(opts: {
    emailNormalized?: string | null;
    phoneNormalized?: string | null;
    deviceFingerprintHash?: string | null;
    excludeUserId?: number;
  }): Promise<User[]> {
    const ors: any[] = [];
    if (opts.emailNormalized) ors.push(eq(users.emailNormalized, opts.emailNormalized));
    if (opts.phoneNormalized) ors.push(eq(users.phoneNormalized, opts.phoneNormalized));
    if (opts.deviceFingerprintHash)
      ors.push(eq(users.deviceFingerprintHash, opts.deviceFingerprintHash));
    if (ors.length === 0) return [];
    const conds: any[] = [eq(users.hasUsedFreeTrial, true), or(...ors)];
    if (opts.excludeUserId) conds.push(sql`${users.id} <> ${opts.excludeUserId}`);
    return db.select().from(users).where(and(...conds));
  }

  // ===== Renewal requests =====
  async getRenewalRequests(filters?: { userId?: number; status?: string; limit?: number }) {
    const conds: any[] = [];
    if (filters?.userId) conds.push(eq(renewalRequests.userId, filters.userId));
    if (filters?.status) conds.push(eq(renewalRequests.status, filters.status));
    const q =
      conds.length > 0
        ? db.select().from(renewalRequests).where(and(...conds))
        : db.select().from(renewalRequests);
    const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
    return q.orderBy(desc(renewalRequests.createdAt)).limit(limit);
  }

  async getRenewalRequest(id: number) {
    const [r] = await db.select().from(renewalRequests).where(eq(renewalRequests.id, id));
    return r;
  }

  async createRenewalRequest(req: InsertRenewalRequest) {
    const [r] = await db.insert(renewalRequests).values(req).returning();
    return r;
  }

  async updateRenewalRequest(id: number, updates: Partial<RenewalRequest>) {
    const [r] = await db.update(renewalRequests).set(updates).where(eq(renewalRequests.id, id)).returning();
    return r;
  }

  // ===== Extension requests =====
  async getExtensionRequests(filters?: { userId?: number; status?: string; limit?: number }) {
    const conds: any[] = [];
    if (filters?.userId) conds.push(eq(extensionRequests.userId, filters.userId));
    if (filters?.status) conds.push(eq(extensionRequests.status, filters.status));
    const q =
      conds.length > 0
        ? db.select().from(extensionRequests).where(and(...conds))
        : db.select().from(extensionRequests);
    const limit = Math.min(Math.max(filters?.limit ?? 100, 1), 500);
    return q.orderBy(desc(extensionRequests.createdAt)).limit(limit);
  }

  async getExtensionRequest(id: number) {
    const [r] = await db.select().from(extensionRequests).where(eq(extensionRequests.id, id));
    return r;
  }

  async createExtensionRequest(req: InsertExtensionRequest) {
    const [r] = await db.insert(extensionRequests).values(req).returning();
    return r;
  }

  async updateExtensionRequest(id: number, updates: Partial<ExtensionRequest>) {
    const [r] = await db.update(extensionRequests).set(updates).where(eq(extensionRequests.id, id)).returning();
    return r;
  }

  // ===== Attendance helper =====
  async incrementUserNoShow(userId: number) {
    // Atomic increment to avoid racing concurrent attendance markers.
    await pool.query(
      `UPDATE users SET no_show_count = no_show_count + 1 WHERE id = $1`,
      [userId],
    );
  }

  // ===== Verification flags (batched) =====
  // Two grouped EXISTS-style queries instead of 2*N per-user fetches. Used
  // by /api/users to enrich the admin client list without scanning every
  // booking/inbody row per client.
  async getVerificationFlagsForUsers(userIds: number[]) {
    const out = new Map<number, { hasInbody: boolean; hasCompletedSession: boolean }>();
    if (userIds.length === 0) return out;
    for (const id of userIds) out.set(id, { hasInbody: false, hasCompletedSession: false });

    const inbodyRows = await db
      .select({ userId: inbodyRecords.userId })
      .from(inbodyRecords)
      .where(inArray(inbodyRecords.userId, userIds))
      .groupBy(inbodyRecords.userId);
    for (const r of inbodyRows) {
      const v = out.get(r.userId);
      if (v) v.hasInbody = true;
    }

    const sessionRows = await db
      .select({ userId: bookings.userId })
      .from(bookings)
      .where(and(inArray(bookings.userId, userIds), eq(bookings.status, "completed")))
      .groupBy(bookings.userId);
    for (const r of sessionRows) {
      const v = out.get(r.userId);
      if (v) v.hasCompletedSession = true;
    }

    return out;
  }
  async getHealthSignalsForUsers(userIds: number[]) {
    type Row = {
      lastCompletedDate: string | null;
      lastCheckinWeek: string | null;
      lastBodyMetricDate: string | null;
      noShows30d: number;
      completed30d: number;
      hasActivePackage: boolean;
      activePackageFrozen: boolean;
    };
    const out = new Map<number, Row>();
    if (userIds.length === 0) return out;
    for (const id of userIds) {
      out.set(id, {
        lastCompletedDate: null,
        lastCheckinWeek: null,
        lastBodyMetricDate: null,
        noShows30d: 0,
        completed30d: 0,
        hasActivePackage: false,
        activePackageFrozen: false,
      });
    }

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const thirtyAgoIso = thirtyDaysAgo.toISOString().slice(0, 10);

    const lastCompletedRows = await db
      .select({
        userId: bookings.userId,
        lastDate: sql<string>`max(${bookings.date})`,
      })
      .from(bookings)
      .where(and(inArray(bookings.userId, userIds), eq(bookings.status, "completed")))
      .groupBy(bookings.userId);
    for (const r of lastCompletedRows) {
      const v = out.get(r.userId);
      if (v) v.lastCompletedDate = r.lastDate;
    }

    const counts30dRows = await db
      .select({
        userId: bookings.userId,
        status: bookings.status,
        n: sql<number>`count(*)::int`,
      })
      .from(bookings)
      .where(
        and(
          inArray(bookings.userId, userIds),
          gte(bookings.date, thirtyAgoIso),
          inArray(bookings.status, ["completed", "no_show"]),
        ),
      )
      .groupBy(bookings.userId, bookings.status);
    for (const r of counts30dRows) {
      const v = out.get(r.userId);
      if (!v) continue;
      if (r.status === "completed") v.completed30d = r.n;
      else if (r.status === "no_show") v.noShows30d = r.n;
    }

    const checkinRows = await db
      .select({
        userId: weeklyCheckins.userId,
        lastWeek: sql<string>`max(${weeklyCheckins.weekStart})`,
      })
      .from(weeklyCheckins)
      .where(inArray(weeklyCheckins.userId, userIds))
      .groupBy(weeklyCheckins.userId);
    for (const r of checkinRows) {
      const v = out.get(r.userId);
      if (v) v.lastCheckinWeek = r.lastWeek;
    }

    const metricRows = await db
      .select({
        userId: bodyMetrics.userId,
        lastDate: sql<string>`max(${bodyMetrics.recordedOn})`,
      })
      .from(bodyMetrics)
      .where(inArray(bodyMetrics.userId, userIds))
      .groupBy(bodyMetrics.userId);
    for (const r of metricRows) {
      const v = out.get(r.userId);
      if (v) v.lastBodyMetricDate = r.lastDate;
    }

    const pkgRows = await db
      .select({
        userId: packages.userId,
        frozen: packages.frozen,
      })
      .from(packages)
      .where(and(inArray(packages.userId, userIds), eq(packages.isActive, true)));
    for (const r of pkgRows) {
      const v = out.get(r.userId);
      if (!v) continue;
      v.hasActivePackage = true;
      if (r.frozen) v.activePackageFrozen = true;
    }

    return out;
  }

  async getClientIntelligenceData(userId: number) {
    const sixtyAgoIso = new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);

    const [activePkgRow] = await db
      .select({
        totalSessions: packages.totalSessions,
        usedSessions: packages.usedSessions,
        expiryDate: packages.expiryDate,
        frozen: packages.frozen,
        paymentStatus: packages.paymentStatus,
      })
      .from(packages)
      .where(and(eq(packages.userId, userId), eq(packages.isActive, true)))
      .orderBy(desc(packages.id))
      .limit(1);

    const bookingRows = await db
      .select({
        id: bookings.id,
        date: bookings.date,
        timeSlot: bookings.timeSlot,
        status: bookings.status,
        coachNotesUpdatedAt: bookings.coachNotesUpdatedAt,
      })
      .from(bookings)
      .where(and(eq(bookings.userId, userId), gte(bookings.date, sixtyAgoIso)))
      .orderBy(desc(bookings.date))
      .limit(200);

    const checkinRows = await db
      .select({ id: weeklyCheckins.id, weekStart: weeklyCheckins.weekStart })
      .from(weeklyCheckins)
      .where(eq(weeklyCheckins.userId, userId))
      .orderBy(desc(weeklyCheckins.weekStart))
      .limit(12);

    const bmRows = await db
      .select({
        id: bodyMetrics.id,
        recordedOn: bodyMetrics.recordedOn,
        weight: bodyMetrics.weight,
        bodyFat: bodyMetrics.bodyFat,
      })
      .from(bodyMetrics)
      .where(eq(bodyMetrics.userId, userId))
      .orderBy(desc(bodyMetrics.recordedOn))
      .limit(5);

    const [renewalRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(renewalRequests)
      .where(and(eq(renewalRequests.userId, userId), eq(renewalRequests.status, "pending")));

    const [extensionRow] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(extensionRequests)
      .where(and(eq(extensionRequests.userId, userId), eq(extensionRequests.status, "pending")));

    return {
      activePackage: activePkgRow
        ? {
            totalSessions: activePkgRow.totalSessions,
            usedSessions: activePkgRow.usedSessions,
            expiryDate: activePkgRow.expiryDate,
            frozen: activePkgRow.frozen,
            paymentStatus: activePkgRow.paymentStatus,
          }
        : null,
      bookings: bookingRows.map((b) => ({
        id: b.id,
        date: b.date,
        timeSlot: b.timeSlot,
        status: b.status,
        coachNotesUpdatedAt: b.coachNotesUpdatedAt,
      })),
      checkins: checkinRows,
      bodyMetrics: bmRows,
      pendingRenewalCount: renewalRow?.n ?? 0,
      pendingExtensionCount: extensionRow?.n ?? 0,
    };
  }

  // ===== SUPPLEMENT LIBRARY =====
  async listSupplements(opts?: { activeOnly?: boolean; category?: string }): Promise<Supplement[]> {
    const conds: any[] = [];
    if (opts?.activeOnly) conds.push(eq(supplements.active, true));
    if (opts?.category) conds.push(eq(supplements.category, opts.category));
    const q = conds.length
      ? db.select().from(supplements).where(and(...conds))
      : db.select().from(supplements);
    return q.orderBy(asc(supplements.category), asc(supplements.name));
  }
  async getSupplement(id: number): Promise<Supplement | undefined> {
    const [row] = await db.select().from(supplements).where(eq(supplements.id, id));
    return row;
  }
  async createSupplement(data: InsertSupplement, createdByUserId: number | null): Promise<Supplement> {
    const [row] = await db
      .insert(supplements)
      .values({
        name: data.name,
        nameAr: data.nameAr ?? null,
        brand: data.brand ?? null,
        category: data.category,
        defaultDosage: data.defaultDosage,
        defaultUnit: data.defaultUnit,
        defaultTimings: data.defaultTimings ?? [],
        defaultTrainingDayOnly: data.defaultTrainingDayOnly ?? false,
        defaultRestDayOnly: data.defaultRestDayOnly ?? false,
        notes: data.notes ?? null,
        warnings: data.warnings ?? null,
        isPrescription: data.isPrescription ?? false,
        active: data.active ?? true,
        createdByUserId: createdByUserId ?? null,
      })
      .returning();
    return row;
  }
  async updateSupplement(id: number, data: UpdateSupplement): Promise<Supplement | undefined> {
    const patch: any = { updatedAt: new Date() };
    for (const k of [
      "name", "nameAr", "brand", "category",
      "defaultDosage", "defaultUnit", "defaultTimings",
      "defaultTrainingDayOnly", "defaultRestDayOnly",
      "notes", "warnings", "isPrescription", "active",
    ] as const) {
      if ((data as any)[k] !== undefined) patch[k] = (data as any)[k];
    }
    const [row] = await db.update(supplements).set(patch).where(eq(supplements.id, id)).returning();
    return row;
  }
  async deleteSupplement(id: number): Promise<boolean> {
    const r = await db.delete(supplements).where(eq(supplements.id, id)).returning({ id: supplements.id });
    return r.length > 0;
  }

  // ===== SUPPLEMENT STACKS =====
  async listSupplementStacks(opts?: { activeOnly?: boolean }): Promise<SupplementStackFull[]> {
    const conds: any[] = [];
    if (opts?.activeOnly) conds.push(eq(supplementStacks.active, true));
    const stacks = await (conds.length
      ? db.select().from(supplementStacks).where(and(...conds))
      : db.select().from(supplementStacks)
    ).orderBy(asc(supplementStacks.sortOrder), asc(supplementStacks.name));
    if (stacks.length === 0) return [];
    const items = await db
      .select()
      .from(supplementStackItems)
      .where(inArray(supplementStackItems.stackId, stacks.map((s) => s.id)))
      .orderBy(asc(supplementStackItems.sortOrder), asc(supplementStackItems.name));
    const byStack = new Map<number, SupplementStackItem[]>();
    for (const it of items) {
      const arr = byStack.get(it.stackId) ?? [];
      arr.push(it);
      byStack.set(it.stackId, arr);
    }
    return stacks.map((s) => ({ ...s, items: byStack.get(s.id) ?? [] }));
  }
  async getSupplementStack(id: number): Promise<SupplementStackFull | undefined> {
    const [stack] = await db.select().from(supplementStacks).where(eq(supplementStacks.id, id));
    if (!stack) return undefined;
    const items = await db
      .select()
      .from(supplementStackItems)
      .where(eq(supplementStackItems.stackId, id))
      .orderBy(asc(supplementStackItems.sortOrder), asc(supplementStackItems.name));
    return { ...stack, items };
  }
  async createSupplementStack(data: InsertSupplementStack, createdByUserId: number | null): Promise<SupplementStackFull> {
    return db.transaction(async (tx) => {
      const [stack] = await tx
        .insert(supplementStacks)
        .values({
          name: data.name,
          goal: data.goal,
          description: data.description ?? null,
          notes: data.notes ?? null,
          active: data.active ?? true,
          sortOrder: data.sortOrder ?? 0,
          createdByUserId: createdByUserId ?? null,
        })
        .returning();
      const items = await tx
        .insert(supplementStackItems)
        .values(
          data.items.map((it: StackItemInput, idx: number) => ({
            stackId: stack.id,
            sourceSupplementId: it.sourceSupplementId ?? null,
            name: it.name,
            brand: it.brand ?? null,
            category: it.category,
            dosage: it.dosage,
            unit: it.unit,
            timings: it.timings ?? [],
            trainingDayOnly: it.trainingDayOnly ?? false,
            restDayOnly: it.restDayOnly ?? false,
            notes: it.notes ?? null,
            warnings: it.warnings ?? null,
            sortOrder: it.sortOrder ?? idx,
          })),
        )
        .returning();
      return { ...stack, items };
    });
  }
  async updateSupplementStack(id: number, data: UpdateSupplementStack): Promise<SupplementStackFull | undefined> {
    return db.transaction(async (tx) => {
      const patch: any = { updatedAt: new Date() };
      for (const k of ["name", "goal", "description", "notes", "active", "sortOrder"] as const) {
        if ((data as any)[k] !== undefined) patch[k] = (data as any)[k];
      }
      const [stack] = await tx.update(supplementStacks).set(patch).where(eq(supplementStacks.id, id)).returning();
      if (!stack) return undefined;
      let items: SupplementStackItem[];
      if (data.items) {
        await tx.delete(supplementStackItems).where(eq(supplementStackItems.stackId, id));
        items = await tx
          .insert(supplementStackItems)
          .values(
            data.items.map((it: StackItemInput, idx: number) => ({
              stackId: id,
              sourceSupplementId: it.sourceSupplementId ?? null,
              name: it.name,
              brand: it.brand ?? null,
              category: it.category,
              dosage: it.dosage,
              unit: it.unit,
              timings: it.timings ?? [],
              trainingDayOnly: it.trainingDayOnly ?? false,
              restDayOnly: it.restDayOnly ?? false,
              notes: it.notes ?? null,
              warnings: it.warnings ?? null,
              sortOrder: it.sortOrder ?? idx,
            })),
          )
          .returning();
      } else {
        items = await tx
          .select()
          .from(supplementStackItems)
          .where(eq(supplementStackItems.stackId, id))
          .orderBy(asc(supplementStackItems.sortOrder));
      }
      return { ...stack, items };
    });
  }
  async deleteSupplementStack(id: number): Promise<boolean> {
    const r = await db.delete(supplementStacks).where(eq(supplementStacks.id, id)).returning({ id: supplementStacks.id });
    return r.length > 0;
  }

  // ===== CLIENT SUPPLEMENTS (per-user assignments) =====
  async listClientSupplements(userId: number, opts?: { activeOnly?: boolean }): Promise<ClientSupplement[]> {
    const conds: any[] = [eq(clientSupplements.userId, userId)];
    if (opts?.activeOnly) conds.push(eq(clientSupplements.status, "active"));
    return db
      .select()
      .from(clientSupplements)
      .where(and(...conds))
      .orderBy(asc(clientSupplements.sortOrder), asc(clientSupplements.name));
  }
  async createClientSupplement(data: InsertClientSupplement, assignedByUserId: number | null): Promise<ClientSupplement> {
    const [row] = await db
      .insert(clientSupplements)
      .values({
        userId: data.userId,
        sourceSupplementId: data.sourceSupplementId ?? null,
        sourceStackId: data.sourceStackId ?? null,
        name: data.name,
        brand: data.brand ?? null,
        category: data.category,
        dosage: data.dosage,
        unit: data.unit,
        timings: data.timings ?? [],
        trainingDayOnly: data.trainingDayOnly ?? false,
        restDayOnly: data.restDayOnly ?? false,
        notes: data.notes ?? null,
        warnings: data.warnings ?? null,
        status: data.status ?? "active",
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        sortOrder: data.sortOrder ?? 0,
        assignedByUserId: assignedByUserId ?? null,
      })
      .returning();
    return row;
  }
  async updateClientSupplement(id: number, data: UpdateClientSupplement): Promise<ClientSupplement | undefined> {
    const patch: any = { updatedAt: new Date() };
    for (const k of [
      "sourceSupplementId", "sourceStackId",
      "name", "brand", "category",
      "dosage", "unit", "timings",
      "trainingDayOnly", "restDayOnly",
      "notes", "warnings",
      "status", "startDate", "endDate", "sortOrder",
    ] as const) {
      if ((data as any)[k] !== undefined) patch[k] = (data as any)[k];
    }
    const [row] = await db.update(clientSupplements).set(patch).where(eq(clientSupplements.id, id)).returning();
    return row;
  }
  async deleteClientSupplement(id: number): Promise<boolean> {
    const r = await db.delete(clientSupplements).where(eq(clientSupplements.id, id)).returning({ id: clientSupplements.id });
    return r.length > 0;
  }
  async applyStackToClient(input: ApplyStackToClientInput, assignedByUserId: number | null): Promise<ClientSupplement[]> {
    return db.transaction(async (tx) => {
      const [stack] = await tx.select().from(supplementStacks).where(eq(supplementStacks.id, input.stackId));
      if (!stack) throw new Error("Stack not found");
      const items = await tx
        .select()
        .from(supplementStackItems)
        .where(eq(supplementStackItems.stackId, input.stackId))
        .orderBy(asc(supplementStackItems.sortOrder));
      if (items.length === 0) throw new Error("Stack is empty");
      if (input.replace) {
        await tx.delete(clientSupplements).where(eq(clientSupplements.userId, input.userId));
      }
      const rows = await tx
        .insert(clientSupplements)
        .values(
          items.map((it, idx) => ({
            userId: input.userId,
            sourceSupplementId: it.sourceSupplementId ?? null,
            sourceStackId: input.stackId,
            name: it.name,
            brand: it.brand ?? null,
            category: it.category,
            dosage: it.dosage,
            unit: it.unit,
            timings: it.timings ?? [],
            trainingDayOnly: it.trainingDayOnly,
            restDayOnly: it.restDayOnly,
            notes: it.notes ?? null,
            warnings: it.warnings ?? null,
            status: "active" as const,
            startDate: input.startDate ?? null,
            sortOrder: it.sortOrder ?? idx,
            assignedByUserId: assignedByUserId ?? null,
          })),
        )
        .returning();
      return rows;
    });
  }

  // ===== Task #27 — Foundation helpers (audit log, flags, locations, agreements) =====
  async recordAuditLog(entry: InsertAdminAuditLogEntry): Promise<AdminAuditLogEntry> {
    const [row] = await db
      .insert(adminAuditLog)
      .values({
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId ?? null,
        previousValue: (entry.previousValue ?? null) as any,
        newValue: (entry.newValue ?? null) as any,
        performedByUserId: entry.performedByUserId ?? null,
        reason: entry.reason ?? null,
      })
      .returning();
    return row;
  }

  async getFeatureFlag(key: string): Promise<FeatureFlag | undefined> {
    const [row] = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, key));
    return row;
  }

  async isFeatureEnabled(key: string): Promise<boolean> {
    const row = await this.getFeatureFlag(key);
    if (row) return row.enabled;
    // Fall back to the seeded default so callers behave correctly even if
    // the seed insert hasn't run yet on a freshly-provisioned DB.
    return (FEATURE_FLAG_DEFAULTS as any)[key] ?? false;
  }

  async listFeatureFlags(): Promise<FeatureFlag[]> {
    return db.select().from(featureFlags).orderBy(asc(featureFlags.key));
  }

  async setFeatureFlag(
    key: string,
    enabled: boolean,
    userId: number | null,
  ): Promise<FeatureFlag> {
    const [row] = await db
      .insert(featureFlags)
      .values({
        key,
        enabled,
        updatedByUserId: userId ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: featureFlags.key,
        set: {
          enabled,
          updatedByUserId: userId ?? null,
          updatedAt: new Date(),
        },
      })
      .returning();
    return row;
  }

  async getUserTrainingLocations(userId: number): Promise<TrainingLocation[]> {
    return db
      .select()
      .from(trainingLocations)
      .where(
        and(
          eq(trainingLocations.userId, userId),
          isNull(trainingLocations.archivedAt),
        ),
      )
      .orderBy(desc(trainingLocations.isDefault), asc(trainingLocations.id));
  }

  async getTrainingLocation(id: number): Promise<TrainingLocation | undefined> {
    const [row] = await db.select().from(trainingLocations).where(eq(trainingLocations.id, id));
    return row;
  }

  async createTrainingLocation(input: any): Promise<TrainingLocation> {
    // If this is being marked as the default, demote any existing defaults
    // for the same user so the (user_id, is_default=true) invariant is
    // preserved as a soft business rule even without a partial unique index.
    if (input.isDefault && input.userId) {
      await db
        .update(trainingLocations)
        .set({ isDefault: false })
        .where(
          and(
            eq(trainingLocations.userId, input.userId),
            eq(trainingLocations.isDefault, true),
          ),
        );
    }
    const [row] = await db.insert(trainingLocations).values(input).returning();
    return row;
  }

  async updateTrainingLocation(
    id: number,
    patch: Partial<TrainingLocation>,
  ): Promise<TrainingLocation | undefined> {
    if (patch.isDefault) {
      const existing = await this.getTrainingLocation(id);
      if (existing) {
        await db
          .update(trainingLocations)
          .set({ isDefault: false })
          .where(
            and(
              eq(trainingLocations.userId, existing.userId),
              eq(trainingLocations.isDefault, true),
            ),
          );
      }
    }
    const [row] = await db
      .update(trainingLocations)
      .set(patch as any)
      .where(eq(trainingLocations.id, id))
      .returning();
    return row;
  }

  async archiveTrainingLocation(id: number): Promise<void> {
    await db
      .update(trainingLocations)
      .set({ archivedAt: new Date() })
      .where(eq(trainingLocations.id, id));
  }

  async getPendingVerificationPackages(): Promise<Package[]> {
    return db
      .select()
      .from(packages)
      .where(eq(packages.status, "pending_verification"))
      .orderBy(desc(packages.purchasedAt));
  }

  async getUserPendingVerificationPackages(userId: number): Promise<Package[]> {
    return db
      .select()
      .from(packages)
      .where(
        and(
          eq(packages.userId, userId),
          eq(packages.status, "pending_verification"),
        ),
      )
      .orderBy(desc(packages.purchasedAt));
  }

  // ===== Task #31 — Command Center / Lead Pipeline / Integrity =====
  // All COUNT(*) queries run in parallel. Each query hits an indexed
  // column (see ensureSchema task#31 indexes). Returns a flat counts
  // payload the /admin/command-center widget grid renders.
  async getCommandCenterCounts() {
    const todayStr = new Date().toISOString().slice(0, 10);
    const in7 = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10);
    const ago21 = new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10);

    const q = (text: string, params: any[] = []) =>
      pool.query<{ c: string }>(text, params).then((r) => Number(r.rows[0]?.c ?? 0));

    const [
      sessionsToday,
      pendingFitnessZoneVerifications,
      pendingNutritionRequests,
      pendingRecoveryRequests,
      expiringPackages,
      expiringNutritionPlans,
      frozenPackages,
      failedEmails,
      inactiveClients,
      leadsNeedingFollowUp,
      integrityWarnings,
    ] = await Promise.all([
      q(`SELECT COUNT(*)::text c FROM bookings WHERE date = $1 AND status IN ('upcoming','confirmed','completed')`, [todayStr]),
      q(`SELECT COUNT(*)::text c FROM packages WHERE status = 'pending_verification'`),
      // No dedicated nutrition-request table — count draft nutrition plans
      // pending publish. Treats `status='draft'` as a queue item.
      q(`SELECT COUNT(*)::text c FROM nutrition_plans WHERE status = 'draft'`),
      q(`SELECT COUNT(*)::text c FROM recovery_requests WHERE status = 'pending'`),
      q(`SELECT COUNT(*)::text c FROM packages
           WHERE is_active = true
             AND status IN ('active','expiring_soon')
             AND expiry_date IS NOT NULL
             AND expiry_date::date <= $1::date
             AND expiry_date::date >= $2::date`, [in7, todayStr]),
      q(`SELECT COUNT(*)::text c FROM nutrition_plans
           WHERE status = 'active'
             AND review_date IS NOT NULL
             AND review_date::date <= $1::date
             AND review_date::date >= $2::date`, [in7, todayStr]),
      q(`SELECT COUNT(*)::text c FROM packages WHERE status = 'frozen' OR frozen = true`),
      q(`SELECT COUNT(*)::text c FROM client_notifications
           WHERE channel_email = true
             AND email_attempted_at IS NOT NULL
             AND email_sent_at IS NULL`),
      // Inactive client = active package + no booking in last 21 days.
      q(`SELECT COUNT(DISTINCT u.id)::text c FROM users u
           JOIN packages p ON p.user_id = u.id AND p.is_active = true
            AND COALESCE(p.status,'active') IN ('active','expiring_soon')
           WHERE u.role = 'client'
             AND u.archived_at IS NULL
             AND NOT EXISTS (
               SELECT 1 FROM bookings b
                WHERE b.user_id = u.id AND b.date >= $1
             )`, [ago21]),
      q(`SELECT COUNT(*)::text c FROM users
           WHERE role = 'client'
             AND archived_at IS NULL
             AND lead_status IN ('lead','registered','trial_requested','trial_booked','trial_completed','package_verification_pending')`),
      // Cheap proxy: sum of three high-signal integrity queries. The full
      // breakdown ships from /api/admin/integrity (more expensive but
      // also cached client-side via React Query).
      q(`SELECT (
            (SELECT COUNT(*) FROM packages WHERE used_sessions > total_sessions) +
            (SELECT COUNT(*) FROM packages p WHERE p.status = 'expired' AND EXISTS (
                SELECT 1 FROM bookings b WHERE b.package_id = p.id AND b.date >= CURRENT_DATE
                  AND b.status IN ('upcoming','confirmed')
            )) +
            (SELECT COUNT(*) FROM packages WHERE type = 'duo' AND partner_user_id IS NULL AND is_active = true)
          )::text c`),
    ]);

    return {
      sessionsToday,
      pendingFitnessZoneVerifications,
      pendingNutritionRequests,
      pendingRecoveryRequests,
      expiringPackages,
      expiringNutritionPlans,
      frozenPackages,
      failedEmails,
      inactiveClients,
      leadsNeedingFollowUp,
      integrityWarnings,
    };
  }

  async getLeadPipeline(filters?: { leadStatus?: string; leadSource?: string }) {
    // The 'inactive' filter is *derived* — it has no persisted equivalent
    // (auto-derive intentionally never downgrades to it). Surface it
    // here via SQL so the widget link and the page query agree.
    if (filters?.leadStatus === "inactive") {
      const ago21 = new Date(Date.now() - 21 * 86_400_000).toISOString().slice(0, 10);
      const params: any[] = [ago21];
      let sourceClause = "";
      if (filters?.leadSource) {
        params.push(filters.leadSource);
        sourceClause = ` AND u.lead_source = $${params.length}`;
      }
      const r = await pool.query<any>(
        `SELECT DISTINCT u.*
           FROM users u
           JOIN packages p ON p.user_id = u.id AND p.is_active = true
            AND COALESCE(p.status,'active') IN ('active','expiring_soon')
          WHERE u.role = 'client'
            AND u.archived_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM bookings b WHERE b.user_id = u.id AND b.date >= $1
            )${sourceClause}
          ORDER BY u.created_at DESC
          LIMIT 500`,
        params,
      );
      // Map snake_case rows to the Drizzle camelCase shape expected by the UI.
      return r.rows.map((row: any) => ({
        ...row,
        fullName: row.full_name,
        leadStatus: row.lead_status,
        leadSource: row.lead_source,
        leadStatusManualOverride: row.lead_status_manual_override,
        createdAt: row.created_at,
        archivedAt: row.archived_at,
      })) as any;
    }
    const conds: any[] = [eq(users.role, "client"), isNull(users.archivedAt)];
    if (filters?.leadStatus) conds.push(eq(users.leadStatus, filters.leadStatus));
    if (filters?.leadSource) conds.push(eq(users.leadSource, filters.leadSource));
    return db
      .select()
      .from(users)
      .where(and(...conds))
      .orderBy(desc(users.createdAt))
      .limit(500);
  }

  async markEmailAttempted(notificationId: number): Promise<void> {
    await pool.query(
      `UPDATE client_notifications
          SET email_attempted_at = COALESCE(email_attempted_at, now())
        WHERE id = $1`,
      [notificationId],
    );
  }

  async setLeadStatus(
    userId: number,
    nextStatus: string,
    adminId: number,
    options?: { manualOverride?: boolean; reason?: string },
  ) {
    const existing = await this.getUser(userId);
    if (!existing) return undefined;
    const previousStatus = existing.leadStatus ?? null;
    const manualOverride = options?.manualOverride ?? true;
    const [updated] = await db
      .update(users)
      .set({
        leadStatus: nextStatus,
        leadStatusManualOverride: manualOverride,
      } as any)
      .where(eq(users.id, userId))
      .returning();
    try {
      await this.recordAuditLog({
        action: "client.lead_status.update",
        entityType: "user",
        entityId: userId,
        previousValue: { leadStatus: previousStatus } as any,
        newValue: { leadStatus: nextStatus, manualOverride } as any,
        performedByUserId: adminId,
        reason: options?.reason ?? null,
      } as any);
    } catch {/* swallow — audit is best-effort */}
    return updated;
  }

  // Auto-derivation hook. No-op when:
  //  • admin has pinned a manual override
  //  • user is archived
  //  • next status would be equal to the current status
  // The status is also never *downgraded* automatically (e.g. once a
  // user reaches `pt_active`, registering a new device or resubmitting
  // a verification never knocks them back to `registered`).
  async setLeadStatusAuto(userId: number, nextStatus: string): Promise<void> {
    const u = await this.getUser(userId);
    if (!u) return;
    if (u.leadStatusManualOverride) return;
    if (u.archivedAt) return;
    if (u.leadStatus === nextStatus) return;
    const RANK: Record<string, number> = {
      lead: 0,
      registered: 10,
      trial_requested: 20,
      trial_booked: 30,
      trial_completed: 40,
      package_verification_pending: 45,
      pt_active: 60,
      nutrition_active: 60,
      recovery_active: 55,
      vip: 70,
      inactive: -5,
      archived: -10,
    };
    const cur = u.leadStatus ? RANK[u.leadStatus] ?? 0 : 0;
    const nxt = RANK[nextStatus] ?? 0;
    if (nxt < cur) return;
    await db
      .update(users)
      .set({ leadStatus: nextStatus } as any)
      .where(eq(users.id, userId));
    try {
      await this.recordAuditLog({
        action: "client.lead_status.auto",
        entityType: "user",
        entityId: userId,
        previousValue: { leadStatus: u.leadStatus ?? null } as any,
        newValue: { leadStatus: nextStatus, auto: true } as any,
        performedByUserId: null,
      } as any);
    } catch {/* swallow */}
  }

  // Ten checks. Each category runs an unbounded COUNT(*) for the true
  // total plus a separate LIMIT 50 query for sample rows so the admin
  // sees real numbers (not capped at 50) and can still click through.
  async getIntegrityWarnings() {
    const runCheck = async (
      category: string,
      severity: "info" | "warning" | "critical",
      countSql: string,
      sampleSql: string,
      params: any[] = [],
      showAllLink: string | null = null,
    ) => {
      const [cRes, sRes] = await Promise.all([
        pool.query<{ c: string }>(countSql, params),
        pool.query<any>(sampleSql, params),
      ]);
      const count = Number(cRes.rows[0]?.c ?? 0);
      if (count === 0) return null;
      const samples = (sRes.rows ?? []).map((row: any) => ({
        id: Number(row.id),
        label: String(row.label ?? `#${row.id}`),
        link: String(row.link ?? `/admin/clients/${row.user_id ?? row.id}`),
      }));
      return { category, severity, count, samples, showAllLink };
    };

    const results = await Promise.all([
      runCheck(
        "Packages with used_sessions > total_sessions",
        "critical",
        `SELECT COUNT(*)::text c FROM packages WHERE used_sessions > total_sessions`,
        `SELECT p.id, ('Package #' || p.id || ' — ' || COALESCE(u.full_name,'?')) AS label,
                ('/admin/clients/' || p.user_id) AS link, p.user_id
           FROM packages p LEFT JOIN users u ON u.id = p.user_id
          WHERE p.used_sessions > p.total_sessions
          ORDER BY p.id DESC LIMIT 50`,
        [],
        "/admin/packages",
      ),
      runCheck(
        "Expired packages with future bookings",
        "warning",
        `SELECT COUNT(*)::text c FROM packages p WHERE p.status = 'expired' AND EXISTS (
            SELECT 1 FROM bookings b WHERE b.package_id = p.id
              AND b.date >= CURRENT_DATE AND b.status IN ('upcoming','confirmed')
          )`,
        `SELECT p.id, ('Package #' || p.id || ' — ' || COALESCE(u.full_name,'?')) AS label,
                ('/admin/clients/' || p.user_id) AS link, p.user_id
           FROM packages p LEFT JOIN users u ON u.id = p.user_id
          WHERE p.status = 'expired' AND EXISTS (
            SELECT 1 FROM bookings b WHERE b.package_id = p.id
              AND b.date >= CURRENT_DATE AND b.status IN ('upcoming','confirmed')
          )
          ORDER BY p.id DESC LIMIT 50`,
        [],
        "/admin/packages?status=expired",
      ),
      runCheck(
        "Duo packages with no partner assigned",
        "warning",
        `SELECT COUNT(*)::text c FROM packages
          WHERE type = 'duo' AND partner_user_id IS NULL AND is_active = true`,
        `SELECT p.id, ('Duo package #' || p.id || ' — ' || COALESCE(u.full_name,'?')) AS label,
                ('/admin/clients/' || p.user_id) AS link, p.user_id
           FROM packages p LEFT JOIN users u ON u.id = p.user_id
          WHERE p.type = 'duo' AND p.partner_user_id IS NULL AND p.is_active = true
          ORDER BY p.id DESC LIMIT 50`,
        [],
        "/admin/packages?type=duo",
      ),
      runCheck(
        "Active nutrition plans with no review date",
        "info",
        `SELECT COUNT(*)::text c FROM nutrition_plans
          WHERE status = 'active' AND (review_date IS NULL OR review_date = '')`,
        `SELECT np.id, ('Plan #' || np.id || ' — ' || COALESCE(u.full_name,'?')) AS label,
                ('/admin/nutrition/plans/' || np.id) AS link, np.user_id
           FROM nutrition_plans np LEFT JOIN users u ON u.id = np.user_id
          WHERE np.status = 'active' AND (np.review_date IS NULL OR np.review_date = '')
          ORDER BY np.id DESC LIMIT 50`,
        [],
        "/admin/nutrition/plans",
      ),
      runCheck(
        "Fitness Zone clients with no verified package",
        "warning",
        `SELECT COUNT(*)::text c FROM users u
          WHERE u.role = 'client' AND u.lead_source = 'fitness_zone' AND u.archived_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM packages p
               WHERE p.user_id = u.id AND p.source = 'fitness_zone' AND p.verified_at IS NOT NULL
            )`,
        `SELECT u.id, u.full_name AS label, ('/admin/clients/' || u.id) AS link
           FROM users u
          WHERE u.role = 'client' AND u.lead_source = 'fitness_zone' AND u.archived_at IS NULL
            AND NOT EXISTS (
              SELECT 1 FROM packages p
               WHERE p.user_id = u.id AND p.source = 'fitness_zone' AND p.verified_at IS NOT NULL
            )
          ORDER BY u.id DESC LIMIT 50`,
        [],
        "/admin/leads?leadSource=fitness_zone",
      ),
      runCheck(
        "Bookings with broken package link",
        "critical",
        `SELECT COUNT(*)::text c FROM bookings b
          WHERE b.package_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM packages p WHERE p.id = b.package_id)`,
        `SELECT b.id, ('Booking #' || b.id || ' (' || b.date || ')') AS label,
                ('/admin/bookings') AS link, b.user_id
           FROM bookings b
          WHERE b.package_id IS NOT NULL
            AND NOT EXISTS (SELECT 1 FROM packages p WHERE p.id = b.package_id)
          ORDER BY b.id DESC LIMIT 50`,
        [],
        "/admin/bookings",
      ),
      runCheck(
        "Packages with mismatched session totals",
        "warning",
        `SELECT COUNT(*)::text c FROM packages p
          WHERE p.paid_sessions IS NOT NULL AND p.bonus_sessions IS NOT NULL
            AND (COALESCE(p.paid_sessions,0) + COALESCE(p.bonus_sessions,0)) <> p.total_sessions`,
        `SELECT p.id, ('Package #' || p.id || ' — ' || COALESCE(u.full_name,'?')) AS label,
                ('/admin/clients/' || p.user_id) AS link, p.user_id
           FROM packages p LEFT JOIN users u ON u.id = p.user_id
          WHERE p.paid_sessions IS NOT NULL AND p.bonus_sessions IS NOT NULL
            AND (COALESCE(p.paid_sessions,0) + COALESCE(p.bonus_sessions,0)) <> p.total_sessions
          ORDER BY p.id DESC LIMIT 50`,
        [],
        "/admin/packages",
      ),
      runCheck(
        "Orphaned consent records",
        "info",
        `SELECT COUNT(*)::text c FROM consent_records c
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id)`,
        `SELECT c.id, ('Consent #' || c.id) AS label, '/admin/clients' AS link
           FROM consent_records c
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = c.user_id)
          ORDER BY c.id DESC LIMIT 50`,
        [],
        null,
      ),
      runCheck(
        "Orphaned agreement rows",
        "info",
        `SELECT COUNT(*)::text c FROM agreements a
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id)`,
        `SELECT a.id, ('Agreement #' || a.id) AS label, '/admin/clients' AS link
           FROM agreements a
          WHERE NOT EXISTS (SELECT 1 FROM users u WHERE u.id = a.user_id)
          ORDER BY a.id DESC LIMIT 50`,
        [],
        null,
      ),
      runCheck(
        "Failed email notifications",
        "warning",
        `SELECT COUNT(*)::text c FROM client_notifications n
          WHERE n.channel_email = true
            AND n.email_attempted_at IS NOT NULL
            AND n.email_sent_at IS NULL`,
        `SELECT n.id, ('Notification #' || n.id || ' — ' || n.title) AS label,
                ('/admin/clients/' || n.user_id) AS link, n.user_id
           FROM client_notifications n
          WHERE n.channel_email = true
            AND n.email_attempted_at IS NOT NULL
            AND n.email_sent_at IS NULL
          ORDER BY n.created_at DESC LIMIT 50`,
        [],
        "/admin/integrity?category=failed-emails",
      ),
    ]);

    return results.filter(Boolean) as Array<{
      category: string;
      severity: "info" | "warning" | "critical";
      count: number;
      samples: Array<{ id: number; label: string; link: string }>;
      showAllLink?: string | null;
    }>;
  }


  async recordAgreement(input: InsertAgreement): Promise<Agreement> {
    const [row] = await db
      .insert(agreements)
      .values({
        userId: input.userId,
        agreementType: input.agreementType,
        version: input.version,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      })
      .onConflictDoNothing({
        target: [agreements.userId, agreements.agreementType, agreements.version],
      })
      .returning();
    if (row) return row;
    // Idempotent: return the existing record when the unique index blocks the insert.
    const [existing] = await db
      .select()
      .from(agreements)
      .where(
        and(
          eq(agreements.userId, input.userId),
          eq(agreements.agreementType, input.agreementType),
          eq(agreements.version, input.version),
        ),
      );
    return existing;
  }

  async getUserAgreements(userId: number): Promise<Agreement[]> {
    return db
      .select()
      .from(agreements)
      .where(eq(agreements.userId, userId))
      .orderBy(desc(agreements.acceptedAt));
  }

  async hasUserAcceptedAgreement(
    userId: number,
    agreementType: string,
    version: string,
  ): Promise<boolean> {
    const [row] = await db
      .select({ id: agreements.id })
      .from(agreements)
      .where(
        and(
          eq(agreements.userId, userId),
          eq(agreements.agreementType, agreementType),
          eq(agreements.version, version),
        ),
      )
      .limit(1);
    return !!row;
  }

  async createRecoveryRequest(
    input: InsertRecoveryRequest & { userId: number },
  ): Promise<RecoveryRequest> {
    const [row] = await db
      .insert(recoveryRequests)
      .values({
        userId: input.userId,
        serviceType: input.serviceType,
        notes: input.notes ?? null,
      })
      .returning();
    return row;
  }

  async getRecoveryRequest(id: number): Promise<RecoveryRequest | undefined> {
    const [row] = await db.select().from(recoveryRequests).where(eq(recoveryRequests.id, id));
    return row;
  }

  async listRecoveryRequestsForUser(userId: number): Promise<RecoveryRequest[]> {
    return db
      .select()
      .from(recoveryRequests)
      .where(eq(recoveryRequests.userId, userId))
      .orderBy(desc(recoveryRequests.createdAt));
  }

  async listRecoveryRequests(filters?: { status?: string }): Promise<RecoveryRequest[]> {
    if (filters?.status) {
      return db
        .select()
        .from(recoveryRequests)
        .where(eq(recoveryRequests.status, filters.status))
        .orderBy(desc(recoveryRequests.createdAt));
    }
    return db.select().from(recoveryRequests).orderBy(desc(recoveryRequests.createdAt));
  }

  async updateRecoveryRequest(
    id: number,
    patch: UpdateRecoveryRequest,
  ): Promise<RecoveryRequest | undefined> {
    const updates: any = { updatedAt: new Date() };
    if (patch.status !== undefined) updates.status = patch.status;
    if (patch.scheduledFor !== undefined) {
      updates.scheduledFor = patch.scheduledFor ? new Date(patch.scheduledFor) : null;
    }
    if (patch.assignedAdminId !== undefined) updates.assignedAdminId = patch.assignedAdminId ?? null;
    if (patch.notes !== undefined) updates.notes = patch.notes ?? null;
    const [row] = await db
      .update(recoveryRequests)
      .set(updates)
      .where(eq(recoveryRequests.id, id))
      .returning();
    return row;
  }
}

// =====================================================================
// P4a — BODY METRICS (Progress Tracking)
// Mounted on the prototype below so `storage.listBodyMetrics(...)` etc.
// resolve without restructuring the existing class. Keeping all storage
// surfaces on a single instance is the project convention.
// =====================================================================
declare module "./storage" {
  interface DatabaseStorage {
    listBodyMetrics(userId: number, opts?: { limit?: number }): Promise<BodyMetric[]>;
    getBodyMetric(id: number): Promise<BodyMetric | undefined>;
    createBodyMetric(input: InsertBodyMetric, loggedByUserId: number | null): Promise<BodyMetric>;
    updateBodyMetric(id: number, patch: UpdateBodyMetric): Promise<BodyMetric | undefined>;
    deleteBodyMetric(id: number): Promise<boolean>;
  }
}

(DatabaseStorage.prototype as any).listBodyMetrics = async function (
  userId: number,
  opts?: { limit?: number },
): Promise<BodyMetric[]> {
  const q = db
    .select()
    .from(bodyMetrics)
    .where(eq(bodyMetrics.userId, userId))
    .orderBy(desc(bodyMetrics.recordedOn), desc(bodyMetrics.id));
  return opts?.limit ? q.limit(opts.limit) : q;
};
(DatabaseStorage.prototype as any).getBodyMetric = async function (
  id: number,
): Promise<BodyMetric | undefined> {
  const [row] = await db.select().from(bodyMetrics).where(eq(bodyMetrics.id, id));
  return row;
};
(DatabaseStorage.prototype as any).createBodyMetric = async function (
  input: InsertBodyMetric,
  loggedByUserId: number | null,
): Promise<BodyMetric> {
  const [row] = await db
    .insert(bodyMetrics)
    .values({
      userId: input.userId,
      recordedOn: input.recordedOn,
      weight: input.weight ?? null,
      bodyFat: input.bodyFat ?? null,
      neck: input.neck ?? null,
      shoulders: input.shoulders ?? null,
      chest: input.chest ?? null,
      arms: input.arms ?? null,
      waist: input.waist ?? null,
      hips: input.hips ?? null,
      thighs: input.thighs ?? null,
      calves: input.calves ?? null,
      notes: input.notes ?? null,
      loggedByUserId: loggedByUserId ?? null,
    })
    .returning();
  return row;
};
(DatabaseStorage.prototype as any).updateBodyMetric = async function (
  id: number,
  patch: UpdateBodyMetric,
): Promise<BodyMetric | undefined> {
  const update: any = { updatedAt: new Date() };
  for (const k of [
    "recordedOn", "weight", "bodyFat",
    "neck", "shoulders", "chest", "arms",
    "waist", "hips", "thighs", "calves",
    "notes",
  ] as const) {
    if ((patch as any)[k] !== undefined) update[k] = (patch as any)[k];
  }
  const [row] = await db.update(bodyMetrics).set(update).where(eq(bodyMetrics.id, id)).returning();
  return row;
};
(DatabaseStorage.prototype as any).deleteBodyMetric = async function (
  id: number,
): Promise<boolean> {
  const r = await db.delete(bodyMetrics).where(eq(bodyMetrics.id, id)).returning({ id: bodyMetrics.id });
  return r.length > 0;
};

// =====================================================================
// P4b — WEEKLY CHECK-INS
// Same prototype-mount pattern as body metrics. Storage layer is dumb;
// adherence/streak math lives in the UI to keep this surface trivially
// cacheable + testable.
// =====================================================================
declare module "./storage" {
  interface DatabaseStorage {
    listWeeklyCheckins(userId: number, opts?: { limit?: number }): Promise<WeeklyCheckin[]>;
    getWeeklyCheckin(id: number): Promise<WeeklyCheckin | undefined>;
    getWeeklyCheckinByWeek(userId: number, weekStart: string): Promise<WeeklyCheckin | undefined>;
    createWeeklyCheckin(input: InsertWeeklyCheckin): Promise<WeeklyCheckin>;
    updateWeeklyCheckin(
      id: number,
      patch: UpdateWeeklyCheckin,
      adminCoachUserId?: number | null,
    ): Promise<WeeklyCheckin | undefined>;
    deleteWeeklyCheckin(id: number): Promise<boolean>;
    listPendingWeeklyCheckins(): Promise<WeeklyCheckin[]>;
  }
}

(DatabaseStorage.prototype as any).listWeeklyCheckins = async function (
  userId: number,
  opts?: { limit?: number },
): Promise<WeeklyCheckin[]> {
  const q = db
    .select()
    .from(weeklyCheckins)
    .where(eq(weeklyCheckins.userId, userId))
    .orderBy(desc(weeklyCheckins.weekStart), desc(weeklyCheckins.id));
  return opts?.limit ? q.limit(opts.limit) : q;
};
(DatabaseStorage.prototype as any).getWeeklyCheckin = async function (id: number) {
  const [row] = await db.select().from(weeklyCheckins).where(eq(weeklyCheckins.id, id));
  return row;
};
(DatabaseStorage.prototype as any).getWeeklyCheckinByWeek = async function (
  userId: number,
  weekStart: string,
) {
  const [row] = await db
    .select()
    .from(weeklyCheckins)
    .where(and(eq(weeklyCheckins.userId, userId), eq(weeklyCheckins.weekStart, weekStart)));
  return row;
};
(DatabaseStorage.prototype as any).createWeeklyCheckin = async function (
  input: InsertWeeklyCheckin,
): Promise<WeeklyCheckin> {
  const [row] = await db
    .insert(weeklyCheckins)
    .values({
      userId: input.userId,
      weekStart: input.weekStart,
      weight: input.weight ?? null,
      sleepQuality: input.sleepQuality ?? null,
      energy: input.energy ?? null,
      stress: input.stress ?? null,
      hunger: input.hunger ?? null,
      digestion: input.digestion ?? null,
      mood: input.mood ?? null,
      cardioAdherence: input.cardioAdherence ?? null,
      trainingAdherence: input.trainingAdherence ?? null,
      waterLitres: input.waterLitres ?? null,
      notes: input.notes ?? null,
    })
    .returning();
  return row;
};
(DatabaseStorage.prototype as any).updateWeeklyCheckin = async function (
  id: number,
  patch: UpdateWeeklyCheckin,
  adminCoachUserId?: number | null,
): Promise<WeeklyCheckin | undefined> {
  const update: any = { updatedAt: new Date() };
  for (const k of [
    "weight", "sleepQuality", "energy", "stress", "hunger", "digestion",
    "mood", "cardioAdherence", "trainingAdherence", "waterLitres", "notes",
  ] as const) {
    if ((patch as any)[k] !== undefined) update[k] = (patch as any)[k];
  }
  // coachResponse is admin-only at the route layer. When provided, also
  // stamp the responder + timestamp so the UI can render attribution.
  if ((patch as any).coachResponse !== undefined) {
    update.coachResponse = (patch as any).coachResponse;
    update.coachRespondedAt = (patch as any).coachResponse ? new Date() : null;
    update.coachRespondedByUserId = (patch as any).coachResponse ? (adminCoachUserId ?? null) : null;
  }
  const [row] = await db
    .update(weeklyCheckins)
    .set(update)
    .where(eq(weeklyCheckins.id, id))
    .returning();
  return row;
};
(DatabaseStorage.prototype as any).deleteWeeklyCheckin = async function (id: number) {
  const r = await db
    .delete(weeklyCheckins)
    .where(eq(weeklyCheckins.id, id))
    .returning({ id: weeklyCheckins.id });
  return r.length > 0;
};
(DatabaseStorage.prototype as any).listPendingWeeklyCheckins = async function () {
  return db
    .select()
    .from(weeklyCheckins)
    .where(sql`${weeklyCheckins.coachResponse} IS NULL`)
    .orderBy(desc(weeklyCheckins.weekStart), desc(weeklyCheckins.id));
};

// =====================================================================
// Task #43 — Admin Control Panel storage methods
// Isolated from main IStorage to keep blast radius zero. Callers reach
// these via `(storage as any).methodName(...)` or via the concrete class
// (which DatabaseStorage exposes inherently).
// =====================================================================
(DatabaseStorage.prototype as any).listAdminTasks = async function (
  filters?: { status?: string; relatedUserId?: number },
): Promise<AdminTask[]> {
  const conds = [] as any[];
  if (filters?.status) conds.push(eq(adminTasks.status, filters.status));
  if (filters?.relatedUserId) conds.push(eq(adminTasks.relatedUserId, filters.relatedUserId));
  const q = db.select().from(adminTasks);
  const rows = conds.length ? await q.where(and(...conds)).orderBy(desc(adminTasks.createdAt))
                            : await q.orderBy(desc(adminTasks.createdAt));
  return rows;
};
(DatabaseStorage.prototype as any).createAdminTask = async function (
  data: InsertAdminTask,
): Promise<AdminTask> {
  const [row] = await db.insert(adminTasks).values(data).returning();
  return row;
};
(DatabaseStorage.prototype as any).updateAdminTask = async function (
  id: number,
  patch: UpdateAdminTask,
): Promise<AdminTask | undefined> {
  const [row] = await db
    .update(adminTasks)
    .set({ ...patch, updatedAt: new Date() } as any)
    .where(eq(adminTasks.id, id))
    .returning();
  return row;
};
(DatabaseStorage.prototype as any).deleteAdminTask = async function (id: number): Promise<boolean> {
  const r = await db.delete(adminTasks).where(eq(adminTasks.id, id)).returning({ id: adminTasks.id });
  return r.length > 0;
};

(DatabaseStorage.prototype as any).listClientTags = async function (userId?: number): Promise<ClientTag[]> {
  const q = db.select().from(clientTags);
  return userId ? await q.where(eq(clientTags.userId, userId)).orderBy(asc(clientTags.label))
                : await q.orderBy(asc(clientTags.userId), asc(clientTags.label));
};
(DatabaseStorage.prototype as any).addClientTag = async function (data: InsertClientTag): Promise<ClientTag | null> {
  try {
    const [row] = await db.insert(clientTags).values(data).returning();
    return row;
  } catch (err: any) {
    // unique violation — tag already exists for that user; treat as idempotent no-op
    if (err?.code === '23505') return null;
    throw err;
  }
};
(DatabaseStorage.prototype as any).removeClientTag = async function (id: number): Promise<boolean> {
  const r = await db.delete(clientTags).where(eq(clientTags.id, id)).returning({ id: clientTags.id });
  return r.length > 0;
};

(DatabaseStorage.prototype as any).getAdminNotificationPrefs = async function (adminUserId: number) {
  const [row] = await db.select().from(adminNotificationPrefs).where(eq(adminNotificationPrefs.adminUserId, adminUserId));
  return row?.prefs ?? {};
};
(DatabaseStorage.prototype as any).setAdminNotificationPrefs = async function (
  adminUserId: number,
  prefs: Record<string, boolean>,
) {
  await db.execute(sql`
    INSERT INTO admin_notification_prefs (admin_user_id, prefs, updated_at)
    VALUES (${adminUserId}, ${JSON.stringify(prefs)}::jsonb, now())
    ON CONFLICT (admin_user_id) DO UPDATE
      SET prefs = EXCLUDED.prefs, updated_at = now()
  `);
  return prefs;
};

(DatabaseStorage.prototype as any).listSavedFilters = async function (
  ownerId: number,
  page?: string,
): Promise<AdminSavedFilter[]> {
  const conds = [eq(adminSavedFilters.ownerUserId, ownerId)];
  if (page) conds.push(eq(adminSavedFilters.page, page));
  return db.select().from(adminSavedFilters).where(and(...conds)).orderBy(desc(adminSavedFilters.createdAt));
};
(DatabaseStorage.prototype as any).createSavedFilter = async function (
  ownerId: number,
  data: InsertSavedFilter,
): Promise<AdminSavedFilter> {
  const [row] = await db.insert(adminSavedFilters).values({ ...data, ownerUserId: ownerId } as any).returning();
  return row;
};
(DatabaseStorage.prototype as any).deleteSavedFilter = async function (id: number, ownerId: number): Promise<boolean> {
  const r = await db
    .delete(adminSavedFilters)
    .where(and(eq(adminSavedFilters.id, id), eq(adminSavedFilters.ownerUserId, ownerId)))
    .returning({ id: adminSavedFilters.id });
  return r.length > 0;
};

(DatabaseStorage.prototype as any).listTrainerAssignments = async function (trainerUserId?: number): Promise<TrainerAssignment[]> {
  const q = db.select().from(trainerAssignments);
  return trainerUserId
    ? await q.where(eq(trainerAssignments.trainerUserId, trainerUserId)).orderBy(desc(trainerAssignments.createdAt))
    : await q.orderBy(desc(trainerAssignments.createdAt));
};
(DatabaseStorage.prototype as any).addTrainerAssignment = async function (trainerUserId: number, clientUserId: number) {
  try {
    const [row] = await db.insert(trainerAssignments).values({ trainerUserId, clientUserId }).returning();
    return row;
  } catch (err: any) {
    if (err?.code === '23505') return null;
    throw err;
  }
};
(DatabaseStorage.prototype as any).removeTrainerAssignment = async function (id: number): Promise<boolean> {
  const r = await db.delete(trainerAssignments).where(eq(trainerAssignments.id, id)).returning({ id: trainerAssignments.id });
  return r.length > 0;
};

(DatabaseStorage.prototype as any).listAdminAuditEntries = async function (limit = 200): Promise<AdminAuditLogEntry[]> {
  return db.select().from(adminAuditLog).orderBy(desc(adminAuditLog.createdAt)).limit(limit);
};

// Task #57 — paginated audit-log query for the global Audit page and
// the per-client Timeline tab. Both filters are OR-able and optional:
// pass `userId` to scope to a single client (matches rows whose
// entityType='user' & entityId=userId OR whose newValue/previousValue
// JSON contains "userId":N), or `entityType` for a coarser slice.
(DatabaseStorage.prototype as any).listAuditEntries = async function (opts: {
  userId?: number;
  entityType?: string;
  limit?: number;
  offset?: number;
}): Promise<AdminAuditLogEntry[]> {
  const limit = Math.min(Math.max(opts.limit ?? 100, 1), 500);
  const offset = Math.max(opts.offset ?? 0, 0);
  const where: any[] = [];
  if (opts.entityType) where.push(eq(adminAuditLog.entityType, opts.entityType));
  if (opts.userId != null) {
    where.push(
      sql`(
        (${adminAuditLog.entityType} = 'user' AND ${adminAuditLog.entityId} = ${opts.userId})
        OR ${adminAuditLog.newValue}::jsonb->>'userId' = ${String(opts.userId)}
        OR ${adminAuditLog.previousValue}::jsonb->>'userId' = ${String(opts.userId)}
      )`,
    );
  }
  const q = db.select().from(adminAuditLog);
  const qFiltered = where.length > 0 ? q.where(and(...where)) : q;
  return qFiltered
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(limit)
    .offset(offset);
};

// =====================================================================
// Task #73 — DAILY CHECK-INS (Recovery readiness)
// Prototype-mount pattern; upsert via ON CONFLICT against the
// (user_id, date) unique index. All fields are nullable so partial
// submissions are valid.
// =====================================================================
declare module "./storage" {
  interface DatabaseStorage {
    getDailyCheckin(userId: number, date: string): Promise<DailyCheckin | undefined>;
    listRecentDailyCheckins(userId: number, limit?: number): Promise<DailyCheckin[]>;
    upsertDailyCheckin(input: InsertDailyCheckin): Promise<DailyCheckin>;
  }
}

(DatabaseStorage.prototype as any).getDailyCheckin = async function (
  userId: number,
  date: string,
): Promise<DailyCheckin | undefined> {
  const [row] = await db
    .select()
    .from(dailyCheckins)
    .where(and(eq(dailyCheckins.userId, userId), eq(dailyCheckins.date, date)));
  return row;
};

(DatabaseStorage.prototype as any).listRecentDailyCheckins = async function (
  userId: number,
  limit = 14,
): Promise<DailyCheckin[]> {
  return db
    .select()
    .from(dailyCheckins)
    .where(eq(dailyCheckins.userId, userId))
    .orderBy(desc(dailyCheckins.date), desc(dailyCheckins.id))
    .limit(limit);
};

(DatabaseStorage.prototype as any).upsertDailyCheckin = async function (
  input: InsertDailyCheckin,
): Promise<DailyCheckin> {
  const [row] = await db
    .insert(dailyCheckins)
    .values({
      userId: input.userId,
      date: input.date,
      sleepHours: input.sleepHours ?? null,
      waterLiters: input.waterLiters ?? null,
      recoveryScore: input.recoveryScore ?? null,
      energyScore: input.energyScore ?? null,
    })
    .onConflictDoUpdate({
      target: [dailyCheckins.userId, dailyCheckins.date],
      set: {
        sleepHours: input.sleepHours ?? null,
        waterLiters: input.waterLiters ?? null,
        recoveryScore: input.recoveryScore ?? null,
        energyScore: input.energyScore ?? null,
      },
    })
    .returning();
  return row;
};

// ===== Task #111 — Payments implementation =====
declare module "./storage" {
  interface DatabaseStorage {
    getPayments(filters?: {
      userId?: number;
      status?: string;
      method?: string;
      from?: string;
      to?: string;
      search?: string;
      limit?: number;
      offset?: number;
    }): Promise<Array<Payment & { user: Pick<User, "id" | "fullName" | "email"> | null; package: { id: number; name: string | null; type: string | null } | null }>>;
    getPayment(id: number): Promise<Payment | undefined>;
    createPayment(input: InsertPayment): Promise<Payment>;
    updatePayment(id: number, updates: Partial<Payment>): Promise<Payment>;
    deletePayment(id: number): Promise<void>;
    getPaymentsSummary(): Promise<{
      totalReceived: number;
      totalPending: number;
      countThisMonth: number;
    }>;
  }
}

(DatabaseStorage.prototype as any).getPayments = async function (
  filters: {
    userId?: number;
    status?: string;
    method?: string;
    from?: string;
    to?: string;
    search?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<Array<Payment & { user: Pick<User, "id" | "fullName" | "email"> | null; package: { id: number; name: string | null; type: string | null } | null }>> {
  const conditions: any[] = [];
  if (filters.userId) conditions.push(eq(payments.userId, filters.userId));
  if (filters.status) conditions.push(eq(payments.status, filters.status));
  if (filters.method) conditions.push(eq(payments.method, filters.method));
  if (filters.from) conditions.push(gte(payments.createdAt, new Date(filters.from)));
  if (filters.to) {
    const toDate = new Date(filters.to);
    toDate.setDate(toDate.getDate() + 1);
    conditions.push(lte(payments.createdAt, toDate));
  }
  if (filters.search) {
    const s = `%${filters.search}%`;
    conditions.push(
      sql`(${users.fullName} ILIKE ${s} OR ${users.email} ILIKE ${s} OR ${payments.receiptReference} ILIKE ${s})`,
    );
  }

  const rows = await db
    .select({
      payment: payments,
      userId: users.id,
      fullName: users.fullName,
      email: users.email,
      pkgId: packages.id,
      pkgName: packages.name,
      pkgType: packages.type,
    })
    .from(payments)
    .leftJoin(users, eq(payments.userId, users.id))
    .leftJoin(packages, eq(payments.packageId, packages.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(payments.createdAt))
    .limit(filters.limit ?? 500)
    .offset(filters.offset ?? 0);

  return rows.map((r) => ({
    ...r.payment,
    user: r.userId ? { id: r.userId, fullName: r.fullName ?? "", email: r.email } : null,
    package: r.pkgId ? { id: r.pkgId, name: r.pkgName ?? null, type: r.pkgType } : null,
  }));
};

(DatabaseStorage.prototype as any).getPayment = async function (
  id: number,
): Promise<Payment | undefined> {
  const [row] = await db.select().from(payments).where(eq(payments.id, id));
  return row;
};

(DatabaseStorage.prototype as any).createPayment = async function (
  input: InsertPayment,
): Promise<Payment> {
  const [row] = await db
    .insert(payments)
    .values({
      userId: input.userId,
      packageId: input.packageId ?? null,
      amount: input.amount,
      status: input.status ?? "pending",
      method: input.method ?? "cash",
      receiptReference: input.receiptReference ?? null,
      notes: input.notes ?? null,
      paidAt: input.paidAt ? new Date(input.paidAt as string) : null,
    })
    .returning();
  return row;
};

(DatabaseStorage.prototype as any).updatePayment = async function (
  id: number,
  updates: Partial<Payment>,
): Promise<Payment> {
  const patch: Record<string, any> = {};
  if (updates.status !== undefined) patch.status = updates.status;
  if (updates.method !== undefined) patch.method = updates.method;
  if (updates.amount !== undefined) patch.amount = updates.amount;
  if (updates.packageId !== undefined) patch.packageId = updates.packageId;
  if (updates.receiptReference !== undefined) patch.receiptReference = updates.receiptReference;
  if (updates.notes !== undefined) patch.notes = updates.notes;
  if (updates.paidAt !== undefined) patch.paidAt = updates.paidAt;
  const [row] = await db
    .update(payments)
    .set(patch)
    .where(eq(payments.id, id))
    .returning();
  if (!row) throw new Error(`Payment ${id} not found`);
  return row;
};

(DatabaseStorage.prototype as any).deletePayment = async function (id: number): Promise<void> {
  await db.delete(payments).where(eq(payments.id, id));
};

(DatabaseStorage.prototype as any).getPaymentsSummary = async function (): Promise<{
  totalReceived: number;
  totalPending: number;
  countThisMonth: number;
}> {
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(CASE WHEN status = 'received' THEN amount ELSE 0 END), 0)::int AS total_received,
      COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)::int  AS total_pending,
      COUNT(CASE WHEN created_at >= ${monthStart.toISOString()} AND created_at < ${monthEnd.toISOString()} THEN 1 END)::int AS count_this_month
    FROM payments
  `);
  const rows = (result as any).rows ?? (result as any);
  const summary = Array.isArray(rows) ? rows[0] : {};

  return {
    totalReceived: Number((summary as any).total_received ?? 0),
    totalPending: Number((summary as any).total_pending ?? 0),
    countThisMonth: Number((summary as any).count_this_month ?? 0),
  };
};

export const storage = new DatabaseStorage();
