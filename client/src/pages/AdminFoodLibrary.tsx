import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  Plus,
  Edit3,
  Trash2,
  Loader2,
  Apple,
  Search,
  Copy,
  Eye,
  EyeOff,
  Filter,
  Beaker,
} from "lucide-react";
import {
  insertFoodSchema,
  FOOD_CATEGORIES,
  FOOD_SERVING_UNITS,
  FOOD_DIGESTION_SPEEDS,
  FOOD_TIMINGS,
  FOOD_CATEGORY_LABELS_EN,
  FOOD_SERVING_UNIT_LABELS_EN,
  FOOD_DIGESTION_SPEED_LABELS_EN,
  FOOD_TIMING_LABELS_EN,
  type Food,
  type InsertFood,
} from "@shared/schema";
import {
  useFoods,
  useCreateFood,
  useUpdateFood,
  useDeleteFood,
  useDuplicateFood,
  type FoodsListFilters,
} from "@/hooks/use-foods";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/i18n";

type FormValues = InsertFood;

const PAGE_SIZE = 50;

const DEFAULTS: FormValues = {
  name: "",
  nameAr: "",
  category: "protein",
  brand: "",
  servingSize: 100,
  servingUnit: "g",
  kcal: 0,
  proteinG: 0,
  carbsG: 0,
  fatsG: 0,
  fiberG: undefined,
  sugarG: undefined,
  sodiumMg: undefined,
  digestionSpeed: undefined,
  bestTiming: undefined,
  notes: "",
  isActive: true,
  isSupplement: false,
};

