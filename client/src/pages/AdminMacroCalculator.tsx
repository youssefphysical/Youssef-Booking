import { useMemo, useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { ArrowLeft, Calculator, Beef, Wheat, Droplets, RefreshCw, Flame, Wand2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { AdminTabs } from "@/pages/AdminDashboard";

const KCAL_PER_G_PROTEIN = 4;
const KCAL_PER_G_CARBS = 4;
const KCAL_PER_G_FAT = 9;

function clampNumber(v: number, min = 0, max = 1500): number {
  if (!Number.isFinite(v)) return 0;
  return Math.max(min, Math.min(max, v));
}

function useAnimatedNumber(target: number, duration = 380): number {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const startRef = useRef<number>(0);
  const rafRef = useRef<number>(0);
  useEffect(() => {
    fromRef.current = value;
    startRef.current = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now: number) => {
      const elapsed = now - startRef.current;
      const t = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const next = fromRef.current + (target - fromRef.current) * eased;
      setValue(next);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration]);
  return value;
}

interface MacroRingProps {
  label: string;
  grams: number;
  kcal: number;
  percent: number;
  color: string;
  icon: React.ReactNode;
  testId: string;
  unitG: string;
  unitKcal: string;
}

function MacroRing({ label, grams, kcal, percent, color, icon, testId, unitG, unitKcal }: MacroRingProps) {
  const animatedPercent = useAnimatedNumber(percent);
  const animatedGrams = useAnimatedNumber(grams);
  const animatedKcal = useAnimatedNumber(kcal);
  const r = 42;
  const c = 2 * Math.PI * r;
  const offset = c - (c * Math.max(0, Math.min(100, animatedPercent))) / 100;
  return (
    <div
      role="group"
      aria-label={`${label}: ${Math.round(grams)}${unitG}, ${Math.round(kcal)} ${unitKcal}, ${Math.round(percent)}%`}
      className="shadcn-card hairline-top fade-in-up rounded-xl border bg-card border-card-border p-3 sm:p-5 flex flex-col items-center text-center"
      data-testid={`macro-ring-${testId}`}
    >
      <div className="relative w-[clamp(80px,26vw,112px)] aspect-square">
        <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90" aria-hidden="true">
          <circle cx="50" cy="50" r={r} stroke="hsl(var(--muted))" strokeWidth="8" fill="none" opacity="0.25" />
          <circle
            cx="50"
            cy="50"
            r={r}
            stroke={color}
            strokeWidth="8"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={offset}
            style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dashoffset 60ms linear" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[10px]" style={{ color }} aria-hidden="true">
            {icon}
          </div>
          <div className="tabular-nums-stat text-base sm:text-xl font-bold leading-none mt-1" data-testid={`text-${testId}-percent`}>
            {Math.round(animatedPercent)}%
          </div>
        </div>
      </div>
      <div className="mt-2 sm:mt-3 text-[10px] sm:text-xs uppercase tracking-[0.14em] sm:tracking-[0.16em] text-muted-foreground font-semibold">{label}</div>
      <div className="tabular-nums-stat text-base sm:text-lg font-bold mt-1" data-testid={`text-${testId}-grams`}>
        {Math.round(animatedGrams)}<span className="text-[10px] sm:text-xs text-muted-foreground font-medium ml-0.5">{unitG}</span>
      </div>
      <div className="tabular-nums-stat text-[10px] sm:text-[11px] text-muted-foreground mt-0.5" data-testid={`text-${testId}-kcal`}>
        {Math.round(animatedKcal)} {unitKcal}
      </div>
    </div>
  );
}

interface MacroInputProps {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
  unit?: string;
  step?: number;
  max?: number;
  testId: string;
  decreaseLabel: string;
  increaseLabel: string;
}

function MacroInput({
  id,
  label,
  value,
  onChange,
  color,
  unit = "g",
  step = 5,
  max = 1500,
  testId,
  decreaseLabel,
  increaseLabel,
}: MacroInputProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs uppercase tracking-[0.14em] font-semibold flex items-center gap-2">
        <span
          className="inline-block w-2 h-2 rounded-full"
          style={{ background: color, boxShadow: `0 0 8px ${color}` }}
          aria-hidden="true"
        />
        {label}
      </Label>
      <div className="flex items-stretch gap-2">
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(clampNumber(value - step, 0, max))}
          className="shrink-0 h-11 w-11 sm:h-10 sm:w-10 text-lg"
          aria-label={decreaseLabel}
          data-testid={`button-${testId}-decrement`}
        >
          <span aria-hidden="true">−</span>
        </Button>
        <div className="relative flex-1">
          <Input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            max={max}
            step={step}
            value={value === 0 ? "" : value}
            onChange={(e) => onChange(clampNumber(parseFloat(e.target.value) || 0, 0, max))}
            placeholder="0"
            aria-describedby={`${id}-unit`}
            className="h-11 sm:h-10 text-center text-lg font-bold tabular-nums-stat pr-8"
            data-testid={`input-${testId}`}
          />
          <span
            id={`${id}-unit`}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none"
          >
            {unit}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={() => onChange(clampNumber(value + step, 0, max))}
          className="shrink-0 h-11 w-11 sm:h-10 sm:w-10 text-lg"
          aria-label={increaseLabel}
          data-testid={`button-${testId}-increment`}
        >
          <span aria-hidden="true">+</span>
        </Button>
      </div>
    </div>
  );
}

