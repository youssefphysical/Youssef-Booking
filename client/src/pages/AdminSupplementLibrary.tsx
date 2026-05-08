import { useState } from "react";
import { Link } from "wouter";
import { ArrowLeft, Plus, Pill, Trash2, Edit3, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  useSupplements,
  useCreateSupplement,
  useUpdateSupplement,
  useDeleteSupplement,
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
  type Supplement,
} from "@shared/schema";

// Admin-curated supplement library. Editing or deleting a row here is
// always safe — every assignment / stack carries its own snapshot.
export default function AdminSupplementLibrary() {
  const { data: items = [], isLoading } = useSupplements();
  const create = useCreateSupplement();
  const update = useUpdateSupplement();
  const remove = useDeleteSupplement();
  const [editing, setEditing] = useState<Supplement | "new" | null>(null);

  const startNew = () => setEditing("new");
  const close = () => setEditing(null);

  const onSave = async (form: SupplementFormValue, isPrescription: boolean, active: boolean, nameAr: string) => {
    const payload = {
      name: form.name.trim(),
      nameAr: nameAr.trim() || null,
      brand: (form.brand ?? "").trim() || null,
      category: form.category,
      defaultDosage: form.dosage,
      defaultUnit: form.unit,
      defaultTimings: form.timings,
      defaultTrainingDayOnly: form.trainingDayOnly,
      defaultRestDayOnly: form.restDayOnly,
      notes: (form.notes ?? "").trim() || null,
      warnings: (form.warnings ?? "").trim() || null,
      isPrescription,
      active,
    };
    if (editing === "new") {
      await create.mutateAsync(payload as any);
    } else if (editing) {
      await update.mutateAsync({ id: editing.id, ...payload } as any);
    }
    close();
  };

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <Link
          href="/admin"
          className="text-sm text-muted-foreground hover:text-primary inline-flex items-center gap-1.5 mb-4"
          data-testid="link-back-admin"
        >
          <ArrowLeft size={14} /> Back to Admin
        </Link>

        <div className="flex items-end justify-between mb-6 flex-wrap gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">Catalogue</p>
            <h1 className="text-3xl font-display font-bold leading-tight">Supplement Library</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Curate the supplements you prescribe. Edits never affect existing client protocols.
            </p>
          </div>
          <div className="flex gap-2">
            <Link href="/admin/supplement-stacks">
              <Button variant="outline" data-testid="link-stacks">Stacks →</Button>
            </Link>
            <Button onClick={startNew} data-testid="button-new-supplement">
              <Plus size={16} className="mr-1.5" /> New
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-muted-foreground">
            Loading…
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center">
            <Pill className="mx-auto mb-3 text-muted-foreground" size={32} />
            <p className="text-muted-foreground mb-4">No supplements in the library yet.</p>
            <Button onClick={startNew} data-testid="button-new-supplement-empty">
              <Plus size={16} className="mr-1.5" /> Add your first
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map((it) => (
              <SupplementCard
                key={it.id}
                item={it}
                onEdit={() => setEditing(it)}
                onDelete={() => remove.mutate(it.id)}
              />
            ))}
          </div>
        )}

        <SupplementDialog
          open={editing !== null}
          initial={editing && editing !== "new" ? editing : null}
          onClose={close}
          onSave={onSave}
          saving={create.isPending || update.isPending}
        />
      </div>
    </div>
  );
}

