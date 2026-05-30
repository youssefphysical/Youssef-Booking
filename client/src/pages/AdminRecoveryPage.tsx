import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { CalendarClock, CheckCircle2, Archive, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useFeatureFlag } from "@/lib/featureFlags";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AdminEmptyState, AdminPageHeader } from "@/components/admin/primitives";
import NotFound from "@/pages/not-found";

type RecoveryRow = {
  id: number;
  userId: number;
  serviceType: string;
  status: string;
  notes: string | null;
  scheduledFor: string | null;
  assignedAdminId: number | null;
  createdAt: string;
};

type ClientUser = { id: number; fullName: string; phone: string | null };

export default function AdminRecoveryPage() {
  const { t } = useTranslation();
  const enabled = useFeatureFlag("recovery_enabled", true);
  const { toast } = useToast();
  const [scheduling, setScheduling] = useState<RecoveryRow | null>(null);
  const [scheduledFor, setScheduledFor] = useState<string>("");

  const [location] = useLocation();
  const isActive = location === "/admin/recovery";
  const { data: rows, isLoading } = useQuery<RecoveryRow[]>({
    queryKey: ["/api/recovery-requests"],
    enabled,
    refetchInterval: isActive ? 60_000 : false,
  });
  const { data: users } = useQuery<ClientUser[]>({ queryKey: ["/api/users"] });
  const nameById = (id: number) => users?.find((u) => u.id === id)?.fullName ?? `#${id}`;

  const update = useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: Record<string, any> }) => {
      const res = await apiRequest("PATCH", `/api/admin/recovery-requests/${id}`, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recovery-requests"] });
      setScheduling(null);
      setScheduledFor("");
    },
    onError: (err: any) => {
      toast({
        title: t("common.error", "Something went wrong"),
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!enabled) return <NotFound />;

  const sorted = [...(rows ?? [])].sort((a, b) => {
    const order = (s: string) => ({ pending: 0, scheduled: 1, completed: 2, archived: 3 } as any)[s] ?? 99;
    return order(a.status) - order(b.status);
  });

  return (
    <div className="admin-shell">
      <div className="admin-container space-y-5" data-testid="page-admin-recovery">
      <AdminPageHeader
        eyebrow="Recovery"
        title={t("admin.recovery.title", "Recovery requests")}
        subtitle={t("admin.recovery.subtitle", "Schedule and complete client recovery / mobility requests.")}
      />

      {isLoading ? (
        <div className="admin-shimmer h-24 rounded-2xl" />
      ) : sorted.length === 0 ? (
        <AdminEmptyState
          icon={<CalendarClock size={26} />}
          title={t("admin.recovery.empty", "No recovery requests yet.")}
          body={t("admin.recovery.emptyHint", "New requests from clients will appear here.")}
          testId="empty-recovery"
        />
      ) : (
        <ul className="space-y-3">
          {sorted.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-white/[0.06] bg-card/60 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              data-testid={`row-recovery-${r.id}`}
            >
              <div className="space-y-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold">{nameById(r.userId)}</span>
                  <span className="text-primary text-[11px] uppercase tracking-wide">
                    {t(`recovery.services.${r.serviceType}.name`, r.serviceType)}
                  </span>
                  <span className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
                    r.status === "pending" ? "bg-amber-500/10 text-amber-200" :
                    r.status === "scheduled" ? "bg-cyan-500/10 text-cyan-200" :
                    r.status === "completed" ? "bg-emerald-500/10 text-emerald-200" :
                    "bg-white/[0.06] text-foreground/50"
                  }`}>
                    {t(`recovery.status.${r.status}`, r.status)}
                  </span>
                </div>
                {r.notes && <p className="text-sm text-foreground/70">{r.notes}</p>}
                {r.scheduledFor && (
                  <p className="text-xs text-foreground/60">
                    {t("admin.recovery.scheduledFor", "Scheduled for")}: {new Date(r.scheduledFor).toLocaleString()}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2 shrink-0">
                {r.status !== "completed" && r.status !== "archived" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => {
                      setScheduling(r);
                      setScheduledFor(
                        r.scheduledFor ? new Date(r.scheduledFor).toISOString().slice(0, 16) : "",
                      );
                    }}
                    data-testid={`button-schedule-${r.id}`}
                  >
                    <CalendarClock size={14} className="mr-1" />
                    {t("admin.recovery.schedule", "Schedule")}
                  </Button>
                )}
                {r.status !== "completed" && r.status !== "archived" && (
                  <Button
                    size="sm"
                    onClick={() => update.mutate({ id: r.id, patch: { status: "completed" } })}
                    disabled={update.isPending}
                    data-testid={`button-complete-${r.id}`}
                  >
                    <CheckCircle2 size={14} className="mr-1" />
                    {t("admin.recovery.complete", "Complete")}
                  </Button>
                )}
                {r.status !== "archived" && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => update.mutate({ id: r.id, patch: { status: "archived" } })}
                    disabled={update.isPending}
                    data-testid={`button-archive-${r.id}`}
                  >
                    <Archive size={14} className="mr-1" />
                    {t("admin.recovery.archive", "Archive")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={!!scheduling} onOpenChange={(o) => !o && setScheduling(null)}>
        <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("admin.recovery.scheduleTitle", "Schedule recovery session")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-foreground/70">
              {t("admin.recovery.pickDatetime", "Pick date & time")}
            </label>
            <Input
              type="datetime-local"
              value={scheduledFor}
              onChange={(e) => setScheduledFor(e.target.value)}
              data-testid="input-schedule-datetime"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setScheduling(null)} data-testid="button-schedule-cancel">
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              disabled={!scheduledFor || update.isPending}
              onClick={() =>
                scheduling &&
                update.mutate({
                  id: scheduling.id,
                  patch: {
                    status: "scheduled",
                    scheduledFor: new Date(scheduledFor).toISOString(),
                  },
                })
              }
              data-testid="button-schedule-confirm"
            >
              {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("admin.recovery.scheduleConfirm", "Schedule")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
      </div>
  );
}
