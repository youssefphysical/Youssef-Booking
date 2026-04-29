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
import {
  useInbodyRecords,
  useUploadInbody,
  useUpdateInbody,
} from "@/hooks/use-inbody";
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
import { exportElementToPdf } from "@/lib/pdf-export";
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
  SAME_DAY_ADJUST_QUOTA,
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
  const { toast } = useToast();
  const exportRef = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  if (!user) return null;

  const handleExport = async () => {
    if (!exportRef.current) return;
    try {
      setExporting(true);
      await exportElementToPdf(exportRef.current, {
        filename: `${user.fullName.replace(/\s+/g, "_")}_dashboard.pdf`,
      });
      toast({ title: "PDF exported" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-5 pt-24 pb-20" ref={exportRef}>
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">My Training</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-greeting">
            Hello, {user.fullName.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage your sessions, packages and progress
          </p>
          <div className="mt-3">
            <VipBadge tier={user.vipTier ?? "developing"} />
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            className="h-11 rounded-xl border-white/10"
            onClick={handleExport}
            disabled={exporting}
            data-testid="button-export-pdf"
          >
            {exporting ? (
              <Loader2 size={16} className="mr-1.5 animate-spin" />
            ) : (
              <FileDown size={16} className="mr-1.5" />
            )}
            Export PDF
          </Button>
          <Link href="/book" data-testid="link-new-booking">
            <Button className="h-11 rounded-xl">
              <Plus size={16} className="mr-1.5" /> New Booking
            </Button>
          </Link>
        </div>
      </div>

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
  const Icon = tier === "elite" ? Crown : tier === "consistent" ? Star : Sparkles;
  const colour =
    tier === "elite"
      ? "bg-gradient-to-r from-amber-500/15 to-orange-500/15 border-amber-400/30 text-amber-200"
      : tier === "consistent"
      ? "bg-emerald-500/15 border-emerald-400/30 text-emerald-200"
      : "bg-blue-500/10 border-blue-400/30 text-blue-200";
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={`inline-flex items-center gap-1.5 text-[11px] uppercase tracking-wider font-semibold px-3 py-1.5 rounded-full border ${colour}`}
            data-testid={`vip-badge-${tier}`}
          >
            <Icon size={12} />
            {VIP_TIER_LABELS[tier] || "Client"}
          </span>
        </TooltipTrigger>
        <TooltipContent side="right" className="max-w-xs">
          <p className="text-xs">{VIP_TIER_DESCRIPTIONS[tier]}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
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
  const adjustRemaining = Math.max(0, SAME_DAY_ADJUST_QUOTA - usedAdjustsThisMonth);

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
              Same-Day Adjustment ({adjustRemaining}/{SAME_DAY_ADJUST_QUOTA} left)
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

type EditableInbody = {
  weight: string;
  bodyFat: string;
  muscleMass: string;
  bmi: string;
  visceralFat: string;
  bmr: string;
  water: string;
  score: string;
  notes: string;
};

function recordToEditable(r: InbodyRecord | null): EditableInbody {
  return {
    weight: r?.weight != null ? String(r.weight) : "",
    bodyFat: r?.bodyFat != null ? String(r.bodyFat) : "",
    muscleMass: r?.muscleMass != null ? String(r.muscleMass) : "",
    bmi: r?.bmi != null ? String(r.bmi) : "",
    visceralFat: r?.visceralFat != null ? String(r.visceralFat) : "",
    bmr: r?.bmr != null ? String(r.bmr) : "",
    water: r?.water != null ? String(r.water) : "",
    score: r?.score != null ? String(r.score) : "",
    notes: r?.notes ?? "",
  };
}

function editableToPatch(e: EditableInbody) {
  const num = (v: string) => (v.trim() === "" ? null : Number(v));
  return {
    weight: num(e.weight),
    bodyFat: num(e.bodyFat),
    muscleMass: num(e.muscleMass),
    bmi: num(e.bmi),
    visceralFat: num(e.visceralFat),
    bmr: num(e.bmr),
    water: num(e.water),
    score: num(e.score),
    notes: e.notes.trim() || null,
  };
}

function InbodyTab({ userId }: { userId: number }) {
  const { data: records = [], isLoading } = useInbodyRecords({ userId });
  const upload = useUploadInbody();
  const updateInbody = useUpdateInbody();
  const fileRef = useRef<HTMLInputElement>(null);

  const [previewRecord, setPreviewRecord] = useState<InbodyRecord | null>(null);
  const [editable, setEditable] = useState<EditableInbody>(recordToEditable(null));

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
            setPreviewRecord(result.record);
            setEditable(recordToEditable(result.record));
          },
        },
      );
    }
    if (fileRef.current) fileRef.current.value = "";
  };

  const onConfirm = () => {
    if (!previewRecord) return;
    updateInbody.mutate(
      { id: previewRecord.id, ...editableToPatch(editable) },
      { onSuccess: () => setPreviewRecord(null) },
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-display font-bold">Body Composition History</h2>
          <p className="text-xs text-muted-foreground">
            Upload InBody scans to track your progress
          </p>
        </div>
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
          Upload Scan
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={onFile}
        />
      </div>

      {/* Trends */}
      {sorted.length >= 2 && (
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3">
            Trends
          </h3>
          <InbodyTrends records={sorted} />
        </div>
      )}

      {isLoading && <SkeletonCards />}

      {!isLoading && list.length === 0 && <EmptyState title="No InBody scans yet" />}

      {latest && (
        <div className="rounded-3xl border border-primary/30 bg-primary/5 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-primary mb-1 inline-flex items-center gap-2">
                <TrendingUp size={12} /> Latest Scan
              </p>
              <p className="text-sm text-muted-foreground">
                {latest.recordedAt && format(new Date(latest.recordedAt), "PPP")}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => {
                  setPreviewRecord(latest);
                  setEditable(recordToEditable(latest));
                }}
                data-testid="button-edit-latest-inbody"
              >
                Edit
              </Button>
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
          {!latest.aiExtracted && !hasMetrics(latest) && (
            <p className="text-xs text-amber-300/80 mt-4 inline-flex items-start gap-1.5">
              <AlertCircle size={12} className="mt-0.5" />
              We received your scan. Youssef will review and update your numbers shortly.
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
                    {r.weight ? `${r.weight}kg` : "—"} •{" "}
                    {r.bodyFat ? `${r.bodyFat}% BF` : "—"}
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

      {/* Preview & confirm dialog */}
      <Dialog
        open={!!previewRecord}
        onOpenChange={(v) => {
          if (!v) setPreviewRecord(null);
        }}
      >
        <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-lg">
          <DialogHeader>
            <DialogTitle>Confirm your InBody numbers</DialogTitle>
            <DialogDescription>
              {previewRecord?.aiExtracted
                ? "We extracted these values automatically. Review and adjust anything that doesn't match your scan."
                : "Edit your InBody values."}
            </DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <NumField label="Weight (kg)" value={editable.weight} onChange={(v) => setEditable({ ...editable, weight: v })} testId="input-inbody-weight" />
            <NumField label="Body Fat (%)" value={editable.bodyFat} onChange={(v) => setEditable({ ...editable, bodyFat: v })} testId="input-inbody-bodyFat" />
            <NumField label="Muscle Mass (kg)" value={editable.muscleMass} onChange={(v) => setEditable({ ...editable, muscleMass: v })} testId="input-inbody-muscleMass" />
            <NumField label="BMI" value={editable.bmi} onChange={(v) => setEditable({ ...editable, bmi: v })} testId="input-inbody-bmi" />
            <NumField label="Visceral Fat" value={editable.visceralFat} onChange={(v) => setEditable({ ...editable, visceralFat: v })} testId="input-inbody-visceralFat" />
            <NumField label="BMR (kcal)" value={editable.bmr} onChange={(v) => setEditable({ ...editable, bmr: v })} testId="input-inbody-bmr" />
            <NumField label="Body Water (L)" value={editable.water} onChange={(v) => setEditable({ ...editable, water: v })} testId="input-inbody-water" />
            <NumField label="Score" value={editable.score} onChange={(v) => setEditable({ ...editable, score: v })} testId="input-inbody-score" />
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setPreviewRecord(null)}
              data-testid="button-skip-inbody"
            >
              Skip for now
            </Button>
            <Button
              onClick={onConfirm}
              disabled={updateInbody.isPending}
              data-testid="button-save-inbody"
            >
              {updateInbody.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  testId,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  testId?: string;
}) {
  return (
    <label className="block">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        inputMode="decimal"
        className="bg-white/5 border-white/10 h-10 mt-1"
        data-testid={testId}
      />
    </label>
  );
}

function hasMetrics(r: InbodyRecord) {
  return r.weight || r.bodyFat || r.muscleMass || r.bmi;
}

function Metric({ label, value, unit }: { label: string; value: number | null; unit?: string }) {
  return (
    <div className="rounded-xl bg-background/40 border border-white/5 p-3">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="font-display font-bold text-lg mt-0.5">
        {value != null ? `${value}${unit ? ` ${unit}` : ""}` : "—"}
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
