import { useQuery } from "@tanstack/react-query";
import type { HomepageSection } from "@shared/schema";

/**
 * Cinematic CMS content for the homepage. Returns active homepage_sections
 * keyed by their `key` (e.g. "hero", "philosophy", "final_cta") for direct
 * lookup. Empty object on failure or before first fetch — every consuming
 * component MUST guard with `?.` and fall back to inline static strings so
 * the page never breaks when a row is missing or the CMS is empty.
 */
export type HomepageContentMap = Record<string, HomepageSection>;

export function useHomepageContent() {
  return useQuery<HomepageContentMap>({
    queryKey: ["/api/homepage-content"],
    staleTime: 60_000,
  });
}
