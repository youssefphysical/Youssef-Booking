import { db, pool } from "./db";
import {
  users, bookings, settings, blockedSlots,
  type User, type InsertUser, type UpdateProfile,
  type Booking, type InsertBooking, type UpdateBooking,
  type Settings, type UpdateSettings,
  type BlockedSlot, type InsertBlockedSlot,
} from "@shared/schema";
import { eq, and, gte, desc, asc, sql } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: UpdateProfile & { password?: string }): Promise<User>;
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

  // Blocked Slots
  getBlockedSlots(): Promise<BlockedSlot[]>;
  createBlockedSlot(slot: InsertBlockedSlot): Promise<BlockedSlot>;
  deleteBlockedSlot(id: number): Promise<void>;

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

  // Users
  async getUser(id: number): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.id, id));
    return u;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.username, username));
    return u;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [u] = await db.select().from(users).where(eq(users.email, email));
    return u;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [u] = await db.insert(users).values(insertUser).returning();
    return u;
  }

  async updateUser(
    id: number,
    updates: UpdateProfile & { password?: string },
  ): Promise<User> {
    const [u] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return u;
  }

  async getAllClients(): Promise<User[]> {
    return db
      .select()
      .from(users)
      .where(eq(users.role, "client"))
      .orderBy(desc(users.createdAt));
  }

  // Bookings
  async getBookings(filters?: { userId?: number; from?: string }): Promise<Booking[]> {
    const conds = [];
    if (filters?.userId) conds.push(eq(bookings.userId, filters.userId));
    if (filters?.from) conds.push(gte(bookings.date, filters.from));
    if (conds.length > 0) {
      return db
        .select()
        .from(bookings)
        .where(and(...conds))
        .orderBy(asc(bookings.date), asc(bookings.timeSlot));
    }
    return db.select().from(bookings).orderBy(asc(bookings.date), asc(bookings.timeSlot));
  }

  async getBooking(id: number): Promise<Booking | undefined> {
    const [b] = await db.select().from(bookings).where(eq(bookings.id, id));
    return b;
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [b] = await db.insert(bookings).values(booking).returning();
    return b;
  }

  async updateBooking(id: number, updates: Partial<Booking>): Promise<Booking> {
    const [b] = await db
      .update(bookings)
      .set(updates)
      .where(eq(bookings.id, id))
      .returning();
    return b;
  }

  async deleteBooking(id: number): Promise<void> {
    await db.delete(bookings).where(eq(bookings.id, id));
  }

  async getBookingByDateAndSlot(date: string, timeSlot: string): Promise<Booking | undefined> {
    const [b] = await db
      .select()
      .from(bookings)
      .where(and(eq(bookings.date, date), eq(bookings.timeSlot, timeSlot)));
    return b;
  }

  // Settings
  async getSettings(): Promise<Settings> {
    const [s] = await db.select().from(settings).limit(1);
    if (s) return s;
    const [created] = await db.insert(settings).values({}).returning();
    return created;
  }

  async updateSettings(updates: UpdateSettings): Promise<Settings> {
    const current = await this.getSettings();
    const [updated] = await db
      .update(settings)
      .set(updates)
      .where(eq(settings.id, current.id))
      .returning();
    return updated;
  }

  // Blocked slots
  async getBlockedSlots(): Promise<BlockedSlot[]> {
    return db.select().from(blockedSlots).orderBy(asc(blockedSlots.date));
  }

  async createBlockedSlot(slot: InsertBlockedSlot): Promise<BlockedSlot> {
    const [b] = await db.insert(blockedSlots).values(slot).returning();
    return b;
  }

  async deleteBlockedSlot(id: number): Promise<void> {
    await db.delete(blockedSlots).where(eq(blockedSlots.id, id));
  }
}

export const storage = new DatabaseStorage();
