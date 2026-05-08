import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientNotification } from "@shared/schema";

// =============================
// P5a — Client notifications hooks
// =============================
// Query keys are SEGMENTED arrays so prefix invalidation
// (`['/api/me/notifications']`) matches every list variant. The list
// queries provide their own queryFn because the default fetcher would
// otherwise join the params object into the URL path.

const LIST_PREFIX = "/api/me/notifications";
const COUNT_KEY = ["/api/me/notifications/unread-count"] as const;

type ListParams = { unreadOnly?: boolean; limit?: number };

function buildListUrl(params: ListParams) {
  const qs = new URLSearchParams();
  if (params.unreadOnly) qs.set("unreadOnly", "true");
  if (params.limit) qs.set("limit", String(params.limit));
  const s = qs.toString();
  return s ? `${LIST_PREFIX}?${s}` : LIST_PREFIX;
}

export function useNotifications(params: ListParams = {}) {
  return useQuery<ClientNotification[]>({
    queryKey: [LIST_PREFIX, params],
    queryFn: async () => {
      const r = await fetch(buildListUrl(params), { credentials: "include" });
      if (!r.ok) throw new Error(`Failed to load notifications (${r.status})`);
      return r.json();
    },
  });
}

export function useUnreadNotificationCount() {
  return useQuery<{ count: number }>({
    queryKey: COUNT_KEY,
    refetchInterval: 60_000,
  });
}

function invalidate() {
  // Prefix match — covers every variant of useNotifications regardless of params.
  queryClient.invalidateQueries({ queryKey: [LIST_PREFIX] });
  queryClient.invalidateQueries({ queryKey: COUNT_KEY });
}

export function useMarkNotificationRead() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/me/notifications/${id}/read`);
    },
    // Optimistic clear so the unread dot disappears immediately even
    // before the refetch lands.
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: [LIST_PREFIX] });
      const now = new Date().toISOString();
      queryClient.setQueriesData<ClientNotification[]>({ queryKey: [LIST_PREFIX] }, (old) =>
        old?.map((n) => (n.id === id && !n.readAt ? { ...n, readAt: now as any } : n)) ?? old,
      );
      const prevCount = queryClient.getQueryData<{ count: number }>(COUNT_KEY);
      if (prevCount && prevCount.count > 0) {
        queryClient.setQueryData(COUNT_KEY, { count: prevCount.count - 1 });
      }
    },
    onSettled: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/me/notifications/read-all");
    },
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: [LIST_PREFIX] });
      const now = new Date().toISOString();
      queryClient.setQueriesData<ClientNotification[]>({ queryKey: [LIST_PREFIX] }, (old) =>
        old?.map((n) => (n.readAt ? n : { ...n, readAt: now as any })) ?? old,
      );
      queryClient.setQueryData(COUNT_KEY, { count: 0 });
    },
    onSettled: invalidate,
  });
}
