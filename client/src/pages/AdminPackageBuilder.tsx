import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import {
  Plus,
  Edit3,
  Trash2,
  Loader2,
  PackagePlus,
  Eye,
  EyeOff,
  Sparkles,
  Calendar as CalendarIcon,
  DollarSign,
  Hash,
} from "lucide-react";
import {
  insertPackageTemplateSchema,
  PACKAGE_TEMPLATE_TYPES,
  PACKAGE_TEMPLATE_UNITS,
  type PackageTemplate,
  type InsertPackageTemplate,
} from "@shared/schema";
import {
  usePackageTemplates,
  useCreatePackageTemplate,
  useUpdatePackageTemplate,
  useDeletePackageTemplate,
} from "@/hooks/use-package-templates";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useTranslation } from "@/i18n";

// ----- Form schema (a thin wrapper around the shared insert schema) -----
type FormValues = InsertPackageTemplate;

const DEFAULTS: FormValues = {
  name: "",
  type: "standard",
  paidSessions: 10,
  bonusSessions: 0,
  totalSessions: 10,
  pricePerSession: 100,
  totalPrice: 1000,
  expirationValue: 30,
  expirationUnit: "days",
  description: "",
  isActive: true,
  displayOrder: 0,
};

export default function AdminPackageBuilder() {
  const { t } = useTranslation();
  const { data: templates = [], isLoading } = usePackageTemplates();
  const create = useCreatePackageTemplate();
  const update = useUpdatePackageTemplate();
  const del = useDeletePackageTemplate();

  const [editing, setEditing] = useState<PackageTemplate | null>(null);
  const [open, setOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  function openCreate() {
    setEditing(null);
    setOpen(true);
  }
  function openEdit(tpl: PackageTemplate) {
    setEditing(tpl);
    setOpen(true);
  }

  const activeCount = useMemo(() => templates.filter((t) => t.isActive).length, [templates]);

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="mb-8 flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">
              {t("admin.packageBuilder.kicker")}
            </p>
            <h1 className="text-3xl font-display font-bold" data-testid="text-builder-title">
              {t("admin.packageBuilder.title")}
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              {t("admin.packageBuilder.summary")
                .replace("{active}", String(activeCount))
                .replace("{total}", String(templates.length))}
            </p>
          </div>
          <Button
            onClick={openCreate}
            className="rounded-xl"
            data-testid="button-new-template"
          >
            <Plus size={16} className="mr-1.5" /> {t("admin.packageBuilder.newPackage")}
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground p-12 justify-center">
            <Loader2 className="animate-spin" size={16} /> {t("common.loading")}
          </div>
        ) : templates.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-muted-foreground">
            <PackagePlus className="mx-auto text-muted-foreground/40 mb-3" size={32} />
            <p>{t("admin.packageBuilder.empty")}</p>
            <Button onClick={openCreate} variant="outline" className="mt-4 rounded-xl">
              <Plus size={14} className="mr-1.5" /> {t("admin.packageBuilder.createFirst")}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((tpl, i) => (
              <TemplateCard
                key={tpl.id}
                tpl={tpl}
                index={i}
                onEdit={() => openEdit(tpl)}
                onDelete={() => setDeleteId(tpl.id)}
                onToggleActive={() =>
                  update.mutate({ id: tpl.id, isActive: !tpl.isActive })
                }
                t={t}
              />
            ))}
          </div>
        )}
      </div>

      <TemplateDialog
        open={open}
        onOpenChange={setOpen}
        editing={editing}
        onSubmit={(values) => {
          if (editing) {
            update.mutate(
              { id: editing.id, ...values },
              { onSuccess: () => setOpen(false) },
            );
          } else {
            create.mutate(values, { onSuccess: () => setOpen(false) });
          }
        }}
        isPending={create.isPending || update.isPending}
        t={t}
      />

      <AlertDialog open={deleteId !== null} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent className="bg-card border-white/10">
          <AlertDialogHeader>
            <AlertDialogTitle>{t("admin.packageBuilder.deleteTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("admin.packageBuilder.deleteDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-delete">
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteId) del.mutate(deleteId);
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-delete"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ===========================================================================
// CARD
// ===========================================================================
function TemplateCard({
  tpl,
  index,
  onEdit,
  onDelete,
  onToggleActive,
  t,
}: {
  tpl: PackageTemplate;
  index: number;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  t: (k: string) => string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.04, 0.3) }}
      className={`rounded-2xl border p-5 card-lift ${
        tpl.isActive
          ? "border-primary/30 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent"
          : "border-white/5 bg-card/60 opacity-70"
      }`}
      data-testid={`template-card-${tpl.id}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.2em] text-primary font-bold">
            {t(`admin.packageBuilder.type.${tpl.type}`)}
          </p>
          <h3 className="font-display font-bold text-lg leading-tight mt-0.5 truncate" data-testid={`text-template-name-${tpl.id}`}>
            {tpl.name}
          </h3>
        </div>
        <div className="flex gap-1">
          <Button
            size="icon"
            variant="ghost"
            onClick={onToggleActive}
            className="h-7 w-7"
            data-testid={`button-toggle-active-${tpl.id}`}
            title={tpl.isActive ? t("admin.packageBuilder.hide") : t("admin.packageBuilder.show")}
          >
            {tpl.isActive ? <Eye size={12} /> : <EyeOff size={12} />}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onEdit}
            className="h-7 w-7"
            data-testid={`button-edit-template-${tpl.id}`}
          >
            <Edit3 size={12} />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onDelete}
            className="h-7 w-7 text-red-400 hover:bg-red-500/10"
            data-testid={`button-delete-template-${tpl.id}`}
          >
            <Trash2 size={12} />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat
          label={t("admin.packageBuilder.paid")}
          value={tpl.paidSessions}
          icon={<Hash size={11} />}
        />
        <Stat
          label={t("admin.packageBuilder.bonus")}
          value={tpl.bonusSessions}
          icon={<Sparkles size={11} />}
          accent={tpl.bonusSessions > 0 ? "text-emerald-300" : undefined}
          highlight={tpl.bonusSessions > 0}
        />
        <Stat
          label={t("admin.packageBuilder.totalSessions")}
          value={tpl.totalSessions}
          accent="text-primary"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
        <div className="rounded-lg bg-white/5 border border-white/5 px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <DollarSign size={10} /> {t("admin.packageBuilder.pricePerSession")}
          </p>
          <p className="font-bold tabular-nums" data-testid={`text-price-per-session-${tpl.id}`}>
            {tpl.pricePerSession.toLocaleString()} {t("common.aed")}
          </p>
        </div>
        <div className="rounded-lg bg-white/5 border border-white/5 px-3 py-2">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center gap-1">
            <DollarSign size={10} /> {t("admin.packageBuilder.totalPrice")}
          </p>
          <p className="font-bold tabular-nums text-primary" data-testid={`text-total-price-${tpl.id}`}>
            {tpl.totalPrice.toLocaleString()} {t("common.aed")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <CalendarIcon size={11} />
        <span>
          {t("admin.packageBuilder.expiresIn")}: {tpl.expirationValue}{" "}
          {t(`admin.packageBuilder.unit.${tpl.expirationUnit}`)}
        </span>
      </div>

      {tpl.description && (
        <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{tpl.description}</p>
      )}
    </motion.div>
  );
}

function Stat({
  label,
  value,
  accent,
  icon,
  highlight,
}: {
  label: string;
  value: number;
  accent?: string;
  icon?: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border px-2 py-1.5 text-center ${
        highlight
          ? "bg-emerald-500/8 border-emerald-400/25 shadow-[0_0_14px_-6px_rgba(16,185,129,0.45)]"
          : "bg-white/5 border-white/5"
      }`}
    >
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground flex items-center justify-center gap-1">
        {icon}
        {label}
      </p>
      <p
        className={`text-base font-display font-bold tabular-nums leading-tight mt-0.5 ${accent || ""}`}
      >
        {value}
      </p>
    </div>
  );
}

