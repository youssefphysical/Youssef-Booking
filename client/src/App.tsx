import { Switch, Route, useLocation } from "wouter";
import { useEffect, lazy, Suspense } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { I18nProvider } from "@/i18n";
import { Navigation } from "@/components/Navigation";
import { Loader } from "@/components/Loader";
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
const AdminAnalytics = lazy(() => import("@/pages/AdminAnalytics"));
const AdminBookings = lazy(() => import("@/pages/AdminBookings"));
const AdminClients = lazy(() => import("@/pages/AdminClients"));
const AdminClientDetail = lazy(() => import("@/pages/AdminClientDetail"));
const AdminPackages = lazy(() => import("@/pages/AdminPackages"));
const AdminPackageBuilder = lazy(() => import("@/pages/AdminPackageBuilder"));
const AdminMacroCalculator = lazy(() => import("@/pages/AdminMacroCalculator"));
const AdminFoodLibrary = lazy(() => import("@/pages/AdminFoodLibrary"));
const AdminMealLibrary = lazy(() => import("@/pages/AdminMealLibrary"));
const AdminMealBuilder = lazy(() => import("@/pages/AdminMealBuilder"));
const AdminNutritionPlans = lazy(() => import("@/pages/AdminNutritionPlans"));
const AdminNutritionPlanBuilder = lazy(() => import("@/pages/AdminNutritionPlanBuilder"));
const NutritionPlanPdf = lazy(() => import("@/pages/NutritionPlanPdf"));
const ClientNutritionPlan = lazy(() => import("@/pages/ClientNutritionPlan"));
const AdminSupplementLibrary = lazy(() => import("@/pages/AdminSupplementLibrary"));
const AdminSupplementStacks = lazy(() => import("@/pages/AdminSupplementStacks"));
const AdminSettings = lazy(() => import("@/pages/AdminSettings"));
const AdminStaffPage = lazy(() => import("@/pages/AdminStaffPage"));
const DirectPaymentPage = lazy(() => import("@/pages/DirectPaymentPage"));

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

  if (isLoading) return <Loader />;
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

  // Print routes (`/print/*`) render a standalone A4 document and must
  // not include any app chrome (header, cookie banner, etc.) or it would
  // bleed into the printed PDF.
  const isPrintRoute = pathname.startsWith("/print/");

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      {!isPrintRoute && <Navigation />}
      {!isPrintRoute && <CookieBanner />}
      {/* Suspense fallback for lazy-loaded routes — Loader matches the
          existing app loader so chunk-loading feels native, not jarring. */}
      <Suspense fallback={<Loader />}>
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
          <Route path="/direct-payment" component={DirectPaymentPage} />

          {/* Client */}
          <Route path="/book">
            <ProtectedRoute component={BookingPage} />
          </Route>
          <Route path="/dashboard">
            <ProtectedRoute component={ClientDashboard} clientOnly />
          </Route>
          <Route path="/profile">
            <ProtectedRoute component={ProfilePage} clientOnly />
          </Route>
          <Route path="/my-nutrition">
            <ProtectedRoute component={ClientNutritionPlan} clientOnly />
          </Route>

          {/* Admin */}
          <Route path="/admin">
            <ProtectedRoute component={AdminDashboard} adminOnly />
          </Route>
          <Route path="/admin/analytics">
            <ProtectedRoute component={AdminAnalytics} adminOnly />
          </Route>
          <Route path="/admin/bookings">
            <ProtectedRoute component={AdminBookings} adminOnly />
          </Route>
          <Route path="/admin/clients">
            <ProtectedRoute component={AdminClients} adminOnly />
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
          <Route path="/admin/nutrition/macro-calculator">
            <ProtectedRoute component={AdminMacroCalculator} adminOnly />
          </Route>
          <Route path="/admin/nutrition/foods">
            <ProtectedRoute component={AdminFoodLibrary} adminOnly />
          </Route>
          <Route path="/admin/nutrition/meals">
            <ProtectedRoute component={AdminMealLibrary} adminOnly />
          </Route>
          <Route path="/admin/nutrition/meals/:id">
            <ProtectedRoute component={AdminMealBuilder} adminOnly />
          </Route>
          <Route path="/admin/nutrition/plans">
            <ProtectedRoute component={AdminNutritionPlans} adminOnly />
          </Route>
          <Route path="/admin/nutrition/plans/:id">
            <ProtectedRoute component={AdminNutritionPlanBuilder} adminOnly />
          </Route>
          <Route path="/admin/supplements">
            <ProtectedRoute component={AdminSupplementLibrary} adminOnly />
          </Route>
          <Route path="/admin/supplement-stacks">
            <ProtectedRoute component={AdminSupplementStacks} adminOnly />
          </Route>
          <Route path="/print/nutrition-plan/:id">
            <ProtectedRoute component={NutritionPlanPdf} />
          </Route>
          <Route path="/admin/settings">
            <ProtectedRoute component={AdminSettings} adminOnly />
          </Route>
          <Route path="/admin/staff">
            <ProtectedRoute component={AdminStaffPage} superAdminOnly />
          </Route>

          <Route component={NotFound} />
        </Switch>
      </Suspense>
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
