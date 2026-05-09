import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Upload, Trash2, Crosshair, Star, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Admin editor for a single media asset (May-2026 architecture).
 *
 * Strict rule: this editor NEVER displays the raw upload. The moment
 * a file is picked, it's POSTed to the server, sharp generates the
 * full variant matrix, and the server returns a metadata envelope.
 * Every preview surface (focal picker, mobile crop, desktop crop)
 * uses the server-processed master via /api/media/:id/master, so the
 * admin sees exactly what the public site will get — no surprises
 * caused by re-encoding artefacts.
 *
 * UI flow:
 *   1. Empty state  → "Upload" button. Picking a file POSTs to
 *      /api/admin/media-assets and returns the asset summary; the
 *      parent persists the binding (mediaAssetId on the section).
 *   2. Bound state → focal-point picker (click anywhere on the
 *      master to set focal X/Y), aspect dropdowns for desktop and
 *      mobile, live mobile + desktop crop previews (server-cropped
 *      bytes via the same endpoints the public site uses), alt
 *      text, priority toggle, visibility toggle, delete button.
 *   3. Every change PATCHes the asset; if focal/aspect changed,
 *      the server re-derives the full variant matrix from the
 *      master automatically.
 */

export type AssetSummary = {
  id: number;
  focalX: number;
  focalY: number;
  desktopAspect: string;
  mobileAspect: string;
  altText: string | null;
  priority: boolean;
  isActive: boolean;
  originalWidth: number;
  originalHeight: number;
  lqip: string;
  updatedAt?: string | null;
};

const ASPECT_OPTIONS = ["16/9", "4/3", "3/2", "1/1", "3/4", "4/5", "9/16"] as const;
const MAX_BYTES = 6 * 1024 * 1024; // base64 expands ~1.37x → < 10MB body cap

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

interface Props {
  /** Currently bound asset (or null if section has none yet). */
  asset: AssetSummary | null;
  /** Called whenever the bound asset changes (create / update / delete). */
  onAssetChange: (asset: AssetSummary | null) => void;
  /** data-testid prefix so multiple editors on a page don't collide. */
  testIdPrefix?: string;
}

