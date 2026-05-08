import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
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

import HomePage from "@/pages/HomePage";
import AuthPage from "@/pages/AuthPage";
import ResetPassword from "@/pages/ResetPassword";
import AdminAccessPage from "@/pages/AdminAccessPage";
import BookingPage from "@/pages/BookingPage";
import ClientDashboard from "@/pages/ClientDashboard";
import ProfilePage from "@/pages/ProfilePage";
import CancellationPolicyPage from "@/pages/CancellationPolicyPage";
import PrivacyPolicy from "@/pages/PrivacyPolicy";
import TermsConditions from "@/pages/TermsConditions";
import MedicalDisclaimer from "@/pages/MedicalDisclaimer";
import CookiePolicy from "@/pages/CookiePolicy";
import HowItWorks from "@/pages/HowItWorks";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminBookings from "@/pages/AdminBookings";
import AdminClients from "@/pages/AdminClients";
import AdminClientDetail from "@/pages/AdminClientDetail";
import AdminPackages from "@/pages/AdminPackages";
import AdminPackageBuilder from "@/pages/AdminPackageBuilder";
import AdminMacroCalculator from "@/pages/AdminMacroCalculator";
import AdminFoodLibrary from "@/pages/AdminFoodLibrary";
import AdminMealLibrary from "@/pages/AdminMealLibrary";
import AdminMealBuilder from "@/pages/AdminMealBuilder";
import AdminNutritionPlans from "@/pages/AdminNutritionPlans";
import AdminNutritionPlanBuilder from "@/pages/AdminNutritionPlanBuilder";
import NutritionPlanPdf from "@/pages/NutritionPlanPdf";
import ClientNutritionPlan from "@/pages/ClientNutritionPlan";
import AdminSettings from "@/pages/AdminSettings";
import AdminStaffPage from "@/pages/AdminStaffPage";
import DirectPaymentPage from "@/pages/DirectPaymentPage";
import NotFound from "@/pages/not-found";
import { CookieBanner } from "@/components/CookieBanner";

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

  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navigation />
      <CookieBanner />
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
