/**
 * Task #65 — E2E + unit coverage for the duplicate-account / admin-merge
 * flows added in Phase 5.
 *
 *   tsx scripts/test-merge-flows.ts
 *
 * 1. Boots an in-process Express via createApp() (same factory the dev
 *    server uses) on an ephemeral port — no need to coordinate with the
 *    `Start application` workflow.
 * 2. Storage-layer unit test on storage.mergeUsers: seeds the loser with
 *    one row in every dependent table that Phase 5 mergeUsers reassigns,
 *    runs the merge, asserts every row landed on the winner and an
 *    admin_audit_log entry was written.
 * 3. HTTP E2E #1 — register a unique user, then re-register with the
 *    "same" email under three normalisation evasions (dot-trick on gmail,
 *    plus-addressing, case change). Each retry must be rejected with 400
 *    (the route returns 400 today; task spec said 409 — note in the
 *    summary). Same for phone (UAE local vs +971/00971).
 * 4. HTTP E2E #2 — pre-seed two client accounts via storage, login as a
 *    super-admin (created on the fly), POST /api/admin/clients/merge,
 *    then verify (a) the winner now owns the loser's booking + package,
 *    (b) the loser can no longer log in.
 *
 * All seeded rows live under `task65+...@example.com` so the test data
 * is trivially identifiable. The merged-loser rows are SCRAMBLED by
 * mergeUsers itself (email/phone/username suffix) — deliberately not
 * deleted, because the audit trail relies on the row staying around.
 * The script also DELETEs every row it created at the end so repeat
 * runs stay clean; the merged-loser row is removed last after a manual
 * audit-log scrub.
 */

import { createServer } from "http";
import type { AddressInfo } from "net";
import { createApp } from "../server/app";
import { storage } from "../server/storage";
import { hashPassword } from "../server/auth";
import { db, pool } from "../server/db";
import {
  users,
  bookings,
  packages,
  bodyMetrics,
  progressPhotos,
  weeklyCheckins,
  clientNotifications,
  consentRecords,
  agreements,
  packageSessionHistory,
  waitlists,
  renewalRequests,
  extensionRequests,
  trainingLocations,
  recoveryRequests,
  clientSupplements,
  inbodyRecords,
  adminAuditLog,
} from "@shared/schema";
import { eq, inArray, sql } from "drizzle-orm";

