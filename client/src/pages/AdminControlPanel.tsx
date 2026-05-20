import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  AdminCard,
  AdminPageHeader,
  AdminEmptyState,
  AdminSkeletonStack,
  AdminStatCard,
} from "@/components/admin/primitives";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Shield,
  ListChecks,
  Tag as TagIcon,
  ScrollText,
  BellRing,
  Filter,
  Layers,
  Eye,
  BookOpenCheck,
  UserCog,
  CheckCircle2,
  AlertTriangle,
  Activity,
  KeyRound,
  Power,
} from "lucide-react";

type AdminMeta = {
  admin: { id: number; email: string; adminRole: string; isSuperAdmin: boolean };
  counts: { openTasks: number; totalTags: number; auditEntries: number };
  recentAudit: any[];
  notificationPrefs: Record<string, boolean>;
};

type AdminTask = {
  id: number;
  title: string;
  relatedUserId: number | null;
  priority: "low" | "medium" | "high";
  dueDate: string | null;
  status: "open" | "done" | "archived";
  notes: string | null;
  createdAt: string;
};

type ClientTag = {
  id: number;
  userId: number;
  label: string;
  color: string | null;
  createdAt: string;
};

type AuditEntry = {
  id: number;
  performedByUserId: number | null;
  action: string;
  entityType: string | null;
  entityId: number | null;
  reason: string | null;
  previousValue: any;
  newValue: any;
  createdAt: string;
};

type SavedFilter = {
  id: number;
  ownerUserId: number;
  name: string;
  page: string;
  queryJson: any;
  createdAt: string;
};

type AdminUserRow = {
  id: number;
  email: string;
  firstName: string | null;
  lastName: string | null;
  adminRole: string;
  isActive: boolean;
};

const NOTIFICATION_KEYS: { key: string; label: string }[] = [
  { key: "client_registered", label: "New client registered" },
  { key: "pending_verification", label: "Pending package verification" },
  { key: "package_expiring", label: "Package expiring soon" },
  { key: "nutrition_expiring", label: "Nutrition plan expiring" },
  { key: "failed_emails", label: "Failed email delivery" },
  { key: "recovery_request", label: "Recovery / mobility request" },
  { key: "inactive_client", label: "Inactive client (14d)" },
];

