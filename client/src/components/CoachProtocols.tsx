import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Sparkles, Leaf, Flame, Crown, Lock, Check } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/i18n";
import { whatsappUrl, buildProtocolRequestWhatsApp } from "@/lib/whatsapp";
import type { PublicProtocol, ProtocolTier } from "@shared/schema";

// Coach-Curated Protocols — premium presentation surface (Phase A).
//
// Two render modes share one card system so homepage + dashboard never
// drift visually:
//   - mode="homepage" — full section with eyebrow + title + philosophy
//     strip below the cards. Used as a teaser on /.
//   - mode="dashboard" — compact, tighter spacing, no philosophy strip,
//     used in SupplementsTab as the "locked-state" before the coach has
//     activated a real protocol for the client.
//
// Both modes use the same /api/protocols/public endpoint (sanitized —
// never returns supplement items, brands, dosages, or sourcing).

type Mode = "homepage" | "dashboard";

interface Props {
  mode: Mode;
}

// Per-tier visual identity. Kept tiny and self-contained — no new color
// tokens, no new shadows. Differentiation comes from icon + a soft accent
// border that's slightly more present on the higher tiers.
const TIER_VISUAL: Record<ProtocolTier, { Icon: typeof Leaf; ring: string; tint: string }> = {
  essentials: {
    Icon: Leaf,
    ring: "ring-1 ring-white/[0.06]",
    tint: "from-white/[0.02] to-transparent",
  },
  performance: {
    Icon: Flame,
    ring: "ring-1 ring-primary/15",
    tint: "from-primary/[0.04] to-transparent",
  },
  concierge: {
    Icon: Crown,
    ring: "ring-1 ring-amber-300/20",
    tint: "from-amber-300/[0.04] to-transparent",
  },
  custom: {
    Icon: Sparkles,
    ring: "ring-1 ring-white/[0.06]",
    tint: "from-white/[0.02] to-transparent",
  },
};

export function CoachProtocols({ mode }: Props) {
  const { t } = useTranslation();

  const { data, isLoading } = useQuery<PublicProtocol[]>({
    queryKey: ["/api/protocols/public"],
    staleTime: 5 * 60 * 1000, // 5 min — copy changes rarely
  });

  // Filter to the 3 public tiers + sort by sortOrder. Custom-tier rows
  // never render here, even if an admin accidentally flips is_public on
  // a custom stack — defense in depth.
  const protocols = useMemo<PublicProtocol[]>(() => {
    const list = (data ?? []).filter((p) => p.tier !== "custom");
    return [...list].sort((a, b) => a.sortOrder - b.sortOrder);
  }, [data]);

  if (isLoading || protocols.length === 0) {
    // Render nothing on dashboard during load — TodayHero's skeleton
    // already covers the screen. On homepage we bail too because the
    // server returns the default fallback when no rows exist, so an
    // empty array means a real network failure; better silent than ugly.
    if (mode === "dashboard") return null;
    if (protocols.length === 0) return null;
  }

  if (mode === "dashboard") {
    return (
      <section
        aria-label={t("protocols.dashboardLabel", "Coach-Curated Protocols")}
        className="space-y-3"
        data-testid="section-coach-protocols-dashboard"
      >
        <header className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary/80 inline-flex items-center gap-1.5">
              <Sparkles size={11} /> {t("protocols.eyebrow", "Coach-Curated")}
            </p>
            <h3 className="font-display text-lg font-semibold leading-tight tracking-tight mt-1">
              {t("protocols.dashboardTitle", "Choose your protocol")}
            </h3>
            <p className="text-xs text-white/55 mt-1">
              {t(
                "protocols.dashboardSub",
                "Every protocol is reviewed and personalized before activation.",
              )}
            </p>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-3">
          {protocols.map((p) => (
            <ProtocolCard key={`${p.tier}-${p.id ?? "default"}`} p={p} mode="dashboard" />
          ))}
        </div>
      </section>
    );
  }

  // mode === "homepage"
  return (
    <section
      id="protocols"
      aria-label={t("protocols.homeLabel", "Coach-Curated Protocols")}
      className="homepage-section max-w-6xl mx-auto px-5 py-20"
      data-testid="section-coach-protocols-home"
    >
      <header className="text-center mb-10">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary mb-2 inline-flex items-center gap-1.5">
          <Sparkles size={11} /> {t("protocols.eyebrow", "Coach-Curated")}
        </p>
        <h2 className="font-display text-3xl sm:text-4xl font-semibold leading-tight tracking-tight">
          {t("protocols.homeTitle", "Coach-Curated Protocols")}
        </h2>
        <p className="text-sm sm:text-base text-white/60 mt-3 max-w-2xl mx-auto leading-relaxed">
          {t(
            "protocols.homeSub",
            "Three private protocol tiers, each reviewed and personalized before activation. Not a marketplace — a coaching system.",
          )}
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-5">
        {protocols.map((p, i) => (
          <motion.div
            key={`${p.tier}-${p.id ?? "default"}`}
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 0.5, delay: i * 0.06, ease: [0.22, 1, 0.36, 1] }}
          >
            <ProtocolCard p={p} mode="homepage" />
          </motion.div>
        ))}
      </div>

      {/* Why Coach-Curated — premium philosophy strip. Single calm
          paragraph; no list, no icons. Silence is part of luxury UI. */}
      <div className="max-w-3xl mx-auto mt-12 text-center">
        <p className="text-[10px] uppercase tracking-[0.3em] text-primary mb-2">
          {t("protocols.whyEyebrow", "Why coach-curated")}
        </p>
        <p className="text-sm sm:text-[15px] text-white/65 leading-relaxed">
          {t(
            "protocols.whyBody",
            "I do not choose protocols based on hype. I look at ingredient quality, sourcing integrity, absorption, testing standards, and whether it makes sense for your body, lifestyle, and training goal.",
          )}
        </p>
        <p className="text-xs text-white/45 mt-3">
          {t("protocols.whySig", "— Coach Youssef")}
        </p>
      </div>
    </section>
  );
}

