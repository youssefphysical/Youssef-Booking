import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  AnimatePresence,
  motion,
  useScroll,
  useTransform,
  type Variants,
} from "framer-motion";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import type { HeroImage } from "@shared/schema";

// Cinematic image-only hero. Auto-rotates between admin-uploaded slides
// (5.5s cadence), crossfades for 1.2s, applies a slow Ken Burns
// scale+pan to the slide image, and layers TRON-poster atmospherics
// (radial spotlight, diagonal light shaft, fine grid, film grain,
// vignette, energy beams) over the top. Per-slide overlay copy
// (title/subtitle/badge) falls back to the global cinematic i18n
// strings so the hero never reads empty.
const ROTATE_MS = 5500;
const FADE_MS = 1200;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Stagger envelope for the overlay copy. Each child fades up in
// sequence: badge → headline → subtitle → button row. This is the
// "movie poster reveal" the cinematic upgrade calls for.
const copyContainer: Variants = {
  hidden: {},
  visible: {
    transition: { delayChildren: 0.18, staggerChildren: 0.16 },
  },
};
const copyItem: Variants = {
  hidden: { opacity: 0, y: 18 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.65, ease: [0.22, 1, 0.36, 1] },
  },
};

export function HeroSlider() {
  const { t } = useTranslation();
  const { data: images = [], isPending } = useQuery<HeroImage[]>({
    queryKey: ["/api/hero-images"],
  });
  const slides = images.filter((s) => s.isActive !== false);
  const [index, setIndex] = useState(0);
  const reduced = prefersReducedMotion();

  // Parallax — scrolling the page nudges the image layer downward at a
  // slower rate than the overlay copy, giving the hero a sense of depth
  // (background recedes; foreground holds). Disabled for reduced motion.
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll();
  const parallaxY = useTransform(scrollY, [0, 600], ["0%", "14%"]);

  useEffect(() => {
    // Honour prefers-reduced-motion: do NOT auto-rotate slides for users
    // who have requested reduced motion at the OS level. They still see
    // the first slide and can use the pagination dots to navigate.
    if (reduced || slides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [slides.length, reduced]);

  // Reset index when image list changes (e.g. after admin deletes one).
  useEffect(() => {
    if (index >= slides.length) setIndex(0);
  }, [slides.length, index]);

  // Always render the cinematic shell (loading / empty / ready states) so
  // the visitor never sees the bio section flash above it on hard refresh.
  // When a real slide exists we paint the Ken Burns image on top of the
  // shell; otherwise the default TRON background + i18n copy stand alone
  // as an intentional, branded fallback.
  const safeIndex = slides.length > 0 && index < slides.length ? index : 0;
  const current: HeroImage | undefined = slides[safeIndex];

  const headline = current?.title?.trim() || t("hero.cinematic.headline");
  const subhead = current?.subtitle?.trim() || t("hero.cinematic.subhead");
  const badge = current?.badge?.trim() || t("hero.cinematic.badge");

  return (
    <div
      ref={heroRef}
      className="relative w-full h-[78vh] min-h-[520px] max-h-[860px] overflow-hidden bg-black"
      data-testid="hero-slider"
      data-hero-state={isPending ? "loading" : current ? "ready" : "empty"}
    >
      {/* Instant dark gradient base — paints with the very first frame so
          there is never a blank, white, or old-design flash before the
          /api/hero-images response arrives. */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at 30% 20%, hsl(220 50% 10%), transparent 60%), " +
            "radial-gradient(ellipse at 75% 80%, hsl(210 60% 14% / 0.6), transparent 55%), " +
            "linear-gradient(180deg, #02060f 0%, #000000 60%, #050a14 100%)",
        }}
        aria-hidden="true"
      />
      <div className="absolute -top-32 -left-24 w-[32rem] h-[32rem] rounded-full bg-primary/10 blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-24 w-[34rem] h-[34rem] rounded-full bg-primary/10 blur-3xl pointer-events-none" />

      {/* Image layer — only mounted once a real slide is available.
          Two render paths so prefers-reduced-motion is fully honoured:
          - Reduced motion: a plain <img> with the cinematic CSS filter,
            no parallax, no Ken Burns, no crossfade, no AnimatePresence.
          - Default: parallax wrapper + AnimatePresence crossfade between
            slides + Ken Burns scale/drift on the image itself. */}
      {current && reduced && (
        <div className="absolute inset-0" aria-hidden="true">
          <img
            src={current.imageDataUrl}
            alt=""
            loading="eager"
            // @ts-expect-error fetchpriority is a valid HTML attribute, React 18 lowercase
            fetchpriority="high"
            decoding="async"
            className="w-full h-full object-cover"
            style={{ filter: "contrast(1.12) brightness(1.08) saturate(1.08)" }}
            data-testid={`img-hero-slide-${current.id}`}
          />
        </div>
      )}
      {current && !reduced && (
        <motion.div
          className="absolute inset-0 will-change-transform"
          style={{ y: parallaxY }}
          aria-hidden="true"
        >
          <AnimatePresence mode="sync">
            <motion.div
              key={current.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: FADE_MS / 1000, ease: "easeInOut" }}
              className="absolute inset-0"
            >
              {/* Ken Burns: slow scale + slight x drift, plus the
                  cinematic CSS filter that lifts contrast/brightness/
                  saturation just enough to make the subject pop without
                  reading as washed out. */}
              <motion.img
                src={current.imageDataUrl}
                alt=""
                aria-hidden="true"
                loading={safeIndex === 0 ? "eager" : "lazy"}
                // @ts-expect-error fetchpriority is a valid HTML attribute, React 18 lowercase
                fetchpriority={safeIndex === 0 ? "high" : "auto"}
                decoding="async"
                className="w-full h-full object-cover will-change-transform"
                style={{
                  filter:
                    "contrast(1.12) brightness(1.08) saturate(1.08)",
                }}
                initial={{ scale: 1.0, x: "-1.5%" }}
                animate={{ scale: 1.08, x: "1.5%" }}
                transition={{
                  duration: (ROTATE_MS + FADE_MS) / 1000,
                  ease: "linear",
                }}
                data-testid={`img-hero-slide-${current.id}`}
              />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}

      {/* TRON layer stack (purely decorative, all pointer-events:none).
          Order matters — bottom of stack first, top of stack last:
            1. Cinematic spotlight (cyan radial, blends "screen" so it
               BRIGHTENS the centre of the image — this is what makes
               the subject pop).
            2. Diagonal light shaft (TRON poster atmosphere).
            3. Fine cyan grid (digital surface, very subtle).
            4. Film grain (kills the "flat dark plastic" feel).
            5. Smart bottom darkening (heavier on desktop where the
               headline sits centered, lighter on mobile so the photo
               stays readable on small screens).
            6. Soft left wash (anchors the headline; lighter on mobile).
            7. Radial vignette (corner darkening for legibility).
            8. Pair of horizontal energy beams (sci-fi accents). */}
      <div className="absolute inset-0 tron-spotlight pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 tron-shaft pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 tron-grid opacity-25 mix-blend-screen pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 tron-noise pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/8 to-transparent md:from-black md:via-black/15 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/35 via-transparent to-transparent md:from-black/55 pointer-events-none" />
      <div className="absolute inset-0 tron-vignette opacity-70 pointer-events-none" />
      <div className="hidden md:block absolute left-0 right-0 top-[28%] tron-beam pointer-events-none" />
      <div className="hidden md:block absolute left-0 right-0 bottom-[18%] tron-beam opacity-60 pointer-events-none" />

      {/* Overlay content — staggered reveal. Animates ONCE per slide
          change so the eye is led: badge → headline → subtitle → CTAs.
          Reduced-motion users get the same final state with no animation. */}
      <div className="absolute inset-0 flex items-end md:items-center">
        <div className="w-full max-w-6xl mx-auto px-5 pb-16 md:pb-0 md:pt-20">
          <motion.div
            key={current ? `copy-${current.id}` : "copy-default"}
            variants={reduced ? undefined : copyContainer}
            initial={reduced ? false : "hidden"}
            animate={reduced ? undefined : "visible"}
            className="max-w-2xl"
          >
            {badge && (
              <motion.span
                variants={reduced ? undefined : copyItem}
                className="tron-eyebrow tron-pulse inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/40 bg-primary/10 backdrop-blur-md text-[10px] mb-5"
                data-testid="text-hero-badge"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {badge}
              </motion.span>
            )}
            <motion.h1
              variants={reduced ? undefined : copyItem}
              className="tron-headline-glow text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold leading-[1.02] text-white tracking-tight"
              data-testid="text-hero-headline"
            >
              {headline}
            </motion.h1>
            {subhead && (
              <motion.p
                variants={reduced ? undefined : copyItem}
                className="mt-5 text-base sm:text-lg md:text-xl text-white/90 max-w-xl leading-relaxed"
                style={{ textShadow: "0 1px 12px rgba(0,0,0,0.7)" }}
                data-testid="text-hero-subhead"
              >
                {subhead}
              </motion.p>
            )}

            <motion.div
              variants={reduced ? undefined : copyItem}
              className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3"
            >
              <Link href="/book" className="w-full sm:w-auto" data-testid="link-hero-start-transformation">
                <button className="tron-cta tron-cta-breathe w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-semibold whitespace-nowrap btn-press">
                  {t("hero.cinematic.startTransformation")}
                  <ArrowRight size={18} />
                </button>
              </Link>
              <button
                type="button"
                onClick={() => {
                  // Prefer the transformations gallery as social proof; if the
                  // admin has not added any yet, fall back to the "why" pitch
                  // so the button always lands somewhere meaningful.
                  const target =
                    document.getElementById("transformations") ??
                    document.getElementById("why");
                  target?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                data-testid="button-hero-view-results"
                className="tron-glass-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-semibold whitespace-nowrap btn-press"
              >
                <Eye size={18} />
                {t("hero.cinematic.viewResults")}
              </button>
              <WhatsAppButton
                label={t("hero.cinematic.whatsapp")}
                message={t("hero.cinematic.whatsappMsg")}
                size="md"
                testId="button-hero-whatsapp"
                // Cyan-tinted shadow so the green WhatsApp button still
                // belongs to the cinematic TRON lighting on the hero.
                className="w-full sm:w-auto shadow-[0_0_0_1px_hsl(195_100%_60%/0.18),0_8px_24px_-6px_hsl(195_100%_60%/0.30)] hover:shadow-[0_0_0_1px_hsl(195_100%_70%/0.30),0_10px_28px_-6px_hsl(195_100%_60%/0.45)]"
              />
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* Pagination dots — visually small but wrapped in a 44×44 tap target
          so they meet WCAG 2.5.5 minimum interactive size on mobile. */}
      {slides.length > 1 && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10"
          data-testid="hero-slider-dots"
        >
          {slides.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Slide ${i + 1}`}
              data-testid={`button-hero-dot-${i}`}
              className="group inline-flex items-center justify-center min-w-[44px] h-[44px] px-2"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all",
                  i === safeIndex
                    ? "w-8 bg-primary"
                    : "w-1.5 bg-white/40 group-hover:bg-white/70",
                )}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
