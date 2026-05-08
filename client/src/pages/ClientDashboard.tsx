import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Link } from "wouter";
import {
  Calendar,
  Plus,
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
import { ClipboardCheck } from "lucide-react";
import { useProgressPhotos, useUploadProgressPhoto } from "@/hooks/use-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useMutation } from "@tanstack/react-query";
import { tierHasPriority, VIP_TIER_TAGLINES, evaluateBookingEligibility } from "@shared/schema";
import { ShieldAlert } from "lucide-react";
import {
  ALL_TIME_SLOTS,
  formatStatus,
  statusColor,
  hoursUntil,
  isCancellable,
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
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { useTranslation } from "@/i18n";
import { SupplementsTab } from "@/components/dashboard/SupplementsTab";
import { Pill, LineChart as LineChartIcon } from "lucide-react";

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

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto px-5 pt-24 pb-20">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div className="flex items-start gap-4 min-w-0">
          <Link href="/profile" data-testid="link-dashboard-avatar" className="shrink-0">
            <UserAvatar
              src={user.profilePictureUrl}
              name={user.fullName}
              size={64}
              testId="img-dashboard-avatar"
            />
          </Link>
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">{t("dashboard.eyebrow")}</p>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-3xl font-display font-bold leading-tight" data-testid="text-greeting">
                {t("dashboard.greeting").replace("{name}", user.fullName.split(" ")[0])}
              </h1>
              {user.isVerified && <VerifiedBadge size="md" testId="badge-dashboard-verified" />}
            </div>
            <p className="text-muted-foreground text-sm mt-1">
              {t("dashboard.subtitle")}
            </p>
            <div className="mt-3">
              <VipBadge tier={user.vipTier ?? "foundation"} />
            </div>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/book" data-testid="link-new-booking">
            <Button className="h-11 rounded-xl">
              <Plus size={16} className="mr-1.5" /> {t("dashboard.newBooking")}
            </Button>
          </Link>
        </div>
      </div>

      <MembershipBlock user={user} />
      <BookingEligibilityBanner userId={user.id} user={user} />

      <Tabs defaultValue="bookings" className="w-full">
        <TabsList className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-7 w-full max-w-5xl bg-white/5 mb-6 h-auto lg:h-11 gap-1 p-1">
          <TabsTrigger value="bookings" data-testid="tab-bookings">
            <Calendar size={14} className="mr-1.5" /> {t("dashboard.tabBookings")}
          </TabsTrigger>
          <TabsTrigger value="packages" data-testid="tab-packages">
            <PackageIcon size={14} className="mr-1.5" /> {t("dashboard.tabPackages")}
          </TabsTrigger>
          <TabsTrigger value="supplements" data-testid="tab-supplements">
            <Pill size={14} className="mr-1.5" /> {t("dashboard.tabSupplements", "Supplements")}
          </TabsTrigger>
          <TabsTrigger value="body" data-testid="tab-body">
            <LineChartIcon size={14} className="mr-1.5" /> {t("dashboard.tabBody", "Body")}
          </TabsTrigger>
          <TabsTrigger value="checkins" data-testid="tab-checkins">
            <ClipboardCheck size={14} className="mr-1.5" /> {t("dashboard.tabCheckins", "Check-ins")}
          </TabsTrigger>
          <TabsTrigger value="inbody" data-testid="tab-inbody">
            <Activity size={14} className="mr-1.5" /> {t("dashboard.tabInbody")}
          </TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress">
            <ImageIcon size={14} className="mr-1.5" /> {t("dashboard.tabProgress")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings"><BookingsTab userId={user.id} /></TabsContent>
        <TabsContent value="packages"><PackagesTab userId={user.id} /></TabsContent>
        <TabsContent value="supplements"><SupplementsTab /></TabsContent>
        <TabsContent value="body"><BodyMetricsPanel userId={user.id} canEdit={false} /></TabsContent>
        <TabsContent value="checkins"><WeeklyCheckinsPanel /></TabsContent>
        <TabsContent value="inbody"><InbodyTab userId={user.id} /></TabsContent>
        <TabsContent value="progress"><ProgressTab userId={user.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

// =============== VIP BADGE ===============

function VipBadge({ tier }: { tier: string }) {
  const { t: trans } = useTranslation();
  const tg = normaliseTier(tier);
  const Icon =
    tg === "diamond_elite" || tg === "pro_elite" || tg === "elite"
      ? Crown
      : tg === "momentum"
      ? Star
      : Sparkles;
  const colour =
    tg === "diamond_elite"
      ? "bg-gradient-to-r from-cyan-400/20 to-violet-500/20 border-cyan-300/40 text-cyan-100"
      : tg === "pro_elite"
      ? "bg-gradient-to-r from-fuchsia-500/15 to-purple-500/15 border-fuchsia-400/30 text-fuchsia-200"
      : tg === "elite"
      ? "bg-gradient-to-r from-amber-500/15 to-orange-500/15 border-amber-400/30 text-amber-200"
      : tg === "momentum"
      ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-200"
      : tg === "starter"
      ? "bg-sky-500/10 border-sky-400/30 text-sky-200"
      : "bg-blue-500/10 border-blue-400/30 text-blue-200";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold px-3 py-1.5 rounded-full border ${colour}`}
            data-testid={`vip-badge-${tg}`}
          >
            <Icon size={12} />
            {VIP_TIER_LABELS[tg] || trans("dashboard.member")}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-xs">{VIP_TIER_DESCRIPTIONS[tg]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

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
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border border-amber-400/30 bg-amber-500/10 text-amber-200"
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
        <Link href="/how-it-works" className="text-xs text-primary hover:underline self-start">
          {t("dashboard.viewAllLevels")}
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <div
          className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3"
          data-testid="block-protected-remaining"
        >
          <p className="text-[10px] uppercase tracking-wider text-amber-200/80 inline-flex items-center gap-1.5">
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
          className="text-primary hover:underline"
        >
          {t("dashboard.messageWaLink")}
        </a>
        .
      </p>
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
        const sd = new Date(`${b.date}T${b.timeSlot}:00`);
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
          <EmptyState
            title={t("dashboard.noUpcoming")}
            cta={
              <Link href="/book">
                <Button className="rounded-xl mt-4">{t("dashboard.bookSessionCta")}</Button>
              </Link>
            }
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
              canCancel
            />
          ))
        )}
      </Section>

      <Section
        title={t("dashboard.sectionPast")}
        count={past.length}
        empty={<EmptyState title={t("dashboard.noPast")} />}
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
      className="rounded-2xl border border-white/5 bg-card/60 p-5 flex flex-col sm:flex-row sm:items-center gap-4"
      data-testid={`booking-card-${booking.id}`}
    >
      <div className="flex items-center gap-4 flex-1">
        <div className="flex-shrink-0 w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary">
          <span className="text-[10px] uppercase font-bold">
            {format(new Date(booking.date), "MMM")}
          </span>
          <span className="text-xl font-display font-bold leading-none">
            {format(new Date(booking.date), "d")}
          </span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{format(new Date(booking.date), "EEEE")}</p>
          <p className="text-sm text-muted-foreground">
            {formatTime12(booking.timeSlot)} • {sessionLabel}
          </p>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            <span
              className={`inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${statusColor(
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
              <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300">
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
          </div>
        </div>
      </div>

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
              <div className="text-xs text-amber-300/80 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 self-start sm:self-end">
                <Lock size={12} />
                {t("dashboard.locked")} ({isStarted ? t("dashboard.lockedStarted") : t("dashboard.lockedHoursLeft").replace("{h}", String(hoursDisplay))})
              </div>
              {!isStarted && protectedAvailable && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-amber-300 hover:text-amber-200 hover:bg-amber-500/10 text-xs"
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
              <Shield className="text-amber-300" size={18} />
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
              className="bg-amber-500 hover:bg-amber-600 text-black"
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
      const d = new Date(`${booking.date}T${t}:00`);
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
  const list = packages as Package[];

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
        <EmptyState
          title={t("dashboard.packagesNone")}
          cta={
            <p className="text-xs text-muted-foreground mt-3 max-w-sm mx-auto">
              {t("dashboard.packagesEmptyDesc")}
            </p>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 gap-3">
          {list.map((p) => {
            const def = PACKAGE_DEFINITIONS[p.type];
            const remaining = p.totalSessions - p.usedSessions;
            const pct = Math.round((p.usedSessions / Math.max(p.totalSessions, 1)) * 100);
            const status = computePackageStatus(p);
            const days = daysUntilExpiry(p);

            const statusBadge =
              status === "expired"
                ? { label: t("dashboard.packageStatusExpired", "Expired"), cls: "bg-red-500/10 border-red-500/30 text-red-300" }
                : status === "expiring_soon"
                  ? { label: t("dashboard.packageStatusExpiring", "Expiring soon"), cls: "bg-amber-500/10 border-amber-500/30 text-amber-300" }
                  : status === "completed"
                    ? { label: t("dashboard.packageStatusCompleted", "Completed"), cls: "bg-sky-500/10 border-sky-500/30 text-sky-300" }
                    : { label: t("dashboard.packageStatusActive", "Active"), cls: "bg-primary/10 border-primary/30 text-primary" };

            return (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className={`rounded-2xl border p-5 ${
                  p.isActive ? "border-primary/30 bg-primary/5" : "border-white/5 bg-card/60 opacity-70"
                }`}
                data-testid={`package-card-${p.id}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <p className="text-xs uppercase tracking-[0.2em] text-primary mb-1 truncate">
                      {(p as any).name || def?.label || `${p.type} Package`}
                    </p>
                    <p className="text-3xl font-display font-bold tabular-nums">
                      {remaining}
                      <span className="text-base text-muted-foreground font-normal">
                        {" "}
                        / {p.totalSessions}
                      </span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">{t("dashboard.sessionsRemaining")}</p>
                    {((p as any).bonusSessions ?? 0) > 0 && (
                      <span className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/12 border border-emerald-400/30 px-2 py-0.5 text-emerald-300 shadow-[0_0_14px_-6px_rgba(16,185,129,0.5)]">
                        <Sparkles size={11} className="shrink-0" />
                        <span className="text-[11px] font-display font-bold tabular-nums leading-none">
                          +{(p as any).bonusSessions} {t("home.packages.bonus")}
                        </span>
                      </span>
                    )}
                    {def?.tagline && (
                      <p className="text-[10px] text-muted-foreground/70 mt-1">{def.tagline}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-1.5">
                    <span
                      className={`inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-lg border font-bold ${statusBadge.cls}`}
                      data-testid={`package-status-${p.id}`}
                    >
                      {statusBadge.label}
                    </span>
                    {def?.isDuo && (
                      <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                        <Users size={11} /> {t("dashboard.packageDuo")}
                      </span>
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <div className="text-xs text-muted-foreground mt-3 space-y-1">
                  <p>
                    {t("dashboard.packageStarted").replace(
                      "{date}",
                      p.startDate
                        ? format(new Date(p.startDate as any), "MMM d, yyyy")
                        : p.purchasedAt
                          ? format(new Date(p.purchasedAt), "MMM d, yyyy")
                          : "—",
                    )}
                    {!p.isActive && ` • ${t("dashboard.packageClosed")}`}
                  </p>
                  {p.expiryDate && (
                    <p data-testid={`package-expiry-${p.id}`}>
                      {t("dashboard.packageExpiresOn", "Expires").replace(
                        "{date}",
                        format(new Date(p.expiryDate as any), "MMM d, yyyy"),
                      )}
                      {days !== null && days >= 0 && status !== "completed" && (
                        <>
                          {" • "}
                          <span className={status === "expiring_soon" ? "text-amber-300 font-semibold" : ""}>
                            {t("dashboard.packageExpiresIn", "{days} days left").replace("{days}", String(days))}
                          </span>
                        </>
                      )}
                      {days !== null && days < 0 && (
                        <>
                          {" • "}
                          <span className="text-red-300 font-semibold">
                            {t("dashboard.packageExpired", "Expired")}
                          </span>
                        </>
                      )}
                    </p>
                  )}
                </div>
                {(status === "expired" || status === "expiring_soon" || status === "completed") && p.isActive && (
                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-lg h-8 text-xs flex-1"
                      onClick={() => setRenewalOpen(true)}
                      data-testid={`button-renew-${p.id}`}
                    >
                      <RefreshCw size={11} className="mr-1" />
                      {t("dashboard.requestRenewal", "Request Renewal")}
                    </Button>
                    {status !== "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg h-8 text-xs flex-1"
                        onClick={() => setExtensionPkg(p)}
                        data-testid={`button-extend-${p.id}`}
                      >
                        <CalendarPlus size={11} className="mr-1" />
                        {t("dashboard.requestExtension", "Request Extension")}
                      </Button>
                    )}
                  </div>
                )}
              </motion.div>
            );
          })}
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
        <EmptyState title={t("dashboard.inbodyEmpty")} />
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
                  className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold px-2.5 py-1 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300"
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
                  className="text-xs text-primary hover:underline"
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
            <p className="text-xs text-amber-300/80 mt-4 inline-flex items-start gap-1.5">
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
                    className="text-xs text-primary hover:underline"
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

  const list = photos as ProgressPhoto[];
  const sorted = [...list].sort(
    (a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime(),
  );

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate({ file, type: "current" });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-display font-bold">{t("dashboard.progressTitle")}</h2>
          <p className="text-xs text-muted-foreground">{t("dashboard.progressTrack")}</p>
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

      {isLoading && <SkeletonCards />}

      {!isLoading && sorted.length === 0 && <EmptyState title={t("dashboard.progressEmpty")} />}

      {sorted.length > 0 && (
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
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/80 to-transparent">
                <p className="text-xs text-white font-medium">
                  {p.recordedAt && format(new Date(p.recordedAt), "MMM d, yyyy")}
                </p>
                <p className="text-[10px] uppercase tracking-wider text-primary">{p.type}</p>
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

function EmptyState({ title, cta }: { title: string; cta?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-10 text-center">
      <Calendar className="mx-auto text-muted-foreground/40 mb-3" size={28} />
      <p className="text-sm text-muted-foreground">{title}</p>
      {cta}
    </div>
  );
}

function SkeletonCards() {
  return (
    <div className="grid gap-3">
      {[1, 2].map((i) => (
        <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
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
  const verdict = evaluateBookingEligibility(user, activePackage ?? null);
  if (verdict.ok) return null;
  return (
    <div
      className="mb-6 rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3"
      data-testid="banner-dashboard-eligibility"
    >
      <ShieldAlert size={18} className="text-amber-300 mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-amber-100">Booking unavailable</p>
        <p className="text-xs text-amber-200/90 mt-1">{verdict.message}</p>
        <div className="mt-2 flex flex-wrap gap-3 text-xs">
          {verdict.code === "profile_incomplete" && (
            <Link href="/profile" className="underline text-amber-100" data-testid="link-dashboard-profile">
              Complete profile →
            </Link>
          )}
          <a
            href={whatsappUrl(DEFAULT_WHATSAPP_NUMBER)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline text-amber-100"
            data-testid="link-dashboard-whatsapp-help"
          >
            {t("dashboard.contactYoussef", "Contact Youssef →")}
          </a>
        </div>
      </div>
    </div>
  );
}
