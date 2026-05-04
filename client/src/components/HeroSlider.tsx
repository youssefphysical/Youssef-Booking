import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, Eye } from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import type { HeroImage } from "@shared/schema";

// Cinematic image-only hero. Auto-rotates between admin-uploaded slides
// (5.5s cadence), crossfades for 1.2s, and applies a slow Ken Burns
// scale+pan to whichever slide is currently visible. Overlay copy is
// per-slide (title/subtitle/badge); when a slide has no metadata we fall
// back to the global homepage headline so the hero never reads empty.
const ROTATE_MS = 5500;
const FADE_MS = 1200;

function prefersReducedMotion() {
  if (typeof window === "undefined" || !window.matchMedia) return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function HeroSlider() {
  const { t } = useTranslation();
  const { data: images = [], isPending } = useQuery<HeroImage[]>({
    queryKey: ["/api/hero-images"],
  });
  const slides = images.filter((s) => s.isActive !== false);
  const [index, setIndex] = useState(0);
  const reduced = prefersReducedMotion();

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, [slides.length]);

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
      className="relative w-full h-[72vh] min-h-[480px] max-h-[820px] overflow-hidden bg-black"
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

      {/* Image layer — only mounted once a real slide is available, and
          fades in smoothly over the shell. */}
      {current && (
        <AnimatePresence mode="sync">
          <motion.div
            key={current.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: FADE_MS / 1000, ease: "easeInOut" }}
            className="absolute inset-0"
          >
            {/* Ken Burns: slow scale + slight x drift on the image only,
                so the overlay text stays still. Disabled for reduced-motion. */}
            <motion.img
              src={current.imageDataUrl}
              alt=""
              aria-hidden="true"
              loading={safeIndex === 0 ? "eager" : "lazy"}
              // @ts-expect-error fetchpriority is a valid HTML attribute, React 18 lowercase
              fetchpriority={safeIndex === 0 ? "high" : "auto"}
              decoding="async"
              className="w-full h-full object-cover will-change-transform"
              initial={reduced ? false : { scale: 1.0, x: "-1.5%" }}
              animate={reduced ? undefined : { scale: 1.08, x: "1.5%" }}
              transition={
                reduced
                  ? undefined
                  : {
                      duration: (ROTATE_MS + FADE_MS) / 1000,
                      ease: "linear",
                    }
              }
              data-testid={`img-hero-slide-${current.id}`}
            />
          </motion.div>
        </AnimatePresence>
      )}

      {/* TRON layer stack (purely decorative, all pointer-events:none):
          1. Subtle cyan grid — reads as "tech surface" without dominating.
          2. Multi-stop dark gradient — guarantees legibility of overlay copy.
          3. Radial vignette — pulls eye to the centre + darkens corners.
          4. A pair of horizontal energy beams above and below the copy. */}
      <div
        className="absolute inset-0 tron-grid opacity-40 mix-blend-screen pointer-events-none"
        aria-hidden="true"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/30 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/15 to-transparent pointer-events-none" />
      <div className="absolute inset-0 tron-vignette pointer-events-none" />
      <div className="hidden md:block absolute left-0 right-0 top-[28%] tron-beam pointer-events-none" />
      <div className="hidden md:block absolute left-0 right-0 bottom-[18%] tron-beam opacity-60 pointer-events-none" />

      {/* Overlay content */}
      <div className="absolute inset-0 flex items-end md:items-center">
        <div className="w-full max-w-6xl mx-auto px-5 pb-16 md:pb-0 md:pt-20">
          <motion.div
            key={current ? `copy-${current.id}` : "copy-default"}
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: "easeOut", delay: 0.15 }}
            className="max-w-2xl"
          >
            {badge && (
              <span
                className="tron-eyebrow inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/40 bg-primary/10 backdrop-blur-md text-[10px] mb-4"
                data-testid="text-hero-badge"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-primary tron-pulse" />
                {badge}
              </span>
            )}
            <h1
              className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-display font-bold leading-[1.02] text-white drop-shadow-2xl tracking-tight"
              data-testid="text-hero-headline"
              style={{ textShadow: "0 2px 18px rgba(0,0,0,0.65), 0 0 36px hsl(195 100% 60% / 0.18)" }}
            >
              {headline}
            </h1>
            {subhead && (
              <p
                className="mt-4 text-base sm:text-lg md:text-xl text-white/85 max-w-xl leading-relaxed"
                data-testid="text-hero-subhead"
              >
                {subhead}
              </p>
            )}

            <div className="mt-7 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Link href="/book" className="w-full sm:w-auto" data-testid="link-hero-start-transformation">
                <button className="tron-cta w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-semibold whitespace-nowrap btn-press">
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
                className="w-full sm:w-auto"
              />
            </div>
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
