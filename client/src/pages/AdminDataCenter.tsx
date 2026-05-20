import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FileSpreadsheet,
  FileText,
  Database,
  Search,
  Users,
  X,
  RefreshCcw,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
  AdminEmptyState,
  AdminSkeletonStack,
  AdminStatCard,
} from "@/components/admin/primitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

type DataCenterRow = {
  id: number;
  full_name: string;
  phone: string | null;
  email: string | null;
  username: string | null;
  area: string | null;
  primary_goal: string | null;
  fitness_goal: string | null;
  training_goal: string | null;
  training_level: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  injuries: string | null;
  medical_notes: string | null;
  notes: string | null;
  admin_notes: string | null;
  coach_notes: string | null;
  goal_notes: string | null;
  communication_notes: string | null;
  lead_source: string | null;
  lead_status: string | null;
  client_status: string | null;
  vip_tier: string | null;
  weekly_frequency: number | null;
  no_show_count: number | null;
  archived_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  tl_label: string | null;
  tl_kind: string | null;
  tl_gym: string | null;
  tl_address: string | null;
  tl_building: string | null;
  tl_room: string | null;
  pkg_name: string | null;
  pkg_type: string | null;
  pkg_total: number | null;
  pkg_used: number | null;
  pkg_start: string | null;
  pkg_expiry: string | null;
  pkg_status: string | null;
  pkg_is_active: boolean | null;
  pkg_frozen: boolean | null;
  has_nutrition: boolean;
  recovery_active_count: number;
  recovery_total_count: number;
  last_session_at: string | null;
};

type DataCenterResponse = {
  rows: DataCenterRow[];
  generatedAt: string;
  count: number;
};

// Column definition — drives both the on-screen table and every export.
// Order here is the order columns appear in CSV / Excel / JSON.
type ColDef = {
  key: string;
  label: string;
  get: (r: DataCenterRow) => string | number | null | undefined;
};

const COLUMNS: ColDef[] = [
  { key: "id", label: "ID", get: (r) => r.id },
  { key: "fullName", label: "Full Name", get: (r) => r.full_name },
  { key: "phone", label: "Phone", get: (r) => r.phone },
  { key: "email", label: "Email", get: (r) => r.email },
  { key: "gender", label: "Gender", get: () => null },
  { key: "age", label: "Age", get: () => null },
  { key: "country", label: "Country", get: () => "United Arab Emirates" },
  { key: "city", label: "City", get: (r) => r.area },
  { key: "area", label: "Area", get: (r) => r.area },
  { key: "building", label: "Building / Tower", get: (r) => r.tl_building },
  { key: "apartment", label: "Apartment", get: (r) => r.tl_room },
  { key: "gymName", label: "Gym Name", get: (r) => r.tl_gym },
  {
    key: "trainingLocation",
    label: "Training Location",
    get: (r) =>
      r.tl_label || r.tl_address || (r.tl_kind ? formatLocationKind(r.tl_kind) : null),
  },
  { key: "goal", label: "Goal", get: (r) => r.primary_goal || r.fitness_goal },
  { key: "height", label: "Height (cm)", get: () => null },
  { key: "weight", label: "Weight (kg)", get: () => null },
  { key: "bodyFat", label: "Body Fat (%)", get: () => null },
  { key: "medicalConditions", label: "Medical Conditions", get: (r) => r.medical_notes },
  { key: "injuries", label: "Injuries", get: (r) => r.injuries },
  { key: "medications", label: "Medications", get: () => null },
  {
    key: "emergencyContact",
    label: "Emergency Contact",
    get: (r) =>
      [r.emergency_contact_name, r.emergency_contact_phone].filter(Boolean).join(" · ") || null,
  },
  { key: "packageName", label: "Package Name", get: (r) => r.pkg_name || r.pkg_type },
  {
    key: "sessions",
    label: "Sessions",
    get: (r) =>
      r.pkg_total != null ? `${r.pkg_used ?? 0} / ${r.pkg_total}` : null,
  },
  { key: "packageStart", label: "Package Start", get: (r) => r.pkg_start },
  { key: "packageExpiry", label: "Package Expiry", get: (r) => r.pkg_expiry },
  {
    key: "nutritionStatus",
    label: "Nutrition Status",
    get: (r) => (r.has_nutrition ? "Active plan" : "—"),
  },
  {
    key: "recoveryStatus",
    label: "Recovery Status",
    get: (r) =>
      r.recovery_active_count > 0
        ? `${r.recovery_active_count} active`
        : r.recovery_total_count > 0
          ? `${r.recovery_total_count} past`
          : "—",
  },
  { key: "leadSource", label: "Lead Source", get: (r) => r.lead_source },
  { key: "trainerNotes", label: "Trainer Notes", get: (r) => r.admin_notes || r.coach_notes },
  { key: "clientNotes", label: "Client Notes", get: (r) => r.notes },
  { key: "registrationDate", label: "Registration Date", get: (r) => fmtDate(r.created_at) },
  { key: "lastSession", label: "Last Session", get: (r) => fmtDate(r.last_session_at) },
  { key: "clientStatus", label: "Client Status", get: (r) => r.client_status },
  { key: "updatedAt", label: "Updated At", get: (r) => fmtDateTime(r.updated_at) },
];

