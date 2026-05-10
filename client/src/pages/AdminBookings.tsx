import { useMemo, useState } from "react";
import {
  format,
  startOfWeek,
  addDays,
  isToday,
  startOfDay,
  endOfDay,
  subDays,
  differenceInCalendarDays,
} from "date-fns";
import { motion } from "framer-motion";
import {
  Plus,
  Trash2,
  Loader2,
  Notebook,
  Wallet,
  ChevronLeft,
  ChevronRight,
  Search,
  CalendarDays,
  Clock,
  CheckCircle2,
  TrendingUp,
} from "lucide-react";
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
import { ALL_TIME_SLOTS, translateStatus, statusColor, paymentColor } from "@/lib/booking-utils";
import { formatTime12 } from "@/lib/time-format";
import type { BookingWithUser } from "@shared/schema";
import { useTranslation } from "@/i18n";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminEmptyState,
} from "@/components/admin/primitives";
import { cn } from "@/lib/utils";

const STATUSES = [
  "upcoming",
  "confirmed",
  "completed",
  "cancelled",
  "free_cancelled",
  "late_cancelled",
  "emergency_cancelled",
];

// Payment chip colors are now sourced from `paymentColor()` in
// booking-utils so admin bookings, client dashboard and any future
// list render an identical visual language. Local PAYMENT_BADGE map
// removed in the May 2026 polish pass.

// Parse a YYYY-MM-DD booking date as a LOCAL calendar day (avoids the UTC
// shift that `new Date("2026-05-08")` introduces in negative-UTC zones).
function parseBookingDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
const toIsoDate = (d: Date) => format(d, "yyyy-MM-dd");

const NON_CANCELLED_STATUSES = new Set(["upcoming", "confirmed", "completed"]);

