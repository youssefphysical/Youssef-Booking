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
  renewalRequests,
  extensionRequests,
  packageSessionHistory,
  foods,
  meals,
  mealItems,
  type Food,
  type InsertFood,
  type UpdateFood,
  type Meal,
  type MealItem,
  type MealItemInput,
  type InsertMeal,
  type UpdateMeal,
  type MealWithItems,
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
  type RenewalRequest,
  type InsertRenewalRequest,
  type ExtensionRequest,
  type InsertExtensionRequest,
  type PackageSessionHistory,
  type InsertPackageSessionHistory,
} from "@shared/schema";
import { eq, and, gte, gt, desc, asc, isNull, inArray, ilike, sql } from "drizzle-orm";
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
  getAllAdmins(): Promise<User[]>;
  /**
   * Batched lookup for the verified-badge flag. Returns a Map keyed by userId
   * so callers can enrich a list of users without N+1 queries.
   */
  getVerificationFlagsForUsers(
    userIds: number[],
  ): Promise<Map<number, { hasInbody: boolean; hasCompletedSession: boolean }>>;

  // Bookings
  getBookings(filters?: { userId?: number; from?: string }): Promise<Booking[]>;
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

  // Package session-history audit log
  getPackageSessionHistory(filters?: {
    userId?: number;
    packageId?: number;
    limit?: number;
  }): Promise<PackageSessionHistory[]>;
  createPackageSessionHistory(entry: InsertPackageSessionHistory): Promise<PackageSessionHistory>;

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const expiry = new Date(pkg.expiryDate as any);
    if (isFinite(expiry.getTime())) {
      const diffMs = expiry.getTime() - today.getTime();
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
      createTableIfMissing: true,
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
    const [u] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return u;
  }

  async getAllClients() {
    return db
      .select()
      .from(users)
      .where(eq(users.role, "client"))
      .orderBy(desc(users.createdAt));
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
  async getBookings(filters?: { userId?: number; from?: string }) {
    const conds: any[] = [];
    if (filters?.userId) conds.push(eq(bookings.userId, filters.userId));
    if (filters?.from) conds.push(gte(bookings.date, filters.from));
    const q =
      conds.length > 0
        ? db.select().from(bookings).where(and(...conds))
        : db.select().from(bookings);
    return q.orderBy(asc(bookings.date), asc(bookings.timeSlot));
  }

  async getBooking(id: number) {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
    return b;
  }

  async createBooking(booking: InsertBooking) {
    const [b] = await db.insert(bookings).values(booking).returning();
    return b;
  }

  async updateBooking(id: number, updates: Partial<Booking>) {
    const [b] = await db.update(bookings).set(updates).where(eq(bookings.id, id)).returning();
    return b;
  }

  async deleteBooking(id: number) {
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  async getBookingByDateAndSlot(date: string, timeSlot: string) {
    const [b] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.date, date), eq(bookings.timeSlot, timeSlot)));
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
    const [updated] = await db
      .update(settings)
      .set(updates)
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
}

export const storage = new DatabaseStorage();
