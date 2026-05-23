import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Users,
  UserCheck,
  UserPlus,
  UserMinus,
  Calendar,
  CalendarDays,
  ShieldCheck,
  Package,
  Apple,
  HeartPulse,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Snowflake,
  TrendingDown,
  Sparkles,
  ChevronRight,
  Download,
  Filter,
  RefreshCcw,
  Target,
  MapPin,
  Flame,
  Clock,
} from "lucide-react";
import {
  AdminCard,
  AdminPageHeader,
  AdminSectionTitle,
  AdminStatCard,
  AdminEmptyState,
  AdminSkeletonStack,
} from "@/components/admin/primitives";
import { cn } from "@/lib/utils";

type Bucket = { k: string; c: number };
type LeadBucket = { k: string; leads: number; converted: number };
type RecentClient = {
  id: number;
  full_name: string;
  created_at?: string;
  last_at?: string;
  lead_source?: string;
};
type ActionRow = {
  user_id: number;
  full_name: string;
  kind: string;
  priority: "high" | "medium" | "low";
  service: string;
  reason: string;
  suggested: string;
};

type Payload = {
  generatedAt: string;
  executive: Record<string, number>;
  clients: {
    byStatus: Bucket[];
    bySource: Bucket[];
    byLocation: Bucket[];
    byGoal: Bucket[];
    recentRegistered: RecentClient[];
    recentActive: RecentClient[];
    noBookings: number;
  };
  packages: Record<string, any> & { byType: Bucket[] };
  bookings: Record<string, any> & { peakHours: Bucket[] };
  nutrition: Record<string, number>;
  recovery: {
    pending: number;
    scheduled: number;
    active_clients: number;
    byType: Bucket[] | null;
  };
  leads: Record<string, any> & { bySource: LeadBucket[] };
  actions: ActionRow[];
};

const PERIOD_OPTIONS = [
  { value: "all", label: "All time" },
  { value: "today", label: "Today" },
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "90d", label: "Last 90 days" },
] as const;
type Period = (typeof PERIOD_OPTIONS)[number]["value"];

const SERVICE_OPTIONS = [
  "all",
  "PT",
  "Package",
  "Nutrition",
  "Recovery",
  "Lead",
] as const;
type Service = (typeof SERVICE_OPTIONS)[number];

const PRIORITY_OPTIONS = ["all", "high", "medium", "low"] as const;
type Priority = (typeof PRIORITY_OPTIONS)[number];

