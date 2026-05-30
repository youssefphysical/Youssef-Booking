import { format } from "date-fns";
import { motion } from "framer-motion";
import {
  Sparkles,
  Users,
  Wallet,
  BadgeCheck,
  Gift,
  RefreshCw,
  CalendarPlus,
  CalendarClock,
  Gauge,
  Info,
} from "lucide-react";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { PACKAGE_DEFINITIONS } from "@shared/schema";
import type { Package, Booking, BookingWithUser } from "@shared/schema";

type AnyBooking = Booking | BookingWithUser;
export type PackageStatus = "active" | "expiring_soon" | "expired" | "completed";

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

export function computeSessionsPerWeek(
  bookings: AnyBooking[],
  now: number = Date.now(),
): number {
  if (!Array.isArray(bookings) || bookings.length === 0) return 0;
  const windowMs = 28 * 86400_000;
  const cutoff = now - windowMs;
  let count = 0;
  for (const b of bookings) {
    if ((b as any).status !== "completed") continue;
    const raw = (b as any).date;
    if (!raw) continue;
    const t = new Date(raw).getTime();
    if (!Number.isFinite(t)) continue;
    if (t >= cutoff && t <= now) count += 1;
  }
  return count / 4;
}

export interface EtaCopy {
  weeks: string;
  finalWeek: string;
  fallback: string;
}

export function formatEta(
  remainingSessions: number,
  sessionsPerWeek: number,
  copy: EtaCopy,
): string {
  if (remainingSessions <= 0) return copy.fallback;
  if (sessionsPerWeek <= 0) return copy.fallback;
  const weeks = Math.ceil(remainingSessions / sessionsPerWeek);
  if (weeks <= 1) return copy.finalWeek;
  return copy.weeks.replace("{weeks}", String(weeks));
}

// ─────────────────────────────────────────────────────────────────────────────
// Tier badge mapping
// ─────────────────────────────────────────────────────────────────────────────

