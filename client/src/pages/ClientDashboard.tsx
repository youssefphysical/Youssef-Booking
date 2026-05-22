import { useEffect, useMemo, useRef, useState } from "react";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Link, useLocation } from "wouter";
import {
  Calendar,
  Lock,
  X,
  AlertCircle,
  Package as PackageIcon,
  Activity,
  Image as ImageIcon,
  Upload,
  TrendingUp,
  Users,
  Loader2,
  Shield,
  Clock,
  FileDown,
  Crown,
  Star,
  Sparkles,
  Dumbbell,
  Info,
  RefreshCw,
  CalendarPlus,
  Wallet,
  BadgeCheck,
  Gift,
  ArrowRight,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  useBookings,
  useCancelBooking,
  useSameDayAdjust,
} from "@/hooks/use-bookings";
import { useSettings } from "@/hooks/use-settings";
import { usePackages } from "@/hooks/use-packages";
import { useBlockedSlots } from "@/hooks/use-blocked-slots";
import { useInbodyRecords, useUploadInbody } from "@/hooks/use-inbody";
import BodyMetricsPanel from "@/components/BodyMetricsPanel";
import WeeklyCheckinsPanel from "@/components/WeeklyCheckinsPanel";
import BeforeAfterCompare from "@/components/BeforeAfterCompare";
import { ClipboardCheck } from "lucide-react";
import { useProgressPhotos, useUploadProgressPhoto } from "@/hooks/use-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityFeed } from "@/components/ActivityFeed";
import { TodayHero } from "@/components/TodayHero";
import { PackageConfidenceCard } from "@/components/dashboard/PackageConfidenceCard";
import { GoalProgressRing } from "@/components/dashboard/GoalProgressRing";
import { RecoveryReadinessCard } from "@/components/dashboard/RecoveryReadinessCard";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { InbodyTrends } from "@/components/InbodyTrends";
import { exportInbodyReportPdf } from "@/lib/pdf-export";
import { whatsappUrl, DEFAULT_WHATSAPP_NUMBER, buildWhatsappMessage } from "@/lib/whatsapp";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useMutation, useQuery } from "@tanstack/react-query";
import { tierHasPriority, VIP_TIER_TAGLINES, evaluateBookingEligibility } from "@shared/schema";
import { ShieldAlert } from "lucide-react";
import {
  ALL_TIME_SLOTS,
  formatStatus,
  statusColor,
  hoursUntil,
  isCancellable,
  buildSessionDate,
} from "@/lib/booking-utils";
import { formatTime12 } from "@/lib/time-format";
import {
  PACKAGE_DEFINITIONS,
  PACKAGE_TYPES,
  VIP_TIER_LABELS,
  VIP_TIER_DESCRIPTIONS,
  WORKOUT_CATEGORY_LABELS,
  protectedCancellationQuota,
  sameDayAdjustQuota,
  normaliseTier,
  WEEKLY_FREQUENCY_OPTIONS,
  type Booking,
  type Package,
  type InbodyRecord,
  type ProgressPhoto,
} from "@shared/schema";
import { UserAvatar } from "@/components/UserAvatar";
import { useTranslation } from "@/i18n";
import { SupplementsTab } from "@/components/dashboard/SupplementsTab";
import { ProfileHero } from "@/components/dashboard/ProfileHero";
import { QuickActionsGrid } from "@/components/dashboard/QuickActionsGrid";
import { PackageStatusHero } from "@/components/dashboard/PackageStatusHero";
import { CoachInsightCard } from "@/components/dashboard/CoachInsightCard";
import { ConsistencyStreak } from "@/components/dashboard/ConsistencyStreak";
import { ProgressSnapshot } from "@/components/dashboard/ProgressSnapshot";
import { SessionTimeline } from "@/components/dashboard/SessionTimeline";
import { TransformationTimeline } from "@/components/dashboard/TransformationTimeline";
import { SessionPrepCard } from "@/components/dashboard/SessionPrepCard";
import { WhatsNext } from "@/components/dashboard/WhatsNext";
import { ChevronDown, ChevronUp } from "lucide-react";
import { PremiumEmptyState } from "@/components/dashboard/PremiumEmptyState";
import { Pill, LineChart as LineChartIcon, HeartPulse } from "lucide-react";
import { AgreementDisclaimer } from "@/components/AgreementDisclaimer";
import { useFeatureFlag } from "@/lib/featureFlags";

function RecoveryDashboardTile() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const enabled = useFeatureFlag("recovery_enabled", true);
  // Status-aware: query the client's own recovery requests so the tile
  // can surface the most relevant pending/scheduled status instead of a
  // generic "explore recovery" CTA. 404 / unauthenticated falls back to
  // the empty array, keeping the legacy CTA behavior.
  const { data: requests = [] } = useQuery<any[]>({
    queryKey: ["/api/recovery-requests"],
    enabled: enabled && !!user && user.role === "client",
    staleTime: 60_000,
  });
  if (!enabled) return null;

  // Surface the highest-priority active request. "scheduled" beats
  // "pending", anything older/declined falls back to the empty CTA.
  const active = (requests as any[])
    .filter((r) => r?.status === "scheduled" || r?.status === "pending")
    .sort((a, b) =>
      a.status === b.status ? 0 : a.status === "scheduled" ? -1 : 1,
    )[0];

  const statusLabel = active
    ? active.status === "scheduled"
      ? t("recovery.statusScheduled", "Session scheduled")
      : t("recovery.statusPending", "Awaiting confirmation")
    : null;

  return (
    <Link
      href="/recovery"
      className="block mb-4 rounded-2xl border border-cyan-500/15 bg-gradient-to-br from-cyan-500/[0.05] to-transparent p-4 hover:border-cyan-400/40 transition-colors"
      data-testid="tile-recovery"
    >
      <div className="flex items-center gap-3">
        <div className="size-10 shrink-0 rounded-xl bg-cyan-500/10 grid place-items-center text-cyan-300">
          <HeartPulse size={18} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] uppercase tracking-[0.18em] text-cyan-300/80 font-semibold">
            {t("recovery.eyebrow", "Recovery & Mobility")}
          </p>
          <p className="text-sm text-foreground/80 truncate" data-testid="text-recovery-status">
            {statusLabel ?? t("recovery.title", "Move better. Recover faster.")}
          </p>
        </div>
        {active && (
          <span
            className="shrink-0 rounded-full bg-cyan-500/15 text-cyan-200 text-[10px] uppercase tracking-wider px-2 py-0.5 border border-cyan-400/30"
            data-testid="badge-recovery-status"
          >
            {active.status}
          </span>
        )}
      </div>
    </Link>
  );
}

function currentMonthKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function todayDateString() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function ClientDashboard() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const [, dashNavigate] = useLocation();
  // Task #28: first-time wizard gate. Brand-new clients (no saved
  // training location AND no active package) are bounced to /wizard
  // so they capture where they train before the dashboard renders.
  // Legacy users with active packages bypass this entirely.
  const { data: dashTrainingLocations = [], isLoading: dashLocLoading } = useQuery<any[]>({
    queryKey: ["/api/training-locations"],
    enabled: !!user && user.role === "client",
  });
  const { data: dashPackages = [] } = usePackages({ userId: user?.id });
  const dashHasActive = (dashPackages as any[]).some(
    (p) => p.isActive && p.usedSessions < p.totalSessions,
  );
  const dashNeedsWizard =
    !!user &&
    user.role === "client" &&
    !dashLocLoading &&
    dashTrainingLocations.length === 0 &&
    !dashHasActive;
  useEffect(() => {
    if (dashNeedsWizard) dashNavigate("/wizard");
  }, [dashNeedsWizard, dashNavigate]);

  // Phase 1 luxury redesign (May 2026): controlled tabs so the new
  // QuickActionsGrid + PackageStatusHero can deep-link into the right
  // section without forcing a new route. Initial value mirrors the
  // previous defaultValue. URL hash sync so external deep links
  // (e.g. /dashboard#progress from a notification email) still work.
  const [tab, setTab] = useState<string>(() => {
    if (typeof window === "undefined") return "bookings";
    const h = window.location.hash.replace(/^#/, "");
    return h && ["bookings","packages","supplements","body","checkins","inbody","progress","activity"].includes(h)
      ? h
      : "bookings";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (h && ["bookings","packages","supplements","body","checkins","inbody","progress","activity"].includes(h)) {
        setTab(h);
      }
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);
  const jumpToTab = (next: string) => {
    setTab(next);
    // Smooth-scroll to the tab list so the user's eye lands on the new content.
    if (typeof window !== "undefined") {
      requestAnimationFrame(() => {
        document
          .getElementById("dashboard-tabs")
          ?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    }
  };

  if (!user) return null;

  return (
    <div className="dashboard-shell min-h-screen">
      <div className="max-w-5xl mx-auto px-5 pt-24 pb-20">
      {/* Task #56 — information hierarchy pass.
          Roadmap order: Welcome → Status → Next action → Upcoming →
          Progress → Insights/Achievements (collapsed on mobile).
          PackageStatusHero is promoted directly under the welcome hero
          so the client's most-asked question ("how many sessions do I
          have?") is the first thing they see. The SessionPrepCard
          renders only when a session is within 24h and is dismissible
          per booking, so it never adds noise on quieter days. */}
      <ProfileHero user={user} />
      <PackageStatusHero userId={user.id} onRenew={() => jumpToTab("packages")} />
      <WhatsNext />
      <RecoveryDashboardTile />
      <QuickActionsGrid onJump={jumpToTab} />

      <TodayHero name={user.fullName} />
      <SessionPrepCard userId={user.id} />
      <SessionTimeline userId={user.id} onJump={jumpToTab} />

      <ProgressSnapshot userId={user.id} />
      <TransformationTimeline userId={user.id} />

      {/* Task #73 — Progress rings + recovery readiness */}
      <div className="grid gap-4 lg:grid-cols-2 mt-4">
        <GoalProgressRing user={user} />
        <RecoveryReadinessCard />
      </div>

      {/* Secondary insight stack — informative but not action-required.
          Collapsed by default on mobile to keep the dashboard scannable;
          always expanded on lg+ where vertical real estate isn't tight. */}
      <SecondaryInsights firstName={user.fullName.split(" ")[0]} userId={user.id} />

      <MembershipBlock user={user} />
      <DuoPartnersBlock />
      <BookingEligibilityBanner userId={user.id} user={user} />

      <Tabs id="dashboard-tabs" value={tab} onValueChange={setTab} className="w-full scroll-mt-24">
        <TabsList className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 w-full max-w-6xl bg-white/5 mb-6 h-auto lg:h-11 gap-1 p-1">
          {/* Brief §36 section labels — tabs map 1:1 to the required
              section model (My Training, My Package, Nutrition (=
              Supplements + plan summary surfaced via WhatsNext), Body,
              Check-ins, InBody, Progress, History). */}
          <TabsTrigger value="bookings" data-testid="tab-bookings">
            <Calendar size={14} className="mr-1.5" /> {t("dashboard.section.myTraining", "My Training")}
          </TabsTrigger>
          <TabsTrigger value="packages" data-testid="tab-packages">
            <PackageIcon size={14} className="mr-1.5" /> {t("dashboard.section.myPackage", "My Package")}
          </TabsTrigger>
          <TabsTrigger value="supplements" data-testid="tab-supplements">
            <Pill size={14} className="mr-1.5" /> {t("dashboard.section.nutrition", "Nutrition")}
          </TabsTrigger>
          <TabsTrigger value="body" data-testid="tab-body">
            <LineChartIcon size={14} className="mr-1.5" /> {t("dashboard.section.body", "Body")}
          </TabsTrigger>
          <TabsTrigger value="checkins" data-testid="tab-checkins">
            <ClipboardCheck size={14} className="mr-1.5" /> {t("dashboard.section.checkins", "Check-ins")}
          </TabsTrigger>
          <TabsTrigger value="inbody" data-testid="tab-inbody">
            <Activity size={14} className="mr-1.5" /> {t("dashboard.section.inbody", "InBody")}
          </TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress">
            <ImageIcon size={14} className="mr-1.5" /> {t("dashboard.section.progress", "Progress")}
          </TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">
            <Activity size={14} className="mr-1.5" /> {t("dashboard.section.history", "History")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings"><BookingsTab userId={user.id} /></TabsContent>
        <TabsContent value="packages"><PackagesTab userId={user.id} /></TabsContent>
        <TabsContent value="supplements"><SupplementsTab /></TabsContent>
        <TabsContent value="body"><BodyMetricsPanel userId={user.id} canEdit={false} /></TabsContent>
        <TabsContent value="checkins"><WeeklyCheckinsPanel /></TabsContent>
        <TabsContent value="inbody"><InbodyTab userId={user.id} /></TabsContent>
        <TabsContent value="progress"><ProgressTab userId={user.id} /></TabsContent>
        <TabsContent value="activity">
          <ActivityFeed endpoint="/api/me/activity" title={t("dashboard.tabActivity", "Activity")} />
        </TabsContent>
      </Tabs>
      </div>
    </div>
  );
}

// =============== SECONDARY INSIGHTS (Task #56) ===============
// Collapsible stack of "nice to have" widgets (coach insight + streak)
// — informative but not action-required. Mobile collapses by default to
// keep the dashboard scannable; lg+ always renders expanded since the
// vertical real estate isn't tight there.
function SecondaryInsights({
  firstName,
  userId,
}: {
  firstName: string;
  userId: number;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  const content = (
    <div className="space-y-4">
      <CoachInsightCard firstName={firstName} />
      <ConsistencyStreak userId={userId} />
    </div>
  );

  return (
    <>
      {/* Mobile: collapsible "Show more" panel. */}
      <div className="lg:hidden mb-6">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-card/40 px-4 py-3 text-sm font-semibold text-foreground/85 hover:border-white/20 transition-colors"
          aria-expanded={open}
          data-testid="button-secondary-insights-toggle"
        >
          <span className="flex items-center gap-2">
            <Sparkles size={14} className="text-cyan-300" />
            {open
              ? t("dashboard.showLess", "Hide insights & streak")
              : t("dashboard.showMore", "Show insights & streak")}
          </span>
          {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {open && <div className="mt-3">{content}</div>}
      </div>
      {/* Desktop: always visible. */}
      <div className="hidden lg:block mb-6">{content}</div>
    </>
  );
}

// =============== VIP BADGE ===============

// VipBadge moved into ProfileHero (May 2026 redesign).

// =============== MEMBERSHIP BLOCK ===============

function MembershipBlock({ user }: { user: { vipTier: string | null; weeklyFrequency: number | null; protectedCancelMonth: string | null; protectedCancelCount: number | null; sameDayAdjustMonth: string | null; sameDayAdjustCount: number | null } }) {
  const { t } = useTranslation();
  const tier = normaliseTier(user.vipTier);
  const monthKey = currentMonthKey();
  const protUsed =
    user.protectedCancelMonth === monthKey ? user.protectedCancelCount ?? 0 : 0;
  const protQuota = protectedCancellationQuota(tier);
  const protRemaining = Math.max(0, protQuota - protUsed);

  const adjUsed =
    user.sameDayAdjustMonth === monthKey ? user.sameDayAdjustCount ?? 0 : 0;
  const adjQuota = sameDayAdjustQuota(tier);
  const adjRemaining = Math.max(0, adjQuota - adjUsed);

  const freqOption = WEEKLY_FREQUENCY_OPTIONS.find(
    (o) => o.value === user.weeklyFrequency,
  );

  return (
    <div
      className="rounded-3xl border border-white/10 bg-card/40 p-5 mb-6"
      data-testid="block-membership"
    >
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-1.5 inline-flex items-center gap-1.5">
            <Info size={12} /> {t("dashboard.membershipLevel")}
          </p>
          <p className="text-sm flex items-center gap-2 flex-wrap">
            <span className="font-semibold" data-testid="text-membership-tier">
              {VIP_TIER_LABELS[tier]}
            </span>
            {tierHasPriority(tier) && (
              <span
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border border-cyan-400/30 bg-cyan-500/10 text-cyan-200"
                data-testid="badge-priority"
              >
                <Crown size={10} /> {t("dashboard.priorityChip")}
              </span>
            )}
            <span className="text-muted-foreground">
              · {freqOption?.label.split(" — ")[0] ?? t("dashboard.weeklyFreqNotSet")}
            </span>
          </p>
          <p className="text-xs text-primary/80 mt-1.5 italic" data-testid="text-membership-tagline">
            {VIP_TIER_TAGLINES[tier] ?? ""}
          </p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xl">
            {VIP_TIER_DESCRIPTIONS[tier]}
          </p>
        </div>
        <Link href="/how-it-works" className="text-xs text-primary hover:opacity-80 self-start">
          {t("dashboard.viewAllLevels")}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <div
          className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3"
          data-testid="block-protected-remaining"
        >
          <p className="text-[10px] uppercase tracking-wider text-cyan-200/80 inline-flex items-center gap-1.5">
            <Shield size={11} /> {t("dashboard.protectedCancellations")}
          </p>
          <p className="text-lg font-display font-bold mt-1">
            {protQuota === 0 ? (
              <span className="text-muted-foreground text-base">{t("dashboard.notOnLevel")}</span>
            ) : (
              <span>
                {protRemaining}{" "}
                <span className="text-sm text-muted-foreground font-normal">{t("dashboard.leftThisMonth").replace("{quota}", String(protQuota))}</span>
              </span>
            )}
          </p>
        </div>
        <div
          className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3"
          data-testid="block-sameday-remaining"
        >
          <p className="text-[10px] uppercase tracking-wider text-blue-200/80 inline-flex items-center gap-1.5">
            <Clock size={11} /> {t("dashboard.sameDayAdjustments")}
          </p>
          <p className="text-lg font-display font-bold mt-1">
            {adjQuota === 0 ? (
              <span className="text-muted-foreground text-base">{t("dashboard.notOnLevel")}</span>
            ) : (
              <span>
                {adjRemaining}{" "}
                <span className="text-sm text-muted-foreground font-normal">{t("dashboard.leftThisMonth").replace("{quota}", String(adjQuota))}</span>
              </span>
            )}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        {t("dashboard.needChangeFreq")}{" "}
        <a
          href={whatsappUrl(DEFAULT_WHATSAPP_NUMBER, t("dashboard.waChangeFreq"))}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:opacity-80"
        >
          {t("dashboard.messageWaLink")}
        </a>
        .
      </p>
    </div>
  );
}

// =============== DUO PARTNERS BLOCK ===============

// Task #9: surface the client's linked Duo partner(s) on their own
// dashboard so the couple-view is consistent with the admin client
// detail page. Privacy: only fullName + avatar leak across accounts —
// matches the bookings-list privacy shape on the server.
type LinkedPartner = {
  id: number;
  fullName: string | null;
  profilePictureUrl: string | null;
};

function DuoPartnersBlock() {
  const { t } = useTranslation();
  const { data: partners, isLoading } = useQuery<LinkedPartner[]>({
    queryKey: ["/api/me/linked-partners"],
  });

  if (isLoading || !partners || partners.length === 0) return null;

  return (
    <div
      className="rounded-3xl border border-white/10 bg-card/40 p-5 mb-6"
      data-testid="block-duo-partners"
    >
      <p className="text-xs uppercase tracking-[0.2em] text-muted-foreground mb-3 inline-flex items-center gap-1.5">
        <Users size={12} />{" "}
        {partners.length === 1
          ? t("dashboard.duoPartner", "Duo partner")
          : t("dashboard.duoPartners", "Duo partners")}
      </p>
      <ul className="flex flex-wrap gap-3">
        {partners.map((p) => (
          <li
            key={p.id}
            className="inline-flex items-center gap-2.5 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-3 py-2"
            data-testid={`row-duo-partner-${p.id}`}
          >
            <UserAvatar
              src={p.profilePictureUrl}
              name={p.fullName ?? ""}
              size={32}
              testId={`avatar-duo-partner-${p.id}`}
            />
            <span
              className="text-sm font-medium"
              data-testid={`text-duo-partner-name-${p.id}`}
            >
              {p.fullName || t("dashboard.unnamedClient", "Client")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// =============== BOOKINGS TAB ===============

function BookingsTab({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data: bookings = [], isLoading } = useBookings({ userId });
  const { data: settings } = useSettings();
  const cutoff = settings?.cancellationCutoffHours ?? 6;

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const list = bookings as Booking[];
    const up = list
      .filter((b) => {
        const sd = buildSessionDate(b.date, b.timeSlot);
        return (
          ["upcoming", "confirmed"].includes(b.status) &&
          sd.getTime() >= now.getTime() - 60 * 60 * 1000
        );
      })
      .sort((a, b) =>
        `${a.date}T${a.timeSlot}`.localeCompare(`${b.date}T${b.timeSlot}`),
      );
    const ps = list
      .filter((b) => !up.includes(b))
      .sort((a, b) =>
        `${b.date}T${b.timeSlot}`.localeCompare(`${a.date}T${a.timeSlot}`),
      );
    return { upcoming: up, past: ps };
  }, [bookings]);

  return (
    <>
      <Section
        title={t("dashboard.sectionUpcoming")}
        count={upcoming.length}
        empty={
          <PremiumEmptyState
            icon={<Calendar size={20} />}
            title={t("dashboard.noUpcoming")}
            body={t("emptyState.noBookings.body")}
            ctaLabel={t("dashboard.bookSessionCta")}
            ctaHref="/book"
            testId="empty-upcoming-bookings"
          />
        }
      >
        {isLoading ? (
          <SkeletonCards />
        ) : (
          upcoming.map((b) => (
            <BookingCard
              key={b.id}
              booking={b}
              cutoff={cutoff}
              allBookings={bookings as Booking[]}
              // Task #6: both the booking owner AND the linked Duo
              // partner can cancel/reschedule. Server-side ownership
              // checks (cancel / same-day-adjust / PATCH) accept either.
              canCancel={
                b.userId === userId ||
                (b as any).linkedPartnerUserId === userId
              }
            />
          ))
        )}
      </Section>

      <Section
        title={t("dashboard.sectionPast")}
        count={past.length}
        empty={<PremiumEmptyState title={t("dashboard.noPast")} testId="empty-past-bookings" />}
      >
        {past.slice(0, 25).map((b) => (
          <BookingCard
            key={b.id}
            booking={b}
            cutoff={cutoff}
            allBookings={bookings as Booking[]}
          />
        ))}
      </Section>
    </>
  );
}

function BookingCard({
  booking,
  cutoff,
  allBookings,
  canCancel,
}: {
  booking: Booking;
  cutoff: number;
  allBookings: Booking[];
  canCancel?: boolean;
}) {
  const { t } = useTranslation();
  const cancelMutation = useCancelBooking();
  const adjustMutation = useSameDayAdjust();
  const { user } = useAuth();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [protectedOpen, setProtectedOpen] = useState(false);
  const [adjustOpen, setAdjustOpen] = useState(false);

  const cancellable = canCancel && isCancellable(booking.date, booking.timeSlot, cutoff);
  const hours = hoursUntil(booking.date, booking.timeSlot);
  const hoursDisplay = Math.round(hours);
  const monthKey = currentMonthKey();

  const usedThisMonth =
    user?.protectedCancelMonth === monthKey ? user?.protectedCancelCount ?? 0 : 0;
  const protectedQuota = protectedCancellationQuota(user?.vipTier);
  const protectedRemaining = Math.max(0, protectedQuota - usedThisMonth);
  const protectedAvailable = protectedRemaining > 0;

  const usedAdjustsThisMonth =
    user?.sameDayAdjustMonth === monthKey ? user?.sameDayAdjustCount ?? 0 : 0;
  const adjustQuota = sameDayAdjustQuota(user?.vipTier);
  const adjustRemaining = Math.max(0, adjustQuota - usedAdjustsThisMonth);

  const isToday = booking.date === todayDateString();
  // Same-Day Adjust is allowed >=60 min before original slot, not yet started
  const adjustAvailable =
    canCancel &&
    isToday &&
    hours >= 1 &&
    adjustRemaining > 0 &&
    ["upcoming", "confirmed"].includes(booking.status);

  const isStarted = hours <= 0;
  const sessionLabel =
    booking.sessionType === "trial"
      ? t("dashboard.sessionTrial")
      : booking.sessionType === "single"
      ? t("dashboard.sessionSingle")
      : booking.sessionType === "duo"
      ? t("dashboard.sessionDuo")
      : t("dashboard.sessionDefault");

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/5 bg-card/60 p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-5"
      data-testid={`booking-card-${booking.id}`}
    >
      <div className="flex items-center gap-4 sm:gap-5 flex-1 min-w-0">
        <div className="flex-shrink-0 w-16 h-16 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary">
          <span className="text-[10px] uppercase font-bold tracking-wider">
            {format(new Date(booking.date), "MMM")}
          </span>
          <span className="text-2xl font-display font-bold leading-none mt-0.5">
            {format(new Date(booking.date), "d")}
          </span>
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-semibold truncate">{format(new Date(booking.date), "EEEE")}</p>
          <p className="text-sm text-muted-foreground mt-0.5">
            {formatTime12(booking.timeSlot)} • {sessionLabel}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-2">
            <span
              className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border whitespace-nowrap ${statusColor(
                booking.status,
              )}`}
              data-testid={`status-${booking.id}`}
            >
              {formatStatus(booking.status)}
            </span>
            {booking.workoutCategory && (
              <span
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md border border-blue-500/30 bg-blue-500/10 text-blue-300"
                data-testid={`workout-chip-${booking.id}`}
              >
                <Dumbbell size={10} />
                {WORKOUT_CATEGORY_LABELS[booking.workoutCategory] || booking.workoutCategory}
              </span>
            )}
            {booking.protectedCancellation && (
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300">
                <Shield size={10} /> {t("dashboard.chipProtected")}
              </span>
            )}
            {booking.rescheduledFrom && (
              <span
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-300"
                title={`Originally ${booking.rescheduledFrom}`}
              >
                <Clock size={10} /> {t("dashboard.chipAdjusted")}
              </span>
            )}
            {/* Task #6: this account is the linked Duo partner, not the
                booking owner. Partners CAN now cancel/adjust (server
                accepts either userId or linkedPartnerUserId); this chip
                just signals which side of the duo this card represents. */}
            {user && (booking as any).linkedPartnerUserId === user.id &&
              booking.userId !== user.id && (
                <span
                  className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md border border-cyan-400/30 bg-cyan-400/10 text-cyan-300"
                  data-testid={`chip-as-partner-${booking.id}`}
                >
                  <Users size={10} /> {t("dashboard.chipAsPartner") || "As partner"}
                </span>
              )}
          </div>
        </div>
      </div>

      {(booking as any).clientVisibleCoachNotes && (
        <div className="basis-full mt-1 px-3 py-2 rounded-lg border border-blue-500/20 bg-blue-500/10">
          <div className="text-[10px] uppercase tracking-wider text-blue-300/80 font-semibold mb-1">
            Coach notes
          </div>
          <p className="text-xs text-foreground/90 whitespace-pre-wrap">
            {(booking as any).clientVisibleCoachNotes}
          </p>
        </div>
      )}

      {canCancel && (
        <div className="flex flex-col items-stretch sm:items-end gap-2">
          {cancellable ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
              onClick={() => setConfirmOpen(true)}
              data-testid={`button-cancel-${booking.id}`}
            >
              <X size={14} className="mr-1" /> {t("dashboard.cancel")}
            </Button>
          ) : (
            <>
              <div className="text-xs text-cyan-300/80 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/20 self-start sm:self-end">
                <Lock size={12} />
                {t("dashboard.locked")} ({isStarted ? t("dashboard.lockedStarted") : t("dashboard.lockedHoursLeft").replace("{h}", String(hoursDisplay))})
              </div>
              {!isStarted && protectedAvailable && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-cyan-300 hover:text-cyan-200 hover:bg-cyan-500/10 text-xs"
                  onClick={() => setProtectedOpen(true)}
                  data-testid={`button-protected-cancel-${booking.id}`}
                >
                  <Shield size={12} className="mr-1" />
                  {t("dashboard.useProtected").replace("{left}", String(protectedRemaining)).replace("{quota}", String(protectedQuota))}
                </Button>
              )}
            </>
          )}
          {adjustAvailable && (
            <Button
              variant="ghost"
              size="sm"
              className="text-blue-300 hover:text-blue-200 hover:bg-blue-500/10 text-xs"
              onClick={() => setAdjustOpen(true)}
              data-testid={`button-same-day-adjust-${booking.id}`}
            >
              <Clock size={12} className="mr-1" />
              {t("dashboard.sameDayAdjust").replace("{left}", String(adjustRemaining)).replace("{quota}", String(adjustQuota))}
            </Button>
          )}
        </div>
      )}

      {/* Free cancel confirm */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-white/10 sm:rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("dashboard.cancelTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("dashboard.cancelDesc")
                .replace("{date}", format(new Date(booking.date), "PPPP"))
                .replace("{time}", formatTime12(booking.timeSlot))
                .replace("{hours}", String(cutoff))}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-keep-booking">{t("dashboard.keepIt")}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-cancel"
              onClick={() =>
                cancelMutation.mutate(
                  { id: booking.id },
                  { onSuccess: () => setConfirmOpen(false) },
                )
              }
              className="bg-red-500 hover:bg-red-600"
            >
              {t("dashboard.yesCancel")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Protected Cancellation confirm */}
      <AlertDialog open={protectedOpen} onOpenChange={setProtectedOpen}>
        <AlertDialogContent className="bg-card border-white/10 sm:rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Shield className="text-cyan-300" size={18} />
              {t("dashboard.protectedTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                {t("dashboard.protectedAvailableLine")
                  .replace("{left}", String(protectedRemaining))
                  .replace("{quota}", String(protectedQuota))}
              </span>
              <span className="block">
                {t("dashboard.protectedExplain").replace("{hours}", String(cutoff))}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="px-1 pb-1">
            <AgreementDisclaimer type="emergency_cancel_policy" />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-protected">{t("dashboard.notNow")}</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-protected-cancel"
              onClick={() =>
                cancelMutation.mutate(
                  { id: booking.id, useProtectedCancel: true },
                  { onSuccess: () => setProtectedOpen(false) },
                )
              }
              className="bg-cyan-500 hover:bg-cyan-600 text-black"
            >
              {t("dashboard.confirmProtectedFull")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Same-Day Adjustment dialog */}
      <SameDayAdjustDialog
        open={adjustOpen}
        onOpenChange={setAdjustOpen}
        booking={booking}
        allBookings={allBookings}
        remaining={adjustRemaining}
        onSubmit={(newTimeSlot) =>
          adjustMutation.mutate(
            { id: booking.id, newTimeSlot },
            { onSuccess: () => setAdjustOpen(false) },
          )
        }
        submitting={adjustMutation.isPending}
      />
    </motion.div>
  );
}

function SameDayAdjustDialog({
  open,
  onOpenChange,
  booking,
  allBookings,
  remaining,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  booking: Booking;
  allBookings: Booking[];
  remaining: number;
  onSubmit: (newTimeSlot: string) => void;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const [slot, setSlot] = useState<string>("");
  const { data: blocked = [] } = useBlockedSlots();

  // Available slots: same day, later than now+30min, not the original slot,
  // not blocked, not taken (NOTE: clients only see their own bookings, so the
  // server may still reject a slot taken by someone else — that's why we show
  // a clear toast on failure).
  const slots = useMemo(() => {
    const now = Date.now();
    const wholeDayBlocked = blocked.some(
      (b) => b.date === booking.date && b.timeSlot === null,
    );
    if (wholeDayBlocked) return [] as string[];
    const blockedSlotSet = new Set(
      blocked.filter((b) => b.date === booking.date).map((b) => b.timeSlot),
    );
    const taken = new Set(
      allBookings
        .filter(
          (b) =>
            b.date === booking.date &&
            b.id !== booking.id &&
            !["cancelled", "free_cancelled", "late_cancelled", "emergency_cancelled"].includes(
              b.status,
            ),
        )
        .map((b) => b.timeSlot),
    );
    return ALL_TIME_SLOTS.filter((t) => {
      if (t === booking.timeSlot) return false;
      if (taken.has(t)) return false;
      if (blockedSlotSet.has(t)) return false;
      const d = buildSessionDate(booking.date, t);
      return d.getTime() - now >= 30 * 60 * 1000;
    });
  }, [allBookings, blocked, booking.date, booking.id, booking.timeSlot, open]);

  useEffect(() => {
    if (open) setSlot("");
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Clock className="text-blue-300" size={18} />
            {t("dashboard.adjustTitle")}
          </DialogTitle>
          <DialogDescription>
            {t("dashboard.adjustDescDialog")
              .replace("{time}", formatTime12(booking.timeSlot))
              .replace("{n}", String(remaining))}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">{t("dashboard.newTimeSlot")}</p>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("dashboard.noRemainingSlots")}
            </p>
          ) : (
            <Select value={slot} onValueChange={setSlot}>
              <SelectTrigger className="bg-white/5 border-white/10 h-11" data-testid="select-adjust-slot">
                <SelectValue placeholder={t("dashboard.pickNewTime")} />
              </SelectTrigger>
              <SelectContent>
                {slots.map((s) => (
                  <SelectItem key={s} value={s} data-testid={`option-adjust-${s}`}>
                    {formatTime12(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-adjust-cancel">
            {t("dashboard.cancel")}
          </Button>
          <Button
            disabled={!slot || submitting}
            onClick={() => slot && onSubmit(slot)}
            className="bg-blue-500 hover:bg-blue-600"
            data-testid="button-adjust-confirm"
          >
            {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {t("dashboard.moveSession")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============== PACKAGES TAB ===============

// Mirrors server/storage.ts:computePackageStatus — pure function so we can
// drive UI badges without an extra API field.
function computePackageStatus(p: Package): "active" | "expiring_soon" | "expired" | "completed" {
  if (p.usedSessions >= p.totalSessions) return "completed";
  if (p.expiryDate) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const exp = new Date(p.expiryDate as any);
    if (isFinite(exp.getTime())) {
      const diffDays = Math.floor((exp.getTime() - today.getTime()) / 86400000);
      if (diffDays < 0) return "expired";
      if (diffDays <= 7) return "expiring_soon";
    }
  }
  return "active";
}

function daysUntilExpiry(p: Package): number | null {
  if (!p.expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const exp = new Date(p.expiryDate as any);
  if (!isFinite(exp.getTime())) return null;
  return Math.floor((exp.getTime() - today.getTime()) / 86400000);
}

function PackagesTab({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data: packages = [], isLoading } = usePackages({ userId });
  const { data: bookingsData = [] } = useBookings({ userId });
  const list = packages as Package[];
  const bookings = bookingsData as Booking[];

  const [renewalOpen, setRenewalOpen] = useState(false);
  const [extensionPkg, setExtensionPkg] = useState<Package | null>(null);

  // Pick the most-relevant package to anchor the action buttons against.
  const activePkg =
    list.find((p) => p.isActive && p.usedSessions < p.totalSessions) ||
    list.find((p) => p.isActive) ||
    null;

  if (isLoading) return <SkeletonCards />;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          variant="outline"
          className="rounded-xl h-10"
          onClick={() => setRenewalOpen(true)}
          data-testid="button-request-renewal"
        >
          <RefreshCw size={14} className="mr-1.5" />
          {t("dashboard.requestRenewal", "Request Renewal")}
        </Button>
        {activePkg && (
          <Button
            variant="outline"
            className="rounded-xl h-10"
            onClick={() => setExtensionPkg(activePkg)}
            data-testid="button-request-extension"
          >
            <CalendarPlus size={14} className="mr-1.5" />
            {t("dashboard.requestExtension", "Request Extension")}
          </Button>
        )}
      </div>

      {list.length === 0 ? (
        <PremiumEmptyState
          icon={<PackageIcon size={20} />}
          title={t("dashboard.packagesNone")}
          body={t("emptyState.verificationPending.body")}
          testId="empty-packages"
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-4 sm:gap-5">
          {list.map((p) => (
            <PackageConfidenceCard
              key={p.id}
              pkg={p}
              bookings={bookings}
              status={computePackageStatus(p)}
              daysUntilExpiry={daysUntilExpiry(p)}
              onRequestRenewal={() => setRenewalOpen(true)}
              onRequestExtension={() => setExtensionPkg(p)}
            />
          ))}
        </div>
      )}

      {/* Inline rules card explaining the manual workflow. */}
      <div className="rounded-2xl border border-white/5 bg-card/60 p-4 text-xs text-muted-foreground leading-relaxed">
        <p className="text-foreground/85 font-semibold text-xs mb-1">
          {t("dashboard.requestRulesTitle", "How package requests work")}
        </p>
        <ul className="list-disc pl-4 space-y-0.5">
          <li>{t("dashboard.requestRule1", "Each session is one hour. Extra time must be agreed in advance and may add a fee.")}</li>
          <li>{t("dashboard.requestRule2", "Renewals and extensions are confirmed manually by Youssef Ahmed after payment.")}</li>
          <li>{t("dashboard.requestRule3", "All payments are final and non-refundable. Unused sessions expire on the package end date.")}</li>
        </ul>
      </div>

      <RenewalRequestDialog
        open={renewalOpen}
        onOpenChange={setRenewalOpen}
        userId={userId}
      />
      <ExtensionRequestDialog
        pkg={extensionPkg}
        onClose={() => setExtensionPkg(null)}
      />
    </div>
  );
}

// ----- Renewal request modal -----
function RenewalRequestDialog({
  open,
  onOpenChange,
  userId: _userId,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: number;
}) {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const { toast } = useToast();
  const [selectedType, setSelectedType] = useState<string>("10");
  const [note, setNote] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/renewal-requests", {
        requestedPackageType: selectedType,
        clientNote: note.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/renewal-requests"] });
      toast({
        title: t("dashboard.requestSubmittedTitle", "Request submitted"),
        description: t("dashboard.requestSubmittedDesc", "Youssef Ahmed will confirm your request shortly. Tap WhatsApp to follow up."),
      });
      onOpenChange(false);
      setNote("");
      // Open WhatsApp prefilled message after a brief delay so the toast is visible.
      const def = PACKAGE_DEFINITIONS[selectedType];
      const msg = buildWhatsappMessage("requestRenewal", {
        clientName: user?.fullName,
        requestedPackageLabel: def?.label || selectedType,
        lang,
      });
      const url = whatsappUrl(settings?.whatsappNumber || DEFAULT_WHATSAPP_NUMBER, msg);
      // See ExtensionRequestDialog: open synchronously so iOS Safari permits
      // the new tab; fall back to same-tab navigation if blocked.
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (!popup) window.location.href = url;
    },
    onError: (e: any) => {
      toast({
        title: t("common.error", "Something went wrong"),
        description: e?.message || t("dashboard.requestErrorDesc", "Please try again or contact us on WhatsApp."),
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-renewal">
        <DialogHeader>
          <DialogTitle>{t("dashboard.requestRenewalTitle", "Request a renewal")}</DialogTitle>
          <DialogDescription>
            {t("dashboard.requestRenewalDesc", "Pick a package and we'll let Youssef Ahmed know. He will confirm pricing and payment via WhatsApp.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {t("dashboard.choosePackage", "Choose a package")}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {PACKAGE_TYPES.filter((tp) => tp !== "single" && tp !== "trial").map((tp) => {
                const def = PACKAGE_DEFINITIONS[tp];
                const active = selectedType === tp;
                return (
                  <button
                    key={tp}
                    type="button"
                    onClick={() => setSelectedType(tp)}
                    data-testid={`renewal-package-${tp}`}
                    className={`text-left rounded-xl border p-3 transition-colors ${
                      active
                        ? "border-primary/60 bg-primary/10"
                        : "border-white/10 bg-white/5 hover:border-primary/30"
                    }`}
                  >
                    <p className="text-xs uppercase tracking-wider text-primary font-bold">
                      {def?.label || tp}
                    </p>
                    {def?.sessions && (
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {def.sessions} {t("dashboard.sessions", "sessions")}
                      </p>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {t("dashboard.requestNote", "Note (optional)")}
            </p>
            <Input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("dashboard.requestNotePlaceholder", "Anything Youssef should know")}
              data-testid="input-renewal-note"
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={() => onOpenChange(false)}
            data-testid="button-cancel-renewal"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            className="rounded-xl"
            disabled={mutation.isPending || !selectedType}
            onClick={() => mutation.mutate()}
            data-testid="button-submit-renewal"
          >
            {mutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
            {t("dashboard.submitAndWhatsapp", "Submit & open WhatsApp")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ----- Extension request modal -----
function ExtensionRequestDialog({
  pkg,
  onClose,
}: {
  pkg: Package | null;
  onClose: () => void;
}) {
  const { t, lang } = useTranslation();
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const { toast } = useToast();
  const [days, setDays] = useState(7);
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (pkg) {
      setDays(7);
      setReason("");
    }
  }, [pkg?.id]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!pkg) throw new Error("Missing package");
      return apiRequest("POST", "/api/extension-requests", {
        packageId: pkg.id,
        requestedDays: days,
        reason: reason.trim() || null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/extension-requests"] });
      toast({
        title: t("dashboard.requestSubmittedTitle", "Request submitted"),
        description: t("dashboard.requestSubmittedDesc", "Youssef Ahmed will confirm your request shortly. Tap WhatsApp to follow up."),
      });
      onClose();
      const def = pkg ? PACKAGE_DEFINITIONS[pkg.type] : undefined;
      const msg = buildWhatsappMessage("requestExtension", {
        clientName: user?.fullName,
        packageLabel: (pkg as any)?.name || def?.label || pkg?.type,
        requestedDays: days,
        reason,
        lang,
      });
      const url = whatsappUrl(settings?.whatsappNumber || DEFAULT_WHATSAPP_NUMBER, msg);
      // Open WhatsApp synchronously inside the success handler so iOS Safari
      // still treats it as part of the original user-gesture chain. Falling
      // back to navigating the current tab if the popup is blocked.
      const popup = window.open(url, "_blank", "noopener,noreferrer");
      if (!popup) window.location.href = url;
    },
    onError: (e: any) => {
      toast({
        title: t("common.error", "Something went wrong"),
        description: e?.message || t("dashboard.requestErrorDesc", "Please try again or contact us on WhatsApp."),
        variant: "destructive",
      });
    },
  });

  return (
    <Dialog open={!!pkg} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="sm:max-w-md" data-testid="dialog-extension">
        <DialogHeader>
          <DialogTitle>{t("dashboard.requestExtensionTitle", "Request an extension")}</DialogTitle>
          <DialogDescription>
            {t("dashboard.requestExtensionDesc", "Tell Youssef how many extra days you need. Approval is at his discretion.")}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {t("dashboard.daysToAdd", "Days to add")}
            </p>
            <div className="flex flex-wrap gap-2">
              {[3, 7, 14, 30].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDays(d)}
                  data-testid={`extension-days-${d}`}
                  className={`px-3 h-9 rounded-xl border text-xs font-semibold transition-colors ${
                    days === d
                      ? "border-primary/60 bg-primary/10 text-primary"
                      : "border-white/10 bg-white/5 text-muted-foreground hover:border-primary/30"
                  }`}
                >
                  +{d} {t("dashboard.daysShort", "days")}
                </button>
              ))}
              <Input
                type="number"
                min={1}
                max={60}
                value={days}
                onChange={(e) => setDays(Math.max(1, Math.min(60, Number(e.target.value) || 0)))}
                className="h-9 w-20 rounded-xl"
                data-testid="input-extension-days"
              />
            </div>
          </div>
          <div>
            <p className="text-xs uppercase tracking-widest text-muted-foreground mb-2">
              {t("dashboard.requestReason", "Reason (optional)")}
            </p>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("dashboard.requestReasonPlaceholder", "Travel, illness, schedule change...")}
              data-testid="input-extension-reason"
              className="h-11 rounded-xl"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            className="rounded-xl"
            onClick={onClose}
            data-testid="button-cancel-extension"
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            className="rounded-xl"
            disabled={mutation.isPending}
            onClick={() => mutation.mutate()}
            data-testid="button-submit-extension"
          >
            {mutation.isPending && <Loader2 className="animate-spin mr-2" size={14} />}
            {t("dashboard.submitAndWhatsapp", "Submit & open WhatsApp")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============== INBODY TAB ===============

function hasMetrics(r: InbodyRecord) {
  return (
    r.weight != null ||
    r.bodyFat != null ||
    r.muscleMass != null ||
    r.bmi != null ||
    r.visceralFat != null ||
    r.bmr != null ||
    r.water != null ||
    r.score != null
  );
}

function InbodyTab({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const { data: records = [], isLoading } = useInbodyRecords({ userId });
  const upload = useUploadInbody();
  const fileRef = useRef<HTMLInputElement>(null);
  const trendsRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const list = records as InbodyRecord[];
  const sorted = [...list].sort(
    (a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime(),
  );
  const latest = sorted[0];

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      upload.mutate(
        { file },
        {
          onSuccess: (result) => {
            const r = result.record;
            if (r.aiExtracted && hasMetrics(r)) {
              toast({
                title: t("dashboard.toastInbodyAdded"),
                description: t("dashboard.toastInbodyAddedDesc"),
              });
            } else {
              toast({
                title: t("dashboard.toastInbodyReview"),
                description: t("dashboard.toastInbodyReviewDesc"),
              });
            }
          },
          onError: (err: any) => {
            toast({
              title: t("dashboard.toastUploadFailed"),
              description: err?.message || t("dashboard.toastUploadFailedDesc"),
              variant: "destructive",
            });
          },
        },
      );
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleDownloadPdf = async () => {
    try {
      setExporting(true);
      await exportInbodyReportPdf({
        clientName: user?.fullName || t("dashboard.client"),
        records: sorted,
        trendsElement: trendsRef.current,
      });
      toast({ title: t("dashboard.toastInbodyReportReady"), description: t("dashboard.toastInbodyReportReadyDesc") });
    } catch (e: any) {
      toast({
        title: t("dashboard.toastPdfFailed"),
        description: e?.message || t("dashboard.toastPdfFailedDesc"),
        variant: "destructive",
      });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-display font-bold">{t("dashboard.bodyCompHistory")}</h2>
          <p className="text-xs text-muted-foreground">
            {t("dashboard.uploadHint")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={exporting || sorted.length === 0}
            className="rounded-xl border-white/10"
            data-testid="button-download-inbody-pdf"
          >
            {exporting ? (
              <Loader2 size={14} className="animate-spin mr-1.5" />
            ) : (
              <FileDown size={14} className="mr-1.5" />
            )}
            {t("dashboard.downloadInbodyPdf")}
          </Button>
          <Button
            onClick={() => fileRef.current?.click()}
            className="rounded-xl"
            disabled={upload.isPending}
            data-testid="button-upload-inbody"
          >
            {upload.isPending ? (
              <Loader2 size={14} className="animate-spin mr-1.5" />
            ) : (
              <Upload size={14} className="mr-1.5" />
            )}
            {upload.isPending ? t("dashboard.readingScanShort") : t("dashboard.uploadScan")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            className="hidden"
            onChange={onFile}
          />
        </div>
      </div>

      {upload.isPending && (
        <div
          className="rounded-2xl border border-primary/30 bg-primary/5 p-4 inline-flex items-center gap-3"
          data-testid="status-inbody-reading"
        >
          <Loader2 size={16} className="animate-spin text-primary" />
          <span className="text-sm">{t("dashboard.readingScanLong")}</span>
        </div>
      )}

      {/* Trends — wrapped in a ref so the InBody PDF can snapshot it */}
      {sorted.length >= 2 && (
        <div ref={trendsRef}>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("dashboard.inbodyTrendsTitle")}
          </h3>
          <InbodyTrends records={sorted} />
        </div>
      )}

      {isLoading && <SkeletonCards />}

      {!isLoading && list.length === 0 && !upload.isPending && (
        <PremiumEmptyState
          icon={<Activity size={20} />}
          title={t("dashboard.inbodyEmpty")}
          body={t("emptyState.noInbody.body")}
          ctaLabel={t("dashboard.uploadScan")}
          ctaOnClick={() => fileRef.current?.click()}
          testId="empty-inbody"
        />
      )}

      {latest && (
        <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary mb-1 inline-flex items-center gap-2">
                <TrendingUp size={12} /> {t("dashboard.latestScan")}
              </p>
              <p className="text-sm text-muted-foreground">
                {latest.recordedAt && format(new Date(latest.recordedAt), "PPP")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {!latest.aiExtracted && (
                <span
                  className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                  data-testid="badge-needs-review"
                >
                  <AlertCircle size={11} /> {t("dashboard.needsReview")}
                </span>
              )}
              {latest.fileUrl && (
                <a
                  href={latest.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:opacity-80"
                  data-testid={`link-inbody-file-${latest.id}`}
                >
                  {t("dashboard.viewOriginal")}
                </a>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label={t("dashboard.metricWeight")} value={latest.weight} unit="kg" />
            <Metric label={t("dashboard.metricBodyFat")} value={latest.bodyFat} unit="%" />
            <Metric label={t("dashboard.metricMuscle")} value={latest.muscleMass} unit="kg" />
            <Metric label={t("dashboard.metricBmi")} value={latest.bmi} />
            <Metric label={t("dashboard.metricVisceral")} value={latest.visceralFat} />
            <Metric label={t("dashboard.metricBmr")} value={latest.bmr} unit="kcal" />
            <Metric label={t("dashboard.metricWater")} value={latest.water} unit="L" />
            <Metric label={t("dashboard.metricScore")} value={latest.score} />
          </div>
          {latest.notes && (
            <p className="text-xs text-muted-foreground mt-4 italic">"{latest.notes}"</p>
          )}
          {!latest.aiExtracted && (
            <p className="text-xs text-cyan-300/80 mt-4 inline-flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5" />
              {hasMetrics(latest) ? t("dashboard.lowConfidence") : t("dashboard.couldNotRead")}
            </p>
          )}
        </div>
      )}

      {sorted.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            {t("dashboard.earlierScans")}
          </h3>
          <div className="space-y-2">
            {sorted.slice(1).map((r) => (
              <div
                key={r.id}
                className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5"
                data-testid={`inbody-row-${r.id}`}
              >
                <div className="text-sm">
                  <span className="font-semibold">
                    {r.recordedAt && format(new Date(r.recordedAt), "MMM d, yyyy")}
                  </span>
                  <span className="text-muted-foreground ml-3">
                    {r.weight != null ? `${r.weight}kg` : t("dashboard.notAvailable")} •{" "}
                    {r.bodyFat != null ? `${r.bodyFat}% BF` : t("dashboard.notAvailable")}
                  </span>
                </div>
                {r.fileUrl && (
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:opacity-80"
                  >
                    {t("dashboard.view")}
                  </a>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  const { t } = useTranslation();
  const display =
    value != null ? `${value}${unit ? ` ${unit}` : ""}` : t("dashboard.notAvailable");
  return (
    <div className="rounded-xl bg-background/40 border border-white/5 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`font-display font-bold text-lg mt-0.5 ${
          value == null ? "text-muted-foreground/60 text-base" : ""
        }`}
        data-testid={`metric-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {display}
      </p>
    </div>
  );
}

// =============== PROGRESS TAB ===============

function ProgressTab({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data: photos = [], isLoading } = useProgressPhotos({ userId });
  const upload = useUploadProgressPhoto();
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadAngle, setUploadAngle] = useState<"front" | "side" | "back">("front");
  const [view, setView] = useState<"compare" | "gallery">("compare");

  const list = photos as ProgressPhoto[];
  const sorted = [...list].sort(
    (a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime(),
  );

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate({ file, type: "current", viewAngle: uploadAngle });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-display font-bold">{t("dashboard.progressTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("dashboard.progressTrack")}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Angle selector for the upload */}
          <div className="flex items-center gap-1 rounded-lg bg-white/5 p-1">
            {(["front", "side", "back"] as const).map((a) => (
              <button
                key={a}
                onClick={() => setUploadAngle(a)}
                className={`px-2.5 py-1 text-[11px] uppercase tracking-wider rounded-md capitalize ${
                  uploadAngle === a ? "bg-white/15 text-white" : "text-white/50 hover:text-white"
                }`}
                data-testid={`button-upload-angle-${a}`}
              >
                {a}
              </button>
            ))}
          </div>
          <Button
            onClick={() => fileRef.current?.click()}
            className="rounded-xl"
            disabled={upload.isPending}
            data-testid="button-upload-progress"
          >
            {upload.isPending ? (
              <Loader2 size={14} className="animate-spin mr-1.5" />
            ) : (
              <Upload size={14} className="mr-1.5" />
            )}
            {t("dashboard.addPhoto")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
        </div>
      </div>

      {/* View toggle */}
      <div className="inline-flex rounded-lg bg-white/5 p-1">
        <button
          onClick={() => setView("compare")}
          className={`px-3 py-1.5 text-xs rounded-md ${view === "compare" ? "bg-white/15 text-white" : "text-white/50"}`}
          data-testid="button-view-compare"
        >
          Compare
        </button>
        <button
          onClick={() => setView("gallery")}
          className={`px-3 py-1.5 text-xs rounded-md ${view === "gallery" ? "bg-white/15 text-white" : "text-white/50"}`}
          data-testid="button-view-gallery"
        >
          Gallery
        </button>
      </div>

      {isLoading && <SkeletonCards />}

      {!isLoading && sorted.length === 0 && (
        <PremiumEmptyState
          icon={<ImageIcon size={20} />}
          title={t("dashboard.progressEmpty")}
          body={t("emptyState.noProgress.body", "Upload your first progress photo to start tracking your transformation.")}
          testId="empty-progress"
        />
      )}

      {!isLoading && sorted.length > 0 && view === "compare" && (
        <BeforeAfterCompare photos={sorted} />
      )}

      {!isLoading && sorted.length > 0 && view === "gallery" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {sorted.map((p) => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="group relative rounded-2xl overflow-hidden border border-white/5 bg-white/5 aspect-square"
              data-testid={`progress-photo-${p.id}`}
            >
              <img
                src={p.photoUrl}
                alt="Progress"
                loading="lazy"
                decoding="async"
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-xs text-white font-medium">
                  {p.recordedAt && format(new Date(p.recordedAt), "MMM d, yyyy")}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-primary">
                  {p.type} · {(p as any).viewAngle ?? "front"}
                </p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============== SHARED ===============

function Section({
  title,
  count,
  children,
  empty,
}: {
  title: string;
  count: number;
  children: React.ReactNode;
  empty?: React.ReactNode;
}) {
  return (
    <section className="mb-10">
      <div className="flex items-baseline gap-3 mb-4">
        <h2 className="text-lg font-display font-bold">{title}</h2>
        <span className="text-xs text-muted-foreground">{count}</span>
      </div>
      {count === 0 ? empty : <div className="grid gap-3">{children}</div>}
    </section>
  );
}

// Local empty state — delegates to the shared <PremiumEmptyState />
// (Task #32) so every "nothing here yet" surface across the dashboard
// uses the same tron-card shell + premium copy treatment.
function EmptyState({
  title,
  cta,
  icon,
}: {
  title: string;
  cta?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <PremiumEmptyState
      title={title}
      icon={icon ?? <Calendar size={20} />}
      cta={cta}
    />
  );
}

function SkeletonCards() {
  // Premium AMOLED skeletons — share the .admin-shimmer utility so
  // client + admin loading states feel identical. No layout shift:
  // heights match the resolved card footprint.
  return (
    <div className="grid gap-3">
      {[1, 2].map((i) => (
        <div
          key={i}
          className="h-24 rounded-2xl border border-white/[0.05] bg-card/40 admin-shimmer"
        />
      ))}
    </div>
  );
}

export { WhatsAppButton };

// =============== BOOKING ELIGIBILITY BANNER ===============

function BookingEligibilityBanner({ userId, user }: { userId: number; user: any }) {
  const { t } = useTranslation();
  const { data: packages = [] } = usePackages({ userId });
  const list = packages as any[];
  const activePackage = list.find((p) => p.isActive && p.usedSessions < p.totalSessions);
  const pendingVerif = list.find((p: any) => p.status === "pending_verification");
  if (pendingVerif) {
    // Phase 1 UX coordination — premium guided "Coach Review In
    // Progress" banner. Replaces the prior technical "Package
    // awaiting verification" copy with progress-tracker semantics:
    // client always sees Where they are, What's happening, and What
    // happens next. Step 2 (Coach verification) is the active step
    // for any pending_verification row; once admin approves and the
    // package flips to active, the banner is removed entirely.
    const steps: Array<{
      key: string;
      label: string;
      state: "done" | "current" | "todo";
    }> = [
      {
        key: "received",
        label: t("dashboard.verification.progress.received", "Request received"),
        state: "done",
      },
      {
        key: "review",
        label: t("dashboard.verification.progress.review", "Coach verification"),
        state: "current",
      },
      {
        key: "activation",
        label: t("dashboard.verification.progress.activation", "Package activation"),
        state: "todo",
      },
      {
        key: "unlock",
        label: t("dashboard.verification.progress.unlock", "Booking unlocked"),
        state: "todo",
      },
    ];
    return (
      <div
        className="mb-6 rounded-2xl border border-cyan-500/40 bg-gradient-to-br from-cyan-500/[0.10] via-cyan-500/[0.04] to-transparent p-5 sm:p-6"
        data-testid="banner-pending-verification"
      >
        <div className="flex items-start gap-3">
          <div className="size-10 shrink-0 rounded-xl bg-cyan-500/15 text-cyan-300 grid place-items-center">
            <ShieldAlert size={18} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/90 font-semibold">
              {t("dashboard.verification.eyebrow", "Coach Review In Progress")}
            </p>
            <h3 className="mt-1 font-display font-bold text-base sm:text-lg leading-snug text-cyan-50">
              {t("dashboard.verification.title", "Getting your package ready")}
            </h3>
            <p className="text-xs sm:text-sm text-cyan-100/80 mt-1.5 leading-relaxed">
              {t(
                "dashboard.verification.body",
                "Your package details are being reviewed by the Youssef Elite team. You'll receive a notification the moment booking unlocks.",
              )}
            </p>
          </div>
        </div>

        <ol
          className="mt-5 space-y-2.5"
          data-testid="progress-verification"
          aria-label={t("dashboard.verification.progressLabel", "Progress")}
        >
          {steps.map((s) => {
            const isDone = s.state === "done";
            const isCurrent = s.state === "current";
            return (
              <li
                key={s.key}
                className="flex items-center gap-3"
                data-testid={`progress-step-${s.key}`}
                data-state={s.state}
              >
                <span
                  className={[
                    "size-5 shrink-0 grid place-items-center rounded-full border text-[10px] font-bold",
                    isDone
                      ? "bg-cyan-400/20 border-cyan-400/70 text-cyan-200"
                      : isCurrent
                        ? "bg-cyan-400/10 border-cyan-300 text-cyan-200 ring-2 ring-cyan-400/30"
                        : "bg-transparent border-cyan-100/20 text-cyan-100/30",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isDone ? "✓" : isCurrent ? "·" : ""}
                </span>
                <span
                  className={[
                    "text-xs sm:text-sm",
                    isDone
                      ? "text-cyan-100/90"
                      : isCurrent
                        ? "text-cyan-50 font-semibold"
                        : "text-cyan-100/40",
                  ].join(" ")}
                >
                  {s.label}
                </span>
                {isCurrent && (
                  <span className="ml-auto text-[10px] uppercase tracking-[0.14em] text-cyan-200/90 font-semibold">
                    {t("dashboard.verification.progress.currentTag", "In progress")}
                  </span>
                )}
              </li>
            );
          })}
        </ol>

        <div className="mt-4 flex items-center gap-2 text-[11px] text-cyan-100/70">
          <Clock size={12} className="shrink-0" />
          <span>{t("dashboard.verification.eta", "Usually within 24 hours.")}</span>
        </div>

        <a
          href={whatsappUrl(DEFAULT_WHATSAPP_NUMBER)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-200 hover:text-cyan-100 transition-colors"
          data-testid="link-verification-help"
        >
          {t("dashboard.verification.help", "Need help? Message Coach")}
          <ArrowRight size={12} />
        </a>
      </div>
    );
  }
  const verdict = evaluateBookingEligibility(user, activePackage ?? null);
  if (verdict.ok) return null;
  return (
    <div
      className="mb-6 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-4 flex items-start gap-3"
      data-testid="banner-dashboard-eligibility"
    >
      <ShieldAlert size={18} className="text-cyan-300 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-cyan-100">Booking unavailable</p>
        <p className="text-xs text-cyan-200/90 mt-1">{verdict.message}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {verdict.code === "profile_incomplete" && (
            <Link href="/profile" className="text-cyan-100 hover:opacity-80" data-testid="link-dashboard-profile">
              Complete profile →
            </Link>
          )}
          <a
            href={whatsappUrl(DEFAULT_WHATSAPP_NUMBER)}
            target="_blank"
            rel="noopener noreferrer"
            className="text-cyan-100 hover:opacity-80"
            data-testid="link-dashboard-whatsapp-help"
          >
            {t("dashboard.contactYoussef", "Contact Youssef →")}
          </a>
        </div>
      </div>
    </div>
  );
}
