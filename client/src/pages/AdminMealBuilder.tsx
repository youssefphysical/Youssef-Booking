import { useEffect, useMemo, useState } from "react";
import { useLocation, useRoute } from "wouter";
import {
  Plus,
  Trash2,
  ChevronUp,
  ChevronDown,
  Save,
  ArrowLeft,
  Loader2,
  GripVertical,
  Beaker,
  Apple,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MealFoodPicker } from "@/components/MealFoodPicker";
import {
  useMeal,
  useCreateMeal,
  useUpdateMeal,
} from "@/hooks/use-meals";
import {
  MEAL_CATEGORIES,
  MEAL_CATEGORY_LABELS_EN,
  FOOD_SERVING_UNIT_LABELS_EN,
  type Food,
  type MealItemInput,
} from "@shared/schema";
import { computeMealTotals, computeItemMacros, macroPercentSplit } from "@shared/nutrition";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";

interface DraftItem extends MealItemInput {
  /** Stable per-row key for React. Not persisted. */
  key: string;
}

function newKey(): string {
  return Math.random().toString(36).slice(2, 10);
}

function fromFood(f: Food): DraftItem {
  return {
    key: newKey(),
    foodId: f.id,
    name: f.name,
    servingSize: f.servingSize,
    servingUnit: f.servingUnit,
    kcal: f.kcal,
    proteinG: f.proteinG,
    carbsG: f.carbsG,
    fatsG: f.fatsG,
    fiberG: f.fiberG ?? null,
    sugarG: f.sugarG ?? null,
    sodiumMg: f.sodiumMg ?? null,
    quantity: 1,
    notes: null,
  };
}

