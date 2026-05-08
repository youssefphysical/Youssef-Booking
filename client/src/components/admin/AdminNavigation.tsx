import { useEffect, useMemo, useState, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Apple,
  UtensilsCrossed,
  ClipboardList,
  Calculator,
  Pill,
  Package as PackageIcon,
  PackagePlus,
  BarChart3,
  ShieldCheck,
  Settings as SettingsIcon,
  Plus,
  MoreHorizontal,
  ChevronDown,
  Search,
  Home,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/i18n";
import { LanguageSelector } from "@/components/LanguageSelector";

// ============================================================
// SHARED NAV CONFIG — single source of truth for the admin sidebar
// (desktop) and the "More" drawer (mobile). The mobile bottom dock
// has a separate, intentionally tiny set of always-visible actions.
// ============================================================

export interface AdminNavItem {
  href: string;
  label: string; // already-translated
  icon: React.ReactNode;
  /** True when current location matches this item */
  isActive: (loc: string) => boolean;
  /** Hide unless super-admin */
  superAdminOnly?: boolean;
}

export interface AdminNavGroup {
  id: string;
  label: string; // already-translated
  items: AdminNavItem[];
}

/**
 * Build groups from translation function. Memoize at the call site
 * to avoid recomputing on every render.
 */
export function buildAdminNavGroups(t: (key: string, fallback?: string) => string): AdminNavGroup[] {
  return [
    {
      id: "overview",
      label: t("nav.section.overview", "Overview"),
      items: [
        {
          href: "/admin",
          label: t("nav.dashboard"),
          icon: <LayoutDashboard size={18} />,
          isActive: (loc) => loc === "/admin",
        },
        {
          href: "/admin/analytics",
          label: t("nav.analytics", "Analytics"),
          icon: <BarChart3 size={18} />,
          isActive: (loc) => loc.startsWith("/admin/analytics"),
        },
      ],
    },
    {
      id: "clients",
      label: t("nav.section.clients", "Clients"),
      items: [
        {
          href: "/admin/clients",
          label: t("nav.clients"),
          icon: <Users size={18} />,
          isActive: (loc) => loc.startsWith("/admin/clients"),
        },
      ],
    },
    {
      id: "coaching",
      label: t("nav.section.coaching", "Coaching"),
      items: [
        {
          href: "/admin/bookings",
          label: t("nav.bookings"),
          icon: <Calendar size={18} />,
          isActive: (loc) => loc.startsWith("/admin/bookings"),
        },
      ],
    },
    {
      id: "nutrition",
      label: t("nav.section.nutrition", "Nutrition"),
      items: [
        {
          href: "/admin/nutrition/macro-calculator",
          label: t("nav.macroCalculator", "Macro Calculator"),
          icon: <Calculator size={18} />,
          isActive: (loc) => loc === "/admin/nutrition/macro-calculator",
        },
        {
          href: "/admin/nutrition/foods",
          label: t("nav.foodLibrary", "Food Library"),
          icon: <Apple size={18} />,
          isActive: (loc) => loc.startsWith("/admin/nutrition/foods"),
        },
        {
          href: "/admin/nutrition/meals",
          label: t("nav.mealLibrary", "Meal Library"),
          icon: <UtensilsCrossed size={18} />,
          isActive: (loc) =>
            loc === "/admin/nutrition/meals" || loc.startsWith("/admin/nutrition/meals/"),
        },
        {
          href: "/admin/nutrition/plans",
          label: t("nav.nutritionPlans", "Nutrition Plans"),
          icon: <ClipboardList size={18} />,
          isActive: (loc) => loc.startsWith("/admin/nutrition/plans"),
        },
      ],
    },
    {
      id: "supplements",
      label: t("nav.section.supplements", "Supplements"),
      items: [
        {
          href: "/admin/supplement-stacks",
          label: t("nav.supplementStacks", "Supplement Stacks"),
          icon: <Pill size={18} />,
          isActive: (loc) => loc.startsWith("/admin/supplement"),
        },
      ],
    },
    {
      id: "financial",
      label: t("nav.section.financial", "Financial"),
      items: [
        {
          href: "/admin/packages",
          label: t("nav.packages"),
          icon: <PackageIcon size={18} />,
          isActive: (loc) => loc === "/admin/packages",
        },
        {
          href: "/admin/package-builder",
          label: t("nav.packageBuilder", "Package Builder"),
          icon: <PackagePlus size={18} />,
          isActive: (loc) => loc.startsWith("/admin/package-builder"),
        },
      ],
    },
    {
      id: "system",
      label: t("nav.section.system"),
      items: [
        {
          href: "/admin/staff",
          label: t("nav.staff"),
          icon: <ShieldCheck size={18} />,
          isActive: (loc) => loc.startsWith("/admin/staff"),
          superAdminOnly: true,
        },
        {
          href: "/admin/settings",
          label: t("nav.settings"),
          icon: <SettingsIcon size={18} />,
          isActive: (loc) => loc.startsWith("/admin/settings"),
        },
      ],
    },
  ];
}

// ============================================================
// COLLAPSED-GROUPS PERSISTENCE — localStorage hook. SSR-safe.
// ============================================================

const COLLAPSED_KEY = "admin.sidebar.collapsed.v1";

function readCollapsed(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.localStorage.getItem(COLLAPSED_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr.filter((x): x is string => typeof x === "string")) : new Set();
  } catch {
    return new Set();
  }
}

