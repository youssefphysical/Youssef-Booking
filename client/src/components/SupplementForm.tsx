import { useEffect, useState } from "react";
import {
  SUPPLEMENT_CATEGORIES,
  SUPPLEMENT_CATEGORY_LABELS_EN,
  SUPPLEMENT_UNITS,
  SUPPLEMENT_TIMINGS,
  SUPPLEMENT_TIMING_LABELS_EN,
  type SupplementCategory,
  type SupplementUnit,
  type SupplementTiming,
} from "@shared/schema";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";

// Shared "Supplement Card" form fields, used by:
//   - admin library entries (defaults)
//   - admin stack-builder rows
//   - admin per-client assignment rows
//
// We keep ONE set of inputs so the data shape stays consistent and
// snapshot-on-assign feels frictionless.

export interface SupplementFormValue {
  name: string;
  brand?: string | null;
  category: SupplementCategory;
  dosage: number;
  unit: SupplementUnit;
  timings: SupplementTiming[];
  trainingDayOnly: boolean;
  restDayOnly: boolean;
  notes?: string | null;
  warnings?: string | null;
}

export function emptySupplementForm(): SupplementFormValue {
  return {
    name: "",
    brand: "",
    category: "other",
    dosage: 1,
    unit: "capsule",
    timings: ["morning"],
    trainingDayOnly: false,
    restDayOnly: false,
    notes: "",
    warnings: "",
  };
}

