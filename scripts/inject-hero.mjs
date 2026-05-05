/* eslint-disable no-console */
/**
 * BUILD-TIME HERO BAKE (May 2026 — permanent flash fix)
 * =====================================================
 *
 * Runs once on Vercel after `vite build` completes. Reads the active
 * hero image directly from Neon, then patches `dist/public/index.html`
 * so the FIRST hero's full data URL is present in the very first byte
 * the CDN sends back to the browser.
 *
 * Why this exists
 * ---------------
 * Even with the parallel /api/hero-images fetch from index.html, the
 * image bytes still have to travel from origin → browser before paint.
 * On a cold CDN edge, that's a 200-400 ms round-trip the user sees as
 * a gradient flash. Baking the image into the HTML eliminates the
 * round-trip entirely: by the time the HTML parser reaches `<body>`,
 * the image is already preloaded AND its data URL is already on
 * window.__INITIAL_HERO_IMAGES__ for TanStack Query's initialData.
 *
 * Failure mode
 * ------------
 * If DATABASE_URL is missing, the table is empty, or the query
 * throws, this script logs and exits 0 — the build still succeeds,
 * and the runtime async-fetch fallback in index.html keeps working
 * exactly as before. Never breaks the deploy.
 *
 * No deps beyond `pg` (already a project dep). XSS-safe: the JSON
 * blob is sanitised against `</script>` injection before insertion.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import pg from "pg";

const HTML_PATH = resolve("dist/public/index.html");

async function fetchActiveHeroes() {
  if (!process.env.DATABASE_URL) {
    console.log("[inject-hero] DATABASE_URL missing — skipping bake (runtime fetch fallback remains).");
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
      SELECT id, image_data_url, title, subtitle, badge, is_active, sort_order,
             focal_x, focal_y, zoom, rotate, brightness, contrast,
             overlay_opacity, created_at
        FROM hero_images
       WHERE is_active = true
       ORDER BY sort_order ASC, id ASC
    `);
    return rows.map((r) => ({
      id: r.id,
      imageDataUrl: r.image_data_url,
      title: r.title,
      subtitle: r.subtitle,
      badge: r.badge,
      isActive: r.is_active,
      sortOrder: r.sort_order,
      focalX: r.focal_x,
      focalY: r.focal_y,
      zoom: r.zoom,
      rotate: r.rotate,
      brightness: r.brightness,
      contrast: r.contrast,
      overlayOpacity: r.overlay_opacity,
      createdAt: r.created_at,
    }));
  } finally {
    await client.end().catch(() => {});
  }
}

function bakeHtml(html, heroes) {
  const first = heroes[0];
  // Only bake the FIRST slide's image into the preload. Baking ALL
  // slides would balloon HTML to ~Nx150KB. The runtime bootstrap
  // fetch updates window.__INITIAL_HERO_IMAGES__ with the full list
  // for the rotating slider; useQuery's queryFn awaits that promise.
  const onlyFirst = [first];
  // XSS-safe JSON: replace any literal `</` inside string values so
  // a malicious slide title can never close the <script> tag early.
  const json = JSON.stringify(onlyFirst).replace(/<\/(script)/gi, "<\\/$1");

  const preloadTag = `<link rel="preload" as="image" href="${first.imageDataUrl}" fetchpriority="high">`;
  const bootStateTag =
    `<script>` +
    `window.__INITIAL_HERO_IMAGES__=${json};` +
    `window.__HERO_BAKED__=true;` +
    `</script>`;

  // Insert immediately after the existing <link rel="icon"> so the
  // preload is the very first non-icon thing the parser sees. The
  // existing async-fetch bootstrap script in index.html will see
  // window.__HERO_BAKED__ and skip its synthetic preload (the baked
  // one already exists) but STILL run its fetch to refresh the full
  // slide list for the rotation.
  const anchor = '<link rel="icon" type="image/png" href="/favicon.png" />';
  if (!html.includes(anchor)) {
    throw new Error(`Anchor not found in HTML: ${anchor}`);
  }
  return html.replace(
    anchor,
    `${anchor}\n    ${preloadTag}\n    ${bootStateTag}`,
  );
}

(async () => {
  try {
    if (!existsSync(HTML_PATH)) {
      console.error(`[inject-hero] ${HTML_PATH} not found — did vite build succeed?`);
      return;
    }
    const heroes = await fetchActiveHeroes();
    if (!heroes || heroes.length === 0) {
      console.log("[inject-hero] No active hero images — leaving runtime fallback in place.");
      return;
    }
    const original = readFileSync(HTML_PATH, "utf8");
    const patched = bakeHtml(original, heroes);
    writeFileSync(HTML_PATH, patched);
    console.log(
      `[inject-hero] Baked first of ${heroes.length} hero(es) into HTML — ` +
        `imageDataUrl=${(heroes[0].imageDataUrl || "").length}b, ` +
        `HTML grew from ${original.length}b → ${patched.length}b.`,
    );
  } catch (e) {
    console.error("[inject-hero] FAILED — runtime fallback remains:", e?.message || e);
    // exit 0 — never break the deploy
  }
})();
