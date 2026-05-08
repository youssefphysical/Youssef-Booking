import { useEffect, useMemo, useState } from "react";
import { Search, Loader2, Apple, Beaker } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useFoods } from "@/hooks/use-foods";
import { useTranslation } from "@/i18n";
import {
  FOOD_CATEGORY_LABELS_EN,
  FOOD_SERVING_UNIT_LABELS_EN,
  type Food,
} from "@shared/schema";

interface Props {
  trigger: React.ReactNode;
  onPick: (food: Food) => void;
}

/**
 * Lightweight food search popover used by the meal builder. Hits the
 * existing /api/foods endpoint with a debounced search term, paginated
 * to 20 results — fast, no extra backend surface needed. Picking a
 * food fires `onPick` with the full Food row so the caller can
 * SNAPSHOT every macro field into a meal_items row.
 */
export function MealFoodPicker({ trigger, onPick }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [raw, setRaw] = useState("");
  const [debounced, setDebounced] = useState("");

  // 200ms debounce — keeps typing snappy with no per-keystroke fetches.
  useEffect(() => {
    const id = setTimeout(() => setDebounced(raw), 200);
    return () => clearTimeout(id);
  }, [raw]);

  const filters = useMemo(
    () => ({ search: debounced || undefined, activeOnly: true, limit: 20 }),
    [debounced],
  );
  const { data, isFetching } = useFoods(filters);
  const items = data?.items ?? [];

  function categoryLabel(key: string): string {
    return t(`nutrition.foodCategory.${key}`, FOOD_CATEGORY_LABELS_EN[key] ?? key);
  }
  function unitLabel(key: string): string {
    return t(`nutrition.servingUnit.${key}`, FOOD_SERVING_UNIT_LABELS_EN[key] ?? key);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        className="w-[min(420px,calc(100vw-2rem))] p-0"
        align="start"
        data-testid="popover-food-picker"
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
              placeholder={t("admin.mealBuilder.picker.search", "Search foods or supplements…")}
              aria-label={t("admin.mealBuilder.picker.searchAria", "Search foods")}
              className="pl-9 h-9"
              data-testid="input-food-picker-search"
            />
          </div>
        </div>
        <div className="max-h-[320px] overflow-y-auto" role="listbox">
          {isFetching && items.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
              <Loader2 size={14} className="animate-spin" aria-hidden="true" />
              {t("admin.mealBuilder.picker.loading", "Searching…")}
            </div>
          ) : items.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {debounced
                ? t("admin.mealBuilder.picker.empty", "No matching foods.")
                : t("admin.mealBuilder.picker.start", "Type to search the food library.")}
            </div>
          ) : (
            <ul className="py-1">
              {items.map((f) => (
                <li key={f.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(f);
                      setOpen(false);
                      setRaw("");
                    }}
                    className="w-full text-left px-3 py-2 hover:bg-accent focus:bg-accent focus:outline-none flex items-start gap-3"
                    role="option"
                    data-testid={`button-pick-food-${f.id}`}
                  >
                    <div className="mt-0.5 text-muted-foreground" aria-hidden="true">
                      {f.isSupplement ? <Beaker size={14} /> : <Apple size={14} />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm truncate">{f.name}</span>
                        <Badge variant="secondary" className="text-[10px] py-0 px-1.5">
                          {categoryLabel(f.category)}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 tabular-nums">
                        {f.servingSize} {unitLabel(f.servingUnit)} · {Math.round(f.kcal)} kcal · P{" "}
                        {f.proteinG}g · C {f.carbsG}g · F {f.fatsG}g
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
