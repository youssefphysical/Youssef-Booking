import { useMemo } from "react";
import { motion } from "framer-motion";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { CalendarIcon, RefreshCw, Users, Sparkles } from "lucide-react";
import { formatDateDubai } from "@shared/dates";
import { Button } from "@/components/ui/button";
import { usePackages } from "@/hooks/use-packages";
import { type Package, PACKAGE_DEFINITIONS } from "@shared/schema";
import { useTranslation } from "@/i18n";

function daysUntil(d?: string | Date | null): number | null {
  if (!d) return null;
  const t = new Date(d as any).getTime();
  if (isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

function tierBadgeFor(type: string): { label: string; cls: string } {
  const t = type.toLowerCase();
  if (t.includes("platinum"))
    return { label: "Platinum", cls: "border-slate-300/40 text-slate-300 bg-slate-300/[0.06]" };
  if (t.includes("gold"))
    return { label: "Gold", cls: "border-amber-400/40 text-amber-300 bg-amber-400/[0.06]" };
  if (t.includes("silver"))
    return { label: "Silver", cls: "border-slate-400/40 text-slate-300 bg-slate-400/[0.07]" };
  if (t.includes("duo"))
    return { label: "Duo", cls: "border-cyan-400/40 text-cyan-300 bg-cyan-400/[0.06]" };
  return {
    label: type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
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
        className="mb-6 rounded-3xl border border-white/[0.08] bg-card/40 p-4"
        data-testid="package-status-loading"
      >
        <div className="h-4 w-32 admin-shimmer rounded mb-3" />
        <div className="h-20 admin-shimmer rounded-2xl" />
      </div>
    );
  }

  if (!active) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative mb-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-card/40 p-4 sm:p-5"
        data-testid="package-status-empty"
      >
        <CyanHairline />
        <p className="tron-eyebrow text-[10px] font-semibold mb-1">
          {t("dashboard.packageStatus", "Package status")}
        </p>
        <h3 className="text-lg font-display font-semibold mb-1">
          {t("dashboard.packagesNone", "No active package")}
        </h3>
        <p className="text-sm text-muted-foreground mb-3">
          {t("dashboard.packagesEmptyDesc", "Message Youssef to get started.")}
        </p>
        <Button
          variant="outline"
          className="rounded-xl h-9 text-sm w-full"
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
  const remaining = active.totalSessions - active.usedSessions;
  const pct = Math.round((active.usedSessions / Math.max(active.totalSessions, 1)) * 100);
  const days = daysUntil(active.expiryDate as any);
  const expiringSoon = days !== null && days >= 0 && days <= 14;
  const tier = tierBadgeFor(active.type);
  const packageName = (active as any).name || def?.label || `${active.type} Package`;
  const isDuo = !!def?.isDuo;

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative mb-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-card/40 p-4 sm:p-5"
      data-testid="package-status-hero"
    >
      <CyanHairline intensity="strong" />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-40"
        style={{
          background: "radial-gradient(circle, hsl(183 100% 60% / 0.14), transparent 70%)",
        }}
      />

      {/* Row 1: eyebrow + status badge */}
      <div className="relative flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <p className="tron-eyebrow text-[10px] font-semibold mb-1">
            {t("dashboard.activePackage", "Active package")}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            <h3
              className="text-xl font-display font-bold leading-tight"
              data-testid="text-package-name"
            >
              {packageName}
            </h3>
            {isDuo && (
              <span className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300">
                <Users size={10} /> Duo
              </span>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span
            className={`inline-flex items-center text-[8px] uppercase tracking-[0.22em] font-black px-2 py-0.5 rounded border ${tier.cls}`}
            data-testid="text-package-tier-badge"
          >
            {tier.label}
          </span>
          <span
            className={`inline-flex items-center text-[8px] uppercase tracking-[0.18em] font-bold px-2 py-0.5 rounded border ${
              expiringSoon
                ? "border-amber-400/40 text-amber-300 bg-amber-400/[0.07]"
                : "border-emerald-400/30 text-emerald-300 bg-emerald-500/[0.06]"
            }`}
          >
            {expiringSoon ? "Expiring soon" : "Active"}
          </span>
        </div>
      </div>

      {/* Row 2: Key stats — sessions left + expiry */}
      <div className="relative grid grid-cols-2 gap-2 mb-4">
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-center">
          <div
            className="text-3xl font-display font-bold tabular-nums text-primary leading-none"
            data-testid="text-package-remaining"
          >
            {remaining}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1.5">
            {t("dashboard.sessionsRemaining", "Sessions left")}
          </div>
          {bonusSessions > 0 && (
            <div
              className="mt-1 inline-flex items-center gap-0.5 text-[8px] text-emerald-300 font-semibold"
              data-testid="badge-coach-reward"
            >
              <Sparkles size={8} /> +{bonusSessions} bonus
            </div>
          )}
        </div>
        <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] px-3 py-3 text-center">
          <div
            className="text-sm font-display font-semibold leading-tight"
            data-testid="text-package-expiry"
          >
            {active.expiryDate
              ? formatDateDubai(active.expiryDate as any)
              : "—"}
          </div>
          <div className="text-[9px] uppercase tracking-wider text-muted-foreground mt-1.5">
            {t("dashboard.packageExpiresLabel", "Expires")}
          </div>
          {days !== null && days >= 0 && (
            <div className={`mt-1 text-[9px] font-semibold tabular-nums ${expiringSoon ? "text-amber-300" : "text-muted-foreground"}`}>
              {days}d {t("dashboard.daysLeft", "left")}
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative mb-4">
        <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
          <span data-testid="text-package-sessions-label">
            {active.usedSessions} / {active.totalSessions} {t("dashboard.sessionsUsedLabel", "used")}
          </span>
          <span className="text-foreground/60">{pct}%</span>
        </div>
        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
            style={{ boxShadow: "0 0 8px hsl(183 100% 60% / 0.5)" }}
          />
        </div>
      </div>

      {/* Action button */}
      <div className="relative">
        <Button
          variant="outline"
          className="rounded-xl h-9 text-sm w-full"
          onClick={onRenew}
          data-testid="button-package-renew"
        >
          <RefreshCw size={13} className="mr-1.5" />
          {t("dashboard.requestRenewal", "Request Renewal")}
        </Button>
      </div>
    </motion.section>
  );
}
