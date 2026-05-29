import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Wrench } from "lucide-react";

export function RepairExpiredSessions() {
  const { toast } = useToast();

  const status = useQuery<{
    lastRun: { at: number; source: string; result: { completed: number; deducted: number; scanned: number } } | null;
    pendingExpired: number;
    serverNow: string;
    dubaiNow: string;
    cronStale: boolean | null;
    env: { cronSecretSet: boolean; publicAppUrlSet: boolean; nodeEnv: string | null };
  }>({
    queryKey: ["/api/admin/auto-complete-status"],
    refetchInterval: 2 * 60_000,
    staleTime: 60_000,
  });

  const m = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/bookings/auto-complete-now");
      return (await r.json()) as { ok: boolean; completed: number; deducted: number; notified: number; errors: any[] };
    },
    onSuccess: (data) => {
      toast({
        title: "Repair complete",
        description: `${data.completed} session${data.completed === 1 ? "" : "s"} completed, ${data.deducted} package credit${data.deducted === 1 ? "" : "s"} deducted.`,
      });
      queryClient.invalidateQueries({ queryKey: ["/api/bookings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/auto-complete-status"] });
    },
    onError: (e: any) => {
      toast({ title: "Repair failed", description: e?.message || "Unknown error", variant: "destructive" });
    },
  });

  const lastRunLabel = (() => {
    const at = status.data?.lastRun?.at;
    if (!at) return "never (waiting for first run)";
    const ms = Date.now() - at;
    if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
    if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
    return `${Math.round(ms / 3_600_000)}h ago`;
  })();

  const sourceLabel = (() => {
    const s = status.data?.lastRun?.source;
    if (s === "cron") return "scheduled cron";
    if (s === "backstop") return "on-read backstop";
    if (s === "admin-manual") return "manual repair";
    return null;
  })();

  return (
    <div className="space-y-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="w-full h-9 text-xs gap-2"
        onClick={() => m.mutate()}
        disabled={m.isPending}
        data-testid="button-repair-expired-sessions"
      >
        <Wrench size={13} />
        {m.isPending ? "Repairing…" : "Repair expired sessions now"}
      </Button>
      <p className="text-[10.5px] text-muted-foreground leading-relaxed">
        Force-completes any past sessions still showing as Upcoming and deducts the package credit once.
      </p>
      <p
        className="text-[10.5px] text-muted-foreground/70 leading-relaxed tabular-nums"
        data-testid="text-auto-complete-last-run"
      >
        Last auto-complete: {lastRunLabel}
        {sourceLabel ? ` · ${sourceLabel}` : ""}
        {status.data?.lastRun ? ` · ${status.data.lastRun.result.completed} completed` : ""}
      </p>
      {status.data && (
        (status.data.pendingExpired > 0 ||
          status.data.cronStale === true ||
          !status.data.env.cronSecretSet ||
          !status.data.env.publicAppUrlSet) && (
          <div className="pt-2 border-t border-white/[0.04] space-y-1" data-testid="diagnostics-block">
            {status.data.pendingExpired > 0 && (
              <p className="text-[10.5px] text-cyan-300/80 leading-relaxed">
                {status.data.pendingExpired} expired session{status.data.pendingExpired === 1 ? "" : "s"} pending auto-complete.
              </p>
            )}
            {status.data.cronStale === true && (
              <p className="text-[10.5px] text-rose-300/80 leading-relaxed">
                Cron looks stale (no scheduled run in 30+ min). Check GitHub Actions.
              </p>
            )}
            {!status.data.env.cronSecretSet && (
              <p className="text-[10.5px] text-rose-300/80 leading-relaxed">
                CRON_SECRET not set on server — external cron will be rejected.
              </p>
            )}
            {!status.data.env.publicAppUrlSet && (
              <p className="text-[10.5px] text-rose-300/80 leading-relaxed">
                PUBLIC_APP_URL not set on server.
              </p>
            )}
          </div>
        )
      )}
      {status.data?.dubaiNow && (
        <p className="text-[10px] text-muted-foreground/50 tabular-nums" data-testid="text-dubai-time">
          Dubai now: {status.data.dubaiNow}
        </p>
      )}
    </div>
  );
}
