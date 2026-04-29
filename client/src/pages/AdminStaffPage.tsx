import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Plus, Trash2, Edit3, ShieldCheck, ShieldOff, Loader2, KeyRound } from "lucide-react";
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
      toast({ title: "Admin created" });
      setDialogOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: "Could not create admin", description: e.message, variant: "destructive" }),
  });

  const updateMut = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const res = await apiRequest("PATCH", `/api/admin/admins/${id}`, body);
      return await res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({ title: "Admin updated" });
      setDialogOpen(false);
    },
    onError: (e: Error) =>
      toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/admin/admins/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/admin/admins"] });
      toast({ title: "Admin deleted" });
    },
    onError: (e: Error) =>
      toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
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
            title: "Password too short",
            description: "Use at least 6 characters or leave blank.",
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
          title: "Password required",
          description: "New admins need a temporary password (min 6 chars).",
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

  return (
    <div className="md:pl-64 p-6 pt-20 md:pt-8 min-h-screen max-w-5xl">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-display font-bold" data-testid="text-staff-title">
            Admin & Staff
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage who can access the admin panel and what they can do.
          </p>
        </div>
        <Button
          className="rounded-xl"
          onClick={openCreate}
          data-testid="button-add-admin"
        >
          <Plus size={14} className="mr-1.5" /> Add admin
        </Button>
      </div>

      <div className="rounded-3xl border border-white/5 bg-card/60 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-muted-foreground">Loading…</div>
        ) : admins.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">No admin staff yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-[10px] uppercase tracking-wider text-muted-foreground bg-white/[0.02]">
              <tr>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Permissions</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
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
                          className="ml-2 text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded border border-amber-500/30 bg-amber-500/10 text-amber-300"
                          data-testid={`badge-super-${a.id}`}
                        >
                          You
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{a.email}</td>
                    <td className="px-4 py-3">
                      <span className="text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border border-primary/20 bg-primary/10 text-primary">
                        {ADMIN_ROLE_LABELS[role]}
                      </span>
                      {isLegacy && (
                        <span className="ml-1.5 text-[9px] uppercase tracking-wider text-muted-foreground">
                          legacy
                        </span>
                      )}
                    </td>
                    <td
                      className="px-4 py-3 text-muted-foreground text-xs"
                      data-testid={`text-perms-${a.id}`}
                    >
                      {role === "super_admin" ? "All" : `${permsCount}/${totalPerms}`}
                    </td>
                    <td className="px-4 py-3">
                      {active ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                          <ShieldCheck size={12} /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <ShieldOff size={12} /> Disabled
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right space-x-1.5 whitespace-nowrap">
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
                              <AlertDialogTitle>Delete this admin?</AlertDialogTitle>
                              <AlertDialogDescription>
                                {a.fullName} will lose all admin access. This cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => deleteMut.mutate(a.id)}
                                data-testid={`button-confirm-delete-admin-${a.id}`}
                              >
                                Delete
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
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit admin" : "Add admin"}</DialogTitle>
          </DialogHeader>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-3">
                <FormField
                  control={form.control}
                  name="fullName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Full name</FormLabel>
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
                      <FormLabel>Email</FormLabel>
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
                      <FormLabel>Role</FormLabel>
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
                        {editing ? "New password (optional)" : "Temporary password"}
                      </FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="password"
                          autoComplete="new-password"
                          placeholder={editing ? "Leave blank to keep current" : "Min 6 chars"}
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
                      <FormLabel className="text-sm">Active</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Disabled admins cannot sign in.
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
                <p className="text-sm font-semibold mb-3">Permissions</p>
                {form.watch("adminRole") === "super_admin" ? (
                  <p className="text-xs text-muted-foreground">
                    Super Admin has full access to everything (cannot be limited).
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
                  Cancel
                </Button>
                <Button
                  type="submit"
                  className="rounded-xl"
                  disabled={createMut.isPending || updateMut.isPending}
                  data-testid="button-save-admin"
                >
                  {(createMut.isPending || updateMut.isPending) && (
                    <Loader2 size={14} className="mr-1.5 animate-spin" />
                  )}
                  {editing ? "Save changes" : "Create admin"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
