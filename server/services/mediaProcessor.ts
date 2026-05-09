import sharp from "sharp";
import {
  MEDIA_DESKTOP_WIDTHS,
  MEDIA_MOBILE_WIDTHS,
} from "@shared/schema";

// Allowed MIME types for the raw upload. HEIC/HEIF supported because
// iPhones default to it — sharp+libvips handles it transparently.
const ALLOWED_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/heic",
  "image/heif",
]);

// 10 MB raw decoded ceiling — pixel-bomb protection. Express body
// limit is 10 MB so anything that arrives is already <= that.
const MAX_DECODED_BYTES = 10 * 1024 * 1024;
const MAX_DATA_URL_BYTES = 12 * 1024 * 1024;
const MAX_INPUT_PIXELS = 50_000_000; // ~7000x7000

export type VariantsBlob = {
  d: { a: Record<string, string>; w: Record<string, string> };
  m: { a: Record<string, string>; w: Record<string, string> };
};

export type ProcessedMedia = {
  master: string; // base64 (no data: prefix)
  variants: VariantsBlob;
  lqip: string; // full data:image/jpeg;base64,... ready to inline
  originalWidth: number;
  originalHeight: number;
  originalMime: string;
};

export type ProcessResult =
  | { ok: true; data: ProcessedMedia }
  | { ok: false; status: number; message: string };

/**
 * Compute extract() params that crop the source image to a target
 * aspect ratio centered on the focal point (focalX/focalY in 0..100).
 * Clamps to image bounds so cropping never extends past the edge.
 */
function focalCrop(
  origW: number,
  origH: number,
  targetAspect: string,
  focalX: number,
  focalY: number,
): { left: number; top: number; width: number; height: number } {
  const [aw, ah] = targetAspect.split("/").map(Number);
  const targetRatio = aw / ah;
  const origRatio = origW / origH;
  let newW: number;
  let newH: number;
  let left: number;
  let top: number;
  if (origRatio > targetRatio) {
    // Source is wider than target — crop horizontally.
    newH = origH;
    newW = Math.round(origH * targetRatio);
    left = Math.round((focalX / 100) * origW - newW / 2);
    left = Math.max(0, Math.min(origW - newW, left));
    top = 0;
  } else {
    // Source is taller than target — crop vertically.
    newW = origW;
    newH = Math.round(origW / targetRatio);
    left = 0;
    top = Math.round((focalY / 100) * origH - newH / 2);
    top = Math.max(0, Math.min(origH - newH, top));
  }
  return { left, top, width: newW, height: newH };
}

/**
 * Validate + decode a base64 data URL. Returns the buffer + mime
 * type, or a 4xx error envelope.
 */
function decodeDataUrl(
  dataUrl: string,
): { ok: true; buffer: Buffer; mime: string } | { ok: false; status: number; message: string } {
  if (typeof dataUrl !== "string" || dataUrl.length < 40) {
    return { ok: false, status: 400, message: "Image data is required" };
  }
  if (dataUrl.length > MAX_DATA_URL_BYTES) {
    return { ok: false, status: 400, message: "Image is too large" };
  }
  const m = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (!m) {
    return { ok: false, status: 400, message: "Image must be a base64 data URL" };
  }
  const mime = m[1].toLowerCase();
  if (!ALLOWED_MIME.has(mime)) {
    return {
      ok: false,
      status: 400,
      message: "Unsupported image type. Use PNG, JPEG, WebP, or HEIC.",
    };
  }
  const buffer = Buffer.from(m[2], "base64");
  if (buffer.byteLength > MAX_DECODED_BYTES) {
    return { ok: false, status: 400, message: "Image is too large after decoding" };
  }
  return { ok: true, buffer, mime };
}

/**
 * Process a brand-new upload: decode, validate, then run the full
 * variant pipeline. Returns the master (1920 webp@q92) plus all
 * 10 responsive variants + LQIP. Never throws — wraps sharp errors
 * into a 400 envelope so callers can return it as JSON.
 */
