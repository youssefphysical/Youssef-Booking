import { Calendar, Sparkles, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { usePackageTemplates } from "@/hooks/use-package-templates";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useTranslation } from "@/i18n";
import { buildContextMessage } from "@/lib/whatsapp";

/**
 * Pricing cards (Task #32, brief §14 + §34).
 *
 * Two render modes, driven by the visitor's auth + training-location:
 *  • Fitness Zone clients (logged in, training_location.kind === "fitness_zone")
 *    see a verification-only card. PT packages are billed by Fitness Zone;
 *    Youssef only confirms the receipt.
 *  • Everyone else (guests + external clients) see "From AED {N}" cards
 *    with two CTAs — Request Package Details + Contact on WhatsApp — both
 *    routed through the shared lib/whatsapp.ts helper.
 *
 * Hides itself when no active templates exist so the homepage stays clean.
 */
export function PricingCards() {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const { data: templates = [], isLoading } = usePackageTemplates({ activeOnly: true });

  const { data: trainingLocations = [] } = useQuery<any[]>({
    queryKey: ["/api/training-locations"],
    enabled: !!user && user.role === "client",
    staleTime: 60_000,
  });

  const isFitnessZone =
    !!user &&
    user.role === "client" &&
    (trainingLocations as any[]).some((loc) => loc.kind === "fitness_zone");

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="admin-shimmer h-[340px] rounded-2xl"
            data-testid={`pricing-skeleton-${i}`}
          />
        ))}
      </div>
    );
  }

  if (!templates || templates.length === 0) return null;

  if (isFitnessZone) {
    return (
      <div
        className="tron-card rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center gap-3 max-w-2xl mx-auto"
        data-testid="pricing-fitness-zone-notice"
      >
        <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
          <ShieldCheck size={22} />
        </div>
        <h3 className="font-display font-bold text-lg sm:text-xl">
          {t("pricing.fitnessZone.title")}
        </h3>
        <p className="text-sm text-muted-foreground max-w-prose">
          {t("pricing.fitnessZone.body")}
        </p>
        <Link
          href="/dashboard"
          data-testid="pricing-fitness-zone-cta"
          className="mt-2 inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("pricing.fitnessZone.cta")}
        </Link>
      </div>
    );
  }

  // Cheapest = "From AED" anchor across all cards.
  const cheapest = templates.reduce<typeof templates[number] | null>(
    (lo, t) => (lo == null || t.totalPrice < lo.totalPrice ? t : lo),
    null,
  );

  return (
    <div className="space-y-5">
      {cheapest && (
        <p
          className="text-sm text-muted-foreground"
          data-testid="pricing-from-aed-anchor"
        >
          {t("pricing.fromAed.anchor")}{" "}
          <span className="font-display font-bold text-primary tabular-nums">
            {t("common.aed")} {cheapest.totalPrice.toLocaleString()}
          </span>
        </p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 items-stretch">
        {templates.map((tpl, i) => {
          const hasBonus = tpl.bonusSessions > 0;
          const paid =
            tpl.paidSessions ||
            (hasBonus ? Math.max(tpl.totalSessions - tpl.bonusSessions, 0) : tpl.totalSessions);
          const isRecommended =
            templates.length >= 2 && i === Math.floor(templates.length / 2);

          const requestMsg = buildContextMessage("pt", {
            lang,
            packageLabel: tpl.name,
          });
          const contactMsg = buildContextMessage("contactCoach", { lang });

          return (
            <div
              key={tpl.id}
              className={`tron-card rounded-2xl sm:rounded-3xl p-5 sm:p-6 flex flex-col h-full min-w-0 card-lift relative ${
                isRecommended ? "amber-edge-glow lg:-translate-y-1" : ""
              }`}
              data-testid={`pricing-card-${tpl.id}`}
            >
              {isRecommended && (
                <span
                  className="absolute -top-2.5 end-4 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] uppercase tracking-[0.16em] font-bold warm-accent-bg amber-glow"
                  data-testid={`pricing-recommended-${tpl.id}`}
                >
                  <Sparkles size={10} />
                  {t("home.packages.recommended", "Most Popular")}
                </span>
              )}

              <div className="min-w-0">
                <p className="tron-eyebrow text-[10px] mb-1.5 truncate">
                  {t("pricing.fromAed.eyebrow")}
                </p>
                <h3 className="font-display font-bold text-lg sm:text-xl leading-tight break-words">
                  {tpl.name}
                </h3>
              </div>

              <div className="mt-4 mb-4 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3.5">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-3xl sm:text-[34px] font-display font-bold tabular-nums leading-none">
                    {paid}
                  </span>
                  <span className="text-sm text-muted-foreground truncate">
                    {t("home.packages.sessions")}
                  </span>
                </div>
                {hasBonus && (
                  <p className="text-[11px] text-emerald-300 mt-2 font-semibold">
                    +{tpl.bonusSessions} {t("home.packages.bonus")}
                  </p>
                )}
              </div>

              <div className="mb-3">
                <p className="text-[12px] uppercase tracking-[0.16em] text-muted-foreground mb-0.5">
                  {t("pricing.fromAed.label")}
                </p>
                <p className="text-[26px] sm:text-3xl font-display font-bold tabular-nums text-primary leading-none">
                  <span className="amber-stat-accent">
                    {tpl.totalPrice.toLocaleString()}
                  </span>{" "}
                  <span className="text-sm font-normal text-muted-foreground">
                    {t("common.aed")}
                  </span>
                </p>
                {tpl.pricePerSession > 0 && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {tpl.pricePerSession.toLocaleString()} {t("common.aed")} /{" "}
                    {t("home.packages.perSession")}
                  </p>
                )}
              </div>

              <ul className="space-y-2 text-sm text-muted-foreground flex-1">
                <li className="flex items-center gap-2 min-w-0">
                  <Calendar size={13} className="text-primary shrink-0" />
                  <span className="truncate">
                    {t("home.packages.validFor")}: {tpl.expirationValue}{" "}
                    {t(`admin.packageBuilder.unit.${tpl.expirationUnit}`)}
                  </span>
                </li>
                {tpl.description && (
                  <li className="text-xs leading-relaxed pt-1 break-words">
                    {tpl.description}
                  </li>
                )}
              </ul>

              <div className="mt-5 flex flex-col gap-2">
                <WhatsAppButton
                  label={t("pricing.fromAed.requestDetails")}
                  message={requestMsg}
                  testId={`pricing-request-${tpl.id}`}
                  className="w-full"
                />
                <WhatsAppButton
                  label={t("pricing.fromAed.contact")}
                  message={contactMsg}
                  testId={`pricing-contact-${tpl.id}`}
                  variant="outline"
                  className="w-full"
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default PricingCards;
