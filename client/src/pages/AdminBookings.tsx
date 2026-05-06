import { useMemo, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Plus, Trash2, Filter, Loader2, Notebook, Wallet } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  useBookings,
  useUpdateBooking,
  useDeleteBooking,
  useCreateBooking,
} from "@/hooks/use-bookings";
import { useClients } from "@/hooks/use-clients";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  PAYMENT_STATUS_LABELS,
  WORKOUT_CATEGORY_LABELS,
  SESSION_TYPE_LABELS,
} from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ALL_TIME_SLOTS, translateStatus, statusColor } from "@/lib/booking-utils";
import { formatTime12 } from "@/lib/time-format";
import type { BookingWithUser } from "@shared/schema";
import { useTranslation } from "@/i18n";

const STATUSES = [
  "upcoming",
  "confirmed",
  "completed",
  "cancelled",
  "free_cancelled",
  "late_cancelled",
  "emergency_cancelled",
];

const PAYMENT_BADGE: Record<string, string> = {
  paid: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  unpaid: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  pending: "bg-blue-500/10 text-blue-300 border-blue-500/20",
  direct_payment_requested: "bg-violet-500/10 text-violet-300 border-violet-500/20",
  free: "bg-white/5 text-muted-foreground border-white/10",
};

export default function AdminBookings() {
  const { t } = useTranslation();
  const { data: rawBookings = [], isLoading } = useBookings({ includeUser: true });
  const updateMutation = useUpdateBooking();
  const deleteMutation = useDeleteBooking();
  const [filter, setFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [workoutFilter, setWorkoutFilter] = useState<string>("all");

  const bookings = rawBookings as BookingWithUser[];

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (filter !== "all" && b.status !== filter) return false;
      if (dateFilter && b.date !== dateFilter) return false;
      if (paymentFilter !== "all" && (b.paymentStatus || "unpaid") !== paymentFilter) return false;
      if (workoutFilter !== "all") {
        if (workoutFilter === "none" && b.workoutCategory) return false;
        if (workoutFilter !== "none" && b.workoutCategory !== workoutFilter) return false;
      }
      return true;
    });
  }, [bookings, filter, dateFilter, paymentFilter, workoutFilter]);

  return (
    <div className="admin-shell">
      <div className="admin-container">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">{t("admin.bookings.kicker")}</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-bookings-title">
            {t("admin.bookings.titleAll")}
          </h1>
        </div>
        <CreateBookingButton />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-2xl border border-white/5 bg-card/60">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Filter size={14} /> {t("admin.bookings.filterLabel")}
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 bg-white/5 border-white/10 h-9" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.bookings.allStatuses")}</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{translateStatus(s, t)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-44 bg-white/5 border-white/10 h-9"
          data-testid="input-date-filter"
        />
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-44 bg-white/5 border-white/10 h-9" data-testid="select-payment-filter">
            <SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.bookings.allPayments")}</SelectItem>
            {Object.entries(PAYMENT_STATUS_LABELS).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={workoutFilter} onValueChange={setWorkoutFilter}>
          <SelectTrigger className="w-44 bg-white/5 border-white/10 h-9" data-testid="select-workout-filter">
            <SelectValue placeholder="Workout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("admin.bookings.allWorkouts")}</SelectItem>
            <SelectItem value="none">{t("admin.bookings.notLogged")}</SelectItem>
            {Object.entries(WORKOUT_CATEGORY_LABELS).map(([k, l]) => (
              <SelectItem key={k} value={k}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(filter !== "all" || dateFilter || paymentFilter !== "all" || workoutFilter !== "all") && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilter("all");
              setDateFilter("");
              setPaymentFilter("all");
              setWorkoutFilter("all");
            }}
            data-testid="button-clear-filters"
          >
            {t("admin.bookings.clear")}
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">
          {t("admin.bookings.results").replace("{n}", String(filtered.length))}
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-muted-foreground">
          {t("admin.bookings.noMatch")}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((b) => (
            <motion.div
              key={b.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-white/5 bg-card/60 p-4 flex flex-col sm:flex-row sm:items-center gap-3"
              data-testid={`admin-booking-${b.id}`}
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="w-14 h-14 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary shrink-0">
                  <span className="text-[10px] uppercase font-bold">
                    {format(new Date(b.date), "MMM")}
                  </span>
                  <span className="text-lg font-display font-bold leading-none">
                    {format(new Date(b.date), "d")}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold truncate" data-testid={`booking-client-${b.id}`}>
                    {b.user?.fullName || `User #${b.userId}`}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(b.date), "EEE, MMM d")} • {formatTime12(b.timeSlot)}
                    {b.sessionType && (
                      <span className="ml-2 text-[10px] uppercase tracking-wider text-primary/70">
                        {SESSION_TYPE_LABELS[b.sessionType as keyof typeof SESSION_TYPE_LABELS] || b.sessionType}
                      </span>
                    )}
                  </p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span
                      className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${statusColor(b.status)}`}
                    >
                      {translateStatus(b.status, t)}
                    </span>
                    <span
                      className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${PAYMENT_BADGE[b.paymentStatus || "unpaid"] || PAYMENT_BADGE.unpaid}`}
                      data-testid={`payment-badge-${b.id}`}
                    >
                      {PAYMENT_STATUS_LABELS[(b.paymentStatus || "unpaid") as keyof typeof PAYMENT_STATUS_LABELS] || b.paymentStatus}
                    </span>
                    {b.workoutCategory && (
                      <span
                        className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-violet-500/20 bg-violet-500/10 text-violet-300"
                        data-testid={`workout-badge-${b.id}`}
                      >
                        {WORKOUT_CATEGORY_LABELS[b.workoutCategory as keyof typeof WORKOUT_CATEGORY_LABELS] || b.workoutCategory}
                      </span>
                    )}
                    {b.isEmergencyCancel && (
                      <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300">
                        {t("admin.bookings.emergency")}
                      </span>
                    )}
                  </div>
                  {b.notes && <p className="text-xs text-muted-foreground/70 mt-1">{b.notes}</p>}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={b.status}
                  onValueChange={(v) => updateMutation.mutate({ id: b.id, status: v as any, override: true })}
                >
                  <SelectTrigger
                    className="w-40 bg-white/5 border-white/10 h-9 text-xs"
                    data-testid={`select-status-${b.id}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{translateStatus(s, t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  value={b.paymentStatus || "unpaid"}
                  onValueChange={(v) =>
                    updateMutation.mutate({ id: b.id, paymentStatus: v as any, override: true } as any)
                  }
                >
                  <SelectTrigger
                    className="w-40 bg-white/5 border-white/10 h-9 text-xs"
                    data-testid={`select-payment-${b.id}`}
                  >
                    <Wallet size={12} className="mr-1" />
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([k, l]) => (
                      <SelectItem key={k} value={k}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <WorkoutLogButton booking={b} />

                <RescheduleButton booking={b} />

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-9 w-9"
                      data-testid={`button-delete-${b.id}`}
                    >
                      <Trash2 size={14} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-card border-white/10">
                    <AlertDialogHeader>
                      <AlertDialogTitle>{t("admin.bookings.deleteTitle")}</AlertDialogTitle>
                      <AlertDialogDescription>
                        {t(
                          "admin.bookings.deleteDesc",
                          "This permanently removes the booking. Use cancel/late cancel statuses if you want to keep a record.",
                        )}
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>{t("admin.bookings.keepIt")}</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(b.id)}
                        className="bg-red-500 hover:bg-red-600"
                        data-testid={`button-confirm-delete-${b.id}`}
                      >
                        {t("admin.bookings.deleteBtn")}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </motion.div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

const workoutLogSchema = z.object({
  workoutCategory: z.string().optional(),
  adminNotes: z.string().optional(),
});

function WorkoutLogButton({ booking }: { booking: BookingWithUser }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const updateMutation = useUpdateBooking();

  const form = useForm<z.infer<typeof workoutLogSchema>>({
    resolver: zodResolver(workoutLogSchema),
    defaultValues: {
      workoutCategory: booking.workoutCategory || "",
      adminNotes: booking.adminNotes || "",
    },
  });

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) {
          form.reset({
            workoutCategory: booking.workoutCategory || "",
            adminNotes: booking.adminNotes || "",
          });
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-9 text-xs"
          data-testid={`button-workout-log-${booking.id}`}
        >
          <Notebook size={12} className="mr-1.5" />
          {t("admin.bookings.workoutLog")}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-white/10 sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle>{t("admin.bookings.workoutLogTitle")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) =>
              updateMutation.mutate(
                {
                  id: booking.id,
                  workoutCategory: data.workoutCategory || null,
                  adminNotes: data.adminNotes || null,
                  override: true,
                } as any,
                { onSuccess: () => setOpen(false) },
              ),
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="workoutCategory"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.bookings.workoutCategory")}</FormLabel>
                  <Select value={field.value || ""} onValueChange={field.onChange}>
                    <SelectTrigger
                      className="bg-white/5 border-white/10"
                      data-testid={`select-workout-category-${booking.id}`}
                    >
                      <SelectValue placeholder={t("admin.bookings.pickCategory")} />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(WORKOUT_CATEGORY_LABELS).map(([k, l]) => (
                        <SelectItem key={k} value={k}>{l}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="adminNotes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.bookings.adminNotes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={4}
                      placeholder={t("admin.bookings.adminNotesPh")}
                      className="bg-white/5 border-white/10"
                      data-testid={`input-admin-notes-${booking.id}`}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {booking.clientNotes && (
              <div className="rounded-xl bg-white/5 border border-white/10 p-3 text-xs">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                  {t("admin.bookings.clientNotesLabel")}
                </p>
                <p className="text-foreground/90 whitespace-pre-wrap">{booking.clientNotes}</p>
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("admin.bookings.cancel")}</Button>
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                data-testid={`button-save-workout-log-${booking.id}`}
              >
                {updateMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
                {t("admin.bookings.saveLog")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const rescheduleSchema = z.object({
  date: z.string().min(1),
  timeSlot: z.string().min(1),
});

function RescheduleButton({ booking }: { booking: BookingWithUser }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const updateMutation = useUpdateBooking();

  const form = useForm<z.infer<typeof rescheduleSchema>>({
    resolver: zodResolver(rescheduleSchema),
    defaultValues: { date: booking.date, timeSlot: booking.timeSlot },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 text-xs" data-testid={`button-reschedule-${booking.id}`}>
          {t("admin.bookings.reschedule")}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-white/10 sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle>{t("admin.bookings.rescheduleTitle")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) =>
              updateMutation.mutate(
                { id: booking.id, ...data, override: true },
                { onSuccess: () => setOpen(false) },
              ),
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.bookings.date")}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} className="bg-white/5 border-white/10" data-testid={`input-reschedule-date-${booking.id}`} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeSlot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.bookings.time")}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-white/5 border-white/10" data-testid={`select-reschedule-time-${booking.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_TIME_SLOTS.map((s) => (
                          <SelectItem key={s} value={s}>{formatTime12(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("admin.bookings.cancel")}</Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid={`button-save-reschedule-${booking.id}`}>
                {updateMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
                {t("admin.bookings.save")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

const createSchema = z.object({
  userId: z.coerce.number().int().positive("Select a client"),
  date: z.string().min(1, "Pick a date"),
  timeSlot: z.string().min(1, "Pick a time"),
  notes: z.string().optional(),
});

function CreateBookingButton() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { data: clients = [] } = useClients();
  const createMutation = useCreateBooking();

  const form = useForm<z.infer<typeof createSchema>>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      userId: 0 as any,
      date: new Date().toISOString().slice(0, 10),
      timeSlot: "10:00",
      notes: "",
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-10 rounded-xl" data-testid="button-add-booking">
          <Plus size={16} className="mr-1.5" /> {t("admin.bookings.add")}
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-white/10 sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle>{t("admin.bookings.addTitle")}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((data) =>
              createMutation.mutate(
                { ...data, acceptedPolicy: true } as any,
                {
                  onSuccess: () => {
                    setOpen(false);
                    form.reset();
                  },
                },
              ),
            )}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="userId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.bookings.client")}</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-add-client">
                        <SelectValue placeholder={t("admin.bookings.selectClient")} />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.fullName} ({c.phone || c.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="date"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.bookings.date")}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} className="bg-white/5 border-white/10" data-testid="input-add-date" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="timeSlot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.bookings.time")}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-add-time">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_TIME_SLOTS.map((s) => (
                          <SelectItem key={s} value={s}>{formatTime12(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.bookings.notes")}</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-white/5 border-white/10" data-testid="input-add-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>{t("admin.bookings.cancel")}</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-add">
                {createMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
                {t("admin.bookings.add")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
