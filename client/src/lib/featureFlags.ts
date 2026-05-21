import { useQuery } from "@tanstack/react-query";

export type FeatureFlagsMap = Record<string, boolean>;

export function useFeatureFlags() {
  return useQuery<FeatureFlagsMap>({
    queryKey: ["/api/feature-flags"],
    // Phase 5 review fix — propagation. The global query default disables
    // refetch-on-focus to avoid hammering the API, but maintenance mode
    // is a global kill-switch: if Youssef flips it, every existing client
    // session must pick it up within ~30s without a manual reload. We
    // override the global default here only for this query, keep
    // staleTime low so the next focus/route change refetches, and poll
    // in the background so even backgrounded tabs eventually catch up.
    refetchInterval: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
    staleTime: 0,
  });
}

export function useFeatureFlag(key: string, fallback = false): boolean {
  const { data } = useFeatureFlags();
  if (!data) return fallback;
  return data[key] ?? fallback;
}
