import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  ChevronsLeftRight,
  Quote,
  Target,
  Calendar,
  TrendingUp,
  ImageOff,
  X,
  ArrowLeft,
  Sparkles,
  Filter,
} from "lucide-react";
import { useTransformations } from "@/hooks/use-transformations";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import type { Transformation } from "@shared/schema";

// =====================================================
// SafeImage — defensive, lazy-loaded
// =====================================================
function SafeImage({
  src,
  alt,
  className,
  testId,
  draggable,
}: {
  src?: string | null;
  alt: string;
  className?: string;
  testId?: string;
  draggable?: boolean;
}) {
  const trimmed = (src || "").trim();
  const looksValid = trimmed.length >= 40;
  const [errored, setErrored] = useState(false);
  if (!looksValid || errored) {
    return (
      <div
        className={cn(
          "flex items-center justify-center text-muted-foreground/40 bg-black/40",
          className,
        )}
        data-testid={testId ? `${testId}-placeholder` : undefined}
      >
        <ImageOff size={28} />
      </div>
    );
  }
  return (
    <img
      src={trimmed}
      alt={alt}
      loading="lazy"
      decoding="async"
      draggable={draggable ?? true}
      onError={() => setErrored(true)}
      className={cn("w-full h-full object-cover", className)}
      data-testid={testId}
    />
  );
}

// =====================================================
// PublicCompareSlider — draggable before/after for the
// public Transformation type. Self-contained, no deps.
// =====================================================
function PublicCompareSlider({
  before,
  after,
  testId,
}: {
  before?: string | null;
  after?: string | null;
  testId?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [pos, setPos] = useState(50);
  const { t } = useTranslation();

  const move = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const x = clientX - rect.left;
    setPos(Math.max(0, Math.min(100, (x / rect.width) * 100)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    draggingRef.current = true;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    move(e.clientX);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    move(e.clientX);
  };
  const onPointerUp = (e: React.PointerEvent) => {
    draggingRef.current = false;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      setPos((p) => Math.max(0, p - 5));
      e.preventDefault();
    }
    if (e.key === "ArrowRight") {
      setPos((p) => Math.min(100, p + 5));
      e.preventDefault();
    }
  };

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      role="slider"
      aria-label="Before / after comparison"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(pos)}
      className="relative w-full h-full bg-black select-none touch-none cursor-ew-resize outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onKeyDown={onKey}
      data-testid={testId}
    >
      {/* AFTER (full base) */}
      <SafeImage src={after} alt="After" className="absolute inset-0 w-full h-full object-cover pointer-events-none" draggable={false} />
      {/* BEFORE (clipped overlay) */}
      <div
        className="absolute inset-0 overflow-hidden pointer-events-none"
        style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}
      >
        <SafeImage src={before} alt="Before" className="absolute inset-0 w-full h-full object-cover" draggable={false} />
      </div>
      {/* Divider — cyan Tron beam (replaces the prior white line). The
          beam has a soft cyan halo so it reads as a HUD light strip
          rather than a hard white seam. Pointer-events-none so the
          drag region behind it stays usable. */}
      <div
        className="absolute top-0 bottom-0 w-px pointer-events-none"
        style={{
          left: `${pos}%`,
          background: "linear-gradient(180deg, hsl(183 100% 75%), hsl(183 100% 65%))",
          boxShadow:
            "0 0 8px hsl(183 100% 60% / 0.55), 0 0 16px hsl(183 100% 55% / 0.35)",
        }}
      />
      {/* Handle — dark-glass disc with cyan rim (replaces the white disc).
          AMOLED-black surface, cyan border, restrained glow. */}
      <div
        className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-background/90 backdrop-blur-sm border border-primary/60 flex items-center justify-center pointer-events-none"
        style={{
          left: `${pos}%`,
          boxShadow:
            "0 0 0 1px hsl(183 100% 70% / 0.25), 0 0 18px -4px hsl(183 100% 55% / 0.55), 0 8px 18px -8px rgba(0,0,0,0.7)",
        }}
      >
        <ChevronsLeftRight size={16} className="text-primary" />
      </div>
      {/* Labels */}
      <div className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-black/70 backdrop-blur-sm text-white text-[10px] font-bold tracking-[0.2em] uppercase pointer-events-none border border-white/10">
        {t("transformations.before")}
      </div>
      <div className="absolute top-3 right-3 px-2.5 py-1 rounded-md bg-primary text-primary-foreground text-[10px] font-bold tracking-[0.2em] uppercase pointer-events-none">
        {t("transformations.after")}
      </div>
    </div>
  );
}

