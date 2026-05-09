import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Calendar, ArrowRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import type { HomepageSectionContent } from "@/hooks/use-homepage-content";
import { SmartImage } from "@/components/SmartImage";

/**
 * Final CTA — closing emotional pane.
 *
 * Cinematic Refinement Pass (May-2026):
 *   • Larger headline (clamp 2rem → 3.75rem) with tighter tracking and
 *     italic accent on the final phrase for cinematic close.
 *   • Pre-headline coach voice eyebrow ("QUIET. SELECTIVE. PREMIUM.")
 *     introduces the tone of selection.
 *   • Capacity microcopy under CTAs reinforces selective onboarding —
 *     same quiet luxury-psychology pattern as the hero.
 *   • Gradient overlay deepened on the copy side, refined to keep copy
 *     legible at any image position. Vignette layer added.
 *   • Pane shadow softened with an outer cyan glow for cinematic lift.
 *   • Mobile py-16 → py-14, padding inside pane rebalanced.
 */
export function FinalCTA({ section }: { section?: HomepageSectionContent | null }) {
  const { t } = useTranslation();
  const [imgErrored, setImgErrored] = useState(false);

  const title = section?.title || t("finalCta.title", "Ready to become your best?");
  const titleAccent = t("finalCta.titleAccent", "your best?");
  const titleParts = title.endsWith(titleAccent)
    ? [title.slice(0, title.length - titleAccent.length).trimEnd(), titleAccent]
    : [title, ""];

  const body =
    section?.body ||
    t(
      "finalCta.body",
      "Spots are intentionally limited so every client receives the proper attention and support they deserve.",
    );
  const ctaPrimary = section?.ctaPrimaryLabel || t("finalCta.ctaPrimary", "Book Your Session");
  const ctaPrimaryHref = section?.ctaPrimaryHref || "/book";
  const ctaSecondary = section?.ctaSecondaryLabel || t("finalCta.ctaSecondary", "Message Coach on WhatsApp");

  const img = (section?.imageDataUrl || "").trim();
  const hasImage = img.length >= 40 && !imgErrored;
  const overlay = Math.max(0, Math.min(100, section?.overlayOpacity ?? 65)) / 100;
  const desktopPos = section?.objectPositionDesktop || "center center";
  const mobilePos = section?.objectPositionMobile || "center center";

  return (
    <section className="py-14 md:py-24" id="final-cta" data-testid="final-cta-section">
      <div className="max-w-6xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-2xl md:rounded-[32px] border-0 md:border md:border-white/[0.06] bg-gradient-to-br from-[#0a0f1a] to-[#050810] min-h-[420px] md:min-h-[460px] shadow-none md:shadow-[0_0_0_1px_rgba(56,189,248,0.12)_inset,_0_40px_100px_-28px_rgba(0,0,0,0.7),_0_0_80px_-28px_rgba(56,189,248,0.18)]"
        >
          {section?.mediaAsset ? (
            // May-2026 responsive pipeline. Background image of the
            // closing CTA — variants are pre-cropped focal-pointed.
            <SmartImage
              asset={section.mediaAsset}
              fill
              sizesDesktop="(min-width: 1280px) 1280px, 100vw"
              testId="img-final-cta"
            />
          ) : hasImage ? (
            <img
              src={img}
              alt={section?.imageAlt || t("finalCta.imageAlt", "Coach Youssef Ahmed")}
              className="final-cta-img absolute inset-0 w-full h-full"
              style={{ objectFit: "cover", objectPosition: mobilePos }}
              onError={() => setImgErrored(true)}
              data-testid="img-final-cta"
              loading="lazy"
              decoding="async"
            />
          ) : null}
          {/* Cinematic overlay — deeper on copy side, fading toward image */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(120deg, rgba(2,6,15,${Math.min(0.95, overlay + 0.3)}) 30%, rgba(2,6,15,${overlay}) 60%, rgba(2,6,15,${Math.max(0.2, overlay - 0.2)}) 100%)`,
            }}
            aria-hidden
          />
          <div className="absolute inset-0 tron-grid-fine opacity-15 pointer-events-none" aria-hidden />
          <div className="absolute inset-0 tron-vignette pointer-events-none" aria-hidden />

          {/* Copy */}
          <div className="relative z-10 max-w-xl px-6 py-14 md:px-14 md:py-20">
            <p className="tron-eyebrow text-[11px] mb-5" data-testid="text-final-cta-eyebrow">
              {t("finalCta.eyebrow", "QUIET. SELECTIVE. PREMIUM.")}
            </p>
            <h2
              className="font-display font-bold text-[clamp(2rem,5.5vw,3.75rem)] leading-[1.05] tracking-[-0.02em]"
              data-testid="text-final-cta-title"
            >
              {titleParts[0]}{" "}
              {titleParts[1] && (
                <span className="text-gradient-blue italic rtl:not-italic font-medium whitespace-nowrap">
                  {titleParts[1]}
                </span>
              )}
            </h2>
            <p className="mt-5 text-base md:text-lg text-foreground/80 leading-[1.7]">
              {body}
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-3">
              <Link href={ctaPrimaryHref} data-testid="link-final-cta-primary" className="w-full sm:w-auto">
                <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-6 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 blue-glow whitespace-nowrap btn-press">
                  <Calendar size={18} />
                  {ctaPrimary}
                  <ArrowRight size={16} className="rtl:rotate-180" />
                </button>
              </Link>
              <WhatsAppButton
                label={ctaSecondary}
                size="md"
                testId="button-final-cta-whatsapp"
                className="w-full sm:w-auto"
              />
            </div>

            {/* Capacity / quiet luxury line — mirrors the hero so the
                page opens and closes with the same selective tone. */}
            <p
              className="mt-5 text-[12px] text-muted-foreground/80 leading-snug max-w-md flex items-center gap-2"
              data-testid="text-final-cta-capacity"
            >
              <span
                className="inline-block w-1.5 h-1.5 rounded-full bg-primary/80 shadow-[0_0_8px_rgba(56,189,248,0.6)] shrink-0"
                aria-hidden
              />
              {t(
                "finalCta.capacity",
                "A limited number of active clients — quality over volume, always.",
              )}
            </p>
            <p className="mt-3 text-xs text-muted-foreground/75">
              {t("finalCta.replies", "Coach Youssef usually replies within a few hours.")}
            </p>
          </div>
          <style>{`@media (min-width: 768px) { .final-cta-img { object-position: ${desktopPos} !important; } }`}</style>
        </motion.div>
      </div>
    </section>
  );
}
