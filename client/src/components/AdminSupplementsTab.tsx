import { useState } from "react";
import { Pill, Plus, Layers, Trash2, Edit3, AlertTriangle, Pause, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  useClientSupplements,
  useCreateClientSupplement,
  useUpdateClientSupplement,
  useDeleteClientSupplement,
  useApplyStackToClient,
  useSupplementStacks,
  useSupplements,
} from "@/hooks/use-supplements";
import {
  SupplementFormFields,
  emptySupplementForm,
  rowToSupplementForm,
  type SupplementFormValue,
} from "@/components/SupplementForm";
import {
  SUPPLEMENT_CATEGORY_LABELS_EN,
  SUPPLEMENT_TIMING_LABELS_EN,
  type ClientSupplement,
  type Supplement,
} from "@shared/schema";

export function AdminSupplementsTab({ userId }: { userId: number }) {
  const { data: items = [], isLoading } = useClientSupplements(userId);
  const remove = useDeleteClientSupplement(userId);
  const update = useUpdateClientSupplement(userId);
  const [editing, setEditing] = useState<ClientSupplement | "new" | null>(null);
  const [stackPickerOpen, setStackPickerOpen] = useState(false);

  const togglePause = (it: ClientSupplement) =>
    update.mutate({ id: it.id, status: it.status === "active" ? "paused" : "active" } as any);

  const grouped = groupByStatus(items);

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-white/5 bg-card/60 p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Pill size={16} className="text-primary" />
            <h3 className="font-display text-lg font-semibold">Supplements</h3>
            <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setStackPickerOpen(true)} data-testid="button-apply-stack">
              <Layers size={13} className="mr-1.5" /> Apply stack
            </Button>
            <Button size="sm" onClick={() => setEditing("new")} data-testid="button-add-supplement">
              <Plus size={13} className="mr-1.5" /> Add
            </Button>
          </div>
        </div>

        {isLoading ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Loading…</p>
        ) : items.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-white/10 rounded-2xl">
            <Pill size={28} className="mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground mb-4">No supplements assigned yet.</p>
            <div className="flex gap-2 justify-center">
              <Button size="sm" variant="outline" onClick={() => setStackPickerOpen(true)}>
                <Layers size={13} className="mr-1.5" /> Apply stack
              </Button>
              <Button size="sm" onClick={() => setEditing("new")}>
                <Plus size={13} className="mr-1.5" /> Add manually
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {grouped.active.length > 0 && (
              <SupplementGroup title="Active" items={grouped.active} onEdit={setEditing} onRemove={(id) => remove.mutate(id)} onTogglePause={togglePause} />
            )}
            {grouped.paused.length > 0 && (
              <SupplementGroup title="Paused" items={grouped.paused} onEdit={setEditing} onRemove={(id) => remove.mutate(id)} onTogglePause={togglePause} />
            )}
            {grouped.stopped.length > 0 && (
              <SupplementGroup title="Stopped" items={grouped.stopped} onEdit={setEditing} onRemove={(id) => remove.mutate(id)} onTogglePause={togglePause} />
            )}
          </div>
        )}
      </div>

      <ClientSupplementDialog
        open={editing !== null}
        initial={editing && editing !== "new" ? editing : null}
        userId={userId}
        onClose={() => setEditing(null)}
      />

      <ApplyStackDialog
        open={stackPickerOpen}
        userId={userId}
        existingCount={items.length}
        onClose={() => setStackPickerOpen(false)}
      />
    </div>
  );
}

function groupByStatus(items: ClientSupplement[]) {
  return {
    active: items.filter((i) => i.status === "active"),
    paused: items.filter((i) => i.status === "paused"),
    stopped: items.filter((i) => i.status === "stopped"),
  };
}