// ===========================================================================
// CREATE/EDIT DIALOG
// ===========================================================================
function TemplateDialog({
  open,
  onOpenChange,
  editing,
  onSubmit,
  isPending,
  t,
}: {
  open: boolean;
  onOpenChange: (b: boolean) => void;
  editing: PackageTemplate | null;
  onSubmit: (v: FormValues) => void;
  isPending: boolean;
  t: (k: string) => string;
}) {
  const form = useForm<FormValues>({
    resolver: zodResolver(insertPackageTemplateSchema) as any,
    defaultValues: DEFAULTS,
  });

  // Repopulate when opening for edit / closing
  useEffect(() => {
    if (!open) return;
    if (editing) {
      form.reset({
        name: editing.name,
        type: editing.type as any,
        paidSessions: editing.paidSessions,
        bonusSessions: editing.bonusSessions,
        totalSessions: editing.totalSessions,
        pricePerSession: editing.pricePerSession,
        totalPrice: editing.totalPrice,
        expirationValue: editing.expirationValue,
        expirationUnit: editing.expirationUnit as any,
        description: editing.description ?? "",
        isActive: editing.isActive,
        displayOrder: editing.displayOrder,
      });
    } else {
      form.reset(DEFAULTS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  // ----- Auto-derive totalSessions = paid+bonus -----
  const paid = form.watch("paidSessions");
  const bonus = form.watch("bonusSessions");
  const pricePer = form.watch("pricePerSession");
  useEffect(() => {
    const sum = (Number(paid) || 0) + (Number(bonus) || 0);
    if (sum > 0) form.setValue("totalSessions", sum, { shouldValidate: true });
  }, [paid, bonus]); // eslint-disable-line react-hooks/exhaustive-deps

  // ----- Auto-derive totalPrice = paid*pricePerSession (only when not manually edited) -----
  useEffect(() => {
    const computed = (Number(paid) || 0) * (Number(pricePer) || 0);
    form.setValue("totalPrice", computed, { shouldValidate: true });
  }, [paid, pricePer]); // eslint-disable-line react-hooks/exhaustive-deps

  function handle(values: FormValues) {
    onSubmit({
      ...values,
      // sanitise null-able description
      description: values.description?.toString().trim() || null,
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {editing ? t("admin.packageBuilder.editTitle") : t("admin.packageBuilder.newTitle")}
          </DialogTitle>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handle)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.packageBuilder.field.name")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder={t("admin.packageBuilder.field.namePh")}
                      className="bg-white/5 border-white/10"
                      data-testid="input-template-name"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.packageBuilder.field.type")}</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger
                      className="bg-white/5 border-white/10"
                      data-testid="select-template-type"
                    >
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PACKAGE_TEMPLATE_TYPES.map((tp) => (
                        <SelectItem key={tp} value={tp}>
                          {t(`admin.packageBuilder.type.${tp}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <NumberField
                form={form}
                name="paidSessions"
                label={t("admin.packageBuilder.field.paid")}
                testId="input-paid-sessions"
              />
              <NumberField
                form={form}
                name="bonusSessions"
                label={t("admin.packageBuilder.field.bonus")}
                testId="input-bonus-sessions"
              />
              <NumberField
                form={form}
                name="totalSessions"
                label={t("admin.packageBuilder.field.total")}
                testId="input-total-sessions"
                hint={t("admin.packageBuilder.field.totalHint")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField
                form={form}
                name="pricePerSession"
                label={t("admin.packageBuilder.field.pricePerSession") + " (" + t("common.aed") + ")"}
                testId="input-price-per-session"
              />
              <NumberField
                form={form}
                name="totalPrice"
                label={t("admin.packageBuilder.field.totalPrice") + " (" + t("common.aed") + ")"}
                testId="input-total-price"
                hint={t("admin.packageBuilder.field.totalPriceHint")}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <NumberField
                form={form}
                name="expirationValue"
                label={t("admin.packageBuilder.field.expirationValue")}
                testId="input-expiration-value"
              />
              <FormField
                control={form.control}
                name="expirationUnit"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.packageBuilder.field.expirationUnit")}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger
                        className="bg-white/5 border-white/10"
                        data-testid="select-expiration-unit"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PACKAGE_TEMPLATE_UNITS.map((u) => (
                          <SelectItem key={u} value={u}>
                            {t(`admin.packageBuilder.unit.${u}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.packageBuilder.field.description")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={(field.value as any) ?? ""}
                      placeholder={t("admin.packageBuilder.field.descriptionPh")}
                      className="bg-white/5 border-white/10 min-h-[70px]"
                      data-testid="input-template-description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-2 gap-3">
              <NumberField
                form={form}
                name="displayOrder"
                label={t("admin.packageBuilder.field.displayOrder")}
                testId="input-display-order"
              />
              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.packageBuilder.field.isActive")}</FormLabel>
                    <Select
                      value={field.value ? "1" : "0"}
                      onValueChange={(v) => field.onChange(v === "1")}
                    >
                      <SelectTrigger
                        className="bg-white/5 border-white/10"
                        data-testid="select-is-active"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">{t("admin.packageBuilder.show")}</SelectItem>
                        <SelectItem value="0">{t("admin.packageBuilder.hide")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormItem>
                )}
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                data-testid="button-cancel-template"
              >
                {t("common.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={isPending}
                className="rounded-xl"
                data-testid="button-save-template"
              >
                {isPending && <Loader2 size={14} className="animate-spin mr-1.5" />}
                {editing ? t("common.save") : t("common.create")}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function NumberField({
  form,
  name,
  label,
  testId,
  hint,
}: {
  form: any;
  name: keyof FormValues;
  label: string;
  testId: string;
  hint?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name as any}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={0}
              {...field}
              value={field.value ?? 0}
              onChange={(e) => field.onChange(Number(e.target.value))}
              className="bg-white/5 border-white/10 tabular-nums"
              data-testid={testId}
            />
          </FormControl>
          {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
