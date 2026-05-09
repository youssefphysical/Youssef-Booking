import { useMemo, useState } from "react";
import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Phone,
  MapPin,
  Search,
  ExternalLink,
  Users,
  ShieldCheck,
  Package as PackageIcon,
  Crown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
  AdminStatCard,
  AdminEmptyState,
  AdminSkeletonStack,
} from "@/components/admin/primitives";
import { cn } from "@/lib/utils";
import { useClients } from "@/hooks/use-clients";
import { usePackages } from "@/hooks/use-packages";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { whatsappClientUrl } from "@/lib/whatsapp";
import {
  PACKAGE_DEFINITIONS,
  VIP_TIER_LABELS,
  normaliseTier,
  type UserResponse,
  type PackageWithUser,
} from "@shared/schema";
import { SiWhatsapp } from "react-icons/si";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge, TierBadge } from "@/components/VerifiedBadge";
import { HealthBadge } from "@/components/HealthBadge";
import { useTranslation } from "@/i18n";

type Row = {
  client: UserResponse;
  activePkg: PackageWithUser | null;
  remaining: number;
  packageLabel: string;
  packageType: string;
};

const PACKAGE_FILTER_KEYS = ["all", "10", "20", "25", "duo30", "single", "trial", "none"] as const;
type PackageFilterKey = (typeof PACKAGE_FILTER_KEYS)[number];

const PACKAGE_FILTER_I18N: Record<PackageFilterKey, { key: string; fallback: string }> = {
  all: { key: "admin.clients.pkgAll", fallback: "All packages" },
  "10": { key: "admin.clients.pkgEssential", fallback: "Essential (10+1)" },
  "20": { key: "admin.clients.pkgProgress", fallback: "Progress (20+3)" },
  "25": { key: "admin.clients.pkgElite", fallback: "Elite (25+5)" },
  duo30: { key: "admin.clients.pkgDuo", fallback: "Duo Performance" },
  single: { key: "admin.clients.pkgSingle", fallback: "Single Session" },
  trial: { key: "admin.clients.pkgTrial", fallback: "Intro Assessment" },
  none: { key: "admin.clients.pkgNone", fallback: "No package" },
};