function writeCollapsed(set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(COLLAPSED_KEY, JSON.stringify(Array.from(set)));
  } catch {
    /* quota / privacy — silent */
  }
}

function useCollapsedGroups() {
  const [collapsed, setCollapsed] = useState<Set<string>>(() => readCollapsed());
  const toggle = useCallback((id: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writeCollapsed(next);
      return next;
    });
  }, []);
  return { collapsed, toggle };
}

// ============================================================
// SIDEBAR LINK — premium active state with 2px luxury accent bar
// ============================================================

interface SidebarLinkProps {
  href: string;
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick?: () => void;
}

function SidebarLink({ href, icon, label, active, onClick }: SidebarLinkProps) {
  return (
    <Link
      href={href}
      onClick={onClick}
      data-testid={`link-${label.toLowerCase().replace(/\s+/g, "-")}`}
      aria-current={active ? "page" : undefined}
    >
      <div
        className={cn(
          "relative flex items-center gap-3 px-4 py-2 rounded-lg text-sm transition-all duration-150",
          active
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-white/[0.04] hover:text-foreground",
        )}
      >
        {/* Luxury active accent — 2px primary bar on the start edge */}
        {active && (
          <span
            aria-hidden
            className="absolute start-0 top-2 bottom-2 w-[2px] rounded-full bg-primary"
          />
        )}
        <span className={cn("shrink-0", active ? "text-primary" : "")}>{icon}</span>
        <span className={cn("font-medium truncate", active && "font-semibold")}>{label}</span>
      </div>
    </Link>
  );
}

// ============================================================
// ADMIN SIDEBAR — desktop (md+) fixed left panel + mobile drawer
// ============================================================

export interface AdminSidebarProps {
  isSuperAdmin: boolean;
  /** Called when any link/button is tapped. Use to close mobile drawer. */
  onItemClick?: () => void;
  /** Open the Cmd+K palette */
  onOpenPalette: () => void;
  /** Trigger the logout confirmation dialog */
  onLogout: () => void;
}

