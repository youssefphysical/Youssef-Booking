import { useEffect, useState, memo } from "react";
import { Link } from "wouter";
import { motion, type Variants } from "framer-motion";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useHeroImages } from "@/hooks/use-hero-images";
import type { HeroImage } from "@shared/schema";

// HERO MOTION ARCHITECTURE v4 (May-2026, "stacked images, CSS-only fade").
// =====================================================================
// PREVIOUS ARCHITECTURE (v3):
//   AnimatePresence rendered exactly ONE <motion.div> with the active
//   slide. On every tick, framer-motion unmounted the old slide and
//   mounted the new one. Even though the visual was a fade, the DOM
//   teardown/build (and the resulting <img> mount + main-thread image
//   decode) caused perceptible jank on mid-range Android devices.
// NEW ARCHITECTURE (v4):
//   1. ALL hero slides are rendered into the DOM at once, stacked
//      absolutely at inset:0. They never mount/unmount during the
//      lifetime of the hero — only their `data-active` attribute flips.
//   2. Visibility is controlled by a SINGLE CSS rule (.hero-slide-layer
//      in index.css) that animates `opacity` only:
//        transition: opacity 1200ms cubic-bezier(0.22, 1, 0.36, 1);
//      No framer-motion is involved in image fades. The browser's
//      compositor handles the entire crossfade on its own thread.
//   3. Each slide layer sits on its own GPU layer
//      (will-change: opacity + transform: translateZ(0) + backface-
//      visibility: hidden), so opacity changes are pure compositor
//      work — zero re-layout, zero re-paint of the image bitmap.
//   4. Image decode happens ONCE per slide, at React's first render
//      after `useHeroImages` resolves. From that point onward,
//      switching slides is a free attribute toggle: the previous
//      slide fades 1→0 while the next slide fades 0→1 in parallel,
//      giving a true crossfade with zero overlap haze.
//   5. The HeroSlideLayer component is `React.memo`'d — when a tick
//      change re-renders the parent, only the two affected slide
//      layers (the one becoming inactive and the one becoming active)
//      re-render their wrapper attribute. The other layers are
//      bailed out by referential equality of their props. The <img>
//      element itself is NEVER re-rendered, so the browser never
//      re-fetches or re-decodes.
//   6. All slides use loading="eager". Hero images are stored as
//      data URLs (slide.imageDataUrl) so they don't network-fetch,
//      but eager+priority hints still help the browser prioritise
//      the first slide's decode for the no-flash first paint.

const ROTATE_MS = 8000;
const FADE_MS = 1200; // mirrored in .hero-slide-layer CSS rule in index.css

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Stagger envelope for the overlay copy. Each child fades up in
// sequence: badge → headline → subtitle → button row. Copy is a
// SEPARATE layer from the images and lives on z-10 above all slide
// layers — its re-mount on tick change does not affect image smoothness.
const copyContainer: Variants = {
  hidden: {},
  visible: {
    transition: { delayChildren: 0.12, staggerChildren: 0.12 },
  },
};
const copyItem: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] },
  },
};

