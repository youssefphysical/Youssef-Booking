import { useMemo, useState } from "react";
import { Link } from "wouter";
import { Filter, X as XIcon } from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AdminPageHeader,
  AdminCard,
  AdminEmptyState,
  AdminSkeletonStack,
} from "@/components/admin/primitives";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { AdminBadge } from "@/components/admin/primitives";
import { Users, ExternalLink, Lock } from "lucide-react";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  LEAD_SOURCES,
  type LeadStatus,
  type LeadSource,
  type UserResponse,
} from "@shared/schema";

const SOURCE_LABELS: Record<LeadSource, string> = {
  fitness_zone: "Fitness Zone",
  website: "Website",
  instagram: "Instagram",
  referral: "Referral",
  hotel: "Hotel",
  other: "Other",
};

type LeadUser = UserResponse & {
  leadStatus: string | null;
  leadSource: string | null;
  leadStatusManualOverride: boolean;
};

export default function AdminLeads() {
  const { toast } = useToast();
  const [leadStatus, setLeadStatus] = useState<string>("all");
  const [leadSource, setLeadSource] = useState<string>("all");
  const [q, setQ] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const params = new URLSearchParams();
  if (leadStatus !== "all") params.set("leadStatus", leadStatus);
  if (leadSource !== "all") params.set("leadSource", leadSource);
  const qs = params.toString();
  const url = `/api/admin/leads${qs ? `?${qs}` : ""}`;

  const { data: rows = [], isLoading } = useQuery<LeadUser[]>({
    queryKey: ["/api/admin/leads", leadStatus, leadSource],
    queryFn: async () => {
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
  });

  const filtered = useMemo(() => {
    if (!q) return rows;
    const s = q.toLowerCase();
    return rows.filter(
      (r) =>
        r.fullName?.toLowerCase().includes(s) ||
        r.email?.toLowerCase().includes(s) ||
        r.phone?.toLowerCase().includes(s),
    );
  }, [rows, q]);

  const mutate = useMutation({
    mutationFn: async (input: { id: number; leadStatus: LeadStatus }) => {
      const res = await apiRequest("PATCH", `/api/admin/clients/${input.id}/lead-status`, {
        leadStatus: input.leadStatus,
        manualOverride: true,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/leads"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/command-center"] });
      toast({ title: "Lead status updated" });
    },
    onError: (err: any) => {
      toast({
        title: "Failed to update lead status",
        description: err?.message ?? "Try again",
        variant: "destructive",
      });
    },
  });

  const hasActiveFilters = leadStatus !== "all" || leadSource !== "all";
  const clearFilters = () => { setLeadStatus("all"); setLeadSource("all"); };

  return (
    <div className="admin-shell">
    <div className="admin-container space-y-5">
      <AdminPageHeader
        eyebrow="Pipeline"
        title="Leads"
        subtitle="Filter by lifecycle status and source. Inline edits write to the audit log."
      />

      <AdminCard>
        {/* Search always visible */}
        <div className="flex items-center gap-2 mb-3">
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name, email, phone"
            data-testid="input-lead-search"
            className="flex-1"
          />
          <button
            type="button"
            onClick={() => setFiltersOpen((o) => !o)}
            data-testid="button-toggle-filters"
            className={`inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border text-[12px] font-semibold transition-colors sm:hidden ${
              filtersOpen || hasActiveFilters
                ? "bg-primary/15 text-primary border-primary/30"
                : "bg-white/5 border-white/10 text-muted-foreground"
            }`}
          >
            <Filter size={13} />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 w-4 h-4 rounded-full bg-primary/30 text-primary text-[9px] flex items-center justify-center font-bold">
                {(leadStatus !== "all" ? 1 : 0) + (leadSource !== "all" ? 1 : 0)}
              </span>
            )}
          </button>
        </div>

        {/* Filter row — always visible on ≥sm, toggle on mobile */}
        <div className={`grid grid-cols-1 sm:grid-cols-2 gap-3 ${filtersOpen ? "block" : "hidden sm:grid"}`}>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 block">
              Lifecycle status
            </label>
            <Select value={leadStatus} onValueChange={setLeadStatus}>
              <SelectTrigger data-testid="select-lead-status-filter">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {LEAD_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {LEAD_STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 block">
              Lead source
            </label>
            <Select value={leadSource} onValueChange={setLeadSource}>
              <SelectTrigger data-testid="select-lead-source-filter">
                <SelectValue placeholder="All sources" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All sources</SelectItem>
                {LEAD_SOURCES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {SOURCE_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </AdminCard>

      {isLoading ? (
        <AdminSkeletonStack count={6} />
      ) : filtered.length === 0 ? (
        <div>
          <AdminEmptyState
            icon={<Users size={28} />}
            title="No leads match"
            body="Try a different filter combination."
            testId="empty-leads"
          />
          {hasActiveFilters && (
            <div className="flex justify-center mt-3">
              <button
                type="button"
                onClick={clearFilters}
                data-testid="button-clear-lead-filters"
                className="inline-flex items-center gap-1.5 h-9 px-4 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.07] text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <XIcon size={13} /> Clear filters
              </button>
            </div>
          )}
        </div>
      ) : (
        <AdminCard padded={false}>
          <div className="divide-y divide-white/5">
            {filtered.map((r) => (
              <div
                key={r.id}
                className="grid grid-cols-1 sm:grid-cols-[1.5fr_1fr_1.2fr_auto] gap-2 sm:gap-3 items-center p-3 sm:p-4"
                data-testid={`row-lead-${r.id}`}
              >
                <div className="min-w-0">
                  <div className="font-semibold truncate">{r.fullName || "(no name)"}</div>
                  <div className="text-[12px] text-muted-foreground truncate">
                    {r.email}
                  </div>
                </div>
                <div className="flex items-center gap-2 text-[12px] text-muted-foreground">
                  {r.leadSource ? (
                    <AdminBadge variant="muted">
                      {SOURCE_LABELS[r.leadSource as LeadSource] ?? r.leadSource}
                    </AdminBadge>
                  ) : (
                    <span className="text-muted-foreground/60">—</span>
                  )}
                  {r.leadStatusManualOverride ? (
                    <span
                      className="inline-flex items-center gap-1 text-[10.5px] text-primary"
                      title="Manually pinned — auto-derive disabled"
                    >
                      <Lock size={11} />
                      pinned
                    </span>
                  ) : null}
                </div>
                <div>
                  <Select
                    value={(r.leadStatus as LeadStatus) ?? ""}
                    onValueChange={(v) =>
                      mutate.mutate({ id: r.id, leadStatus: v as LeadStatus })
                    }
                  >
                    <SelectTrigger
                      className="h-9"
                      data-testid={`select-lead-status-${r.id}`}
                    >
                      <SelectValue placeholder="Set status" />
                    </SelectTrigger>
                    <SelectContent>
                      {LEAD_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {LEAD_STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Link
                  href={`/admin/clients/${r.id}`}
                  data-testid={`link-lead-${r.id}`}
                  className="inline-flex items-center gap-1 text-[12px] text-primary hover:underline"
                >
                  Open
                  <ExternalLink size={12} />
                </Link>
              </div>
            ))}
          </div>
        </AdminCard>
      )}
    </div>
    </div>
  );
}
