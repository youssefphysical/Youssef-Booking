// =============================================================================
// Task #29 — Booking Rules Engine (pure functions)
// =============================================================================
// One source of truth for every booking-side check. Each function is pure
// (input → result), performs no I/O, and returns a tagged result that route
// handlers translate to HTTP responses and the client maps to i18n strings.
//
// Codes are stable identifiers — never localise them server-side; the UI
// owns the wording.
// =============================================================================

import type { User, Package, Booking } from "@shared/schema";
import { evaluateBookingEligibility } from "@shared/schema";

export type RuleOk = { ok: true };
export type RuleFail = { ok: false; code: string; message: string };
export type RuleResult = RuleOk | RuleFail;

const OK: RuleOk = { ok: true };

const ALLOWED_BOOKING_HOURS = new Set([
  "06:00","07:00","08:00","09:00","10:00","11:00","12:00",
  "13:00","14:00","15:00","16:00","17:00","18:00","19:00",
  "20:00","21:00","22:00",
]);

const CANCELLED_STATES = new Set([
  "cancelled","free_cancelled","late_cancelled","emergency_cancelled",
]);

const TERMINAL_STATES = new Set([
  ...Array.from(CANCELLED_STATES),
  "completed","no_show",
]);

/** Constants exposed for re-use by the route layer. */
export const BOOKING_CONSTANTS = {
  ALLOWED_BOOKING_HOURS,
  CANCELLED_STATES,
  TERMINAL_STATES,
};

// -----------------------------------------------------------------------------
// canUserBook(user, pkg, sessionType)
// -----------------------------------------------------------------------------
// Wraps the existing shared `evaluateBookingEligibility` helper so the rules
// module is the single canonical entry point. Trial/single sessions skip the
// package half by passing `pkg = null`.
export function canUserBook(
  user: Pick<User, "clientStatus" | "parqCompleted" | "waiverAccepted" | "primaryGoal" | "weeklyFrequency">,
  pkg: Pick<Package, "totalSessions" | "usedSessions" | "expiryDate" | "frozen" | "isActive" | "paymentStatus" | "paymentApproved" | "adminApproved" | "status"> | null,
  sessionType: "package" | "duo" | "single" | "trial",
): RuleResult {
  const linked = sessionType === "single" || sessionType === "trial" ? null : pkg ?? null;
  const verdict = evaluateBookingEligibility(user as any, linked as any);
  if (!verdict.ok) return verdict;

  if (linked) {
    // Block pending-verification packages explicitly.
    if ((linked as any).status === "pending_verification") {
      return {
        ok: false,
        code: "pending_verification",
        message: "Your package is awaiting verification. You'll be able to book once approved.",
      };
    }
    if ((linked as any).status === "archived") {
      return { ok: false, code: "package_archived", message: "This package has been archived." };
    }
    const total = linked.totalSessions ?? 0;
    const used = linked.usedSessions ?? 0;
    if (used >= total) {
      return { ok: false, code: "package_completed", message: "Your package is fully used. Please request a renewal to continue booking." };
    }
    if (linked.expiryDate) {
      const todayStr = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
      const expStr = String(linked.expiryDate).slice(0, 10);
      if (expStr < todayStr) {
        return { ok: false, code: "package_expired", message: "Your package has expired. Please request a renewal or an extension to continue booking." };
      }
    }
  }
  return OK;
}

// -----------------------------------------------------------------------------
// isValidBookingSlot — server-side guards for the slot itself.
// -----------------------------------------------------------------------------
export function isValidBookingSlot(args: {
  sessionAt: Date;
  timeSlot: string;
  isAdmin: boolean;
  leadTimeCutoffMs: number;
}): RuleResult {
  const { sessionAt, timeSlot, isAdmin, leadTimeCutoffMs } = args;
  if (isNaN(sessionAt.getTime())) {
    return { ok: false, code: "invalid_slot", message: "Invalid date or time." };
  }
  if (!isAdmin && !ALLOWED_BOOKING_HOURS.has(timeSlot)) {
    return { ok: false, code: "slot_out_of_hours", message: "Sessions can only be booked between 06:00 AM and 10:00 PM." };
  }
  if (!isAdmin && sessionAt.getTime() <= Date.now()) {
    return { ok: false, code: "slot_in_past", message: "This time is no longer available. Please choose a future slot." };
  }
  if (!isAdmin && sessionAt.getTime() < leadTimeCutoffMs) {
    return { ok: false, code: "lead_time_too_short", message: "Bookings must be made at least 3 hours in advance so the trainer can prepare and arrive on time." };
  }
  return OK;
}

// -----------------------------------------------------------------------------
// canCancelWithoutCharge — Nh lockout rule (default 3h, admin-configurable).
// -----------------------------------------------------------------------------
export function canCancelWithoutCharge(args: {
  sessionAt: Date;
  cutoffHours: number;
  now?: number;
}): RuleResult {
  const now = args.now ?? Date.now();
  const cutoffMs = args.cutoffHours * 60 * 60 * 1000;
  if (args.sessionAt.getTime() - now < cutoffMs) {
    return {
      ok: false,
      code: "under_6h_lockout",
      message: `Cancellation locked. Less than ${args.cutoffHours} hours remain.`,
    };
  }
  return OK;
}

// -----------------------------------------------------------------------------
// canBookDuo — verify partner snapshot when sessionType='duo'.
// -----------------------------------------------------------------------------
export function canBookDuo(args: {
  sessionType: string;
  partnerFullName?: string | null;
  isAdmin: boolean;
}): RuleResult {
  if (args.sessionType !== "duo") return OK;
  if (args.isAdmin) return OK;
  const name = (args.partnerFullName ?? "").trim();
  if (name.length < 2) {
    return {
      ok: false,
      code: "duo_partner_required",
      message: "Training partner full name is required for a Duo session.",
    };
  }
  return OK;
}

// -----------------------------------------------------------------------------
// canModifyBooking — owner / partner / admin can mutate; status-locked rows can't.
// -----------------------------------------------------------------------------
export function canModifyBooking(args: {
  booking: Pick<Booking, "userId" | "status"> & { linkedPartnerUserId?: number | null };
  actorId: number;
  isAdmin: boolean;
}): RuleResult {
  const { booking, actorId, isAdmin } = args;
  if (!isAdmin) {
    const isOwner = booking.userId === actorId;
    const isPartner =
      typeof booking.linkedPartnerUserId === "number" && booking.linkedPartnerUserId === actorId;
    if (!isOwner && !isPartner) {
      return { ok: false, code: "forbidden", message: "Forbidden" };
    }
  }
  if (TERMINAL_STATES.has(booking.status)) {
    return { ok: false, code: "booking_locked", message: "This booking can no longer be modified." };
  }
  return OK;
}
