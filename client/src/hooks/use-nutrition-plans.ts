import {
  useQuery,
  useMutation,
  useQueryClient,
  keepPreviousData,
} from "@tanstack/react-query";
import {
  api,
  buildUrl,
  type CreateNutritionPlanInput,
  type UpdateNutritionPlanInput,
} from "@shared/routes";
import type { NutritionPlan, NutritionPlanFull } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";
import { apiRequest } from "@/lib/queryClient";

const LIST = api.nutritionPlans.list.path;

export interface NutritionPlansFilters {
  userId?: number;
  status?: string;
  limit?: number;
  offset?: number;
}

export interface NutritionPlansListResponse {
  items: NutritionPlan[];
  total: number;
}

function buildListUrl(filters?: NutritionPlansFilters): string {
  const p = new URLSearchParams();
  if (filters?.userId) p.set("userId", String(filters.userId));
  if (filters?.status) p.set("status", filters.status);
  if (filters?.limit !== undefined) p.set("limit", String(filters.limit));
  if (filters?.offset !== undefined) p.set("offset", String(filters.offset));
  const qs = p.toString();
  return qs ? `${LIST}?${qs}` : LIST;
}

export function useNutritionPlans(filters?: NutritionPlansFilters) {
  return useQuery<NutritionPlansListResponse>({
    queryKey: [LIST, filters ?? {}],
    queryFn: async () => {
      const r = await fetch(buildListUrl(filters), { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load nutrition plans");
      return r.json();
    },
    placeholderData: keepPreviousData,
  });
}

export function useNutritionPlan(id: number | null) {
  return useQuery<NutritionPlanFull>({
    queryKey: [api.nutritionPlans.get.path, id],
    enabled: typeof id === "number" && id > 0,
    queryFn: async () => {
      const url = buildUrl(api.nutritionPlans.get.path, { id: id as number });
      const r = await fetch(url, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load plan");
      return r.json();
    },
  });
}

/** Client-facing: fetch the signed-in user's active plan (no private notes). */
export function useMyActiveNutritionPlan(enabled = true) {
  return useQuery<NutritionPlanFull | null>({
    queryKey: [api.nutritionPlans.mine.path],
    enabled,
    retry: false,
    queryFn: async () => {
      const r = await fetch(api.nutritionPlans.mine.path, { credentials: "include" });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error("Failed to load nutrition plan");
      return r.json();
    },
  });
}

export function useCreateNutritionPlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (data: CreateNutritionPlanInput) => {
      const r = await apiRequest("POST", api.nutritionPlans.create.path, data);
      return (await r.json()) as NutritionPlanFull;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: t("admin.planBuilder.toast.created", "Plan created") });
    },
    onError: (err: Error) =>
      toast({
        title: t("admin.planBuilder.toast.createFailed", "Failed to create plan"),
        description: err.message,
        variant: "destructive",
      }),
  });
}

export function useUpdateNutritionPlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateNutritionPlanInput) => {
      const url = buildUrl(api.nutritionPlans.update.path, { id });
      const r = await apiRequest("PATCH", url, data);
      return (await r.json()) as NutritionPlanFull;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: [LIST] });
      qc.invalidateQueries({ queryKey: [api.nutritionPlans.get.path, p.id] });
      qc.invalidateQueries({ queryKey: [api.nutritionPlans.mine.path] });
      toast({ title: t("admin.planBuilder.toast.saved", "Plan saved") });
    },
    onError: (err: Error) =>
      toast({
        title: t("admin.planBuilder.toast.saveFailed", "Failed to save plan"),
        description: err.message,
        variant: "destructive",
      }),
  });
}

export function useDeleteNutritionPlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.nutritionPlans.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      qc.invalidateQueries({ queryKey: [api.nutritionPlans.mine.path] });
      toast({ title: t("admin.planBuilder.toast.deleted", "Plan deleted") });
    },
    onError: (err: Error) =>
      toast({
        title: t("admin.planBuilder.toast.deleteFailed", "Failed to delete plan"),
        description: err.message,
        variant: "destructive",
      }),
  });
}

export function useDuplicateNutritionPlan() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.nutritionPlans.duplicate.path, { id });
      const r = await apiRequest("POST", url);
      return (await r.json()) as NutritionPlanFull;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: t("admin.planBuilder.toast.duplicated", "Plan duplicated") });
    },
    onError: (err: Error) =>
      toast({
        title: t("admin.planBuilder.toast.duplicateFailed", "Failed to duplicate plan"),
        description: err.message,
        variant: "destructive",
      }),
  });
}
