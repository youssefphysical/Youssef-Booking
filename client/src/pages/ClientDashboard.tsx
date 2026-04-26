import { useMemo, useRef, useState } from "react";
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
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useBookings, useCancelBooking } from "@/hooks/use-bookings";
import { useSettings } from "@/hooks/use-settings";
import { usePackages } from "@/hooks/use-packages";
import { useInbodyRecords, useUploadInbody } from "@/hooks/use-inbody";
import { useProgressPhotos, useUploadProgressPhoto } from "@/hooks/use-progress";
import { Button } from "@/components/ui/button";
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
import { WhatsAppButton } from "@/components/WhatsAppButton";
import {
  formatStatus,
  statusColor,
  hoursUntil,
  isCancellable,
} from "@/lib/booking-utils";
import { PACKAGE_DEFINITIONS, type Booking, type Package, type InbodyRecord, type ProgressPhoto } from "@shared/schema";

export default function ClientDashboard() {
  const { user } = useAuth();
  if (!user) return null;

  return (
    <div className="max-w-5xl mx-auto px-5 pt-24 pb-20">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">My Training</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-greeting">
            Hello, {user.fullName.split(" ")[0]}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage your sessions, packages and progress</p>
        </div>
        <Link href="/book" data-testid="link-new-booking">
          <Button className="h-11 rounded-xl">
            <Plus size={16} className="mr-1.5" /> New Booking
          </Button>
        </Link>
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

// =============== BOOKINGS TAB ===============

function BookingsTab({ userId }: { userId: number }) {
  const { data: bookings = [], isLoading } = useBookings({ userId });
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
        {isLoading
          ? <SkeletonCards />
          : upcoming.map((b) => (
              <BookingCard key={b.id} booking={b} cutoff={cutoff} canCancel />
            ))}
      </Section>

      <Section title="Past sessions" count={past.length} empty={<EmptyState title="No past sessions yet" />}>
        {past.slice(0, 25).map((b) => (
          <BookingCard key={b.id} booking={b} cutoff={cutoff} />
        ))}
      </Section>
    </>
  );
}

function BookingCard({ booking, cutoff, canCancel }: { booking: Booking; cutoff: number; canCancel?: boolean }) {
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
          <span className="text-[10px] uppercase font-bold">{format(new Date(booking.date), "MMM")}</span>
          <span className="text-xl font-display font-bold leading-none">{format(new Date(booking.date), "d")}</span>
        </div>
        <div className="min-w-0">
          <p className="font-semibold">{format(new Date(booking.date), "EEEE")}</p>
          <p className="text-sm text-muted-foreground">{booking.timeSlot} • Session</p>
          <span
            className={`inline-block mt-1.5 text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${statusColor(booking.status)}`}
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
            Contact Youssef on WhatsApp to purchase a session package. Available: 10, 20, 25 sessions, or Duo Package (30 sessions).
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
                  <span className="text-base text-muted-foreground font-normal"> / {p.totalSessions}</span>
                </p>
                <p className="text-xs text-muted-foreground mt-1">sessions remaining</p>
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

function InbodyTab({ userId }: { userId: number }) {
  const { data: records = [], isLoading } = useInbodyRecords({ userId });
  const upload = useUploadInbody();
  const fileRef = useRef<HTMLInputElement>(null);

  const list = records as InbodyRecord[];
  const sorted = [...list].sort(
    (a, b) => new Date(b.recordedAt || 0).getTime() - new Date(a.recordedAt || 0).getTime(),
  );
  const latest = sorted[0];

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) upload.mutate({ file });
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-display font-bold">Body Composition History</h2>
          <p className="text-xs text-muted-foreground">Upload InBody scans to track your progress</p>
        </div>
        <Button
          onClick={() => fileRef.current?.click()}
          className="rounded-xl"
          disabled={upload.isPending}
          data-testid="button-upload-inbody"
        >
          {upload.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Upload size={14} className="mr-1.5" />}
          Upload Scan
        </Button>
        <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={onFile} />
      </div>

      {isLoading && <SkeletonCards />}

      {!isLoading && list.length === 0 && (
        <EmptyState title="No InBody scans yet" />
      )}

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
                    {r.weight ? `${r.weight}kg` : "—"} • {r.bodyFat ? `${r.bodyFat}% BF` : "—"}
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
          {upload.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Upload size={14} className="mr-1.5" />}
          Add Photo
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onFile} />
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