const COLOR_PROTEIN = "rgb(56 189 248)";
const COLOR_CARBS = "rgb(251 191 36)";
const COLOR_FATS = "rgb(244 114 182)";

export default function AdminMacroCalculator() {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen page-fade pt-20 sm:pt-24 pb-16">
      <div className="max-w-6xl mx-auto px-3 sm:px-6">
        <div className="mb-3 sm:mb-4">
          <Link
            href="/admin"
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm text-muted-foreground hover:text-foreground transition-colors"
            data-testid="link-back-admin"
          >
            <ArrowLeft size={14} /> {t("nutrition.backToAdmin", "Back to Admin")}
          </Link>
        </div>
        <AdminTabs />
        <div className="flex items-start gap-3 mb-5 sm:mb-7">
          <div className="shrink-0 w-11 h-11 sm:w-12 sm:h-12 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary ring-glow-primary">
            <Calculator size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold tracking-tight" data-testid="heading-macro-calculator">
              {t("nutrition.macroCalc.title", "Smart Macro Calculator")}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              {t(
                "nutrition.macroCalc.subtitle",
                "Coach-grade macro math: live calories, percentages, and a reverse helper for target-driven plans.",
              )}
            </p>
          </div>
        </div>

        <Tabs defaultValue="forward" className="space-y-5 sm:space-y-6">
          <TabsList className="grid grid-cols-2 w-full sm:w-auto sm:inline-grid h-11">
            <TabsTrigger value="forward" data-testid="tab-forward" className="text-xs sm:text-sm">
              {t("nutrition.macroCalc.forwardTab", "Macros → Calories")}
            </TabsTrigger>
            <TabsTrigger value="reverse" data-testid="tab-reverse" className="text-xs sm:text-sm">
              {t("nutrition.macroCalc.reverseTab", "Calories → Macros")}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="forward">
            <ForwardMode />
          </TabsContent>
          <TabsContent value="reverse">
            <ReverseMode />
          </TabsContent>
        </Tabs>

        <p className="mt-6 sm:mt-8 text-[11px] text-muted-foreground/70 text-center">
          {t(
            "nutrition.macroCalc.disclaimer",
            "Educational tool for coach planning. Not medical advice.",
          )}
        </p>
      </div>
    </div>
  );
}

