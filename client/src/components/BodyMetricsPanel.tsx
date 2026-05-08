import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import {
  TrendingDown, TrendingUp, Minus, Plus, Pencil, Trash2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { BODY_METRIC_FIELDS, type BodyMetric, type BodyMetricField } from "@shared/schema";
import {
  useBodyMetrics, useCreateBodyMetric, useUpdateBodyMetric, useDeleteBodyMetric,
} from "@/hooks/use-body-metrics";

interface FieldMeta {
  key: BodyMetricField;
  label: string;
  unit: string;
  // Lower is better for body fat / waist; higher is better for chest/arms etc.
  // null = no opinion (weight depends on the goal).
  goodDirection: "down" | "up" | null;
}

const FIELDS: FieldMeta[] = [
  { key: "weight", label: "Weight", unit: "kg", goodDirection: null },
  { key: "bodyFat", label: "Body Fat", unit: "%", goodDirection: "down" },
  { key: "neck", label: "Neck", unit: "cm", goodDirection: null },
  { key: "shoulders", label: "Shoulders", unit: "cm", goodDirection: "up" },
  { key: "chest", label: "Chest", unit: "cm", goodDirection: "up" },
  { key: "arms", label: "Arms", unit: "cm", goodDirection: "up" },
  { key: "waist", label: "Waist", unit: "cm", goodDirection: "down" },
  { key: "hips", label: "Hips", unit: "cm", goodDirection: null },
  { key: "thighs", label: "Thighs", unit: "cm", goodDirection: "up" },
  { key: "calves", label: "Calves", unit: "cm", goodDirection: "up" },
];

const todayISO = () => new Date().toISOString().slice(0, 10);

interface FormState {
  recordedOn: string;
  notes: string;
  // string-typed for the input; converted to number on submit.
  values: Record<BodyMetricField, string>;
}

const emptyForm = (): FormState => ({
  recordedOn: todayISO(),
  notes: "",
  values: BODY_METRIC_FIELDS.reduce(
    (acc, k) => ({ ...acc, [k]: "" }),
    {} as Record<BodyMetricField, string>,
  ),
});

function fromRow(row: BodyMetric): FormState {
  return {
    recordedOn: row.recordedOn ?? todayISO(),
    notes: row.notes ?? "",
    values: BODY_METRIC_FIELDS.reduce((acc, k) => {
      const v = (row as any)[k];
      acc[k] = v == null ? "" : String(v);
      return acc;
    }, {} as Record<BodyMetricField, string>),
  };
}

function toPayload(state: FormState) {
  const payload: any = {
    recordedOn: state.recordedOn,
    notes: state.notes.trim() || null,
  };
  for (const k of BODY_METRIC_FIELDS) {
    const raw = state.values[k].trim();
    if (raw === "") {
      payload[k] = null;
    } else {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0) payload[k] = n;
    }
  }
  return payload;
}

interface Props {
  userId: number;
  /** When false, hides admin-only mutation surfaces (Add/Edit/Delete). */
  canEdit: boolean;
}

