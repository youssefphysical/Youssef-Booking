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
  Package as PackageIcon,
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
  matchRank: number;
};

type SearchResponse = {
  query: string;
  clients: ClientResult[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delay = 80): T {
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

function remainingLabel(total: number | null, used: number | null): string | null {
  if (total == null || used == null) return null;
  const rem = Math.max(0, total - used);
  return `${rem} remaining`;
}

function statusBadgeClass(status: string | null): string {
  switch (status) {
    case "active":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
    case "expiring_soon":
      return "bg-amber-500/15 text-amber-400 border-amber-500/20";
    case "frozen":
      return "bg-sky-500/15 text-sky-400 border-sky-500/20";
    case "expired":
    case "completed":
      return "bg-white/5 text-muted-foreground border-white/10";
    default:
      return "bg-white/5 text-muted-foreground border-white/10";
  }
}

function statusLabel(s: string | null) {
  return (s ?? "").replace(/_/g, " ");
}

// Best match threshold — ranks 0-4 are identity matches (name/email/phone).
// Ranks 5-9 are contains/package/status matches.
const BEST_RANK_MAX = 4;

// ─── Client result card ───────────────────────────────────────────────────────

function ClientCard({ c, q }: { c: ClientResult; q: string }) {
  const rem = remainingLabel(c.pkgTotal, c.pkgUsed);
  const contact = c.email || c.phone;

  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      {/* Avatar */}
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <Users size={15} />
      </span>

      {/* Text */}
      <span className="flex min-w-0 flex-col gap-[3px]">
        {/* Name + badges */}
        <span className="flex flex-wrap items-center gap-1.5">
          <span className="text-[13px] font-medium leading-tight truncate max-w-full" data-testid={`client-name-${c.id}`}>
            <Highlight text={c.fullName} q={q} />
          </span>
          {c.vipTier && c.vipTier !== "foundation" && (
            <span className="shrink-0 rounded-full bg-amber-500/15 border border-amber-500/20 px-1.5 text-[9px] uppercase tracking-wider text-amber-400 leading-[16px]">
              {c.vipTier}
            </span>
          )}
          {c.clientStatus && (
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 text-[9px] uppercase tracking-wider leading-[16px]",
                statusBadgeClass(c.clientStatus),
              )}
              data-testid={`client-status-${c.id}`}
            >
              {statusLabel(c.clientStatus)}
            </span>
          )}
        </span>

        {/* Contact */}
        {contact && (
          <span className="text-[11px] text-muted-foreground truncate leading-tight">
            <Highlight text={contact} q={q} />
          </span>
        )}

        {/* Package */}
        {c.pkgName && (
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground/70 leading-tight">
            <PackageIcon size={9} className="shrink-0" />
            <span className="truncate">
              <Highlight text={c.pkgName} q={q} />
            </span>
            {rem && <span className="shrink-0 opacity-60">· {rem}</span>}
          </span>
        )}
      </span>
    </span>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const debounced = useDebounced(query.trim(), 80);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => setQuery(""), 150);
      return () => clearTimeout(id);
    }
  }, [open]);

  const limit = isMobile ? 8 : 12;

  const { data, isFetching } = useQuery<SearchResponse>({
    queryKey: ["/api/admin/clients/search", debounced, limit],
    queryFn: async () => {
      if (!debounced) return { query: "", clients: [] };
      const res = await fetch(
        `/api/admin/clients/search?q=${encodeURIComponent(debounced)}&limit=${limit}`,
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
  const all = data?.clients ?? [];
  const bestMatches = all.filter((c) => c.matchRank <= BEST_RANK_MAX);
  const suggestions = all.filter((c) => c.matchRank > BEST_RANK_MAX);

  // If there are only suggestions (no identity matches), display them as "Best matches"
  const showBest = bestMatches.length > 0 ? bestMatches : suggestions;
  const showSugg = bestMatches.length > 0 ? suggestions : [];
  const hasResults = all.length > 0;

  const placeholder = isMobile
    ? "Search clients…"
    : "Search clients by name, phone, email, or package…";

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      {/* ── Input row ────────────────────────────────────────────────────── */}
      <div
        className="relative flex items-center border-b border-border/60"
        data-testid="client-search-input-wrapper"
      >
        {/* Override cmdk input height to 52-56px range */}
        <CommandInput
          ref={inputRef as any}
          value={query}
          onValueChange={setQuery}
          placeholder={placeholder}
          className="pr-9 h-[54px]"
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
            className="absolute right-3 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={13} />
          </button>
        )}
      </div>

      {/* ── Results list ─────────────────────────────────────────────────── */}
      <CommandList
        className="max-h-[60vh] overflow-y-auto overflow-x-hidden"
        data-testid="client-search-results"
      >
        {/* Empty state */}
        {!hasQuery && (
          <div
            className="flex flex-col items-center justify-center gap-2 py-9 px-4 text-center"
            data-testid="client-search-empty-state"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Search size={18} />
            </span>
            <p className="text-sm font-medium">Search Clients</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[230px]">
              Type a name, phone, email, or package.
            </p>
          </div>
        )}

        {/* Searching */}
        {hasQuery && isFetching && (
          <div
            className="py-5 text-center text-[12px] text-muted-foreground"
            data-testid="client-search-loading"
          >
            Searching…
          </div>
        )}

        {/* No results */}
        {hasQuery && !isFetching && !hasResults && (
          <div
            className="flex flex-col items-center justify-center gap-2 py-9 px-4 text-center"
            data-testid="client-search-no-results"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
              <Users size={18} />
            </span>
            <p className="text-sm font-medium">No clients found</p>
            <p className="text-[12px] text-muted-foreground leading-relaxed max-w-[230px]">
              Try another name, phone, email, or package.
            </p>
            <button
              type="button"
              onClick={() => go("/admin/clients?new=1")}
              data-testid="button-create-client-no-results"
              className="mt-1 flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary hover:bg-primary/15 transition-colors"
            >
              <UserPlus size={12} />
              Create client
            </button>
          </div>
        )}

        {/* Best matches section */}
        {hasQuery && !isFetching && showBest.length > 0 && (
          <CommandGroup
            heading="Best matches"
            className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
            data-testid="section-best-matches"
          >
            {showBest.map((c) => (
              <CommandItem
                key={`best-${c.id}`}
                value={`${c.fullName} ${c.email ?? ""} ${c.phone ?? ""} ${c.pkgName ?? ""}`}
                onSelect={() => go(`/admin/clients/${c.id}`)}
                data-testid={`client-result-${c.id}`}
                className="flex items-center gap-0 py-2 px-2 rounded-lg cursor-pointer min-h-[52px]"
              >
                <ClientCard c={c} q={debounced} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* More suggestions section — only when there are also best matches */}
        {hasQuery && !isFetching && showSugg.length > 0 && (
          <CommandGroup
            heading="More suggestions"
            className="[&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/60 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
            data-testid="section-more-suggestions"
          >
            {showSugg.map((c) => (
              <CommandItem
                key={`sugg-${c.id}`}
                value={`${c.fullName} ${c.email ?? ""} ${c.phone ?? ""} ${c.pkgName ?? ""}`}
                onSelect={() => go(`/admin/clients/${c.id}`)}
                data-testid={`client-result-${c.id}`}
                className="flex items-center gap-0 py-2 px-2 rounded-lg cursor-pointer min-h-[52px]"
              >
                <ClientCard c={c} q={debounced} />
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <div
        className="flex items-center justify-between gap-2 border-t border-border/60 px-3 py-2 text-[10px] uppercase tracking-wider text-muted-foreground"
        data-testid="client-search-footer"
      >
        <span className="hidden sm:flex items-center gap-1">
          <Search size={10} />
          Enter to open · Esc to close
        </span>
        <span className="sm:hidden text-[10px] text-muted-foreground/50">Client search</span>
        <span className="font-mono hidden md:inline">⌘K</span>
      </div>
    </CommandDialog>
  );
}

// ─── Keyboard shortcut hook ───────────────────────────────────────────────────

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
