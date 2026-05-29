import { useEffect, useRef } from "react";
import { Link, useLocation } from "wouter";
import {
  Home,
  Users,
  LayoutDashboard,
  Calendar,
  Camera,
  MoreHorizontal,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";
import { isEffectiveSuperAdmin } from "@shared/schema";

/**
 * AdminTabs — global top navigation strip for the entire /admin/*
 * surface. Mounted ONCE in App.tsx (May 2026 lift) so it stays
 * visible across every admin section without each page having to
 * mount it.
 *
 * UX guarantees (May 2026 polish pass):
 *   • Layout-stable active state — the cyan pill uses `ring`
 *     (box-shadow under the hood) + same paddings as inactive, so
 *     switching tabs never reflows the row width.
 *   • Sticky to the very top of the viewport via .admin-tabs-sticky
 *     (defined in client/src/index.css). Backdrop-blur + isolation
 *     so it never bleeds into siblings.
 *   • Active tab auto-scrolls into horizontal view on route change
 *     (`scrollIntoView({inline: "center"})`) so deep-link landings
 *     never hide the current tab off-screen on narrow phones.
 *   • `touch-action: pan-x` on the scroll container — a fast
 *     horizontal swipe on the strip never accidentally scrolls
 *     the page vertically (no jitter on Samsung Internet / iOS).
 *   • `overscroll-behavior-x: contain` so swiping past the start
 *     of the strip doesn't trigger the browser's "back" gesture.
 *   • `aria-current="page"` on the active tab.
 *   • "Home" tab navigates back to the public homepage. The admin
 *     session is server-side (cookie), so re-entering /admin lands
 *     the user straight back into the dashboard with no re-auth.
 */

type TabSpec = {
  href: string;
  labelKey: string;
  fallback: string;
  icon: React.ReactNode;
  matches: (path: string) => boolean;
  /** When true the tab is hidden for non-super-admin sessions */
  superAdminOnly?: boolean;
};

// 6-tab strip: Home | Dashboard | Clients | Bookings | Media | More
// All secondary tools (Analytics, Leads, Settings, etc.) live behind
// the More hub at /admin/more — see AdminMore.tsx.
const ADMIN_TABS: TabSpec[] = [
  { href: "/", labelKey: "admin.tabs.home", fallback: "Home", icon: <Home size={15} />, matches: () => false },
  { href: "/admin", labelKey: "admin.tabs.overview", fallback: "Dashboard", icon: <LayoutDashboard size={15} />, matches: (p) => p === "/admin" },
  { href: "/admin/clients", labelKey: "admin.tabs.clients", fallback: "Clients", icon: <Users size={15} />, matches: (p) => p.startsWith("/admin/clients") },
  { href: "/admin/bookings", labelKey: "admin.tabs.bookings", fallback: "Bookings", icon: <Calendar size={15} />, matches: (p) => p.startsWith("/admin/bookings") },
  { href: "/admin/media", labelKey: "admin.tabs.media", fallback: "Media", icon: <Camera size={15} />, matches: (p) => p.startsWith("/admin/media") },
  { href: "/admin/more", labelKey: "admin.tabs.more", fallback: "More", icon: <MoreHorizontal size={15} />, matches: (p) => p.startsWith("/admin/more") },
];

// Preload map — thunk fires on hover/focus, making the chunk hot before
// the user clicks. Safe to call multiple times; lazy() caches internally.
const ADMIN_PRELOAD: Record<string, () => Promise<unknown>> = {
  "/admin": () => import("@/pages/AdminDashboard"),
  "/admin/clients": () => import("@/pages/AdminClients"),
  "/admin/bookings": () => import("@/pages/AdminBookings"),
  "/admin/media": () => import("@/pages/AdminMedia"),
  "/admin/more": () => import("@/pages/AdminMore"),
};

function preloadAdminRoute(href: string) {
  const fn = ADMIN_PRELOAD[href];
  if (fn) {
    // Swallow failures — preload is best-effort; the real navigation
    // will surface any actual chunk-loading error to Suspense.
    fn().catch(() => {});
  }
}

export function AdminTabs() {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { user } = useAuth();
  const isSuperAdmin = isEffectiveSuperAdmin(user as any);

  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    const id = requestAnimationFrame(() => {
      try {
        el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      } catch {
        // Older Samsung Internet builds throw on the options object — silent fallback.
      }
    });
    return () => cancelAnimationFrame(id);
  }, [location]);

  return (
    <div
      ref={scrollerRef}
      className="admin-tabs-sticky rounded-2xl border border-white/[0.06] bg-card/80 p-1 mb-3 sm:mb-5 overflow-x-auto admin-tabs-scroll [-webkit-overflow-scrolling:touch]"
      style={{ touchAction: "pan-x", overscrollBehaviorX: "contain" }}
      data-testid="admin-tabs"
    >
      <div className="flex gap-0.5 min-w-max">
        {ADMIN_TABS.filter((tab) => !tab.superAdminOnly || isSuperAdmin).map((tab) => {
          const active = tab.matches(location);
          const label = t(tab.labelKey, tab.fallback);
          return (
            <Link
              key={tab.labelKey + tab.href}
              href={tab.href}
              ref={active ? activeRef : undefined}
              data-testid={`admintab-${tab.fallback.toLowerCase()}`}
              aria-current={active ? "page" : undefined}
              onMouseEnter={() => preloadAdminRoute(tab.href)}
              onFocus={() => preloadAdminRoute(tab.href)}
              onTouchStart={() => preloadAdminRoute(tab.href)}
              className={cn(
                "inline-flex items-center gap-1.5 h-9 justify-center px-3.5 rounded-xl text-[12px] sm:text-[12.5px] font-semibold whitespace-nowrap",
                "transition-[background-color,color,box-shadow] duration-150 ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-0",
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
