import { useMemo } from "react";
import { Link } from "wouter";
import {
  Plus,
  Apple,
  Edit3,
  Copy,
  Archive,
  CheckCircle2,
  ClipboardList,
  Loader2,
  ChefHat,
  Droplets,
  Calendar,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useNutritionPlans,
  useDuplicateNutritionPlan,
  useUpdateNutritionPlan,
} from "@/hooks/use-nutrition-plans";
import { useTranslation } from "@/i18n";
import {
  NUTRITION_PLAN_GOAL_LABELS_EN,
  NUTRITION_PLAN_STATUS_LABELS_EN,
  type UserResponse,
  type NutritionPlanStatus,
} from "@shared/schema";

interface Props {
  client: UserResponse;
}

const STATUS_TONE: Record<NutritionPlanStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  archived: "bg-amber-500/10 text-amber-300 border border-amber-500/30",
};

/**
 * Embedded inside AdminClientDetail as the "Nutrition" tab. Shows the
 * client's active plan summary plus a list of historical plans, with
 * actions to assign, edit, duplicate, or archive. Heavy editing
 * happens on the dedicated builder page (/admin/nutrition/plans/:id).
 */
export function ClientNutritionTab({ client }: Props) {
  const { t } = useTranslation();
  const { data, isLoading } = useNutritionPlans({ userId: client.id, limit: 50 });
  const plans = data?.items ?? [];
  const active = useMemo(() => plans.find((p) => p.status === "active"), [plans]);
  const others = useMemo(() => plans.filter((p) => p.status !== "active"), [plans]);

  const duplicate = useDuplicateNutritionPlan();
  const update = useUpdateNutritionPlan();

  const goalLabel = (k: string) =>
    t(`admin.planBuilder.goal.${k}`, (NUTRITION_PLAN_GOAL_LABELS_EN as any)[k] ?? k);
  const statusLabel = (k: string) =>
    t(`admin.planBuilder.status.${k}`, (NUTRITION_PLAN_STATUS_LABELS_EN as any)[k] ?? k);

  if (isLoading) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Loader2 size={18} className="animate-spin inline mr-2" aria-hidden="true" />
        {t("admin.clientDetail.nutrition.loading", "Loading nutrition plans…")}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-lg font-display font-semibold flex items-center gap-2">
            <Apple size={16} className="text-primary" aria-hidden="true" />
            {t("admin.clientDetail.nutrition.title", "Nutrition Plans")}
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t(
              "admin.clientDetail.nutrition.subtitle",
              "Assign, edit, and track this client's nutrition history.",
            )}
          </p>
        </div>
        <Link href={`/admin/nutrition/plans/new?clientId=${client.id}`}>
          <Button size="sm" className="gap-1.5" data-testid="button-add-client-plan">
            <Plus size={13} aria-hidden="true" />
            {t("admin.clientDetail.nutrition.add", "Build Plan")}
          </Button>
        </Link>
      </div>

      {/* Active plan card */}
      {active ? (
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 md:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
            <div className="min-w-0">
              <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 mb-1.5">
                <CheckCircle2 size={11} className="mr-1" aria-hidden="true" />
                {t("admin.clientDetail.nutrition.activeBadge", "Active Plan")}
              </Badge>
              <h3
                className="font-display font-semibold text-lg truncate"
                data-testid="text-active-plan-name"
              >
                {active.name}
              </h3>
              <Badge variant="secondary" className="text-[10px] mt-1">
                {goalLabel(active.goal)}
              </Badge>
            </div>
            <div className="flex gap-1.5">
              <Link href={`/admin/nutrition/plans/${active.id}`}>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5"
                  data-testid={`button-edit-active-plan-${active.id}`}
                >
                  <Edit3 size={13} aria-hidden="true" />
                  {t("common.edit", "Edit")}
                </Button>
              </Link>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            {active.startDate && (
              <div className="rounded-lg bg-background/50 p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                  <Calendar size={10} aria-hidden="true" />
                  {t("admin.clientDetail.nutrition.start", "Start")}
                </p>
                <p className="text-xs font-medium mt-0.5">{active.startDate}</p>
              </div>
            )}
            {active.reviewDate && (
              <div className="rounded-lg bg-background/50 p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                  <Calendar size={10} aria-hidden="true" />
                  {t("admin.clientDetail.nutrition.review", "Review")}
                </p>
                <p className="text-xs font-medium mt-0.5">{active.reviewDate}</p>
              </div>
            )}
            {active.waterTargetMl && (
              <div className="rounded-lg bg-background/50 p-2.5">
                <p className="text-[10px] uppercase text-muted-foreground tracking-wider flex items-center gap-1">
                  <Droplets size={10} aria-hidden="true" />
                  {t("admin.clientDetail.nutrition.water", "Water")}
                </p>
                <p className="text-xs font-medium mt-0.5 tabular-nums">
                  {(active.waterTargetMl / 1000).toFixed(1)} L
                </p>
              </div>
            )}
          </div>
          {active.publicNotes && (
            <div className="mt-3 rounded-lg bg-background/40 border border-border/60 p-3">
              <p className="text-[10px] uppercase text-muted-foreground tracking-wider mb-1">
                {t("admin.clientDetail.nutrition.coachNotes", "Coach Notes (visible to client)")}
              </p>
              <p className="text-xs whitespace-pre-line">{active.publicNotes}</p>
            </div>
          )}
          {active.privateNotes && (
            <div className="mt-2 rounded-lg bg-background/40 border border-amber-500/30 p-3">
              <p className="text-[10px] uppercase text-amber-300/80 tracking-wider mb-1">
                {t("admin.clientDetail.nutrition.privateNotes", "Private Notes (trainer only)")}
              </p>
              <p className="text-xs whitespace-pre-line">{active.privateNotes}</p>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border/60 bg-card/20 p-6 text-center">
          <ClipboardList
            size={28}
            className="mx-auto mb-2 text-muted-foreground"
            aria-hidden="true"
          />
          <p className="text-sm text-muted-foreground">
            {t(
              "admin.clientDetail.nutrition.noActive",
              "No active nutrition plan. Build one to deliver to this client.",
            )}
          </p>
        </div>
      )}

      {/* Other plans (drafts + archived) */}
      {others.length > 0 && (
        <div>
          <h3 className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
            {t("admin.clientDetail.nutrition.history", "Plan History")}
          </h3>
          <div className="rounded-2xl border border-border bg-card/40 overflow-hidden">
            <ul className="divide-y divide-border/60">
              {others.map((p) => (
                <li
                  key={p.id}
                  className="px-4 py-3 flex items-center gap-3 flex-wrap"
                  data-testid={`row-history-plan-${p.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <Link
                      href={`/admin/nutrition/plans/${p.id}`}
                      className="font-medium text-sm hover:text-primary"
                    >
                      {p.name}
                    </Link>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {goalLabel(p.goal)}
                      {p.startDate ? ` · ${p.startDate}` : ""}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] ${STATUS_TONE[p.status as NutritionPlanStatus]}`}
                  >
                    {statusLabel(p.status)}
                  </span>
                  {p.status !== "active" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() =>
                        update.mutate({ id: p.id, status: "active" } as any)
                      }
                      disabled={update.isPending}
                      className="text-emerald-300 hover:text-emerald-200 h-7 text-xs"
                      data-testid={`button-activate-plan-${p.id}`}
                    >
                      <CheckCircle2 size={12} className="mr-1" aria-hidden="true" />
                      {t("admin.clientDetail.nutrition.activate", "Activate")}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => duplicate.mutate(p.id)}
                    disabled={duplicate.isPending}
                    aria-label={t("common.duplicate", "Duplicate")}
                    className="h-7 w-7"
                    data-testid={`button-duplicate-history-${p.id}`}
                  >
                    <Copy size={13} aria-hidden="true" />
                  </Button>
                  {p.status !== "archived" && p.status !== "active" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() =>
                        update.mutate({ id: p.id, status: "archived" } as any)
                      }
                      disabled={update.isPending}
                      aria-label={t("common.archive", "Archive")}
                      className="h-7 w-7"
                      data-testid={`button-archive-plan-${p.id}`}
                    >
                      <Archive size={13} aria-hidden="true" />
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
