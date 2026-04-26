import { Link, useLocation } from "wouter";
import {
  Home,
  Calendar,
  User,
  LayoutDashboard,
  Users,
  Settings as SettingsIcon,
  LogOut,
  LogIn,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export function Navigation() {
  const [location, navigate] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [open, setOpen] = useState(false);

  const isAdmin = user?.role === "admin";
  const isAdminPage = location.startsWith("/admin");

  // ============= ADMIN SIDEBAR =============
  if (isAdmin && isAdminPage) {
    return (
      <>
        <button
          onClick={() => setOpen(!open)}
          className="md:hidden fixed top-4 left-4 z-[60] p-2 bg-card/80 backdrop-blur-md rounded-xl border border-white/10"
          data-testid="button-toggle-sidebar"
          aria-label="Toggle menu"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>

        <nav
          className={cn(
            "fixed left-0 top-0 h-screen w-64 bg-card border-r border-border p-6 z-50 flex-col transition-transform",
            open ? "flex translate-x-0" : "hidden md:flex md:translate-x-0 -translate-x-full",
          )}
        >
          <Link href="/" className="mb-10 px-2 block" data-testid="link-home">
            <h1 className="text-xl font-bold font-display text-gradient-gold">Youssef Tarek</h1>
            <p className="text-[10px] text-muted-foreground mt-1 tracking-widest uppercase">
              Admin Portal
            </p>
          </Link>

          <div className="flex-1 space-y-1">
            <SidebarLink href="/admin" icon={<LayoutDashboard size={18} />} label="Dashboard" active={location === "/admin"} onClick={() => setOpen(false)} />
            <SidebarLink href="/admin/bookings" icon={<Calendar size={18} />} label="Bookings" active={location.startsWith("/admin/bookings")} onClick={() => setOpen(false)} />
            <SidebarLink href="/admin/clients" icon={<Users size={18} />} label="Clients" active={location.startsWith("/admin/clients")} onClick={() => setOpen(false)} />
            <SidebarLink href="/admin/settings" icon={<SettingsIcon size={18} />} label="Settings" active={location.startsWith("/admin/settings")} onClick={() => setOpen(false)} />
          </div>

          <div className="pt-4 border-t border-border space-y-2">
            <Link href="/" className="flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm hover:bg-white/5 text-muted-foreground" data-testid="link-public-site">
              <Home size={16} />
              <span>View public site</span>
            </Link>
            <button
              onClick={() => {
                logoutMutation.mutate();
                navigate("/");
              }}
              data-testid="button-logout"
              className="flex w-full items-center gap-3 px-4 py-2.5 rounded-xl text-sm text-destructive hover:bg-destructive/10"
            >
              <LogOut size={16} />
              <span>Logout</span>
            </button>
          </div>
        </nav>
      </>
    );
  }

  // ============= PUBLIC TOP NAV =============
  return (
    <header className="fixed top-0 inset-x-0 z-40 bg-background/70 backdrop-blur-xl border-b border-white/5">
      <div className="max-w-6xl mx-auto px-5 h-16 flex items-center justify-between">
        <Link href="/" className="font-display font-bold text-lg" data-testid="link-brand">
          <span className="text-gradient-gold">Youssef Tarek</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          <TopNavLink href="/" label="Home" active={location === "/"} />
          <TopNavLink href="/book" label="Book" active={location === "/book"} />
          <TopNavLink href="/policy" label="Policy" active={location === "/policy"} />
          {user?.role === "client" && (
            <TopNavLink href="/dashboard" label="My Sessions" active={location.startsWith("/dashboard")} />
          )}
          {user?.role === "client" && (
            <TopNavLink href="/profile" label="Profile" active={location === "/profile"} />
          )}
          {user?.role === "admin" && (
            <TopNavLink href="/admin" label="Admin" active={location.startsWith("/admin")} />
          )}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <button
              onClick={() => {
                logoutMutation.mutate();
                navigate("/");
              }}
              data-testid="button-logout"
              className="hidden sm:inline-flex items-center gap-2 text-sm px-4 h-9 rounded-xl border border-white/10 hover:bg-white/5 transition-colors"
            >
              <LogOut size={14} />
              Sign out
            </button>
          ) : (
            <Link
              href="/auth"
              data-testid="link-signin"
              className="inline-flex items-center gap-2 text-sm px-4 h-9 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90"
            >
              <LogIn size={14} />
              Sign in
            </Link>
          )}
          <button
            className="md:hidden p-2 rounded-lg border border-white/10"
            onClick={() => setOpen(!open)}
            aria-label="Menu"
            data-testid="button-mobile-menu"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>

      {open && (
        <div className="md:hidden border-t border-white/5 bg-background/95 backdrop-blur-xl">
          <div className="px-5 py-4 space-y-1">
            <MobileLink href="/" label="Home" icon={<Home size={16} />} onClose={() => setOpen(false)} />
            <MobileLink href="/book" label="Book" icon={<Calendar size={16} />} onClose={() => setOpen(false)} />
            <MobileLink href="/policy" label="Cancellation Policy" icon={<SettingsIcon size={16} />} onClose={() => setOpen(false)} />
            {user?.role === "client" && (
              <>
                <MobileLink href="/dashboard" label="My Sessions" icon={<LayoutDashboard size={16} />} onClose={() => setOpen(false)} />
                <MobileLink href="/profile" label="Profile" icon={<User size={16} />} onClose={() => setOpen(false)} />
              </>
            )}
            {user?.role === "admin" && (
              <MobileLink href="/admin" label="Admin Dashboard" icon={<LayoutDashboard size={16} />} onClose={() => setOpen(false)} />
            )}
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

function TopNavLink({ href, label, active }: { href: string; label: string; active: boolean }) {
  return (
    <Link href={href} data-testid={`link-top-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div
        className={cn(
          "px-3 h-9 inline-flex items-center text-sm rounded-lg transition-colors",
          active ? "text-primary" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {label}
      </div>
    </Link>
  );
}

function MobileLink({ href, label, icon, onClose }: { href: string; label: string; icon: React.ReactNode; onClose: () => void }) {
  return (
    <Link href={href} onClick={onClose} data-testid={`link-mobile-${label.toLowerCase().replace(/\s+/g, "-")}`}>
      <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm hover:bg-white/5">
        {icon}
        <span>{label}</span>
      </div>
    </Link>
  );
}
