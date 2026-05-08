import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import {
  Users,
  CalendarCheck,
  Clock,
  TrendingUp,
  ExternalLink,
  LayoutDashboard,
  Calendar,
  Package as PackageIcon,
  Activity,
  Camera,
  Settings as SettingsIcon,
  BarChart3,
  AlertTriangle,
  CalendarX,
  RefreshCw,
  CalendarPlus,
  AlertCircle,
  ChevronRight,
  Wallet,
  Sun,
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@shared/routes";
import type { DashboardStats, BookingWithUser, AdminAnalytics } from "@shared/schema";
import { useBookings } from "@/hooks/use-bookings";
import { translateStatus, statusColor } from "@/lib/booking-utils";
import { formatTime12 } from "@/lib/time-format";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import {
  AdminCard,
  AdminPageHeader,
  AdminSectionTitle,
  AdminStatCard,
  AdminAlertRow,
  AdminEmptyState,
  useAdminCountUp,
} from "@/components/admin/primitives";

const FMT_AED = new Intl.NumberFormat("en-US", { style: "currency", currency: "AED", maximumFractionDigits: 0 });

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
  { href: "/admin/analytics", labelKey: "admin.tabs.analytics", fallback: "Analytics", icon: <BarChart3 size={15} />, matches: (p) => p.startsWith("/admin/analytics") },
  { href: "/admin/clients", labelKey: "admin.tabs.inbody", fallback: "InBody", icon: <Activity size={15} />, matches: () => false, hintKey: "admin.tabs.inbodyHint", hintFallback: "Open a client to manage InBody scans" },
  { href: "/admin/clients", labelKey: "admin.tabs.progress", fallback: "Progress", icon: <Camera size={15} />, matches: () => false, hintKey: "admin.tabs.progressHint", hintFallback: "Open a client to manage progress photos" },
  { href: "/admin/settings", labelKey: "admin.tabs.settings", fallback: "Settings", icon: <SettingsIcon size={15} />, matches: (p) => p.startsWith("/admin/settings") },
];

