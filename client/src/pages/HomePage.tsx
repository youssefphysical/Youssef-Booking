import { Footer } from "@/components/Footer";
import { Transformations } from "@/components/Transformations";
import { CoachProtocols } from "@/components/CoachProtocols";
import { Hero } from "@/components/home/Hero";
import { Philosophy } from "@/components/home/Philosophy";
import { HowItWorks } from "@/components/home/HowItWorks";
import { CompleteSystem } from "@/components/home/CompleteSystem";
import { Credentials } from "@/components/home/Credentials";
import { FinalCTA } from "@/components/home/FinalCTA";
import { useTranslation } from "@/i18n";
import { useHomepageContent } from "@/hooks/use-homepage-content";

/**
 * Tron-Legacy homepage rebuild (May-2026), Cinematic Refinement Pass.
 *
 * Marketing flow per master prompt:
 *   1. Hero            (admin CMS image)
 *   2. Philosophy      (admin CMS image, pull-quote treatment)
 *   3. Transformations (existing DB-backed component, ambient glow)
 *   4. How It Works    (5-step cinematic timeline, cyan beam)
 *   5. Coach-Curated Protocols
 *   6. Complete Coaching System (editorial numbered list)
 *   7. Credentials     (editorial single-column list)
 *   8. Final CTA       (admin CMS image, capacity microcopy)
 *   9. Cinematic sign-off (calm closing line + cyan beam)
 *  10. Footer
 *
 * All admin-editable images flow through one `/api/homepage-content`
 * fetch — components render their built-in premium fallback copy when
 * a key is missing or inactive, so first paint is never blank.
 *
 * Visual rhythm is deliberate:
 *   • dark-card sections (Hero, Philosophy) alternate with
 *   • borderless editorial sections (CompleteSystem, Credentials)
 *   • image-led cinematic sections (Transformations, FinalCTA)
 *   • minimal centred sections (HowItWorks)
 * — so the eye is guided naturally without repeating identical layouts.
 */
export default function HomePage() {
  const { t } = useTranslation();
  const { data: content } = useHomepageContent();
  return (
    <div className="min-h-screen pt-16 homepage-shell">
      <Hero section={content?.hero} />
      <Philosophy section={content?.philosophy} />
      <Transformations />
      <HowItWorks />
      <CoachProtocols mode="homepage" />
      <CompleteSystem />
      <Credentials />
      <FinalCTA section={content?.final_cta} />

      {/* Cinematic sign-off — calm emotional close before the quiet
          footer links. Single italic line + a thin cyan beam, plenty
          of luxury spacing. Per refinement-pass brief: stronger final
          emotional close BEFORE footer. */}
      <div
        className="text-center py-12 md:py-16 max-w-2xl mx-auto px-5"
        data-testid="home-closing-signoff"
      >
        <div className="tron-beam mx-auto w-40 mb-6 opacity-60" aria-hidden />
        <p className="font-display italic text-foreground/75 text-base md:text-lg leading-[1.7]">
          {t(
            "home.closing",
            "Real coaching. Real bodies. Real long-term results.",
          )}
        </p>
        <p className="mt-4 text-[10px] uppercase tracking-[0.32em] text-primary/60">
          — {t("brand.trainerName", "Youssef Ahmed")}
        </p>
      </div>

      <Footer />
    </div>
  );
}
