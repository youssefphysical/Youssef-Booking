import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Users,
  TrendingUp,
  CalendarCheck,
  Wallet,
  Activity,
  AlertTriangle,
  Snowflake,
  RefreshCw,
  CheckCircle2,
  Repeat,
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts";
import { AdminTabs } from "@/pages/AdminDashboard";
import type { AdminAnalytics } from "@shared/schema";
import { useTranslation } from "@/i18n";
import { cn } from "@/lib/utils";
import {
  AdminCard,
  AdminChartCard,
  AdminPageHeader,
  AdminSectionTitle,
  AdminStatCard,
} from "@/components/admin/primitives";

const ANALYTICS_PATH = "/api/admin/analytics";
const FMT_INT = new Intl.NumberFormat("en-US");
const FMT_AED = new Intl.NumberFormat("en-US", { style: "currency", currency: "AED", maximumFractionDigits: 0 });
const DOW_LABEL = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function shortMonth(ym: string) {
  // ym = "YYYY-MM"
  const [y, m] = ym.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, 1).toLocaleDateString("en-US", { month: "short" });
}

/**
 * Calm, theme-aligned chart palette. Primary = brand cyan (HSL token,
 * follows theme). Secondary roles use calm tints that read well on the
 * dark luxury background — slightly desaturated vs raw Tailwind defaults
 * so they don't shout against the rest of the surface.
 */
const CHART_COLOR = {
  primary: "hsl(var(--primary))",       // brand cyan — main metric
  comparison: "rgba(255,255,255,0.45)", // calm white — secondary line
  success: "#34d399",                   // emerald-400 — signups / growth
  warning: "#fbbf24",                   // amber-400 — caution
  danger: "#f87171",                    // rose-400 — churn / loss
} as const;
const PIE_COLORS = [CHART_COLOR.primary, CHART_COLOR.warning, CHART_COLOR.danger, CHART_COLOR.comparison];

