import { useMemo } from "react";
import { Sparkles, Clock3, CalendarOff } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useBlockedSlots } from "@/hooks/use-blocked-slots";
import { useBookings } from "@/hooks/use-bookings";
import { dubaiTodayYMD, buildSessionDate } from "@/lib/booking-utils";
import { formatTimeDual } from "@shared/dates";
import { computeCoachAvailability } from "@/lib/coach-availability";
import { whatsappUrl, DEFAULT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { cn } from "@/lib/utils";

// Render a Dubai-anchored slot as "Wed, May 22 · 08:00 PM / 20:00 — Dubai time"
// regardless of the viewer's browser timezone.
function formatDubaiSlotLabel(date: string, timeSlot: string): string {
  const d = buildSessionDate(date, timeSlot);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Dubai",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("weekday")}, ${get("month")} ${get("day")} · ${formatTimeDual(timeSlot)}`;
}

interface CoachAvailabilityChipProps {
  className?: string;
}

export function CoachAvailabilityChip({ className }: CoachAvailabilityChipProps) {
  const { t } = useTranslation();
  const { data: blocked } = useBlockedSlots();
  const { data: bookings } = useBookings({ from: dubaiTodayYMD() });

  const result = useMemo(
    () =>
      computeCoachAvailability({
        blocked: (blocked ?? []).map((b: any) => ({
          date: b.date,
          timeSlot: b.timeSlot ?? null,
        })),
        bookings: (bookings ?? []).map((b: any) => ({
          date: b.date,
          timeSlot: b.timeSlot ?? null,
          status: b.status,
        })),
      }),
    [blocked, bookings],
  );

  const { state, nextSlot } = result;
  const isLoading = !blocked || !bookings;

  const dot =
    state === "available_today"
      ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.7)]"
      : state === "next_slot"
        ? "bg-cyan-300 shadow-[0_0_8px_rgba(94,231,255,0.7)]"
        : "bg-muted-foreground";

  const Icon =
    state === "available_today" ? Sparkles : state === "next_slot" ? Clock3 : CalendarOff;

  let label: string;
  if (isLoading) {
    label = t("coachAvail.loading");
  } else if (state === "available_today") {
    label = t("coachAvail.availableToday");
  } else if (state === "next_slot" && nextSlot) {
    const when = formatDubaiSlotLabel(nextSlot.date, nextSlot.timeSlot);
    label = t("coachAvail.nextSlot").replace("{when}", when);
  } else {
    label = t("coachAvail.bookedOut");
  }

  const isBookedOut = state === "booked_out" && !isLoading;

  if (isBookedOut) {
    return (
      <a
        href={whatsappUrl(
          DEFAULT_WHATSAPP_NUMBER,
          t("coachAvail.waitlistMessage"),
        )}
        target="_blank"
        rel="noopener noreferrer"
        data-testid="chip-coach-availability"
        className={cn(
          "inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-medium text-foreground/90 backdrop-blur-md transition-colors hover:border-cyan-400/40 hover:text-cyan-200",
          className,
        )}
      >
        <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
        <Icon size={12} className="text-muted-foreground" aria-hidden />
        <span>{label}</span>
        <span className="text-cyan-300/90">·</span>
        <span className="text-cyan-200">{t("coachAvail.messageCoach")}</span>
      </a>
    );
  }

  return (
    <div
      data-testid="chip-coach-availability"
      className={cn(
        "inline-flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-medium text-foreground/90 backdrop-blur-md",
        className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", dot)} aria-hidden />
      <Icon
        size={12}
        className={
          state === "available_today"
            ? "text-emerald-300"
            : state === "next_slot"
              ? "text-cyan-300"
              : "text-muted-foreground"
        }
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}

export default CoachAvailabilityChip;
