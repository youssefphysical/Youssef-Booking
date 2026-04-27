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
} from "@shared/schema";
import { eq, and, gte, desc, asc, isNull } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  getAllClients(): Promise<User[]>;

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

  sessionStore: session.Store;
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
    const pkg = await this.getPackage(id);
    if (!pkg) throw new Error("Package not found");
    const newUsed = Math.min(pkg.totalSessions, pkg.usedSessions + by);
    return this.updatePackage(id, { usedSessions: newUsed });
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
}

export const storage = new DatabaseStorage();
