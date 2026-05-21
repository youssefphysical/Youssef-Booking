import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Eye, LogOut } from "lucide-react";

/**
 * Task #57 — sticky banner shown whenever an admin is viewing the
 * app as a client (impersonation session). The middleware on the
 * server makes the entire surface read-only, so the only sensible
 * action from here is "Exit" — restores the real admin session and
 * navigates back to /admin/clients. Mounted globally in App.tsx so
 * it overlays every route while active.
 */
export function ImpersonationBanner() {
  const { user } = useAuth();
  const impersonatedByAdminId = (user as any)?.impersonatedByAdminId;
  if (!user || !impersonatedByAdminId) return null;

  async function onExit() {
    try {
      await apiRequest("POST", "/api/admin/impersonate/exit");
    } catch {
      /* ignore — we still clear the cache below */
    }
    queryClient.clear();
    window.location.assign("/admin/clients");
  }

  return (
    <div
      className="sticky top-0 z-[100] w-full bg-amber-400/15 backdrop-blur-md border-b border-amber-300/40 text-amber-200"
      data-testid="impersonation-banner"
      role="status"
    >
      <div className="max-w-7xl mx-auto px-3 sm:px-5 py-2 flex items-center gap-3">
        <Eye size={14} className="shrink-0" />
        <p className="text-[12px] sm:text-[13px] font-medium leading-tight flex-1 truncate">
          Viewing as{" "}
          <span className="font-semibold">
            {(user as any).fullName || (user as any).email}
          </span>
          {" "}— read-only.
        </p>
        <button
          type="button"
          onClick={onExit}
          data-testid="button-impersonate-exit"
          className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-3 h-7 rounded-md bg-amber-300/20 hover:bg-amber-300/30 transition-colors"
        >
          <LogOut size={12} /> Exit
        </button>
      </div>
    </div>
  );
}
