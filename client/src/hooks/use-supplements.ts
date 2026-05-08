import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type {
  Supplement,
  InsertSupplement,
  UpdateSupplement,
  SupplementStackFull,
  InsertSupplementStack,
  UpdateSupplementStack,
  ClientSupplement,
  InsertClientSupplement,
  UpdateClientSupplement,
  ApplyStackToClientInput,
} from "@shared/schema";

const LIB = api.supplements.list.path;
const STACKS = api.supplementStacks.list.path;
const CS = api.clientSupplements.list.path;
const ME = api.clientSupplements.mine.path;

// ============ LIBRARY ============
export function useSupplements(opts: { activeOnly?: boolean; enabled?: boolean } = {}) {
  return useQuery<Supplement[]>({
    queryKey: [LIB, { activeOnly: !!opts.activeOnly }],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const url = opts.activeOnly ? `${LIB}?activeOnly=true` : LIB;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load supplements");
      return res.json();
    },
  });
}

export function useCreateSupplement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertSupplement) => {
      const res = await apiRequest("POST", api.supplements.create.path, data);
      return (await res.json()) as Supplement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIB] });
      toast({ title: "Supplement added" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to add", description: err.message, variant: "destructive" }),
  });
}

export function useUpdateSupplement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateSupplement) => {
      const url = buildUrl(api.supplements.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return (await res.json()) as Supplement;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIB] });
      toast({ title: "Saved" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteSupplement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.supplements.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [LIB] });
      toast({ title: "Deleted" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

// ============ STACKS ============
export function useSupplementStacks(opts: { activeOnly?: boolean; enabled?: boolean } = {}) {
  return useQuery<SupplementStackFull[]>({
    queryKey: [STACKS, { activeOnly: !!opts.activeOnly }],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const url = opts.activeOnly ? `${STACKS}?activeOnly=true` : STACKS;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load stacks");
      return res.json();
    },
  });
}

export function useCreateSupplementStack() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertSupplementStack) => {
      const res = await apiRequest("POST", api.supplementStacks.create.path, data);
      return (await res.json()) as SupplementStackFull;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STACKS] });
      toast({ title: "Stack created" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

export function useUpdateSupplementStack() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateSupplementStack) => {
      const url = buildUrl(api.supplementStacks.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return (await res.json()) as SupplementStackFull;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STACKS] });
      toast({ title: "Saved" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteSupplementStack() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.supplementStacks.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [STACKS] });
      toast({ title: "Deleted" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

// ============ PER-CLIENT ASSIGNMENTS ============
export function useClientSupplements(userId: number | undefined, opts: { enabled?: boolean } = {}) {
  return useQuery<ClientSupplement[]>({
    queryKey: [CS, userId],
    enabled: (opts.enabled ?? true) && !!userId,
    queryFn: async () => {
      const res = await fetch(`${CS}?userId=${userId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load client supplements");
      return res.json();
    },
  });
}

export function useMySupplements(opts: { enabled?: boolean } = {}) {
  return useQuery<ClientSupplement[]>({
    queryKey: [ME],
    enabled: opts.enabled ?? true,
    queryFn: async () => {
      const res = await fetch(ME, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load supplements");
      return res.json();
    },
  });
}

export function useCreateClientSupplement() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: InsertClientSupplement) => {
      const res = await apiRequest("POST", api.clientSupplements.create.path, data);
      return (await res.json()) as ClientSupplement;
    },
    onSuccess: (row) => {
      qc.invalidateQueries({ queryKey: [CS, row.userId] });
      qc.invalidateQueries({ queryKey: [ME] });
      toast({ title: "Supplement assigned" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

export function useUpdateClientSupplement(userId?: number) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: number } & UpdateClientSupplement) => {
      const url = buildUrl(api.clientSupplements.update.path, { id });
      const res = await apiRequest("PATCH", url, data);
      return (await res.json()) as ClientSupplement;
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: [CS, userId] });
      qc.invalidateQueries({ queryKey: [CS] });
      qc.invalidateQueries({ queryKey: [ME] });
      toast({ title: "Saved" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

export function useDeleteClientSupplement(userId?: number) {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: number) => {
      const url = buildUrl(api.clientSupplements.delete.path, { id });
      await apiRequest("DELETE", url);
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: [CS, userId] });
      qc.invalidateQueries({ queryKey: [CS] });
      qc.invalidateQueries({ queryKey: [ME] });
      toast({ title: "Removed" });
    },
    onError: (err: Error) =>
      toast({ title: "Failed", description: err.message, variant: "destructive" }),
  });
}

export function useApplyStackToClient() {
  const qc = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: ApplyStackToClientInput) => {
      const res = await apiRequest("POST", api.clientSupplements.applyStack.path, data);
      return (await res.json()) as ClientSupplement[];
    },
    onSuccess: (rows) => {
      const userId = rows[0]?.userId;
      if (userId) qc.invalidateQueries({ queryKey: [CS, userId] });
      qc.invalidateQueries({ queryKey: [CS] });
      qc.invalidateQueries({ queryKey: [ME] });
      toast({ title: `Applied stack — ${rows.length} supplements added` });
    },
    onError: (err: Error) =>
      toast({ title: "Failed to apply stack", description: err.message, variant: "destructive" }),
  });
}
