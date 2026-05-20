import { useQuery } from "@tanstack/react-query";

export type FeatureFlagsMap = Record<string, boolean>;

export function useFeatureFlags() {
  return useQuery<FeatureFlagsMap>({
    queryKey: ["/api/feature-flags"],
    staleTime: 60_000,
  });
}

export function useFeatureFlag(key: string, fallback = false): boolean {
  const { data } = useFeatureFlags();
  if (!data) return fallback;
  return data[key] ?? fallback;
}