export function AdminSidebar({
  isSuperAdmin,
  onItemClick,
  onOpenPalette,
  onLogout,
}: AdminSidebarProps) {
  const [location] = useLocation();
  const { t } = useTranslation();
  const { collapsed, toggle } = useCollapsedGroups();

  const groups = useMemo(() => buildAdminNavGroups(t), [t]);

  return (
    <div className="flex h-full w-full flex-col bg-card">
      {/* Brand */}
      <div className="px-5 pt-6 pb-3">
        <Link href="/" className="block min-w-0" data-testid="link-home" onClick={onItemClick}>
          <h1 className="text-lg font-bold font-display text-gradient-blue truncate leading-tight">
            {t("brand.trainerName", "Youssef Ahmed")}
          </h1>
          <p className="text-[10px] text-muted-foreground/80 mt-1 tracking-[0.18em] uppercase leading-snug line-clamp-2">
            {t("nav.adminTagline")}
          </p>
        </Link>
      </div>

      {/* Search trigger — premium ⌘K affordance */}
      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => {
            onOpenPalette();
            onItemClick?.();
          }}
          data-testid="button-open-command-palette"
          className="flex w-full items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-2 text-left text-sm text-muted-foreground hover:border-white/[0.14] hover:bg-white/[0.05] transition-colors"
        >
          <Search size={14} className="opacity-60" />
          <span className="flex-1 truncate text-xs">
            {t("nav.searchPlaceholder", "Search or jump to…")}
          </span>
          <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground/80">
            ⌘K
          </kbd>
        </button>
      </div>

      {/* Groups — scroll if overflow */}
      <nav className="flex-1 overflow-y-auto px-2 pb-2 space-y-1">
        {groups.map((group) => {
          const visibleItems = group.items.filter((it) => !it.superAdminOnly || isSuperAdmin);
          if (visibleItems.length === 0) return null;
          const isCollapsed = collapsed.has(group.id);
          // If any item in the group is active, force expanded so users can
          // always see where they are even if they previously collapsed it.
          const hasActiveChild = visibleItems.some((it) => it.isActive(location));
          const showItems = !isCollapsed || hasActiveChild;

          return (
            <div key={group.id} className="pt-2 first:pt-0">
              <button
                type="button"
                onClick={() => toggle(group.id)}
                data-testid={`button-toggle-group-${group.id}`}
                className="group flex w-full items-center justify-between gap-2 rounded-md px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 hover:text-foreground transition-colors"
              >
                <span>{group.label}</span>
                <ChevronDown
                  size={12}
                  className={cn(
                    "shrink-0 opacity-50 transition-transform duration-200",
                    showItems ? "" : "-rotate-90 rtl:rotate-90",
                  )}
                />
              </button>
              <div
                className={cn(
                  "overflow-hidden transition-[max-height,opacity] duration-200 ease-out",
                  showItems ? "max-h-[600px] opacity-100" : "max-h-0 opacity-0",
                )}
              >
                <div className="space-y-0.5 py-1">
                  {visibleItems.map((it) => (
                    <SidebarLink
                      key={it.href}
                      href={it.href}
                      icon={it.icon}
                      label={it.label}
                      active={it.isActive(location)}
                      onClick={onItemClick}
                    />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/[0.06] px-3 pt-3 pb-4 space-y-1.5">
        <div className="px-1 pb-1">
          <LanguageSelector variant="full" className="w-full justify-between" />
        </div>
        <Link
          href="/"
          onClick={onItemClick}
          className="flex items-center gap-3 px-4 py-2 rounded-lg text-sm hover:bg-white/[0.04] text-muted-foreground hover:text-foreground transition-colors"
          data-testid="link-public-site"
        >
          <Home size={16} />
          <span>{t("nav.publicSite")}</span>
        </Link>
        <button
          onClick={() => {
            onItemClick?.();
            onLogout();
          }}
          data-testid="button-logout"
          className="flex w-full items-center gap-3 px-4 py-2 rounded-lg text-sm text-destructive/90 hover:bg-destructive/10 hover:text-destructive transition-colors"
        >
          <LogOut size={16} />
          <span>{t("nav.signOut")}</span>
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ADMIN MOBILE BOTTOM NAV — native-app dock
// 5 slots: Home · Clients · [+ Add] · Calendar · More
// The center "+" is an elevated FAB that opens the palette in
// create mode. "More" opens the full sidebar drawer.
// ============================================================

export interface AdminMobileBottomNavProps {
  onOpenPalette: () => void;
  onOpenMore: () => void;
}

interface DockItem {
  key: string;
  href?: string;
  label: string;
  icon: React.ReactNode;
  isActive: (loc: string) => boolean;
  onPress?: () => void;
}

export function AdminMobileBottomNav({ onOpenPalette, onOpenMore }: AdminMobileBottomNavProps) {
  const [location] = useLocation();
  const { t } = useTranslation();

  const items: DockItem[] = [
    {
      key: "home",
      href: "/admin",
      label: t("nav.dashboard"),
      icon: <LayoutDashboard size={20} />,
      isActive: (loc) => loc === "/admin",
    },
    {
      key: "clients",
      href: "/admin/clients",
      label: t("nav.clients"),
      icon: <Users size={20} />,
      isActive: (loc) => loc.startsWith("/admin/clients"),
    },
    {
      key: "calendar",
      href: "/admin/bookings",
      label: t("nav.bookings"),
      icon: <Calendar size={20} />,
      isActive: (loc) => loc.startsWith("/admin/bookings"),
    },
    {
      key: "more",
      label: t("nav.more", "More"),
      icon: <MoreHorizontal size={20} />,
      isActive: () => false,
      onPress: onOpenMore,
    },
  ];

  return (
    <nav
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-card/95 backdrop-blur-xl border-t border-white/[0.06]"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      data-testid="nav-admin-mobile-bottom"
      aria-label={t("nav.bottomNavLabel", "Admin navigation")}
    >
      <div className="relative grid grid-cols-5 h-16">
        {/* Slots 0,1 */}
        {items.slice(0, 2).map((it) => (
          <DockButton key={it.key} item={it} location={location} />
        ))}

        {/* Center FAB — opens palette in create mode */}
        <div className="flex items-start justify-center pt-1">
          <button
            type="button"
            onClick={onOpenPalette}
            data-testid="button-mobile-quick-add"
            aria-label={t("nav.quickAdd", "Quick add")}
            className="relative -translate-y-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 active:scale-95 transition-transform"
          >
            <Plus size={22} strokeWidth={2.5} />
          </button>
        </div>

        {/* Slots 2,3 */}
        {items.slice(2, 4).map((it) => (
          <DockButton key={it.key} item={it} location={location} />
        ))}
      </div>
    </nav>
  );
}

function DockButton({ item, location }: { item: DockItem; location: string }) {
  const active = item.isActive(location);
  const inner = (
    <div
      className={cn(
        "flex h-full w-full flex-col items-center justify-center gap-0.5 transition-colors",
        active ? "text-primary" : "text-muted-foreground",
      )}
    >
      <span
        className={cn(
          "flex h-7 w-7 items-center justify-center rounded-lg transition-colors",
          active ? "bg-primary/10" : "",
        )}
      >
        {item.icon}
      </span>
      <span className="text-[10px] font-medium tracking-wide truncate max-w-[60px]">
        {item.label}
      </span>
    </div>
  );

  if (item.onPress) {
    return (
      <button
        type="button"
        onClick={item.onPress}
        data-testid={`dock-${item.key}`}
        className="flex flex-col items-center justify-center"
      >
        {inner}
      </button>
    );
  }
  return (
    <Link href={item.href!} data-testid={`dock-${item.key}`} className="flex flex-col items-center justify-center">
      {inner}
    </Link>
  );
}

/**
 * A spacer block to add bottom padding to admin pages so content
 * isn't hidden behind the fixed bottom dock on mobile. Mount once
 * inside the admin layout (or end of the sidebar component).
 */
export function AdminMobileBottomSpacer() {
  return (
    <div
      aria-hidden
      className="md:hidden h-16"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    />
  );
}

// Touch-and-go: re-export for legacy single-import sites
export { useCollapsedGroups };
// Suppress unused-warning — kept for potential future export
useEffect; // eslint-disable-line @typescript-eslint/no-unused-expressions
