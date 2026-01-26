import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { registerAudioRoutes } from "./replit_integrations/audio";
import { registerImageRoutes } from "./replit_integrations/image";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup Auth
  setupAuth(app);

  // Register AI Routes
  registerAudioRoutes(app);
  registerImageRoutes(app);

  // === Users ===
  app.get(api.users.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const users = await storage.getAllUsers();
    res.json(users);
  });

  app.get(api.users.get.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const user = await storage.getUser(Number(req.params.id));
    if (!user) return res.status(404).json({ message: "User not found" });
    res.json(user);
  });

  app.patch(api.users.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    // TODO: Verify authorization (only admin or self)
    const user = await storage.updateUser(Number(req.params.id), req.body);
    res.json(user);
  });

  // === Packages ===
  app.get(api.packages.list.path, async (req, res) => {
    const packages = await storage.getPackages();
    res.json(packages);
  });

  app.post(api.packages.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const pkg = await storage.createPackage(req.body);
    res.status(201).json(pkg);
  });

  // === Bookings ===
  app.get(api.bookings.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const bookings = await storage.getBookings(userId);
    res.json(bookings);
  });

  app.post(api.bookings.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const booking = await storage.createBooking(req.body);
    res.status(201).json(booking);
  });

  app.patch(api.bookings.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const booking = await storage.updateBooking(Number(req.params.id), req.body);
    res.json(booking);
  });

  // === Payments ===
  app.get(api.payments.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const payments = await storage.getPayments();
    res.json(payments);
  });

  app.post(api.payments.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const payment = await storage.createPayment(req.body);
    res.status(201).json(payment);
  });

  app.patch(api.payments.update.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const payment = await storage.updatePayment(Number(req.params.id), req.body);
    res.json(payment);
  });

  // === Nutrition ===
  app.get(api.nutrition.plans.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const plans = await storage.getNutritionPlans(userId);
    res.json(plans);
  });

  app.post(api.nutrition.plans.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const plan = await storage.createNutritionPlan(req.body);
    res.status(201).json(plan);
  });

  app.get(api.nutrition.logs.list.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const userId = req.query.userId ? Number(req.query.userId) : undefined;
    const logs = await storage.getIntakeLogs(userId);
    res.json(logs);
  });

  app.post(api.nutrition.logs.create.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    const log = await storage.createIntakeLog(req.body);
    res.status(201).json(log);
  });

  // === Dashboard Stats ===
  app.get(api.dashboard.stats.path, async (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    
    // Quick aggregation
    const users = await storage.getAllUsers();
    const payments = await storage.getPayments();
    
    const stats = {
      activeClients: users.length,
      totalRevenue: payments.reduce((acc, p) => acc + Number(p.amount), 0),
      pendingPayments: payments.filter(p => p.status === 'pending').length,
      upcomingSessions: 0 // TODO: Query future bookings
    };
    
    res.json(stats);
  });

  // Seed Data if needed
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
  const users = await storage.getAllUsers();
  if (users.length === 0) {
    console.log("Seeding database...");
    // Admin
    const admin = await storage.createUser({
      username: "admin",
      password: "password123", // In real app, this is hashed
      fullName: "Youssef Admin",
      role: "admin",
      email: "admin@yousseffitness.com",
      membershipTier: "platinum",
      sessionsRemaining: 999
    });
    
    // Test Client
    const client = await storage.createUser({
      username: "client",
      password: "password123",
      fullName: "Test Client",
      role: "client",
      email: "client@example.com",
      membershipTier: "gold",
      sessionsRemaining: 10
    });

    // Packages
    await storage.createPackage({
      name: "Silver Package",
      description: "10 Sessions per month",
      price: 1500,
      sessionCount: 10,
      tier: "silver"
    });
    
    await storage.createPackage({
      name: "Gold Package",
      description: "20 Sessions + Nutrition",
      price: 2500,
      sessionCount: 20,
      tier: "gold"
    });
    
    console.log("Database seeded!");
  }
}
