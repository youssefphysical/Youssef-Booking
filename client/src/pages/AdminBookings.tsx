import { useMemo, useState } from "react";
import { format } from "date-fns";
import { motion } from "framer-motion";
import { Plus, Trash2, Filter, Loader2 } from "lucide-react";
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
import { ALL_TIME_SLOTS, formatStatus, statusColor } from "@/lib/booking-utils";
import type { BookingWithUser } from "@shared/schema";

const STATUSES = [
  "upcoming",
  "confirmed",
  "completed",
  "cancelled",
  "free_cancelled",
  "late_cancelled",
];

export default function AdminBookings() {
  const { data: rawBookings = [], isLoading } = useBookings({ includeUser: true });
  const updateMutation = useUpdateBooking();
  const deleteMutation = useDeleteBooking();
  const [filter, setFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");

  const bookings = rawBookings as BookingWithUser[];

  const filtered = useMemo(() => {
    return bookings.filter((b) => {
      if (filter !== "all" && b.status !== filter) return false;
      if (dateFilter && b.date !== dateFilter) return false;
      return true;
    });
  }, [bookings, filter, dateFilter]);

  return (
    <div className="md:pl-64 p-6 pt-20 md:pt-8 min-h-screen">
      <div className="flex items-start justify-between mb-8 gap-4 flex-wrap">
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">Bookings</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-bookings-title">
            All Bookings
          </h1>
        </div>
        <CreateBookingButton />
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6 p-4 rounded-2xl border border-white/5 bg-card/60">
        <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Filter size={14} /> Filter:
        </div>
        <Select value={filter} onValueChange={setFilter}>
          <SelectTrigger className="w-44 bg-white/5 border-white/10 h-9" data-testid="select-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
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
        {(filter !== "all" || dateFilter) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setFilter("all");
              setDateFilter("");
            }}
            data-testid="button-clear-filters"
          >
            Clear
          </Button>
        )}
        <span className="ml-auto text-xs text-muted-foreground">{filtered.length} results</span>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-muted-foreground">
          No bookings match your filters.
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
                    {format(new Date(b.date), "EEE, MMM d")} • {b.timeSlot}
                  </p>
                  {b.notes && <p className="text-xs text-muted-foreground/70 mt-1">{b.notes}</p>}
                </div>
                <span
                  className={`hidden sm:inline-block text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded-md border ${statusColor(b.status)}`}
                >
                  {formatStatus(b.status)}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Select
                  value={b.status}
                  onValueChange={(v) => updateMutation.mutate({ id: b.id, status: v as any, override: true })}
                >
                  <SelectTrigger
                    className="w-44 bg-white/5 border-white/10 h-9 text-xs"
                    data-testid={`select-status-${b.id}`}
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUSES.map((s) => (
                      <SelectItem key={s} value={s}>{formatStatus(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

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
                      <AlertDialogTitle>Delete booking?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This permanently removes the booking. Use cancel/late cancel statuses if you
                        want to keep a record.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep it</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(b.id)}
                        className="bg-red-500 hover:bg-red-600"
                        data-testid={`button-confirm-delete-${b.id}`}
                      >
                        Delete
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
  );
}

const rescheduleSchema = z.object({
  date: z.string().min(1),
  timeSlot: z.string().min(1),
});

function RescheduleButton({ booking }: { booking: BookingWithUser }) {
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
          Reschedule
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-white/10 sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle>Reschedule booking</DialogTitle>
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
                  <FormLabel>Date</FormLabel>
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
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-white/5 border-white/10" data-testid={`select-reschedule-time-${booking.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_TIME_SLOTS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={updateMutation.isPending} data-testid={`button-save-reschedule-${booking.id}`}>
                {updateMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
                Save
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
          <Plus size={16} className="mr-1.5" /> Add Booking
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-white/10 sm:rounded-3xl">
        <DialogHeader>
          <DialogTitle>Add a booking</DialogTitle>
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
                  <FormLabel>Client</FormLabel>
                  <FormControl>
                    <Select
                      value={field.value ? String(field.value) : ""}
                      onValueChange={(v) => field.onChange(Number(v))}
                    >
                      <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-add-client">
                        <SelectValue placeholder="Select a client" />
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
                  <FormLabel>Date</FormLabel>
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
                  <FormLabel>Time</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-white/5 border-white/10" data-testid="select-add-time">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_TIME_SLOTS.map((s) => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
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
                  <FormLabel>Notes</FormLabel>
                  <FormControl>
                    <Input {...field} className="bg-white/5 border-white/10" data-testid="input-add-notes" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={createMutation.isPending} data-testid="button-save-add">
                {createMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
                Add Booking
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
