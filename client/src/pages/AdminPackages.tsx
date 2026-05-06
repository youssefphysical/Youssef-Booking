import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { Search, Package as PackageIcon, ExternalLink, Users } from "lucide-react";
import { usePackages } from "@/hooks/use-packages";
import { useClients } from "@/hooks/use-clients";
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
  const totalRemaining = list
    .filter((p) => p.isActive)
    .reduce((sum, p) => sum + (p.totalSessions - p.usedSessions), 0);

  return (
    <div className="admin-shell">
      <div className="admin-container">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">
          {t("admin.packagesPage.kicker")}
        </p>
        <h1 className="text-3xl font-display font-bold" data-testid="text-packages-title">
          {t("admin.packagesPage.title")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("admin.packagesPage.summary")
            .replace("{active}", String(totalActive))
            .replace("{remaining}", String(totalRemaining))}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={t("admin.packagesPage.searchPh")}
            className="pl-9 bg-white/5 border-white/10"
            data-testid="input-search-packages"
          />
        </div>
        <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
          <SelectTrigger className="bg-white/5 border-white/10 w-40" data-testid="select-package-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("admin.packagesPage.activeOnly")}</SelectItem>
            <SelectItem value="closed">{t("admin.packagesPage.closedOnly")}</SelectItem>
            <SelectItem value="all">{t("admin.packagesPage.allFilter")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-muted-foreground">
          <PackageIcon className="mx-auto text-muted-foreground/40 mb-3" size={32} />
          {q
            ? t("admin.packagesPage.noMatch")
            : t("admin.packagesPage.noneYet")}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {filtered.map((p, i) => {
            const owner = p.user || clientById.get(p.userId);
            const partner = p.partnerUserId ? clientById.get(p.partnerUserId) : null;
            const def = PACKAGE_DEFINITIONS[p.type];
            const remaining = p.totalSessions - p.usedSessions;
            const pct = Math.round((p.usedSessions / Math.max(p.totalSessions, 1)) * 100);
            const bonus = def?.bonusSessions ?? 0;
            const base = (def?.sessions ?? p.totalSessions) - bonus;

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
                      <p className="text-xs text-amber-300/80 mt-1 inline-flex items-center gap-1.5">
                        <Users size={11} /> {t("admin.packagesPage.partner")}: {partner.fullName}
                      </p>
                    )}
                  </div>
                  <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-primary/10 border border-primary/20 text-primary whitespace-nowrap">
                    {def?.label || p.type}
                  </span>
                </div>

                <div className="grid grid-cols-4 gap-2 mb-3">
                  <PackageStat label={t("admin.packagesPage.statBase")} value={base} />
                  <PackageStat label={t("admin.packagesPage.statBonus")} value={bonus} accent={bonus > 0 ? "text-amber-300" : undefined} />
                  <PackageStat label={t("admin.packagesPage.statTotal")} value={p.totalSessions} accent="text-primary" />
                  <PackageStat label={t("admin.packagesPage.statLeft")} value={remaining} accent="text-emerald-300" />
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
