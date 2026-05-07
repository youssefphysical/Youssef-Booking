/* eslint-disable no-console */
/**
 * BUILD-TIME OG HERO GENERATOR (May 2026)
 * =======================================
 *
 * Generates a 1200x630 social-sharing OG image from the *current* active
 * homepage hero (the same source HeroSlider renders), composites a clean
 * dark-gradient overlay with the headline + brand wordmark, and stamps
 * the resulting file's content hash into og:image / twitter:image URLs
 * inside dist/public/index.html so WhatsApp / Facebook / LinkedIn /
 * Telegram / X auto-bust their previews whenever the hero changes.
 *
 * Source resolution order (first wins):
 *   1. Neon `hero_images` row where is_active = true (same query
 *      inject-hero.mjs uses — guarantees the OG matches what visitors
 *      actually see on the homepage).
 *   2. Static fallback: client/public/hero-initial.webp (committed dev
 *      placeholder; also what inject-hero falls back to).
 *
 * Output:
 *   - dist/public/og-hero-current.jpg            (the OG image, 1200x630)
 *   - dist/public/index.html                     (?v=current → ?v=<hash8>)
 *
 * Failure mode:
 *   Always exits 0. If anything goes wrong we leave the committed
 *   client/public/og-hero-current.jpg in place and the meta tag's
 *   ?v=current placeholder unchanged. Never breaks the deploy.
 */

import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { createHash } from "node:crypto";
import sharp from "sharp";
import pg from "pg";

const OUT_DIST = resolve("dist/public/og-hero-current.jpg");
const OUT_DEV = resolve("client/public/og-hero-current.jpg");
const HTML_PATH = resolve("dist/public/index.html");
const FALLBACK_HERO = resolve("client/public/hero-initial.webp");

// --- 1. Get hero source bytes (Neon → committed fallback) ----------------

async function fetchActiveHeroBuffer() {
  if (process.env.DATABASE_URL) {
    const client = new pg.Client({
      connectionString: process.env.DATABASE_URL,
      ssl: /sslmode=require|neon\.tech/.test(process.env.DATABASE_URL)
        ? { rejectUnauthorized: false }
        : undefined,
    });
    try {
      await client.connect();
      const { rows } = await client.query(`
        SELECT id, image_data_url
          FROM hero_images
         WHERE is_active = true
         ORDER BY sort_order ASC, id ASC
         LIMIT 1
      `);
      const row = rows[0];
      if (row?.image_data_url) {
        const m = row.image_data_url.match(/^data:image\/[a-z+]+;base64,(.+)$/);
        if (m) {
          const buf = Buffer.from(m[1], "base64");
          if (buf.length >= 1024) {
            console.log(`[og-hero] Using active hero id=${row.id} from Neon (${buf.length}b).`);
            return buf;
          }
        }
      }
    } catch (e) {
      console.log("[og-hero] Neon read failed, falling back to committed hero:", e?.message || e);
    } finally {
      await client.end().catch(() => {});
    }
  } else {
    console.log("[og-hero] DATABASE_URL missing — using committed hero.");
  }
  if (existsSync(FALLBACK_HERO)) {
    return readFileSync(FALLBACK_HERO);
  }
  throw new Error("No hero source available (neither Neon nor committed file).");
}

// --- 2. Compose 1200x630 OG image with clean overlay ---------------------

const OG_W = 1200;
const OG_H = 630;

function buildOverlaySvg() {
  // Dark gradient on the left third for text legibility, with subtle blue
  // accent line. Title pulled from the live homepage. Pure SVG — sharp
  // rasterises it crisply at 2x retina-equivalent quality.
  return `
<svg width="${OG_W}" height="${OG_H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.88"/>
      <stop offset="55%" stop-color="#000000" stop-opacity="0.55"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
    <linearGradient id="b" x1="0" y1="1" x2="0" y2="0">
      <stop offset="0%" stop-color="#000000" stop-opacity="0.85"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0"/>
    </linearGradient>
  </defs>
  <rect x="0" y="0" width="${OG_W}" height="${OG_H}" fill="url(#g)"/>
  <rect x="0" y="${OG_H - 220}" width="${OG_W}" height="220" fill="url(#b)"/>
  <rect x="60" y="170" width="6" height="220" rx="3" fill="#3b82f6"/>
  <g font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif" fill="#ffffff">
    <text x="90" y="200" font-size="22" font-weight="600" letter-spacing="6" fill="#93c5fd">PREMIUM PERSONAL TRAINING</text>
    <text x="90" y="285" font-size="74" font-weight="800" letter-spacing="-2">Your Transformation</text>
    <text x="90" y="365" font-size="74" font-weight="800" letter-spacing="-2">Starts Here.</text>
    <text x="90" y="430" font-size="26" font-weight="500" fill="#e2e8f0" opacity="0.92">Science-based coaching in Dubai · Youssef Ahmed</text>
  </g>
</svg>`.trim();
}

async function generateOgImage(heroBuf) {
  const overlay = Buffer.from(buildOverlaySvg());
  return sharp(heroBuf)
    .resize(OG_W, OG_H, { fit: "cover", position: "attention" })
    .composite([{ input: overlay, top: 0, left: 0 }])
    .jpeg({ quality: 86, progressive: true, mozjpeg: true, chromaSubsampling: "4:4:4" })
    .toBuffer();
}

// --- 3. Write file + stamp version into dist/public/index.html -----------

function writeOgFile(outPath, buf) {
  if (!existsSync(dirname(outPath))) mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, buf);
}

function stampHtmlVersion(hash) {
  if (!existsSync(HTML_PATH)) {
    console.log("[og-hero] dist/public/index.html missing — skipping HTML stamp (dev mode?).");
    return;
  }
  const html = readFileSync(HTML_PATH, "utf8");
  const stamped = html.replaceAll("og-hero-current.jpg?v=current", `og-hero-current.jpg?v=${hash}`);
  if (stamped === html) {
    console.log("[og-hero] No ?v=current placeholder found in HTML — already stamped or template changed.");
    return;
  }
  writeFileSync(HTML_PATH, stamped);
  console.log(`[og-hero] Stamped index.html with og-hero version ${hash}.`);
}

// --- main ----------------------------------------------------------------

(async () => {
  try {
    const heroBuf = await fetchActiveHeroBuffer();
    const ogBuf = await generateOgImage(heroBuf);
    const hash = createHash("sha256").update(ogBuf).digest("hex").slice(0, 8);

    // Always refresh the committed dev copy (so local preview & first
    // build after a hero change both see the right image).
    writeOgFile(OUT_DEV, ogBuf);

    // During Vercel build, dist/public exists → also write the
    // production copy and stamp the HTML.
    if (existsSync(resolve("dist/public"))) {
      writeOgFile(OUT_DIST, ogBuf);
      stampHtmlVersion(hash);
    }
    console.log(`[og-hero] OK — ${OG_W}x${OG_H}, ${ogBuf.length} bytes, hash=${hash}.`);
  } catch (e) {
    console.error("[og-hero] FAILED — committed og-hero-current.jpg remains:", e?.message || e);
    // exit 0 — never break the deploy
  }
})();
