import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { HeroImage, UpdateHeroImage } from "@shared/schema";

const KEY = ["/api/hero-images"] as const;

export function useHeroImages() {
  return useQuery<HeroImage[]>({ queryKey: KEY });
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
