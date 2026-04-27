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
} from "lucide-react";
import { format } from "date-fns";
import { api } from "@shared/routes";
import type { DashboardStats, BookingWithUser } from "@shared/schema";
import { useBookings } from "@/hooks/use-bookings";
import { formatStatus, statusColor } from "@/lib/booking-utils";
import { cn } from "@/lib/utils";

const ADMIN_TABS: {
  href: string;
  label: string;
  icon: React.ReactNode;
  matches: (path: string) => boolean;
  hint?: string;
}[] = [
  { href: "/admin", label: "Overview", icon: <LayoutDashboard size={15} />, matches: (p) => p === "/admin" },
  { href: "/admin/clients", label: "Clients", icon: <Users size={15} />, matches: (p) => p.startsWith("/admin/clients") },
  { href: "/admin/bookings", label: "Bookings", icon: <Calendar size={15} />, matches: (p) => p.startsWith("/admin/bookings") },
  { href: "/admin/packages", label: "Sessions", icon: <PackageIcon size={15} />, matches: (p) => p.startsWith("/admin/packages") },
  { href: "/admin/clients", label: "InBody", icon: <Activity size={15} />, matches: () => false, hint: "Open a client to manage InBody scans" },
  { href: "/admin/clients", label: "Progress", icon: <Camera size={15} />, matches: () => false, hint: "Open a client to manage progress photos" },
  { href: "/admin/settings", label: "Settings", icon: <SettingsIcon size={15} />, matches: (p) => p.startsWith("/admin/settings") },
];

export function AdminTabs() {
  const [location] = useLocation();
  return (
    <div className="rounded-2xl border border-white/5 bg-card/60 p-1.5 mb-8 overflow-x-auto">
      <div className="flex gap-1 min-w-max">
        {ADMIN_TABS.map((t) => {
          const active = t.matches(location);
          return (
            <Link
              key={t.label}
              href={t.href}
              data-testid={`admintab-${t.label.toLowerCase()}`}
              title={t.hint}
              className={cn(
                "inline-flex items-center gap-2 h-9 px-3 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap",
                active
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-white/5",
              )}
            >
              {t.icon}
              {t.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
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
        <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">Overview</p>
        <h1 className="text-3xl font-display font-bold" data-testid="text-admin-title">
          Admin Dashboard
        </h1>
        <p className="text-muted-foreground text-sm">Manage clients, bookings, packages, and settings — all in one place.</p>
      </div>

      <AdminTabs />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={<Users size={20} />} label="Total Clients" value={stats?.totalClients ?? 0} testId="stat-clients" />
        <StatCard icon={<CalendarCheck size={20} />} label="Upcoming" value={stats?.upcomingBookings ?? 0} testId="stat-upcoming" />
        <StatCard icon={<Clock size={20} />} label="Today" value={stats?.bookingsToday ?? 0} testId="stat-today" />
        <StatCard icon={<TrendingUp size={20} />} label="Completed (mo.)" value={stats?.completedThisMonth ?? 0} testId="stat-completed" />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 rounded-3xl border border-white/5 bg-card/60 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-display font-bold text-lg">Upcoming sessions</h3>
            <Link href="/admin/bookings" className="text-xs text-primary inline-flex items-center gap-1" data-testid="link-all-bookings">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground py-10 text-center">No upcoming sessions.</p>
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
                    <p className="text-sm font-semibold truncate">{b.user?.fullName || "Client"}</p>
                    <p className="text-xs text-muted-foreground">
                      {b.timeSlot} • {b.user?.phone || ""}
                    </p>
                  </div>
                  <span
                    className={`text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border ${statusColor(b.status)}`}
                  >
                    {formatStatus(b.status)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/5 bg-card/60 p-6">
          <h3 className="font-display font-bold text-lg mb-5">Quick actions</h3>
          <div className="space-y-2">
            <QuickAction href="/admin/clients" label="View & edit clients" />
            <QuickAction href="/admin/bookings" label="Manage bookings" />
            <QuickAction href="/admin/packages" label="Sessions & packages" />
            <QuickAction href="/admin/settings" label="Off days, blocked hours, profile" />
            <QuickAction href="/" label="View public site" external />
          </div>
          <p className="text-[11px] text-muted-foreground mt-4 leading-relaxed">
            InBody scans and progress photos are managed inside each client's profile — open any client from the Clients tab.
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
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  testId: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/5 bg-card/60 p-5"
      data-testid={testId}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-2xl font-display font-bold">{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </motion.div>
  );
}

function QuickAction({ href, label, external }: { href: string; label: string; external?: boolean }) {
  return (
    <Link
      href={href}
      data-testid={`quick-${label.toLowerCase().replace(/\s+/g, "-")}`}
      className="flex items-center justify-between px-4 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-sm font-medium transition-colors"
    >
      <span>{label}</span>
      {external ? <ExternalLink size={14} /> : <ArrowRight size={14} />}
    </Link>
  );
}
