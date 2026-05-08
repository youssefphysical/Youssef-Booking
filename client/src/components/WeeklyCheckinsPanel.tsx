import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Tooltip as UITooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  CalendarCheck,
  Flame,
  TrendingUp,
  TrendingDown,
  Minus,
  MessageCircle,
  Trash2,
  Pencil,
  AlertTriangle,
} from "lucide-react";
import {
  useMyWeeklyCheckins,
  useWeeklyCheckins,
  useCreateWeeklyCheckin,
  useUpdateWeeklyCheckin,
  useDeleteWeeklyCheckin,
  mondayOf,
  adherenceScore,
  checkinStreak,
} from "@/hooks/use-weekly-checkins";
import type { WeeklyCheckin, InsertWeeklyCheckin } from "@shared/schema";

interface Props {
  // When provided, panel is in admin mode (target client's id). When
  // omitted, panel uses /me and the signed-in user owns submissions.
  userId?: number;
  isAdmin?: boolean;
}

const SCALE_FIELDS: Array<{
  key: keyof Pick<WeeklyCheckin, "sleepQuality" | "energy" | "stress" | "hunger" | "digestion" | "mood">;
  label: string;
  goodHigh: boolean; // true => higher is better; false => lower is better
}> = [
  { key: "sleepQuality", label: "Sleep", goodHigh: true },
  { key: "energy", label: "Energy", goodHigh: true },
  { key: "mood", label: "Mood", goodHigh: true },
  { key: "digestion", label: "Digestion", goodHigh: true },
  { key: "hunger", label: "Hunger", goodHigh: true },
  { key: "stress", label: "Stress", goodHigh: false },
];

interface FormState {
  weekStart: string;
  weight: string;
  sleepQuality: number;
  energy: number;
  stress: number;
  hunger: number;
  digestion: number;
  mood: number;
  cardioAdherence: number;
  trainingAdherence: number;
  waterLitres: string;
  notes: string;
}

function emptyForm(weekStart?: string): FormState {
  return {
    weekStart: weekStart ?? mondayOf(new Date()),
    weight: "",
    sleepQuality: 7,
    energy: 7,
    stress: 4,
    hunger: 5,
    digestion: 7,
    mood: 7,
    cardioAdherence: 80,
    trainingAdherence: 90,
    waterLitres: "",
    notes: "",
  };
}

function fromRow(row: WeeklyCheckin): FormState {
  return {
    weekStart: row.weekStart,
    weight: row.weight != null ? String(row.weight) : "",
    sleepQuality: row.sleepQuality ?? 7,
    energy: row.energy ?? 7,
    stress: row.stress ?? 4,
    hunger: row.hunger ?? 5,
    digestion: row.digestion ?? 7,
    mood: row.mood ?? 7,
    cardioAdherence: row.cardioAdherence ?? 0,
    trainingAdherence: row.trainingAdherence ?? 0,
    waterLitres: row.waterLitres != null ? String(row.waterLitres) : "",
    notes: row.notes ?? "",
  };
}

function toPayload(form: FormState, userId: number): InsertWeeklyCheckin {
  const num = (s: string) => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  };
  return {
    userId,
    weekStart: form.weekStart,
    weight: num(form.weight),
    sleepQuality: form.sleepQuality,
    energy: form.energy,
    stress: form.stress,
    hunger: form.hunger,
    digestion: form.digestion,
    mood: form.mood,
    cardioAdherence: form.cardioAdherence,
    trainingAdherence: form.trainingAdherence,
    waterLitres: num(form.waterLitres),
    notes: form.notes.trim() || null,
  };
}

