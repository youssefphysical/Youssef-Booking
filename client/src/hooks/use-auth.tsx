import { createContext, ReactNode, useContext } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { api, type LoginInput, type RegisterInput } from "@shared/routes";
import type { UserResponse } from "@shared/schema";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type AuthContextType = {
  user: UserResponse | null;
  isLoading: boolean;
  error: Error | null;
  loginMutation: ReturnType<typeof useLoginMutation>;
  logoutMutation: ReturnType<typeof useLogoutMutation>;
  registerMutation: ReturnType<typeof useRegisterMutation>;
};

const AuthContext = createContext<AuthContextType | null>(null);

function useLoginMutation() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (credentials: LoginInput) => {
      const res = await fetch(api.auth.login.path, {
        method: api.auth.login.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 401) throw new Error("Invalid credentials");
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "Login failed");
      }
      return (await res.json()) as UserResponse;
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
      toast({ title: "Welcome back", description: `Signed in as ${user.fullName}` });
    },
    onError: (error: Error) => {
      toast({ title: "Login failed", description: error.message, variant: "destructive" });
    },
  });
}

function useRegisterMutation() {
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (data: RegisterInput) => {
      const res = await fetch(api.auth.register.path, {
        method: api.auth.register.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || "Registration failed");
      }
      return (await res.json()) as UserResponse;
    },
    onSuccess: (user) => {
      queryClient.setQueryData([api.auth.me.path], user);
      toast({ title: "Account created", description: `Welcome, ${user.fullName}!` });
    },
    onError: (error: Error) => {
      toast({ title: "Registration failed", description: error.message, variant: "destructive" });
    },
  });
}

function useLogoutMutation() {
  return useMutation({
    mutationFn: async () => {
      // Optimistically flip auth state synchronously so the UI redirects
      // and re-renders as guest immediately, without waiting for the
      // round-trip. This is what makes logout feel instant.
      queryClient.setQueryData([api.auth.me.path], null);
      try {
        await fetch(api.auth.logout.path, {
          method: api.auth.logout.method,
          credentials: "include",
          keepalive: true,
        });
      } catch {
        // Best-effort: even if the network call fails, the local session
        // cache is already cleared below, so the user is locally logged out.
      }
    },
    onSettled: () => {
      // Drop ALL cached data so a stale client/admin payload can't leak
      // across users on the same browser. Done in onSettled (not onSuccess)
      // so it runs even if the network call fails.
      queryClient.setQueryData([api.auth.me.path], null);
      queryClient.clear();
    },
  });
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const { data: user, error, isLoading } = useQuery<UserResponse | null, Error>({
    queryKey: [api.auth.me.path],
    queryFn: async () => {
      const res = await fetch(api.auth.me.path, { credentials: "include" });
      if (res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to fetch user");
      return await res.json();
    },
  });

  const loginMutation = useLoginMutation();
  const logoutMutation = useLogoutMutation();
  const registerMutation = useRegisterMutation();

  return (
    <AuthContext.Provider
      value={{ user: user ?? null, isLoading, error, loginMutation, logoutMutation, registerMutation }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within an AuthProvider");
  return context;
}