export default function AdminBookings() {
  const { t } = useTranslation();
  const { data: rawBookings = [], isLoading } = useBookings({ includeUser: true });
  const updateMutation = useUpdateBooking();
  const deleteMutation = useDeleteBooking();
  const [filter, setFilter] = useState<string>("all");
  const [dateFilter, setDateFilter] = useState<string>("");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [workoutFilter, setWorkoutFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [weekAnchor, setWeekAnchor] = useState<Date>(() => startOfWeek(new Date(), { weekStartsOn: 1 }));

  const bookings = rawBookings as BookingWithUser[];

  // ---------- Premium KPIs ----------
  const stats = useMemo(() => {
    const now = new Date();
    const todayIso = toIsoDate(now);
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);
    const last30Start = startOfDay(subDays(now, 30));

    let today = 0;
    let week = 0;
    let upcoming = 0;
    let completed30 = 0;
    let scheduled30 = 0; // completed + no-shows + late cancels in last 30d
    for (const b of bookings) {
      const d = parseBookingDate(b.date);
      if (b.date === todayIso && NON_CANCELLED_STATUSES.has(b.status)) today += 1;
      if (d >= weekStart && d <= endOfDay(weekEnd) && NON_CANCELLED_STATUSES.has(b.status)) week += 1;
      if (d >= startOfDay(now) && (b.status === "upcoming" || b.status === "confirmed")) upcoming += 1;
      if (d >= last30Start && d <= now) {
        if (b.status === "completed") {
          completed30 += 1;
          scheduled30 += 1;
        } else if (b.status === "late_cancelled" || b.status === "emergency_cancelled") {
          scheduled30 += 1;
        }
      }
    }
    const completionRate = scheduled30 > 0 ? completed30 / scheduled30 : 0;
    return { today, week, upcoming, completed30, completionRate };
  }, [bookings]);

  // ---------- Density per day for the calendar strip ----------
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekAnchor, i)),
    [weekAnchor],
  );
  const densityByIso = useMemo(() => {
    const map = new Map<string, number>();
    for (const b of bookings) {
      if (!NON_CANCELLED_STATUSES.has(b.status)) continue;
      map.set(b.date, (map.get(b.date) || 0) + 1);
    }
    return map;
  }, [bookings]);

  // ---------- Filtering ----------
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return bookings.filter((b) => {
      if (filter !== "all" && b.status !== filter) return false;
      if (dateFilter && b.date !== dateFilter) return false;
      if (paymentFilter !== "all" && (b.paymentStatus || "unpaid") !== paymentFilter) return false;
      if (workoutFilter !== "all") {
        if (workoutFilter === "none" && b.workoutCategory) return false;
        if (workoutFilter !== "none" && b.workoutCategory !== workoutFilter) return false;
      }
      if (q) {
        const name = (b.user?.fullName || "").toLowerCase();
        const email = (b.user?.email || "").toLowerCase();
        const notes = (b.notes || "").toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !notes.includes(q)) return false;
      }
      return true;
    });
  }, [bookings, filter, dateFilter, paymentFilter, workoutFilter, search]);

  // Group filtered list by date (chronological asc) for sticky day headers.
  const grouped = useMemo(() => {
    const m = new Map<string, BookingWithUser[]>();
    for (const b of filtered) {
      const arr = m.get(b.date) || [];
      arr.push(b);
      m.set(b.date, arr);
    }
    // Sort each day by timeSlot asc, then sort dates asc
    const sortedDates = Array.from(m.keys()).sort();
    return sortedDates.map((date) => ({
      date,
      items: (m.get(date) || []).sort((a, b) => a.timeSlot.localeCompare(b.timeSlot)),
    }));
  }, [filtered]);

  const hasActiveFilters =
    filter !== "all" || !!dateFilter || paymentFilter !== "all" || workoutFilter !== "all" || !!search;

  const clearAll = () => {
    setFilter("all");
    setDateFilter("");
    setPaymentFilter("all");
    setWorkoutFilter("all");
    setSearch("");
  };

  return (
    <div className="admin-shell">
      <div className="admin-container space-y-5">
        <AdminPageHeader
          eyebrow={t("admin.bookings.kicker")}
          title={t("admin.bookings.titleAll")}
          subtitle={t(
            "admin.bookings.subtitle",
            "Schedule, track and manage every session.",
          )}
          right={<CreateBookingButton />}
          testId="text-bookings-title"
        />

        {/* ---------- KPI strip ---------- */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <AdminStatCard
            icon={<Clock size={16} />}
            label={t("admin.bookings.kpi.today", "Sessions today")}
            value={stats.today}
            tone="schedule"
            animate
            testId="stat-bookings-today"
          />
          <AdminStatCard
            icon={<CalendarDays size={16} />}
            label={t("admin.bookings.kpi.thisWeek", "This week")}
            value={stats.week}
            tone="info"
            animate
            testId="stat-bookings-week"
          />
          <AdminStatCard
            icon={<TrendingUp size={16} />}
            label={t("admin.bookings.kpi.upcoming", "Upcoming")}
            value={stats.upcoming}
            tone="default"
            animate
            testId="stat-bookings-upcoming"
          />
          <AdminStatCard
            icon={<CheckCircle2 size={16} />}
            label={t("admin.bookings.kpi.completion", "Completion 30d")}
            value={stats.completionRate}
            format="percent"
            tone="success"
            animate
            testId="stat-bookings-completion"
          />
        </div>

        {/* ---------- Calendar week strip ---------- */}
        <CalendarWeekStrip
          weekAnchor={weekAnchor}
          weekDays={weekDays}
          densityByIso={densityByIso}
          dateFilter={dateFilter}
          onPickDay={(iso) => setDateFilter(dateFilter === iso ? "" : iso)}
          onPrev={() => setWeekAnchor((d) => addDays(d, -7))}
          onNext={() => setWeekAnchor((d) => addDays(d, 7))}
          onToday={() => {
            const today = new Date();
            setWeekAnchor(startOfWeek(today, { weekStartsOn: 1 }));
            setDateFilter(toIsoDate(today));
          }}
          t={t}
        />

        {/* ---------- Filter bar ---------- */}
        <AdminCard padded={false} className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
              />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t(
                  "admin.bookings.searchPh",
                  "Search client, email, notes…",
                )}
                className="ps-9 h-9 bg-white/5 border-white/10"
                data-testid="input-bookings-search"
              />
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger
                className="w-[150px] bg-white/5 border-white/10 h-9 text-xs"
                data-testid="select-status-filter"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.bookings.allStatuses")}</SelectItem>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {translateStatus(s, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger
                className="w-[150px] bg-white/5 border-white/10 h-9 text-xs"
                data-testid="select-payment-filter"
              >
                <SelectValue placeholder={t("admin.bookings.filterPayment", "Payment")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.bookings.allPayments")}</SelectItem>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={workoutFilter} onValueChange={setWorkoutFilter}>
              <SelectTrigger
                className="w-[150px] bg-white/5 border-white/10 h-9 text-xs"
                data-testid="select-workout-filter"
              >
                <SelectValue placeholder={t("admin.bookings.filterWorkout", "Workout")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.bookings.allWorkouts")}</SelectItem>
                <SelectItem value="none">{t("admin.bookings.notLogged")}</SelectItem>
                {Object.entries(WORKOUT_CATEGORY_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                data-testid="button-clear-filters"
                className="h-9"
              >
                {t("admin.bookings.clear")}
              </Button>
            )}
            <span className="ms-auto text-[11px] sm:text-xs text-muted-foreground tabular-nums">
              {t("admin.bookings.results").replace("{n}", String(filtered.length))}
            </span>
          </div>
        </AdminCard>

        {/* ---------- Day-grouped list ---------- */}
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-2xl admin-shimmer" />
            ))}
          </div>
        ) : grouped.length === 0 ? (
          <AdminEmptyState
            icon={<CalendarDays size={28} />}
            title={t("admin.bookings.noMatch")}
            body={
              hasActiveFilters
                ? t(
                    "admin.bookings.noMatchHint",
                    "Try clearing filters or pick a different week.",
                  )
                : undefined
            }
          />
        ) : (
          <div className="space-y-5">
            {grouped.map((g) => (
              <DaySection
                key={g.date}
                isoDate={g.date}
                items={g.items}
                updateMutation={updateMutation}
                deleteMutation={deleteMutation}
                t={t}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// CALENDAR WEEK STRIP — premium 7-day picker with density dots
// ============================================================
function CalendarWeekStrip({
  weekAnchor,
  weekDays,
  densityByIso,
  dateFilter,
  onPickDay,
  onPrev,
  onNext,
  onToday,
  t,
}: {
  weekAnchor: Date;
  weekDays: Date[];
  densityByIso: Map<string, number>;
  dateFilter: string;
  onPickDay: (iso: string) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  t: (k: string, fb?: string) => string;
}) {
  const rangeLabel = useMemo(() => {
    const last = weekDays[weekDays.length - 1];
    const sameMonth = format(weekAnchor, "MMM") === format(last, "MMM");
    return sameMonth
      ? `${format(weekAnchor, "MMM d")} – ${format(last, "d, yyyy")}`
      : `${format(weekAnchor, "MMM d")} – ${format(last, "MMM d, yyyy")}`;
  }, [weekAnchor, weekDays]);

  const todayInThisWeek = weekDays.some((d) => isToday(d));

  return (
    <AdminCard className="!p-3 sm:!p-4" padded={false}>
      <div className="flex items-center justify-between gap-3 mb-2 sm:mb-3 px-1">
        <div className="min-w-0 flex items-center gap-2">
          <span className="text-[10px] sm:text-[11px] uppercase tracking-[0.18em] text-muted-foreground/80">
            {t("admin.bookings.weekOf", "Week of")}
          </span>
          <span
            className="font-display font-semibold text-sm sm:text-base truncate"
            data-testid="text-week-range"
          >
            {rangeLabel}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onPrev}
            className="h-8 w-8"
            data-testid="button-week-prev"
            aria-label={t("admin.bookings.prevWeek", "Previous week")}
          >
            <ChevronLeft size={16} className="rtl:rotate-180" />
          </Button>
          {!todayInThisWeek && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onToday}
              className="h-8 px-2 text-xs"
              data-testid="button-week-today"
            >
              {t("admin.bookings.today", "Today")}
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onNext}
            className="h-8 w-8"
            data-testid="button-week-next"
            aria-label={t("admin.bookings.nextWeek", "Next week")}
          >
            <ChevronRight size={16} className="rtl:rotate-180" />
          </Button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {weekDays.map((d) => {
          const iso = toIsoDate(d);
          const count = densityByIso.get(iso) || 0;
          const selected = dateFilter === iso;
          const today = isToday(d);
          return (
            <button
              key={iso}
              type="button"
              onClick={() => onPickDay(iso)}
              data-testid={`day-${iso}`}
              aria-pressed={selected}
              className={cn(
                "group relative flex flex-col items-center gap-1 rounded-xl border px-1.5 py-2 sm:py-3 transition-all duration-150 min-h-[68px] sm:min-h-[80px] focus:outline-none focus:ring-2 focus:ring-primary/40",
                selected
                  ? "bg-primary/15 border-primary/50 text-primary shadow-sm shadow-primary/20"
                  : today
                    ? "bg-white/[0.04] border-primary/30 text-foreground hover:bg-white/[0.06]"
                    : "bg-white/[0.02] border-white/[0.06] text-muted-foreground hover:bg-white/[0.05] hover:text-foreground",
              )}
            >
              <span className="text-[9px] sm:text-[10px] uppercase tracking-wider font-semibold opacity-80">
                {format(d, "EEE")}
              </span>
              <span
                className={cn(
                  "text-base sm:text-lg font-display font-bold leading-none tabular-nums",
                  selected || today ? "" : "text-foreground/90",
                )}
              >
                {format(d, "d")}
              </span>
              {count > 0 ? (
                <span
                  className={cn(
                    "text-[9px] sm:text-[10px] font-semibold rounded-full px-1.5 py-px tabular-nums",
                    selected
                      ? "bg-primary/30 text-primary"
                      : count >= 5
                        ? "bg-primary/20 text-primary"
                        : "bg-white/[0.06] text-muted-foreground",
                  )}
                  aria-label={`${count} sessions`}
                >
                  {count}
                </span>
              ) : (
                <span className="text-[9px] sm:text-[10px] text-muted-foreground/40">—</span>
              )}
            </button>
          );
        })}
      </div>
    </AdminCard>
  );
}

// ============================================================
// DAY SECTION — sticky-ish header + list of booking rows
// ============================================================
function DaySection({
  isoDate,
  items,
  updateMutation,
  deleteMutation,
  t,
}: {
  isoDate: string;
  items: BookingWithUser[];
  updateMutation: ReturnType<typeof useUpdateBooking>;
  deleteMutation: ReturnType<typeof useDeleteBooking>;
  t: (k: string, fb?: string) => string;
}) {
  const d = parseBookingDate(isoDate);
  const today = isToday(d);
  const distance = differenceInCalendarDays(d, new Date());
  const relLabel =
    today
      ? t("admin.bookings.today", "Today")
      : distance === 1
        ? t("admin.bookings.tomorrow", "Tomorrow")
        : distance === -1
          ? t("admin.bookings.yesterday", "Yesterday")
          : null;

  return (
    <section data-testid={`day-section-${isoDate}`}>
      <header className="flex items-baseline justify-between gap-3 mb-2 px-1">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="font-display font-bold text-sm sm:text-base">
            {format(d, "EEEE, MMM d")}
          </h2>
          {relLabel && (
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded-md border",
                today
                  ? "bg-primary/15 text-primary border-primary/30"
                  : "bg-white/[0.04] text-muted-foreground border-white/10",
              )}
            >
              {relLabel}
            </span>
          )}
        </div>
        <span className="text-[11px] text-muted-foreground tabular-nums">
          {items.length} {items.length === 1
            ? t("admin.bookings.session", "session")
            : t("admin.bookings.sessions", "sessions")}
        </span>
      </header>
      <div className="space-y-2">
        {items.map((b) => (
          <BookingRow
            key={b.id}
            b={b}
            updateMutation={updateMutation}
            deleteMutation={deleteMutation}
            t={t}
          />
        ))}
      </div>
    </section>
  );
}

