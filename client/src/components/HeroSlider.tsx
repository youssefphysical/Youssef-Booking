import { useEffect, useState, useMemo, memo } from "react";
import { Link } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useHeroImages } from "@/hooks/use-hero-images";
import type { HeroImage } from "@shared/schema";

// HERO MOTION ARCHITECTURE v6 (May-2026, "ultra-smooth pass").
// =====================================================================
// Image layer (unchanged from v4): ALL slides rendered at once, stacked
// absolutely. Visibility controlled by toggling the `data-active`
// attribute (CSS handles the 1200ms compositor-only opacity crossfade
// — see .hero-slide-layer in index.css). HeroSlideLayer is React.memo'd
// so unchanged slides bail out of re-render. The <img> elements are
// never re-mounted, re-fetched, or re-decoded during a slide switch.
// No Ken Burns, no scale animation — the bitmap stays put on its GPU
// layer, only opacity changes.
//
// Copy layer (v6, "ultra-smooth pass"): badge, headline, subheadline
// reveal via pure CSS animations (opacity + translateY + filter:blur)
// driven by three CSS variables (--hr-start, --hr-step, --hr-dur) on
// each reveal element, with a per-token --i index used to compute
// animation-delay = start + i * step. ZERO per-frame React work — the
// splitting happens once at mount.
//
// Changes vs v5.1:
//   - REMOVED the typewriter cursor entirely. With all chars in the DOM
//     from t=0 (just hidden via opacity:0), the cursor would sit at the
//     END of the full headline regardless of typing progress, which on
//     multi-line headlines with the min-h reservation made it appear
//     detached from the typing position ("fake cursor floating in
//     middle of screen"). Apple/Stripe/Linear marketing copy uses no
//     literal cursor either — the char-by-char fade-in IS the
//     typewriter signature.
//   - FASTER typing (25ms step, 200ms dur for headline → ~1175ms total
//     for a 40-char headline, within 0.8-1.2s spec window).
//   - CINEMATIC focus-pull: each token now interpolates filter:blur(4px)
//     → blur(0) along with opacity + translateY. Adds a Apple-quality
//     "depth of field" feel without any extra layout work. Animation is
//     short enough (200ms) that the temporary filter layers are
//     ephemeral and not a mobile compositor concern.
//   - OVERLAP slide transition: AnimatePresence dropped mode="wait", so
//     outgoing copy fades out (200ms) while new copy mounts and starts
//     revealing simultaneously. No gap. Image cross-fade (1200ms) runs
//     in parallel for buttery slide changes.
//   - Premium font: --font-display switched from 'Outfit' to 'Plus
//     Jakarta Sans' (already loaded in client/index.html), which gives
//     the headline a tighter, more Stripe/Linear-grade silhouette.

const ROTATE_MS = 8000;
const FADE_MS = 1200; // mirrored in .hero-slide-layer CSS rule

// COPY REVEAL TIMING (v6, "ultra-smooth pass").
// All values measured from the moment the new copy mounts. Because
// AnimatePresence no longer waits for the exit (mode="wait" dropped),
// the new-copy mount happens at t=0 of the slide change, in parallel
// with the outgoing copy's 200ms fade-out and the image layer's 1200ms
// cross-fade.
//
//   - badge: WORD-mode, 3 tokens × 80ms + 220ms anim ≈ 460ms total
//     for "PREMIUM PERSONAL TRAINING". Within spec 300-500ms. The
//     .tron-eyebrow letter-spacing 0.28em is preserved because
//     letter-spacing applies between glyphs INSIDE each inline-block
//     word span.
//   - headline: char-mode, ~40 chars × 25ms + 200ms anim ≈ 1175ms
//     total. Within spec 0.8-1.2s. Starts 350ms after copy mount —
//     just long enough for the badge to "click into focus" first.
//   - subhead: word-mode, ~13 words × 50ms + 280ms anim ≈ 930ms
//     total. Within spec 800-1200ms. Starts 1300ms in — overlaps
//     the very end of the headline (intentional: the eye reads the
//     completed headline as the subhead begins flowing in).
//   - buttons: single 380ms fade+translateY(8px → 0) starting at
//     2100ms (overlaps the very end of the subhead). Within spec
//     300-500ms.
// Total reveal ~2480ms — snappier than v5.1's 2920ms (about 15%
// faster), well within ROTATE_MS=8000 so buttons are fully visible
// and clickable for ~5.5s before the next slide change.
const COPY = {
  badge:    { start:    0, step: 80, dur: 220 },
  headline: { start:  350, step: 25, dur: 200 },
  subhead:  { start: 1300, step: 50, dur: 280 },
  buttons:  { start: 2100,           dur: 380 },
  exit:     { dur: 200 }, // outgoing copy fade-out (overlaps with new reveal)
};

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

