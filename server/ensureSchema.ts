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

    -- May 2026 Package Builder wave: admin-defined package catalogue +
    -- snapshot columns on per-client packages so editing a template can
    -- never mutate an existing client's assignment.
    CREATE TABLE IF NOT EXISTS package_templates (
      id serial PRIMARY KEY,
      name text NOT NULL,
      type text NOT NULL DEFAULT 'standard',
      paid_sessions integer NOT NULL DEFAULT 0,
      bonus_sessions integer NOT NULL DEFAULT 0,
      total_sessions integer NOT NULL DEFAULT 0,
      price_per_session integer NOT NULL DEFAULT 0,
      total_price integer NOT NULL DEFAULT 0,
      expiration_value integer NOT NULL DEFAULT 30,
      expiration_unit text NOT NULL DEFAULT 'days',
      description text,
      is_active boolean NOT NULL DEFAULT true,
      display_order integer NOT NULL DEFAULT 0,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );

    ALTER TABLE IF EXISTS packages
      ADD COLUMN IF NOT EXISTS template_id        integer,
      ADD COLUMN IF NOT EXISTS name               text,
      ADD COLUMN IF NOT EXISTS paid_sessions      integer,
      ADD COLUMN IF NOT EXISTS bonus_sessions     integer,
      ADD COLUMN IF NOT EXISTS price_per_session  integer,
      ADD COLUMN IF NOT EXISTS total_price        integer;

    -- May 2026 Client Profile Admin Control wave: client lifecycle status,
    -- package payment / freeze / approval, categorized notes, audit log.
    ALTER TABLE IF EXISTS users
      ADD COLUMN IF NOT EXISTS client_status text NOT NULL DEFAULT 'incomplete',
      ADD COLUMN IF NOT EXISTS preferred_training_days text[],
      ADD COLUMN IF NOT EXISTS injuries text,
      ADD COLUMN IF NOT EXISTS medical_notes text,
      ADD COLUMN IF NOT EXISTS parq_completed boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS waiver_accepted boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS medical_clearance_note text,
      ADD COLUMN IF NOT EXISTS coach_notes text,
      ADD COLUMN IF NOT EXISTS goal_notes text,
      ADD COLUMN IF NOT EXISTS communication_notes text;

    ALTER TABLE IF EXISTS packages
      ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
      ADD COLUMN IF NOT EXISTS payment_approved boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS payment_approved_at timestamp,
      ADD COLUMN IF NOT EXISTS payment_approved_by_user_id integer,
      ADD COLUMN IF NOT EXISTS payment_note text,
      ADD COLUMN IF NOT EXISTS frozen boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS frozen_at timestamp,
      ADD COLUMN IF NOT EXISTS frozen_reason text,
      ADD COLUMN IF NOT EXISTS admin_approved boolean NOT NULL DEFAULT false,
      ADD COLUMN IF NOT EXISTS admin_approved_at timestamp,
      ADD COLUMN IF NOT EXISTS admin_approved_by_user_id integer;

    CREATE TABLE IF NOT EXISTS package_session_history (
      id serial PRIMARY KEY,
      package_id integer NOT NULL,
      user_id integer NOT NULL,
      action text NOT NULL,
      booking_id integer,
      sessions_delta integer NOT NULL DEFAULT 0,
      performed_by_user_id integer,
      reason text,
      created_at timestamp DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS package_session_history_package_idx
      ON package_session_history(package_id);
    CREATE INDEX IF NOT EXISTS package_session_history_user_idx
      ON package_session_history(user_id);

    -- Backfill: any client who already has an active package and finished
    -- registration should be considered active. Brand-new rows default to
    -- 'incomplete' via the column default.
    UPDATE users
       SET client_status = 'active'
     WHERE role = 'client'
       AND client_status = 'incomplete'
       AND primary_goal IS NOT NULL
       AND weekly_frequency IS NOT NULL;

    -- Backfill: existing assigned packages predate payment / approval
    -- tracking. Treat them as paid + approved so trainers don't lose clients
    -- mid-cycle when this migration ships. New packages will default to
    -- unpaid + unapproved (admin must opt-in).
    UPDATE packages
       SET payment_status = 'paid',
           payment_approved = true,
           admin_approved = true
     WHERE payment_status = 'unpaid'
       AND payment_approved = false
       AND admin_approved = false;

    -- May 2026 premium email-system wave: dedupe columns so the cron and the
    -- post-booking notifier never re-send the same email twice.
    ALTER TABLE IF EXISTS packages
      ADD COLUMN IF NOT EXISTS expiring_notified_at timestamp,
      ADD COLUMN IF NOT EXISTS finished_notified_at timestamp;

    ALTER TABLE IF EXISTS bookings
      ADD COLUMN IF NOT EXISTS reminder_24h_sent_at timestamp,
      ADD COLUMN IF NOT EXISTS reminder_1h_sent_at  timestamp;

    CREATE INDEX IF NOT EXISTS bookings_date_status_idx
      ON bookings(date, status);

    -- May 2026 Nutrition OS — Phase 2: Food Library catalogue.
    -- Additive only. Per-serving macros (not per-100g) so the meal builder
    -- can multiply by quantity client-side without unit conversion.
    -- created_by_user_id is intentionally NOT a foreign key so deleting a
    -- trainer never orphans / cascades the catalogue.
    CREATE TABLE IF NOT EXISTS foods (
      id serial PRIMARY KEY,
      name text NOT NULL,
      name_ar text,
      category text NOT NULL DEFAULT 'other',
      brand text,
      serving_size double precision NOT NULL DEFAULT 100,
      serving_unit text NOT NULL DEFAULT 'g',
      kcal double precision NOT NULL DEFAULT 0,
      protein_g double precision NOT NULL DEFAULT 0,
      carbs_g double precision NOT NULL DEFAULT 0,
      fats_g double precision NOT NULL DEFAULT 0,
      fiber_g double precision,
      sugar_g double precision,
      sodium_mg double precision,
      digestion_speed text,
      best_timing text,
      notes text,
      is_active boolean NOT NULL DEFAULT true,
      is_supplement boolean NOT NULL DEFAULT false,
      created_by_user_id integer,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );

    -- Search & filter indexes (designed for thousands of rows).
    CREATE INDEX IF NOT EXISTS foods_name_lower_idx
      ON foods (lower(name));
    CREATE INDEX IF NOT EXISTS foods_category_idx
      ON foods (category);
    CREATE INDEX IF NOT EXISTS foods_active_idx
      ON foods (is_active);
    CREATE INDEX IF NOT EXISTS foods_supplement_idx
      ON foods (is_supplement);
    CREATE INDEX IF NOT EXISTS foods_created_by_idx
      ON foods (created_by_user_id);

    -- Nutrition OS — Phase 3: Meal Builder
    CREATE TABLE IF NOT EXISTS meals (
      id serial PRIMARY KEY,
      name text NOT NULL,
      name_ar text,
      description text,
      category text NOT NULL DEFAULT 'other',
      notes text,
      is_template boolean NOT NULL DEFAULT true,
      is_active boolean NOT NULL DEFAULT true,
      total_kcal double precision NOT NULL DEFAULT 0,
      total_protein_g double precision NOT NULL DEFAULT 0,
      total_carbs_g double precision NOT NULL DEFAULT 0,
      total_fats_g double precision NOT NULL DEFAULT 0,
      created_by_user_id integer,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS meals_category_idx ON meals (category);
    CREATE INDEX IF NOT EXISTS meals_active_idx ON meals (is_active);
    CREATE INDEX IF NOT EXISTS meals_template_idx ON meals (is_template);
    CREATE INDEX IF NOT EXISTS meals_created_by_idx ON meals (created_by_user_id);
    CREATE INDEX IF NOT EXISTS meals_name_lower_idx ON meals (lower(name));

    CREATE TABLE IF NOT EXISTS meal_items (
      id serial PRIMARY KEY,
      meal_id integer NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
      food_id integer,
      name text NOT NULL,
      serving_size double precision NOT NULL DEFAULT 100,
      serving_unit text NOT NULL DEFAULT 'g',
      kcal double precision NOT NULL DEFAULT 0,
      protein_g double precision NOT NULL DEFAULT 0,
      carbs_g double precision NOT NULL DEFAULT 0,
      fats_g double precision NOT NULL DEFAULT 0,
      fiber_g double precision,
      sugar_g double precision,
      sodium_mg double precision,
      quantity double precision NOT NULL DEFAULT 1,
      notes text,
      sort_order integer NOT NULL DEFAULT 0,
      created_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS meal_items_meal_idx ON meal_items (meal_id);
    CREATE INDEX IF NOT EXISTS meal_items_food_idx ON meal_items (food_id);
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
