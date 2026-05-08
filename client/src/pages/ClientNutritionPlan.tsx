import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Apple,
  Droplets,
  Target,
  Calendar,
  ChefHat,
  Info,
  Share2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useMyActiveNutritionPlan } from "@/hooks/use-nutrition-plans";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/i18n";
import { buildNutritionPlanWhatsApp, whatsappUrl, DEFAULT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import {
  NUTRITION_PLAN_GOAL_LABELS_EN,
  NUTRITION_PLAN_DAY_TYPE_LABELS_EN,
  MEAL_CATEGORY_LABELS_EN,
} from "@shared/schema";

function dayTotals(meals: { totalKcal: number; totalProteinG: number; totalCarbsG: number; totalFatsG: number }[]) {
  return meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.totalKcal,
      proteinG: acc.proteinG + m.totalProteinG,
      carbsG: acc.carbsG + m.totalCarbsG,
      fatsG: acc.fatsG + m.totalFatsG,
    }),
    { kcal: 0, proteinG: 0, carbsG: 0, fatsG: 0 },
  );
}

export default function ClientNutritionPlan() {
  const { t, lang } = useTranslation();
  const { data: plan, isLoading, isError } = useMyActiveNutritionPlan();
  const { data: settings } = useSettings();
  const { user } = useAuth();
  const [activeIdx, setActiveIdx] = useState(0);

  const goalLabel = (k: string) =>
    t(`admin.planBuilder.goal.${k}`, (NUTRITION_PLAN_GOAL_LABELS_EN as any)[k] ?? k);
  const dayTypeLabel = (k: string) =>
    t(
      `admin.planBuilder.dayType.${k}`,
      (NUTRITION_PLAN_DAY_TYPE_LABELS_EN as any)[k] ?? k,
    );
  const categoryLabel = (k: string) =>
    t(`nutrition.mealCategory.${k}`, (MEAL_CATEGORY_LABELS_EN as any)[k] ?? k);

  const days = plan?.days ?? [];
  const activeDay = days[activeIdx];
  const totals = useMemo(
    () => (activeDay ? dayTotals(activeDay.meals) : null),
    [activeDay],
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="mb-6 flex items-center gap-3">
          <Link href="/dashboard">
            <Button
              variant="ghost"
              size="icon"
              aria-label={t("common.back", "Back")}
              data-testid="button-back-dashboard"
            >
              <ArrowLeft size={18} aria-hidden="true" />
            </Button>
          </Link>
          <div className="flex-1 min-w-0">
            <p className="text-xs uppercase tracking-[0.25em] text-primary">
              {t("client.nutrition.kicker", "Your Nutrition")}
            </p>
            <h1
              className="text-2xl md:text-3xl font-display font-bold truncate"
              data-testid="text-my-nutrition-title"
            >
              {plan?.name ?? t("client.nutrition.title", "My Nutrition Plan")}
            </h1>
          </div>
          {plan && plan.days.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const msg = buildNutritionPlanWhatsApp(plan, {
                  lang,
                  clientName: user?.fullName ?? null,
                  dayIndex: activeIdx,
                });
                window.open(
                  whatsappUrl(settings?.whatsappNumber || DEFAULT_WHATSAPP_NUMBER, msg),
                  "_blank",
                  "noopener,noreferrer",
                );
              }}
              className="gap-2"
              data-testid="button-share-my-plan-whatsapp"
            >
              <Share2 size={14} aria-hidden="true" />
              <span className="hidden sm:inline">
                {t("client.nutrition.shareWa", "Share to WhatsApp")}
              </span>
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="rounded-2xl border border-border bg-card/40 p-10 text-center text-muted-foreground">
            {t("client.nutrition.loading", "Loading your plan…")}
          </div>
        ) : !plan ? (
          <div
            className="rounded-2xl border border-border bg-card/40 p-10 text-center"
            data-testid="empty-no-plan"
          >
            <Apple
              size={36}
              className="mx-auto mb-3 text-muted-foreground"
              aria-hidden="true"
            />
            <h2 className="text-lg font-semibold mb-2">
              {t("client.nutrition.empty.title", "No active nutrition plan yet")}
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {t(
                "client.nutrition.empty.body",
                "Your coach will share your nutrition plan here once it's ready. In the meantime, focus on your training and hydration.",
              )}
            </p>
          </div>
        ) : (
          <>
            {/* Plan overview */}
            <div className="rounded-2xl border border-border bg-card/40 p-5 md:p-6 mb-5">
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <Badge className="bg-primary/15 text-primary border-primary/30">
                  {goalLabel(plan.goal)}
                </Badge>
                <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30">
                  {t("admin.planBuilder.status.active", "Active")}
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {plan.startDate && (
                  <div className="rounded-xl border border-border/60 bg-background/30 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Calendar size={11} aria-hidden="true" />
                      {t("client.nutrition.startDate", "Start Date")}
                    </p>
                    <p className="text-sm font-medium mt-0.5" data-testid="text-plan-start">
                      {plan.startDate}
                    </p>
                  </div>
                )}
                {plan.reviewDate && (
                  <div className="rounded-xl border border-border/60 bg-background/30 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Calendar size={11} aria-hidden="true" />
                      {t("client.nutrition.reviewDate", "Review")}
                    </p>
                    <p className="text-sm font-medium mt-0.5" data-testid="text-plan-review">
                      {plan.reviewDate}
                    </p>
                  </div>
                )}
                {plan.waterTargetMl && (
                  <div className="rounded-xl border border-border/60 bg-background/30 p-3">
                    <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                      <Droplets size={11} aria-hidden="true" />
                      {t("client.nutrition.water", "Water Target")}
                    </p>
                    <p className="text-sm font-medium mt-0.5 tabular-nums" data-testid="text-plan-water">
                      {(plan.waterTargetMl / 1000).toFixed(1)} L
                    </p>
                  </div>
                )}
                <div className="rounded-xl border border-border/60 bg-background/30 p-3">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                    <ChefHat size={11} aria-hidden="true" />
                    {t("client.nutrition.dayCount", "Day Types")}
                  </p>
                  <p className="text-sm font-medium mt-0.5 tabular-nums">{plan.days.length}</p>
                </div>
              </div>
              {plan.publicNotes && (
                <div className="mt-4 rounded-xl border border-primary/20 bg-primary/5 p-4">
                  <p className="text-[11px] uppercase tracking-wider text-primary mb-1 flex items-center gap-1">
                    <Info size={11} aria-hidden="true" />
                    {t("client.nutrition.coachNotes", "Coach Notes")}
                  </p>
                  <p className="text-sm whitespace-pre-line" data-testid="text-plan-coach-notes">
                    {plan.publicNotes}
                  </p>
                </div>
              )}
            </div>

            {/* Day tabs */}
            {days.length > 0 && (
              <Tabs
                value={String(activeIdx)}
                onValueChange={(v) => setActiveIdx(Number(v))}
              >
                <TabsList className="bg-white/5 mb-4 h-auto flex-wrap p-1 gap-1">
                  {days.map((d, i) => (
                    <TabsTrigger
                      key={d.id}
                      value={String(i)}
                      data-testid={`tab-client-day-${i}`}
                      className="text-xs md:text-sm"
                    >
                      {d.label?.trim() || dayTypeLabel(d.dayType)}
                    </TabsTrigger>
                  ))}
                </TabsList>

                {days.map((d, idx) => {
                  const t2 = dayTotals(d.meals);
                  return (
                    <TabsContent key={d.id} value={String(idx)} className="mt-0">
                      {/* Targets */}
                      <div className="rounded-2xl border border-border bg-card/40 p-5 mb-4">
                        <p className="text-xs uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1">
                          <Target size={11} aria-hidden="true" />
                          {t("client.nutrition.dailyTargets", "Daily Targets")}
                        </p>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          {[
                            { label: t("nutrition.kcal", "kcal"), v: d.targetKcal },
                            { label: t("nutrition.protein", "Protein"), v: d.targetProteinG, unit: "g" },
                            { label: t("nutrition.carbs", "Carbs"), v: d.targetCarbsG, unit: "g" },
                            { label: t("nutrition.fats", "Fats"), v: d.targetFatsG, unit: "g" },
                          ].map((row) => (
                            <div
                              key={row.label}
                              className="rounded-xl border border-border/60 bg-background/30 p-3"
                            >
                              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                                {row.label}
                              </p>
                              <p className="text-lg font-semibold tabular-nums mt-0.5">
                                {row.v}
                                {(row as any).unit ?? ""}
                              </p>
                            </div>
                          ))}
                        </div>
                        {d.notes && (
                          <p className="mt-3 text-sm text-muted-foreground whitespace-pre-line">
                            {d.notes}
                          </p>
                        )}
                      </div>

                      {/* Meals */}
                      {d.meals.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-border/60 bg-card/20 p-8 text-center text-sm text-muted-foreground">
                          {t("client.nutrition.noMeals", "No meals on this day yet.")}
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {d.meals.map((m) => (
                            <div
                              key={m.id}
                              className="rounded-2xl border border-border bg-card/40 p-4 md:p-5"
                              data-testid={`card-client-meal-${m.id}`}
                            >
                              <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                                <div>
                                  <h3 className="font-display font-semibold text-base">
                                    {m.name}
                                  </h3>
                                  <Badge variant="secondary" className="text-[10px] mt-1">
                                    {categoryLabel(m.category)}
                                  </Badge>
                                </div>
                                <div className="text-right text-xs text-muted-foreground tabular-nums">
                                  <p className="text-base font-semibold text-foreground">
                                    {Math.round(m.totalKcal)} kcal
                                  </p>
                                  <p>
                                    P {m.totalProteinG}g · C {m.totalCarbsG}g · F{" "}
                                    {m.totalFatsG}g
                                  </p>
                                </div>
                              </div>
                              <ul className="space-y-1.5">
                                {m.items.map((it) => (
                                  <li
                                    key={it.id}
                                    className="flex items-center justify-between gap-3 text-sm border-t border-border/40 pt-1.5 first:border-t-0 first:pt-0"
                                  >
                                    <span className="truncate">{it.name}</span>
                                    <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                                      {(it.servingSize * it.quantity).toFixed(0)}
                                      {it.servingUnit}
                                      {" · "}
                                      {Math.round(it.kcal * it.quantity)} kcal
                                    </span>
                                  </li>
                                ))}
                              </ul>
                              {m.notes && (
                                <p className="mt-3 text-xs text-muted-foreground whitespace-pre-line">
                                  {m.notes}
                                </p>
                              )}
                            </div>
                          ))}
                          <div className="rounded-2xl border border-border/60 bg-background/40 p-4 text-sm flex items-center justify-between flex-wrap gap-2">
                            <span className="font-semibold">
                              {t("client.nutrition.dayTotal", "Day Total")}
                            </span>
                            <span className="tabular-nums text-muted-foreground">
                              <span className="font-semibold text-foreground">
                                {Math.round(t2.kcal)} kcal
                              </span>
                              {" · "}P {t2.proteinG.toFixed(0)}g · C {t2.carbsG.toFixed(0)}g · F{" "}
                              {t2.fatsG.toFixed(0)}g
                            </span>
                          </div>
                        </div>
                      )}
                    </TabsContent>
                  );
                })}
              </Tabs>
            )}
          </>
        )}
      </div>
    </div>
  );
}