export default function AdminMealBuilder() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute<{ id?: string }>("/admin/nutrition/meals/:id");
  const isNew = !params?.id || params.id === "new";
  const mealId = isNew ? null : Number(params!.id);

  const { data: existing, isLoading } = useMeal(mealId);
  const create = useCreateMeal();
  const update = useUpdateMeal();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("breakfast");
  const [notes, setNotes] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from server when editing.
  useEffect(() => {
    if (isNew) {
      setHydrated(true);
      return;
    }
    if (existing && !hydrated) {
      setName(existing.name);
      setDescription(existing.description ?? "");
      setCategory(existing.category);
      setNotes(existing.notes ?? "");
      setIsActive(existing.isActive);
      setItems(
        existing.items.map((it) => ({
          key: newKey(),
          foodId: it.foodId,
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
      );
      setHydrated(true);
    }
  }, [existing, hydrated, isNew]);

  // Live totals — pure shared helper, single source of truth.
  const totals = useMemo(() => computeMealTotals(items), [items]);
  const split = useMemo(
    () => macroPercentSplit(totals),
    [totals.proteinG, totals.carbsG, totals.fatsG],
  );

  const categoryLabel = (k: string) =>
    t(`nutrition.mealCategory.${k}`, (MEAL_CATEGORY_LABELS_EN as any)[k] ?? k);
  const unitLabel = (k: string) =>
    t(`nutrition.servingUnit.${k}`, FOOD_SERVING_UNIT_LABELS_EN[k] ?? k);

  function addItem(food: Food) {
    setItems((prev) => [...prev, fromFood(food)]);
  }
  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }
  function moveItem(key: string, dir: -1 | 1) {
    setItems((prev) => {
      const idx = prev.findIndex((i) => i.key === key);
      if (idx < 0) return prev;
      const swap = idx + dir;
      if (swap < 0 || swap >= prev.length) return prev;
      const next = prev.slice();
      [next[idx], next[swap]] = [next[swap], next[idx]];
      return next;
    });
  }
  function patchItem(key: string, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  // ----- Drag & drop reordering (HTML5, no extra deps) -----
  const [dragKey, setDragKey] = useState<string | null>(null);
  function onDragStart(key: string) {
    setDragKey(key);
  }
  function onDragOver(e: React.DragEvent, overKey: string) {
    e.preventDefault();
    if (!dragKey || dragKey === overKey) return;
    setItems((prev) => {
      const fromIdx = prev.findIndex((i) => i.key === dragKey);
      const toIdx = prev.findIndex((i) => i.key === overKey);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = prev.slice();
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }
  function onDragEnd() {
    setDragKey(null);
  }

  function handleSave() {
    if (!name.trim()) {
      toast({
        title: t("admin.mealBuilder.validation.name", "Meal needs a name"),
        variant: "destructive",
      });
      return;
    }
    if (items.length === 0) {
      toast({
        title: t("admin.mealBuilder.validation.items", "Add at least one food to the meal"),
        variant: "destructive",
      });
      return;
    }
    const payload = {
      name: name.trim(),
      description: description.trim() || null,
      category: category as any,
      notes: notes.trim() || null,
      isActive,
      isTemplate: true,
      items: items.map((it, idx) => {
        const { key, ...rest } = it;
        return { ...rest, sortOrder: idx };
      }),
    };
    if (isNew) {
      create.mutate(payload, {
        onSuccess: (m) => navigate(`/admin/nutrition/meals/${m.id}`),
      });
    } else if (mealId) {
      update.mutate({ id: mealId, ...payload });
    }
  }

  const isSaving = create.isPending || update.isPending;

  if (!isNew && isLoading) {
    return (
      <div className="admin-shell">
        <div className="admin-container">
          <div className="flex items-center justify-center py-24 text-muted-foreground">
            <Loader2 size={20} className="animate-spin mr-2" aria-hidden="true" />
            {t("admin.mealBuilder.loading", "Loading meal…")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <div className="admin-container">
        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <button
              type="button"
              onClick={() => navigate("/admin/nutrition/meals")}
              className="text-xs text-muted-foreground hover:text-foreground mb-2 inline-flex items-center gap-1.5"
              data-testid="button-back-to-meals"
            >
              <ArrowLeft size={12} aria-hidden="true" />
              {t("admin.mealBuilder.back", "Back to Meal Library")}
            </button>
            <h1
              className="text-3xl font-display font-bold"
              data-testid="text-meal-builder-title"
            >
              {isNew
                ? t("admin.mealBuilder.titleNew", "New Meal")
                : t("admin.mealBuilder.titleEdit", "Edit Meal")}
            </h1>
          </div>
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="gap-2"
            data-testid="button-save-meal"
          >
            {isSaving ? (
              <Loader2 size={16} className="animate-spin" aria-hidden="true" />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            {isNew
              ? t("admin.mealBuilder.create", "Create Meal")
              : t("admin.mealBuilder.save", "Save Changes")}
          </Button>
        </div>

        <div className="grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* LEFT: form + items */}
          <div className="space-y-6">
            {/* Meta */}
            <div className="rounded-2xl border border-border bg-card/40 p-5 space-y-4">
              <div className="grid sm:grid-cols-[1fr_180px] gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="meal-name">
                    {t("admin.mealBuilder.field.name", "Meal name")}
                  </Label>
                  <Input
                    id="meal-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder={t(
                      "admin.mealBuilder.field.namePlaceholder",
                      "e.g. High-protein breakfast",
                    )}
                    data-testid="input-meal-name"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="meal-category">
                    {t("admin.mealBuilder.field.category", "Category")}
                  </Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="meal-category" data-testid="select-meal-category-builder">
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
              <div className="space-y-1.5">
                <Label htmlFor="meal-desc">
                  {t("admin.mealBuilder.field.description", "Short description")}
                </Label>
                <Input
                  id="meal-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={t(
                    "admin.mealBuilder.field.descriptionPlaceholder",
                    "One-line summary shown in lists",
                  )}
                  data-testid="input-meal-description"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="meal-notes">
                  {t("admin.mealBuilder.field.notes", "Coaching notes")}
                </Label>
                <Textarea
                  id="meal-notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder={t(
                    "admin.mealBuilder.field.notesPlaceholder",
                    "Anything the client should know about this meal…",
                  )}
                  data-testid="input-meal-notes"
                />
              </div>
              {!isNew && (
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <Label htmlFor="meal-active" className="text-sm">
                      {t("admin.mealBuilder.field.active", "Active")}
                    </Label>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {t(
                        "admin.mealBuilder.field.activeHint",
                        "Archived meals stay in plans that already use them, but disappear from the library.",
                      )}
                    </p>
                  </div>
                  <Switch
                    id="meal-active"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                    data-testid="switch-meal-active"
                  />
                </div>
              )}
            </div>

            {/* Items */}
            <div className="rounded-2xl border border-border bg-card/40 p-5">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <h2 className="font-display text-lg font-semibold">
                    {t("admin.mealBuilder.items.title", "Foods in this meal")}
                  </h2>
                  <p className="text-xs text-muted-foreground">
                    {t(
                      "admin.mealBuilder.items.hint",
                      "Drag rows or use the arrows to reorder. Quantity multiplies the snapshot serving.",
                    )}
                  </p>
                </div>
                <MealFoodPicker
                  trigger={
                    <Button size="sm" className="gap-2" data-testid="button-add-food-to-meal">
                      <Plus size={14} aria-hidden="true" />
                      {t("admin.mealBuilder.items.add", "Add food")}
                    </Button>
                  }
                  onPick={addItem}
                />
              </div>

              {items.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground text-sm rounded-xl border border-dashed border-border">
                  {t(
                    "admin.mealBuilder.items.empty",
                    "No foods yet. Click “Add food” to search the library.",
                  )}
                </div>
              ) : (
                <ul className="space-y-2" data-testid="list-meal-items">
                  {items.map((it, idx) => {
                    const m = computeItemMacros(it);
                    return (
                      <li
                        key={it.key}
                        draggable
                        onDragStart={() => onDragStart(it.key)}
                        onDragOver={(e) => onDragOver(e, it.key)}
                        onDragEnd={onDragEnd}
                        className={`rounded-xl border bg-background/60 p-3 transition-colors ${
                          dragKey === it.key ? "border-primary opacity-60" : "border-border"
                        }`}
                        data-testid={`row-meal-item-${idx}`}
                      >
                        <div className="flex items-start gap-3">
                          <button
                            type="button"
                            className="mt-1 cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground"
                            aria-label={t("admin.mealBuilder.items.dragAria", "Drag to reorder")}
                            data-testid={`button-drag-item-${idx}`}
                          >
                            <GripVertical size={16} aria-hidden="true" />
                          </button>
                          <div className="flex-1 min-w-0 space-y-2">
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                              <div className="min-w-0">
                                <p
                                  className="font-medium text-sm truncate"
                                  data-testid={`text-item-name-${idx}`}
                                >
                                  {it.name}
                                </p>
                                <p className="text-xs text-muted-foreground tabular-nums">
                                  {it.servingSize} {unitLabel(it.servingUnit)} ·{" "}
                                  {Math.round(it.kcal)} kcal · P {it.proteinG}g · C {it.carbsG}g · F{" "}
                                  {it.fatsG}g
                                </p>
                              </div>
                              <div className="flex items-center gap-1">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => moveItem(it.key, -1)}
                                  disabled={idx === 0}
                                  aria-label={t("admin.mealBuilder.items.moveUp", "Move up")}
                                  data-testid={`button-move-up-${idx}`}
                                >
                                  <ChevronUp size={14} aria-hidden="true" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => moveItem(it.key, 1)}
                                  disabled={idx === items.length - 1}
                                  aria-label={t("admin.mealBuilder.items.moveDown", "Move down")}
                                  data-testid={`button-move-down-${idx}`}
                                >
                                  <ChevronDown size={14} aria-hidden="true" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItem(it.key)}
                                  aria-label={t("admin.mealBuilder.items.remove", "Remove")}
                                  data-testid={`button-remove-item-${idx}`}
                                >
                                  <Trash2 size={14} aria-hidden="true" />
                                </Button>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 sm:grid-cols-[140px_1fr_auto] gap-2 items-end">
                              <div className="space-y-1">
                                <Label
                                  htmlFor={`qty-${it.key}`}
                                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                                >
                                  {t("admin.mealBuilder.items.quantity", "Quantity (× servings)")}
                                </Label>
                                <Input
                                  id={`qty-${it.key}`}
                                  type="number"
                                  min={0.01}
                                  step={0.1}
                                  value={it.quantity}
                                  onChange={(e) => {
                                    const n = Number(e.target.value);
                                    patchItem(it.key, {
                                      quantity:
                                        Number.isFinite(n) && n > 0 ? n : it.quantity,
                                    });
                                  }}
                                  className="h-9"
                                  data-testid={`input-quantity-${idx}`}
                                />
                              </div>
                              <div className="space-y-1 col-span-2 sm:col-span-1">
                                <Label
                                  htmlFor={`note-${it.key}`}
                                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                                >
                                  {t("admin.mealBuilder.items.itemNote", "Notes (optional)")}
                                </Label>
                                <Input
                                  id={`note-${it.key}`}
                                  value={it.notes ?? ""}
                                  onChange={(e) =>
                                    patchItem(it.key, { notes: e.target.value || null })
                                  }
                                  placeholder={t(
                                    "admin.mealBuilder.items.notePlaceholder",
                                    "e.g. cooked weight",
                                  )}
                                  className="h-9"
                                  data-testid={`input-item-note-${idx}`}
                                />
                              </div>
                              <div className="text-right tabular-nums text-xs sm:min-w-[120px]">
                                <div className="font-semibold text-base">
                                  {Math.round(m.kcal)}{" "}
                                  <span className="text-[10px] font-normal text-muted-foreground">
                                    kcal
                                  </span>
                                </div>
                                <div className="text-muted-foreground">
                                  P {m.proteinG} · C {m.carbsG} · F {m.fatsG}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>

          {/* RIGHT: live totals */}
          <aside className="lg:sticky lg:top-24 space-y-4">
            <div className="rounded-2xl border border-border bg-card/60 p-5">
              <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground mb-3">
                {t("admin.mealBuilder.totals.title", "Meal totals")}
              </p>
              <div
                className="text-4xl font-display font-bold tabular-nums"
                data-testid="text-total-kcal"
              >
                {Math.round(totals.kcal)}
                <span className="text-sm font-normal text-muted-foreground ml-1">kcal</span>
              </div>

              {/* Macro split bar */}
              <div className="mt-4 space-y-2">
                <div className="h-2 rounded-full overflow-hidden flex bg-muted">
                  <div
                    className="h-full"
                    style={{ width: `${split.protein}%`, background: "rgb(56 189 248)" }}
                    aria-hidden="true"
                  />
                  <div
                    className="h-full"
                    style={{ width: `${split.carbs}%`, background: "rgb(251 191 36)" }}
                    aria-hidden="true"
                  />
                  <div
                    className="h-full"
                    style={{ width: `${split.fats}%`, background: "rgb(244 114 182)" }}
                    aria-hidden="true"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <MacroPill
                    label={t("admin.mealBuilder.totals.protein", "Protein")}
                    grams={totals.proteinG}
                    pct={split.protein}
                    color="rgb(56 189 248)"
                    testid="text-total-protein"
                  />
                  <MacroPill
                    label={t("admin.mealBuilder.totals.carbs", "Carbs")}
                    grams={totals.carbsG}
                    pct={split.carbs}
                    color="rgb(251 191 36)"
                    testid="text-total-carbs"
                  />
                  <MacroPill
                    label={t("admin.mealBuilder.totals.fats", "Fats")}
                    grams={totals.fatsG}
                    pct={split.fats}
                    color="rgb(244 114 182)"
                    testid="text-total-fats"
                  />
                </div>
              </div>

              <Separator className="my-4" />

              <dl className="space-y-2 text-xs">
                <Row
                  label={t("admin.mealBuilder.totals.fiber", "Fiber")}
                  value={`${totals.fiberG} g`}
                />
                <Row
                  label={t("admin.mealBuilder.totals.sugar", "Sugar")}
                  value={`${totals.sugarG} g`}
                />
                <Row
                  label={t("admin.mealBuilder.totals.sodium", "Sodium")}
                  value={`${Math.round(totals.sodiumMg)} mg`}
                />
                <Row
                  label={t("admin.mealBuilder.totals.items", "Items")}
                  value={String(items.length)}
                />
              </dl>
            </div>

            <div className="rounded-2xl border border-dashed border-border bg-card/20 p-4 text-xs text-muted-foreground">
              {t(
                "admin.mealBuilder.totals.snapshotHint",
                "Adding a food snapshots its macros into this meal. Editing or deleting the food in the library will not change this meal.",
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function MacroPill({
  label,
  grams,
  pct,
  color,
  testid,
}: {
  label: string;
  grams: number;
  pct: number;
  color: string;
  testid: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 px-2 py-1.5">
      <div className="flex items-center gap-1.5">
        <span
          className="w-2 h-2 rounded-full"
          style={{ background: color }}
          aria-hidden="true"
        />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
      </div>
      <div className="mt-1 tabular-nums" data-testid={testid}>
        <span className="font-semibold">{grams}</span>
        <span className="text-muted-foreground"> g · {pct}%</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  );
}