export default function AdminClients() {
  const { t } = useTranslation();
  const { data: clients = [], isLoading } = useClients();
  const { data: packagesData = [] } = usePackages({ includeUser: true });
  const packages = packagesData as PackageWithUser[];

  const [q, setQ] = useState("");
  const [verifiedFilter, setVerifiedFilter] = useState<"all" | "verified" | "unverified">("all");
  const [packageFilter, setPackageFilter] = useState<PackageFilterKey>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "remaining" | "joined">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const toggleSort = (field: "name" | "remaining" | "joined") => {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir(field === "remaining" ? "desc" : "asc");
    }
  };

  const rows: Row[] = useMemo(() => {
    const activeByUser = new Map<number, PackageWithUser>();
    packages
      .filter((p) => p.isActive)
      .forEach((p) => {
        const existing = activeByUser.get(p.userId);
        if (!existing) activeByUser.set(p.userId, p);
        else if (
          (p.purchasedAt ? new Date(p.purchasedAt).getTime() : 0) >
          (existing.purchasedAt ? new Date(existing.purchasedAt).getTime() : 0)
        ) {
          activeByUser.set(p.userId, p);
        }
      });

    return clients.map((c) => {
      const pkg = activeByUser.get(c.id) || null;
      const remaining = pkg ? pkg.totalSessions - pkg.usedSessions : 0;
      const def = pkg ? PACKAGE_DEFINITIONS[pkg.type] : null;
      return {
        client: c,
        activePkg: pkg,
        remaining,
        packageLabel: def?.label || (pkg ? pkg.type : "—"),
        packageType: pkg?.type || "none",
      };
    });
  }, [clients, packages]);

  const filtered = useMemo(() => {
    const out = rows.filter((r) => {
      if (verifiedFilter === "verified" && !r.client.isVerified) return false;
      if (verifiedFilter === "unverified" && r.client.isVerified) return false;
      if (packageFilter !== "all" && r.packageType !== packageFilter) return false;
      if (statusFilter !== "all" && (r.client.clientStatus || "incomplete") !== statusFilter) return false;
      if (q) {
        const s = q.toLowerCase();
        const c = r.client;
        const matches =
          c.fullName.toLowerCase().includes(s) ||
          (c.email || "").toLowerCase().includes(s) ||
          (c.phone || "").toLowerCase().includes(s);
        if (!matches) return false;
      }
      return true;
    });
    const sign = sortDir === "asc" ? 1 : -1;
    out.sort((a, b) => {
      if (sortBy === "remaining") return (a.remaining - b.remaining) * sign;
      if (sortBy === "joined") {
        const av = a.client.id;
        const bv = b.client.id;
        return (av - bv) * sign;
      }
      return a.client.fullName.localeCompare(b.client.fullName) * sign;
    });
    return out;
  }, [rows, q, verifiedFilter, packageFilter, statusFilter, sortBy, sortDir]);

  const totalVerified = rows.filter((r) => r.client.isVerified).length;
  const totalActivePkg = rows.filter((r) => r.activePkg).length;
  const totalRemaining = rows.reduce((s, r) => s + r.remaining, 0);

  const hasActiveFilters =
    !!q || verifiedFilter !== "all" || packageFilter !== "all" || statusFilter !== "all";
  const clearAll = () => {
    setQ("");
    setVerifiedFilter("all");
    setPackageFilter("all");
    setStatusFilter("all");
  };

  return (
    <div className="admin-shell">
      <div className="admin-container space-y-5">
        <AdminPageHeader
          eyebrow={t("admin.clients.kicker")}
          title={t("admin.clientsTitle")}
          subtitle={t(
            "admin.clients.subtitle",
            "Search, sort and act on every client in one place.",
          )}
          testId="text-clients-title"
        />

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <AdminStatCard
            icon={<Users size={16} />}
            label={t("admin.clients.statTotal")}
            value={rows.length}
            tone="info"
            animate
            testId="stat-clients-total"
          />
          <AdminStatCard
            icon={<ShieldCheck size={16} />}
            label={t("admin.clients.statVerified")}
            value={totalVerified}
            tone="success"
            animate
            testId="stat-clients-verified"
          />
          <AdminStatCard
            icon={<PackageIcon size={16} />}
            label={t("admin.clients.statActivePlan")}
            value={totalActivePkg}
            tone="warning"
            animate
            testId="stat-clients-active-plan"
          />
          <AdminStatCard
            icon={<Crown size={16} />}
            label={t("admin.clients.statSessionsRemaining")}
            value={totalRemaining}
            tone="schedule"
            animate
            testId="stat-clients-sessions-remaining"
          />
        </div>

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
                placeholder={t("admin.clients.searchPh")}
                className="ps-9 h-9 bg-white/5 border-white/10"
                data-testid="input-search-clients"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger
                className="w-[140px] h-9 bg-white/5 border-white/10 text-xs"
                data-testid="select-status-filter"
              >
                <SelectValue placeholder={t("admin.clients.filterStatus", "Status")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.clients.statusAll", "All statuses")}</SelectItem>
                <SelectItem value="active">{t("admin.clients.statusActive", "Active")}</SelectItem>
                <SelectItem value="frozen">{t("admin.clients.statusFrozen", "Frozen")}</SelectItem>
                <SelectItem value="cancelled">{t("admin.clients.statusCancelled", "Cancelled")}</SelectItem>
                <SelectItem value="expired">{t("admin.clients.statusExpired", "Expired")}</SelectItem>
                <SelectItem value="completed">{t("admin.clients.statusCompleted", "Completed")}</SelectItem>
                <SelectItem value="incomplete">{t("admin.clients.statusIncomplete", "Incomplete")}</SelectItem>
              </SelectContent>
            </Select>
            <Select value={verifiedFilter} onValueChange={(v) => setVerifiedFilter(v as any)}>
              <SelectTrigger
                className="w-[140px] h-9 bg-white/5 border-white/10 text-xs"
                data-testid="select-verified-filter"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("admin.clients.filterAll")}</SelectItem>
                <SelectItem value="verified">{t("admin.clients.filterVerifiedOnly")}</SelectItem>
                <SelectItem value="unverified">{t("admin.clients.filterUnverified")}</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={packageFilter}
              onValueChange={(v) => setPackageFilter(v as PackageFilterKey)}
            >
              <SelectTrigger
                className="w-[160px] h-9 bg-white/5 border-white/10 text-xs"
                data-testid="select-package-filter"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PACKAGE_FILTER_KEYS.map((k) => {
                  const meta = PACKAGE_FILTER_I18N[k];
                  return (
                    <SelectItem key={k} value={k}>
                      {t(meta.key, meta.fallback)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearAll}
                className="h-9 px-3 text-xs text-muted-foreground hover:text-foreground rounded-lg hover:bg-white/5 transition-colors"
                data-testid="button-clear-clients-filters"
              >
                {t("admin.bookings.clear", "Clear")}
              </button>
            )}
            <span className="ms-auto text-[11px] sm:text-xs text-muted-foreground tabular-nums">
              {t("admin.clients.showing")
                .replace("{n}", String(filtered.length))
                .replace("{total}", String(rows.length))}
            </span>
          </div>
        </AdminCard>

        {isLoading ? (
          <AdminSkeletonStack count={6} height="h-16" />
        ) : filtered.length === 0 ? (
          <AdminEmptyState
            icon={<Users size={28} />}
            title={
              hasActiveFilters
                ? t("admin.clients.noMatch")
                : t("admin.clients.noneYet")
            }
            body={
              hasActiveFilters
                ? t(
                    "admin.clients.noMatchHint",
                    "Try clearing filters or broadening your search.",
                  )
                : undefined
            }
          />
        ) : (
          <>
            {/* DESKTOP TABLE */}
            <AdminCard padded={false} className="hidden md:block overflow-hidden">
              <div className="grid grid-cols-[1.4fr_1.4fr_1fr_1.2fr_1fr_0.8fr] gap-3 px-5 py-2.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground border-b border-white/[0.06] bg-white/[0.02] sticky top-0 z-10 backdrop-blur-md">
                <SortHeader
                  label={t("admin.clients.colClient")}
                  field="name"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onClick={() => toggleSort("name")}
                />
                <div>{t("admin.clients.colEmail")}</div>
                <div>{t("admin.clients.colPhone")}</div>
                <div>{t("admin.clients.colPackage")}</div>
                <SortHeader
                  label={t("admin.clients.colSessionsLeft")}
                  field="remaining"
                  sortBy={sortBy}
                  sortDir={sortDir}
                  onClick={() => toggleSort("remaining")}
                />
                <div className="text-end">{t("admin.clients.colStatus")}</div>
              </div>
              <AnimatePresence initial={false}>
                {filtered.map((r, i) => (
                  <ClientRow key={r.client.id} row={r} index={i} />
                ))}
              </AnimatePresence>
            </AdminCard>

            {/* MOBILE CARDS */}
            <div className="md:hidden space-y-2">
              {filtered.map((r) => (
                <MobileCard key={r.client.id} row={r} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Sortable column header
function SortHeader({
  label,
  field,
  sortBy,
  sortDir,
  onClick,
}: {
  label: string;
  field: "name" | "remaining" | "joined";
  sortBy: "name" | "remaining" | "joined";
  sortDir: "asc" | "desc";
  onClick: () => void;
}) {
  const active = sortBy === field;
  const Icon = active ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`sort-${field}`}
      className={cn(
        "inline-flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] hover:text-foreground transition-colors text-start",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      {label}
      <Icon size={10} className="opacity-70" />
    </button>
  );
}

function ClientRow({ row, index }: { row: Row; index: number }) {
  const { t } = useTranslation();
  const { client, activePkg, remaining, packageLabel } = row;
  const tier = normaliseTier(client.vipTier);
  const isElite = tier === "elite" || tier === "pro_elite" || tier === "diamond_elite";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.18) }}
      className="grid grid-cols-[1.4fr_1.4fr_1fr_1.2fr_1fr_0.8fr] gap-3 px-5 py-3 items-center border-b border-white/5 last:border-b-0 hover:bg-white/[0.025] transition-colors"
      data-testid={`row-client-${client.id}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <UserAvatar
          src={client.profilePictureUrl}
          name={client.fullName}
          size={36}
          testId={`img-client-avatar-${client.id}`}
        />
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <Link
              href={`/admin/clients/${client.id}`}
              className="text-sm font-semibold truncate hover:text-primary"
              data-testid={`client-name-${client.id}`}
            >
              {client.fullName}
            </Link>
            {client.isVerified && <VerifiedBadge size="xs" testId={`badge-verified-${client.id}`} />}
            <HealthBadge health={client.health} size="xs" showLabel={false} />
          </div>
          {client.area && (
            <p className="text-[10px] text-muted-foreground truncate inline-flex items-center gap-1">
              <MapPin size={9} /> {client.area}
            </p>
          )}
        </div>
      </div>

      <div className="text-xs text-muted-foreground truncate inline-flex items-center gap-1.5">
        {client.email && (
          <>
            <Mail size={11} className="shrink-0" />
            <span className="truncate">{client.email}</span>
          </>
        )}
      </div>

      <div className="text-xs text-muted-foreground truncate inline-flex items-center gap-1.5">
        {client.phone && (
          <>
            <Phone size={11} className="shrink-0" />
            <span className="truncate">{client.phone}</span>
          </>
        )}
      </div>

      <div className="min-w-0">
        {activePkg ? (
          <>
            <p className="text-xs font-semibold truncate">{packageLabel}</p>
            <p className="text-[10px] text-muted-foreground truncate">
              {VIP_TIER_LABELS[tier]} {t("admin.clients.tier")}
            </p>
          </>
        ) : (
          <p className="text-xs text-muted-foreground italic">
            {t("admin.clients.noActivePlan")}
          </p>
        )}
      </div>

      <div>
        {activePkg ? (
          <div className="inline-flex items-center gap-2">
            <span className="text-base font-display font-bold tabular-nums">{remaining}</span>
            <span className="text-[10px] text-muted-foreground">/ {activePkg.totalSessions}</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </div>

      <div className="flex items-center justify-end gap-1.5">
        {isElite && <TierBadge tier={tier} size="xs" />}
        <Link
          href={`/admin/clients/${client.id}`}
          data-testid={`link-view-client-${client.id}`}
          className="inline-flex items-center justify-center w-8 h-8 rounded-lg border border-white/10 hover:bg-white/5 hover:border-primary/40 btn-soft"
          title={t("admin.clients.openProfile")}
        >
          <ExternalLink size={12} />
        </Link>
        {(() => {
          const url = whatsappClientUrl(client.phone);
          if (!url) return null;
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`button-whatsapp-${client.id}`}
              className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 btn-soft"
              title={t("admin.clients.whatsapp")}
            >
              <SiWhatsapp size={12} />
            </a>
          );
        })()}
      </div>
    </motion.div>
  );
}

function MobileCard({ row }: { row: Row }) {
  const { t } = useTranslation();
  const { client, activePkg, remaining, packageLabel } = row;
  const tier = normaliseTier(client.vipTier);
  const isElite = tier === "elite" || tier === "pro_elite" || tier === "diamond_elite";

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/10 bg-card/40 p-4"
      data-testid={`client-card-${client.id}`}
    >
      <div className="flex items-start gap-3">
        <UserAvatar src={client.profilePictureUrl} name={client.fullName} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold truncate" data-testid={`client-name-${client.id}`}>
              {client.fullName}
            </p>
            {client.isVerified && <VerifiedBadge size="xs" />}
            {isElite && <TierBadge tier={tier} size="xs" />}
            <HealthBadge health={client.health} size="xs" />
          </div>
          {client.email && (
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5 mt-1">
              <Mail size={10} /> {client.email}
            </p>
          )}
          {client.phone && (
            <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1.5 mt-0.5">
              <Phone size={10} /> {client.phone}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
        <div className="rounded-lg bg-white/5 px-2.5 py-2">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {t("admin.clients.colPackage")}
          </p>
          <p className="font-semibold truncate mt-0.5">{activePkg ? packageLabel : "—"}</p>
        </div>
        <div className="rounded-lg bg-white/5 px-2.5 py-2">
          <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
            {t("admin.clients.colSessionsLeft")}
          </p>
          <p className="font-semibold mt-0.5 tabular-nums">
            {activePkg ? `${remaining} / ${activePkg.totalSessions}` : "—"}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 mt-3">
        <Link
          href={`/admin/clients/${client.id}`}
          className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-lg text-xs font-semibold border border-white/10 hover:bg-white/5 btn-soft"
        >
          {t("admin.clients.openProfile")} <ExternalLink size={11} />
        </Link>
        {(() => {
          const url = whatsappClientUrl(client.phone);
          if (!url) return null;
          return (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              data-testid={`button-whatsapp-mobile-${client.id}`}
              className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 btn-soft"
            >
              <SiWhatsapp size={14} />
            </a>
          );
        })()}
      </div>
    </motion.div>
  );
}