export function AdminTabs() {
  const [location] = useLocation();
  const { t } = useTranslation();
  return (
    <div className="rounded-xl sm:rounded-2xl border border-white/5 bg-card/60 p-1 mb-4 sm:mb-6 overflow-x-auto admin-tabs-scroll [-webkit-overflow-scrolling:touch]">
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
                "inline-flex items-center gap-1.5 h-9 sm:h-9 min-w-[84px] justify-center px-3 rounded-lg text-[12.5px] sm:text-xs font-semibold transition-colors whitespace-nowrap",
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

// =====================================================
// TodayHero — calm, premium "what matters today" panel.
// Uses already-fetched DashboardStats + AdminAnalytics so
// there's no extra round-trip beyond what the page does.
// =====================================================
function TodayHero({
  todayCount,
  upcomingCount,
  urgentCount,
  revenue30d,
}: {
  todayCount: number;
  upcomingCount: number;
  urgentCount: number;
  revenue30d: number | null;
}) {
  const { t } = useTranslation();
  const animatedToday = useAdminCountUp(todayCount);
  const dateLabel = format(new Date(), "EEEE, MMM d");
  return (
    <AdminCard className="mb-3 sm:mb-5 relative overflow-hidden" testId="today-hero">
      {/* Soft brand glow */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-20 -end-20 w-64 h-64 rounded-full bg-primary/15 blur-3xl"
      />
      <div className="relative grid sm:grid-cols-[1fr_auto] gap-4 items-end">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs uppercase tracking-[0.25em] text-primary font-semibold">
            <Sun size={12} /> {t("admin.dashboard.todayLabel", "Today")}
          </p>
          <p className="text-[11px] sm:text-xs text-muted-foreground mt-1">{dateLabel}</p>
          <div className="flex items-baseline gap-2 mt-2">
            <span className="font-display font-bold text-[40px] sm:text-[56px] leading-none tabular-nums">
              {Math.round(animatedToday)}
            </span>
            <span className="text-[12.5px] sm:text-sm text-muted-foreground">
              {todayCount === 1
                ? t("admin.dashboard.sessionScheduled", "session scheduled")
                : t("admin.dashboard.sessionsScheduled", "sessions scheduled")}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 sm:gap-3 sm:min-w-[340px]">
          <HeroChip icon={<CalendarCheck size={13} />} value={upcomingCount} label={t("admin.dashboard.statUpcoming", "Upcoming")} tone="info" />
          <HeroChip icon={<AlertCircle size={13} />} value={urgentCount} label={t("admin.dashboard.urgentAlerts", "Urgent")} tone={urgentCount > 0 ? "danger" : "muted"} />
          <HeroChip
            icon={<Wallet size={13} />}
            value={revenue30d == null ? "—" : FMT_AED.format(revenue30d)}
            label={t("admin.dashboard.revenue30d", "Revenue 30d")}
            tone="success"
            wide
          />
        </div>
      </div>
    </AdminCard>
  );
}

function HeroChip({
  icon,
  value,
  label,
  tone,
  wide = false,
}: {
  icon: React.ReactNode;
  value: number | string;
  label: string;
  tone: "info" | "danger" | "success" | "muted";
  wide?: boolean;
}) {
  const toneText =
    tone === "danger"
      ? "text-red-300"
      : tone === "success"
        ? "text-emerald-300"
        : tone === "muted"
          ? "text-muted-foreground"
          : "text-sky-300";
  return (
    <div className="rounded-xl sm:rounded-2xl border border-white/8 bg-white/[0.03] px-2.5 sm:px-3 py-2 sm:py-2.5 min-w-0">
      <div className="flex items-center gap-1.5 text-[10.5px] uppercase tracking-wider font-semibold text-muted-foreground">
        <span className={cn("inline-flex items-center justify-center w-5 h-5 rounded-md bg-white/[0.05]", toneText)}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p
        className={cn(
          "font-display font-bold tabular-nums leading-none mt-1.5",
          wide ? "text-[17px] sm:text-[20px]" : "text-[20px] sm:text-[24px]",
          toneText,
        )}
      >
        {value}
      </p>
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

  // Premium revenue snapshot — fetched lazily so the page paints fast
  // even before this larger payload returns. Failure is silent.
  const { data: analytics } = useQuery<AdminAnalytics>({
    queryKey: ["/api/admin/analytics"],
    queryFn: async () => {
      const res = await fetch("/api/admin/analytics", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
    staleTime: 60_000,
  });

  const today = new Date().toISOString().slice(0, 10);
  const { data: upcomingRaw = [] } = useBookings({ from: today, includeUser: true });
  const upcoming = (upcomingRaw as BookingWithUser[])
    .filter((b) => ["upcoming", "confirmed"].includes(b.status))
    .slice(0, 6);

  const todayCount = stats?.bookingsToday ?? 0;
  const upcomingCount = stats?.upcomingBookings ?? 0;
  const urgentCount =
    (stats?.expiredPackages ?? 0) +
    (stats?.expiringPackages ?? 0) +
    (stats?.pendingRenewals ?? 0) +
    (stats?.pendingExtensions ?? 0) +
    (stats?.lowSessionClients ?? 0);

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <AdminPageHeader
          eyebrow={t("admin.tabs.overview")}
          title={t("admin.dashboardTitle")}
          subtitle={t("admin.dashboard.subtitle")}
          testId="text-admin-title"
        />

        <AdminTabs />

        {/* Today hero — anchors the page in "what matters now" */}
        <TodayHero
          todayCount={todayCount}
          upcomingCount={upcomingCount}
          urgentCount={urgentCount}
          revenue30d={analytics?.revenue.paid30d ?? null}
        />

        {/* Urgent alerts strip — scannable, color-coded, all link out */}
        {urgentCount > 0 ? (
          <div
            className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3 mb-4 sm:mb-6"
            data-testid="urgent-alerts-strip"
          >
            <AdminAlertRow
              icon={<AlertTriangle size={15} />}
              count={stats?.expiringPackages ?? 0}
              label={t("admin.dashboard.statExpiring", "Expiring soon")}
              href="/admin/packages"
              tone="warning"
              testId="alert-expiring"
            />
            <AdminAlertRow
              icon={<CalendarX size={15} />}
              count={stats?.expiredPackages ?? 0}
              label={t("admin.dashboard.statExpired", "Expired packages")}
              href="/admin/packages"
              tone="danger"
              testId="alert-expired"
            />
            <AdminAlertRow
              icon={<RefreshCw size={15} />}
              count={stats?.pendingRenewals ?? 0}
              label={t("admin.dashboard.statPendingRenewals", "Pending renewals")}
              href="/admin/packages"
              tone="info"
              testId="alert-renewals"
            />
            <AdminAlertRow
              icon={<CalendarPlus size={15} />}
              count={stats?.pendingExtensions ?? 0}
              label={t("admin.dashboard.statPendingExtensions", "Pending extensions")}
              href="/admin/packages"
              tone="info"
              testId="alert-extensions"
            />
            <AdminAlertRow
              icon={<AlertCircle size={15} />}
              count={stats?.lowSessionClients ?? 0}
              label={t("admin.dashboard.statLowSessions", "Low-session clients")}
              href="/admin/clients"
              tone="warning"
              testId="alert-low-sessions"
            />
          </div>
        ) : null}

        {/* Headline KPIs — concise, premium count-ups */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-4 sm:mb-6">
          <AdminStatCard icon={<Users size={18} />} label={t("admin.dashboard.statTotalClients")} value={stats?.totalClients ?? 0} testId="stat-clients" tone="info" animate />
          <AdminStatCard icon={<CalendarCheck size={18} />} label={t("admin.dashboard.statUpcoming")} value={upcomingCount} testId="stat-upcoming" tone="schedule" animate />
          <AdminStatCard icon={<Clock size={18} />} label={t("admin.dashboard.statToday")} value={todayCount} testId="stat-today" tone="schedule" animate />
          <AdminStatCard icon={<TrendingUp size={18} />} label={t("admin.dashboard.statCompletedMo")} value={stats?.completedThisMonth ?? 0} testId="stat-completed" tone="success" animate />
        </div>

        <div className="grid lg:grid-cols-3 gap-3 sm:gap-5">
          <AdminCard className="lg:col-span-2">
            <AdminSectionTitle
              title={t("admin.dashboard.upcomingSessions")}
              cta={{ href: "/admin/bookings", label: t("admin.dashboard.viewAll"), testId: "link-all-bookings" }}
            />
            {upcoming.length === 0 ? (
              <AdminEmptyState
                icon={<CalendarCheck size={20} />}
                title={t("admin.dashboard.noUpcoming", "No upcoming sessions")}
                body={t("admin.dashboard.noUpcomingHint", "When clients book, they'll show up here.")}
                cta={{ href: "/admin/bookings", label: t("admin.dashboard.qaManageBookings", "Manage bookings"), testId: "empty-go-bookings" }}
                testId="empty-upcoming"
              />
            ) : (
              <div className="divide-y divide-white/5 -mx-1">
                {upcoming.map((b) => (
                  <Link
                    key={b.id}
                    href="/admin/bookings"
                    className="flex items-center gap-2.5 sm:gap-4 py-2.5 px-1 sm:px-3 sm:py-3 sm:rounded-xl min-h-[60px] sm:min-h-[68px] hover:bg-white/[0.04] sm:hover:bg-white/5 transition-colors"
                    data-testid={`upcoming-row-${b.id}`}
                  >
                    <div className="w-10 h-10 sm:w-11 sm:h-11 shrink-0 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20 flex flex-col items-center justify-center text-primary">
                      <span className="text-[8.5px] uppercase font-bold leading-none tracking-wide">
                        {format(new Date(b.date), "MMM")}
                      </span>
                      <span className="text-[15px] font-display font-bold leading-none mt-0.5">
                        {format(new Date(b.date), "d")}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] sm:text-sm font-semibold truncate leading-tight">{b.user?.fullName || t("admin.bookings.client")}</p>
                      <p className="text-[11px] sm:text-xs text-muted-foreground truncate mt-0.5">
                        {formatTime12(b.timeSlot)}{b.user?.phone ? ` • ${b.user.phone}` : ""}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 text-[9px] uppercase tracking-wider font-bold px-1.5 sm:px-2 py-0.5 rounded-md border whitespace-nowrap max-w-[76px] sm:max-w-[88px] truncate ${statusColor(b.status)}`}
                    >
                      {translateStatus(b.status, t)}
                    </span>
                    <ChevronRight size={14} className="shrink-0 text-muted-foreground/60 hidden sm:block rtl:rotate-180" />
                  </Link>
                ))}
              </div>
            )}
          </AdminCard>

          <AdminCard>
            <AdminSectionTitle title={t("admin.dashboard.quickActions")} />
            <div className="space-y-1.5 sm:space-y-2">
              <QuickAction icon={<Users size={15} />} href="/admin/clients" label={t("admin.dashboard.qaViewClients")} testKey="view-clients" />
              <QuickAction icon={<Calendar size={15} />} href="/admin/bookings" label={t("admin.dashboard.qaManageBookings")} testKey="manage-bookings" />
              <QuickAction icon={<PackageIcon size={15} />} href="/admin/packages" label={t("admin.dashboard.qaSessions")} testKey="sessions-packages" />
              <QuickAction icon={<BarChart3 size={15} />} href="/admin/analytics" label={t("admin.dashboard.qaAnalytics", "View analytics")} testKey="analytics" />
              <QuickAction icon={<SettingsIcon size={15} />} href="/admin/settings" label={t("admin.dashboard.qaSettings")} testKey="settings" />
              <QuickAction icon={<ExternalLink size={15} />} href="/" label={t("admin.dashboard.qaPublic")} testKey="public" external />
            </div>
            <p className="text-[11px] text-muted-foreground mt-3 sm:mt-4 leading-relaxed">
              {t("admin.dashboard.qaHint")}
            </p>
          </AdminCard>
        </div>
      </div>
    </div>
  );
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
      className="flex items-center gap-2.5 w-full min-h-[44px] sm:min-h-[48px] px-3 py-2 rounded-xl sm:rounded-2xl border border-white/8 bg-white/[0.04] hover:bg-white/[0.08] hover:border-white/12 active:bg-white/[0.10] text-[13px] sm:text-sm font-medium transition-colors"
    >
      {icon ? (
        <span className="inline-flex items-center justify-center w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/12 text-primary shrink-0">
          {icon}
        </span>
      ) : null}
      <span className="flex-1 truncate">{label}</span>
      {external ? <ExternalLink size={13} className="shrink-0 opacity-60" /> : <ChevronRight size={14} className="shrink-0 opacity-60 rtl:rotate-180" />}
    </Link>
  );
}
