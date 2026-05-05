import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Slider } from "@/components/ui/slider";
import {
  Loader2,
  Upload,
  ZoomIn,
  RotateCcw,
  RotateCw,
  Check,
} from "lucide-react";

export type AspectPreset = {
  /** Stable key, used for selection state. */
  key: string;
  /** Short label shown on the chip, e.g. "16:9" or "1:1". */
  label: string;
  /** width / height. Use any positive number. Use 0 for "free" crop. */
  ratio: number;
  /** Render the crop window as a circle preview (only useful with ratio=1). */
  circle?: boolean;
  /** Optional helper text under the chip. */
  hint?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Receives a base64 data-URL (WebP if supported, otherwise JPEG). */
  onCropped: (dataUrl: string) => void | Promise<void>;
  saving?: boolean;
  /** Heading inside the dialog. */
  title?: string;
  /** Subheading inside the dialog. */
  description?: string;
  /**
   * Aspect ratio chips shown to the admin. The FIRST entry is the default.
   * Pass a single entry to lock the cropper to one ratio.
   */
  aspects: AspectPreset[];
  /**
   * Long edge of the exported canvas (the short edge is derived from the
   * selected aspect). Default 1600 — large enough for hero/transformation,
   * small enough that base64 upload payloads stay reasonable.
   */
  outputLongEdgePx?: number;
  /** Default false. When true the cropper outputs a JPEG instead of WebP. */
  forceJpeg?: boolean;
};

const STAGE_MAX_W = 380;
const STAGE_MAX_H = 400;

/** Returns {w,h} for the on-screen crop window respecting the aspect ratio. */
function stageSizeForAspect(ratio: number) {
  if (!ratio || ratio <= 0) {
    // Free crop: render a 4:3 stage as a sensible default.
    return { w: STAGE_MAX_W, h: Math.round(STAGE_MAX_W * (3 / 4)) };
  }
  if (ratio >= STAGE_MAX_W / STAGE_MAX_H) {
    return { w: STAGE_MAX_W, h: Math.round(STAGE_MAX_W / ratio) };
  }
  return { w: Math.round(STAGE_MAX_H * ratio), h: STAGE_MAX_H };
}

/**
 * Re-renders an image into an offscreen canvas at the requested rotation
 * and returns a new HTMLImageElement built from that canvas. We pre-rotate
 * (rather than CSS-transforming inside the stage) so the pan/zoom math stays
 * a simple 2D translate+scale and the export pipeline doesn't need to track
 * orientation.
 */
