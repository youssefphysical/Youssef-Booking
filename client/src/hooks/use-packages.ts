import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type CreatePackageInput, type UpdatePackageInput } from "@shared/routes";
import type { Package, PackageWithUser } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function usePackages(opts?: { userId?: number; includeUser?: boolean }) {
  const params = new URLSearchParams();
  if (opts?.userId) params.set("userId", String(opts.userId));
  if (opts?.includeUser) params.set("includeUser", "true");
  const qs = params.toString();
  const url = qs ? `${api.packages.list.path}?${qs}` : api.packages.list.path;

  return useQuery<PackageWithUser[] | Package[]>({
    queryKey: [api.packages.list.path, opts?.userId, opts?.includeUser],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch packages");
      return res.json();
    },
  });
}

export function useCreatePackage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: CreatePackageInput) => {
      const res = await apiRequest("POST", api.packages.create.path, data);
      return (await res.json()) as Package;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.packages.list.path] });
      qc.invalidateQueries({ queryKey: [api.dashboard.stats.path] });
      toast({ title: "Package added" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

export function useUpdatePackage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdatePackageInput) => {
      const url = buildUrl(api.packages.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return (await res.json()) as Package;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.packages.list.path] });
      toast({ title: "Package updated" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

export function useDeletePackage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.packages.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.packages.list.path] });
      toast({ title: "Package removed" });
    },
  });
}
