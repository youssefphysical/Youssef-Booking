import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Edit3, ShieldCheck, ShieldOff, Loader2, KeyRound, Users as UsersIcon } from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminEmptyState,
} from "@/components/admin/primitives";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
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
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/ui/form";
import {
  ADMIN_ROLES,
  ADMIN_ROLE_LABELS,
  ADMIN_PERMISSION_KEYS,
  ADMIN_PERMISSION_LABELS,
  ADMIN_PERMISSION_GROUPS,
  DEFAULT_PERMISSIONS_BY_ROLE,
  SUPER_ADMIN_EMAIL,
  type AdminPermissionKey,
  type AdminRole,
  type UserResponse,
} from "@shared/schema";
import { useTranslation } from "@/i18n";

const formSchema = z.object({
  email: z.string().email("Valid email required"),
  fullName: z.string().min(2, "Full name required"),
  password: z.string().optional(),
  adminRole: z.enum(ADMIN_ROLES),
  isActive: z.boolean(),
});
type FormValues = z.infer<typeof formSchema>;

type AdminUser = UserResponse & {
  adminRole?: AdminRole | null;
  permissions?: Record<string, boolean> | null;
  isActive?: boolean | null;
};

export default function AdminStaffPage() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: admins = [], isLoading } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/admins"],
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [perms, setPerms] = useState<Record<AdminPermissionKey, boolean>>(
    DEFAULT_PERMISSIONS_BY_ROLE.viewer,
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
      fullName: "",
      password: "",
      adminRole: "viewer",
      isActive: true,
    },
  });

  function openCreate() {
    setEditing(null);
    form.reset({
      email: "",
      fullName: "",
      password: "",
      adminRole: "viewer",
      isActive: true,
    });
    setPerms({ ...DEFAULT_PERMISSIONS_BY_ROLE.viewer });
    setDialogOpen(true);
  }

  function openEdit(a: AdminUser) {
    setEditing(a);
    form.reset({
      email: a.email ?? "",
      fullName: a.fullName,
      password: "",
      adminRole: (a.adminRole as AdminRole) || "viewer",
      isActive: a.isActive !== false,
    });
    setPerms({
      ...DEFAULT_PERMISSIONS_BY_ROLE.viewer,
      ...(a.permissions || {}),
    } as Record<AdminPermissionKey, boolean>);
    setDialogOpen(true);
  }

  // Sync permissions whenever role changes (only when no manual edits expected)
  function onRoleChange(newRole: AdminRole) {
    form.setValue("adminRole", newRole);
    setPerms({ ...DEFAULT_PERMISSIONS_BY_ROLE[newRole] });
  }

  const createMut = useMutation({
    mutationFn: async (body: any) => {
      const res = await apiRequest("POST", "/api/admin/admins", body);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({ title: t("admin.staff.toast.created", "Admin created") });
      setDialogOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: t("admin.staff.toast.createFailed", "Could not create admin"), description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/admins/${id}`, body);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({ title: t("admin.staff.toast.updated", "Admin updated") });
      setDialogOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: t("admin.staff.toast.updateFailed", "Update failed"), description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/admins/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({ title: t("admin.staff.toast.deleted", "Admin deleted") });
    },
    onError: (e: Error) =>
      toast({ title: t("admin.staff.toast.deleteFailed", "Delete failed"), description: e.message, variant: "destructive" }),
  });

  function onSubmit(values: FormValues) {
    if (editing) {
      const body: any = {
        fullName: values.fullName,
        adminRole: values.adminRole,
        isActive: values.isActive,
        permissions: perms,
      };
      if (values.password && values.password.length > 0) {
        if (values.password.length < 6) {
          toast({
            title: t("admin.staff.toast.pwTooShortTitle", "Password too short"),
            description: t("admin.staff.toast.pwTooShortDesc", "Use at least 6 characters or leave blank."),
            variant: "destructive",
          });
          return;
        }
        body.password = values.password;
      }
      updateMut.mutate({ id: editing.id, body });
    } else {
      if (!values.password || values.password.length < 6) {
        toast({
          title: t("admin.staff.toast.pwRequiredTitle", "Password required"),
          description: t("admin.staff.toast.pwRequiredDesc", "New admins need a temporary password (min 6 chars)."),
          variant: "destructive",
        });
        return;
      }
      createMut.mutate({
        email: values.email,
        fullName: values.fullName,
        password: values.password,
        adminRole: values.adminRole,
        isActive: values.isActive,
        permissions: perms,
      });
    }
  }

  const isCanonicalSuper = (a: AdminUser) =>
    a.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();

  const totalAdmins = admins.length;
  const activeAdmins = admins.filter((a) => a.isActive !== false).length;
  const superAdmins = admins.filter((a) => (a.adminRole || "super_admin") === "super_admin").length;
  const disabledAdmins = totalAdmins - activeAdmins;

  return (
    <div className="admin-shell">
      <div className="admin-container space-y-5">
        <AdminPageHeader
          title={t("admin.staff.title", "Admin & Staff")}
          subtitle={t(
            "admin.staff.subtitle",
            "Manage who can access the admin panel and what they can do.",
          )}
          testId="text-staff-title"
          right={
            <Button
              className="rounded-xl h-9"
              onClick={openCreate}
              data-testid="button-add-admin"
            >
              <Plus size={14} className="me-1.5" /> {t("admin.staff.add", "Add admin")}
            </Button>
          }
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <AdminStatCard
            icon={<UsersIcon size={16} />}
            label={t("admin.staff.statTotal", "Total")}
            value={totalAdmins}
            tone="info"
            animate
            testId="stat-staff-total"
          />
          <AdminStatCard
            icon={<ShieldCheck size={16} />}
            label={t("admin.staff.statActive", "Active")}
            value={activeAdmins}
            tone="success"
            animate
            testId="stat-staff-active"
          />
          <AdminStatCard
            icon={<KeyRound size={16} />}
            label={t("admin.staff.statSuper", "Super admins")}
            value={superAdmins}
            tone="warning"
            animate
            testId="stat-staff-super"
          />
          <AdminStatCard
            icon={<ShieldOff size={16} />}
            label={t("admin.staff.statDisabled", "Disabled")}
            value={disabledAdmins}
            tone="muted"
            animate
            testId="stat-staff-disabled"
          />
        </div>

        <AdminCard padded={false} className="overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">{t("common.loading", "Loading…")}</div>
        ) : admins.length === 0 ? (
          <AdminEmptyState
            icon={<UsersIcon size={28} />}
            title={t("admin.staff.empty", "No admin staff yet.")}
          />
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-white/[0.02]">
              <tr>
                <th className="text-start px-4 py-3">{t("admin.staff.col.name", "Name")}</th>
                <th className="text-start px-4 py-3">{t("admin.staff.col.email", "Email")}</th>
                <th className="text-start px-4 py-3">{t("admin.staff.col.role", "Role")}</th>
                <th className="text-start px-4 py-3">{t("admin.staff.col.perms", "Permissions")}</th>
                <th className="text-start px-4 py-3">{t("admin.staff.col.status", "Status")}</th>
                <th className="text-end px-4 py-3">{t("admin.staff.col.actions", "Actions")}</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => {
                const isLegacy = !a.adminRole;
                const role = (a.adminRole as AdminRole) || "super_admin";
                const permsCount = Object.values(a.permissions || {}).filter(Boolean).length;
                const totalPerms = ADMIN_PERMISSION_KEYS.length;
                const active = a.isActive !== false;
                const canonical = isCanonicalSuper(a);
                const isSelf = a.id === user?.id;
                return (
                  <tr
                    key={a.id}
                    className="border-t border-white/5"
                    data-testid={`row-admin-${a.id}`}
                  >
                    <td className="px-4 py-3 font-medium">
                      {a.fullName}
                      {canonical && (
                        <span
                          className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-cyan-500/30 bg-cyan-500/10 text-cyan-300"
                          data-testid={`badge-super-${a.id}`}
                        >
                          {t("admin.staff.you", "You")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-primary/20 bg-primary/10 text-primary">
                        {ADMIN_ROLE_LABELS[role]}
                      </span>
                      {isLegacy && (
                        <span className="ms-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                          {t("admin.staff.legacy", "legacy")}
                        </span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-muted-foreground text-xs"
                      data-testid={`text-perms-${a.id}`}
                    >
                      {role === "super_admin" ? t("admin.staff.all", "All") : `${permsCount}/${totalPerms}`}
                    </td>
                    <td className="px-4 py-3">
                      {active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                          <ShieldCheck size={12} /> {t("admin.staff.active", "Active")}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <ShieldOff size={12} /> {t("admin.staff.disabled", "Disabled")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-end space-x-1.5 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEdit(a)}
                        data-testid={`button-edit-admin-${a.id}`}
                      >
                        <Edit3 size={14} />
                      </Button>
                      {!canonical && !isSelf && (
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              data-testid={`button-delete-admin-${a.id}`}
                            >
                              <Trash2 size={14} />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>{t("admin.staff.deleteTitle", "Delete this admin?")}</AlertDialogTitle>
                              <AlertDialogDescription>
                                {t("admin.staff.deleteDesc", "{name} will lose all admin access. This cannot be undone.").replace("{name}", a.fullName)}
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>{t("common.cancel", "Cancel")}</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(a.id)}
                                data-testid={`button-confirm-delete-admin-${a.id}`}
                              >
                                {t("common.delete", "Delete")}
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
        </AdminCard>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? t("admin.staff.editTitle", "Edit admin") : t("admin.staff.add", "Add admin")}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.staff.fullName", "Full name")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          className="bg-white/5 border-white/10"
                          data-testid="input-admin-name"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.staff.email", "Email")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          disabled={!!editing}
                          className="bg-white/5 border-white/10"
                          data-testid="input-admin-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="adminRole"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.staff.role", "Role")}</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={(v) => onRoleChange(v as AdminRole)}
                        disabled={
                          !!editing &&
                          editing.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
                        }
                      >
                        <SelectTrigger
                          className="bg-white/5 border-white/10"
                          data-testid="select-admin-role"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {ADMIN_ROLES.map((r) => (
                            <SelectItem key={r} value={r}>
                              {ADMIN_ROLE_LABELS[r]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-1.5">
                        <KeyRound size={12} />
                        {editing ? t("admin.staff.newPassword", "New password (optional)") : t("admin.staff.tempPassword", "Temporary password")}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          placeholder={editing ? t("admin.staff.pwLeaveBlank", "Leave blank to keep current") : t("admin.staff.pwMin6", "Min 6 chars")}
                          className="bg-white/5 border-white/10"
                          data-testid="input-admin-password"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-xl border border-white/5 bg-white/[0.02] px-4 py-3">
                    <div>
                      <FormLabel className="text-sm">{t("admin.staff.active", "Active")}</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        {t("admin.staff.disabledHint", "Disabled admins cannot sign in.")}
                      </p>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        disabled={
                          !!editing &&
                          editing.email?.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
                        }
                        data-testid="switch-admin-active"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4">
                <p className="text-sm font-semibold mb-3">{t("admin.staff.col.perms", "Permissions")}</p>
                {form.watch("adminRole") === "super_admin" ? (
                  <p className="text-xs text-muted-foreground">
                    {t("admin.staff.superHint", "Super Admin has full access to everything (cannot be limited).")}
                  </p>
                ) : (
                  <div className="space-y-4">
                    {ADMIN_PERMISSION_GROUPS.map((g) => (
                      <div key={g.key}>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                          {g.label}
                        </p>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {g.perms.map((k) => (
                            <label
                              key={k}
                              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/[0.03] border border-white/5 cursor-pointer"
                            >
                              <span className="text-xs">{ADMIN_PERMISSION_LABELS[k]}</span>
                              <Switch
                                checked={!!perms[k]}
                                onCheckedChange={(v) =>
                                  setPerms((prev) => ({ ...prev, [k]: !!v }))
                                }
                                data-testid={`switch-perm-${k}`}
                              />
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setDialogOpen(false)}
                  data-testid="button-cancel-admin-form"
                >
                  {t("common.cancel", "Cancel")}
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl"
                  disabled={createMut.isPending || updateMut.isPending}
                  data-testid="button-save-admin"
                >
                  {(createMut.isPending || updateMut.isPending) && (
                    <Loader2 size={14} className="mr-1.5 rtl:mr-0 rtl:ml-1.5 animate-spin" />
                  )}
                  {editing ? t("admin.staff.saveChanges", "Save changes") : t("admin.staff.create", "Create admin")}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
