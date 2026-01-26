import { Link, useLocation } from "wouter";
import { Home, Calendar, ShoppingBag, User, Dumbbell, LayoutDashboard, Users, CreditCard, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export function Navigation() {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();

  if (!user) return null;

  const isAdmin = user.role === 'admin';

  if (isAdmin) {
    return (
      <nav className="hidden md:flex flex-col w-64 bg-card border-r border-border h-screen fixed left-0 top-0 p-6 z-50">
        <div className="mb-10 px-2">
          <h1 className="text-2xl font-bold font-display text-gradient-gold">Youssef Fitness</h1>
          <p className="text-xs text-muted-foreground mt-1 tracking-widest uppercase">Admin Portal</p>
        </div>
        
        <div className="flex-1 space-y-2">
          <Link href="/admin">
            <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/5", location === "/admin" && "bg-white/5 text-primary")}>
              <LayoutDashboard size={20} />
              <span className="font-medium">Dashboard</span>
            </div>
          </Link>
          <Link href="/admin/bookings">
            <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/5", location === "/admin/bookings" && "bg-white/5 text-primary")}>
              <Calendar size={20} />
              <span className="font-medium">Bookings</span>
            </div>
          </Link>
          <Link href="/admin/payments">
            <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/5", location === "/admin/payments" && "bg-white/5 text-primary")}>
              <CreditCard size={20} />
              <span className="font-medium">Payments</span>
            </div>
          </Link>
          <Link href="/admin/users">
            <div className={cn("flex items-center gap-3 px-4 py-3 rounded-xl transition-all hover:bg-white/5", location === "/admin/users" && "bg-white/5 text-primary")}>
              <Users size={20} />
              <span className="font-medium">Clients</span>
            </div>
          </Link>
        </div>

        <div className="pt-6 border-t border-border">
          <button 
            onClick={() => logoutMutation.mutate()}
            className="flex w-full items-center gap-3 px-4 py-3 rounded-xl text-destructive hover:bg-destructive/10 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </nav>
    );
  }

  // Mobile Bottom Navigation for Clients
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full bg-card/80 backdrop-blur-xl border-t border-border z-50 pb-safe">
      <div className="flex justify-around items-center p-3">
        <NavLink href="/" icon={<Home size={22} />} label="Home" active={location === "/"} />
        <NavLink href="/book" icon={<Calendar size={22} />} label="Book" active={location === "/book"} />
        <NavLink href="/nutrition" icon={<Dumbbell size={22} />} label="Nutrition" active={location === "/nutrition"} />
        <NavLink href="/packages" icon={<ShoppingBag size={22} />} label="Packages" active={location === "/packages"} />
        <NavLink href="/profile" icon={<User size={22} />} label="Profile" active={location === "/profile"} />
      </div>
    </nav>
  );
}

function NavLink({ href, icon, label, active }: { href: string; icon: React.ReactNode; label: string; active: boolean }) {
  return (
    <Link href={href}>
      <div className={cn("flex flex-col items-center gap-1 p-2 rounded-xl transition-all", active ? "text-primary scale-105" : "text-muted-foreground hover:text-foreground")}>
        {icon}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
    </Link>
  );
}