function tierBadgeFor(type: string): { label: string; cls: string } {
  const t = type.toLowerCase();
  if (t.includes("platinum"))
    return { label: "Platinum Package", cls: "border-slate-300/40 text-slate-300 bg-slate-300/[0.06]" };
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

// ─────────────────────────────────────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────────────────────────────────────

export interface PackageConfidenceCardProps {
  pkg: Package;
  bookings: AnyBooking[];
  status: PackageStatus;
  daysUntilExpiry: number | null;
  onRequestRenewal: () => void;
  onRequestExtension: () => void;
}

export function PackageConfidenceCard({
  pkg,
  bookings,
  status,
  daysUntilExpiry,
  onRequestRenewal,
  onRequestExtension,
}: PackageConfidenceCardProps) {
  const { t } = useTranslation();
  const def = PACKAGE_DEFINITIONS[pkg.type];

  const completed = pkg.usedSessions;
  const total = Math.max(pkg.totalSessions, 1);
  const remaining = Math.max(0, pkg.totalSessions - pkg.usedSessions);
  const pct = Math.min(100, Math.round((completed / total) * 100));
  const bonusSessions = (pkg as any).bonusSessions ?? 0;
  const paidSessions = (pkg as any).paidSessions ?? (pkg.totalSessions - bonusSessions);

  const pace = computeSessionsPerWeek(bookings);
  const etaText = formatEta(remaining, pace, {
    weeks: t("dashboard.packageEtaWeeks", "Estimated completion: ~{weeks} weeks remaining"),
    finalWeek: t("dashboard.packageEtaFinalWeek", "Estimated completion: final week"),
    fallback: t("dashboard.packageEtaFallback", "Pace your sessions to finish strong."),
  });

  const expiry = pkg.expiryDate ? new Date(pkg.expiryDate as any) : null;
  const validUntilDate = expiry && Number.isFinite(expiry.getTime())
    ? format(expiry, "d MMM yyyy")
    : null;

  const totalPrice = ((pkg as any).totalPrice ?? 0) as number;
  const amountPaid = ((pkg as any).amountPaid ?? 0) as number;
  const outstanding = Math.max(0, totalPrice - amountPaid);
  const payStatus = (((pkg as any).paymentStatus ?? "unpaid") as string);
  const isFrozen = !!(pkg as any).frozen;

  const tier = tierBadgeFor(pkg.type);

  const payBadge =
    payStatus === "paid"
      ? { label: t("dashboard.packagePayPaid", "Paid in Full"), cls: "bg-emerald-500/10 border-emerald-400/30 text-emerald-300", icon: <BadgeCheck size={11} /> }
      : payStatus === "partially_paid"
        ? { label: t("dashboard.packagePayPartial", "Partial Payment"), cls: "bg-cyan-500/10 border-cyan-400/30 text-cyan-300", icon: <Wallet size={11} /> }
        : payStatus === "complimentary"
          ? { label: t("dashboard.packagePayComp", "Complimentary"), cls: "bg-sky-500/10 border-sky-400/30 text-sky-200", icon: <Gift size={11} /> }
          : { label: t("dashboard.packagePayPending", "Payment Pending"), cls: "bg-rose-500/10 border-rose-400/30 text-rose-200", icon: <Wallet size={11} /> };

  const statusBadge =
    isFrozen
      ? { label: t("dashboard.packageStatusFrozen", "Frozen"), cls: "bg-cyan-500/10 border-cyan-400/30 text-cyan-200" }
      : status === "expired"
        ? { label: t("dashboard.packageStatusExpired", "Expired"), cls: "bg-red-500/10 border-red-500/30 text-red-300" }
        : status === "expiring_soon"
          ? { label: t("dashboard.packageStatusExpiring", "Renewing soon"), cls: "bg-cyan-500/10 border-cyan-500/30 text-cyan-300" }
          : status === "completed"
            ? { label: t("dashboard.packageStatusCompleted", "Completed"), cls: "bg-sky-500/10 border-sky-500/30 text-sky-300" }
            : { label: t("dashboard.packageStatusActive", "Active"), cls: "bg-primary/10 border-primary/30 text-primary" };

  const lowSessions = remaining > 0 && remaining <= 3;
  const lowDays = daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 7;
  const showRenewalCta =
    pkg.isActive &&
    (lowSessions || lowDays || status === "expired" || status === "expiring_soon" || status === "completed");
  const showExtensionCta = pkg.isActive && status !== "completed" && (lowDays || status === "expired" || status === "expiring_soon");

  return (
    <motion.div
      key={pkg.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative overflow-hidden rounded-2xl border p-5 sm:p-6 ${
        pkg.isActive ? "border-primary/30 bg-primary/5" : "border-white/5 bg-card/60 opacity-70"
      }`}
      data-testid={`card-package-confidence-${pkg.id}`}
    >
      {pkg.isActive && <CyanHairline intensity="strong" inset="inset-x-5 sm:inset-x-6" />}

      {/* Header — name + tier badge + status / payment badges */}
      <div className="relative flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-1 truncate" data-testid={`text-package-name-${pkg.id}`}>
            {(pkg as any).name || def?.label || `${pkg.type} Package`}
          </p>
          {/* Luxury tier badge */}
          <span
            className={`inline-flex items-center text-[9px] uppercase tracking-[0.22em] font-black px-2 py-0.5 rounded border ${tier.cls}`}
            data-testid={`package-tier-badge-${pkg.id}`}
          >
            {tier.label}
          </span>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span
            className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-lg border font-bold whitespace-nowrap ${statusBadge.cls}`}
            data-testid={`package-status-${pkg.id}`}
          >
            {statusBadge.label}
          </span>
          <span
            className={`inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-lg border font-bold whitespace-nowrap ${payBadge.cls}`}
            data-testid={`package-payment-${pkg.id}`}
          >
            {payBadge.icon}
            {payBadge.label}
          </span>
          {def?.isDuo && (
            <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2.5 py-1 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 whitespace-nowrap">
              <Users size={11} /> {t("dashboard.packageDuo", "Duo")}
            </span>
          )}
        </div>
      </div>

      {/* Big dual-number row: Completed | Remaining */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3" data-testid={`text-package-completed-${pkg.id}`}>
          <p className="text-3xl font-display font-bold tabular-nums leading-none text-foreground">
            {completed}
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground mt-2">
            {t("dashboard.packageNumCompleted", "Completed")}
          </p>
        </div>
        <div className="rounded-xl border border-primary/25 bg-primary/[0.06] px-4 py-3" data-testid={`text-package-remaining-${pkg.id}`}>
          <p className="text-3xl font-display font-bold tabular-nums leading-none text-primary">
            {remaining}
          </p>
          <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80 mt-2">
            {t("dashboard.packageNumRemaining", "Remaining")}
          </p>
        </div>
      </div>

      {/* Session breakdown — shown when bonus sessions exist */}
      {bonusSessions > 0 && (
        <div
          className="mb-4 rounded-2xl border border-emerald-400/20 bg-emerald-500/[0.05] p-3.5"
          data-testid={`package-breakdown-${pkg.id}`}
        >
          {/* Header row: label + Coach Reward badge + info tooltip */}
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-1.5">
              <Sparkles size={12} className="text-emerald-400 shrink-0" />
              <span className="text-[10px] uppercase tracking-[0.18em] text-emerald-300 font-semibold">
                {t("dashboard.sessionBreakdown", "Session breakdown")}
              </span>
              <button
                type="button"
                title="Coach bonus sessions added to your package."
                aria-label="About bonus sessions"
                className="text-muted-foreground/50 hover:text-emerald-300/80 transition-colors cursor-help"
                data-testid={`button-bonus-info-${pkg.id}`}
              >
                <Info size={11} />
              </button>
            </div>
            {/* ✨ Coach Reward luxury badge */}
            <span className="inline-flex items-center gap-1 rounded border border-emerald-400/30 bg-emerald-500/[0.08] px-2 py-0.5 text-[9px] uppercase tracking-[0.18em] text-emerald-300 font-black shadow-[0_0_10px_-5px_rgba(16,185,129,0.5)]">
              ✨ Coach Reward
            </span>
          </div>
          {/* 3-column grid: Purchased | +Bonus | Total */}
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl border border-white/5 bg-white/[0.03] px-2 py-2">
              <p className="text-lg font-display font-bold tabular-nums leading-none text-foreground" data-testid={`text-paid-sessions-${pkg.id}`}>
                {paidSessions}
              </p>
              <p className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground mt-1.5">
                {t("dashboard.purchasedSessions", "Purchased")}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-2 py-2">
              <p className="text-lg font-display font-bold tabular-nums leading-none text-emerald-300" data-testid={`text-bonus-sessions-${pkg.id}`}>
                +{bonusSessions}
              </p>
              <p className="text-[9px] uppercase tracking-[0.15em] text-emerald-400/80 mt-1.5">
                {t("dashboard.bonusSessions", "Bonus")}
              </p>
            </div>
            <div className="rounded-xl border border-primary/25 bg-primary/[0.06] px-2 py-2">
              <p className="text-lg font-display font-bold tabular-nums leading-none text-primary" data-testid={`text-total-sessions-${pkg.id}`}>
                {pkg.totalSessions}
              </p>
              <p className="text-[9px] uppercase tracking-[0.15em] text-primary/80 mt-1.5">
                {t("dashboard.totalSessions", "Total")}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Outstanding balance */}
      {outstanding > 0 && payStatus !== "complimentary" && pkg.isActive && (
        <div
          className="mb-4 rounded-xl border border-cyan-400/25 bg-cyan-500/[0.07] px-3.5 py-2.5 flex items-center justify-between gap-3"
          data-testid={`package-balance-${pkg.id}`}
        >
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">
              {t("dashboard.packageBalanceLabel", "Outstanding balance")}
            </p>
            <p className="text-sm font-display font-semibold text-cyan-100 tabular-nums mt-1">
              AED {outstanding.toLocaleString()}
              {totalPrice > 0 && (
                <span className="text-[11px] font-normal text-cyan-200/60 ml-1.5">
                  of AED {totalPrice.toLocaleString()}
                </span>
              )}
            </p>
          </div>
          <Wallet size={16} className="text-cyan-300 shrink-0" />
        </div>
      )}

      {/* Progress bar — Tron cyan with glow + "X / Y Sessions Remaining" label */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] tabular-nums">
          <span className="text-foreground/80 font-medium" data-testid={`text-package-progress-${pkg.id}`}>
            {remaining} / {pkg.totalSessions} {t("dashboard.sessionsRemainingLabel", "Sessions Remaining")}
          </span>
          <span className="text-muted-foreground">{pct}% {t("dashboard.packageUsed", "used")}</span>
        </div>
        <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700"
            style={{
              width: `${pct}%`,
              boxShadow: pkg.isActive ? "0 0 8px hsl(183 100% 60% / 0.5)" : undefined,
            }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground tabular-nums">
          {completed} {t("dashboard.sessionsUsedLabel", "used")} · {pkg.totalSessions} {t("dashboard.sessionsTotalLabel", "total")}
        </p>
      </div>

      {/* Expiry chip — prominent placement directly after progress bar */}
      {validUntilDate && (
        <div
          className={`mt-3 inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
            status === "expiring_soon" || (daysUntilExpiry !== null && daysUntilExpiry >= 0 && daysUntilExpiry <= 14)
              ? "border-cyan-500/30 bg-cyan-500/10 text-cyan-200"
              : "border-white/10 bg-white/[0.04] text-muted-foreground"
          }`}
          data-testid={`text-package-valid-until-${pkg.id}`}
        >
          <CalendarClock size={12} className="shrink-0" />
          <span>
            <span className="font-medium">{t("dashboard.packageExpiresLabel", "Expires")}: </span>
            {validUntilDate}
            {daysUntilExpiry !== null && daysUntilExpiry >= 0 && status !== "completed" && (
              <span className={`ml-1.5 ${daysUntilExpiry <= 14 ? "text-cyan-300 font-semibold" : "text-muted-foreground"}`}>
                · {daysUntilExpiry}d {t("dashboard.daysLeft", "left")}
              </span>
            )}
            {daysUntilExpiry !== null && daysUntilExpiry < 0 && (
              <span className="ml-1.5 text-red-300 font-semibold">· {t("dashboard.packageExpired", "Expired")}</span>
            )}
          </span>
        </div>
      )}

      {/* ETA pace line */}
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground" data-testid={`text-package-eta-${pkg.id}`}>
        <Gauge size={13} className="shrink-0 text-primary/70" />
        <span>{etaText}</span>
      </div>

      {/* Action row */}
      {(showRenewalCta || showExtensionCta) && (
        <div className="flex flex-col sm:flex-row gap-2 mt-4">
          {showRenewalCta && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg h-9 text-xs flex-1"
              onClick={onRequestRenewal}
              data-testid={`button-renew-${pkg.id}`}
            >
              <RefreshCw size={12} className="mr-1.5" />
              {t("dashboard.requestRenewal", "Request Renewal")}
            </Button>
          )}
          {showExtensionCta && (
            <Button
              size="sm"
              variant="outline"
              className="rounded-lg h-9 text-xs flex-1"
              onClick={onRequestExtension}
              data-testid={`button-extend-${pkg.id}`}
            >
              <CalendarPlus size={12} className="mr-1.5" />
              {t("dashboard.requestExtension", "Request Extension")}
            </Button>
          )}
        </div>
      )}
    </motion.div>
  );
}
