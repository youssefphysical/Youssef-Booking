import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Calendar, ArrowRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import type { HomepageSectionContent } from "@/hooks/use-homepage-content";

/**
 * Final CTA — "Ready to become your best?" Cinematic image-bg pane
 * with admin-controlled photo + overlay opacity. Closes the page on
 * an emotional, confident note.
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
    <section className="py-16 md:py-24" id="final-cta" data-testid="final-cta-section">
      <div className="max-w-6xl mx-auto px-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0a0f1a] to-[#050810] min-h-[360px] md:min-h-[420px]"
          style={{ boxShadow: "0 0 0 1px rgba(56,189,248,0.15) inset, 0 30px 80px -20px rgba(0,0,0,0.6)" }}
        >
          {hasImage && (
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
          )}
          {/* Cinematic overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: `linear-gradient(120deg, rgba(2,6,15,${Math.min(0.95, overlay + 0.25)}) 30%, rgba(2,6,15,${overlay}) 60%, rgba(2,6,15,${Math.max(0.2, overlay - 0.2)}) 100%)`,
            }}
            aria-hidden
          />
          <div className="absolute inset-0 tron-grid-fine opacity-20 pointer-events-none" aria-hidden />

          {/* Copy */}
          <div className="relative z-10 max-w-xl px-6 py-12 md:px-12 md:py-16">
            <h2 className="font-display font-bold text-3xl md:text-5xl leading-[1.1]" data-testid="text-final-cta-title">
              {titleParts[0]}{" "}
              {titleParts[1] && (
                <span className="text-gradient-blue whitespace-nowrap">{titleParts[1]}</span>
              )}
            </h2>
            <p className="mt-4 text-base text-muted-foreground/95 leading-relaxed">{body}</p>
            <div className="mt-7 flex flex-col sm:flex-row gap-3">
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
            <p className="mt-5 text-xs text-muted-foreground/80">
              {t("finalCta.replies", "Coach Youssef usually replies within a few hours.")}
            </p>
          </div>
          <style>{`@media (min-width: 768px) { .final-cta-img { object-position: ${desktopPos} !important; } }`}</style>
        </motion.div>
      </div>
    </section>
  );
}
