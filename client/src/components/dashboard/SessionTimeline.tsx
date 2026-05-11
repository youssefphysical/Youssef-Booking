import { useMemo } from "react";
import { motion } from "framer-motion";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { CalendarClock, ChevronRight } from "lucide-react";
import { useBookings } from "@/hooks/use-bookings";
import type { Booking } from "@shared/schema";
import { format, isToday, isTomorrow } from "date-fns";
import { formatTime12 } from "@/lib/time-format";
import { useTranslation } from "@/i18n";

// Session timeline — top 3 upcoming sessions in cinematic stacked
// cards. Replaces the "scroll into the bookings tab" friction for the
// most common question: "what's my next session?". Pure read of the
// existing useBookings hook; clicking a card jumps to the bookings tab
// where the full management UI (cancel/adjust) lives.

function dayLabel(d: Date, t: (k: string, fb?: string) => string): string {
  if (isToday(d)) return t("dashboard.today", "Today");
  if (isTomorrow(d)) return t("dashboard.tomorrow", "Tomorrow");
  return format(d, "EEE, MMM d");
}

export function SessionTimeline({
  userId,
  onJump,
}: {
  userId: number;
  onJump: (tab: string) => void;
}) {
  const { t } = useTranslation();
  const { data: bookings = [], isLoading } = useBookings({ userId });

  const upcoming = useMemo(() => {
    const list = bookings as Booking[];
    const now = Date.now();
    return list
      .filter((b) => {
        const s = (b.status ?? "").toLowerCase();
        if (!["upcoming", "confirmed"].includes(s)) return false;
        if (!b.date || !b.timeSlot) return false;
        const t = new Date(`${b.date}T${b.timeSlot}:00+04:00`).getTime();
        return t >= now;
      })
      .sort((a, b) =>
        (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot),
      )
      .slice(0, 3);
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="mb-6 rounded-3xl border border-white/[0.08] bg-card/40 p-6">
        <div className="h-4 w-40 admin-shimmer rounded mb-4" />
        <div className="space-y-2">
          <div className="h-16 admin-shimmer rounded-2xl" />
          <div className="h-16 admin-shimmer rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: "easeOut" }}
      className="relative mb-6 overflow-hidden rounded-3xl border border-white/[0.08] bg-card/40 p-6"
      data-testid="session-timeline"
    >
      <CyanHairline />
      <div className="flex items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/10 ring-1 ring-primary/40 text-primary">
            <CalendarClock size={16} />
          </div>
          <div>
            <p className="tron-eyebrow text-[10px] font-semibold">
              {t("dashboard.upcomingSessions", "Upcoming sessions")}
            </p>
            <h3 className="text-lg sm:text-xl font-display font-semibold leading-tight">
              {upcoming.length > 0
                ? t("dashboard.next3", "Your next sessions")
                : t("dashboard.noUpcoming", "Nothing scheduled yet")}
            </h3>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onJump("bookings")}
          className="text-xs text-primary hover:text-primary/80 transition-colors inline-flex items-center gap-1"
          data-testid="link-timeline-all"
        >
          {t("dashboard.viewAll", "View all")} <ChevronRight size={14} />
        </button>
      </div>

      {upcoming.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-5 text-sm text-muted-foreground">
          {t(
            "dashboard.timelineEmpty",
            "Book your next session and it will appear here.",
          )}
        </div>
      ) : (
        <div className="space-y-2.5">
          {upcoming.map((b, i) => {
            const dt = new Date(`${b.date}T${b.timeSlot}:00+04:00`);
            const day = dayLabel(dt, t);
            const time = formatTime12(b.timeSlot);
            const isNext = i === 0;
            return (
              <motion.button
                key={b.id}
                type="button"
                onClick={() => onJump("bookings")}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
                whileHover={{ x: 2 }}
                className={`group w-full text-left flex items-center justify-between gap-3 rounded-2xl border px-4 py-3.5 transition-colors ${
                  isNext
                    ? "border-primary/30 bg-primary/[0.06] hover:border-primary/50"
                    : "border-white/10 bg-white/[0.03] hover:border-white/20"
                }`}
                data-testid={`timeline-session-${b.id}`}
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Timeline dot/rail */}
                  <div className="relative flex flex-col items-center shrink-0">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isNext
                          ? "bg-primary shadow-[0_0_10px_-1px_hsl(183_100%_60%/0.7)]"
                          : "bg-white/30"
                      }`}
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {day}
                    </p>
                    <p className="mt-0.5 text-base sm:text-lg font-display font-semibold leading-tight tabular-nums">
                      {time}
                    </p>
                    {b.sessionType && (
                      <p className="mt-0.5 text-[11px] text-muted-foreground capitalize truncate max-w-[200px]">
                        {String(b.sessionType).replace(/_/g, " ")}
                      </p>
                    )}
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className="shrink-0 text-muted-foreground transition-colors group-hover:text-primary"
                />
              </motion.button>
            );
          })}
        </div>
      )}
    </motion.section>
  );
}
