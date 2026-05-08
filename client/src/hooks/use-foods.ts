import { useQuery, useMutation, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { api, buildUrl, type CreateFoodInput, type UpdateFoodInput } from "@shared/routes";
import type { Food } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const LIST = api.foods.list.path;

export interface FoodsListFilters {
  search?: string;
  category?: string;
  isSupplement?: boolean;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface FoodsListResponse {
  items: Food[];
  total: number;
}

function buildListUrl(filters?: FoodsListFilters): string {
  const params = new URLSearchParams();
  if (filters?.search?.trim()) params.set("search", filters.search.trim());
  if (filters?.category) params.set("category", filters.category);
  if (typeof filters?.isSupplement === "boolean") {
    params.set("supplement", String(filters.isSupplement));
  }
  if (filters?.activeOnly) params.set("activeOnly", "true");
  if (filters?.limit !== undefined) params.set("limit", String(filters.limit));
  if (filters?.offset !== undefined) params.set("offset", String(filters.offset));
  const qs = params.toString();
  return qs ? `${LIST}?${qs}` : LIST;
}

export function useFoods(filters?: FoodsListFilters) {
  return useQuery<FoodsListResponse>({
    queryKey: [LIST, filters ?? {}],
    queryFn: async () => {
      const res = await fetch(buildListUrl(filters), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load foods");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });
}

export function useCreateFood() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: CreateFoodInput) => {
      const res = await apiRequest("POST", api.foods.create.path, data);
      return (await res.json()) as Food;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: "Food added" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to add", description: err.message, variant: "destructive" }),
  });
}

export function useUpdateFood() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateFoodInput) => {
      const url = buildUrl(api.foods.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return (await res.json()) as Food;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: "Food updated" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteFood() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.foods.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: "Food removed" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" }),
  });
}

export function useDuplicateFood() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.foods.duplicate.path, { id });
      const res = await apiRequest("POST", url);
      return (await res.json()) as Food;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: "Food duplicated" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to duplicate", description: err.message, variant: "destructive" }),
  });
}