export default function AdminAnalytics() {
  const { t } = useTranslation();
  const { data, isLoading, error } = useQuery<AdminAnalytics>({
    queryKey: [ANALYTICS_PATH],
    // Analytics endpoint is heavy (snapshot + 12-month trends). 60s stale time
    // matches AdminDashboard's revenue30d query so they share cache and we
    // don't refetch on every tab switch.
    staleTime: 60_000,
    queryFn: async () => {
      const res = await fetch(ANALYTICS_PATH, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load analytics");
      return res.json();
    },
  });

  const revenueData = useMemo(
    () => (data?.trends.revenueByMonth ?? []).map((r) => ({ ...r, label: shortMonth(r.month) })),
    [data],
  );
  const completedData = useMemo(
    () => (data?.trends.completedByMonth ?? []).map((r) => ({ ...r, label: shortMonth(r.month) })),
    [data],
  );
  const signupsData = useMemo(
    () => (data?.trends.signupsByMonth ?? []).map((r) => ({ ...r, label: shortMonth(r.month) })),
    [data],
  );
  const dowData = useMemo(
    () => (data?.trends.bookingsByDow ?? []).map((r) => ({ ...r, label: DOW_LABEL[r.dow] ?? "" })),
    [data],
  );
  const pkgPie = useMemo(() => {
    if (!data) return [] as Array<{ name: string; value: number }>;
    return [
      { name: t("admin.analytics.pkgActive", "Active"), value: data.packages.active },
      { name: t("admin.analytics.pkgExpiring", "Expiring"), value: data.packages.expiringSoon },
      { name: t("admin.analytics.pkgExpired", "Expired"), value: data.packages.expired },
      { name: t("admin.analytics.pkgFrozen", "Frozen"), value: data.packages.frozen },
    ];
  }, [data, t]);

  return (
    <div className="admin-shell">
      <div className="admin-container">
        <AdminPageHeader
          eyebrow={t("admin.tabs.analytics", "Analytics")}
          title={t("admin.analytics.title", "Business Analytics")}
          subtitle={t("admin.analytics.subtitle", "Revenue, retention, attendance and momentum at a glance.")}
          testId="text-analytics-title"
        />

        <AdminTabs />

        {error ? (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300" data-testid="analytics-error">
            {t("admin.analytics.error", "Could not load analytics. Please refresh the page.")}
          </div>
        ) : null}

        {isLoading || !data ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl admin-shimmer h-[110px] sm:h-[120px]"
                data-testid={`analytics-skeleton-${i}`}
              />
            ))}
          </div>
        ) : (
          <>
            {/* Top KPI grid */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-3 sm:mb-4">
              <AdminStatCard
                icon={<Users size={18} />}
                label={t("admin.analytics.activeClients", "Active clients")}
                value={data.clients.active}
                sub={`${data.clients.new30d} ${t("admin.analytics.new30d", "new in 30d")}`}
                tone="info"
                testId="kpi-active-clients"
                animate
              />
              <AdminStatCard
                icon={<Wallet size={18} />}
                label={t("admin.analytics.revenuePaid30d", "Revenue (30d)")}
                value={data.revenue.paid30d}
                sub={`${FMT_AED.format(data.revenue.outstanding)} ${t("admin.analytics.outstanding", "outstanding")}`}
                tone="success"
                format="currencyAED"
                testId="kpi-revenue-30d"
                animate
              />
              <AdminStatCard
                icon={<CalendarCheck size={18} />}
                label={t("admin.analytics.completed30d", "Sessions (30d)")}
                value={data.sessions.completed30d}
                sub={`${data.sessions.completed90d} ${t("admin.analytics.in90d", "in 90d")}`}
                tone="schedule"
                testId="kpi-completed-30d"
                animate
              />
              <AdminStatCard
                icon={<TrendingUp size={18} />}
                label={t("admin.analytics.attendance30d", "Attendance rate")}
                value={data.sessions.attendanceRate30d}
                sub={`${(data.sessions.noShowRate30d * 100).toFixed(0)}% ${t("admin.analytics.noShows", "no-shows")}`}
                tone={data.sessions.attendanceRate30d >= 0.8 ? "success" : "warning"}
                format="percent"
                testId="kpi-attendance"
                animate
              />
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4 mb-4 sm:mb-6">
              <AdminStatCard
                icon={<AlertTriangle size={18} />}
                label={t("admin.analytics.expiringSoon", "Expiring soon")}
                value={data.packages.expiringSoon}
                tone="warning"
                testId="kpi-expiring"
                animate
              />
              <AdminStatCard
                icon={<Snowflake size={18} />}
                label={t("admin.analytics.frozenPkgs", "Frozen packages")}
                value={data.packages.frozen}
                tone="info"
                testId="kpi-frozen"
                animate
              />
              <AdminStatCard
                icon={<Repeat size={18} />}
                label={t("admin.analytics.repeatClients", "Repeat clients")}
                value={data.retention.multiPackageClients}
                sub={t("admin.analytics.multiPkgHint", "≥2 packages")}
                tone="success"
                testId="kpi-repeat"
                animate
              />
              <AdminStatCard
                icon={<RefreshCw size={18} />}
                label={t("admin.analytics.renewals30d", "Renewals (30d)")}
                value={data.packages.renewals30d}
                tone="default"
                testId="kpi-renewals"
                animate
              />
            </div>

            {/* Charts */}
            <div className="grid lg:grid-cols-2 gap-3 sm:gap-5 mb-4 sm:mb-6">
              <AdminChartCard
                title={t("admin.analytics.revenueTrend", "Revenue (12 months)")}
                subtitle={t("admin.analytics.revenueTrendSub", "Paid vs total assigned")}
                testId="chart-revenue"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={revenueData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(8,15,28,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                      formatter={(v: any) => FMT_AED.format(Number(v))}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="total" name="Assigned" stroke={CHART_COLOR.comparison} strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="paid" name="Paid" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </AdminChartCard>

              <AdminChartCard
                title={t("admin.analytics.completedTrend", "Completed sessions")}
                subtitle={t("admin.analytics.completedTrendSub", "Last 12 months")}
                testId="chart-completed"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={completedData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(8,15,28,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" name="Sessions" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </AdminChartCard>

              <AdminChartCard
                title={t("admin.analytics.signupsTrend", "New clients")}
                subtitle={t("admin.analytics.signupsTrendSub", "Signups per month")}
                testId="chart-signups"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={signupsData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(8,15,28,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Line type="monotone" dataKey="count" name="Signups" stroke={CHART_COLOR.success} strokeWidth={2.5} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </AdminChartCard>

              <AdminChartCard
                title={t("admin.analytics.dowLoad", "Demand by weekday")}
                subtitle={t("admin.analytics.dowLoadSub", "All non-cancelled sessions by weekday")}
                testId="chart-dow"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dowData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                    <YAxis tick={{ fontSize: 11, fill: "rgba(255,255,255,0.5)" }} />
                    <Tooltip
                      contentStyle={{
                        background: "rgba(8,15,28,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Bar dataKey="count" name="Sessions" fill={CHART_COLOR.comparison} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </AdminChartCard>
            </div>

            {/* Bottom: package mix + churn + adherence */}
            <div className="grid lg:grid-cols-3 gap-3 sm:gap-5">
              <AdminChartCard
                title={t("admin.analytics.pkgMix", "Package mix")}
                subtitle={t("admin.analytics.pkgMixSub", "Currently active packages")}
                testId="chart-pkgmix"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={pkgPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={2}
                      stroke="rgba(8,15,28,0.9)"
                      strokeWidth={3}
                    >
                      {pkgPie.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        background: "rgba(8,15,28,0.95)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 12,
                        fontSize: 12,
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </AdminChartCard>

              <AdminCard testId="card-churn">
                <AdminSectionTitle title={t("admin.analytics.churn", "Churn signals")} />
                <p className="text-[11px] text-muted-foreground -mt-2 mb-3">
                  {t("admin.analytics.churnSub", "Active clients with no recent booking")}
                </p>
                <div className="space-y-2.5">
                  {[
                    { label: "30d", value: data.retention.churn30d, tone: "text-amber-300" },
                    { label: "60d", value: data.retention.churn60d, tone: "text-orange-300" },
                    { label: "90d", value: data.retention.churn90d, tone: "text-red-300" },
                  ].map((row) => (
                    <div
                      key={row.label}
                      className="flex items-center justify-between rounded-xl bg-white/[0.04] border border-white/5 px-3 py-2.5"
                      data-testid={`churn-${row.label}`}
                    >
                      <span className="text-[12.5px] text-muted-foreground uppercase tracking-wide font-semibold">
                        {row.label}
                      </span>
                      <span className={cn("font-display font-bold text-xl tabular-nums", row.tone)}>
                        {FMT_INT.format(row.value)}
                      </span>
                    </div>
                  ))}
                </div>
              </AdminCard>

              <AdminCard testId="card-adherence">
                <AdminSectionTitle title={t("admin.analytics.adherence", "Weekly check-in adherence")} />
                <p className="text-[11px] text-muted-foreground -mt-2 mb-3">
                  {t("admin.analytics.adherenceSub", "Active clients, last 30 days")}
                </p>
                <div className="flex flex-col items-center justify-center py-6">
                  <div className="relative w-32 h-32">
                    <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                      <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="10" />
                      <circle
                        cx="60"
                        cy="60"
                        r="52"
                        fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${2 * Math.PI * 52}`}
                        strokeDashoffset={`${2 * Math.PI * 52 * (1 - data.adherence.weeklyCheckinRate30d)}`}
                        style={{ transition: "stroke-dashoffset 800ms ease-out" }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-display font-bold text-2xl tabular-nums" data-testid="adherence-percent">
                        {(data.adherence.weeklyCheckinRate30d * 100).toFixed(0)}%
                      </span>
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                        {t("admin.analytics.adherenceLabel", "On-track")}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 mt-4 text-[11.5px] text-muted-foreground">
                    {data.adherence.weeklyCheckinRate30d >= 0.6 ? (
                      <>
                        <CheckCircle2 size={13} className="text-emerald-400" />
                        <span>{t("admin.analytics.adherenceGood", "Strong engagement")}</span>
                      </>
                    ) : (
                      <>
                        <Activity size={13} className="text-amber-400" />
                        <span>{t("admin.analytics.adherenceLow", "Room to grow")}</span>
                      </>
                    )}
                  </div>
                </div>
              </AdminCard>
            </div>

            <p className="text-[10.5px] text-muted-foreground/60 mt-4 text-end">
              {t("admin.analytics.generatedAt", "Generated")}: {new Date(data.generatedAt).toLocaleString()}
            </p>
          </>
        )}
      </div>
    </div>
  );
}