const PRIORITY_TONE: Record<string, string> = {
  high: "text-rose-300 bg-rose-500/15 border-rose-400/30",
  medium: "text-amber-300 bg-amber-500/15 border-amber-400/30",
  low: "text-cyan-300 bg-cyan-500/15 border-cyan-400/30",
};

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportSummary(d: Payload) {
  const rows: Array<[string, string, string | number]> = [];
  const push = (
    section: string,
    label: string,
    value: string | number | undefined | null,
  ) => rows.push([section, label, value ?? 0]);

  push("Executive", "Total clients", d.executive?.total_clients);
  push("Executive", "Active clients", d.executive?.active_clients);
  push("Executive", "New this month", d.executive?.new_this_month);
  push("Executive", "Inactive clients", d.executive?.inactive_clients);
  push("Executive", "Sessions today", d.executive?.sessions_today);
  push("Executive", "Sessions this week", d.executive?.sessions_this_week);
  push(
    "Executive",
    "Pending verifications",
    d.executive?.pending_verifications,
  );
  push(
    "Executive",
    "Packages expiring soon",
    d.executive?.packages_expiring_soon,
  );
  push(
    "Executive",
    "Nutrition expiring soon",
    d.executive?.nutrition_expiring_soon,
  );
  push("Executive", "Recovery requests pending", d.executive?.recovery_pending);

  push("Packages", "Active", d.packages?.active_count);
  push("Packages", "Expiring 7d", d.packages?.expiring_7d);
  push("Packages", "Expiring 14d", d.packages?.expiring_14d);
  push("Packages", "Frozen", d.packages?.frozen_count);
  push("Packages", "Expired", d.packages?.expired_count);
  push("Packages", "Low remaining sessions", d.packages?.low_remaining);
  push("Packages", "Avg remaining sessions", d.packages?.avg_remaining);
  push(
    "Packages",
    "Renewal opportunities",
    d.packages?.renewal_opportunities,
  );

  push("Bookings", "Today", d.bookings?.today_total);
  push("Bookings", "This week", d.bookings?.this_week);
  push("Bookings", "This month", d.bookings?.this_month);
  push("Bookings", "Completed (all-time)", d.bookings?.completed_total);
  push("Bookings", "Cancelled (all-time)", d.bookings?.cancelled_total);
  push("Bookings", "Late cancellations", d.bookings?.late_cancellations);

  push("Nutrition", "Active clients", d.nutrition?.active_clients);
  push("Nutrition", "Active plans", d.nutrition?.active_plans);
  push("Nutrition", "Nutrition-only clients", d.nutrition?.nutrition_only);
  push("Nutrition", "Expiring 7d", d.nutrition?.expiring_7d);
  push("Nutrition", "Expiring 14d", d.nutrition?.expiring_14d);
  push(
    "Nutrition",
    "Renewal opportunities",
    d.nutrition?.renewal_opportunities,
  );

  push("Recovery", "Pending", d.recovery?.pending);
  push("Recovery", "Scheduled", d.recovery?.scheduled);
  push("Recovery", "Active clients", d.recovery?.active_clients);

  push("Leads", "New leads", d.leads?.new_leads);
  push("Leads", "Trial requested", d.leads?.trial_requested);
  push("Leads", "Trial completed", d.leads?.trial_completed);
  push("Leads", "Pending verification", d.leads?.pending_verification);
  push("Leads", "Needing action", d.leads?.needing_action);
  push(
    "Leads",
    "Registered never booked",
    d.leads?.registered_never_booked,
  );

  for (const r of d.clients?.bySource ?? []) {
    push("Clients by source", r.k, r.c);
  }
  for (const r of d.clients?.byLocation ?? []) {
    push("Clients by location", r.k, r.c);
  }
  for (const r of d.clients?.byGoal ?? []) {
    push("Clients by goal", r.k, r.c);
  }
  for (const r of d.leads?.bySource ?? []) {
    push("Lead source", `${r.k} (leads)`, r.leads);
    push("Lead source", `${r.k} (converted)`, r.converted);
  }

  const header = "Section,Metric,Value\n";
  const body = rows
    .map(([s, l, v]) =>
      [csvEscape(s), csvEscape(l), csvEscape(v)].join(","),
    )
    .join("\n");
  const stamp = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  triggerDownload(
    new Blob(["\ufeff" + header + body], {
      type: "text/csv;charset=utf-8",
    }),
    `management-analysis-${stamp}.csv`,
  );
}

function exportActions(rows: ActionRow[]) {
  const header = "Client,Priority,Service,Reason,Suggested Action,Profile URL\n";
  const body = rows
    .map((r) =>
      [
        csvEscape(r.full_name),
        csvEscape(r.priority),
        csvEscape(r.service),
        csvEscape(r.reason),
        csvEscape(r.suggested),
        csvEscape(`/admin/clients/${r.user_id}`),
      ].join(","),
    )
    .join("\n");
  const stamp = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString().slice(0, 10);
  triggerDownload(
    new Blob(["\ufeff" + header + body], {
      type: "text/csv;charset=utf-8",
    }),
    `coach-actions-${stamp}.csv`,
  );
}

