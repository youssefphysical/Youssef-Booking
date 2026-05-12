import { useEffect, useMemo, useState } from "react";
import { useParams, useLocation, Link } from "wouter";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Save,
  Loader2,
  GripVertical,
  ChevronUp,
  ChevronDown,
  UtensilsCrossed,
  Library,
  AlertCircle,
  Target,
  Droplets,
  Lock,
  Eye,
  Share2,
  FileDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { useClients } from "@/hooks/use-clients";
import { useMeal } from "@/hooks/use-meals";
import {
  useNutritionPlan,
  useCreateNutritionPlan,
  useUpdateNutritionPlan,
} from "@/hooks/use-nutrition-plans";
import { MealFoodPicker } from "@/components/MealFoodPicker";
import { MealPicker } from "@/components/MealPicker";
import { useTranslation } from "@/i18n";
import {
  NUTRITION_PLAN_GOALS,
  NUTRITION_PLAN_GOAL_LABELS_EN,
  NUTRITION_PLAN_STATUSES,
  NUTRITION_PLAN_STATUS_LABELS_EN,
  NUTRITION_PLAN_DAY_TYPES,
  NUTRITION_PLAN_DAY_TYPE_LABELS_EN,
  MEAL_CATEGORIES,
  MEAL_CATEGORY_LABELS_EN,
  type Food,
  type Meal,
  type MealWithItems,
  type PlanDayInput,
  type PlanMealInput,
  type PlanMealItemInput,
  type NutritionPlanDayType,
  type NutritionPlanGoal,
  type NutritionPlanStatus,
} from "@shared/schema";
import { computeMealTotals } from "@shared/nutrition";
import { api } from "@shared/routes";
import { buildNutritionPlanWhatsApp, whatsappClientUrl } from "@/lib/whatsapp";

// ===== Helpers =====
function blankItem(food: Food): PlanMealItemInput {
  return {
    sourceFoodId: food.id,
    name: food.name,
    servingSize: food.servingSize,
    servingUnit: food.servingUnit,
    kcal: food.kcal,
    proteinG: food.proteinG,
    carbsG: food.carbsG,
    fatsG: food.fatsG,
    fiberG: food.fiberG ?? null,
    sugarG: food.sugarG ?? null,
    sodiumMg: food.sodiumMg ?? null,
    quantity: 1,
    notes: null,
  };
}
function snapshotMealAsPlanMeal(m: MealWithItems): PlanMealInput {
  return {
    sourceMealId: m.id,
    name: m.name,
    category: m.category as any,
    notes: m.notes ?? null,
    items: m.items.map((it) => ({
      sourceFoodId: it.foodId ?? null,
      name: it.name,
      servingSize: it.servingSize,
      servingUnit: it.servingUnit,
      kcal: it.kcal,
      proteinG: it.proteinG,
      carbsG: it.carbsG,
      fatsG: it.fatsG,
      fiberG: it.fiberG ?? null,
      sugarG: it.sugarG ?? null,
      sodiumMg: it.sodiumMg ?? null,
      quantity: it.quantity,
      notes: it.notes ?? null,
    })),
  };
}
function blankCustomMeal(): PlanMealInput {
  return {
    sourceMealId: null,
    name: "",
    category: "other",
    notes: null,
    items: [],
  };
}
function blankDay(dayType: NutritionPlanDayType): PlanDayInput {
  return {
    dayType,
    label: null,
    targetKcal: 0,
    targetProteinG: 0,
    targetCarbsG: 0,
    targetFatsG: 0,
    notes: null,
    meals: [],
  };
}

/** Green ≤5%, amber ≤15%, red >15% — same threshold across all plan UI. */
function diffTone(actual: number, target: number) {
  if (target <= 0) return "text-muted-foreground";
  const pct = Math.abs(actual - target) / target;
  if (pct <= 0.05) return "text-emerald-400";
  if (pct <= 0.15) return "text-cyan-400";
  return "text-rose-400";
}

interface DayTotals {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatsG: number;
}
function dayTotals(d: PlanDayInput): DayTotals {
  let k = 0,
    p = 0,
    c = 0,
    f = 0;
  for (const m of d.meals) {
    const t = computeMealTotals(m.items);
    k += t.kcal;
    p += t.proteinG;
    c += t.carbsG;
    f += t.fatsG;
  }
  return { kcal: k, proteinG: p, carbsG: c, fatsG: f };
}

