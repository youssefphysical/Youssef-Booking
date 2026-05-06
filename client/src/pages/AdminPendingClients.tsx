import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  CheckCircle2,
  XCircle,
  Mail,
  Phone,
  ExternalLink,
  ShieldCheck,
  Package as PackageIcon,
  Inbox,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { AdminTabs } from "@/pages/AdminDashboard";
import { UserAvatar } from "@/components/UserAvatar";
import { useTranslation } from "@/i18n";
import type { Package, UserResponse } from "@shared/schema";

type PendingRow = {
  client: UserResponse;
  pendingPackage: Package | null;
};

export default function AdminPendingClients() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [notes, setNotes] = useState<Record<number, string>>({});

  const { data: rows = [], isLoading } = useQuery<PendingRow[]>({
    queryKey: ["/api/admin/clients/pending"],
    queryFn: async () => {
      const r = await fetch("/api/admin/clients/pending", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load pending clients");
      return r.json();
    },
    refetchInterval: 30_000,
  });

  const approveMut = useMutation({
    mutationFn: async (vars: { id: number; note?: string | null }) => {
      const r = await apiRequest("POST", `/api/admin/clients/${vars.id}/approve`, {
        note: vars.note ?? null,
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: t("admin.pending.approved", "Client approved") });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
    },
    onError: (e: any) =>
      toast({
        title: t("admin.pending.approveFailed", "Could not approve"),
        description: e?.message ?? "",
        variant: "destructive",
      }),
  });

  const rejectMut = useMutation({
    mutationFn: async (vars: { id: number; reason?: string | null }) => {
      const r = await apiRequest("POST", `/api/admin/clients/${vars.id}/reject`, {
        reason: vars.reason ?? null,
      });
      return r.json();
    },
    onSuccess: () => {
      toast({ title: t("admin.pending.rejected", "Client rejected") });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/clients/pending"] });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (e: any) =>
      toast({
        title: t("admin.pending.rejectFailed", "Could not reject"),
        description: e?.message ?? "",
        variant: "destructive",
      }),
  });

  return (
    <div className="container mx-auto px-5 py-10 max-w-6xl">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-display font-bold text-gradient-blue">
          {t("admin.pending.title", "Pending Client Requests")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "admin.pending.subtitle",
            "New signups awaiting your approval. Confirm payment over WhatsApp first, then approve to unlock booking.",
          )}
        </p>
      </motion.div>

      <AdminTabs />

      {isLoading ? (
        <div className="text-sm text-muted-foreground py-12 text-center" data-testid="text-pending-loading">
          {t("common.loading", "Loading…")}
        </div>
      ) : rows.length === 0 ? (
        <div
          data-testid="empty-pending"
          className="rounded-2xl border border-white/10 bg-card/40 p-10 text-center"
        >
          <Inbox className="mx-auto mb-3 text-muted-foreground" size={32} />
          <p className="text-sm font-semibold">
            {t("admin.pending.empty", "No pending requests right now")}
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("admin.pending.emptyHint", "All caught up — new signups will appear here.")}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {rows.map(({ client, pendingPackage }) => {
            const note = notes[client.id] ?? "";
            const busy = approveMut.isPending || rejectMut.isPending;
            return (
              <motion.div
                key={client.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                data-testid={`card-pending-${client.id}`}
                className="rounded-2xl border border-amber-300/20 bg-gradient-to-br from-amber-500/[0.04] to-card/60 p-5 flex flex-col gap-4"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar src={client.profilePictureUrl} name={client.fullName} size={48} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold truncate" data-testid={`text-pending-name-${client.id}`}>
                        {client.fullName}
                      </p>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-amber-300 bg-amber-300/10 px-2 py-0.5 rounded-full">
                        {t("admin.pending.badge", "Pending")}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground mt-1">
                      <span className="inline-flex items-center gap-1">
                        <Mail size={12} /> {client.email}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Phone size={12} /> {client.phone}
                      </span>
                    </div>
                    {client.primaryGoal && (
                      <p className="text-[11px] text-muted-foreground mt-1">
                        {t("admin.pending.goal", "Goal")}:{" "}
                        <span className="text-foreground/80 font-medium">
                          {String(client.primaryGoal).replace("_", " ")}
                        </span>
                        {client.weeklyFrequency
                          ? ` • ${client.weeklyFrequency}×/${t("admin.pending.week", "wk")}`
                          : ""}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/admin/clients/${client.id}`}
                    data-testid={`link-pending-detail-${client.id}`}
                    className="text-xs text-muted-foreground hover:text-primary inline-flex items-center gap-1 shrink-0"
                  >
                    {t("admin.pending.open", "Open")} <ExternalLink size={12} />
                  </Link>
                </div>

                {pendingPackage ? (
                  <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div className="inline-flex items-center gap-2 text-sm font-semibold">
                        <PackageIcon size={14} className="text-primary" />
                        {pendingPackage.name ?? pendingPackage.type}
                      </div>
                      <p className="text-xs font-bold text-primary">
                        {pendingPackage.totalPrice
                          ? `AED ${pendingPackage.totalPrice.toLocaleString()}`
                          : "—"}
                      </p>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      {pendingPackage.totalSessions} {t("admin.pending.sessions", "sessions")}
                      {pendingPackage.bonusSessions
                        ? ` (+${pendingPackage.bonusSessions} bonus)`
                        : ""}
                      {pendingPackage.expiryDate ? ` • exp ${pendingPackage.expiryDate}` : ""}
                    </p>
                    <p className="text-[11px] text-amber-300/90 mt-1 inline-flex items-center gap-1">
                      <ShieldCheck size={11} />
                      {t(
                        "admin.pending.paymentHint",
                        "Approving will mark payment paid + activate the package.",
                      )}
                    </p>
                  </div>
                ) : (
                  <div
                    className="rounded-xl border border-white/10 bg-white/[0.02] p-3 text-xs text-muted-foreground"
                    data-testid={`text-no-pkg-${client.id}`}
                  >
                    {t(
                      "admin.pending.noPackage",
                      "No package selected on signup. You can assign one from the client page.",
                    )}
                  </div>
                )}

                <Textarea
                  rows={2}
                  placeholder={t(
                    "admin.pending.notePlaceholder",
                    "Optional internal note (visible on the package history)…",
                  )}
                  value={note}
                  onChange={(e) =>
                    setNotes((s) => ({ ...s, [client.id]: e.target.value }))
                  }
                  className="bg-white/5 border-white/10 text-xs"
                  data-testid={`input-pending-note-${client.id}`}
                />

                <div className="flex gap-2">
                  <Button
                    onClick={() =>
                      approveMut.mutate({ id: client.id, note: note || null })
                    }
                    disabled={busy}
                    data-testid={`button-approve-${client.id}`}
                    className="flex-1 bg-emerald-500/90 hover:bg-emerald-500 text-white"
                  >
                    <CheckCircle2 size={14} className="mr-1.5" />
                    {t("admin.pending.approve", "Approve")}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() =>
                      rejectMut.mutate({ id: client.id, reason: note || null })
                    }
                    disabled={busy}
                    data-testid={`button-reject-${client.id}`}
                    className="flex-1 border-rose-400/40 text-rose-300 hover:bg-rose-500/10"
                  >
                    <XCircle size={14} className="mr-1.5" />
                    {t("admin.pending.reject", "Reject")}
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
