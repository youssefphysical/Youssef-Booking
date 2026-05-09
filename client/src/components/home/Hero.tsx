import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Calendar,
  ShieldCheck,
  MapPin,
  Sparkles,
  Trophy,
  Award,
  ImageOff,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import type { HomepageSectionContent } from "@/hooks/use-homepage-content";
import { SmartImage } from "@/components/SmartImage";

/**
 * Tron-Legacy split hero — Cinematic Refinement Pass (May-2026).
 *
 * Refinements over the original split (no architecture changes):
 *   • Cinematic typography — larger headline (clamp up to 5.25rem),
 *     tighter tracking (-0.025em), italic accent on the final word
 *     for emotional dominance.
 *   • Image frame softened — border white/[0.06] (was /10), corner
 *     radius bumped to 28px, ambient cyan halo widened + intensified,
 *     plus a subtle vignette layer integrates the subject into the
 *     page rather than presenting them inside a hard frame.
 *   • Limited-capacity microcopy under the CTAs introduces selective
 *     onboarding language — quiet luxury psychology, no fake countdowns.
 *   • Mobile pt 10→8 / pb 16→14 to ease scroll fatigue.
 *
 * CMS bindings, focal-point control, and the mediaAsset responsive
 * pipeline are preserved exactly as before.
 */
