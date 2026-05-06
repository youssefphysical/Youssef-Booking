import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  api,
  buildUrl,
  type CreatePackageTemplateInput,
  type UpdatePackageTemplateInput,
} from "@shared/routes";
import type { PackageTemplate } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const LIST = api.packageTemplates.list.path;

export function usePackageTemplates(opts?: { activeOnly?: boolean }) {
  const url = opts?.activeOnly ? `${LIST}?activeOnly=true` : LIST;
  return useQuery<PackageTemplate[]>({
    queryKey: [LIST, opts?.activeOnly ?? false],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load package templates");
      return res.json();
    },
  });
}

export function useCreatePackageTemplate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: CreatePackageTemplateInput) => {
      const res = await apiRequest("POST", api.packageTemplates.create.path, data);
      return (await res.json()) as PackageTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: "Package created" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to create", description: err.message, variant: "destructive" }),
  });
}

export function useUpdatePackageTemplate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdatePackageTemplateInput) => {
      const url = buildUrl(api.packageTemplates.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return (await res.json()) as PackageTemplate;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: "Package updated" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to update", description: err.message, variant: "destructive" }),
  });
}

export function useDeletePackageTemplate() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.packageTemplates.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIST] });
      toast({ title: "Package removed" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to delete", description: err.message, variant: "destructive" }),
  });
}
