import { Switch, Route, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { I18nProvider } from "@/i18n";
import { Navigation } from "@/components/Navigation";
import { ClientBottomNav } from "@/components/ClientBottomNav";
import { PremiumPageLoader } from "@/components/PremiumPageLoader";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { isEffectiveSuperAdmin } from "@shared/schema";
import { trackPageView } from "@/lib/analytics";

// ===== Eager-loaded routes (critical path) =====
// HomePage is the LCP page for unauthenticated visitors and must paint
// without an extra network round trip. AuthPage is the next step in the
// funnel and small enough to keep eager. NotFound is tiny and a fallback
// that should always be available without network.
import HomePage from "@/pages/HomePage";
import AuthPage from "@/pages/AuthPage";
import NotFound from "@/pages/not-found";
import { CookieBanner } from "@/components/CookieBanner";
import { InstallPrompt } from "@/components/InstallPrompt";
import { HelpFab } from "@/components/HelpFab";
import { ImpersonationBanner } from "@/components/admin/ImpersonationBanner";
import { OfflineBanner } from "@/components/OfflineBanner";
import { OfflineQueueBanner } from "@/components/OfflineQueueBanner";
import { MaintenanceScreen } from "@/components/MaintenanceScreen";
import { useFeatureFlag } from "@/lib/featureFlags";
import { useSettings } from "@/hooks/use-settings";
import { applyBrandCSSVars } from "@/lib/brandSettings";

// ===== Lazy-loaded routes (split into per-page chunks) =====
// Every other page is loaded on demand. This keeps the initial JS
// payload small — no admin, nutrition, or builder code is shipped to
// guests on the homepage.
const ResetPassword = lazy(() => import("@/pages/ResetPassword"));
const AdminAccessPage = lazy(() => import("@/pages/AdminAccessPage"));
const BookingPage = lazy(() => import("@/pages/BookingPage"));
const ClientDashboard = lazy(() => import("@/pages/ClientDashboard"));
const ProfilePage = lazy(() => import("@/pages/ProfilePage"));
const CancellationPolicyPage = lazy(() => import("@/pages/CancellationPolicyPage"));
const PrivacyPolicy = lazy(() => import("@/pages/PrivacyPolicy"));
const TermsConditions = lazy(() => import("@/pages/TermsConditions"));
const MedicalDisclaimer = lazy(() => import("@/pages/MedicalDisclaimer"));
const CookiePolicy = lazy(() => import("@/pages/CookiePolicy"));
const HowItWorks = lazy(() => import("@/pages/HowItWorks"));
const TransformationsGallery = lazy(() => import("@/pages/TransformationsGallery"));
const AdminDashboard = lazy(() => import("@/pages/AdminDashboard"));
const AdminCommandCenter = lazy(() => import("@/pages/AdminCommandCenter"));
const AdminLeads = lazy(() => import("@/pages/AdminLeads"));
const AdminIntegrity = lazy(() => import("@/pages/AdminIntegrity"));
const AdminAnalytics = lazy(() => import("@/pages/AdminAnalytics"));
const AdminBusinessHealth = lazy(() => import("@/pages/AdminBusinessHealth"));
const AdminBookings = lazy(() => import("@/pages/AdminBookings"));
const AdminClients = lazy(() => import("@/pages/AdminClients"));
const AdminDataCenter = lazy(() => import("@/pages/AdminDataCenter"));
const AdminManagementAnalysis = lazy(
  () => import("@/pages/AdminManagementAnalysis"),
);
const AdminControlPanel = lazy(() => import("@/pages/AdminControlPanel"));
const AdminClientDetail = lazy(() => import("@/pages/AdminClientDetail"));
const AdminPackages = lazy(() => import("@/pages/AdminPackages"));
const AdminPackageBuilder = lazy(() => import("@/pages/AdminPackageBuilder"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const AdminMedia = lazy(() => import("@/pages/AdminMedia"));
const AdminStaffPage = lazy(() => import("@/pages/AdminStaffPage"));
const AdminAuditLog = lazy(() => import("@/pages/AdminAuditLog"));
const AdminMergeClients = lazy(() => import("@/pages/AdminMergeClients"));
const AdminPayments = lazy(() => import("@/pages/AdminPayments"));
const AdminContent = lazy(() => import("@/pages/AdminContent"));
const AdminTheme = lazy(() => import("@/pages/AdminTheme"));
const AdminEmails = lazy(() => import("@/pages/AdminEmails"));
const DirectPaymentPage = lazy(() => import("@/pages/DirectPaymentPage"));
const TrainingLocationWizard = lazy(() => import("@/pages/TrainingLocationWizard"));
const RecoveryPage = lazy(() => import("@/pages/RecoveryPage"));
const AdminRecoveryPage = lazy(() => import("@/pages/AdminRecoveryPage"));
const AdminMore = lazy(() => import("@/pages/AdminMore"));
const AgreementsPage = lazy(() => import("@/pages/AgreementsPage"));
const FaqPage = lazy(() => import("@/pages/FaqPage"));

function ProtectedRoute({
  component: Component,
  adminOnly = false,
  clientOnly = false,
  superAdminOnly = false,
}: {
  component: React.ComponentType;
  adminOnly?: boolean;
  clientOnly?: boolean;
  superAdminOnly?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/auth");
    } else if (adminOnly && !superAdminOnly && user.role !== "admin") {
      navigate("/");
    } else if (clientOnly && user.role !== "client") {
      navigate("/admin");
    }
  }, [user, isLoading, adminOnly, clientOnly, superAdminOnly, navigate]);

  if (isLoading) return <PremiumPageLoader />;
  if (!user) return null;
  if (adminOnly && !superAdminOnly && user.role !== "admin") return null;
  if (clientOnly && user.role !== "client") return null;

  if (superAdminOnly && !isEffectiveSuperAdmin(user as any)) {
    return (
      <div className="admin-shell">
        <div className="admin-container flex flex-col items-center justify-center min-h-[40vh] text-center gap-4">
          <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-300 text-4xl">🔒</div>
          <h1 className="text-2xl font-display font-bold">Super-admin access required</h1>
          <p className="text-muted-foreground text-sm max-w-xs">
            This area is restricted to the account owner. Contact Youssef if you need access.
          </p>
        </div>
      </div>
    );
  }

  return <Component />;
}

function Router() {
  // Track SPA route changes for Google Analytics 4. The hook itself
  // is a no-op when VITE_GA_MEASUREMENT_ID is unset, so this is safe
  // to leave on in every environment (dev, preview, prod).
  const [pathname] = useLocation();
  useEffect(() => {
    trackPageView(pathname);
  }, [pathname]);

  // Maintenance mode (Phase 5). When the `maintenance_mode` feature
  // flag is true, every non-admin surface is replaced with the
  // maintenance screen. Admins bypass so Youssef can keep working
  // on the system while it's locked down for clients. Public auth
  // routes (/auth, /admin-access, /reset-password) stay reachable
  // so an admin can always log in to flip the flag back.
  const maintenance = useFeatureFlag("maintenance_mode", false);
  const { user } = useAuth();

  // Inject brand CSS variables as soon as settings load so BrandLogo
  // and AuthPage pick up admin-configured sizes without a page reload.
  //
  // Guard: skip the effect while settings === undefined (i.e. the
  // /api/settings fetch is still in flight). The inline boot script in
  // index.html has already applied the cached/default vars synchronously, so
  // running applyBrandCSSVars with undefined would overwrite any
  // admin-saved non-default values with the hardcoded defaults — causing a
  // visible micro-jump before the real API response arrives.
  const { data: settings } = useSettings();
  useEffect(() => {
    if (settings === undefined) return;
    applyBrandCSSVars(settings.brandSettings as Record<string, number | string> | null);
  }, [settings]);
  // Dynamic favicon — update <link rel="icon"> when the admin uploads a
  // custom favicon from Media Center. Falls back to the static /favicon-*.png
  // files baked into the build (which are always correctly sized 16/32/48/180 px).
  useEffect(() => {
    if (!settings) return;
    const custom = (settings as any).logoFaviconUrl as string | null | undefined;
    // Skip canonical default paths — index.html already serves the BRAND_ASSETS
    // favicons (versioned). Only a genuine admin upload (/uploads/…) overrides them,
    // so the favicon never swaps to a stale/legacy asset after settings hydrate.
    const CANONICAL_FAVICONS = ["/brand-logo.png", "/ye-logo.png", "/ye-logo-horizontal.png", "/ye-logo-primary.png"];
    if (!custom || CANONICAL_FAVICONS.includes(custom)) return;
    // Cache-bust: prefer settings.updatedAt (exact timestamp when admin last saved),
    // fall back to the ms-timestamp embedded in the upload filename.
    const ua = (settings as any).updatedAt;
    const v  = ua ? new Date(ua).getTime()
                  : encodeURIComponent(custom.split("-").pop()?.split(".")[0] ?? "1");
    const bust = `${custom}?v=${v}`;
    const setLink = (id: string, href: string) => {
      const el = document.getElementById(id) as HTMLLinkElement | null;
      if (el) el.href = href;
    };
    setLink("favicon-16",    bust);
    setLink("favicon-32",    bust);
    setLink("favicon-48",    bust);
    setLink("favicon-apple", bust);
    // Also update the href-less <link rel="icon" href="/favicon.ico">
    const ico = document.querySelector<HTMLLinkElement>("link[href='/favicon.ico']");
    if (ico) ico.href = bust;
  }, [(settings as any)?.logoFaviconUrl, (settings as any)?.updatedAt]);
  const authBypassPaths = ["/auth", "/admin-access", "/reset-password"];
  const allowBypass = user?.role === "admin" || authBypassPaths.includes(pathname);
  const showMaintenance = maintenance && !allowBypass;

  // Print routes (`/print/*`) render a standalone A4 document and must
  // not include any app chrome (header, cookie banner, etc.) or it would
  // bleed into the printed PDF.
  const isPrintRoute = pathname.startsWith("/print/");

  // Admin top-tab strip is mounted globally for the entire /admin/*
  // surface so it stays visible across every section (Overview, Clients,
  // Bookings, Analytics, Packages, Settings, ClientDetail, Staff, etc.)
  // without each page having to mount it.
  // /admin-access (hidden admin login) is excluded — the user isn't
  // authenticated as admin yet on that route.
  const isAdminRoute =
    pathname === "/admin" ||
    (pathname.startsWith("/admin/") && pathname !== "/admin-access");

  if (showMaintenance) {
    return (
      <div className="min-h-screen bg-background text-foreground font-body">
        <OfflineBanner />
        <MaintenanceScreen />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {!isPrintRoute && <OfflineBanner />}
      {!isPrintRoute && <OfflineQueueBanner />}
      {!isPrintRoute && <ImpersonationBanner />}
      {!isPrintRoute && <Navigation />}
      {!isPrintRoute && <CookieBanner />}
      {!isPrintRoute && <InstallPrompt />}
      {isAdminRoute && (
        <div
          className="admin-container md:ml-64"
          // Match the mobile sticky offset (.admin-tabs-sticky uses
          // top: safe-area + 0.5rem). Aligning the initial padding
          // with the sticky offset means there's no visible jump
          // when the user scrolls past the tabs and they "stick".
          // md:ml-64 offsets the sidebar (w-64 = 16rem) on desktop
          // so AdminTabs aligns with the main content area, not the
          // full viewport — without this the sidebar would cover the
          // first 1–2 tabs at 1024–1440px viewport widths.
          style={{ paddingTop: "calc(env(safe-area-inset-top, 0px) + 0.5rem)" }}
        >
          <AdminTabs />
        </div>
      )}
      {/* Suspense fallback for lazy-loaded routes — premium loader with
          rotating copy so chunk loads feel intentional, not blank. */}
      <Suspense fallback={<PremiumPageLoader />}>
        <Switch>
          {/* Public */}
          <Route path="/" component={HomePage} />
          <Route path="/auth">
            <AuthPage />
          </Route>
          <Route path="/reset-password" component={ResetPassword} />
          {/* Hidden admin login — not linked from public surfaces */}
          <Route path="/admin-access" component={AdminAccessPage} />
          <Route path="/policy" component={CancellationPolicyPage} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsConditions} />
          <Route path="/medical-disclaimer" component={MedicalDisclaimer} />
          <Route path="/cookies" component={CookiePolicy} />
          <Route path="/how-it-works" component={HowItWorks} />
          <Route path="/transformations" component={TransformationsGallery} />
          <Route path="/faq" component={FaqPage} />
          <Route path="/direct-payment" component={DirectPaymentPage} />
          <Route path="/recovery" component={RecoveryPage} />
          <Route path="/agreements">
            <ProtectedRoute component={AgreementsPage} />
          </Route>
          <Route path="/admin/recovery">
            <ProtectedRoute component={AdminRecoveryPage} adminOnly />
          </Route>

          {/* Client */}
          <Route path="/wizard">
            <ProtectedRoute component={TrainingLocationWizard} clientOnly />
          </Route>
          <Route path="/book">
            <ProtectedRoute component={BookingPage} />
          </Route>
          <Route path="/dashboard">
            <ProtectedRoute component={ClientDashboard} clientOnly />
          </Route>
          <Route path="/profile">
            <ProtectedRoute component={ProfilePage} clientOnly />
          </Route>
          {/* Admin */}
          <Route path="/admin">
            <ProtectedRoute component={AdminDashboard} adminOnly />
          </Route>
          <Route path="/admin/command-center">
            <ProtectedRoute component={AdminCommandCenter} adminOnly />
          </Route>
          <Route path="/admin/leads">
            <ProtectedRoute component={AdminLeads} adminOnly />
          </Route>
          <Route path="/admin/integrity">
            <ProtectedRoute component={AdminIntegrity} superAdminOnly />
          </Route>
          <Route path="/admin/analytics">
            <ProtectedRoute component={AdminAnalytics} adminOnly />
          </Route>
          <Route path="/admin/business-health">
            <ProtectedRoute component={AdminBusinessHealth} adminOnly />
          </Route>
          <Route path="/admin/bookings">
            <ProtectedRoute component={AdminBookings} adminOnly />
          </Route>
          <Route path="/admin/clients">
            <ProtectedRoute component={AdminClients} adminOnly />
          </Route>
          <Route path="/admin/data-center">
            <ProtectedRoute component={AdminDataCenter} superAdminOnly />
          </Route>
          <Route path="/admin/control-panel">
            <ProtectedRoute component={AdminControlPanel} adminOnly />
          </Route>
          <Route path="/admin/management-analysis">
            <ProtectedRoute component={AdminManagementAnalysis} adminOnly />
          </Route>
          <Route path="/admin/clients/:id">
            <ProtectedRoute component={AdminClientDetail} adminOnly />
          </Route>
          <Route path="/admin/packages">
            <ProtectedRoute component={AdminPackages} adminOnly />
          </Route>
          <Route path="/admin/package-builder">
            <ProtectedRoute component={AdminPackageBuilder} adminOnly />
          </Route>
          <Route path="/admin/settings">
            <ProtectedRoute component={AdminSettings} adminOnly />
          </Route>
          <Route path="/admin/media">
            <ProtectedRoute component={AdminMedia} adminOnly />
          </Route>
          <Route path="/admin/staff">
            <ProtectedRoute component={AdminStaffPage} superAdminOnly />
          </Route>
          <Route path="/admin/audit-log">
            <ProtectedRoute component={AdminAuditLog} adminOnly />
          </Route>
          <Route path="/admin/merge-clients">
            <ProtectedRoute component={AdminMergeClients} superAdminOnly />
          </Route>
          <Route path="/admin/payments">
            <ProtectedRoute component={AdminPayments} adminOnly />
          </Route>
          <Route path="/admin/content">
            <ProtectedRoute component={AdminContent} adminOnly />
          </Route>
          <Route path="/admin/theme">
            <ProtectedRoute component={AdminTheme} adminOnly />
          </Route>
          <Route path="/admin/emails">
            <ProtectedRoute component={AdminEmails} adminOnly />
          </Route>
          <Route path="/admin/more">
            <ProtectedRoute component={AdminMore} adminOnly />
          </Route>

          <Route component={NotFound} />
        </Switch>
      </Suspense>
      {/* Task #76 — Global one-tap support FAB. Hides itself on
          booking/admin/auth routes via internal pathname check. */}
      {!isPrintRoute && <HelpFab />}
      {!isPrintRoute && <ClientBottomNav />}
      {/* Spacer keeps content above the client bottom nav on mobile */}
      {!isPrintRoute && user?.role === "client" && (
        <div className="md:hidden h-20 shrink-0" aria-hidden />
      )}
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <TooltipProvider>
          <AuthProvider>
            <Router />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </I18nProvider>
    </QueryClientProvider>
  );
}
