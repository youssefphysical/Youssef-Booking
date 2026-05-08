import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { ClientNotification } from "@shared/schema";

const LIST_KEY = ["/api/me/notifications"] as const;
const COUNT_KEY = ["/api/me/notifications/unread-count"] as const;

export function useNotifications(opts?: { unreadOnly?: boolean; limit?: number }) {
  const params = new URLSearchParams();
  if (opts?.unreadOnly) params.set("unreadOnly", "true");
  if (opts?.limit) params.set("limit", String(opts.limit));
  const qs = params.toString();
  const url = qs ? `/api/me/notifications?${qs}` : "/api/me/notifications";
  return useQuery<ClientNotification[]>({ queryKey: [url] });
}

export function useUnreadNotificationCount() {
  return useQuery<{ count: number }>({
    queryKey: COUNT_KEY,
    refetchInterval: 60_000,
  });
}

function invalidate() {
  queryClient.invalidateQueries({ queryKey: LIST_KEY });
  queryClient.invalidateQueries({ queryKey: COUNT_KEY });
  queryClient.invalidateQueries({ queryKey: ["/api/me/notifications?unreadOnly=true"] });
}

export function useMarkNotificationRead() {
  return useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("POST", `/api/me/notifications/${id}/read`);
    },
    onSuccess: invalidate,
  });
}

export function useMarkAllNotificationsRead() {
  return useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/me/notifications/read-all");
    },
    onSuccess: invalidate,
  });
}
