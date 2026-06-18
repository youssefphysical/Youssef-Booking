/**
 * generate-ye-icons.mjs  —  v2 (optimized fill + sharpening)
 *
 * Strategy:
 *   1. Trim transparent border from source → 795×513 content.
 *   2. For every square canvas, size the icon to 94% of canvas WIDTH
 *      (landscape source means width fills first with fit:contain).
 *      This maximises visual size without distorting the YE shape.
 *   3. Apply Lanczos3 downscaling + post-sharpen for ≤48 px.
 *   4. Maskable: 82% width, AMOLED black fill.
 *   5. Produce a contact-sheet PNG for visual QA.
 */

import sharp from "sharp";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const SRC  = join(ROOT, "attached_assets/Picsart_26-06-18_19-23-19-482_1781797753655.png");
const OUT  = join(ROOT, "client/public");

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };
const AMOLED      = { r: 5, g: 5, b: 5, alpha: 255 };

/* ── 1. Pre-trim the source once (removes sparse transparent edge) ───────── */
const TRIMMED_BUF = await sharp(SRC)
  .trim({ background: { r: 0, g: 0, b: 0, alpha: 0 }, threshold: 10 })
  .png()
  .toBuffer();
const TRIMMED_META = await sharp(TRIMMED_BUF).metadata();
console.log(`[ye-icons] Trimmed source: ${TRIMMED_META.width}×${TRIMMED_META.height}`);

/**
 * Square icon generator.
 *
 * @param {number} size         - Output canvas dimension in px (square).
 * @param {number} widthFrac    - Icon width as fraction of canvas (0-1).
 * @param {object} bg           - Extend/contain background colour.
 * @param {boolean} doSharpen   - Apply post-resize sharpen (for ≤48 px).
 */
