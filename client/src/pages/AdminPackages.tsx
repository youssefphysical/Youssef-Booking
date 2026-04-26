import { useMemo, useState } from "react";
import { Link } from "wouter";
import { format } from "date-fns";
import { Search, Package as PackageIcon, ExternalLink, Users } from "lucide-react";
import { usePackages } from "@/hooks/use-packages";
import { useClients } from "@/hooks/use-clients";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PACKAGE_DEFINITIONS, type PackageWithUser, type UserResponse } from "@shared/schema";

export default function AdminPackages() {
  const { data: packages = [], isLoading } = usePackages({ includeUser: true });
  const { data: clients = [] } = useClients();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "closed">("active");

  const list = packages as PackageWithUser[];
  const clientById = useMemo(() => {
    const m = new Map<number, UserResponse>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (filter === "active" && !p.isActive) return false;
      if (filter === "closed" && p.isActive) return false;
      if (q) {
        const owner = p.user || clientById.get(p.userId);
        if (!owner) return false;
        const s = q.toLowerCase();
        return (
          owner.fullName.toLowerCase().includes(s) ||
          (owner.email || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [list, q, filter, clientById]);

  const totalActive = list.filter((p) => p.isActive).length;
  const totalRemaining = list
    .filter((p) => p.isActive)
    .reduce((sum, p) => sum + (p.totalSessions - p.usedSessions), 0);

  return (
    <div className="md:pl-64 p-6 pt-20 md:pt-8 min-h-screen max-w-6xl">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">Packages</p>
        <h1 className="text-3xl font-display font-bold" data-testid="text-packages-title">
          Session Packages
        </h1>
        <p className="text-muted-foreground text-sm">
          {totalActive} active • {totalRemaining} sessions remaining across all clients
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by client name or email..."
            className="pl-9 bg-white/5 border-white/10"
            data-testid="input-search-packages"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="bg-white/5 border-white/10 w-40" data-testid="select-package-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active only</SelectItem>
            <SelectItem value="closed">Closed only</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-muted-foreground">
          <PackageIcon className="mx-auto text-muted-foreground/40 mb-3" size={32} />
          {q ? "No packages match your search." : "No packages assigned yet. Add packages from a client's profile."}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p) => {
            const owner = p.user || clientById.get(p.userId);
            const partner = p.partnerUserId ? clientById.get(p.partnerUserId) : null;
            const def = PACKAGE_DEFINITIONS[p.type];
            const remaining = p.totalSessions - p.usedSessions;
            const pct = Math.round((p.usedSessions / Math.max(p.totalSessions, 1)) * 100);

            return (
              <div
                key={p.id}
                className={`rounded-2xl border p-5 ${p.isActive ? "border-primary/30 bg-primary/5" : "border-white/5 bg-card/60 opacity-70"}`}
                data-testid={`packages-row-${p.id}`}
              >
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="min-w-0">
                    <Link
                      href={`/admin/clients/${p.userId}`}
                      data-testid={`link-package-client-${p.id}`}
                      className="font-semibold hover:text-primary inline-flex items-center gap-1.5"
                    >
                      {owner?.fullName || "Unknown"}
                      <ExternalLink size={11} />
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">{owner?.email}</p>
                    {def?.isDuo && partner && (
                      <p className="text-xs text-amber-300/80 mt-1 inline-flex items-center gap-1.5">
                        <Users size={11} /> Partner: {partner.fullName}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary">
                    {def?.label || p.type}
                  </span>
                </div>

                <div className="flex items-end justify-between gap-3 mb-2">
                  <div>
                    <p className="text-2xl font-display font-bold">
                      {remaining} <span className="text-sm font-normal text-muted-foreground">/ {p.totalSessions}</span>
                    </p>
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">sessions left</p>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Started {p.purchasedAt && format(new Date(p.purchasedAt), "MMM d, yyyy")}
                  </p>
                </div>
                <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary to-primary/60" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
