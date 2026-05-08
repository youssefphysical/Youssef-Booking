import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  WeeklyCheckin,
  InsertWeeklyCheckin,
  UpdateWeeklyCheckin,
} from "@shared/schema";

const LIST = api.weeklyCheckins.list.path;
const ME = api.weeklyCheckins.mine.path;
const PENDING = api.weeklyCheckins.pending.path;

export function useWeeklyCheckins(userId: number | undefined, opts: { enabled?: boolean } = {}) {
  return useQuery<WeeklyCheckin[]>({
    queryKey: [LIST, userId],
    enabled: (opts.enabled ?? true) && !!userId,
    queryFn: async () => {
      const res = await fetch(`${LIST}?userId=${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load check-ins");
      return res.json();
    },
  });
}

export function useMyWeeklyCheckins(opts: { enabled?: boolean } = {}) {
  return useQuery<WeeklyCheckin[]>({
    queryKey: [ME],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const res = await fetch(ME, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load check-ins");
      return res.json();
    },
  });
}

export function usePendingWeeklyCheckins(opts: { enabled?: boolean } = {}) {
  return useQuery<WeeklyCheckin[]>({
    queryKey: [PENDING],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const res = await fetch(PENDING, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load pending check-ins");
      return res.json();
    },
  });
}

function invalidateAll(qc: ReturnType<typeof useQueryClient>, userId?: number) {
  if (userId) qc.invalidateQueries({ queryKey: [LIST, userId] });
  qc.invalidateQueries({ queryKey: [LIST] });
  qc.invalidateQueries({ queryKey: [ME] });
  qc.invalidateQueries({ queryKey: [PENDING] });
}

export function useCreateWeeklyCheckin() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertWeeklyCheckin) => {
      const res = await apiRequest("POST", api.weeklyCheckins.create.path, data);
      return (await res.json()) as WeeklyCheckin;
    },
    onSuccess: (row) => {
      invalidateAll(qc, row.userId);
      toast({ title: "Check-in submitted" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to submit check-in", description: err.message, variant: "destructive" }),
  });
}

export function useUpdateWeeklyCheckin(userId?: number) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateWeeklyCheckin) => {
      const url = buildUrl(api.weeklyCheckins.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return (await res.json()) as WeeklyCheckin;
    },
    onSuccess: () => {
      invalidateAll(qc, userId);
      toast({ title: "Saved" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteWeeklyCheckin(userId?: number) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.weeklyCheckins.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      invalidateAll(qc, userId);
      toast({ title: "Removed" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

// ----- Adherence + streak helpers (pure, UI-shared) -----

export function mondayOf(d: Date): string {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  const day = x.getDay(); // 0 Sun .. 6 Sat
  const diff = (day === 0 ? -6 : 1 - day);
  x.setDate(x.getDate() + diff);
  const yyyy = x.getFullYear();
  const mm = String(x.getMonth() + 1).padStart(2, "0");
  const dd = String(x.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function adherenceScore(c: WeeklyCheckin): number | null {
  const parts: number[] = [];
  if (c.cardioAdherence != null) parts.push(c.cardioAdherence);
  if (c.trainingAdherence != null) parts.push(c.trainingAdherence);
  if (parts.length === 0) return null;
  return Math.round(parts.reduce((a, b) => a + b, 0) / parts.length);
}

// Consecutive-week streak ending at the most recent submitted check-in
// (counted from the latest week_start back, no gaps).
export function checkinStreak(rows: WeeklyCheckin[]): number {
  if (!rows.length) return 0;
  const sorted = [...rows].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1));
  let streak = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].weekStart);
    const cur = new Date(sorted[i].weekStart);
    const diffDays = Math.round((prev.getTime() - cur.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 7) streak++;
    else break;
  }
  return streak;
}
