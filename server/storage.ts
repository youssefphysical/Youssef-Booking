import { db } from "./db";
import { 
  users, packages, bookings, payments, nutritionPlans, intakeLogs,
  type User, type InsertUser, type UpdateUserRequest,
  type Package, type InsertPackage, type UpdatePackageRequest,
  type Booking, type InsertBooking, type UpdateBookingRequest,
  type Payment, type InsertPayment, type UpdatePaymentRequest,
  type NutritionPlan, type InsertNutritionPlan,
  type IntakeLog, type InsertIntakeLog
} from "@shared/schema";
import { eq, desc, and, gte } from "drizzle-orm";
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

export interface IStorage {
  // Auth & Users
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: UpdateUserRequest): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Packages
  getPackages(): Promise<Package[]>;
  createPackage(pkg: InsertPackage): Promise<Package>;
  updatePackage(id: number, updates: UpdatePackageRequest): Promise<Package>;

  // Bookings
  getBookings(userId?: number, fromDate?: string): Promise<Booking[]>;
  createBooking(booking: InsertBooking): Promise<Booking>;
  updateBooking(id: number, updates: UpdateBookingRequest): Promise<Booking>;

  // Payments
  getPayments(): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  updatePayment(id: number, updates: UpdatePaymentRequest): Promise<Payment>;

  // Nutrition
  getNutritionPlans(userId?: number): Promise<NutritionPlan[]>;
  createNutritionPlan(plan: InsertNutritionPlan): Promise<NutritionPlan>;
  getIntakeLogs(userId?: number, date?: string): Promise<IntakeLog[]>;
  createIntakeLog(log: InsertIntakeLog): Promise<IntakeLog>;

  // Session Store
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
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(users).values(insertUser).returning();
    return user;
  }

  async updateUser(id: number, updates: UpdateUserRequest): Promise<User> {
    const [user] = await db.update(users).set(updates).where(eq(users.id, id)).returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users).orderBy(desc(users.createdAt));
  }

  // Packages
  async getPackages(): Promise<Package[]> {
    return db.select().from(packages).where(eq(packages.isActive, true));
  }

  async createPackage(pkg: InsertPackage): Promise<Package> {
    const [newPkg] = await db.insert(packages).values(pkg).returning();
    return newPkg;
  }

  async updatePackage(id: number, updates: UpdatePackageRequest): Promise<Package> {
    const [pkg] = await db.update(packages).set(updates).where(eq(packages.id, id)).returning();
    return pkg;
  }

  // Bookings
  async getBookings(userId?: number, fromDate?: string): Promise<Booking[]> {
    let query = db.select().from(bookings).orderBy(desc(bookings.date));
    
    if (userId) {
      if (fromDate) {
        // @ts-ignore
        query = query.where(and(eq(bookings.userId, userId), gte(bookings.date, fromDate)));
      } else {
        // @ts-ignore
        query = query.where(eq(bookings.userId, userId));
      }
    }
    
    return query;
  }

  async createBooking(booking: InsertBooking): Promise<Booking> {
    const [newBooking] = await db.insert(bookings).values(booking).returning();
    return newBooking;
  }

  async updateBooking(id: number, updates: UpdateBookingRequest): Promise<Booking> {
    const [booking] = await db.update(bookings).set(updates).where(eq(bookings.id, id)).returning();
    return booking;
  }

  // Payments
  async getPayments(): Promise<Payment[]> {
    return db.select().from(payments).orderBy(desc(payments.createdAt));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const [newPayment] = await db.insert(payments).values(payment).returning();
    return newPayment;
  }

  async updatePayment(id: number, updates: UpdatePaymentRequest): Promise<Payment> {
    const [payment] = await db.update(payments).set(updates).where(eq(payments.id, id)).returning();
    return payment;
  }

  // Nutrition
  async getNutritionPlans(userId?: number): Promise<NutritionPlan[]> {
    if (userId) {
      return db.select().from(nutritionPlans).where(eq(nutritionPlans.userId, userId)).orderBy(desc(nutritionPlans.createdAt));
    }
    return db.select().from(nutritionPlans).orderBy(desc(nutritionPlans.createdAt));
  }

  async createNutritionPlan(plan: InsertNutritionPlan): Promise<NutritionPlan> {
    const [newPlan] = await db.insert(nutritionPlans).values(plan).returning();
    return newPlan;
  }

  async getIntakeLogs(userId?: number, date?: string): Promise<IntakeLog[]> {
    let conditions = [];
    if (userId) conditions.push(eq(intakeLogs.userId, userId));
    if (date) conditions.push(eq(intakeLogs.date, date));
    
    if (conditions.length > 0) {
      // @ts-ignore
      return db.select().from(intakeLogs).where(and(...conditions));
    }
    return db.select().from(intakeLogs);
  }

  async createIntakeLog(log: InsertIntakeLog): Promise<IntakeLog> {
    const [newLog] = await db.insert(intakeLogs).values(log).returning();
    return newLog;
  }
}

export const storage = new DatabaseStorage();
