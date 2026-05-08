import { useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  Plus,
  Search,
  UtensilsCrossed,
  Edit3,
  Copy,
  Trash2,
  Loader2,
  Filter,
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
  useMeals,
  useDeleteMeal,
  useDuplicateMeal,
  type MealsListFilters,
} from "@/hooks/use-meals";
import {
  MEAL_CATEGORIES,
  MEAL_CATEGORY_LABELS_EN,
  type Meal,
} from "@shared/schema";
import { useTranslation } from "@/i18n";

const PAGE_SIZE = 50;

export default function AdminMealLibrary() {
  const { t } = useTranslation();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [showInactive, setShowInactive] = useState(false);
  const [page, setPage] = useState(0);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const filters: MealsListFilters = useMemo(
    () => ({
      search: search.trim() || undefined,
      category: category === "all" ? undefined : category,
      activeOnly: !showInactive,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    }),
    [search, category, showInactive, page],
  );

  const { data, isLoading, isFetching } = useMeals(filters);
  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const del = useDeleteMeal();
  const duplicate = useDuplicateMeal();

  const categoryLabel = (k: string) =>
    t(`nutrition.mealCategory.${k}`, (MEAL_CATEGORY_LABELS_EN as any)[k] ?? k);

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">
              {t("admin.mealLibrary.kicker", "Nutrition OS")}
            </p>
            <h1
              className="text-3xl font-display font-bold"
              data-testid="text-meal-library-title"
            >
              {t("admin.mealLibrary.title", "Meal Library")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1 max-w-xl">
              {t(
                "admin.mealLibrary.summary",
                "Reusable meals you can drop into client nutrition plans. Built from the food library with live macro totals.",
              )}
            </p>
          </div>
          <Button
            onClick={() => navigate("/admin/nutrition/meals/new")}
            className="gap-2"
            data-testid="button-add-meal"
          >
            <Plus size={16} aria-hidden="true" />
            {t("admin.mealLibrary.add", "Build Meal")}
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
              placeholder={t("admin.mealLibrary.searchPlaceholder", "Search by name…")}
              className="pl-9"
              aria-label={t("admin.mealLibrary.searchAria", "Search meals")}
              data-testid="input-meal-search"
            />
          </div>
          <Select
            value={category}
            onValueChange={(v) => {
              setCategory(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="w-[180px]" data-testid="select-meal-category">
              <Filter size={14} className="mr-1.5" aria-hidden="true" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {t("admin.mealLibrary.allCategories", "All categories")}
              </SelectItem>
              {MEAL_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>
                  {categoryLabel(c)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant={showInactive ? "default" : "outline"}
            size="sm"
            onClick={() => {
              setShowInactive((v) => !v);
              setPage(0);
            }}
            data-testid="button-toggle-inactive-meals"
          >
            {showInactive
              ? t("admin.mealLibrary.showActive", "Show active only")
              : t("admin.mealLibrary.showAll", "Show archived")}
          </Button>
          {isFetching && !isLoading && (
            <Loader2
              size={14}
              className="animate-spin text-muted-foreground"
              aria-hidden="true"
            />
          )}
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-border overflow-hidden bg-card/40">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="text-left font-medium px-4 py-3">
                    {t("admin.mealLibrary.col.name", "Meal")}
                  </th>
                  <th className="text-left font-medium px-3 py-3 hidden md:table-cell">
                    {t("admin.mealLibrary.col.category", "Category")}
                  </th>
                  <th className="text-right font-medium px-3 py-3 tabular-nums">
                    {t("admin.mealLibrary.col.kcal", "kcal")}
                  </th>
                  <th className="text-right font-medium px-3 py-3 tabular-nums hidden sm:table-cell">
                    P
                  </th>
                  <th className="text-right font-medium px-3 py-3 tabular-nums hidden sm:table-cell">
                    C
                  </th>
                  <th className="text-right font-medium px-3 py-3 tabular-nums hidden sm:table-cell">
                    F
                  </th>
                  <th className="text-right font-medium px-3 py-3">
                    {t("admin.mealLibrary.col.actions", "")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                      <Loader2
                        size={18}
                        className="animate-spin inline-block mr-2"
                        aria-hidden="true"
                      />
                      {t("admin.mealLibrary.loading", "Loading meals…")}
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <UtensilsCrossed
                        size={28}
                        className="mx-auto mb-3 text-muted-foreground"
                        aria-hidden="true"
                      />
                      <p className="text-muted-foreground" data-testid="text-empty-meals">
                        {search || category !== "all" || showInactive
                          ? t(
                              "admin.mealLibrary.emptyFiltered",
                              "No meals match these filters.",
                            )
                          : t(
                              "admin.mealLibrary.empty",
                              "No meals yet. Build your first one.",
                            )}
                      </p>
                    </td>
                  </tr>
                ) : (
                  items.map((m: Meal) => (
                    <tr
                      key={m.id}
                      className="border-t border-border/60 hover:bg-muted/20"
                      data-testid={`row-meal-${m.id}`}
                    >
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/nutrition/meals/${m.id}`}
                          className="font-medium hover:text-primary"
                          data-testid={`link-meal-${m.id}`}
                        >
                          {m.name}
                        </Link>
                        {!m.isActive && (
                          <Badge variant="outline" className="ml-2 text-[10px]">
                            {t("admin.mealLibrary.archived", "Archived")}
                          </Badge>
                        )}
                        {m.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {m.description}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell">
                        <Badge variant="secondary" className="text-[10px]">
                          {categoryLabel(m.category)}
                        </Badge>
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums font-medium">
                        {Math.round(m.totalKcal)}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums hidden sm:table-cell">
                        {m.totalProteinG}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums hidden sm:table-cell">
                        {m.totalCarbsG}
                      </td>
                      <td className="px-3 py-3 text-right tabular-nums hidden sm:table-cell">
                        {m.totalFatsG}
                      </td>
                      <td className="px-3 py-3 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => navigate(`/admin/nutrition/meals/${m.id}`)}
                          aria-label={t("admin.mealLibrary.editAria", "Edit meal")}
                          data-testid={`button-edit-meal-${m.id}`}
                        >
                          <Edit3 size={15} aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => duplicate.mutate(m.id)}
                          disabled={duplicate.isPending}
                          aria-label={t("admin.mealLibrary.duplicateAria", "Duplicate meal")}
                          data-testid={`button-duplicate-meal-${m.id}`}
                        >
                          <Copy size={15} aria-hidden="true" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(m.id)}
                          aria-label={t("admin.mealLibrary.deleteAria", "Delete meal")}
                          data-testid={`button-delete-meal-${m.id}`}
                        >
                          <Trash2 size={15} aria-hidden="true" />
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-4 flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {t("admin.mealLibrary.pageOf", "Page")} {page + 1} / {totalPages} · {total}{" "}
              {t("admin.mealLibrary.totalMeals", "meals")}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page === 0}
                data-testid="button-meals-prev-page"
              >
                {t("admin.mealLibrary.prev", "Previous")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page + 1 >= totalPages}
                data-testid="button-meals-next-page"
              >
                {t("admin.mealLibrary.next", "Next")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("admin.mealLibrary.deleteConfirmTitle", "Delete this meal?")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t(
                "admin.mealLibrary.deleteConfirmBody",
                "This permanently removes the meal and all its items. Plans that already snapshotted this meal are unaffected.",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete-meal">
              {t("common.cancel", "Cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId !== null) del.mutate(deleteId);
                setDeleteId(null);
              }}
              data-testid="button-confirm-delete-meal"
            >
              {t("common.delete", "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
