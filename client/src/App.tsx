import { Switch, Route, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { I18nProvider } from "@/i18n";
import { Navigation } from "@/components/Navigation";
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
const DirectPaymentPage = lazy(() => import("@/pages/DirectPaymentPage"));
const TrainingLocationWizard = lazy(() => import("@/pages/TrainingLocationWizard"));
const RecoveryPage = lazy(() => import("@/pages/RecoveryPage"));
const AdminRecoveryPage = lazy(() => import("@/pages/AdminRecoveryPage"));
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
    } else if (superAdminOnly && !isEffectiveSuperAdmin(user as any)) {
      navigate("/admin");
    } else if (adminOnly && user.role !== "admin") {
      navigate("/");
    } else if (clientOnly && user.role !== "client") {
      navigate("/admin");
    }
  }, [user, isLoading, adminOnly, clientOnly, superAdminOnly, navigate]);

  if (isLoading) return <PremiumPageLoader />;
  if (!user) return null;
  if (superAdminOnly && !isEffectiveSuperAdmin(user as any)) return null;
  if (adminOnly && user.role !== "admin") return null;
  if (clientOnly && user.role !== "client") return null;
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
          className="admin-container"
          // Match the mobile sticky offset (.admin-tabs-sticky uses
          // top: safe-area + 0.5rem). Aligning the initial padding
          // with the sticky offset means there's no visible jump
          // when the user scrolls past the tabs and they "stick".
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
            <ProtectedRoute component={AdminIntegrity} adminOnly />
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
            <ProtectedRoute component={AdminDataCenter} adminOnly />
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
            <ProtectedRoute component={AdminMergeClients} adminOnly />
          </Route>

          <Route component={NotFound} />
        </Switch>
      </Suspense>
      {/* Task #76 — Global one-tap support FAB. Hides itself on
          booking/admin/auth routes via internal pathname check. */}
      {!isPrintRoute && <HelpFab />}
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
