import { useState } from "react";
import { motion } from "framer-motion";
import { Compass, User, Target, ShieldCheck, ImageOff, Quote } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { HomepageSectionContent } from "@/hooks/use-homepage-content";
import { SmartImage } from "@/components/SmartImage";

/**
 * "I don't believe in random plans." — Coach philosophy section.
 *
 * Cinematic Refinement Pass (May-2026):
 *   • Title styled as an editorial pull-quote — opening cyan quote
 *     mark + italic display weight + tighter tracking. Increases
 *     coach-presence without rewriting copy.
 *   • Subtle attribution line under the quote ties the voice to the coach.
 *   • Body text brightened to foreground/75 with a more luxurious
 *     1.75 line-height for editorial reading rhythm.
 *   • Point-cards converted to lighter borderless rows with a cyan
 *     hairline on the start edge — breaks the dark-card sameness
 *     established by the hero.
 *   • Mobile py-16 → py-14 to ease scroll fatigue.
 * CMS bindings, focal-point, and mediaAsset pipeline preserved.
 */
export function Philosophy({ section }: { section?: HomepageSectionContent | null }) {
  const { t } = useTranslation();
  const [imgErrored, setImgErrored] = useState(false);

  const eyebrow = section?.eyebrow || t("philosophy.eyebrow", "MY PHILOSOPHY");
  const title = section?.title || t("philosophy.title", "I don't believe in random plans.");
  const body =
    section?.body ||
    t(
      "philosophy.body",
      "I believe in precision. Every body is different. Every goal is unique. That's why I use premium protocols, structured training, and real progress tracking — designed around you, not the other way around.",
    );

  const img = (section?.imageDataUrl || "").trim();
  const hasImage = img.length >= 40 && !imgErrored;
  const desktopPos = section?.objectPositionDesktop || "center center";
  const mobilePos = section?.objectPositionMobile || "center center";
  const overlay = Math.max(0, Math.min(100, section?.overlayOpacity ?? 35)) / 100;

  const points = [
    { icon: <Compass size={18} />, title: t("philosophy.p1.title", "Quality First"), body: t("philosophy.p1.body", "Premium ingredients. No fillers. No shortcuts.") },
    { icon: <User size={18} />, title: t("philosophy.p2.title", "Personalized"), body: t("philosophy.p2.body", "Your body, your data, your plan.") },
    { icon: <Target size={18} />, title: t("philosophy.p3.title", "Consistent"), body: t("philosophy.p3.body", "Small daily actions. Big long-term results.") },
    { icon: <ShieldCheck size={18} />, title: t("philosophy.p4.title", "Accountability"), body: t("philosophy.p4.body", "I'm with you every step of the way.") },
  ];

  return (
    <section className="relative py-14 md:py-24" id="philosophy" data-testid="philosophy-section">
      <div
        className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(30,58,138,0.20),transparent_60%)] pointer-events-none"
        aria-hidden
      />
      <div className="relative max-w-6xl mx-auto px-5 grid md:grid-cols-12 gap-10 md:gap-16 items-center">
        {/* Image */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="md:col-span-5 relative"
        >
          {/* Soft cyan halo behind the frame */}
          <div
            className="absolute -inset-6 -z-10 bg-[radial-gradient(circle_at_40%_50%,rgba(56,189,248,0.18),transparent_70%)] blur-2xl"
            aria-hidden
          />
          <div
            className="relative aspect-[4/5] rounded-[28px] overflow-hidden border border-white/[0.06] bg-gradient-to-br from-[#0a0f1a] to-[#050810]"
            style={{
              boxShadow:
                "0 0 0 1px rgba(56,189,248,0.10) inset, 0 30px 80px -24px rgba(0,0,0,0.6)",
            }}
          >
            {section?.mediaAsset ? (
              // May-2026 responsive pipeline — focal-cropped AVIF/WebP
              // variants per breakpoint, lazy loaded (below-the-fold).
              <SmartImage
                asset={section.mediaAsset}
                fill
                sizesDesktop="(min-width: 1280px) 480px, (min-width: 768px) 40vw, 100vw"
                testId="img-philosophy"
              />
            ) : hasImage ? (
              <img
                src={img}
                alt={section?.imageAlt || t("philosophy.imageAlt", "Coach Youssef Ahmed")}
                className="philosophy-img w-full h-full"
                style={{ objectFit: "cover", objectPosition: mobilePos }}
                onError={() => setImgErrored(true)}
                data-testid="img-philosophy"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div
                className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/40"
                data-testid="philosophy-placeholder"
              >
                <ImageOff size={40} />
                <p className="mt-3 text-[10px] uppercase tracking-[0.28em]">
                  {t("philosophy.placeholder", "Add image in admin")}
                </p>
              </div>
            )}
            <div className="absolute inset-0 tron-vignette pointer-events-none" aria-hidden />
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(180deg, rgba(0,0,0,0) 55%, rgba(0,0,0,${overlay}) 100%)`,
              }}
              aria-hidden
            />
          </div>
          <style>{`@media (min-width: 768px) { .philosophy-img { object-position: ${desktopPos} !important; } }`}</style>
        </motion.div>

        {/* Copy — pull-quote treatment */}
        <div className="md:col-span-7">
          <p className="tron-eyebrow text-[11px] mb-4">{eyebrow}</p>
          <Quote size={28} className="text-primary/45 mb-3 rtl:scale-x-[-1]" aria-hidden />
          <h2
            className="font-display font-bold text-[clamp(1.875rem,4.6vw,3.25rem)] leading-[1.1] tracking-[-0.02em] italic rtl:not-italic text-foreground/95"
            data-testid="text-philosophy-title"
          >
            {title}
          </h2>
          <p className="mt-4 text-[11px] uppercase tracking-[0.28em] text-primary/65">
            — {t("philosophy.attribution", "Coach Youssef Ahmed")}
          </p>
          <p className="mt-7 text-base md:text-lg text-foreground/75 leading-[1.75] max-w-xl whitespace-pre-line">
            {body}
          </p>

          <div className="mt-9 grid grid-cols-2 gap-x-6 gap-y-5">
            {points.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.05 }}
                className="flex gap-3 ps-4 border-s border-primary/20"
                data-testid={`philosophy-point-${i}`}
              >
                <div className="text-primary/90 mt-0.5 shrink-0">{p.icon}</div>
                <div className="min-w-0">
                  <h3 className="font-display font-bold text-sm text-foreground/95">
                    {p.title}
                  </h3>
                  <p className="text-xs text-muted-foreground/85 mt-1 leading-relaxed">
                    {p.body}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
