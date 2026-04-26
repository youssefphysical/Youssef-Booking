import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type UpdateSettingsInput } from "@shared/routes";
import type { Settings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function useSettings() {
  return useQuery<Settings>({
    queryKey: [api.settings.get.path],
    queryFn: async () => {
      const res = await fetch(api.settings.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json();
    },
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: UpdateSettingsInput) => {
      const res = await apiRequest("PATCH", api.settings.update.path, data);
      return (await res.json()) as Settings;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.settings.get.path] });
      toast({ title: "Settings updated" });
    },
    onError: (err: Error) => {
      toast({ title: "Update failed", description: err.message, variant: "destructive" });
    },
  });
}