function ForwardMode() {
  const { t } = useTranslation();
  const unitG = t("nutrition.units.g", "g");
  const unitKcal = t("nutrition.units.kcal", "kcal");
  const labelProtein = t("nutrition.macros.protein", "Protein");
  const labelCarbs = t("nutrition.macros.carbs", "Carbs");
  const labelFats = t("nutrition.macros.fats", "Fats");
  const decreaseTpl = t("nutrition.macroCalc.decrease", "Decrease {macro}");
  const increaseTpl = t("nutrition.macroCalc.increase", "Increase {macro}");
  const [protein, setProtein] = useState(180);
  const [carbs, setCarbs] = useState(220);
  const [fats, setFats] = useState(70);

  const calc = useMemo(() => {
    const pKcal = protein * KCAL_PER_G_PROTEIN;
    const cKcal = carbs * KCAL_PER_G_CARBS;
    const fKcal = fats * KCAL_PER_G_FAT;
    const total = pKcal + cKcal + fKcal;
    const safe = total > 0 ? total : 1;
    return {
      pKcal,
      cKcal,
      fKcal,
      total,
      pPct: (pKcal / safe) * 100,
      cPct: (cKcal / safe) * 100,
      fPct: (fKcal / safe) * 100,
    };
  }, [protein, carbs, fats]);

  const animatedTotal = useAnimatedNumber(calc.total);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-5 sm:gap-6">
      <Card className="hairline-top fade-in-up" data-testid="card-forward-inputs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Wand2 size={16} className="text-primary" />
            {t("nutrition.macroCalc.inputsTitle", "Daily macro intake")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t("nutrition.macroCalc.inputsHelp", "Tap +/- or type. Calories update live.")}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 sm:space-y-5">
          <MacroInput
            id="protein-g"
            label={labelProtein}
            value={protein}
            onChange={setProtein}
            color={COLOR_PROTEIN}
            unit={unitG}
            testId="protein"
            decreaseLabel={decreaseTpl.replace("{macro}", labelProtein)}
            increaseLabel={increaseTpl.replace("{macro}", labelProtein)}
          />
          <MacroInput
            id="carbs-g"
            label={labelCarbs}
            value={carbs}
            onChange={setCarbs}
            color={COLOR_CARBS}
            unit={unitG}
            testId="carbs"
            decreaseLabel={decreaseTpl.replace("{macro}", labelCarbs)}
            increaseLabel={increaseTpl.replace("{macro}", labelCarbs)}
          />
          <MacroInput
            id="fats-g"
            label={labelFats}
            value={fats}
            onChange={setFats}
            color={COLOR_FATS}
            unit={unitG}
            testId="fats"
            decreaseLabel={decreaseTpl.replace("{macro}", labelFats)}
            increaseLabel={increaseTpl.replace("{macro}", labelFats)}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setProtein(0);
              setCarbs(0);
              setFats(0);
            }}
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            data-testid="button-reset-forward"
          >
            <RefreshCw size={12} className="mr-1.5" /> {t("nutrition.macroCalc.reset", "Reset")}
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4 sm:space-y-5">
        <Card className="hairline-top fade-in-up fade-in-up-delay-1 ring-glow-primary" data-testid="card-total-kcal">
          <CardContent className="p-5 sm:p-6 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground font-semibold flex items-center gap-1.5">
                <Flame size={11} aria-hidden="true" /> {t("nutrition.macroCalc.totalKcal", "Total daily calories")}
              </div>
              <div
                className="tabular-nums-stat text-3xl sm:text-4xl font-bold mt-1.5"
                data-testid="text-total-kcal"
                aria-live="polite"
              >
                {Math.round(animatedTotal).toLocaleString()}
                <span className="text-base sm:text-lg text-muted-foreground font-medium ml-1.5">{unitKcal}</span>
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end gap-1 text-[11px] tabular-nums-stat shrink-0">
              <span className="text-muted-foreground">{labelProtein.charAt(0)} · {Math.round(calc.pPct)}%</span>
              <span className="text-muted-foreground">{labelCarbs.charAt(0)} · {Math.round(calc.cPct)}%</span>
              <span className="text-muted-foreground">{labelFats.charAt(0)} · {Math.round(calc.fPct)}%</span>
            </div>
          </CardContent>
          <div className="px-5 sm:px-6 pb-5">
            <div
              role="img"
              aria-label={t(
                "nutrition.macroCalc.distributionLabel",
                "Macro distribution: {p}% protein, {c}% carbs, {f}% fats",
              )
                .replace("{p}", String(Math.round(calc.pPct)))
                .replace("{c}", String(Math.round(calc.cPct)))
                .replace("{f}", String(Math.round(calc.fPct)))}
              className="h-2.5 rounded-full overflow-hidden bg-muted/30 flex"
            >
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{ width: `${calc.pPct}%`, background: COLOR_PROTEIN }}
              />
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{ width: `${calc.cPct}%`, background: COLOR_CARBS }}
              />
              <div
                className="h-full transition-all duration-500 ease-out"
                style={{ width: `${calc.fPct}%`, background: COLOR_FATS }}
              />
            </div>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-2 sm:gap-4">
          <MacroRing
            label={labelProtein}
            grams={protein}
            kcal={calc.pKcal}
            percent={calc.pPct}
            color={COLOR_PROTEIN}
            icon={<Beef size={14} />}
            testId="protein"
            unitG={unitG}
            unitKcal={unitKcal}
          />
          <MacroRing
            label={labelCarbs}
            grams={carbs}
            kcal={calc.cKcal}
            percent={calc.cPct}
            color={COLOR_CARBS}
            icon={<Wheat size={14} />}
            testId="carbs"
            unitG={unitG}
            unitKcal={unitKcal}
          />
          <MacroRing
            label={labelFats}
            grams={fats}
            kcal={calc.fKcal}
            percent={calc.fPct}
            color={COLOR_FATS}
            icon={<Droplets size={14} />}
            testId="fats"
            unitG={unitG}
            unitKcal={unitKcal}
          />
        </div>
      </div>
    </div>
  );
}