export function SupplementFormFields({
  value,
  onChange,
  testIdPrefix = "supp",
  showWarnings = true,
}: {
  value: SupplementFormValue;
  onChange: (next: SupplementFormValue) => void;
  testIdPrefix?: string;
  showWarnings?: boolean;
}) {
  const set = <K extends keyof SupplementFormValue>(k: K, v: SupplementFormValue[K]) =>
    onChange({ ...value, [k]: v });

  // Guard: training-only and rest-only are mutually exclusive. We don't
  // hard-error in the UI; we just toggle the other one off when one is
  // turned on, so the trainer can flick between modes painlessly.
  const setTrain = (b: boolean) => onChange({ ...value, trainingDayOnly: b, restDayOnly: b ? false : value.restDayOnly });
  const setRest = (b: boolean) => onChange({ ...value, restDayOnly: b, trainingDayOnly: b ? false : value.trainingDayOnly });

  const toggleTiming = (slot: SupplementTiming) => {
    const has = value.timings.includes(slot);
    const next = has ? value.timings.filter((t) => t !== slot) : [...value.timings, slot];
    set("timings", next);
  };

  return (
    <div className="space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">Name *</Label>
          <Input
            value={value.name}
            onChange={(e) => set("name", e.target.value)}
            placeholder="Whey Protein"
            data-testid={`${testIdPrefix}-input-name`}
          />
        </div>
        <div>
          <Label className="text-xs">Brand</Label>
          <Input
            value={value.brand ?? ""}
            onChange={(e) => set("brand", e.target.value)}
            placeholder="Optional"
            data-testid={`${testIdPrefix}-input-brand`}
          />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <div>
          <Label className="text-xs">Category</Label>
          <Select value={value.category} onValueChange={(v) => set("category", v as SupplementCategory)}>
            <SelectTrigger data-testid={`${testIdPrefix}-select-category`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUPPLEMENT_CATEGORIES.map((c) => (
                <SelectItem key={c} value={c}>{SUPPLEMENT_CATEGORY_LABELS_EN[c]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Dosage</Label>
          <Input
            type="number"
            min={0}
            step={0.01}
            value={Number.isFinite(value.dosage) ? value.dosage : 0}
            onChange={(e) => set("dosage", Number(e.target.value) || 0)}
            data-testid={`${testIdPrefix}-input-dosage`}
          />
        </div>
        <div>
          <Label className="text-xs">Unit</Label>
          <Select value={value.unit} onValueChange={(v) => set("unit", v as SupplementUnit)}>
            <SelectTrigger data-testid={`${testIdPrefix}-select-unit`}><SelectValue /></SelectTrigger>
            <SelectContent>
              {SUPPLEMENT_UNITS.map((u) => (<SelectItem key={u} value={u}>{u}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label className="text-xs">Timing — tap the slots to take it</Label>
        <div className="flex flex-wrap gap-2 mt-2">
          {SUPPLEMENT_TIMINGS.map((slot) => {
            const active = value.timings.includes(slot);
            return (
              <button
                key={slot}
                type="button"
                onClick={() => toggleTiming(slot)}
                data-testid={`${testIdPrefix}-timing-${slot}`}
                className={`text-xs h-8 px-3 rounded-full border transition ${
                  active
                    ? "bg-primary/20 border-primary/40 text-primary"
                    : "bg-white/[0.03] border-white/10 text-muted-foreground hover:border-white/20"
                }`}
              >
                {SUPPLEMENT_TIMING_LABELS_EN[slot]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2.5">
          <div>
            <Label className="text-xs">Training days only</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">Skip on rest days</p>
          </div>
          <Switch
            checked={value.trainingDayOnly}
            onCheckedChange={setTrain}
            data-testid={`${testIdPrefix}-switch-train`}
          />
        </div>
        <div className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2.5">
          <div>
            <Label className="text-xs">Rest days only</Label>
            <p className="text-[10px] text-muted-foreground mt-0.5">Skip on training days</p>
          </div>
          <Switch
            checked={value.restDayOnly}
            onCheckedChange={setRest}
            data-testid={`${testIdPrefix}-switch-rest`}
          />
        </div>
      </div>
      {!value.trainingDayOnly && !value.restDayOnly && (
        <p className="text-[10px] text-muted-foreground -mt-2 pl-1">Both off → take every day.</p>
      )}

      <div>
        <Label className="text-xs">Coach notes (visible to client)</Label>
        <Textarea
          value={value.notes ?? ""}
          onChange={(e) => set("notes", e.target.value)}
          rows={2}
          placeholder="e.g. Take with 200ml water"
          data-testid={`${testIdPrefix}-input-notes`}
        />
      </div>

      {showWarnings && (
        <div>
          <Label className="text-xs flex items-center gap-1.5">
            <Badge variant="outline" className="text-[10px] uppercase tracking-wider border-amber-500/30 text-amber-300 bg-amber-500/5">Warning</Badge>
            <span className="text-muted-foreground">Visible to client</span>
          </Label>
          <Textarea
            value={value.warnings ?? ""}
            onChange={(e) => set("warnings", e.target.value)}
            rows={2}
            placeholder="e.g. Do not exceed 5g/day. Avoid if pregnant."
            data-testid={`${testIdPrefix}-input-warnings`}
          />
        </div>
      )}
    </div>
  );
}

// Convenience: load value from any row that already has the snapshot fields.
export function rowToSupplementForm(row: Partial<SupplementFormValue> & { defaultDosage?: number; defaultUnit?: string; defaultTimings?: string[]; defaultTrainingDayOnly?: boolean; defaultRestDayOnly?: boolean }): SupplementFormValue {
  return {
    name: row.name || "",
    brand: row.brand ?? "",
    category: (row.category ?? "other") as SupplementCategory,
    dosage: row.dosage ?? row.defaultDosage ?? 1,
    unit: (row.unit ?? row.defaultUnit ?? "capsule") as SupplementUnit,
    timings: ((row.timings ?? row.defaultTimings ?? []) as string[]).filter((t) =>
      (SUPPLEMENT_TIMINGS as readonly string[]).includes(t),
    ) as SupplementTiming[],
    trainingDayOnly: row.trainingDayOnly ?? row.defaultTrainingDayOnly ?? false,
    restDayOnly: row.restDayOnly ?? row.defaultRestDayOnly ?? false,
    notes: row.notes ?? "",
    warnings: row.warnings ?? "",
  };
}
