import { useMemo } from "react";
import { motion } from "framer-motion";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { Sparkles, Calendar as CalendarIcon, RefreshCw, Users, Info } from "lucide-react";
import { formatDateDubai } from "@shared/dates";
import { Button } from "@/components/ui/button";
import { InfoTip } from "@/components/ui/InfoTip";
import { usePackages } from "@/hooks/use-packages";
import { type Package, PACKAGE_DEFINITIONS } from "@shared/schema";
import { useTranslation } from "@/i18n";

// Premium "active package" hero card.
// Pure presentational — reads from /api/me/packages via usePackages hook.

function daysUntil(d?: string | Date | null): number | null {
  if (!d) return null;
  const t = new Date(d as any).getTime();
  if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function tierBadgeFor(type: string): { label: string; cls: string } {
  const t = type.toLowerCase();
  if (t.includes("platinum"))
    return { label: "Platinum Package", cls: "border-violet-400/40 text-violet-300 bg-violet-400/[0.06]" };
  if (t.includes("gold"))
    return { label: "Gold Package", cls: "border-amber-400/40 text-amber-300 bg-amber-400/[0.06]" };
  if (t.includes("silver"))
    return { label: "Silver Package", cls: "border-slate-400/40 text-slate-300 bg-slate-400/[0.07]" };
  if (t.includes("duo"))
    return { label: "Duo Package", cls: "border-cyan-400/40 text-cyan-300 bg-cyan-400/[0.06]" };
  return {
    label: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()) + " Package",
    cls: "border-primary/30 text-primary bg-primary/[0.06]",
  };
}