function ReverseMode() {
  const { t } = useTranslation();
  const unitG = t("nutrition.units.g", "g");
  const unitKcal = t("nutrition.units.kcal", "kcal");
  const labelProtein = t("nutrition.macros.protein", "Protein");
  const labelCarbs = t("nutrition.macros.carbs", "Carbs");
  const labelFats = t("nutrition.macros.fats", "Fats");
  const decreaseTpl = t("nutrition.macroCalc.decrease", "Decrease {macro}");
  const increaseTpl = t("nutrition.macroCalc.increase", "Increase {macro}");
  const carbAbbr = t("nutrition.macroCalc.carbsAbbr", "C");
  const fatAbbr = t("nutrition.macroCalc.fatsAbbr", "F");
  const [totalKcal, setTotalKcal] = useState(2200);
  const [proteinG, setProteinG] = useState(180);
  const [carbRatio, setCarbRatio] = useState(55); // % of remaining kcal that go to carbs

  const calc = useMemo(() => {
    const proteinKcal = proteinG * KCAL_PER_G_PROTEIN;
    const remaining = Math.max(0, totalKcal - proteinKcal);
    const carbsKcal = (remaining * carbRatio) / 100;
    const fatsKcal = remaining - carbsKcal;
    const carbsG = carbsKcal / KCAL_PER_G_CARBS;
    const fatsG = fatsKcal / KCAL_PER_G_FAT;
    const overTarget = proteinKcal > totalKcal;
    return { proteinKcal, remaining, carbsG, fatsG, carbsKcal, fatsKcal, overTarget };
  }, [totalKcal, proteinG, carbRatio]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-5 sm:gap-6">
      <Card className="hairline-top fade-in-up" data-testid="card-reverse-inputs">
        <CardHeader className="pb-3">
          <CardTitle className="text-base sm:text-lg flex items-center gap-2">
            <Wand2 size={16} className="text-primary" />
            {t("nutrition.macroCalc.reverseInputsTitle", "Targets")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t(
              "nutrition.macroCalc.reverseInputsHelp",
              "Set total kcal and protein. We'll suggest a carbs/fats split.",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="total-kcal" className="text-xs uppercase tracking-[0.14em] font-semibold">
              {t("nutrition.macroCalc.targetTotal", "Target daily calories")}
            </Label>
            <div className="relative">
              <Input
                id="total-kcal"
                type="number"
                inputMode="numeric"
                min={0}
                max={8000}
                step={50}
                value={totalKcal === 0 ? "" : totalKcal}
                onChange={(e) => setTotalKcal(clampNumber(parseFloat(e.target.value) || 0, 0, 8000))}
                placeholder="2200"
                className="h-11 sm:h-10 text-center text-lg font-bold tabular-nums-stat pr-12"
                data-testid="input-target-total"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                {unitKcal}
              </span>
            </div>
          </div>
          <MacroInput
            id="target-protein"
            label={t("nutrition.macroCalc.targetProtein", "Target protein")}
            value={proteinG}
            onChange={setProteinG}
            color={COLOR_PROTEIN}
            unit={unitG}
            step={5}
            testId="target-protein"
            decreaseLabel={decreaseTpl.replace("{macro}", labelProtein)}
            increaseLabel={increaseTpl.replace("{macro}", labelProtein)}
          />
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <Label htmlFor="slider-carb-ratio-label" id="slider-carb-ratio-label" className="text-xs uppercase tracking-[0.14em] font-semibold">
                {t("nutrition.macroCalc.carbFatSplit", "Carb / fat split")}
              </Label>
              <div className="text-[11px] tabular-nums-stat text-muted-foreground" aria-live="polite">
                <span style={{ color: COLOR_CARBS }}>{carbRatio}%{carbAbbr}</span>
                {" / "}
                <span style={{ color: COLOR_FATS }}>{100 - carbRatio}%{fatAbbr}</span>
              </div>
            </div>
            <Slider
              value={[carbRatio]}
              onValueChange={(v) => setCarbRatio(v[0] ?? 55)}
              min={20}
              max={80}
              step={5}
              aria-labelledby="slider-carb-ratio-label"
              aria-valuetext={`${carbRatio}% ${labelCarbs}, ${100 - carbRatio}% ${labelFats}`}
              data-testid="slider-carb-ratio"
            />
          </div>
        </CardContent>
      </Card>

      <Card className="hairline-top fade-in-up fade-in-up-delay-1" data-testid="card-reverse-output">
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">
            {t("nutrition.macroCalc.suggestedSplit", "Suggested split")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t(
              "nutrition.macroCalc.suggestedSplitHelp",
              "Adjust the slider to lean more carbs (training days) or more fats (rest days).",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {calc.overTarget && (
            <div
              className="rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-xs text-destructive-foreground"
              data-testid="warning-over-target"
            >
              {t(
                "nutrition.macroCalc.overTarget",
                "Protein alone exceeds the calorie target. Lower protein or raise total kcal.",
              )}
            </div>
          )}
          <ResultRow
            label={labelProtein}
            grams={proteinG}
            kcal={calc.proteinKcal}
            color={COLOR_PROTEIN}
            icon={<Beef size={14} />}
            testId="result-protein"
            unitG={unitG}
            unitKcal={unitKcal}
          />
          <ResultRow
            label={labelCarbs}
            grams={calc.carbsG}
            kcal={calc.carbsKcal}
            color={COLOR_CARBS}
            icon={<Wheat size={14} />}
            testId="result-carbs"
            unitG={unitG}
            unitKcal={unitKcal}
          />
          <ResultRow
            label={labelFats}
            grams={calc.fatsG}
            kcal={calc.fatsKcal}
            color={COLOR_FATS}
            icon={<Droplets size={14} />}
            testId="result-fats"
            unitG={unitG}
            unitKcal={unitKcal}
          />
          <div className="pt-3 mt-1 border-t border-border/60 flex items-center justify-between">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground font-semibold">
              {t("nutrition.macroCalc.totalKcal", "Total")}
            </span>
            <span className="tabular-nums-stat text-2xl font-bold" data-testid="text-reverse-total">
              {Math.round(totalKcal).toLocaleString()}
              <span className="text-xs text-muted-foreground font-medium ml-1">{unitKcal}</span>
            </span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

interface ResultRowProps {
  label: string;
  grams: number;
  kcal: number;
  color: string;
  icon: React.ReactNode;
  testId: string;
  unitG: string;
  unitKcal: string;
}

function ResultRow({ label, grams, kcal, color, icon, testId, unitG, unitKcal }: ResultRowProps) {
  const animatedG = useAnimatedNumber(grams);
  const animatedK = useAnimatedNumber(kcal);
  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 border border-border/50 px-3 py-2.5"
      data-testid={testId}
      aria-label={`${label}: ${Math.round(grams)}${unitG}, ${Math.round(kcal)} ${unitKcal}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <span
          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md"
          style={{ background: `${color}20`, color }}
          aria-hidden="true"
        >
          {icon}
        </span>
        <span className="text-sm font-semibold truncate">{label}</span>
      </div>
      <div className="flex items-baseline gap-2 shrink-0">
        <span className="tabular-nums-stat text-lg font-bold" style={{ color }}>
          {Math.round(animatedG)}
          <span className="text-xs text-muted-foreground font-medium ml-0.5">{unitG}</span>
        </span>
        <span className="tabular-nums-stat text-[11px] text-muted-foreground">
          {Math.round(animatedK)} {unitKcal}
        </span>
      </div>
    </div>
  );
}
