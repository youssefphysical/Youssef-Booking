import { useEffect, useState, memo } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useHeroImages } from "@/hooks/use-hero-images";
import type { HeroImage } from "@shared/schema";

// HERO MOTION ARCHITECTURE v7 (May-2026, "stable mask reveal").
// =====================================================================
// Image layer (unchanged from v4): ALL slides rendered at once, stacked
// absolutely. Visibility controlled by toggling the `data-active`
// attribute (CSS handles the 1200ms compositor-only opacity crossfade
// — see .hero-slide-layer in index.css). HeroSlideLayer is React.memo'd
// so unchanged slides bail out of re-render. The <img> elements are
// never re-mounted, re-fetched, or re-decoded during a slide switch.
//
// Copy layer (v7, "stable mask reveal") — total rewrite of the v6.x
// per-character typewriter + cursor experiment. The user's production
// video showed three repeatable bugs in v6.3:
//   1) During slide change, the per-char spans of the old headline
//      were torn down BEFORE the new ones revealed; for ~200-400ms
//      only the typewriter cursor was visible, floating in the middle
//      of an empty headline frame.
//   2) The CTA buttons were INSIDE the AnimatePresence subtree, so
//      they re-mounted (and re-ran their entrance animation) on every
//      single slide change — visible "disappear/reappear" jank.
//   3) On narrower mobile viewports the headline occasionally wrapped
//      to 2 lines but the per-char reveal made the second line look
//      clipped because chars were still hidden when the eye expected
//      a complete word.
//
// v7 architecture (per the "FIX HERO TEXT ANIMATION BUGS" spec):
//   - FULL text always present in the DOM. No splitting, no per-char
//     state, no cursor element anywhere.
//   - Headline reveals via a clip-path wipe on an INNER block wrapper
//     (`.hero-mask-reveal` in index.css). The h1 itself reserves the
//     multi-line height via min-h-* utility classes; the inner wrapper
//     animates clip-path inset(0 100% 0 0) → inset(0 0 0 0) so the
//     wipe travels left-to-right across all wrapped lines
//     simultaneously. Text wraps naturally at word boundaries because
//     the wrapper is `display: block`, not `inline-block`.
//   - Badge: pure opacity fade (.hero-fade), 250ms.
//   - Subhead: opacity + translateY(8px → 0) (.hero-fade-up), 350ms.
//   - Buttons: rendered OUTSIDE AnimatePresence as a sibling element,
//     so they NEVER remount on slide change. They get a one-time
//     mount fade (.hero-buttons-once) at t=1000ms and stay stable
//     forever after.
//   - Slide change: AnimatePresence in default sync mode (NO
//     mode="wait") — old motion.div fades out 200ms while new
//     motion.div mounts at t=0 and its CSS-animated children begin
//     revealing immediately. The old text is still visible at
//     decreasing opacity during the entire window in which the new
//     copy is below 100% — ZERO blank-headline frame, ZERO cursor-
//     only frame, ZERO empty-text moment.
//
// Performance:
//   - Animates only opacity, transform, and clip-path. No blur. No
//     layout. No per-frame JS. No setInterval-per-character.
//   - Each animated element gets ONE compositor layer for the
//     duration of its 250-600ms animation, then released. Headline
//     has just 1 promoted layer (the inner mask wrapper) instead of
//     v6.3's ~30 per-char spans.
//   - First-paint flash kill (static base image, fetchpriority high)
//     unchanged from v5.

const ROTATE_MS = 8000;
const FADE_MS = 1200; // mirrored in .hero-slide-layer CSS rule

