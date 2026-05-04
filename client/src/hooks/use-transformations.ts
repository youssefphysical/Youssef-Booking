import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Transformation, UpdateTransformation } from "@shared/schema";

const PUBLIC_KEY = ["/api/transformations"] as const;
const ADMIN_KEY = ["/api/admin/transformations"] as const;

export function useTransformations() {
  return useQuery<Transformation[]>({ queryKey: PUBLIC_KEY });
}

export function useAdminTransformations() {
  return useQuery<Transformation[]>({ queryKey: ADMIN_KEY });
}

export type CreateTransformationInput = {
  beforeImageDataUrl: string;
  afterImageDataUrl: string;
  displayName?: string | null;
  goal?: string | null;
  duration?: string | null;
  result?: string | null;
  testimonial?: string | null;
};

export function useCreateTransformation() {
  return useMutation({
    mutationFn: async (input: CreateTransformationInput) => {
      const res = await apiRequest("POST", "/api/admin/transformations", input);
      return (await res.json()) as Transformation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
    },
  });
}

export function useUpdateTransformation() {
  return useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: UpdateTransformation }) => {
      const res = await apiRequest("PATCH", `/api/admin/transformations/${id}`, updates);
      return (await res.json()) as Transformation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
    },
  });
}

export function useDeleteTransformation() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/transformations/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: PUBLIC_KEY });
      queryClient.invalidateQueries({ queryKey: ADMIN_KEY });
    },
  });
}