export default function AdminControlPanel() {
  const [tab, setTab] = useState("overview");
  const { toast } = useToast();

  const metaQ = useQuery<AdminMeta>({ queryKey: ["/api/admin/control-panel/me"] });

  const isSuper = !!metaQ.data?.admin?.isSuperAdmin;

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10">
        <AdminPageHeader
          title="Admin Control Panel"
          subtitle="RBAC, audit, tags, tasks, notifications, policies — one place."
          eyebrow="Operations"
        />

        {metaQ.isLoading ? (
          <AdminSkeletonStack count={4} />
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-4">
              <AdminStatCard
                label="Open tasks"
                value={metaQ.data?.counts.openTasks ?? 0}
                icon={<ListChecks className="h-4 w-4" />}
                testId="stat-open-tasks"
              />
              <AdminStatCard
                label="Client tags"
                value={metaQ.data?.counts.totalTags ?? 0}
                icon={<TagIcon className="h-4 w-4" />}
                testId="stat-client-tags"
              />
              <AdminStatCard
                label="Recent audit entries"
                value={metaQ.data?.counts.auditEntries ?? 0}
                icon={<ScrollText className="h-4 w-4" />}
                testId="stat-audit-entries"
              />
              <AdminStatCard
                label="Your role"
                value={(metaQ.data?.admin.adminRole ?? "—").replace("_", " ")}
                icon={<UserCog className="h-4 w-4" />}
                testId="stat-admin-role"
                format="raw"
              />
            </div>

            <Tabs value={tab} onValueChange={setTab} className="mt-8">
              <TabsList className="flex w-full flex-wrap gap-1 bg-white/[0.03] p-1 ring-1 ring-white/10">
                <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
                <TabsTrigger value="tasks" data-testid="tab-tasks">Tasks</TabsTrigger>
                <TabsTrigger value="tags" data-testid="tab-tags">Tags</TabsTrigger>
                <TabsTrigger value="audit" data-testid="tab-audit">Audit</TabsTrigger>
                <TabsTrigger value="notifications" data-testid="tab-notifications">Notifications</TabsTrigger>
                <TabsTrigger value="filters" data-testid="tab-filters">Saved filters</TabsTrigger>
                <TabsTrigger value="overrides" data-testid="tab-overrides">Manual overrides</TabsTrigger>
                <TabsTrigger value="roles" data-testid="tab-roles">Roles & RBAC</TabsTrigger>
                <TabsTrigger value="bulk" data-testid="tab-bulk">Bulk actions</TabsTrigger>
                <TabsTrigger value="view-as" data-testid="tab-view-as">View as client</TabsTrigger>
                <TabsTrigger value="system" data-testid="tab-system">System health</TabsTrigger>
                <TabsTrigger value="policies" data-testid="tab-policies">Policies</TabsTrigger>
              </TabsList>

              <TabsContent value="overview" className="mt-6">
                <OverviewPane meta={metaQ.data} />
              </TabsContent>
              <TabsContent value="tasks" className="mt-6"><TasksPane toast={toast} /></TabsContent>
              <TabsContent value="tags" className="mt-6"><TagsPane toast={toast} /></TabsContent>
              <TabsContent value="audit" className="mt-6"><AuditPane /></TabsContent>
              <TabsContent value="notifications" className="mt-6"><NotificationsPane toast={toast} initial={metaQ.data?.notificationPrefs} /></TabsContent>
              <TabsContent value="filters" className="mt-6"><SavedFiltersPane toast={toast} /></TabsContent>
              <TabsContent value="overrides" className="mt-6"><OverridesPane toast={toast} /></TabsContent>
              <TabsContent value="roles" className="mt-6"><RolesPane toast={toast} isSuper={isSuper} /></TabsContent>
              <TabsContent value="bulk" className="mt-6"><BulkPane toast={toast} /></TabsContent>
              <TabsContent value="view-as" className="mt-6"><ViewAsPane toast={toast} /></TabsContent>
              <TabsContent value="system" className="mt-6"><SystemHealthPane toast={toast} isSuper={isSuper} /></TabsContent>
              <TabsContent value="policies" className="mt-6"><PoliciesPane /></TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </div>
  );
}

// ---------- Panes ----------

function OverviewPane({ meta }: { meta: AdminMeta | undefined }) {
  if (!meta) return <AdminSkeletonStack count={2} />;
  return (
    <AdminCard className="p-6">
      <h3 className="text-lg font-semibold text-white">Recent activity</h3>
      <p className="mt-1 text-sm text-white/60">Last 10 audit events across all admins.</p>
      <div className="mt-4 space-y-2">
        {meta.recentAudit.length === 0 ? (
          <AdminEmptyState icon={<ScrollText className="h-6 w-6" />} title="No activity yet" />
        ) : meta.recentAudit.map((e: any) => (
          <div key={e.id} className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-2 text-sm">
            <div className="flex items-center gap-3">
              <Badge variant="outline" className="border-cyan-500/30 text-cyan-300">{e.action}</Badge>
              <span className="text-white/70">{e.entityType ?? "—"}{e.entityId != null ? ` #${e.entityId}` : ""}</span>
            </div>
            <span className="text-xs text-white/40">{new Date(e.createdAt).toLocaleString("en-AE", { timeZone: "Asia/Dubai" })}</span>
          </div>
        ))}
      </div>
    </AdminCard>
  );
}

function TasksPane({ toast }: { toast: any }) {
  const q = useQuery<AdminTask[]>({ queryKey: ["/api/admin/control-panel/tasks"] });
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [notes, setNotes] = useState("");

  const create = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/control-panel/tasks", { title, priority, notes });
    },
    onSuccess: () => {
      setTitle(""); setNotes(""); setPriority("medium");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/control-panel/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/control-panel/me"] });
      toast({ title: "Task created" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const setStatus = useMutation({
    mutationFn: async (v: { id: number; status: AdminTask["status"] }) => {
      await apiRequest("PATCH", `/api/admin/control-panel/tasks/${v.id}`, { status: v.status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/control-panel/tasks"] }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/control-panel/tasks/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/control-panel/tasks"] }),
  });

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <AdminCard className="p-6 lg:col-span-1">
        <h3 className="text-lg font-semibold">New task</h3>
        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-white/70">Title</Label>
            <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Follow up with Khaled re: package" data-testid="input-task-title" />
          </div>
          <div>
            <Label className="text-white/70">Priority</Label>
            <Select value={priority} onValueChange={(v: any) => setPriority(v)}>
              <SelectTrigger data-testid="select-task-priority"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-white/70">Notes</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} data-testid="input-task-notes" />
          </div>
          <Button onClick={() => create.mutate()} disabled={!title.trim() || create.isPending} className="w-full" data-testid="button-task-create">
            {create.isPending ? "Creating…" : "Create task"}
          </Button>
        </div>
      </AdminCard>

      <AdminCard className="p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold">Open tasks</h3>
        <div className="mt-4 space-y-2">
          {q.isLoading ? <AdminSkeletonStack count={3} /> :
           (q.data ?? []).length === 0 ? <AdminEmptyState icon={<ListChecks className="h-6 w-6" />} title="No tasks" /> :
           (q.data ?? []).map(t => (
            <div key={t.id} className="flex items-start justify-between rounded-md border border-white/5 bg-white/[0.02] p-3" data-testid={`row-task-${t.id}`}>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={
                    t.priority === "high" ? "border-red-500/40 text-red-300" :
                    t.priority === "medium" ? "border-amber-500/40 text-amber-300" :
                    "border-white/20 text-white/60"
                  }>{t.priority}</Badge>
                  <Badge variant="outline" className={
                    t.status === "done" ? "border-emerald-500/40 text-emerald-300" :
                    t.status === "archived" ? "border-white/20 text-white/40" :
                    "border-cyan-500/40 text-cyan-300"
                  }>{t.status}</Badge>
                  <span className={`text-sm ${t.status === "done" ? "line-through text-white/40" : "text-white"}`}>{t.title}</span>
                </div>
                {t.notes && <p className="mt-1 text-xs text-white/50">{t.notes}</p>}
              </div>
              <div className="flex gap-1">
                {t.status !== "done" && (
                  <Button size="sm" variant="ghost" onClick={() => setStatus.mutate({ id: t.id, status: "done" })} data-testid={`button-task-done-${t.id}`}>
                    <CheckCircle2 className="h-4 w-4" />
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => del.mutate(t.id)} data-testid={`button-task-delete-${t.id}`}>
                  ✕
                </Button>
              </div>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

function TagsPane({ toast }: { toast: any }) {
  const q = useQuery<ClientTag[]>({ queryKey: ["/api/admin/control-panel/tags"] });
  const [userId, setUserId] = useState("");
  const [label, setLabel] = useState("");
  const [color, setColor] = useState("");

  const add = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/control-panel/tags", {
        userId: Number(userId),
        label: label.trim(),
        color: color.trim() || null,
      });
    },
    onSuccess: () => {
      setUserId(""); setLabel(""); setColor("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/control-panel/tags"] });
      toast({ title: "Tag added" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/control-panel/tags/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/control-panel/tags"] }),
  });

  const grouped = useMemo(() => {
    const m = new Map<number, ClientTag[]>();
    (q.data ?? []).forEach(t => {
      const arr = m.get(t.userId) ?? [];
      arr.push(t); m.set(t.userId, arr);
    });
    return Array.from(m.entries());
  }, [q.data]);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <AdminCard className="p-6 lg:col-span-1">
        <h3 className="text-lg font-semibold">Add tag</h3>
        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-white/70">Client user ID</Label>
            <Input value={userId} onChange={e => setUserId(e.target.value.replace(/\D/g, ""))} placeholder="42" data-testid="input-tag-user-id" />
          </div>
          <div>
            <Label className="text-white/70">Label</Label>
            <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="VIP" data-testid="input-tag-label" />
          </div>
          <div>
            <Label className="text-white/70">Color (optional hex)</Label>
            <Input value={color} onChange={e => setColor(e.target.value)} placeholder="#5ee7ff" data-testid="input-tag-color" />
          </div>
          <Button onClick={() => add.mutate()} disabled={!userId || !label.trim() || add.isPending} className="w-full" data-testid="button-tag-add">
            {add.isPending ? "Adding…" : "Add tag"}
          </Button>
        </div>
      </AdminCard>
      <AdminCard className="p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold">All tags</h3>
        <div className="mt-4 space-y-3">
          {q.isLoading ? <AdminSkeletonStack count={2} /> :
           grouped.length === 0 ? <AdminEmptyState icon={<TagIcon className="h-6 w-6" />} title="No tags yet" /> :
           grouped.map(([uid, tags]) => (
            <div key={uid} className="rounded-md border border-white/5 bg-white/[0.02] p-3" data-testid={`row-tag-user-${uid}`}>
              <div className="text-xs uppercase tracking-wide text-white/40">User #{uid}</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {tags.map(t => (
                  <Badge
                    key={t.id}
                    variant="outline"
                    className="cursor-pointer border-cyan-500/30 text-cyan-200"
                    style={t.color ? { borderColor: t.color, color: t.color } : undefined}
                    onClick={() => del.mutate(t.id)}
                    data-testid={`badge-tag-${t.id}`}
                  >
                    {t.label} <span className="ml-1 opacity-50">✕</span>
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

function AuditPane() {
  const q = useQuery<AuditEntry[]>({ queryKey: ["/api/admin/control-panel/audit-log"] });
  return (
    <AdminCard className="p-6">
      <h3 className="text-lg font-semibold">Audit log</h3>
      <p className="mt-1 text-sm text-white/60">Latest {q.data?.length ?? 0} entries. Append-only.</p>
      <div className="mt-4 overflow-x-auto">
        {q.isLoading ? <AdminSkeletonStack count={5} /> :
         (q.data ?? []).length === 0 ? <AdminEmptyState icon={<ScrollText className="h-6 w-6" />} title="No audit entries" /> :
         <table className="w-full text-sm">
           <thead className="text-left text-xs uppercase tracking-wide text-white/40">
             <tr><th className="py-2">When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Metadata</th></tr>
           </thead>
           <tbody>
             {q.data!.map(e => {
               const meta = e.newValue ?? e.previousValue ?? null;
               return (
                 <tr key={e.id} className="border-t border-white/5" data-testid={`row-audit-${e.id}`}>
                   <td className="py-2 text-white/60">{new Date(e.createdAt).toLocaleString("en-AE", { timeZone: "Asia/Dubai" })}</td>
                   <td className="text-white/70">#{e.performedByUserId ?? "—"}</td>
                   <td><Badge variant="outline" className="border-cyan-500/30 text-cyan-300">{e.action}</Badge></td>
                   <td className="text-white/70">{e.entityType ?? "—"}{e.entityId != null ? ` #${e.entityId}` : ""}</td>
                   <td className="text-xs text-white/50">{e.reason ? `${e.reason} · ` : ""}{meta ? JSON.stringify(meta).slice(0, 60) : "—"}</td>
                 </tr>
               );
             })}
           </tbody>
         </table>
        }
      </div>
    </AdminCard>
  );
}

function NotificationsPane({ toast, initial }: { toast: any; initial: Record<string, boolean> | undefined }) {
  const [prefs, setPrefs] = useState<Record<string, boolean>>(initial ?? {});
  const save = useMutation({
    mutationFn: async () => { await apiRequest("PUT", "/api/admin/control-panel/notification-prefs", prefs); },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/control-panel/me"] });
      toast({ title: "Saved" });
    },
  });
  return (
    <AdminCard className="p-6">
      <h3 className="text-lg font-semibold">Notification preferences</h3>
      <p className="mt-1 text-sm text-white/60">Toggle which admin alerts you want to receive.</p>
      <div className="mt-4 space-y-2">
        {NOTIFICATION_KEYS.map(({ key, label }) => (
          <div key={key} className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] px-3 py-3">
            <div className="flex items-center gap-2"><BellRing className="h-4 w-4 text-cyan-300" /><span className="text-sm">{label}</span></div>
            <Switch
              checked={!!prefs[key]}
              onCheckedChange={(v) => setPrefs(p => ({ ...p, [key]: v }))}
              data-testid={`switch-pref-${key}`}
            />
          </div>
        ))}
      </div>
      <Button className="mt-4" onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-prefs-save">
        {save.isPending ? "Saving…" : "Save preferences"}
      </Button>
    </AdminCard>
  );
}

function SavedFiltersPane({ toast }: { toast: any }) {
  const q = useQuery<SavedFilter[]>({ queryKey: ["/api/admin/control-panel/saved-filters"] });
  const [name, setName] = useState("");
  const [page, setPage] = useState("clients");
  const [queryStr, setQueryStr] = useState("{}");
  const add = useMutation({
    mutationFn: async () => {
      let parsed: any = {};
      try { parsed = JSON.parse(queryStr); } catch { throw new Error("Query must be valid JSON"); }
      await apiRequest("POST", "/api/admin/control-panel/saved-filters", { name, page, queryJson: parsed });
    },
    onSuccess: () => {
      setName(""); setQueryStr("{}");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/control-panel/saved-filters"] });
      toast({ title: "Filter saved" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });
  const del = useMutation({
    mutationFn: async (id: number) => { await apiRequest("DELETE", `/api/admin/control-panel/saved-filters/${id}`); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/control-panel/saved-filters"] }),
  });
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <AdminCard className="p-6 lg:col-span-1">
        <h3 className="text-lg font-semibold">Save filter</h3>
        <div className="mt-4 space-y-3">
          <div>
            <Label className="text-white/70">Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)} placeholder="High-value clients" data-testid="input-filter-name" />
          </div>
          <div>
            <Label className="text-white/70">Page</Label>
            <Input value={page} onChange={e => setPage(e.target.value)} placeholder="clients" data-testid="input-filter-page" />
          </div>
          <div>
            <Label className="text-white/70">Query (JSON)</Label>
            <Textarea value={queryStr} onChange={e => setQueryStr(e.target.value)} rows={4} className="font-mono text-xs" data-testid="input-filter-query" />
          </div>
          <Button onClick={() => add.mutate()} disabled={!name.trim() || add.isPending} className="w-full" data-testid="button-filter-save">
            {add.isPending ? "Saving…" : "Save"}
          </Button>
        </div>
      </AdminCard>
      <AdminCard className="p-6 lg:col-span-2">
        <h3 className="text-lg font-semibold">Your saved filters</h3>
        <div className="mt-4 space-y-2">
          {q.isLoading ? <AdminSkeletonStack count={3} /> :
           (q.data ?? []).length === 0 ? <AdminEmptyState icon={<Filter className="h-6 w-6" />} title="None yet" /> :
           (q.data ?? []).map(f => (
            <div key={f.id} className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] p-3" data-testid={`row-filter-${f.id}`}>
              <div>
                <div className="font-medium">{f.name}</div>
                <div className="text-xs text-white/40">{f.page} · {JSON.stringify(f.queryJson).slice(0, 60)}</div>
              </div>
              <Button size="sm" variant="ghost" onClick={() => del.mutate(f.id)} data-testid={`button-filter-delete-${f.id}`}>✕</Button>
            </div>
          ))}
        </div>
      </AdminCard>
    </div>
  );
}

function OverridesPane({ toast }: { toast: any }) {
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [entityId, setEntityId] = useState("");
  const [reason, setReason] = useState("");
  const save = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/admin/control-panel/overrides", { action, entityType, entityId: entityId || null, reason });
    },
    onSuccess: () => {
      setAction(""); setEntityType(""); setEntityId(""); setReason("");
      toast({ title: "Override recorded" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });
  return (
    <AdminCard className="p-6">
      <h3 className="text-lg font-semibold">Record a manual override</h3>
      <p className="mt-1 text-sm text-white/60">
        For any action you take outside normal policy (force-cancel within 12h, manual package extend, etc).
        The reason is permanently stored in the audit log.
      </p>
      <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div><Label className="text-white/70">Action</Label><Input value={action} onChange={e => setAction(e.target.value)} placeholder="force_cancel_booking" data-testid="input-override-action" /></div>
        <div><Label className="text-white/70">Entity type</Label><Input value={entityType} onChange={e => setEntityType(e.target.value)} placeholder="booking" data-testid="input-override-entity-type" /></div>
        <div><Label className="text-white/70">Entity ID (optional)</Label><Input value={entityId} onChange={e => setEntityId(e.target.value)} placeholder="123" data-testid="input-override-entity-id" /></div>
        <div className="md:col-span-2"><Label className="text-white/70">Reason (≥5 chars, required)</Label><Textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} data-testid="input-override-reason" /></div>
      </div>
      <Button className="mt-4" onClick={() => save.mutate()} disabled={!action || !entityType || reason.trim().length < 5 || save.isPending} data-testid="button-override-save">
        {save.isPending ? "Recording…" : "Record override"}
      </Button>
    </AdminCard>
  );
}

function RolesPane({ toast, isSuper }: { toast: any; isSuper: boolean }) {
  const q = useQuery<AdminUserRow[]>({ queryKey: ["/api/admin/control-panel/admins"] });
  const upd = useMutation({
    mutationFn: async (v: { id: number; role: string }) => {
      await apiRequest("PATCH", `/api/admin/control-panel/admins/${v.id}/role`, { role: v.role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/control-panel/admins"] });
      toast({ title: "Role updated" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });
  return (
    <AdminCard className="p-6">
      <h3 className="text-lg font-semibold">Admin roles</h3>
      {!isSuper && (
        <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-200">
          <AlertTriangle className="h-4 w-4" /> Only super admins can change roles. You can view but not modify.
        </div>
      )}
      <div className="mt-4 space-y-2">
        {q.isLoading ? <AdminSkeletonStack count={3} /> :
         (q.data ?? []).map(a => (
          <div key={a.id} className="flex items-center justify-between rounded-md border border-white/5 bg-white/[0.02] p-3" data-testid={`row-admin-${a.id}`}>
            <div>
              <div className="font-medium">{a.firstName} {a.lastName}</div>
              <div className="text-xs text-white/40">{a.email}</div>
            </div>
            <div className="flex items-center gap-2">
              <Select
                value={a.adminRole}
                onValueChange={(v) => upd.mutate({ id: a.id, role: v })}
                disabled={!isSuper}
              >
                <SelectTrigger className="w-40" data-testid={`select-role-${a.id}`}><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="super_admin">Super admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="trainer">Trainer</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
              {!a.isActive && <Badge variant="outline" className="border-red-500/40 text-red-300">Disabled</Badge>}
            </div>
          </div>
        ))}
      </div>
    </AdminCard>
  );
}

function BulkPane({ toast }: { toast: any }) {
  const [idsRaw, setIdsRaw] = useState("");
  const [label, setLabel] = useState("");
  const [archiveReason, setArchiveReason] = useState("");

  const ids = useMemo(() => idsRaw.split(/[\s,]+/).map(Number).filter(n => Number.isFinite(n) && n > 0), [idsRaw]);

  const bulkTag = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/admin/control-panel/bulk/tag", { clientIds: ids, label }); },
    onSuccess: (_d, _v, _c) => { toast({ title: `Tag applied to ${ids.length} clients` }); setLabel(""); },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  const bulkArchive = useMutation({
    mutationFn: async () => { await apiRequest("POST", "/api/admin/control-panel/bulk/archive", { clientIds: ids, reason: archiveReason }); },
    onSuccess: () => { toast({ title: `Intent recorded for ${ids.length} clients` }); setArchiveReason(""); },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  return (
    <div className="space-y-6">
      <AdminCard className="p-6">
        <h3 className="text-lg font-semibold">Bulk actions</h3>
        <p className="mt-1 text-sm text-white/60">Paste client user IDs (space or comma separated).</p>
        <Textarea value={idsRaw} onChange={e => setIdsRaw(e.target.value)} rows={3} className="mt-3 font-mono" placeholder="12 34 56" data-testid="input-bulk-ids" />
        <div className="mt-1 text-xs text-white/40">{ids.length} IDs detected</div>
      </AdminCard>

      <AdminCard className="p-6">
        <h4 className="font-medium"><Layers className="mr-2 inline h-4 w-4 text-cyan-300" />Bulk tag</h4>
        <div className="mt-3 flex gap-2">
          <Input value={label} onChange={e => setLabel(e.target.value)} placeholder="Tag label" data-testid="input-bulk-tag-label" />
          <Button onClick={() => bulkTag.mutate()} disabled={ids.length === 0 || !label.trim() || bulkTag.isPending} data-testid="button-bulk-tag">
            Apply
          </Button>
        </div>
      </AdminCard>

      <AdminCard className="p-6">
        <h4 className="font-medium"><AlertTriangle className="mr-2 inline h-4 w-4 text-amber-300" />Bulk archive (records intent)</h4>
        <Textarea value={archiveReason} onChange={e => setArchiveReason(e.target.value)} rows={2} className="mt-3" placeholder="Reason (≥5 chars)" data-testid="input-bulk-archive-reason" />
        <Button className="mt-3" onClick={() => bulkArchive.mutate()} disabled={ids.length === 0 || archiveReason.trim().length < 5 || bulkArchive.isPending} data-testid="button-bulk-archive">
          Record archive intent
        </Button>
      </AdminCard>
    </div>
  );
}

function ViewAsPane({ toast }: { toast: any }) {
  const [userId, setUserId] = useState("");
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const r = await fetch(`/api/admin/control-panel/view-as/${userId}`, { credentials: "include" });
      if (!r.ok) throw new Error(await r.text());
      setData(await r.json());
    } catch (e: any) {
      toast({ title: "Failed", description: e?.message, variant: "destructive" });
      setData(null);
    } finally { setLoading(false); }
  };

  return (
    <div className="space-y-6">
      <AdminCard className="p-6">
        <h3 className="text-lg font-semibold">View as client (read-only)</h3>
        <p className="mt-1 text-sm text-white/60">Snapshot of a client's account state. Records an audit entry.</p>
        <div className="mt-3 flex gap-2">
          <Input value={userId} onChange={e => setUserId(e.target.value.replace(/\D/g, ""))} placeholder="Client user ID" className="max-w-xs" data-testid="input-viewas-user-id" />
          <Button onClick={load} disabled={!userId || loading} data-testid="button-viewas-load">
            <Eye className="mr-2 h-4 w-4" /> {loading ? "Loading…" : "Load snapshot"}
          </Button>
        </div>
      </AdminCard>

      {data && (
        <AdminCard className="p-6">
          <h4 className="font-semibold">{data.user?.firstName} {data.user?.lastName} <span className="text-white/40 text-sm">#{data.user?.id}</span></h4>
          <div className="mt-1 text-sm text-white/60">{data.user?.email}</div>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs uppercase tracking-wide text-white/40">Active package</div>
              <pre className="mt-1 max-h-60 overflow-auto rounded bg-black/40 p-3 text-xs">{JSON.stringify(data.activePackage, null, 2)}</pre>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-white/40">Latest body metrics</div>
              <pre className="mt-1 max-h-60 overflow-auto rounded bg-black/40 p-3 text-xs">{JSON.stringify(data.latestBodyMetrics, null, 2)}</pre>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-white/40">Bookings ({data.bookings?.length ?? 0})</div>
              <pre className="mt-1 max-h-60 overflow-auto rounded bg-black/40 p-3 text-xs">{JSON.stringify(data.bookings, null, 2)}</pre>
            </div>
            <div className="md:col-span-2">
              <div className="text-xs uppercase tracking-wide text-white/40">Tags</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {(data.tags ?? []).map((t: any) => (
                  <Badge key={t.id} variant="outline" className="border-cyan-500/30 text-cyan-200">{t.label}</Badge>
                ))}
                {(!data.tags || data.tags.length === 0) && <span className="text-xs text-white/40">—</span>}
              </div>
            </div>
          </div>
        </AdminCard>
      )}
    </div>
  );
}

function PoliciesPane() {
  const q = useQuery<any>({ queryKey: ["/api/admin/control-panel/policies"] });
  return (
    <AdminCard className="p-6">
      <h3 className="text-lg font-semibold"><BookOpenCheck className="mr-2 inline h-5 w-5 text-cyan-300" />Policy reference</h3>
      {q.isLoading ? <AdminSkeletonStack count={2} /> : !q.data ? <AdminEmptyState icon={<BookOpenCheck className="h-6 w-6" />} title="Unavailable" /> : (
        <div className="mt-4 space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Stat label="Cancel window" value={`${q.data.cancellationWindowHours}h`} />
            <Stat label="Reschedule window" value={`${q.data.rescheduleWindowHours}h`} />
            <Stat label="Same-day adjust" value={`${q.data.sameDayAdjustWindowHours}h`} />
            <Stat label="Expiry grace" value={`${q.data.packageExpiryGraceDays}d`} />
            <Stat label="Currency" value={q.data.currency} />
            <Stat label="Timezone" value={q.data.timezone} />
          </div>
          <div className="rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3 text-cyan-100">
            <strong>Manual override policy:</strong> {q.data.manualOverridePolicy}
          </div>
          <ul className="list-disc space-y-1 pl-5 text-white/70">
            {(q.data.notes ?? []).map((n: string, i: number) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}
    </AdminCard>
  );
}

function SystemHealthPane({ toast, isSuper }: { toast: any; isSuper: boolean }) {
  const q = useQuery<any>({ queryKey: ["/api/admin/control-panel/system-health"] });
  const inc = useQuery<any>({ queryKey: ["/api/admin/control-panel/incidents"] });
  const [targetId, setTargetId] = useState("");
  const [disableReason, setDisableReason] = useState("");

  const forceLogout = useMutation({
    mutationFn: async (uid: number) => {
      await apiRequest("POST", `/api/admin/control-panel/emergency/force-logout/${uid}`, {});
    },
    onSuccess: () => toast({ title: "Sessions cleared" }),
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });
  const disableAdmin = useMutation({
    mutationFn: async (v: { id: number; reason: string }) => {
      await apiRequest("POST", `/api/admin/control-panel/emergency/disable-admin/${v.id}`, { reason: v.reason });
    },
    onSuccess: () => {
      setDisableReason(""); setTargetId("");
      queryClient.invalidateQueries({ queryKey: ["/api/admin/control-panel/admins"] });
      toast({ title: "Admin disabled" });
    },
    onError: (e: any) => toast({ title: "Failed", description: e?.message, variant: "destructive" }),
  });

  if (q.isLoading) return <AdminSkeletonStack count={4} />;
  const d = q.data;
  if (!d) return <AdminEmptyState icon={<Activity className="h-6 w-6" />} title="Unavailable" />;
  const envTone = d.environment === "production" ? "border-red-500/40 text-red-300" :
                  d.environment === "staging" ? "border-amber-500/40 text-amber-300" :
                  "border-cyan-500/40 text-cyan-300";

  return (
    <div className="space-y-6">
      <AdminCard className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold"><Activity className="mr-2 inline h-5 w-5 text-cyan-300" />System health</h3>
            <p className="mt-1 text-sm text-white/60">Aggregated environment, email, cron, and integrity status.</p>
          </div>
          <Badge variant="outline" className={`uppercase ${envTone}`} data-testid="badge-environment">{d.environment}</Badge>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="Active admins" value={String(d.integrity?.activeAdmins ?? "—")} />
          <Stat label="Clients" value={String(d.integrity?.totalClients ?? "—")} />
          <Stat label="Orphan bookings" value={String(d.integrity?.orphanBookings ?? "—")} />
          <Stat label="Admin sessions" value={String(d.sessions?.activeAdminSessions ?? "—")} />
          <Stat label="Email recent sent" value={String(d.email?.recentSent ?? 0)} />
          <Stat label="Email recent failed" value={String(d.email?.recentFailed ?? 0)} />
          <Stat label="Cron last run" value={d.cron?.lastRunAt ? new Date(d.cron.lastRunAt).toLocaleTimeString("en-AE", { timeZone: "Asia/Dubai" }) : "—"} />
          <Stat label="Email ready" value={d.email?.ready ? "Yes" : "No"} />
        </div>

        {d.missingEnvs?.length > 0 && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-200" data-testid="warn-missing-envs">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <div>
              <div className="font-medium">Missing environment variables ({d.missingEnvs.length})</div>
              <div className="text-xs">{d.missingEnvs.join(", ")}</div>
            </div>
          </div>
        )}

        {d.cron?.stale === true && (
          <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-200" data-testid="warn-cron-stale">
            <AlertTriangle className="h-4 w-4" /> Cron has not run in over an hour.
          </div>
        )}

        <div className="mt-4 rounded-md border border-cyan-500/20 bg-cyan-500/5 p-3 text-sm text-cyan-100">
          <strong>MFA:</strong> {d.mfa?.recommendation} <strong>Backup:</strong> {d.backup?.managed} {d.backup?.recommendation}
        </div>
      </AdminCard>

      <AdminCard className="p-6">
        <h3 className="text-lg font-semibold"><AlertTriangle className="mr-2 inline h-5 w-5 text-amber-300" />Incident center</h3>
        <p className="mt-1 text-sm text-white/60">Recent failed jobs and sensitive admin actions.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">Failed emails</div>
            <div className="mt-2 space-y-1 max-h-60 overflow-auto">
              {inc.data?.failedEmails?.length ? inc.data.failedEmails.map((e: any, i: number) => (
                <div key={i} className="rounded border border-white/5 bg-white/[0.02] px-2 py-1 text-xs">
                  <span className="text-white/70">{e.to ?? "—"}</span> <span className="text-white/40">· {e.subject ?? ""}</span>
                </div>
              )) : <div className="text-xs text-white/40">None ✓</div>}
            </div>
          </div>
          <div>
            <div className="text-xs uppercase tracking-wide text-white/40">Sensitive admin actions</div>
            <div className="mt-2 space-y-1 max-h-60 overflow-auto">
              {inc.data?.sensitiveActions?.length ? inc.data.sensitiveActions.map((a: any) => (
                <div key={a.id} className="rounded border border-white/5 bg-white/[0.02] px-2 py-1 text-xs">
                  <Badge variant="outline" className="border-amber-500/40 text-amber-300">{a.action}</Badge>
                  <span className="ml-2 text-white/60">{a.entityType ?? "—"}{a.entityId != null ? ` #${a.entityId}` : ""}</span>
                </div>
              )) : <div className="text-xs text-white/40">None recently</div>}
            </div>
          </div>
        </div>
      </AdminCard>

      <AdminCard className="p-6">
        <h3 className="text-lg font-semibold"><Power className="mr-2 inline h-5 w-5 text-red-300" />Emergency controls</h3>
        {!isSuper ? (
          <div className="mt-2 flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm text-amber-200">
            <AlertTriangle className="h-4 w-4" /> Super admin only. You can view but not execute.
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
              <Input value={targetId} onChange={e => setTargetId(e.target.value.replace(/\D/g, ""))} placeholder="User ID" data-testid="input-emergency-user-id" />
              <Button
                variant="outline"
                disabled={!targetId || forceLogout.isPending}
                onClick={() => forceLogout.mutate(Number(targetId))}
                data-testid="button-force-logout"
              >
                <KeyRound className="mr-2 h-4 w-4" /> Force logout
              </Button>
            </div>
            <div>
              <Label className="text-white/70">Disable admin reason (≥5 chars)</Label>
              <Textarea value={disableReason} onChange={e => setDisableReason(e.target.value)} rows={2} placeholder="Why you're disabling this admin" data-testid="input-disable-reason" />
              <Button
                className="mt-2"
                variant="destructive"
                disabled={!targetId || disableReason.trim().length < 5 || disableAdmin.isPending}
                onClick={() => disableAdmin.mutate({ id: Number(targetId), reason: disableReason.trim() })}
                data-testid="button-disable-admin"
              >
                <Power className="mr-2 h-4 w-4" /> Disable admin
              </Button>
              <div className="mt-1 text-xs text-white/40">The permanent super admin cannot be disabled.</div>
            </div>
          </div>
        )}
      </AdminCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-white/5 bg-white/[0.02] p-3">
      <div className="text-xs uppercase tracking-wide text-white/40">{label}</div>
      <div className="mt-1 font-semibold text-cyan-200">{value}</div>
    </div>
  );
}