function formatLocationKind(k: string): string {
  return k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function fmtDate(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function fmtDateTime(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().replace("T", " ").slice(0, 16);
}

function csvEscape(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function htmlEscape(v: unknown): string {
  if (v == null) return "";
  return String(v)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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

function exportCsv(rows: DataCenterRow[]) {
  const header = COLUMNS.map((c) => csvEscape(c.label)).join(",");
  const body = rows
    .map((r) => COLUMNS.map((c) => csvEscape(c.get(r))).join(","))
    .join("\n");
  const csv = "\ufeff" + header + "\n" + body;
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(new Blob([csv], { type: "text/csv;charset=utf-8" }), `clients-${stamp}.csv`);
}

// SpreadsheetML-via-HTML — Excel and Google Sheets both open this as a
// real worksheet (one column per <th>). Zero dependency, UTF-8 safe.
function exportExcel(rows: DataCenterRow[]) {
  const head = COLUMNS.map((c) => `<th>${htmlEscape(c.label)}</th>`).join("");
  const body = rows
    .map(
      (r) =>
        `<tr>${COLUMNS.map((c) => `<td>${htmlEscape(c.get(r) ?? "")}</td>`).join("")}</tr>`,
    )
    .join("");
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">` +
    `<head><meta charset="utf-8"></head>` +
    `<body><table border="1">` +
    `<thead><tr>${head}</tr></thead>` +
    `<tbody>${body}</tbody>` +
    `</table></body></html>`;
  const stamp = new Date().toISOString().slice(0, 10);
  triggerDownload(
    new Blob(["\ufeff" + html], { type: "application/vnd.ms-excel;charset=utf-8" }),
    `clients-${stamp}.xls`,
  );
}

function exportJsonDump(rows: DataCenterRow[]) {
  const stamp = new Date().toISOString().slice(0, 10);
  const payload = {
    generatedAt: new Date().toISOString(),
    count: rows.length,
    columns: COLUMNS.map((c) => c.label),
    rows,
  };
  triggerDownload(
    new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }),
    `client-database-${stamp}.json`,
  );
}

const STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "incomplete", label: "Incomplete" },
  { value: "frozen", label: "Frozen" },
  { value: "expired", label: "Expired" },
  { value: "completed", label: "Completed" },
];

