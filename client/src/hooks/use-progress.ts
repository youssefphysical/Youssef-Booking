import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { ProgressPhoto } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function useProgressPhotos(opts?: { userId?: number }) {
  const params = new URLSearchParams();
  if (opts?.userId) params.set("userId", String(opts.userId));
  const qs = params.toString();
  const url = qs ? `${api.progress.list.path}?${qs}` : api.progress.list.path;

  return useQuery<ProgressPhoto[]>({
    queryKey: [api.progress.list.path, opts?.userId],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch progress photos");
      return res.json();
    },
  });
}

export function useUploadProgressPhoto() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: { file: File; userId?: number; type?: "before" | "current" | "after"; viewAngle?: "front" | "side" | "back"; notes?: string }) => {
      const fd = new FormData();
      fd.append("file", vars.file);
      if (vars.userId) fd.append("userId", String(vars.userId));
      if (vars.type) fd.append("type", vars.type);
      if (vars.viewAngle) fd.append("viewAngle", vars.viewAngle);
      if (vars.notes) fd.append("notes", vars.notes);
      const res = await fetch(api.progress.upload.path, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed");
      }
      return (await res.json()) as ProgressPhoto;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.progress.list.path] });
      toast({ title: "Progress photo added" });
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteProgressPhoto() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.progress.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.progress.list.path] });
      toast({ title: "Photo removed" });
    },
  });
}
