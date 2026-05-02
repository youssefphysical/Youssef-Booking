import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
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

const OUTPUT_PX = 512; // square output canvas
const STAGE_PX = 320; // on-screen circular crop window

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  /** Receives a JPEG/WebP data-URL after the user confirms a crop. */
  onCropped: (dataUrl: string) => void | Promise<void>;
  saving?: boolean;
};

/**
 * Instagram-style circular cropper. The user picks a file, drags to pan, and
 * uses the slider to zoom. Save renders the visible crop into a 512×512
 * WebP data-URL (~30–60KB) which is then handed off to `onCropped`.
 *
 * Implementation notes:
 * - All math is done in IMAGE pixels for stability under window resizes.
 * - Pan offset is tracked as the (x,y) of the image's top-left in stage
 *   coordinates; we clamp so the crop window stays fully covered.
 * - The browser handles EXIF rotation when decoding via createImageBitmap
 *   (when available), so portrait photos won't appear sideways.
 */
export function ProfilePictureCropper({ open, onOpenChange, onCropped, saving }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1); // 1 = "cover" baseline
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ startX: number; startY: number; baseX: number; baseY: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Reset everything when the dialog closes or a new file is loaded.
  useEffect(() => {
    if (!open) {
      setImageEl(null);
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setError(null);
    }
  }, [open]);

  // When a fresh image is loaded, fit it as "cover" inside the stage and centre it.
  useEffect(() => {
    if (!imageEl) return;
    const baseScale = Math.max(STAGE_PX / imageEl.naturalWidth, STAGE_PX / imageEl.naturalHeight);
    setScale(1);
    const w = imageEl.naturalWidth * baseScale;
    const h = imageEl.naturalHeight * baseScale;
    setOffset({ x: (STAGE_PX - w) / 2, y: (STAGE_PX - h) / 2 });
  }, [imageEl]);

  function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file (JPG, PNG, HEIC, WebP).");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image is larger than 10MB. Try a smaller photo.");
      return;
    }
    setError(null);
    const reader = new FileReader();
    reader.onerror = () => setError("Could not read this file. Try a different photo.");
    reader.onload = () => {
      const img = new Image();
      img.onload = () => setImageEl(img);
      img.onerror = () => setError("Could not decode this image. Try JPG or PNG.");
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  // ============== DRAG-TO-PAN ==============
  function startDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!imageEl) return;
    (e.target as Element).setPointerCapture(e.pointerId);
    setDragging({ startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y });
  }
  function onDrag(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragging || !imageEl) return;
    const dx = e.clientX - dragging.startX;
    const dy = e.clientY - dragging.startY;
    setOffset(clampOffset({ x: dragging.baseX + dx, y: dragging.baseY + dy }, imageEl, scale));
  }
  function endDrag() {
    setDragging(null);
  }

  function clampOffset(o: { x: number; y: number }, img: HTMLImageElement, currentScale: number) {
    const baseScale = Math.max(STAGE_PX / img.naturalWidth, STAGE_PX / img.naturalHeight);
    const w = img.naturalWidth * baseScale * currentScale;
    const h = img.naturalHeight * baseScale * currentScale;
    const minX = STAGE_PX - w;
    const minY = STAGE_PX - h;
    return {
      x: Math.min(0, Math.max(minX, o.x)),
      y: Math.min(0, Math.max(minY, o.y)),
    };
  }

  // Re-clamp whenever the user changes the zoom level.
  useEffect(() => {
    if (!imageEl) return;
    setOffset((o) => clampOffset(o, imageEl, scale));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scale]);

  // ============== EXPORT ==============
  async function handleSave() {
    if (!imageEl) return;
    try {
      const baseScale = Math.max(STAGE_PX / imageEl.naturalWidth, STAGE_PX / imageEl.naturalHeight);
      const renderScale = baseScale * scale;
      // The on-stage crop maps back to image pixels by inverting the transform.
      const sxImg = -offset.x / renderScale;
      const syImg = -offset.y / renderScale;
      const sSizeImg = STAGE_PX / renderScale;

      const canvas = document.createElement("canvas");
      canvas.width = OUTPUT_PX;
      canvas.height = OUTPUT_PX;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(
        imageEl,
        sxImg,
        syImg,
        sSizeImg,
        sSizeImg,
        0,
        0,
        OUTPUT_PX,
        OUTPUT_PX,
      );
      // Try WebP first (much smaller); fall back to JPEG when the browser
      // doesn't accept WebP encoding for canvases (older Safari).
      let dataUrl = canvas.toDataURL("image/webp", 0.85);
      if (!dataUrl.startsWith("data:image/webp")) {
        dataUrl = canvas.toDataURL("image/jpeg", 0.88);
      }
      await onCropped(dataUrl);
    } catch (e: any) {
      setError(e?.message || "Could not save crop. Try a different image.");
    }
  }

  // ============== STAGE GEOMETRY (for render) ==============
  const baseScale = imageEl
    ? Math.max(STAGE_PX / imageEl.naturalWidth, STAGE_PX / imageEl.naturalHeight)
    : 1;
  const imgW = imageEl ? imageEl.naturalWidth * baseScale * scale : 0;
  const imgH = imageEl ? imageEl.naturalHeight * baseScale * scale : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>Profile picture</DialogTitle>
          <DialogDescription>
            Upload a photo, drag to position, zoom to taste — then save.
          </DialogDescription>
        </DialogHeader>

        {!imageEl ? (
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
              <p className="text-sm font-medium">Choose a photo</p>
              <p className="text-xs">JPG, PNG or HEIC · up to 10MB</p>
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
              className="relative mx-auto rounded-full overflow-hidden touch-none select-none border border-white/10 bg-black/40"
              style={{ width: STAGE_PX, height: STAGE_PX }}
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
              <div className="absolute inset-0 ring-1 ring-white/15 rounded-full pointer-events-none" />
            </div>

            <div className="flex items-center gap-3 px-1">
              <ZoomIn size={14} className="text-muted-foreground shrink-0" />
              <Slider
                value={[scale]}
                min={1}
                max={4}
                step={0.01}
                onValueChange={(v) => setScale(v[0] ?? 1)}
                data-testid="slider-cropper-zoom"
              />
              <button
                type="button"
                onClick={() => {
                  setScale(1);
                  if (imageEl) {
                    const baseScale = Math.max(
                      STAGE_PX / imageEl.naturalWidth,
                      STAGE_PX / imageEl.naturalHeight,
                    );
                    const w = imageEl.naturalWidth * baseScale;
                    const h = imageEl.naturalHeight * baseScale;
                    setOffset({ x: (STAGE_PX - w) / 2, y: (STAGE_PX - h) / 2 });
                  }
                }}
                data-testid="button-cropper-reset"
                title="Reset"
                className="text-muted-foreground hover:text-foreground"
              >
                <RotateCcw size={14} />
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setImageEl(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2"
              data-testid="button-cropper-change-photo"
            >
              Choose a different photo
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
            Cancel
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
                <Loader2 className="mr-2 animate-spin" size={14} /> Saving…
              </>
            ) : (
              <>
                <Check size={14} className="mr-2" /> Save photo
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
