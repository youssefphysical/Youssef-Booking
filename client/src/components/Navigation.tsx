import { Link, useLocation } from "wouter";
import {
  Home,
  Calendar,
  User,
  LayoutDashboard,
  Users,
  Package as PackageIcon,
  PackagePlus,
  Calculator,
  Apple,
  UtensilsCrossed,
  ClipboardList,
  Settings as SettingsIcon,
  ShieldCheck,
  LogOut,
  LogIn,
  Menu,
  X,
  Search,
} from "lucide-react";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { isEffectiveSuperAdmin } from "@shared/schema";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { LanguageSelector } from "@/components/LanguageSelector";
import { LogoutConfirmDialog } from "@/components/LogoutConfirmDialog";
import { NotificationsBell } from "@/components/NotificationsBell";
import { CommandPalette, useCommandPaletteShortcut } from "@/components/admin/CommandPalette";
import { useTranslation } from "@/i18n";

export function Navigation() {
  const [location, navigate] = useLocation();
  const { user, isLoading: authLoading, logoutMutation } = useAuth();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  // Cmd/Ctrl+K opens the admin palette globally — only wired when the
  // current user is an admin. The hook itself is a no-op when the
  // setter never fires, but gating keeps the listener off the public
  // app entirely.
  const isAdminUser = user?.role === "admin";
  useCommandPaletteShortcut(isAdminUser ? setPaletteOpen : () => {});

  const requestLogout = useCallback(() => {
    // Always close the mobile drawer if it was open, then surface the
    // confirmation modal. Never trigger the mutation directly from a
    // header/sidebar button — confirmation is mandatory.
    setOpen(false);
    setLogoutOpen(true);
  }, []);

  const confirmLogout = useCallback(() => {
    if (logoutMutation.isPending) return; // de-dupe double clicks
    // Fire-and-forget. Cache flip happens synchronously inside the
    // mutationFn so the redirect below renders as guest immediately.
    logoutMutation.mutate(undefined, {
      onSettled: () => setLogoutOpen(false),
    });
    navigate("/");
  }, [logoutMutation, navigate]);

  // ============== AUTH STATE — single source of truth ==============
  // The auth area MUST NEVER disappear. It must always show one of two
  // CTAs: Sign In (for loading + guest) or Profile/Logout (for an
  // authenticated user). No empty state is allowed.
  //
  // Three named booleans, all derived from the same useAuth() snapshot:
  //   • isAuthenticated — only true when we KNOW we have a real user.
  //   • isGuest         — only true after auth resolves AND no user.
  //   • shouldShowSignIn — defined as `!isAuthenticated`, which is the
  //     simplest, most bulletproof invariant: any time we don't have a
  //     confirmed user, the Sign-In CTA renders. This single line covers
  //     ALL three "no user" sub-states (loading, guest, transient error)
  //     and is provably mutually exclusive with the authenticated branch.
  //
  // 401 from /api/auth/me is treated as guest (the queryFn in
  // hooks/use-auth.tsx returns `null`, NOT throw), so an unauthenticated
  // visitor is never an "error" state that could hide auth actions. And
  // because the provider exposes `user: user ?? null`, the loading state
  // also surfaces as a falsy `user`, so `!isAuthenticated` is true from
  // the very first paint until either auth resolves to a real user (then
  // it flips to false and the Profile/Logout CTAs take over) or stays
  // resolved as guest (then it stays true forever — Sign In never blinks).
  //
  // Forbidden patterns (intentionally absent from this component):
  //   • `if (!user) return null`
  //   • `if (isLoading) return null`
  //   • Any branch that renders neither Sign-In nor authenticated CTAs.
  //
  // STRICT v8.4 (May 2026) — "Confirmed User Only" gate.
  // ============================================================
  // Per the user-supplied micro-fix spec:
  //   const isConfirmedUser = Boolean(user?.id || user?.email);
  // Sign Out / Profile MUST never appear unless we have a confirmed
  // real authenticated user. Confirmed user is defined as having a
  // valid `user.id` OR `user.email`. Every other state (401, null,
  // undefined, empty object `{}`, failed auth check, transient
  // loading) is treated as guest → Sign In.
  //
  // The desktop branches below render mutually-exclusively on
  // `isConfirmedUser` ALONE — never on "loading complete",
  // "authChecked", "session checked", or `Boolean(user)` truthiness.
  // For every legitimate `UserResponse` from the server `id` is
  // always present (schema: `users.id = serial("id").primaryKey()`),
  // so this is a no-op for real users; for any pathological cache
  // state the desktop stays on Sign In.
  //
  // 401 path: useAuth's queryFn returns `null` on 401 (NOT throw),
  // so an unauthenticated visitor surfaces as `user: null` →
  // `isConfirmedUser = false` → Sign In stays. retry: false +
  // staleTime: Infinity in queryClient mean no surprise refetches
  // can flip the gate.
  //
  // Forbidden patterns (intentionally absent from this component):
  //   • `if (!user) return null`
  //   • `if (isLoading) return null`
  //   • Any branch that renders neither Sign-In nor authenticated CTAs.
  const isConfirmedUser = Boolean(user?.id || user?.email);
  const isGuest = !authLoading && !isConfirmedUser;
  const shouldShowSignIn = !isConfirmedUser;

  const isAdmin = user?.role === "admin";
  const isSuperAdmin = isEffectiveSuperAdmin(user as any);
  const isAdminPage = location.startsWith("/admin");

  // ============= ADMIN SIDEBAR =============
  if (isAdmin && isAdminPage) {
    return (
      <>
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden fixed top-4 left-4 z-[60] p-2 bg-card/80 backdrop-blur-md rounded-xl border border-white/10"
          data-testid="button-toggle-sidebar"
          aria-label={t("nav.toggleMenu")}
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav
          className={cn(
            "fixed left-0 top-0 h-screen w-64 bg-card border-r border-border p-6 z-50 flex-col transition-transform",
            open ? "flex translate-x-0" : "hidden md:flex md:translate-x-0 -translate-x-full",
          )}
        >
          <Link href="/" className="mb-4 px-1 block min-w-0" data-testid="link-home">
            <h1 className="text-lg font-bold font-display text-gradient-blue truncate leading-tight px-0.5 py-0.5">{t("brand.trainerName", "Youssef Ahmed")}</h1>
            <p className="text-[10px] text-muted-foreground mt-1 tracking-widest uppercase leading-snug line-clamp-2">
              {t("nav.adminTagline")}
            </p>
          </Link>

          {/* CMD+K SEARCH TRIGGER — visible affordance for the global palette.
              Mirrors the Linear/Stripe/Raycast pattern: a button that looks
              like a search input, with the keyboard shortcut on the right. */}
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            data-testid="button-open-command-palette"
            className="mb-4 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-left text-sm text-muted-foreground hover:border-white/20 hover:bg-white/[0.06] transition-colors"
          >
            <Search size={14} className="opacity-60" />
            <span className="flex-1 truncate text-xs">
              {t("nav.searchPlaceholder", "Search or jump to…")}
            </span>
            <kbd className="hidden md:inline-flex items-center gap-0.5 rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
              ⌘K
            </kbd>
          </button>

          <div className="flex-1 space-y-4">
            <div className="space-y-1">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70" data-testid="text-section-main">
                {t("nav.section.main")}
              </p>
              <SidebarLink href="/admin" icon={<LayoutDashboard size={18} />} label={t("nav.dashboard")} active={location === "/admin"} onClick={() => setOpen(false)} />
              <SidebarLink href="/admin/bookings" icon={<Calendar size={18} />} label={t("nav.bookings")} active={location.startsWith("/admin/bookings")} onClick={() => setOpen(false)} />
              <SidebarLink href="/admin/clients" icon={<Users size={18} />} label={t("nav.clients")} active={location.startsWith("/admin/clients")} onClick={() => setOpen(false)} />
            </div>
            <div className="space-y-1">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70" data-testid="text-section-business">
                {t("nav.section.business")}
              </p>
              <SidebarLink href="/admin/packages" icon={<PackageIcon size={18} />} label={t("nav.packages")} active={location === "/admin/packages"} onClick={() => setOpen(false)} />
              <SidebarLink href="/admin/package-builder" icon={<PackagePlus size={18} />} label={t("nav.packageBuilder")} active={location.startsWith("/admin/package-builder")} onClick={() => setOpen(false)} />
              <SidebarLink href="/admin/nutrition/macro-calculator" icon={<Calculator size={18} />} label={t("nav.macroCalculator", "Macro Calculator")} active={location === "/admin/nutrition/macro-calculator"} onClick={() => setOpen(false)} />
              <SidebarLink href="/admin/nutrition/foods" icon={<Apple size={18} />} label={t("nav.foodLibrary", "Food Library")} active={location.startsWith("/admin/nutrition/foods")} onClick={() => setOpen(false)} />
              <SidebarLink href="/admin/nutrition/meals" icon={<UtensilsCrossed size={18} />} label={t("nav.mealLibrary", "Meal Library")} active={location === "/admin/nutrition/meals" || location.startsWith("/admin/nutrition/meals/")} onClick={() => setOpen(false)} />
              <SidebarLink href="/admin/nutrition/plans" icon={<ClipboardList size={18} />} label={t("nav.nutritionPlans", "Nutrition Plans")} active={location.startsWith("/admin/nutrition/plans")} onClick={() => setOpen(false)} />
            </div>
            <div className="space-y-1">
              <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70" data-testid="text-section-system">
                {t("nav.section.system")}
              </p>
              {isSuperAdmin && (
                <SidebarLink href="/admin/staff" icon={<ShieldCheck size={18} />} label={t("nav.staff")} active={location.startsWith("/admin/staff")} onClick={() => setOpen(false)} />
              )}
              <SidebarLink href="/admin/settings" icon={<SettingsIcon size={18} />} label={t("nav.settings")} active={location.startsWith("/admin/settings")} onClick={() => setOpen(false)} />
            </div>
          </div>

          <div className="pt-4 border-t border-border space-y-2">
            <div className="px-2 pb-1">
              <LanguageSelector variant="full" className="w-full justify-between" />
            </div>
            <Link href="/" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm hover:bg-white/5 text-muted-foreground" data-testid="link-public-site">
              <Home size={16} />
              <span>{t("nav.publicSite")}</span>
            </Link>
            <button
              onClick={requestLogout}
              data-testid="button-logout"
              className="flex w-full items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut size={16} />
              <span>{t("nav.signOut")}</span>
            </button>
          </div>
        </nav>
        <LogoutConfirmDialog
          open={logoutOpen}
          onOpenChange={setLogoutOpen}
          onConfirm={confirmLogout}
          isPending={logoutMutation.isPending}
        />
        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
      </>
    );
  }

  // ============= PUBLIC TOP NAV =============
  return (
    <header
      className="fixed top-0 inset-x-0 z-[100] bg-background/95 md:bg-background/75 md:backdrop-blur-lg border-b border-white/5"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-5 h-16 flex items-center justify-between gap-2 sm:gap-3">
        <Link
          href="/"
          className="font-display font-bold text-base sm:text-lg shrink-0 min-w-0"
          data-testid="link-brand"
        >
          <span className="text-gradient-blue whitespace-nowrap">
            <span className="hidden sm:inline">{t("nav.brand")}</span>
            <span className="sm:hidden">{t("brand.trainerName", "Youssef Ahmed")}</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 flex-1 justify-center">
          <TopNavLink href="/" label={t("nav.home")} testKey="home" active={location === "/"} />
          <TopNavLink href="/book" label={t("nav.book")} testKey="book" active={location === "/book"} />
          <TopNavLink href="/how-it-works" label={t("nav.howItWorks")} testKey="how-it-works" active={location === "/how-it-works"} />
          <TopNavLink href="/policy" label={t("nav.policy")} testKey="policy" active={location === "/policy"} />
          {user?.role === "client" && (
            <TopNavLink href="/dashboard" label={t("nav.mySessions")} testKey="my-sessions" active={location.startsWith("/dashboard")} />
          )}
          {user?.role === "client" && (
            <TopNavLink href="/profile" label={t("nav.profile")} testKey="profile" active={location === "/profile"} />
          )}
          {user?.role === "admin" && (
            <TopNavLink href="/admin" label={t("nav.controlPanel")} testKey="control-panel" active={location.startsWith("/admin")} />
          )}
        </nav>

        {/* Auth area — explicitly elevated above the header itself with
            relative positioning + z-[110] so even if a future overlay
            tried to reach above the fixed header, the Sign-In CTA can
            never be obscured. This is belt-and-braces: the header is
            already z-[100] and the hero overlay layers all sit at the
            default z=0 inside their own .hero-isolate stacking context. */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 relative z-[110]">
          {isConfirmedUser && user?.role === "client" && <NotificationsBell />}
          <LanguageSelector />
          {/* DESKTOP AUTH AREA — STRICT mutually-exclusive conditional.
              =====================================================
              EXACTLY ONE of the two branches below renders on desktop
              (≥sm), never both, never neither. This fixes the v6.2
              CSS-hide approach (which kept the Sign In pill in the DOM
              just hidden via `md:hidden`) by making the rendering itself
              auth-state-aware. The mobile static Sign In pill below is
              completely independent and intentionally untouched.
                - authenticated  → profile avatar + Sign Out only
                - guest/loading  → Desktop Sign In only
              Both branches use `hidden sm:inline-flex` so neither shows
              up on mobile (mobile uses the static pill below + the
              hamburger drawer for Sign Out). */}
          {isConfirmedUser && user ? (
            <>
              {user.role === "client" && (
                <Link
                  href="/profile"
                  data-testid="link-nav-profile-avatar"
                  className="hidden sm:inline-flex items-center gap-2 pl-1 pr-3 h-9 rounded-full border border-white/10 hover:bg-white/5 hover:border-white/20 btn-soft"
                  title={t("nav.profileTitle")}
                >
                  <UserAvatar
                    src={user.profilePictureUrl}
                    name={user.fullName}
                    size={28}
                    testId="img-nav-avatar"
                    className="border-0"
                  />
                  <span className="text-xs font-medium max-w-[120px] truncate">
                    {user.fullName.split(" ")[0]}
                  </span>
                  {user.isVerified && <VerifiedBadge size="xs" showTooltip={false} testId="badge-nav-verified" />}
                </Link>
              )}
              <button
                onClick={requestLogout}
                data-testid="button-logout"
                className="hidden sm:inline-flex items-center gap-2 text-sm px-4 h-9 rounded-xl border border-white/10 hover:bg-white/5 hover:border-white/20 whitespace-nowrap btn-soft"
              >
                <LogOut size={14} className="shrink-0" />
                <span className="whitespace-nowrap">{t("nav.signOut")}</span>
              </button>
            </>
          ) : (
            /* DESKTOP-ONLY Sign In — only rendered when NOT authenticated.
               Hidden on mobile via `hidden sm:inline-flex` — mobile uses
               the static pill below, which is unconditional per directive. */
            <Link
              href="/auth"
              data-testid="link-signin-desktop"
              className="hidden sm:inline-flex items-center justify-center gap-2 text-sm px-4 h-9 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 whitespace-nowrap shrink-0 btn-press shadow-[0_0_0_1px_hsl(195_100%_60%/0.35),0_6px_22px_-6px_hsl(195_100%_60%/0.55)] hover:shadow-[0_0_0_1px_hsl(195_100%_60%/0.55),0_8px_28px_-6px_hsl(195_100%_60%/0.75)] transition-shadow"
            >
              <LogIn size={14} className="shrink-0" />
              <span className="whitespace-nowrap">{t("nav.signIn")}</span>
            </Link>
          )}
          {/* MOBILE AUTH PILL — auth-state-aware (May 2026 directive).
              ==================================================
              The old "always show Sign In" directive was reversed: when
              the user IS signed in, the mobile pill must visibly become
              Sign Out so they can log out from the header without
              opening the drawer. Mutually exclusive with the
              authenticated branch via `isConfirmedUser`. */}
          {isConfirmedUser ? (
            <button
              type="button"
              onClick={requestLogout}
              data-testid="button-mobile-signout-pill"
              style={{
                position: "relative",
                zIndex: 9999,
                opacity: 1,
                pointerEvents: "auto",
              }}
              className="inline-flex md:hidden items-center justify-center gap-1.5 text-sm px-3.5 h-9 rounded-xl border border-white/15 bg-white/5 text-foreground font-semibold hover:bg-white/10 hover:border-white/25 whitespace-nowrap shrink-0 btn-press"
            >
              <LogOut size={14} className="shrink-0" />
              <span className="whitespace-nowrap">{t("nav.signOut")}</span>
            </button>
          ) : (
            <Link
              href="/auth"
              data-testid="link-signin"
              style={{
                position: "relative",
                zIndex: 9999,
                opacity: 1,
                pointerEvents: "auto",
              }}
              className="inline-flex md:hidden items-center justify-center gap-1.5 text-sm px-3.5 h-9 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 whitespace-nowrap shrink-0 btn-press shadow-[0_0_0_1px_hsl(195_100%_60%/0.35),0_6px_22px_-6px_hsl(195_100%_60%/0.55)] hover:shadow-[0_0_0_1px_hsl(195_100%_60%/0.55),0_8px_28px_-6px_hsl(195_100%_60%/0.75)] transition-shadow"
            >
              <LogIn size={14} className="shrink-0" />
              <span className="whitespace-nowrap">{t("nav.signIn")}</span>
            </Link>
          )}
          <button
            className="md:hidden p-2 rounded-lg border border-white/10 hover:bg-white/5 hover:border-white/20 shrink-0 btn-soft"
            onClick={() => setOpen(!open)}
            aria-label={t("nav.toggleMenu")}
            data-testid="button-mobile-menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      <LogoutConfirmDialog
        open={logoutOpen}
        onOpenChange={setLogoutOpen}
        onConfirm={confirmLogout}
        isPending={logoutMutation.isPending}
      />
      {open && (
        <div className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-md">
          <div className="px-5 py-4 space-y-1">
            {/* Mobile-menu Sign-In link — only when NOT signed in.
                When the user IS signed in, the mobile-menu Sign-Out
                button further down handles the inverse action. */}
            {!isConfirmedUser && (
              <Link
                href="/auth"
                onClick={() => setOpen(false)}
                data-testid="link-mobile-signin"
                style={{
                  position: "relative",
                  zIndex: 9999,
                  opacity: 1,
                  pointerEvents: "auto",
                }}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-semibold bg-primary/15 text-primary border border-primary/30 hover:bg-primary/25 mb-2 btn-press"
              >
                <LogIn size={16} className="shrink-0" />
                <span className="whitespace-nowrap">{t("nav.signIn")}</span>
              </Link>
            )}
            <MobileLink href="/" label={t("nav.home")} testKey="home" icon={<Home size={16} />} onClose={() => setOpen(false)} />
            <MobileLink href="/book" label={t("nav.book")} testKey="book" icon={<Calendar size={16} />} onClose={() => setOpen(false)} />
            <MobileLink href="/how-it-works" label={t("nav.howItWorks")} testKey="how-it-works" icon={<SettingsIcon size={16} />} onClose={() => setOpen(false)} />
            <MobileLink href="/policy" label={t("nav.policy")} testKey="policy" icon={<SettingsIcon size={16} />} onClose={() => setOpen(false)} />
            {user?.role === "client" && (
              <>
                <MobileLink href="/dashboard" label={t("nav.mySessions")} testKey="my-sessions" icon={<LayoutDashboard size={16} />} onClose={() => setOpen(false)} />
                <MobileLink href="/profile" label={t("nav.profile")} testKey="profile" icon={<User size={16} />} onClose={() => setOpen(false)} />
              </>
            )}
            {user?.role === "admin" && (
              <MobileLink href="/admin" label={t("nav.controlPanel")} testKey="control-panel" icon={<LayoutDashboard size={16} />} onClose={() => setOpen(false)} />
            )}
            {/* Sign Out lives in the mobile menu too — header has no room
                for it on small viewports, so without this the only way to
                log out on mobile is via the profile page. Only when we
                KNOW the user is authenticated (never during loading).
                Same `isConfirmedUser` gate as desktop. */}
            {isConfirmedUser && (
              <button
                type="button"
                onClick={requestLogout}
                data-testid="button-mobile-logout"
                className="flex w-full items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-destructive hover:bg-destructive/10 active:bg-destructive/15 btn-soft"
              >
                <LogOut size={16} className="shrink-0" />
                <span className="whitespace-nowrap">{t("nav.signOut")}</span>
              </button>
            )}
            <div className="pt-3 mt-3 border-t border-white/5">
              <LanguageSelector variant="full" className="w-full justify-between" />
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

function SidebarLink({ href, icon, label, active, onClick }: { href: string; icon: React.ReactNode; label: string; active: boolean; onClick?: () => void }) {
  return (
    <Link href={href} onClick={onClick} data-testid={`link-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div
        className={cn(
          "flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm transition-colors",
          active ? "bg-primary/15 text-primary border border-primary/20" : "hover:bg-white/5 text-muted-foreground hover:text-foreground",
        )}
      >
        {icon}
        <span className="font-medium">{label}</span>
      </div>
    </Link>
  );
}

function TopNavLink({ href, label, active, testKey }: { href: string; label: string; active: boolean; testKey: string }) {
  return (
    <Link href={href} data-testid={`link-top-${testKey}`}>
      <div
        className={cn(
          "px-3.5 h-9 inline-flex items-center text-sm font-medium rounded-lg transition-colors whitespace-nowrap",
          active
            ? "text-primary bg-primary/10"
            : "text-muted-foreground hover:text-foreground hover:bg-white/5",
        )}
      >
        {label}
      </div>
    </Link>
  );
}

function MobileLink({ href, label, icon, onClose, testKey }: { href: string; label: string; icon: React.ReactNode; onClose: () => void; testKey: string }) {
  return (
    <Link href={href} onClick={onClose} data-testid={`link-mobile-${testKey}`}>
      <div className="flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium hover:bg-white/5 active:bg-white/10 btn-soft">
        <span className="shrink-0 text-muted-foreground">{icon}</span>
        <span className="whitespace-nowrap">{label}</span>
      </div>
    </Link>
  );
}