async function makeIconBuf(size, widthFrac = 0.94, bg = TRANSPARENT, doSharpen = false) {
  // Target icon width within the square canvas.
  const targetW = Math.round(size * widthFrac);

  // Fit into (targetW × size) box — landscape source fills width first,
  // vertical space is padded with bg. Result dimensions = targetW × ~(targetW/ar).
  let pipe = sharp(TRIMMED_BUF)
    .resize(targetW, size, {
      fit: "contain",
      background: bg,
      kernel: "lanczos3",
      withoutEnlargement: false,
    });

  if (doSharpen) {
    // Mild adaptive sharpen: sigma tuned for small-px readability.
    pipe = pipe.sharpen({ sigma: 0.6, m1: 0.8, m2: 2.5, x1: 2, y2: 10, y3: 20 });
  }

  // Extend left/right to reach full square canvas.
  const totalPad = size - targetW;
  const padL = Math.floor(totalPad / 2);
  const padR = totalPad - padL;

  return pipe
    .extend({ top: 0, bottom: 0, left: padL, right: padR, background: bg })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/**
 * Maskable icon: 82% width-fill, AMOLED black background, flattened.
 * Gives ~53% height coverage — safely inside Android's safe-area circle.
 */
async function makeMaskableBuf(size) {
  const targetW = Math.round(size * 0.82);
  const totalPad = size - targetW;
  const padL = Math.floor(totalPad / 2);
  const padR = totalPad - padL;

  return sharp(TRIMMED_BUF)
    .resize(targetW, size, {
      fit: "contain",
      background: AMOLED,
      kernel: "lanczos3",
    })
    .extend({ top: 0, bottom: 0, left: padL, right: padR, background: AMOLED })
    .flatten({ background: { r: 5, g: 5, b: 5 } })
    .png({ compressionLevel: 9 })
    .toBuffer();
}

/* ── 2. Generate all icon sizes ─────────────────────────────────────────── */
console.log("[ye-icons] Generating icons…");

const SIZES = {
  "favicon-16.png":       { size: 16,  wf: 0.94, sharpen: true  },
  "favicon-32.png":       { size: 32,  wf: 0.94, sharpen: true  },
  "favicon-48.png":       { size: 48,  wf: 0.94, sharpen: true  },
  "favicon-96.png":       { size: 96,  wf: 0.94, sharpen: false },
  "favicon-180.png":      { size: 180, wf: 0.94, sharpen: false },
  "favicon-192.png":      { size: 192, wf: 0.94, sharpen: false },
  "favicon.png":          { size: 32,  wf: 0.94, sharpen: true  },
  "apple-touch-icon.png": { size: 180, wf: 0.94, sharpen: false },
  "icon-192.png":         { size: 192, wf: 0.94, sharpen: false },
  "icon-512.png":         { size: 512, wf: 0.94, sharpen: false },
};

const results = await Promise.all(
  Object.entries(SIZES).map(async ([name, { size, wf, sharpen }]) => {
    const buf = await makeIconBuf(size, wf, TRANSPARENT, sharpen);
    return { name, buf, size };
  })
);

// Maskable icons separately
const maskable512 = await makeMaskableBuf(512);
const maskable192 = await makeMaskableBuf(192);

// Write all PNGs
for (const { name, buf } of results) {
  writeFileSync(join(OUT, name), buf);
  console.log(`  ✓ ${name} (${buf.length} bytes)`);
}
writeFileSync(join(OUT, "icon-512-maskable.png"), maskable512);
console.log(`  ✓ icon-512-maskable.png (${maskable512.length} bytes)`);
writeFileSync(join(OUT, "icon-192-maskable.png"), maskable192);
console.log(`  ✓ icon-192-maskable.png (${maskable192.length} bytes)`);

/* ── 3. Build multi-size favicon.ico (16 + 32 + 48 embedded PNGs) ────────── */
function buildIco(buffers, widths) {
  const N   = buffers.length;
  const hdr = Buffer.alloc(6 + N * 16);
  hdr.writeUInt16LE(0, 0);
  hdr.writeUInt16LE(1, 2);
  hdr.writeUInt16LE(N, 4);
  let offset = 6 + N * 16;
  for (let i = 0; i < N; i++) {
    const w   = widths[i];
    const pos = 6 + i * 16;
    hdr.writeUInt8(w >= 256 ? 0 : w, pos);
    hdr.writeUInt8(w >= 256 ? 0 : w, pos + 1);
    hdr.writeUInt8(0,  pos + 2);
    hdr.writeUInt8(0,  pos + 3);
    hdr.writeUInt16LE(1,  pos + 4);
    hdr.writeUInt16LE(32, pos + 6);
    hdr.writeUInt32LE(buffers[i].length, pos + 8);
    hdr.writeUInt32LE(offset, pos + 12);
    offset += buffers[i].length;
  }
  return Buffer.concat([hdr, ...buffers]);
}

const buf16 = results.find(r => r.name === "favicon-16.png").buf;
const buf32 = results.find(r => r.name === "favicon-32.png").buf;
const buf48 = results.find(r => r.name === "favicon-48.png").buf;
const icoBuf = buildIco([buf16, buf32, buf48], [16, 32, 48]);
writeFileSync(join(OUT, "favicon.ico"), icoBuf);
console.log(`  ✓ favicon.ico (multi-size 16+32+48, ${icoBuf.length} bytes)`);

/* ── 4. Contact sheet — dark bg, icons at 16/32/48/96/192/512 side by side ─ */
console.log("[ye-icons] Building contact sheet…");

const SHEET_SIZES  = [512, 192, 96, 48, 32, 16];
const PAD          = 24;     // gap between icons
const SHEET_BG     = { r: 8, g: 8, b: 8, alpha: 255 };

const sheetIcons = await Promise.all(
  SHEET_SIZES.map(sz => makeIconBuf(sz, 0.94, TRANSPARENT, sz <= 48))
);

const totalW = SHEET_SIZES.reduce((s, sz) => s + sz, 0) + PAD * (SHEET_SIZES.length + 1);
const totalH = 512 + PAD * 2;

const composites = [];
let curX = PAD;
for (let i = 0; i < SHEET_SIZES.length; i++) {
  const sz = SHEET_SIZES[i];
  // Centre icon vertically in the 512-high strip
  const yOff = PAD + Math.floor((512 - sz) / 2);
  composites.push({ input: sheetIcons[i], left: curX, top: yOff });
  curX += sz + PAD;
}

const sheetBuf = await sharp({
  create: { width: totalW, height: totalH, channels: 4, background: SHEET_BG },
})
  .composite(composites)
  .png({ compressionLevel: 6 })
  .toBuffer();

const sheetPath = join(ROOT, "attached_assets/screenshots/ye-icon-contact-sheet.png");
writeFileSync(sheetPath, sheetBuf);
console.log(`  ✓ Contact sheet: ${totalW}×${totalH} → ${sheetPath}`);

console.log("[ye-icons] All done ✓");
