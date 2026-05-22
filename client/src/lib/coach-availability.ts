import {
  ALL_TIME_SLOTS,
  bookingCutoffMs,
  buildSessionDate,
  formatYMDInDubai,
  dubaiTodayYMD,
} from "./booking-utils";

export type CoachAvailabilityState = "available_today" | "next_slot" | "booked_out";

export interface CoachAvailabilitySlot {
  date: string;
  timeSlot: string;
}

export interface CoachAvailabilityResult {
  state: CoachAvailabilityState;
  nextSlot: CoachAvailabilitySlot | null;
  freeTodayCount: number;
}

interface BlockedLike {
  date: string;
  timeSlot: string | null;
}

interface BookingLike {
  date: string;
  timeSlot: string | null;
  status: string;
}

const ACTIVE_BOOKING_STATUSES = new Set(["upcoming", "confirmed", "completed"]);
const BOOKED_OUT_HORIZON_MS = 48 * 60 * 60 * 1000;
const DEFAULT_DAYS_TO_SCAN = 7;

export interface ComputeCoachAvailabilityOpts {
  blocked: BlockedLike[];
  bookings: BookingLike[];
  now?: Date;
  daysToScan?: number;
}

export function computeCoachAvailability(
  opts: ComputeCoachAvailabilityOpts,
): CoachAvailabilityResult {
  const nowMs = (opts.now ?? new Date()).getTime();
  const cutoff = bookingCutoffMs(nowMs);
  const daysToScan = opts.daysToScan ?? DEFAULT_DAYS_TO_SCAN;

  const todayYMD = dubaiTodayYMD();
  const days: string[] = [todayYMD];
  for (let i = 1; i < daysToScan; i++) {
    const d = new Date(`${todayYMD}T12:00:00+04:00`);
    d.setUTCDate(d.getUTCDate() + i);
    days.push(formatYMDInDubai(d));
  }

  const wholeDayBlocked = new Set<string>();
  const blockedSlotKeys = new Set<string>();
  for (const b of opts.blocked) {
    if (!b.timeSlot) wholeDayBlocked.add(b.date);
    else blockedSlotKeys.add(`${b.date}|${b.timeSlot}`);
  }

  const takenKeys = new Set<string>();
  for (const bk of opts.bookings) {
    if (!bk.timeSlot) continue;
    if (!ACTIVE_BOOKING_STATUSES.has(bk.status)) continue;
    takenKeys.add(`${bk.date}|${bk.timeSlot}`);
  }

  let nextSlot: CoachAvailabilitySlot | null = null;
  let freeTodayCount = 0;

  for (const date of days) {
    if (wholeDayBlocked.has(date)) continue;
    for (const slot of ALL_TIME_SLOTS) {
      const key = `${date}|${slot}`;
      if (blockedSlotKeys.has(key) || takenKeys.has(key)) continue;
      const startMs = buildSessionDate(date, slot).getTime();
      if (startMs < cutoff) continue;
      if (!nextSlot) nextSlot = { date, timeSlot: slot };
      if (date === todayYMD) freeTodayCount += 1;
    }
    if (nextSlot && date !== todayYMD) break;
  }

  if (freeTodayCount > 0) {
    return { state: "available_today", nextSlot, freeTodayCount };
  }
  if (nextSlot) {
    const nextStartMs = buildSessionDate(nextSlot.date, nextSlot.timeSlot).getTime();
    if (nextStartMs - nowMs <= BOOKED_OUT_HORIZON_MS) {
      return { state: "next_slot", nextSlot, freeTodayCount: 0 };
    }
    return { state: "booked_out", nextSlot, freeTodayCount: 0 };
  }
  return { state: "booked_out", nextSlot: null, freeTodayCount: 0 };
}
