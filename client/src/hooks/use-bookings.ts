import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateBookingInput, type UpdateBookingInput } from "@shared/routes";
import type { Booking, BookingWithUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

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
      toast({ title: "Booking failed", description: err.message, variant: "destructive" });
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
    mutationFn: async (id: number) => {
      const url = buildUrl(api.bookings.cancel.path, { id });
      const res = await apiRequest("POST", url);
      return (await res.json()) as Booking;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.bookings.list.path] });
      qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      toast({ title: "Booking cancelled" });
    },
    onError: (err: Error) => {
      toast({ title: "Cancel failed", description: err.message, variant: "destructive" });
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
