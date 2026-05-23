import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateBookingInput, type UpdateBookingInput } from "@shared/routes";
import type { Booking, BookingWithUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { TRANSLATIONS, DEFAULT_LANGUAGE, type LanguageCode } from "@/i18n/translations";

// Task #29: rules-engine codes → i18n keys + English fallbacks. The map
// mirrors RULE_CODE_I18N_KEYS in server/rules/packages.ts. Callers pass the
// server's `code` (e.g. "slot_taken") and the server's terse `message` as a
// last-resort fallback if the code is unknown.
const RULE_CODE_FALLBACK: Record<string, { key: string; fallback: string }> = {
  slot_taken: { key: "booking.error.slot_taken", fallback: "This time slot was just booked by someone else. Please pick another." },
  slot_in_past: { key: "booking.error.slot_in_past", fallback: "This time has already passed. Please pick a future slot." },
  lead_time_too_short: { key: "booking.error.lead_time_too_short", fallback: "Bookings need to be made at least 3 hours in advance." },
  pending_verification: { key: "booking.error.pending_verification", fallback: "Your package is awaiting verification. You'll be able to book once approved." },
  package_expired: { key: "booking.error.package_expired", fallback: "Your package has expired. Please request a renewal or extension." },
  package_completed: { key: "booking.error.package_completed", fallback: "Your package is fully used. Please request a renewal." },
  package_frozen: { key: "booking.error.package_frozen", fallback: "Your package is currently frozen. Contact your coach to unfreeze it." },
  duo_partner_required: { key: "booking.error.duo_partner_required", fallback: "Please add your training partner's full name to book a Duo session." },
  no_remaining_sessions: { key: "booking.error.no_remaining_sessions", fallback: "No sessions remaining on this package." },
  no_active_package: { key: "booking.error.no_active_package", fallback: "You don't have an active package. Please choose one before booking." },
  forbidden: { key: "booking.error.forbidden", fallback: "You can't book against this package." },
};

function translateRuleCode(code: string, serverMessage: string): string {
  const entry = RULE_CODE_FALLBACK[code];
  if (!entry) return serverMessage;
  // Resolve against the active language. I18nProvider sets
  // `<html lang="...">` so we read it directly — this helper is called from
  // mutation onError callbacks (non-component context), so the React
  // useTranslation() hook isn't available here.
  const docLang =
    (typeof document !== "undefined" ? document.documentElement.lang : "") ||
    DEFAULT_LANGUAGE;
  const lang = (docLang in TRANSLATIONS ? docLang : DEFAULT_LANGUAGE) as LanguageCode;
  const dict = TRANSLATIONS[lang] ?? TRANSLATIONS[DEFAULT_LANGUAGE];
  return dict[entry.key] ?? entry.fallback;
}

export function useBookings(opts?: { userId?: number; includeUser?: boolean; from?: string }) {
  const params = new URLSearchParams();
  if (opts?.userId) params.set("userId", String(opts.userId));
  if (opts?.includeUser) params.set("includeUser", "true");
  if (opts?.from) params.set("from", opts.from);
  const qs = params.toString();
  const url = qs ? `${api.bookings.list.path}?${qs}` : api.bookings.list.path;

  return useQuery<BookingWithUser[] | Booking[]>({
    queryKey: [api.bookings.list.path, opts?.userId, opts?.includeUser, opts?.from],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch bookings");
      return res.json();
    },
    // Mobile sleep/wake + tab-switch safety. The global default in
    // queryClient.ts is `refetchOnWindowFocus: false` (intentional, to
    // avoid hammering the API everywhere), but bookings are the one
    // surface where stale state is dangerous: a phone that's been
    // locked for 10 minutes can come back showing a slot that just
    // got taken or just slipped into the past. Opting in here only
    // affects the booking list and dashboard upcoming-list — not a
    // sweeping default flip.
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    // Re-fetch every 60s while the tab is visible so a user sitting
    // on the booking page for several minutes sees other clients'
    // bookings appear without manual refresh. TanStack Query auto-
    // pauses this when the tab is backgrounded.
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}

export function useCreateBooking() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: CreateBookingInput & { override?: boolean }) => {
      const res = await fetch(api.bookings.create.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        const err = new Error(errData.message || "Booking failed");
        (err as any).blockType = errData.blockType;
        (err as any).code = errData.code;
        (err as any).status = res.status;
        throw err;
      }
      return (await res.json()) as Booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.bookings.list.path] });
      qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      toast({
        title: "Booking submitted",
        description: "Your booking request has been submitted. You can also confirm directly with Youssef on WhatsApp.",
      });
    },
    onError: (err: Error) => {
      // Task #29: rules-engine codes mapped to i18n keys. The English
      // fallback is the same copy as before so behaviour is unchanged when
      // translations are missing. Server's terse `message` is used as the
      // final fallback for any unmapped code.
      const code = (err as any).code as string | undefined;
      const description = code
        ? translateRuleCode(code, err.message)
        : err.message;
      toast({ title: "Booking failed", description, variant: "destructive" });
    },
  });
}

export function useUpdateBooking() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateBookingInput) => {
      const url = buildUrl(api.bookings.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return (await res.json()) as Booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.bookings.list.path] });
      qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      toast({ title: "Booking updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useCancelBooking() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (
      input:
        | number
        | {
            id: number;
            // New name. Old name kept for backward compatibility.
            useProtectedCancel?: boolean;
            useEmergencyCancel?: boolean;
          },
    ) => {
      const id = typeof input === "number" ? input : input.id;
      const useProtectedCancel =
        typeof input === "number"
          ? false
          : !!(input.useProtectedCancel || input.useEmergencyCancel);
      const url = buildUrl(api.bookings.cancel.path, { id });
      const res = await apiRequest("POST", url, { useProtectedCancel });
      return (await res.json()) as Booking;
    },
    onSuccess: (booking) => {
      qc.invalidateQueries({ queryKey: [api.bookings.list.path] });
      qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      qc.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: (booking as any).protectedCancellation
          ? "Protected Cancellation applied"
          : "Booking cancelled",
        description: (booking as any).protectedCancellation
          ? "Your session was cancelled without charge using your monthly Protected Cancellation."
          : undefined,
      });
    },
    onError: (err: Error) => {
      toast({ title: "Cancel failed", description: err.message, variant: "destructive" });
    },
  });
}

export function useSameDayAdjust() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, newTimeSlot }: { id: number; newTimeSlot: string }) => {
      const url = buildUrl(api.bookings.sameDayAdjust.path, { id });
      const res = await apiRequest("POST", url, { newTimeSlot });
      return (await res.json()) as Booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.bookings.list.path] });
      qc.invalidateQueries({ queryKey: ["/api/auth/me"] });
      toast({
        title: "Session moved",
        description: "Your session has been moved to the new time today.",
      });
    },
    onError: (err: Error) => {
      toast({ title: "Couldn't adjust", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteBooking() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.bookings.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.bookings.list.path] });
      qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      toast({ title: "Booking removed" });
    },
  });
}
