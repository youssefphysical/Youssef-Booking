/* eslint-disable no-console */
/**
 * BUILD-TIME BRAND LOGO SYNC (Vercel-safe)
 * =========================================
 * Runs once on Vercel after `vite build` completes.
 *
 * Problem it solves
 * -----------------
 * Vercel's serverless filesystem is read-only at runtime — files written
 * to /uploads/brand/ during a previous deploy do not persist. Any
 * settings.logo_*_url that holds a /uploads/brand/ path will 404 in
 * production because the file only ever existed on the build machine.
 *
 * This script migrates every such URL to the matching file that Vite
 * has already bundled into dist/public/brand/ so the logo is served
 * from Vercel's CDN instead of the ephemeral serverless disk.
 *
 * Current static brand assets (client/public/brand/ → /brand/ on CDN):
 *   logo-login.png  →  settings.logo_login_url  (Login / Auth Hero Logo)
 *
 * Rules
 * -----
 * - Only updates a column if it currently holds a /uploads/brand/ path
 *   OR is NULL/empty AND a matching static file exists in dist/public/brand/.
 * - Never overwrites a value that is already a /brand/ CDN path or a
 *   data: URL — that means the admin set it deliberately.
 * - Always exits 0. A failure here must never break a deploy.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const BRAND_STATIC_ROOT = resolve("dist/public/brand");

/**
 * Map of: { settingsColumn, staticFilename, label }
 * Add more entries here when additional logos are committed to client/public/brand/.
 */
const LOGO_MIGRATIONS = [
  {
    column:   "logo_login_url",
    file:     "logo-login.png",
    label:    "Login / Auth Hero Logo",
  },
];

async function run() {
  if (!process.env.DATABASE_URL) {
    console.log("[inject-brand-logos] DATABASE_URL missing — skipping.");
    return;
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=require|neon\.tech/.test(process.env.DATABASE_URL)
      ? { rejectUnauthorized: false }
      : undefined,
  });

  await client.connect();

  try {
    // Read current settings row
    const { rows } = await client.query(
      "SELECT logo_login_url FROM settings WHERE id = 1 LIMIT 1"
    );
    if (!rows.length) {
      console.log("[inject-brand-logos] No settings row found — skipping.");
      return;
    }
    const current = rows[0];

    for (const { column, file, label } of LOGO_MIGRATIONS) {
      const currentVal = current[column];
      const staticPath  = resolve(BRAND_STATIC_ROOT, file);
      const publicUrl   = `/brand/${file}`;

      if (!existsSync(staticPath)) {
        console.log(`[inject-brand-logos] ${label}: dist file missing (${staticPath}) — skipping.`);
        continue;
      }

      // Don't overwrite a value that is already the CDN path or a data: URL
      if (currentVal === publicUrl) {
        console.log(`[inject-brand-logos] ${label}: already set to ${publicUrl} — no change needed.`);
        continue;
      }
      if (typeof currentVal === "string" && currentVal.startsWith("data:")) {
        console.log(`[inject-brand-logos] ${label}: current value is a data URL (admin-set) — skipping.`);
        continue;
      }
      if (typeof currentVal === "string" && currentVal.startsWith("/brand/")) {
        console.log(`[inject-brand-logos] ${label}: current value is a /brand/ CDN path (${currentVal}) — skipping.`);
        continue;
      }

      // Migrate: NULL, empty, or stale /uploads/brand/ path → CDN path
      const reason = !currentVal ? "was NULL/empty"
                   : currentVal.startsWith("/uploads/brand/") ? `was non-persistent serverless path (${currentVal})`
                   : `was ${currentVal}`;
      await client.query(
        `UPDATE settings SET ${column} = $1 WHERE id = 1`,
        [publicUrl]
      );
      console.log(`[inject-brand-logos] ${label}: updated — ${reason} → ${publicUrl}`);
    }
  } finally {
    await client.end().catch(() => {});
  }
}

run().catch((err) => {
  console.error("[inject-brand-logos] error (non-fatal):", err.message);
  process.exit(0);
});
