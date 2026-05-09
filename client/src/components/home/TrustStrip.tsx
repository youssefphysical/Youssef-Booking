import { useTranslation } from "@/i18n";

/**
 * Cinematic trust micro-strip — sits in the void below the hero with
 * NO card, NO border, NO background. Just three credentials separated
 * by amber dots, uppercase wide-tracking. Reads like a film-credit
 * undertitle, not a dashboard chip row.
 */
export function TrustStrip() {
  const { t } = useTranslation();
  return (
    <section
      className="relative max-w-6xl mx-auto px-5 py-10 sm:py-14"
      data-testid="cinematic-trust-strip"
    >
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 text-[10px] sm:text-[11px] tracking-[0.28em] uppercase text-white/55">
        <span data-testid="trust-cert">
          {t("hero.trust.cert", "REPs UAE Certified")}
        </span>
        <span className="amber-dot" aria-hidden="true" />
        <span data-testid="trust-experience">
          {t("hero.trust.experience", "10+ Years Experience")}
        </span>
        <span className="amber-dot" aria-hidden="true" />
        <span data-testid="trust-clients">
          {t("hero.trust.clients", "500+ Clients Coached")}
        </span>
      </div>
    </section>
  );
}
