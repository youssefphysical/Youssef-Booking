/**
 * WYSIWYG Image Rendering Engine
 *
 * All rendering formulas in this file must match the production renderers exactly:
 *   - HeroImageFrame  → matches HeroSlideLayer in HeroSlider.tsx
 *   - ServiceImageFrame → matches the service card img in HomePage.tsx
 *
 * Used by:
 *   - AdminMedia.tsx  (admin preview — what Youssef sees)
 *   - (future) HeroSlider.tsx can import HeroSlideCore once ready
 *
 * WYSIWYG contract:
 *   admin preview === client view
 *   No separate crop logic. One source of truth.
 */

import { useRef, useState, useEffect, useCallback } from "react";
import { Image as ImageIcon } from "lucide-react";

// ─── Reference dimensions ─────────────────────────────────────────────────────
// Hero focalX / focalY are absolute pixel offsets on a 1440 × 810 (16:9)
// reference viewport. The production slider renders on exactly this canvas
// on a 1440px laptop. Smaller viewports see a proportional crop.
const HERO_REF_W = 1440;
const HERO_REF_H = 810;

// ─── Content type meta ────────────────────────────────────────────────────────
const CONTENT_TYPE_LABELS: Record<string, { label: string; color: string }> = {
  person:      { label: "Person",      color: "hsl(183 100% 74%)" },
  nutrition:   { label: "Food",        color: "#7dd87d" },
  supplement:  { label: "Supplement",  color: "#f59e5a" },
  logo:        { label: "Logo",        color: "#c084fc" },
  auto:        { label: "Auto",        color: "rgba(255,255,255,0.55)" },
};

