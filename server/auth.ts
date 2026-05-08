import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual, createHash } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { computeClientHealth, type HealthSignals } from "./services/clientHealth";
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
  sendAdminNewClientEmail,
} from "./notifications";
import { z } from "zod";

const scryptAsync = promisify(scrypt);

// =============================
// LIGHTWEIGHT IN-MEMORY RATE LIMITER
// =============================
// Best-effort per-IP attempt limiter for unauthenticated auth endpoints. On
// Replit (single long-running process) it works as expected. On Vercel
// serverless each warm instance has its own counters, so the effective ceiling
// is per-instance per-window — still meaningful protection against trivial
// brute-force/credential-stuffing without requiring a paid Redis service.
type Bucket = { count: number; resetAt: number };
const RATE_BUCKETS = new Map<string, Bucket>();

function rateLimit(opts: { windowMs: number; max: number; key: string }) {
  const { windowMs, max, key: routeKey } = opts;
  return (req: any, res: any, next: any) => {
    // Prefer Express's resolved req.ip — when `trust proxy` is set
    // (production), Express parses x-forwarded-for honoring our proxy
    // count, so clients can't trivially spoof their identity. Fall back
    // to the raw header / socket only if Express couldn't resolve.
    const ip =
      req.ip ||
      (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim() ||
      req.socket?.remoteAddress ||
      "unknown";
    const k = `${routeKey}:${ip}`;
    const now = Date.now();
    const cur = RATE_BUCKETS.get(k);
    if (!cur || cur.resetAt < now) {
      RATE_BUCKETS.set(k, { count: 1, resetAt: now + windowMs });
      // Opportunistic GC: keep the map from growing unbounded across cold starts.
      if (RATE_BUCKETS.size > 5000) {
        RATE_BUCKETS.forEach((mv, mk) => {
          if (mv.resetAt < now) RATE_BUCKETS.delete(mk);
        });
      }
      return next();
    }
    if (cur.count >= max) {
      const retryAfter = Math.ceil((cur.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({
        error: "TooManyRequests",
        message: "Too many attempts. Please wait a moment and try again.",
      });
    }
    cur.count += 1;
    next();
  };
}

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
  const {
    password,
    adminNotes,
    passwordResetToken,
    passwordResetExpires,
    ...rest
  } = user as any;
  return rest;
}

// Admin-only view of a user that retains private trainer fields
// (adminNotes, noShowCount). Use this ONLY in admin-gated endpoints.
// Reset-token internals are still stripped — they are never useful to UI.
function sanitizeUserAdminView(user: User) {
  const { password, passwordResetToken, passwordResetExpires, ...rest } =
    user as any;
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

function daysBetween(fromIso: string | Date | null, toDate: Date): number {
  if (!fromIso) return Infinity;
  const from = typeof fromIso === "string" ? new Date(fromIso) : fromIso;
  if (isNaN(from.getTime())) return Infinity;
  return Math.max(0, Math.floor((toDate.getTime() - from.getTime()) / 86_400_000));
}

function toHealthInput(
  user: User,
  s: {
    lastCompletedDate: string | null;
    lastCheckinWeek: string | null;
    lastBodyMetricDate: string | null;
    noShows30d: number;
    completed30d: number;
    hasActivePackage: boolean;
    activePackageFrozen: boolean;
  },
): HealthSignals {
  const now = new Date();
  const lc = s.lastCompletedDate ? daysBetween(s.lastCompletedDate, now) : null;
  const ck = s.lastCheckinWeek ? daysBetween(s.lastCheckinWeek, now) : null;
  const bm = s.lastBodyMetricDate ? daysBetween(s.lastBodyMetricDate, now) : null;
  const joined = user.createdAt ? daysBetween(user.createdAt as any, now) : 9999;
  return {
    daysSinceLastCompleted: lc === Infinity ? null : lc,
    daysSinceLastCheckin: ck === Infinity ? null : ck,
    daysSinceLastBodyMetric: bm === Infinity ? null : bm,
    noShows30d: s.noShows30d,
    completed30d: s.completed30d,
    hasActivePackage: s.hasActivePackage,
    activePackageFrozen: s.activePackageFrozen,
    daysSinceJoined: joined,
    clientStatus: user.clientStatus ?? null,
  };
}

async function sanitizeAndEnrich(user: User, opts: { withHealth?: boolean } = {}) {
  const base = sanitizeUser(user);
  const isVerified = await computeIsVerified(user);
  if (!opts.withHealth || user.role !== "client") {
    return { ...base, isVerified };
  }
  try {
    const signals = await storage.getHealthSignalsForUsers([user.id]);
    const s = signals.get(user.id);
    if (!s) return { ...base, isVerified };
    const health = computeClientHealth(toHealthInput(user, s));
    return { ...base, isVerified, health };
  } catch (e) {
    console.warn("[auth] single-user health compute failed:", e);
    return { ...base, isVerified };
  }
}

/**
 * Batch-enrich a list of users with the verified flag using a single
 * grouped query per signal (instead of 2*N per-user fetches). Used by
 * /api/users to keep the admin client list O(1) in queries.
 */
async function sanitizeAndEnrichMany(
  usersList: User[],
  opts: { withHealth?: boolean } = {},
) {
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

  const allClientIds = usersList.filter((u) => u.role === "client").map((u) => u.id);
  const healthSignals =
    opts.withHealth && allClientIds.length > 0
      ? await storage.getHealthSignalsForUsers(allClientIds).catch((e) => {
          console.warn("[auth] batched health compute failed:", e);
          return new Map();
        })
      : null;

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
    if (healthSignals && u.role === "client") {
      const s = healthSignals.get(u.id);
      if (s) {
        const health = computeClientHealth(toHealthInput(u, s));
        return { ...base, isVerified, health };
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

  // Client registration — rate-limited to discourage automated signups.
  app.post("/api/auth/register", rateLimit({ windowMs: 60_000, max: 5, key: "register" }), async (req, res, next) => {
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
        packageTemplateId,
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
        // Clients with a complete profile become 'active' immediately and can
        // book without trainer approval. Admin retains full edit control via
        // the admin panel. Profiles missing primary goal / weekly frequency
        // stay 'incomplete' and finish onboarding before booking.
        clientStatus: isSuperAdminSignup
          ? "active"
          : primaryGoal && weeklyFrequency
          ? "active"
          : "incomplete",
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

      // Snapshot the client-selected package template into a packages row.
      // The package is immediately active and bookable. Payment is tracked
      // (paymentStatus='unpaid') for the trainer to confirm via the admin
      // panel, but it does NOT block booking.
      let snapshotPkgId: number | null = null;
      if (!isSuperAdminSignup && packageTemplateId) {
        try {
          const tpl = await storage.getPackageTemplate(packageTemplateId);
          if (tpl && tpl.isActive !== false) {
            const days =
              tpl.expirationUnit === "months"
                ? (tpl.expirationValue ?? 0) * 30
                : tpl.expirationUnit === "weeks"
                ? (tpl.expirationValue ?? 0) * 7
                : tpl.expirationValue ?? 0;
            const startDate = new Date();
            const expiryDate = days > 0 ? new Date(startDate.getTime() + days * 86_400_000) : null;
            const created = await storage.createPackage({
              userId: user.id,
              type: tpl.type as any,
              totalSessions: tpl.totalSessions,
              usedSessions: 0,
              isActive: true,
              templateId: tpl.id,
              name: tpl.name,
              paidSessions: tpl.paidSessions,
              bonusSessions: tpl.bonusSessions,
              pricePerSession: tpl.pricePerSession,
              totalPrice: tpl.totalPrice,
              startDate: startDate.toISOString().slice(0, 10) as any,
              expiryDate: expiryDate ? (expiryDate.toISOString().slice(0, 10) as any) : null,
              paymentStatus: "unpaid",
              paymentApproved: false,
              adminApproved: true,
              frozen: false,
            } as any);
            snapshotPkgId = created.id;
            try {
              await storage.createPackageSessionHistory({
                packageId: created.id,
                userId: user.id,
                action: "package_created",
                bookingId: null as any,
                sessionsDelta: tpl.totalSessions,
                performedByUserId: user.id,
                reason: `Client signup — selected "${tpl.name}"`,
              } as any);
            } catch (e) {
              console.warn("[auth] session history log failed:", e);
            }
          }
        } catch (e) {
          console.warn("[auth] package snapshot failed:", e);
        }
      }

      // Notify the trainer that a new client signed up so they can confirm
      // payment / review the chosen package. Booking is NOT gated on this.
      if (!isSuperAdminSignup) {
        try {
          await storage.createAdminNotification({
            kind: "system",
            title: `New client signup — ${user.fullName}`,
            body: snapshotPkgId
              ? `Selected a package on signup — confirm payment when received.`
              : `New client registered without selecting a package.`,
            userId: user.id,
            bookingId: null as any,
          } as any);
        } catch (e) {
          console.warn("[auth] admin notification failed:", e);
        }
      }

      // Best-effort welcome email / SMS — never blocks registration.
      const reqLang =
        (req.body?.lang as string | undefined) ||
        (req.get("accept-language") || "").split(",")[0]?.split("-")[0] ||
        "en";
      sendWelcomeNotifications({
        clientName: user.fullName,
        email: user.email,
        phone: user.phone,
        lang: reqLang,
      }).catch((e) => console.warn("[auth] welcome notifications failed:", e));

      // Best-effort admin "new client signup" email to the trainer mailbox.
      if (!isSuperAdminSignup) {
        let pkgInfo: { name: string | null; price: number | null } = { name: null, price: null };
        if (snapshotPkgId) {
          try {
            const pkg = await storage.getPackage(snapshotPkgId);
            if (pkg) {
              pkgInfo = {
                name: (pkg as any).name ?? `${pkg.type} (${pkg.totalSessions} sessions)`,
                price: (pkg as any).totalPrice ?? null,
              };
            }
          } catch { /* ignore */ }
        }
        sendAdminNewClientEmail({
          clientName: user.fullName,
          email: user.email,
          phone: user.phone,
          primaryGoal: user.primaryGoal,
          weeklyFrequency: user.weeklyFrequency ?? null,
          area: user.area,
          packageName: pkgInfo.name,
          packagePrice: pkgInfo.price,
        }).catch((e) => console.warn("[auth] admin new-client email failed:", e));
      }

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

  // Forgot password — always returns the same friendly message regardless of
  // whether the email exists, to prevent account enumeration.
  //
  // Flow: generate a 32-byte random token, store its sha256 hash + 30 min
  // expiry on the user, email the *plaintext* token in a reset link. The
  // /api/auth/reset-password endpoint hashes the supplied token and looks it
  // up. Email failures are logged but never fail the request.
  app.post("/api/auth/forgot-password", rateLimit({ windowMs: 60_000, max: 5, key: "forgot" }), async (req, res) => {
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
      if (user && user.email) {
        const rawToken = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 min
        await storage.updateUser(user.id, {
          passwordResetToken: tokenHash,
          passwordResetExpires: expiresAt,
        } as any);
        // Build absolute reset URL from a TRUSTED canonical origin only.
        // We deliberately do NOT trust the request's Host / x-forwarded-host
        // headers here: an attacker can submit forgot-password for a victim
        // with a forged Host and trick the server into emailing a phishing
        // reset URL. In production fall back to the well-known prod domain;
        // in dev fall back to localhost.
        const origin = (
          process.env.PUBLIC_APP_URL ||
          (process.env.NODE_ENV === "production"
            ? "https://youssef-booking.vercel.app"
            : `http://localhost:${process.env.PORT || 5000}`)
        ).replace(/\/+$/, "");
        const resetUrl = `${origin}/reset-password?token=${rawToken}`;
        const resetLang =
          (req.body?.lang as string | undefined) ||
          (req.get("accept-language") || "").split(",")[0]?.split("-")[0] ||
          "en";
        await sendPasswordResetNotification({ email: user.email, resetUrl, lang: resetLang });
      }
    } catch (e) {
      console.warn("[auth] forgot-password failed:", e);
    }
    return res.status(200).json(friendly);
  });

  // Reset password — verifies the single-use token + sets a new password.
  // Token is sent as plaintext; server hashes it with sha256 and looks it up.
  // On success the token + expiry are nulled so it can't be reused.
  app.post(
    "/api/auth/reset-password",
    rateLimit({ windowMs: 60_000, max: 10, key: "reset-password" }),
    async (req, res) => {
      const schema = z.object({
        token: z.string().min(32),
        password: z.string().min(6, "Password must be at least 6 characters"),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: parsed.error.errors[0]?.message || "Invalid request",
        });
      }
      try {
        const tokenHash = createHash("sha256")
          .update(parsed.data.token)
          .digest("hex");
        const hashed = await hashPassword(parsed.data.password);
        // Atomic consume: succeeds only if the token row is still valid AND
        // not yet expired. Two concurrent requests cannot both succeed —
        // the second sees zero rows updated and we return invalid/expired.
        const user = await storage.consumePasswordResetToken(tokenHash, hashed);
        if (!user) {
          return res.status(400).json({
            message: "This reset link is invalid or has expired.",
          });
        }
        return res
          .status(200)
          .json({ message: "Password updated. You can now sign in." });
      } catch (e) {
        console.error("[auth] reset-password failed:", e);
        return res.status(500).json({ message: "Could not reset password." });
      }
    },
  );

  app.post("/api/auth/login", rateLimit({ windowMs: 60_000, max: 10, key: "login" }), (req, res, next) => {
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

export { sanitizeUser, sanitizeUserAdminView, sanitizeAndEnrich, sanitizeAndEnrichMany, computeIsVerified };