function FilterPills<T extends string>({
  value,
  onChange,
  options,
  testId,
}: {
  value: T;
  onChange: (v: T) => void;
  options: ReadonlyArray<T | { value: T; label: string }>;
  testId: string;
}) {
  return (
    <div
      className="flex flex-wrap gap-1.5"
      data-testid={testId}
      role="tablist"
    >
      {options.map((opt) => {
        const v = typeof opt === "string" ? opt : opt.value;
        const label = typeof opt === "string" ? opt : opt.label;
        const active = v === value;
        return (
          <button
            key={v}
            type="button"
            onClick={() => onChange(v)}
            data-testid={`${testId}-${v}`}
            className={cn(
              "px-2.5 h-7 text-[11px] rounded-full border transition-colors",
              active
                ? "bg-primary/15 border-primary/40 text-primary"
                : "bg-white/[0.03] border-white/10 text-muted-foreground hover:text-foreground hover:bg-white/[0.06]",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

function Bars({ rows, max }: { rows: Bucket[]; max?: number }) {
  if (!rows?.length) {
    return (
      <p className="text-xs text-muted-foreground py-2">No data available yet.</p>
    );
  }
  const top = max ? rows.slice(0, max) : rows;
  const peak = Math.max(...top.map((r) => r.c), 1);
  return (
    <ul className="space-y-1.5">
      {top.map((r) => (
        <li key={r.k} className="flex items-center gap-2 text-xs">
          <span className="w-32 truncate text-muted-foreground">{r.k}</span>
          <div className="flex-1 h-2 rounded-full bg-white/[0.04] overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-400/70 to-cyan-300/40"
              style={{ width: `${(r.c / peak) * 100}%` }}
            />
          </div>
          <span className="w-8 text-end tabular-nums">{r.c}</span>
        </li>
      ))}
    </ul>
  );
}

export default function AdminManagementAnalysis() {
  const [period, setPeriod] = useState<Period>("all");
  const [service, setService] = useState<Service>("all");
  const [priority, setPriority] = useState<Priority>("all");

  const { data, isLoading, isFetching, refetch } = useQuery<Payload>({
    queryKey: ["/api/admin/management-analysis"],
    staleTime: 30_000,
  });

  // ---------- which booking metric matches the chosen period ----------
  const periodBookingCount = useMemo(() => {
    if (!data) return null;
    switch (period) {
      case "today":
        return { label: "Sessions today", v: data.bookings?.today_total };
      case "week":
        return { label: "Sessions this week", v: data.bookings?.this_week };
      case "month":
        return { label: "Sessions this month", v: data.bookings?.this_month };
      case "90d":
        // peakHours covers 90d already; total is sum of those
        return {
          label: "Sessions last 90 days",
          v: (data.bookings?.peakHours ?? []).reduce(
            (s: number, r: Bucket) => s + (r.c || 0),
            0,
          ),
        };
      default:
        return null;
    }
  }, [data, period]);

  // ---------- filtered action list ----------
  const filteredActions = useMemo(() => {
    if (!data?.actions) return [];
    return data.actions.filter((a) => {
      if (service !== "all" && a.service !== service) return false;
      if (priority !== "all" && a.priority !== priority) return false;
      return true;
    });
  }, [data?.actions, service, priority]);

  // ---------- render ----------
  if (isLoading) {
    return (
      <div className="admin-shell">
        <div className="admin-container">
          <AdminPageHeader
            eyebrow="Insights"
            title="Management & Analysis"
            subtitle="Loading aggregated metrics…"
            testId="text-management-analysis-title"
          />
          <AdminSkeletonStack count={8} />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="admin-shell">
        <div className="admin-container">
          <AdminPageHeader
            eyebrow="Insights"
            title="Management & Analysis"
            testId="text-management-analysis-title"
          />
          <AdminCard>
            <AdminEmptyState
              icon={<AlertTriangle size={32} className="text-amber-300" />}
              title="Couldn't load analytics"
              body="Try refreshing in a moment."
              testId="empty-management-analysis"
            />
          </AdminCard>
        </div>
      </div>
    );
  }

  const e = data.executive ?? {};
  const pkg = data.packages ?? {};
  const bk = data.bookings ?? {};
  const nu = data.nutrition ?? {};
  const re = data.recovery ?? {};
  const ld = data.leads ?? {};

  return (
    <div className="admin-shell">
    <div className="admin-container space-y-5 sm:space-y-7">
      <AdminPageHeader
        eyebrow="Insights"
        title="Management & Analysis"
        subtitle={`Generated ${new Date(data.generatedAt).toLocaleString()}`}
        testId="text-management-analysis-title"
        right={
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="h-9 px-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
              data-testid="button-refresh-analysis"
            >
              <RefreshCcw
                size={14}
                className={cn(isFetching && "animate-spin")}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => exportSummary(data)}
              className="h-9 px-3 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-md shadow-primary/20 hover:opacity-90 inline-flex items-center gap-1.5"
              data-testid="button-export-summary-csv"
            >
              <Download size={14} /> Summary CSV
            </button>
          </div>
        }
      />

      {/* Filters */}
      <AdminCard>
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-muted-foreground">
            <Filter size={13} />
            Filters
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Period
              </p>
              <FilterPills
                value={period}
                onChange={setPeriod}
                options={PERIOD_OPTIONS}
                testId="filter-period"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Action service
              </p>
              <FilterPills
                value={service}
                onChange={setService}
                options={SERVICE_OPTIONS}
                testId="filter-service"
              />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1.5">
                Action priority
              </p>
              <FilterPills
                value={priority}
                onChange={setPriority}
                options={PRIORITY_OPTIONS}
                testId="filter-priority"
              />
            </div>
          </div>
        </div>
      </AdminCard>

      {/* 1. Executive Overview */}
      <section>
        <AdminSectionTitle title="Executive Overview" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3">
          <AdminStatCard
            icon={<Users size={16} />}
            label="Total clients"
            value={Number(e.total_clients ?? 0)}
            tone="info"
            testId="stat-total-clients"
            animate
          />
          <AdminStatCard
            icon={<UserCheck size={16} />}
            label="Active clients"
            value={Number(e.active_clients ?? 0)}
            tone="success"
            testId="stat-active-clients"
            animate
          />
          <AdminStatCard
            icon={<UserPlus size={16} />}
            label="New this month"
            value={Number(e.new_this_month ?? 0)}
            tone="info"
            testId="stat-new-this-month"
            animate
          />
          <AdminStatCard
            icon={<UserMinus size={16} />}
            label="Inactive clients"
            value={Number(e.inactive_clients ?? 0)}
            tone="muted"
            testId="stat-inactive-clients"
            animate
          />
          <AdminStatCard
            icon={<Calendar size={16} />}
            label="Sessions today"
            value={Number(e.sessions_today ?? 0)}
            tone="info"
            testId="stat-sessions-today"
            animate
          />
          <AdminStatCard
            icon={<CalendarDays size={16} />}
            label="Sessions this week"
            value={Number(e.sessions_this_week ?? 0)}
            tone="info"
            testId="stat-sessions-week"
            animate
          />
          <AdminStatCard
            icon={<ShieldCheck size={16} />}
            label="Pending verifications"
            value={Number(e.pending_verifications ?? 0)}
            tone={e.pending_verifications ? ("warning" as const) : ("muted" as const)}
            testId="stat-pending-verifications"
            animate
          />
          <AdminStatCard
            icon={<Package size={16} />}
            label="Packages expiring soon"
            value={Number(e.packages_expiring_soon ?? 0)}
            tone={e.packages_expiring_soon ? "warning" : "muted"}
            testId="stat-packages-expiring"
            animate
          />
          <AdminStatCard
            icon={<Apple size={16} />}
            label="Nutrition expiring soon"
            value={Number(e.nutrition_expiring_soon ?? 0)}
            tone={e.nutrition_expiring_soon ? "warning" : "muted"}
            testId="stat-nutrition-expiring"
            animate
          />
          <AdminStatCard
            icon={<HeartPulse size={16} />}
            label="Recovery pending"
            value={Number(e.recovery_pending ?? 0)}
            tone={e.recovery_pending ? "warning" : "muted"}
            testId="stat-recovery-pending"
            animate
          />
        </div>
        {periodBookingCount ? (
          <p className="text-[11px] text-muted-foreground mt-2">
            {periodBookingCount.label}:{" "}
            <span className="text-cyan-300 tabular-nums">
              {periodBookingCount.v ?? 0}
            </span>
          </p>
        ) : null}
      </section>

      {/* 2. Client Management Analysis */}
      <section>
        <AdminSectionTitle title="Client Management" />
        <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
          <AdminCard>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Target size={13} /> By status
            </h4>
            <Bars rows={data.clients?.byStatus ?? []} />
            <div className="grid grid-cols-2 gap-2 mt-3">
              <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  No bookings
                </p>
                <p
                  className="text-lg font-display font-bold tabular-nums"
                  data-testid="stat-no-bookings"
                >
                  {data.clients?.noBookings ?? 0}
                </p>
              </div>
              <div className="rounded-lg bg-white/[0.03] border border-white/5 px-2.5 py-2">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide">
                  Needs follow-up
                </p>
                <p
                  className="text-lg font-display font-bold tabular-nums"
                  data-testid="stat-needs-followup"
                >
                  {filteredActions.length}
                </p>
              </div>
            </div>
          </AdminCard>
          <AdminCard>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Sparkles size={13} /> By lead source
            </h4>
            <Bars rows={data.clients?.bySource ?? []} max={8} />
          </AdminCard>
          <AdminCard>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <MapPin size={13} /> By training location
            </h4>
            <Bars rows={data.clients?.byLocation ?? []} max={8} />
          </AdminCard>
          <AdminCard>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
              <Flame size={13} /> By goal
            </h4>
            <Bars rows={data.clients?.byGoal ?? []} max={8} />
          </AdminCard>
          <AdminCard>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Recently registered
            </h4>
            {data.clients?.recentRegistered?.length ? (
              <ul className="text-xs divide-y divide-white/5">
                {data.clients.recentRegistered.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-2 py-1.5"
                  >
                    <Link
                      href={`/admin/clients/${u.id}`}
                      className="truncate hover:text-cyan-300"
                      data-testid={`link-recent-registered-${u.id}`}
                    >
                      {u.full_name}
                    </Link>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {u.created_at
                        ? new Date(u.created_at).toLocaleDateString()
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No data available yet.</p>
            )}
          </AdminCard>
          <AdminCard>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Recently active
            </h4>
            {data.clients?.recentActive?.length ? (
              <ul className="text-xs divide-y divide-white/5">
                {data.clients.recentActive.map((u) => (
                  <li
                    key={u.id}
                    className="flex items-center justify-between gap-2 py-1.5"
                  >
                    <Link
                      href={`/admin/clients/${u.id}`}
                      className="truncate hover:text-cyan-300"
                      data-testid={`link-recent-active-${u.id}`}
                    >
                      {u.full_name}
                    </Link>
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {u.last_at
                        ? new Date(u.last_at).toLocaleDateString()
                        : ""}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">No data available yet.</p>
            )}
          </AdminCard>
        </div>
      </section>

      {/* 3. Package Management */}
      <section>
        <AdminSectionTitle title="Package Management" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3">
          <AdminStatCard
            icon={<Package size={16} />}
            label="Active packages"
            value={Number(pkg.active_count ?? 0)}
            tone="info"
            testId="stat-pkg-active"
            animate
          />
          <AdminStatCard
            icon={<AlertTriangle size={16} />}
            label="Expiring 7 days"
            value={Number(pkg.expiring_7d ?? 0)}
            tone={pkg.expiring_7d ? "warning" : "muted"}
            testId="stat-pkg-exp-7"
            animate
          />
          <AdminStatCard
            icon={<AlertTriangle size={16} />}
            label="Expiring 14 days"
            value={Number(pkg.expiring_14d ?? 0)}
            tone={pkg.expiring_14d ? "warning" : "muted"}
            testId="stat-pkg-exp-14"
            animate
          />
          <AdminStatCard
            icon={<Snowflake size={16} />}
            label="Frozen"
            value={Number(pkg.frozen_count ?? 0)}
            tone="muted"
            testId="stat-pkg-frozen"
            animate
          />
          <AdminStatCard
            icon={<XCircle size={16} />}
            label="Expired"
            value={Number(pkg.expired_count ?? 0)}
            tone="muted"
            testId="stat-pkg-expired"
            animate
          />
          <AdminStatCard
            icon={<TrendingDown size={16} />}
            label="Low remaining (≤3)"
            value={Number(pkg.low_remaining ?? 0)}
            tone={pkg.low_remaining ? "warning" : "muted"}
            testId="stat-pkg-low"
            animate
          />
          <AdminStatCard
            icon={<Target size={16} />}
            label="Avg sessions left"
            value={Number(pkg.avg_remaining ?? 0)}
            tone="default"
            testId="stat-pkg-avg"
          />
          <AdminStatCard
            icon={<RefreshCcw size={16} />}
            label="Renewal opportunities"
            value={Number(pkg.renewal_opportunities ?? 0)}
            tone={pkg.renewal_opportunities ? ("info" as const) : ("muted" as const)}
            testId="stat-pkg-renewals"
            animate
          />
        </div>
        <AdminCard className="mt-3">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            By package type
          </h4>
          <Bars rows={pkg.byType ?? []} max={10} />
        </AdminCard>
      </section>

      {/* 4. Booking Management */}
      <section>
        <AdminSectionTitle title="Booking Management" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          <AdminStatCard
            icon={<Calendar size={16} />}
            label="Sessions today"
            value={Number(bk.today_total ?? 0)}
            tone="info"
            testId="stat-bk-today"
            animate
          />
          <AdminStatCard
            icon={<CalendarDays size={16} />}
            label="This week"
            value={Number(bk.this_week ?? 0)}
            tone="info"
            testId="stat-bk-week"
            animate
          />
          <AdminStatCard
            icon={<CalendarDays size={16} />}
            label="This month"
            value={Number(bk.this_month ?? 0)}
            tone="info"
            testId="stat-bk-month"
            animate
          />
          <AdminStatCard
            icon={<CheckCircle2 size={16} />}
            label="Completed"
            value={Number(bk.completed_total ?? 0)}
            tone="success"
            testId="stat-bk-completed"
            animate
          />
          <AdminStatCard
            icon={<XCircle size={16} />}
            label="Cancelled"
            value={Number(bk.cancelled_total ?? 0)}
            tone="muted"
            testId="stat-bk-cancelled"
            animate
          />
          <AdminStatCard
            icon={<AlertTriangle size={16} />}
            label="Late cancellations"
            value={Number(bk.late_cancellations ?? 0)}
            tone={bk.late_cancellations ? "warning" : "muted"}
            testId="stat-bk-late"
            animate
          />
        </div>
        <AdminCard className="mt-3">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
            <Clock size={13} /> Peak times (last 90 days)
          </h4>
          <Bars rows={bk.peakHours ?? []} max={8} />
        </AdminCard>
      </section>

      {/* 5. Nutrition */}
      <section>
        <AdminSectionTitle title="Nutrition Management" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          <AdminStatCard
            icon={<Apple size={16} />}
            label="Active nutrition clients"
            value={Number(nu.active_clients ?? 0)}
            tone="info"
            testId="stat-nu-active"
            animate
          />
          <AdminStatCard
            icon={<Apple size={16} />}
            label="Active plans"
            value={Number(nu.active_plans ?? 0)}
            tone="default"
            testId="stat-nu-plans"
            animate
          />
          <AdminStatCard
            icon={<Apple size={16} />}
            label="Nutrition only"
            value={Number(nu.nutrition_only ?? 0)}
            tone="default"
            testId="stat-nu-only"
            animate
          />
          <AdminStatCard
            icon={<AlertTriangle size={16} />}
            label="Expiring 7d"
            value={Number(nu.expiring_7d ?? 0)}
            tone={nu.expiring_7d ? "warning" : "muted"}
            testId="stat-nu-exp7"
            animate
          />
          <AdminStatCard
            icon={<AlertTriangle size={16} />}
            label="Expiring 14d"
            value={Number(nu.expiring_14d ?? 0)}
            tone={nu.expiring_14d ? "warning" : "muted"}
            testId="stat-nu-exp14"
            animate
          />
          <AdminStatCard
            icon={<RefreshCcw size={16} />}
            label="Renewal opportunities"
            value={Number(nu.renewal_opportunities ?? 0)}
            tone={nu.renewal_opportunities ? ("info" as const) : ("muted" as const)}
            testId="stat-nu-renewals"
            animate
          />
        </div>
      </section>

      {/* 6. Recovery */}
      <section>
        <AdminSectionTitle title="Recovery Management" />
        <div className="grid lg:grid-cols-2 gap-3 sm:gap-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            <AdminStatCard
              icon={<HeartPulse size={16} />}
              label="Pending"
              value={Number(re.pending ?? 0)}
              tone={re.pending ? "warning" : "muted"}
              testId="stat-re-pending"
              animate
            />
            <AdminStatCard
              icon={<HeartPulse size={16} />}
              label="Scheduled"
              value={Number(re.scheduled ?? 0)}
              tone="info"
              testId="stat-re-scheduled"
              animate
            />
            <AdminStatCard
              icon={<HeartPulse size={16} />}
              label="Active clients"
              value={Number(re.active_clients ?? 0)}
              tone="default"
              testId="stat-re-active"
              animate
            />
          </div>
          <AdminCard>
            <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
              Demand by type
            </h4>
            <Bars rows={(re.byType as Bucket[]) ?? []} />
          </AdminCard>
        </div>
      </section>

      {/* 7. Leads */}
      <section>
        <AdminSectionTitle title="Lead & Conversion" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 sm:gap-3">
          <AdminStatCard
            icon={<UserPlus size={16} />}
            label="New leads"
            value={Number(ld.new_leads ?? 0)}
            tone="info"
            testId="stat-ld-new"
            animate
          />
          <AdminStatCard
            icon={<Sparkles size={16} />}
            label="Trial requested"
            value={Number(ld.trial_requested ?? 0)}
            tone="info"
            testId="stat-ld-trial-req"
            animate
          />
          <AdminStatCard
            icon={<CheckCircle2 size={16} />}
            label="Trial completed"
            value={Number(ld.trial_completed ?? 0)}
            tone="success"
            testId="stat-ld-trial-done"
            animate
          />
          <AdminStatCard
            icon={<ShieldCheck size={16} />}
            label="Pending FZ verifications"
            value={Number(ld.pending_verification ?? 0)}
            tone={ld.pending_verification ? "warning" : "muted"}
            testId="stat-ld-pending-verif"
            animate
          />
          <AdminStatCard
            icon={<AlertTriangle size={16} />}
            label="Needs action"
            value={Number(ld.needing_action ?? 0)}
            tone={ld.needing_action ? "warning" : "muted"}
            testId="stat-ld-needs-action"
            animate
          />
          <AdminStatCard
            icon={<UserMinus size={16} />}
            label="Registered, never booked"
            value={Number(ld.registered_never_booked ?? 0)}
            tone="muted"
            testId="stat-ld-never-booked"
            animate
          />
        </div>
        <AdminCard className="mt-3">
          <h4 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            Source performance
          </h4>
          {ld.bySource?.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wider text-muted-foreground border-b border-white/5">
                    <th className="text-start font-medium py-1.5">Source</th>
                    <th className="text-end font-medium">Leads</th>
                    <th className="text-end font-medium">Converted</th>
                    <th className="text-end font-medium">Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {ld.bySource.map((r: LeadBucket) => {
                    const rate = r.leads
                      ? Math.round((r.converted / r.leads) * 100)
                      : 0;
                    return (
                      <tr
                        key={r.k}
                        className="border-b border-white/5 last:border-0"
                        data-testid={`row-lead-source-${r.k}`}
                      >
                        <td className="py-1.5 truncate">{r.k}</td>
                        <td className="text-end tabular-nums">{r.leads}</td>
                        <td className="text-end tabular-nums">
                          {r.converted}
                        </td>
                        <td className="text-end tabular-nums text-cyan-300">
                          {rate}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">No data available yet.</p>
          )}
        </AdminCard>
      </section>

      {/* 8. Coach Action List */}
      <section>
        <div className="flex items-center justify-between mb-3 gap-3">
          <h3 className="font-display font-bold text-[15px] sm:text-lg">
            Coach Action List
            <span className="ml-2 text-xs text-muted-foreground tabular-nums">
              ({filteredActions.length})
            </span>
          </h3>
          <button
            type="button"
            onClick={() => exportActions(filteredActions)}
            disabled={!filteredActions.length}
            className="h-8 px-3 rounded-xl border border-white/10 bg-white/[0.04] hover:bg-white/[0.08] text-xs font-medium inline-flex items-center gap-1.5 disabled:opacity-50"
            data-testid="button-export-actions-csv"
          >
            <Download size={13} /> Actions CSV
          </button>
        </div>
        {filteredActions.length ? (
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
            {filteredActions.map((a, i) => (
              <li
                key={`${a.user_id}-${a.kind}-${i}`}
                data-testid={`action-${a.kind}-${a.user_id}`}
              >
                <AdminCard className="h-full">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <Link
                      href={`/admin/clients/${a.user_id}`}
                      className="font-semibold text-sm hover:text-cyan-300 truncate"
                      data-testid={`link-action-client-${a.user_id}`}
                    >
                      {a.full_name}
                    </Link>
                    <span
                      className={cn(
                        "shrink-0 px-1.5 h-5 inline-flex items-center text-[10px] rounded-full border uppercase tracking-wider",
                        PRIORITY_TONE[a.priority] ?? PRIORITY_TONE.low,
                      )}
                    >
                      {a.priority}
                    </span>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider text-cyan-300/80 mb-1">
                    {a.service}
                  </p>
                  <p className="text-xs text-foreground/90 mb-1">{a.reason}</p>
                  <p className="text-[11px] text-muted-foreground mb-2">
                    {a.suggested}
                  </p>
                  <Link
                    href={`/admin/clients/${a.user_id}`}
                    className="text-[11px] text-primary inline-flex items-center gap-1 hover:underline"
                  >
                    Open client <ChevronRight size={11} />
                  </Link>
                </AdminCard>
              </li>
            ))}
          </ul>
        ) : (
          <AdminCard>
            <AdminEmptyState
              icon={<CheckCircle2 size={32} className="text-emerald-300" />}
              title="No actions match these filters"
              body="Adjust the service or priority filter, or check back later."
              testId="empty-actions"
            />
          </AdminCard>
        )}
      </section>
    </div>
    </div>
  );
}
