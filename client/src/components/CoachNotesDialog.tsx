import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Loader2, Activity, Heart, Moon, ListChecks, EyeOff, Eye } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface CoachNotesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  booking: any;
}

interface FormState {
  sessionEnergy: number | null;
  sessionPerformance: number | null;
  sessionSleep: number | null;
  sessionAdherence: number | null;
  sessionCardio: string;
  sessionPainInjury: string;
  privateCoachNotes: string;
  clientVisibleCoachNotes: string;
}

const empty = (b: any): FormState => ({
  sessionEnergy: b?.sessionEnergy ?? null,
  sessionPerformance: b?.sessionPerformance ?? null,
  sessionSleep: b?.sessionSleep ?? null,
  sessionAdherence: b?.sessionAdherence ?? null,
  sessionCardio: b?.sessionCardio ?? "",
  sessionPainInjury: b?.sessionPainInjury ?? "",
  privateCoachNotes: b?.privateCoachNotes ?? "",
  clientVisibleCoachNotes: b?.clientVisibleCoachNotes ?? "",
});

function ScaleField({
  label,
  icon,
  value,
  onChange,
  testId,
}: {
  label: string;
  icon: React.ReactNode;
  value: number | null;
  onChange: (v: number | null) => void;
  testId: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <Label className="text-xs flex items-center gap-1.5">
          {icon}
          {label}
        </Label>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold tabular-nums w-8 text-right" data-testid={`${testId}-value`}>
            {value ?? "—"}
          </span>
          {value !== null && (
            <button
              type="button"
              onClick={() => onChange(null)}
              className="text-[10px] uppercase tracking-wider text-white/40 hover:text-white/70"
            >
              clear
            </button>
          )}
        </div>
      </div>
      <Slider
        min={1}
        max={10}
        step={1}
        value={[value ?? 5]}
        onValueChange={(v) => onChange(v[0] ?? null)}
        data-testid={testId}
      />
    </div>
  );
}

export default function CoachNotesDialog({ open, onOpenChange, booking }: CoachNotesDialogProps) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [form, setForm] = useState<FormState>(() => empty(booking));

  useEffect(() => {
    if (open) setForm(empty(booking));
  }, [open, booking?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        sessionEnergy: form.sessionEnergy,
        sessionPerformance: form.sessionPerformance,
        sessionSleep: form.sessionSleep,
        sessionAdherence: form.sessionAdherence,
        sessionCardio: form.sessionCardio.trim() || null,
        sessionPainInjury: form.sessionPainInjury.trim() || null,
        privateCoachNotes: form.privateCoachNotes.trim() || null,
        clientVisibleCoachNotes: form.clientVisibleCoachNotes.trim() || null,
      };
      const res = await apiRequest("PATCH", `/api/bookings/${booking.id}`, payload);
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/bookings"] });
      toast({ title: "Coach notes saved" });
      onOpenChange(false);
    },
    onError: (e: any) =>
      toast({ title: "Save failed", description: e?.message || "Try again", variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Log session</DialogTitle>
          <DialogDescription className="text-xs text-white/50">
            Capture how the session went. Private notes stay admin-only; visible notes appear on the client's booking card.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-2">
          <div className="grid sm:grid-cols-2 gap-5">
            <ScaleField
              label="Energy"
              icon={<Activity size={12} />}
              value={form.sessionEnergy}
              onChange={(v) => setForm((f) => ({ ...f, sessionEnergy: v }))}
              testId="slider-energy"
            />
            <ScaleField
              label="Performance"
              icon={<Heart size={12} />}
              value={form.sessionPerformance}
              onChange={(v) => setForm((f) => ({ ...f, sessionPerformance: v }))}
              testId="slider-performance"
            />
            <ScaleField
              label="Sleep (last night)"
              icon={<Moon size={12} />}
              value={form.sessionSleep}
              onChange={(v) => setForm((f) => ({ ...f, sessionSleep: v }))}
              testId="slider-sleep"
            />
            <ScaleField
              label="Adherence (week)"
              icon={<ListChecks size={12} />}
              value={form.sessionAdherence}
              onChange={(v) => setForm((f) => ({ ...f, sessionAdherence: v }))}
              testId="slider-adherence"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Cardio performed</Label>
            <Input
              value={form.sessionCardio}
              onChange={(e) => setForm((f) => ({ ...f, sessionCardio: e.target.value }))}
              placeholder="e.g. 20 min stairmaster, level 8"
              className="bg-white/5 border-white/10"
              data-testid="input-cardio"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Pain / injury</Label>
            <Input
              value={form.sessionPainInjury}
              onChange={(e) => setForm((f) => ({ ...f, sessionPainInjury: e.target.value }))}
              placeholder="e.g. Mild left knee discomfort on lunges"
              className="bg-white/5 border-white/10"
              data-testid="input-pain-injury"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5 text-cyan-300/90">
              <EyeOff size={12} /> Private coach notes (admin-only)
            </Label>
            <Textarea
              rows={3}
              value={form.privateCoachNotes}
              onChange={(e) => setForm((f) => ({ ...f, privateCoachNotes: e.target.value }))}
              placeholder="Form cues, programming notes, things to watch — never shown to the client."
              className="bg-white/5 border-cyan-500/20"
              data-testid="textarea-private-notes"
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs flex items-center gap-1.5 text-blue-300/90">
              <Eye size={12} /> Visible to client
            </Label>
            <Textarea
              rows={3}
              value={form.clientVisibleCoachNotes}
              onChange={(e) => setForm((f) => ({ ...f, clientVisibleCoachNotes: e.target.value }))}
              placeholder="Encouragement, takeaways, focus for next session — surfaces on the client's booking card."
              className="bg-white/5 border-blue-500/20"
              data-testid="textarea-client-visible-notes"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-coach-cancel">
            Cancel
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid="button-coach-save">
            {save.isPending && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            Save notes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