// ─── Crop guide overlay ───────────────────────────────────────────────────────
export function CropGuideOverlay({
  show,
  contentType,
  showMobileZone = false,
}: {
  show: boolean;
  contentType?: string;
  showMobileZone?: boolean;
}) {
  if (!show) return null;

  const ctMeta = contentType ? CONTENT_TYPE_LABELS[contentType] : null;
  const isLogo = contentType === "logo";

  return (
    <div
      className="absolute inset-0 pointer-events-none select-none"
      style={{ zIndex: 20 }}
      aria-hidden="true"
    >
      {/* Rule of thirds — vertical lines */}
      <div
        className="absolute inset-y-0"
        style={{ left: "33.33%", width: 1, background: "rgba(94,231,255,0.28)" }}
      />
      <div
        className="absolute inset-y-0"
        style={{ left: "66.67%", width: 1, background: "rgba(94,231,255,0.28)" }}
      />
      {/* Rule of thirds — horizontal lines */}
      <div
        className="absolute inset-x-0"
        style={{ top: "33.33%", height: 1, background: "rgba(94,231,255,0.28)" }}
      />
      <div
        className="absolute inset-x-0"
        style={{ top: "66.67%", height: 1, background: "rgba(94,231,255,0.28)" }}
      />
      {/* Power-point intersection dots */}
      {([33.33, 66.67] as const).flatMap((x) =>
        ([33.33, 66.67] as const).map((y) => (
          <div
            key={`${x}-${y}`}
            style={{
              position: "absolute",
              left: `calc(${x}% - 3px)`,
              top: `calc(${y}% - 3px)`,
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "hsl(183 100% 74% / 0.85)",
              boxShadow: "0 0 5px hsl(183 100% 74% / 0.6)",
            }}
          />
        )),
      )}

      {/* Safe zone — 10% inset on every side (desktop frame safe area) */}
      <div
        style={{
          position: "absolute",
          inset: "10%",
          border: "1.5px dashed rgba(94,231,255,0.5)",
          borderRadius: 4,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 4,
            left: 4,
            fontSize: 9,
            fontWeight: 700,
            color: "hsl(183 100% 74% / 0.75)",
            background: "rgba(0,0,0,0.6)",
            padding: "1px 5px",
            borderRadius: 3,
            letterSpacing: "0.06em",
            pointerEvents: "none",
          }}
        >
          SAFE ZONE
        </span>
      </div>

      {/* Mobile viewport crop indicator — visible on 390px mobile, 16:10 ratio clip */}
      {showMobileZone && (
        <div
          style={{
            position: "absolute",
            left: "12%",
            right: "12%",
            top: "5%",
            bottom: "5%",
            border: "1.5px dashed rgba(255,180,80,0.55)",
            borderRadius: 4,
          }}
        >
          <span
            style={{
              position: "absolute",
              bottom: 4,
              right: 4,
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(255,180,80,0.9)",
              background: "rgba(0,0,0,0.6)",
              padding: "1px 5px",
              borderRadius: 3,
              letterSpacing: "0.06em",
              pointerEvents: "none",
            }}
          >
            MOBILE CROP
          </span>
        </div>
      )}

      {/* Logo protection zone — centered 40% area, shown for logo content type */}
      {isLogo && (
        <div
          style={{
            position: "absolute",
            left: "30%",
            right: "30%",
            top: "30%",
            bottom: "30%",
            border: "1.5px dashed rgba(192,132,252,0.65)",
            borderRadius: 4,
          }}
        >
          <span
            style={{
              position: "absolute",
              top: 4,
              left: "50%",
              transform: "translateX(-50%)",
              fontSize: 9,
              fontWeight: 700,
              color: "rgba(192,132,252,0.9)",
              background: "rgba(0,0,0,0.6)",
              padding: "1px 5px",
              borderRadius: 3,
              letterSpacing: "0.06em",
              pointerEvents: "none",
              whiteSpace: "nowrap",
            }}
          >
            LOGO ZONE
          </span>
        </div>
      )}

      {/* Center crosshair */}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transform: "translate(-50%,-50%)",
          opacity: 0.45,
          pointerEvents: "none",
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <line x1="9" y1="0" x2="9" y2="18" stroke="hsl(183 100% 74%)" strokeWidth="1" />
          <line x1="0" y1="9" x2="18" y2="9" stroke="hsl(183 100% 74%)" strokeWidth="1" />
          <circle cx="9" cy="9" r="3" stroke="hsl(183 100% 74%)" strokeWidth="1" />
        </svg>
      </div>

      {/* Content type badge — top-right corner */}
      {ctMeta && (
        <div
          style={{
            position: "absolute",
            top: 6,
            right: 6,
            fontSize: 9,
            fontWeight: 700,
            color: ctMeta.color,
            background: "rgba(0,0,0,0.7)",
            border: `1px solid ${ctMeta.color}55`,
            padding: "2px 6px",
            borderRadius: 4,
            letterSpacing: "0.08em",
            pointerEvents: "none",
            textTransform: "uppercase",
          }}
        >
          {ctMeta.label}
        </div>
      )}
    </div>
  );
}

// ─── Hero Image Frame ─────────────────────────────────────────────────────────
/**
 * Renders a hero image using the EXACT same transform formula as HeroSlideLayer:
 *   transform: translate(focalX px, focalY px) scale(zoom) rotate(rotate deg) translateZ(0)
 *   transformOrigin: center
 *   objectFit: cover
 *   filter: brightness(1.05 × b) contrast(1.08 × c) saturate(1.05)
 *
 * WYSIWYG trick: the image renders inside a 1440 × 810 px inner container that
 * is CSS-scaled to fill the preview box. Because focalX/Y are pixel offsets on
 * that 1440 px canvas, the visual composition is identical to the real slider.
 *
 * Drag interaction: dragging updates focalX / focalY in reference-space pixels.
 */