export function PackageStatusHero({
  userId,
  onRenew,
}: {
  userId: number;
  onRenew: () => void;
}) {
  const { t } = useTranslation();
  const { data: packages = [], isLoading } = usePackages({ userId });

  const active = useMemo(() => {
    const list = packages as Package[];
    return (
      list.find((p) => p.isActive && p.usedSessions < p.totalSessions) ||
      list.find((p) => p.isActive) ||
      null
    );
  }, [packages]);

  if (isLoading) {
    return (
      <div
        className="mb-6 rounded-3xl border border-white/[0.08] bg-card/40 p-6"
        data-testid="package-status-loading"
      >
        <div className="h-4 w-40 admin-shimmer rounded mb-4" />
        <div className="h-32 admin-shimmer rounded-2xl" />
      </div>
    );
  }

  if (!active) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-card/40 p-6"
        data-testid="package-status-empty"
      >
        <CyanHairline />
        <p className="tron-eyebrow text-[10px] font-semibold">
          {t("dashboard.packageStatus", "Package status")}
        </p>
        <h3 className="mt-2 text-xl sm:text-2xl font-display font-semibold">
          {t("dashboard.packagesNone", "No active package")}
        </h3>
        <p className="mt-1 text-sm text-muted-foreground max-w-md">
          {t(
            "dashboard.packagesEmptyDesc",
            "Get started with a training package — message Youssef and he'll set you up.",
          )}
        </p>
        <Button
          variant="outline"
          className="mt-4 rounded-xl"
          onClick={onRenew}
          data-testid="button-package-hero-empty"
        >
          {t("dashboard.requestRenewal", "Request Package")}
        </Button>
      </motion.section>
    );
  }

  const def = PACKAGE_DEFINITIONS[active.type];
  const bonusSessions = (active as any).bonusSessions ?? 0;
  const paidSessions = (active as any).paidSessions ?? (active.totalSessions - bonusSessions);
  const remaining = active.totalSessions - active.usedSessions;
  const pct = Math.round((active.usedSessions / Math.max(active.totalSessions, 1)) * 100);
  const days = daysUntil(active.expiryDate as any);
  const expiringSoon = days !== null && days >= 0 && days <= 14;
  const tier = tierBadgeFor(active.type);

  // SVG ring math — r=56, stroke=10 → 140×140 viewBox
  const r = 56;
  const C = 2 * Math.PI * r;
  const dash = C * (active.usedSessions / Math.max(active.totalSessions, 1));

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative mb-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-card/40 p-5 sm:p-7"
      data-testid="package-status-hero"
    >
      <CyanHairline intensity="strong" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -right-20 h-64 w-64 rounded-full opacity-50"
        style={{
          background: "radial-gradient(circle, hsl(183 100% 60% / 0.16), transparent 70%)",
        }}
      />

      <div className="relative flex flex-col sm:flex-row sm:items-start gap-6 sm:gap-8">
        {/* Progress ring */}
        <div
          className="relative shrink-0 self-center"
          style={{ width: 140, height: 140 }}
        >
          <svg width={140} height={140} viewBox="0 0 140 140" className="-rotate-90">
            <circle
              cx={70}
              cy={70}
              r={r}
              fill="none"
              stroke="hsl(0 0% 100% / 0.08)"
              strokeWidth={10}
            />
            <motion.circle
              cx={70}
              cy={70}
              r={r}
              fill="none"
              stroke="hsl(183 100% 60%)"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={C}
              initial={{ strokeDashoffset: C }}
              animate={{ strokeDashoffset: C - dash }}
              transition={{ duration: 1.1, ease: "easeOut" }}
              style={{
                filter: "drop-shadow(0 0 8px hsl(183 100% 60% / 0.55))",
              }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span
              className="text-3xl sm:text-4xl font-display font-bold tabular-nums leading-none"
              data-testid="text-package-remaining"
            >
              {remaining}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1.5">
              {t("dashboard.sessionsRemaining", "Sessions left")}
            </span>
          </div>
        </div>

        {/* Details */}
        <div className="min-w-0 flex-1">
          <p className="tron-eyebrow text-[10px] font-semibold">
            {t("dashboard.activePackage", "Active package")}
          </p>
          <h3
            className="mt-1.5 text-2xl sm:text-3xl font-display font-bold leading-tight"
            data-testid="text-package-name"
          >
            {(active as any).name || def?.label || `${active.type} Package`}
          </h3>

          {/* Luxury tier badge */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center text-[9px] uppercase tracking-[0.22em] font-black px-2 py-0.5 rounded border ${tier.cls}`}
              data-testid="text-package-tier-badge"
            >
              {tier.label}
            </span>
            {def?.isDuo && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                <Users size={11} /> {t("dashboard.packageDuo", "Duo")}
              </span>
            )}
            {/* ✨ Coach Reward badge */}
            {bonusSessions > 0 && (
              <span
                className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-500/[0.08] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-emerald-300 font-black shadow-[0_0_10px_-5px_rgba(16,185,129,0.5)]"
                data-testid="badge-coach-reward"
              >
                ✨ Coach Reward
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-muted-foreground">
              {pct}% {t("dashboard.packageUsed", "used")}
            </span>
          </div>

          {/* Session breakdown — only when bonus sessions exist */}
          {bonusSessions > 0 && (
            <div
              className="mt-3 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] px-3.5 py-3"
              data-testid="package-hero-breakdown"
            >
              <div className="flex items-center gap-1.5 mb-2">
                <Sparkles size={11} className="text-emerald-400 shrink-0" />
                <span className="text-[9px] uppercase tracking-[0.18em] text-emerald-300 font-semibold">
                  {t("dashboard.sessionBreakdown", "Session breakdown")}
                </span>
                <button
                  type="button"
                  title="Coach bonus sessions added to your package."
                  aria-label="About bonus sessions"
                  className="text-muted-foreground/50 hover:text-emerald-300/80 transition-colors cursor-help"
                  data-testid="button-bonus-info-hero"
                >
                  <Info size={10} />
                </button>
              </div>
              <div className="grid grid-cols-3 gap-1.5 text-center">
                <div className="rounded-xl border border-white/5 bg-white/[0.03] px-1.5 py-2">
                  <p className="text-base font-display font-bold tabular-nums leading-none text-foreground">
                    {paidSessions}
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.13em] text-muted-foreground mt-1">
                    {t("dashboard.purchasedSessions", "Purchased")}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-1.5 py-2">
                  <p className="text-base font-display font-bold tabular-nums leading-none text-emerald-300">
                    +{bonusSessions}
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.13em] text-emerald-400/80 mt-1">
                    {t("dashboard.bonusSessions", "Bonus")}
                  </p>
                </div>
                <div className="rounded-xl border border-primary/25 bg-primary/[0.06] px-1.5 py-2">
                  <p className="text-base font-display font-bold tabular-nums leading-none text-primary">
                    {active.totalSessions}
                  </p>
                  <p className="text-[9px] uppercase tracking-[0.13em] text-primary/80 mt-1">
                    {t("dashboard.totalSessions", "Total")}
                  </p>
                </div>
              </div>
              <div className="mt-2 flex justify-between text-[10px] text-muted-foreground px-0.5">
                <span>{t("dashboard.usedSessionsLabel", "Used")}: <span className="text-foreground/80 tabular-nums">{active.usedSessions}</span></span>
                <span>{t("dashboard.remainingSessionsLabel", "Remaining")}: <span className="text-primary tabular-nums font-semibold">{remaining}</span></span>
              </div>
            </div>
          )}

          {/* Linear progress bar with "X / Y Sessions Remaining" */}
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between text-[11px] tabular-nums">
              <span className="text-foreground/80 font-medium" data-testid="text-package-sessions-label">
                {remaining} / {active.totalSessions} {t("dashboard.sessionsRemainingLabel", "Sessions Remaining")}
              </span>
              <span className="text-muted-foreground">{active.usedSessions} {t("dashboard.sessionsUsedLabel", "used")}</span>
            </div>
            <div className="relative h-1.5 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
                style={{ boxShadow: "0 0 8px hsl(183 100% 60% / 0.5)" }}
              />
            </div>
          </div>

          {/* Expiry — prominent inline placement */}
          {active.expiryDate && (
            <div
              className={`mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                expiringSoon
                  ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
                  : "border-white/10 bg-white/[0.04] text-muted-foreground"
              }`}
              data-testid="text-package-expiry"
            >
              <CalendarIcon size={12} />
              <span>
                <span className="font-medium">{t("dashboard.packageExpiresLabel", "Expires")}: </span>
                {formatDateDubai(active.expiryDate as any)}
                {days !== null && days >= 0 && (
                  <span className={`ml-1.5 ${expiringSoon ? "text-cyan-300 font-semibold" : ""}`}>
                    · {days}d {t("dashboard.daysLeft", "left")}
                  </span>
                )}
              </span>
              <InfoTip
                title={t("tooltip.packageExpiry.title")}
                body={t("tooltip.packageExpiry.body")}
                testId="infotip-package-expiry"
              />
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              variant="outline"
              className="rounded-xl h-10"
              onClick={onRenew}
              data-testid="button-package-renew"
            >
              <RefreshCw size={14} className="mr-1.5" />
              {t("dashboard.requestRenewal", "Request Renewal")}
            </Button>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
