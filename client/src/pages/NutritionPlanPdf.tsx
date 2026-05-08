import { Fragment, useMemo } from "react";
import { useParams } from "wouter";
import { Loader2, Apple } from "lucide-react";
import { PdfDocument } from "@/components/pdf/PdfDocument";
import {
  useNutritionPlan,
  useMyActiveNutritionPlan,
} from "@/hooks/use-nutrition-plans";
import { useAuth } from "@/hooks/use-auth";
import { useClients } from "@/hooks/use-clients";
import { useTranslation } from "@/i18n";
import {
  NUTRITION_PLAN_GOAL_LABELS_EN,
  NUTRITION_PLAN_DAY_TYPE_LABELS_EN,
  MEAL_CATEGORY_LABELS_EN,
  type NutritionPlanFull,
  type NutritionPlanDayWithMeals,
} from "@shared/schema";

function dayTotals(day: NutritionPlanDayWithMeals) {
  return day.meals.reduce(
    (acc, m) => ({
      kcal: acc.kcal + m.totalKcal,
      protein: acc.protein + m.totalProteinG,
      carbs: acc.carbs + m.totalCarbsG,
      fats: acc.fats + m.totalFatsG,
    }),
    { kcal: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

function fmt(n: number) {
  return Number.isFinite(n) ? Math.round(n).toString() : "0";
}

/**
 * Premium A4 nutrition-plan PDF view.
 *
 * Routing:
 *  - `/print/nutrition-plan/me`     — client prints their active plan
 *  - `/print/nutrition-plan/:id`    — admin prints any plan by id
 *
 * The `me` branch uses the auth-gated `/me/active` endpoint (server
 * strips `privateNotes`); the numeric branch uses the admin-gated
 * `/:id` endpoint. Either way the trainer's private notes never leak
 * into the printed output.
 */
export default function NutritionPlanPdf() {
  const { t } = useTranslation();
  const params = useParams<{ id: string }>();
  const isMe = params.id === "me";
  const planId = isMe ? null : Number(params.id);
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";

  // Two queries; only one runs based on the route.
  const adminPlan = useNutritionPlan(isMe ? null : planId);
  const myPlan = useMyActiveNutritionPlan(isMe);

  const plan: NutritionPlanFull | undefined = (isMe ? myPlan.data : adminPlan.data) as
    | NutritionPlanFull
    | undefined;
  const isLoading = isMe ? myPlan.isLoading : adminPlan.isLoading;

  // Resolve the recipient name. For admin printing, look up the client
  // in the clients list (same hook used elsewhere). For self-print,
  // use the signed-in user's full name — and skip the admin-only
  // /api/users query so clients don't see 403 noise.
  const { data: clients = [] } = useClients({ enabled: !isMe && isAdmin });
  const recipientName = useMemo(() => {
    if (!plan) return "";
    if (isMe) return user?.fullName ?? "";
    return clients.find((c) => c.id === plan.userId)?.fullName ?? "";
  }, [plan, isMe, user, clients]);

  const goalLabel = (k: string) =>
    t(`admin.planBuilder.goal.${k}`, (NUTRITION_PLAN_GOAL_LABELS_EN as any)[k] ?? k);
  const dayTypeLabel = (k: string) =>
    t(`admin.planBuilder.dayType.${k}`, (NUTRITION_PLAN_DAY_TYPE_LABELS_EN as any)[k] ?? k);
  const categoryLabel = (k: string) =>
    t(`nutrition.mealCategory.${k}`, (MEAL_CATEGORY_LABELS_EN as any)[k] ?? k);

  const backHref = isMe ? "/my-nutrition" : `/admin/nutrition/plans/${planId}`;
  const subtitleParts: string[] = [];
  if (recipientName) subtitleParts.push(recipientName);
  if (plan?.startDate) subtitleParts.push(`${t("pdf.from", "From")} ${plan.startDate}`);

  return (
    <PdfDocument
      title={plan?.name ?? t("pdf.nutritionTitle", "Nutrition Plan")}
      kicker={t("pdf.nutritionKicker", "NUTRITION PLAN")}
      subtitle={subtitleParts.join(" · ") || undefined}
      backHref={backHref}
      autoPrint
      isReady={!!plan && !isLoading}
    >
      {isLoading ? (
        <div className="py-20 text-center text-neutral-500">
          <Loader2 size={20} className="animate-spin inline mr-2" aria-hidden="true" />
          {t("pdf.loading", "Loading plan…")}
        </div>
      ) : !plan ? (
        <div className="py-20 text-center text-neutral-500">
          <Apple size={28} className="mx-auto mb-3" aria-hidden="true" />
          {t("pdf.noPlan", "No active nutrition plan to export.")}
        </div>
      ) : (
        <>
          {/* Plan summary band */}
          <section className="pdf-summary">
            <div className="pdf-summary-cell">
              <p className="pdf-cell-label">{t("pdf.goal", "Goal")}</p>
              <p className="pdf-cell-value">{goalLabel(plan.goal)}</p>
            </div>
            {plan.startDate && (
              <div className="pdf-summary-cell">
                <p className="pdf-cell-label">{t("pdf.start", "Start")}</p>
                <p className="pdf-cell-value">{plan.startDate}</p>
              </div>
            )}
            {plan.reviewDate && (
              <div className="pdf-summary-cell">
                <p className="pdf-cell-label">{t("pdf.review", "Review")}</p>
                <p className="pdf-cell-value">{plan.reviewDate}</p>
              </div>
            )}
            {plan.waterTargetMl ? (
              <div className="pdf-summary-cell">
                <p className="pdf-cell-label">{t("pdf.water", "Water")}</p>
                <p className="pdf-cell-value">
                  {(plan.waterTargetMl / 1000).toFixed(1)} L
                </p>
              </div>
            ) : null}
          </section>

          {plan.publicNotes && (
            <section className="pdf-callout">
              <p className="pdf-callout-label">{t("pdf.coachNotes", "Coach Notes")}</p>
              <p className="pdf-callout-body">{plan.publicNotes}</p>
            </section>
          )}

          {/* Day blocks */}
          {plan.days.map((day, dIdx) => {
            const totals = dayTotals(day);
            return (
              <section
                key={day.id}
                className="pdf-day"
                data-testid={`pdf-day-${dIdx}`}
              >
                <div className="pdf-day-head">
                  <div>
                    <p className="pdf-day-kicker">
                      {t("pdf.day", "DAY")} {dIdx + 1}
                    </p>
                    <h2 className="pdf-day-title">
                      {day.label?.trim() || dayTypeLabel(day.dayType)}
                    </h2>
                  </div>
                  <div className="pdf-targets">
                    <span className="pdf-target">
                      <strong>{fmt(day.targetKcal)}</strong> kcal
                    </span>
                    <span className="pdf-target">
                      P <strong>{fmt(day.targetProteinG)}</strong>g
                    </span>
                    <span className="pdf-target">
                      C <strong>{fmt(day.targetCarbsG)}</strong>g
                    </span>
                    <span className="pdf-target">
                      F <strong>{fmt(day.targetFatsG)}</strong>g
                    </span>
                  </div>
                </div>

                {day.meals.length === 0 ? (
                  <p className="pdf-empty">{t("pdf.noMeals", "No meals on this day.")}</p>
                ) : (
                  <table className="pdf-meal-table">
                    <thead>
                      <tr>
                        <th className="pdf-th-meal">{t("pdf.meal", "Meal")}</th>
                        <th className="pdf-th-qty">{t("pdf.qty", "Qty")}</th>
                        <th className="pdf-th-num">kcal</th>
                        <th className="pdf-th-num">P</th>
                        <th className="pdf-th-num">C</th>
                        <th className="pdf-th-num">F</th>
                      </tr>
                    </thead>
                    <tbody>
                      {day.meals.map((m) => (
                        <Fragment key={`mf-${m.id}`}>
                          <tr className="pdf-meal-row">
                            <td colSpan={2} className="pdf-meal-name">
                              <span className="pdf-meal-cat">
                                {categoryLabel(m.category)}
                              </span>
                              <span className="pdf-meal-title">{m.name}</span>
                            </td>
                            <td className="pdf-num pdf-meal-total">
                              {fmt(m.totalKcal)}
                            </td>
                            <td className="pdf-num pdf-meal-total">
                              {fmt(m.totalProteinG)}
                            </td>
                            <td className="pdf-num pdf-meal-total">
                              {fmt(m.totalCarbsG)}
                            </td>
                            <td className="pdf-num pdf-meal-total">
                              {fmt(m.totalFatsG)}
                            </td>
                          </tr>
                          {m.items.map((it) => (
                            <tr key={`i-${it.id}`} className="pdf-item-row">
                              <td className="pdf-item-name">{it.name}</td>
                              <td className="pdf-item-qty">
                                {(it.servingSize * it.quantity).toFixed(0)}
                                {it.servingUnit}
                              </td>
                              <td className="pdf-num">{fmt(it.kcal * it.quantity)}</td>
                              <td className="pdf-num">{fmt(it.proteinG * it.quantity)}</td>
                              <td className="pdf-num">{fmt(it.carbsG * it.quantity)}</td>
                              <td className="pdf-num">{fmt(it.fatsG * it.quantity)}</td>
                            </tr>
                          ))}
                        </Fragment>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="pdf-totals-row">
                        <td colSpan={2}>{t("pdf.dayTotal", "Day Total")}</td>
                        <td className="pdf-num">{fmt(totals.kcal)}</td>
                        <td className="pdf-num">{fmt(totals.protein)}</td>
                        <td className="pdf-num">{fmt(totals.carbs)}</td>
                        <td className="pdf-num">{fmt(totals.fats)}</td>
                      </tr>
                    </tfoot>
                  </table>
                )}

                {day.notes && (
                  <p className="pdf-day-notes">{day.notes}</p>
                )}
              </section>
            );
          })}
        </>
      )}
    </PdfDocument>
  );
}
