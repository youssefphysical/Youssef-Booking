import { Link, useLocation } from "wouter";
import {
  Home,
  Users,
  LayoutDashboard,
  Calendar,
  Package as PackageIcon,
  Activity,
  Camera,
  Settings as SettingsIcon,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";

/**
 * AdminTabs — global top navigation strip for the entire /admin/*
 * surface. Mounted ONCE in App.tsx (May 2026 lift) so it stays
 * visible across every admin section (Overview, Clients, Bookings,
 * Analytics, Sessions/Packages, ClientDetail, Settings, Staff,
 * Nutrition, Supplements, etc.) without each page having to mount it.
 *
 * Behavior contract:
 *   • Sticky to the top of the viewport via .admin-tabs-sticky
 *     (defined in client/src/index.css). Backdrop-blur + isolation
 *     so it never bleeds into siblings.
 *   • Horizontally scrollable on mobile (overflow-x-auto), but each
 *     individual tab is whitespace-nowrap so labels never break.
 *   • Active tab gets the cyan/primary segmented-control treatment
 *     + soft underglow + aria-current="page".
 *   • "Home" tab navigates back to the public homepage. Session is
 *     preserved server-side (cookie), so re-entering /admin lands
 *     the user straight back into the dashboard.
 */

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
  // Home — back to the public site, session preserved.
  { href: "/", labelKey: "admin.tabs.home", fallback: "Home", icon: <Home size={15} />, matches: () => false },
  { href: "/admin", labelKey: "admin.tabs.overview", fallback: "Overview", icon: <LayoutDashboard size={15} />, matches: (p) => p === "/admin" },
  { href: "/admin/clients", labelKey: "admin.tabs.clients", fallback: "Clients", icon: <Users size={15} />, matches: (p) => p.startsWith("/admin/clients") },
  { href: "/admin/bookings", labelKey: "admin.tabs.bookings", fallback: "Bookings", icon: <Calendar size={15} />, matches: (p) => p.startsWith("/admin/bookings") },
  { href: "/admin/packages", labelKey: "admin.tabs.sessions", fallback: "Sessions", icon: <PackageIcon size={15} />, matches: (p) => p.startsWith("/admin/packages") },
  { href: "/admin/analytics", labelKey: "admin.tabs.analytics", fallback: "Analytics", icon: <BarChart3 size={15} />, matches: (p) => p.startsWith("/admin/analytics") },
  // Hint-only entries — never render as active. They tell admins where
  // to find InBody / Progress (inside a client profile) without making
  // the tab strip lie about destination.
  { href: "/admin/clients", labelKey: "admin.tabs.inbody", fallback: "InBody", icon: <Activity size={15} />, matches: () => false, hintKey: "admin.tabs.inbodyHint", hintFallback: "Open a client to manage InBody scans" },
  { href: "/admin/clients", labelKey: "admin.tabs.progress", fallback: "Progress", icon: <Camera size={15} />, matches: () => false, hintKey: "admin.tabs.progressHint", hintFallback: "Open a client to manage progress photos" },
  { href: "/admin/settings", labelKey: "admin.tabs.settings", fallback: "Settings", icon: <SettingsIcon size={15} />, matches: (p) => p.startsWith("/admin/settings") },
];

export function AdminTabs() {
  const [location] = useLocation();
  const { t } = useTranslation();
  return (
    <div
      className="admin-tabs-sticky rounded-2xl border border-white/[0.06] bg-card/80 p-1 mb-3 sm:mb-5 overflow-x-auto admin-tabs-scroll [-webkit-overflow-scrolling:touch]"
      data-testid="admin-tabs"
    >
      <div className="flex gap-0.5 min-w-max">
        {ADMIN_TABS.map((tab) => {
          const active = tab.matches(location);
          const label = t(tab.labelKey, tab.fallback);
          return (
            <Link
              key={tab.labelKey + tab.href}
              href={tab.href}
              data-testid={`admintab-${tab.fallback.toLowerCase()}`}
              title={tab.hintKey ? t(tab.hintKey, tab.hintFallback) : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 justify-center px-3.5 rounded-xl text-[12px] sm:text-[12.5px] font-semibold transition-colors whitespace-nowrap",
                active
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30 shadow-[0_0_14px_-4px_hsl(var(--primary)/0.45)]"
                  : "text-muted-foreground/80 hover:text-foreground hover:bg-white/[0.04]",
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
