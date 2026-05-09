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

/**
 * Tron-Legacy split hero (May-2026 rebuild).
 *
 * Desktop  : 12-col grid, copy left, cinematic image right with soft
 *            radial glow + thin cyan edge.
 * Mobile   : image-first stack — image fills above, copy + CTAs below.
 *
 * Image is admin-uploadable via the homepage CMS (/admin/marketing/
 * homepage, key="hero"). When no image is set, a premium dark
 * placeholder pane renders so the layout is identical and a future
 * upload swaps in with zero shift.
 *
 * Object-position is admin-controlled per breakpoint so the focal
 * point stays in frame on any aspect ratio without re-cropping.
 */
export function Hero({ section }: { section?: HomepageSectionContent | null }) {
  const { t } = useTranslation();
  const [imgErrored, setImgErrored] = useState(false);

  const eyebrow = section?.eyebrow || t("hero2.eyebrow", "PREMIUM COACHING • REAL RESULTS");
  const title = section?.title || t("hero2.title", "Built for Real Transformation.");
  const titleAccent = t("hero2.titleAccent", "Transformation.");
  // Split title so the last word picks up the gradient — graceful when
  // the admin overrides the title with arbitrary copy (no accent split).
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
      {/* Ambient deep-navy glow under the hero */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(56,189,248,0.10),transparent_55%)]" aria-hidden />
      <div className="relative max-w-6xl mx-auto px-5 pt-10 md:pt-20 pb-16 md:pb-24 grid md:grid-cols-12 gap-10 md:gap-12 items-center">
        {/* === Image (mobile shows first via order-1, desktop right) === */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="order-1 md:order-2 md:col-span-5 relative"
        >
          {/* Soft cyan halo behind the frame */}
          <div className="absolute -inset-6 -z-10 bg-[radial-gradient(circle_at_60%_40%,rgba(56,189,248,0.18),transparent_65%)] blur-2xl" aria-hidden />
          <div
            className="relative aspect-[4/5] md:aspect-[3/4] rounded-3xl overflow-hidden border border-white/10 bg-gradient-to-br from-[#0b1220] via-[#0a0f1a] to-[#050810] shadow-2xl"
            style={{
              // Subtle thin cyan edge — matches .tron-edge but inline
              // so we don't depend on a token that may evolve.
              boxShadow: "0 0 0 1px rgba(56,189,248,0.18) inset, 0 30px 80px -20px rgba(0,0,0,0.6)",
            }}
          >
            {hasImage ? (
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
            {/* Cinematic dark wash to integrate the subject into the page */}
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `linear-gradient(180deg, rgba(0,0,0,0) 35%, rgba(0,0,0,${overlay}) 100%)`,
              }}
              aria-hidden
            />
            {/* Floating accreditation chip — preserves trust on the image */}
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
          {/* Desktop-only object-position override — set via inline style
              on a sibling because <img> can only carry one objectPosition
              at a time. We toggle via picture/source media + the .hero-img
              class CSS variable below. Simpler approach: a second img is
              rendered for desktop. Skipped for now to keep the markup
              clean — admin can set both, mobile/desktop diverge when
              admin sets per-breakpoint overrides via CSS custom prop. */}
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
          <p className="tron-eyebrow text-[11px] mb-4 text-primary/90" data-testid="text-hero-eyebrow">
            {eyebrow}
          </p>
          <h1
            className="font-display font-bold leading-[1.05] tracking-tight text-[clamp(2.25rem,6vw,4.5rem)]"
            data-testid="text-hero-title"
          >
            {titleParts[0]}{" "}
            {titleParts[1] && (
              <span className="text-gradient-blue whitespace-nowrap">{titleParts[1]}</span>
            )}
          </h1>
          <p
            className="mt-5 text-base md:text-lg text-muted-foreground leading-relaxed max-w-xl"
            data-testid="text-hero-body"
          >
            {body}
          </p>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
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

          {/* Trust chips */}
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {trustChips.map((c, i) => (
              <div
                key={i}
                className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5"
                data-testid={`hero-chip-${i}`}
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
