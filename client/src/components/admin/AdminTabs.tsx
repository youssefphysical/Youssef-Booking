import { useEffect, useRef } from "react";
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
  // Hint-only — never render as active. Tooltip directs the admin to
  // the right place (a client profile) without lying about destination.
  { href: "/admin/clients", labelKey: "admin.tabs.inbody", fallback: "InBody", icon: <Activity size={15} />, matches: () => false, hintKey: "admin.tabs.inbodyHint", hintFallback: "Open a client to manage InBody scans" },
  { href: "/admin/clients", labelKey: "admin.tabs.progress", fallback: "Progress", icon: <Camera size={15} />, matches: () => false, hintKey: "admin.tabs.progressHint", hintFallback: "Open a client to manage progress photos" },
  { href: "/admin/settings", labelKey: "admin.tabs.settings", fallback: "Settings", icon: <SettingsIcon size={15} />, matches: (p) => p.startsWith("/admin/settings") },
];

export function AdminTabs() {
  const [location] = useLocation();
  const { t } = useTranslation();

  // Auto-scroll the active tab into view when the route changes.
  // `inline: "center"` on mobile keeps it visually centered when it
  // overflows; `block: "nearest"` prevents any vertical scroll jump.
  // Guarded by `prefers-reduced-motion` (CSS already sets
  // `scroll-behavior: auto` on .admin-tabs-scroll for that case).
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const activeRef = useRef<HTMLAnchorElement | null>(null);
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    // Defer one frame so layout is committed before scrolling.
    const id = requestAnimationFrame(() => {
      try {
        el.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
      } catch {
        // Older Samsung Internet builds throw on the options object —
        // fall back silently. The tab is still reachable via swipe.
      }
    });
    return () => cancelAnimationFrame(id);
  }, [location]);

  return (
    <div
      ref={scrollerRef}
      className="admin-tabs-sticky rounded-2xl border border-white/[0.06] bg-card/80 p-1 mb-3 sm:mb-5 overflow-x-auto admin-tabs-scroll [-webkit-overflow-scrolling:touch]"
      // touch-action: pan-x lets the OS know horizontal swipes are
      // ours (no vertical-scroll handoff battle). overscroll-behavior:
      // contain stops the swipe from triggering browser back-gesture
      // or chaining to the parent scroll.
      style={{ touchAction: "pan-x", overscrollBehaviorX: "contain" }}
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
              ref={active ? activeRef : undefined}
              data-testid={`admintab-${tab.fallback.toLowerCase()}`}
              title={tab.hintKey ? t(tab.hintKey, tab.hintFallback) : undefined}
              aria-current={active ? "page" : undefined}
              className={cn(
                // Layout-stable: every tab keeps the same padding +
                // height + font-weight. Active state only swaps
                // colors / ring (box-shadow) / glow — none of which
                // change layout. transition-[background-color,color,box-shadow]
                // is more specific than transition-colors so the
                // glow eases in alongside the color, no flicker.
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