export function HeroImageFrame({
  src,
  focalX = 0,
  focalY = 0,
  zoom = 1,
  rotate = 0,
  brightness = 1,
  contrast = 1,
  overlayOpacity = 35,
  showGuide = false,
  onFocalChange,
  className = "",
}: {
  src?: string | null;
  focalX?: number;
  focalY?: number;
  zoom?: number;
  rotate?: number;
  brightness?: number;
  contrast?: number;
  overlayOpacity?: number;
  showGuide?: boolean;
  /** Called with updated (focalX, focalY) while the user drags */
  onFocalChange?: (fx: number, fy: number) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerW, setContainerW] = useState(352);
  const dragRef = useRef<{
    startX: number;
    startY: number;
    startFX: number;
    startFY: number;
  } | null>(null);

  // Measure preview container width so we can compute the CSS scale factor.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerW(el.offsetWidth || 352);
    const ro = new ResizeObserver(() => {
      setContainerW(el.offsetWidth || 352);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // scale: maps reference pixels → preview pixels
  const scale = containerW / HERO_REF_W;

  // ── Drag handlers ────────────────────────────────────────────────────────
  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onFocalChange) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startFX: focalX,
        startFY: focalY,
      };
    },
    [onFocalChange, focalX, focalY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragRef.current || !onFocalChange) return;
      const liveScale =
        containerRef.current
          ? containerRef.current.getBoundingClientRect().width / HERO_REF_W
          : scale;
      const dfx = (e.clientX - dragRef.current.startX) / liveScale;
      const dfy = (e.clientY - dragRef.current.startY) / liveScale;
      onFocalChange(
        Math.round(Math.max(-200, Math.min(200, dragRef.current.startFX + dfx))),
        Math.round(Math.max(-200, Math.min(200, dragRef.current.startFY + dfy))),
      );
    },
    [onFocalChange, scale],
  );

  const onPointerUp = useCallback(() => {
    dragRef.current = null;
  }, []);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!src) {
    return (
      <div
        className={`relative bg-black/40 flex flex-col items-center justify-center gap-2 ${className}`}
        style={{ aspectRatio: "16/9" }}
      >
        <ImageIcon size={22} className="text-muted-foreground/25" />
        <p className="text-[10px] text-muted-foreground/35">No image</p>
      </div>
    );
  }

  // ── Rendered frame ───────────────────────────────────────────────────────
  // image transform — MUST match HeroSlideLayer line-for-line
  const imgStyle: React.CSSProperties = {
    position: "absolute",
    inset: 0,
    width: "100%",
    height: "100%",
    objectFit: "cover",
    transform: `translate(${focalX}px, ${focalY}px) scale(${zoom}) rotate(${rotate}deg) translateZ(0)`,
    transformOrigin: "center",
    filter: `brightness(${(1.05 * brightness).toFixed(3)}) contrast(${(1.08 * contrast).toFixed(3)}) saturate(1.05)`,
    userSelect: "none",
    WebkitUserDrag: "none",
  } as React.CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden select-none ${className}`}
      style={{
        width: "100%",
        aspectRatio: "16/9",
        cursor: onFocalChange ? "crosshair" : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      {/*
       * Inner reference canvas: 1440 × 810 px, CSS-scaled to the preview size.
       * The image's translate(focalX, focalY) operates in the 1440 px space,
       * which is identical to the production viewport — giving perfect WYSIWYG.
       */}
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: HERO_REF_W,
          height: HERO_REF_H,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
          overflow: "hidden",
        }}
      >
        <img src={src} alt="" draggable={false} style={imgStyle} />
        {/* Overlay gradient — matches production HeroSlideLayer */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(to top, rgba(0,0,0,${(overlayOpacity / 100).toFixed(3)}) 0%, transparent 55%)`,
            pointerEvents: "none",
          }}
        />
      </div>

      <CropGuideOverlay show={showGuide} />

      {onFocalChange && (
        <div
          style={{
            position: "absolute",
            bottom: 6,
            left: 6,
            fontSize: 9,
            fontWeight: 600,
            color: "hsl(183 100% 74% / 0.8)",
            background: "rgba(0,0,0,0.65)",
            padding: "2px 6px",
            borderRadius: 4,
            pointerEvents: "none",
            userSelect: "none",
          }}
        >
          ↕↔ drag to set focal point
        </div>
      )}
    </div>
  );
}

