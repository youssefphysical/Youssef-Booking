import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import type { DailyCheckin } from "@shared/schema";
import { Heart, Moon, Droplets, Zap, BatteryCharging, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { InfoTip } from "@/components/ui/InfoTip";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useTranslation } from "@/i18n";

export type ReadinessTier = "crushing" | "solid" | "easy" | "unknown";

export function computeReadiness(c: DailyCheckin | null | undefined): {
  score: number | null;
  tier: ReadinessTier;
} {
  if (!c) return { score: null, tier: "unknown" };
  const { sleepHours, waterLiters, recoveryScore, energyScore } = c;
  const parts: number[] = [];
  if (sleepHours != null) parts.push(Math.max(0, Math.min(100, (Number(sleepHours) / 8) * 100)) * 0.30);
  if (waterLiters != null) parts.push(Math.max(0, Math.min(100, (Number(waterLiters) / 3) * 100)) * 0.20);
  if (recoveryScore != null) parts.push((Number(recoveryScore) / 10) * 100 * 0.30);
  if (energyScore != null) parts.push((Number(energyScore) / 10) * 100 * 0.20);
  if (parts.length === 0) return { score: null, tier: "unknown" };
  const weightFilled =
    (sleepHours != null ? 0.30 : 0) +
    (waterLiters != null ? 0.20 : 0) +
    (recoveryScore != null ? 0.30 : 0) +
    (energyScore != null ? 0.20 : 0);
  const score = Math.round(parts.reduce((a, b) => a + b, 0) / weightFilled);
  if (score >= 80) return { score, tier: "crushing" };
  if (score >= 60) return { score, tier: "solid" };
  return { score, tier: "easy" };
}

const TIER_COLOR: Record<ReadinessTier, { ring: string; text: string; bg: string }> = {
  crushing: { ring: "stroke-[#5ee7ff]", text: "text-cyan-300", bg: "bg-cyan-400/10 border-cyan-400/30" },
  solid:    { ring: "stroke-[#7af0ff]", text: "text-cyan-200", bg: "bg-cyan-300/5 border-cyan-300/20" },
  easy:     { ring: "stroke-amber-300", text: "text-amber-300", bg: "bg-amber-400/10 border-amber-400/30" },
  unknown:  { ring: "stroke-white/20", text: "text-white/60", bg: "bg-white/[0.03] border-white/10" },
};

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(mq.matches);
    update();
    mq.addEventListener?.("change", update);
    return () => mq.removeEventListener?.("change", update);
  }, []);
  return reduced;
}

