import { useEffect, useState } from "react";
import { Link } from "wouter";
import { useTranslation } from "@/i18n";
import { ArrowLeft, Plus, Layers, Trash2, Edit3, GripVertical, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import {
  useSupplements,
  useSupplementStacks,
  useCreateSupplementStack,
  useUpdateSupplementStack,
  useDeleteSupplementStack,
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
  type SupplementStackFull,
  type Supplement,
} from "@shared/schema";

const STACK_GOALS = [
  { value: "cutting", label: "Cutting" },
  { value: "lean_bulk", label: "Lean Bulk" },
  { value: "recomp", label: "Recomp" },
  { value: "performance", label: "Performance" },
  { value: "recovery", label: "Recovery" },
  { value: "general_health", label: "General Health" },
  { value: "custom", label: "Custom" },
];

export default function AdminSupplementStacks() {
  const { t } = useTranslation();
  const { data: stacks = [], isLoading } = useSupplementStacks();
  const remove = useDeleteSupplementStack();
  const [editing, setEditing] = useState<SupplementStackFull | "new" | null>(null);

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 mb-4"
          data-testid="link-back-admin"
        >
          <ArrowLeft size={14} /> {t("admin.backToAdmin", "Back to Admin")}
        </Link>

        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">{t("admin.supplementStacks.eyebrow", "Templates")}</p>
            <h1 className="text-3xl font-display font-bold leading-tight">{t("admin.supplementStacks.title", "Supplement Stacks")}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t("admin.supplementStacks.subtitle", "Build reusable protocols you can apply to a client in one tap.")}
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/supplements">
              <Button variant="outline" data-testid="link-library">{t("admin.supplementStacks.libraryLink", "Library →")}</Button>
            </Link>
            <Button onClick={() => setEditing("new")} data-testid="button-new-stack">
              <Plus size={16} className="mr-1.5" /> {t("admin.supplementStacks.newStack", "New stack")}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-muted-foreground">
            {t("common.loading", "Loading…")}
          </div>
        ) : stacks.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center">
            <Layers className="mx-auto mb-3 text-muted-foreground" size={32} />
            <p className="text-muted-foreground mb-4">{t("admin.supplementStacks.emptyText", "No stacks yet — group supplements into reusable protocols.")}</p>
            <Button onClick={() => setEditing("new")} data-testid="button-new-stack-empty">
              <Plus size={16} className="mr-1.5" /> {t("admin.supplementStacks.buildFirst", "Build your first stack")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {stacks.map((s) => (
              <StackCard
                key={s.id}
                stack={s}
                onEdit={() => setEditing(s)}
                onDelete={() => remove.mutate(s.id)}
              />
            ))}
          </div>
        )}

        <StackDialog
          open={editing !== null}
          initial={editing && editing !== "new" ? editing : null}
          onClose={() => setEditing(null)}
        />
      </div>
    </div>
  );
}