function ScaleSlider({
  label, value, onChange, goodHigh = true, disabled,
}: { label: string; value: number; onChange: (n: number) => void; goodHigh?: boolean; disabled?: boolean }) {
  // Color cue: emerald when value is in the "good" half, amber otherwise.
  const isGood = goodHigh ? value >= 7 : value <= 4;
  const color = isGood ? "text-emerald-300" : value === 5 || value === 6 ? "text-amber-300" : "text-orange-300";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <Label className="text-white/70 font-normal">{label}</Label>
        <span className={`font-semibold tabular-nums ${color}`}>{value}/10</span>
      </div>
      <Slider
        min={1} max={10} step={1}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? value)}
        disabled={disabled}
        data-testid={`slider-checkin-${label.toLowerCase()}`}
      />
    </div>
  );
}

function PercentSlider({
  label, value, onChange, disabled,
}: { label: string; value: number; onChange: (n: number) => void; disabled?: boolean }) {
  const color = value >= 85 ? "text-emerald-300" : value >= 60 ? "text-amber-300" : "text-orange-300";
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <Label className="text-white/70 font-normal">{label}</Label>
        <span className={`font-semibold tabular-nums ${color}`}>{value}%</span>
      </div>
      <Slider
        min={0} max={100} step={5}
        value={[value]}
        onValueChange={(v) => onChange(v[0] ?? value)}
        disabled={disabled}
        data-testid={`slider-adherence-${label.toLowerCase().replace(/\s+/g, "-")}`}
      />
    </div>
  );
}

function AdherenceBadge({ score }: { score: number | null }) {
  if (score == null) return <Badge variant="outline" className="text-white/40">—</Badge>;
  const tone =
    score >= 85 ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
    : score >= 60 ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
    : "bg-orange-500/15 text-orange-300 border-orange-500/30";
  return <Badge className={`${tone} border`} data-testid={`badge-adherence-${score}`}>{score}%</Badge>;
}

