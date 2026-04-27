import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import {
  User,
  insertClientSchema,
  REGISTRATION_CONSENT_ITEMS,
  POLICY_VERSION,
} from "@shared/schema";
import { registrationConsentSchema } from "@shared/routes";

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

function sanitizeUser(user: User) {
  const { password, ...rest } = user;
  return rest;
}

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "dev-secret-change-me",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      secure: app.get("env") === "production",
      maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    },
  };

  if (app.get("env") === "production") {
    app.set("trust proxy", 1);
  }

  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (identifier, password, done) => {
      try {
        // Try by username first, then by email
        let user = await storage.getUserByUsername(identifier);
        if (!user) user = await storage.getUserByEmail(identifier);
        if (!user) return done(null, false);
        const ok = await comparePasswords(password, user.password);
        if (!ok) return done(null, false);
        return done(null, user);
      } catch (e) {
        return done(e as Error);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, (user as User).id));
  passport.deserializeUser(async (id, done) => {
    try {
      const user = await storage.getUser(id as number);
      done(null, user || false);
    } catch (e) {
      done(e as Error);
    }
  });

  // Client registration
  app.post("/api/auth/register", async (req, res, next) => {
    try {
      const parsed = insertClientSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message || "Invalid registration data",
        });
      }
      const consentsParsed = registrationConsentSchema.safeParse(req.body?.consents);
      if (!consentsParsed.success) {
        return res.status(400).json({
          message:
            consentsParsed.error.errors[0]?.message ||
            "Please accept all required consents to continue",
        });
      }
      const {
        email,
        password,
        fullName,
        phone,
        area,
        emergencyContactName,
        emergencyContactPhone,
        fitnessGoal,
        notes,
      } = parsed.data;

      const existingByEmail = await storage.getUserByEmail(email);
      if (existingByEmail) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const existingByUsername = await storage.getUserByUsername(email);
      if (existingByUsername) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await hashPassword(password);
      const user = await storage.createUser({
        username: email,
        email,
        password: hashedPassword,
        fullName,
        phone,
        area: area || null,
        emergencyContactName: emergencyContactName || null,
        emergencyContactPhone: emergencyContactPhone || null,
        fitnessGoal: fitnessGoal || null,
        notes: notes || null,
        role: "client",
      });

      // Persist registration consent for legal/audit trail
      try {
        await storage.createConsentRecord({
          userId: user.id,
          consentType: "registration",
          policyVersion: POLICY_VERSION,
          acceptedItems: REGISTRATION_CONSENT_ITEMS as unknown as string[],
          ipAddress: (req.ip || req.socket.remoteAddress || null) as string | null,
          userAgent: (req.get("user-agent") || null) as string | null,
        });
      } catch (e) {
        console.warn("[auth] Failed to write consent record:", e);
      }

      req.login(user, (err) => {
        if (err) return next(err);
        res.status(201).json(sanitizeUser(user));
      });
    } catch (err) {
      next(err);
    }
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: Error, user: User | false) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      req.login(user, (loginErr) => {
        if (loginErr) return next(loginErr);
        res.status(200).json(sanitizeUser(user));
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/auth/me", (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.sendStatus(401);
    res.json(sanitizeUser(req.user as User));
  });
}

export { sanitizeUser };
