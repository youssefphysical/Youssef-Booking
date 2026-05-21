import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { AdminCard, AdminSectionTitle } from "@/components/admin/primitives";
import { Loader2, ShieldCheck, ChevronRight, Filter } from "lucide-react";
import { Link } from "wouter";

/**
 * Task #57 — global admin audit-log page.
 * Renders the most recent admin mutations recorded by the `audit()`
 * helper in server/routes.ts. Filters: entity type, free-text actor
 * search. Click any row to expand its previous/new JSON snapshot —
 * useful for forensics ("what value did the freeze switch from?").
 */

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

const ENTITY_OPTIONS = ["all", "user", "package", "booking"] as const;

export default function AdminAuditLog() {
  const [entityType, setEntityType] = useState<(typeof ENTITY_OPTIONS)[number]>("all");
  const [search, setSearch] = useState("");
  const [openId, setOpenId] = useState<number | null>(null);

  const queryKey = useMemo(
    () =>
      entityType === "all"
        ? ["/api/admin/audit-log"]
        : ["/api/admin/audit-log", { entityType }],
    [entityType],
  );

  const { data, isLoading, isError } = useQuery<AuditEntry[]>({
    queryKey,
    queryFn: async () => {
      const qs = entityType === "all" ? "" : `?entityType=${entityType}`;
      const res = await fetch(`/api/admin/audit-log${qs}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });

  const rows = useMemo(() => {
    const list = data ?? [];
    if (!search.trim()) return list;
    const needle = search.toLowerCase();
    return list.filter((r) =>
      [r.action, r.entityType, r.reason, r.actor?.fullName, r.actor?.email, String(r.entityId ?? "")]
        .filter(Boolean)
        .some((s) => String(s).toLowerCase().includes(needle)),
    );
  }, [data, search]);

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck size={18} className="text-primary" />
          <h1 className="text-xl sm:text-2xl font-display font-bold">Audit log</h1>
        </div>

        <AdminCard className="mb-4">
          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            <div className="flex items-center gap-1.5 text-muted-foreground text-[12px]">
              <Filter size={13} /> Entity
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {ENTITY_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEntityType(e)}
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
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search actor, reason, action…"
              data-testid="input-audit-search"
              className="sm:ml-auto h-9 px-3 rounded-lg bg-white/[0.04] border border-white/10 text-sm w-full sm:w-72 focus:outline-none focus:border-primary/50"
            />
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
            {rows.map((r) => {
              const isOpen = openId === r.id;
              const ts = new Date(r.createdAt);
              return (
                <li key={r.id} data-testid={`audit-row-${r.id}`}>
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : r.id)}
                    className="w-full text-left py-2.5 flex items-start gap-3 hover:bg-white/[0.02] px-1 rounded-md"
                  >
                    <ChevronRight
                      size={14}
                      className={`mt-1 text-muted-foreground transition-transform ${isOpen ? "rotate-90 text-primary" : ""}`}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-[12.5px] font-semibold truncate">
                        <span className="text-primary">{r.action}</span>
                        <span className="text-muted-foreground"> · {r.entityType}</span>
                        {r.entityId != null && (
                          <span className="text-muted-foreground"> #{r.entityId}</span>
                        )}
                      </p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {format(ts, "MMM d, yyyy HH:mm")} ·{" "}
                        {r.actor?.fullName || r.actor?.email || (r.performedByUserId ? `User #${r.performedByUserId}` : "system")}
                        {r.entityType === "user" && r.entityId && (
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
                  </button>
                  {isOpen && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pb-3 ps-7">
                      <JsonBlock title="Previous" value={r.previousValue} />
                      <JsonBlock title="New" value={r.newValue} />
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </AdminCard>
      </div>
    </div>
  );
}

function JsonBlock({ title, value }: { title: string; value: any }) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-black/40 p-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{title}</p>
      <pre className="text-[11px] text-foreground/90 overflow-x-auto whitespace-pre-wrap break-words">
        {value == null ? "—" : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
