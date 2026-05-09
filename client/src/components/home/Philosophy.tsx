import { useState } from "react";
import { motion } from "framer-motion";
import { Compass, User, Target, ShieldCheck, ImageOff } from "lucide-react";
import { useTranslation } from "@/i18n";
import type { HomepageSectionContent } from "@/hooks/use-homepage-content";

/**
 * "I don't believe in random plans." — coach philosophy section.
 * Builds emotional authority. Image is admin-controlled (key="philosophy");
 * falls back to a dark placeholder pane so the layout never breaks.
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
    <section className="relative py-16 md:py-24" id="philosophy" data-testid="philosophy-section">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_left,rgba(30,58,138,0.18),transparent_60%)] pointer-events-none" aria-hidden />
      <div className="relative max-w-6xl mx-auto px-5 grid md:grid-cols-12 gap-10 md:gap-14 items-center">
        {/* Image */}
        <motion.div
          initial={{ opacity: 0, x: -16 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          className="md:col-span-5"
        >
          <div
            className="relative aspect-[4/5] rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0a0f1a] to-[#050810]"
            style={{ boxShadow: "0 0 0 1px rgba(56,189,248,0.12) inset" }}
          >
            {hasImage ? (
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
            <div
              className="absolute inset-0 pointer-events-none"
              style={{ background: `linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,${overlay}) 100%)` }}
              aria-hidden
            />
          </div>
          <style>{`@media (min-width: 768px) { .philosophy-img { object-position: ${desktopPos} !important; } }`}</style>
        </motion.div>

        {/* Copy */}
        <div className="md:col-span-7">
          <p className="tron-eyebrow text-[11px] text-primary/90 mb-3">{eyebrow}</p>
          <h2 className="font-display font-bold text-3xl md:text-4xl leading-tight" data-testid="text-philosophy-title">
            {title}
          </h2>
          <p className="mt-5 text-base text-muted-foreground leading-relaxed max-w-xl whitespace-pre-line">
            {body}
          </p>

          <div className="mt-8 grid grid-cols-2 gap-3">
            {points.map((p, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                data-testid={`philosophy-point-${i}`}
              >
                <div className="w-9 h-9 rounded-lg bg-primary/15 border border-primary/30 flex items-center justify-center text-primary mb-2.5">
                  {p.icon}
                </div>
                <h3 className="font-display font-bold text-sm">{p.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{p.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
