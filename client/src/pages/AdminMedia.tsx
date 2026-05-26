import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ImageCropper, type AspectPreset } from "@/components/ImageCropper";
import type { HeroImage, Settings } from "@shared/schema";
import {
  Image as ImageIcon,
  Monitor,
  Smartphone,
  UploadCloud,
  Trash2,
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Eye,
  EyeOff,
  RefreshCw,
  Pencil,
  Film,
  Layers,
  Palette,
} from "lucide-react";

// ─── Data hook ────────────────────────────────────────────────────────────────
const MEDIA_KEY = ["/api/admin/media"] as const;

function useMediaData() {
  return useQuery<{ heroImages: HeroImage[]; settings: Settings }>({
    queryKey: MEDIA_KEY,
  });
}

function invalidateMedia() {
  queryClient.invalidateQueries({ queryKey: MEDIA_KEY });
  queryClient.invalidateQueries({ queryKey: ["/api/hero-images"] });
  queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
}

// ─── Aspect presets ───────────────────────────────────────────────────────────
const HERO_ASPECTS: AspectPreset[] = [
  { key: "16x9",  label: "16:9",  ratio: 16 / 9 },
  { key: "21x9",  label: "21:9",  ratio: 21 / 9 },
];
const HERO_MOBILE_ASPECTS: AspectPreset[] = [
  { key: "4x5",   label: "4:5",   ratio: 4 / 5 },
  { key: "9x16",  label: "9:16",  ratio: 9 / 16 },
  { key: "1x1",   label: "1:1",   ratio: 1 },
];
const SERVICE_ASPECTS: AspectPreset[] = [
  { key: "3x2",   label: "3:2",   ratio: 3 / 2 },
  { key: "16x9",  label: "16:9",  ratio: 16 / 9 },
  { key: "1x1",   label: "1:1",   ratio: 1 },
];

// ─── Tiny slider row ──────────────────────────────────────────────────────────
function SliderRow({
  label, value, min, max, step = 0.01, unit = "",
  onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-muted-foreground w-28 shrink-0">{label}</span>
      <Slider
        value={[value]}
        min={min} max={max} step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
        className="flex-1"
      />
      <span className="text-[11px] tabular-nums text-muted-foreground w-12 text-right">
        {Number.isInteger(value) ? value : value.toFixed(2)}{unit}
      </span>
    </div>
  );
}

// ─── Fit selector ─────────────────────────────────────────────────────────────
function FitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-muted-foreground w-28 shrink-0">Object fit</span>
      <div className="flex gap-2">
        {["cover", "contain"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            data-testid={`button-fit-${f}`}
            className={`px-3 h-7 rounded-full text-[11px] font-semibold border transition-colors ${
              value === f
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
            }`}
          >
            {f}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Section tab bar ──────────────────────────────────────────────────────────
type Section = "hero" | "services" | "branding";

const SECTIONS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "hero",     label: "Hero Images",  icon: <Film size={14} /> },
  { key: "services", label: "Services",     icon: <Layers size={14} /> },
  { key: "branding", label: "Branding",     icon: <Palette size={14} /> },
];