// Parse a possibly-empty input value into a number, treating "" as undefined.
function parseNumberInput(v: string): number | undefined {
  if (v === "" || v === null || v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export default function AdminFoodLibrary() {
  const { t } = useTranslation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [supplementFilter, setSupplementFilter] = useState<"all" | "yes" | "no">("all");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(0);

  const filters: FoodsListFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      category: category === "all" ? undefined : category,
      isSupplement: supplementFilter === "all" ? undefined : supplementFilter === "yes",
      activeOnly: !showInactive,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [search, category, supplementFilter, showInactive, page],
  );

  const { data, isLoading, isFetching } = useFoods(filters);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const create = useCreateFood();
  const update = useUpdateFood();
  const del = useDeleteFood();
  const duplicate = useDuplicateFood();

  const [editing, setEditing] = useState<Food | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(food: Food) {
    setEditing(food);
    setOpen(true);
  }

  function categoryLabel(key: string): string {
    return t(`nutrition.foodCategory.${key}`, FOOD_CATEGORY_LABELS_EN[key] ?? key);
  }
  function unitLabel(key: string): string {
    return t(`nutrition.servingUnit.${key}`, FOOD_SERVING_UNIT_LABELS_EN[key] ?? key);
  }
  function digestionLabel(key: string): string {
    return t(`nutrition.digestion.${key}`, FOOD_DIGESTION_SPEED_LABELS_EN[key] ?? key);
  }
  function timingLabel(key: string): string {
    return t(`nutrition.timing.${key}`, FOOD_TIMING_LABELS_EN[key] ?? key);
  }

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">
              {t("admin.foodLibrary.kicker", "Nutrition OS")}
            </p>
            <h1 className="text-3xl font-display font-bold" data-testid="text-food-library-title">
              {t("admin.foodLibrary.title", "Food Library")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">
              {t(
                "admin.foodLibrary.summary",
                "Central catalogue of foods and supplements. Used by the meal builder and per-client nutrition assignments.",
              )}
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="gap-2"
            data-testid="button-add-food"
          >
            <Plus size={16} aria-hidden="true" />
            {t("admin.foodLibrary.add", "Add Food")}
          </Button>
        </div>

        {/* Filters */}
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              placeholder={t("admin.foodLibrary.searchPlaceholder", "Search by name…")}
              className="pl-9"
              aria-label={t("admin.foodLibrary.searchAria", "Search foods")}
              data-testid="input-food-search"
            />
          </div>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(0);
            }}
          >
            <SelectTrigger
              className="w-[180px]"
              data-testid="select-food-category-filter"
              aria-label={t("admin.foodLibrary.filterCategoryAria", "Filter by category")}
            >
              <Filter size={14} className="mr-1" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("admin.foodLibrary.allCategories", "All categories")}
              </SelectItem>
              {FOOD_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={supplementFilter}
            onValueChange={(v) => {
              setSupplementFilter(v as "all" | "yes" | "no");
              setPage(0);
            }}
          >
            <SelectTrigger
              className="w-[170px]"
              data-testid="select-food-supplement-filter"
              aria-label={t("admin.foodLibrary.filterTypeAria", "Filter by type")}
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("admin.foodLibrary.allTypes", "All types")}</SelectItem>
              <SelectItem value="no">{t("admin.foodLibrary.foodsOnly", "Foods only")}</SelectItem>
              <SelectItem value="yes">
                {t("admin.foodLibrary.supplementsOnly", "Supplements only")}
              </SelectItem>
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={showInactive ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowInactive((s) => !s);
              setPage(0);
            }}
            className="gap-1.5"
            data-testid="button-toggle-inactive"
          >
            {showInactive ? <Eye size={14} aria-hidden="true" /> : <EyeOff size={14} aria-hidden="true" />}
            {showInactive
              ? t("admin.foodLibrary.showingArchived", "Showing archived")
              : t("admin.foodLibrary.activeOnly", "Active only")}
          </Button>
        </div>

        {/* Table */}
        <div className="rounded-lg border border-border overflow-hidden bg-card">
          {isLoading ? (
            <div className="p-8 flex items-center justify-center text-muted-foreground">
              <Loader2 className="animate-spin mr-2" size={18} aria-hidden="true" />
              {t("admin.foodLibrary.loading", "Loading…")}
            </div>
          ) : items.length === 0 ? (
            <div className="p-12 text-center">
              <Apple
                className="mx-auto mb-3 text-muted-foreground/40"
                size={48}
                aria-hidden="true"
              />
              <p className="text-muted-foreground" data-testid="text-empty-foods">
                {search || category !== "all" || supplementFilter !== "all"
                  ? t("admin.foodLibrary.emptyFiltered", "No foods match your filters.")
                  : t(
                      "admin.foodLibrary.emptyAll",
                      "No foods yet. Add your first food to start building meals.",
                    )}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("admin.foodLibrary.col.name", "Food")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("admin.foodLibrary.col.category", "Category")}
                    </th>
                    <th className="px-4 py-3 text-left font-medium">
                      {t("admin.foodLibrary.col.serving", "Serving")}
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t("nutrition.units.kcal", "kcal")}
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t("nutrition.macroCalc.proteinAbbr", "P")}
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t("nutrition.macroCalc.carbsAbbr", "C")}
                    </th>
                    <th className="px-4 py-3 text-right font-medium">
                      {t("nutrition.macroCalc.fatsAbbr", "F")}
                    </th>
                    <th className="px-4 py-3 text-right font-medium w-[120px]">
                      <span className="sr-only">
                        {t("admin.foodLibrary.col.actions", "Actions")}
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((f) => (
                    <motion.tr
                      key={f.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="border-t border-border hover:bg-muted/30 transition-colors"
                      data-testid={`row-food-${f.id}`}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium" data-testid={`text-food-name-${f.id}`}>
                            {f.name}
                          </span>
                          {f.isSupplement && (
                            <Badge variant="outline" className="gap-1 text-[10px]">
                              <Beaker size={10} aria-hidden="true" />
                              {t("admin.foodLibrary.supplementBadge", "Supplement")}
                            </Badge>
                          )}
                          {!f.isActive && (
                            <Badge variant="secondary" className="text-[10px]">
                              {t("admin.foodLibrary.archivedBadge", "Archived")}
                            </Badge>
                          )}
                        </div>
                        {f.brand && (
                          <div className="text-xs text-muted-foreground">{f.brand}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {categoryLabel(f.category)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground tabular-nums">
                        {f.servingSize} {unitLabel(f.servingUnit)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-medium">
                        {Math.round(f.kcal)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {f.proteinG}
                        <span className="text-muted-foreground/60 text-xs ms-0.5">
                          {t("nutrition.units.g", "g")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {f.carbsG}
                        <span className="text-muted-foreground/60 text-xs ms-0.5">
                          {t("nutrition.units.g", "g")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {f.fatsG}
                        <span className="text-muted-foreground/60 text-xs ms-0.5">
                          {t("nutrition.units.g", "g")}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => duplicate.mutate(f.id)}
                            disabled={duplicate.isPending}
                            aria-label={t("admin.foodLibrary.duplicateAria", "Duplicate food")}
                            data-testid={`button-duplicate-food-${f.id}`}
                          >
                            <Copy size={15} aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => openEdit(f)}
                            aria-label={t("admin.foodLibrary.editAria", "Edit food")}
                            data-testid={`button-edit-food-${f.id}`}
                          >
                            <Edit3 size={15} aria-hidden="true" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => setDeleteId(f.id)}
                            aria-label={t("admin.foodLibrary.deleteAria", "Delete food")}
                            data-testid={`button-delete-food-${f.id}`}
                          >
                            <Trash2 size={15} aria-hidden="true" />
                          </Button>
                        </div>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {total > PAGE_SIZE && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span data-testid="text-foods-count">
              {t("admin.foodLibrary.pageInfo", "Showing {from}-{to} of {total}")
                .replace("{from}", String(page * PAGE_SIZE + 1))
                .replace("{to}", String(Math.min((page + 1) * PAGE_SIZE, total)))
                .replace("{total}", String(total))}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0 || isFetching}
                data-testid="button-foods-prev"
              >
                {t("common.previous", "Previous")}
              </Button>
              <span className="tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page + 1 >= totalPages || isFetching}
                data-testid="button-foods-next"
              >
                {t("common.next", "Next")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <FoodFormDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSubmit={async (values) => {
          if (editing) {
            await update.mutateAsync({ id: editing.id, ...values });
          } else {
            await create.mutateAsync(values);
          }
          setOpen(false);
        }}
        submitting={create.isPending || update.isPending}
        categoryLabel={categoryLabel}
        unitLabel={unitLabel}
        digestionLabel={digestionLabel}
        timingLabel={timingLabel}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.foodLibrary.deleteTitle", "Delete this food?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "admin.foodLibrary.deleteDesc",
                "This removes the food from the catalogue. Meals already created using this food keep their snapshot copy and are not affected.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-food">
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (deleteId !== null) {
                  await del.mutateAsync(deleteId);
                  setDeleteId(null);
                }
              }}
              data-testid="button-confirm-delete-food"
            >
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// =============================
// Form dialog (create + edit)
// =============================
function FoodFormDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  submitting,
  categoryLabel,
  unitLabel,
  digestionLabel,
  timingLabel,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  editing: Food | null;
  onSubmit: (values: FormValues) => Promise<void>;
  submitting: boolean;
  categoryLabel: (k: string) => string;
  unitLabel: (k: string) => string;
  digestionLabel: (k: string) => string;
  timingLabel: (k: string) => string;
}) {
  const { t } = useTranslation();
  const form = useForm<FormValues>({
    resolver: zodResolver(insertFoodSchema),
    defaultValues: DEFAULTS,
    values: editing
      ? {
          name: editing.name,
          nameAr: editing.nameAr ?? "",
          category: editing.category as FormValues["category"],
          brand: editing.brand ?? "",
          servingSize: editing.servingSize,
          servingUnit: editing.servingUnit as FormValues["servingUnit"],
          kcal: editing.kcal,
          proteinG: editing.proteinG,
          carbsG: editing.carbsG,
          fatsG: editing.fatsG,
          fiberG: editing.fiberG ?? undefined,
          sugarG: editing.sugarG ?? undefined,
          sodiumMg: editing.sodiumMg ?? undefined,
          digestionSpeed: (editing.digestionSpeed as FormValues["digestionSpeed"]) ?? undefined,
          bestTiming: (editing.bestTiming as FormValues["bestTiming"]) ?? undefined,
          notes: editing.notes ?? "",
          isActive: editing.isActive,
          isSupplement: editing.isSupplement,
        }
      : DEFAULTS,
  });

  // Live preview: kcal vs computed kcal from macros (4/4/9 rule).
  const watched = form.watch();
  const computedKcal = Math.round(
    (Number(watched.proteinG) || 0) * 4 +
      (Number(watched.carbsG) || 0) * 4 +
      (Number(watched.fatsG) || 0) * 9,
  );
  const enteredKcal = Math.round(Number(watched.kcal) || 0);
  const kcalMismatch = Math.abs(enteredKcal - computedKcal) > 15 && computedKcal > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t("admin.foodLibrary.editTitle", "Edit food")
              : t("admin.foodLibrary.addTitle", "Add food")}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(async (v) => {
              await onSubmit(v);
            })}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.foodLibrary.field.name", "Name")}</FormLabel>
                    <FormControl>
                      <Input {...field} data-testid="input-food-name" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="brand"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {t("admin.foodLibrary.field.brand", "Brand (optional)")}
                    </FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={field.value ?? ""}
                        data-testid="input-food-brand"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="category"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.foodLibrary.field.category", "Category")}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger data-testid="select-food-category">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {FOOD_CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>
                            {categoryLabel(c)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="grid grid-cols-2 gap-2">
                <FormField
                  control={form.control}
                  name="servingSize"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("admin.foodLibrary.field.servingSize", "Serving size")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseNumberInput(e.target.value) ?? 0)}
                          data-testid="input-food-serving-size"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="servingUnit"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.foodLibrary.field.unit", "Unit")}</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-food-unit">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {FOOD_SERVING_UNITS.map((u) => (
                            <SelectItem key={u} value={u}>
                              {unitLabel(u)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {t("admin.foodLibrary.section.macros", "Macros per serving")}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <FormField
                  control={form.control}
                  name="kcal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("nutrition.units.kcal", "kcal")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="1"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseNumberInput(e.target.value) ?? 0)}
                          data-testid="input-food-kcal"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="proteinG"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("admin.foodLibrary.field.protein", "Protein (g)")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseNumberInput(e.target.value) ?? 0)}
                          data-testid="input-food-protein"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="carbsG"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.foodLibrary.field.carbs", "Carbs (g)")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseNumberInput(e.target.value) ?? 0)}
                          data-testid="input-food-carbs"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fatsG"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.foodLibrary.field.fats", "Fats (g)")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseNumberInput(e.target.value) ?? 0)}
                          data-testid="input-food-fats"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              {kcalMismatch && (
                <p
                  className="mt-2 text-xs text-amber-500"
                  role="status"
                  data-testid="text-kcal-mismatch"
                >
                  {t(
                    "admin.foodLibrary.kcalMismatch",
                    "Heads-up: macros compute to {computed} kcal but you entered {entered}.",
                  )
                    .replace("{computed}", String(computedKcal))
                    .replace("{entered}", String(enteredKcal))}
                </p>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">
                {t("admin.foodLibrary.section.optional", "Optional details")}
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <FormField
                  control={form.control}
                  name="fiberG"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.foodLibrary.field.fiber", "Fiber (g)")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseNumberInput(e.target.value))}
                          data-testid="input-food-fiber"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sugarG"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.foodLibrary.field.sugar", "Sugar (g)")}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="0.1"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseNumberInput(e.target.value))}
                          data-testid="input-food-sugar"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="sodiumMg"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("admin.foodLibrary.field.sodium", "Sodium (mg)")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          inputMode="decimal"
                          step="1"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(parseNumberInput(e.target.value))}
                          data-testid="input-food-sodium"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                <FormField
                  control={form.control}
                  name="digestionSpeed"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("admin.foodLibrary.field.digestion", "Digestion speed")}
                      </FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-food-digestion">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">
                            {t("common.notSet", "Not set")}
                          </SelectItem>
                          {FOOD_DIGESTION_SPEEDS.map((d) => (
                            <SelectItem key={d} value={d}>
                              {digestionLabel(d)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="bestTiming"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>
                        {t("admin.foodLibrary.field.timing", "Best timing")}
                      </FormLabel>
                      <Select
                        onValueChange={(v) => field.onChange(v === "__none__" ? undefined : v)}
                        value={field.value ?? "__none__"}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-food-timing">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="__none__">
                            {t("common.notSet", "Not set")}
                          </SelectItem>
                          {FOOD_TIMINGS.map((tg) => (
                            <SelectItem key={tg} value={tg}>
                              {timingLabel(tg)}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem className="mt-3">
                    <FormLabel>{t("admin.foodLibrary.field.notes", "Notes")}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        value={field.value ?? ""}
                        rows={2}
                        data-testid="input-food-notes"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="border-t border-border pt-4 flex flex-wrap gap-6">
              <FormField
                control={form.control}
                name="isSupplement"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value ?? false}
                        onCheckedChange={field.onChange}
                        data-testid="switch-food-supplement"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      {t("admin.foodLibrary.field.isSupplement", "This is a supplement")}
                    </FormLabel>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center gap-2 space-y-0">
                    <FormControl>
                      <Switch
                        checked={field.value ?? true}
                        onCheckedChange={field.onChange}
                        data-testid="switch-food-active"
                      />
                    </FormControl>
                    <FormLabel className="!mt-0">
                      {t("admin.foodLibrary.field.isActive", "Active in catalogue")}
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={submitting}
                data-testid="button-food-cancel"
              >
                {t("common.cancel", "Cancel")}
              </Button>
              <Button type="submit" disabled={submitting} data-testid="button-food-save">
                {submitting && (
                  <Loader2 className="animate-spin mr-2" size={14} aria-hidden="true" />
                )}
                {editing
                  ? t("common.save", "Save")
                  : t("admin.foodLibrary.addAction", "Add to library")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
