import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, type UpdateSettingsInput } from "@shared/routes";
import type { Settings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function useSettings() {
  return useQuery<Settings>({
    queryKey: [api.settings.get.path],
    queryFn: async () => {
      // Await the boot-time fetch (started in index.html before the JS bundle
      // even begins parsing) instead of opening a second network connection.
      // On fast networks the promise is already resolved by the time React
      // mounts, so this returns in a single microtask with zero extra latency.
      const boot = (window as any).__YE_SETTINGS_BOOT__ as Promise<Settings | null> | undefined;
      if (boot) {
        try {
          const s = await boot;
          if (s) return s;
        } catch (_) {}
      }
      // Fallback: fresh fetch (first visit, boot script absent, or boot failed)
      const res = await fetch(api.settings.get.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch settings");
      return res.json() as Promise<Settings>;
    },
    // If the boot fetch resolved before React mounted, use its result immediately
    // so BrandLogo / AuthPage have correct URLs on the very first render.
    initialData: (): Settings | undefined => {
      const s = (window as any).__YE_INITIAL_SETTINGS__;
      return s ?? undefined;
    },
    // Mark the boot data as "just fetched" so TanStack doesn't immediately
    // refetch — same staleTime window applies from this moment forward.
    initialDataUpdatedAt: (): number => {
      const s = (window as any).__YE_INITIAL_SETTINGS__;
      return s != null ? Date.now() : 0;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: true,
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
