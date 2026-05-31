import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandItem,
  CommandGroup,
} from "@/components/ui/command";
import {
  Search,
  X,
  Users,
  Calendar,
  Package as PackageIcon,
  Gift,
  UserPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ClientResult = {
  id: number;
  fullName: string;
  email: string | null;
  phone: string | null;
  clientStatus: string | null;
  vipTier: string | null;
  pkgName: string | null;
  pkgTotal: number | null;
  pkgUsed: number | null;
  pkgStatus: string | null;
};

type SearchResponse = {
  query: string;
  clients: ClientResult[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delay = 220): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/** Highlight the first occurrence of `q` in `text` with Tron-cyan. */
function Highlight({ text, q }: { text: string; q: string }) {
  if (!q || !text) return <>{text}</>;
  const idx = text.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, idx)}
      <mark className="bg-transparent text-primary font-semibold not-italic">
        {text.slice(idx, idx + q.length)}
      </mark>
      {text.slice(idx + q.length)}
    </>
  );
}

/** Returns "X remaining" label, or null if no package info. */
function remainingLabel(total: number | null, used: number | null): string | null {
  if (total == null || used == null) return null;
  const rem = total - used;
  return `${rem >= 0 ? rem : 0} remaining`;
}

/** Status badge colour map. */
function statusBadgeClass(status: string | null): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    case "expiring_soon":
      return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    case "expired":
    case "completed":
      return "bg-white/5 text-muted-foreground border-white/10";
    case "frozen":
      return "bg-sky-500/15 text-sky-400 border-sky-500/20";
    default:
      return "bg-white/5 text-muted-foreground border-white/10";
  }
}

