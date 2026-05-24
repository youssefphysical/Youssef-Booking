import { useMemo } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Sparkles,
  Calendar,
  RefreshCw,
  Trophy,
  Salad,
  ShieldAlert,
  MapPin,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { usePackages } from "@/hooks/use-packages";
import { useBookings } from "@/hooks/use-bookings";
import { useTranslation } from "@/i18n";
import {
  pickRecommendation,
  type Recommendation,
  type RecommendationKind,
} from "@/lib/recommendations";

const ICONS: Record<RecommendationKind, JSX.Element> = {
  verification_pending: <ShieldAlert size={18} />,
  renewal_low_sessions: <RefreshCw size={18} />,
  renewal_expired: <RefreshCw size={18} />,
  book_next: <Calendar size={18} />,
  inactive_book_next: <Calendar size={18} />,
  book_first: <Calendar size={18} />,
  consistency_milestone: <Trophy size={18} />,
  complete_profile: <MapPin size={18} />,
};

function formatTemplate(s: string, values?: Record<string, string | number>) {
  if (!values) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => String(values[k] ?? `{${k}}`));
}

/**
 * "What's Next" tile (Task #32, brief §33 + §36 — "What next?").
 * Pulls live state from existing client hooks, runs the pure-function
 * recommendation engine, and renders the single highest-priority nudge.
 * Renders nothing when no rule fires (keeps the dashboard quiet).
 */
export function WhatsNext() {
  const { user } = useAuth();
  const { t } = useTranslation();

  const { data: packages = [] } = usePackages({ userId: user?.id });
  const { data: bookings = [] } = useBookings({ userId: user?.id });


  const { data: trainingLocations = [] } = useQuery<any[]>({
    queryKey: ["/api/training-locations"],
    enabled: !!user && user.role === "client",
    staleTime: 60_000,
  });

  // Pending verification = package row in pending_verification status.
  const hasPendingVerification = useMemo(
    () =>
      (packages as any[]).some(
        (p) => p.status === "pending_verification" || p.status === "pending",
      ),
    [packages],
  );

  const activePackage = useMemo(() => {
    const list = packages as any[];
    const active = list.find(
      (p) => p.isActive && (p.usedSessions ?? 0) < (p.totalSessions ?? 0),
    );
    if (active) return active;
    // Surface the most recent (possibly expired) so renewal rules can fire.
    return list[0] ?? null;
  }, [packages]);

  const lastSessionAt = useMemo(() => {
    const list = bookings as any[];
    const completed = list
      .filter((b) => b.status === "completed")
      .map((b) => `${b.date}T${b.timeSlot || "00:00"}:00`)
      .sort();
    return completed.length ? completed[completed.length - 1] : null;
  }, [bookings]);

  const consistencyStreak = useMemo(() => {
    // Lightweight: count completed sessions in the last 28 days.
    const cutoff = Date.now() - 28 * 24 * 60 * 60 * 1000;
    return (bookings as any[]).filter((b) => {
      if (b.status !== "completed") return false;
      const t = new Date(`${b.date}T00:00:00`).getTime();
      return Number.isFinite(t) && t >= cutoff;
    }).length;
  }, [bookings]);

  const rec = useMemo<Recommendation | null>(
    () =>
      pickRecommendation({
        activePackage: activePackage
          ? {
              isActive: !!activePackage.isActive,
              status: activePackage.status,
              usedSessions: activePackage.usedSessions ?? 0,
              totalSessions: activePackage.totalSessions ?? 0,
              expiresAt: activePackage.expiresAt ?? null,
            }
          : null,
        hasPendingVerification,
        goal: (user as any)?.goal ?? null,
        lastSessionAt,
        consistencyStreak,
        hasAnyBooking: (bookings as any[]).length > 0,
        hasTrainingLocation: (trainingLocations as any[]).length > 0,
      }),
    [
      activePackage,
      hasPendingVerification,
      user,
      lastSessionAt,
      consistencyStreak,
      bookings,
      trainingLocations,
    ],
  );

  if (!rec) return null;

  const title = formatTemplate(t(rec.titleKey), rec.values);
  const body = formatTemplate(t(rec.bodyKey), rec.values);
  const ctaLabel = formatTemplate(t(rec.ctaKey), rec.values);
  const icon = ICONS[rec.kind] ?? <Sparkles size={18} />;

  return (
    <Link
      href={rec.href}
      className="block mb-4 rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.07] via-primary/[0.02] to-transparent p-4 sm:p-5 hover:border-primary/50 transition-colors"
      data-testid={`whatsnext-${rec.kind}`}
    >
      <div className="flex items-start gap-3 sm:gap-4">
        <div className="size-10 sm:size-11 shrink-0 rounded-xl bg-primary/12 text-primary grid place-items-center">
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] uppercase tracking-[0.18em] text-primary/80 font-semibold mb-1">
            {t("whatsnext.eyebrow", "What's Next")}
          </p>
          <h3 className="font-display font-bold text-base sm:text-lg leading-snug text-foreground">
            {title}
          </h3>
          {body && (
            <p className="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">
              {body}
            </p>
          )}
          <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">
            {ctaLabel}
            <ArrowRight size={13} className="lucide-arrow-right" />
          </span>
        </div>
      </div>
    </Link>
  );
}

export default WhatsNext;