// ============================================================
// BOOKING ROW — single row inside a DaySection
// ============================================================
function BookingRow({
  b,
  updateMutation,
  deleteMutation,
  t,
}: {
  b: BookingWithUser;
  updateMutation: ReturnType<typeof useUpdateBooking>;
  deleteMutation: ReturnType<typeof useDeleteBooking>;
  t: (k: string, fb?: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      data-testid={`admin-booking-${b.id}`}
    >
      <AdminCard className="hover:border-white/15 transition-colors" padded={false}>
        <div className="p-3.5 sm:p-4 flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
            {/* Time tile */}
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary shrink-0">
              <span className="text-[10px] sm:text-[11px] uppercase font-bold tracking-wider opacity-80">
                {formatTime12(b.timeSlot).split(" ")[1] /* AM/PM */}
              </span>
              <span className="text-[15px] sm:text-base font-display font-bold leading-none tabular-nums">
                {formatTime12(b.timeSlot).split(" ")[0]}
              </span>
            </div>
            {/* Identity + badges */}
            <div className="min-w-0 flex-1">
              <p
                className="font-semibold truncate text-sm sm:text-base"
                data-testid={`booking-client-${b.id}`}
              >
                {b.user?.fullName || `User #${b.userId}`}
              </p>
              <p className="text-[12px] sm:text-xs text-muted-foreground/90 mt-0.5 truncate">
                {b.user?.email || "—"}
                {b.sessionType && (
                  <span className="ms-2 text-[10px] uppercase tracking-wider text-primary/80">
                    {SESSION_TYPE_LABELS[b.sessionType as keyof typeof SESSION_TYPE_LABELS] ||
                      b.sessionType}
                  </span>
                )}
              </p>
              {/* Duo metadata strip — partner snapshot + (when present) the
                  linked partner account. Renders ONLY for duo bookings so
                  single/package/trial rows stay visually clean. */}
              {b.sessionType === "duo" && (b as any).partnerFullName && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span
                    className="inline-flex items-center gap-1 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-primary/40 bg-primary/10 text-primary"
                    data-testid={`badge-duo-${b.id}`}
                  >
                    Duo
                  </span>
                  <span
                    className="text-[11px] text-foreground/80 truncate"
                    data-testid={`text-partner-${b.id}`}
                  >
                    + {(b as any).partnerFullName}
                    {(b as any).linkedPartnerUser?.fullName && (
                      <span className="text-primary/80 ms-1">
                        (linked: {(b as any).linkedPartnerUser.fullName})
                      </span>
                    )}
                  </span>
                  {(b as any).package && (
                    <span
                      className="text-[10px] text-muted-foreground tabular-nums"
                      data-testid={`text-session-count-${b.id}`}
                    >
                      Session {((b as any).package.usedSessions ?? 0) + 1} of {(b as any).package.totalSessions} ·{" "}
                      {(b as any).package.remaining} left
                    </span>
                  )}
                </div>
              )}
              <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                <span
                  className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${statusColor(b.status)}`}
                >
                  {translateStatus(b.status, t)}
                </span>
                <span
                  className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${paymentColor(b.paymentStatus || "unpaid")}`}
                  data-testid={`payment-badge-${b.id}`}
                >
                  {PAYMENT_STATUS_LABELS[
                    (b.paymentStatus || "unpaid") as keyof typeof PAYMENT_STATUS_LABELS
                  ] || b.paymentStatus}
                </span>
                {b.workoutCategory && (
                  <span
                    className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-violet-500/20 bg-violet-500/10 text-violet-300"
                    data-testid={`workout-badge-${b.id}`}
                  >
                    {WORKOUT_CATEGORY_LABELS[
                      b.workoutCategory as keyof typeof WORKOUT_CATEGORY_LABELS
                    ] || b.workoutCategory}
                  </span>
                )}
                {b.isEmergencyCancel && (
                  <span className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-amber-500/30 bg-amber-500/10 text-amber-300">
                    {t("admin.bookings.emergency")}
                  </span>
                )}
                {/* Auto-complete provenance pill — only renders when the
                    auto-complete cron transitioned the row (vs. an admin
                    manually flipping status to completed). Tooltip carries
                    completedAt + deduction timestamp for audit. */}
                {(b as any).autoCompletedAt && (
                  <span
                    className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                    title={`Auto-completed ${new Date((b as any).autoCompletedAt).toLocaleString()}${(b as any).packageSessionDeductedAt ? ` · package deducted ${new Date((b as any).packageSessionDeductedAt).toLocaleString()}` : " · no package deduction"}`}
                    data-testid={`auto-completed-badge-${b.id}`}
                  >
                    Auto
                  </span>
                )}
              </div>
              {b.notes && (
                <p className="text-[11px] text-muted-foreground/70 mt-1.5 line-clamp-2">
                  {b.notes}
                </p>
              )}
            </div>
          </div>
          {/* Controls */}
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 lg:shrink-0">
            <Select
              value={b.status}
              onValueChange={(v) =>
                updateMutation.mutate({ id: b.id, status: v as any, override: true })
              }
            >
              <SelectTrigger
                className="w-[136px] bg-white/5 border-white/10 h-8 text-[11px]"
                data-testid={`select-status-${b.id}`}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {translateStatus(s, t)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={b.paymentStatus || "unpaid"}
              onValueChange={(v) =>
                updateMutation.mutate({
                  id: b.id,
                  paymentStatus: v as any,
                  override: true,
                } as any)
              }
            >
              <SelectTrigger
                className="w-[130px] bg-white/5 border-white/10 h-8 text-[11px]"
                data-testid={`select-payment-${b.id}`}
              >
                <Wallet size={11} className="me-1" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([k, l]) => (
                  <SelectItem key={k} value={k}>
                    {l}
                  </SelectItem>
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
                  className="text-red-400 hover:text-red-300 hover:bg-red-500/10 h-8 w-8"
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
        </div>
      </AdminCard>
    </motion.div>
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
