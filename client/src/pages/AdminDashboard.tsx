import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Users,
  CalendarCheck,
  Clock,
  TrendingUp,
  ArrowRight,
  ExternalLink,
  LayoutDashboard,
  Calendar,
  Package as PackageIcon,
  Activity,
  Camera,
  Settings as SettingsIcon,
  AlertTriangle,
  CalendarX,
  RefreshCw,
  CalendarPlus,
  AlertCircle,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@shared/routes";
import type { DashboardStats, BookingWithUser } from "@shared/schema";
import { useBookings } from "@/hooks/use-bookings";
import { translateStatus, statusColor } from "@/lib/booking-utils";
import { formatTime12 } from "@/lib/time-format";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

type TabSpec = {
  href: string;
  labelKey: string;
  fallback: string;
  icon: React.ReactNode;
  matches: (path: string) => boolean;
  hintKey?: string;
  hintFallback?: string;
};

const ADMIN_TABS: TabSpec[] = [
  { href: "/admin", labelKey: "admin.tabs.overview", fallback: "Overview", icon: <LayoutDashboard size={15} />, matches: (p) => p === "/admin" },
  { href: "/admin/clients", labelKey: "admin.tabs.clients", fallback: "Clients", icon: <Users size={15} />, matches: (p) => p.startsWith("/admin/clients") },
  { href: "/admin/bookings", labelKey: "admin.tabs.bookings", fallback: "Bookings", icon: <Calendar size={15} />, matches: (p) => p.startsWith("/admin/bookings") },
  { href: "/admin/packages", labelKey: "admin.tabs.sessions", fallback: "Sessions", icon: <PackageIcon size={15} />, matches: (p) => p.startsWith("/admin/packages") },
  { href: "/admin/clients", labelKey: "admin.tabs.inbody", fallback: "InBody", icon: <Activity size={15} />, matches: () => false, hintKey: "admin.tabs.inbodyHint", hintFallback: "Open a client to manage InBody scans" },
  { href: "/admin/clients", labelKey: "admin.tabs.progress", fallback: "Progress", icon: <Camera size={15} />, matches: () => false, hintKey: "admin.tabs.progressHint", hintFallback: "Open a client to manage progress photos" },
  { href: "/admin/settings", labelKey: "admin.tabs.settings", fallback: "Settings", icon: <SettingsIcon size={15} />, matches: (p) => p.startsWith("/admin/settings") },
];

