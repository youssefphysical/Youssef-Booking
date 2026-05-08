import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, UtensilsCrossed } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMeals } from "@/hooks/use-meals";
import { useTranslation } from "@/i18n";
import { MEAL_CATEGORY_LABELS_EN, type Meal } from "@shared/schema";

interface Props {
  trigger: React.ReactNode;
  /** Called with the chosen meal id; the caller fetches the full meal
   *  (with items) before snapshotting it into the plan tree. */
  onPick: (meal: Meal) => void;
}

/**
 * Library meal search popover used by the plan builder when the
 * trainer wants to drop a pre-built meal into a day. Mirrors the
 * MealFoodPicker UX: 200ms-debounced search, top 20 active meals.
 */
export function MealPicker({ trigger, onPick }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [debounced, setDebounced] = useState("");

  useEffect(() => {
    const id = setTimeout(() => setDebounced(raw), 200);
    return () => clearTimeout(id);
  }, [raw]);

  const filters = useMemo(
    () => ({ search: debounced || undefined, activeOnly: true, limit: 20 }),
    [debounced],
  );
  const { data, isFetching } = useMeals(filters);
  const items = data?.items ?? [];

  const categoryLabel = (k: string) =>
    t(`nutrition.mealCategory.${k}`, (MEAL_CATEGORY_LABELS_EN as any)[k] ?? k);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-[min(420px,calc(100vw-2rem))] p-0"
        align="start"
        data-testid="popover-meal-picker"
      >
        <div className="p-3 border-b border-border">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              autoFocus
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              placeholder={t("admin.planBuilder.picker.mealSearch", "Search meal library…")}
              aria-label={t("admin.planBuilder.picker.mealSearchAria", "Search meals")}
              className="pl-9 h-9"
              data-testid="input-meal-picker-search"
            />
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto" role="listbox">
          {isFetching && items.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t("admin.planBuilder.picker.loading", "Searching…")}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {debounced
                ? t("admin.planBuilder.picker.empty", "No matching meals.")
                : t("admin.planBuilder.picker.start", "Type to search the meal library.")}
            </div>
          ) : (
            <ul className="py-1">
              {items.map((m) => (
                <li key={m.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(m);
                      setOpen(false);
                      setRaw("");
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent focus:bg-accent focus:outline-none flex items-start gap-3"
                    role="option"
                    data-testid={`button-pick-meal-${m.id}`}
                  >
                    <div
                      className="mt-0.5 text-muted-foreground"
                      aria-hidden="true"
                    >
                      <UtensilsCrossed size={14} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{m.name}</span>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          {categoryLabel(m.category)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {Math.round(m.totalKcal)} kcal · P {m.totalProteinG}g · C{" "}
                        {m.totalCarbsG}g · F {m.totalFatsG}g
                      </div>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
