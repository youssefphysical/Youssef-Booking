import path from "path";
import fs from "fs";
import sharp from "sharp";

/**
 * Optimize an image file in place: re-encode for the web and create a thumbnail.
 * If the file is not an image (e.g. PDF) or processing fails, the original file
 * is left untouched. Never throws — returns information about what happened.
 */
export async function optimizeImageFile(
  fullPath: string,
  mimeType: string,
  opts: { maxWidth?: number; quality?: number; thumb?: boolean } = {},
): Promise<{
  optimized: boolean;
  thumbnailUrlPart?: string;
  optimizedFilename?: string;
  originalSize?: number;
  optimizedSize?: number;
}> {
  const isImage = mimeType.startsWith("image/");
  if (!isImage) return { optimized: false };

  const dir = path.dirname(fullPath);
  const base = path.basename(fullPath, path.extname(fullPath));
  const optimizedFilename = `${base}.webp`;
  const optimizedPath = path.join(dir, optimizedFilename);

  try {
    const original = await fs.promises.stat(fullPath);
    const pipeline = sharp(fullPath, { failOn: "none" }).rotate();
    const meta = await pipeline.metadata();
    const targetWidth =
      opts.maxWidth && meta.width && meta.width > opts.maxWidth
        ? opts.maxWidth
        : null;
    let webp = pipeline.clone();
    if (targetWidth) webp = webp.resize({ width: targetWidth, withoutEnlargement: true });
    await webp
      .webp({ quality: opts.quality ?? 82, effort: 4 })
      .toFile(optimizedPath);

    let thumbnailFilename: string | undefined;
    if (opts.thumb !== false) {
      thumbnailFilename = `${base}_thumb.webp`;
      const thumbPath = path.join(dir, thumbnailFilename);
      await sharp(fullPath, { failOn: "none" })
        .rotate()
        .resize({ width: 480, withoutEnlargement: true })
        .webp({ quality: 70, effort: 4 })
        .toFile(thumbPath);
    }

    const optimized = await fs.promises.stat(optimizedPath);

    // If the optimized version is smaller, drop the original. Otherwise keep
    // both — sometimes already-optimized PNGs compress poorly.
    if (optimized.size < original.size) {
      try {
        await fs.promises.unlink(fullPath);
      } catch {
        /* ignore */
      }
    }

    return {
      optimized: true,
      optimizedFilename,
      thumbnailUrlPart: thumbnailFilename,
      originalSize: original.size,
      optimizedSize: optimized.size,
    };
  } catch (e) {
    console.warn("[image-utils] optimize failed:", e);
    return { optimized: false };
  }
}
