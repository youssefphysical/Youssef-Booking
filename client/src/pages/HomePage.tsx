import { useEffect } from "react";
import { Hero } from "@/components/home/Hero";
import { TrustStrip } from "@/components/home/TrustStrip";
import { Philosophy } from "@/components/home/Philosophy";
import { HowItWorks } from "@/components/home/HowItWorks";
import { CompleteSystem } from "@/components/home/CompleteSystem";
import { Credentials } from "@/components/home/Credentials";
import { FinalCTA } from "@/components/home/FinalCTA";
import { Transformations } from "@/components/Transformations";
import { Footer } from "@/components/Footer";
import { useTranslation } from "@/i18n";

/**
 * CINEMATIC HOMEPAGE (May-2026 Tron Legacy rebuild).
 *
 * Replaces the previous 13-section SaaS-style homepage with a focused
 * 8-section editorial experience that reads like a film, not a dashboard.
 *
 * Composition rules (per the May-2026 cinematic-rebuild brief):
 *   • LESS BOXES — sections blend into the AMOLED black shell instead
 *     of stacking as bordered cards. No section has a tron-card outer.
 *   • BLACK VOID DOMINANCE — every section uses generous py spacing
 *     (24/28/32 vertical units) with intentional empty columns. The
 *     void is the frame.
 *   • CINEMATIC TYPOGRAPHY — every headline uses the editorial scale
 *     (clamp 2-4.5rem, leading 1.05, tracking -0.025em). Eyebrows use
 *     the hero-eyebrow-rule (amber leading hairline) instead of pills.
 *   • TRON ENERGY LINES — hero-horizon hairlines mark major boundaries
 *     (hero/content + content/finalCTA). Cyan→amber→cyan with bloom.
 *   • NO ROTATING SLIDER on the new Hero — single CMS-driven still.
 *     The legacy HeroSlider component is preserved in /components but
 *     is no longer mounted.
 *
 * Section order (master-prompt cinematic flow):
 *   1. Hero            — full-bleed image, edge-bleeds into black
 *   2. TrustStrip      — credentials in the void, no card
 *   3. Philosophy      — asymmetric editorial, CMS-driven
 *   4. Transformations — admin-managed before/after gallery (existing)
 *   5. HowItWorks      — 3 numbered moments, no cards
 *   6. CompleteSystem  — package catalogue, calmer chrome
 *   7. Credentials     — portrait + film-credit cert roll
 *   8. FinalCTA        — last beat, CMS-driven, void-dominant
 *   9. Footer          — existing
 *
 * Hero / Philosophy / FinalCTA copy + imagery is editable from
 * /admin/marketing/homepage (T4) — they consume /api/homepage-content
 * and fall back to inline t(key, fallback) strings so the homepage
 * NEVER breaks when a CMS row is empty.
 */
export default function HomePage() {
  const { t } = useTranslation();

  // SEO: cinematic title on every paint of the homepage. Restored on
  // unmount so other pages keep their own document.title.
  useEffect(() => {
    const previousTitle = document.title;
    document.title = t(
      "home.documentTitle",
      "Youssef Ahmed — Premium Personal Training in Dubai",
    );
    return () => {
      document.title = previousTitle;
    };
  }, [t]);

  return (
    <div className="min-h-screen bg-black homepage-shell">
      <Hero />
      <TrustStrip />
      <Philosophy />
      <Transformations />
      <HowItWorks />
      <CompleteSystem />
      <Credentials />
      <FinalCTA />
      <Footer />
    </div>
  );
}