export async function processNewUpload(
  rawDataUrl: string,
  opts: { focalX: number; focalY: number; desktopAspect: string; mobileAspect: string },
): Promise<ProcessResult> {
  const decoded = decodeDataUrl(rawDataUrl);
  if (!decoded.ok) return decoded;
  try {
    const meta = await sharp(decoded.buffer, {
      failOn: "none",
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .metadata();
    if (!meta.width || !meta.height) {
      return { ok: false, status: 400, message: "Could not read image dimensions" };
    }
    // Build the master ONCE, then derive every variant from it.
    // Re-encoding from the master on focal change loses minimal
    // perceptual quality (q92 is near-lossless at 1920) and saves
    // us from having to keep the original raw upload in storage.
    const masterBuf = await sharp(decoded.buffer, {
      failOn: "none",
      limitInputPixels: MAX_INPUT_PIXELS,
    })
      .rotate()
      .resize({
        width: 1920,
        height: 1920,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 92, effort: 5, smartSubsample: true })
      .toBuffer();

    const masterMeta = await sharp(masterBuf).metadata();
    const masterW = masterMeta.width || meta.width;
    const masterH = masterMeta.height || meta.height;

    const variants = await deriveVariants(masterBuf, masterW, masterH, opts);
    const lqip = await buildLqip(masterBuf);

    return {
      ok: true,
      data: {
        master: masterBuf.toString("base64"),
        variants,
        lqip,
        // Store the ORIGINAL geometry — frontend uses it to set
        // explicit aspect-ratio and width/height for CLS prevention.
        originalWidth: meta.width,
        originalHeight: meta.height,
        originalMime: decoded.mime,
      },
    };
  } catch (e) {
    console.error("[mediaProcessor] processNewUpload failed:", e);
    return { ok: false, status: 400, message: "Could not process image. Try a different photo." };
  }
}

/**
 * Re-derive ALL 10 variants + LQIP from an existing master (used
 * when the admin changes focal point or aspect ratio). The master
 * itself is unchanged — only `variants` + `lqip` + `updatedAt`.
 */
export async function reprocessFromMaster(
  masterBase64: string,
  opts: { focalX: number; focalY: number; desktopAspect: string; mobileAspect: string },
): Promise<{ ok: true; variants: VariantsBlob; lqip: string } | { ok: false; status: number; message: string }> {
  try {
    const masterBuf = Buffer.from(masterBase64, "base64");
    const meta = await sharp(masterBuf).metadata();
    if (!meta.width || !meta.height) {
      return { ok: false, status: 500, message: "Master image is corrupt" };
    }
    const variants = await deriveVariants(masterBuf, meta.width, meta.height, opts);
    const lqip = await buildLqip(masterBuf);
    return { ok: true, variants, lqip };
  } catch (e) {
    console.error("[mediaProcessor] reprocessFromMaster failed:", e);
    return { ok: false, status: 500, message: "Could not regenerate variants" };
  }
}

/**
 * Generate the 10-variant matrix (desktop × {avif, webp} × 3 widths
 * + mobile × {avif, webp} × 2 widths). Every variant is focal-point
 * cropped to its breakpoint's aspect ratio so faces stay in frame.
 */
async function deriveVariants(
  masterBuf: Buffer,
  origW: number,
  origH: number,
  opts: { focalX: number; focalY: number; desktopAspect: string; mobileAspect: string },
): Promise<VariantsBlob> {
  const desktopCrop = focalCrop(origW, origH, opts.desktopAspect, opts.focalX, opts.focalY);
  const mobileCrop = focalCrop(origW, origH, opts.mobileAspect, opts.focalX, opts.focalY);

  const variants: VariantsBlob = {
    d: { a: {}, w: {} },
    m: { a: {}, w: {} },
  };

  // Run encodes serially within each breakpoint to avoid pegging
  // libvips' worker pool on a Vercel cold start. Total wall time
  // for 10 encodes on a typical hero photo is ~1.5s.
  for (const w of MEDIA_DESKTOP_WIDTHS) {
    const base = sharp(masterBuf, { failOn: "none" })
      .extract(desktopCrop)
      .resize({ width: w, withoutEnlargement: true });
    const [avif, webp] = await Promise.all([
      base.clone().avif({ quality: 50, effort: 4, chromaSubsampling: "4:2:0" }).toBuffer(),
      base.clone().webp({ quality: 82, effort: 4, smartSubsample: true }).toBuffer(),
    ]);
    variants.d.a[String(w)] = avif.toString("base64");
    variants.d.w[String(w)] = webp.toString("base64");
  }
  for (const w of MEDIA_MOBILE_WIDTHS) {
    const base = sharp(masterBuf, { failOn: "none" })
      .extract(mobileCrop)
      .resize({ width: w, withoutEnlargement: true });
    const [avif, webp] = await Promise.all([
      base.clone().avif({ quality: 50, effort: 4, chromaSubsampling: "4:2:0" }).toBuffer(),
      base.clone().webp({ quality: 82, effort: 4, smartSubsample: true }).toBuffer(),
    ]);
    variants.m.a[String(w)] = avif.toString("base64");
    variants.m.w[String(w)] = webp.toString("base64");
  }
  return variants;
}

/**
 * Build a tiny blurred placeholder (~500 bytes) that's safe to
 * inline in JSON. 24px wide JPEG at q50 with a soft blur — looks
 * like a frosted-glass version of the photo while real bytes load.
 */
async function buildLqip(masterBuf: Buffer): Promise<string> {
  const buf = await sharp(masterBuf, { failOn: "none" })
    .resize({ width: 24, withoutEnlargement: true })
    .blur(1.4)
    .jpeg({ quality: 50, chromaSubsampling: "4:2:0" })
    .toBuffer();
  return `data:image/jpeg;base64,${buf.toString("base64")}`;
}
