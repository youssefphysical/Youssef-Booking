/* eslint-disable no-console */
/**
 * BUILD-TIME HERO STATIC FILE REFRESH (May 2026, FINAL flash kill)
 * =================================================================
 *
 * Runs once on Vercel after `vite build` completes. Reads the active
 * hero image directly from Neon, then writes its binary contents to
 * `dist/public/hero-default.webp` — overwriting the committed dev
 * placeholder with the admin's current production photo so the
 * static file served at `/hero-default.webp` is always in sync.
 *
 * Why this design (vs. the previous HTML-bake approach)
 * -----------------------------------------------------
 * The earlier version of this script inlined the hero's base64 data
 * URL into a `<script>window.__INITIAL_HERO_IMAGES__=...</script>`
 * tag and a `<link rel="preload" as="image" href="data:image/...">`.
 * That worked but had two costs:
 *   1) The HTML grew from 6 KB to 220 KB for EVERY route (Vercel
 *      rewrite serves the same index.html at /book, /policy, /admin,
 *      /how-it-works, etc). Non-home routes paid the bloat.
 *   2) First paint still required the JS bundle to render the React
 *      <img> tag — the browser had the data URL preloaded but no
 *      element to attach it to until React mounted.
 * This new approach renders a real `<img src="/hero-default.webp">`
 * in HeroSlider.tsx unconditionally, paired with a
 * `<link rel="preload" as="image" href="/hero-default.webp">` in the
 * HTML head. The browser starts decoding the image as soon as it
 * sees the preload link — long before React mounts. The image is on
 * screen on the very first frame after HTML parse. This script's job
 * is just to keep the static file fresh: every deploy overwrites the
 * webp with whatever the admin's current active hero is.
 *
 * Failure mode
 * ------------
 * If DATABASE_URL is missing, the table is empty, or the query
 * throws, this script logs and exits 0. The deploy still succeeds;
 * the dev placeholder committed at `client/public/hero-default.webp`
 * is what gets served. Worst case: the static file is one deploy
 * behind the admin's latest upload — the dynamic slides loaded by
 * the API after first paint cover the static base, so the user sees
 * the latest hero as soon as the JS bundle finishes loading anyway.
 * Never breaks the deploy.
 */

import { writeFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import pg from "pg";

const OUT_PATH = resolve("dist/public/hero-default.webp");

async function fetchActiveFirstHero() {
  if (!process.env.DATABASE_URL) {
    console.log("[inject-hero] DATABASE_URL missing — keeping committed dev placeholder.");
    return null;
  }
  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    ssl: /sslmode=require|neon\.tech/.test(process.env.DATABASE_URL)
      ? { rejectUnauthorized: false }
      : undefined,
  });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT id, image_data_url
        FROM hero_images
       WHERE is_active = true
       ORDER BY sort_order ASC, id ASC
       LIMIT 1
    `);
    return rows[0] || null;
  } finally {
    await client.end().catch(() => {});
  }
}

(async () => {
  try {
    if (!existsSync(dirname(OUT_PATH))) {
      mkdirSync(dirname(OUT_PATH), { recursive: true });
    }
    const row = await fetchActiveFirstHero();
    if (!row) {
      console.log("[inject-hero] No active hero in DB — keeping committed dev placeholder.");
      return;
    }
    const dataUrl = row.image_data_url || "";
    const m = dataUrl.match(/^data:(image\/[a-z+]+);base64,(.+)$/);
    if (!m) {
      console.log("[inject-hero] Active hero is not a data URL — keeping committed dev placeholder.");
      return;
    }
    const buf = Buffer.from(m[2], "base64");
    writeFileSync(OUT_PATH, buf);
    console.log(
      `[inject-hero] Refreshed ${OUT_PATH} from active hero id=${row.id} ` +
        `(${m[1]}, ${buf.length} bytes).`,
    );
  } catch (e) {
    console.error("[inject-hero] FAILED — committed dev placeholder remains:", e?.message || e);
    // exit 0 — never break the deploy
  }
})();
