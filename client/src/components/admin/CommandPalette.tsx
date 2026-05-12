import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import {
  Users,
  Calendar,
  Package as PackageIcon,
  ClipboardList,
  Pill,
  UserPlus,
  CalendarPlus,
  PackagePlus,
  Apple,
  ShieldCheck,
  Settings as SettingsIcon,
  LayoutDashboard,
  BarChart3,
  Search as SearchIcon,
  ChevronRight,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { isEffectiveSuperAdmin } from "@shared/schema";
import { useAuth } from "@/hooks/use-auth";

type SearchResult = {
  query: string;
  clients: Array<{
    id: number;
    fullName: string;
    email: string | null;
    phone: string | null;
    clientStatus: string | null;
    vipTier: string | null;
  }>;
  bookings: Array<{
    id: number;
    userId: number;
    userName: string | null;
    date: string;
    timeSlot: string;
    status: string;
    sessionType: string;
  }>;
  packages: Array<{
    id: number;
    userId: number;
    userName: string | null;
    name: string | null;
    type: string;
    totalSessions: number;
    usedSessions: number;
    status: string | null;
  }>;
  nutritionPlans: Array<{
    id: number;
    userId: number;
    userName: string | null;
    name: string;
    status: string;
    goal: string;
  }>;
  supplementStacks: Array<{
    id: number;
    name: string;
    goal: string;
    active: boolean;
  }>;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function useDebounced<T>(value: T, delay = 200): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const [, navigate] = useLocation();
  const { user } = useAuth();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 200);
  const isSuperAdmin = isEffectiveSuperAdmin(user as any);

  // Reset query when palette closes
  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => setQuery(""), 150);
      return () => clearTimeout(id);
    }
  }, [open]);

  const { data, isFetching } = useQuery<SearchResult>({
    queryKey: ["/api/admin/search", debounced],
    queryFn: async () => {
      if (!debounced) {
        return {
          query: "",
          clients: [],
          bookings: [],
          packages: [],
          nutritionPlans: [],
          supplementStacks: [],
        };
      }
      const res = await fetch(
        `/api/admin/search?q=${encodeURIComponent(debounced)}&limit=5`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Search failed");
      return res.json();
    },
    enabled: open,
    staleTime: 30_000,
  });

  const go = (path: string) => {
    onOpenChange(false);
    setTimeout(() => navigate(path), 50);
  };

  const hasQuery = debounced.length > 0;
  const hasResults =
    !!data &&
    (data.clients.length > 0 ||
      data.bookings.length > 0 ||
      data.packages.length > 0 ||
      data.nutritionPlans.length > 0 ||
      data.supplementStacks.length > 0);

  const quickAdds = useMemo(
    () => [
      {
        key: "client",
        label: t("palette.create.client", "New client"),
        hint: t("palette.create.clientHint", "Register a client and assign a package"),
        icon: <UserPlus size={18} />,
        path: "/admin/clients?new=1",
      },
      {
        key: "booking",
        label: t("palette.create.booking", "New booking"),
        hint: t("palette.create.bookingHint", "Manually log a session"),
        icon: <CalendarPlus size={18} />,
        path: "/admin/bookings?new=1",
      },
      {
        key: "package",
        label: t("palette.create.package", "New package template"),
        hint: t("palette.create.packageHint", "Add a package to the public catalogue"),
        icon: <PackagePlus size={18} />,
        path: "/admin/package-builder?new=1",
      },
      {
        key: "nutrition",
        label: t("palette.create.nutrition", "New nutrition plan"),
        hint: t("palette.create.nutritionHint", "Build a meal plan for a client"),
        icon: <Apple size={18} />,
        path: "/admin/nutrition/plans?new=1",
      },
      {
        key: "supplements",
        label: t("palette.create.supplements", "New supplement stack"),
        hint: t("palette.create.supplementsHint", "Curate a stack to assign"),
        icon: <Pill size={18} />,
        path: "/admin/supplement-stacks?new=1",
      },
    ],
    [t],
  );

  const navJumps = useMemo(
    () => [
      { key: "dash", label: t("nav.dashboard"), icon: <LayoutDashboard size={18} />, path: "/admin" },
      { key: "bookings", label: t("nav.bookings"), icon: <Calendar size={18} />, path: "/admin/bookings" },
      { key: "clients", label: t("nav.clients"), icon: <Users size={18} />, path: "/admin/clients" },
      { key: "packages", label: t("nav.packages"), icon: <PackageIcon size={18} />, path: "/admin/packages" },
      { key: "analytics", label: t("nav.analytics", "Analytics"), icon: <BarChart3 size={18} />, path: "/admin/analytics" },
      { key: "settings", label: t("nav.settings"), icon: <SettingsIcon size={18} />, path: "/admin/settings" },
      ...(isSuperAdmin
        ? [{ key: "staff", label: t("nav.staff"), icon: <ShieldCheck size={18} />, path: "/admin/staff" }]
        : []),
    ],
    [t, isSuperAdmin],
  );

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        value={query}
        onValueChange={setQuery}
        placeholder={t("palette.placeholder", "Search clients, bookings, packages…  or type to create")}
        data-testid="input-command-palette"
      />
      <CommandList className="max-h-[60vh]">
        <CommandEmpty>
          {isFetching
            ? t("palette.searching", "Searching…")
            : hasQuery
            ? t("palette.noResults", "No matches found.")
            : t("palette.empty", "Start typing to search across your business.")}
        </CommandEmpty>

        {/* QUICK ADD — always visible, scoped above search results so it's
            the natural primary action when the input is empty */}
        <CommandGroup heading={t("palette.section.create", "Create")}>
          {quickAdds.map((qa) => (
            <CommandItem
              key={qa.key}
              value={`create ${qa.label} ${qa.hint}`}
              onSelect={() => go(qa.path)}
              data-testid={`palette-create-${qa.key}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                {qa.icon}
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-sm font-medium truncate">{qa.label}</span>
                <span className="text-[11px] text-muted-foreground truncate">{qa.hint}</span>
              </span>
              <ChevronRight size={14} className="ml-auto opacity-40 rtl:rotate-180" />
            </CommandItem>
          ))}
        </CommandGroup>

        {/* SEARCH RESULTS — only when there is a query */}
        {hasQuery && data && data.clients.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("palette.section.clients", "Clients")}>
              {data.clients.map((c) => (
                <CommandItem
                  key={`client-${c.id}`}
                  value={`client ${c.fullName} ${c.email ?? ""} ${c.phone ?? ""}`}
                  onSelect={() => go(`/admin/clients/${c.id}`)}
                  data-testid={`palette-client-${c.id}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                    <Users size={16} />
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{c.fullName}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {[c.email, c.phone].filter(Boolean).join(" · ") || "—"}
                    </span>
                  </span>
                  {c.vipTier && (
                    <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground">
                      {c.vipTier}
                    </span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {hasQuery && data && data.bookings.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("palette.section.bookings", "Bookings")}>
              {data.bookings.map((b) => (
                <CommandItem
                  key={`booking-${b.id}`}
                  value={`booking ${b.date} ${b.timeSlot} ${b.userName ?? ""} ${b.status}`}
                  onSelect={() => go(`/admin/bookings?date=${b.date}`)}
                  data-testid={`palette-booking-${b.id}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Calendar size={16} />
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {b.date} · {b.timeSlot}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {b.userName ?? `User #${b.userId}`} · {b.status}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {hasQuery && data && data.packages.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("palette.section.packages", "Packages")}>
              {data.packages.map((p) => (
                <CommandItem
                  key={`package-${p.id}`}
                  value={`package ${p.name ?? ""} ${p.type} ${p.userName ?? ""}`}
                  onSelect={() => go(`/admin/clients/${p.userId}`)}
                  data-testid={`palette-package-${p.id}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                    <PackageIcon size={16} />
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">
                      {p.name ?? p.type}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {p.userName ?? `User #${p.userId}`} ·{" "}
                      {p.usedSessions}/{p.totalSessions} sessions
                      {p.status ? ` · ${p.status}` : ""}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {hasQuery && data && data.nutritionPlans.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("palette.section.nutrition", "Nutrition Plans")}>
              {data.nutritionPlans.map((n) => (
                <CommandItem
                  key={`np-${n.id}`}
                  value={`nutrition ${n.name} ${n.userName ?? ""} ${n.goal}`}
                  onSelect={() => go(`/admin/nutrition/plans/${n.id}`)}
                  data-testid={`palette-nutrition-${n.id}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lime-500/10 text-lime-400">
                    <ClipboardList size={16} />
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{n.name}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {n.userName ?? `User #${n.userId}`} · {n.status} · {n.goal}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {hasQuery && data && data.supplementStacks.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading={t("palette.section.supplements", "Supplement Stacks")}>
              {data.supplementStacks.map((s) => (
                <CommandItem
                  key={`stack-${s.id}`}
                  value={`stack ${s.name} ${s.goal}`}
                  onSelect={() => go(`/admin/supplement-stacks`)}
                  data-testid={`palette-stack-${s.id}`}
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-500/10 text-purple-400">
                    <Pill size={16} />
                  </span>
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm font-medium truncate">{s.name}</span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      {s.goal}
                      {!s.active ? " · inactive" : ""}
                    </span>
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* NAVIGATION JUMPS — always visible at the bottom */}
        <CommandSeparator />
        <CommandGroup heading={t("palette.section.jump", "Jump to")}>
          {navJumps.map((j) => (
            <CommandItem
              key={j.key}
              value={`go ${j.label}`}
              onSelect={() => go(j.path)}
              data-testid={`palette-jump-${j.key}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/5 text-muted-foreground">
                {j.icon}
              </span>
              <span className="text-sm">{j.label}</span>
              <ChevronRight size={14} className="ml-auto opacity-40 rtl:rotate-180" />
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>

      <div className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1">
          <SearchIcon size={11} />
          {t("palette.footer.tip", "Type to search · Enter to open · Esc to close")}
        </span>
        <span className="font-mono">⌘K</span>
      </div>
    </CommandDialog>
  );
}

/**
 * Hook that wires Cmd/Ctrl+K (and Cmd/Ctrl+J as a backup) to toggle the
 * palette open. Mount once at the admin shell level.
 */
export function useCommandPaletteShortcut(setOpen: (open: boolean) => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && (e.key === "k" || e.key === "K" || e.key === "j" || e.key === "J")) {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setOpen]);
}
