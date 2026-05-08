import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  BodyMetric,
  InsertBodyMetric,
  UpdateBodyMetric,
} from "@shared/schema";

const LIST = api.bodyMetrics.list.path;
const ME = api.bodyMetrics.mine.path;

export function useBodyMetrics(userId: number | undefined, opts: { enabled?: boolean } = {}) {
  return useQuery<BodyMetric[]>({
    queryKey: [LIST, userId],
    enabled: (opts.enabled ?? true) && !!userId,
    queryFn: async () => {
      const res = await fetch(`${LIST}?userId=${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load body metrics");
      return res.json();
    },
  });
}

export function useMyBodyMetrics(opts: { enabled?: boolean } = {}) {
  return useQuery<BodyMetric[]>({
    queryKey: [ME],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const res = await fetch(ME, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load body metrics");
      return res.json();
    },
  });
}

export function useCreateBodyMetric() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertBodyMetric) => {
      const res = await apiRequest("POST", api.bodyMetrics.create.path, data);
      return (await res.json()) as BodyMetric;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: [LIST, row.userId] });
      qc.invalidateQueries({ queryKey: [LIST] });
      qc.invalidateQueries({ queryKey: [ME] });
      toast({ title: "Entry logged" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to log entry", description: err.message, variant: "destructive" }),
  });
}

export function useUpdateBodyMetric(userId?: number) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateBodyMetric) => {
      const url = buildUrl(api.bodyMetrics.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return (await res.json()) as BodyMetric;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: [LIST, userId] });
      qc.invalidateQueries({ queryKey: [LIST] });
      qc.invalidateQueries({ queryKey: [ME] });
      toast({ title: "Saved" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteBodyMetric(userId?: number) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.bodyMetrics.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: [LIST, userId] });
      qc.invalidateQueries({ queryKey: [LIST] });
      qc.invalidateQueries({ queryKey: [ME] });
      toast({ title: "Removed" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}
