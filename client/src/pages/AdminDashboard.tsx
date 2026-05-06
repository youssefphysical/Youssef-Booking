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
  ChevronRight,
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
    <div className="rounded-2xl border border-white/5 bg-card/60 p-1.5 mb-5 sm:mb-8 overflow-x-auto admin-tabs-scroll [-webkit-overflow-scrolling:touch]">
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
                "inline-flex items-center gap-1.5 h-10 sm:h-9 min-w-[88px] justify-center px-3.5 rounded-xl text-[13px] sm:text-xs font-semibold transition-colors whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
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

  const todayCount = stats?.bookingsToday ?? 0;
  const upcomingCount = stats?.upcomingBookings ?? 0;
  const urgentCount = (stats?.expiredPackages ?? 0) + (stats?.expiringPackages ?? 0);

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="mb-5 sm:mb-6">
          <p className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-primary mb-1.5 sm:mb-2">
            {t("admin.tabs.overview")}
          </p>
          <h1 className="text-[26px] sm:text-3xl font-display font-bold leading-tight" data-testid="text-admin-title">
            {t("admin.dashboardTitle")}
          </h1>
          <p className="text-muted-foreground text-[13px] sm:text-sm mt-1">
            {t("admin.dashboard.subtitle")}
          </p>
        </div>

        <AdminTabs />

        {/* Today summary strip — premium glass one-liner. Uses existing
            DashboardStats values only; no new API calls or calculations. */}
        <div
          className="rounded-2xl border border-white/8 bg-[rgba(8,15,28,0.82)] px-3.5 sm:px-4 py-3 mb-5 sm:mb-6 shadow-sm shadow-black/20"
          data-testid="today-summary-strip"
        >
          <div className="flex items-center gap-3 sm:gap-4 overflow-x-auto admin-tabs-scroll [-webkit-overflow-scrolling:touch]">
            <SummaryPill icon={<Clock size={14} />} value={todayCount} label={t("admin.dashboard.statToday", "Today")} tone="schedule" />
            <SummaryDivider />
            <SummaryPill icon={<CalendarCheck size={14} />} value={upcomingCount} label={t("admin.dashboard.statUpcoming", "Upcoming")} tone="info" />
            <SummaryDivider />
            <SummaryPill icon={<AlertCircle size={14} />} value={urgentCount} label={t("admin.dashboard.urgentAlerts", "Urgent")} tone={urgentCount > 0 ? "danger" : "muted"} />
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-3 sm:mb-4">
          <StatCard icon={<Users size={20} />} label={t("admin.dashboard.statTotalClients")} value={stats?.totalClients ?? 0} testId="stat-clients" tone="info" />
          <StatCard icon={<CalendarCheck size={20} />} label={t("admin.dashboard.statUpcoming")} value={upcomingCount} testId="stat-upcoming" tone="schedule" />
          <StatCard icon={<Clock size={20} />} label={t("admin.dashboard.statToday")} value={todayCount} testId="stat-today" tone="schedule" />
          <StatCard icon={<TrendingUp size={20} />} label={t("admin.dashboard.statCompletedMo")} value={stats?.completedThisMonth ?? 0} testId="stat-completed" tone="success" />
        </div>

        {/* Lifecycle counts. 5th card spans 2 cols on mobile so the row
            never leaves an orphan tile. */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4 mb-5 sm:mb-8">
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
            spanFullOnMobile
          />
        </div>

        <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
          <div className="lg:col-span-2 rounded-[22px] sm:rounded-3xl border border-white/8 bg-[rgba(8,15,28,0.82)] p-4 sm:p-6 shadow-sm shadow-black/20">
            <div className="flex items-center justify-between mb-4 sm:mb-5 gap-3">
              <h3 className="font-display font-bold text-[17px] sm:text-lg truncate">
                {t("admin.dashboard.upcomingSessions")}
              </h3>
              <Link href="/admin/bookings" className="text-xs text-primary inline-flex items-center gap-1 shrink-0 whitespace-nowrap" data-testid="link-all-bookings">
                {t("admin.dashboard.viewAll")} <ArrowRight size={12} />
              </Link>
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">
                {t("admin.dashboard.noUpcoming")}
              </p>
            ) : (
              <div className="divide-y divide-white/5">
                {upcoming.map((b) => (
                  <Link
                    key={b.id}
                    href="/admin/bookings"
                    className="flex items-center gap-3 sm:gap-4 py-3 px-1 sm:p-3 sm:rounded-xl min-h-[72px] hover:bg-white/[0.04] sm:hover:bg-white/5 transition-colors"
                    data-testid={`upcoming-row-${b.id}`}
                  >
                    <div className="w-12 h-12 shrink-0 rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary">
                      <span className="text-[9px] uppercase font-bold leading-none">
                        {format(new Date(b.date), "MMM")}
                      </span>
                      <span className="text-base font-display font-bold leading-none mt-0.5">
                        {format(new Date(b.date), "d")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">{b.user?.fullName || t("admin.bookings.client")}</p>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {formatTime12(b.timeSlot)}{b.user?.phone ? ` • ${b.user.phone}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border whitespace-nowrap ${statusColor(b.status)}`}
                    >
                      {translateStatus(b.status, t)}
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-muted-foreground/60 hidden sm:block" />
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-[22px] sm:rounded-3xl border border-white/8 bg-[rgba(8,15,28,0.82)] p-4 sm:p-6 shadow-sm shadow-black/20">
            <h3 className="font-display font-bold text-[17px] sm:text-lg mb-4 sm:mb-5">
              {t("admin.dashboard.quickActions")}
            </h3>
            <div className="space-y-2.5">
              <QuickAction icon={<Users size={16} />} href="/admin/clients" label={t("admin.dashboard.qaViewClients")} testKey="view-clients" />
              <QuickAction icon={<Calendar size={16} />} href="/admin/bookings" label={t("admin.dashboard.qaManageBookings")} testKey="manage-bookings" />
              <QuickAction icon={<PackageIcon size={16} />} href="/admin/packages" label={t("admin.dashboard.qaSessions")} testKey="sessions-packages" />
              <QuickAction icon={<SettingsIcon size={16} />} href="/admin/settings" label={t("admin.dashboard.qaSettings")} testKey="settings" />
              <QuickAction icon={<ExternalLink size={16} />} href="/" label={t("admin.dashboard.qaPublic")} testKey="public" external />
            </div>
            <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
              {t("admin.dashboard.qaHint")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

type StatTone = "default" | "warning" | "danger" | "info" | "success" | "schedule";

const TONE_STYLES: Record<StatTone, string> = {
  default: "bg-primary/15 text-primary",
  warning: "bg-amber-500/15 text-amber-300",
  danger: "bg-red-500/15 text-red-300",
  info: "bg-sky-500/15 text-sky-300",
  success: "bg-emerald-500/15 text-emerald-300",
  schedule: "bg-cyan-500/15 text-cyan-300",
};

function StatCard({
  icon,
  label,
  value,
  testId,
  tone = "default",
  spanFullOnMobile = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  testId: string;
  tone?: StatTone;
  spanFullOnMobile?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-[18px] sm:rounded-2xl border border-white/8 bg-[rgba(8,15,28,0.82)] p-4 sm:p-5 min-h-[112px] flex flex-col shadow-sm shadow-black/20",
        spanFullOnMobile && "col-span-2 lg:col-span-1",
      )}
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-2.5 sm:mb-3">
        <div className={`w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center ${TONE_STYLES[tone]}`}>
          {icon}
        </div>
      </div>
      <p className="text-[28px] sm:text-3xl font-display font-bold leading-none tracking-tight">{value}</p>
      <p className="text-[11px] sm:text-xs text-muted-foreground mt-1.5 leading-snug">{label}</p>
    </motion.div>
  );
}

function SummaryPill({
  icon,
  value,
  label,
  tone,
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  tone: "schedule" | "info" | "danger" | "muted";
}) {
  const toneStyle =
    tone === "danger"
      ? "text-red-300"
      : tone === "muted"
        ? "text-muted-foreground"
        : tone === "schedule"
          ? "text-cyan-300"
          : "text-sky-300";
  return (
    <div className="flex items-center gap-2 shrink-0">
      <span className={cn("inline-flex items-center justify-center w-7 h-7 rounded-lg bg-white/[0.04] border border-white/5", toneStyle)}>
        {icon}
      </span>
      <div className="leading-tight">
        <span className={cn("font-display font-bold text-base", tone === "danger" && "text-red-300")}>{value}</span>
        <span className="text-[11px] text-muted-foreground ml-1.5 uppercase tracking-wide font-semibold">{label}</span>
      </div>
    </div>
  );
}

function SummaryDivider() {
  return <span aria-hidden className="w-px h-6 shrink-0 bg-white/8" />;
}

function QuickAction({
  href,
  label,
  external,
  testKey,
  icon,
}: {
  href: string;
  label: string;
  external?: boolean;
  testKey: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      data-testid={`quick-${testKey}`}
      className="flex items-center gap-3 w-full min-h-[52px] px-3.5 py-2.5 rounded-2xl border border-white/8 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/12 active:bg-white/[0.10] text-sm font-medium transition-colors"
    >
      {icon ? (
        <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-primary/12 text-primary shrink-0">
          {icon}
        </span>
      ) : null}
      <span className="flex-1 truncate">{label}</span>
      {external ? <ExternalLink size={14} className="shrink-0 opacity-60" /> : <ChevronRight size={16} className="shrink-0 opacity-60" />}
    </Link>
  );
}
