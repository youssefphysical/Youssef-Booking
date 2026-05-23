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
} from "lucide-react";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/i18n";
import { PACKAGE_DEFINITIONS } from "@shared/schema";
import type { Package, Booking, BookingWithUser } from "@shared/schema";

type AnyBooking = Booking | BookingWithUser;
export type PackageStatus = "active" | "expiring_soon" | "expired" | "completed";

// ---------------------------------------------------------------------
// Pure helpers (exported for testability / reuse).
// ---------------------------------------------------------------------

/**
 * Sessions-per-week pace, averaged over the last 4 weeks of completed
 * bookings. Pure: takes the booking list + an optional `now` anchor.
 * `now` parameter exists so tests / consumers can pin the window.
 */
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

/**
 * Human ETA copy from pace + remaining sessions. Caller passes the i18n
 * strings so this helper stays presentation-pure. `{weeks}` is the only
 * placeholder substituted.
 */
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

// ---------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------

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

  // Pace + ETA — pure derivations.
  const pace = computeSessionsPerWeek(bookings);
  const etaText = formatEta(remaining, pace, {
    weeks: t("dashboard.packageEtaWeeks", "Estimated completion: ~{weeks} weeks remaining"),
    finalWeek: t("dashboard.packageEtaFinalWeek", "Estimated completion: final week"),
    fallback: t("dashboard.packageEtaFallback", "Pace your sessions to finish strong."),
  });

  // Valid-until — gracefully hidden when null (legacy packages).
  const expiry = pkg.expiryDate ? new Date(pkg.expiryDate as any) : null;
  const validUntilDate = expiry && Number.isFinite(expiry.getTime())
    ? format(expiry, "d MMM yyyy")
    : null;

  // Payment + lifecycle surfacing (preserved from prior card).
  const totalPrice = ((pkg as any).totalPrice ?? 0) as number;
  const amountPaid = ((pkg as any).amountPaid ?? 0) as number;
  const outstanding = Math.max(0, totalPrice - amountPaid);
  const payStatus = (((pkg as any).paymentStatus ?? "unpaid") as string);
  const isFrozen = !!(pkg as any).frozen;

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

  // Renewal CTA trigger: low sessions OR low days OR lifecycle state.
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

      {/* Header — name + status / payment badges */}
      <div className="relative flex items-start justify-between gap-4 mb-5">
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] text-primary mb-1 truncate" data-testid={`text-package-name-${pkg.id}`}>
            {(pkg as any).name || def?.label || `${pkg.type} Package`}
          </p>
          {def?.tagline && (
            <p className="text-[11px] text-muted-foreground/70 mt-0.5">{def.tagline}</p>
          )}
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

      {/* Big dual-number row: Completed | Remaining.
          Replaces the old "12 / 25" stack — gives the client a clear
          read on both sides of the package without duplicating counts. */}
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

      {/* Bonus chip — kept from prior surface, lives inline below numbers */}
      {((pkg as any).bonusSessions ?? 0) > 0 && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/12 border border-emerald-400/30 px-2 py-0.5 text-emerald-300 shadow-[0_0_14px_-6px_rgba(16,185,129,0.5)]">
            <Sparkles size={11} className="shrink-0" />
            <span className="text-[11px] font-display font-bold tabular-nums leading-none">
              +{(pkg as any).bonusSessions} {t("home.packages.bonus", "bonus")}
            </span>
          </span>
        </div>
      )}

      {/* Outstanding balance — same treatment as before, informational only */}
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

      {/* Progress bar — Tron cyan fill, soft glow on active packages */}
      <div className="relative h-2 bg-white/5 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary transition-all"
          style={{
            width: `${pct}%`,
            boxShadow: pkg.isActive
              ? "0 0 6px hsl(183 100% 60% / 0.35)"
              : undefined,
          }}
        />
      </div>
      <p className="text-[11px] text-muted-foreground mt-2 tabular-nums" data-testid={`text-package-progress-${pkg.id}`}>
        {t("dashboard.packagePctComplete", "{pct}% complete · {total} total sessions")
          .replace("{pct}", String(pct))
          .replace("{total}", String(pkg.totalSessions))}
      </p>

      {/* Confidence lines — valid-until + ETA. The valid-until line is
          always present when expiryDate exists; never shows "Invalid Date". */}
      <div className="mt-4 space-y-2">
        {validUntilDate && (
          <div className="flex items-center gap-2 text-xs text-foreground/85" data-testid={`text-package-valid-until-${pkg.id}`}>
            <CalendarClock size={13} className="shrink-0 text-primary/80" />
            <span>
              {t("dashboard.packageValidUntil", "Package valid until {date}").replace("{date}", validUntilDate)}
              {daysUntilExpiry !== null && daysUntilExpiry >= 0 && status !== "completed" && (
                <span className={`ml-1.5 ${status === "expiring_soon" ? "text-cyan-300 font-semibold" : "text-muted-foreground"}`}>
                  · {t("dashboard.packageExpiresIn", "{days} days left").replace("{days}", String(daysUntilExpiry))}
                </span>
              )}
              {daysUntilExpiry !== null && daysUntilExpiry < 0 && (
                <span className="ml-1.5 text-red-300 font-semibold">
                  · {t("dashboard.packageExpired", "Expired")}
                </span>
              )}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-testid={`text-package-eta-${pkg.id}`}>
          <Gauge size={13} className="shrink-0 text-primary/70" />
          <span>{etaText}</span>
        </div>
      </div>

      {/* Action row — renewal / extension. Renewal fires on ≤3 sessions,
          ≤7 days, expired, expiring soon, or completed. */}
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