// One stacked slide layer. Memoized so it ONLY re-renders when its
// own props change (slide data or active flag). When the parent
// re-renders due to a tick change, only the two affected slides
// (becoming-inactive + becoming-active) flip their data-active
// attribute on the DOM. Every other slide is bailed out by memo.
// The <img> element is never re-mounted or re-rendered.
const HeroSlideLayer = memo(function HeroSlideLayer({
  slide,
  isActive,
  isFirst,
}: {
  slide: HeroImage;
  isActive: boolean;
  isFirst: boolean;
}) {
  // Per-image admin tuning (focal point, zoom, rotate, brightness,
  // contrast, overlay opacity). All NULL-safe → identity defaults so
  // pre-existing slides without tuning data render unchanged.
  const t_focalX = slide.focalX ?? 0;
  const t_focalY = slide.focalY ?? 0;
  const t_zoom = slide.zoom ?? 1.0;
  const t_rotate = slide.rotate ?? 0;
  const t_brightness = slide.brightness ?? 1.0;
  const t_contrast = slide.contrast ?? 1.0;
  const t_overlayOpacity = slide.overlayOpacity ?? 35; // percent

  // Match the .hero-img CSS baseline (brightness 1.05 / contrast 1.08
  // / saturate 1.05) exactly, then multiply per-image admin tuning.
  // translateZ(0) keeps the GPU layer pinned during admin slider tweaks.
  const sharpStyle: React.CSSProperties = {
    filter: `brightness(${(1.05 * t_brightness).toFixed(3)}) contrast(${(1.08 * t_contrast).toFixed(3)}) saturate(1.05)`,
    transform: `translate(${t_focalX}px, ${t_focalY}px) scale(${t_zoom}) rotate(${t_rotate}deg) translateZ(0)`,
    transformOrigin: "center",
  };

  return (
    <div
      className="hero-slide-layer"
      data-active={isActive ? "true" : "false"}
      data-testid={`hero-slide-layer-${slide.id}`}
      aria-hidden="true"
    >
      <img
        src={slide.imageDataUrl}
        alt=""
        // ALL slides eager. Data URLs don't network-fetch, but eager +
        // sync decode for the first slide (which is visible on first
        // paint) keeps the no-flash contract; subsequent slides decode
        // async to avoid blocking the main thread on mount.
        loading="eager"
        // @ts-expect-error fetchpriority is a valid HTML attribute, lowercase in React 18
        fetchpriority={isFirst ? "high" : "low"}
        decoding={isFirst ? "sync" : "async"}
        className="hero-img absolute inset-0 w-full h-full object-cover"
        style={sharpStyle}
        data-testid={`img-hero-slide-${slide.id}`}
      />
      {/* Per-slide bottom darkening gradient — lives INSIDE the slide
          layer so it crossfades together with its image. Two-stop
          linear gradient, transparent above 55% so the upper subject
          area is never touched. Direct 1:1 alpha mapping of the admin
          slider value (0-100 percent → 0.0-1.0 alpha). */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: `linear-gradient(to top, rgba(0,0,0,${(t_overlayOpacity / 100).toFixed(3)}) 0%, transparent 55%)`,
        }}
      />
    </div>
  );
});

