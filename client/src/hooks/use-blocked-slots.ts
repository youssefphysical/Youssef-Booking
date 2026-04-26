import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreateBlockedSlotInput } from "@shared/routes";
import type { BlockedSlot } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function useBlockedSlots() {
  return useQuery<BlockedSlot[]>({
    queryKey: [api.blockedSlots.list.path],
    queryFn: async () => {
      const res = await fetch(api.blockedSlots.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load blocked slots");
      return res.json();
    },
  });
}

export function useCreateBlockedSlot() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: CreateBlockedSlotInput) => {
      const res = await apiRequest("POST", api.blockedSlots.create.path, data);
      return (await res.json()) as BlockedSlot;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.blockedSlots.list.path] });
      toast({ title: "Slot blocked" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to block", description: err.message, variant: "destructive" });
    },
  });
}

export function useDeleteBlockedSlot() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.blockedSlots.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.blockedSlots.list.path] });
      toast({ title: "Block removed" });
    },
  });
}