export default function BodyMetricsPanel({ userId, canEdit }: Props) {
  const { data: rows = [], isLoading } = useBodyMetrics(userId);
  const create = useCreateBodyMetric();
  const update = useUpdateBodyMetric(userId);
  const remove = useDeleteBodyMetric(userId);

  const [chartField, setChartField] = useState<BodyMetricField>("weight");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BodyMetric | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  // Sorted ascending for chart, descending for table.
  const sorted = useMemo(() => [...rows].sort(
    (a, b) => (a.recordedOn || "").localeCompare(b.recordedOn || ""),
  ), [rows]);

  const chartData = useMemo(() => sorted
    .filter((r) => (r as any)[chartField] != null)
    .map((r) => ({
      date: r.recordedOn,
      label: r.recordedOn ? format(parseISO(r.recordedOn), "MMM d") : "",
      value: Number((r as any)[chartField]),
    })),
    [sorted, chartField]);

  // Trend = compare latest value to first value in the chart series.
  const trend = useMemo(() => {
    if (chartData.length < 2) return null;
    const first = chartData[0].value;
    const last = chartData[chartData.length - 1].value;
    const delta = last - first;
    if (Math.abs(delta) < 0.001) return { delta: 0, direction: "flat" as const };
    return { delta, direction: delta > 0 ? ("up" as const) : ("down" as const) };
  }, [chartData]);

  const meta = FIELDS.find((f) => f.key === chartField)!;
  const trendIsGood = (() => {
    if (!trend || meta.goodDirection === null || trend.direction === "flat") return null;
    if (trend.direction === "up" && meta.goodDirection === "up") return true;
    if (trend.direction === "down" && meta.goodDirection === "down") return true;
    return false;
  })();

  const openAdd = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };
  const openEdit = (row: BodyMetric) => {
    setEditing(row);
    setForm(fromRow(row));
    setOpen(true);
  };

  const submit = async () => {
    const payload = toPayload(form);
    // Reject completely empty rows.
    const hasValue = BODY_METRIC_FIELDS.some((k) => payload[k] != null);
    if (!hasValue) return;
    if (editing) {
      await update.mutateAsync({ id: editing.id, ...payload });
    } else {
      await create.mutateAsync({ userId, ...payload });
    }
    setOpen(false);
  };

  const desc = useMemo(() => [...sorted].reverse(), [sorted]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-display font-bold">Body Metrics</h2>
          <p className="text-xs text-muted-foreground">
            Weight, body-fat &amp; circumference measurements over time.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openAdd} data-testid="button-add-body-metric">
            <Plus className="mr-1 h-4 w-4" /> Add entry
          </Button>
        )}
      </div>

      {/* Chart card */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Tracking</Label>
            <Select value={chartField} onValueChange={(v) => setChartField(v as BodyMetricField)}>
              <SelectTrigger className="w-[180px]" data-testid="select-chart-field">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELDS.map((f) => (
                  <SelectItem key={f.key} value={f.key} data-testid={`option-chart-${f.key}`}>
                    {f.label} ({f.unit})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {trend && (
            <div className="flex items-center gap-2 text-sm" data-testid="status-body-trend">
              {trend.direction === "flat" ? (
                <Minus className="h-4 w-4 text-muted-foreground" />
              ) : trend.direction === "up" ? (
                <TrendingUp className={`h-4 w-4 ${trendIsGood === true ? "text-emerald-500" : trendIsGood === false ? "text-red-500" : "text-muted-foreground"}`} />
              ) : (
                <TrendingDown className={`h-4 w-4 ${trendIsGood === true ? "text-emerald-500" : trendIsGood === false ? "text-red-500" : "text-muted-foreground"}`} />
              )}
              <span className="font-medium">
                {trend.delta > 0 ? "+" : ""}{trend.delta.toFixed(1)} {meta.unit}
              </span>
              <span className="text-muted-foreground text-xs">
                across {chartData.length} entries
              </span>
            </div>
          )}
        </div>
        <div className="h-[240px]">
          {isLoading ? (
            <div className="h-full flex items-center justify-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              No {meta.label.toLowerCase()} entries yet.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" />
                <YAxis tick={{ fontSize: 11 }} stroke="hsl(var(--muted-foreground))" domain={["auto", "auto"]} />
                <Tooltip
                  contentStyle={{
                    background: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: any) => [`${v} ${meta.unit}`, meta.label]}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* History table */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b">
          <h3 className="text-sm font-semibold">History</h3>
          <p className="text-xs text-muted-foreground">{desc.length} entries</p>
        </div>
        {desc.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            No entries yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground bg-muted/30">
                <tr>
                  <th className="text-left px-3 py-2">Date</th>
                  {FIELDS.map((f) => (
                    <th key={f.key} className="text-right px-2 py-2 whitespace-nowrap">
                      {f.label}
                    </th>
                  ))}
                  {canEdit && <th className="px-2 py-2 w-20" />}
                </tr>
              </thead>
              <tbody>
                {desc.map((r) => (
                  <tr key={r.id} className="border-t" data-testid={`row-body-metric-${r.id}`}>
                    <td className="px-3 py-2 whitespace-nowrap font-medium">
                      {r.recordedOn ? format(parseISO(r.recordedOn), "MMM d, yyyy") : "—"}
                    </td>
                    {FIELDS.map((f) => {
                      const v = (r as any)[f.key];
                      return (
                        <td key={f.key} className="text-right px-2 py-2 tabular-nums" data-testid={`cell-${f.key}-${r.id}`}>
                          {v == null ? <span className="text-muted-foreground">—</span> : `${Number(v).toFixed(1)}`}
                        </td>
                      );
                    })}
                    {canEdit && (
                      <td className="px-2 py-2 text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => openEdit(r)}
                            data-testid={`button-edit-body-metric-${r.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button
                                size="icon" variant="ghost"
                                data-testid={`button-delete-body-metric-${r.id}`}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-red-500" />
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete entry?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently removes the body-metric entry from{" "}
                                  {r.recordedOn ? format(parseISO(r.recordedOn), "MMM d, yyyy") : "this date"}.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove.mutate(r.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {desc[0]?.notes && (
          <div className="px-4 py-3 border-t text-xs text-muted-foreground">
            <Badge variant="outline" className="mr-2">Latest note</Badge>
            {desc[0].notes}
          </div>
        )}
      </Card>

      {/* Add/Edit dialog */}
      {canEdit && (
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editing ? "Edit body metric entry" : "Log body metrics"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="bm-date">Date</Label>
                  <Input
                    id="bm-date" type="date" value={form.recordedOn}
                    onChange={(e) => setForm({ ...form, recordedOn: e.target.value })}
                    data-testid="input-body-metric-date"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {FIELDS.map((f) => (
                  <div key={f.key}>
                    <Label htmlFor={`bm-${f.key}`} className="text-xs">
                      {f.label} <span className="text-muted-foreground">({f.unit})</span>
                    </Label>
                    <Input
                      id={`bm-${f.key}`}
                      type="number" step="0.1" min="0"
                      placeholder="—"
                      value={form.values[f.key]}
                      onChange={(e) =>
                        setForm({
                          ...form,
                          values: { ...form.values, [f.key]: e.target.value },
                        })
                      }
                      data-testid={`input-body-${f.key}`}
                    />
                  </div>
                ))}
              </div>
              <div>
                <Label htmlFor="bm-notes">Notes</Label>
                <Textarea
                  id="bm-notes" rows={3}
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Optional context — measurement conditions, time of day, etc."
                  data-testid="input-body-notes"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button
                onClick={submit}
                disabled={create.isPending || update.isPending}
                data-testid="button-save-body-metric"
              >
                {(create.isPending || update.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editing ? "Save changes" : "Log entry"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