// HERO COPY REVEAL — character/word typewriter via CSS animations.
// =====================================================================
// The text is split into per-token <span>s with a CSS variable `--i`
// that drives the per-token animation-delay. The animation itself is
// pure CSS (heroReveal keyframe in index.css) — no framer-motion, no
// per-frame React work, no main-thread JS during the reveal.
//
// Splitting strategy:
//   - "char" mode: text is split by whitespace into words; each non-
//     whitespace word is split into its individual characters and
//     wrapped in <span class="hero-reveal">. Whitespace tokens are
//     emitted as plain text between word-spans so the browser can
//     wrap naturally at word boundaries (display:inline-block on the
//     char-spans would otherwise prevent line-breaks mid-word).
//   - "word" mode: each whitespace-separated word becomes one
//     <span class="hero-reveal">. Used for the subhead so longer
//     prose feels reading-paced rather than typewritten.
//
// Accessibility:
//   - The full text is rendered once inside a <span class="sr-only">
//     so assistive tech reads the headline as one phrase, not
//     character-by-character.
//   - The visual span tree is marked aria-hidden so it is invisible
//     to screen readers.
//   - When prefers-reduced-motion: reduce is set, the parent short-
//     circuits and renders plain text — no spans, no animation.
function HeroReveal({
  text,
  mode,
  startMs,
  stepMs,
  durMs,
}: {
  text: string;
  mode: "char" | "word";
  startMs: number;
  stepMs: number;
  durMs: number;
}) {
  // Splitting is cheap but memoised so it documents intent and avoids
  // re-running on parent re-render (text only changes when the slide
  // changes, which remounts this component anyway via the parent's
  // AnimatePresence key).
  const tokens = useMemo(() => {
    return text
      .split(/(\s+)/)
      .filter(Boolean)
      .map((tok) => ({
        text: tok,
        isSpace: /^\s+$/.test(tok),
        chars: mode === "char" && !/^\s+$/.test(tok) ? Array.from(tok) : null,
      }));
  }, [text, mode]);

  let i = 0;
  const styleVars = {
    ["--hr-start" as any]: `${startMs}ms`,
    ["--hr-step" as any]: `${stepMs}ms`,
    ["--hr-dur" as any]: `${durMs}ms`,
  } as React.CSSProperties;

  return (
    <span style={styleVars}>
      <span className="sr-only">{text}</span>
      <span aria-hidden="true">
        {tokens.map((tok, ti) => {
          if (tok.isSpace) return tok.text;
          if (mode === "word") {
            const idx = i++;
            return (
              <span
                key={ti}
                className="hero-reveal"
                style={{ ["--i" as any]: idx } as React.CSSProperties}
              >
                {tok.text}
              </span>
            );
          }
          // char mode — wrap chars in word-wrappers so the browser
          // still treats each word as unbreakable at the inline-block
          // level, but lets long lines wrap at word boundaries.
          return (
            <span key={ti} className="hero-reveal-word">
              {tok.chars!.map((c, ci) => {
                const idx = i++;
                return (
                  <span
                    key={ci}
                    className="hero-reveal"
                    style={{ ["--i" as any]: idx } as React.CSSProperties}
                  >
                    {c}
                  </span>
                );
              })}
            </span>
          );
        })}
      </span>
    </span>
  );
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
  // the old copy starts its 200ms exit fade and the new copy mounts
  // simultaneously (no mode="wait" — overlap is intentional).
  const slideKey = `${copyIndex}-${current?.id ?? "default"}`;

  return (
    <div
      className="hero-isolate relative w-full h-[78vh] min-h-[520px] max-h-[860px] overflow-hidden bg-black"
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

      {/* OVERLAY COPY — ultra-smooth reveal v6.
          AnimatePresence WITHOUT mode="wait": the outgoing copy fades
          out over 200ms while the new copy mounts and starts revealing
          simultaneously. The eye reads this as a buttery overlap — no
          gap, no flicker. Pairs with the image layer's parallel 1200ms
          cross-fade for a single coherent slide change. The new badge/
          headline/subhead/buttons reveal themselves via pure CSS
          animations driven by HeroReveal and the .hero-reveal /
          .hero-button-reveal rules in index.css. Reduced-motion users
          get plain text instantly — the entire reveal apparatus is
          skipped. */}
      <div className="absolute inset-0 z-10 flex items-end md:items-center">
        <div className="relative w-full max-w-6xl mx-auto px-5 pb-20 md:pb-0 md:pt-20">
          <AnimatePresence initial={false}>
            <motion.div
              key={`copy-${slideKey}`}
              initial={false}
              animate={{ opacity: 1, pointerEvents: "auto" }}
              /* pointerEvents:"none" on exit is CRITICAL: while two
                 copies coexist during the 200ms overlap window, the
                 exiting layer (opacity:0, absolute positioned at the
                 same z as the new layer) MUST NOT intercept taps for
                 the new CTAs. pointer-events transitions discretely
                 (no interpolation) so the flip happens immediately
                 when exit starts — the new layer captures all clicks
                 from frame 1 of the slide change. */
              exit={
                reduced ? undefined : { opacity: 0, pointerEvents: "none" }
              }
              transition={{
                duration: COPY.exit.dur / 1000,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="max-w-2xl absolute inset-x-5 md:inset-x-0 md:relative"
            >
              {badge && (
                <span
                  className="tron-eyebrow tron-pulse inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/40 bg-black/45 text-[10px] mb-6"
                  data-testid="text-hero-badge"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                  {reduced ? (
                    badge
                  ) : (
                    <HeroReveal
                      text={badge}
                      mode="word"
                      startMs={COPY.badge.start}
                      stepMs={COPY.badge.step}
                      durMs={COPY.badge.dur}
                    />
                  )}
                </span>
              )}
              {/* min-h-* reserves space for ~3 lines at every breakpoint
                  so the buttons row never jumps when admin/i18n
                  produces shorter or longer titles between slides
                  (line-height ≈ 1.02 × font-size × 3 lines):
                    text-4xl  (36px)   → 3 lines ≈ 110px → 112
                    text-5xl  (48px)   → 3 lines ≈ 147px → 152
                    text-6xl  (60px)   → 3 lines ≈ 184px → 192
                    text-[5rem] (80px) → 3 lines ≈ 245px → 256
                    text-[5.5rem](88px)→ 3 lines ≈ 269px → 288  */}
              <h1
                className="tron-headline-glow text-4xl sm:text-5xl md:text-6xl lg:text-[5rem] xl:text-[5.5rem] font-display font-bold leading-[1.02] text-white tracking-tight min-h-[112px] sm:min-h-[152px] md:min-h-[192px] lg:min-h-[256px] xl:min-h-[288px]"
                data-testid="text-hero-headline"
              >
                {reduced ? (
                  headline
                ) : (
                  <HeroReveal
                    text={headline}
                    mode="char"
                    startMs={COPY.headline.start}
                    stepMs={COPY.headline.step}
                    durMs={COPY.headline.dur}
                  />
                )}
              </h1>
              {subhead && (
                /* min-h-* reserves space for 2 lines at every breakpoint
                   (text × leading-relaxed ≈ 1.625):
                     text-base (16) → 2 × 26 ≈ 52
                     text-lg   (18) → 2 × 29 ≈ 60
                     text-xl   (20) → 2 × 33 ≈ 68 */
                <p
                  className="mt-6 text-base sm:text-lg md:text-xl text-white/90 max-w-xl leading-relaxed min-h-[52px] sm:min-h-[60px] md:min-h-[68px]"
                  style={{ textShadow: "0 1px 12px rgba(0,0,0,0.7)" }}
                  data-testid="text-hero-subhead"
                >
                  {reduced ? (
                    subhead
                  ) : (
                    <HeroReveal
                      text={subhead}
                      mode="word"
                      startMs={COPY.subhead.start}
                      stepMs={COPY.subhead.step}
                      durMs={COPY.subhead.dur}
                    />
                  )}
                </p>
              )}

              <div
                className={cn(
                  "mt-9 flex flex-col sm:flex-row sm:flex-wrap gap-3.5",
                  !reduced && "hero-button-reveal",
                )}
                style={
                  !reduced
                    ? ({
                        ["--hr-start" as any]: `${COPY.buttons.start}ms`,
                        ["--hr-dur" as any]: `${COPY.buttons.dur}ms`,
                      } as React.CSSProperties)
                    : undefined
                }
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
            </motion.div>
          </AnimatePresence>
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
