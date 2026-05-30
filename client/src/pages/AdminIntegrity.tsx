import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AdminPageHeader,
  AdminCard,
  AdminEmptyState,
  AdminSkeletonStack,
} from "@/components/admin/primitives";
import { AlertTriangle, ShieldCheck, ChevronRight, Info, AlertOctagon, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Warning = {
  category: string;
  severity: "info" | "warning" | "critical";
  count: number;
  samples: Array<{ id: number; label: string; link: string }>;
  showAllLink?: string | null;
};

type Payload = { warnings: Warning[]; generatedAt: string };

const SEVERITY_STYLES: Record<Warning["severity"], { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  info: { bg: "bg-sky-500/15", text: "text-sky-300", icon: <Info size={16} />, label: "Info" },
  warning: { bg: "bg-amber-500/15", text: "text-amber-300", icon: <AlertTriangle size={16} />, label: "Warning" },
  critical: { bg: "bg-red-500/15", text: "text-red-300", icon: <AlertOctagon size={16} />, label: "Critical" },
};

export default function AdminIntegrity() {
  const { data, isLoading, error, refetch, isFetching, dataUpdatedAt } = useQuery<Payload>({
    queryKey: ["/api/admin/integrity"],
    staleTime: 60_000,
  });

  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="admin-shell">
      <div className="admin-container space-y-5">
      <div className="flex items-start justify-between gap-3">
        <AdminPageHeader
          eyebrow="Data integrity"
          title="Integrity checker"
          subtitle="Read-only audit of cross-table inconsistencies. Click any row to investigate."
        />
        <div className="flex items-center gap-2 shrink-0 pt-1">
          {updatedLabel && (
            <span className="text-[11px] text-muted-foreground hidden sm:block" data-testid="text-integrity-updated-at">
              Checked {updatedLabel}
            </span>
          )}
          <button
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
            data-testid="button-refresh-integrity"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>
      </div>

      {isLoading ? (
        <AdminSkeletonStack count={5} height="h-24" />
      ) : error ? (
        <AdminCard testId="card-integrity-error">
          <div className="flex items-start gap-4 py-1">
            <span className="shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500/10 text-amber-400">
              <RefreshCw size={18} />
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold" data-testid="text-integrity-error">
                Could not load integrity report
              </p>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                This is usually transient. Refresh to try again.
              </p>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                data-testid="button-retry-integrity"
                className="inline-flex items-center gap-1.5 h-8 px-3 mt-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
                Try again
              </button>
            </div>
          </div>
        </AdminCard>
      ) : !data?.warnings?.length ? (
        <AdminEmptyState
          icon={<ShieldCheck size={28} />}
          title="All clean"
          body="No integrity warnings detected."
          testId="empty-integrity"
        />
      ) : (
        <div className="space-y-4">
          {(data?.warnings ?? []).map((w) => {
            const s = SEVERITY_STYLES[w.severity];
            return (
              <AdminCard key={w.category} testId={`section-${w.category.toLowerCase().replace(/\s+/g, "-")}`}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("inline-flex items-center justify-center w-8 h-8 rounded-lg", s.bg, s.text)}>
                      {s.icon}
                    </span>
                    <div className="min-w-0">
                      <h3 className="font-display font-bold text-[14.5px] leading-tight truncate">
                        {w.category}
                      </h3>
                      <p className={cn("text-[11px] mt-0.5", s.text)}>
                        {s.label} · {w.count} affected
                      </p>
                    </div>
                  </div>
                  <span
                    className="font-display font-bold text-[22px] tabular-nums shrink-0"
                    data-testid={`count-${w.category.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    {w.count}
                  </span>
                </div>
                <div className="divide-y divide-white/5 border-t border-white/5 -mx-3.5 sm:-mx-5">
                  {w.samples.map((sample) => (
                    <Link
                      key={`${w.category}-${sample.id}`}
                      href={sample.link}
                      data-testid={`integrity-sample-${sample.id}`}
                      className="flex items-center justify-between gap-2 px-3.5 sm:px-5 py-2.5 hover:bg-white/[0.04] text-[12.5px]"
                    >
                      <span className="truncate">{sample.label}</span>
                      <ChevronRight size={14} className="text-muted-foreground/70 shrink-0 rtl:rotate-180" />
                    </Link>
                  ))}
                  {w.count > w.samples.length || w.showAllLink ? (
                    <div className="px-3.5 sm:px-5 py-2 text-[11px] text-muted-foreground flex items-center justify-between gap-2">
                      <span>
                        {w.count > w.samples.length
                          ? `Showing ${w.samples.length} of ${w.count}.`
                          : `Showing all ${w.count}.`}
                      </span>
                      {w.showAllLink ? (
                        <Link
                          href={w.showAllLink}
                          data-testid={`show-all-${w.category.toLowerCase().replace(/\s+/g, "-")}`}
                          className="text-primary hover:underline inline-flex items-center gap-1"
                        >
                          Show all
                          <ChevronRight size={12} className="rtl:rotate-180" />
                        </Link>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </AdminCard>
            );
          })}
        </div>
      )}

      {data?.generatedAt ? (
        <p className="text-[11px] text-muted-foreground" data-testid="text-integrity-generated-at">
          Generated {new Date(data.generatedAt).toLocaleString()}
        </p>
      ) : null}
    </div>
      </div>
  );
}
