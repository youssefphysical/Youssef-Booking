import { db, pool } from "./db";
import {
  users,
  bookings,
  settings,
  blockedSlots,
  packages,
  inbodyRecords,
  progressPhotos,
  consentRecords,
  heroImages,
  adminNotifications,
  renewalRequests,
  extensionRequests,
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
  type InbodyRecord,
  type InsertInbody,
  type UpdateInbody,
  type ProgressPhoto,
  type InsertProgressPhoto,
  type ConsentRecord,
  type InsertConsent,
  type HeroImage,
  type InsertHeroImage,
  type AdminNotification,
  type InsertAdminNotification,
  type RenewalRequest,
  type InsertRenewalRequest,
  type ExtensionRequest,
  type InsertExtensionRequest,
} from "@shared/schema";
import { eq, and, gte, gt, desc, asc, isNull, inArray } from "drizzle-orm";
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
  updateHeroImageOrder(id: number, sortOrder: number): Promise<HeroImage>;
  deleteHeroImage(id: number): Promise<void>;

  // Packages
  getPackages(filters?: { userId?: number; activeOnly?: boolean }): Promise<Package[]>;
  getPackage(id: number): Promise<Package | undefined>;
  getActivePackageForUser(userId: number): Promise<Package | undefined>;
  createPackage(pkg: InsertPackage): Promise<Package>;
  updatePackage(id: number, updates: Partial<Package>): Promise<Package>;
  deletePackage(id: number): Promise<void>;
  incrementPackageUsage(id: number, by?: number): Promise<Package>;
  decrementPackageUsage(id: number, by?: number): Promise<Package>;

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

  async deleteHeroImage(id: number) {
    await db.delete(heroImages).where(eq(heroImages.id, id));
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
