import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ImageCropper, type AspectPreset } from "@/components/ImageCropper";
import { HeroImageFrame, ServiceImageFrame } from "@/components/ImageRenderer";
import { MobileImageEditor } from "@/components/MobileImageEditor";
import type { HeroImage, Settings } from "@shared/schema";
import {
  Monitor,
  Smartphone,
  UploadCloud,
  Trash2,
  ArrowUp,
  ArrowDown,
  Film,
  Layers,
  Palette,
  RefreshCw,
  Settings2,
  CheckCircle2,
  ScanLine,
  Maximize2,
  RotateCcw,
  ChevronDown,
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
const SERVICE_ASPECTS: AspectPreset[] = [
  { key: "16x9",  label: "16:9",  ratio: 16 / 9 },
  { key: "3x2",   label: "3:2",   ratio: 3 / 2 },
  { key: "1x1",   label: "1:1",   ratio: 1 },
];

// ─── Slider row ───────────────────────────────────────────────────────────────
function SliderRow({
  label, value, min, max, step = 0.01, unit = "", onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">{label}</span>
        <span className="text-[11px] tabular-nums font-mono text-primary/80 bg-primary/8 px-2 py-0.5 rounded-md border border-primary/15">
          {Number.isInteger(value) ? value : value.toFixed(2)}{unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min} max={max} step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
        className="w-full"
      />
    </div>
  );
}

// ─── Fit selector ─────────────────────────────────────────────────────────────
function FitSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <span className="text-[11px] font-medium text-muted-foreground tracking-wide uppercase">Object fit</span>
      <div className="flex gap-2">
        {["cover", "contain"].map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => onChange(f)}
            data-testid={`button-fit-${f}`}
            className={`flex-1 h-8 rounded-xl text-[11px] font-semibold border transition-all duration-200 ${
              value === f
                ? "bg-primary/20 text-primary border-primary/40 shadow-[0_0_12px_-4px_hsl(183_100%_60%/0.4)]"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10 hover:border-white/20"
            }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Glass icon button ────────────────────────────────────────────────────────
function IconBtn({
  icon, label, onClick, disabled, danger, active, testId,
}: {
  icon: React.ReactNode;
  label?: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  active?: boolean;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      title={label}
      className={`
        inline-flex items-center gap-1.5 px-3 h-9 rounded-xl text-[11px] font-semibold
        border transition-all duration-200 disabled:opacity-30
        ${danger
          ? "bg-red-500/8 border-red-500/20 text-red-400 hover:bg-red-500/18 hover:border-red-500/35 hover:shadow-[0_0_14px_-4px_rgba(239,68,68,0.4)]"
          : active
          ? "bg-primary/20 border-primary/40 text-primary shadow-[0_0_12px_-4px_hsl(183_100%_60%/0.35)]"
          : "bg-white/6 border-white/10 text-muted-foreground hover:bg-white/12 hover:border-white/20 hover:text-foreground"
        }
      `}
    >
      {icon}
      {label && <span>{label}</span>}
    </button>
  );
}

// ─── Drag-and-drop upload zone ────────────────────────────────────────────────
function DropZone({
  onTrigger, disabled = false, compact = false,
}: {
  onTrigger: () => void; disabled?: boolean; compact?: boolean;
}) {
  const [dragging, setDragging] = useState(false);

  if (compact) {
    return (
      <button
        type="button"
        onClick={onTrigger}
        disabled={disabled}
        className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-primary/12 hover:bg-primary/20 border border-primary/25 hover:border-primary/40 text-primary text-sm font-semibold transition-all duration-200 disabled:opacity-40 hover:shadow-[0_0_18px_-4px_hsl(183_100%_60%/0.4)]"
      >
        <UploadCloud size={15} />
        Add Another Slide
      </button>
    );
  }

  return (
    <div
      onDragEnter={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
      onDragLeave={(e) => { e.preventDefault(); setDragging(false); }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (!disabled) onTrigger(); }}
      onClick={onTrigger}
      className={`
        relative cursor-pointer rounded-2xl border-2 border-dashed transition-all duration-200 select-none
        flex flex-col items-center justify-center gap-3 py-12
        ${dragging
          ? "border-primary/60 bg-primary/8 shadow-[0_0_30px_-8px_hsl(183_100%_60%/0.3)]"
          : "border-white/12 bg-white/[0.02] hover:border-primary/30 hover:bg-primary/5"
        }
        ${disabled ? "opacity-40 cursor-not-allowed" : ""}
      `}
    >
      <motion.div animate={dragging ? { scale: 1.15, y: -4 } : { scale: 1, y: 0 }} transition={{ type: "spring", stiffness: 300, damping: 22 }}>
        <UploadCloud size={30} className={dragging ? "text-primary" : "text-muted-foreground/50"} />
      </motion.div>
      <div className="text-center">
        <p className={`text-sm font-semibold ${dragging ? "text-primary" : "text-muted-foreground"}`}>
          {dragging ? "Release to upload" : "Drop image here"}
        </p>
        <p className="text-[11px] text-muted-foreground/55 mt-0.5">or click to browse · Max 25 MB</p>
      </div>
    </div>
  );
}

// ─── Settings tab bar ─────────────────────────────────────────────────────────
function SettingsTabs({
  value, onChange, id, prefix,
}: { value: "desktop" | "mobile"; onChange: (v: "desktop" | "mobile") => void; id: string | number; prefix: string }) {
  return (
    <div className="flex gap-1 p-0.5 bg-black/30 rounded-xl border border-white/8 w-fit mb-4">
      {(["desktop", "mobile"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange(t)}
          data-testid={`tab-${prefix}-${t}-${id}`}
          className={`flex items-center gap-1.5 px-3 h-7 rounded-lg text-[11px] font-semibold transition-all duration-200 ${
            value === t
              ? "bg-primary/20 text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t === "desktop" ? <Monitor size={11} /> : <Smartphone size={11} />}
          {t === "desktop" ? "Desktop" : "Mobile"}
        </button>
      ))}
    </div>
  );
}