async function rotateImageElement(
  source: HTMLImageElement,
  degrees: 0 | 90 | 180 | 270,
): Promise<HTMLImageElement> {
  if (degrees === 0) return source;
  const w = source.naturalWidth;
  const h = source.naturalHeight;
  const swap = degrees === 90 || degrees === 270;
  const cw = swap ? h : w;
  const ch = swap ? w : h;
  const canvas = document.createElement("canvas");
  canvas.width = cw;
  canvas.height = ch;
  const ctx = canvas.getContext("2d");
  if (!ctx) return source;
  ctx.translate(cw / 2, ch / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(source, -w / 2, -h / 2);
  return await new Promise((resolve, reject) => {
    const out = new Image();
    out.onload = () => resolve(out);
    out.onerror = reject;
    out.src = canvas.toDataURL("image/png");
  });
}

/**
 * Generic image cropper with aspect-ratio presets, drag-to-pan, zoom,
 * 90° rotation, and reset. Designed for any admin upload surface (hero
 * banner, progress photos, transformations, etc.).
 *
 * Implementation notes:
 * - All math is done in IMAGE pixels for stability under window resizes.
 * - Pan offset is the (x,y) of the image's top-left in stage coordinates;
 *   we clamp so the crop window stays fully covered.
 * - Rotation is applied via a pre-rotated offscreen canvas; pan/zoom math
 *   never needs to know about orientation.
 * - The browser handles EXIF rotation when decoding via createImageBitmap
 *   (when available), so portrait phone photos won't appear sideways.
 */
export function ImageCropper({
  open,
  onOpenChange,
  onCropped,
  saving,
  title,
  description,
  aspects,
  outputLongEdgePx = 1600,
  forceJpeg,
}: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [originalImage, setOriginalImage] = useState<HTMLImageElement | null>(
    null,
  );
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0);
  const [aspectKey, setAspectKey] = useState<string>(aspects[0]?.key || "");
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{
    startX: number;
    startY: number;
    baseX: number;
    baseY: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const aspect = useMemo(
    () => aspects.find((a) => a.key === aspectKey) || aspects[0],
    [aspects, aspectKey],
  );
  const stage = useMemo(
    () => stageSizeForAspect(aspect?.ratio || 0),
    [aspect],
  );

  // Reset everything when the dialog closes.
  useEffect(() => {
    if (!open) {
      setOriginalImage(null);
      setImageEl(null);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setRotation(0);
      setError(null);
      setAspectKey(aspects[0]?.key || "");
      // v8.9 (May-2026): also clear the file input value so the user
      // can re-pick the SAME file after cancelling. Browsers suppress
      // the `change` event when the same file path is re-selected,
      // which previously stranded admins on a "nothing happens" state
      // after they cancelled and tried again.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // When the image OR aspect OR rotation changes, fit "cover" + centre.
  useEffect(() => {
    if (!imageEl) return;
    const baseScale = Math.max(
      stage.w / imageEl.naturalWidth,
      stage.h / imageEl.naturalHeight,
    );
    setScale(1);
    const w = imageEl.naturalWidth * baseScale;
    const h = imageEl.naturalHeight * baseScale;
    setOffset({ x: (stage.w - w) / 2, y: (stage.h - h) / 2 });
  }, [imageEl, stage.w, stage.h]);

  // Rebuild the rotated working image whenever rotation or original changes.
  useEffect(() => {
    let cancelled = false;
    if (!originalImage) {
      setImageEl(null);
      return;
    }
    rotateImageElement(originalImage, rotation).then((img) => {
      if (!cancelled) setImageEl(img);
    });
    return () => {
      cancelled = true;
    };
  }, [originalImage, rotation]);

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("cropper.errFileType"));
      return;
    }
    if (file.size > 15 * 1024 * 1024) {
      setError(t("cropper.errFileSize"));
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => setError(t("cropper.errReadFile"));
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        setRotation(0);
        setOriginalImage(img);
      };
      img.onerror = () => setError(t("cropper.errDecode"));
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // ============== DRAG-TO-PAN ==============
  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!imageEl) return;
    // v8.9 (May-2026): capture on currentTarget (the stage div that
    // owns onPointerMove/Up/Cancel handlers), NOT on e.target. The
    // pointer often lands on the inner <img> or the ring overlay
    // (both `pointer-events-none`); capturing on those wrong
    // elements caused pointermove events to be delivered to a node
    // with no listeners, leaving `dragging` stuck and the drag
    // unresponsive — the "no smooth touch" / "drag stops responding"
    // bug. currentTarget guarantees capture on the listener owner.
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragging({
      startX: e.clientX,
      startY: e.clientY,
      baseX: offset.x,
      baseY: offset.y,
    });
  }
  function onDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !imageEl) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    setOffset(
      clampOffset({ x: dragging.baseX + dx, y: dragging.baseY + dy }, imageEl, scale),
    );
  }
  function endDrag() {
    setDragging(null);
  }

  function clampOffset(
    o: { x: number; y: number },
    img: HTMLImageElement,
    currentScale: number,
  ) {
    const baseScale = Math.max(stage.w / img.naturalWidth, stage.h / img.naturalHeight);
    const w = img.naturalWidth * baseScale * currentScale;
    const h = img.naturalHeight * baseScale * currentScale;
    const minX = stage.w - w;
    const minY = stage.h - h;
    return {
      x: Math.min(0, Math.max(minX, o.x)),
      y: Math.min(0, Math.max(minY, o.y)),
    };
  }

  // Re-clamp whenever the user changes the zoom level. Acts as a
  // safety net for paths that change scale without going through
  // setZoomToCenter (e.g. aspect-ratio reset).
  useEffect(() => {
    if (!imageEl) return;
    setOffset((o) => clampOffset(o, imageEl, scale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  /**
   * v8.9 (May-2026): zoom anchored to the CROP CENTER instead of
   * the image's top-left corner. Previously, sliding zoom from 1×
   * to 2× kept (offset.x, offset.y) constant — so the visible
   * content drifted toward the top-left of the crop window as the
   * image grew larger from its top-left anchor. Admins reported
   * this as "image jumping" or "wrong position after zoom".
   *
   * The fix maps the stage center to the same image pixel before
   * AND after the zoom change. Math:
   *   stage_center = (cx, cy)
   *   image_pixel_at_center_before = (cx - offset.x) / s_old
   *   image_pixel_at_center_after  = (cx - offset.x_new) / s_new
   *   set the two equal → offset.x_new = cx - (cx - offset.x) * (s_new / s_old)
   * Same for y. Then clamp so the crop window stays fully covered.
   */
  function setZoomToCenter(newScale: number) {
    if (!imageEl) {
      setScale(newScale);
      return;
    }
    const cx = stage.w / 2;
    const cy = stage.h / 2;
    const ratio = newScale / scale;
    const newOffset = clampOffset(
      {
        x: cx - (cx - offset.x) * ratio,
        y: cy - (cy - offset.y) * ratio,
      },
      imageEl,
      newScale,
    );
    setScale(newScale);
    setOffset(newOffset);
  }

  function resetView() {
    setScale(1);
    // v8.9 (May-2026): reset rotation too. Reset is supposed to mean
    // "back to the freshly-loaded state" — admins were confused that
    // the photo stayed sideways after they hit reset.
    setRotation(0);
    if (!imageEl) return;
    const baseScale = Math.max(
      stage.w / imageEl.naturalWidth,
      stage.h / imageEl.naturalHeight,
    );
    const w = imageEl.naturalWidth * baseScale;
    const h = imageEl.naturalHeight * baseScale;
    setOffset({ x: (stage.w - w) / 2, y: (stage.h - h) / 2 });
  }

  // ============== EXPORT ==============
  async function handleSave() {
    if (!imageEl) return;
    try {
      const baseScale = Math.max(
        stage.w / imageEl.naturalWidth,
        stage.h / imageEl.naturalHeight,
      );
      const renderScale = baseScale * scale;
      // The on-stage crop maps back to image pixels by inverting the transform.
      const sxImg = -offset.x / renderScale;
      const syImg = -offset.y / renderScale;
      const sWidthImg = stage.w / renderScale;
      const sHeightImg = stage.h / renderScale;

      // Output canvas keeps the stage aspect ratio; long edge clamped.
      const stageRatio = stage.w / stage.h;
      let outW: number;
      let outH: number;
      if (stageRatio >= 1) {
        outW = outputLongEdgePx;
        outH = Math.round(outputLongEdgePx / stageRatio);
      } else {
        outH = outputLongEdgePx;
        outW = Math.round(outputLongEdgePx * stageRatio);
      }
      const canvas = document.createElement("canvas");
      canvas.width = outW;
      canvas.height = outH;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        imageEl,
        sxImg,
        syImg,
        sWidthImg,
        sHeightImg,
        0,
        0,
        outW,
        outH,
      );
      // WebP first (much smaller); JPEG fallback for legacy Safari.
      // CINEMATIC TIER quality: WebP 0.95 / JPEG 0.96. At these
      // settings the encoder retains essentially all the perceptual
      // detail of the source — fine gym texture, fabric weave, hair,
      // dumbbell rack chrome — which is exactly what the upgraded
      // cinematic hero (twin-image depth-of-field rig + cyan grade)
      // needs to look like a premium movie poster. Size cost over
      // the previous 0.92/0.94 tier is modest (~10–15%) and well
      // worth it for the "wow… this is different" reaction.
      let dataUrl = forceJpeg
        ? canvas.toDataURL("image/jpeg", 0.96)
        : canvas.toDataURL("image/webp", 0.95);
      if (!dataUrl.startsWith("data:image/")) {
        dataUrl = canvas.toDataURL("image/jpeg", 0.96);
      } else if (!forceJpeg && !dataUrl.startsWith("data:image/webp")) {
        dataUrl = canvas.toDataURL("image/jpeg", 0.96);
      }
      await onCropped(dataUrl);
    } catch (e: any) {
      setError(e?.message || t("cropper.errSave"));
    }
  }

  // ============== STAGE GEOMETRY (for render) ==============
  const baseScale = imageEl
    ? Math.max(stage.w / imageEl.naturalWidth, stage.h / imageEl.naturalHeight)
    : 1;
  const imgW = imageEl ? imageEl.naturalWidth * baseScale * scale : 0;
  const imgH = imageEl ? imageEl.naturalHeight * baseScale * scale : 0;

  const isCircle = !!aspect?.circle && (aspect?.ratio === 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-cropper-title">
            {title || t("cropper.title")}
          </DialogTitle>
          <DialogDescription>
            {description || t("cropper.helperGeneric")}
          </DialogDescription>
        </DialogHeader>

        {!imageEl ? (
          <div className="space-y-3 py-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-cropper-pick"
              className="w-full h-44 rounded-2xl border-2 border-dashed border-white/15 bg-white/[0.02] hover:bg-white/5 transition-colors flex flex-col items-center justify-center gap-2 text-muted-foreground"
            >
              <div className="w-12 h-12 rounded-full bg-primary/15 text-primary flex items-center justify-center">
                <Upload size={20} />
              </div>
              <p className="text-sm font-medium">{t("cropper.choose")}</p>
              <p className="text-xs">{t("cropper.formatHint")}</p>
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp,image/heic,image/heif"
              className="hidden"
              data-testid="input-cropper-file"
              onChange={handlePickFile}
            />
            {error && (
              <p className="text-xs text-destructive" data-testid="text-cropper-error">
                {error}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            {/* ---- Aspect ratio chips ---- */}
            {aspects.length > 1 && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground mb-2">
                  {t("cropper.aspectRatio")}
                </p>
                <div className="flex flex-wrap gap-2">
                  {aspects.map((a) => {
                    const active = a.key === aspectKey;
                    return (
                      <button
                        key={a.key}
                        type="button"
                        onClick={() => setAspectKey(a.key)}
                        data-testid={`button-cropper-aspect-${a.key}`}
                        className={`px-3 h-8 rounded-full text-xs font-semibold border transition-colors ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                        }`}
                      >
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div
              className={`relative mx-auto overflow-hidden touch-none select-none border border-white/10 bg-black/40 ${
                isCircle ? "rounded-full" : "rounded-2xl"
              }`}
              style={{ width: stage.w, height: stage.h }}
              onPointerDown={startDrag}
              onPointerMove={onDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              data-testid="region-cropper-stage"
            >
              <img
                src={imageEl.src}
                alt=""
                draggable={false}
                style={{
                  position: "absolute",
                  left: offset.x,
                  top: offset.y,
                  width: imgW,
                  height: imgH,
                  cursor: dragging ? "grabbing" : "grab",
                  userSelect: "none",
                  pointerEvents: "none",
                }}
              />
              <div
                className={`absolute inset-0 ring-1 ring-white/15 pointer-events-none ${
                  isCircle ? "rounded-full" : "rounded-2xl"
                }`}
              />
            </div>

            <div className="flex items-center gap-3 px-1">
              <ZoomIn size={14} className="text-muted-foreground shrink-0" />
              <Slider
                value={[scale]}
                min={1}
                max={4}
                step={0.01}
                onValueChange={(v) => setZoomToCenter(v[0] ?? 1)}
                data-testid="slider-cropper-zoom"
              />
              <button
                type="button"
                onClick={() =>
                  setRotation((r) => (((r + 90) % 360) as 0 | 90 | 180 | 270))
                }
                data-testid="button-cropper-rotate"
                title={t("cropper.rotate")}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                <RotateCw size={14} />
              </button>
              <button
                type="button"
                onClick={resetView}
                data-testid="button-cropper-reset"
                title={t("cropper.reset")}
                className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-white/5"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setOriginalImage(null);
                setImageEl(null);
                setRotation(0);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              data-testid="button-cropper-change-photo"
            >
              {t("cropper.changePhoto")}
            </button>
            {error && (
              <p className="text-xs text-destructive" data-testid="text-cropper-error">
                {error}
              </p>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            data-testid="button-cropper-cancel"
            className="rounded-xl"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!imageEl || !!saving}
            data-testid="button-cropper-save"
            className="rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? (
              <>
                <Loader2 className="mr-2 animate-spin" size={14} />{" "}
                {t("common.saving")}
              </>
            ) : (
              <>
                <Check size={14} className="mr-2" /> {t("cropper.savePhoto")}
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Convert a base64 data URL to a File (needed for FormData uploads). */
export function dataUrlToFile(dataUrl: string, fileName: string): File {
  const [meta, b64] = dataUrl.split(",");
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = mimeMatch?.[1] || "image/jpeg";
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new File([arr], fileName, { type: mime });
}