// COPY REVEAL TIMING (v7).
// All values measured from the moment the new copy mounts. Because
// AnimatePresence runs in default sync mode, the new-copy mount
// happens at t=0 of the slide change, in parallel with the outgoing
// copy's 200ms fade-out and the image layer's 1200ms cross-fade.
//
//   - badge:    fade 250ms starting at  0ms ⇒ done by 250ms.
//   - headline: clip-path wipe + 8px lift, 600ms starting at 200ms
//               ⇒ done by 800ms.
//   - subhead:  fade-up 350ms starting at 700ms ⇒ done by 1050ms.
//   - buttons:  one-time mount fade-up 380ms at 1000ms (FIRST mount
//               only — see comment on the buttons div below).
//   - exit:     outgoing motion.div opacity 1 → 0 over 200ms; runs
//               in parallel with the new motion.div's child reveals
//               (which keeps the headline area visually full at all
//               times).
const COPY = {
  badge:    { start:    0, dur: 250 },
  headline: { start:  200, dur: 600 },
  subhead:  { start:  700, dur: 350 },
  buttons:  { start: 1000, dur: 380 },
  exit:     { dur: 200 },
};

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// One stacked slide layer. Memoized so it ONLY re-renders when its
// own props change. The <img> element is never re-mounted.
const HeroSlideLayer = memo(function HeroSlideLayer({
  slide,
  isActive,
  isFirst,
}: {
  slide: HeroImage;
  isActive: boolean;
  isFirst: boolean;
}) {
  const t_focalX = slide.focalX ?? 0;
  const t_focalY = slide.focalY ?? 0;
  const t_zoom = slide.zoom ?? 1.0;
  const t_rotate = slide.rotate ?? 0;
  const t_brightness = slide.brightness ?? 1.0;
  const t_contrast = slide.contrast ?? 1.0;
  const t_overlayOpacity = slide.overlayOpacity ?? 35;

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
        loading="eager"
        // @ts-expect-error fetchpriority is a valid HTML attribute, lowercase in React 18
        fetchpriority={isFirst ? "high" : "low"}
        decoding={isFirst ? "sync" : "async"}
        className="hero-img absolute inset-0 w-full h-full object-cover"
        style={sharpStyle}
        data-testid={`img-hero-slide-${slide.id}`}
      />
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
  const { data: images = [] } = useHeroImages();
  const slides = images.filter((s) => s.isActive !== false);
  const [tick, setTick] = useState(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (reduced) return;
    if (slides.length <= 1) return;
    const id = window.setInterval(() => setTick((i) => i + 1), ROTATE_MS);
    return () => window.clearInterval(id);
  }, [reduced, slides.length]);

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

  // Slide identity used as the AnimatePresence key. When this changes,
  // the OLD motion.div begins its 200ms exit fade and the NEW motion.div
  // mounts at t=0 with its CSS-animated children starting their reveals.
  // Default sync mode (no mode="wait") — old + new overlap visually for
  // those 200ms, which is precisely how we avoid an empty-headline frame.
  const slideKey = `${copyIndex}-${current?.id ?? "default"}`;

  return (
    <div
      /* MOBILE: 75vh per spec. DESKTOP keeps the larger 78vh via the
         md:h-[78vh] override for the cinematic full-screen feel.
         min-h-[520px] floor and max-h-[860px] ceiling unchanged so the
         hero never collapses on tiny landscape viewports nor balloons
         on ultra-tall monitors. */
      className="hero-isolate relative w-full h-[75vh] md:h-[78vh] min-h-[520px] max-h-[860px] overflow-hidden bg-black"
      data-testid="hero-slider"
      data-hero-state="ready"
    >
      {/* STATIC HERO BASE — first-paint flash kill. */}
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

      {/* STACKED IMAGE LAYER — v4 architecture. */}
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

      {/* OVERLAY COPY — v7 stable mask reveal.
          ====================================================================
          Layout strategy:
          - The OUTER div positions the whole copy block: on mobile it is
            absolute-anchored bottom-20 (80px from hero bottom) with 20px
            (inset-x-5) horizontal padding; on desktop it goes back into
            normal flow and is vertically centred by the parent's
            `md:flex md:items-center` wrapper.
          - INSIDE that outer div there are TWO siblings:
              (a) The "copy stage" — a relative wrapper with EXPLICIT
                  min-h reservations so its height NEVER changes between
                  slides (no jump). The AnimatePresence motion.div is
                  absolutely positioned inset-0 inside this wrapper, so
                  during a slide change the OLD and NEW motion.divs stack
                  on top of each other without re-flowing the layout.
              (b) The "buttons row" — a SEPARATE sibling, NOT inside
                  AnimatePresence. The buttons are rendered exactly once
                  per page mount; they animate in once at t=1000ms and
                  then stay fully visible and stable for the rest of the
                  session, no matter how many slides cycle through.
          This is the architectural fix for the v6.3 "buttons disappear
          and reappear on every slide change" bug — they no longer share
          the AnimatePresence key, so they no longer remount.

          Slide change visual sequence (overlap mode, 200ms exit dur):
            t=0    new motion.div mounts; old motion.div begins exit fade
                   (parent opacity 1 → 0). New badge starts CSS fade
                   (.hero-fade) 0 → 1 over 250ms. Image cross-fade
                   (1200ms) running in parallel.
            t=200  old motion.div fully transparent and unmounted.
                   New badge fully visible. New headline mask-reveal
                   begins (clip-path inset(0 100% 0 0) → inset(0 0 0 0)
                   + opacity 0 → 1 + translateY 8 → 0).
            t=700  Headline ~83% revealed. New subhead begins fade-up.
            t=800  Headline fully revealed.
            t=1050 Subhead fully revealed. Buttons unchanged the whole
                   time — they were rendered once on initial mount and
                   live outside this AnimatePresence subtree. */}
      <div className="absolute inset-0 z-10 md:flex md:items-center">
        <div className="relative w-full h-full md:h-auto max-w-6xl mx-auto md:px-5 md:pt-20">
          <div className="max-w-2xl absolute inset-x-5 bottom-20 md:inset-auto md:bottom-auto md:relative md:max-w-2xl">
            {/* COPY STAGE — reserved-height wrapper for AnimatePresence.
                The min-h-* values match the sum of badge + headline +
                subhead reserved heights at each breakpoint, so the
                wrapper never resizes between slides and the absolute
                motion.div children never push surrounding layout.

                Mobile (default):
                  badge ~30 + mb-6 (24)               = 54
                  headline min-h-[112]                = 112
                  subhead mt-6 (24) + min-h-[52]      = 76
                  TOTAL                               = 242

                sm:  54 + 152 + (24 + 60 = 84) = 290
                md:  54 + 192 + (24 + 68 = 92) = 338
                lg:  54 + 256 + 92            = 402
                xl:  54 + 288 + 92            = 434 */}
            <div className="relative min-h-[242px] sm:min-h-[290px] md:min-h-[338px] lg:min-h-[402px] xl:min-h-[434px]">
              <AnimatePresence initial={false}>
                <motion.div
                  key={`copy-${slideKey}`}
                  initial={false}
                  exit={reduced ? undefined : { opacity: 0 }}
                  transition={{
                    duration: COPY.exit.dur / 1000,
                    ease: [0.22, 1, 0.36, 1],
                  }}
                  className="absolute inset-0"
                >
                  {badge && (
                    <span
                      className={cn(
                        "tron-eyebrow tron-pulse inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/40 bg-black/45 text-[10px] mb-6",
                        !reduced && "hero-fade",
                      )}
                      style={
                        !reduced
                          ? ({
                              ["--hr-start" as any]: `${COPY.badge.start}ms`,
                              ["--hr-dur" as any]: `${COPY.badge.dur}ms`,
                            } as React.CSSProperties)
                          : undefined
                      }
                      data-testid="text-hero-badge"
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      {badge}
                    </span>
                  )}
                  {/* HEADLINE — outer h1 reserves the multi-line height so
                      no layout shift between slides; inner span carries
                      the .hero-mask-reveal animation. The wrapper is
                      `display: block` (set in CSS) so the natural word-
                      wrap behaviour is preserved on narrow viewports —
                      headlines that wrap to 2 or 3 lines reveal cleanly
                      with the clip-path travelling left-to-right across
                      ALL lines simultaneously. */}
                  <h1
                    className="tron-headline-glow text-4xl sm:text-5xl md:text-6xl lg:text-[5rem] xl:text-[5.5rem] font-display font-bold leading-[1.02] text-white tracking-tight min-h-[112px] sm:min-h-[152px] md:min-h-[192px] lg:min-h-[256px] xl:min-h-[288px]"
                    data-testid="text-hero-headline"
                  >
                    {reduced ? (
                      headline
                    ) : (
                      <span
                        className="hero-mask-reveal"
                        style={
                          {
                            ["--hr-start" as any]: `${COPY.headline.start}ms`,
                            ["--hr-dur" as any]: `${COPY.headline.dur}ms`,
                          } as React.CSSProperties
                        }
                      >
                        {headline}
                      </span>
                    )}
                  </h1>
                  {subhead && (
                    <p
                      className={cn(
                        "mt-6 text-base sm:text-lg md:text-xl text-white/90 max-w-xl leading-relaxed min-h-[52px] sm:min-h-[60px] md:min-h-[68px]",
                        !reduced && "hero-fade-up",
                      )}
                      style={
                        !reduced
                          ? ({
                              textShadow: "0 1px 12px rgba(0,0,0,0.7)",
                              ["--hr-start" as any]: `${COPY.subhead.start}ms`,
                              ["--hr-dur" as any]: `${COPY.subhead.dur}ms`,
                            } as React.CSSProperties)
                          : { textShadow: "0 1px 12px rgba(0,0,0,0.7)" }
                      }
                      data-testid="text-hero-subhead"
                    >
                      {subhead}
                    </p>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* CTA BUTTONS — rendered ONCE, OUTSIDE AnimatePresence.
                These do NOT remount on slide change (they don't share the
                slideKey) so they NEVER re-run their entrance animation.
                On initial page mount, the .hero-buttons-once class plays
                a single 380ms fade-up starting at 1000ms; thereafter the
                buttons stay at opacity 1 / translateY 0 forever via
                animation-fill-mode: forwards. */}
            <div
              className={cn(
                "mt-9 flex flex-col sm:flex-row sm:flex-wrap gap-3.5",
                !reduced && "hero-buttons-once",
              )}
              data-testid="hero-buttons-row"
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
                  const target =
                    document.getElementById("transformations") ??
                    document.getElementById("why");
                  target?.scrollIntoView({
                    behavior: "smooth",
                    block: "start",
                  });
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
                className="w-full sm:w-auto shadow-[0_0_0_1px_hsl(195_100%_60%/0.18),0_8px_24px_-6px_hsl(195_100%_60%/0.30)] hover:shadow-[0_0_0_1px_hsl(195_100%_70%/0.30),0_10px_28px_-6px_hsl(195_100%_60%/0.45)]"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Pagination dots */}
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