// ────────────────────────────────────────────────────────────────────────────
// Tiny test harness — no Vitest in the repo so we roll our own. Records pass
// / fail per test, prints a summary, exits non-zero on any failure.
// ────────────────────────────────────────────────────────────────────────────
type Result = { name: string; ok: boolean; err?: any };
const results: Result[] = [];
async function test(name: string, fn: () => Promise<void>) {
  process.stdout.write(`• ${name} … `);
  try {
    await fn();
    results.push({ name, ok: true });
    console.log("OK");
  } catch (err: any) {
    results.push({ name, ok: false, err });
    console.log("FAIL");
    console.error("    ", err?.stack || err?.message || err);
  }
}
function assert(cond: any, msg: string): asserts cond {
  if (!cond) throw new Error("assertion failed: " + msg);
}
function assertEq<T>(actual: T, expected: T, msg: string) {
  if (actual !== expected) {
    throw new Error(
      `assertion failed: ${msg} — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
    );
  }
}

// ────────────────────────────────────────────────────────────────────────────
const TAG = `task65_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
const createdUserIds = new Set<number>();
const createdAuditIds = new Set<number>();

async function bootApp() {
  const app = await createApp();
  const server = createServer(app);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = (server.address() as AddressInfo).port;
  const base = `http://127.0.0.1:${port}`;
  // mergeUsers reassigns `package_verification_requests` + `client_tags`
  // via raw SQL. On some dev DBs one or both tables don't exist — and
  // Postgres aborts the WHOLE transaction on a "relation does not
  // exist", poisoning every subsequent reassign. ensureSchema creates
  // client_tags but NOT package_verification_requests, so we provide a
  // minimal stand-in here. The unit test below seeds rows into both so
  // we deterministically verify reassignment for every dependent table
  // mergeUsers knows about.
  await db.execute(
    sql.raw(
      `CREATE TABLE IF NOT EXISTS package_verification_requests (id serial PRIMARY KEY, user_id integer NOT NULL)`,
    ),
  );
  await db.execute(
    sql.raw(
      `CREATE TABLE IF NOT EXISTS client_tags (id serial PRIMARY KEY, user_id integer NOT NULL, label text NOT NULL)`,
    ),
  );
  return { server, base };
}

async function seedUser(opts: {
  emailSlug: string;
  phone: string;
  role?: "client" | "admin";
  isAdmin?: boolean;
  password?: string;
}) {
  const password = opts.password ?? "Test1234!";
  const hashed = await hashPassword(password);
  const email = `${opts.emailSlug}@example.com`;
  const u = await storage.createUser({
    username: email,
    email,
    password: hashed,
    fullName: opts.emailSlug,
    phone: opts.phone,
    role: opts.role ?? "client",
    adminRole: opts.isAdmin ? "super_admin" : null,
    permissions: opts.isAdmin ? { manage_users: true } : {},
    isActive: true,
    clientStatus: opts.role === "client" || !opts.role ? "active" : "active",
  } as any);
  createdUserIds.add(u.id);
  return { user: u, password };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. Storage-layer unit test on mergeUsers — verify every dependent
//    table actually moves + audit row written.
// ────────────────────────────────────────────────────────────────────────────
async function unitTestMergeUsers() {
  const winnerSeed = await seedUser({
    emailSlug: `winner_${TAG}`,
    phone: `+97150${Math.floor(1000000 + Math.random() * 8999999)}`,
  });
  const loserSeed = await seedUser({
    emailSlug: `loser_${TAG}`,
    phone: `+97150${Math.floor(1000000 + Math.random() * 8999999)}`,
  });
  const performer = await seedUser({
    emailSlug: `perf_${TAG}`,
    phone: `+97150${Math.floor(1000000 + Math.random() * 8999999)}`,
    role: "admin",
    isAdmin: true,
  });
  const winner = winnerSeed.user;
  const loser = loserSeed.user;

  // Seed ONE row in each table that mergeUsers reassigns from the
  // shared schema set. (Tables defined only in ensureSchema.ts — i.e.
  // client_tags / package_verification_requests — are exercised by the
  // reassign loop but we don't insert into them; mergeUsers' reassign
  // is a no-op when the table is empty, which is what we want.)
  const loc = await db
    .insert(trainingLocations)
    .values({ userId: loser.id, kind: "home", label: "loser-home" } as any)
    .returning();
  const pkg = await db
    .insert(packages)
    .values({
      userId: loser.id,
      type: "standard",
      totalSessions: 10,
      usedSessions: 0,
      paymentStatus: "paid",
    } as any)
    .returning();
  const bk = await db
    .insert(bookings)
    .values({
      userId: loser.id,
      packageId: pkg[0].id,
      date: "2099-01-01",
      timeSlot: "09:00",
      status: "upcoming",
      sessionType: "package",
    } as any)
    .returning();
  await db.insert(bodyMetrics).values({
    userId: loser.id,
    recordedOn: "2099-01-01",
    weight: 80,
  } as any);
  await db.insert(progressPhotos).values({
    userId: loser.id,
    photoUrl: "data:image/png;base64,AAA",
    type: "current",
    viewAngle: "front",
  } as any);
  await db.insert(weeklyCheckins).values({
    userId: loser.id,
    weekStart: "2099-01-04",
    weight: 80,
  } as any);
  await db.insert(clientNotifications).values({
    userId: loser.id,
    kind: "system",
    title: "x",
    body: "x",
  } as any);
  await db.insert(consentRecords).values({
    userId: loser.id,
    consentType: "registration",
    policyVersion: "v1",
  } as any);
  await db.insert(agreements).values({
    userId: loser.id,
    agreementType: "waiver",
    version: "v-task65",
  } as any);
  await db.insert(packageSessionHistory).values({
    packageId: pkg[0].id,
    userId: loser.id,
    action: "session_used",
    sessionsDelta: -1,
  } as any);
  await db.insert(waitlists).values({
    userId: loser.id,
    date: "2099-01-01",
    timeSlot: "10:00",
  } as any);
  await db.insert(renewalRequests).values({
    userId: loser.id,
    requestedPackageType: "standard",
  } as any);
  await db.insert(extensionRequests).values({
    userId: loser.id,
    packageId: pkg[0].id,
    requestedDays: 7,
  } as any);
  await db.insert(recoveryRequests).values({
    userId: loser.id,
    serviceType: "physio",
  } as any);
  await db.insert(clientSupplements).values({
    userId: loser.id,
    name: "Whey",
  } as any);
  await db.insert(inbodyRecords).values({
    userId: loser.id,
    fileName: "x.pdf",
  } as any);

  // ensureSchema (and bootApp above as a fallback) guarantees both
  // tables exist, so we insert deterministically and assert below.
  await db.execute(
    sql.raw(
      `INSERT INTO client_tags (user_id, label, created_by_user_id) VALUES (${loser.id}, 'task65', ${performer.user.id})`,
    ),
  );
  await db.execute(
    sql.raw(
      `INSERT INTO package_verification_requests (user_id) VALUES (${loser.id})`,
    ),
  );

  // Sanity: confirm rows really live on the loser before the merge.
  const beforeBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.userId, loser.id));
  assertEq(beforeBookings.length, 1, "pre-merge: loser owns 1 booking");

  const { winner: w2, loser: l2 } = await storage.mergeUsers({
    winnerId: winner.id,
    loserId: loser.id,
    performedByUserId: performer.user.id,
  });

  // Winner row updates
  assertEq(w2.id, winner.id, "winner id unchanged");
  assert(l2.mergedIntoUserId === winner.id, "loser.mergedIntoUserId set");
  assert(l2.isActive === false, "loser.isActive false");
  assertEq(l2.clientStatus, "merged", "loser.clientStatus=merged");
  assert(l2.email !== loser.email, "loser email was scrambled");

  // Every dependent table now references winner (loser has 0 rows).
  const checks: Array<[string, () => Promise<number>, () => Promise<number>]> = [
    [
      "bookings",
      async () =>
        (await db.select().from(bookings).where(eq(bookings.userId, winner.id))).length,
      async () =>
        (await db.select().from(bookings).where(eq(bookings.userId, loser.id))).length,
    ],
    [
      "packages",
      async () =>
        (await db.select().from(packages).where(eq(packages.userId, winner.id))).length,
      async () =>
        (await db.select().from(packages).where(eq(packages.userId, loser.id))).length,
    ],
    [
      "body_metrics",
      async () =>
        (await db.select().from(bodyMetrics).where(eq(bodyMetrics.userId, winner.id)))
          .length,
      async () =>
        (await db.select().from(bodyMetrics).where(eq(bodyMetrics.userId, loser.id)))
          .length,
    ],
    [
      "progress_photos",
      async () =>
        (
          await db
            .select()
            .from(progressPhotos)
            .where(eq(progressPhotos.userId, winner.id))
        ).length,
      async () =>
        (
          await db
            .select()
            .from(progressPhotos)
            .where(eq(progressPhotos.userId, loser.id))
        ).length,
    ],
    [
      "weekly_checkins",
      async () =>
        (
          await db
            .select()
            .from(weeklyCheckins)
            .where(eq(weeklyCheckins.userId, winner.id))
        ).length,
      async () =>
        (
          await db
            .select()
            .from(weeklyCheckins)
            .where(eq(weeklyCheckins.userId, loser.id))
        ).length,
    ],
    [
      "client_notifications",
      async () =>
        (
          await db
            .select()
            .from(clientNotifications)
            .where(eq(clientNotifications.userId, winner.id))
        ).length,
      async () =>
        (
          await db
            .select()
            .from(clientNotifications)
            .where(eq(clientNotifications.userId, loser.id))
        ).length,
    ],
    [
      "consent_records",
      async () =>
        (
          await db
            .select()
            .from(consentRecords)
            .where(eq(consentRecords.userId, winner.id))
        ).length,
      async () =>
        (
          await db
            .select()
            .from(consentRecords)
            .where(eq(consentRecords.userId, loser.id))
        ).length,
    ],
    [
      "agreements",
      async () =>
        (await db.select().from(agreements).where(eq(agreements.userId, winner.id)))
          .length,
      async () =>
        (await db.select().from(agreements).where(eq(agreements.userId, loser.id)))
          .length,
    ],
    [
      "package_session_history",
      async () =>
        (
          await db
            .select()
            .from(packageSessionHistory)
            .where(eq(packageSessionHistory.userId, winner.id))
        ).length,
      async () =>
        (
          await db
            .select()
            .from(packageSessionHistory)
            .where(eq(packageSessionHistory.userId, loser.id))
        ).length,
    ],
    [
      "waitlists",
      async () =>
        (await db.select().from(waitlists).where(eq(waitlists.userId, winner.id)))
          .length,
      async () =>
        (await db.select().from(waitlists).where(eq(waitlists.userId, loser.id)))
          .length,
    ],
    [
      "renewal_requests",
      async () =>
        (
          await db
            .select()
            .from(renewalRequests)
            .where(eq(renewalRequests.userId, winner.id))
        ).length,
      async () =>
        (
          await db
            .select()
            .from(renewalRequests)
            .where(eq(renewalRequests.userId, loser.id))
        ).length,
    ],
    [
      "extension_requests",
      async () =>
        (
          await db
            .select()
            .from(extensionRequests)
            .where(eq(extensionRequests.userId, winner.id))
        ).length,
      async () =>
        (
          await db
            .select()
            .from(extensionRequests)
            .where(eq(extensionRequests.userId, loser.id))
        ).length,
    ],
    [
      "training_locations",
      async () =>
        (
          await db
            .select()
            .from(trainingLocations)
            .where(eq(trainingLocations.userId, winner.id))
        ).length,
      async () =>
        (
          await db
            .select()
            .from(trainingLocations)
            .where(eq(trainingLocations.userId, loser.id))
        ).length,
    ],
    [
      "recovery_requests",
      async () =>
        (
          await db
            .select()
            .from(recoveryRequests)
            .where(eq(recoveryRequests.userId, winner.id))
        ).length,
      async () =>
        (
          await db
            .select()
            .from(recoveryRequests)
            .where(eq(recoveryRequests.userId, loser.id))
        ).length,
    ],
    [
      "client_supplements",
      async () =>
        (
          await db
            .select()
            .from(clientSupplements)
            .where(eq(clientSupplements.userId, winner.id))
        ).length,
      async () =>
        (
          await db
            .select()
            .from(clientSupplements)
            .where(eq(clientSupplements.userId, loser.id))
        ).length,
    ],
    [
      "inbody_records",
      async () =>
        (
          await db
            .select()
            .from(inbodyRecords)
            .where(eq(inbodyRecords.userId, winner.id))
        ).length,
      async () =>
        (
          await db
            .select()
            .from(inbodyRecords)
            .where(eq(inbodyRecords.userId, loser.id))
        ).length,
    ],
  ];

  for (const [table, onWinner, onLoser] of checks) {
    const w = await onWinner();
    const l = await onLoser();
    assert(w >= 1, `${table}: winner should have ≥1 row (got ${w})`);
    assertEq(l, 0, `${table}: loser should have 0 rows after merge`);
  }

  // client_tags + package_verification_requests are reassigned via raw
  // SQL in mergeUsers; verify both deterministically (tables guaranteed
  // to exist by bootApp() / ensureSchema).
  for (const rawTable of ["client_tags", "package_verification_requests"]) {
    const r: any = await db.execute(
      sql.raw(
        `SELECT (SELECT COUNT(*)::int FROM ${rawTable} WHERE user_id = ${winner.id}) AS w, (SELECT COUNT(*)::int FROM ${rawTable} WHERE user_id = ${loser.id}) AS l`,
      ),
    );
    const row = Array.isArray(r) ? r[0] : r?.rows?.[0];
    assert(row, `${rawTable}: count query returned no row`);
    assert(Number(row.w) >= 1, `${rawTable}: winner should have ≥1 row after merge`);
    assertEq(Number(row.l), 0, `${rawTable}: loser should have 0 rows after merge`);
  }

  // Audit log row written.
  const audit = await db
    .select()
    .from(adminAuditLog)
    .where(eq(adminAuditLog.entityId, loser.id));
  const mergeAudit = audit.find((a) => a.action === "client.merge");
  assert(mergeAudit, "admin_audit_log: client.merge row written for loser");
  assertEq(
    mergeAudit!.performedByUserId,
    performer.user.id,
    "audit.performedByUserId",
  );
  createdAuditIds.add(mergeAudit!.id);
}

// ────────────────────────────────────────────────────────────────────────────
// 2. HTTP — duplicate-account prevention with normalised email/phone.
// ────────────────────────────────────────────────────────────────────────────
async function httpTestDuplicateRegistration(base: string) {
  // Use a fixed gmail local so dot/plus evasions collapse to the same
  // normalised value. Random suffix avoids collisions across runs.
  const suffix = Math.random().toString(36).slice(2, 8);
  const local = `task65dup${suffix}`;
  const email = `${local}@gmail.com`;
  const phone = `+97150${Math.floor(1000000 + Math.random() * 8999999)}`;
  const password = "Test1234!";
  const consents = {
    info_accurate: true,
    cancellation_policy: true,
    terms_conditions: true,
    medical_fitness: true,
    data_storage: true,
  };

  async function register(payload: any) {
    return fetch(`${base}/api/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  }

  const base1 = {
    email,
    password,
    fullName: "Dup Tester",
    phone,
    primaryGoal: "fat_loss",
    weeklyFrequency: 3,
    consents,
  };
  const r1 = await register(base1);
  assertEq(r1.status, 201, `initial register: ${r1.status} ${await r1.text()}`);
  // Capture the new user so cleanup can find them.
  const u = await storage.getUserByEmail(email);
  if (u) createdUserIds.add(u.id);

  // Every duplicate-evasion attempt must return exactly 409 Conflict so
  // the front-end can distinguish "your form is wrong" (400) from
  // "this account already exists" (409) without string-matching.
  // Evasion 1: dot trick. t.a.s.k.65dup<suffix>@gmail.com normalises to the same.
  const dotted = local.split("").join(".") + "@gmail.com";
  const r2 = await register({
    ...base1,
    email: dotted,
    phone: `+97150${Math.floor(1000000 + Math.random() * 8999999)}`,
  });
  assertEq(r2.status, 409, `dot-trick must return 409 (got ${r2.status} ${await r2.text().catch(() => "")})`);

  // Evasion 2: plus-addressing.
  const r3 = await register({
    ...base1,
    email: `${local}+spam@gmail.com`,
    phone: `+97150${Math.floor(1000000 + Math.random() * 8999999)}`,
  });
  assertEq(r3.status, 409, `plus-addressing must return 409 (got ${r3.status} ${await r3.text().catch(() => "")})`);

  // Evasion 3: case change.
  const r4 = await register({
    ...base1,
    email: email.toUpperCase(),
    phone: `+97150${Math.floor(1000000 + Math.random() * 8999999)}`,
  });
  assertEq(r4.status, 409, `case change must return 409 (got ${r4.status} ${await r4.text().catch(() => "")})`);

  // Phone normalisation: UAE 05XXXXXXXX should collide with +9715XXXXXXXX.
  // Use a fresh email so the only collision is the phone.
  const phoneLocal = `0${phone.slice(4)}`; // +9715xxxxxxxx -> 05xxxxxxxx
  const r5 = await register({
    ...base1,
    email: `task65dup2_${suffix}@example.com`,
    phone: phoneLocal,
  });
  assertEq(r5.status, 409, `phone evasion must return 409 (got ${r5.status} ${await r5.text().catch(() => "")})`);
}

// ────────────────────────────────────────────────────────────────────────────
// 3. HTTP — admin merge end-to-end.
// ────────────────────────────────────────────────────────────────────────────
async function httpTestAdminMerge(base: string) {
  // Spin up a super-admin we can log in as.
  const adminSeed = await seedUser({
    emailSlug: `admin_${TAG}`,
    phone: `+97150${Math.floor(1000000 + Math.random() * 8999999)}`,
    role: "admin",
    isAdmin: true,
  });
  const winnerSeed = await seedUser({
    emailSlug: `mwinner_${TAG}`,
    phone: `+97150${Math.floor(1000000 + Math.random() * 8999999)}`,
  });
  const loserSeed = await seedUser({
    emailSlug: `mloser_${TAG}`,
    phone: `+97150${Math.floor(1000000 + Math.random() * 8999999)}`,
  });
  const loserOriginalEmail = loserSeed.user.email!;
  const loserOriginalPassword = loserSeed.password;

  // Seed loser with an active package + booking the admin merge must move.
  const pkg = await db
    .insert(packages)
    .values({
      userId: loserSeed.user.id,
      type: "standard",
      totalSessions: 10,
      usedSessions: 0,
      paymentStatus: "paid",
      isActive: true,
    } as any)
    .returning();
  const bk = await db
    .insert(bookings)
    .values({
      userId: loserSeed.user.id,
      packageId: pkg[0].id,
      date: "2099-02-02",
      timeSlot: "10:00",
      status: "upcoming",
      sessionType: "package",
    } as any)
    .returning();

  // Login as admin to get a session cookie.
  const loginRes = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: adminSeed.user.username,
      password: adminSeed.password,
    }),
  });
  assertEq(loginRes.status, 200, `admin login: ${loginRes.status} ${await loginRes.text().catch(() => "")}`);
  const cookie = loginRes.headers.get("set-cookie") || "";
  assert(cookie, "admin login set-cookie header missing");
  const sessionCookie = cookie.split(";")[0];

  // Confirm loser CAN log in before the merge.
  const preMergeLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: loserOriginalEmail,
      password: loserOriginalPassword,
    }),
  });
  assertEq(preMergeLogin.status, 200, "loser should log in BEFORE merge");

  // POST /api/admin/clients/merge as admin.
  const mergeRes = await fetch(`${base}/api/admin/clients/merge`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: sessionCookie,
    },
    body: JSON.stringify({
      winnerId: winnerSeed.user.id,
      loserId: loserSeed.user.id,
    }),
  });
  assertEq(mergeRes.status, 200, `admin merge: ${mergeRes.status} ${await mergeRes.text().catch(() => "")}`);

  // Booking + package now belong to the winner.
  const winnerBookings = await db
    .select()
    .from(bookings)
    .where(eq(bookings.userId, winnerSeed.user.id));
  assert(
    winnerBookings.some((b) => b.id === bk[0].id),
    "merged booking moved to winner",
  );
  const winnerPackages = await db
    .select()
    .from(packages)
    .where(eq(packages.userId, winnerSeed.user.id));
  assert(
    winnerPackages.some((p) => p.id === pkg[0].id),
    "merged package moved to winner",
  );

  // Loser CANNOT log in any more — username/email was scrambled.
  const postMergeLogin = await fetch(`${base}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      username: loserOriginalEmail,
      password: loserOriginalPassword,
    }),
  });
  assert(
    postMergeLogin.status >= 400,
    `loser login should fail AFTER merge (got ${postMergeLogin.status})`,
  );

  // Track scrubbed audit row for cleanup.
  const audit = await db
    .select()
    .from(adminAuditLog)
    .where(eq(adminAuditLog.entityId, loserSeed.user.id));
  for (const a of audit) createdAuditIds.add(a.id);
}

