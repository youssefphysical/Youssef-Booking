import { pool } from "./db";

/**
 * Idempotent self-healing schema migration.
 *
 * Why this exists: production runs on a separate Neon database from dev, and
 * Drizzle's `db:push` only ever ran against the dev database. When the
 * "premium business" wave (May 2026) added new columns/tables, the prod
 * function started crashing with `column "no_show_count" does not exist`
 * during boot, returning 500 "Server failed to start" for every request
 * including /api/auth/login.
 *
 * This module runs ONCE per cold start (cached promise) and applies the
 * additive DDL with `IF NOT EXISTS` so it is safe to re-run forever and
 * cannot lose data. Once the columns exist, every subsequent boot is a no-op
 * (PostgreSQL still parses the statements but does nothing).
 *
 * NEVER add destructive operations here (DROP, RENAME, ALTER TYPE). This
 * file is reserved for additive recovery only.
 */
let ensurePromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!ensurePromise) ensurePromise = run();
  return ensurePromise;
}

async function run(): Promise<void> {
  const sql = `
    -- May 2026 premium-business wave (P1)
    ALTER TABLE IF EXISTS users
      ADD COLUMN IF NOT EXISTS no_show_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS admin_notes text,
      ADD COLUMN IF NOT EXISTS password_reset_token text,
      ADD COLUMN IF NOT EXISTS password_reset_expires timestamp;

    ALTER TABLE IF EXISTS packages
      ADD COLUMN IF NOT EXISTS start_date date,
      ADD COLUMN IF NOT EXISTS expiry_date date,
      ADD COLUMN IF NOT EXISTS status text;

    -- Bookings: every column added after the original schema. All NULL-safe /
    -- defaulted so adding them on prod cannot affect existing rows.
    -- (session_focus / training_goal omission was the cause of the
    -- "column session_focus does not exist" emergency in May 2026.)
    ALTER TABLE IF EXISTS bookings
      ADD COLUMN IF NOT EXISTS session_focus text,
      ADD COLUMN IF NOT EXISTS training_goal text,
      ADD COLUMN IF NOT EXISTS workout_category text,
      ADD COLUMN IF NOT EXISTS workout_notes text,
      ADD COLUMN IF NOT EXISTS admin_notes text,
      ADD COLUMN IF NOT EXISTS client_notes text,
      ADD COLUMN IF NOT EXISTS is_emergency_cancel boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS protected_cancellation boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS rescheduled_from text,
      ADD COLUMN IF NOT EXISTS is_manual_historical boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
      ADD COLUMN IF NOT EXISTS attendance_marked_by_user_id integer,
      ADD COLUMN IF NOT EXISTS attendance_marked_at timestamp,
      ADD COLUMN IF NOT EXISTS attendance_reason text;

    CREATE TABLE IF NOT EXISTS renewal_requests (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id),
      requested_package_type text NOT NULL,
      status text NOT NULL DEFAULT 'pending',
      client_note text,
      admin_note text,
      decided_by_user_id integer,
      decided_at timestamp,
      created_at timestamp DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS extension_requests (
      id serial PRIMARY KEY,
      user_id integer NOT NULL REFERENCES users(id),
      package_id integer NOT NULL,
      requested_days integer NOT NULL DEFAULT 7,
      reason text,
      status text NOT NULL DEFAULT 'pending',
      admin_note text,
      decided_by_user_id integer,
      decided_at timestamp,
      created_at timestamp DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS users_password_reset_token_idx
      ON users(password_reset_token);

    -- May 2026 cinematic homepage wave: hero overlay metadata + transformations
    ALTER TABLE IF EXISTS hero_images
      ADD COLUMN IF NOT EXISTS title text,
      ADD COLUMN IF NOT EXISTS subtitle text,
      ADD COLUMN IF NOT EXISTS badge text,
      ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

    -- May 2026 hero display-tuning wave: per-image render-time controls so
    -- the admin can fine-tune focal point / zoom / tilt / brightness /
    -- contrast / overlay darkness without re-cropping. All NULL-safe with
    -- sensible identity-ish defaults so pre-existing slides never shift.
    ALTER TABLE IF EXISTS hero_images
      ADD COLUMN IF NOT EXISTS focal_x        double precision DEFAULT 0,
      ADD COLUMN IF NOT EXISTS focal_y        double precision DEFAULT 0,
      ADD COLUMN IF NOT EXISTS zoom           double precision DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS rotate         double precision DEFAULT 0,
      ADD COLUMN IF NOT EXISTS brightness     double precision DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS contrast       double precision DEFAULT 1.0,
      ADD COLUMN IF NOT EXISTS overlay_opacity double precision DEFAULT 35;

    CREATE TABLE IF NOT EXISTS transformations (
      id serial PRIMARY KEY,
      before_image_data_url text NOT NULL,
      after_image_data_url text NOT NULL,
      display_name text,
      goal text,
      duration text,
      result text,
      testimonial text,
      is_active boolean NOT NULL DEFAULT true,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamp DEFAULT now()
    );
  `;

  try {
    console.log("[ensureSchema] running idempotent additive migration");
    await pool.query(sql);
    console.log("[ensureSchema] OK");
  } catch (err) {
    console.error("[ensureSchema] FAILED — server will still try to boot:", err);
    // Reset the cached promise so the next request retries. This avoids
    // permanently locking the process into a broken state if the migration
    // hits a transient Neon error.
    ensurePromise = null;
    throw err;
  }
}