// =====================================================
// GalleryCard — clickable preview with embedded slider
// =====================================================
function GalleryCard({
  row,
  onOpen,
  index,
}: {
  row: Transformation;
  onOpen: () => void;
  index: number;
}) {
  const { t } = useTranslation();
  const name = row.displayName?.trim() || t("transformations.anonymous");

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.1 }}
      transition={{ duration: 0.5, delay: Math.min(index * 0.04, 0.4) }}
      className="tron-card rounded-3xl overflow-hidden card-lift group"
      data-testid={`gallery-card-${row.id}`}
    >
      <div className="relative aspect-[4/5] bg-black">
        <PublicCompareSlider
          before={row.beforeImageDataUrl}
          after={row.afterImageDataUrl}
          testId={`gallery-slider-${row.id}`}
        />
      </div>

      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="font-display font-bold text-base leading-tight" data-testid={`text-gallery-name-${row.id}`}>
            {name}
          </h3>
          <button
            type="button"
            onClick={onOpen}
            className="text-[11px] font-semibold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors shrink-0 inline-flex items-center gap-1"
            data-testid={`button-gallery-expand-${row.id}`}
          >
            {t("gallery.viewDetails", "View")}
          </button>
        </div>

        <ul className="mt-3 space-y-1.5 text-sm">
          {row.goal && (
            <li className="flex items-start gap-2 text-muted-foreground">
              <Target size={14} className="text-primary mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground/90">{t("transformations.goal")}:</strong> {row.goal}
              </span>
            </li>
          )}
          {row.duration && (
            <li className="flex items-start gap-2 text-muted-foreground">
              <Calendar size={14} className="text-primary mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground/90">{t("transformations.duration")}:</strong> {row.duration}
              </span>
            </li>
          )}
          {row.result && (
            <li className="flex items-start gap-2 text-muted-foreground">
              <TrendingUp size={14} className="text-primary mt-0.5 shrink-0" />
              <span>
                <strong className="text-foreground/90">{t("transformations.result")}:</strong> {row.result}
              </span>
            </li>
          )}
        </ul>
      </div>
    </motion.article>
  );
}