// One card — used by both modes. Mode controls only spacing density and
// whether the request button is full-width or pill-sized.
function ProtocolCard({ p, mode }: { p: PublicProtocol; mode: Mode }) {
  const { t, lang } = useTranslation();
  const { data: settings } = useSettings();
  const { user } = useAuth();
  const visual = TIER_VISUAL[p.tier] ?? TIER_VISUAL.custom;
  const Icon = visual.Icon;

  const requestUrl = useMemo(() => {
    const tierLabel = p.title.replace(/\s*Protocol\s*$/i, "").trim() || p.title;
    const msg = buildProtocolRequestWhatsApp({
      tierLabel,
      lang,
      clientName: user?.fullName,
    });
    return whatsappUrl(settings?.whatsappNumber, msg);
  }, [p.title, lang, user?.fullName, settings?.whatsappNumber]);

  const isCompact = mode === "dashboard";

  return (
    <article
      className={[
        "relative rounded-3xl bg-gradient-to-br bg-card/40 backdrop-blur-sm overflow-hidden",
        visual.tint,
        visual.ring,
        isCompact ? "p-4" : "p-5 sm:p-6",
      ].join(" ")}
      data-testid={`card-protocol-${p.tier}`}
    >
      {/* Header row — icon + tier label */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={`size-10 rounded-2xl bg-white/[0.04] inline-flex items-center justify-center text-primary shrink-0`}>
          <Icon size={18} />
        </div>
        <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-white/40 px-2 py-1 rounded-full bg-white/[0.03] ring-1 ring-white/[0.05]">
          <Lock size={9} />
          {t("protocols.locked", "Locked")}
        </span>
      </div>

      <h3 className={`font-display font-semibold leading-tight tracking-tight ${isCompact ? "text-base" : "text-lg sm:text-xl"}`}>
        {p.title}
      </h3>
      <p className={`text-white/55 mt-1 leading-snug ${isCompact ? "text-xs" : "text-[13px]"}`}>
        {p.subtitle}
      </p>

      <p className={`text-white/65 mt-3 leading-relaxed ${isCompact ? "text-[12.5px]" : "text-[13.5px]"}`}>
        {p.description}
      </p>

      {p.idealFor.length > 0 && (
        <ul className={`mt-4 space-y-1.5 ${isCompact ? "text-[12px]" : "text-[12.5px]"} text-white/55`}>
          {p.idealFor.slice(0, 3).map((line) => (
            <li key={line} className="flex items-start gap-2 leading-snug">
              <Check size={12} className="text-primary/70 shrink-0 mt-0.5" />
              <span>{line}</span>
            </li>
          ))}
        </ul>
      )}

      {/* CTA — single primary action only. WhatsApp open in new tab.
          Tertiary helper line below explains the manual review step so
          clients know there's no checkout / no surprise charges. */}
      <div className={`pt-4 mt-4 border-t border-white/[0.05] ${isCompact ? "" : "sm:pt-5 sm:mt-5"}`}>
        <a
          href={requestUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center gap-2 px-4 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 transition text-sm font-semibold"
          data-testid={`link-request-${p.tier}`}
        >
          <SiWhatsapp size={14} />
          {t("protocols.requestCta", "Request") + " " + p.title.replace(/\s*Protocol\s*$/i, "").trim() + " " + t("protocols.protocolWord", "Protocol")}
        </a>
        <p className="text-[10.5px] text-white/40 mt-2 text-center leading-relaxed">
          {t("protocols.reviewNote", "Every protocol is reviewed before activation.")}
        </p>
      </div>
    </article>
  );
}
