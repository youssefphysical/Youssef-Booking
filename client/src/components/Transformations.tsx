import { useState } from "react";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Quote, Target, Calendar, TrendingUp, ImageOff, ArrowRight } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useTransformations } from "@/hooks/use-transformations";

/**
 * SafeImage (QA-pass May-2026)
 *
 * Defensive renderer for transformation before/after photos. If the
 * stored data URL is empty, malformed, or fails to decode at runtime
 * (admin-removed file, partially-uploaded base64, etc.) the visitor
 * sees a clean placeholder tile instead of the browser's broken-image
 * icon. Same defensive pattern as ProfilePhoto on HomePage.
 */
function SafeImage({
  src,
  alt,
  testId,
}: {
  src?: string | null;
  alt: string;
  testId: string;
}) {
  const trimmed = (src || "").trim();
  // Real data URLs are always > 40 chars; anything shorter is empty
  // or a stale placeholder.
  const looksValid = trimmed.length >= 40;
  const [errored, setErrored] = useState(false);
  if (!looksValid || errored) {
    return (
      <div
        className="w-full h-full flex items-center justify-center text-muted-foreground/40"
        data-testid={`${testId}-placeholder`}
      >
        <ImageOff size={32} />
      </div>
    );
  }
  return (
    <img
      src={trimmed}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
      className="w-full h-full object-cover"
      data-testid={testId}
    />
  );
}

// Public premium "Real Results" section. Renders nothing when admin has
// not added any active transformations — homepage stays clean instead of
// showing an empty grid.
export function Transformations() {
  const { t } = useTranslation();
  const { data = [], isLoading } = useTransformations();

  if (isLoading) return null;
  if (data.length === 0) return null;

  // On the homepage we show only the first 3 cards as a teaser; the
  // dedicated /transformations gallery is the full premium experience.
  const preview = data.slice(0, 3);
  const hasMore = data.length > preview.length;

  return (
    <section className="relative py-14 md:py-24" id="transformations">
      {/* Cinematic Refinement Pass (May-2026): soft ambient cyan glow
          makes Transformations the visual centerpiece — emotional proof
          engine at the heart of the homepage. */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.10),transparent_60%)]"
        aria-hidden
      />
      <div className="relative max-w-6xl mx-auto px-5">
      <div className="mb-10 flex items-end justify-between gap-4 flex-wrap">
        <div>
          <p className="tron-eyebrow text-xs mb-3">
            {t("section.transformations.eyebrow")}
          </p>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-3xl md:text-5xl font-display font-bold tracking-[-0.02em] leading-[1.05]">
              {t("section.transformations.title")}
            </h2>
            {data.length >= 2 && (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary"
                data-testid="badge-transformation-count"
              >
                {data.length}+ {t("transformations.countLabel", "verified results")}
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-2">
            {t("section.transformations.subtitle")}
          </p>
        </div>
        <Link
          href="/transformations"
          className="inline-flex items-center gap-1.5 h-10 px-4 rounded-full text-xs font-semibold bg-white/[0.04] border border-white/10 text-foreground/90 hover:bg-white/[0.08] hover:border-primary/30 transition-colors"
          data-testid="link-view-all-transformations"
        >
          {t("gallery.viewAll", "View gallery")}
          <ArrowRight size={13} className="rtl:rotate-180" />
        </Link>
      </div>

      {/* MOBILE: full-bleed snap-scroll carousel — each card occupies
          ~88vw so one transformation dominates the viewport at a time
          (peek of next card hints at swipeability). Reads as cinematic
          proof reel rather than a stacked grid.
          DESKTOP: 2/3-col grid as before. */}
      <div className="md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-5 flex md:block gap-4 overflow-x-auto md:overflow-visible snap-x snap-mandatory -mx-5 px-5 md:mx-0 md:px-0 pb-4 md:pb-0 scrollbar-hide">
        {preview.map((row, i) => {
          const name = row.displayName?.trim() || t("transformations.anonymous");
          return (
            <motion.article
              key={row.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="tron-card rounded-3xl overflow-hidden snap-center shrink-0 w-[88vw] sm:w-[420px] md:w-auto md:shrink"
              data-testid={`transformation-card-${row.id}`}
            >
              {/* Before / After split — thin cyan separator between halves
                  to reinforce the TRON edge aesthetic. */}
              <div className="grid grid-cols-2 gap-[1px] bg-primary/30">
                <figure className="relative aspect-[4/5] bg-black">
                  <SafeImage
                    src={row.beforeImageDataUrl}
                    alt={`${name} — before`}
                    testId={`img-transformation-before-${row.id}`}
                  />
                  <figcaption className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-[10px] uppercase tracking-[0.2em] text-white/90 font-bold border border-white/10">
                    {t("transformations.before")}
                  </figcaption>
                </figure>
                <figure className="relative aspect-[4/5] bg-black">
                  <SafeImage
                    src={row.afterImageDataUrl}
                    alt={`${name} — after`}
                    testId={`img-transformation-after-${row.id}`}
                  />
                  <figcaption className="tron-pulse absolute top-2 right-2 px-2 py-1 rounded-md bg-primary text-primary-foreground text-[10px] uppercase tracking-[0.2em] font-bold">
                    {t("transformations.after")}
                  </figcaption>
                </figure>
              </div>

              {/* Body */}
              <div className="p-5">
                <h3 className="font-display font-bold text-base" data-testid={`text-transformation-name-${row.id}`}>
                  {name}
                </h3>

                <ul className="mt-3 space-y-1.5 text-sm">
                  {row.goal && (
                    <li className="flex items-start gap-2 text-muted-foreground">
                      <Target size={14} className="text-primary mt-0.5 shrink-0" />
                      <span><strong className="text-foreground/90">{t("transformations.goal")}:</strong> {row.goal}</span>
                    </li>
                  )}
                  {row.duration && (
                    <li className="flex items-start gap-2 text-muted-foreground">
                      <Calendar size={14} className="text-primary mt-0.5 shrink-0" />
                      <span><strong className="text-foreground/90">{t("transformations.duration")}:</strong> {row.duration}</span>
                    </li>
                  )}
                  {row.result && (
                    <li className="flex items-start gap-2 text-muted-foreground">
                      <TrendingUp size={14} className="text-primary mt-0.5 shrink-0" />
                      <span><strong className="text-foreground/90">{t("transformations.result")}:</strong> {row.result}</span>
                    </li>
                  )}
                </ul>

                {row.testimonial && (
                  <blockquote className="mt-4 pt-4 border-t border-white/5 text-sm italic text-muted-foreground/90 leading-relaxed flex gap-2">
                    <Quote size={14} className="text-primary/60 shrink-0 mt-0.5" />
                    <span data-testid={`text-transformation-testimonial-${row.id}`}>{row.testimonial}</span>
                  </blockquote>
                )}
              </div>
            </motion.article>
          );
        })}
      </div>

      {hasMore && (
        <div className="mt-8 text-center">
          <Link
            href="/transformations"
            className="inline-flex items-center gap-2 h-11 px-6 rounded-full text-sm font-semibold bg-primary text-primary-foreground hover:opacity-90 transition-opacity btn-press shadow-md shadow-primary/20"
            data-testid="link-view-all-transformations-cta"
          >
            {t("gallery.viewAllN", `View all ${data.length} transformations`)}
            <ArrowRight size={14} className="rtl:rotate-180" />
          </Link>
        </div>
      )}
      </div>
    </section>
  );
}
