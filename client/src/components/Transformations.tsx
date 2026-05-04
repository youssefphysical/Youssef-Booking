import { motion } from "framer-motion";
import { Quote, Target, Calendar, TrendingUp } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useTransformations } from "@/hooks/use-transformations";

// Public premium "Real Results" section. Renders nothing when admin has
// not added any active transformations — homepage stays clean instead of
// showing an empty grid.
export function Transformations() {
  const { t } = useTranslation();
  const { data = [], isLoading } = useTransformations();

  if (isLoading) return null;
  if (data.length === 0) return null;

  return (
    <section className="max-w-6xl mx-auto px-5 py-20" id="transformations">
      <div className="mb-8">
        <p className="tron-eyebrow text-xs mb-2">
          {t("section.transformations.eyebrow")}
        </p>
        <h2 className="text-3xl md:text-4xl font-display font-bold">
          {t("section.transformations.title")}
        </h2>
        <p className="text-muted-foreground mt-2">
          {t("section.transformations.subtitle")}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {data.map((row, i) => {
          const name = row.displayName?.trim() || t("transformations.anonymous");
          return (
            <motion.article
              key={row.id}
              initial={{ opacity: 0, y: 16 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.15 }}
              transition={{ duration: 0.5, delay: i * 0.05 }}
              className="tron-card rounded-3xl overflow-hidden"
              data-testid={`transformation-card-${row.id}`}
            >
              {/* Before / After split — thin cyan separator between halves
                  to reinforce the TRON edge aesthetic. */}
              <div className="grid grid-cols-2 gap-[1px] bg-primary/30">
                <figure className="relative aspect-[4/5] bg-black">
                  <img
                    src={row.beforeImageDataUrl}
                    alt={`${name} — before`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                    data-testid={`img-transformation-before-${row.id}`}
                  />
                  <figcaption className="absolute top-2 left-2 px-2 py-1 rounded-md bg-black/70 backdrop-blur-sm text-[10px] uppercase tracking-[0.2em] text-white/90 font-bold border border-white/10">
                    {t("transformations.before")}
                  </figcaption>
                </figure>
                <figure className="relative aspect-[4/5] bg-black">
                  <img
                    src={row.afterImageDataUrl}
                    alt={`${name} — after`}
                    loading="lazy"
                    decoding="async"
                    className="w-full h-full object-cover"
                    data-testid={`img-transformation-after-${row.id}`}
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
    </section>
  );
}