export function RecoveryReadinessCard() {
  const { t } = useTranslation();
  const reduced = useReducedMotion();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: today } = useQuery<DailyCheckin | null>({
    queryKey: ["/api/me/checkins/today"],
  });

  const [open, setOpen] = useState(false);
  const [sleep, setSleep] = useState<number>(today?.sleepHours ?? 8);
  const [water, setWater] = useState<number>(today?.waterLiters ?? 2.5);
  const [recovery, setRecovery] = useState<number>(today?.recoveryScore ?? 7);
  const [energy, setEnergy] = useState<number>(today?.energyScore ?? 7);

  useEffect(() => {
    if (today) {
      if (today.sleepHours != null) setSleep(Number(today.sleepHours));
      if (today.waterLiters != null) setWater(Number(today.waterLiters));
      if (today.recoveryScore != null) setRecovery(today.recoveryScore);
      if (today.energyScore != null) setEnergy(today.energyScore);
    }
  }, [today]);

  const save = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/me/checkins", {
        sleepHours: sleep,
        waterLiters: water,
        recoveryScore: recovery,
        energyScore: energy,
      });
      return (await res.json()) as DailyCheckin;
    },
    onSuccess: (row) => {
      qc.setQueryData(["/api/me/checkins/today"], row);
      qc.invalidateQueries({ queryKey: ["/api/me/checkins/recent"] });
      toast({
        title: t("dashboard.recovery.saved.title", "Check-in saved"),
        description: t("dashboard.recovery.saved.desc", "Recovery readiness updated."),
      });
      setOpen(false);
    },
    onError: (err: Error) => {
      toast({
        title: t("dashboard.recovery.saveFailed", "Save failed"),
        description: err.message,
        variant: "destructive",
      });
    },
  });

  const { score, tier } = computeReadiness(today ?? null);
  const colors = TIER_COLOR[tier];
  const interpretation = t(`dashboard.recovery.tier.${tier}`, {
    crushing: "Crushing it",
    solid: "Solid",
    easy: "Take it easy",
    unknown: "Log today's check-in",
  }[tier]);

  const size = 120;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - ((score ?? 0) / 100) * c;

  return (
    <div
      className="rounded-2xl border border-white/10 bg-white/[0.02] p-5 sm:p-6"
      data-testid="card-recovery-readiness"
    >
      <div className="flex items-center gap-2 mb-4">
        <Heart size={16} className="text-cyan-300" />
        <h3 className="text-sm font-semibold tracking-wide text-white/80 uppercase">
          {t("dashboard.recovery.title", "Recovery readiness")}
        </h3>
        <InfoTip
          title={t("tooltip.recoveryScore.title")}
          body={t("tooltip.recoveryScore.body")}
          testId="infotip-recovery-score"
        />
      </div>

      <div className="flex items-center gap-5">
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          <svg width={size} height={size} className="-rotate-90">
            <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
            <circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              className={colors.ring}
              strokeWidth={stroke}
              strokeLinecap="round"
              fill="none"
              strokeDasharray={c}
              strokeDashoffset={offset}
              style={{
                transition: reduced ? "none" : "stroke-dashoffset 900ms cubic-bezier(0.22, 1, 0.36, 1)",
              }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-white tabular-nums" data-testid="text-readiness-score">
                {score ?? "—"}
              </div>
              <div className="text-[9px] uppercase tracking-wider text-white/40 mt-0.5">/ 100</div>
            </div>
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${colors.bg} ${colors.text}`}
            data-testid="badge-readiness-tier"
          >
            {tier === "crushing" && <Zap size={12} />}
            {tier === "solid" && <Check size={12} />}
            {tier === "easy" && <BatteryCharging size={12} />}
            <span data-testid="text-readiness-interpretation">{interpretation}</span>
          </div>
          <p className="text-sm text-white/60 mt-2 leading-relaxed">
            {today
              ? t("dashboard.recovery.basedOn", "Based on today's sleep, hydration, recovery & energy.")
              : t("dashboard.recovery.cta", "Log a quick 4-field check-in to get your daily score.")}
          </p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="mt-3 border-cyan-400/30 bg-cyan-400/5 text-cyan-200 hover:bg-cyan-400/10"
            onClick={() => setOpen((v) => !v)}
            data-testid="button-toggle-checkin"
          >
            {open
              ? t("dashboard.recovery.btnHide", "Hide form")
              : today
                ? t("dashboard.recovery.btnUpdate", "Update today")
                : t("dashboard.recovery.btnLog", "Log today")}
          </Button>
        </div>
      </div>

      {open && (
        <div className="mt-5 pt-5 border-t border-white/10 grid gap-5 sm:grid-cols-2">
          <Field
            icon={Moon}
            label={t("dashboard.recovery.field.sleep", "Sleep · {h} h").replace("{h}", sleep.toFixed(1))}
            testid="field-sleep"
          >
            <Slider value={[sleep]} min={0} max={12} step={0.5} onValueChange={(v) => setSleep(v[0] ?? 0)} data-testid="slider-sleep" />
          </Field>
          <Field
            icon={Droplets}
            label={t("dashboard.recovery.field.water", "Water · {l} L").replace("{l}", water.toFixed(1))}
            testid="field-water"
          >
            <Slider value={[water]} min={0} max={6} step={0.25} onValueChange={(v) => setWater(v[0] ?? 0)} data-testid="slider-water" />
          </Field>
          <Field
            icon={Heart}
            label={t("dashboard.recovery.field.recovery", "Recovery · {n}/10").replace("{n}", String(recovery))}
            testid="field-recovery"
          >
            <Slider value={[recovery]} min={1} max={10} step={1} onValueChange={(v) => setRecovery(v[0] ?? 1)} data-testid="slider-recovery" />
          </Field>
          <Field
            icon={Zap}
            label={t("dashboard.recovery.field.energy", "Energy · {n}/10").replace("{n}", String(energy))}
            testid="field-energy"
          >
            <Slider value={[energy]} min={1} max={10} step={1} onValueChange={(v) => setEnergy(v[0] ?? 1)} data-testid="slider-energy" />
          </Field>
          <div className="sm:col-span-2 flex justify-end">
            <Button
              type="button"
              onClick={() => save.mutate()}
              disabled={save.isPending}
              className="bg-cyan-400 text-black hover:bg-cyan-300"
              data-testid="button-save-checkin"
            >
              {save.isPending ? <Loader2 size={14} className="animate-spin mr-2" /> : <Check size={14} className="mr-2" />}
              {t("dashboard.recovery.save", "Save check-in")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({
  icon: Icon,
  label,
  testid,
  children,
}: {
  icon: typeof Heart;
  label: string;
  testid: string;
  children: React.ReactNode;
}) {
  return (
    <div data-testid={testid}>
      <Label className="flex items-center gap-2 text-xs uppercase tracking-wider text-white/60 mb-2">
        <Icon size={12} className="text-cyan-300" />
        {label}
      </Label>
      {children}
    </div>
  );
}
