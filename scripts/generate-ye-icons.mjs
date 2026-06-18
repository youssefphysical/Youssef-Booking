/**
 * generate-ye-icons.mjs
 * Generates all small icon assets from the YE icon source.
 * Source: attached_assets/Picsart_26-06-18_19-23-19-482_1781796904655.png
 * Source already has transparent background (Picsart remove_bg applied).
 */

import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC  = join(ROOT, "attached_assets/Picsart_26-06-18_19-23-19-482_1781796904655.png");
const OUT  = join(ROOT, "client/public");

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const AMOLED      = { r: 5, g: 5, b: 5, alpha: 255 };

/**
 * Returns a square PNG buffer of exactly `size × size`.
 * The source is fitted inside `inner × inner` (aspect-preserving, centred),
 * then extended with `bg` to reach `size × size`.
 * `innerFraction` = how much of the square the logo occupies (0→1).
 */
async function makeIconBuf(size, innerFraction = 0.86, bg = TRANSPARENT) {
  const inner = Math.round(size * innerFraction);
  const pad   = Math.floor((size - inner) / 2);
  const padB  = size - inner - pad; // handles odd remainders

  const resized = await sharp(SRC)
    .resize(inner, inner, {
      fit: "contain",
      background: bg,
      kernel: "lanczos3",
    })
    .extend({ top: pad, bottom: padB, left: pad, right: padB, background: bg })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return resized;
}

/**
 * Maskable variant: 72 % inner so the logo is fully inside the Android
 * safe-area circle; background is AMOLED black so the OS fill blends.
 */
async function makeMaskableBuf(size) {
  const inner = Math.round(size * 0.72);
  const pad   = Math.floor((size - inner) / 2);
  const padB  = size - inner - pad;

  const resized = await sharp(SRC)
    .resize(inner, inner, {
      fit: "contain",
      background: AMOLED,
      kernel: "lanczos3",
    })
    .extend({ top: pad, bottom: padB, left: pad, right: padB, background: AMOLED })
    .flatten({ background: { r: 5, g: 5, b: 5 } })
    .png({ compressionLevel: 9 })
    .toBuffer();

  return resized;
}

/**
 * Wrap one or more PNG buffers in a valid ICO file.
 * Each buffer should be a square PNG. widths[] = pixel dimensions per image.
 */
function buildIco(buffers, widths) {
  const N   = buffers.length;
  const hdr = Buffer.alloc(6 + N * 16);

  hdr.writeUInt16LE(0, 0); // reserved
  hdr.writeUInt16LE(1, 2); // type: ICO
  hdr.writeUInt16LE(N, 4); // image count

  let offset = 6 + N * 16;
  for (let i = 0; i < N; i++) {
    const w   = widths[i];
    const pos = 6 + i * 16;
    hdr.writeUInt8(w >= 256 ? 0 : w, pos);     // width  (0 = 256)
    hdr.writeUInt8(w >= 256 ? 0 : w, pos + 1); // height (0 = 256)
    hdr.writeUInt8(0,  pos + 2); // colorCount
    hdr.writeUInt8(0,  pos + 3); // reserved
    hdr.writeUInt16LE(1,  pos + 4); // planes
    hdr.writeUInt16LE(32, pos + 6); // bitCount (32-bit RGBA PNG)
    hdr.writeUInt32LE(buffers[i].length, pos + 8);
    hdr.writeUInt32LE(offset, pos + 12);
    offset += buffers[i].length;
  }

  return Buffer.concat([hdr, ...buffers]);
}

async function run() {
  console.log("[ye-icons] Generating all icon sizes from YE icon source…");

  const [
    buf16,
    buf32,
    buf48,
    buf180,
    buf192,
    buf512,
    buf512m,
  ] = await Promise.all([
    makeIconBuf(16,  0.82),
    makeIconBuf(32,  0.84),
    makeIconBuf(48,  0.84),
    makeIconBuf(180, 0.86),
    makeIconBuf(192, 0.86),
    makeIconBuf(512, 0.88),
    makeMaskableBuf(512),
  ]);

  // Individual PNG files
  const files = [
    ["favicon-16.png",       buf16],
    ["favicon-32.png",       buf32],
    ["favicon-48.png",       buf48],
    ["favicon-180.png",      buf180],
    ["favicon-192.png",      buf192],
    ["favicon.png",          buf32],           // SW precache alias (32 px)
    ["apple-touch-icon.png", buf180],
    ["icon-192.png",         buf192],
    ["icon-512.png",         buf512],
    ["icon-512-maskable.png", buf512m],
  ];

  for (const [name, buf] of files) {
    const path = join(OUT, name);
    writeFileSync(path, buf);
    console.log(`  ✓ ${name} (${buf.length} bytes)`);
  }

  // favicon.ico — embed 16, 32, 48 in a multi-size ICO
  const icoPath = join(OUT, "favicon.ico");
  const icoBuf  = buildIco([buf16, buf32, buf48], [16, 32, 48]);
  writeFileSync(icoPath, icoBuf);
  console.log(`  ✓ favicon.ico (multi-size 16+32+48, ${icoBuf.length} bytes)`);

  console.log("[ye-icons] All icons generated ✓");
}

run().catch((e) => { console.error(e); process.exit(1); });