export function AdminTabs() {
  const [location] = useLocation();
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl border border-white/5 bg-card/60 p-1.5 mb-8 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {ADMIN_TABS.map((tab) => {
          const active = tab.matches(location);
          const label = t(tab.labelKey, tab.fallback);
          return (
            <Link
              key={tab.labelKey + tab.href}
              href={tab.href}
              data-testid={`admintab-${tab.fallback.toLowerCase()}`}
              title={tab.hintKey ? t(tab.hintKey, tab.hintFallback) : undefined}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
              )}
            >
              {tab.icon}
              {label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { t } = useTranslation();
  const { data: stats } = useQuery<DashboardStats>({
    queryKey: [api.dashboard.stats.path],
    queryFn: async () => {
      const res = await fetch(api.dashboard.stats.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load stats");
      return res.json();
    },
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: upcomingRaw = [] } = useBookings({ from: today, includeUser: true });
  const upcoming = (upcomingRaw as BookingWithUser[])
    .filter((b) => ["upcoming", "confirmed"].includes(b.status))
    .slice(0, 6);

  return (
    <div className="md:pl-64 p-6 pt-20 md:pt-8 min-h-screen">
      <div className="mb-6">
        <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">
          {t("admin.tabs.overview")}
        </p>
        <h1 className="text-3xl font-display font-bold" data-testid="text-admin-title">
          {t("admin.dashboardTitle")}
        </h1>
        <p className="text-muted-foreground text-sm">
          {t("admin.dashboard.subtitle")}
        </p>
      </div>

      <AdminTabs />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
        <StatCard icon={<Users size={20} />} label={t("admin.dashboard.statTotalClients")} value={stats?.totalClients ?? 0} testId="stat-clients" />
        <StatCard icon={<CalendarCheck size={20} />} label={t("admin.dashboard.statUpcoming")} value={stats?.upcomingBookings ?? 0} testId="stat-upcoming" />
        <StatCard icon={<Clock size={20} />} label={t("admin.dashboard.statToday")} value={stats?.bookingsToday ?? 0} testId="stat-today" />
        <StatCard icon={<TrendingUp size={20} />} label={t("admin.dashboard.statCompletedMo")} value={stats?.completedThisMonth ?? 0} testId="stat-completed" />
      </div>

      {/* Premium business management — at-a-glance lifecycle counts. */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
        <StatCard
          icon={<AlertTriangle size={20} />}
          label={t("admin.dashboard.statExpiring", "Expiring soon")}
          value={stats?.expiringPackages ?? 0}
          testId="stat-expiring"
          tone="warning"
        />
        <StatCard
          icon={<CalendarX size={20} />}
          label={t("admin.dashboard.statExpired", "Expired packages")}
          value={stats?.expiredPackages ?? 0}
          testId="stat-expired"
          tone="danger"
        />
        <StatCard
          icon={<RefreshCw size={20} />}
          label={t("admin.dashboard.statPendingRenewals", "Pending renewals")}
          value={stats?.pendingRenewals ?? 0}
          testId="stat-pending-renewals"
          tone="info"
        />
        <StatCard
          icon={<CalendarPlus size={20} />}
          label={t("admin.dashboard.statPendingExtensions", "Pending extensions")}
          value={stats?.pendingExtensions ?? 0}
          testId="stat-pending-extensions"
          tone="info"
        />
        <StatCard
          icon={<AlertCircle size={20} />}
          label={t("admin.dashboard.statLowSessions", "Low-session clients")}
          value={stats?.lowSessionClients ?? 0}
          testId="stat-low-sessions"
          tone="warning"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-3xl border border-white/5 bg-card/60 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-lg">
              {t("admin.dashboard.upcomingSessions")}
            </h3>
            <Link href="/admin/bookings" className="text-xs text-primary inline-flex items-center gap-1" data-testid="link-all-bookings">
              {t("admin.dashboard.viewAll")} <ArrowRight size={12} />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">
              {t("admin.dashboard.noUpcoming")}
            </p>
          ) : (
            <div className="space-y-2">
              {upcoming.map((b) => (
                <div
                  key={b.id}
                  className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 transition-colors"
                  data-testid={`upcoming-row-${b.id}`}
                >
                  <div className="w-12 h-12 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary">
                    <span className="text-[9px] uppercase font-bold leading-none">
                      {format(new Date(b.date), "MMM")}
                    </span>
                    <span className="text-base font-display font-bold leading-none mt-0.5">
                      {format(new Date(b.date), "d")}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{b.user?.fullName || t("admin.bookings.client")}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatTime12(b.timeSlot)} • {b.user?.phone || ""}
                    </p>
                  </div>
                  <span
                    className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${statusColor(b.status)}`}
                  >
                    {translateStatus(b.status, t)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/5 bg-card/60 p-6">
          <h3 className="font-display font-bold text-lg mb-5">
            {t("admin.dashboard.quickActions")}
          </h3>
          <div className="space-y-2">
            <QuickAction href="/admin/clients" label={t("admin.dashboard.qaViewClients")} testKey="view-clients" />
            <QuickAction href="/admin/bookings" label={t("admin.dashboard.qaManageBookings")} testKey="manage-bookings" />
            <QuickAction href="/admin/packages" label={t("admin.dashboard.qaSessions")} testKey="sessions-packages" />
            <QuickAction href="/admin/settings" label={t("admin.dashboard.qaSettings")} testKey="settings" />
            <QuickAction href="/" label={t("admin.dashboard.qaPublic")} testKey="public" external />
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            {t("admin.dashboard.qaHint")}
          </p>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  testId,
  tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  testId: string;
  tone?: "default" | "warning" | "danger" | "info";
}) {
  const toneStyle =
    tone === "warning"
      ? "bg-amber-500/15 text-amber-300"
      : tone === "danger"
        ? "bg-red-500/15 text-red-300"
        : tone === "info"
          ? "bg-sky-500/15 text-sky-300"
          : "bg-primary/15 text-primary";
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/5 bg-card/60 p-5"
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${toneStyle}`}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-display font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </motion.div>
  );
}

function QuickAction({ href, label, external, testKey }: { href: string; label: string; external?: boolean; testKey: string }) {
  return (
    <Link
      href={href}
      data-testid={`quick-${testKey}`}
      className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors"
    >
      <span>{label}</span>
      {external ? <ExternalLink size={14} /> : <ArrowRight size={14} />}
    </Link>
  );
}
