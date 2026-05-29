import { useState, useCallback, useEffect, useRef } from "react";
import { useUnsavedChanges } from "@/hooks/use-unsaved-changes";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { SERVICE_CARD_SLIDER_FIELDS } from "@/lib/service-card-fields";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ImageCropper, type AspectPreset } from "@/components/ImageCropper";
import { HeroImageFrame, ServiceImageFrame } from "@/components/ImageRenderer";
import { MobileImageEditor } from "@/components/MobileImageEditor";
import { useUpdateSettings } from "@/hooks/use-settings";
import {
  applyLogoSlotCSSVars,
  type LogoBrandControls,
  type LogoSlot as BrandLogoSlot,
  LOGO_SLOTS as BRAND_LOGO_SLOTS,
  LOGO_BRAND_SLOT_DEFAULTS,
} from "@/lib/brandSettings";
import {
  useAdminTransformations,
  useCreateTransformation,
  useUpdateTransformation,
  useDeleteTransformation,
} from "@/hooks/use-transformations";
import type { HeroImage, Settings, Transformation } from "@shared/schema";
import {
  Monitor,
  Smartphone,
  Tablet,
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
  Eye,
  EyeOff,
  Download,
  Shield,
  User,
  Sparkles,
  ImageIcon,
  MessageSquare,
  Plus,
  X,
  Check,
  Loader2,
  GripVertical,
  Lock,
  LockOpen,
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
  label, value, min, max, step = 0.01, unit = "", onChange, testId, disabled,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void; testId?: string; disabled?: boolean;
}) {
  const derivedTestId = testId ?? `slider-row-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <div className={`space-y-1.5 transition-opacity duration-200 ${disabled ? "opacity-35 pointer-events-none select-none" : ""}`} data-testid={derivedTestId}>
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
        disabled={disabled}
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
type Section = "hero" | "services" | "branding" | "profile" | "transformations";
const SECTIONS: { key: Section; label: string; icon: React.ReactNode }[] = [
  { key: "hero",            label: "Hero Slider",     icon: <Film size={15} /> },
  { key: "services",        label: "Services",        icon: <Layers size={15} /> },
  { key: "branding",        label: "Branding",        icon: <Palette size={15} /> },
  { key: "profile",         label: "Profile",         icon: <User size={15} /> },
  { key: "transformations", label: "Transformations", icon: <Sparkles size={15} /> },
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
    onSuccess: (_data, { id }) => {
      invalidateMedia();
      toast({ title: "Settings saved", description: "Hero slide updated successfully." });
      setLocalDesktop((prev) => { const next = { ...prev }; delete next[id]; return next; });
      setLocalMobile((prev) => { const next = { ...prev }; delete next[id]; return next; });
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

  const isDirty = Object.keys(localDesktop).length > 0 || Object.keys(localMobile).length > 0;
  const { guard: unsavedGuard } = useUnsavedChanges(isDirty);

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
      {unsavedGuard}
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
                    src={img.imageUrl || img.imageDataUrl}
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
                  {(img.mobileUrl || img.mobileDataUrl) && (
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
                            src={img.imageUrl || img.imageDataUrl}
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
              imageUrl: fsImg.imageUrl || fsImg.imageDataUrl,
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
type ContentType = "auto" | "person" | "nutrition" | "supplement" | "logo";

const SERVICE_META: { key: ServiceCard; label: string; desc: string }[] = [
  { key: "personalTraining", label: "Personal Training",    desc: "16:9 · 1920×1080" },
  { key: "nutrition",        label: "Nutrition Plans",      desc: "16:9 · 1920×1080" },
  { key: "supplement",       label: "Supplement Protocol",  desc: "16:9 · 1920×1080" },
];

const CARD_DEFAULT_CONTENT_TYPE: Record<ServiceCard, ContentType> = {
  personalTraining: "person",
  nutrition:        "nutrition",
  supplement:       "supplement",
};

const CONTENT_TYPES: { key: ContentType; label: string }[] = [
  { key: "auto",        label: "Auto" },
  { key: "person",      label: "Person" },
  { key: "nutrition",   label: "Food" },
  { key: "supplement",  label: "Supplement" },
  { key: "logo",        label: "Logo" },
];

export function ServiceCardEditor({ cardKey, label, desc, settings }: {
  cardKey: ServiceCard;
  label: string;
  desc: string;
  settings: Settings;
}) {
  const { toast } = useToast();
  const [cropperOpen, setCropperOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"desktop" | "mobile">("desktop");
  const [showGuide, setShowGuide] = useState(false);
  const [showMobileZone, setShowMobileZone] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [contentType, setContentType] = useState<ContentType>(CARD_DEFAULT_CONTENT_TYPE[cardKey]);

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
      const res = await apiRequest("POST", `/api/admin/media/services/${cardKey}`, {
        ...data,
        contentType,
      });
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
          contentType={contentType}
          showMobileZone={showMobileZone}
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
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowMobileZone(z => !z)}
              title="Toggle mobile crop zone"
              className={`inline-flex items-center gap-1.5 px-2 h-7 rounded-lg text-[11px] font-semibold border transition-all duration-200 ${
                showMobileZone
                  ? "bg-orange-500/20 text-orange-400 border-orange-500/35"
                  : "bg-white/5 border-white/10 text-muted-foreground hover:bg-white/10"
              }`}
            >
              <Smartphone size={11} />
            </button>
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
        </div>

        {/* Content type selector — tells AI what subject to prioritise */}
        <div>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 mb-1.5 font-semibold">AI subject type</p>
          <div className="flex flex-wrap gap-1">
            {CONTENT_TYPES.map(({ key, label: ctLabel }) => (
              <button
                key={key}
                type="button"
                onClick={() => setContentType(key)}
                data-testid={`button-content-type-${key}-${cardKey}`}
                className={`px-2.5 h-6 rounded-lg text-[10px] font-semibold border transition-all duration-150 ${
                  contentType === key
                    ? "bg-primary/20 text-primary border-primary/40"
                    : "bg-white/[0.04] border-white/10 text-muted-foreground hover:bg-white/8 hover:border-white/18"
                }`}
              >
                {ctLabel}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground/45 mt-1">
            Used on next upload to guide AI focal detection.
          </p>
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
                    {SERVICE_CARD_SLIDER_FIELDS.map(({ schemaKey, label, min, max, step, unit }) => (
                      <SliderRow
                        key={schemaKey}
                        label={label}
                        testId={`slider-row-desktop-${label.toLowerCase().replace(/\s+/g, "-")}`}
                        value={((desktop as unknown) as Record<string, number>)[schemaKey] ?? 0}
                        min={min} max={max} step={step} unit={unit}
                        onChange={(v) => setDesktop(p => ({ ...p, [schemaKey]: v }))}
                      />
                    ))}
                    {/* Smart clipping validation — warn when focal point is very near the edge */}
                    {(desktop.positionX < 8 || desktop.positionX > 92 || desktop.positionY < 8 || desktop.positionY > 92) && (
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/25 text-[11px] text-amber-400">
                        <span className="text-[13px] leading-none mt-0.5">⚠</span>
                        <span>Focal point is near the edge — main subject may be clipped on some screens. Check the preview.</span>
                      </div>
                    )}
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
                    {SERVICE_CARD_SLIDER_FIELDS.map(({ schemaKey, label, min, max, step, unit }) => (
                      <SliderRow
                        key={schemaKey}
                        label={label}
                        testId={`slider-row-mobile-${label.toLowerCase().replace(/\s+/g, "-")}`}
                        value={((mob as unknown) as Record<string, number>)[schemaKey] ?? 0}
                        min={min} max={max} step={step} unit={unit}
                        onChange={(v) => setMob(p => ({ ...p, [schemaKey]: v }))}
                      />
                    ))}
                    {/* Smart clipping validation for mobile */}
                    {(mob.positionX < 8 || mob.positionX > 92 || mob.positionY < 8 || mob.positionY > 92) && (
                      <div className="flex items-start gap-2 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/25 text-[11px] text-amber-400">
                        <span className="text-[13px] leading-none mt-0.5">⚠</span>
                        <span>Mobile focal point is near the edge — subject may be clipped on narrow screens.</span>
                      </div>
                    )}
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

// ─── Logo Manager (Branding section) ──────────────────────────────────────────
type LogoSlot = "icon" | "navbar" | "auth";

const LOGO_SLOTS: {
  key: LogoSlot;
  label: string;
  desc: string;
  fallback: string;
  hint: string;
  maxLabel: string;
}[] = [
  {
    key: "icon",
    label: "Icon Logo",
    desc: "Navbar, sidebar, footer, loading screen",
    fallback: "/ye-logo.png",
    hint: "Square or icon format recommended. PNG with transparency works best.",
    maxLabel: "400 × 400 px",
  },
  {
    key: "navbar",
    label: "Horizontal Logo",
    desc: "Admin brand preview (Settings → Brand)",
    fallback: "/ye-logo-horizontal.png",
    hint: "Wide format with text. PNG with transparent background.",
    maxLabel: "800 × 300 px",
  },
  {
    key: "auth",
    label: "Auth / Hero Logo",
    desc: "Auth page hero, onboarding screens",
    fallback: "/ye-logo-primary.png",
    hint: "Full brand logo. Used on the login / registration pages.",
    maxLabel: "600 × 600 px",
  },
];

function LogoSlotCard({
  slot, label, desc, fallback, hint, maxLabel, currentUrl,
  onUpload, onRemove, uploading, removing,
}: {
  slot: LogoSlot;
  label: string;
  desc: string;
  fallback: string;
  hint: string;
  maxLabel: string;
  currentUrl: string | null | undefined;
  onUpload: (dataUrl: string) => void;
  onRemove: () => void;
  uploading: boolean;
  removing: boolean;
}) {
  const { toast } = useToast();
  const isCustom = Boolean(currentUrl);
  const displaySrc = currentUrl || fallback;

  function triggerUpload() {
    const el = document.getElementById(`logo-input-${slot}`) as HTMLInputElement | null;
    el?.click();
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "File too large", description: "Logo must be under 5 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      if (dataUrl) onUpload(dataUrl);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm overflow-hidden">
      {/* Preview */}
      <div
        className="relative flex items-center justify-center bg-black/40"
        style={{ aspectRatio: "16/9", minHeight: 120 }}
      >
        {(uploading || removing) ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/55 backdrop-blur-[2px]">
            <RefreshCw size={14} className="text-primary animate-spin" />
            <span className="text-[11px] text-primary font-semibold">{uploading ? "Uploading…" : "Removing…"}</span>
          </div>
        ) : (
          <img
            src={displaySrc}
            alt={label}
            className="max-h-24 max-w-[80%] object-contain"
            style={{ filter: "drop-shadow(0 0 8px rgba(0,212,255,0.25))" }}
          />
        )}
        {isCustom && !uploading && !removing && (
          <div className="absolute top-2 right-2">
            <span className="text-[9px] bg-primary/20 border border-primary/30 text-primary px-2 py-0.5 rounded-md font-semibold">Custom</span>
          </div>
        )}
        {!isCustom && !uploading && !removing && (
          <div className="absolute top-2 right-2">
            <span className="text-[9px] bg-white/8 border border-white/10 text-muted-foreground px-2 py-0.5 rounded-md font-semibold">Default</span>
          </div>
        )}
      </div>

      {/* Card body */}
      <div className="p-4 space-y-3">
        <div>
          <h4 className="font-display font-bold text-sm">{label}</h4>
          <p className="text-[11px] text-muted-foreground">{desc}</p>
        </div>

        <p className="text-[10px] text-muted-foreground/50">{hint}</p>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={triggerUpload}
            disabled={uploading || removing}
            data-testid={`button-logo-upload-${slot}`}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-xl bg-primary/10 hover:bg-primary/18 border border-primary/20 hover:border-primary/35 text-primary text-[12px] font-semibold transition-all duration-200 disabled:opacity-40"
          >
            <UploadCloud size={13} />
            {isCustom ? "Replace" : "Upload"}
          </button>
          {isCustom && (
            <button
              type="button"
              onClick={onRemove}
              disabled={uploading || removing}
              data-testid={`button-logo-remove-${slot}`}
              className="inline-flex items-center justify-center gap-1.5 px-3 h-9 rounded-xl bg-red-500/8 hover:bg-red-500/16 border border-red-500/20 hover:border-red-500/35 text-red-400 text-[12px] font-semibold transition-all duration-200 disabled:opacity-40"
            >
              <Trash2 size={13} />
              Remove
            </button>
          )}
        </div>
        <p className="text-[10px] text-muted-foreground/35">Max {maxLabel} · PNG, JPG, WebP · 5 MB</p>
      </div>

      <input
        id={`logo-input-${slot}`}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={handleFile}
      />
    </div>
  );
}

// ─── Logo config helpers ───────────────────────────────────────────────────────

interface LogoConfig {
  showNavbar:     boolean;
  showFooter:     boolean;
  showLoading:    boolean;
  showEmail:      boolean;
  showApp:        boolean;
  showFavicon:    boolean;
  showHero:       boolean;
  desktopPadding: number;
  mobilePadding:  number;
  aiProtection:   boolean;
}

const DEFAULT_LOGO_CONFIG: LogoConfig = {
  showNavbar: true, showFooter: true, showLoading: true,
  showEmail:  true, showApp:    true, showFavicon: true, showHero: true,
  desktopPadding: 5, mobilePadding: 4, aiProtection: true,
};

function brandSettingsToConfig(bs: Record<string, number>): LogoConfig {
  return {
    showNavbar:     (bs.logoShowNavbar    ?? 1) !== 0,
    showFooter:     (bs.logoShowFooter    ?? 1) !== 0,
    showLoading:    (bs.logoShowLoading   ?? 1) !== 0,
    showEmail:      (bs.logoShowEmail     ?? 1) !== 0,
    showApp:        (bs.logoShowApp       ?? 1) !== 0,
    showFavicon:    (bs.logoShowFavicon   ?? 1) !== 0,
    showHero:       (bs.logoShowHero      ?? 1) !== 0,
    desktopPadding: bs.logoDesktopPadding ?? DEFAULT_LOGO_CONFIG.desktopPadding,
    mobilePadding:  bs.logoMobilePadding  ?? DEFAULT_LOGO_CONFIG.mobilePadding,
    aiProtection:   (bs.logoAiProtection  ?? 1) !== 0,
  };
}

function configToBrandPatch(cfg: LogoConfig): Record<string, number> {
  return {
    logoShowNavbar:     cfg.showNavbar    ? 1 : 0,
    logoShowFooter:     cfg.showFooter    ? 1 : 0,
    logoShowLoading:    cfg.showLoading   ? 1 : 0,
    logoShowEmail:      cfg.showEmail     ? 1 : 0,
    logoShowApp:        cfg.showApp       ? 1 : 0,
    logoShowFavicon:    cfg.showFavicon   ? 1 : 0,
    logoShowHero:       cfg.showHero      ? 1 : 0,
    logoDesktopPadding: cfg.desktopPadding,
    logoMobilePadding:  cfg.mobilePadding,
    logoAiProtection:   cfg.aiProtection  ? 1 : 0,
  };
}

const VISIBILITY_ROWS: {
  key: keyof Pick<LogoConfig,
    "showNavbar"|"showFooter"|"showLoading"|"showHero"|"showEmail"|"showApp"|"showFavicon">;
  label: string;
  desc: string;
  badge?: string;
}[] = [
  { key: "showNavbar",  label: "Navbar logo",    desc: "Top navigation bar on all pages" },
  { key: "showFooter",  label: "Footer logo",    desc: "Page footer — public & client area" },
  { key: "showLoading", label: "Loading screen", desc: "Splash loader on cold start" },
  { key: "showHero",    label: "Hero / Auth",    desc: "Login, registration & auth hero" },
  { key: "showEmail",   label: "Email",          desc: "Transactional emails",   badge: "Export" },
  { key: "showApp",     label: "App icon",       desc: "PWA homescreen icon",     badge: "Export" },
  { key: "showFavicon", label: "Favicon",        desc: "Browser tab icon",        badge: "Export" },
];

const EXPORT_PRESETS: {
  key: string; label: string; desc: string;
  files: { w: number; h: number; name: string }[];
}[] = [
  {
    key: "website",
    label: "Website",
    desc: "Icon 400×400 + Navbar 800×300",
    files: [
      { w: 400, h: 400, name: "ye-logo-icon.png" },
      { w: 800, h: 300, name: "ye-logo-navbar.png" },
    ],
  },
  {
    key: "mobile",
    label: "Mobile App",
    desc: "App icons 1024×1024 + 512×512",
    files: [
      { w: 1024, h: 1024, name: "ye-logo-app-1024.png" },
      { w: 512,  h: 512,  name: "ye-logo-app-512.png"  },
    ],
  },
  {
    key: "email",
    label: "Email",
    desc: "Email header 300×80",
    files: [
      { w: 300, h: 80, name: "ye-logo-email.png" },
    ],
  },
  {
    key: "pwa",
    label: "PWA",
    desc: "PWA icons 512×512 + 192×192",
    files: [
      { w: 512, h: 512, name: "ye-logo-pwa-512.png" },
      { w: 192, h: 192, name: "ye-logo-pwa-192.png" },
    ],
  },
];

async function exportLogoPreset(presetKey: string, logoSrc: string) {
  const preset = EXPORT_PRESETS.find(p => p.key === presetKey);
  if (!preset) return;

  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const i = new Image();
    i.crossOrigin = "anonymous";
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = logoSrc;
  });

  for (const { w, h, name } of preset.files) {
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    // contain fit — never crop, preserve aspect ratio
    const ratio = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const sw = img.naturalWidth  * ratio;
    const sh = img.naturalHeight * ratio;
    ctx.drawImage(img, (w - sw) / 2, (h - sh) / 2, sw, sh);
    await new Promise<void>(res => {
      canvas.toBlob(blob => {
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a   = document.createElement("a");
          a.href = url; a.download = name;
          document.body.appendChild(a); a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }
        setTimeout(res, 220);
      }, "image/png");
    });
  }
}

type PreviewDevice = "desktop" | "tablet" | "mobile";

function LogoLivePreview({ logoSrc, config }: { logoSrc: string; config: LogoConfig }) {
  const [device, setDevice] = useState<PreviewDevice>("desktop");

  const DEVICES: { key: PreviewDevice; label: string; icon: React.ReactNode; viewW: number }[] = [
    { key: "desktop", label: "Desktop", icon: <Monitor size={12} />,    viewW: 1280 },
    { key: "tablet",  label: "Tablet",  icon: <Tablet size={12} />,     viewW: 768  },
    { key: "mobile",  label: "Mobile",  icon: <Smartphone size={12} />, viewW: 390  },
  ];

  const cur    = DEVICES.find(d => d.key === device)!;
  const PANELW = 540;
  const scale  = PANELW / cur.viewW;
  const pad    = device === "mobile" ? config.mobilePadding : config.desktopPadding;
  const navH   = device === "mobile" ? 60 : 72;
  const logoH  = device === "mobile" ? 36 + pad : 44 + pad;

  return (
    <div className="space-y-3">
      {/* Device tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {DEVICES.map(d => (
          <button
            key={d.key}
            type="button"
            onClick={() => setDevice(d.key)}
            className={`flex items-center gap-1.5 px-3 h-7 rounded-lg text-[11px] font-semibold border transition-all duration-150 ${
              device === d.key
                ? "bg-primary/12 text-primary border-primary/30"
                : "bg-white/[0.03] text-muted-foreground border-white/8 hover:bg-white/6 hover:text-foreground"
            }`}
          >
            {d.icon} {d.label}
          </button>
        ))}
        <span className="ml-auto text-[10px] text-muted-foreground/35 self-center">{cur.viewW}px</span>
      </div>

      {/* Viewport simulation */}
      <div
        className="relative rounded-xl border border-white/10 bg-[#050505] overflow-hidden"
        style={{ height: Math.round(navH * scale) + 2 }}
      >
        <div
          style={{
            position: "absolute", top: 0, left: 0,
            width: cur.viewW,
            transformOrigin: "top left",
            transform: `scale(${scale})`,
            background: "#050505",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <div style={{
            height: navH,
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: `0 ${device === "mobile" ? 16 : 24}px`,
          }}>
            {/* Logo */}
            <div style={{ display: "flex", alignItems: "center" }}>
              {config.showNavbar ? (
                <img
                  src={logoSrc}
                  alt=""
                  style={{
                    height: logoH, width: "auto", objectFit: "contain",
                    padding: `${pad}px`,
                    filter: "drop-shadow(0 0 8px rgba(0,212,255,0.30))",
                    maxWidth: device === "mobile" ? 100 : 180,
                  }}
                />
              ) : (
                <div style={{
                  width: 48, height: 48,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px dashed rgba(255,255,255,0.12)",
                  borderRadius: 6,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>OFF</span>
                </div>
              )}
            </div>
            {/* Nav links — desktop only */}
            {device === "desktop" && (
              <div style={{ display: "flex", gap: 28, alignItems: "center" }}>
                {["Home", "Book", "How it Works", "FAQ"].map(t => (
                  <span key={t} style={{ color: "rgba(255,255,255,0.38)", fontSize: 13 }}>{t}</span>
                ))}
              </div>
            )}
            {/* Right action */}
            {device !== "mobile" ? (
              <div style={{
                height: 36, paddingInline: 16,
                background: "hsl(183 100% 74% / 0.13)",
                border: "1px solid hsl(183 100% 74% / 0.28)",
                borderRadius: 10,
                display: "flex", alignItems: "center",
              }}>
                <span style={{ color: "hsl(183 100% 74%)", fontSize: 12, fontWeight: 600 }}>Sign in</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                {[20, 14, 20].map((w, i) => (
                  <div key={i} style={{ width: w, height: 2, background: "rgba(255,255,255,0.42)", borderRadius: 1 }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/40">
        {device === "mobile" ? `Mobile padding: ${config.mobilePadding}px` : `Desktop padding: ${config.desktopPadding}px`}
        {!config.showNavbar && <span className="text-amber-400/70 ml-2">· Navbar logo hidden</span>}
      </p>
    </div>
  );
}

// ─── Per-logo slot metadata ────────────────────────────────────────────────
interface LogoSlotMeta { label: string; desc: string; fallback: string; }
const LOGO_SLOT_META: Record<BrandLogoSlot, LogoSlotMeta> = {
  navbar:    { label: "Navbar Logo",    desc: "Horizontal bar · desktop & tablet",    fallback: "/ye-logo-horizontal.png" },
  mobile:    { label: "Mobile Logo",    desc: "Navbar icon on phones",                fallback: "/ye-logo.png"            },
  login:     { label: "Login Logo",     desc: "Auth page hero image",                 fallback: "/ye-logo-primary.png"    },
  dashboard: { label: "Dashboard Logo", desc: "Client home · top-header logo",        fallback: "/ye-logo.png"            },
  footer:    { label: "Footer Logo",    desc: "Page footer icon stamp",               fallback: "/ye-logo.png"            },
  favicon:   { label: "Favicon",        desc: "Browser tab & bookmark icon",          fallback: "/ye-logo.png"            },
  splash:    { label: "Splash Screen",  desc: "Full-screen loader at app boot",       fallback: "/ye-logo.png"            },
};

function getLogoSrcForSlot(settings: Settings | undefined, slot: BrandLogoSlot): string {
  const s = settings as any;
  if (slot === "navbar") return s?.logoNavbarUrl || "/ye-logo-horizontal.png";
  if (slot === "login")  return s?.logoAuthUrl   || "/ye-logo-primary.png";
  return s?.logoIconUrl || "/ye-logo.png";
}

// ─── Logo controls panel (7 independent slots, 9 sliders each) ─────────────
function LogoControlsPanel() {
  const { toast } = useToast();
  const { data, isLoading } = useMediaData();
  const updateSettings = useUpdateSettings();
  const settings = data?.settings;

  type StoredLogos = Partial<Record<BrandLogoSlot, Partial<LogoBrandControls>>>;

  function buildLogos(stored?: StoredLogos): Record<BrandLogoSlot, LogoBrandControls> {
    return Object.fromEntries(
      BRAND_LOGO_SLOTS.map(slot => [slot, { ...LOGO_BRAND_SLOT_DEFAULTS[slot], ...(stored?.[slot] ?? {}) }])
    ) as Record<BrandLogoSlot, LogoBrandControls>;
  }

  const storedLogos = ((data?.settings?.brandSettings ?? {}) as any).logos as StoredLogos | undefined;

  const [logos, setLogos]           = useState<Record<BrandLogoSlot, LogoBrandControls>>(() => buildLogos(storedLogos));
  const [activeSlot, setActiveSlot]   = useState<BrandLogoSlot | null>("navbar");
  const [unlockedSlot, setUnlockedSlot] = useState<BrandLogoSlot | null>(null);
  const [dirty, setDirty]             = useState(false);
  const [initialised, setInitialised] = useState(false);

  useEffect(() => {
    if (!isLoading && data?.settings && !initialised) {
      const sl = ((data.settings.brandSettings ?? {}) as any).logos as StoredLogos | undefined;
      setLogos(buildLogos(sl));
      setInitialised(true);
    }
  }, [isLoading, data, initialised]);

  function setSlotVal(slot: BrandLogoSlot, key: keyof LogoBrandControls, v: number) {
    setLogos(prev => {
      const next = { ...prev, [slot]: { ...prev[slot], [key]: v } };
      applyLogoSlotCSSVars(slot, next[slot]);
      return next;
    });
    setDirty(true);
  }

  function resetSlot(slot: BrandLogoSlot) {
    const def = { ...LOGO_BRAND_SLOT_DEFAULTS[slot] };
    setLogos(prev => ({ ...prev, [slot]: def }));
    applyLogoSlotCSSVars(slot, def);
    setDirty(true);
  }

  function toggleLock(slot: BrandLogoSlot, e: React.MouseEvent) {
    e.stopPropagation();
    setUnlockedSlot(prev => (prev === slot ? null : slot));
    if (unlockedSlot !== slot) setActiveSlot(slot);
  }

  function handleResetAll() {
    const defaults = buildLogos();
    setLogos(defaults);
    BRAND_LOGO_SLOTS.forEach(slot => applyLogoSlotCSSVars(slot, defaults[slot]));
    setDirty(true);
  }

  function handleSave() {
    const existing = (data?.settings?.brandSettings ?? {}) as Record<string, unknown>;
    updateSettings.mutate(
      { brandSettings: { ...existing, logos } },
      {
        onSuccess: () => {
          invalidateMedia();
          toast({ title: "Brand settings saved" });
          setDirty(false);
        },
        onError: () => toast({ title: "Save failed", variant: "destructive" }),
      },
    );
  }

  if (isLoading) {
    return <div className="rounded-2xl border border-white/[0.08] bg-card/60 h-48 admin-shimmer" />;
  }

  return (
    <div className="rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-5 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h4 className="font-display font-bold text-base">Logo Controls</h4>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Independent sizing, zoom, offset, padding and glow for each logo placement. Sliders preview live — save to persist.
          </p>
        </div>
        {dirty && <span className="text-[11px] text-amber-400/80 shrink-0 pt-1">Unsaved changes</span>}
      </div>

      {/* ── Accordion: one card per slot ───────────────────────────────────── */}
      <div className="space-y-2">
        {BRAND_LOGO_SLOTS.map(slot => {
          const meta   = LOGO_SLOT_META[slot];
          const c      = logos[slot];
          const imgSrc = getLogoSrcForSlot(settings, slot);
          const isOpen = activeSlot === slot;

          const isUnlocked = unlockedSlot === slot;

          return (
            <div
              key={slot}
              className={`rounded-xl border overflow-hidden transition-colors duration-200 ${
                isUnlocked
                  ? "border-primary/30 shadow-[0_0_12px_-4px_hsl(183_100%_60%/0.25)]"
                  : "border-white/[0.07]"
              }`}
            >

              {/* Slot header */}
              <button
                type="button"
                onClick={() => setActiveSlot(isOpen ? null : slot)}
                data-testid={`button-brand-slot-${slot}`}
                className="w-full flex items-center gap-3 px-4 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors text-left"
              >
                {/* Thumbnail */}
                <div className="w-14 h-9 rounded-lg bg-black/60 flex items-center justify-center shrink-0 border border-white/[0.06] overflow-hidden">
                  <img
                    src={imgSrc}
                    alt=""
                    style={{
                      maxWidth: 50,
                      maxHeight: 30,
                      objectFit: "contain",
                      filter: `drop-shadow(0 0 4px rgba(0,212,255,${c.glow / 100}))`,
                    }}
                  />
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold leading-none">{meta.label}</p>
                  <p className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{meta.desc}</p>
                </div>

                {/* Quick stats */}
                <div className="hidden sm:flex items-center gap-2 text-[10px] font-mono text-muted-foreground/45 shrink-0">
                  <span>{c.hDesktop > 0 ? `h${c.hDesktop}` : c.wDesktop > 0 ? `w${c.wDesktop}` : "auto"}</span>
                  <span className="text-muted-foreground/25">·</span>
                  <span>{c.zoom}%</span>
                  <span className="text-muted-foreground/25">·</span>
                  <span>glow {c.glow}%</span>
                </div>

                {/* Lock / Unlock button */}
                <button
                  type="button"
                  onClick={(e) => toggleLock(slot, e)}
                  data-testid={`button-brand-slot-lock-${slot}`}
                  title={isUnlocked ? "Lock section" : "Unlock to edit"}
                  className={`shrink-0 flex items-center gap-1 px-2.5 h-7 rounded-lg text-[10px] font-semibold border transition-all duration-200 ${
                    isUnlocked
                      ? "bg-primary/15 border-primary/35 text-primary shadow-[0_0_8px_-2px_hsl(183_100%_60%/0.4)]"
                      : "bg-white/[0.04] border-white/[0.10] text-muted-foreground/50 hover:text-muted-foreground hover:bg-white/[0.08]"
                  }`}
                >
                  {isUnlocked
                    ? <><LockOpen size={11} /> <span className="hidden xs:inline">Editing</span></>
                    : <><Lock size={11} /> <span className="hidden xs:inline">Locked</span></>
                  }
                </button>

                <ChevronDown
                  size={14}
                  className={`shrink-0 text-muted-foreground/40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                />
              </button>

              {/* Slot body */}
              {isOpen && (
                <div className="border-t border-white/[0.06] bg-black/20 px-4 pb-5 pt-4 space-y-5">

                  {/* Lock notice banner */}
                  {!isUnlocked && (
                    <div className="flex items-center gap-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] px-3.5 py-2.5">
                      <Lock size={13} className="text-muted-foreground/40 shrink-0" />
                      <p className="text-[11px] text-muted-foreground/50 leading-snug">
                        Section is locked. Tap <span className="text-muted-foreground/80 font-semibold">Locked</span> in the header to enable editing.
                      </p>
                    </div>
                  )}

                  {/* Live preview — always visible */}
                  <div
                    className="rounded-xl border border-primary/15 bg-black/60 flex items-center justify-center overflow-hidden"
                    style={{ minHeight: 180 }}
                  >
                    <div style={{ padding: c.padding }}>
                      <img
                        src={imgSrc}
                        alt={meta.label}
                        style={{
                          display: "block",
                          width:  c.wDesktop > 0 ? Math.min(c.wDesktop, 500) : "auto",
                          height: c.hDesktop > 0 ? Math.min(c.hDesktop, 140) : "auto",
                          maxWidth: "100%",
                          maxHeight: 140,
                          objectFit: "contain",
                          transform: `scale(${c.zoom / 100}) translate(${c.hOffset}px, ${c.vOffset}px)`,
                          transformOrigin: "center center",
                          filter: `drop-shadow(0 0 18px rgba(0,212,255,${c.glow / 100}))`,
                          transition: "all 0.12s ease",
                        }}
                      />
                    </div>
                  </div>

                  {/* 9 sliders — disabled when locked */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-x-6 gap-y-5">
                    <SliderRow
                      label="Desktop Width"  value={c.wDesktop}  min={0}   max={800} step={10} unit="px" disabled={!isUnlocked}
                      onChange={v => setSlotVal(slot, "wDesktop",  v)} testId={`slider-${slot}-w-desktop`}
                    />
                    <SliderRow
                      label="Desktop Height" value={c.hDesktop}  min={0}   max={400} step={2}  unit="px" disabled={!isUnlocked}
                      onChange={v => setSlotVal(slot, "hDesktop",  v)} testId={`slider-${slot}-h-desktop`}
                    />
                    <SliderRow
                      label="Mobile Width"   value={c.wMobile}   min={0}   max={600} step={10} unit="px" disabled={!isUnlocked}
                      onChange={v => setSlotVal(slot, "wMobile",   v)} testId={`slider-${slot}-w-mobile`}
                    />
                    <SliderRow
                      label="Mobile Height"  value={c.hMobile}   min={0}   max={300} step={2}  unit="px" disabled={!isUnlocked}
                      onChange={v => setSlotVal(slot, "hMobile",   v)} testId={`slider-${slot}-h-mobile`}
                    />
                    <SliderRow
                      label="Zoom"           value={c.zoom}      min={50}  max={200} step={5}  unit="%" disabled={!isUnlocked}
                      onChange={v => setSlotVal(slot, "zoom",      v)} testId={`slider-${slot}-zoom`}
                    />
                    <SliderRow
                      label="H-Offset"       value={c.hOffset}   min={-80} max={80}  step={1}  unit="px" disabled={!isUnlocked}
                      onChange={v => setSlotVal(slot, "hOffset",   v)} testId={`slider-${slot}-hoffset`}
                    />
                    <SliderRow
                      label="V-Offset"       value={c.vOffset}   min={-80} max={80}  step={1}  unit="px" disabled={!isUnlocked}
                      onChange={v => setSlotVal(slot, "vOffset",   v)} testId={`slider-${slot}-voffset`}
                    />
                    <SliderRow
                      label="Padding"        value={c.padding}   min={0}   max={32}  step={1}  unit="px" disabled={!isUnlocked}
                      onChange={v => setSlotVal(slot, "padding",   v)} testId={`slider-${slot}-padding`}
                    />
                    <SliderRow
                      label="Glow Intensity" value={c.glow}      min={0}   max={100} step={5}  unit="%" disabled={!isUnlocked}
                      onChange={v => setSlotVal(slot, "glow",      v)} testId={`slider-${slot}-glow`}
                    />
                  </div>

                  {/* Per-slot reset — only when unlocked */}
                  {isUnlocked && (
                    <button
                      type="button"
                      onClick={() => resetSlot(slot)}
                      data-testid={`button-brand-slot-reset-${slot}`}
                      className="text-[11px] text-muted-foreground/40 hover:text-muted-foreground/70 transition-colors"
                    >
                      ↺ Reset {meta.label} to defaults
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Global actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-white/[0.06]">
        <button
          type="button"
          onClick={handleResetAll}
          data-testid="button-brand-reset"
          className="px-4 h-9 rounded-xl text-[12px] font-semibold border border-white/10 bg-white/[0.04] text-muted-foreground hover:text-foreground hover:bg-white/[0.08] transition-all duration-150"
        >
          Reset all
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || updateSettings.isPending}
          data-testid="button-brand-save"
          className="ml-auto inline-flex items-center gap-2 px-5 h-9 rounded-xl bg-primary/12 hover:bg-primary/20 border border-primary/25 hover:border-primary/40 text-primary text-[12px] font-semibold transition-all duration-200 disabled:opacity-40"
        >
          {updateSettings.isPending
            ? <><RefreshCw size={12} className="animate-spin" /> Saving…</>
            : <><CheckCircle2 size={12} /> Save all</>
          }
        </button>
      </div>
    </div>
  );
}

// ─── Branding section ──────────────────────────────────────────────────────────
function BrandingSection() {
  const { toast } = useToast();
  const { data, isLoading } = useMediaData();
  const settings = data?.settings;

  // ── Upload / remove mutations (unchanged) ─────────────────────────────────
  const uploadMutations = {
    icon: useMutation({
      mutationFn: async (dataUrl: string) => {
        const res = await apiRequest("POST", "/api/admin/media/logo/icon", { imageDataUrl: dataUrl });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || "Upload failed"); }
        return res.json();
      },
      onSuccess: () => { invalidateMedia(); toast({ title: "Icon logo updated" }); },
      onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
    }),
    navbar: useMutation({
      mutationFn: async (dataUrl: string) => {
        const res = await apiRequest("POST", "/api/admin/media/logo/navbar", { imageDataUrl: dataUrl });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || "Upload failed"); }
        return res.json();
      },
      onSuccess: () => { invalidateMedia(); toast({ title: "Horizontal logo updated" }); },
      onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
    }),
    auth: useMutation({
      mutationFn: async (dataUrl: string) => {
        const res = await apiRequest("POST", "/api/admin/media/logo/auth", { imageDataUrl: dataUrl });
        if (!res.ok) { const e = await res.json().catch(() => ({})); throw new Error((e as any).error || "Upload failed"); }
        return res.json();
      },
      onSuccess: () => { invalidateMedia(); toast({ title: "Auth logo updated" }); },
      onError: (e: Error) => toast({ title: "Upload failed", description: e.message, variant: "destructive" }),
    }),
  };
  const removeMutations = {
    icon: useMutation({
      mutationFn: async () => {
        const res = await apiRequest("DELETE", "/api/admin/media/logo/icon");
        if (!res.ok) throw new Error("Remove failed");
      },
      onSuccess: () => { invalidateMedia(); toast({ title: "Icon logo removed — default restored" }); },
      onError: (e: Error) => toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
    }),
    navbar: useMutation({
      mutationFn: async () => {
        const res = await apiRequest("DELETE", "/api/admin/media/logo/navbar");
        if (!res.ok) throw new Error("Remove failed");
      },
      onSuccess: () => { invalidateMedia(); toast({ title: "Horizontal logo removed — default restored" }); },
      onError: (e: Error) => toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
    }),
    auth: useMutation({
      mutationFn: async () => {
        const res = await apiRequest("DELETE", "/api/admin/media/logo/auth");
        if (!res.ok) throw new Error("Remove failed");
      },
      onSuccess: () => { invalidateMedia(); toast({ title: "Auth logo removed — default restored" }); },
      onError: (e: Error) => toast({ title: "Remove failed", description: e.message, variant: "destructive" }),
    }),
  };

  // ── Logo config state ─────────────────────────────────────────────────────
  const [cfg, setCfg]                       = useState<LogoConfig>(DEFAULT_LOGO_CONFIG);
  const [isDirty, setIsDirty]               = useState(false);
  const [activeTab, setActiveTab]           = useState<"uploads"|"preview"|"settings"|"export">("uploads");
  const [exportingPreset, setExportingPreset] = useState<string | null>(null);

  useEffect(() => {
    if (settings?.brandSettings) {
      setCfg(brandSettingsToConfig(settings.brandSettings as Record<string, number>));
      setIsDirty(false);
    }
  }, [settings?.brandSettings]);

  function patchCfg(patch: Partial<LogoConfig>) {
    setCfg(prev => ({ ...prev, ...patch }));
    setIsDirty(true);
  }

  const saveConfigMutation = useMutation({
    mutationFn: async (patch: Record<string, number>) => {
      const res = await apiRequest("PATCH", "/api/admin/media/logo/config", patch);
      if (!res.ok) throw new Error("Save failed");
      return res.json();
    },
    onSuccess: () => {
      invalidateMedia();
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setIsDirty(false);
      toast({ title: "Logo settings saved" });
    },
    onError: (e: Error) => toast({ title: "Save failed", description: e.message, variant: "destructive" }),
  });

  const iconLogoSrc = (settings as any)?.logoIconUrl || "/ye-logo.png";

  const TAB_LABELS: Record<typeof activeTab, string> = {
    uploads:  "Logo Uploads",
    preview:  "Live Preview",
    settings: "Visibility & Padding",
    export:   "Export Presets",
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h3 className="font-display font-bold text-lg">Logo Manager</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Upload custom logos, preview across devices, control visibility per placement, set safe padding, and export for every platform.
        </p>
      </div>

      {/* Sub-tabs */}
      <div className="flex gap-2 flex-wrap" data-testid="logo-manager-tabs">
        {(["uploads","preview","settings","export"] as const).map(t => (
          <button
            key={t}
            type="button"
            onClick={() => setActiveTab(t)}
            data-testid={`tab-logo-${t}`}
            className={`px-4 h-8 rounded-xl text-[12px] font-semibold border transition-all duration-150 ${
              activeTab === t
                ? "bg-primary/12 text-primary border-primary/30 shadow-[0_0_16px_-5px_hsl(183_100%_60%/0.3)]"
                : "bg-white/[0.03] text-muted-foreground border-white/8 hover:bg-white/6 hover:text-foreground"
            }`}
          >
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* ── Tab: Logo Uploads ─────────────────────────────────────────────── */}
      {activeTab === "uploads" && (
        isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {[0,1,2].map(i => <div key={i} className="admin-shimmer h-64 rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {LOGO_SLOTS.map(({ key, label, desc, fallback, hint, maxLabel }) => (
              <LogoSlotCard
                key={key}
                slot={key}
                label={label}
                desc={desc}
                fallback={fallback}
                hint={hint}
                maxLabel={maxLabel}
                currentUrl={(settings as any)?.[`logo${key.charAt(0).toUpperCase()}${key.slice(1)}Url`]}
                onUpload={(dataUrl) => uploadMutations[key].mutate(dataUrl)}
                onRemove={() => removeMutations[key].mutate()}
                uploading={uploadMutations[key].isPending}
                removing={removeMutations[key].isPending}
              />
            ))}
          </div>
        )
      )}

      {/* ── Tab: Live Preview ─────────────────────────────────────────────── */}
      {activeTab === "preview" && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-5 space-y-4">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Navbar</p>
            <LogoLivePreview logoSrc={iconLogoSrc} config={cfg} />
          </div>

          {/* Footer preview */}
          <div className="rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-5 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Footer</p>
            <div className="rounded-xl border border-white/8 bg-black/40 px-6 py-4 flex items-center justify-between">
              {cfg.showFooter ? (
                <img
                  src={iconLogoSrc} alt=""
                  style={{ height: 22, width: "auto", objectFit: "contain",
                    filter: "drop-shadow(0 0 6px rgba(0,212,255,0.22))", opacity: 0.8 }}
                />
              ) : (
                <div style={{ width: 22, height: 22, background: "rgba(255,255,255,0.04)",
                  border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 4,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 9 }}>OFF</span>
                </div>
              )}
              <span style={{ color: "rgba(255,255,255,0.18)", fontSize: 11 }}>© 2025 Youssef Elite</span>
            </div>
          </div>

          {/* Loading screen preview */}
          <div className="rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-5 space-y-3">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Loading Screen</p>
            <div className="rounded-xl border border-white/8 bg-black/40 h-36 flex flex-col items-center justify-center gap-4">
              {cfg.showLoading ? (
                <img
                  src={iconLogoSrc} alt=""
                  style={{ height: 64, width: "auto", objectFit: "contain",
                    filter: "drop-shadow(0 0 14px rgba(0,212,255,0.38))" }}
                />
              ) : (
                <div style={{ width: 64, height: 64, background: "rgba(255,255,255,0.04)",
                  border: "1px dashed rgba(255,255,255,0.1)", borderRadius: 8,
                  display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ color: "rgba(255,255,255,0.2)", fontSize: 10 }}>OFF</span>
                </div>
              )}
              <div style={{ width: 18, height: 18, borderRadius: "50%",
                border: "2px solid rgba(94,231,255,0.45)", borderTopColor: "transparent" }} />
            </div>
          </div>
        </div>
      )}

      {/* ── Tab: Visibility & Padding ─────────────────────────────────────── */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          {/* Visibility toggles */}
          <div className="rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-5 space-y-4">
            <div>
              <h4 className="font-display font-bold text-sm">Visibility Toggles</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Control where your logo appears. <span className="text-amber-400/80">Export</span>-tagged placements affect download presets, not live rendering.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VISIBILITY_ROWS.map(({ key, label, desc, badge }) => (
                <div
                  key={key}
                  className="flex items-center justify-between gap-3 p-3 rounded-xl bg-white/[0.025] border border-white/[0.06] hover:bg-white/[0.04] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      {(cfg as any)[key]
                        ? <Eye size={11} className="text-primary/60 shrink-0" />
                        : <EyeOff size={11} className="text-muted-foreground/40 shrink-0" />
                      }
                      <span className="text-[12px] font-semibold">{label}</span>
                      {badge && (
                        <span className="text-[9px] bg-amber-400/12 border border-amber-400/22 text-amber-400 px-1.5 py-0.5 rounded font-semibold">{badge}</span>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground/55 truncate pl-4">{desc}</p>
                  </div>
                  <Switch
                    checked={(cfg as any)[key] as boolean}
                    onCheckedChange={v => patchCfg({ [key]: v } as Partial<LogoConfig>)}
                    data-testid={`toggle-logo-${key}`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Padding sliders */}
          <div className="rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-5 space-y-4">
            <div>
              <h4 className="font-display font-bold text-sm">Safe Padding</h4>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                Internal breathing room inside each logo container. Prevents the logo from touching its slot edge.
                Live preview updates instantly — save to apply site-wide.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-semibold flex items-center gap-1.5">
                    <Monitor size={12} className="text-muted-foreground" /> Desktop padding
                  </label>
                  <span className="text-[11px] font-mono text-primary">{cfg.desktopPadding}px</span>
                </div>
                <Slider
                  min={0} max={32} step={1}
                  value={[cfg.desktopPadding]}
                  onValueChange={([v]) => patchCfg({ desktopPadding: v })}
                  data-testid="slider-logo-desktop-padding"
                />
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-semibold flex items-center gap-1.5">
                    <Smartphone size={12} className="text-muted-foreground" /> Mobile padding
                  </label>
                  <span className="text-[11px] font-mono text-primary">{cfg.mobilePadding}px</span>
                </div>
                <Slider
                  min={0} max={32} step={1}
                  value={[cfg.mobilePadding]}
                  onValueChange={([v]) => patchCfg({ mobilePadding: v })}
                  data-testid="slider-logo-mobile-padding"
                />
              </div>
            </div>
          </div>

          {/* AI logo protection */}
          <div className="rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3">
                <Shield size={16} className="mt-0.5 shrink-0 text-primary/70" />
                <div>
                  <h4 className="font-display font-bold text-sm">AI Logo Protection</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    All logo uploads are processed with <em>contain</em> fit — the logo is never cropped and its aspect ratio is always preserved.
                    Disable only if you intentionally want to crop uploaded logos.
                  </p>
                </div>
              </div>
              <Switch
                checked={cfg.aiProtection}
                onCheckedChange={v => patchCfg({ aiProtection: v })}
                data-testid="toggle-logo-ai-protection"
              />
            </div>
          </div>

          {/* Save */}
          <div className="flex items-center gap-3 justify-end">
            {isDirty && <span className="text-[11px] text-amber-400/80">Unsaved changes</span>}
            <button
              type="button"
              onClick={() => saveConfigMutation.mutate(configToBrandPatch(cfg))}
              disabled={!isDirty || saveConfigMutation.isPending}
              data-testid="button-logo-settings-save"
              className="inline-flex items-center gap-2 px-5 h-9 rounded-xl bg-primary/12 hover:bg-primary/20 border border-primary/25 hover:border-primary/40 text-primary text-[12px] font-semibold transition-all duration-200 disabled:opacity-40"
            >
              {saveConfigMutation.isPending
                ? <><RefreshCw size={12} className="animate-spin" /> Saving…</>
                : isDirty
                  ? <><CheckCircle2 size={12} /> Save settings</>
                  : <><CheckCircle2 size={12} /> Saved</>
              }
            </button>
          </div>
        </div>
      )}

      {/* ── Tab: Export Presets ───────────────────────────────────────────── */}
      {activeTab === "export" && (
        <div className="space-y-4">
          <p className="text-[12px] text-muted-foreground">
            Downloads are generated from your active logo (custom or default) at the exact dimensions for each platform.
            The logo is always contain-fitted — never cropped, aspect ratio preserved.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {EXPORT_PRESETS.map(preset => (
              <div
                key={preset.key}
                className="rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-5 space-y-3"
              >
                <div>
                  <h4 className="font-display font-bold text-sm">{preset.label}</h4>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{preset.desc}</p>
                </div>
                <div className="space-y-1">
                  {preset.files.map(f => (
                    <div key={f.name} className="flex items-center gap-2 text-[10px] text-muted-foreground/55">
                      <div className="w-1 h-1 rounded-full bg-muted-foreground/30 shrink-0" />
                      <span className="font-mono">{f.name}</span>
                      <span className="text-muted-foreground/35">— {f.w}×{f.h}</span>
                    </div>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={exportingPreset === preset.key}
                  data-testid={`button-export-${preset.key}`}
                  onClick={async () => {
                    setExportingPreset(preset.key);
                    try {
                      await exportLogoPreset(preset.key, iconLogoSrc);
                      toast({ title: `${preset.label} logos downloaded` });
                    } catch {
                      toast({ title: "Export failed", description: "Could not generate logo files.", variant: "destructive" });
                    } finally {
                      setExportingPreset(null);
                    }
                  }}
                  className="w-full inline-flex items-center justify-center gap-2 h-9 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/8 hover:border-white/18 text-foreground/75 hover:text-foreground text-[12px] font-semibold transition-all duration-200 disabled:opacity-40"
                >
                  {exportingPreset === preset.key
                    ? <><RefreshCw size={12} className="animate-spin" /> Generating…</>
                    : <><Download size={12} /> Download {preset.label}</>
                  }
                </button>
              </div>
            ))}
          </div>
          <div className="flex items-start gap-3 p-3.5 bg-white/[0.03] border border-white/8 rounded-xl">
            <Shield size={13} className="mt-0.5 shrink-0 text-muted-foreground/60" />
            <p className="text-[11px] text-muted-foreground/70">
              All exports use <strong className="text-foreground/80">contain fit</strong> — logo is never cropped and aspect ratio is always preserved. Transparent areas are included in the PNG output.
            </p>
          </div>
        </div>
      )}

      {/* ── Logo Controls (7 independent slots, 9 sliders each) ─────────── */}
      <LogoControlsPanel />
    </div>
  );
}

// ─── Profile section ──────────────────────────────────────────────────────────
function ProfileSection({ settings }: { settings: Settings }) {
  const { toast } = useToast();
  const updateSettings = useUpdateSettings();

  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
  const ALLOWED_PHOTO_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [imgErrored, setImgErrored] = useState(false);
  const [bio, setBio] = useState(settings?.profileBio ?? "");

  const savedPhoto = settings?.profilePhotoUrl?.trim() || "";
  const displayPhoto = pendingPreview || (savedPhoto && !imgErrored ? savedPhoto : "");

  useEffect(() => {
    setImgErrored(false);
  }, [savedPhoto]);

  useEffect(() => {
    setBio(settings?.profileBio ?? "");
  }, [settings?.profileBio]);

  const uploadMutation = useMutation({
    mutationFn: async (dataUrl: string) => {
      const res = await apiRequest("POST", "/api/admin/profile-photo", { imageDataUrl: dataUrl });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Upload failed");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateMedia();
      setPendingPreview(null);
      toast({ title: "Photo uploaded", description: "Profile photo updated successfully." });
    },
    onError: (e: Error) => {
      setPendingPreview(null);
      toast({ title: "Upload failed", description: e.message, variant: "destructive" });
    },
  });

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;
    if (!ALLOWED_PHOTO_MIME.includes(file.type.toLowerCase())) {
      toast({ title: "Invalid file type", description: "Please upload a JPG, PNG, or WebP image.", variant: "destructive" });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast({ title: "File too large", description: "Photo must be under 5 MB.", variant: "destructive" });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        toast({ title: "Read failed", description: "Could not read the file. Please try again.", variant: "destructive" });
        return;
      }
      setPendingPreview(result);
      uploadMutation.mutate(result);
    };
    reader.onerror = () => toast({ title: "Read failed", variant: "destructive" });
    reader.readAsDataURL(file);
  };

  const deletePhotoMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("PATCH", "/api/settings", { profilePhotoUrl: null });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as any).error || "Delete failed");
      }
      return res.json();
    },
    onSuccess: () => {
      invalidateMedia();
      toast({ title: "Photo removed", description: "Profile photo cleared." });
    },
    onError: (e: Error) => {
      toast({ title: "Failed to remove photo", description: e.message, variant: "destructive" });
    },
  });

  function handleBioSave() {
    updateSettings.mutate({ profileBio: bio.trim() || null } as any, {
      onSuccess: () => {
        invalidateMedia();
      },
    });
  }

  return (
    <div className="space-y-6" data-testid="section-profile-media">
      <div>
        <h3 className="font-display font-bold text-lg">Profile Photo & Bio</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Coach homepage photo and about text shown on the public homepage.
        </p>
      </div>

      {/* Photo uploader */}
      <div className="rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-5 space-y-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <ImageIcon size={12} /> Profile Photo
        </p>

        <div className="flex flex-col sm:flex-row gap-5">
          {/* 4:5 preview tile */}
          <div className="relative w-32 sm:w-36 aspect-[4/5] flex-shrink-0 rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-primary/10 to-black/40">
            {displayPhoto ? (
              <img
                src={displayPhoto}
                alt="Profile preview"
                className="w-full h-full object-cover object-top"
                onError={() => { if (!pendingPreview) setImgErrored(true); }}
                data-testid="img-profile-preview-media"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60 p-2 text-center">
                <ImageIcon size={28} className="mb-2 opacity-50" />
                <span className="text-[10px] uppercase tracking-widest">No Photo</span>
              </div>
            )}
            {uploadMutation.isPending && (
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                <Loader2 className="animate-spin text-primary" size={22} />
                <span className="mt-2 text-[10px] uppercase tracking-widest text-white/80">Uploading…</span>
              </div>
            )}
          </div>

          <div className="flex-1 flex flex-col gap-3 justify-center">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                handleFileSelected(e.target.files?.[0]);
                e.target.value = "";
              }}
              data-testid="input-photo-file-media"
            />
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending || deletePhotoMutation.isPending}
                data-testid="button-upload-profile-photo"
                className="inline-flex items-center justify-center gap-2 px-5 h-10 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 hover:border-primary/50 text-primary text-sm font-semibold transition-all duration-200 disabled:opacity-40 hover:shadow-[0_0_18px_-4px_hsl(183_100%_60%/0.35)]"
              >
                {uploadMutation.isPending ? (
                  <><Loader2 size={14} className="animate-spin" /> Uploading…</>
                ) : (
                  <><UploadCloud size={14} /> {savedPhoto ? "Replace Photo" : "Upload Photo"}</>
                )}
              </button>
              {savedPhoto && (
                <button
                  type="button"
                  onClick={() => {
                    if (confirm("Remove the profile photo? The homepage will show a placeholder until you upload a new one.")) {
                      deletePhotoMutation.mutate();
                    }
                  }}
                  disabled={uploadMutation.isPending || deletePhotoMutation.isPending}
                  data-testid="button-delete-profile-photo"
                  className="inline-flex items-center justify-center gap-2 px-4 h-10 rounded-xl border border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-300 hover:border-red-500/50 text-sm font-semibold transition-all duration-200 disabled:opacity-40"
                >
                  {deletePhotoMutation.isPending ? (
                    <><Loader2 size={14} className="animate-spin" /> Removing…</>
                  ) : (
                    <><X size={14} /> Remove Photo</>
                  )}
                </button>
              )}
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              JPG, PNG, or WebP · Max 5 MB · Stored as optimised WebP (1200×1500, q90). Displayed on the public homepage.
            </p>
          </div>
        </div>
      </div>

      {/* Bio editor */}
      <div className="rounded-2xl border border-white/[0.08] bg-card/60 backdrop-blur-sm p-5 space-y-4">
        <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
          <MessageSquare size={12} /> About / Bio
        </p>

        <Textarea
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          rows={6}
          placeholder="Write a short bio for the homepage about section…"
          className="bg-white/5 border-white/10 resize-none"
          data-testid="input-profile-bio-media"
        />

        <button
          type="button"
          onClick={handleBioSave}
          disabled={updateSettings.isPending}
          data-testid="button-save-profile-bio"
          className="w-full h-10 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 hover:border-primary/50 text-primary text-sm font-semibold transition-all duration-200 disabled:opacity-40 hover:shadow-[0_0_18px_-4px_hsl(183_100%_60%/0.35)] flex items-center justify-center gap-2"
        >
          {updateSettings.isPending ? (
            <><Loader2 size={14} className="animate-spin" /> Saving…</>
          ) : (
            <><CheckCircle2 size={14} /> Save Bio</>
          )}
        </button>
      </div>
    </div>
  );
}