// ─── Hero section ─────────────────────────────────────────────────────────────
function HeroSection({ images }: { images: HeroImage[] }) {
  const { toast } = useToast();
  const [cropperOpen, setCropperOpen] = useState(false);
  const [mobileCropperOpen, setMobileCropperOpen] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Record<number, "desktop" | "mobile">>({});

  const uploadMutation = useMutation({
    mutationFn: async (data: { imageDataUrl: string }) => {
      const res = await apiRequest("POST", "/api/admin/media/hero", data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => { invalidateMedia(); toast({ title: "Hero slide uploaded" }); setCropperOpen(false); },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const mobileUploadMutation = useMutation({
    mutationFn: async ({ id, imageDataUrl }: { id: number; imageDataUrl: string }) => {
      const res = await apiRequest("PATCH", `/api/admin/media/hero/${id}/settings`, {
        mobileSettings: { customMobileUrl: "pending" },
      });
      if (!res.ok) throw new Error("Failed to save mobile image");
      return res.json();
    },
    onSuccess: () => { invalidateMedia(); toast({ title: "Mobile image updated" }); setMobileCropperOpen(null); },
    onError: (e: Error) => toast({ title: "Failed", description: e.message, variant: "destructive" }),
  });

  const settingsMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/admin/media/hero/${id}/settings`, updates);
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => { invalidateMedia(); toast({ title: "Settings saved" }); },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/hero-images/${id}`);
    },
    onSuccess: () => { invalidateMedia(); toast({ title: "Slide deleted" }); },
    onError: () => toast({ title: "Delete failed", variant: "destructive" }),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ id, sortOrder }: { id: number; sortOrder: number }) => {
      await apiRequest("PATCH", `/api/admin/hero-images/${id}`, { sortOrder });
    },
    onSuccess: () => invalidateMedia(),
  });

  function move(idx: number, dir: -1 | 1) {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const a = images[idx], b = images[target];
    reorderMutation.mutate({ id: a.id, sortOrder: b.sortOrder });
    reorderMutation.mutate({ id: b.id, sortOrder: a.sortOrder });
  }

  const tab = useCallback((id: number) => activeTab[id] ?? "desktop", [activeTab]);
  const setTab = (id: number, t: "desktop" | "mobile") => setActiveTab(prev => ({ ...prev, [id]: t }));

  const [localDesktop, setLocalDesktop] = useState<Record<number, Record<string, number>>>({});
  const [localMobile, setLocalMobile] = useState<Record<number, Record<string, number | string>>>({});

  function getDesktop(img: HeroImage) {
    return {
      focalX:         localDesktop[img.id]?.focalX        ?? img.focalX        ?? 0,
      focalY:         localDesktop[img.id]?.focalY        ?? img.focalY        ?? 0,
      zoom:           localDesktop[img.id]?.zoom           ?? img.zoom          ?? 1,
      rotate:         localDesktop[img.id]?.rotate         ?? img.rotate        ?? 0,
      brightness:     localDesktop[img.id]?.brightness     ?? img.brightness    ?? 1,
      contrast:       localDesktop[img.id]?.contrast       ?? img.contrast      ?? 1,
      overlayOpacity: localDesktop[img.id]?.overlayOpacity ?? img.overlayOpacity ?? 35,
    };
  }

  function getMobileDefaults(img: HeroImage) {
    const ms = (img.mobileSettings as Record<string, number | string>) ?? {};
    return {
      positionX: Number(localMobile[img.id]?.positionX ?? ms.positionX ?? 50),
      positionY: Number(localMobile[img.id]?.positionY ?? ms.positionY ?? 50),
      zoom:      Number(localMobile[img.id]?.zoom      ?? ms.zoom      ?? 1),
      height:    Number(localMobile[img.id]?.height    ?? ms.height    ?? 220),
      radius:    Number(localMobile[img.id]?.radius    ?? ms.radius    ?? 0),
      fit:       String(localMobile[img.id]?.fit       ?? ms.fit       ?? "cover"),
    };
  }

  function patchDesktop(img: HeroImage, key: string, val: number) {
    setLocalDesktop(prev => ({ ...prev, [img.id]: { ...prev[img.id], [key]: val } }));
  }
  function patchMobile(img: HeroImage, key: string, val: number | string) {
    setLocalMobile(prev => ({ ...prev, [img.id]: { ...prev[img.id], [key]: val } }));
  }

  function saveDesktop(img: HeroImage) {
    const d = getDesktop(img);
    settingsMutation.mutate({ id: img.id, updates: d });
  }

  function saveMobile(img: HeroImage) {
    const m = getMobileDefaults(img);
    settingsMutation.mutate({ id: img.id, updates: { mobileSettings: m } });
  }

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-base">Hero Slides</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{images.length} / 12 slides · Drag to reorder</p>
        </div>
        <Button
          onClick={() => setCropperOpen(true)}
          disabled={uploadMutation.isPending || images.length >= 12}
          size="sm"
          data-testid="button-hero-upload"
          className="gap-1.5 bg-primary/20 hover:bg-primary/30 text-primary border border-primary/30"
          variant="ghost"
        >
          <UploadCloud size={14} />
          Add Slide
        </Button>
      </div>

      <ImageCropper
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        saving={uploadMutation.isPending}
        aspects={HERO_ASPECTS}
        outputLongEdgePx={2400}
        title="Upload hero slide"
        description="16:9 recommended for desktop. The server generates desktop, mobile, and thumbnail versions automatically."
        onCropped={(url) => uploadMutation.mutateAsync({ imageDataUrl: url })}
      />

      {sorted.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-2xl py-16 flex flex-col items-center gap-3 text-muted-foreground">
          <ImageIcon size={28} className="opacity-30" />
          <p className="text-sm">No hero slides yet. Upload your first one above.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sorted.map((img, i) => {
            const isExpanded = expandedId === img.id;
            const currentTab = tab(img.id);
            const desktop = getDesktop(img);
            const mobile = getMobileDefaults(img);
            const thumbSrc = img.thumbnailDataUrl ?? img.imageDataUrl;

            return (
              <div
                key={img.id}
                className="admin-card !p-0 overflow-hidden"
                data-testid={`hero-card-${img.id}`}
              >
                {/* Card header */}
                <div className="flex items-center gap-3 p-3">
                  <div className="relative w-24 h-14 rounded-xl overflow-hidden shrink-0 border border-white/10 bg-black/40">
                    <img src={thumbSrc} alt="" className="w-full h-full object-cover" />
                    {img.isActive === false && (
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                        <EyeOff size={12} className="text-white/70" />
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {img.title || `Slide ${i + 1}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">{img.subtitle || "No subtitle"}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      {img.mobileDataUrl && (
                        <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded-full">
                          <Smartphone size={8} className="inline mr-0.5" />Mobile
                        </span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${
                        img.isActive !== false
                          ? "bg-green-500/10 text-green-400 border-green-500/20"
                          : "bg-white/5 text-muted-foreground border-white/10"
                      }`}>
                        {img.isActive !== false ? "Active" : "Hidden"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => move(i, -1)}
                      disabled={i === 0}
                      data-testid={`button-hero-up-${img.id}`}
                      className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-25 flex items-center justify-center"
                    ><ArrowUp size={12} /></button>
                    <button
                      type="button"
                      onClick={() => move(i, 1)}
                      disabled={i === sorted.length - 1}
                      data-testid={`button-hero-down-${img.id}`}
                      className="w-7 h-7 rounded-md bg-white/5 hover:bg-white/10 disabled:opacity-25 flex items-center justify-center"
                    ><ArrowDown size={12} /></button>
                    <button
                      type="button"
                      onClick={() => setExpandedId(isExpanded ? null : img.id)}
                      data-testid={`button-hero-expand-${img.id}`}
                      className={`w-7 h-7 rounded-md flex items-center justify-center transition-colors ${
                        isExpanded ? "bg-primary/20 text-primary" : "bg-white/5 hover:bg-white/10 text-muted-foreground"
                      }`}
                    >{isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</button>
                    <button
                      type="button"
                      onClick={() => deleteMutation.mutate(img.id)}
                      data-testid={`button-hero-delete-${img.id}`}
                      className="w-7 h-7 rounded-md bg-white/5 hover:bg-red-500/20 hover:text-red-400 text-muted-foreground flex items-center justify-center"
                    ><Trash2 size={12} /></button>
                  </div>
                </div>

                {/* Expanded settings */}
                {isExpanded && (
                  <div className="border-t border-white/[0.06] p-4 space-y-4 bg-black/20">
                    {/* Active toggle */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium">Visible on homepage</span>
                      <Switch
                        checked={img.isActive !== false}
                        onCheckedChange={(v) => settingsMutation.mutate({ id: img.id, updates: { isActive: v } })}
                        data-testid={`switch-hero-active-${img.id}`}
                      />
                    </div>

                    {/* Title/subtitle/badge */}
                    <div className="grid grid-cols-1 gap-2">
                      {[
                        { key: "title", label: "Title", max: 140, val: img.title ?? "" },
                        { key: "subtitle", label: "Subtitle", max: 240, val: img.subtitle ?? "" },
                        { key: "badge", label: "Badge", max: 60, val: img.badge ?? "" },
                      ].map(({ key, label, max, val }) => (
                        <div key={key} className="flex items-center gap-3">
                          <span className="text-[11px] text-muted-foreground w-16 shrink-0">{label}</span>
                          <input
                            type="text"
                            defaultValue={val}
                            maxLength={max}
                            onBlur={(e) => settingsMutation.mutate({ id: img.id, updates: { [key]: e.target.value || null } })}
                            data-testid={`input-hero-${key}-${img.id}`}
                            className="flex-1 h-8 rounded-lg bg-white/5 border border-white/10 px-2.5 text-xs focus:outline-none focus:border-primary/40"
                          />
                        </div>
                      ))}
                    </div>

                    {/* Desktop / Mobile tabs */}
                    <div>
                      <div className="flex gap-1 mb-3">
                        {(["desktop", "mobile"] as const).map((t) => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setTab(img.id, t)}
                            data-testid={`tab-hero-${t}-${img.id}`}
                            className={`flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-semibold border transition-colors ${
                              currentTab === t
                                ? "bg-primary/20 text-primary border-primary/30"
                                : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
                            }`}
                          >
                            {t === "desktop" ? <Monitor size={11} /> : <Smartphone size={11} />}
                            {t === "desktop" ? "Desktop" : "Mobile"}
                          </button>
                        ))}
                      </div>

                      {currentTab === "desktop" && (
                        <div className="space-y-3">
                          <SliderRow label="Focal X" value={desktop.focalX} min={-200} max={200} step={1} unit="px" onChange={(v) => patchDesktop(img, "focalX", v)} />
                          <SliderRow label="Focal Y" value={desktop.focalY} min={-200} max={200} step={1} unit="px" onChange={(v) => patchDesktop(img, "focalY", v)} />
                          <SliderRow label="Zoom" value={desktop.zoom} min={0.8} max={2.0} step={0.01} onChange={(v) => patchDesktop(img, "zoom", v)} />
                          <SliderRow label="Rotate" value={desktop.rotate} min={-10} max={10} step={0.5} unit="°" onChange={(v) => patchDesktop(img, "rotate", v)} />
                          <SliderRow label="Brightness" value={desktop.brightness} min={0.9} max={1.2} step={0.01} onChange={(v) => patchDesktop(img, "brightness", v)} />
                          <SliderRow label="Contrast" value={desktop.contrast} min={0.95} max={1.2} step={0.01} onChange={(v) => patchDesktop(img, "contrast", v)} />
                          <SliderRow label="Overlay %" value={desktop.overlayOpacity} min={0} max={60} step={1} unit="%" onChange={(v) => patchDesktop(img, "overlayOpacity", v)} />
                          <Button size="sm" onClick={() => saveDesktop(img)} disabled={settingsMutation.isPending} data-testid={`button-hero-save-desktop-${img.id}`} className="mt-1 w-full">
                            Save desktop settings
                          </Button>
                        </div>
                      )}

                      {currentTab === "mobile" && (
                        <div className="space-y-3">
                          <SliderRow label="Position X" value={mobile.positionX} min={0} max={100} step={1} unit="%" onChange={(v) => patchMobile(img, "positionX", v)} />
                          <SliderRow label="Position Y" value={mobile.positionY} min={0} max={100} step={1} unit="%" onChange={(v) => patchMobile(img, "positionY", v)} />
                          <SliderRow label="Zoom" value={mobile.zoom} min={0.5} max={3} step={0.01} onChange={(v) => patchMobile(img, "zoom", v)} />
                          <SliderRow label="Height" value={mobile.height} min={80} max={600} step={4} unit="px" onChange={(v) => patchMobile(img, "height", v)} />
                          <SliderRow label="Radius" value={mobile.radius} min={0} max={50} step={1} unit="px" onChange={(v) => patchMobile(img, "radius", v)} />
                          <FitSelect value={mobile.fit} onChange={(v) => patchMobile(img, "fit", v)} />
                          <Button size="sm" onClick={() => saveMobile(img)} disabled={settingsMutation.isPending} data-testid={`button-hero-save-mobile-${img.id}`} className="mt-1 w-full">
                            Save mobile settings
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Services section ─────────────────────────────────────────────────────────
type ServiceCard = "personalTraining" | "nutrition" | "supplement";

const SERVICE_META: { key: ServiceCard; label: string; desc: string }[] = [
  { key: "personalTraining", label: "Personal Training", desc: "3:2 recommended · 1200×800" },
  { key: "nutrition",        label: "Nutrition Plans",   desc: "3:2 recommended · 1200×800" },
  { key: "supplement",       label: "Supplement Protocol", desc: "3:2 recommended · 1200×800" },
];

function ServiceCardEditor({ cardKey, label, desc, settings }: {
  cardKey: ServiceCard;
  label: string;
  desc: string;
  settings: Settings;
}) {
  const { toast } = useToast();
  const [cropperOpen, setCropperOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"desktop" | "mobile">("desktop");
  const [previewMode, setPreviewMode] = useState<"desktop" | "mobile">("desktop");

  // Pull current values from settings
  const prefix = cardKey;
  const desktopUrl   = (settings as any)[`${prefix}ImageUrl`]        ?? null;
  const mobileUrl    = (settings as any)[`${prefix}MobileUrl`]       ?? null;
  const thumbnailUrl = (settings as any)[`${prefix}ThumbnailUrl`]    ?? null;

  // Desktop settings (flat columns)
  const [desktop, setDesktop] = useState({
    fit:           String((settings as any)[`${prefix}ImageFit`]           ?? "cover"),
    positionX:     Number((settings as any)[`${prefix}ImagePositionX`]     ?? 50),
    positionY:     Number((settings as any)[`${prefix}ImagePositionY`]     ?? 50),
    zoom:          Number((settings as any)[`${prefix}ImageZoom`]          ?? 1),
    desktopHeight: Number((settings as any)[`${prefix}ImageDesktopHeight`] ?? 260),
    mobileHeight:  Number((settings as any)[`${prefix}ImageMobileHeight`]  ?? 220),
    radius:        Number((settings as any)[`${prefix}ImageRadius`]        ?? 0),
  });

  // Mobile settings (jsonb)
  const rawMobileSettings = ((settings as any)[`${prefix}MobileSettings`] ?? {}) as Record<string, number | string>;
  const [mob, setMob] = useState({
    fit:       String(rawMobileSettings.fit       ?? "cover"),
    positionX: Number(rawMobileSettings.positionX ?? 50),
    positionY: Number(rawMobileSettings.positionY ?? 50),
    zoom:      Number(rawMobileSettings.zoom      ?? 1),
    height:    Number(rawMobileSettings.height    ?? 220),
    radius:    Number(rawMobileSettings.radius    ?? 0),
  });

  const uploadMutation = useMutation({
    mutationFn: async (data: { imageDataUrl: string }) => {
      const res = await apiRequest("POST", `/api/admin/media/services/${cardKey}`, data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => { invalidateMedia(); toast({ title: `${label} image updated` }); setCropperOpen(false); },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const settingsMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/admin/media/services/${cardKey}/settings`, body);
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => { invalidateMedia(); toast({ title: "Settings saved" }); },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const displaySrc = previewMode === "mobile" && mobileUrl ? mobileUrl : (thumbnailUrl ?? desktopUrl);

  return (
    <div className="admin-card space-y-4" data-testid={`service-card-${cardKey}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="font-display font-bold text-sm">{label}</h4>
          <p className="text-[11px] text-muted-foreground">{desc}</p>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPreviewMode(previewMode === "desktop" ? "mobile" : "desktop")}
            data-testid={`button-preview-toggle-${cardKey}`}
            className="flex items-center gap-1 px-2 h-7 rounded-lg bg-white/5 hover:bg-white/10 text-muted-foreground text-[10px]"
          >
            {previewMode === "desktop" ? <Monitor size={11} /> : <Smartphone size={11} />}
            {previewMode}
          </button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setCropperOpen(true)}
            disabled={uploadMutation.isPending}
            data-testid={`button-upload-${cardKey}`}
            className="gap-1 h-7 text-[11px] bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
          >
            <UploadCloud size={12} />
            {desktopUrl ? "Replace" : "Upload"}
          </Button>
        </div>
      </div>

      {/* Image preview */}
      <div
        className="relative w-full rounded-xl overflow-hidden border border-white/10 bg-black/40"
        style={{ height: 160 }}
      >
        {displaySrc ? (
          <img
            src={displaySrc}
            alt={label}
            className="w-full h-full object-cover"
            style={{
              objectFit: activeTab === "desktop" ? desktop.fit as any : mob.fit as any,
              objectPosition: activeTab === "desktop"
                ? `${desktop.positionX}% ${desktop.positionY}%`
                : `${mob.positionX}% ${mob.positionY}%`,
              transform: `scale(${activeTab === "desktop" ? desktop.zoom : mob.zoom})`,
              transformOrigin: "center",
              borderRadius: activeTab === "desktop" ? desktop.radius : mob.radius,
            }}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageIcon size={24} className="opacity-30" />
            <p className="text-xs">No image — click Upload</p>
          </div>
        )}
        {desktopUrl && (
          <div className="absolute bottom-2 right-2 flex gap-1">
            {mobileUrl && (
              <span className="text-[9px] bg-black/70 text-primary/80 px-1.5 py-0.5 rounded-full border border-primary/20">
                <Smartphone size={8} className="inline mr-0.5" />Mobile ready
              </span>
            )}
          </div>
        )}
      </div>

      <ImageCropper
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        saving={uploadMutation.isPending}
        aspects={SERVICE_ASPECTS}
        outputLongEdgePx={2000}
        title={`Upload ${label} image`}
        description="3:2 recommended. Desktop, mobile, and thumbnail variants are generated automatically."
        onCropped={(url) => uploadMutation.mutateAsync({ imageDataUrl: url })}
      />

      {/* Desktop / Mobile tabs */}
      <div>
        <div className="flex gap-1 mb-3">
          {(["desktop", "mobile"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              data-testid={`tab-service-${t}-${cardKey}`}
              className={`flex items-center gap-1.5 px-3 h-7 rounded-full text-[11px] font-semibold border transition-colors ${
                activeTab === t
                  ? "bg-primary/20 text-primary border-primary/30"
                  : "bg-white/5 text-muted-foreground border-white/10 hover:bg-white/10"
              }`}
            >
              {t === "desktop" ? <Monitor size={11} /> : <Smartphone size={11} />}
              {t === "desktop" ? "Desktop" : "Mobile"}
            </button>
          ))}
        </div>

        {activeTab === "desktop" && (
          <div className="space-y-3">
            <FitSelect value={desktop.fit} onChange={(v) => setDesktop(p => ({ ...p, fit: v }))} />
            <SliderRow label="Position X" value={desktop.positionX} min={0} max={100} step={1} unit="%" onChange={(v) => setDesktop(p => ({ ...p, positionX: v }))} />
            <SliderRow label="Position Y" value={desktop.positionY} min={0} max={100} step={1} unit="%" onChange={(v) => setDesktop(p => ({ ...p, positionY: v }))} />
            <SliderRow label="Zoom" value={desktop.zoom} min={0.5} max={3} step={0.01} onChange={(v) => setDesktop(p => ({ ...p, zoom: v }))} />
            <SliderRow label="Desktop height" value={desktop.desktopHeight} min={80} max={700} step={4} unit="px" onChange={(v) => setDesktop(p => ({ ...p, desktopHeight: v }))} />
            <SliderRow label="Mobile height" value={desktop.mobileHeight} min={80} max={700} step={4} unit="px" onChange={(v) => setDesktop(p => ({ ...p, mobileHeight: v }))} />
            <SliderRow label="Radius" value={desktop.radius} min={0} max={50} step={1} unit="px" onChange={(v) => setDesktop(p => ({ ...p, radius: v }))} />
            <Button
              size="sm"
              onClick={() => settingsMutation.mutate({ ...desktop })}
              disabled={settingsMutation.isPending}
              data-testid={`button-save-desktop-${cardKey}`}
              className="w-full mt-1"
            >
              Save desktop settings
            </Button>
          </div>
        )}

        {activeTab === "mobile" && (
          <div className="space-y-3">
            <p className="text-[11px] text-primary/70 bg-primary/5 border border-primary/15 rounded-lg px-3 py-2">
              Mobile settings are independent from desktop. Changing these never affects the desktop view.
            </p>
            <FitSelect value={mob.fit} onChange={(v) => setMob(p => ({ ...p, fit: v }))} />
            <SliderRow label="Position X" value={mob.positionX} min={0} max={100} step={1} unit="%" onChange={(v) => setMob(p => ({ ...p, positionX: v }))} />
            <SliderRow label="Position Y" value={mob.positionY} min={0} max={100} step={1} unit="%" onChange={(v) => setMob(p => ({ ...p, positionY: v }))} />
            <SliderRow label="Zoom" value={mob.zoom} min={0.5} max={3} step={0.01} onChange={(v) => setMob(p => ({ ...p, zoom: v }))} />
            <SliderRow label="Height" value={mob.height} min={80} max={700} step={4} unit="px" onChange={(v) => setMob(p => ({ ...p, height: v }))} />
            <SliderRow label="Radius" value={mob.radius} min={0} max={50} step={1} unit="px" onChange={(v) => setMob(p => ({ ...p, radius: v }))} />
            <Button
              size="sm"
              onClick={() => settingsMutation.mutate({ mobileSettings: mob })}
              disabled={settingsMutation.isPending}
              data-testid={`button-save-mobile-${cardKey}`}
              className="w-full mt-1"
            >
              Save mobile settings
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ServicesSection({ settings }: { settings: Settings }) {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display font-bold text-base">Service Images</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Desktop and mobile settings are fully independent. Uploads generate desktop, mobile, and thumbnail variants automatically.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {SERVICE_META.map(({ key, label, desc }) => (
          <ServiceCardEditor key={key} cardKey={key} label={label} desc={desc} settings={settings} />
        ))}
      </div>
    </div>
  );
}

// ─── Branding section ─────────────────────────────────────────────────────────
function BrandingSection() {
  return (
    <div className="space-y-4">
      <div>
        <h3 className="font-display font-bold text-base">Branding</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Logo and future branding assets</p>
      </div>
      <div className="border border-dashed border-white/10 rounded-2xl py-16 flex flex-col items-center gap-3 text-muted-foreground">
        <Palette size={28} className="opacity-30" />
        <p className="text-sm">Logo upload coming soon.</p>
        <p className="text-xs opacity-60">Profile photo is managed in Settings → Profile.</p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminMedia() {
  const [activeSection, setActiveSection] = useState<Section>("hero");
  const { data, isLoading, error } = useMediaData();

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="admin-shimmer h-10 rounded-2xl w-64" />
        <div className="admin-shimmer h-48 rounded-2xl" />
        <div className="admin-shimmer h-48 rounded-2xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="admin-card text-center py-12">
        <p className="text-muted-foreground text-sm">Failed to load media data. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-admin-media">
      {/* Page header */}
      <div>
        <h1 className="font-display font-bold text-xl">Media Manager</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Upload, organise, and fine-tune every image on the site. Desktop and mobile settings are always independent.
        </p>
      </div>

      {/* Section selector */}
      <div className="flex gap-2 p-1 bg-black/30 rounded-2xl border border-white/[0.06] w-fit">
        {SECTIONS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            data-testid={`tab-section-${key}`}
            className={`flex items-center gap-2 px-4 h-9 rounded-xl text-sm font-semibold transition-all ${
              activeSection === key
                ? "bg-primary/20 text-primary border border-primary/30 shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-white/5"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-2 p-3 bg-primary/5 border border-primary/15 rounded-xl text-xs text-primary/80">
        <RefreshCw size={12} className="mt-0.5 shrink-0" />
        <span>
          All uploads are server-validated (magic bytes, MIME type, 25 MB limit). Images are automatically
          optimised and generated at three resolutions. Only admins can upload or modify media.
        </span>
      </div>

      {/* Section content */}
      {activeSection === "hero"     && <HeroSection images={data.heroImages} />}
      {activeSection === "services" && <ServicesSection settings={data.settings} />}
      {activeSection === "branding" && <BrandingSection />}
    </div>
  );
}