export default function AdminDataCenter() {
  const { toast } = useToast();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [locationFilter, setLocationFilter] = useState<string>("all");
  const [gymFilter, setGymFilter] = useState<string>("all");
  const [goalFilter, setGoalFilter] = useState<string>("all");
  const [packageFilter, setPackageFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Set<number>>(new Set());

  const { data, isLoading, isError, refetch, isFetching } = useQuery<DataCenterResponse>({
    queryKey: ["/api/admin/data-center"],
    staleTime: 30_000,
  });

  const rows = data?.rows ?? [];

  // Filter option pools, derived from data
  const locationOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const v = r.tl_kind || "";
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [rows]);

  const gymOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const v = (r.tl_gym || "").trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [rows]);

  const goalOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const v = (r.primary_goal || r.fitness_goal || "").trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [rows]);

  const packageOptions = useMemo(() => {
    const s = new Set<string>();
    rows.forEach((r) => {
      const v = (r.pkg_type || "").trim();
      if (v) s.add(v);
    });
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((r) => {
      if (statusFilter !== "all") {
        const cs = (r.client_status || "").toLowerCase();
        if (statusFilter === "frozen") {
          if (!r.pkg_frozen) return false;
        } else if (statusFilter === "expired") {
          if (cs !== "expired" && r.pkg_status !== "expired") return false;
        } else if (statusFilter === "active") {
          if (cs !== "active") return false;
        } else if (cs !== statusFilter) {
          return false;
        }
      }
      if (locationFilter !== "all" && r.tl_kind !== locationFilter) return false;
      if (gymFilter !== "all" && (r.tl_gym || "") !== gymFilter) return false;
      if (goalFilter !== "all") {
        const g = r.primary_goal || r.fitness_goal || "";
        if (g !== goalFilter) return false;
      }
      if (packageFilter !== "all" && (r.pkg_type || "") !== packageFilter) return false;
      if (needle) {
        const hay = [
          r.full_name,
          r.phone,
          r.email,
          r.username,
          r.area,
          r.tl_gym,
          r.pkg_name,
        ]
          .map((v) => (v || "").toLowerCase())
          .join(" ");
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [rows, q, statusFilter, locationFilter, gymFilter, goalFilter, packageFilter]);

  const selectedRows = useMemo(
    () => filtered.filter((r) => selected.has(r.id)),
    [filtered, selected],
  );

  const hasActiveFilters =
    !!q ||
    statusFilter !== "all" ||
    locationFilter !== "all" ||
    gymFilter !== "all" ||
    goalFilter !== "all" ||
    packageFilter !== "all";

  const clearAll = () => {
    setQ("");
    setStatusFilter("all");
    setLocationFilter("all");
    setGymFilter("all");
    setGoalFilter("all");
    setPackageFilter("all");
  };

  const allOnPageSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allOnPageSelected) {
      filtered.forEach((r) => next.delete(r.id));
    } else {
      filtered.forEach((r) => next.add(r.id));
    }
    setSelected(next);
  };

  const toggleOne = (id: number) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const handleExport = (
    fmt: "csv" | "xls" | "json",
    scope: "selected" | "filtered" | "all",
  ) => {
    let target: DataCenterRow[];
    if (scope === "selected") target = selectedRows;
    else if (scope === "filtered") target = filtered;
    else target = rows;
    if (target.length === 0) {
      toast({
        title: "Nothing to export",
        description: "Select at least one client or adjust your filters.",
        variant: "destructive",
      });
      return;
    }
    if (fmt === "csv") exportCsv(target);
    else if (fmt === "xls") exportExcel(target);
    else exportJsonDump(target);
    toast({
      title: `Exported ${target.length} client${target.length === 1 ? "" : "s"}`,
      description: `Format: ${fmt.toUpperCase()} · scope: ${scope}`,
    });
  };

  // Stat counts
  const totalClients = rows.length;
  const activeClients = rows.filter((r) => (r.client_status || "") === "active").length;
  const frozenClients = rows.filter((r) => r.pkg_frozen).length;
  const expiredClients = rows.filter(
    (r) => (r.pkg_status || "") === "expired" || (r.client_status || "") === "expired",
  ).length;

  return (
    <div className="admin-shell">
      <div className="admin-container space-y-5">
        <AdminPageHeader
          eyebrow="Admin · Data"
          title="Client Data Center"
          subtitle="Every registered client, every field, one place — search, filter, and export."
          testId="text-data-center-title"
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <AdminStatCard
            icon={<Users size={16} />}
            label="Total clients"
            value={totalClients}
            testId="stat-total-clients"
          />
          <AdminStatCard
            icon={<Users size={16} />}
            label="Active"
            value={activeClients}
            testId="stat-active-clients"
          />
          <AdminStatCard
            icon={<Users size={16} />}
            label="Frozen"
            value={frozenClients}
            testId="stat-frozen-clients"
          />
          <AdminStatCard
            icon={<Users size={16} />}
            label="Expired"
            value={expiredClients}
            testId="stat-expired-clients"
          />
        </div>

        <AdminCard>
          <div className="p-4 sm:p-5 space-y-4">
            {/* Search + actions */}
            <div className="flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">
              <div className="relative flex-1 max-w-xl">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40"
                  size={16}
                />
                <Input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search name, phone, email, gym, package…"
                  className="pl-9 bg-black/40 border-white/10 text-white placeholder:text-white/30"
                  data-testid="input-search-clients"
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetch()}
                  disabled={isFetching}
                  className="bg-black/40 border-white/10 text-white hover:bg-white/5"
                  data-testid="button-refresh"
                >
                  <RefreshCcw size={14} className={isFetching ? "animate-spin" : ""} />
                  Refresh
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("csv", selected.size > 0 ? "selected" : "filtered")}
                  className="bg-black/40 border-white/10 text-white hover:bg-white/5"
                  data-testid="button-export-csv"
                >
                  <FileText size={14} />
                  Export CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleExport("xls", selected.size > 0 ? "selected" : "filtered")}
                  className="bg-black/40 border-white/10 text-white hover:bg-white/5"
                  data-testid="button-export-excel"
                >
                  <FileSpreadsheet size={14} />
                  Export Excel
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleExport("json", "all")}
                  className="bg-[hsl(183,100%,74%)] text-black hover:bg-[hsl(183,100%,80%)]"
                  data-testid="button-download-database"
                >
                  <Database size={14} />
                  Download Client Database
                </Button>
              </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger
                  className="bg-black/40 border-white/10 text-white"
                  data-testid="select-status-filter"
                >
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={locationFilter} onValueChange={setLocationFilter}>
                <SelectTrigger
                  className="bg-black/40 border-white/10 text-white"
                  data-testid="select-location-filter"
                >
                  <SelectValue placeholder="Location" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All locations</SelectItem>
                  {locationOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {formatLocationKind(v)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={gymFilter} onValueChange={setGymFilter}>
                <SelectTrigger
                  className="bg-black/40 border-white/10 text-white"
                  data-testid="select-gym-filter"
                >
                  <SelectValue placeholder="Gym" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All gyms</SelectItem>
                  {gymOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={goalFilter} onValueChange={setGoalFilter}>
                <SelectTrigger
                  className="bg-black/40 border-white/10 text-white"
                  data-testid="select-goal-filter"
                >
                  <SelectValue placeholder="Goal" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All goals</SelectItem>
                  {goalOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v.replace(/_/g, " ")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={packageFilter} onValueChange={setPackageFilter}>
                <SelectTrigger
                  className="bg-black/40 border-white/10 text-white"
                  data-testid="select-package-filter"
                >
                  <SelectValue placeholder="Package type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All packages</SelectItem>
                  {packageOptions.map((v) => (
                    <SelectItem key={v} value={v}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Active filter summary */}
            <div className="flex flex-wrap items-center gap-2 text-xs text-white/60">
              <span data-testid="text-result-count">
                Showing <b className="text-white">{filtered.length}</b> of {totalClients} clients
                {selected.size > 0 && (
                  <>
                    {" · "}
                    <b className="text-[hsl(183,100%,74%)]">{selected.size}</b> selected
                  </>
                )}
              </span>
              {hasActiveFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAll}
                  className="h-7 px-2 text-white/60 hover:text-white"
                  data-testid="button-clear-filters"
                >
                  <X size={12} />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </AdminCard>

        <AdminCard>
          {isLoading ? (
            <div className="p-4">
              <AdminSkeletonStack count={6} />
            </div>
          ) : isError ? (
            <div className="flex flex-col items-center py-10 gap-3">
              <AdminEmptyState
                icon={<Database size={28} />}
                title="Could not load clients"
                body="Try refreshing — if the issue persists, check the server logs."
              />
              <Button onClick={() => refetch()} data-testid="button-retry">
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <AdminEmptyState
              icon={<Users size={28} />}
              title="No clients match"
              body={
                hasActiveFilters
                  ? "Adjust filters or clear them to see more clients."
                  : "When clients register, they'll appear here automatically."
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-black/40 border-b border-white/10 text-white/60 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="p-3 text-left w-8">
                      <Checkbox
                        checked={allOnPageSelected}
                        onCheckedChange={toggleAll}
                        data-testid="checkbox-select-all"
                      />
                    </th>
                    <th className="p-3 text-left">Client</th>
                    <th className="p-3 text-left hidden md:table-cell">Contact</th>
                    <th className="p-3 text-left hidden lg:table-cell">Location</th>
                    <th className="p-3 text-left hidden lg:table-cell">Goal</th>
                    <th className="p-3 text-left">Package</th>
                    <th className="p-3 text-left hidden md:table-cell">Status</th>
                    <th className="p-3 text-left hidden xl:table-cell">Registered</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {filtered.map((r) => {
                    const isSel = selected.has(r.id);
                    const statusLabel =
                      (r.pkg_frozen && "Frozen") ||
                      (r.pkg_status === "expired" && "Expired") ||
                      r.client_status ||
                      "—";
                    return (
                      <tr
                        key={r.id}
                        className={
                          isSel
                            ? "bg-[hsl(183,100%,74%)]/5"
                            : "hover:bg-white/[0.02]"
                        }
                        data-testid={`row-client-${r.id}`}
                      >
                        <td className="p-3 align-top">
                          <Checkbox
                            checked={isSel}
                            onCheckedChange={() => toggleOne(r.id)}
                            data-testid={`checkbox-client-${r.id}`}
                          />
                        </td>
                        <td className="p-3 align-top">
                          <div
                            className="font-medium text-white"
                            data-testid={`text-name-${r.id}`}
                          >
                            {r.full_name}
                          </div>
                          <div className="text-xs text-white/40 md:hidden">
                            {r.phone || r.email || "—"}
                          </div>
                          {r.lead_source && (
                            <Badge
                              variant="outline"
                              className="mt-1 border-white/10 text-white/60 text-[10px]"
                            >
                              {r.lead_source}
                            </Badge>
                          )}
                        </td>
                        <td className="p-3 align-top hidden md:table-cell text-white/70">
                          <div data-testid={`text-phone-${r.id}`}>{r.phone || "—"}</div>
                          <div
                            className="text-xs text-white/40"
                            data-testid={`text-email-${r.id}`}
                          >
                            {r.email || "—"}
                          </div>
                        </td>
                        <td className="p-3 align-top hidden lg:table-cell text-white/70">
                          <div>{r.tl_gym || r.tl_label || (r.tl_kind ? formatLocationKind(r.tl_kind) : "—")}</div>
                          <div className="text-xs text-white/40">{r.area || ""}</div>
                        </td>
                        <td className="p-3 align-top hidden lg:table-cell text-white/70 capitalize">
                          {(r.primary_goal || r.fitness_goal || "—").replace(/_/g, " ")}
                        </td>
                        <td className="p-3 align-top">
                          <div className="text-white/80">{r.pkg_name || r.pkg_type || "—"}</div>
                          {r.pkg_total != null && (
                            <div className="text-xs text-white/40">
                              {r.pkg_used ?? 0} / {r.pkg_total} sessions
                            </div>
                          )}
                        </td>
                        <td className="p-3 align-top hidden md:table-cell">
                          <Badge
                            variant="outline"
                            className={
                              statusLabel === "active"
                                ? "border-[hsl(183,100%,74%)]/40 text-[hsl(183,100%,74%)]"
                                : statusLabel === "Frozen"
                                  ? "border-blue-400/40 text-blue-300"
                                  : statusLabel === "Expired"
                                    ? "border-red-400/40 text-red-300"
                                    : "border-white/10 text-white/60"
                            }
                            data-testid={`badge-status-${r.id}`}
                          >
                            {statusLabel}
                          </Badge>
                        </td>
                        <td className="p-3 align-top hidden xl:table-cell text-white/60 text-xs">
                          {fmtDate(r.created_at) || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </AdminCard>

        {selected.size > 0 && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 flex items-center gap-2 rounded-full border border-white/10 bg-black/80 backdrop-blur px-3 py-2 shadow-xl">
            <span className="text-xs text-white/70">{selected.size} selected</span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-black/40 border-white/10 text-white"
              onClick={() => handleExport("csv", "selected")}
              data-testid="button-export-selected-csv"
            >
              <Download size={12} />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 bg-black/40 border-white/10 text-white"
              onClick={() => handleExport("xls", "selected")}
              data-testid="button-export-selected-excel"
            >
              <Download size={12} />
              Excel
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-white/60"
              onClick={() => setSelected(new Set())}
              data-testid="button-clear-selection"
            >
              <X size={12} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