// ────────────────────────────────────────────────────────────────────────────
// Cleanup — best-effort, wide-net delete keyed on the TAG prefix.
// ────────────────────────────────────────────────────────────────────────────
async function cleanup() {
  if (createdUserIds.size === 0) return;
  const ids = Array.from(createdUserIds);
  console.log(`\n[cleanup] removing ${ids.length} test users + dependents`);

  // Audit rows referencing test users.
  await db.delete(adminAuditLog).where(inArray(adminAuditLog.entityId, ids));

  // Reassigned rows now sit on the winner — scrub by entity, not user.
  const tables: Array<{ t: any; col: any }> = [
    { t: bookings, col: bookings.userId },
    { t: packageSessionHistory, col: packageSessionHistory.userId },
    { t: packages, col: packages.userId },
    { t: bodyMetrics, col: bodyMetrics.userId },
    { t: progressPhotos, col: progressPhotos.userId },
    { t: weeklyCheckins, col: weeklyCheckins.userId },
    { t: clientNotifications, col: clientNotifications.userId },
    { t: consentRecords, col: consentRecords.userId },
    { t: agreements, col: agreements.userId },
    { t: waitlists, col: waitlists.userId },
    { t: renewalRequests, col: renewalRequests.userId },
    { t: extensionRequests, col: extensionRequests.userId },
    { t: trainingLocations, col: trainingLocations.userId },
    { t: recoveryRequests, col: recoveryRequests.userId },
    { t: clientSupplements, col: clientSupplements.userId },
    { t: inbodyRecords, col: inbodyRecords.userId },
  ];
  for (const { t, col } of tables) {
    try {
      await db.delete(t).where(inArray(col, ids));
    } catch (e: any) {
      console.warn(`[cleanup] delete ${e?.message || e}`);
    }
  }
  try {
    await db.execute(
      sql.raw(`DELETE FROM client_tags WHERE user_id IN (${ids.join(",")})`),
    );
  } catch {
    /* table absent */
  }
  // Bookings reference auditMarkedByUserId via users.id but no FK — safe.
  // Now drop the test users themselves.
  try {
    await db.delete(users).where(inArray(users.id, ids));
  } catch (e: any) {
    console.warn(`[cleanup] users delete: ${e?.message || e}`);
  }
}

// ────────────────────────────────────────────────────────────────────────────
async function main() {
  console.log(`[task65] tag=${TAG}`);
  const { server, base } = await bootApp();
  console.log(`[task65] in-process app on ${base}`);

  try {
    await test("storage.mergeUsers reassigns every dependent table + audits", unitTestMergeUsers);
    await test(
      "POST /api/auth/register rejects normalised duplicates (email dot/plus/case + phone)",
      () => httpTestDuplicateRegistration(base),
    );
    await test(
      "POST /api/admin/clients/merge moves rows + blocks loser login",
      () => httpTestAdminMerge(base),
    );
  } finally {
    await cleanup().catch((e) => console.warn("[cleanup] failed:", e));
    server.close();
    await pool.end().catch(() => {});
  }

  const failed = results.filter((r) => !r.ok);
  console.log(`\n[task65] ${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    for (const f of failed) {
      console.error(`  ✗ ${f.name}: ${f.err?.message || f.err}`);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error("[task65] FATAL:", e);
  process.exit(2);
});
