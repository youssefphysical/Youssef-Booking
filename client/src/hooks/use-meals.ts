import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import { api, buildUrl, type CreateMealInput, type UpdateMealInput } from "@shared/routes";
import type { Meal, MealWithItems } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiRequest } from "@/lib/queryClient";

const LIST = api.meals.list.path;

export interface MealsListFilters {
  search?: string;
  category?: string;
  templateOnly?: boolean;
  activeOnly?: boolean;
  limit?: number;
  offset?: number;
}

export interface MealsListResponse {
  items: Meal[];
  total: number;
}

function buildListUrl(filters?: MealsListFilters): string {
  const p = new URLSearchParams();
  if (filters?.search?.trim()) p.set("search", filters.search.trim());
  if (filters?.category) p.set("category", filters.category);
  if (filters?.templateOnly) p.set("templateOnly", "true");
  if (filters?.activeOnly) p.set("activeOnly", "true");
  if (filters?.limit !== undefined) p.set("limit", String(filters.limit));
  if (filters?.offset !== undefined) p.set("offset", String(filters.offset));
  const qs = p.toString();
  return qs ? `${LIST}?${qs}` : LIST;
}

export function useMeals(filters?: MealsListFilters) {
  return useQuery<MealsListResponse>({
    queryKey: [LIST, filters ?? {}],
    queryFn: async () => {
      const res = await fetch(buildListUrl(filters), { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load meals");
      return res.json();
    },
    placeholderData: keepPreviousData,
  });
}

export function useMeal(id: number | null) {
  return useQuery<MealWithItems>({
    queryKey: [api.meals.get.path, id],
    enabled: typeof id === "number" && id > 0,
    queryFn: async () => {
      const url = buildUrl(api.meals.get.path, { id: id as number });
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load meal");
      return res.json();
    },
  });
}

export function useCreateMeal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: CreateMealInput) => {
      const res = await apiRequest("POST", api.meals.create.path, data);
      return (await res.json()) as MealWithItems;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: t("admin.mealBuilder.toast.created", "Meal created") });
    },
    onError: (err: Error) =>
      toast({
        title: t("admin.mealBuilder.toast.createFailed", "Failed to create meal"),
        description: err.message,
        variant: "destructive",
      }),
  });
}

export function useUpdateMeal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateMealInput) => {
      const url = buildUrl(api.meals.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return (await res.json()) as MealWithItems;
    },
    onSuccess: (m) => {
      qc.invalidateQueries({ queryKey: [LIST] });
      qc.invalidateQueries({ queryKey: [api.meals.get.path, m.id] });
      toast({ title: t("admin.mealBuilder.toast.updated", "Meal updated") });
    },
    onError: (err: Error) =>
      toast({
        title: t("admin.mealBuilder.toast.updateFailed", "Failed to update meal"),
        description: err.message,
        variant: "destructive",
      }),
  });
}

export function useDeleteMeal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.meals.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: t("admin.mealBuilder.toast.deleted", "Meal removed") });
    },
    onError: (err: Error) =>
      toast({
        title: t("admin.mealBuilder.toast.deleteFailed", "Failed to delete meal"),
        description: err.message,
        variant: "destructive",
      }),
  });
}

export function useDuplicateMeal() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.meals.duplicate.path, { id });
      const res = await apiRequest("POST", url);
      return (await res.json()) as MealWithItems;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: t("admin.mealBuilder.toast.duplicated", "Meal duplicated") });
    },
    onError: (err: Error) =>
      toast({
        title: t("admin.mealBuilder.toast.duplicateFailed", "Failed to duplicate meal"),
        description: err.message,
        variant: "destructive",
      }),
  });
}
