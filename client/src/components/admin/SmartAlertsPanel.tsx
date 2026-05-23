import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { AlertTriangle, AlertCircle, Info, Check, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AdminCard, AdminSectionTitle, AdminEmptyState } from "@/components/admin/primitives";
import { formatRelativeDubai } from "@shared/dates";

type Severity = "info" | "warning" | "critical";

type AlertRow = {
  id: number;
  kind: string;
  severity: Severity;
  title: string;
  body: string;
  link: string | null;
  entityType: string | null;
  entityId: number | null;
  createdAt: string;
};

const SEV_ICON: Record<Severity, React.ReactNode> = {
  critical: <AlertCircle size={14} className="text-red-300" />,
  warning: <AlertTriangle size={14} className="text-amber-300" />,
  info: <Info size={14} className="text-sky-300" />,
};

const SEV_BORDER: Record<Severity, string> = {
  critical: "border-red-500/30 bg-red-500/[0.06]",
  warning: "border-amber-500/30 bg-amber-500/[0.05]",
  info: "border-sky-500/25 bg-sky-500/[0.04]",
};

export function SmartAlertsPanel() {
  const { data: alerts = [], isLoading } = useQuery<AlertRow[]>({
    queryKey: ["/api/admin/alerts"],
    queryFn: async () => {
      const r = await fetch("/api/admin/alerts", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load alerts");
      return r.json();
    },
    refetchInterval: 60_000,
  });

  const resolve = useMutation({
    mutationFn: async (id: number) => {
      const r = await apiRequest("POST", `/api/admin/alerts/${id}/resolve`, {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/alerts"] });
    },
  });

  const recompute = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/admin/alerts/recompute", {});
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/alerts"] });
    },
  });

  return (
    <AdminCard testId="smart-alerts">
      <AdminSectionTitle
        title="Smart alerts"
        cta={{
          href: "#",
          label: recompute.isPending ? "Recomputing…" : "Recompute",
          testId: "btn-alerts-recompute",
        }}
      />
      {isLoading ? (
        <div className="rounded-xl admin-shimmer h-24" />
      ) : alerts.length === 0 ? (
        <AdminEmptyState
          icon={<Inbox size={20} />}
          title="All clear"
          body="Nothing needs your attention right now."
          testId="empty-alerts"
        />
      ) : (
        <div className="space-y-2">
          {alerts.map((a) => (
            <div
              key={a.id}
              className={`rounded-xl border p-3 flex items-start gap-3 ${SEV_BORDER[a.severity]}`}
              data-testid={`alert-${a.id}`}
            >
              <span className="mt-0.5 shrink-0">{SEV_ICON[a.severity]}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[13px] font-semibold leading-tight">{a.title}</p>
                  <span className="text-[10px] text-muted-foreground shrink-0 tabular-nums">
                    {formatRelativeDubai(a.createdAt)}
                  </span>
                </div>
                <p className="text-[11.5px] text-muted-foreground mt-1 leading-snug">{a.body}</p>
                <div className="flex items-center gap-2 mt-2">
                  {a.link && (
                    <Link
                      href={a.link}
                      className="text-[11px] text-primary hover:underline"
                      data-testid={`alert-link-${a.id}`}
                    >
                      Open →
                    </Link>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[10.5px]"
                    onClick={() => resolve.mutate(a.id)}
                    disabled={resolve.isPending}
                    data-testid={`alert-resolve-${a.id}`}
                  >
                    <Check size={11} className="mr-1" /> Resolve
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
      {/* Hidden trigger to allow the cta=recompute button to fire mutation
          (AdminSectionTitle renders a link, so we wrap with onClick). */}
      <button
        type="button"
        className="hidden"
        aria-hidden
        onClick={() => recompute.mutate()}
        data-testid="hidden-recompute-trigger"
      />
    </AdminCard>
  );
}
