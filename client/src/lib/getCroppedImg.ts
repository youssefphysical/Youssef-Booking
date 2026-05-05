/**
 * v9.0 (May-2026) — Shared canvas exporter for react-easy-crop.
 *
 * react-easy-crop returns the user's selection in SOURCE-IMAGE
 * pixel coordinates via `croppedAreaPixels = {x, y, width, height}`.
 * This helper renders exactly those pixels into an output canvas,
 * applying rotation and an optional max-long-edge cap, then encodes
 * to WebP (preferred) or JPEG (Safari fallback / forceJpeg).
 *
 * Quality guarantees:
 * - The exported image's pixels are 1:1 with the SOURCE crop region
 *   (no upscaling, no fixed-canvas downscaling). What the user sees
 *   inside the crop window IS what gets saved.
 * - Optional `maxLongEdgePx` cap downsamples with the browser's
 *   `imageSmoothingQuality = "high"` to avoid DB-row bloat for very
 *   large source files (>4K). Below the cap, native source-pixel
 *   resolution is preserved.
 * - Encoding default: WebP at 0.97 (visually indistinguishable from
 *   the source even on hi-DPI screens, ~50-60% smaller than JPEG
 *   1.0). Safari fallback / forceJpeg uses JPEG at 0.97.
 */

export type PixelCrop = {
  x: number;
  y: number;
  width: number;
  height: number;
};

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.addEventListener("load", () => resolve(img));
    img.addEventListener("error", (e) => reject(e));
    // Avoid CORS taint when src is a data URL or same-origin.
    img.crossOrigin = "anonymous";
    img.src = src;
  });
}

/**
 * Compute the bounding-box dimensions of a rotated rectangle.
 * Used to size the intermediate canvas when rotation is applied.
 */
function rotatedBoundingBox(
  width: number,
  height: number,
  rotationDeg: number,
): { width: number; height: number } {
  const rad = (rotationDeg * Math.PI) / 180;
  const sin = Math.abs(Math.sin(rad));
  const cos = Math.abs(Math.cos(rad));
  return {
    width: width * cos + height * sin,
    height: width * sin + height * cos,
  };
}

export async function getCroppedImg(
  imageSrc: string,
  pixelCrop: PixelCrop,
  rotationDeg = 0,
  opts: {
    /** When the long edge of the cropped output exceeds this, scale
     * down with high-quality smoothing. Defaults to 4000 (per the
     * "STRICT IMAGE CROPPER + FULL QUALITY UPLOAD FIX" spec). */
    maxLongEdgePx?: number;
    /** Encode as JPEG instead of WebP. */
    forceJpeg?: boolean;
    /** Encoding quality 0..1. Defaults to 0.97. */
    quality?: number;
  } = {},
): Promise<string> {
  const { maxLongEdgePx = 4000, forceJpeg = false, quality = 0.97 } = opts;

  const image = await loadImage(imageSrc);
  const safeRotation = ((rotationDeg % 360) + 360) % 360;

  // 1) Render the (possibly rotated) source onto an intermediate
  //    canvas that's exactly large enough to hold its bounding box.
  const bbox = rotatedBoundingBox(
    image.naturalWidth,
    image.naturalHeight,
    safeRotation,
  );
  const intermediate = document.createElement("canvas");
  intermediate.width = Math.round(bbox.width);
  intermediate.height = Math.round(bbox.height);
  const ictx = intermediate.getContext("2d");
  if (!ictx) throw new Error("Canvas 2D context unavailable");
  ictx.imageSmoothingEnabled = true;
  ictx.imageSmoothingQuality = "high";
  ictx.translate(intermediate.width / 2, intermediate.height / 2);
  ictx.rotate((safeRotation * Math.PI) / 180);
  ictx.drawImage(
    image,
    -image.naturalWidth / 2,
    -image.naturalHeight / 2,
  );

  // 2) Cut out the requested crop region at native source-pixel
  //    resolution. `pixelCrop` is provided by react-easy-crop in
  //    the rotated-image coordinate space, so this is a clean blit.
  const cropped = document.createElement("canvas");
  cropped.width = Math.round(pixelCrop.width);
  cropped.height = Math.round(pixelCrop.height);
  const cctx = cropped.getContext("2d");
  if (!cctx) throw new Error("Canvas 2D context unavailable");
  cctx.imageSmoothingEnabled = true;
  cctx.imageSmoothingQuality = "high";
  cctx.drawImage(
    intermediate,
    pixelCrop.x,
    pixelCrop.y,
    pixelCrop.width,
    pixelCrop.height,
    0,
    0,
    cropped.width,
    cropped.height,
  );

  // 3) Optional max-long-edge cap. Below the cap, we keep the
  //    native source-pixel resolution (no quality loss). Above it,
  //    we downscale once with high-quality smoothing to keep the
  //    base64 payload under server body limits.
  let finalCanvas: HTMLCanvasElement = cropped;
  const longEdge = Math.max(cropped.width, cropped.height);
  if (longEdge > maxLongEdgePx) {
    const ratio = maxLongEdgePx / longEdge;
    const dst = document.createElement("canvas");
    dst.width = Math.round(cropped.width * ratio);
    dst.height = Math.round(cropped.height * ratio);
    const dctx = dst.getContext("2d");
    if (!dctx) throw new Error("Canvas 2D context unavailable");
    dctx.imageSmoothingEnabled = true;
    dctx.imageSmoothingQuality = "high";
    dctx.drawImage(cropped, 0, 0, dst.width, dst.height);
    finalCanvas = dst;
  }

  // 4) Encode. Try WebP first (much smaller for the same perceived
  //    quality); fall back to JPEG when the browser's WebP encoder
  //    is unavailable (older Safari) or when forceJpeg is set.
  let dataUrl: string;
  if (forceJpeg) {
    dataUrl = finalCanvas.toDataURL("image/jpeg", quality);
  } else {
    dataUrl = finalCanvas.toDataURL("image/webp", quality);
    if (!dataUrl.startsWith("data:image/webp")) {
      dataUrl = finalCanvas.toDataURL("image/jpeg", quality);
    }
  }
  return dataUrl;
}
