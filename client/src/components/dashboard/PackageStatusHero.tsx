import { useMemo } from "react";
import { motion } from "framer-motion";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { Sparkles, Calendar as CalendarIcon, RefreshCw, Users } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { usePackages } from "@/hooks/use-packages";
import { type Package, PACKAGE_DEFINITIONS } from "@shared/schema";
import { useTranslation } from "@/i18n";

// Premium "active package" hero card (May 2026 client profile redesign).
// Pure presentational. Reads from existing /api/me/packages via the same
// `usePackages` hook the PackagesTab uses — no new endpoints. The Renew
// button delegates to a parent callback so the existing RenewalRequest
// dialog (housed inside PackagesTab) remains the single source of truth
// for renewal logic; this card just deep-links to the packages tab.

function daysUntil(d?: string | Date | null): number | null {
  if (!d) return null;
  const t = new Date(d as any).getTime();
  if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export function PackageStatusHero({
  userId,
  onRenew,
}: {
  userId: number;
  /** Called by the Renew button. Parent jumps to the packages tab where
   *  the existing RenewalRequestDialog lives. */
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
  const remaining = active.totalSessions - active.usedSessions;
  const pct = Math.round((active.usedSessions / Math.max(active.totalSessions, 1)) * 100);
  const days = daysUntil(active.expiryDate as any);
  const expiringSoon = days !== null && days >= 0 && days <= 14;

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

      <div className="relative flex flex-col sm:flex-row sm:items-center gap-6 sm:gap-8">
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

          <div className="mt-3 flex flex-wrap items-center gap-2">
            {def?.isDuo && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                <Users size={11} /> {t("dashboard.packageDuo", "Duo")}
              </span>
            )}
            {((active as any).bonusSessions ?? 0) > 0 && (
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/12 border border-emerald-400/30 px-2 py-1 text-emerald-300 text-[11px] font-display font-bold shadow-[0_0_14px_-6px_rgba(16,185,129,0.5)]">
                <Sparkles size={11} /> +{(active as any).bonusSessions}{" "}
                {t("home.packages.bonus", "bonus")}
              </span>
            )}
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2 py-1 text-[11px] text-muted-foreground">
              {pct}% {t("dashboard.packageUsed", "used")}
            </span>
          </div>

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
                {expiringSoon && days !== null
                  ? t("dashboard.packageExpiresInDays", "Expires in {days} days").replace(
                      "{days}",
                      String(Math.max(0, days)),
                    )
                  : t("dashboard.packageExpiresOn", "Expires {date}").replace(
                      "{date}",
                      format(new Date(active.expiryDate as any), "MMM d, yyyy"),
                    )}
              </span>
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