function SupplementGroup({
  title,
  items,
  onEdit,
  onRemove,
  onTogglePause,
}: {
  title: string;
  items: ClientSupplement[];
  onEdit: (it: ClientSupplement) => void;
  onRemove: (id: number) => void;
  onTogglePause: (it: ClientSupplement) => void;
}) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{title}</p>
      <ul className="space-y-2">
        {items.map((it) => (
          <li
            key={it.id}
            className="rounded-2xl border border-white/5 bg-white/[0.02] p-3 flex items-start gap-3"
            data-testid={`row-client-supp-${it.id}`}
          >
            <div className="size-8 rounded-lg bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
              <Pill size={14} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="font-semibold text-sm leading-tight">
                    {it.name}
                    {it.brand && <span className="text-muted-foreground font-normal"> · {it.brand}</span>}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {it.dosage}{it.unit}
                    {it.timings.length > 0 && ` · ${it.timings.map((t) => SUPPLEMENT_TIMING_LABELS_EN[t as keyof typeof SUPPLEMENT_TIMING_LABELS_EN] || t).join(", ")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {it.trainingDayOnly && <Badge variant="outline" className="text-[9px]">Train days</Badge>}
                  {it.restDayOnly && <Badge variant="outline" className="text-[9px]">Rest days</Badge>}
                </div>
              </div>
              {it.notes && <p className="text-xs text-muted-foreground mt-1.5">{it.notes}</p>}
              {it.warnings && (
                <p className="text-xs text-cyan-300/90 mt-1.5 inline-flex items-start gap-1.5">
                  <AlertTriangle size={11} className="shrink-0 mt-0.5" />
                  <span>{it.warnings}</span>
                </p>
              )}
              <div className="flex gap-1 mt-2">
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onTogglePause(it)} data-testid={`button-toggle-pause-${it.id}`}>
                  {it.status === "active" ? <><Pause size={11} className="mr-1" /> Pause</> : <><Play size={11} className="mr-1" /> Resume</>}
                </Button>
                <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => onEdit(it)} data-testid={`button-edit-client-supp-${it.id}`}>
                  <Edit3 size={11} className="mr-1" /> Edit
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button size="sm" variant="outline" className="h-7" data-testid={`button-remove-client-supp-${it.id}`}>
                      <Trash2 size={11} />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Remove "{it.name}"?</AlertDialogTitle>
                      <AlertDialogDescription>The client will no longer see this in their list.</AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => onRemove(it.id)}>Remove</AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClientSupplementDialog({
  open,
  initial,
  userId,
  onClose,
}: {
  open: boolean;
  initial: ClientSupplement | null;
  userId: number;
  onClose: () => void;
}) {
  const create = useCreateClientSupplement();
  const update = useUpdateClientSupplement(userId);
  const { data: library = [] } = useSupplements({ activeOnly: true, enabled: open && !initial });
  const [form, setForm] = useState<SupplementFormValue>(emptySupplementForm());
  const [sourceId, setSourceId] = useState<number | null>(null);

  useEffectKey(`${open}-${initial?.id ?? "new"}`, () => {
    if (initial) {
      setForm(rowToSupplementForm(initial as any));
      setSourceId(initial.sourceSupplementId ?? null);
    } else {
      setForm(emptySupplementForm());
      setSourceId(null);
    }
  });

  const pickFromLibrary = (lib: Supplement) => {
    setForm(rowToSupplementForm(lib as any));
    setSourceId(lib.id);
  };

  const save = async () => {
    const payload = {
      sourceSupplementId: sourceId,
      sourceStackId: null,
      name: form.name.trim(),
      brand: (form.brand ?? "").trim() || null,
      category: form.category,
      dosage: form.dosage,
      unit: form.unit,
      timings: form.timings,
      trainingDayOnly: form.trainingDayOnly,
      restDayOnly: form.restDayOnly,
      notes: (form.notes ?? "").trim() || null,
      warnings: (form.warnings ?? "").trim() || null,
    };
    if (initial) {
      await update.mutateAsync({ id: initial.id, ...payload } as any);
    } else {
      await create.mutateAsync({ userId, ...payload } as any);
    }
    onClose();
  };

  const saving = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-client-supplement">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "Assign Supplement"}</DialogTitle>
          {!initial && (
            <DialogDescription>Pick from library or fill in manually.</DialogDescription>
          )}
        </DialogHeader>

        {!initial && library.length > 0 && (
          <div>
            <Label className="text-xs">Quick fill from library</Label>
            <Select value="" onValueChange={(v) => {
              const lib = library.find((l) => String(l.id) === v);
              if (lib) pickFromLibrary(lib);
            }}>
              <SelectTrigger data-testid="select-library-pick"><SelectValue placeholder="Choose from library…" /></SelectTrigger>
              <SelectContent>
                {library.map((lib) => (
                  <SelectItem key={lib.id} value={String(lib.id)}>
                    {lib.name} — {lib.defaultDosage}{lib.defaultUnit}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <SupplementFormFields value={form} onChange={setForm} testIdPrefix="cs" />

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={save} disabled={saving || !form.name.trim()} data-testid="button-save-client-supp">
            {saving ? "Saving…" : initial ? "Save" : "Assign"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ApplyStackDialog({
  open,
  userId,
  existingCount,
  onClose,
}: {
  open: boolean;
  userId: number;
  existingCount: number;
  onClose: () => void;
}) {
  const { data: stacks = [] } = useSupplementStacks({ activeOnly: true, enabled: open });
  const apply = useApplyStackToClient();
  const [stackId, setStackId] = useState<number | null>(null);
  const [replace, setReplace] = useState(false);

  useEffectKey(String(open), () => {
    setStackId(null);
    setReplace(false);
  });

  const submit = async () => {
    if (!stackId) return;
    await apply.mutateAsync({ userId, stackId, replace });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent data-testid="dialog-apply-stack">
        <DialogHeader>
          <DialogTitle>Apply Supplement Stack</DialogTitle>
          <DialogDescription>Snapshots every item from the stack onto this client.</DialogDescription>
        </DialogHeader>

        {stacks.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">No stacks defined yet.</p>
        ) : (
          <>
            <div>
              <Label className="text-xs">Stack</Label>
              <Select value={stackId ? String(stackId) : ""} onValueChange={(v) => setStackId(Number(v))}>
                <SelectTrigger data-testid="select-stack"><SelectValue placeholder="Choose a stack…" /></SelectTrigger>
                <SelectContent>
                  {stacks.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.name} ({s.items.length} items)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {existingCount > 0 && (
              <label className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2.5 text-sm">
                <div>
                  <p>Replace existing</p>
                  <p className="text-[10px] text-muted-foreground">Removes all {existingCount} current supplements first.</p>
                </div>
                <Switch checked={replace} onCheckedChange={setReplace} data-testid="switch-replace" />
              </label>
            )}
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={!stackId || apply.isPending} data-testid="button-confirm-apply-stack">
            {apply.isPending ? "Applying…" : "Apply"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

import { useEffect } from "react";
function useEffectKey(key: string, fn: () => void) {
  useEffect(() => { fn(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
}
