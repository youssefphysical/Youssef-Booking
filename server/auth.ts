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
  tierFromFrequency,
  POLICY_VERSION,
  SUPER_ADMIN_EMAIL,
  DEFAULT_PERMISSIONS_BY_ROLE,
} from "@shared/schema";
import { registrationConsentSchema } from "@shared/routes";
import {
  sendWelcomeNotifications,
  sendPasswordResetNotification,
} from "./notifications";
import { z } from "zod";

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

/**
 * Compute the `isVerified` flag for a single user. A client is verified once
 * they've uploaded a profile picture AND have either at least one InBody
 * record or one completed coaching session on file.
 *
 * Two small COUNT queries — fast enough for per-request use on /api/auth/me
 * and /api/users/:id where we always know the userId up front.
 */
async function computeIsVerified(user: User): Promise<boolean> {
  if (user.role !== "client") return false;
  // Admin manual override takes precedence over auto-computation.
  if (user.verifiedOverride === true) return true;
  if (user.verifiedOverride === false) return false;
  if (!user.profilePictureUrl) return false;
  try {
    const [inbody, sessions] = await Promise.all([
      storage.getInbodyRecords({ userId: user.id }),
      storage.getBookings({ userId: user.id }),
    ]);
    if (inbody.length > 0) return true;
    if (sessions.some((b) => b.status === "completed")) return true;
    return false;
  } catch (e) {
    console.warn("[auth] isVerified compute failed:", e);
    return false;
  }
}

async function sanitizeAndEnrich(user: User) {
  const base = sanitizeUser(user);
  const isVerified = await computeIsVerified(user);
  return { ...base, isVerified };
}

/**
 * Batch-enrich a list of users with the verified flag using a single
 * grouped query per signal (instead of 2*N per-user fetches). Used by
 * /api/users to keep the admin client list O(1) in queries.
 */
async function sanitizeAndEnrichMany(usersList: User[]) {
  if (usersList.length === 0) return [];
  const clientIds = usersList
    .filter((u) => u.role === "client" && u.profilePictureUrl)
    .map((u) => u.id);
  const flags =
    clientIds.length > 0
      ? await storage.getVerificationFlagsForUsers(clientIds).catch((e) => {
          console.warn("[auth] batched isVerified compute failed:", e);
          return new Map<number, { hasInbody: boolean; hasCompletedSession: boolean }>();
        })
      : new Map<number, { hasInbody: boolean; hasCompletedSession: boolean }>();

  return usersList.map((u) => {
    const base = sanitizeUser(u);
    let isVerified = false;
    if (u.role === "client") {
      if (u.verifiedOverride === true) isVerified = true;
      else if (u.verifiedOverride === false) isVerified = false;
      else if (u.profilePictureUrl) {
        const f = flags.get(u.id);
        isVerified = !!(f && (f.hasInbody || f.hasCompletedSession));
      }
    }
    return { ...base, isVerified };
  });
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
        // Inactive admins/staff cannot sign in
        if (user.role === "admin" && user.isActive === false) {
          return done(null, false);
        }
        // Auto-promote the canonical super-admin email on every successful login.
        // Best-effort: never blocks the login on failure.
        try {
          if (
            user.email &&
            user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() &&
            (user.role !== "admin" || user.adminRole !== "super_admin")
          ) {
            const promoted = await storage.updateUser(user.id, {
              role: "admin",
              adminRole: "super_admin",
              isActive: true,
              permissions: DEFAULT_PERMISSIONS_BY_ROLE.super_admin,
            } as any);
            if (promoted) user = promoted;
          }
        } catch (e) {
          console.warn("[auth] super-admin auto-promotion failed:", e);
        }
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
        fitnessGoal,
        primaryGoal,
        notes,
        weeklyFrequency,
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
      const initialTier = tierFromFrequency(weeklyFrequency);
      // If the canonical super-admin email registers, auto-create as super_admin
      // (not a client). Permission grid + active flag set immediately so the
      // user is fully operational on first login.
      const isSuperAdminSignup =
        email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
      const user = await storage.createUser({
        username: email,
        email,
        password: hashedPassword,
        fullName,
        phone,
        area: area || null,
        emergencyContactName: null,
        emergencyContactPhone: null,
        fitnessGoal: fitnessGoal || null,
        primaryGoal: primaryGoal || null,
        notes: notes || null,
        role: isSuperAdminSignup ? "admin" : "client",
        adminRole: isSuperAdminSignup ? "super_admin" : null,
        permissions: isSuperAdminSignup
          ? DEFAULT_PERMISSIONS_BY_ROLE.super_admin
          : {},
        isActive: true,
        weeklyFrequency,
        vipTier: initialTier,
        vipUpdatedAt: new Date(),
      } as any);

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

      // Best-effort welcome email / SMS — never blocks registration.
      sendWelcomeNotifications({
        clientName: user.fullName,
        email: user.email,
        phone: user.phone,
      }).catch((e) => console.warn("[auth] welcome notifications failed:", e));

      req.login(user, async (err) => {
        if (err) return next(err);
        // Enrich so the frontend immediately sees `isVerified: false` (not
        // `undefined`) right after registration. Verification can only flip to
        // true later — once a profile picture AND inbody/completed-session
        // exist — but returning the field keeps the shape consistent with
        // /api/auth/me and avoids special-casing in React.
        const enriched = await sanitizeAndEnrich(user);
        res.status(201).json(enriched);
      });
    } catch (err) {
      next(err);
    }
  });

  // Forgot password — always returns the same friendly message.
  app.post("/api/auth/forgot-password", async (req, res) => {
    const schema = z.object({ email: z.string().email() });
    const parsed = schema.safeParse(req.body);
    const friendly = {
      message:
        "If an account exists with this email, password reset instructions will be sent.",
    };
    if (!parsed.success) {
      // Still return the friendly message — never disclose validity.
      return res.status(200).json(friendly);
    }
    try {
      const user = await storage.getUserByEmail(parsed.data.email);
      if (user) {
        await sendPasswordResetNotification({ email: parsed.data.email });
      }
    } catch (e) {
      console.warn("[auth] forgot-password lookup failed:", e);
    }
    return res.status(200).json(friendly);
  });

  app.post("/api/auth/login", (req, res, next) => {
    passport.authenticate("local", (err: Error, user: User | false) => {
      if (err) return next(err);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      req.login(user, async (loginErr) => {
        if (loginErr) return next(loginErr);
        // Same shape as /api/auth/me — frontend can rely on `isVerified`.
        const enriched = await sanitizeAndEnrich(user);
        res.status(200).json(enriched);
      });
    })(req, res, next);
  });

  app.post("/api/auth/logout", (req, res, next) => {
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/auth/me", async (req, res) => {
    if (!req.isAuthenticated() || !req.user) return res.sendStatus(401);
    const enriched = await sanitizeAndEnrich(req.user as User);
    res.json(enriched);
  });
}

export { sanitizeUser, sanitizeAndEnrich, sanitizeAndEnrichMany, computeIsVerified };
