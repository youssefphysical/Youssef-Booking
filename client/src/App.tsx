import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/use-auth";
import { Navigation } from "@/components/Navigation";
import { Loader } from "@/components/Loader";

// Client Pages
import AuthPage from "@/pages/AuthPage";
import HomePage from "@/pages/HomePage";
import BookingPage from "@/pages/BookingPage";
import PackagesPage from "@/pages/PackagesPage";
import NotFound from "@/pages/not-found";

// Admin Pages
import AdminDashboard from "@/pages/AdminDashboard";

function ProtectedRoute({ component: Component, adminOnly = false }: { component: React.ComponentType, adminOnly?: boolean }) {
  const { user, isLoading } = useAuth();
  const [, setLocation] = useLocation();

  if (isLoading) return <Loader />;

  if (!user) {
    setLocation("/auth");
    return null;
  }

  if (adminOnly && user.role !== 'admin') {
    setLocation("/");
    return null;
  }

  return <Component />;
}

function Router() {
  return (
    <div className="min-h-screen bg-background text-foreground font-body">
      <Switch>
        <Route path="/auth" component={AuthPage} />
        
        {/* Admin Routes */}
        <Route path="/admin">
          <ProtectedRoute component={AdminDashboard} adminOnly />
        </Route>
        
        {/* Client Routes */}
        <Route path="/">
          <ProtectedRoute component={HomePage} />
        </Route>
        <Route path="/book">
          <ProtectedRoute component={BookingPage} />
        </Route>
        <Route path="/packages">
          <ProtectedRoute component={PackagesPage} />
        </Route>
        
        {/* Fallback */}
        <Route component={NotFound} />
      </Switch>
      <Navigation />
    </div>
  );
}

function App() {
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

export default App;
