import { useQuery } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { UserResponse } from "@shared/schema";

export function useClients() {
  return useQuery<UserResponse[]>({
    queryKey: [api.users.list.path],
    queryFn: async () => {
      const res = await fetch(api.users.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch clients");
      return res.json();
    },
  });
}
