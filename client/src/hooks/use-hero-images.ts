import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { HeroImage, UpdateHeroImage } from "@shared/schema";

const KEY = ["/api/hero-images"] as const;

// Read the pre-bootstrap result populated by the inline <script> in
// index.html. If it ran successfully BEFORE React mounted, we can hand
// it straight to TanStack Query as `initialData` and the hero <img>
// renders on the very first paint — no gradient flash, no waterfall.
// If the boot script hasn't finished yet (rare; only on very fast JS
// bundle load against a slow API), `initialData` is `undefined` and
// useQuery transparently falls back to its normal fetch on mount.
declare global {
  interface Window {
    __INITIAL_HERO_IMAGES__?: HeroImage[];
    __HERO_BOOT__?: Promise<HeroImage[]>;
  }
}
function readBootstrap(): HeroImage[] | undefined {
  if (typeof window === "undefined") return undefined;
  const arr = window.__INITIAL_HERO_IMAGES__;
  return Array.isArray(arr) ? arr : undefined;
}

export function useHeroImages() {
  return useQuery<HeroImage[]>({
    queryKey: KEY,
    initialData: readBootstrap,
    // initialData with `staleTime: Infinity` (the global default) means
    // the hook NEVER refetches on mount when bootstrap data is present.
    // That's exactly what we want for the homepage hero — the rotating
    // slider polls nothing and admin uploads invalidate the key
    // explicitly via the upload/update/delete mutations below.
  });
}

export function useUploadHeroImage() {
  return useMutation({
    mutationFn: async (input: { imageDataUrl: string; title?: string; subtitle?: string; badge?: string }) => {
      const res = await apiRequest("POST", "/api/admin/hero-images", input);
      return (await res.json()) as HeroImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useUpdateHeroImage() {
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: UpdateHeroImage }) => {
      const res = await apiRequest("PATCH", `/api/admin/hero-images/${id}`, updates);
      return (await res.json()) as HeroImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

// Convenience wrapper kept for backwards-compatibility with the existing
// HeroImagesSection move-up/move-down buttons.
export function useUpdateHeroImageOrder() {
  return useMutation({
    mutationFn: async ({ id, sortOrder }: { id: number; sortOrder: number }) => {
      const res = await apiRequest("PATCH", `/api/admin/hero-images/${id}`, {
        sortOrder,
      });
      return (await res.json()) as HeroImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

export function useDeleteHeroImage() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/hero-images/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}
