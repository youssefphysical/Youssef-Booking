import { motion } from "framer-motion";
import { useTranslation } from "@/i18n";
import { useHomepageContent } from "@/hooks/use-homepage-content";

/**
 * Cinematic philosophy section — pure black void, asymmetric editorial.
 *
 * Composition: thin amber leading rule + small eyebrow on the FAR LEFT
 * (column 1 of 12), oversized headline + body in columns 2-9, columns
 * 10-12 deliberately empty void. NO card, NO border, NO background fill.
 * The void IS the design.
 *
 * CMS-driven (key="philosophy"); safe inline fallbacks.
 */
export function Philosophy() {
  const { t } = useTranslation();
  const { data: content } = useHomepageContent();
  const c = content?.philosophy;

  const eyebrow = c?.eyebrow || t("philosophy.eyebrow", "PHILOSOPHY");
  const title =
    c?.title || t("philosophy.title", "Train with intention. Live with clarity.");
  const body =
    c?.body ||
    t(
      "philosophy.body",
      "Premium personal training is more than counting reps — it is a structured system built on academic physical education, clinical movement science, and a decade of competitive coaching. Every session is engineered around your physiology, your schedule, and the outcome you came for. No guesswork. No noise.",
    );

  return (
    <section
      className="relative max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-32 lg:py-40"
      data-testid="cinematic-philosophy"
    >
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.3 }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        className="grid grid-cols-12 gap-x-6"
      >
        {/* Eyebrow — single column, asymmetric. */}
        <div className="col-span-12 md:col-span-3 mb-6 md:mb-0">
          <div className="flex items-center gap-3 text-[10px] sm:text-[11px] tracking-[0.32em] uppercase text-white/60">
            <span className="hero-eyebrow-rule" aria-hidden="true" />
            <span>{eyebrow}</span>
          </div>
        </div>

        {/* Headline + body — columns 4-10, leaves columns 11-12 as void. */}
        <div className="col-span-12 md:col-span-9 md:col-start-4">
          <h2
            className="font-display font-bold text-white leading-[1.05] tracking-[-0.025em]"
            style={{ fontSize: "clamp(2rem, 5.2vw, 4.25rem)" }}
            data-testid="text-philosophy-title"
          >
            {title}
          </h2>
          <p
            className="mt-7 sm:mt-9 text-base sm:text-lg lg:text-xl text-white/70 leading-[1.65] max-w-2xl"
            data-testid="text-philosophy-body"
          >
            {body}
          </p>
        </div>
      </motion.div>
    </section>
  );
}
