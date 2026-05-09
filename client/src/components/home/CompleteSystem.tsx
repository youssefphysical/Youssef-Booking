import { Calendar, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { useTranslation } from "@/i18n";
import { usePackageTemplates } from "@/hooks/use-package-templates";
import { WhatsAppButton } from "@/components/WhatsAppButton";

/**
 * Cinematic packages section — admin-managed catalogue.
 *
 * Composition: NO heavy tron-card border around every tile. Tiles are
 * minimal black surfaces with a single thin top hairline that lights up
 * to amber on hover. Pricing is the typographic centerpiece (oversized
 * tabular numerals). Bonus session callout preserved (it's a real value
 * proposition) but rendered with calmer styling.
 *
 * Hides itself entirely when no active templates exist (keeps the
 * homepage clean for new sites with no products yet).
 */
export function CompleteSystem() {
  const { t } = useTranslation();
  const { data: templates = [] } = usePackageTemplates({ activeOnly: true });
  if (!templates || templates.length === 0) return null;

  return (
    <section
      className="relative max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-28"
      id="packages"
      data-testid="cinematic-system"
    >
      <div className="mb-14 sm:mb-16">
        <div className="flex items-center gap-3 mb-5 text-[10px] sm:text-[11px] tracking-[0.32em] uppercase text-white/60">
          <span className="hero-eyebrow-rule" aria-hidden="true" />
          <span>{t("home.packages.eyebrow", "TRAINING PROTOCOLS")}</span>
        </div>
        <h2
          className="font-display font-bold text-white leading-[1.05] tracking-[-0.025em] max-w-3xl"
          style={{ fontSize: "clamp(1.875rem, 4.5vw, 3.5rem)" }}
        >
          {t("home.packages.title", "The complete training system.")}
        </h2>
        <p className="mt-5 text-base sm:text-lg text-white/65 max-w-2xl leading-[1.6]">
          {t(
            "home.packages.subtitle",
            "Choose the protocol that matches your commitment. Every plan includes the full coaching system — programming, tracking, check-ins, and your private dashboard.",
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 items-stretch">
        {templates.map((tpl, i) => {
          const message = t("home.packages.whatsappMsg").replace("{name}", tpl.name);
          const hasBonus = tpl.bonusSessions > 0;
          const paid =
            tpl.paidSessions ||
            (hasBonus
              ? Math.max(tpl.totalSessions - tpl.bonusSessions, 0)
              : tpl.totalSessions);
          return (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ delay: Math.min(i * 0.05, 0.3) }}
              className="group relative bg-black/40 border-t border-white/[0.06] hover:border-amber-400/40 transition-colors p-6 sm:p-7 flex flex-col h-full min-w-0"
              data-testid={`cinematic-package-${tpl.id}`}
            >
              {/* Editorial eyebrow + name */}
              <p className="text-[10px] tracking-[0.32em] uppercase text-white/55 mb-3 truncate">
                {t(`admin.packageBuilder.type.${tpl.type}`)}
              </p>
              <h3 className="font-display font-bold text-2xl sm:text-[26px] leading-[1.15] text-white break-words">
                {tpl.name}
              </h3>

              {/* Sessions block — calmer than the previous tron-card variant */}
              <div className="mt-7 mb-7">
                <div className="flex items-baseline gap-2 min-w-0">
                  <span className="text-5xl sm:text-[52px] font-display font-bold tabular-nums leading-none text-white">
                    {paid}
                  </span>
                  <span className="text-sm text-white/55 truncate">
                    {t("home.packages.sessions")}
                  </span>
                </div>
                {hasBonus && (
                  <div className="mt-3 inline-flex items-center gap-1.5 text-emerald-300/90 text-[12px]">
                    <Sparkles size={12} className="shrink-0" />
                    <span className="tabular-nums font-semibold">
                      +{tpl.bonusSessions}
                    </span>
                    <span className="font-medium">
                      {t("home.packages.bonus", "bonus")}
                    </span>
                    <span className="text-[10px] tracking-wider uppercase text-emerald-400/70 ms-1">
                      {t("home.packages.bonusBadge", "by Coach")}
                    </span>
                  </div>
                )}
              </div>

              {/* Price — typographic centerpiece */}
              <div className="mb-5 pb-5 border-b border-white/[0.05]">
                <p className="text-[34px] sm:text-[38px] font-display font-bold tabular-nums text-primary leading-none">
                  {tpl.totalPrice.toLocaleString()}
                  <span className="text-base font-normal text-white/55 ms-2">
                    {t("common.aed", "AED")}
                  </span>
                </p>
                {tpl.pricePerSession > 0 && (
                  <p className="text-xs text-white/55 mt-2 tabular-nums">
                    {tpl.pricePerSession.toLocaleString()} {t("common.aed", "AED")} /{" "}
                    {t("home.packages.perSession", "session")}
                  </p>
                )}
              </div>

              {/* Validity + description */}
              <ul className="space-y-2 text-sm text-white/65 flex-1">
                <li className="flex items-center gap-2 min-w-0">
                  <Calendar size={13} className="text-primary/80 shrink-0" />
                  <span className="truncate">
                    {t("home.packages.validFor")}: {tpl.expirationValue}{" "}
                    {t(`admin.packageBuilder.unit.${tpl.expirationUnit}`)}
                  </span>
                </li>
                {tpl.description && (
                  <li className="text-xs leading-[1.6] pt-2 break-words text-white/55">
                    {tpl.description}
                  </li>
                )}
              </ul>

              <WhatsAppButton
                label={t("home.packages.requestCta")}
                message={message}
                testId={`button-cinematic-request-${tpl.id}`}
                className="mt-6 w-full"
              />
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
