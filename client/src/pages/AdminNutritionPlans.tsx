import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Plus,
  ClipboardList,
  Edit3,
  Copy,
  Trash2,
  Loader2,
  Filter,
  Search,
  CheckCircle2,
  Archive,
  FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useNutritionPlans,
  useDeleteNutritionPlan,
  useDuplicateNutritionPlan,
} from "@/hooks/use-nutrition-plans";
import { useClients } from "@/hooks/use-clients";
import {
  NUTRITION_PLAN_STATUSES,
  NUTRITION_PLAN_STATUS_LABELS_EN,
  NUTRITION_PLAN_GOAL_LABELS_EN,
  type NutritionPlanStatus,
} from "@shared/schema";
import { useTranslation } from "@/i18n";

const STATUS_TONE: Record<NutritionPlanStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  archived: "bg-amber-500/10 text-amber-300 border-amber-500/30",
};
const STATUS_ICON: Record<NutritionPlanStatus, JSX.Element> = {
  draft: <FileText size={11} aria-hidden="true" />,
  active: <CheckCircle2 size={11} aria-hidden="true" />,
  archived: <Archive size={11} aria-hidden="true" />,
};

export default function AdminNutritionPlans() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filters = useMemo(
    () => ({
      status: status === "all" ? undefined : status,
      userId: clientFilter === "all" ? undefined : Number(clientFilter),
      limit: 100,
    }),
    [status, clientFilter],
  );

  const { data, isLoading } = useNutritionPlans(filters);
  const { data: clientsData } = useClients();
  const clients = clientsData ?? [];
  const clientById = useMemo(() => {
    const m = new Map<number, (typeof clients)[number]>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  const items = data?.items ?? [];
  const filteredItems = useMemo(() => {
    if (!search.trim()) return items;
    const s = search.trim().toLowerCase();
    return items.filter((p) => {
      const name = p.name.toLowerCase();
      const client = clientById.get(p.userId);
      const clientName = client ? client.fullName.toLowerCase() : "";
      return name.includes(s) || clientName.includes(s);
    });
  }, [items, search, clientById]);

  const del = useDeleteNutritionPlan();
  const duplicate = useDuplicateNutritionPlan();

  const statusLabel = (k: string) =>
    t(`admin.planBuilder.status.${k}`, (NUTRITION_PLAN_STATUS_LABELS_EN as any)[k] ?? k);
  const goalLabel = (k: string) =>
    t(`admin.planBuilder.goal.${k}`, (NUTRITION_PLAN_GOAL_LABELS_EN as any)[k] ?? k);

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">
              {t("admin.nutritionPlans.kicker", "Nutrition OS")}
            </p>
            <h1
              className="text-3xl font-display font-bold"
              data-testid="text-nutrition-plans-title"
            >
              {t("admin.nutritionPlans.title", "Client Nutrition Plans")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">
              {t(
                "admin.nutritionPlans.summary",
                "Build and assign personalized nutrition plans. Each plan is fully snapshotted — editing the food or meal library never changes a delivered plan.",
              )}
            </p>
          </div>
          <Button
            onClick={() => navigate("/admin/nutrition/plans/new")}
            className="gap-2"
            data-testid="button-add-nutrition-plan"
          >
            <Plus size={16} aria-hidden="true" />
            {t("admin.nutritionPlans.add", "Build Plan")}
          </Button>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.nutritionPlans.searchPlaceholder", "Plan or client name…")}
              className="pl-9"
              data-testid="input-nutrition-plans-search"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-[160px]" data-testid="select-plan-status-filter">
              <Filter size={14} className="mr-1.5" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("admin.nutritionPlans.allStatuses", "All statuses")}
              </SelectItem>
              {NUTRITION_PLAN_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>
                  {statusLabel(s)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-plan-client-filter">
              <SelectValue
                placeholder={t("admin.nutritionPlans.allClients", "All clients")}
              />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("admin.nutritionPlans.allClients", "All clients")}
              </SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-2xl border border-border overflow-hidden bg-card/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">
                    {t("admin.nutritionPlans.col.plan", "Plan")}
                  </th>
                  <th className="text-left font-medium px-3 py-3 hidden md:table-cell">
                    {t("admin.nutritionPlans.col.client", "Client")}
                  </th>
                  <th className="text-left font-medium px-3 py-3 hidden md:table-cell">
                    {t("admin.nutritionPlans.col.goal", "Goal")}
                  </th>
                  <th className="text-left font-medium px-3 py-3">
                    {t("admin.nutritionPlans.col.status", "Status")}
                  </th>
                  <th className="text-right font-medium px-3 py-3" />
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                      <Loader2
                        size={18}
                        className="animate-spin inline-block mr-2"
                        aria-hidden="true"
                      />
                      {t("admin.nutritionPlans.loading", "Loading plans…")}
                    </td>
                  </tr>
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-16 text-center">
                      <ClipboardList
                        size={28}
                        className="mx-auto mb-3 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-muted-foreground" data-testid="text-empty-plans">
                        {search || status !== "all" || clientFilter !== "all"
                          ? t(
                              "admin.nutritionPlans.emptyFiltered",
                              "No plans match these filters.",
                            )
                          : t(
                              "admin.nutritionPlans.empty",
                              "No plans yet. Build the first one.",
                            )}
                      </p>
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((p) => {
                    const client = clientById.get(p.userId);
                    const tone =
                      STATUS_TONE[(p.status as NutritionPlanStatus) ?? "draft"] ?? "";
                    return (
                      <tr
                        key={p.id}
                        className="border-t border-border/60 hover:bg-muted/20"
                        data-testid={`row-plan-${p.id}`}
                      >
                        <td className="px-4 py-3">
                          <Link
                            href={`/admin/nutrition/plans/${p.id}`}
                            className="font-medium hover:text-primary"
                            data-testid={`link-plan-${p.id}`}
                          >
                            {p.name}
                          </Link>
                          {p.startDate && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {t("admin.nutritionPlans.starts", "Starts")} {p.startDate}
                            </p>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          {client ? (
                            <Link
                              href={`/admin/clients/${client.id}`}
                              className="hover:text-primary"
                              data-testid={`link-plan-client-${p.id}`}
                            >
                              {client.fullName}
                            </Link>
                          ) : (
                            <span className="text-muted-foreground">
                              {t("admin.nutritionPlans.unknownClient", "Unknown")}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 hidden md:table-cell">
                          <Badge variant="secondary" className="text-[10px]">
                            {goalLabel(p.goal)}
                          </Badge>
                        </td>
                        <td className="px-3 py-3">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] border ${tone}`}
                          >
                            {STATUS_ICON[(p.status as NutritionPlanStatus) ?? "draft"]}
                            {statusLabel(p.status)}
                          </span>
                        </td>
                        <td className="px-3 py-3 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/admin/nutrition/plans/${p.id}`)}
                            aria-label={t("admin.nutritionPlans.editAria", "Edit plan")}
                            data-testid={`button-edit-plan-${p.id}`}
                          >
                            <Edit3 size={15} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => duplicate.mutate(p.id)}
                            disabled={duplicate.isPending}
                            aria-label={t(
                              "admin.nutritionPlans.duplicateAria",
                              "Duplicate plan",
                            )}
                            data-testid={`button-duplicate-plan-${p.id}`}
                          >
                            <Copy size={15} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteId(p.id)}
                            aria-label={t("admin.nutritionPlans.deleteAria", "Delete plan")}
                            data-testid={`button-delete-plan-${p.id}`}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.nutritionPlans.deleteTitle", "Delete this plan?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "admin.nutritionPlans.deleteBody",
                "This permanently removes the plan and every snapshotted day, meal, and item. The client will no longer see this plan.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-plan">
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId !== null) del.mutate(deleteId);
                setDeleteId(null);
              }}
              data-testid="button-confirm-delete-plan"
            >
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
