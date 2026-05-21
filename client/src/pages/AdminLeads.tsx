import { useMemo, useState } from "react";
import { Link } from "wouter";
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
import { Badge } from "@/components/ui/badge";
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

  return (
    <div className="admin-shell">
    <div className="admin-container space-y-5">
      <AdminPageHeader
        eyebrow="Pipeline"
        title="Leads"
        subtitle="Filter by lifecycle status and source. Inline edits write to the audit log."
      />

      <AdminCard>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 block">
              Lead status
            </label>
            <Select value={leadStatus} onValueChange={setLeadStatus}>
              <SelectTrigger data-testid="select-lead-status-filter">
                <SelectValue />
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
                <SelectValue />
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
          <div>
            <label className="text-[11px] uppercase tracking-wide text-muted-foreground mb-1 block">
              Search
            </label>
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Name, email, phone"
              data-testid="input-lead-search"
            />
          </div>
        </div>
      </AdminCard>

      {isLoading ? (
        <AdminSkeletonStack count={6} />
      ) : filtered.length === 0 ? (
        <AdminEmptyState
          icon={<Users size={28} />}
          title="No leads match"
          body="Try a different filter combination."
          testId="empty-leads"
        />
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
                    <Badge variant="outline" className="text-[10.5px]">
                      {SOURCE_LABELS[r.leadSource as LeadSource] ?? r.leadSource}
                    </Badge>
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