export default function WeeklyCheckinsPanel({ userId, isAdmin = false }: Props) {
  const adminMode = !!userId;
  const myQ = useMyWeeklyCheckins({ enabled: !adminMode });
  const adminQ = useWeeklyCheckins(userId, { enabled: adminMode });
  const data = (adminMode ? adminQ.data : myQ.data) ?? [];
  const isLoading = adminMode ? adminQ.isLoading : myQ.isLoading;

  const create = useCreateWeeklyCheckin();
  const update = useUpdateWeeklyCheckin(userId);
  const remove = useDeleteWeeklyCheckin(userId);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WeeklyCheckin | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [coachResponse, setCoachResponse] = useState("");
  const [coachOpen, setCoachOpen] = useState<WeeklyCheckin | null>(null);

  const sorted = useMemo(
    () => [...data].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)),
    [data]
  );
  const latest = sorted[0];
  const previous = sorted[1];
  const streak = checkinStreak(data);

  const chartRows = useMemo(() => {
    return [...data]
      .sort((a, b) => (a.weekStart < b.weekStart ? -1 : 1))
      .map((r) => ({
        week: format(parseISO(r.weekStart), "MMM d"),
        adherence: adherenceScore(r),
        weight: r.weight ?? null,
        sleep: r.sleepQuality ?? null,
        energy: r.energy ?? null,
        mood: r.mood ?? null,
      }));
  }, [data]);

  const latestAdherence = latest ? adherenceScore(latest) : null;
  const prevAdherence = previous ? adherenceScore(previous) : null;
  const trend =
    latestAdherence == null || prevAdherence == null
      ? null
      : latestAdherence - prevAdherence;

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm());
    setOpen(true);
  };
  const openEdit = (row: WeeklyCheckin) => {
    setEditing(row);
    setForm(fromRow(row));
    setOpen(true);
  };

  const submit = () => {
    const targetUserId = userId ?? 0; // self-submit endpoint forces userId on server
    if (editing) {
      const { userId: _u, weekStart: _w, ...patch } = toPayload(form, targetUserId);
      update.mutate({ id: editing.id, ...patch }, { onSuccess: () => setOpen(false) });
    } else {
      // For non-admin self submit, server rewrites userId. We still pass
      // a positive int to satisfy zod; backend ignores client-supplied
      // userId for non-admins.
      const payload = toPayload(form, targetUserId || 1);
      create.mutate(payload, { onSuccess: () => setOpen(false) });
    }
  };

  const submitCoach = () => {
    if (!coachOpen) return;
    update.mutate(
      { id: coachOpen.id, coachResponse: coachResponse.trim() || null },
      {
        onSuccess: () => {
          setCoachOpen(null);
          setCoachResponse("");
        },
      },
    );
  };

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-white/50">Latest adherence</div>
            <div className="mt-2 flex items-center gap-2">
              <AdherenceBadge score={latestAdherence} />
              {trend != null && (
                <span
                  className={`flex items-center gap-1 text-xs ${
                    trend > 0 ? "text-emerald-300" : trend < 0 ? "text-orange-300" : "text-white/50"
                  }`}
                  data-testid="text-adherence-trend"
                >
                  {trend > 0 ? <TrendingUp size={12} /> : trend < 0 ? <TrendingDown size={12} /> : <Minus size={12} />}
                  {Math.abs(trend)}%
                </span>
              )}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-white/50">Streak</div>
            <div className="mt-2 flex items-center gap-2 text-white">
              <Flame size={16} className="text-orange-300" />
              <span className="text-xl font-semibold tabular-nums" data-testid="text-checkin-streak">{streak}</span>
              <span className="text-xs text-white/50">{streak === 1 ? "week" : "weeks"}</span>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-white/50">Latest weight</div>
            <div className="mt-2 text-white text-xl font-semibold tabular-nums" data-testid="text-latest-weight">
              {latest?.weight != null ? `${latest.weight} kg` : "—"}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="text-[11px] uppercase tracking-widest text-white/50">Last check-in</div>
            <div className="mt-2 text-white text-sm" data-testid="text-latest-week">
              {latest ? format(parseISO(latest.weekStart), "MMM d, yyyy") : "Never"}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action row */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="text-sm text-white/60">
          {adminMode
            ? "Read this client's weekly check-ins and respond as coach."
            : "Submit a weekly check-in. One per week — keeps your streak alive."}
        </div>
        <div className="flex items-center gap-2">
          {!adminMode && (
            <Button onClick={openCreate} data-testid="button-new-checkin">
              <CalendarCheck size={14} className="mr-2" />
              New check-in
            </Button>
          )}
          {adminMode && isAdmin && (
            <Button variant="outline" onClick={openCreate} data-testid="button-admin-new-checkin">
              <CalendarCheck size={14} className="mr-2" />
              Add for client
            </Button>
          )}
        </div>
      </div>

      {/* Trend chart */}
      {chartRows.length >= 2 && (
        <Card className="bg-white/5 border-white/10">
          <CardContent className="p-4">
            <div className="mb-3 text-sm text-white/70">Adherence + wellbeing trend</div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff20" />
                  <XAxis dataKey="week" stroke="#ffffff70" fontSize={11} />
                  <YAxis stroke="#ffffff70" fontSize={11} domain={[0, 100]} />
                  <Tooltip
                    contentStyle={{ background: "#0b1220", border: "1px solid #ffffff20", color: "white" }}
                    labelStyle={{ color: "white" }}
                  />
                  <Legend wrapperStyle={{ color: "#ffffff90", fontSize: 11 }} />
                  <Line type="monotone" dataKey="adherence" stroke="#60a5fa" strokeWidth={2} dot={false} name="Adherence %" />
                  <Line type="monotone" dataKey="sleep" stroke="#34d399" strokeWidth={1.5} dot={false} name="Sleep /10" />
                  <Line type="monotone" dataKey="energy" stroke="#fbbf24" strokeWidth={1.5} dot={false} name="Energy /10" />
                  <Line type="monotone" dataKey="mood" stroke="#f472b6" strokeWidth={1.5} dot={false} name="Mood /10" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* History */}
      <Card className="bg-white/5 border-white/10">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-white/50 text-sm">Loading…</div>
          ) : sorted.length === 0 ? (
            <div className="p-10 text-center">
              <CalendarCheck size={28} className="mx-auto text-white/30 mb-3" />
              <div className="text-white/70 text-sm">No check-ins yet.</div>
              <div className="text-white/40 text-xs mt-1">
                {adminMode ? "Client hasn't submitted any check-ins." : "Submit your first check-in to start a streak."}
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {sorted.map((row) => {
                const score = adherenceScore(row);
                const pendingCoach = !row.coachResponse;
                return (
                  <div key={row.id} className="p-4" data-testid={`row-checkin-${row.id}`}>
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div>
                        <div className="text-white text-sm font-medium">
                          Week of {format(parseISO(row.weekStart), "MMM d, yyyy")}
                        </div>
                        <div className="text-white/40 text-xs mt-0.5">
                          Submitted {format(new Date(row.createdAt), "MMM d, p")}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <AdherenceBadge score={score} />
                        {row.weight != null && (
                          <Badge variant="outline" className="text-white/70 border-white/20">{row.weight} kg</Badge>
                        )}
                        {isAdmin && pendingCoach && (
                          <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <AlertTriangle size={10} className="mr-1" />Pending
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Compact scale grid */}
                    <div className="mt-3 grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {SCALE_FIELDS.map((f) => {
                        const v = row[f.key];
                        return (
                          <TooltipProvider key={f.key}>
                            <UITooltip>
                              <TooltipTrigger asChild>
                                <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5 text-center">
                                  <div className="text-[10px] uppercase tracking-wider text-white/40">{f.label}</div>
                                  <div className="text-sm text-white tabular-nums">{v ?? "—"}</div>
                                </div>
                              </TooltipTrigger>
                              <TooltipContent>{f.label}: {v ?? "not reported"} / 10</TooltipContent>
                            </UITooltip>
                          </TooltipProvider>
                        );
                      })}
                    </div>

                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                      <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-white/40">Training</div>
                        <div className="text-white tabular-nums">{row.trainingAdherence ?? "—"}{row.trainingAdherence != null ? "%" : ""}</div>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-white/40">Cardio</div>
                        <div className="text-white tabular-nums">{row.cardioAdherence ?? "—"}{row.cardioAdherence != null ? "%" : ""}</div>
                      </div>
                      <div className="rounded-md border border-white/10 bg-white/[0.02] px-2 py-1.5">
                        <div className="text-[10px] uppercase tracking-wider text-white/40">Water</div>
                        <div className="text-white tabular-nums">{row.waterLitres != null ? `${row.waterLitres} L` : "—"}</div>
                      </div>
                    </div>

                    {row.notes && (
                      <div className="mt-3 rounded-md border border-white/10 bg-white/[0.02] p-3">
                        <div className="text-[10px] uppercase tracking-wider text-white/40 mb-1">Client notes</div>
                        <div className="text-sm text-white/80 whitespace-pre-wrap">{row.notes}</div>
                      </div>
                    )}

                    {row.coachResponse && (
                      <div className="mt-3 rounded-md border border-blue-500/20 bg-blue-500/5 p-3">
                        <div className="text-[10px] uppercase tracking-wider text-blue-300 mb-1 flex items-center gap-1">
                          <MessageCircle size={10} /> Coach response
                          {row.coachRespondedAt && (
                            <span className="ml-2 text-white/40 lowercase tracking-normal">
                              {format(new Date(row.coachRespondedAt), "MMM d, p")}
                            </span>
                          )}
                        </div>
                        <div className="text-sm text-white/90 whitespace-pre-wrap">{row.coachResponse}</div>
                      </div>
                    )}

                    {/* Actions */}
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {(!adminMode || isAdmin) && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-white/70 hover:text-white"
                          onClick={() => openEdit(row)}
                          data-testid={`button-edit-checkin-${row.id}`}
                        >
                          <Pencil size={12} className="mr-1.5" /> Edit
                        </Button>
                      )}
                      {isAdmin && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-blue-300 hover:text-blue-200"
                            onClick={() => {
                              setCoachOpen(row);
                              setCoachResponse(row.coachResponse ?? "");
                            }}
                            data-testid={`button-respond-checkin-${row.id}`}
                          >
                            <MessageCircle size={12} className="mr-1.5" />
                            {row.coachResponse ? "Edit response" : "Respond"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-red-400 hover:text-red-300 ml-auto"
                            onClick={() => {
                              if (confirm("Delete this check-in? This cannot be undone.")) remove.mutate(row.id);
                            }}
                            data-testid={`button-delete-checkin-${row.id}`}
                          >
                            <Trash2 size={12} />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Submit / edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl bg-[#0b1220] border-white/10 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editing ? "Edit check-in" : "New weekly check-in"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 py-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-white/70 text-xs">Week of (Monday)</Label>
                <Input
                  type="date"
                  value={form.weekStart}
                  onChange={(e) => setForm((f) => ({ ...f, weekStart: e.target.value }))}
                  disabled={!!editing}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  data-testid="input-checkin-week"
                />
              </div>
              <div>
                <Label className="text-white/70 text-xs">Weight (kg, optional)</Label>
                <Input
                  type="number" step="0.1" placeholder="e.g. 78.4"
                  value={form.weight}
                  onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white mt-1"
                  data-testid="input-checkin-weight"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-2">
              <ScaleSlider label="Sleep" value={form.sleepQuality} onChange={(n) => setForm((f) => ({ ...f, sleepQuality: n }))} goodHigh />
              <ScaleSlider label="Energy" value={form.energy} onChange={(n) => setForm((f) => ({ ...f, energy: n }))} goodHigh />
              <ScaleSlider label="Stress" value={form.stress} onChange={(n) => setForm((f) => ({ ...f, stress: n }))} goodHigh={false} />
              <ScaleSlider label="Hunger" value={form.hunger} onChange={(n) => setForm((f) => ({ ...f, hunger: n }))} goodHigh />
              <ScaleSlider label="Digestion" value={form.digestion} onChange={(n) => setForm((f) => ({ ...f, digestion: n }))} goodHigh />
              <ScaleSlider label="Mood" value={form.mood} onChange={(n) => setForm((f) => ({ ...f, mood: n }))} goodHigh />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4 pt-2 border-t border-white/10">
              <PercentSlider label="Training adherence" value={form.trainingAdherence} onChange={(n) => setForm((f) => ({ ...f, trainingAdherence: n }))} />
              <PercentSlider label="Cardio adherence" value={form.cardioAdherence} onChange={(n) => setForm((f) => ({ ...f, cardioAdherence: n }))} />
            </div>

            <div>
              <Label className="text-white/70 text-xs">Water (L/day average, optional)</Label>
              <Input
                type="number" step="0.1" placeholder="e.g. 3.0"
                value={form.waterLitres}
                onChange={(e) => setForm((f) => ({ ...f, waterLitres: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1 max-w-[200px]"
                data-testid="input-checkin-water"
              />
            </div>

            <div>
              <Label className="text-white/70 text-xs">Notes for your coach (optional)</Label>
              <Textarea
                rows={3}
                placeholder="Anything you want me to know — wins, struggles, questions…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="bg-white/5 border-white/10 text-white mt-1"
                data-testid="input-checkin-notes"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button
              onClick={submit}
              disabled={create.isPending || update.isPending}
              data-testid="button-submit-checkin"
            >
              {editing ? "Save changes" : "Submit check-in"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Coach response dialog */}
      <Dialog open={!!coachOpen} onOpenChange={(o) => !o && setCoachOpen(null)}>
        <DialogContent className="max-w-lg bg-[#0b1220] border-white/10">
          <DialogHeader>
            <DialogTitle className="text-white">Coach response</DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <Textarea
              rows={6}
              placeholder="Acknowledge the win, address the friction, set the next focus…"
              value={coachResponse}
              onChange={(e) => setCoachResponse(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
              data-testid="input-coach-response"
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setCoachOpen(null)}>Cancel</Button>
            <Button onClick={submitCoach} disabled={update.isPending} data-testid="button-submit-coach-response">
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
