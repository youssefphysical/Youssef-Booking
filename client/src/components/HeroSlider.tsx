import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useHeroImages } from "@/hooks/use-hero-images";
import type { HeroImage } from "@shared/schema";

// Cinematic image-only hero. Auto-rotates every 6s. A single tick
// counter drives both the image rotation (modulo slides.length) and
// the brand-pillar copy rotation (modulo 3) — so visitors always see
// the three core promises (premium / results / purpose) eventually,
// even if the admin hasn't uploaded any hero images yet.
//
// Performance: this hero is engineered for buttery-smooth scrolling.
// We deliberately avoid:
//   - useScroll / parallax (caused per-frame transform repaints)
//   - mix-blend-mode on overlays (forces full stacking-context repaint)
//   - backdrop-filter on the badge (very expensive on mobile)
//   - box-shadow keyframe animation on mobile (pulse/breathe gated to
//     desktop via the .tron-pulse / .tron-cta-breathe media query)
// We ALLOW:
//   - A static CSS filter on the <img> for premium look (contrast +
//     brightness + saturation slightly up). Static filters are baked
//     into the GPU layer once at compositing time and do NOT cost
//     per-frame work, so they are safe.
//   - A very slow Ken Burns scale on desktop only, paused while the
//     user is actively scrolling — this gives the hero life without
//     ever competing with scroll for CPU/GPU time.
const ROTATE_MS = 6000;
const FADE_MS = 900;
// How long after the last scroll event before we resume Ken Burns. A
// short tail (140ms) means the resume feels instant once the user
// stops, but pauses cleanly the moment a scroll begins.
const SCROLL_IDLE_MS = 140;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// Stagger envelope for the overlay copy. Each child fades up in
// sequence: badge → headline → subtitle → button row.
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