function statusLabel(status: string | null): string {
  if (!status) return "";
  return status.replace(/_/g, " ");
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 220);
  const inputRef = useRef<HTMLInputElement>(null);

  // Detect mobile for responsive placeholder
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // Reset query when palette closes
  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => setQuery(""), 150);
      return () => clearTimeout(id);
    }
  }, [open]);

  const { data, isFetching } = useQuery<SearchResponse>({
    queryKey: ["/api/admin/clients/search", debounced],
    queryFn: async () => {
      if (!debounced) return { query: "", clients: [] };
      const res = await fetch(
        `/api/admin/clients/search?q=${encodeURIComponent(debounced)}&limit=8`,
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
  const clients = data?.clients ?? [];
  const hasResults = clients.length > 0;

  const placeholder = isMobile
    ? "Search clients…"
    : "Search clients by name, phone, email, or package…";

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* Input row — X button overlaid so it doesn't overlap text */}
      <div className="relative flex items-center" data-testid="client-search-input-wrapper">
        <CommandInput
          ref={inputRef as any}
          value={query}
          onValueChange={setQuery}
          placeholder={placeholder}
          className={cn("pr-9", isMobile && "text-sm")}
          data-testid="input-client-search"
        />
        {query.length > 0 && (
          <button
            type="button"
            aria-label="Clear search"
            data-testid="button-clear-search"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            className="absolute right-3 flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      <CommandList
        className="max-h-[65vh] overflow-y-auto overflow-x-hidden"
        data-testid="client-search-results"
      >
        {/* ── Empty state (before typing) ──────────────────────────────── */}
        {!hasQuery && (
          <div
            className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center"
            data-testid="client-search-empty-state"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Search size={20} />
            </span>
            <p className="text-sm font-medium">Search Clients</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[240px]">
              Search by name, phone, email, or package.
            </p>
          </div>
        )}

        {/* ── Searching indicator ──────────────────────────────────────── */}
        {hasQuery && isFetching && (
          <div className="py-5 text-center text-sm text-muted-foreground" data-testid="client-search-loading">
            Searching…
          </div>
        )}

        {/* ── No results state ─────────────────────────────────────────── */}
        {hasQuery && !isFetching && !hasResults && (
          <div
            className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center"
            data-testid="client-search-no-results"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
              <Users size={20} />
            </span>
            <p className="text-sm font-medium">No clients found</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[240px]">
              Try another name, phone, email, or package.
            </p>
            <button
              type="button"
              onClick={() => go("/admin/clients?new=1")}
              data-testid="button-create-client-no-results"
              className="mt-1 flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary hover:bg-primary/15 transition-colors"
            >
              <UserPlus size={13} />
              Create client
            </button>
          </div>
        )}

        {/* ── Client results ───────────────────────────────────────────── */}
        {hasQuery && !isFetching && hasResults && (
          <CommandGroup>
            {clients.map((c) => {
              const rem = remainingLabel(c.pkgTotal, c.pkgUsed);
              return (
                <CommandItem
                  key={`client-${c.id}`}
                  value={`${c.fullName} ${c.email ?? ""} ${c.phone ?? ""} ${c.pkgName ?? ""}`}
                  onSelect={() => go(`/admin/clients/${c.id}`)}
                  data-testid={`client-result-${c.id}`}
                  className="flex items-start gap-3 py-2.5 px-2 rounded-lg cursor-pointer group"
                >
                  {/* Avatar */}
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary mt-0.5">
                    <Users size={16} />
                  </span>

                  {/* Main info */}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {/* Name row */}
                    <span className="flex flex-wrap items-center gap-1.5 leading-tight">
                      <span
                        className="text-sm font-medium truncate max-w-full"
                        data-testid={`client-name-${c.id}`}
                      >
                        <Highlight text={c.fullName} q={debounced} />
                      </span>
                      {c.vipTier && c.vipTier !== "foundation" && (
                        <span className="shrink-0 rounded-full bg-amber-500/15 border border-amber-500/20 px-1.5 py-0 text-[9px] uppercase tracking-wider text-amber-400">
                          {c.vipTier}
                        </span>
                      )}
                      {c.clientStatus && (
                        <span
                          className={cn(
                            "shrink-0 rounded-full border px-1.5 py-0 text-[9px] uppercase tracking-wider",
                            statusBadgeClass(c.clientStatus),
                          )}
                          data-testid={`client-status-${c.id}`}
                        >
                          {statusLabel(c.clientStatus)}
                        </span>
                      )}
                    </span>

                    {/* Contact */}
                    <span className="text-[11px] text-muted-foreground truncate">
                      {[c.email, c.phone]
                        .filter(Boolean)
                        .map((v, i) => (
                          <span key={i}>
                            {i > 0 && <span className="mx-1 opacity-40">·</span>}
                            <Highlight text={v!} q={debounced} />
                          </span>
                        ))}
                      {!c.email && !c.phone && "—"}
                    </span>

                    {/* Package info */}
                    {c.pkgName && (
                      <span className="flex flex-wrap items-center gap-1 mt-0.5">
                        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                          <PackageIcon size={10} className="shrink-0 opacity-60" />
                          <Highlight text={c.pkgName} q={debounced} />
                        </span>
                        {rem && (
                          <span className="text-[10px] text-muted-foreground opacity-60">
                            · {rem}
                          </span>
                        )}
                      </span>
                    )}
                  </span>

                  {/* Action icons — stop propagation so they don't trigger row onSelect */}
                  <span
                    className="flex shrink-0 items-center gap-0.5 opacity-0 group-data-[selected=true]:opacity-100 transition-opacity"
                    data-testid={`client-actions-${c.id}`}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ActionIcon
                      icon={<Calendar size={13} />}
                      label="Book session"
                      testId={`action-book-${c.id}`}
                      onClick={() => go(`/admin/bookings?new=1&clientId=${c.id}`)}
                    />
                    <ActionIcon
                      icon={<PackageIcon size={13} />}
                      label="Add package"
                      testId={`action-package-${c.id}`}
                      onClick={() => go(`/admin/clients/${c.id}`)}
                    />
                    <ActionIcon
                      icon={<Gift size={13} />}
                      label="Add bonus sessions"
                      testId={`action-bonus-${c.id}`}
                      onClick={() => go(`/admin/clients/${c.id}`)}
                    />
                  </span>
                </CommandItem>
              );
            })}
          </CommandGroup>
        )}
      </CommandList>

      {/* Footer */}
      <div
        className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground"
        data-testid="client-search-footer"
      >
        <span className="flex items-center gap-1">
          <Search size={10} />
          <span className="hidden sm:inline">Enter to open · Esc to close</span>
          <span className="sm:hidden">Tap to open</span>
        </span>
        <span className="font-mono hidden md:inline">⌘K</span>
      </div>
    </CommandDialog>
  );
}

// ─── Tiny action icon button ──────────────────────────────────────────────────

function ActionIcon({
  icon,
  label,
  testId,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  testId: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      data-testid={testId}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
    >
      {icon}
    </button>
  );
}

// ─── Keyboard shortcut hook ───────────────────────────────────────────────────

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