export default function AdminNutritionPlanBuilder() {
  const { t, lang } = useTranslation();
  const { id: rawId } = useParams<{ id?: string }>();
  const isNew = !rawId || rawId === "new";
  const planId = isNew ? null : Number(rawId);
  const [, navigate] = useLocation();
  const { toast } = useToast();

  // ===== Form state =====
  const [userId, setUserId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [goal, setGoal] = useState<NutritionPlanGoal>("fat_loss");
  const [status, setStatus] = useState<NutritionPlanStatus>("draft");
  const [startDate, setStartDate] = useState<string>("");
  const [reviewDate, setReviewDate] = useState<string>("");
  const [waterTargetMl, setWaterTargetMl] = useState<number>(3000);
  const [publicNotes, setPublicNotes] = useState<string>("");
  const [privateNotes, setPrivateNotes] = useState<string>("");
  const [days, setDays] = useState<PlanDayInput[]>([
    blankDay("training"),
    blankDay("rest"),
  ]);
  const [activeDayIdx, setActiveDayIdx] = useState(0);
  const [pendingMealId, setPendingMealId] = useState<{ dayIdx: number; mealId: number } | null>(
    null,
  );

  const { data: clients = [] } = useClients();
  const { data: existing, isLoading: loadingPlan } = useNutritionPlan(planId);
  // Lazy-load the full meal (with items) before snapshotting it in.
  const { data: pendingMeal } = useMeal(pendingMealId?.mealId ?? null);

  // ===== Hydrate form from server =====
  useEffect(() => {
    if (!existing) return;
    setUserId(existing.userId);
    setName(existing.name);
    setGoal((existing.goal as NutritionPlanGoal) ?? "custom");
    setStatus((existing.status as NutritionPlanStatus) ?? "draft");
    setStartDate(existing.startDate ?? "");
    setReviewDate(existing.reviewDate ?? "");
    setWaterTargetMl(existing.waterTargetMl ?? 3000);
    setPublicNotes(existing.publicNotes ?? "");
    setPrivateNotes(existing.privateNotes ?? "");
    setDays(
      existing.days.length === 0
        ? [blankDay("training"), blankDay("rest")]
        : existing.days.map((d) => ({
            dayType: d.dayType as NutritionPlanDayType,
            label: d.label,
            targetKcal: d.targetKcal,
            targetProteinG: d.targetProteinG,
            targetCarbsG: d.targetCarbsG,
            targetFatsG: d.targetFatsG,
            notes: d.notes,
            meals: d.meals.map((m) => ({
              sourceMealId: m.sourceMealId,
              name: m.name,
              category: m.category as any,
              notes: m.notes,
              items: m.items.map((it) => ({
                sourceFoodId: it.sourceFoodId,
                name: it.name,
                servingSize: it.servingSize,
                servingUnit: it.servingUnit,
                kcal: it.kcal,
                proteinG: it.proteinG,
                carbsG: it.carbsG,
                fatsG: it.fatsG,
                fiberG: it.fiberG,
                sugarG: it.sugarG,
                sodiumMg: it.sodiumMg,
                quantity: it.quantity,
                notes: it.notes,
              })),
            })),
          })),
    );
  }, [existing]);

  // ===== Library-meal snapshot once loaded =====
  useEffect(() => {
    if (!pendingMealId || !pendingMeal) return;
    const snapshot = snapshotMealAsPlanMeal(pendingMeal);
    setDays((prev) => {
      const next = [...prev];
      const day = { ...next[pendingMealId.dayIdx] };
      day.meals = [...day.meals, snapshot];
      next[pendingMealId.dayIdx] = day;
      return next;
    });
    setPendingMealId(null);
  }, [pendingMealId, pendingMeal]);

  // ===== Mutations =====
  const create = useCreateNutritionPlan();
  const update = useUpdateNutritionPlan();
  const saving = create.isPending || update.isPending;

  // ===== Day editors =====
  const patchDay = (dayIdx: number, patch: Partial<PlanDayInput>) => {
    setDays((prev) => prev.map((d, i) => (i === dayIdx ? { ...d, ...patch } : d)));
  };
  const addDay = (dayType: NutritionPlanDayType) => {
    setDays((prev) => [...prev, blankDay(dayType)]);
    setActiveDayIdx(days.length);
  };
  const removeDay = (dayIdx: number) => {
    if (days.length <= 1) {
      toast({
        title: t("admin.planBuilder.toast.needOneDay", "Plan needs at least one day"),
        variant: "destructive",
      });
      return;
    }
    setDays((prev) => prev.filter((_, i) => i !== dayIdx));
    setActiveDayIdx((i) => Math.max(0, Math.min(i, days.length - 2)));
  };

  // ===== Meal/item editors =====
  const updateDayMeals = (dayIdx: number, fn: (meals: PlanMealInput[]) => PlanMealInput[]) => {
    setDays((prev) =>
      prev.map((d, i) => (i === dayIdx ? { ...d, meals: fn(d.meals) } : d)),
    );
  };
  const addCustomMeal = (dayIdx: number) =>
    updateDayMeals(dayIdx, (m) => [...m, blankCustomMeal()]);
  const removeMeal = (dayIdx: number, mealIdx: number) =>
    updateDayMeals(dayIdx, (m) => m.filter((_, i) => i !== mealIdx));
  const moveMeal = (dayIdx: number, mealIdx: number, dir: -1 | 1) => {
    const target = mealIdx + dir;
    updateDayMeals(dayIdx, (meals) => {
      if (target < 0 || target >= meals.length) return meals;
      const next = [...meals];
      [next[mealIdx], next[target]] = [next[target], next[mealIdx]];
      return next;
    });
  };
  const patchMeal = (dayIdx: number, mealIdx: number, patch: Partial<PlanMealInput>) =>
    updateDayMeals(dayIdx, (meals) =>
      meals.map((m, i) => (i === mealIdx ? { ...m, ...patch } : m)),
    );
  const addItemToMeal = (dayIdx: number, mealIdx: number, food: Food) =>
    updateDayMeals(dayIdx, (meals) =>
      meals.map((m, i) =>
        i === mealIdx ? { ...m, items: [...m.items, blankItem(food)] } : m,
      ),
    );
  const patchItem = (
    dayIdx: number,
    mealIdx: number,
    itemIdx: number,
    patch: Partial<PlanMealItemInput>,
  ) =>
    updateDayMeals(dayIdx, (meals) =>
      meals.map((m, i) =>
        i === mealIdx
          ? {
              ...m,
              items: m.items.map((it, j) => (j === itemIdx ? { ...it, ...patch } : it)),
            }
          : m,
      ),
    );
  const removeItem = (dayIdx: number, mealIdx: number, itemIdx: number) =>
    updateDayMeals(dayIdx, (meals) =>
      meals.map((m, i) =>
        i === mealIdx ? { ...m, items: m.items.filter((_, j) => j !== itemIdx) } : m,
      ),
    );

  // ===== Save =====
  const onSave = async () => {
    if (!userId) {
      toast({
        title: t("admin.planBuilder.toast.pickClient", "Pick a client first"),
        variant: "destructive",
      });
      return;
    }
    if (!name.trim()) {
      toast({
        title: t("admin.planBuilder.toast.needName", "Plan needs a name"),
        variant: "destructive",
      });
      return;
    }
    for (const d of days) {
      for (const m of d.meals) {
        if (!m.name.trim()) {
          toast({
            title: t("admin.planBuilder.toast.mealName", "Every meal needs a name"),
            variant: "destructive",
          });
          return;
        }
        if (m.items.length === 0) {
          toast({
            title: t(
              "admin.planBuilder.toast.mealEmpty",
              "Add at least one food to every meal",
            ),
            variant: "destructive",
          });
          return;
        }
      }
    }
    const payload = {
      userId,
      name: name.trim(),
      goal,
      status,
      startDate: startDate || null,
      reviewDate: reviewDate || null,
      waterTargetMl: waterTargetMl || null,
      publicNotes: publicNotes.trim() || null,
      privateNotes: privateNotes.trim() || null,
      days: days.map((d, idx) => ({ ...d, sortOrder: idx })),
    };
    try {
      if (isNew) {
        const created = await create.mutateAsync(payload as any);
        navigate(`/admin/nutrition/plans/${created.id}`);
      } else if (planId) {
        const { userId: _u, ...rest } = payload;
        await update.mutateAsync({ id: planId, ...rest } as any);
      }
    } catch {
      /* toast already shown */
    }
  };

  // ===== Derived =====
  const goalLabel = (k: string) =>
    t(`admin.planBuilder.goal.${k}`, (NUTRITION_PLAN_GOAL_LABELS_EN as any)[k] ?? k);
  const statusLabel = (k: string) =>
    t(`admin.planBuilder.status.${k}`, (NUTRITION_PLAN_STATUS_LABELS_EN as any)[k] ?? k);
  const dayTypeLabel = (k: string) =>
    t(
      `admin.planBuilder.dayType.${k}`,
      (NUTRITION_PLAN_DAY_TYPE_LABELS_EN as any)[k] ?? k,
    );
  const categoryLabel = (k: string) =>
    t(`nutrition.mealCategory.${k}`, (MEAL_CATEGORY_LABELS_EN as any)[k] ?? k);

  const activeDay = days[activeDayIdx];
  const activeTotals = useMemo(() => (activeDay ? dayTotals(activeDay) : null), [activeDay]);

  if (!isNew && loadingPlan) {
    return (
      <div className="admin-shell">
        <div className="admin-container py-16 text-center text-muted-foreground">
          <Loader2 size={20} className="animate-spin inline-block mr-2" aria-hidden="true" />
          {t("admin.planBuilder.loading", "Loading plan…")}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-container">
        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link href="/admin/nutrition/plans">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.back", "Back")}
              data-testid="button-back-plans"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.25em] text-primary">
              {t("admin.planBuilder.kicker", "Nutrition Plan")}
            </p>
            <h1
              className="text-2xl md:text-3xl font-display font-bold truncate"
              data-testid="text-plan-builder-title"
            >
              {isNew
                ? t("admin.planBuilder.titleNew", "New Plan")
                : name || t("admin.planBuilder.titleEdit", "Edit Plan")}
            </h1>
          </div>
          {!isNew && existing && existing.days.length > 0 && (
            <>
              <Link href={`/print/nutrition-plan/${existing.id}`}>
                <Button
                  variant="outline"
                  className="gap-2"
                  data-testid="button-export-plan-pdf"
                >
                  <FileDown size={16} aria-hidden="true" />
                  <span className="hidden sm:inline">
                    {t("admin.planBuilder.exportPdf", "Export PDF")}
                  </span>
                </Button>
              </Link>
              <Button
                variant="outline"
                onClick={() => {
                  const client = clients.find((c) => c.id === existing.userId);
                  const msg = buildNutritionPlanWhatsApp(existing, {
                    lang,
                    clientName: client?.fullName ?? null,
                    dayIndex: activeDayIdx,
                  });
                  const url = whatsappClientUrl(client?.phone, msg);
                  if (!url) {
                    toast({
                      title: t("admin.planBuilder.waNoPhoneTitle", "Client phone missing"),
                      description: t(
                        "admin.planBuilder.waNoPhoneBody",
                        "Add a phone number to this client before sharing the plan via WhatsApp.",
                      ),
                      variant: "destructive",
                    });
                    return;
                  }
                  window.open(url, "_blank", "noopener,noreferrer");
                }}
                className="gap-2"
                data-testid="button-share-plan-whatsapp"
              >
                <Share2 size={16} aria-hidden="true" />
                <span className="hidden sm:inline">
                  {t("admin.planBuilder.shareWa", "Share to WhatsApp")}
                </span>
              </Button>
            </>
          )}
          <Button
            onClick={onSave}
            disabled={saving}
            className="gap-2"
            data-testid="button-save-plan"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            {t("admin.planBuilder.save", "Save Plan")}
          </Button>
        </div>

        {/* Plan overview card */}
        <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6 mb-6">
          <h2 className="text-sm uppercase tracking-wider text-muted-foreground mb-4">
            {t("admin.planBuilder.overview", "Plan Overview")}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label htmlFor="np-name">
                {t("admin.planBuilder.field.name", "Plan Name")}
              </Label>
              <Input
                id="np-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t(
                  "admin.planBuilder.field.namePlaceholder",
                  "e.g. April Cut Phase",
                )}
                className="mt-1.5"
                data-testid="input-plan-name"
              />
            </div>
            <div>
              <Label htmlFor="np-client">
                {t("admin.planBuilder.field.client", "Client")}
              </Label>
              <Select
                value={userId ? String(userId) : ""}
                onValueChange={(v) => setUserId(Number(v))}
                disabled={!isNew}
              >
                <SelectTrigger id="np-client" className="mt-1.5" data-testid="select-plan-client">
                  <SelectValue
                    placeholder={t("admin.planBuilder.field.pickClient", "Select client…")}
                  />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {!isNew && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  <Lock size={10} className="inline mr-1" aria-hidden="true" />
                  {t(
                    "admin.planBuilder.field.clientLocked",
                    "Client cannot be changed after creation. Duplicate the plan to reassign.",
                  )}
                </p>
              )}
            </div>

            <div>
              <Label htmlFor="np-goal">{t("admin.planBuilder.field.goal", "Goal")}</Label>
              <Select value={goal} onValueChange={(v) => setGoal(v as NutritionPlanGoal)}>
                <SelectTrigger id="np-goal" className="mt-1.5" data-testid="select-plan-goal">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NUTRITION_PLAN_GOALS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {goalLabel(g)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="np-status">
                {t("admin.planBuilder.field.status", "Status")}
              </Label>
              <Select
                value={status}
                onValueChange={(v) => setStatus(v as NutritionPlanStatus)}
              >
                <SelectTrigger id="np-status" className="mt-1.5" data-testid="select-plan-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NUTRITION_PLAN_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {statusLabel(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {status === "active" && (
                <p className="text-[11px] text-cyan-300/80 mt-1">
                  {t(
                    "admin.planBuilder.field.activeWarn",
                    "Saving will archive any other active plan for this client.",
                  )}
                </p>
              )}
            </div>
            <div>
              <Label htmlFor="np-water">
                {t("admin.planBuilder.field.water", "Water Target (ml)")}
              </Label>
              <div className="relative mt-1.5">
                <Droplets
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  id="np-water"
                  type="number"
                  min={0}
                  max={20000}
                  step={250}
                  value={waterTargetMl}
                  onChange={(e) => setWaterTargetMl(Math.max(0, Number(e.target.value) || 0))}
                  className="pl-9"
                  data-testid="input-plan-water"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="np-start">
                {t("admin.planBuilder.field.startDate", "Start Date")}
              </Label>
              <Input
                id="np-start"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1.5"
                data-testid="input-plan-start"
              />
            </div>
            <div>
              <Label htmlFor="np-review">
                {t("admin.planBuilder.field.reviewDate", "Review Date")}
              </Label>
              <Input
                id="np-review"
                type="date"
                value={reviewDate}
                onChange={(e) => setReviewDate(e.target.value)}
                className="mt-1.5"
                data-testid="input-plan-review"
              />
            </div>

            <div className="md:col-span-2 lg:col-span-3">
              <Label htmlFor="np-public-notes">
                {t("admin.planBuilder.field.publicNotes", "Public Notes (visible to client)")}
              </Label>
              <Textarea
                id="np-public-notes"
                value={publicNotes}
                onChange={(e) => setPublicNotes(e.target.value)}
                rows={2}
                placeholder={t(
                  "admin.planBuilder.field.publicNotesPh",
                  "Coach guidance the client should see.",
                )}
                className="mt-1.5"
                data-testid="input-plan-public-notes"
              />
            </div>
            <div className="md:col-span-2 lg:col-span-3">
              <Label htmlFor="np-private-notes" className="flex items-center gap-1.5">
                <Lock size={11} aria-hidden="true" />
                {t("admin.planBuilder.field.privateNotes", "Private Notes (trainer-only)")}
              </Label>
              <Textarea
                id="np-private-notes"
                value={privateNotes}
                onChange={(e) => setPrivateNotes(e.target.value)}
                rows={2}
                placeholder={t(
                  "admin.planBuilder.field.privateNotesPh",
                  "Internal notes never shown to the client.",
                )}
                className="mt-1.5"
                data-testid="input-plan-private-notes"
              />
            </div>
          </div>
        </div>

        {/* Day-type tabs */}
        <Tabs
          value={String(activeDayIdx)}
          onValueChange={(v) => setActiveDayIdx(Number(v))}
          className="w-full"
        >
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <TabsList className="bg-white/5 h-auto flex-wrap p-1 gap-1">
              {days.map((d, i) => (
                <TabsTrigger
                  key={i}
                  value={String(i)}
                  data-testid={`tab-day-${i}`}
                  className="text-xs md:text-sm"
                >
                  {d.label?.trim() || dayTypeLabel(d.dayType)}
                </TabsTrigger>
              ))}
            </TabsList>
            <Select value="" onValueChange={(v) => addDay(v as NutritionPlanDayType)}>
              <SelectTrigger
                className="w-[180px] h-9"
                data-testid="select-add-day"
                aria-label={t("admin.planBuilder.day.addAria", "Add day type")}
              >
                <Plus size={13} className="mr-1.5" aria-hidden="true" />
                <span className="text-xs">
                  {t("admin.planBuilder.day.add", "Add Day Type")}
                </span>
              </SelectTrigger>
              <SelectContent>
                {NUTRITION_PLAN_DAY_TYPES.map((dt) => (
                  <SelectItem key={dt} value={dt}>
                    {dayTypeLabel(dt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {days.map((d, dayIdx) => (
            <TabsContent key={dayIdx} value={String(dayIdx)} className="mt-0">
              {/* Day header */}
              <div className="rounded-2xl border border-border bg-card/40 p-5 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-3">
                    <Label htmlFor={`d-type-${dayIdx}`}>
                      {t("admin.planBuilder.day.type", "Day Type")}
                    </Label>
                    <Select
                      value={d.dayType}
                      onValueChange={(v) =>
                        patchDay(dayIdx, { dayType: v as NutritionPlanDayType })
                      }
                    >
                      <SelectTrigger
                        id={`d-type-${dayIdx}`}
                        className="mt-1.5"
                        data-testid={`select-day-type-${dayIdx}`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {NUTRITION_PLAN_DAY_TYPES.map((dt) => (
                          <SelectItem key={dt} value={dt}>
                            {dayTypeLabel(dt)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="md:col-span-3">
                    <Label htmlFor={`d-label-${dayIdx}`}>
                      {t("admin.planBuilder.day.label", "Custom Label (optional)")}
                    </Label>
                    <Input
                      id={`d-label-${dayIdx}`}
                      value={d.label ?? ""}
                      onChange={(e) =>
                        patchDay(dayIdx, { label: e.target.value || null })
                      }
                      placeholder={dayTypeLabel(d.dayType)}
                      className="mt-1.5"
                      data-testid={`input-day-label-${dayIdx}`}
                    />
                  </div>
                  <div className="md:col-span-6 flex justify-end">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeDay(dayIdx)}
                      className="text-rose-400 hover:text-rose-300"
                      data-testid={`button-remove-day-${dayIdx}`}
                    >
                      <Trash2 size={14} className="mr-1.5" aria-hidden="true" />
                      {t("admin.planBuilder.day.remove", "Remove Day")}
                    </Button>
                  </div>

                  {/* Targets */}
                  <div className="md:col-span-12">
                    <Label className="flex items-center gap-1.5 mb-2">
                      <Target size={13} aria-hidden="true" />
                      {t("admin.planBuilder.day.targets", "Macro Targets")}
                    </Label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {(
                        [
                          { k: "targetKcal", label: t("nutrition.kcal", "kcal") },
                          {
                            k: "targetProteinG",
                            label: t("nutrition.protein", "Protein (g)"),
                          },
                          { k: "targetCarbsG", label: t("nutrition.carbs", "Carbs (g)") },
                          { k: "targetFatsG", label: t("nutrition.fats", "Fats (g)") },
                        ] as const
                      ).map(({ k, label }) => (
                        <div key={k}>
                          <Label className="text-xs">{label}</Label>
                          <Input
                            type="number"
                            min={0}
                            value={(d as any)[k]}
                            onChange={(e) =>
                              patchDay(dayIdx, {
                                [k]: Math.max(0, Number(e.target.value) || 0),
                              } as any)
                            }
                            className="mt-1 tabular-nums"
                            data-testid={`input-day-${k}-${dayIdx}`}
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="md:col-span-12">
                    <Label htmlFor={`d-notes-${dayIdx}`}>
                      {t("admin.planBuilder.day.notes", "Day Notes")}
                    </Label>
                    <Textarea
                      id={`d-notes-${dayIdx}`}
                      value={d.notes ?? ""}
                      onChange={(e) =>
                        patchDay(dayIdx, { notes: e.target.value || null })
                      }
                      rows={2}
                      placeholder={t(
                        "admin.planBuilder.day.notesPh",
                        "Carb timing, supplement instructions, etc.",
                      )}
                      className="mt-1.5"
                      data-testid={`input-day-notes-${dayIdx}`}
                    />
                  </div>
                </div>
              </div>

              {/* Target vs actual bar */}
              {activeTotals && (
                <div className="rounded-2xl border border-border bg-card/40 p-5 mb-4">
                  <h3 className="text-sm uppercase tracking-wider text-muted-foreground mb-3">
                    {t("admin.planBuilder.compare.title", "Target vs Actual")}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(
                      [
                        {
                          label: t("nutrition.kcal", "kcal"),
                          actual: Math.round(activeTotals.kcal),
                          target: d.targetKcal,
                        },
                        {
                          label: t("nutrition.protein", "Protein"),
                          actual: Math.round(activeTotals.proteinG),
                          target: d.targetProteinG,
                          unit: "g",
                        },
                        {
                          label: t("nutrition.carbs", "Carbs"),
                          actual: Math.round(activeTotals.carbsG),
                          target: d.targetCarbsG,
                          unit: "g",
                        },
                        {
                          label: t("nutrition.fats", "Fats"),
                          actual: Math.round(activeTotals.fatsG),
                          target: d.targetFatsG,
                          unit: "g",
                        },
                      ] as const
                    ).map((row) => (
                      <div
                        key={row.label}
                        className="rounded-xl border border-border/60 bg-background/30 p-3"
                      >
                        <p className="text-[11px] uppercase text-muted-foreground tracking-wider">
                          {row.label}
                        </p>
                        <p
                          className={`text-lg font-semibold tabular-nums mt-0.5 ${diffTone(
                            row.actual,
                            row.target,
                          )}`}
                          data-testid={`text-day-actual-${row.label}-${dayIdx}`}
                        >
                          {row.actual}
                          {(row as any).unit ?? ""}
                          <span className="text-xs text-muted-foreground font-normal">
                            {" "}
                            / {row.target}
                            {(row as any).unit ?? ""}
                          </span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Meals */}
              <div className="space-y-4">
                {d.meals.length === 0 && (
                  <div className="rounded-2xl border border-dashed border-border/60 bg-card/20 p-8 text-center">
                    <UtensilsCrossed
                      size={28}
                      className="mx-auto mb-3 text-muted-foreground"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-muted-foreground">
                      {t(
                        "admin.planBuilder.meals.empty",
                        "No meals yet. Add a meal from your library or build one from scratch.",
                      )}
                    </p>
                  </div>
                )}

                {d.meals.map((m, mealIdx) => {
                  const totals = computeMealTotals(m.items);
                  return (
                    <div
                      key={mealIdx}
                      className="rounded-2xl border border-border bg-card/40 p-4 md:p-5"
                      data-testid={`card-plan-meal-${dayIdx}-${mealIdx}`}
                    >
                      <div className="flex items-start gap-2 mb-3">
                        <div className="text-muted-foreground mt-2.5" aria-hidden="true">
                          <GripVertical size={14} />
                        </div>
                        <div className="flex-1 grid grid-cols-1 md:grid-cols-12 gap-2">
                          <div className="md:col-span-7">
                            <Input
                              value={m.name}
                              onChange={(e) =>
                                patchMeal(dayIdx, mealIdx, { name: e.target.value })
                              }
                              placeholder={t(
                                "admin.planBuilder.meals.namePh",
                                "Meal name (e.g. Pre-workout)",
                              )}
                              data-testid={`input-meal-name-${dayIdx}-${mealIdx}`}
                            />
                          </div>
                          <div className="md:col-span-5">
                            <Select
                              value={m.category}
                              onValueChange={(v) =>
                                patchMeal(dayIdx, mealIdx, { category: v as any })
                              }
                            >
                              <SelectTrigger
                                data-testid={`select-meal-category-${dayIdx}-${mealIdx}`}
                              >
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {MEAL_CATEGORIES.map((c) => (
                                  <SelectItem key={c} value={c}>
                                    {categoryLabel(c)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="flex flex-col gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveMeal(dayIdx, mealIdx, -1)}
                            disabled={mealIdx === 0}
                            className="h-7 w-7"
                            aria-label={t("common.moveUp", "Move up")}
                            data-testid={`button-meal-up-${dayIdx}-${mealIdx}`}
                          >
                            <ChevronUp size={13} aria-hidden="true" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => moveMeal(dayIdx, mealIdx, 1)}
                            disabled={mealIdx === d.meals.length - 1}
                            className="h-7 w-7"
                            aria-label={t("common.moveDown", "Move down")}
                            data-testid={`button-meal-down-${dayIdx}-${mealIdx}`}
                          >
                            <ChevronDown size={13} aria-hidden="true" />
                          </Button>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeMeal(dayIdx, mealIdx)}
                          className="text-rose-400 hover:text-rose-300"
                          aria-label={t("common.delete", "Delete")}
                          data-testid={`button-remove-meal-${dayIdx}-${mealIdx}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </Button>
                      </div>

                      {m.sourceMealId && (
                        <Badge variant="secondary" className="text-[10px] mb-3">
                          {t("admin.planBuilder.meals.fromLibrary", "From library (snapshot)")}
                        </Badge>
                      )}

                      {/* Items */}
                      <div className="rounded-xl border border-border/60 bg-background/30 overflow-hidden">
                        <div className="hidden md:grid md:grid-cols-12 gap-2 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-border/60">
                          <div className="col-span-5">
                            {t("admin.planBuilder.items.food", "Food")}
                          </div>
                          <div className="col-span-2 text-right">
                            {t("admin.planBuilder.items.qty", "Qty")}
                          </div>
                          <div className="col-span-1 text-right">
                            {t("nutrition.kcal", "kcal")}
                          </div>
                          <div className="col-span-1 text-right">P</div>
                          <div className="col-span-1 text-right">C</div>
                          <div className="col-span-1 text-right">F</div>
                          <div className="col-span-1" />
                        </div>
                        {m.items.length === 0 ? (
                          <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                            {t(
                              "admin.planBuilder.items.empty",
                              "No foods yet. Add one from the picker below.",
                            )}
                          </div>
                        ) : (
                          m.items.map((it, itemIdx) => (
                            <div
                              key={itemIdx}
                              className="px-3 py-2 grid grid-cols-12 gap-2 items-center border-b border-border/40 last:border-b-0"
                              data-testid={`row-item-${dayIdx}-${mealIdx}-${itemIdx}`}
                            >
                              <div className="col-span-12 md:col-span-5">
                                <p className="text-sm truncate">{it.name}</p>
                                <p className="text-[10px] text-muted-foreground">
                                  {it.servingSize}
                                  {it.servingUnit} ·{" "}
                                  {Math.round(it.kcal)} kcal
                                </p>
                              </div>
                              <div className="col-span-4 md:col-span-2">
                                <Input
                                  type="number"
                                  min={0.01}
                                  step={0.25}
                                  value={it.quantity}
                                  onChange={(e) => {
                                    const v = Math.max(0.01, Number(e.target.value) || 0.01);
                                    patchItem(dayIdx, mealIdx, itemIdx, { quantity: v });
                                  }}
                                  className="h-8 text-right tabular-nums"
                                  data-testid={`input-item-qty-${dayIdx}-${mealIdx}-${itemIdx}`}
                                />
                              </div>
                              <div className="col-span-2 md:col-span-1 text-right text-xs tabular-nums">
                                {Math.round(it.kcal * it.quantity)}
                              </div>
                              <div className="col-span-2 md:col-span-1 text-right text-xs tabular-nums">
                                {(it.proteinG * it.quantity).toFixed(1)}
                              </div>
                              <div className="col-span-2 md:col-span-1 text-right text-xs tabular-nums">
                                {(it.carbsG * it.quantity).toFixed(1)}
                              </div>
                              <div className="col-span-1 text-right text-xs tabular-nums">
                                {(it.fatsG * it.quantity).toFixed(1)}
                              </div>
                              <div className="col-span-1 flex justify-end">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 text-rose-400 hover:text-rose-300"
                                  onClick={() => removeItem(dayIdx, mealIdx, itemIdx)}
                                  aria-label={t("common.delete", "Delete")}
                                  data-testid={`button-remove-item-${dayIdx}-${mealIdx}-${itemIdx}`}
                                >
                                  <Trash2 size={12} aria-hidden="true" />
                                </Button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>

                      {/* Add food picker + footer totals */}
                      <div className="flex items-center justify-between gap-3 mt-3 flex-wrap">
                        <MealFoodPicker
                          trigger={
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              data-testid={`button-add-food-${dayIdx}-${mealIdx}`}
                            >
                              <Plus size={13} aria-hidden="true" />
                              {t("admin.planBuilder.items.add", "Add Food")}
                            </Button>
                          }
                          onPick={(food) => addItemToMeal(dayIdx, mealIdx, food)}
                        />
                        <div className="text-xs tabular-nums text-muted-foreground">
                          <span className="font-semibold text-foreground">
                            {Math.round(totals.kcal)} kcal
                          </span>
                          {" · "}P {totals.proteinG}g · C {totals.carbsG}g · F {totals.fatsG}g
                        </div>
                      </div>
                    </div>
                  );
                })}

                <div className="flex flex-wrap gap-2 pt-1">
                  <MealPicker
                    trigger={
                      <Button
                        variant="outline"
                        className="gap-2"
                        data-testid={`button-add-from-library-${dayIdx}`}
                      >
                        <Library size={14} aria-hidden="true" />
                        {t("admin.planBuilder.meals.addFromLibrary", "Add Meal from Library")}
                      </Button>
                    }
                    onPick={(m: Meal) =>
                      setPendingMealId({ dayIdx, mealId: m.id })
                    }
                  />
                  <Button
                    variant="outline"
                    onClick={() => addCustomMeal(dayIdx)}
                    className="gap-2"
                    data-testid={`button-add-custom-meal-${dayIdx}`}
                  >
                    <Plus size={14} aria-hidden="true" />
                    {t("admin.planBuilder.meals.addCustom", "Build Custom Meal")}
                  </Button>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>

        <div className="mt-8 flex justify-end">
          <Button
            onClick={onSave}
            disabled={saving}
            className="gap-2"
            data-testid="button-save-plan-bottom"
          >
            {saving ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            {t("admin.planBuilder.save", "Save Plan")}
          </Button>
        </div>
      </div>
    </div>
  );
}
