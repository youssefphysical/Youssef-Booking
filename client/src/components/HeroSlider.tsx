import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion, type Variants } from "framer-motion";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { WhatsAppButton } from "@/components/WhatsAppButton";
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
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
};

export function HeroSlider() {
  const { t } = useTranslation();
  const { data: images = [], isPending } = useQuery<HeroImage[]>({
    queryKey: ["/api/hero-images"],
  });
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

  // Compose admin tuning with the cinematic baseline filter. The CSS
  // `.hero-img` rule already applies contrast(1.08) brightness(1.05)
  // saturate(1.10) hue-rotate(-5deg) — we MULTIPLY the admin's
  // brightness/contrast onto that baseline so the photo keeps its
  // movie-poster grade while still responding to the slider. Inline
  // filter overrides the CSS one, so we re-state the full chain here.
  // The translateZ(0) at the end of the transform forces a GPU layer
  // (same hint as `.hero-img` in CSS) so the inline transform doesn't
  // accidentally drop the layer when the admin moves a slider.
  const sharpStyle: React.CSSProperties = {
    filter: `contrast(${(1.08 * t_contrast).toFixed(3)}) brightness(${(1.05 * t_brightness).toFixed(3)}) saturate(1.10) hue-rotate(-5deg)`,
    transform: `translate(${t_focalX}px, ${t_focalY}px) scale(${t_zoom}) rotate(${t_rotate}deg) translateZ(0)`,
    transformOrigin: "center",
    willChange: "transform",
  };
  const blurStyle: React.CSSProperties = {
    // Background bokeh copy gets the same translate/zoom/rotate so the
    // mask seam never drifts off the subject — but keeps its own
    // pre-baked blur+saturate filter (defined in .hero-img-blur).
    transform: `translate(${t_focalX}px, ${t_focalY}px) scale(${(t_zoom * 1.08).toFixed(3)}) rotate(${t_rotate}deg) translateZ(0)`,
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
      data-hero-state={isPending ? "loading" : current ? "ready" : "empty"}
      data-scrolling={isScrolling ? "true" : "false"}
    >
      {/* Instant dark gradient base — paints with the very first frame
          so there is never a blank or old-design flash before the
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
              initial={reduced ? false : { opacity: 0 }}
              animate={reduced ? undefined : { opacity: 1 }}
              exit={reduced ? undefined : { opacity: 0 }}
              transition={
                reduced
                  ? undefined
                  : { duration: FADE_MS / 1000, ease: "easeInOut" }
              }
            >
              {/* Background "out of focus" copy — blurred + cool-graded.
                  Inherits the same admin focal/zoom/rotate so its
                  composition tracks the sharp foreground perfectly. */}
              <img
                src={current.imageDataUrl}
                alt=""
                loading={imageIndex === 0 ? "eager" : "lazy"}
                decoding="async"
                aria-hidden="true"
                className="hero-img-blur absolute inset-0 w-full h-full object-cover"
                style={blurStyle}
              />
              {/* Foreground sharp copy — radial-masked so subject pops.
                  The inline `style` carries the admin's per-image
                  display tuning (focal, zoom, rotate, brightness,
                  contrast). It overrides the baseline CSS filter on
                  `.hero-img` so we restate the cinematic chain inside
                  `sharpStyle` to keep the movie-poster grade. */}
              <img
                src={current.imageDataUrl}
                alt=""
                loading={imageIndex === 0 ? "eager" : "lazy"}
                // @ts-expect-error fetchpriority is a valid HTML attribute, lowercase in React 18
                fetchpriority={imageIndex === 0 ? "high" : "auto"}
                decoding="async"
                className="hero-img hero-img-mask absolute inset-0 w-full h-full object-cover"
                style={sharpStyle}
                data-testid={`img-hero-slide-${current.id}`}
              />
            </motion.div>
          </AnimatePresence>
        </div>
      )}

      {/* Subject focus radial — brighter cyan halo right where the
          subject's face/torso usually sits in the frame. Stacks above
          the photo to "lift" the subject off the background like a
          movie poster key light. Pure additive paint, no blend mode. */}
      {current && (
        <div className="hero-subject-glow absolute inset-0 pointer-events-none" aria-hidden="true" />
      )}

      {/* TRON layer stack — all decorative, all pointer-events:none, NO
          mix-blend-mode and NO backdrop-filter. The cyan tints are
          baked directly into the alpha gradients, so the cinematic
          look is preserved without the per-frame repaint cost.
          OVERLAY DENSITY: dialled down deliberately so the subject in
          the photo stays clearly visible — heavy stacked black
          gradients were making the image look flat and washed-out. */}
      <div className="absolute inset-0 tron-spotlight pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 tron-shaft pointer-events-none" aria-hidden="true" />
      <div className="absolute inset-0 tron-grid opacity-[0.08] pointer-events-none" aria-hidden="true" />
      {/* Smart vertical gradient — NOT a flat black wall. Top 50% is
          transparent so the subject reads in full clarity, middle is
          a deep navy soft-tint for cinematic depth without losing the
          photo, bottom is darker so the headline and CTAs land on a
          high-contrast pad. Cool navy stop instead of pure black so
          the cyan grade doesn't fight a black underlayer.
          OVERLAY DARKNESS is per-image admin tunable: the bottom stop
          alpha and the mid-stop alpha both scale with the slider so
          the admin can dial the gradient down for a bright slide
          (where the photo already provides contrast) or up for a
          washed-out slide (where the headline needs more pad). The
          slider value is a 0–60 % "darkness budget" — at 0 the
          gradient is invisible, at 35 (default) we get the classic
          cinematic pad, at 60 the bottom is near-opaque. */}
      <div className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "linear-gradient(to top, " +
            // CLARITY PASS (May 2026): multipliers tuned so default
            // overlayOpacity=35 maps to ~0.65 alpha at the bottom (matches
            // the recommended cinematic pad), ~0.32 at the mid stop
            // (light navy haze), and effectively transparent above 50%
            // — so the upper half of the photo where the subject lives
            // stays clear and never reads as "blurry / washed out".
            `hsl(220 60% 4% / ${(t_overlayOpacity / 100 * 1.85).toFixed(3)}) 0%, ` +
            `hsl(220 55% 6% / ${(t_overlayOpacity / 100 * 0.92).toFixed(3)}) 22%, ` +
            `hsl(220 50% 8% / ${(t_overlayOpacity / 100 * 0.20).toFixed(3)}) 50%, ` +
            "transparent 75%)",
        }}
      />
      {/* Subtle horizontal navy hold on the left so the headline pad
          stays readable on bright photos without darkening the right
          side of the frame where the subject usually is. */}
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-transparent md:from-black/40 pointer-events-none" />
      <div className="absolute inset-0 tron-vignette opacity-60 pointer-events-none" />
      {/* Animated cyan beam — drifts slowly across the hero. Two
          beams at different vertical positions and slightly different
          drift phases so they never feel like a single static line. */}
      <div className="hidden md:block absolute left-0 right-0 top-[28%] tron-beam tron-beam-drift pointer-events-none" />
      <div className="hidden md:block absolute left-0 right-0 bottom-[18%] tron-beam tron-beam-drift tron-beam-drift--alt opacity-60 pointer-events-none" />

      {/* Overlay copy — staggered reveal. Animates once per copy or
          slide change so the eye is led: badge → headline → subtitle
          → CTAs. Reduced-motion users get the same final state with
          no animation. Explicit z-10 ensures the copy ALWAYS paints
          above the .hero-isolate::after cyan rim light (z:5), even
          though the rim is a positioned pseudo-element and copy
          would otherwise lose stacking by JSX order alone. */}
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
