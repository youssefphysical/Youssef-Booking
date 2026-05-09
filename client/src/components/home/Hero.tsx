import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useHomepageContent } from "@/hooks/use-homepage-content";
import { WhatsAppButton } from "@/components/WhatsAppButton";

/**
 * Cinematic hero — Tron Legacy interface, NOT a SaaS landing header.
 *
 * Composition rules (per the May-2026 cinematic-rebuild brief):
 *  • Full-bleed image consumed at the bottom by a hard fade-to-black
 *    so the photo dissolves into the void instead of cutting on a hard
 *    edge. The void IS the frame.
 *  • Editorial eyebrow: thin AMBER leading rule (.hero-eyebrow-rule)
 *    + uppercase tracking — reads as a luxury film credit. NO pill,
 *    NO border, NO bg.
 *  • Oversized headline (.hero-headline-fluid) sits asymmetric-left,
 *    bottom-anchored. Long-language safety via .hero-headline-fluid's
 *    overflow-wrap:anywhere + hyphens:auto.
 *  • Tron horizon line (.hero-horizon) at the very bottom marks the
 *    section boundary as one continuous luxury seam (replaces the
 *    "card-on-card" SaaS feel).
 *
 * CMS-driven via /api/homepage-content key="hero", with safe inline
 * fallbacks via t(key, fallback) so the section ALWAYS renders.
 */
