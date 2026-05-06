import { useEffect, useState, memo } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useHeroImages } from "@/hooks/use-hero-images";
import type { HeroImage } from "@shared/schema";

// HERO MOTION ARCHITECTURE v8.1 (May-2026, "JITTER-FREE MASK REVEAL").
// =====================================================================
// Image layer (unchanged from v4): ALL slides rendered at once, stacked
// absolutely. Visibility controlled by toggling the `data-active`
// attribute (CSS handles the 1200ms compositor-only opacity crossfade
// — see .hero-slide-layer in index.css). HeroSlideLayer is React.memo'd
// so unchanged slides bail out of re-render. The <img> elements are
// never re-mounted, re-fetched, or re-decoded during a slide switch.
//
// Copy layer (v8.1, "jitter-free mask reveal") — re-introduces the
// clip-path mask reveal on the headline that v8 had removed, but
// engineered specifically to eliminate the v7 jitter the user reported.
//
// V7 JITTER ROOT CAUSE: the v7 .hero-mask-reveal animated THREE
// properties simultaneously — clip-path, translateY(8→0), AND
// opacity(0→1) — with `will-change: opacity, transform, clip-path`.
// The combination of clip-path narrowing the visible width WHILE
// translateY shifted the rasterised text vertically caused per-frame
// subpixel shifts on the text glyphs. On multi-line headlines the
// effect was magnified at line-break boundaries (which often land at
// fractional pixel positions). The over-broad will-change list also
// caused unnecessary compositor layer thrash.
//
// v8.1 FIX: animate ONLY clip-path on the inner wrapper. NO translateY.
// NO opacity (the visible region is always at full opacity; the only
// thing changing is which portion of the box is visible). Force the
// wrapper onto its own GPU layer with transform: translateZ(0) +
// backface-visibility: hidden so the rasterised text stays at integer
// pixel coordinates for the entire animation. Narrow will-change to
// just `clip-path`. Duration 800ms (mid-range of spec's 700-1000ms)
// with cubic-bezier(0.22, 1, 0.36, 1) Apple-style ease-out-quint.
// Result: pure left-to-right reveal, identical visual to v7 but with
// ZERO subpixel jitter.
//
// Preserved from v8 (FINAL HERO STABILIZATION strict mode):
//   - NO text-shadow / glow on headline (.tron-headline-glow gone).
//   - NO inline textShadow on subhead.
//   - NO per-character splitting, NO setInterval per letter, NO
//     React per-char state, NO cursor element of any kind.
//   - AnimatePresence in mode="wait" — old fully exits, then new
//     mounts and reveals. Animation restarts ONLY when textKey
//     (badge|headline|subhead content hash) changes; same-text
//     re-renders never restart the reveal — see textKey docstring
//     near line 212 for full rationale (v8.2 anti-double-replay fix).
//   - Badge:    .hero-fade        — opacity 0→1, 200ms.
//   - Headline: <h1> reserves multi-line height; INNER span has
//                .hero-mask-reveal — clip-path inset(0 100% 0 0) →
//                inset(0 0 0 0), 800ms, starts at 100ms.
//   - Subhead:  .hero-fade-up     — opacity 0→1 + translateY(6→0),
//                                    400ms, starts at 700ms (after the
//                                    headline reveal is ~75% complete,
//                                    so the cascade still reads
//                                    badge → headline → subhead).
//   - Buttons:  .hero-buttons-once — opacity + translateY 300ms,
//                                    starts at 500ms, one-time mount,
//                                    OUTSIDE AnimatePresence — NEVER
//                                    remount on slide change.
//
// Performance:
//   - Animates ONLY opacity, transform, and clip-path (per spec
//     literal "Animate only: opacity, transform, mask/clip-path").
//   - Does NOT animate width, height, font-size, filter, blur (per
//     spec literal "Do NOT animate: width / height / font-size /
//     filter / blur").
//   - Each animated element gets ONE compositor layer.
//   - First-paint flash kill (static base image, fetchpriority high)
//     unchanged from v5.

const ROTATE_MS = 8000;
const FADE_MS = 1200; // mirrored in .hero-slide-layer CSS rule

