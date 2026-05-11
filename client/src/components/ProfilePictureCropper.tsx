import { useCallback, useEffect, useRef, useState } from "react";
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
import { Loader2, Upload, ZoomIn, RotateCcw, Check } from "lucide-react";
import { getCroppedImg } from "@/lib/getCroppedImg";

/** Long-edge cap for the saved avatar. The source crop is exported
 *  at native source-pixel resolution; if the user's crop exceeds
 *  this size, we downsample once with high-quality smoothing.
 *  1024 is comfortably retina-sharp at any avatar display size used
 *  on this site (max ~160 px @ 3x = 480 px) and keeps the base64
 *  payload tiny in the database. */
const OUTPUT_LONG_EDGE_PX = 1024;

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Receives a JPEG/WebP data-URL after the user confirms a crop. */
  onCropped: (dataUrl: string) => void | Promise<void>;
  saving?: boolean;
};

/**
 * v9.0 (May-2026) — Instagram-style circular avatar cropper, now
 * built on `react-easy-crop`. The user picks a file, drags to pan,
 * pinches/scrolls/uses the slider to zoom, and saves. Output is a
 * native source-pixel circular crop (capped at 1024 px long edge)
 * encoded as WebP 0.97 (JPEG 0.97 fallback).
 *
 * External API (`open`, `onOpenChange`, `onCropped`, `saving`) is
 * UNCHANGED — `ProfilePage.tsx` keeps working without edits.
 */
export function ProfilePictureCropper({
  open,
  onOpenChange,
  onCropped,
  saving,
}: Props) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);

  // Reset everything when the dialog closes.
  useEffect(() => {
    if (!open) {
      setImageSrc(null);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setCroppedAreaPixels(null);
      setPreviewDataUrl(null);
      setError(null);
      // Allow re-picking the same file after cancel.
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [open]);

  // Live preview thumbnail driven by the same exporter the Save
  // button uses, so the preview pixels are guaranteed to match the
  // final saved image.
  useEffect(() => {
    if (!imageSrc || !croppedAreaPixels) {
      setPreviewDataUrl(null);
      return;
    }
    let cancelled = false;
    getCroppedImg(imageSrc, croppedAreaPixels, 0, {
      maxLongEdgePx: 256,
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
  }, [imageSrc, croppedAreaPixels]);

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError(t("cropper.errFileType"));
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError(t("cropper.errFileSize"));
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => setError(t("cropper.errReadFile"));
    reader.onload = () => {
      setZoom(1);
      setCrop({ x: 0, y: 0 });
      setImageSrc(reader.result as string);
    };
    reader.readAsDataURL(file);
  }

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setCroppedAreaPixels(areaPixels);
  }, []);

  async function handleSave() {
    if (!imageSrc || !croppedAreaPixels) return;
    try {
      // v9.0.1 - per STRICT spec: toBlob('image/jpeg', 1.0) for save.
      const dataUrl = await getCroppedImg(imageSrc, croppedAreaPixels, 0, {
        maxLongEdgePx: OUTPUT_LONG_EDGE_PX,
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
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("cropper.title")}</DialogTitle>
          <DialogDescription>
            {t("cropper.description")}
          </DialogDescription>
        </DialogHeader>

        {!imageSrc ? (
          <div className="space-y-3 py-4">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              data-testid="button-pick-profile-picture"
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
              accept="image/*"
              className="hidden"
              data-testid="input-profile-picture-file"
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
            <div
              className="relative w-full h-[320px] rounded-2xl overflow-hidden border border-white/10 bg-black/60"
              data-testid="region-cropper-stage"
            >
              <Cropper
                image={imageSrc}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                minZoom={1}
                maxZoom={3}
                restrictPosition
                objectFit="contain"
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            </div>

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
                onClick={() => {
                  setZoom(1);
                  setCrop({ x: 0, y: 0 });
                }}
                data-testid="button-cropper-reset"
                title={t("cropper.reset")}
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            <div className="flex items-center gap-3">
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground shrink-0">
                {t("cropper.preview")}
              </p>
              <div
                className="relative rounded-full bg-black/40 border border-white/10 overflow-hidden"
                style={{ width: 64, height: 64 }}
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
                setZoom(1);
                setCrop({ x: 0, y: 0 });
                setPreviewDataUrl(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
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
                <Loader2 className="mr-2 animate-spin" size={14} /> {t("common.saving")}
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
