import { useMemo, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Link } from "wouter";
import { Calendar, Plus, Lock, X, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useBookings, useCancelBooking } from "@/hooks/use-bookings";
import { useSettings } from "@/hooks/use-settings";
import { Button } from "@/components/ui/button";
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
import { WhatsAppButton } from "@/components/WhatsAppButton";
import {
  formatStatus,
  statusColor,
  hoursUntil,
  isCancellable,
} from "@/lib/booking-utils";
import type { Booking } from "@shared/schema";

export default function ClientDashboard() {
  const { user } = useAuth();
  const { data: bookings = [], isLoading } = useBookings({ userId: user?.id });
  const { data: settings } = useSettings();
  const cutoff = settings?.cancellationCutoffHours ?? 6;

  const { upcoming, past } = useMemo(() => {
    const now = new Date();
    const list = bookings as Booking[];
    const up = list.filter((b) => {
      const sd = new Date(`${b.date}T${b.timeSlot}:00`);
      return ["upcoming", "confirmed"].includes(b.status) && sd.getTime() >= now.getTime() - 60 * 60 * 1000;
    }).sort((a, b) => `${a.date}T${a.timeSlot}`.localeCompare(`${b.date}T${b.timeSlot}`));
    const ps = list.filter((b) => !up.includes(b))
      .sort((a, b) => `${b.date}T${b.timeSlot}`.localeCompare(`${a.date}T${a.timeSlot}`));
    return { upcoming: up, past: ps };
  }, [bookings]);

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-5 pt-24 pb-20">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">My Sessions</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-greeting">
            Hello, {user.fullName.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your training schedule</p>
        </div>
        <Link href="/book" data-testid="link-new-booking">
          <Button className="h-11 rounded-xl">
            <Plus size={16} className="mr-1.5" /> New Booking
          </Button>
        </Link>
      </div>

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
        {isLoading
          ? <SkeletonCards />
          : upcoming.map((b) => (
              <BookingCard key={b.id} booking={b} cutoff={cutoff} canCancel />
            ))}
      </Section>

      <Section title="Past sessions" count={past.length} empty={<EmptyState title="No past sessions yet" />}>
        {past.map((b) => (
          <BookingCard key={b.id} booking={b} cutoff={cutoff} />
        ))}
      </Section>
    </div>
  );
}

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

function BookingCard({
  booking,
  cutoff,
  canCancel,
}: {
  booking: Booking;
  cutoff: number;
  canCancel?: boolean;
}) {
  const cancelMutation = useCancelBooking();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const cancellable = canCancel && isCancellable(booking.date, booking.timeSlot, cutoff);
  const hours = Math.round(hoursUntil(booking.date, booking.timeSlot));

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
            {booking.timeSlot} • Session
          </p>
          <span
            className={`inline-block mt-1.5 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${statusColor(
              booking.status,
            )}`}
            data-testid={`status-${booking.id}`}
          >
            {formatStatus(booking.status)}
          </span>
        </div>
      </div>

      {canCancel && (
        <div className="flex items-center gap-2">
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
            <div className="text-xs text-amber-300/80 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <Lock size={12} /> Locked ({hours <= 0 ? "started" : `${hours}h left`})
            </div>
          )}
        </div>
      )}

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="bg-card border-white/10 sm:rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel this session?</AlertDialogTitle>
            <AlertDialogDescription>
              {format(new Date(booking.date), "PPPP")} at {booking.timeSlot}. Since you're cancelling
              more than {cutoff} hours in advance, this won't be charged.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-keep-booking">Keep it</AlertDialogCancel>
            <AlertDialogAction
              data-testid="button-confirm-cancel"
              onClick={() => cancelMutation.mutate(booking.id, { onSuccess: () => setConfirmOpen(false) })}
              className="bg-red-500 hover:bg-red-600"
            >
              Yes, cancel
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
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
    <>
      {[1, 2].map((i) => (
        <div key={i} className="h-24 rounded-2xl bg-white/5 animate-pulse" />
      ))}
    </>
  );
}

// Locked notice (kept here in case we want to show it elsewhere)
export function CancellationLockedNotice({ cutoff }: { cutoff: number }) {
  return (
    <div className="text-xs flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-200/80">
      <AlertCircle size={14} className="mt-0.5 shrink-0" />
      <p>
        Cancellations are locked within {cutoff} hours of the session. Contact Youssef on WhatsApp for
        emergencies.
      </p>
    </div>
  );
}

// Re-export for use elsewhere if needed
export { WhatsAppButton };
