import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { HeroImage } from "@shared/schema";

const KEY = ["/api/hero-images"] as const;

export function useHeroImages() {
  return useQuery<HeroImage[]>({ queryKey: KEY });
}

export function useUploadHeroImage() {
  return useMutation({
    mutationFn: async (imageDataUrl: string) => {
      const res = await apiRequest("POST", "/api/admin/hero-images", {
        imageDataUrl,
      });
      return (await res.json()) as HeroImage;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: KEY });
    },
  });
}

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
