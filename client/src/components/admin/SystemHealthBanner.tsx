import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Activity, ChevronRight } from "lucide-react";

type Health = {
  degraded: boolean;
  failureKinds: string[];
  rows: Array<{
    kind: string;
    consecutiveFailures: number;
    lastFailureAt: string | null;
  }>;
};

export function SystemHealthBanner() {
  const { data } = useQuery<Health>({
    queryKey: ["/api/admin/system-health"],
    queryFn: async () => {
      const r = await fetch("/api/admin/system-health", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load system health");
      return r.json();
    },
    refetchInterval: 120_000,
  });

  if (!data?.degraded) return null;

  return (
    <Link
      href="/admin/business-health"
      className="block rounded-2xl border border-red-500/40 bg-red-500/[0.08] p-3 sm:p-4 mb-3 sm:mb-4 hover:bg-red-500/[0.12] transition-colors"
      data-testid="system-health-banner"
    >
      <div className="flex items-center gap-3">
        <span className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center shrink-0">
          <Activity size={16} className="text-red-300" />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-red-300/90">
            System degraded
          </p>
          <p className="text-[12px] sm:text-[13px] text-red-100 mt-0.5 truncate">
            {data.failureKinds.length} subsystem
            {data.failureKinds.length === 1 ? "" : "s"} reporting failures:{" "}
            <span className="font-mono text-[11px]">{data.failureKinds.join(", ")}</span>
          </p>
        </div>
        <ChevronRight size={14} className="text-red-300 shrink-0" />
      </div>
    </Link>
  );
}
