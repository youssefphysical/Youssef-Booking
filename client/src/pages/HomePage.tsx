import { Footer } from "@/components/Footer";
import { Transformations } from "@/components/Transformations";
import { CoachProtocols } from "@/components/CoachProtocols";
import { Hero } from "@/components/home/Hero";
import { Philosophy } from "@/components/home/Philosophy";
import { HowItWorks } from "@/components/home/HowItWorks";
import { CompleteSystem } from "@/components/home/CompleteSystem";
import { Credentials } from "@/components/home/Credentials";
import { FinalCTA } from "@/components/home/FinalCTA";
import { useHomepageContent } from "@/hooks/use-homepage-content";

/**
 * Tron-Legacy homepage rebuild (May-2026).
 *
 * Marketing flow per master prompt:
 *   1. Hero            (admin CMS image)
 *   2. Philosophy      (admin CMS image)
 *   3. Transformations (existing DB-backed component)
 *   4. How It Works    (5-step static timeline)
 *   5. Coach-Curated Protocols (existing component, Phase A)
 *   6. Complete Coaching System (5 cards)
 *   7. Credentials     (hardcoded — never invented)
 *   8. Final CTA       (admin CMS image)
 *   9. Footer
 *
 * All admin-editable images flow through one `/api/homepage-content`
 * fetch — components render their built-in premium fallback copy when
 * a key is missing or inactive, so first paint is never blank.
 *
 * Sections from the prior homepage that are intentionally not on this
 * new page (PublicPackages, About bio, Specialties, "Why train") have
 * been retired in favour of the master-prompt's tighter conversion
 * funnel. Packages are still managed under /admin/packages and shown
 * on the booking flow; the public site is now coach-led, not catalogue-
 * led.
 */
export default function HomePage() {
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
      <Footer />
    </div>
  );
}