export function HeroSlider() {
  const { t } = useTranslation();
  // Use the shared hook so we get `initialData` from
  // `window.__INITIAL_HERO_IMAGES__` (populated by the inline boot
  // script in index.html). When the boot script wins the race against
  // the JS bundle (the common case on prod), the first <img> tag is
  // rendered on the very first React paint — zero gradient flash.
  const { data: images = [], isPending } = useHeroImages();
  const slides = images.filter((s) => s.isActive !== false);
  const [tick, setTick] = useState(0);
  const [isScrolling, setIsScrolling] = useState(false);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    // Honour prefers-reduced-motion: do NOT auto-rotate for users who
    // have requested reduced motion at the OS level. They still see
    // the first slide and can use the pagination dots to navigate.
    if (reduced) return;
    const id = window.setInterval(() => setTick((i) => i + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduced]);

  // Pause Ken Burns while the user is actively scrolling. This is the
  // single biggest cause of perceived hero "stutter" on mid-range
  // phones — even a cheap GPU-accelerated transform competes with the
  // browser's compositor when scroll-driven repaints are happening at
  // the same time. Pausing for the duration of the scroll, then
  // resuming 140ms after the last scroll event, makes the hero feel
  // both alive AND silky to scroll past.
  //
  // IMPORTANT: this effect MUST NOT depend on `isScrolling`. If it did,
  // every state flip would tear down the listener AND clear the
  // pending revert-timer in the cleanup — which would leave the hero
  // permanently stuck in `data-scrolling="true"` after a single
  // discrete scroll event (e.g. a tap-to-top, wheel notch, or anchor
  // jump). React's setState bail-out handles the duplicate calls for
  // free, so we just call setIsScrolling(true) every event.
  //
  // We DO NOT gate this listener on `reduced` either: the Ken Burns
  // CSS rule that consumes `data-scrolling` is itself already gated
  // by `(prefers-reduced-motion: no-preference)` in index.css, so
  // toggling the attribute for reduced-motion users is a free no-op
  // visually. Gating here used to skip attaching the listener in
  // automated browsers (Playwright defaults to `prefers-reduced-motion:
  // reduce`), which broke the contract under test.
  const scrollTimerRef = useRef<number | null>(null);
  useEffect(() => {
    const onScroll = () => {
      setIsScrolling(true);
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = window.setTimeout(
        () => setIsScrolling(false),
        SCROLL_IDLE_MS,
      );
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (scrollTimerRef.current) window.clearTimeout(scrollTimerRef.current);
    };
  }, []);

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

  // ====== PER-IMAGE DISPLAY TUNING ======
  // Admin-controlled render-time adjustments. All NULL-safe — pre-existing
  // slides with no tuning data fall back to identity (zoom 1, no rotation,
  // no offset, baseline brightness/contrast, default overlay) so the hero
  // never visually shifts when this feature is added. The tuning is
  // applied as a single combined inline `transform`/`filter` on the
  // foreground sharp <img>, which composes cleanly with the wrapper's
  // Ken Burns transform (the wrapper handles motion, the img handles
  // composition tuning — they live on different elements so neither
  // fights the other for the GPU layer).
  const t_focalX = current?.focalX ?? 0;
  const t_focalY = current?.focalY ?? 0;
  const t_zoom = current?.zoom ?? 1.0;
  const t_rotate = current?.rotate ?? 0;
  const t_brightness = current?.brightness ?? 1.0;
  const t_contrast = current?.contrast ?? 1.0;
  const t_overlayOpacity = current?.overlayOpacity ?? 35; // percent

  // CONSISTENCY-PASS (May-2026, post-load clarity fix).
  // The image filter is now intentionally LIGHT and matches the
  // baseline `.hero-img` CSS rule exactly:
  //   brightness(1.05) contrast(1.08) saturate(1.05)
  // No hue-rotate (that was tinting the photo cyan after load and
  // making it read as "less clear"). No blur copy underneath, no
  // radial mask on top — the sharp image is the only image. This
  // means the static <img src="/hero-initial.webp"> on first paint
  // and the dynamic admin <img> after API hydration get IDENTICAL
  // visual treatment. No visible "after-load change". Admin per-image
  // brightness/contrast multiply onto the same baseline so the
  // sliders still work for fine-tuning. translateZ(0) keeps the
  // GPU layer pinned during admin slider tweaks.
  const sharpStyle: React.CSSProperties = {
    filter: `brightness(${(1.05 * t_brightness).toFixed(3)}) contrast(${(1.08 * t_contrast).toFixed(3)}) saturate(1.05)`,
    transform: `translate(${t_focalX}px, ${t_focalY}px) scale(${t_zoom}) rotate(${t_rotate}deg) translateZ(0)`,
    transformOrigin: "center",
    willChange: "transform",
  };

  return (
    <div
      // The data-scrolling attribute toggles the Ken Burns play state
      // via the .hero-kenburns CSS rule below. Keeping the scroll
      // listener at the top of the hero (rather than per-image) means
      // we only attach a single window listener for the whole slider.
      className="hero-isolate relative w-full h-[78vh] min-h-[520px] max-h-[860px] overflow-hidden bg-black"
      data-testid="hero-slider"
      data-hero-state="ready"
      data-scrolling={isScrolling ? "true" : "false"}
    >
      {/* ============================================================
          STATIC HERO BASE — May 2026 permanent flash kill (final).
          ============================================================
          This <img> is the cornerstone of the no-flash guarantee:
            • It is a real DOM <img> with a real `src`, NOT a CSS
              background, NOT a data URL on a global, NOT injected
              after hydration. It exists in the JSX from the first
              React render and the `<link rel="preload" as="image">`
              for the same path is in the HTML head BEFORE any
              script tag. The browser begins decoding it before
              React has even mounted.
            • The path `/hero-initial.webp` is a Vite public-dir
              asset — `client/public/hero-initial.webp` is copied
              verbatim to `dist/public/` at build time and served
              by Vercel's CDN as a static file (no API, no JS).
            • `scripts/inject-hero.mjs` (post-`vite build`) refreshes
              `dist/public/hero-initial.webp` from the current
              active hero in Neon on EVERY Vercel deploy, so the
              static file is always in sync with what the admin
              uploaded — no stale committed binary problem.
            • `loading="eager"` + `fetchpriority="high"` +
              `decoding="sync"` together force the browser to put
              this image at the front of the queue and decode it on
              the main thread before paint. Combined with the
              preload link, the image is on screen on the very
              first frame after HTML parse.
          The dynamic <img> tags below (admin-managed slides with
          per-image tuning, blur depth-of-field, fade transitions)
          render ON TOP of this static base via DOM order + the
          `absolute inset-0` positioning — so when a dynamic slide
          loads it covers the static one cleanly. The static base
          is only ever visually relevant for the ~0-150 ms window
          between first paint and the first dynamic slide arriving;
          for that window it makes the hero look complete and
          branded instead of gradient-only.  */}
      <img
        src="/hero-initial.webp"
        alt=""
        // CRITICAL: these three attributes together are why the
        // image is on screen on frame 1. Do not change without
        // re-validating the no-flash contract.
        loading="eager"
        // @ts-expect-error fetchpriority is a valid HTML attribute, lowercase in React 18
        fetchpriority="high"
        decoding="sync"
        aria-hidden="true"
        className="hero-img absolute inset-0 w-full h-full object-cover"
        data-testid="img-hero-static-default"
      />

      {/* Image layer — TWIN-IMAGE depth-of-field rig.
          The bottom copy is blurred and serves as the "out of focus"
          background. The top copy is the sharp original, but it's
          masked by a soft radial so only the centre (where the
          subject is) reads as razor-sharp; the corners fade to the
          blurred copy beneath. This is the same trick a portrait lens
          gives you optically: subject in focus, surroundings melting
          into bokeh. Both images share a single Ken Burns transform
          on the wrapper so the masked seam never moves out of
          alignment. The browser shares the decoded bitmap between
          the two <img> tags with the same src, so memory cost is
          negligible. */}
      {current && (
        <div className="absolute inset-0" aria-hidden="true">
          <AnimatePresence mode="sync">
            <motion.div
              key={current.id}
              className="hero-kenburns absolute inset-0"
              // FIRST PAINT (tick === 0): skip the opacity-0 → 1 fade
              // entirely. Combined with the matching filter on the
              // static base image, this means hydration is visually
              // invisible — the dynamic image takes over without
              // any darkening, fading, or blur transition.
              // SUBSEQUENT SLIDES: keep the cinematic 900 ms cross-
              // fade between slides during the auto-rotation.
              initial={reduced || tick === 0 ? false : { opacity: 0 }}
              animate={reduced ? undefined : { opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={
                reduced
                  ? undefined
                  : { duration: FADE_MS / 1000, ease: "easeInOut" }
              }
            >
              {/* SINGLE sharp image — no blur copy underneath, no
                  radial mask. The previous twin-image depth-of-field
                  rig was visually beautiful but the blurred bokeh
                  layer bled through at the masked edges, making the
                  image read as "less clear" after API hydration than
                  it did on first paint (the static base has no blur).
                  Removing the blur+mask means dynamic load = static
                  load visually. Filter on this image matches the CSS
                  baseline of the static <img src="/hero-initial.webp">
                  exactly (brightness 1.05 / contrast 1.08 / saturate
                  1.05) so hydration is a no-op for the user's eye. */}
              <img
                src={current.imageDataUrl}
                alt=""
                loading={imageIndex === 0 ? "eager" : "lazy"}
                // @ts-expect-error fetchpriority is a valid HTML attribute, lowercase in React 18
                fetchpriority={imageIndex === 0 ? "high" : "auto"}
                decoding={imageIndex === 0 ? "sync" : "async"}
                className="hero-img absolute inset-0 w-full h-full object-cover"
                style={sharpStyle}
                data-testid={`img-hero-slide-${current.id}`}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* CLARITY PASS — May 2026.
          Stripped the entire decorative TRON stack (spotlight, shaft,
          grid, vignette, beams, subject-glow radial, horizontal navy
          hold). Each one was a pointer-events:none full-bleed layer
          painting on every scroll/Ken-Burns frame and collectively they
          were the dominant cause of the photo reading as "dull / hazy".
          The cinematic look now lives in the static CSS filter on the
          image itself (.hero-img) and a single soft bottom navy
          gradient that the admin can still tune per-image via the
          overlayOpacity slider. Single overlay = clear photo + smooth
          paint + headline still has a contrast pad to land on. */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background:
            // Single linear bottom-up gradient, two stops only.
            // CONSISTENCY-PASS (May-2026): direct 1:1 alpha mapping so
            // the admin slider numbers in the UI match the actual
            // alpha applied. Default 35 → 0.35 alpha; user-spec value
            // 55 → 0.55 alpha (the canonical "headline pad" the brief
            // calls for). Black instead of navy so it doesn't tint
            // the photo blue — pure neutral darkening. Feathers to
            // transparent at 55 % so the upper half (where the
            // subject lives) is NEVER touched.
            `linear-gradient(to top, rgba(0,0,0,${(t_overlayOpacity / 100).toFixed(3)}) 0%, transparent 55%)`,
        }}
      />

      {/* Overlay copy — staggered reveal. Animates once per copy or
          slide change so the eye is led: badge → headline → subtitle
          → CTAs. Reduced-motion users get the same final state with
          no animation. Explicit z-10 keeps the copy authoritatively
          above the (now single) bottom navy gradient regardless of
          JSX order — defensive guarantee for future overlay tweaks. */}
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