export function Hero() {
  const { t } = useTranslation();
  const { data: content } = useHomepageContent();
  const c = content?.hero;

  const eyebrow =
    c?.eyebrow ||
    t("hero.cinematic.eyebrow", "PREMIUM PERSONAL TRAINING · DUBAI");
  const headline =
    c?.title || t("hero.cinematic.headline", "Your transformation starts here.");
  const subhead =
    c?.subtitle ||
    t(
      "hero.cinematic.subhead",
      "Science-based coaching in Dubai for fat loss, muscle gain, and long-term performance.",
    );
  const ctaPrimaryLabel =
    c?.ctaPrimaryLabel ||
    t("hero.cinematic.startTransformation", "Start your transformation");
  const ctaPrimaryHref = c?.ctaPrimaryHref || "/book";
  const ctaSecondaryLabel = c?.ctaSecondaryLabel || null;
  const ctaSecondaryHref = c?.ctaSecondaryHref || null;

  const imageSrc = c?.imageDataUrl || "/hero-initial.webp";
  const imageAlt =
    c?.imageAlt || t("hero.cinematic.imageAlt", "Premium personal training in Dubai");
  const overlayAlpha = (c?.overlayOpacity ?? 45) / 100;
  const blurPx = c?.blurIntensity ?? 0;
  const objPosDesktop = c?.objectPositionDesktop || "center center";
  const objPosMobile = c?.objectPositionMobile || "center center";

  return (
    <section
      className="relative w-full h-[82svh] min-h-[560px] md:min-h-[720px] lg:min-h-[760px] max-h-[920px] overflow-hidden bg-black"
      data-testid="cinematic-hero"
    >
      {/* IMAGE — full-bleed. Mobile object-position differs because portrait
          phones crop wider crops differently. Both are CMS-tunable. */}
      <picture aria-hidden="true">
        <source media="(min-width: 768px)" srcSet={imageSrc} />
        <img
          src={imageSrc}
          alt=""
          loading="eager"
          // @ts-expect-error fetchpriority is valid HTML
          fetchpriority="high"
          decoding="sync"
          className="absolute inset-0 w-full h-full object-cover md:hidden"
          style={{ objectPosition: objPosMobile, filter: blurPx ? `blur(${blurPx}px)` : undefined }}
        />
        <img
          src={imageSrc}
          alt={imageAlt}
          loading="eager"
          // @ts-expect-error fetchpriority is valid HTML
          fetchpriority="high"
          decoding="sync"
          className="absolute inset-0 w-full h-full object-cover hidden md:block"
          style={{ objectPosition: objPosDesktop, filter: blurPx ? `blur(${blurPx}px)` : undefined }}
        />
      </picture>

      {/* CINEMATIC VEIL — radial centre wash + hard bottom fade-to-black so
          the image bleeds into the void. Overlay alpha is CMS-tunable
          (slider 0-100% in the admin CMS). The bottom 55% is the copy zone;
          the gradient drops to pure black exactly where the headline sits. */}
      <div
        className="absolute inset-0 pointer-events-none"
        aria-hidden="true"
        style={{
          background: `radial-gradient(120% 80% at 60% 40%, rgba(0,0,0,${overlayAlpha * 0.6}) 0%, rgba(0,0,0,${overlayAlpha}) 60%, rgba(0,0,0,0.95) 100%)`,
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-[60%] pointer-events-none"
        aria-hidden="true"
        style={{
          background:
            "linear-gradient(to top, rgba(0,0,0,1) 0%, rgba(0,0,0,0.92) 35%, rgba(0,0,0,0.55) 65%, rgba(0,0,0,0) 100%)",
        }}
      />

      {/* COPY — asymmetric editorial. Bottom-anchored on mobile, lower-third
          centre-left on desktop. Max-w-3xl so long English headlines stay
          on 2-3 lines on 1440. */}
      <div className="absolute inset-0 z-10 flex items-end md:items-center">
        <div className="w-full max-w-6xl mx-auto px-5 md:px-8 pb-16 md:pb-24 lg:pb-28">
          <div className="max-w-3xl">
            <div
              className="hero-eyebrow inline-flex items-center gap-3 mb-5 sm:mb-6 text-[10px] sm:text-[11px] tracking-[0.32em] uppercase text-white/75"
              data-testid="text-cinematic-eyebrow"
            >
              <span className="hero-eyebrow-rule" aria-hidden="true" />
              <span>{eyebrow}</span>
            </div>
            <h1
              className="hero-headline-fluid font-display font-bold text-white hero-text-shadow"
              data-testid="text-cinematic-headline"
            >
              {headline}
            </h1>
            {subhead && (
              <p
                className="mt-5 sm:mt-6 text-base sm:text-lg md:text-xl text-white/85 max-w-2xl leading-[1.55] hero-text-shadow"
                data-testid="text-cinematic-subhead"
              >
                {subhead}
              </p>
            )}
            <div className="mt-8 sm:mt-9 flex flex-col sm:flex-row gap-3 sm:gap-3.5">
              {ctaPrimaryHref?.startsWith("/") ? (
                <Link href={ctaPrimaryHref} className="w-full sm:w-auto">
                  <button
                    className="tron-cta tron-cta-breathe w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl font-semibold whitespace-nowrap btn-press"
                    data-testid="button-cinematic-primary"
                  >
                    {ctaPrimaryLabel}
                    <ArrowRight size={18} />
                  </button>
                </Link>
              ) : (
                <a href={ctaPrimaryHref || "#"} className="w-full sm:w-auto">
                  <button className="tron-cta tron-cta-breathe w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl font-semibold whitespace-nowrap btn-press">
                    {ctaPrimaryLabel}
                    <ArrowRight size={18} />
                  </button>
                </a>
              )}
              {ctaSecondaryLabel && ctaSecondaryHref ? (
                ctaSecondaryHref.startsWith("/") ? (
                  <Link href={ctaSecondaryHref} className="w-full sm:w-auto">
                    <button className="tron-glass-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-semibold whitespace-nowrap btn-press">
                      {ctaSecondaryLabel}
                    </button>
                  </Link>
                ) : (
                  <a href={ctaSecondaryHref} className="w-full sm:w-auto">
                    <button className="tron-glass-btn w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl font-semibold whitespace-nowrap btn-press">
                      {ctaSecondaryLabel}
                    </button>
                  </a>
                )
              ) : (
                <WhatsAppButton
                  label={t("hero.cinematic.whatsapp", "Message Coach Youssef")}
                  message={t(
                    "hero.cinematic.whatsappMsg",
                    "Hi Coach Youssef, I'd like to start training with you.",
                  )}
                  size="md"
                  testId="button-cinematic-whatsapp"
                  className="w-full sm:w-auto"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* TRON HORIZON — cinematic seam between hero and the next section.
          Replaces the "section-card-on-card" SaaS feel. */}
      <div
        className="hero-horizon absolute inset-x-0 bottom-0 z-[5]"
        aria-hidden="true"
      />
    </section>
  );
}