export function Hero({ section }: { section?: HomepageSectionContent | null }) {
  const { t } = useTranslation();
  const [imgErrored, setImgErrored] = useState(false);

  const eyebrow = section?.eyebrow || t("hero2.eyebrow", "PREMIUM COACHING • REAL RESULTS");
  const title = section?.title || t("hero2.title", "Built for Real Transformation.");
  const titleAccent = t("hero2.titleAccent", "Transformation.");
  const titleParts = title.endsWith(titleAccent)
    ? [title.slice(0, title.length - titleAccent.length).trimEnd(), titleAccent]
    : [title, ""];

  const body =
    section?.body ||
    t(
      "hero2.body",
      "Elite coaching, structured training, and science-backed protocols — designed around your body, your lifestyle, and your goals.",
    );

  const ctaPrimary = section?.ctaPrimaryLabel || t("hero2.ctaPrimary", "Book Your Session");
  const ctaPrimaryHref = section?.ctaPrimaryHref || "/book";
  const ctaSecondary = section?.ctaSecondaryLabel || t("hero2.ctaSecondary", "Message Coach on WhatsApp");

  const img = (section?.imageDataUrl || "").trim();
  const hasImage = img.length >= 40 && !imgErrored;
  const overlay = Math.max(0, Math.min(100, section?.overlayOpacity ?? 45)) / 100;
  const blur = Math.max(0, Math.min(20, section?.blurIntensity ?? 0));
  const desktopPos = section?.objectPositionDesktop || "center center";
  const mobilePos = section?.objectPositionMobile || "center top";

  const trustChips = [
    { icon: <ShieldCheck size={13} />, label: t("hero2.chip.certified", "Certified Coach"), sub: t("hero2.chip.certifiedSub", "REPs UAE · EREPS Level 6") },
    { icon: <MapPin size={13} />, label: t("hero2.chip.dubai", "Dubai Based"), sub: t("hero2.chip.dubaiSub", "In-person & Online") },
    { icon: <Sparkles size={13} />, label: t("hero2.chip.support", "Premium Support"), sub: t("hero2.chip.supportSub", "Direct Coach Access") },
    { icon: <Trophy size={13} />, label: t("hero2.chip.results", "Results Focused"), sub: t("hero2.chip.resultsSub", "No Guesswork") },
  ];

  return (
    <section className="relative overflow-hidden" data-testid="hero-tron">
      {/* Layered ambient cinematic glows — top-right cyan, bottom-left navy. */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.14),transparent_58%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(15,42,86,0.32),transparent_55%)]"
        aria-hidden
      />
      <div className="relative max-w-6xl mx-auto px-5 pt-8 md:pt-20 pb-14 md:pb-24 grid md:grid-cols-12 gap-8 md:gap-14 items-center">
        {/* === Image (mobile shows first via order-1, desktop right) === */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="order-1 md:order-2 md:col-span-5 relative"
        >
          {/* Wider, softer cyan halo — bleeds further beyond the frame so
              the subject feels integrated with the atmosphere, not boxed. */}
          <div
            className="absolute -inset-12 md:-inset-10 -z-10 bg-[radial-gradient(circle_at_60%_40%,rgba(56,189,248,0.32),transparent_72%)] blur-3xl"
            aria-hidden
          />
          {/* Mobile: borderless / smaller radius — image dissolves into the
              page instead of reading as a card.
              Desktop: composed 28px cinematic frame stays for split layout. */}
          <div
            className="relative aspect-[4/5] md:aspect-[3/4] rounded-2xl md:rounded-[28px] overflow-hidden border-0 md:border md:border-white/[0.06] bg-gradient-to-br from-[#0b1220] via-[#0a0f1a] to-[#050810] shadow-none md:shadow-[0_0_0_1px_rgba(56,189,248,0.14)_inset,_0_40px_100px_-28px_rgba(0,0,0,0.7),_0_0_80px_-20px_rgba(56,189,248,0.20)]"
          >
            {section?.mediaAsset ? (
              // May-2026 responsive media pipeline. SmartImage fills the
              // cinematic frame with focal-cropped AVIF/WebP variants per
              // breakpoint. `priority` because the hero is above-the-fold.
              <SmartImage
                asset={section.mediaAsset}
                priority
                fill
                sizesDesktop="(min-width: 1280px) 480px, (min-width: 768px) 40vw, 100vw"
                testId="img-hero"
              />
            ) : hasImage ? (
              <picture>
                <source media="(min-width: 768px)" srcSet={img} />
                <img
                  src={img}
                  alt={section?.imageAlt || t("hero2.imageAlt", "Coach Youssef Ahmed")}
                  className="hero-img w-full h-full"
                  style={{
                    objectFit: "cover",
                    objectPosition: mobilePos,
                    filter: blur > 0 ? `blur(${blur}px)` : undefined,
                  }}
                  onError={() => setImgErrored(true)}
                  data-testid="img-hero"
                />
              </picture>
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50"
                data-testid="hero-image-placeholder"
              >
                <ImageOff size={48} />
                <p className="mt-3 text-[10px] uppercase tracking-[0.28em]">
                  {t("hero2.placeholder.line1", "Hero photo coming soon")}
                </p>
                <p className="mt-1 text-[10px] text-muted-foreground/50">
                  {t("hero2.placeholder.line2", "Admin → Marketing → Homepage")}
                </p>
              </div>
            )}
            {/* Cinematic vignette — soft darken at corners so the subject
                feels integrated into the page rather than framed inside a
                box. Pure decoration, pointer-events-none. */}
            <div className="absolute inset-0 tron-vignette pointer-events-none" aria-hidden />
            {/* Bottom dark wash so floating accreditation chips always read */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,${overlay}) 100%)`,
              }}
              aria-hidden
            />
            {/* Floating accreditation chips */}
            <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between gap-2 text-[10px] font-bold">
              <span className="px-2.5 py-1.5 rounded-full bg-primary text-primary-foreground tracking-wider">
                <Award size={11} className="inline -mt-0.5 me-1" />
                {t("hero2.badge.reps", "REPs UAE")}
              </span>
              <span className="px-2.5 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/10 tracking-wider">
                {t("hero2.badge.eqf", "EREPS · EQF Level 6")}
              </span>
            </div>
          </div>
          {/* Desktop-only object-position override — when the legacy
              imageDataUrl path is used (no mediaAsset), the picture/img
              shares one objectPosition; this CSS variable lets the admin
              set per-breakpoint focal points without re-rendering. */}
          <style>{`
            @media (min-width: 768px) {
              .hero-img { object-position: ${desktopPos} !important; }
            }
          `}</style>
        </motion.div>

        {/* === Copy === */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05, ease: [0.22, 1, 0.36, 1] }}
          className="order-2 md:order-1 md:col-span-7 text-start"
        >
          <p className="tron-eyebrow text-[11px] mb-4" data-testid="text-hero-eyebrow">
            {eyebrow}
          </p>
          <h1
            className="font-display font-bold leading-[1.02] tracking-[-0.025em] text-[clamp(2.5rem,7.2vw,5.25rem)]"
            data-testid="text-hero-title"
          >
            {titleParts[0]}{" "}
            {titleParts[1] && (
              <span className="text-gradient-blue italic rtl:not-italic font-medium whitespace-nowrap">
                {titleParts[1]}
              </span>
            )}
          </h1>
          <p
            className="mt-6 text-base md:text-lg text-foreground/75 leading-[1.7] max-w-xl"
            data-testid="text-hero-body"
          >
            {body}
          </p>

          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link href={ctaPrimaryHref} data-testid="link-hero-primary" className="w-full sm:w-auto">
              <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 blue-glow whitespace-nowrap btn-press">
                <Calendar size={18} />
                {ctaPrimary}
              </button>
            </Link>
            <WhatsAppButton
              label={ctaSecondary}
              size="md"
              testId="button-hero-whatsapp"
              className="w-full sm:w-auto"
            />
          </div>

          {/* Quiet luxury-psychology line — selective onboarding without
              resorting to fake countdowns or scarcity timers. */}
          <p
            className="mt-5 text-[12px] text-muted-foreground/75 leading-snug max-w-md flex items-center gap-2"
            data-testid="text-hero-capacity"
          >
            <span
              className="inline-block w-1.5 h-1.5 rounded-full bg-primary/80 shadow-[0_0_8px_rgba(56,189,248,0.6)] shrink-0"
              aria-hidden
            />
            {t(
              "hero2.capacity",
              "Limited active clients — selective onboarding to protect coaching quality.",
            )}
          </p>

          {/* Trust signals.
              MOBILE: borderless cyan-dot pills in a single horizontal scroll
              row — feels editorial / luxury campaign, not dashboard 2x2.
              DESKTOP: 2x2 chip grid as before — denser composition. */}
          <div className="mt-7 md:hidden -mx-5 px-5 overflow-x-auto scrollbar-hide">
            <div className="flex gap-5 items-center whitespace-nowrap pb-1">
              {trustChips.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[11.5px] text-foreground/85 shrink-0"
                  data-testid={`hero-chip-${i}`}
                >
                  <span className="text-primary/90">{c.icon}</span>
                  <span className="font-semibold tracking-wide">{c.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-8 hidden md:grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {trustChips.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 hover:border-primary/25 transition-colors"
                data-testid={`hero-chip-desktop-${i}`}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-primary/90 font-semibold">
                  {c.icon}
                  <span>{c.label}</span>
                </div>
                <p className="mt-0.5 text-[10px] text-muted-foreground/80 leading-snug">
                  {c.sub}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