function SupplementCard({ item, onEdit, onDelete }: { item: Supplement; onEdit: () => void; onDelete: () => void }) {
  return (
    <div
      className="rounded-2xl border border-white/5 bg-card/60 p-4 flex flex-col gap-2"
      data-testid={`card-supplement-${item.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="font-semibold leading-tight" data-testid={`text-supplement-name-${item.id}`}>{item.name}</h3>
          {item.brand && <p className="text-xs text-muted-foreground truncate">{item.brand}</p>}
        </div>
        <Badge variant="outline" className="text-[10px] shrink-0">
          {SUPPLEMENT_CATEGORY_LABELS_EN[item.category as keyof typeof SUPPLEMENT_CATEGORY_LABELS_EN] || item.category}
        </Badge>
      </div>
      <p className="text-sm text-foreground/80">
        {item.defaultDosage} {item.defaultUnit}
        {item.defaultTimings.length > 0 && (
          <span className="text-muted-foreground"> · {item.defaultTimings.map((t) => SUPPLEMENT_TIMING_LABELS_EN[t as keyof typeof SUPPLEMENT_TIMING_LABELS_EN] || t).join(", ")}</span>
        )}
      </p>
      {(item.defaultTrainingDayOnly || item.defaultRestDayOnly) && (
        <Badge variant="outline" className="self-start text-[10px]">
          {item.defaultTrainingDayOnly ? "Training days only" : "Rest days only"}
        </Badge>
      )}
      {item.warnings && (
        <p className="text-xs text-amber-300/90 inline-flex items-start gap-1.5">
          <AlertTriangle size={12} className="shrink-0 mt-0.5" />
          <span className="line-clamp-2">{item.warnings}</span>
        </p>
      )}
      <div className="flex gap-2 mt-auto pt-2">
        <Button size="sm" variant="outline" className="flex-1" onClick={onEdit} data-testid={`button-edit-supplement-${item.id}`}>
          <Edit3 size={12} className="mr-1.5" /> Edit
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button size="sm" variant="outline" data-testid={`button-delete-supplement-${item.id}`}>
              <Trash2 size={12} />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete "{item.name}"?</AlertDialogTitle>
              <AlertDialogDescription>
                Removes from the library. Existing client assignments are unaffected (they snapshot the data).
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDelete} data-testid={`button-confirm-delete-${item.id}`}>Delete</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function SupplementDialog({
  open,
  initial,
  onClose,
  onSave,
  saving,
}: {
  open: boolean;
  initial: Supplement | null;
  onClose: () => void;
  onSave: (form: SupplementFormValue, isPrescription: boolean, active: boolean, nameAr: string) => Promise<void> | void;
  saving: boolean;
}) {
  const [form, setForm] = useState<SupplementFormValue>(emptySupplementForm());
  const [isPrescription, setIsPrescription] = useState(false);
  const [active, setActive] = useState(true);
  const [nameAr, setNameAr] = useState("");

  // Reset every time the dialog opens / target changes.
  const key = `${open}-${initial?.id ?? "new"}`;
  useStateOnKey(key, () => {
    if (initial) {
      setForm(rowToSupplementForm(initial as any));
      setIsPrescription(!!initial.isPrescription);
      setActive(!!initial.active);
      setNameAr(initial.nameAr ?? "");
    } else {
      setForm(emptySupplementForm());
      setIsPrescription(false);
      setActive(true);
      setNameAr("");
    }
  });

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" data-testid="dialog-supplement">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${initial.name}` : "New Supplement"}</DialogTitle>
        </DialogHeader>

        <SupplementFormFields value={form} onChange={setForm} testIdPrefix="lib" />

        <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
          <label className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2.5 text-sm">
            <span>Prescription required</span>
            <Switch checked={isPrescription} onCheckedChange={setIsPrescription} data-testid="switch-prescription" />
          </label>
          <label className="flex items-center justify-between rounded-xl border border-white/5 px-3 py-2.5 text-sm">
            <span>Active in library</span>
            <Switch checked={active} onCheckedChange={setActive} data-testid="switch-active" />
          </label>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="button-cancel">Cancel</Button>
          <Button
            onClick={() => onSave(form, isPrescription, active, nameAr)}
            disabled={saving || !form.name.trim()}
            data-testid="button-save"
          >
            {saving ? "Saving…" : initial ? "Save changes" : "Add to library"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// tiny "useEffect on key change" — avoids importing useEffect for one
// place and avoids the dependency-array linting noise for this case.
import { useEffect } from "react";
function useStateOnKey(key: string, fn: () => void) {
  useEffect(() => { fn(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [key]);
}
