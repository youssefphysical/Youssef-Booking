import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type UpdateInbodyInput } from "@shared/routes";
import type { InbodyRecord } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export function useInbodyRecords(opts?: { userId?: number }) {
  const params = new URLSearchParams();
  if (opts?.userId) params.set("userId", String(opts.userId));
  const qs = params.toString();
  const url = qs ? `${api.inbody.list.path}?${qs}` : api.inbody.list.path;

  return useQuery<InbodyRecord[]>({
    queryKey: [api.inbody.list.path, opts?.userId],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch InBody records");
      return res.json();
    },
  });
}

export function useUploadInbody() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (vars: { file: File; userId?: number; notes?: string }) => {
      const fd = new FormData();
      fd.append("file", vars.file);
      if (vars.userId) fd.append("userId", String(vars.userId));
      if (vars.notes) fd.append("notes", vars.notes);
      const res = await fetch(api.inbody.upload.path, {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Upload failed");
      }
      return (await res.json()) as { record: InbodyRecord; aiExtracted: boolean; message: string };
    },
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: [api.inbody.list.path] });
      toast({ title: "InBody uploaded", description: result.message });
    },
    onError: (err: Error) => toast({ title: "Upload failed", description: err.message, variant: "destructive" }),
  });
}

export function useUpdateInbody() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateInbodyInput) => {
      const url = buildUrl(api.inbody.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return (await res.json()) as InbodyRecord;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.inbody.list.path] });
      toast({ title: "InBody updated" });
    },
    onError: (err: Error) => toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteInbody() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.inbody.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [api.inbody.list.path] });
      toast({ title: "Record removed" });
    },
  });
}
