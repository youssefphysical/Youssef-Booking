import { Switch, Route, useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Navigation } from "@/components/Navigation";
import { Loader } from "@/components/Loader";

import HomePage from "@/pages/HomePage";
import AuthPage from "@/pages/AuthPage";
import BookingPage from "@/pages/BookingPage";
import ClientDashboard from "@/pages/ClientDashboard";
import ProfilePage from "@/pages/ProfilePage";
import CancellationPolicyPage from "@/pages/CancellationPolicyPage";
import AdminDashboard from "@/pages/AdminDashboard";
import AdminBookings from "@/pages/AdminBookings";
import AdminClients from "@/pages/AdminClients";
import AdminSettings from "@/pages/AdminSettings";
import NotFound from "@/pages/not-found";

function ProtectedRoute({
  component: Component,
  adminOnly = false,
  clientOnly = false,
}: {
  component: React.ComponentType;
  adminOnly?: boolean;
  clientOnly?: boolean;
}) {
  const { user, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      navigate("/auth");
    } else if (adminOnly && user.role !== "admin") {
      navigate("/");
    } else if (clientOnly && user.role !== "client") {
      navigate("/admin");
    }
  }, [user, isLoading, adminOnly, clientOnly, navigate]);

  if (isLoading) return <Loader />;
  if (!user) return null;
  if (adminOnly && user.role !== "admin") return null;
  if (clientOnly && user.role !== "client") return null;
  return <Component />;
}

function Router() {
  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Navigation />
      <Switch>
        {/* Public */}
        <Route path="/" component={HomePage} />
        <Route path="/auth" component={AuthPage} />
        <Route path="/policy" component={CancellationPolicyPage} />

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
        <Route path="/admin/settings">
          <ProtectedRoute component={AdminSettings} adminOnly />
        </Route>

        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Router />
          <Toaster />
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
