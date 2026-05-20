import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  Search,
  Package as PackageIcon,
  ExternalLink,
  Users,
  Sparkles,
  CheckCircle2,
  ShieldCheck,
  X as XIcon,
  Loader2,
} from "lucide-react";
import { usePackages } from "@/hooks/use-packages";
import { useClients } from "@/hooks/use-clients";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PACKAGE_DEFINITIONS, type PackageWithUser, type UserResponse } from "@shared/schema";
import { useTranslation } from "@/i18n";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminEmptyState,
  AdminSkeleton,
} from "@/components/admin/primitives";

export default function AdminPackages() {
  const { t } = useTranslation();
  const { data: packages = [], isLoading } = usePackages({ includeUser: true });
  const { data: clients = [] } = useClients();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "closed">("active");

  const list = packages as PackageWithUser[];
  const clientById = useMemo(() => {
    const m = new Map<number, UserResponse>();
    clients.forEach((c) => m.set(c.id, c));
    return m;
  }, [clients]);

  const filtered = useMemo(() => {
    return list.filter((p) => {
      if (filter === "active" && !p.isActive) return false;
      if (filter === "closed" && p.isActive) return false;
      if (q) {
        const owner = p.user || clientById.get(p.userId);
        if (!owner) return false;
        const s = q.toLowerCase();
        return (
          owner.fullName.toLowerCase().includes(s) ||
          (owner.email || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [list, q, filter, clientById]);

  const totalActive = list.filter((p) => p.isActive).length;
  const totalClosed = list.filter((p) => !p.isActive).length;
  const totalRemaining = list
    .filter((p) => p.isActive)
    .reduce((sum, p) => sum + (p.totalSessions - p.usedSessions), 0);
  const totalDelivered = list.reduce((sum, p) => sum + p.usedSessions, 0);

  const hasActiveFilters = !!q || filter !== "active";
  const clearAll = () => {
    setQ("");
    setFilter("active");
  };

  return (
    <div className="admin-shell">
      <div className="admin-container space-y-5">
        <AdminPageHeader
          eyebrow={t("admin.packagesPage.kicker")}
          title={t("admin.packagesPage.title")}
          subtitle={t("admin.packagesPage.summary")
            .replace("{active}", String(totalActive))
            .replace("{remaining}", String(totalRemaining))}
          testId="text-packages-title"
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <AdminStatCard
            icon={<PackageIcon size={16} />}
            label={t("admin.packagesPage.statActive", "Active")}
            value={totalActive}
            tone="info"
            animate
            testId="stat-pkgs-active"
          />
          <AdminStatCard
            icon={<Sparkles size={16} />}
            label={t("admin.packagesPage.statRemaining", "Sessions left")}
            value={totalRemaining}
            tone="schedule"
            animate
            testId="stat-pkgs-remaining"
          />
          <AdminStatCard
            icon={<CheckCircle2 size={16} />}
            label={t("admin.packagesPage.statDelivered", "Sessions delivered")}
            value={totalDelivered}
            tone="success"
            animate
            testId="stat-pkgs-delivered"
          />
          <AdminStatCard
            icon={<PackageIcon size={16} />}
            label={t("admin.packagesPage.statClosed", "Closed")}
            value={totalClosed}
            tone="muted"
            animate
            testId="stat-pkgs-closed"
          />
        </div>

        <VerificationQueue />

        <AdminCard padded={false} className="p-3 sm:p-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search
                size={14}
                className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground/70"
              />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder={t("admin.packagesPage.searchPh")}
                className="ps-9 h-9 bg-white/5 border-white/10"
                data-testid="input-search-packages"
              />
            </div>
            <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
              <SelectTrigger
                className="w-[150px] h-9 bg-white/5 border-white/10 text-xs"
                data-testid="select-package-filter"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">{t("admin.packagesPage.activeOnly")}</SelectItem>
                <SelectItem value="closed">{t("admin.packagesPage.closedOnly")}</SelectItem>
                <SelectItem value="all">{t("admin.packagesPage.allFilter")}</SelectItem>
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/5 transition-colors"
                data-testid="button-clear-pkg-filters"
              >
                {t("admin.bookings.clear", "Clear")}
              </button>
            )}
            <span className="ms-auto text-[11px] sm:text-xs text-muted-foreground tabular-nums">
              {filtered.length} / {list.length}
            </span>
          </div>
        </AdminCard>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <AdminSkeleton key={i} className="h-28" rounded="2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <AdminEmptyState
            icon={<PackageIcon size={28} />}
            title={
              hasActiveFilters
                ? t("admin.packagesPage.noMatch")
                : t("admin.packagesPage.noneYet")
            }
            body={
              hasActiveFilters
                ? t(
                    "admin.packagesPage.noMatchHint",
                    "Try clearing filters or switching to All.",
                  )
                : undefined
            }
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filtered.map((p, i) => {
              const owner = p.user || clientById.get(p.userId);
              const partner = p.partnerUserId ? clientById.get(p.partnerUserId) : null;
              const def = PACKAGE_DEFINITIONS[p.type];
              const remaining = p.totalSessions - p.usedSessions;
              const pct = Math.round((p.usedSessions / Math.max(p.totalSessions, 1)) * 100);
              const bonus = (p as any).bonusSessions ?? def?.bonusSessions ?? 0;
              const base =
                (p as any).paidSessions ?? ((def?.sessions ?? p.totalSessions) - bonus);
              const displayLabel = (p as any).name || def?.label || p.type;

              return (
                <motion.div
                  key={p.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.2) }}
                  className={`rounded-2xl border p-5 card-lift ${p.isActive ? "border-primary/30 bg-gradient-to-br from-primary/10 via-primary/[0.04] to-transparent" : "border-white/5 bg-card/60 opacity-70"}`}
                  data-testid={`packages-row-${p.id}`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <Link
                        href={`/admin/clients/${p.userId}`}
                        data-testid={`link-package-client-${p.id}`}
                        className="font-semibold hover:text-primary inline-flex items-center gap-1.5"
                      >
                        {owner?.fullName || t("admin.packagesPage.unknown")}
                        <ExternalLink size={11} />
                      </Link>
                      <p className="text-xs text-muted-foreground mt-0.5">{owner?.email}</p>
                      {def?.isDuo && partner && (
                        <p className="text-xs text-cyan-300/80 mt-1 inline-flex items-center gap-1.5">
                          <Users size={11} /> {t("admin.packagesPage.partner")}: {partner.fullName}
                        </p>
                      )}
                    </div>
                    <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary whitespace-nowrap">
                      {displayLabel}
                    </span>
                  </div>

                  <div className="grid grid-cols-4 gap-2 mb-3">
                    <PackageStat label={t("admin.packagesPage.statBase")} value={base} />
                    <PackageStat
                      label={t("admin.packagesPage.statBonus")}
                      value={bonus}
                      accent={bonus > 0 ? "text-cyan-300" : undefined}
                    />
                    <PackageStat
                      label={t("admin.packagesPage.statTotal")}
                      value={p.totalSessions}
                      accent="text-primary"
                    />
                    <PackageStat
                      label={t("admin.packagesPage.statLeft")}
                      value={remaining}
                      accent="text-emerald-300"
                    />
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                    <span>
                      {t("admin.packagesPage.usedOf")
                        .replace("{used}", String(p.usedSessions))
                        .replace("{total}", String(p.totalSessions))}
                    </span>
                    <span>
                      {p.purchasedAt &&
                        t("admin.packagesPage.startedOn").replace(
                          "{date}",
                          format(new Date(p.purchasedAt), "MMM d, yyyy"),
                        )}
                    </span>
                  </div>
                  <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                      className="h-full bg-gradient-to-r from-primary via-primary to-primary/60"
                    />
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function VerificationQueue() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: items = [], isLoading } = useQuery<any[]>({
    queryKey: ["/api/admin/package-verification-requests"],
  });
  const decide = useMutation({
    mutationFn: async ({ id, body }: { id: number; body: any }) => {
      const r = await apiRequest(
        "PATCH",
        `/api/admin/package-verification-requests/${id}`,
        body,
      );
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/package-verification-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
    },
    onError: (e: any) => toast({ title: e?.message || "Failed", variant: "destructive" }),
  });

  if (isLoading) return null;
  if (!items.length) return null;

  return (
    <AdminCard padded={false} className="p-4 sm:p-5 border-cyan-500/30 bg-cyan-500/[0.04]">
      <div className="flex items-center gap-2 mb-3">
        <ShieldCheck size={16} className="text-primary" />
        <h2 className="text-sm font-semibold" data-testid="text-verification-queue-title">
          {t("admin.verifications.title", "Package verification queue")}
        </h2>
        <span className="ms-auto text-[11px] text-muted-foreground tabular-nums">{items.length}</span>
      </div>
      <div className="grid grid-cols-1 gap-3" data-testid="grid-verification-queue">
        {items.map((row: any) => {
          const payload = row.verificationRequestPayload || {};
          return (
            <div
              key={row.id}
              className="rounded-xl border border-white/10 bg-card/60 p-3 sm:p-4"
              data-testid={`row-verification-${row.id}`}
            >
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <p className="font-semibold text-sm">
                    {row.user?.fullName || t("admin.packagesPage.unknown")}
                  </p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">
                    {row.user?.email} · {payload.requestedType || row.type}
                    {payload.purchaseDate ? ` · ${payload.purchaseDate}` : ""}
                  </p>
                  {payload.notes && (
                    <p className="text-xs mt-1 text-muted-foreground italic">"{payload.notes}"</p>
                  )}
                </div>
                {row.verificationAttachments && (
                  <a
                    href={row.verificationAttachments}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary hover:underline shrink-0"
                    data-testid={`link-receipt-${row.id}`}
                  >
                    {t("admin.verifications.viewReceipt", "View receipt")} →
                  </a>
                )}
              </div>
              <div className="flex flex-wrap gap-2 pt-2 border-t border-white/5">
                <Button
                  size="sm"
                  onClick={() => {
                    const sessionsStr = window.prompt(
                      t("admin.verifications.promptSessions", "Total sessions to grant:"),
                      String(row.totalSessions || 10),
                    );
                    if (sessionsStr === null) return;
                    const total = Number(sessionsStr);
                    if (!Number.isFinite(total) || total <= 0) return;
                    const expiry = window.prompt(
                      t("admin.verifications.promptExpiry", "Expiry date (YYYY-MM-DD), blank = +60 days:"),
                      "",
                    );
                    decide.mutate({
                      id: row.id,
                      body: {
                        decision: "approve",
                        totalSessions: total,
                        expiryDate: expiry || undefined,
                      },
                    });
                  }}
                  disabled={decide.isPending}
                  data-testid={`button-approve-verification-${row.id}`}
                >
                  {decide.isPending ? <Loader2 size={12} className="animate-spin mr-1" /> : <CheckCircle2 size={12} className="mr-1" />}
                  {t("admin.verifications.approve", "Approve")}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    const note = window.prompt(
                      t("admin.verifications.promptReject", "Reason (sent to client):"),
                      "",
                    );
                    if (note === null) return;
                    decide.mutate({
                      id: row.id,
                      body: { decision: "reject", note: note || undefined },
                    });
                  }}
                  disabled={decide.isPending}
                  data-testid={`button-reject-verification-${row.id}`}
                >
                  <XIcon size={12} className="mr-1" />
                  {t("admin.verifications.reject", "Reject")}
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </AdminCard>
  );
}

function PackageStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent?: string;
}) {
  return (
    <div className="rounded-lg bg-white/5 border border-white/5 px-2 py-1.5 text-center">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p
        className={`text-base font-display font-bold tabular-nums leading-tight mt-0.5 ${accent || ""}`}
      >
        {value}
      </p>
    </div>
  );
}