export function HeroSlider() {
  const { t } = useTranslation();
  // Use the shared hook so we get `initialData` from
  // `window.__INITIAL_HERO_IMAGES__` (populated by the inline boot
  // script in index.html). When the boot script wins the race
  // against the JS bundle, the slide layers render on the very
  // first React paint — zero gradient flash.
  const { data: images = [] } = useHeroImages();
  const slides = images.filter((s) => s.isActive !== false);
  const [tick, setTick] = useState(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    // Honour prefers-reduced-motion: do NOT auto-rotate for users who
    // have requested reduced motion at the OS level. They still see
    // the first slide and can use the pagination dots to navigate.
    if (reduced) return;
    // Don't bother running an interval if there's only one slide
    // (or none) — no opacity to flip, just wasted timer work.
    if (slides.length <= 1) return;
    const id = window.setInterval(() => setTick((i) => i + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduced, slides.length]);

  // Three world-class brand-pillar copy variants from i18n. Per-image
  // admin copy on a HeroImage row OVERRIDES the variant for that
  // specific image — so the admin can still write custom copy per
  // slide if they want to.
  const variants = [
    {
      badge: t("hero.slides.s1.badge"),
      headline: t("hero.slides.s1.headline"),
      subhead: t("hero.slides.s1.subhead"),
    },
    {
      badge: t("hero.slides.s2.badge"),
      headline: t("hero.slides.s2.headline"),
      subhead: t("hero.slides.s2.subhead"),
    },
    {
      badge: t("hero.slides.s3.badge"),
      headline: t("hero.slides.s3.headline"),
      subhead: t("hero.slides.s3.subhead"),
    },
  ];

  const imageIndex = slides.length > 0 ? tick % slides.length : 0;
  const copyIndex = tick % 3;
  const variant = variants[copyIndex];
  const current: HeroImage | undefined = slides[imageIndex];

  const headline = current?.title?.trim() || variant.headline;
  const subhead = current?.subtitle?.trim() || variant.subhead;
  const badge = current?.badge?.trim() || variant.badge;

  return (
    <div
      className="hero-isolate relative w-full h-[78vh] min-h-[520px] max-h-[860px] overflow-hidden bg-black"
      data-testid="hero-slider"
      data-hero-state="ready"
    >
      {/* ============================================================
          STATIC HERO BASE — May 2026 permanent flash kill (final).
          ============================================================
          This <img> exists in JSX from the first React render and is
          paired with a <link rel="preload" as="image"> in the HTML
          head. The browser begins decoding before React mounts.
          `scripts/inject-hero.mjs` refreshes the file from the
          current active hero in Neon on every Vercel deploy, so the
          static file always matches what the admin uploaded. The
          stacked dynamic <img> tags below render ON TOP via DOM
          order + absolute positioning; once the API resolves and
          slides[0] mounts with data-active="true" → opacity:1 from
          its first computed style (no transition runs on initial
          mount, only on attribute changes), it covers this static
          base seamlessly. */}
      <img
        src="/hero-initial.webp"
        alt=""
        loading="eager"
        // @ts-expect-error fetchpriority is a valid HTML attribute, lowercase in React 18
        fetchpriority="high"
        decoding="sync"
        aria-hidden="true"
        className="hero-img absolute inset-0 w-full h-full object-cover"
        data-testid="img-hero-static-default"
      />

      {/* ============================================================
          STACKED IMAGE LAYER — v4 architecture.
          ============================================================
          ALL admin slides are rendered to the DOM at once, stacked
          absolutely at inset:0. None are ever unmounted. The active
          slide has data-active="true" and is opaque; all others are
          opacity:0. CSS handles the 1200ms crossfade entirely on the
          compositor thread — see .hero-slide-layer in index.css.
          The HeroSlideLayer component is React.memo'd so when the
          parent re-renders, only the two affected layers re-render
          their data-active attribute; the <img> elements are never
          touched. */}
      {slides.length > 0 && (
        <div className="absolute inset-0" aria-hidden="true">
          {slides.map((slide, i) => (
            <HeroSlideLayer
              key={slide.id}
              slide={slide}
              isActive={i === imageIndex}
              isFirst={i === 0}
            />
          ))}
        </div>
      )}

      {/* Overlay copy — staggered reveal. Animates once per copy or
          slide change so the eye is led: badge → headline → subtitle
          → CTAs. Reduced-motion users get the same final state with
          no animation. Explicit z-10 keeps the copy authoritatively
          above ALL slide layers and their per-slide gradients. */}
      <div className="absolute inset-0 z-10 flex items-end md:items-center">
        <div className="w-full max-w-6xl mx-auto px-5 pb-20 md:pb-0 md:pt-20">
          <motion.div
            key={`copy-${copyIndex}-${current?.id ?? "default"}`}
            variants={reduced ? undefined : copyContainer}
            initial={reduced ? false : "hidden"}
            animate={reduced ? undefined : "visible"}
            className="max-w-2xl"
          >
            {badge && (
              <motion.span
                variants={reduced ? undefined : copyItem}
                className="tron-eyebrow tron-pulse inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/40 bg-black/45 text-[10px] mb-6"
                data-testid="text-hero-badge"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                {badge}
              </motion.span>
            )}
            <motion.h1
              variants={reduced ? undefined : copyItem}
              className="tron-headline-glow text-4xl sm:text-5xl md:text-6xl lg:text-[5rem] xl:text-[5.5rem] font-display font-bold leading-[1.02] text-white tracking-tight"
              data-testid="text-hero-headline"
            >
              {headline}
            </motion.h1>
            {subhead && (
              <motion.p
                variants={reduced ? undefined : copyItem}
                className="mt-6 text-base sm:text-lg md:text-xl text-white/90 max-w-xl leading-relaxed"
                style={{ textShadow: "0 1px 12px rgba(0,0,0,0.7)" }}
                data-testid="text-hero-subhead"
              >
                {subhead}
              </motion.p>
            )}

            <motion.div
              variants={reduced ? undefined : copyItem}
              className="mt-9 flex flex-col sm:flex-row sm:flex-wrap gap-3.5"
            >
              <Link
                href="/book"
                className="w-full sm:w-auto"
                data-testid="link-hero-start-transformation"
              >
                <button className="tron-cta tron-cta-breathe w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl font-semibold whitespace-nowrap btn-press">
                  {t("hero.cinematic.startTransformation")}
                  <ArrowRight size={18} />
                </button>
              </Link>
              <button
                type="button"
                onClick={() => {
                  // Prefer the transformations gallery as social proof; if
                  // the admin has not added any yet, fall back to the "why"
                  // pitch so the button always lands somewhere meaningful.
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

      {/* Pagination dots — visually small but wrapped in a 44×44 tap
          target so they meet WCAG 2.5.5 minimum interactive size. */}
      {slides.length > 1 && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10"
          data-testid="hero-slider-dots"
        >
          {slides.map((img, i) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setTick(i)}
              aria-label={`Slide ${i + 1}`}
              data-testid={`button-hero-dot-${i}`}
              className="group inline-flex items-center justify-center min-w-[44px] h-[44px] px-2"
            >
              <span
                className={cn(
                  "block h-1.5 rounded-full transition-all",
                  i === imageIndex
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
