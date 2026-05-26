/**
 * MobileImageEditor — Fullscreen touch-first image editor
 *
 * Design: Instagram / iOS Photos crop editor feel.
 * Works on all screen sizes; optimised for phone touch.
 *
 * Gesture support on preview:
 *   • 1-finger drag  — pan focal point
 *   • 2-finger pinch — zoom in / out
 *   • Double-tap     — reset current tab to original values
 *
 * WYSIWYG contract (same as ImageRenderer.tsx):
 *   Hero desktop: translate(focalX × scale, focalY × scale) scale(zoom) rotate(rotate)
 *   Hero mobile: objectPosition posX% posY%, scale(zoom)
 *   Service:     objectFit / objectPosition posX% posY%, scale(zoom), transformOrigin posX% posY%
 */

import { useState, useRef, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X, RotateCcw, Monitor, Smartphone, ScanLine } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { CropGuideOverlay } from "@/components/ImageRenderer";

// ─── Reference dimensions (must match ImageRenderer + HeroSlider) ─────────────
const HERO_REF_W = 1440;
const HERO_REF_H = 810;

// ─── Types ────────────────────────────────────────────────────────────────────
export type HeroDesktopSettings = {
  focalX: number;
  focalY: number;
  zoom: number;
  rotate: number;
  brightness: number;
  contrast: number;
  overlayOpacity: number;
};
export type HeroMobileSettings = {
  positionX: number;
  positionY: number;
  zoom: number;
};
export type ServiceSettings = {
  fit: string;
  positionX: number;
  positionY: number;
  zoom: number;
};

export type HeroEditorConfig = {
  type: "hero";
  imageUrl: string;
  label: string;
  initialDesktop: HeroDesktopSettings;
  initialMobile: HeroMobileSettings;
};
export type ServiceEditorConfig = {
  type: "service";
  imageUrl: string;
  label: string;
  initialDesktop: ServiceSettings;
  initialMobile: ServiceSettings;
};
export type EditorConfig = HeroEditorConfig | ServiceEditorConfig;

export type EditorSavePayload = {
  desktop: Record<string, unknown>;
  mobile: Record<string, unknown>;
};

// ─── Presets ──────────────────────────────────────────────────────────────────
const HERO_DESKTOP_PRESETS = [
  { label: "Center",  focalX: 0,    focalY: 0    },
  { label: "Top",     focalX: 0,    focalY: -120 },
  { label: "Bottom",  focalX: 0,    focalY: 120  },
  { label: "Left",    focalX: -150, focalY: 0    },
  { label: "Right",   focalX: 150,  focalY: 0    },
  { label: "Subject", focalX: 0,    focalY: -60  },
  { label: "Wide",    focalX: 0,    focalY: 50   },
];
const PERCENT_PRESETS = [
  { label: "Center",  positionX: 50, positionY: 50 },
  { label: "Top",     positionX: 50, positionY: 10 },
  { label: "Bottom",  positionX: 50, positionY: 90 },
  { label: "Left",    positionX: 10, positionY: 50 },
  { label: "Right",   positionX: 90, positionY: 50 },
  { label: "Subject", positionX: 50, positionY: 35 },
  { label: "Logo",    positionX: 50, positionY: 15 },
];

// ─── Local slider row (larger touch target than AdminMedia's) ─────────────────
function MobileSlider({
  label, value, min, max, step = 0.01, unit = "", onChange,
}: {
  label: string; value: number; min: number; max: number;
  step?: number; unit?: string; onChange: (v: number) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-foreground">{label}</span>
        <span
          className="text-sm font-mono tabular-nums text-primary bg-primary/10 border border-primary/20 px-3 py-1 rounded-xl min-w-[68px] text-center"
        >
          {Number.isInteger(value) ? value : value.toFixed(2)}{unit}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
        className="w-full"
      />
    </div>
  );
}

