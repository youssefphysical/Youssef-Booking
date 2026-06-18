import sharp from "sharp";
import { writeFileSync } from "node:fs";

const MASTER = "client/public/brand/logo-master.png";
const PUB = "client/public";
const BRAND = "client/public/brand";
const DARK = { r: 5, g: 5, b: 5, alpha: 1 }; // #050505 AMOLED — app-icon/OG only

// Transparent square resize (preserves the logo, no bg, no crop).
async function transparentSquare(size, out) {
  await sharp(MASTER)
    .resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toFile(out);
  console.log("✓", out, `${size}x${size} transparent`);
}

// App-icon: logo centered on AMOLED dark, slight safe padding.
async function appIcon(size, out, pad = 0.12) {
  const inner = Math.round(size * (1 - pad * 2));
  const logo = await sharp(MASTER)
    .resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: DARK } })
    .composite([{ input: logo, gravity: "center" }])
    .png()
    .toFile(out);
  console.log("✓", out, `${size}x${size} app-icon`);
}

// OG / social card — 1200x630 logo centered on AMOLED dark.
async function ogCard(out, fmt = "png") {
  const logo = await sharp(MASTER)
    .resize(520, 520, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  let pipe = sharp({ create: { width: 1200, height: 630, channels: 4, background: DARK } })
    .composite([{ input: logo, gravity: "center" }]);
  if (fmt === "jpg") pipe = pipe.jpeg({ quality: 90 });
  else pipe = pipe.png();
  await pipe.toFile(out);
  console.log("✓", out, "1200x630 OG card");
}

// favicon.ico — 48x48 PNG payload (browsers accept PNG-in-ICO; we write a 48 png as .ico-compatible)
async function faviconIco(out) {
  // Real .ico: pack a 48x48 PNG. Use png buffer; most modern browsers read png .ico.
  const png = await sharp(MASTER)
    .resize(48, 48, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();
  // Minimal ICO header wrapping a single PNG image.
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);   // reserved
  header.writeUInt16LE(1, 2);   // type 1 = icon
  header.writeUInt16LE(1, 4);   // count
  const dir = Buffer.alloc(16);
  dir.writeUInt8(48, 0);        // width
  dir.writeUInt8(48, 1);        // height
  dir.writeUInt8(0, 2);         // palette
  dir.writeUInt8(0, 3);         // reserved
  dir.writeUInt16LE(1, 4);      // planes
  dir.writeUInt16LE(32, 6);     // bpp
  dir.writeUInt32LE(png.length, 8); // size
  dir.writeUInt32LE(22, 12);    // offset (6 + 16)
  writeFileSync(out, Buffer.concat([header, dir, png]));
  console.log("✓", out, "favicon.ico (48 png)");
}

await Promise.all([
  // Display logos — transparent, no bg, no crop
  transparentSquare(256, `${BRAND}/logo-navbar.png`),
  transparentSquare(512, `${BRAND}/logo-auth.png`),
  // Canonical brand-logo.png (kept for backward refs) — transparent
  transparentSquare(512, `${PUB}/brand-logo.png`),
  transparentSquare(512, `${PUB}/brand-logo-final.png`),
  // ye-logo aliases — transparent (kept identical for any stray refs)
  transparentSquare(512, `${PUB}/ye-logo.png`),
  transparentSquare(512, `${PUB}/ye-logo-horizontal.png`),
  transparentSquare(512, `${PUB}/ye-logo-primary.png`),
]);

await Promise.all([
  // App icons — dark bg (PWA requires opaque)
  appIcon(192, `${PUB}/icon-192.png`),
  appIcon(512, `${PUB}/icon-512.png`),
  appIcon(512, `${PUB}/icon-512-maskable.png`, 0.2),
  appIcon(180, `${PUB}/apple-touch-icon.png`),
  appIcon(180, `${PUB}/favicon-180.png`),
  appIcon(192, `${PUB}/favicon-192.png`),
  // Favicons — transparent (small, on tab bar)
  transparentSquare(16, `${PUB}/favicon-16.png`),
  transparentSquare(32, `${PUB}/favicon-32.png`),
  transparentSquare(48, `${PUB}/favicon-48.png`),
  transparentSquare(512, `${PUB}/favicon-512.png`),
  transparentSquare(48, `${PUB}/favicon.png`),
]);

await ogCard(`${BRAND}/logo-og.png`, "png");
await ogCard(`${PUB}/og-brand.jpg`, "jpg");
await faviconIco(`${PUB}/favicon.ico`);

console.log("\nAll logo assets regenerated from transparent master.");
