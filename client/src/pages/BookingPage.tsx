import { useState, useMemo } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import {
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  Lock,
  CheckCircle2,
  ShieldAlert,
  Coffee,
  AlertTriangle,
  Users,
  Package as PackageIcon,
  Sparkles,
} from "lucide-react";
import { useCreateBooking, useBookings } from "@/hooks/use-bookings";
import { useBlockedSlots } from "@/hooks/use-blocked-slots";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { usePackages } from "@/hooks/use-packages";
import type { Package } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ALL_TIME_SLOTS, buildSessionDate } from "@/lib/booking-utils";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export default function BookingPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const createBooking = useCreateBooking();
  const { data: blocked = [] } = useBlockedSlots();
  const { data: settings } = useSettings();
  const { data: existing = [] } = useBookings({ from: format(new Date(), "yyyy-MM-dd") });
  const { data: packages = [] } = usePackages({ userId: user?.id });

  const isAdmin = user?.role === "admin";
  const activePackage = (packages as Package[]).find(
    (p) => p.isActive && p.usedSessions < p.totalSessions,
  );
  const sessionsLeft = activePackage
    ? activePackage.totalSessions - activePackage.usedSessions
    : 0;

  const dateStr = date ? format(date, "yyyy-MM-dd") : "";

  const wholeDayBlock = useMemo(() => {
    return blocked.find((b) => b.date === dateStr && b.timeSlot === null);
  }, [blocked, dateStr]);

  // Determine which slots are unavailable on the selected date
  const slotState = useMemo(() => {
    const map: Record<string, "available" | "blocked" | "taken" | "past"> = {};
    if (!date) return map;
    const wholeDayBlocked = blocked.some((b) => b.date === dateStr && b.timeSlot === null);
    for (const slot of ALL_TIME_SLOTS) {
      if (wholeDayBlocked) {
        map[slot] = "blocked";
        continue;
      }
      const slotBlocked = blocked.some((b) => b.date === dateStr && b.timeSlot === slot);
      if (slotBlocked) {
        map[slot] = "blocked";
        continue;
      }
      const taken = (existing as any[]).some(
        (b) =>
          b.date === dateStr &&
          b.timeSlot === slot &&
          !["cancelled", "free_cancelled", "late_cancelled"].includes(b.status),
      );
      if (taken) {
        map[slot] = "taken";
        continue;
      }
      const sessionAt = buildSessionDate(dateStr, slot);
      if (sessionAt.getTime() < Date.now()) {
        map[slot] = "past";
        continue;
      }
      map[slot] = "available";
    }
    return map;
  }, [date, dateStr, blocked, existing]);

  const handleBook = () => {
    if (!date || !selectedSlot || !user) {
      if (!user) navigate("/auth");
      return;
    }
    createBooking.mutate(
      {
        userId: user.id,
        date: dateStr,
        timeSlot: selectedSlot,
        notes: notes || undefined,
        acceptedPolicy: true,
        ...(isAdmin ? { override: true } : {}),
      } as any,
      {
        onSuccess: () => {
          setIsConfirmOpen(false);
          setSubmitted(true);
        },
      },
    );
  };

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-5 pt-32 pb-20 text-center">
        <div className="rounded-3xl border border-white/10 bg-card/80 p-8">
          <CalendarIcon size={32} className="text-primary mx-auto mb-3" />
          <h2 className="text-2xl font-display font-bold mb-2">Sign in to book</h2>
          <p className="text-muted-foreground text-sm mb-6">
            You need a client account to book a session with Youssef.
          </p>
          <Button
            onClick={() => navigate("/auth")}
            className="w-full h-12 rounded-xl"
            data-testid="button-go-auth"
          >
            Sign in or Create Account
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-5 pt-32 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-8"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2" data-testid="text-success-title">
            Booking submitted
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            Your booking request has been submitted. You can also confirm directly with Youssef on WhatsApp.
          </p>
          <div className="flex flex-col gap-3">
            <WhatsAppButton
              label="Confirm Booking on WhatsApp"
              message={`Hi Youssef, I just booked a session for ${dateStr} at ${selectedSlot}.`}
              size="lg"
              testId="button-confirm-whatsapp"
            />
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              data-testid="button-go-dashboard"
              className="h-12 rounded-xl"
            >
              View My Sessions
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-5 pt-24 pb-32">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-primary/15 rounded-2xl text-primary">
          <CalendarIcon size={22} />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">
            Book a Session
          </h1>
          <p className="text-muted-foreground text-sm">Choose a date and a free time slot</p>
        </div>
      </div>

      <div className="space-y-6">
        <div className="bg-card border border-white/5 rounded-3xl p-3 shadow-xl flex justify-center">
          <DayPicker
            mode="single"
            selected={date}
            onSelect={(d) => {
              setDate(d);
              setSelectedSlot(null);
            }}
            disabled={{ before: new Date() }}
            className="p-3"
            modifiersClassNames={{
              selected: "bg-primary text-primary-foreground font-bold rounded-full",
              today: "text-primary font-bold",
            }}
            styles={{
              head_cell: { color: "hsl(var(--muted-foreground))" },
              caption: { color: "hsl(var(--primary))" },
            }}
          />
        </div>

        {date && wholeDayBlock && <HolidayNotice block={wholeDayBlock} />}

        {date && !wholeDayBlock && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              Slots for {format(date, "EEEE, MMM d")}
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {ALL_TIME_SLOTS.map((slot) => {
                const state = slotState[slot] || "available";
                const isAvailable = state === "available";
                const selected = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    disabled={!isAvailable}
                    onClick={() => setSelectedSlot(slot)}
                    data-testid={`slot-${slot}`}
                    className={`relative h-12 rounded-xl text-sm font-semibold transition-all border ${
                      selected
                        ? "bg-primary text-black border-primary scale-[1.02] shadow-lg shadow-primary/20"
                        : isAvailable
                          ? "bg-white/5 border-white/10 hover:bg-white/10"
                          : "bg-white/[0.02] border-white/5 text-muted-foreground/40 cursor-not-allowed"
                    }`}
                  >
                    {slot}
                    {state === "taken" && (
                      <span className="absolute top-1 right-1 text-[9px] uppercase tracking-wider text-red-400/80">
                        Taken
                      </span>
                    )}
                    {state === "blocked" && (
                      <Lock size={10} className="absolute top-1 right-1 text-amber-400/80" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              Available hours: 06:00 – 22:00. Last session 22:00.
            </p>
          </motion.div>
        )}

        {selectedSlot && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <PackageBalance pkg={activePackage} sessionsLeft={sessionsLeft} isAdmin={!!isAdmin} />
            <div>
              <label className="text-sm font-semibold block mb-2">Notes (optional)</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Anything Youssef should know about this session?"
                className="bg-white/5 border-white/10"
                data-testid="input-booking-notes"
              />
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selectedSlot && date && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 px-5 pb-5 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent z-40"
          >
            <div className="max-w-3xl mx-auto">
              <Button
                onClick={() => setIsConfirmOpen(true)}
                data-testid="button-open-confirm"
                className="w-full h-14 text-base font-bold rounded-2xl shadow-2xl shadow-primary/20"
              >
                Continue • {format(date, "MMM d")} at {selectedSlot}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">Confirm your booking</DialogTitle>
            <DialogDescription>Please review and accept the policy below.</DialogDescription>
          </DialogHeader>

          <div className="bg-white/5 p-4 rounded-xl space-y-2 my-2">
            <Row label="Date" value={date && format(date, "PPPP")} />
            <Row label="Time" value={<span className="text-primary font-bold">{selectedSlot}</span>} />
            {notes && <Row label="Notes" value={notes} />}
          </div>

          <div className="flex gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs leading-relaxed">
            <ShieldAlert className="text-amber-400 shrink-0 mt-0.5" size={16} />
            <p className="text-amber-100/80">
              All cancellations or rescheduling requests must be made at least{" "}
              <span className="font-bold">{settings?.cancellationCutoffHours ?? 6} hours</span> before the scheduled session
              time. Within this window, the session will be counted as used and charged.
            </p>
          </div>

          <label className="flex items-start gap-3 mt-4 cursor-pointer">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              data-testid="checkbox-accept-policy"
              className="mt-0.5"
            />
            <span className="text-sm">I understand and accept the cancellation policy.</span>
          </label>

          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} data-testid="button-cancel-confirm">
              Cancel
            </Button>
            <Button
              onClick={handleBook}
              disabled={createBooking.isPending || !accepted}
              data-testid="button-confirm-booking"
            >
              {createBooking.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Confirm Booking
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function HolidayNotice({ block }: { block: { blockType?: string | null; reason?: string | null } }) {
  const cfg = {
    "off-day": {
      icon: <Coffee size={20} />,
      title: "Youssef Fitness is unavailable on this day",
      subtitle: "Please choose another available date.",
      colors: "border-sky-400/30 bg-sky-400/5 text-sky-100",
      iconBg: "bg-sky-400/15 text-sky-300",
    },
    emergency: {
      icon: <AlertTriangle size={20} />,
      title: "This day is currently unavailable",
      subtitle: "Due to an urgent schedule change, this day is currently unavailable. Please select another date.",
      colors: "border-red-500/30 bg-red-500/5 text-red-100",
      iconBg: "bg-red-500/15 text-red-300",
    },
    "fully-booked": {
      icon: <Users size={20} />,
      title: "Fully booked on this day",
      subtitle: "All slots are taken. Please choose another available date.",
      colors: "border-primary/30 bg-primary/5 text-primary/90",
      iconBg: "bg-primary/15 text-primary",
    },
  } as const;

  const type = (block.blockType || "off-day") as keyof typeof cfg;
  const c = cfg[type] || cfg["off-day"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border p-6 flex items-start gap-4 ${c.colors}`}
      data-testid={`holiday-notice-${type}`}
    >
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${c.iconBg}`}>
        {c.icon}
      </div>
      <div className="flex-1">
        <p className="font-display font-bold text-base">{c.title}</p>
        <p className="text-sm opacity-80 mt-0.5">{c.subtitle}</p>
        {block.reason && (
          <p className="text-xs opacity-60 italic mt-2">"{block.reason}"</p>
        )}
      </div>
    </motion.div>
  );
}

function PackageBalance({ pkg, sessionsLeft, isAdmin }: { pkg?: Package; sessionsLeft: number; isAdmin: boolean }) {
  if (isAdmin) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200/90 inline-flex items-center gap-2">
        <Sparkles size={13} /> Admin booking — package checks bypassed.
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
        <PackageIcon size={18} className="text-amber-400 shrink-0 mt-0.5" />
        <div className="text-xs text-amber-100/90">
          <p className="font-semibold mb-0.5">No active package</p>
          <p className="opacity-80">
            Your booking will still be submitted. Contact Youssef on WhatsApp to purchase a package and confirm your slot.
          </p>
        </div>
      </div>
    );
  }

  const lowBalance = sessionsLeft <= 2;
  return (
    <div
      className={`rounded-2xl border p-4 flex items-center gap-3 ${
        lowBalance
          ? "border-amber-500/30 bg-amber-500/5"
          : "border-primary/20 bg-primary/5"
      }`}
      data-testid="package-balance"
    >
      <PackageIcon size={18} className={lowBalance ? "text-amber-400" : "text-primary"} />
      <div className="text-xs flex-1">
        <p className="font-semibold">
          {sessionsLeft} session{sessionsLeft === 1 ? "" : "s"} remaining
        </p>
        <p className="text-muted-foreground">
          From your active package. This session will be deducted when marked completed.
        </p>
      </div>
    </div>
  );
}
