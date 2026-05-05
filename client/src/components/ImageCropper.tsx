import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import type { Area } from "react-easy-crop";
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
import { getCroppedImg } from "@/lib/getCroppedImg";

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
   * v9.0 (May-2026): semantics CHANGED from fixed-canvas size to
   * MAX-LONG-EDGE CAP. The exporter now produces output at the
   * native SOURCE-PIXEL resolution of the user's crop selection,
   * preserving sharpness and detail (no fixed downscale). When
   * the cropped long edge exceeds this cap, we downsample once
   * with high-quality smoothing — this protects the 10 MB JSON
   * body limit on `/api/admin/hero-images` from 4K+ phone photos.
   * Default 4000 per the "STRICT IMAGE CROPPER + FULL QUALITY"
   * spec. Existing call sites that pass 1920/1600 keep their cap;
   * the meaning is now "don't go above this", not "fix at this".
   */
  outputLongEdgePx?: number;
  /** Default false. When true the cropper outputs a JPEG instead of WebP. */
  forceJpeg?: boolean;
};

/**
 * v9.0 (May-2026) — Professional image cropper built on
 * `react-easy-crop` (the de-facto React port of the Cropper.js /
 * iOS Photos crop UX). Replaces the v8.x custom implementation.
 *
 * Why react-easy-crop:
 * - Battle-tested touch/mouse/wheel/pinch gesture pipeline that
 *   eliminates the v8.x bug class entirely (no pointer-capture
 *   foot-guns, no zoom-anchor drift, no jumpy drag).
 * - Native pinch-to-zoom on mobile, scroll-to-zoom on desktop,
 *   slider zoom, and free pan in both axes — exactly the
 *   "Instagram / iPhone" feel called out in the spec.
 * - Returns crop coords in SOURCE-IMAGE pixel space, which we
 *   feed into our own canvas exporter (`getCroppedImg`) for
 *   full-quality output with no fixed downscale.
 *
 * External API (props, `onCropped` signature, `dataUrlToFile`,
 * `AspectPreset`) is UNCHANGED so all call sites keep working
 * without edits.
 */
export function ImageCropper({
  open,
  onOpenChange,
  onCropped,
  saving,
  title,
  description,
  aspects,
  outputLongEdgePx = 4000,
  forceJpeg,
}: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [aspectKey, setAspectKey] = useState<string>(aspects[0]?.key || "");
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  const aspect = useMemo(
    () => aspects.find((a) => a.key === aspectKey) || aspects[0],
    [aspects, aspectKey],
  );
  const aspectRatio = aspect?.ratio && aspect.ratio > 0 ? aspect.ratio : 16 / 9;
  const isCircle = !!aspect?.circle && (aspect?.ratio === 1);

  // Reset everything when the dialog closes.
  useEffect(() => {
    if (!open) {
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setRotation(0);
      setError(null);
      setAspectKey(aspects[0]?.key || "");
      setCroppedAreaPixels(null);
      setPreviewDataUrl(null);
      // Allow re-picking the same file after cancel — browsers
      // suppress the change event when the same file path is
      // re-selected, so we must clear the input value.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Recenter when aspect or rotation changes so the user sees a
  // sensible starting frame.
  useEffect(() => {
    setCrop({ x: 0, y: 0 });
    setZoom(1);
  }, [aspectKey, rotation]);

  // Live preview thumbnail. react-easy-crop calls onCropComplete
  // (debounced internally) whenever the crop, zoom, or rotation
  // settles, so we re-render the preview at a small thumbnail
  // size from the SAME exporter the Save button uses. The preview
  // pixels are therefore guaranteed to match the saved output.
  useEffect(() => {
    if (!imageSrc || !croppedAreaPixels) {
      setPreviewDataUrl(null);
      return;
    }
    let cancelled = false;
    // Cap preview at ~320 long edge for snappy updates.
    getCroppedImg(imageSrc, croppedAreaPixels, rotation, {
      maxLongEdgePx: 320,
      forceJpeg: true,
      quality: 0.85,
    })
      .then((url) => {
        if (!cancelled) setPreviewDataUrl(url);
      })
      .catch(() => {
        if (!cancelled) setPreviewDataUrl(null);
      });
    return () => {
      cancelled = true;
    };
  }, [imageSrc, croppedAreaPixels, rotation]);

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
      setRotation(0);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  function resetView() {
    setZoom(1);
    setRotation(0);
    setCrop({ x: 0, y: 0 });
  }

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      // v9.0.1 (May-2026) - per STRICT spec: toBlob('image/jpeg', 1.0)
      // for the final save. WebP/0.97 was visually identical at half
      // the size, but the spec is literal: JPEG 1.0 max quality, no
      // compression. 4000px long-edge cap is the only payload guard.
      const dataUrl = await getCroppedImg(imageSrc, croppedAreaPixels, rotation, {
        maxLongEdgePx: outputLongEdgePx,
        forceJpeg: true,
        quality: 1.0,
      });
      await onCropped(dataUrl);
    } catch (e: any) {
      setError(e?.message || t("cropper.errSave"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle data-testid="text-cropper-title">
            {title || t("cropper.title")}
          </DialogTitle>
          <DialogDescription>
            {description || t("cropper.helperGeneric")}
          </DialogDescription>
        </DialogHeader>

        {!imageSrc ? (
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

            {/* ---- The cropper stage ---- */}
            <div
              className="relative w-full h-[340px] rounded-2xl overflow-hidden border border-white/10 bg-black/60"
              data-testid="region-cropper-stage"
            >
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                rotation={rotation}
                aspect={aspectRatio}
                cropShape={isCircle ? "round" : "rect"}
                showGrid
                minZoom={1}
                maxZoom={3}
                restrictPosition
                objectFit="contain"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onRotationChange={setRotation}
                onCropComplete={onCropComplete}
              />
            </div>

            {/* ---- Controls row ---- */}
            <div className="flex items-center gap-3 px-1">
              <ZoomIn size={14} className="text-muted-foreground shrink-0" />
              <Slider
                value={[zoom]}
                min={1}
                max={3}
                step={0.01}
                onValueChange={(v) => setZoom(v[0] ?? 1)}
                data-testid="slider-cropper-zoom"
              />
              <button
                type="button"
                onClick={() => setRotation((r) => (r + 90) % 360)}
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

            {/* ---- Live preview ---- */}
            <div className="flex items-center gap-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">
                {t("cropper.preview")}
              </p>
              <div
                className={`relative bg-black/40 border border-white/10 overflow-hidden ${
                  isCircle ? "rounded-full" : "rounded-lg"
                }`}
                style={{
                  width: 96,
                  height: Math.round(96 / aspectRatio),
                  maxHeight: 96,
                }}
                data-testid="region-cropper-preview"
              >
                {previewDataUrl ? (
                  <img
                    src={previewDataUrl}
                    alt={t("cropper.preview")}
                    className="absolute inset-0 w-full h-full object-cover"
                    data-testid="img-cropper-preview"
                  />
                ) : (
                  <div className="absolute inset-0 grid place-items-center">
                    <Loader2 className="animate-spin text-white/30" size={14} />
                  </div>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground leading-snug">
                {t("cropper.previewMatches")}
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setImageSrc(null);
                setRotation(0);
                setZoom(1);
                setCrop({ x: 0, y: 0 });
                setPreviewDataUrl(null);
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
            disabled={!imageSrc || !croppedAreaPixels || !!saving}
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
