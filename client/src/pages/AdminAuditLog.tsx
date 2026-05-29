import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { AdminCard, AdminPageHeader, AdminSectionTitle } from "@/components/admin/primitives";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Loader2, ShieldCheck, Filter, RefreshCw, Wrench, GitMerge, Activity } from "lucide-react";
import { Link } from "wouter";

type AuditEntry = {
  id: number;
  action: string;
  entityType: string;
  entityId: number | null;
  previousValue: any;
  newValue: any;
  performedByUserId: number | null;
  reason: string | null;
  createdAt: string;
  actor: { id: number; fullName: string | null; email: string | null } | null;
};

const ENTITY_OPTIONS = ["all", "user", "package", "booking", "system"] as const;

function ActionIcon({ action }: { action: string }) {
  if (action === "admin_repair_sessions") return <Wrench size={13} className="text-amber-400 shrink-0 mt-0.5" />;
  if (action === "client.merge") return <GitMerge size={13} className="text-violet-400 shrink-0 mt-0.5" />;
  return <Activity size={13} className="text-primary/60 shrink-0 mt-0.5" />;
}

function actionLabel(action: string) {
  if (action === "admin_repair_sessions") return "Repair sessions";
  if (action === "client.merge") return "Client merge";
  return action;
}
const PAGE_SIZE = 20;