// COPY REVEAL TIMING (v8.1).
// All values measured from the moment the new copy mounts. Because
// AnimatePresence runs in mode="wait", the new-copy mount happens
// AFTER the old copy's 200ms exit fade fully completes. So the user
// experiences:
//   t = 0    …  old copy fades out (200ms)
//   t = 200  …  swap; new copy mounts; new badge begins fading in
//   t = 300  …  new headline mask-reveal begins (clip-path 0% → 100%)
//   t = 400  …  new badge fully visible
//   t = 900  …  new subhead begins fade-up
//   t = 1100 …  new headline fully revealed (clip-path complete)
//   t = 1300 …  new subhead fully visible (slide change complete)
// The image layer's 1200ms cross-fade runs in parallel underneath.
//
// Buttons are special — they live OUTSIDE AnimatePresence and animate
// in ONCE on initial page mount only. They do NOT re-animate on any
// slide change. Per spec literal: "Buttons appear once on first load.
// NEVER animate again. NEVER hide on slide change. NEVER move
// position."
const COPY = {
  badge:    { start:   0, dur: 200 },  // spec carries from v8: badge fade 200ms
  headline: { start: 100, dur: 800 },  // spec: "Duration: 700-1000ms" mask reveal
  subhead:  { start: 700, dur: 400 },  // bumped from 200ms start so cascade reads
                                       // badge → headline → subhead even with the
                                       // new 800ms headline reveal
  buttons:  { start: 500, dur: 300 },  // unchanged — buttons stay on their v8 timing
  exit:     { dur: 200 },              // unchanged — fade-out before swap
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

  // V8.2 ANIMATION RESTART RULE — content-based keying.
  // ====================================================================
  // PROBLEM (v8.1 and earlier): the AnimatePresence key was slide
  // *identity*-based (`${copyIndex}-${current?.id ?? "default"}`).
  // On hard refresh this caused a visible double-replay:
  //
  //   t = 0      Component mounts. useHeroImages() returns
  //              `data: undefined` (or the build-baked seed of just
  //              the first slide). `current` is undefined → slideKey
  //              = "0-default". motion.div mounts with this key. CSS
  //              reveals fire — text appears correctly.
  //   t = ~150ms queryFn resolves with the FULL active list (the hook
  //              uses `initialDataUpdatedAt: 0` to force a refetch
  //              even when initialData was seeded, because the seed
  //              only contains the first slide). `current` = images[0]
  //              → slideKey changes from "0-default" to "0-<id>".
  //              AnimatePresence detects key change → fades old out
  //              200ms → mounts new → CSS reveals run AGAIN. User
  //              sees text disappear-then-replay even though the
  //              displayed text is identical.
  //
  // FIX: key by displayed CONTENT, not slide identity. If the rendered
  // badge + headline + subhead text is the same string before and
  // after the API resolves (which is the common case — the build-time
  // bake mirrors the same first slide the API returns), then textKey
  // is identical and motion.div is NEVER remounted. The CSS reveal
  // plays exactly ONCE on initial mount and stays settled.
  //
  // This is the React-idiomatic equivalent of the spec's suggested
  // pattern:
  //   if (textKey === lastAnimatedTextKey.current) { /* no replay */ }
  //   else { lastAnimatedTextKey.current = textKey; /* replay */ }
  // Using textKey as the React key delegates the comparison to React's
  // reconciler — same outcome, no extra ref / state. When textKey
  // changes (genuine slide change, locale switch, admin edit, or
  // copyIndex rotation that picks a different variant), motion.div
  // remounts and the reveal plays exactly once. When textKey stays
  // the same (initial vs API-resolved with identical content, parent
  // re-render for unrelated reasons), motion.div stays mounted and
  // the reveal does NOT replay.
  //
  // Per spec literal: "Only restart text reveal when: slide id changes
  // to a genuinely different slide OR headline/badge/subheadline text
  // actually changes." textKey covers both: if text changes for any
  // reason, key changes, reveal replays. If text doesn't change, key
  // doesn't change, reveal doesn't replay.
  // JSON.stringify on a tuple is collision-proof: two text values
  // can never be reordered to produce the same key even if they
  // contain pipe-or-other delimiter characters.
  const textKey = JSON.stringify([badge ?? "", headline ?? "", subhead ?? ""]);

  return (
    <div
      /* MOBILE: 75vh per spec. DESKTOP keeps the larger 78vh via the
         md:h-[78vh] override for the cinematic full-screen feel.
         min-h-[520px] floor and max-h-[860px] ceiling unchanged so the
         hero never collapses on tiny landscape viewports nor balloons
         on ultra-tall monitors. */
      /* v8.8 (May-2026): bg-[#0c1826] -> bg-transparent. Per the
         "UNIFY HOMEPAGE BACKGROUND SECTIONS" spec, the hero wrapper
         is now transparent so the new .homepage-shell page-level
         background (radial accent + 4-stop dark navy gradient,
         applied on the homepage parent div) shows through any
         sub-pixel gap at the bottom edge. This eliminates the
         visible bands between hero, Youssef Ahmed, and About
         sections by ensuring all sections sit on the same
         continuous shell background. The v8.7.3 sub-pixel-gap
         insight is preserved — the gap is still invisible because
         the shell behind the wrapper matches the shell behind the
         next section (they're the SAME shell). */
      className="hero-isolate relative w-full h-[75vh] md:h-[78vh] min-h-[520px] max-h-[860px] overflow-hidden bg-transparent"
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

      {/* HERO VISUAL POLISH OVERLAYS (v8.7 + v8.7.1, May-2026).
          Two decorative layers on top of the image, both below the
          z-10 copy overlay so neither dims badge/headline/subhead/
          CTAs. pointer-events:none on both so clicks pass through.

          (a) .hero-overlay (z-2) — center-balanced radial wash that
              evens left/right brightness across the whole hero.
              UNCHANGED in v8.7.1.
          (b) .hero-bottom-blend (z-3) — v8.7.1: replaces v8.7's
              .hero-bottom-overlay. Taller (clamp 120-180px vs the
              previous 160px fixed), 4-stop gradient ramping to FULL
              opacity at the very bottom row in the next section's
              exact composited color (rgb(12,24,38)) — zero hue or
              luminance delta at the seam, no perceived "frosted"
              zone above the section line.

          Text contrast is provided by .hero-text-shadow on the h1
          and subhead p (subtle 1px+8px shadow on the glyphs
          themselves — no rectangle, no scrim, no blur). UNCHANGED.

          The optional .hero-image mask from the v8.7.1 spec was
          SKIPPED per the spec's own safety rule — masking the image
          layers would interfere with the slide cross-fade animation.

          See `.hero-overlay`, `.hero-bottom-blend`,
          `.hero-text-shadow` in index.css for full rationale. */}
      <div className="hero-overlay" aria-hidden="true" data-testid="hero-overlay" />
      <div className="hero-bottom-blend" aria-hidden="true" data-testid="hero-bottom-blend" />

      {/* OVERLAY COPY — v8 simple stable fade.
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
                  absolutely positioned inset-0 inside this wrapper. With
                  mode="wait" only ONE motion.div is mounted at a time —
                  old fades out fully, then new mounts and fades in.
              (b) The "buttons row" — a SEPARATE sibling, NOT inside
                  AnimatePresence. The buttons are rendered exactly once
                  per page mount; they animate in once at t=500ms and
                  then stay fully visible and stable for the rest of the
                  session, no matter how many slides cycle through.

          Slide change visual sequence (mode="wait", 200ms exit dur):
            t=0    old motion.div begins exit fade (opacity 1 → 0).
                   Image cross-fade (1200ms) running in parallel.
            t=200  old fully transparent + unmounted. New mounts.
                   New badge begins .hero-fade (200ms).
            t=300  new headline begins .hero-fade-up (300ms).
            t=400  new badge fully visible. New subhead begins
                   .hero-fade-up (400ms).
            t=600  new headline fully visible.
            t=800  new subhead fully visible. Buttons unchanged the
                   whole time — they were rendered once on initial
                   mount and live OUTSIDE this AnimatePresence
                   subtree. */}
      <div className="absolute inset-0 z-10 md:flex md:items-center">
        <div className="relative w-full h-full md:h-auto max-w-6xl mx-auto md:px-5 md:pt-20">
          <div className="max-w-2xl absolute inset-x-4 bottom-20 md:inset-auto md:bottom-auto md:relative md:max-w-2xl text-start sm:inset-x-5">
            {/* COPY STAGE — reserved-height wrapper for AnimatePresence.
                The min-h-* values match the sum of badge + headline +
                subhead reserved heights at each breakpoint, so the
                wrapper never resizes between slides and the absolute
                motion.div children never push surrounding layout.

                v8.6 RECALC (May-2026, headline leading 1.02 → 1.1):
                  badge ~30 + mb-6 (24)               = 54
                  headline min-h-[120]                = 120  (was 112)
                  subhead mt-6 (24) + min-h-[52]      = 76
                  TOTAL                               = 250  (was 242)

                sm:  54 + 160 + 84  = 298  (was 290)
                md:  54 + 200 + 92  = 346  (was 338)
                lg:  54 + 268 + 92  = 414  (was 402)
                xl:  54 + 296 + 92  = 442  (was 434)
                +8px to +12px per breakpoint to absorb the new leading
                without per-mount layout shift (CLS=0). On mobile the
                copy block is bottom-anchored (`bottom-20`) so the
                only visible delta vs v8.5 is the badge sitting ~8px
                higher; CTAs and subhead viewport positions are
                anchor-stable. */}
            <div className="relative min-h-[250px] sm:min-h-[298px] md:min-h-[346px] lg:min-h-[414px] xl:min-h-[442px]">
              {/* v8.7 (May-2026): the v8.6 .hero-text-scrim div has
                  been removed. Text contrast is now provided by the
                  .hero-text-shadow class on the h1 and subhead p
                  themselves (see those elements below). */}
              <AnimatePresence initial={false} mode="wait">
                <motion.div
                  key={`copy-${textKey}`}
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
                        "tron-eyebrow tron-pulse inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/40 bg-black/45 text-[10px] mb-4",
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
                  {/* HEADLINE — v8.1 jitter-free mask reveal.
                      Outer h1 reserves the multi-line height via Tailwind
                      min-h-* utilities so the headline area NEVER changes
                      size between slides (no layout shift, no width/
                      height animation). The h1 itself carries NO
                      animation class — it stays fully static.
                      The INNER span carries the .hero-mask-reveal
                      animation: clip-path inset(0 100% 0 0) → inset(0
                      0 0 0), 800ms, cubic-bezier(0.22, 1, 0.36, 1).
                      That's the ONLY animated property — no translateY,
                      no opacity, no font-size, no width. The wrapper
                      is `display: block` (set in CSS) so multi-line
                      headlines wrap naturally and reveal left-to-right
                      across all lines simultaneously.
                      Reduced-motion users: short-circuit to plain text
                      with no animation wrapper. */}
                  {/* HEADLINE TYPOGRAPHY (v8.6 + v8.7 polish):
                      - leading 1.1, tracking-[-0.015em], bumped min-h
                        from v8.6 — all kept.
                      - v8.7: added .hero-text-shadow class for very
                        subtle separation from the photo behind. Two
                        stacked text-shadows (1px crisp drop + 8px
                        soft halo, both very low alpha) so the text
                        stays 100% sharp — no blur, no glow.
                      - mask-reveal animation on inner span unchanged. */}
                  <h1
                    className="hero-headline-fluid font-display font-bold leading-[1.12] text-white tracking-[-0.015em] min-h-[120px] sm:min-h-[160px] md:min-h-[200px] lg:min-h-[268px] xl:min-h-[296px] hero-text-shadow"
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
                  {/* SUBHEAD TYPOGRAPHY (v8.6 + v8.7 polish):
                      - text-white/85 + leading-[1.65] from v8.6 kept.
                      - v8.7: added .hero-text-shadow for the same
                        subtle glyph separation as the headline.
                      - All other classes (size, max-w, hero-fade-up
                        animation, min-h reservations) unchanged. */}
                  {subhead && (
                    <p
                      className={cn(
                        "mt-5 text-base sm:text-lg md:text-xl text-white/85 max-w-xl leading-[1.55] min-h-[52px] sm:min-h-[60px] md:min-h-[68px] hero-text-shadow hero-subhead-wrap",
                        !reduced && "hero-fade-up",
                      )}
                      style={
                        !reduced
                          ? ({
                              ["--hr-start" as any]: `${COPY.subhead.start}ms`,
                              ["--hr-dur" as any]: `${COPY.subhead.dur}ms`,
                            } as React.CSSProperties)
                          : undefined
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
                textKey) so they NEVER re-run their entrance animation.
                On initial page mount, the .hero-buttons-once class plays
                a single 300ms fade-up starting at 500ms; thereafter the
                buttons stay at opacity 1 / translateY 0 forever via
                animation-fill-mode: forwards.

                Mobile vertical-budget tightening (carried forward from
                v7.1): on the smallest viewports (75vh of a 600px portrait
                phone falls back to the 520px min-h floor), `mt-6 sm:mt-9
                gap-2 sm:gap-3.5` keeps mobile content at ~506px (vs
                530px with full desktop spacing) — leaves 14px headroom
                on the 520px floor while preserving tablet/desktop
                spacing exactly. */}
            <div
              className={cn(
                "mt-7 sm:mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-2.5 sm:gap-3.5",
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
          className="absolute bottom-4 sm:bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 z-10"
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