export function MediaAssetEditor({ asset, onAssetChange, testIdPrefix = "media" }: Props) {
  const { toast } = useToast();
  // Mirror server state locally so click-to-focal feels immediate
  // (we debounce the PATCH so dragging across the picker doesn't
  // fire one request per pixel).
  const [draft, setDraft] = useState<AssetSummary | null>(asset);
  useEffect(() => {
    setDraft(asset);
  }, [asset?.id, asset?.updatedAt]);

  const upload = useMutation({
    mutationFn: async (file: File): Promise<AssetSummary> => {
      const dataUrl = await fileToDataUrl(file);
      const res = await apiRequest("POST", "/api/admin/media-assets", {
        imageDataUrl: dataUrl,
        // Default focal centred + balanced portrait/landscape aspects.
        focalX: 50,
        focalY: 50,
        desktopAspect: "16/9",
        mobileAspect: "4/5",
      });
      return (await res.json()) as AssetSummary;
    },
    onSuccess: (created) => {
      onAssetChange(created);
      toast({ title: "Uploaded", description: "Variants generated." });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Upload failed", description: e?.message || "Try again." });
    },
  });

  const patch = useMutation({
    mutationFn: async (changes: Partial<AssetSummary>): Promise<AssetSummary> => {
      if (!draft) throw new Error("No asset");
      const res = await apiRequest("PATCH", `/api/admin/media-assets/${draft.id}`, changes);
      return (await res.json()) as AssetSummary;
    },
    onSuccess: (next) => onAssetChange(next),
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Save failed", description: e?.message || "Try again." });
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!draft) return;
      await apiRequest("DELETE", `/api/admin/media-assets/${draft.id}`);
    },
    onSuccess: () => {
      onAssetChange(null);
      toast({ title: "Image removed" });
    },
  });

  // Debounced focal commit — clicking the picker updates `draft`
  // immediately for snappy UX, then commits the PATCH 400ms after
  // the last interaction. Avoids one request per click during quick
  // adjustments.
  const focalTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function commitFocalSoon(focalX: number, focalY: number) {
    if (focalTimer.current) clearTimeout(focalTimer.current);
    focalTimer.current = setTimeout(() => {
      patch.mutate({ focalX, focalY });
    }, 400);
  }

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast({ variant: "destructive", title: "Image too large", description: "Max 6 MB." });
      return;
    }
    upload.mutate(f);
  }

  // ------- Empty state: no asset bound yet -------
  if (!draft) {
    return (
      <div className="space-y-3" data-testid={`${testIdPrefix}-empty`}>
        <Label className="text-xs uppercase tracking-wider">Image</Label>
        <div className="aspect-[4/5] rounded-xl border-2 border-dashed border-white/15 bg-black/30 flex flex-col items-center justify-center text-muted-foreground/60">
          <Upload size={28} />
          <p className="mt-2 text-[11px] uppercase tracking-widest">No image yet</p>
          <p className="mt-1 text-[10px] text-muted-foreground/50">
            Optimised variants generated on upload
          </p>
        </div>
        <label className="block">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={onPickFile}
            disabled={upload.isPending}
            data-testid={`${testIdPrefix}-file-input`}
          />
          <span
            className={`inline-flex items-center justify-center gap-2 w-full h-9 rounded-md border border-input text-sm cursor-pointer ${upload.isPending ? "opacity-60" : "hover:bg-accent"}`}
          >
            {upload.isPending ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            {upload.isPending ? "Processing…" : "Upload image"}
          </span>
        </label>
      </div>
    );
  }

  // ------- Bound state: focal picker, aspects, previews, controls -------
  const v = draft.updatedAt ? new Date(draft.updatedAt).getTime() : 0;
  const masterUrl = `/api/media/${draft.id}/master?v=${v}`;

  const current = draft;
  function handleFocalClick(e: React.MouseEvent<HTMLDivElement>) {
    if (!current) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100);
    const focalX = Math.max(0, Math.min(100, x));
    const focalY = Math.max(0, Math.min(100, y));
    setDraft({ ...current, focalX, focalY });
    commitFocalSoon(focalX, focalY);
  }

  return (
    <div className="space-y-4" data-testid={`${testIdPrefix}-editor-${draft.id}`}>
      {/* Focal-point picker. Click anywhere on the master to set the
          focal point — dot follows the cursor. The master is the
          server-processed 1920 webp (NOT the raw upload). */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <Label className="text-xs uppercase tracking-wider flex items-center gap-1.5">
            <Crosshair size={12} /> Focal point — click on subject
          </Label>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {draft.focalX}% × {draft.focalY}%
          </span>
        </div>
        <div
          className="relative w-full rounded-xl overflow-hidden border border-white/10 cursor-crosshair select-none"
          onClick={handleFocalClick}
          data-testid={`${testIdPrefix}-focal-picker`}
        >
          {/* LQIP behind master so clicks register before bytes load */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: `url("${draft.lqip}")`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              filter: "blur(18px)",
              transform: "scale(1.1)",
            }}
          />
          <img
            src={masterUrl}
            alt=""
            className="relative w-full h-auto block"
            draggable={false}
            data-testid={`${testIdPrefix}-focal-master`}
          />
          {/* Focal crosshair */}
          <div
            aria-hidden
            className="absolute w-6 h-6 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{ left: `${draft.focalX}%`, top: `${draft.focalY}%` }}
          >
            <div className="absolute inset-0 rounded-full border-2 border-primary shadow-[0_0_0_2px_rgba(0,0,0,0.6)]" />
            <div className="absolute left-1/2 top-1/2 w-1.5 h-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_1px_rgba(0,0,0,0.8)]" />
          </div>
        </div>
      </div>

      {/* Aspect dropdowns */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider">Desktop crop</Label>
          <Select
            value={draft.desktopAspect}
            onValueChange={(value) => {
              setDraft({ ...draft, desktopAspect: value });
              patch.mutate({ desktopAspect: value });
            }}
          >
            <SelectTrigger data-testid={`${testIdPrefix}-aspect-desktop`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider">Mobile crop</Label>
          <Select
            value={draft.mobileAspect}
            onValueChange={(value) => {
              setDraft({ ...draft, mobileAspect: value });
              patch.mutate({ mobileAspect: value });
            }}
          >
            <SelectTrigger data-testid={`${testIdPrefix}-aspect-mobile`}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ASPECT_OPTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Live crop previews — uses CSS object-position from focal so
          the admin sees exactly what the cropped variant will look
          like before the server re-encodes. The master URL is the
          same one served to the public, just rendered with a
          different aspect-ratio container. */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Desktop preview
          </Label>
          <div
            className="mt-1 rounded-lg overflow-hidden border border-white/10 bg-black/30"
            style={{ aspectRatio: draft.desktopAspect }}
          >
            <img
              src={masterUrl}
              alt=""
              className="w-full h-full"
              style={{
                objectFit: "cover",
                objectPosition: `${draft.focalX}% ${draft.focalY}%`,
              }}
              draggable={false}
              data-testid={`${testIdPrefix}-preview-desktop`}
            />
          </div>
        </div>
        <div>
          <Label className="text-[10px] uppercase tracking-widest text-muted-foreground/70">
            Mobile preview
          </Label>
          <div
            className="mt-1 mx-auto rounded-lg overflow-hidden border border-white/10 bg-black/30 max-w-[180px]"
            style={{ aspectRatio: draft.mobileAspect }}
          >
            <img
              src={masterUrl}
              alt=""
              className="w-full h-full"
              style={{
                objectFit: "cover",
                objectPosition: `${draft.focalX}% ${draft.focalY}%`,
              }}
              draggable={false}
              data-testid={`${testIdPrefix}-preview-mobile`}
            />
          </div>
        </div>
      </div>

      {/* Alt + toggles */}
      <div className="space-y-3">
        <div>
          <Label className="text-xs uppercase tracking-wider">Alt text (accessibility)</Label>
          <Input
            value={draft.altText || ""}
            onChange={(e) => setDraft({ ...draft, altText: e.target.value })}
            onBlur={() => {
              if ((draft.altText || "") !== (asset?.altText || "")) {
                patch.mutate({ altText: draft.altText || null });
              }
            }}
            placeholder="Coach Youssef leading a strength session"
            data-testid={`${testIdPrefix}-alt`}
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="flex items-center gap-2">
            <Star size={14} className={draft.priority ? "text-primary" : "text-muted-foreground"} />
            <div>
              <Label className="text-xs">Priority (above-the-fold)</Label>
              <p className="text-[10px] text-muted-foreground">
                Eager loading + fetchpriority high. Use on hero only.
              </p>
            </div>
          </div>
          <Switch
            checked={draft.priority}
            onCheckedChange={(checked) => {
              setDraft({ ...draft, priority: checked });
              patch.mutate({ priority: checked });
            }}
            data-testid={`${testIdPrefix}-priority`}
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2">
          <div className="flex items-center gap-2">
            <EyeOff size={14} className={draft.isActive ? "text-muted-foreground" : "text-amber-400"} />
            <div>
              <Label className="text-xs">Visible on site</Label>
              <p className="text-[10px] text-muted-foreground">
                When off, the section falls back to the placeholder.
              </p>
            </div>
          </div>
          <Switch
            checked={draft.isActive}
            onCheckedChange={(checked) => {
              setDraft({ ...draft, isActive: checked });
              patch.mutate({ isActive: checked });
            }}
            data-testid={`${testIdPrefix}-active`}
          />
        </div>
      </div>

      {/* Replace / delete */}
      <div className="flex gap-2">
        <label className="flex-1">
          <input
            type="file"
            accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
            className="hidden"
            onChange={onPickFile}
            disabled={upload.isPending}
            data-testid={`${testIdPrefix}-replace-input`}
          />
          <span className="inline-flex items-center justify-center gap-2 w-full h-9 rounded-md border border-input hover:bg-accent text-sm cursor-pointer">
            {upload.isPending ? <Loader2 className="animate-spin" size={14} /> : <Upload size={14} />}
            {upload.isPending ? "Processing…" : "Replace image"}
          </span>
        </label>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (confirm("Delete this image? Section will fall back to placeholder.")) {
              remove.mutate();
            }
          }}
          disabled={remove.isPending}
          data-testid={`${testIdPrefix}-delete`}
        >
          <Trash2 size={14} />
        </Button>
      </div>

      {(patch.isPending || upload.isPending) && (
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
          <Loader2 className="animate-spin" size={12} />
          Regenerating variants…
        </div>
      )}
    </div>
  );
}