// ─── Save button ──────────────────────────────────────────────────────────────
function SaveBtn({ onClick, disabled, testId }: { onClick: () => void; disabled?: boolean; testId?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-testid={testId}
      className="w-full h-10 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 hover:border-primary/50 text-primary text-sm font-semibold transition-all duration-200 disabled:opacity-40 hover:shadow-[0_0_18px_-4px_hsl(183_100%_60%/0.35)] flex items-center justify-center gap-2"
    >
      <CheckCircle2 size={14} />
      Save Settings
    </button>
  );
}

// ─── Section tab bar ──────────────────────────────────────────────────────────
type Section = "hero" | "services" | "branding";
const SECTIONS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "hero",     label: "Hero Slider",  icon: <Film size={15} /> },
  { key: "services", label: "Services",     icon: <Layers size={15} /> },
  { key: "branding", label: "Branding",     icon: <Palette size={15} /> },
];

// ─── Hero section ─────────────────────────────────────────────────────────────
function HeroSection({ images }: { images: HeroImage[] }) {
  const { toast } = useToast();
  const [cropperOpen, setCropperOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<Record<number, "desktop" | "mobile">>({});
  const [showGuide, setShowGuide] = useState<Record<number, boolean>>({});
  const [fullscreenId, setFullscreenId] = useState<number | null>(null);

  const uploadMutation = useMutation({
    mutationFn: async (data: { imageDataUrl: string }) => {
      const res = await apiRequest("POST", "/api/admin/media/hero", data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateMedia();
      toast({ title: "Slide uploaded", description: "Your new hero slide is live." });
      setCropperOpen(false);
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  const settingsMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Record<string, unknown> }) => {
      const res = await apiRequest("PATCH", `/api/admin/media/hero/${id}/settings`, updates);
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      invalidateMedia();
      toast({ title: "Settings saved", description: "Hero slide updated successfully." });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/hero-images/${id}`);
    },
    onSuccess: () => {
      invalidateMedia();
      toast({ title: "Slide removed", description: "The slide has been deleted." });
    },
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
  const toggleGuide = (id: number) => setShowGuide(prev => ({ ...prev, [id]: !prev[id] }));

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

  const sorted = [...images].sort((a, b) => a.sortOrder - b.sortOrder);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-lg">Hero Slides</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {images.length} / 12 slides · Preview matches client view exactly
          </p>
        </div>
        <button
          onClick={() => setCropperOpen(true)}
          disabled={uploadMutation.isPending || images.length >= 12}
          data-testid="button-hero-upload"
          className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 hover:border-primary/50 text-primary text-sm font-semibold transition-all duration-200 disabled:opacity-40 hover:shadow-[0_0_20px_-6px_hsl(183_100%_60%/0.5)]"
        >
          <UploadCloud size={15} />
          Add Slide
        </button>
      </div>

      <ImageCropper
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        saving={uploadMutation.isPending}
        aspects={HERO_ASPECTS}
        outputLongEdgePx={2400}
        title="Upload hero slide"
        description="16:9 recommended for desktop. Desktop, mobile, and thumbnail versions are generated automatically."
        onCropped={(url) => uploadMutation.mutateAsync({ imageDataUrl: url })}
      />

      {sorted.length === 0 ? (
        <DropZone onTrigger={() => setCropperOpen(true)} disabled={uploadMutation.isPending} />
      ) : (
        <div className="space-y-4">
          {sorted.map((img, i) => {
            const isExpanded = expandedId === img.id;
            const currentTab = tab(img.id);
            const desktop = getDesktop(img);
            const mobile = getMobileDefaults(img);
            const guide = showGuide[img.id] ?? false;

            return (
              <motion.div
                key={img.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-white/[0.08] bg-card/60 overflow-hidden backdrop-blur-sm"
                style={{ boxShadow: isExpanded ? "0 0 30px -10px hsl(183 100% 60% / 0.12)" : "none" }}
                data-testid={`hero-card-${img.id}`}
              >
                {/* WYSIWYG thumbnail — uses exact production rendering formula */}
                <div className="relative">
                  <HeroImageFrame
                    src={img.imageDataUrl}
                    focalX={desktop.focalX}
                    focalY={desktop.focalY}
                    zoom={desktop.zoom}
                    rotate={desktop.rotate}
                    brightness={desktop.brightness}
                    contrast={desktop.contrast}
                    overlayOpacity={desktop.overlayOpacity}
                    className="w-full rounded-t-2xl"
                  />
                  {/* Status pill */}
                  <div className="absolute top-2.5 left-2.5">
                    <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full border backdrop-blur-sm ${
                      img.isActive !== false
                        ? "bg-emerald-500/25 text-emerald-400 border-emerald-500/35"
                        : "bg-black/60 text-muted-foreground border-white/15"
                    }`}>
                      {img.isActive !== false ? "● Live" : "○ Off"}
                    </span>
                  </div>
                  {/* Mobile badge */}
                  {img.mobileDataUrl && (
                    <div className="absolute top-2.5 right-2.5">
                      <span className="text-[9px] bg-primary/20 backdrop-blur-sm text-primary px-2 py-0.5 rounded-full border border-primary/30 flex items-center gap-1">
                        <Smartphone size={8} />Mobile ✓
                      </span>
                    </div>
                  )}
                  {/* Slide number */}
                  <div className="absolute bottom-2.5 right-2.5 text-[9px] bg-black/60 backdrop-blur-sm text-white/60 px-2 py-0.5 rounded-md border border-white/10">
                    {i + 1}/{sorted.length}
                  </div>
                </div>

                {/* Card footer row */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold truncate">{img.title || `Slide ${i + 1}`}</p>
                    <p className="text-xs text-muted-foreground truncate">{img.subtitle || "No subtitle"}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <IconBtn icon={<ArrowUp size={13} />} onClick={() => move(i, -1)} disabled={i === 0} testId={`button-hero-up-${img.id}`} />
                    <IconBtn icon={<ArrowDown size={13} />} onClick={() => move(i, 1)} disabled={i === sorted.length - 1} testId={`button-hero-down-${img.id}`} />
                    <IconBtn
                      icon={<Maximize2 size={13} />}
                      label="Edit"
                      onClick={() => setFullscreenId(img.id)}
                      testId={`button-hero-fullscreen-${img.id}`}
                    />
                    <IconBtn
                      icon={<Settings2 size={13} />}
                      onClick={() => setExpandedId(isExpanded ? null : img.id)}
                      active={isExpanded}
                      testId={`button-hero-expand-${img.id}`}
                    />
                    <IconBtn icon={<Trash2 size={13} />} onClick={() => deleteMutation.mutate(img.id)} danger testId={`button-hero-delete-${img.id}`} />
                  </div>
                </div>

                {/* Expanded settings */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-white/[0.07] p-5 space-y-5 bg-black/25">

                        {/* WYSIWYG live preview + guide toggle */}
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                              Live Preview — drag to set focal point
                            </p>
                            <button
                              type="button"
                              onClick={() => toggleGuide(img.id)}
                              className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[11px] font-semibold border transition-all duration-200 ${
                                guide
                                  ? "bg-primary/20 text-primary border-primary/35"
                                  : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
                              }`}
                            >
                              <ScanLine size={11} />
                              {guide ? "Hide Guide" : "Show Guide"}
                            </button>
                          </div>
                          <HeroImageFrame
                            src={img.imageDataUrl}
                            focalX={desktop.focalX}
                            focalY={desktop.focalY}
                            zoom={desktop.zoom}
                            rotate={desktop.rotate}
                            brightness={desktop.brightness}
                            contrast={desktop.contrast}
                            overlayOpacity={desktop.overlayOpacity}
                            showGuide={guide}
                            onFocalChange={(fx, fy) => {
                              patchDesktop(img, "focalX", fx);
                              patchDesktop(img, "focalY", fy);
                            }}
                            className="w-full rounded-xl border border-white/10"
                          />
                          <p className="text-[10px] text-muted-foreground/55 text-center">
                            Focal X: {desktop.focalX}px · Focal Y: {desktop.focalY}px — drag the preview or use sliders below
                          </p>
                        </div>

                        {/* Visibility toggle */}
                        <div className="flex items-center justify-between p-3 rounded-xl bg-white/[0.03] border border-white/8">
                          <div>
                            <p className="text-sm font-semibold">Visible on homepage</p>
                            <p className="text-[11px] text-muted-foreground mt-0.5">Toggle to show/hide this slide</p>
                          </div>
                          <Switch
                            checked={img.isActive !== false}
                            onCheckedChange={(v) => settingsMutation.mutate({ id: img.id, updates: { isActive: v } })}
                            data-testid={`switch-hero-active-${img.id}`}
                          />
                        </div>

                        {/* Text fields */}
                        <div className="space-y-2">
                          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">Content</p>
                          {[
                            { key: "title", label: "Title", max: 140, val: img.title ?? "", placeholder: "Slide headline" },
                            { key: "subtitle", label: "Subtitle", max: 240, val: img.subtitle ?? "", placeholder: "Supporting text" },
                            { key: "badge", label: "Badge", max: 60, val: img.badge ?? "", placeholder: "e.g. 500+ clients" },
                          ].map(({ key, label, max, val, placeholder }) => (
                            <div key={key} className="flex items-center gap-3">
                              <span className="text-[11px] text-muted-foreground w-16 shrink-0">{label}</span>
                              <input
                                type="text"
                                defaultValue={val}
                                maxLength={max}
                                placeholder={placeholder}
                                onBlur={(e) => settingsMutation.mutate({ id: img.id, updates: { [key]: e.target.value || null } })}
                                data-testid={`input-hero-${key}-${img.id}`}
                                className="flex-1 h-9 rounded-xl bg-white/5 border border-white/10 px-3 text-xs focus:outline-none focus:border-primary/40 focus:bg-white/8 transition-colors placeholder:text-muted-foreground/40"
                              />
                            </div>
                          ))}
                        </div>

                        {/* Desktop / Mobile tabs */}
                        <div>
                          <SettingsTabs value={currentTab} onChange={(t) => setTab(img.id, t)} id={img.id} prefix="hero" />

                          {currentTab === "desktop" && (
                            <div className="space-y-4">
                              <SliderRow label="Focal X" value={desktop.focalX} min={-200} max={200} step={1} unit="px" onChange={(v) => patchDesktop(img, "focalX", v)} />
                              <SliderRow label="Focal Y" value={desktop.focalY} min={-200} max={200} step={1} unit="px" onChange={(v) => patchDesktop(img, "focalY", v)} />
                              <SliderRow label="Zoom" value={desktop.zoom} min={0.8} max={2.0} step={0.01} onChange={(v) => patchDesktop(img, "zoom", v)} />
                              <SliderRow label="Rotate" value={desktop.rotate} min={-10} max={10} step={0.5} unit="°" onChange={(v) => patchDesktop(img, "rotate", v)} />
                              <SliderRow label="Brightness" value={desktop.brightness} min={0.9} max={1.2} step={0.01} onChange={(v) => patchDesktop(img, "brightness", v)} />
                              <SliderRow label="Contrast" value={desktop.contrast} min={0.95} max={1.2} step={0.01} onChange={(v) => patchDesktop(img, "contrast", v)} />
                              <SliderRow label="Overlay" value={desktop.overlayOpacity} min={0} max={60} step={1} unit="%" onChange={(v) => patchDesktop(img, "overlayOpacity", v)} />
                              <SaveBtn
                                onClick={() => settingsMutation.mutate({ id: img.id, updates: getDesktop(img) })}
                                disabled={settingsMutation.isPending}
                                testId={`button-hero-save-desktop-${img.id}`}
                              />
                            </div>
                          )}

                          {currentTab === "mobile" && (
                            <div className="space-y-4">
                              <p className="text-[11px] text-primary/70 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5">
                                Mobile settings are fully independent from desktop.
                              </p>
                              <SliderRow label="Position X" value={mobile.positionX} min={0} max={100} step={1} unit="%" onChange={(v) => patchMobile(img, "positionX", v)} />
                              <SliderRow label="Position Y" value={mobile.positionY} min={0} max={100} step={1} unit="%" onChange={(v) => patchMobile(img, "positionY", v)} />
                              <SliderRow label="Zoom" value={mobile.zoom} min={0.5} max={3} step={0.01} onChange={(v) => patchMobile(img, "zoom", v)} />
                              <SliderRow label="Height" value={mobile.height} min={80} max={600} step={4} unit="px" onChange={(v) => patchMobile(img, "height", v)} />
                              <SliderRow label="Radius" value={mobile.radius} min={0} max={50} step={1} unit="px" onChange={(v) => patchMobile(img, "radius", v)} />
                              <FitSelect value={mobile.fit} onChange={(v) => patchMobile(img, "fit", v)} />
                              <SaveBtn
                                onClick={() => settingsMutation.mutate({ id: img.id, updates: { mobileSettings: getMobileDefaults(img) } })}
                                disabled={settingsMutation.isPending}
                                testId={`button-hero-save-mobile-${img.id}`}
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}

          {images.length < 12 && (
            <DropZone onTrigger={() => setCropperOpen(true)} disabled={uploadMutation.isPending} compact />
          )}
        </div>
      )}

      {/* Fullscreen mobile editor — portal, mounts once at section level */}
      {(() => {
        const fsImg = fullscreenId ? sorted.find((i) => i.id === fullscreenId) : null;
        if (!fsImg) return null;
        const fsDesktop = getDesktop(fsImg);
        const fsMobile  = getMobileDefaults(fsImg);
        return (
          <MobileImageEditor
            open={fullscreenId !== null}
            onClose={() => setFullscreenId(null)}
            saving={settingsMutation.isPending}
            config={{
              type: "hero",
              imageUrl: fsImg.imageDataUrl,
              label: fsImg.title || `Slide ${sorted.findIndex((x) => x.id === fullscreenId) + 1}`,
              initialDesktop: fsDesktop,
              initialMobile: { positionX: fsMobile.positionX, positionY: fsMobile.positionY, zoom: fsMobile.zoom },
            }}
            onSave={(payload) => {
              settingsMutation.mutate({
                id: fsImg.id,
                updates: {
                  ...payload.desktop,
                  mobileSettings: {
                    ...fsMobile,
                    ...(payload.mobile as Record<string, unknown>),
                  },
                },
              });
              setFullscreenId(null);
            }}
          />
        );
      })()}
    </div>
  );
}

// ─── Services section ─────────────────────────────────────────────────────────
type ServiceCard = "personalTraining" | "nutrition" | "supplement";

const SERVICE_META: { key: ServiceCard; label: string; desc: string }[] = [
  { key: "personalTraining", label: "Personal Training",    desc: "16:9 · 1920×1080" },
  { key: "nutrition",        label: "Nutrition Plans",      desc: "16:9 · 1920×1080" },
  { key: "supplement",       label: "Supplement Protocol",  desc: "16:9 · 1920×1080" },
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
  const [showGuide, setShowGuide] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const prefix = cardKey;
  const desktopUrl   = (settings as any)[`${prefix}ImageUrl`]     ?? null;
  const mobileUrl    = (settings as any)[`${prefix}MobileUrl`]    ?? null;
  const thumbnailUrl = (settings as any)[`${prefix}ThumbnailUrl`] ?? null;

  const [desktop, setDesktop] = useState({
    fit:       String((settings as any)[`${prefix}ImageFit`]       ?? "cover"),
    positionX: Number((settings as any)[`${prefix}ImagePositionX`] ?? 50),
    positionY: Number((settings as any)[`${prefix}ImagePositionY`] ?? 50),
    zoom:      Number((settings as any)[`${prefix}ImageZoom`]      ?? 1),
    radius:    Number((settings as any)[`${prefix}ImageRadius`]    ?? 0),
  });

  const rawMobileSettings = ((settings as any)[`${prefix}MobileSettings`] ?? {}) as Record<string, number | string>;
  const [mob, setMob] = useState({
    fit:       String(rawMobileSettings.fit       ?? "cover"),
    positionX: Number(rawMobileSettings.positionX ?? 50),
    positionY: Number(rawMobileSettings.positionY ?? 50),
    zoom:      Number(rawMobileSettings.zoom      ?? 1),
    radius:    Number(rawMobileSettings.radius    ?? 0),
  });

  // ── settingsMutation defined FIRST so uploadMutation.onSuccess can reference it ──
  const settingsMutation = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const res = await apiRequest("PATCH", `/api/admin/media/services/${cardKey}/settings`, body);
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      invalidateMedia();
      toast({ title: "Settings saved", description: "Display settings updated." });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  // Auto Fit / Reset — centers focal point and saves immediately
  const AUTO_FIT_BODY = {
    fit: "cover", positionX: 50, positionY: 50, zoom: 1,
    mobileSettings: { fit: "cover", positionX: 50, positionY: 50, zoom: 1 },
  } as const;
  const applyAutoFit = () => {
    setDesktop(p => ({ ...p, fit: "cover", positionX: 50, positionY: 50, zoom: 1 }));
    setMob(p => ({ ...p, fit: "cover", positionX: 50, positionY: 50, zoom: 1 }));
    settingsMutation.mutate(AUTO_FIT_BODY);
  };

  const uploadMutation = useMutation({
    mutationFn: async (data: { imageDataUrl: string }) => {
      const res = await apiRequest("POST", `/api/admin/media/services/${cardKey}`, data);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Upload failed");
      }
      return res.json() as Promise<{
        success: boolean;
        desktop: string;
        mobile: string;
        thumbnail: string;
        focalPoint?: { positionX: number; positionY: number; zoom: number; subjectType: string };
      }>;
    },
    onSuccess: (data) => {
      invalidateMedia();
      setCropperOpen(false);
      // Apply AI-detected focal point, or fall back to centered composition
      const fp = data.focalPoint;
      const positionX = fp?.positionX ?? 50;
      const positionY = fp?.positionY ?? 50;
      const zoom      = fp?.zoom      ?? 1;
      const aiUsed    = fp && fp.subjectType !== "center";
      setDesktop(p => ({ ...p, fit: "cover", positionX, positionY, zoom }));
      setMob(p => ({ ...p, fit: "cover", positionX, positionY, zoom }));
      // Focal settings are already persisted server-side — no extra PATCH needed
      toast({
        title: `${label} updated`,
        description: aiUsed
          ? `AI detected a ${fp!.subjectType} — composition auto-optimised.`
          : "Image uploaded and centred for all screens.",
      });
    },
    onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
  });

  // Active preview image — show appropriate URL for the tab
  const previewSrc = activeTab === "mobile" && mobileUrl
    ? mobileUrl
    : (thumbnailUrl ?? desktopUrl);

  // Active settings for the preview
  const activeFit = activeTab === "desktop" ? desktop.fit : mob.fit;
  const activePosX = activeTab === "desktop" ? desktop.positionX : mob.positionX;
  const activePosY = activeTab === "desktop" ? desktop.positionY : mob.positionY;
  const activeZoom = activeTab === "desktop" ? desktop.zoom : mob.zoom;

  return (
    <div
      className="rounded-2xl border border-white/[0.08] bg-card/60 overflow-hidden backdrop-blur-sm"
      data-testid={`service-card-${cardKey}`}
    >
      {/* WYSIWYG preview — uses exact production rendering formula */}
      <div className="relative">
        <ServiceImageFrame
          src={previewSrc}
          fit={activeFit}
          positionX={activePosX}
          positionY={activePosY}
          zoom={activeZoom}
          showGuide={showGuide}
          onPositionChange={(posX, posY) => {
            if (activeTab === "desktop") {
              setDesktop(p => ({ ...p, positionX: posX, positionY: posY }));
            } else {
              setMob(p => ({ ...p, positionX: posX, positionY: posY }));
            }
          }}
          className="w-full"
        />
        {/* Empty state click-to-upload overlay */}
        {!previewSrc && (
          <div
            className="absolute inset-0 flex flex-col items-center justify-center gap-3 cursor-pointer group"
            onClick={() => setCropperOpen(true)}
          >
            <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-white/15 group-hover:border-primary/40 flex items-center justify-center transition-colors">
              <UploadCloud size={20} className="text-muted-foreground/40 group-hover:text-primary/60 transition-colors" />
            </div>
            <p className="text-xs text-muted-foreground/55 group-hover:text-muted-foreground transition-colors">Click to upload</p>
          </div>
        )}
        {/* AI analysing overlay — shown while upload+analysis is in flight */}
        {uploadMutation.isPending && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 backdrop-blur-[2px]">
            <div className="flex items-center gap-2 bg-black/70 border border-primary/30 rounded-xl px-3 py-2">
              <RefreshCw size={11} className="text-primary animate-spin" />
              <span className="text-[11px] font-semibold text-primary">AI analysing…</span>
            </div>
          </div>
        )}
        {/* Overlay badges */}
        {desktopUrl && !uploadMutation.isPending && (
          <>
            <div className="absolute top-2.5 left-2.5">
              <span className="text-[9px] bg-black/65 backdrop-blur-sm text-white/65 px-2 py-1 rounded-lg border border-white/10">
                {label}
              </span>
            </div>
            {mobileUrl && (
              <div className="absolute top-2.5 right-2.5">
                <span className="text-[9px] bg-primary/20 backdrop-blur-sm text-primary px-2 py-1 rounded-lg border border-primary/25 flex items-center gap-1">
                  <Smartphone size={8} />Mobile ✓
                </span>
              </div>
            )}
          </>
        )}
        {/* Preview tab in corner */}
        {desktopUrl && (
          <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-end justify-between pointer-events-none">
            <span className="text-[9px] text-muted-foreground/50">{desc}</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">

        {/* Header */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="font-display font-bold text-sm">{label}</h4>
            <p className="text-[11px] text-muted-foreground">
              {desktopUrl ? "Drag preview to reposition" : "Upload a 16:9 image to get started"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowGuide(g => !g)}
            className={`inline-flex items-center gap-1.5 px-2.5 h-7 rounded-lg text-[11px] font-semibold border transition-all duration-200 ${
              showGuide
                ? "bg-primary/20 text-primary border-primary/35"
                : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
            }`}
          >
            <ScanLine size={11} />
            Guide
          </button>
        </div>

        {/* Action buttons */}
        {!desktopUrl ? (
          /* No image yet — single prominent upload CTA */
          <button
            type="button"
            onClick={() => setCropperOpen(true)}
            disabled={uploadMutation.isPending}
            data-testid={`button-upload-${cardKey}`}
            className="w-full inline-flex items-center justify-center gap-2 h-11 rounded-xl bg-primary/12 hover:bg-primary/20 border border-primary/25 hover:border-primary/40 text-primary text-sm font-semibold transition-all duration-200 hover:shadow-[0_0_16px_-4px_hsl(183_100%_60%/0.4)]"
          >
            <UploadCloud size={15} />
            Upload Image
          </button>
        ) : (
          /* Has image — 2×2 grid of action buttons */
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setCropperOpen(true)}
              disabled={uploadMutation.isPending}
              data-testid={`button-upload-${cardKey}`}
              className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-white/6 hover:bg-white/10 border border-white/12 hover:border-white/20 text-muted-foreground hover:text-foreground text-[12px] font-semibold transition-all duration-200"
            >
              <UploadCloud size={13} />
              Replace
            </button>
            <button
              type="button"
              onClick={applyAutoFit}
              disabled={settingsMutation.isPending}
              data-testid={`button-autofit-${cardKey}`}
              className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-primary/10 hover:bg-primary/18 border border-primary/20 hover:border-primary/35 text-primary text-[12px] font-semibold transition-all duration-200"
            >
              <Maximize2 size={13} />
              Auto Fit
            </button>
            <button
              type="button"
              onClick={() => setEditorOpen(true)}
              data-testid={`button-fullscreen-${cardKey}`}
              className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-white/6 hover:bg-white/10 border border-white/12 hover:border-white/20 text-muted-foreground hover:text-foreground text-[12px] font-semibold transition-all duration-200"
            >
              <Maximize2 size={13} />
              Edit
            </button>
            <button
              type="button"
              onClick={applyAutoFit}
              disabled={settingsMutation.isPending}
              data-testid={`button-reset-${cardKey}`}
              className="inline-flex items-center justify-center gap-1.5 h-11 rounded-xl bg-white/6 hover:bg-white/10 border border-white/12 hover:border-white/20 text-muted-foreground hover:text-foreground text-[12px] font-semibold transition-all duration-200"
            >
              <RotateCcw size={13} />
              Reset
            </button>
          </div>
        )}

        <ImageCropper
          open={cropperOpen}
          onOpenChange={setCropperOpen}
          saving={uploadMutation.isPending}
          aspects={[{ key: "16x9", label: "16:9", ratio: 16 / 9 }]}
          outputLongEdgePx={2000}
          title={`Upload ${label} image`}
          description="16:9 format (1920×1080 recommended). Desktop, mobile, and thumbnail variants are generated automatically."
          onCropped={(url) => { void uploadMutation.mutateAsync({ imageDataUrl: url }); }}
        />

        {/* Advanced Settings — collapsed by default */}
        {desktopUrl && (
          <div>
            <button
              type="button"
              onClick={() => setShowAdvanced(s => !s)}
              data-testid={`button-advanced-${cardKey}`}
              className="w-full inline-flex items-center justify-between gap-2 px-3 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.07] text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-all duration-200"
            >
              <span className="flex items-center gap-1.5">
                <Settings2 size={11} />
                Advanced Settings
              </span>
              <ChevronDown
                size={12}
                className={`transition-transform duration-200 ${showAdvanced ? "rotate-180" : ""}`}
              />
            </button>

            {showAdvanced && (
              <div className="mt-3 space-y-4">
                <SettingsTabs value={activeTab} onChange={setActiveTab} id={cardKey} prefix="service" />

                {activeTab === "desktop" && (
                  <div className="space-y-4">
                    <FitSelect value={desktop.fit} onChange={(v) => setDesktop(p => ({ ...p, fit: v }))} />
                    <SliderRow label="Position X" value={desktop.positionX} min={0} max={100} step={1} unit="%" onChange={(v) => setDesktop(p => ({ ...p, positionX: v }))} />
                    <SliderRow label="Position Y" value={desktop.positionY} min={0} max={100} step={1} unit="%" onChange={(v) => setDesktop(p => ({ ...p, positionY: v }))} />
                    <SliderRow label="Zoom" value={desktop.zoom} min={0.5} max={3} step={0.01} onChange={(v) => setDesktop(p => ({ ...p, zoom: v }))} />
                    <SliderRow label="Corner radius" value={desktop.radius} min={0} max={50} step={1} unit="px" onChange={(v) => setDesktop(p => ({ ...p, radius: v }))} />
                    <SaveBtn
                      onClick={() => settingsMutation.mutate({ ...desktop })}
                      disabled={settingsMutation.isPending}
                      testId={`button-save-desktop-${cardKey}`}
                    />
                  </div>
                )}

                {activeTab === "mobile" && (
                  <div className="space-y-4">
                    <p className="text-[11px] text-primary/70 bg-primary/5 border border-primary/15 rounded-xl px-3 py-2.5">
                      Mobile settings are independent from desktop. Drag the preview above to set the focal point.
                    </p>
                    <FitSelect value={mob.fit} onChange={(v) => setMob(p => ({ ...p, fit: v }))} />
                    <SliderRow label="Position X" value={mob.positionX} min={0} max={100} step={1} unit="%" onChange={(v) => setMob(p => ({ ...p, positionX: v }))} />
                    <SliderRow label="Position Y" value={mob.positionY} min={0} max={100} step={1} unit="%" onChange={(v) => setMob(p => ({ ...p, positionY: v }))} />
                    <SliderRow label="Zoom" value={mob.zoom} min={0.5} max={3} step={0.01} onChange={(v) => setMob(p => ({ ...p, zoom: v }))} />
                    <SliderRow label="Corner radius" value={mob.radius} min={0} max={50} step={1} unit="px" onChange={(v) => setMob(p => ({ ...p, radius: v }))} />
                    <SaveBtn
                      onClick={() => settingsMutation.mutate({ mobileSettings: mob })}
                      disabled={settingsMutation.isPending}
                      testId={`button-save-mobile-${cardKey}`}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Fullscreen touch editor */}
      <MobileImageEditor
        open={editorOpen}
        onClose={() => setEditorOpen(false)}
        saving={settingsMutation.isPending}
        config={{
          type: "service",
          imageUrl: thumbnailUrl ?? desktopUrl ?? "",
          label,
          initialDesktop: { fit: desktop.fit, positionX: desktop.positionX, positionY: desktop.positionY, zoom: desktop.zoom },
          initialMobile:  { fit: mob.fit,     positionX: mob.positionX,     positionY: mob.positionY,     zoom: mob.zoom },
        }}
        onSave={(payload) => {
          const d = payload.desktop as { fit: string; positionX: number; positionY: number; zoom: number };
          const m = payload.mobile  as { fit: string; positionX: number; positionY: number; zoom: number };
          setDesktop((p) => ({ ...p, fit: d.fit, positionX: d.positionX, positionY: d.positionY, zoom: d.zoom }));
          setMob((p) => ({ ...p, fit: m.fit, positionX: m.positionX, positionY: m.positionY, zoom: m.zoom }));
          settingsMutation.mutate({
            fit:        d.fit,
            positionX:  d.positionX,
            positionY:  d.positionY,
            zoom:       d.zoom,
            mobileSettings: { ...mob, fit: m.fit, positionX: m.positionX, positionY: m.positionY, zoom: m.zoom },
          });
          setEditorOpen(false);
        }}
      />
    </div>
  );
}

function ServicesSection({ settings }: { settings: Settings }) {
  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display font-bold text-lg">Service Images</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Preview matches the live site exactly. Drag on any image to set the focal point — no important subject will be clipped.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
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
    <div className="space-y-5">
      <div>
        <h3 className="font-display font-bold text-lg">Branding</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Logo assets and brand identity</p>
      </div>
      <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.01] py-20 flex flex-col items-center gap-4 text-muted-foreground">
        <div className="w-16 h-16 rounded-2xl border border-white/10 flex items-center justify-center bg-white/[0.03]">
          <Palette size={28} className="opacity-30" />
        </div>
        <div className="text-center">
          <p className="text-sm font-semibold">Logo upload coming soon</p>
          <p className="text-xs opacity-50 mt-1">Profile photo is managed in Settings → Profile</p>
        </div>
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
      <div className="space-y-5">
        <div className="admin-shimmer h-10 rounded-2xl w-72" />
        <div className="admin-shimmer h-32 rounded-2xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {[0,1,2].map(i => <div key={i} className="admin-shimmer h-64 rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl border border-white/8 bg-card/60 text-center py-16">
        <p className="text-muted-foreground text-sm">Failed to load media. Please refresh.</p>
      </div>
    );
  }

  return (
    <div className="space-y-7" data-testid="page-admin-media">
      <div>
        <h1 className="font-display font-bold text-2xl tracking-tight">Media Manager</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          WYSIWYG: every preview uses the exact same rendering engine as the live site. What you see here is what clients see.
        </p>
      </div>

      {/* Section selector */}
      <div className="flex gap-3 w-fit">
        {SECTIONS.map(({ key, label, icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
            data-testid={`tab-section-${key}`}
            className={`flex items-center gap-2 px-5 h-11 rounded-2xl text-sm font-semibold border transition-all duration-200 ${
              activeSection === key
                ? "bg-primary/15 text-primary border-primary/35 shadow-[0_0_20px_-6px_hsl(183_100%_60%/0.4)]"
                : "bg-white/[0.03] text-muted-foreground border-white/8 hover:bg-white/6 hover:border-white/15 hover:text-foreground"
            }`}
          >
            {icon}
            {label}
          </button>
        ))}
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 p-3.5 bg-primary/5 border border-primary/15 rounded-xl">
        <RefreshCw size={13} className="mt-0.5 shrink-0 text-primary/60" />
        <p className="text-[11px] text-primary/70">
          All uploads are server-validated (magic bytes, MIME type, 25 MB limit). Images are automatically
          optimised and generated at three resolutions. Only admins can upload or modify media.
        </p>
      </div>

      {/* Section content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeSection}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
        >
          {activeSection === "hero"     && <HeroSection images={data.heroImages} />}
          {activeSection === "services" && <ServicesSection settings={data.settings} />}
          {activeSection === "branding" && <BrandingSection />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