function StackCard({ stack, onEdit, onDelete }: { stack: SupplementStackFull; onEdit: () => void; onDelete: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-white/5 bg-card/60 p-5" data-testid={`card-stack-${stack.id}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-lg leading-tight" data-testid={`text-stack-name-${stack.id}`}>{stack.name}</h3>
          <div className="flex flex-wrap gap-2 mt-1">
            <Badge variant="outline" className="text-[10px]">
              {STACK_GOALS.find((g) => g.value === stack.goal)?.label || stack.goal}
            </Badge>
            <Badge variant="outline" className="text-[10px]">{stack.items.length} {t("common.items", "items")}</Badge>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="outline" onClick={onEdit} data-testid={`button-edit-stack-${stack.id}`}>
            <Edit3 size={12} />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button size="sm" variant="outline" data-testid={`button-delete-stack-${stack.id}`}>
                <Trash2 size={12} />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("admin.supplementStacks.deleteStack", "Delete stack")} "{stack.name}"?</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("admin.supplementStacks.deleteDesc", "Existing client assignments are unaffected (they snapshot the data).")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
                <AlertDialogAction onClick={onDelete} data-testid={`button-confirm-delete-stack-${stack.id}`}>{t("common.delete", "Delete")}</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>
      {stack.description && <p className="text-sm text-muted-foreground mb-3">{stack.description}</p>}
      <ul className="text-sm space-y-1.5">
        {stack.items.map((it) => (
          <li key={it.id} className="flex items-center gap-2 text-foreground/80">
            <span className="size-1.5 rounded-full bg-primary/60" />
            <span className="font-medium">{it.name}</span>
            <span className="text-muted-foreground text-xs">
              {it.dosage}{it.unit} · {it.timings.map((t) => SUPPLEMENT_TIMING_LABELS_EN[t as keyof typeof SUPPLEMENT_TIMING_LABELS_EN] || t).join(", ") || "anytime"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface DraftItem extends SupplementFormValue {
  sourceSupplementId?: number | null;
}

function StackDialog({
  open,
  initial,
  onClose,
}: {
  open: boolean;
  initial: SupplementStackFull | null;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const create = useCreateSupplementStack();
  const update = useUpdateSupplementStack();
  const { data: library = [] } = useSupplements({ activeOnly: true, enabled: open });

  const [name, setName] = useState("");
  const [goal, setGoal] = useState("custom");
  const [description, setDescription] = useState("");
  const [items, setItems] = useState<DraftItem[]>([]);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (initial) {
      setName(initial.name);
      setGoal(initial.goal);
      setDescription(initial.description ?? "");
      setItems(
        initial.items.map((it) => ({
          ...rowToSupplementForm(it as any),
          sourceSupplementId: it.sourceSupplementId ?? null,
        })),
      );
      setActiveIdx(0);
    } else {
      setName("");
      setGoal("custom");
      setDescription("");
      setItems([]);
      setActiveIdx(0);
    }
  }, [open, initial?.id]);

  const addBlank = () => {
    setItems((prev) => {
      const next = [...prev, { ...emptySupplementForm(), sourceSupplementId: null }];
      setActiveIdx(next.length - 1);
      return next;
    });
  };
  const addFromLibrary = (lib: Supplement) => {
    setItems((prev) => {
      const next = [
        ...prev,
        {
          ...rowToSupplementForm(lib as any),
          sourceSupplementId: lib.id,
        } as DraftItem,
      ];
      setActiveIdx(next.length - 1);
      return next;
    });
    setPickerOpen(false);
  };
  const removeAt = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
    setActiveIdx((cur) => Math.max(0, cur > idx ? cur - 1 : cur));
  };
  const updateAt = (idx: number, next: SupplementFormValue) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...next } : it)));
  };

  const save = async () => {
    if (!name.trim() || items.length === 0) return;
    const payload = {
      name: name.trim(),
      goal,
      description: description.trim() || null,
      active: true,
      items: items.map((it, idx) => ({
        sourceSupplementId: it.sourceSupplementId ?? null,
        name: it.name.trim(),
        brand: (it.brand ?? "").trim() || null,
        category: it.category,
        dosage: it.dosage,
        unit: it.unit,
        timings: it.timings,
        trainingDayOnly: it.trainingDayOnly,
        restDayOnly: it.restDayOnly,
        notes: (it.notes ?? "").trim() || null,
        warnings: (it.warnings ?? "").trim() || null,
        sortOrder: idx,
      })),
    };
    if (initial) {
      await update.mutateAsync({ id: initial.id, ...payload } as any);
    } else {
      await create.mutateAsync(payload as any);
    }
    onClose();
  };

  const saving = create.isPending || update.isPending;
  const active = items[activeIdx];

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[92vh] overflow-y-auto" data-testid="dialog-stack">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "New Stack"}</DialogTitle>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">Stack name *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cutting Essentials" data-testid="input-stack-name" />
          </div>
          <div>
            <Label className="text-xs">Goal</Label>
            <Select value={goal} onValueChange={setGoal}>
              <SelectTrigger data-testid="select-stack-goal"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STACK_GOALS.map((g) => <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div>
          <Label className="text-xs">Description</Label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Who this is for, when to use it…" data-testid="input-stack-description" />
        </div>

        <div className="grid md:grid-cols-[280px_1fr] gap-4 pt-3 border-t border-white/5">
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Items ({items.length})</Label>
              <div className="flex gap-1">
                <Button size="sm" variant="outline" onClick={addBlank} data-testid="button-add-blank-item">
                  <Plus size={12} />
                </Button>
                <Button size="sm" variant="outline" onClick={() => setPickerOpen(true)} data-testid="button-pick-from-library">
                  Library
                </Button>
              </div>
            </div>
            <ul className="space-y-1.5 max-h-[400px] overflow-y-auto pr-1">
              {items.map((it, idx) => (
                <li
                  key={idx}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer transition ${
                    idx === activeIdx
                      ? "bg-primary/10 border-primary/30"
                      : "bg-white/[0.02] border-white/5 hover:border-white/15"
                  }`}
                  onClick={() => setActiveIdx(idx)}
                  data-testid={`stack-item-${idx}`}
                >
                  <GripVertical size={12} className="text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{it.name || "(unnamed)"}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{it.dosage}{it.unit}</p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeAt(idx); }}
                    className="text-muted-foreground hover:text-destructive shrink-0"
                    data-testid={`button-remove-item-${idx}`}
                  >
                    <X size={14} />
                  </button>
                </li>
              ))}
              {items.length === 0 && (
                <li className="text-xs text-muted-foreground text-center py-6">
                  {t("admin.supplementStacks.noItemsYet", "No items yet. Add from library or blank.")}
                </li>
              )}
            </ul>
          </div>

          <div>
            {active ? (
              <SupplementFormFields
                value={active}
                onChange={(v) => updateAt(activeIdx, v)}
                testIdPrefix={`stack-item-form-${activeIdx}`}
              />
            ) : (
              <div className="text-sm text-muted-foreground text-center py-12 border border-dashed border-white/10 rounded-2xl">
                Add an item to start.
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel-stack">Cancel</Button>
          <Button onClick={save} disabled={saving || !name.trim() || items.length === 0} data-testid="button-save-stack">
            {saving ? "Saving…" : initial ? "Save changes" : "Create stack"}
          </Button>
        </DialogFooter>

        {/* Library picker */}
        <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
          <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Add from library</DialogTitle></DialogHeader>
            {library.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No library items yet.</p>
            ) : (
              <ul className="space-y-1.5">
                {library.map((lib) => (
                  <li key={lib.id}>
                    <button
                      type="button"
                      onClick={() => addFromLibrary(lib)}
                      className="w-full text-left px-3 py-2.5 rounded-lg border border-white/5 hover:border-primary/30 hover:bg-primary/5 transition"
                      data-testid={`picker-lib-${lib.id}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">{lib.name}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {SUPPLEMENT_CATEGORY_LABELS_EN[lib.category as keyof typeof SUPPLEMENT_CATEGORY_LABELS_EN] || lib.category}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">{lib.defaultDosage}{lib.defaultUnit}</p>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DialogContent>
        </Dialog>
      </DialogContent>
    </Dialog>
  );
}
