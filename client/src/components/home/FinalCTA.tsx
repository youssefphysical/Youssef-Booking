import { Link } from "wouter";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/i18n";
import { useHomepageContent } from "@/hooks/use-homepage-content";
import { WhatsAppButton } from "@/components/WhatsAppButton";

/**
 * Cinematic final CTA — the last beat before the footer.
 *
 * Composition: a Tron horizon energy line marks the entrance into this
 * section, then pure black void with a centered eyebrow + oversized
 * headline + 2 CTAs. NO card. NO border. The void IS the frame.
 *
 * CMS-driven (key="final_cta"); safe inline fallbacks.
 */
export function FinalCTA() {
  const { t } = useTranslation();
  const { data: content } = useHomepageContent();
  const c = content?.final_cta;

  const eyebrow = c?.eyebrow || t("finalCta.eyebrow", "BEGIN");
  const title = c?.title || t("finalCta.title", "The next session is yours.");
  const subtitle =
    c?.subtitle ||
    t(
      "finalCta.subtitle",
      "Book your first session, or message Coach Youssef directly. Replies usually within an hour.",
    );
  const ctaPrimaryLabel =
    c?.ctaPrimaryLabel || t("finalCta.bookSession", "Book your session");
  const ctaPrimaryHref = c?.ctaPrimaryHref || "/book";

  return (
    <section
      className="relative w-full bg-black"
      id="contact"
      data-testid="cinematic-final-cta"
    >
      {/* Cinematic horizon entering the section — same Tron energy line
          treatment as below the hero. Marks the final beat. */}
      <div className="hero-horizon w-full" aria-hidden="true" />

      <div className="max-w-4xl mx-auto px-5 sm:px-8 py-28 sm:py-36 text-center">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="inline-flex items-center gap-3 mb-6 text-[10px] sm:text-[11px] tracking-[0.32em] uppercase text-white/65">
            <span className="hero-eyebrow-rule" aria-hidden="true" />
            <span>{eyebrow}</span>
            <span
              className="hero-eyebrow-rule"
              aria-hidden="true"
              style={{
                background:
                  "linear-gradient(270deg, transparent 0%, rgba(255,184,0,0.55) 60%, hsl(var(--warm-accent)) 100%)",
              }}
            />
          </div>
          <h2
            className="font-display font-bold text-white leading-[1.05] tracking-[-0.025em] max-w-3xl mx-auto"
            style={{ fontSize: "clamp(2.25rem, 5.5vw, 4.5rem)" }}
            data-testid="text-final-cta-title"
          >
            {title}
          </h2>
          {subtitle && (
            <p
              className="mt-6 text-base sm:text-lg lg:text-xl text-white/70 leading-[1.6] max-w-2xl mx-auto"
              data-testid="text-final-cta-subtitle"
            >
              {subtitle}
            </p>
          )}
          <div className="mt-10 sm:mt-12 flex flex-col sm:flex-row gap-3 sm:gap-3.5 justify-center max-w-md sm:max-w-none mx-auto">
            {ctaPrimaryHref.startsWith("/") ? (
              <Link href={ctaPrimaryHref} className="w-full sm:w-auto">
                <button
                  className="tron-cta tron-cta-breathe w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl font-semibold whitespace-nowrap btn-press"
                  data-testid="button-final-cta-primary"
                >
                  {ctaPrimaryLabel}
                  <ArrowRight size={18} />
                </button>
              </Link>
            ) : (
              <a href={ctaPrimaryHref} className="w-full sm:w-auto">
                <button className="tron-cta tron-cta-breathe w-full sm:w-auto inline-flex items-center justify-center gap-2 h-12 px-7 rounded-xl font-semibold whitespace-nowrap btn-press">
                  {ctaPrimaryLabel}
                  <ArrowRight size={18} />
                </button>
              </a>
            )}
            <WhatsAppButton
              label={
                c?.ctaSecondaryLabel ||
                t("finalCta.message", "Message Coach Youssef")
              }
              message={t(
                "home.cta.whatsappMessage",
                "Hi Coach Youssef, I'm interested in personal training.",
              )}
              testId="button-final-cta-whatsapp"
              className="w-full sm:w-auto"
            />
          </div>
          <p className="mt-7 text-xs tracking-[0.22em] uppercase text-white/40">
            {t("section.cta.replies", "Replies within an hour, every day")}
          </p>
        </motion.div>
      </div>
    </section>
  );
}