// ─── Transformations section ──────────────────────────────────────────────────
const TRANSFORMATION_ASPECTS: AspectPreset[] = [
  { key: "4x5", label: "4:5", ratio: 4 / 5 },
  { key: "3x4", label: "3:4", ratio: 3 / 4 },
  { key: "1x1", label: "1:1", ratio: 1 / 1 },
];

type TransformationCardProps =
  | {
      mode: "create";
      onCancel: () => void;
      onSave: (payload: {
        beforeImageDataUrl: string;
        afterImageDataUrl: string;
        displayName: string | null;
        goal: string | null;
        duration: string | null;
        result: string | null;
        testimonial: string | null;
      }) => Promise<void>;
      saving: boolean;
    }
  | { mode: "edit"; row: Transformation };

function TransformationCard(props: TransformationCardProps) {
  const { toast } = useToast();
  const updateMutation = useUpdateTransformation();
  const deleteMutation = useDeleteTransformation();

  const initial: Transformation | null = props.mode === "edit" ? props.row : null;

  const [beforeUrl, setBeforeUrl] = useState<string>(initial?.beforeImageDataUrl ?? "");
  const [afterUrl, setAfterUrl] = useState<string>(initial?.afterImageDataUrl ?? "");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [duration, setDuration] = useState(initial?.duration ?? "");
  const [result, setResult] = useState(initial?.result ?? "");
  const [testimonial, setTestimonial] = useState(initial?.testimonial ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [beforeCropOpen, setBeforeCropOpen] = useState(false);
  const [afterCropOpen, setAfterCropOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const id = initial?.id ?? null;
  const saving =
    busy ||
    (props.mode === "create" && props.saving) ||
    (props.mode === "edit" && updateMutation.isPending);

  async function handleSave() {
    if (!beforeUrl || !afterUrl) {
      toast({ title: "Both before and after images are required.", variant: "destructive" });
      return;
    }
    setBusy(true);
    try {
      const norm = (v: string) => (v.trim() ? v.trim() : null);
      if (props.mode === "create") {
        await props.onSave({
          beforeImageDataUrl: beforeUrl,
          afterImageDataUrl: afterUrl,
          displayName: norm(displayName),
          goal: norm(goal),
          duration: norm(duration),
          result: norm(result),
          testimonial: norm(testimonial),
        });
        toast({ title: "Transformation saved." });
      } else if (id !== null) {
        const updates: Record<string, unknown> = {
          displayName: norm(displayName),
          goal: norm(goal),
          duration: norm(duration),
          result: norm(result),
          testimonial: norm(testimonial),
          isActive,
        };
        if (beforeUrl !== initial?.beforeImageDataUrl) updates.beforeImageDataUrl = beforeUrl;
        if (afterUrl !== initial?.afterImageDataUrl) updates.afterImageDataUrl = afterUrl;
        await updateMutation.mutateAsync({ id, updates });
        toast({ title: "Transformation saved." });
      }
    } catch (e: any) {
      toast({ title: "Save failed", description: e?.message, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-2xl border border-white/10 bg-black/20 p-4"
      data-testid={props.mode === "create" ? "transformation-card-new" : `transformation-admin-card-${id}`}
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-4">
        {/* BEFORE slot */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Before</p>
          <div className="aspect-[4/5] rounded-xl border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center">
            {beforeUrl ? (
              <img src={beforeUrl} alt="before" className="w-full h-full object-cover" data-testid={`img-admin-before-${id ?? "new"}`} />
            ) : (
              <ImageIcon size={28} className="text-muted-foreground/40" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-xl"
            onClick={() => setBeforeCropOpen(true)}
            data-testid={`button-crop-before-${id ?? "new"}`}
          >
            <UploadCloud size={14} className="mr-1.5" />
            {beforeUrl ? "Change Before" : "Upload Before"}
          </Button>
        </div>

        {/* AFTER slot */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">After</p>
          <div className="aspect-[4/5] rounded-xl border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center">
            {afterUrl ? (
              <img src={afterUrl} alt="after" className="w-full h-full object-cover" data-testid={`img-admin-after-${id ?? "new"}`} />
            ) : (
              <ImageIcon size={28} className="text-muted-foreground/40" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-xl"
            onClick={() => setAfterCropOpen(true)}
            data-testid={`button-crop-after-${id ?? "new"}`}
          >
            <UploadCloud size={14} className="mr-1.5" />
            {afterUrl ? "Change After" : "Upload After"}
          </Button>
        </div>

        {/* Metadata */}
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Display Name</label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              className="bg-white/5 border-white/10"
              data-testid={`input-display-name-${id ?? "new"}`}
            />
            <p className="text-[11px] text-muted-foreground mt-1">Shown on the gallery card. Leave blank to hide.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Goal</label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={120}
                placeholder="e.g. Fat loss"
                className="bg-white/5 border-white/10"
                data-testid={`input-goal-${id ?? "new"}`}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Duration</label>
              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                maxLength={60}
                placeholder="e.g. 12 weeks"
                className="bg-white/5 border-white/10"
                data-testid={`input-duration-${id ?? "new"}`}
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Result</label>
            <Input
              value={result}
              onChange={(e) => setResult(e.target.value)}
              maxLength={160}
              placeholder="e.g. −12 kg body fat"
              className="bg-white/5 border-white/10"
              data-testid={`input-result-${id ?? "new"}`}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">Testimonial</label>
            <Textarea
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder="Client quote (optional)"
              className="bg-white/5 border-white/10"
              data-testid={`input-testimonial-${id ?? "new"}`}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/5">
        {props.mode === "edit" ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={isActive} onCheckedChange={setIsActive} data-testid={`switch-transformation-active-${id}`} />
            Active
          </label>
        ) : (
          <Button type="button" variant="ghost" onClick={() => "onCancel" in props && props.onCancel()} data-testid="button-cancel-new-transformation">
            <X size={14} className="mr-1.5" /> Cancel
          </Button>
        )}

        <div className="flex items-center gap-2">
          {props.mode === "edit" && id !== null && (
            <Button
              type="button"
              variant="outline"
              className="text-red-300 border-red-500/30 hover:bg-red-500/10 hover:text-red-200"
              onClick={() => { if (confirm("Delete this transformation?")) deleteMutation.mutate(id); }}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-transformation-${id}`}
            >
              <Trash2 size={14} className="mr-1.5" /> Delete
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-testid={`button-save-transformation-${id ?? "new"}`}
            className="rounded-xl"
          >
            {saving ? <Loader2 size={14} className="mr-2 animate-spin" /> : <Check size={14} className="mr-1.5" />}
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <ImageCropper
        open={beforeCropOpen}
        onOpenChange={setBeforeCropOpen}
        saving={false}
        onCropped={(url) => { setBeforeUrl(url); setBeforeCropOpen(false); }}
        aspects={TRANSFORMATION_ASPECTS}
        outputLongEdgePx={1600}
        title="Upload Before Photo"
        description="Portrait orientation recommended (4:5 or 3:4). The photo will be shown on the public transformations gallery."
      />
      <ImageCropper
        open={afterCropOpen}
        onOpenChange={setAfterCropOpen}
        saving={false}
        onCropped={(url) => { setAfterUrl(url); setAfterCropOpen(false); }}
        aspects={TRANSFORMATION_ASPECTS}
        outputLongEdgePx={1600}
        title="Upload After Photo"
        description="Use the same orientation as the before photo for the best gallery appearance."
      />
    </div>
  );
}

// ─── Sortable row wrapper ─────────────────────────────────────────────────────
function SortableTransformationRow({
  row,
  isSaving,
}: {
  row: Transformation;
  isSaving: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex gap-2 items-start ${isDragging ? "opacity-50 z-50 relative" : ""}`}
    >
      <div className="flex flex-col items-center justify-center pt-4 shrink-0">
        <button
          type="button"
          {...attributes}
          {...listeners}
          data-testid={`button-drag-handle-${row.id}`}
          disabled={isSaving}
          className="w-7 h-14 rounded-lg border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] hover:border-primary/30 flex items-center justify-center disabled:opacity-30 disabled:cursor-not-allowed transition-all cursor-grab active:cursor-grabbing touch-none"
          title="Drag to reorder"
        >
          {isSaving ? (
            <Loader2 size={13} className="animate-spin text-muted-foreground" />
          ) : (
            <GripVertical size={13} className="text-muted-foreground" />
          )}
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <TransformationCard mode="edit" row={row} />
      </div>
    </div>
  );
}

function TransformationsMediaSection() {
  const { toast } = useToast();
  const { data: rawRows = [], isLoading } = useAdminTransformations();
  const createMutation = useCreateTransformation();
  const reorderMutation = useUpdateTransformation();
  const [adding, setAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Optimistic local order — kept in sync with server data but can be
  // reordered instantly on drag end before the server responds.
  const [localIds, setLocalIds] = useState<number[]>([]);

  // Sort by sortOrder ascending so the list matches the public gallery order.
  const sortedRows = [...rawRows].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  // Sync localIds whenever the server data changes (initial load, mutations).
  useEffect(() => {
    setLocalIds(sortedRows.map((r) => r.id));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawRows]);

  // Build the display list from localIds so optimistic reorder is instant.
  const rowById = Object.fromEntries(rawRows.map((r) => [r.id, r]));
  const rows = localIds.map((id) => rowById[id]).filter(Boolean) as Transformation[];

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = localIds.indexOf(active.id as number);
    const newIndex = localIds.indexOf(over.id as number);
    if (oldIndex === -1 || newIndex === -1) return;

    // Optimistic update
    const newIds = arrayMove(localIds, oldIndex, newIndex);
    setLocalIds(newIds);

    // Persist — assign sort_order = array index for all affected rows
    setIsSaving(true);
    try {
      await Promise.all(
        newIds.map((id, idx) =>
          reorderMutation.mutateAsync({ id, updates: { sortOrder: idx } }),
        ),
      );
    } catch (e: any) {
      toast({ title: "Reorder failed", description: e?.message, variant: "destructive" });
      // Roll back optimistic update
      setLocalIds(sortedRows.map((r) => r.id));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-5" data-testid="section-transformations-media">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-bold text-lg flex items-center gap-2">
            <Sparkles size={17} className="text-primary" /> Transformations Gallery
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Before/after photo pairs displayed on the public transformations page. Drag to reorder.
          </p>
        </div>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            data-testid="button-add-transformation"
            className="inline-flex items-center gap-2 px-5 h-10 rounded-xl bg-primary/15 hover:bg-primary/25 border border-primary/30 hover:border-primary/50 text-primary text-sm font-semibold transition-all duration-200 hover:shadow-[0_0_20px_-6px_hsl(183_100%_60%/0.5)]"
          >
            <Plus size={15} /> Add Transformation
          </button>
        )}
      </div>

      {adding && (
        <TransformationCard
          mode="create"
          onCancel={() => setAdding(false)}
          onSave={async (payload) => {
            await createMutation.mutateAsync(payload);
            setAdding(false);
          }}
          saving={createMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> Loading transformations…
        </div>
      ) : rows.length === 0 && !adding ? (
        <p
          className="text-sm text-muted-foreground py-8 text-center border border-dashed border-white/10 rounded-xl"
          data-testid="text-no-transformations-media"
        >
          No transformations yet. Add your first before/after pair.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={localIds} strategy={verticalListSortingStrategy}>
            <div className="space-y-4">
              {rows.map((row) => (
                <SortableTransformationRow
                  key={row.id}
                  row={row}
                  isSaving={isSaving}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

// ─── URL ↔ section sync helpers ───────────────────────────────────────────────
const VALID_SECTIONS: Section[] = ["hero", "services", "branding", "profile", "transformations"];

function getSectionFromUrl(): Section {
  const param = new URLSearchParams(window.location.search).get("section");
  return VALID_SECTIONS.includes(param as Section) ? (param as Section) : "hero";
}

// ─── Main page ────────────────────────────────────────────────────────────────
export default function AdminMedia() {
  const [activeSection, setActiveSection] = useState<Section>(getSectionFromUrl);

  useEffect(() => {
    function onPopState() {
      setActiveSection(getSectionFromUrl());
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  function navigate(section: Section) {
    setActiveSection(section);
    window.history.pushState(null, "", `/admin/media?section=${section}`);
  }
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
    <div className="space-y-5 pb-28" data-testid="page-admin-media">
      <div className="pt-1">
        <h1 className="font-display font-bold text-2xl tracking-tight">Media Manager</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          WYSIWYG: every preview uses the exact same rendering engine as the live site. What you see here is what clients see.
        </p>
      </div>

      {/* Security notice */}
      <div className="flex items-start gap-3 p-3.5 bg-primary/5 border border-primary/15 rounded-xl">
        <RefreshCw size={13} className="mt-0.5 shrink-0 text-primary/60" />
        <p className="text-[11px] text-primary/70">
          All uploads are server-validated (magic bytes, MIME type, 25 MB limit). Images are automatically
          optimised and generated at three resolutions. Only admins can upload or modify media.
        </p>
      </div>

      {/* Main layout: sidebar on desktop, scrollable pills on mobile */}
      <div className="flex flex-col md:flex-row gap-6">

        {/* Mobile: horizontally scrollable pill row */}
        <div className="md:hidden overflow-x-auto -mx-4 px-4 pb-1 pt-0.5">
          <div className="flex gap-2 w-max">
            {SECTIONS.map(({ key, label, icon }) => (
              <button
                key={key}
                type="button"
                onClick={() => navigate(key)}
                data-testid={`tab-section-${key}`}
                className={`flex items-center gap-1.5 px-4 h-10 rounded-2xl text-sm font-semibold border transition-all duration-200 whitespace-nowrap ${
                  activeSection === key
                    ? "bg-primary/15 text-primary border-primary/35 shadow-[0_0_18px_-6px_hsl(183_100%_60%/0.4)]"
                    : "bg-white/[0.03] text-muted-foreground border-white/8 hover:bg-white/6 hover:border-white/15 hover:text-foreground"
                }`}
              >
                {icon}
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Desktop: sidebar nav */}
        <nav className="hidden md:flex flex-col gap-1 w-44 shrink-0 pt-0.5">
          {SECTIONS.map(({ key, label, icon }) => (
            <button
              key={key}
              type="button"
              onClick={() => navigate(key)}
              data-testid={`tab-section-${key}`}
              className={`flex items-center gap-2.5 px-3.5 h-10 rounded-xl text-sm font-semibold transition-all duration-200 text-left w-full ${
                activeSection === key
                  ? "bg-primary/15 text-primary border border-primary/30 shadow-[0_0_14px_-5px_hsl(183_100%_60%/0.35)]"
                  : "border border-transparent text-muted-foreground hover:bg-white/[0.05] hover:border-white/10 hover:text-foreground"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </nav>

        {/* Section content */}
        <div className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSection}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18 }}
            >
              {activeSection === "hero"            && <HeroSection images={data.heroImages} />}
              {activeSection === "services"        && <ServicesSection settings={data.settings} />}
              {activeSection === "branding"        && <BrandingSection />}
              {activeSection === "profile"         && <ProfileSection settings={data.settings} />}
              {activeSection === "transformations" && <TransformationsMediaSection />}
            </motion.div>
          </AnimatePresence>
        </div>

      </div>
    </div>
  );
}