// ─── Service Image Frame ──────────────────────────────────────────────────────
/**
 * Renders a service card image using the EXACT same formula as HomePage.tsx:
 *   objectFit: fit
 *   objectPosition: `${posX}% ${posY}%`
 *   transform: scale(zoom)              (only when zoom ≠ 1)
 *   transformOrigin: `${posX}% ${posY}%`   ← KEY: anchors zoom to focal point
 *
 * Bug that existed in the admin preview: transformOrigin was "center" instead
 * of `${posX}% ${posY}%`. This file fixes that so admin = client.
 *
 * Drag interaction: click or drag on the preview to set positionX / positionY.
 * The focal dot indicator follows the drag in real time.
 */
export function ServiceImageFrame({
  src,
  fit = "cover",
  positionX = 50,
  positionY = 50,
  zoom = 1,
  showGuide = false,
  contentType,
  showMobileZone = false,
  onPositionChange,
  className = "",
}: {
  src?: string | null;
  fit?: string;
  positionX?: number;
  positionY?: number;
  zoom?: number;
  showGuide?: boolean;
  contentType?: string;
  showMobileZone?: boolean;
  /** Called with updated (posX, posY) while the user drags */
  onPositionChange?: (posX: number, posY: number) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);

  const calcPos = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return null;
      return {
        x: Math.round(Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))),
        y: Math.round(Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))),
      };
    },
    [],
  );

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!onPositionChange) return;
      e.currentTarget.setPointerCapture(e.pointerId);
      isDragging.current = true;
      const pos = calcPos(e);
      if (pos) onPositionChange(pos.x, pos.y);
    },
    [onPositionChange, calcPos],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!isDragging.current || !onPositionChange) return;
      const pos = calcPos(e);
      if (pos) onPositionChange(pos.x, pos.y);
    },
    [onPositionChange, calcPos],
  );

  const onPointerUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // ── Empty state ──────────────────────────────────────────────────────────
  if (!src) {
    return (
      <div
        className={`svc-img-wrap relative bg-black/40 flex flex-col items-center justify-center gap-2 ${className}`}
      >
        <ImageIcon size={20} className="text-muted-foreground/25" />
        <p className="text-[10px] text-muted-foreground/35">No image uploaded</p>
      </div>
    );
  }

  // ── Image style — MUST match HomePage.tsx lines 840-843 ─────────────────
  const imgStyle: React.CSSProperties = {
    width: "100%",
    height: "100%",
    objectFit: fit as React.CSSProperties["objectFit"],
    objectPosition: `${positionX}% ${positionY}%`,
    transform: zoom !== 1 ? `scale(${zoom})` : undefined,
    // CRITICAL FIX: production uses posX/posY as the origin; "center" was wrong
    transformOrigin: `${positionX}% ${positionY}%`,
    display: "block",
    userSelect: "none",
    WebkitUserDrag: "none",
  } as React.CSSProperties;

  return (
    <div
      ref={containerRef}
      className={`svc-img-wrap relative overflow-hidden select-none ${className}`}
      style={{
        cursor: onPositionChange ? "crosshair" : "default",
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerUp}
    >
      <img src={src} alt="" draggable={false} style={imgStyle} />

      <CropGuideOverlay
        show={showGuide}
        contentType={contentType}
        showMobileZone={showMobileZone}
      />

      {onPositionChange && (
        <>
          {/* Focal dot — shows current position in the preview */}
          <div
            style={{
              position: "absolute",
              left: `calc(${positionX}% - 6px)`,
              top: `calc(${positionY}% - 6px)`,
              width: 12,
              height: 12,
              borderRadius: "50%",
              border: "2px solid hsl(183 100% 74%)",
              background: "rgba(0,0,0,0.4)",
              boxShadow: "0 0 8px hsl(183 100% 74% / 0.65)",
              pointerEvents: "none",
              transition: "left 40ms linear, top 40ms linear",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 6,
              left: 6,
              fontSize: 9,
              fontWeight: 600,
              color: "hsl(183 100% 74% / 0.8)",
              background: "rgba(0,0,0,0.65)",
              padding: "2px 6px",
              borderRadius: 4,
              pointerEvents: "none",
              userSelect: "none",
            }}
          >
            ↕↔ click or drag to set focal point
          </div>
        </>
      )}
    </div>
  );
}