// =====================================================
// FullscreenModal — premium detail view
// =====================================================
function FullscreenModal({
  row,
  onClose,
}: {
  row: Transformation;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const name = row.displayName?.trim() || t("transformations.anonymous");

  // Lock body scroll + Esc to close
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="fixed inset-0 z-[80] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
      onClick={onClose}
      data-testid="gallery-modal"
    >
      <motion.div
        initial={{ scale: 0.96, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 8 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-5xl max-h-[92vh] rounded-3xl overflow-hidden bg-[rgba(8,15,28,0.96)] border border-white/10 shadow-2xl flex flex-col lg:flex-row"
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full bg-black/70 backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/80 hover:text-white hover:bg-black transition-colors"
          aria-label="Close"
          data-testid="button-gallery-close"
        >
          <X size={18} />
        </button>

        {/* Slider */}
        <div className="relative w-full lg:w-3/5 aspect-[4/5] lg:aspect-auto bg-black shrink-0">
          <PublicCompareSlider
            before={row.beforeImageDataUrl}
            after={row.afterImageDataUrl}
            testId={`gallery-modal-slider-${row.id}`}
          />
        </div>

        {/* Details */}
        <div className="flex-1 p-5 sm:p-7 overflow-y-auto">
          <p className="tron-eyebrow text-[10px] mb-1.5">{t("section.transformations.eyebrow")}</p>
          <h2 className="font-display font-bold text-2xl sm:text-3xl leading-tight" data-testid={`text-gallery-modal-name-${row.id}`}>
            {name}
          </h2>

          <ul className="mt-5 space-y-3 text-sm">
            {row.goal && (
              <li className="flex items-start gap-2.5">
                <Target size={16} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
                    {t("transformations.goal")}
                  </div>
                  <div className="text-foreground/90 mt-0.5">{row.goal}</div>
                </div>
              </li>
            )}
            {row.duration && (
              <li className="flex items-start gap-2.5">
                <Calendar size={16} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
                    {t("transformations.duration")}
                  </div>
                  <div className="text-foreground/90 mt-0.5">{row.duration}</div>
                </div>
              </li>
            )}
            {row.result && (
              <li className="flex items-start gap-2.5">
                <TrendingUp size={16} className="text-primary mt-0.5 shrink-0" />
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/80">
                    {t("transformations.result")}
                  </div>
                  <div className="text-foreground/90 mt-0.5">{row.result}</div>
                </div>
              </li>
            )}
          </ul>

          {row.testimonial && (
            <blockquote className="mt-6 pt-5 border-t border-white/8 text-sm italic text-muted-foreground/90 leading-relaxed flex gap-2.5">
              <Quote size={16} className="text-primary/70 shrink-0 mt-0.5" />
              <span data-testid={`text-gallery-modal-testimonial-${row.id}`}>{row.testimonial}</span>
            </blockquote>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

// =====================================================
// TransformationsGallery — public page at /transformations
// =====================================================
export default function TransformationsGallery() {
  const { t } = useTranslation();
  const { data = [], isLoading } = useTransformations();
  const [activeGoal, setActiveGoal] = useState<string>("all");
  const [openId, setOpenId] = useState<number | null>(null);

  // Build goal filter chips from existing data — first word of goal,
  // case-folded. Skip rows with no goal.
  const goals = useMemo(() => {
    const set = new Set<string>();
    for (const row of data) {
      const g = row.goal?.trim();
      if (g) set.add(g);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filtered = useMemo(() => {
    if (activeGoal === "all") return data;
    return data.filter((r) => (r.goal?.trim() || "") === activeGoal);
  }, [data, activeGoal]);

  const openRow = openId != null ? data.find((r) => r.id === openId) ?? null : null;

  // SEO
  useEffect(() => {
    const prevTitle = document.title;
    document.title = `${t("section.transformations.title")} · Youssef Ahmed`;
    return () => {
      document.title = prevTitle;
    };
  }, [t]);

  return (
    <main className="min-h-screen bg-background page-fade">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 pt-8 sm:pt-12 pb-20">
        {/* Back link */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors mb-6"
          data-testid="link-back-home"
        >
          <ArrowLeft size={14} className="rtl:rotate-180" />
          {t("gallery.backHome", "Back to home")}
        </Link>

        {/* Header */}
        <header className="mb-8 sm:mb-10">
          <p className="tron-eyebrow text-xs mb-2 inline-flex items-center gap-1.5">
            <Sparkles size={12} className="text-primary" />
            {t("section.transformations.eyebrow")}
          </p>
          <h1 className="text-3xl sm:text-5xl font-display font-bold tracking-tight">
            {t("section.transformations.title")}
          </h1>
          <p className="text-muted-foreground mt-3 max-w-2xl text-sm sm:text-base leading-relaxed">
            {t("gallery.subtitle", "Real clients. Structured programs. Verified results.")}
          </p>
        </header>

        {/* Filter chips — only shown when there are 2+ distinct goals */}
        {goals.length >= 2 && (
          <div className="mb-7 sm:mb-9">
            <div className="flex items-center gap-2 mb-2.5 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/70">
              <Filter size={11} />
              {t("gallery.filterByGoal", "Filter by goal")}
            </div>
            <div className="flex flex-wrap gap-2">
              <FilterChip
                label={t("gallery.all", "All")}
                active={activeGoal === "all"}
                onClick={() => setActiveGoal("all")}
                count={data.length}
                testId="chip-goal-all"
              />
              {goals.map((g) => (
                <FilterChip
                  key={g}
                  label={g}
                  active={activeGoal === g}
                  onClick={() => setActiveGoal(g)}
                  count={data.filter((r) => (r.goal?.trim() || "") === g).length}
                  testId={`chip-goal-${g.toLowerCase().replace(/\s+/g, "-")}`}
                />
              ))}
            </div>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="aspect-[4/5] rounded-3xl admin-shimmer" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-3xl border border-white/8 bg-white/[0.03] py-20 px-6 text-center">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-white/[0.05] border border-white/10 flex items-center justify-center text-muted-foreground/70 mb-4">
              <Sparkles size={26} />
            </div>
            <h3 className="font-display font-bold text-lg">{t("gallery.emptyTitle", "No transformations match this filter")}</h3>
            <p className="text-muted-foreground text-sm mt-1.5 max-w-md mx-auto">
              {t("gallery.emptyBody", "Try a different goal — or come back soon, more wins coming.")}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filtered.map((row, i) => (
              <GalleryCard key={row.id} row={row} index={i} onOpen={() => setOpenId(row.id)} />
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {openRow && <FullscreenModal row={openRow} onClose={() => setOpenId(null)} />}
      </AnimatePresence>
    </main>
  );
}

function FilterChip({
  label,
  active,
  count,
  onClick,
  testId,
}: {
  label: string;
  active: boolean;
  count: number;
  onClick: () => void;
  testId?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-2 h-9 px-3.5 rounded-full text-xs font-semibold transition-all border",
        active
          ? "bg-primary text-primary-foreground border-primary shadow-md shadow-primary/20"
          : "bg-white/[0.03] text-muted-foreground border-white/10 hover:text-foreground hover:bg-white/[0.06] hover:border-white/15",
      )}
      data-testid={testId}
    >
      {label}
      <span
        className={cn(
          "px-1.5 py-0.5 rounded-md text-[10px] font-bold tabular-nums",
          active ? "bg-black/20 text-white" : "bg-white/[0.06] text-muted-foreground/80",
        )}
      >
        {count}
      </span>
    </button>
  );
}