export default function AdminAuditLog() {
  const [location] = useLocation();
  const isActive = location === "/admin/audit-log";
  const [entityType, setEntityType] = useState<(typeof ENTITY_OPTIONS)[number]>("all");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [detailEntry, setDetailEntry] = useState<AuditEntry | null>(null);
  const [visible, setVisible] = useState(PAGE_SIZE);

  const queryKey = useMemo(
    () =>
      entityType === "all"
        ? ["/api/admin/audit-log"]
        : ["/api/admin/audit-log", { entityType }],
    [entityType],
  );

  const { data, isLoading, isError, refetch, isFetching, dataUpdatedAt } = useQuery<AuditEntry[]>({
    queryKey,
    queryFn: async () => {
      const qs = entityType === "all" ? "" : `?entityType=${entityType}`;
      const res = await fetch(`/api/admin/audit-log${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
    refetchInterval: isActive ? false : false,
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    let filtered = list;
    if (search.trim()) {
      const needle = search.toLowerCase();
      filtered = filtered.filter((r) =>
        [r.action, r.entityType, r.reason, r.actor?.fullName, r.actor?.email, String(r.entityId ?? "")]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(needle)),
      );
    }
    if (fromDate) {
      const from = new Date(fromDate).getTime();
      filtered = filtered.filter((r) => new Date(r.createdAt).getTime() >= from);
    }
    if (toDate) {
      const to = new Date(toDate + "T23:59:59").getTime();
      filtered = filtered.filter((r) => new Date(r.createdAt).getTime() <= to);
    }
    return filtered;
  }, [data, search, fromDate, toDate]);

  const visibleRows = rows.slice(0, visible);
  const hasMore = visible < rows.length;

  const updatedLabel = dataUpdatedAt
    ? new Date(dataUpdatedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  return (
    <div className="admin-shell">
      <div className="admin-container space-y-4">
        <div className="flex items-start justify-between gap-3">
          <AdminPageHeader
            eyebrow="Audit"
            title="Audit log"
            subtitle="Admin mutations with actor, entity, and before/after snapshot."
          />
          <div className="flex items-center gap-2 shrink-0 pt-1">
            {updatedLabel && (
              <span className="text-[11px] text-muted-foreground hidden sm:block" data-testid="text-audit-updated-at">
                {updatedLabel}
              </span>
            )}
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              data-testid="button-refresh-audit"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-[12px] text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={isFetching ? "animate-spin" : ""} />
              Refresh
            </button>
          </div>
        </div>

        <AdminCard>
          <div className="space-y-3">
            {/* Entity filter + search */}
            <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
              <div className="flex items-center gap-1.5 text-muted-foreground text-[12px] shrink-0">
                <Filter size={13} /> Entity
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {ENTITY_OPTIONS.map((e) => (
                  <button
                    key={e}
                    type="button"
                    onClick={() => { setEntityType(e); setVisible(PAGE_SIZE); }}
                    data-testid={`filter-entity-${e}`}
                    className={`h-8 px-3 rounded-lg text-[11.5px] font-semibold border transition-colors ${
                      entityType === e
                        ? "bg-primary/15 text-primary border-primary/30"
                        : "bg-white/[0.03] text-muted-foreground border-white/10 hover:text-foreground"
                    }`}
                  >
                    {e === "all" ? "All" : e.charAt(0).toUpperCase() + e.slice(1)}
                  </button>
                ))}
              </div>
              <input
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setVisible(PAGE_SIZE); }}
                placeholder="Search actor, reason, action…"
                data-testid="input-audit-search"
                className="sm:ml-auto h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm w-full sm:w-64 focus:outline-none focus:border-primary/50"
              />
            </div>
            {/* Date range */}
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setVisible(PAGE_SIZE); }}
                data-testid="input-audit-from"
                className="h-8 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-[12px] focus:outline-none focus:border-primary/50"
              />
              <span className="text-[11px] text-muted-foreground uppercase tracking-wide">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setVisible(PAGE_SIZE); }}
                data-testid="input-audit-to"
                className="h-8 px-2 rounded-lg bg-white/[0.04] border border-white/10 text-[12px] focus:outline-none focus:border-primary/50"
              />
              {(fromDate || toDate) && (
                <button
                  type="button"
                  onClick={() => { setFromDate(""); setToDate(""); setVisible(PAGE_SIZE); }}
                  className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
                  data-testid="button-clear-dates"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard>
          <AdminSectionTitle title={`Recent activity ${rows.length ? `(${rows.length})` : ""}`} />
          {isLoading && (
            <div className="flex items-center gap-2 text-muted-foreground py-6">
              <Loader2 size={14} className="animate-spin" /> Loading…
            </div>
          )}
          {isError && <div className="py-6 text-rose-300">Failed to load audit log.</div>}
          {!isLoading && rows.length === 0 && (
            <div className="py-10 text-center text-muted-foreground text-sm">No entries.</div>
          )}
          <ul className="divide-y divide-white/[0.06]">
            {visibleRows.map((r) => {
              const ts = new Date(r.createdAt);
              const isMerge = r.action === "client.merge";
              const isRepair = r.action === "admin_repair_sessions";
              const mergeWinnerId = isMerge ? r.newValue?.winnerId : null;
              const mergeLoserId = isMerge ? (r.previousValue?.loserId ?? r.entityId) : null;
              return (
                <li key={r.id} data-testid={`audit-row-${r.id}`}>
                  <button
                    type="button"
                    onClick={() => setDetailEntry(r)}
                    className="w-full text-left py-2.5 flex items-start gap-3 hover:bg-white/[0.02] px-1 rounded-md"
                  >
                    <ActionIcon action={r.action} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold truncate flex items-center gap-1.5 flex-wrap">
                        <span className={isMerge ? "text-violet-400" : isRepair ? "text-amber-400" : "text-primary"}>
                          {actionLabel(r.action)}
                        </span>
                        <span className="text-muted-foreground font-normal">· {r.entityType}</span>
                        {r.entityId != null && !isMerge && (
                          <span className="text-muted-foreground font-normal">#{r.entityId}</span>
                        )}
                        {isMerge && mergeLoserId != null && mergeWinnerId != null && (
                          <span className="text-muted-foreground font-normal text-[11px]">
                            loser{" "}
                            <Link
                              href={`/admin/clients/${mergeLoserId}`}
                              className="text-violet-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`link-merge-loser-${mergeLoserId}`}
                            >
                              #{mergeLoserId}
                            </Link>
                            {" → winner "}
                            <Link
                              href={`/admin/clients/${mergeWinnerId}`}
                              className="text-violet-400 hover:underline"
                              onClick={(e) => e.stopPropagation()}
                              data-testid={`link-merge-winner-${mergeWinnerId}`}
                            >
                              #{mergeWinnerId}
                            </Link>
                          </span>
                        )}
                        {isRepair && r.newValue && (
                          <span className="text-muted-foreground font-normal text-[11px]">
                            {r.newValue.completed ?? 0} completed · {r.newValue.deducted ?? 0} deducted
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {format(ts, "MMM d, yyyy HH:mm")} ·{" "}
                        {r.actor?.fullName || r.actor?.email || (r.performedByUserId ? `User #${r.performedByUserId}` : "system")}
                        {r.entityType === "user" && r.entityId && !isMerge && (
                          <Link
                            href={`/admin/clients/${r.entityId}`}
                            className="ms-2 text-primary hover:underline"
                            onClick={(e) => e.stopPropagation()}
                            data-testid={`link-client-${r.entityId}`}
                          >
                            open client →
                          </Link>
                        )}
                      </p>
                      {r.reason && (
                        <p className="text-[11.5px] text-foreground/80 mt-1 truncate">{r.reason}</p>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground/60 shrink-0 mt-0.5 hidden sm:block">
                      View →
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {hasMore && (
            <div className="flex justify-center pt-3 border-t border-white/[0.06] mt-2">
              <button
                type="button"
                onClick={() => setVisible((v) => v + PAGE_SIZE)}
                data-testid="button-load-more-audit"
                className="h-9 px-6 rounded-xl text-sm font-semibold border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-muted-foreground hover:text-foreground transition-colors"
              >
                Load more ({rows.length - visible} remaining)
              </button>
            </div>
          )}
        </AdminCard>

        {/* Detail drawer */}
        <Dialog open={!!detailEntry} onOpenChange={(o) => !o && setDetailEntry(null)}>
          <DialogContent className="bg-card border-white/10 max-w-lg sm:rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base flex items-center gap-2">
                {detailEntry && <ActionIcon action={detailEntry.action} />}
                <span className={
                  detailEntry?.action === "client.merge" ? "text-violet-400" :
                  detailEntry?.action === "admin_repair_sessions" ? "text-amber-400" :
                  "text-primary"
                }>
                  {detailEntry ? actionLabel(detailEntry.action) : ""}
                </span>
                <span className="text-muted-foreground font-normal text-sm">
                  · {detailEntry?.entityType}{detailEntry?.entityId != null ? ` #${detailEntry.entityId}` : ""}
                </span>
              </DialogTitle>
            </DialogHeader>
            {detailEntry && (
              <div className="space-y-3">
                <p className="text-[12px] text-muted-foreground">
                  {format(new Date(detailEntry.createdAt), "MMM d, yyyy HH:mm:ss")}
                  {" · "}
                  {detailEntry.actor?.fullName || detailEntry.actor?.email || (detailEntry.performedByUserId ? `User #${detailEntry.performedByUserId}` : "system")}
                </p>
                {/* Merge: surface winner/loser IDs prominently */}
                {detailEntry.action === "client.merge" && (
                  <div className="flex items-center gap-3 rounded-lg border border-violet-400/20 bg-violet-400/5 px-3 py-2 text-[12.5px]">
                    <GitMerge size={14} className="text-violet-400 shrink-0" />
                    <span className="text-muted-foreground">
                      Loser{" "}
                      <Link
                        href={`/admin/clients/${detailEntry.previousValue?.loserId ?? detailEntry.entityId}`}
                        className="text-violet-400 hover:underline font-semibold"
                        data-testid={`link-detail-loser-${detailEntry.previousValue?.loserId ?? detailEntry.entityId}`}
                      >
                        #{detailEntry.previousValue?.loserId ?? detailEntry.entityId}
                      </Link>
                      {" merged into winner "}
                      <Link
                        href={`/admin/clients/${detailEntry.newValue?.winnerId}`}
                        className="text-violet-400 hover:underline font-semibold"
                        data-testid={`link-detail-winner-${detailEntry.newValue?.winnerId}`}
                      >
                        #{detailEntry.newValue?.winnerId}
                      </Link>
                    </span>
                  </div>
                )}
                {/* Repair: surface completed/deducted counts prominently */}
                {detailEntry.action === "admin_repair_sessions" && (
                  <div className="flex items-center gap-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-[12.5px]">
                    <Wrench size={14} className="text-amber-400 shrink-0" />
                    <span className="text-muted-foreground">
                      <span className="text-foreground font-semibold">{detailEntry.newValue?.completed ?? 0}</span> sessions completed ·{" "}
                      <span className="text-foreground font-semibold">{detailEntry.newValue?.deducted ?? 0}</span> credits deducted
                    </span>
                  </div>
                )}
                {detailEntry.reason && (
                  <p className="text-sm text-foreground/80 italic">"{detailEntry.reason}"</p>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <JsonBlock title="Previous" value={detailEntry.previousValue} />
                  <JsonBlock title="New" value={detailEntry.newValue} />
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/40 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
      <pre className="text-[11px] text-foreground/90 overflow-x-auto whitespace-pre-wrap break-words max-h-48">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
