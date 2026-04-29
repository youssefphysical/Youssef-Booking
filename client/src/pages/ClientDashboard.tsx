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
import { whatsappUrl, DEFAULT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { tierHasPriority, VIP_TIER_TAGLINES } from "@shared/schema";
import {
  ALL_TIME_SLOTS,
  formatStatus,
  statusColor,
  hoursUntil,
  isCancellable,
} from "@/lib/booking-utils";
import {
  PACKAGE_DEFINITIONS,
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

  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto px-5 pt-24 pb-20">
      <div className="flex items-start justify-between mb-6 gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">My Training</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-greeting">
            Hello, {user.fullName.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your sessions, packages and progress
          </p>
          <div className="mt-3">
            <VipBadge tier={user.vipTier ?? "foundation"} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Link href="/book" data-testid="link-new-booking">
            <Button className="h-11 rounded-xl">
              <Plus size={16} className="mr-1.5" /> New Booking
            </Button>
          </Link>
        </div>
      </div>

      <MembershipBlock user={user} />

      <Tabs defaultValue="bookings" className="w-full">
        <TabsList className="grid grid-cols-4 w-full max-w-2xl bg-white/5 mb-6 h-11">
          <TabsTrigger value="bookings" data-testid="tab-bookings">
            <Calendar size={14} className="mr-1.5" /> Bookings
          </TabsTrigger>
          <TabsTrigger value="packages" data-testid="tab-packages">
            <PackageIcon size={14} className="mr-1.5" /> Sessions
          </TabsTrigger>
          <TabsTrigger value="inbody" data-testid="tab-inbody">
            <Activity size={14} className="mr-1.5" /> InBody
          </TabsTrigger>
          <TabsTrigger value="progress" data-testid="tab-progress">
            <ImageIcon size={14} className="mr-1.5" /> Progress
          </TabsTrigger>
        </TabsList>

        <TabsContent value="bookings"><BookingsTab userId={user.id} /></TabsContent>
        <TabsContent value="packages"><PackagesTab userId={user.id} /></TabsContent>
        <TabsContent value="inbody"><InbodyTab userId={user.id} /></TabsContent>
        <TabsContent value="progress"><ProgressTab userId={user.id} /></TabsContent>
      </Tabs>
    </div>
  );
}

// =============== VIP BADGE ===============

function VipBadge({ tier }: { tier: string }) {
  const t = normaliseTier(tier);
  const Icon =
    t === "diamond_elite" || t === "pro_elite" || t === "elite"
      ? Crown
      : t === "momentum"
      ? Star
      : Sparkles;
  const colour =
    t === "diamond_elite"
      ? "bg-gradient-to-r from-cyan-400/20 to-violet-500/20 border-cyan-300/40 text-cyan-100"
      : t === "pro_elite"
      ? "bg-gradient-to-r from-fuchsia-500/15 to-purple-500/15 border-fuchsia-400/30 text-fuchsia-200"
      : t === "elite"
      ? "bg-gradient-to-r from-amber-500/15 to-orange-500/15 border-amber-400/30 text-amber-200"
      : t === "momentum"
      ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-200"
      : t === "starter"
      ? "bg-sky-500/10 border-sky-400/30 text-sky-200"
      : "bg-blue-500/10 border-blue-400/30 text-blue-200";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold px-3 py-1.5 rounded-full border ${colour}`}
            data-testid={`vip-badge-${t}`}
          >
            <Icon size={12} />
            {VIP_TIER_LABELS[t] || "Member"}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-xs">{VIP_TIER_DESCRIPTIONS[t]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// =============== MEMBERSHIP BLOCK ===============

function MembershipBlock({ user }: { user: { vipTier: string | null; weeklyFrequency: number | null; protectedCancelMonth: string | null; protectedCancelCount: number | null; sameDayAdjustMonth: string | null; sameDayAdjustCount: number | null } }) {
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
            <Info size={12} /> My Training Level
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
                <Crown size={10} /> Priority
              </span>
            )}
            <span className="text-muted-foreground">
              · {freqOption?.label.split(" — ")[0] ?? "Weekly frequency not set"}
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
          View all levels
        </Link>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
        <div
          className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3"
          data-testid="block-protected-remaining"
        >
          <p className="text-[10px] uppercase tracking-wider text-amber-200/80 inline-flex items-center gap-1.5">
            <Shield size={11} /> Protected Cancellations
          </p>
          <p className="text-lg font-display font-bold mt-1">
            {protQuota === 0 ? (
              <span className="text-muted-foreground text-base">Not on this level</span>
            ) : (
              <span>
                {protRemaining}{" "}
                <span className="text-sm text-muted-foreground font-normal">/ {protQuota} left this month</span>
              </span>
            )}
          </p>
        </div>
        <div
          className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-3"
          data-testid="block-sameday-remaining"
        >
          <p className="text-[10px] uppercase tracking-wider text-blue-200/80 inline-flex items-center gap-1.5">
            <Clock size={11} /> Same-Day Adjustments
          </p>
          <p className="text-lg font-display font-bold mt-1">
            {adjQuota === 0 ? (
              <span className="text-muted-foreground text-base">Not on this level</span>
            ) : (
              <span>
                {adjRemaining}{" "}
                <span className="text-sm text-muted-foreground font-normal">/ {adjQuota} left this month</span>
              </span>
            )}
          </p>
        </div>
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        Need to change your weekly frequency?{" "}
        <a
          href={whatsappUrl(DEFAULT_WHATSAPP_NUMBER, "Hi Youssef, I'd like to update my weekly training frequency.")}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          Message Youssef on WhatsApp
        </a>
        .
      </p>
    </div>
  );
}

// =============== BOOKINGS TAB ===============

function BookingsTab({ userId }: { userId: number }) {
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
        title="Upcoming"
        count={upcoming.length}
        empty={
          <EmptyState
            title="No upcoming sessions"
            cta={
              <Link href="/book">
                <Button className="rounded-xl mt-4">Book a Session</Button>
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
        title="Past sessions"
        count={past.length}
        empty={<EmptyState title="No past sessions yet" />}
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
      ? "Intro Assessment"
      : booking.sessionType === "single"
      ? "Single Session"
      : booking.sessionType === "duo"
      ? "Duo Session"
      : "Session";

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
            {booking.timeSlot} • {sessionLabel}
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
                <Shield size={10} /> Protected
              </span>
            )}
            {booking.rescheduledFrom && (
              <span
                className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md border border-purple-500/30 bg-purple-500/10 text-purple-300"
                title={`Originally ${booking.rescheduledFrom}`}
              >
                <Clock size={10} /> Adjusted
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
              <X size={14} className="mr-1" /> Cancel
            </Button>
          ) : (
            <>
              <div className="text-xs text-amber-300/80 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 self-start sm:self-end">
                <Lock size={12} />
                Locked ({isStarted ? "started" : `${hoursDisplay}h left`})
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
                  Use Protected Cancellation ({protectedRemaining}/{protectedQuota} left)
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
              Same-Day Adjustment ({adjustRemaining}/{adjustQuota} left)
            </Button>
          )}
        </div>
      )}

      {/* Free cancel confirm */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-white/10 sm:rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {format(new Date(booking.date), "PPPP")} at {booking.timeSlot}. Since you're
              cancelling more than {cutoff} hours in advance, this won't be charged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-keep-booking">Keep it</AlertDialogCancel>
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
              Yes, cancel
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
              Use a Protected Cancellation?
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <span className="block">
                You have{" "}
                <span className="text-amber-300 font-semibold">
                  {protectedRemaining} of {protectedQuota}
                </span>{" "}
                Protected Cancellations available this month.
              </span>
              <span className="block">
                Using one cancels this session for free even though it's inside the{" "}
                {cutoff}-hour window. The session is not deducted from your plan.
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-protected">Not now</AlertDialogCancel>
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
              Yes, use Protected Cancellation
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
            Same-Day Adjustment
          </DialogTitle>
          <DialogDescription>
            Move today's {booking.timeSlot} session to another time the same day. You have{" "}
            <span className="text-blue-300 font-semibold">{remaining}</span> adjustment
            {remaining === 1 ? "" : "s"} left this month.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-xs uppercase tracking-wider text-muted-foreground">New time slot</p>
          {slots.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No remaining slots are available later today.
            </p>
          ) : (
            <Select value={slot} onValueChange={setSlot}>
              <SelectTrigger className="bg-white/5 border-white/10 h-11" data-testid="select-adjust-slot">
                <SelectValue placeholder="Pick a new time" />
              </SelectTrigger>
              <SelectContent>
                {slots.map((s) => (
                  <SelectItem key={s} value={s} data-testid={`option-adjust-${s}`}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-adjust-cancel">
            Cancel
          </Button>
          <Button
            disabled={!slot || submitting}
            onClick={() => slot && onSubmit(slot)}
            className="bg-blue-500 hover:bg-blue-600"
            data-testid="button-adjust-confirm"
          >
            {submitting && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            Move session
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// =============== PACKAGES TAB ===============

function PackagesTab({ userId }: { userId: number }) {
  const { data: packages = [], isLoading } = usePackages({ userId });
  const list = packages as Package[];

  if (isLoading) return <SkeletonCards />;

  if (list.length === 0) {
    return (
      <EmptyState
        title="No active packages yet"
        cta={
          <p className="text-xs text-muted-foreground mt-3 max-w-sm mx-auto">
            Contact Youssef on WhatsApp to purchase a session package. Available:
            Essential Plan (10), Progress Plan (20), Elite Plan (25), or Duo Performance Plan (30 sessions).
          </p>
        }
      />
    );
  }

  return (
    <div className="grid sm:grid-cols-2 gap-3">
      {list.map((p) => {
        const def = PACKAGE_DEFINITIONS[p.type];
        const remaining = p.totalSessions - p.usedSessions;
        const pct = Math.round((p.usedSessions / Math.max(p.totalSessions, 1)) * 100);
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
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-primary mb-1">
                  {def?.label || `${p.type} Package`}
                </p>
                <p className="text-3xl font-display font-bold">
                  {remaining}
                  <span className="text-base text-muted-foreground font-normal">
                    {" "}
                    / {p.totalSessions}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">sessions remaining</p>
                {def?.tagline && (
                  <p className="text-[10px] text-muted-foreground/70 mt-0.5">{def.tagline}</p>
                )}
              </div>
              {def?.isDuo && (
                <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300">
                  <Users size={11} /> Duo
                </span>
              )}
            </div>
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Started {p.purchasedAt ? format(new Date(p.purchasedAt), "MMM d, yyyy") : "—"}
              {!p.isActive && " • Closed"}
            </p>
          </motion.div>
        );
      })}
    </div>
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
                title: "InBody scan added",
                description: "We read your numbers automatically.",
              });
            } else {
              toast({
                title: "Scan uploaded — needs review",
                description:
                  "We couldn't read every value with confidence. Youssef will review and update it for you.",
              });
            }
          },
          onError: (err: any) => {
            toast({
              title: "Upload failed",
              description: err?.message || "Please try a clearer photo or contact Youssef.",
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
        clientName: user?.fullName || "Client",
        records: sorted,
        trendsElement: trendsRef.current,
      });
      toast({ title: "InBody report ready", description: "PDF saved to your device." });
    } catch (e: any) {
      toast({
        title: "Couldn't generate PDF",
        description: e?.message || "Please try again.",
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
          <h2 className="text-lg font-display font-bold">Body Composition History</h2>
          <p className="text-xs text-muted-foreground">
            Upload InBody scans — we'll read the numbers automatically.
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
            Download InBody Report PDF
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
            {upload.isPending ? "Reading your InBody scan…" : "Upload Scan"}
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
          <span className="text-sm">Reading your InBody scan… this usually takes a few seconds.</span>
        </div>
      )}

      {/* Trends — wrapped in a ref so the InBody PDF can snapshot it */}
      {sorted.length >= 2 && (
        <div ref={trendsRef}>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Trends
          </h3>
          <InbodyTrends records={sorted} />
        </div>
      )}

      {isLoading && <SkeletonCards />}

      {!isLoading && list.length === 0 && !upload.isPending && (
        <EmptyState title="No InBody scans yet" />
      )}

      {latest && (
        <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary mb-1 inline-flex items-center gap-2">
                <TrendingUp size={12} /> Latest Scan
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
                  <AlertCircle size={11} /> Needs Review
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
                  View original
                </a>
              )}
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Metric label="Weight" value={latest.weight} unit="kg" />
            <Metric label="Body Fat" value={latest.bodyFat} unit="%" />
            <Metric label="Muscle" value={latest.muscleMass} unit="kg" />
            <Metric label="BMI" value={latest.bmi} />
            <Metric label="Visceral Fat" value={latest.visceralFat} />
            <Metric label="BMR" value={latest.bmr} unit="kcal" />
            <Metric label="Body Water" value={latest.water} unit="L" />
            <Metric label="Score" value={latest.score} />
          </div>
          {latest.notes && (
            <p className="text-xs text-muted-foreground mt-4 italic">"{latest.notes}"</p>
          )}
          {!latest.aiExtracted && (
            <p className="text-xs text-amber-300/80 mt-4 inline-flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5" />
              {hasMetrics(latest)
                ? "Some values came through with low confidence. Youssef will double-check this scan."
                : "We received your scan but couldn't read the numbers automatically. Youssef will update them shortly."}
            </p>
          )}
        </div>
      )}

      {sorted.length > 1 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Earlier scans
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
                    {r.weight != null ? `${r.weight}kg` : "Not available"} •{" "}
                    {r.bodyFat != null ? `${r.bodyFat}% BF` : "Not available"}
                  </span>
                </div>
                {r.fileUrl && (
                  <a
                    href={r.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline"
                  >
                    View
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
  const display =
    value != null ? `${value}${unit ? ` ${unit}` : ""}` : "Not available";
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
          <h2 className="text-lg font-display font-bold">Progress Photos</h2>
          <p className="text-xs text-muted-foreground">Track your transformation visually</p>
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
          Add Photo
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

      {!isLoading && sorted.length === 0 && <EmptyState title="No progress photos yet" />}

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