// ─── Preview renderer ─────────────────────────────────────────────────────────
// Self-contained image renderer for the fullscreen editor.
// Avoids depending on HeroImageFrame's aspectRatio so we can fill h-full.
// MUST match: HeroSlideLayer for hero desktop, service card for service.
function EditorPreview({
  config,
  tab,
  heroD,
  heroM,
  svcD,
  svcM,
  showGuide,
  previewRef,
  scaleRef,
}: {
  config: EditorConfig;
  tab: "desktop" | "mobile";
  heroD: HeroDesktopSettings;
  heroM: HeroMobileSettings;
  svcD: ServiceSettings;
  svcM: ServiceSettings;
  showGuide: boolean;
  previewRef: React.RefObject<HTMLDivElement | null>;
  scaleRef: React.MutableRefObject<number>;
}) {
  const [containerW, setContainerW] = useState(390);

  useEffect(() => {
    const el = previewRef.current;
    if (!el) return;
    const update = () => {
      const w = el.offsetWidth || 390;
      setContainerW(w);
      scaleRef.current = w / HERO_REF_W;
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [previewRef, scaleRef]);

  const scale = containerW / HERO_REF_W;

  let imgStyle: React.CSSProperties = {};
  let wrapperChildren: React.ReactNode = null;

  if (config.type === "hero" && tab === "desktop") {
    // EXACT match of HeroSlideLayer desktop rendering, scaled to preview
    imgStyle = {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      // focalX/Y are in 1440px reference space; multiply by scale to preview space
      transform: `translate(${heroD.focalX * scale}px, ${heroD.focalY * scale}px) scale(${heroD.zoom}) rotate(${heroD.rotate}deg) translateZ(0)`,
      transformOrigin: "center",
      filter: `brightness(${(1.05 * heroD.brightness).toFixed(3)}) contrast(${(1.08 * heroD.contrast).toFixed(3)}) saturate(1.05)`,
      userSelect: "none",
      WebkitUserDrag: "none",
    } as React.CSSProperties;
    wrapperChildren = (
      <>
        <img src={config.imageUrl} alt="" draggable={false} style={imgStyle} />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to top, rgba(0,0,0,${(heroD.overlayOpacity / 100).toFixed(3)}) 0%, transparent 55%)`,
            pointerEvents: "none",
          }}
        />
      </>
    );
  } else if (config.type === "hero" && tab === "mobile") {
    // Hero mobile: percentage-based rendering (aspirational future mobile slider)
    imgStyle = {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: "cover",
      objectPosition: `${heroM.positionX}% ${heroM.positionY}%`,
      transform: heroM.zoom !== 1 ? `scale(${heroM.zoom})` : undefined,
      transformOrigin: `${heroM.positionX}% ${heroM.positionY}%`,
      userSelect: "none",
      WebkitUserDrag: "none",
    } as React.CSSProperties;
    wrapperChildren = (
      <>
        <img src={config.imageUrl} alt="" draggable={false} style={imgStyle} />
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            fontSize: 9,
            fontWeight: 700,
            background: "rgba(245,158,11,0.2)",
            color: "#f59e0b",
            border: "1px solid rgba(245,158,11,0.35)",
            padding: "2px 6px",
            borderRadius: 6,
            pointerEvents: "none",
          }}
        >
          Mobile preview (future)
        </div>
      </>
    );
  } else {
    // Service: EXACT match of HomePage service card rendering
    const s = tab === "desktop" ? svcD : svcM;
    imgStyle = {
      position: "absolute",
      inset: 0,
      width: "100%",
      height: "100%",
      objectFit: s.fit as React.CSSProperties["objectFit"],
      objectPosition: `${s.positionX}% ${s.positionY}%`,
      transform: s.zoom !== 1 ? `scale(${s.zoom})` : undefined,
      // CRITICAL: transformOrigin must be the focal point, not center
      transformOrigin: `${s.positionX}% ${s.positionY}%`,
      userSelect: "none",
      WebkitUserDrag: "none",
    } as React.CSSProperties;
    wrapperChildren = <img src={config.imageUrl} alt="" draggable={false} style={imgStyle} />;
  }

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      {wrapperChildren}
      <CropGuideOverlay show={showGuide} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export function MobileImageEditor({
  open,
  onClose,
  config,
  onSave,
  saving = false,
}: {
  open: boolean;
  onClose: () => void;
  config: EditorConfig;
  onSave: (payload: EditorSavePayload) => void;
  saving?: boolean;
}) {
  const [tab, setTab] = useState<"desktop" | "mobile">("desktop");
  const [showGuide, setShowGuide] = useState(true);

  // State per image type
  const [heroD, setHeroD] = useState<HeroDesktopSettings>(
    config.type === "hero" ? { ...config.initialDesktop } : { focalX: 0, focalY: 0, zoom: 1, rotate: 0, brightness: 1, contrast: 1, overlayOpacity: 35 },
  );
  const [heroM, setHeroM] = useState<HeroMobileSettings>(
    config.type === "hero" ? { ...config.initialMobile } : { positionX: 50, positionY: 50, zoom: 1 },
  );
  const [svcD, setSvcD] = useState<ServiceSettings>(
    config.type === "service" ? { ...config.initialDesktop } : { fit: "cover", positionX: 50, positionY: 50, zoom: 1 },
  );
  const [svcM, setSvcM] = useState<ServiceSettings>(
    config.type === "service" ? { ...config.initialMobile } : { fit: "cover", positionX: 50, positionY: 50, zoom: 1 },
  );

  // Re-initialise when the edited image changes
  useEffect(() => {
    if (config.type === "hero") {
      setHeroD({ ...config.initialDesktop });
      setHeroM({ ...config.initialMobile });
    } else {
      setSvcD({ ...config.initialDesktop });
      setSvcM({ ...config.initialMobile });
    }
    setTab("desktop");
  }, [config.imageUrl]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Touch / pointer gesture tracking ────────────────────────────────────────
  const previewRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<number>(1); // updated by EditorPreview via ResizeObserver
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());
  const prevDistRef = useRef<number | null>(null);
  const lastTapRef = useRef<number>(0);

  const resetCurrentTab = useCallback(() => {
    if (config.type === "hero") {
      if (tab === "desktop") setHeroD({ ...config.initialDesktop });
      else setHeroM({ ...config.initialMobile });
    } else {
      if (tab === "desktop") setSvcD({ ...config.initialDesktop });
      else setSvcM({ ...config.initialMobile });
    }
  }, [config, tab]);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    prevDistRef.current = null;

    // Double-tap detection
    const now = Date.now();
    if (now - lastTapRef.current < 280 && pointersRef.current.size === 1) {
      resetCurrentTab();
    }
    lastTapRef.current = now;
  }, [resetCurrentTab]);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const prev = pointersRef.current.get(e.pointerId);
    if (!prev) return;

    const dx = e.clientX - prev.x;
    const dy = e.clientY - prev.y;
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });

    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;

    if (pointersRef.current.size === 1) {
      // ── Single finger: pan ──────────────────────────────────────────────────
      if (config.type === "hero") {
        if (tab === "desktop") {
          // Convert preview-px delta → reference-space px
          const s = scaleRef.current || 1;
          setHeroD((p) => ({
            ...p,
            focalX: Math.round(Math.max(-200, Math.min(200, p.focalX + dx / s))),
            focalY: Math.round(Math.max(-200, Math.min(200, p.focalY + dy / s))),
          }));
        } else {
          // Mobile: percentage-based pan (drag right = see more left = posX ↓)
          setHeroM((p) => ({
            ...p,
            positionX: Math.round(Math.max(0, Math.min(100, p.positionX - (dx / rect.width) * 100))),
            positionY: Math.round(Math.max(0, Math.min(100, p.positionY - (dy / rect.height) * 100))),
          }));
        }
      } else {
        // Service: percentage-based pan
        const update = (p: ServiceSettings): ServiceSettings => ({
          ...p,
          positionX: Math.round(Math.max(0, Math.min(100, p.positionX - (dx / rect.width) * 100))),
          positionY: Math.round(Math.max(0, Math.min(100, p.positionY - (dy / rect.height) * 100))),
        });
        if (tab === "desktop") setSvcD(update);
        else setSvcM(update);
      }
    } else if (pointersRef.current.size === 2) {
      // ── Two fingers: pinch to zoom ──────────────────────────────────────────
      const pts = Array.from(pointersRef.current.values());
      if (pts.length < 2) return;
      const newDist = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
      const prevDist = prevDistRef.current;
      prevDistRef.current = newDist;
      if (!prevDist || prevDist === 0) return;
      const ratio = newDist / prevDist;

      if (config.type === "hero") {
        if (tab === "desktop") {
          setHeroD((p) => ({ ...p, zoom: Math.max(0.8, Math.min(2.0, p.zoom * ratio)) }));
        } else {
          setHeroM((p) => ({ ...p, zoom: Math.max(0.5, Math.min(3, p.zoom * ratio)) }));
        }
      } else {
        const update = (p: ServiceSettings): ServiceSettings => ({
          ...p,
          zoom: Math.max(0.5, Math.min(3, p.zoom * ratio)),
        });
        if (tab === "desktop") setSvcD(update);
        else setSvcM(update);
      }
    }
  }, [config.type, tab]);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    pointersRef.current.delete(e.pointerId);
    if (pointersRef.current.size < 2) prevDistRef.current = null;
  }, []);

  // ── Apply preset ─────────────────────────────────────────────────────────────
  const applyPreset = (preset: Record<string, number>) => {
    if (config.type === "hero") {
      if (tab === "desktop") setHeroD((p) => ({ ...p, ...preset }));
      else setHeroM((p) => ({ ...p, ...preset }));
    } else {
      const apply = (p: ServiceSettings): ServiceSettings => ({ ...p, ...preset });
      if (tab === "desktop") setSvcD(apply);
      else setSvcM(apply);
    }
  };

  const presets =
    config.type === "hero" && tab === "desktop" ? HERO_DESKTOP_PRESETS : PERCENT_PRESETS;

  // ── Save ─────────────────────────────────────────────────────────────────────
  const handleSave = () => {
    if (config.type === "hero") {
      onSave({ desktop: heroD as unknown as Record<string, unknown>, mobile: heroM as unknown as Record<string, unknown> });
    } else {
      onSave({ desktop: svcD as unknown as Record<string, unknown>, mobile: svcM as unknown as Record<string, unknown> });
    }
  };

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: "100%" }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: "100%" }}
          transition={{ type: "spring", damping: 28, stiffness: 280, mass: 0.85 }}
          className="fixed inset-0 flex flex-col overflow-hidden"
          style={{ zIndex: 9998, background: "#050505" }}
        >
          {/* ── Header ── */}
          <div className="shrink-0 flex items-center justify-between px-4 border-b border-white/[0.07]" style={{ minHeight: 56 }}>
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold">Image Editor</p>
              <p className="text-sm font-bold font-display truncate">{config.label}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              data-testid="button-editor-close"
              className="ml-3 shrink-0 w-11 h-11 rounded-full bg-white/8 hover:bg-white/14 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* ── Preview area ── */}
          <div
            ref={previewRef}
            className="shrink-0 relative touch-none select-none"
            style={{ width: "100%", aspectRatio: "16/9", maxHeight: "60vh" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerLeave={onPointerUp}
          >
            <EditorPreview
              config={config}
              tab={tab}
              heroD={heroD}
              heroM={heroM}
              svcD={svcD}
              svcM={svcM}
              showGuide={showGuide}
              previewRef={previewRef}
              scaleRef={scaleRef}
            />

            {/* Gesture hint */}
            <div
              className="absolute bottom-2.5 left-0 right-0 flex justify-center pointer-events-none"
            >
              <span
                className="text-[10px] font-semibold px-3 py-1.5 rounded-full border"
                style={{
                  background: "rgba(0,0,0,0.65)",
                  color: "hsl(183 100% 74% / 0.8)",
                  border: "1px solid hsl(183 100% 74% / 0.18)",
                  backdropFilter: "blur(8px)",
                }}
              >
                ↕↔ drag to pan · pinch to zoom · double-tap to reset
              </span>
            </div>
          </div>

          {/* ── Tab bar + Guide toggle ── */}
          <div
            className="shrink-0 flex items-center justify-between gap-3 px-4 py-2.5 border-y border-white/[0.07]"
            style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(12px)" }}
          >
            <div className="flex gap-2">
              {(["desktop", "mobile"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTab(t)}
                  data-testid={`button-editor-tab-${t}`}
                  className={`flex items-center gap-2 px-4 rounded-xl font-semibold text-sm transition-all duration-200 ${
                    tab === t
                      ? "bg-primary/20 text-primary border border-primary/35 shadow-[0_0_14px_-4px_hsl(183_100%_60%/0.4)]"
                      : "bg-white/6 border border-white/12 text-muted-foreground hover:bg-white/10 hover:text-foreground"
                  }`}
                  style={{ minHeight: 44 }}
                >
                  {t === "desktop" ? <Monitor size={14} /> : <Smartphone size={14} />}
                  {t === "desktop" ? "Desktop" : "Mobile"}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setShowGuide((g) => !g)}
              data-testid="button-editor-guide"
              className={`flex items-center gap-1.5 px-4 rounded-xl font-semibold text-sm border transition-all duration-200 ${
                showGuide
                  ? "bg-primary/20 text-primary border-primary/35"
                  : "bg-white/6 border-white/12 text-muted-foreground hover:bg-white/10"
              }`}
              style={{ minHeight: 44 }}
            >
              <ScanLine size={14} />
              Guide
            </button>
          </div>

          {/* ── Scrollable control sheet ── */}
          <div
            className="flex-1 overflow-y-auto overscroll-contain"
            style={{ WebkitOverflowScrolling: "touch" } as React.CSSProperties}
          >
            <div className="px-4 pt-5 pb-4 space-y-6">

              {/* Preset buttons */}
              <div className="space-y-2.5">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest">
                  Quick presets
                </p>
                <div className="flex gap-2.5 overflow-x-auto pb-1 -mx-1 px-1" style={{ scrollbarWidth: "none" }}>
                  {presets.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => applyPreset(preset as unknown as Record<string, number>)}
                      data-testid={`button-preset-${preset.label.toLowerCase()}`}
                      className="shrink-0 bg-white/6 hover:bg-white/12 border border-white/12 hover:border-primary/25 text-muted-foreground hover:text-foreground text-sm font-semibold rounded-2xl transition-all duration-200 whitespace-nowrap"
                      style={{ height: 48, padding: "0 18px" }}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fine-tune sliders */}
              <div className="space-y-5">
                <p className="text-[11px] text-muted-foreground font-semibold uppercase tracking-widest">
                  Fine tune
                </p>

                {config.type === "hero" ? (
                  tab === "desktop" ? (
                    <>
                      <MobileSlider label="Focal X" value={heroD.focalX} min={-200} max={200} step={1} unit="px" onChange={(v) => setHeroD((p) => ({ ...p, focalX: v }))} />
                      <MobileSlider label="Focal Y" value={heroD.focalY} min={-200} max={200} step={1} unit="px" onChange={(v) => setHeroD((p) => ({ ...p, focalY: v }))} />
                      <MobileSlider label="Zoom" value={heroD.zoom} min={0.8} max={2.0} step={0.01} onChange={(v) => setHeroD((p) => ({ ...p, zoom: v }))} />
                      <MobileSlider label="Rotate" value={heroD.rotate} min={-10} max={10} step={0.5} unit="°" onChange={(v) => setHeroD((p) => ({ ...p, rotate: v }))} />
                      <MobileSlider label="Brightness" value={heroD.brightness} min={0.9} max={1.2} step={0.01} onChange={(v) => setHeroD((p) => ({ ...p, brightness: v }))} />
                      <MobileSlider label="Contrast" value={heroD.contrast} min={0.95} max={1.2} step={0.01} onChange={(v) => setHeroD((p) => ({ ...p, contrast: v }))} />
                      <MobileSlider label="Overlay" value={heroD.overlayOpacity} min={0} max={60} step={1} unit="%" onChange={(v) => setHeroD((p) => ({ ...p, overlayOpacity: v }))} />
                    </>
                  ) : (
                    <>
                      <MobileSlider label="Position X" value={heroM.positionX} min={0} max={100} step={1} unit="%" onChange={(v) => setHeroM((p) => ({ ...p, positionX: v }))} />
                      <MobileSlider label="Position Y" value={heroM.positionY} min={0} max={100} step={1} unit="%" onChange={(v) => setHeroM((p) => ({ ...p, positionY: v }))} />
                      <MobileSlider label="Zoom" value={heroM.zoom} min={0.5} max={3} step={0.01} onChange={(v) => setHeroM((p) => ({ ...p, zoom: v }))} />
                    </>
                  )
                ) : (
                  tab === "desktop" ? (
                    <>
                      <MobileSlider label="Position X" value={svcD.positionX} min={0} max={100} step={1} unit="%" onChange={(v) => setSvcD((p) => ({ ...p, positionX: v }))} />
                      <MobileSlider label="Position Y" value={svcD.positionY} min={0} max={100} step={1} unit="%" onChange={(v) => setSvcD((p) => ({ ...p, positionY: v }))} />
                      <MobileSlider label="Zoom" value={svcD.zoom} min={0.5} max={3} step={0.01} onChange={(v) => setSvcD((p) => ({ ...p, zoom: v }))} />
                    </>
                  ) : (
                    <>
                      <MobileSlider label="Position X" value={svcM.positionX} min={0} max={100} step={1} unit="%" onChange={(v) => setSvcM((p) => ({ ...p, positionX: v }))} />
                      <MobileSlider label="Position Y" value={svcM.positionY} min={0} max={100} step={1} unit="%" onChange={(v) => setSvcM((p) => ({ ...p, positionY: v }))} />
                      <MobileSlider label="Zoom" value={svcM.zoom} min={0.5} max={3} step={0.01} onChange={(v) => setSvcM((p) => ({ ...p, zoom: v }))} />
                    </>
                  )
                )}
              </div>

              {/* Reset */}
              <button
                type="button"
                onClick={resetCurrentTab}
                data-testid="button-editor-reset"
                className="w-full bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/18 text-muted-foreground hover:text-foreground text-sm font-semibold rounded-2xl flex items-center justify-center gap-2.5 transition-all duration-200"
                style={{ height: 52 }}
              >
                <RotateCcw size={15} />
                Reset {tab} to original
              </button>
            </div>
          </div>

          {/* ── Sticky save bar ── */}
          <div
            className="shrink-0 border-t border-white/[0.07] flex gap-3 px-4 py-3"
            style={{ background: "rgba(5,5,5,0.85)", backdropFilter: "blur(20px)" }}
          >
            <button
              type="button"
              onClick={onClose}
              data-testid="button-editor-cancel"
              className="flex-1 bg-white/8 hover:bg-white/14 border border-white/12 hover:border-white/22 text-muted-foreground hover:text-foreground text-sm font-bold rounded-2xl transition-all duration-200"
              style={{ height: 56 }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              data-testid="button-editor-save"
              className="flex-[2] bg-primary/18 hover:bg-primary/28 border border-primary/40 hover:border-primary/60 text-primary text-sm font-bold rounded-2xl transition-all duration-200 disabled:opacity-50 hover:shadow-[0_0_28px_-6px_hsl(183_100%_60%/0.5)]"
              style={{ height: 56 }}
            >
              {saving ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
