import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
// Use cmdk root primitive directly — avoids "[&_[cmdk-input]]:h-12" override on the UI Command wrapper
import { Command as CmdkRoot } from "cmdk";
import { CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, X, Users, UserPlus } from "lucide-react";
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
  profilePictureUrl: string | null;
  matchRank: number;
};

type SearchResponse = {
  query: string;
  clients: ClientResult[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const BEST_RANK_MAX = 5;
const AVATAR_PX = 44;
const LOW_SESSION_THRESHOLD = 3;

// ─── Quick filter chips ───────────────────────────────────────────────────────
//
// ALL filters below run CLIENT-SIDE on results already returned by the search API.
// They add ZERO backend cost (no extra queries, no polling).
//
// Each chip's predicate uses ONLY fields present in the ClientResult payload:
//   clientStatus, vipTier, pkgName, pkgTotal, pkgUsed, pkgStatus
//
// INTENTIONALLY OMITTED (per "hide unsupported filter" + "never add heavy backend
// queries"):
//   • "Nutrition" — the search payload has no nutrition-program field; CLIENT_STATUSES
//     has no nutrition value (that lives in LEAD_STATUSES, not returned here).
//   • "Today"     — the search payload has no today's-booking data; computing it would
//     require a heavy per-result bookings query.

type FilterId =
  | "active" | "pending" | "expiring" | "low_sessions"
  | "has_pkg" | "no_pkg" | "vip";

const FILTERS: { id: FilterId; label: string; predicate: (c: ClientResult) => boolean }[] = [
  { id: "active",       label: "Active",        predicate: (c) => c.clientStatus === "active" },
  { id: "pending",      label: "Pending",       predicate: (c) => c.clientStatus === "pending" },
  { id: "expiring",     label: "Expiring Soon", predicate: (c) => c.pkgStatus === "expiring_soon" },
  {
    id: "low_sessions", label: "Low Sessions",
    predicate: (c) => {
      if (c.pkgTotal == null || c.pkgUsed == null) return false;
      const rem = c.pkgTotal - c.pkgUsed;
      return rem >= 0 && rem <= LOW_SESSION_THRESHOLD;
    },
  },
  { id: "has_pkg",      label: "Has Package",   predicate: (c) => !!c.pkgName },
  { id: "no_pkg",       label: "No Package",    predicate: (c) => !c.pkgName },
  { id: "vip",          label: "VIP",           predicate: (c) => !!c.vipTier && c.vipTier !== "foundation" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delay = 20): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

function toTitle(s: string | null): string {
  if (!s) return "";
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function remainingLabel(total: number | null, used: number | null): string | null {
  if (total == null || used == null) return null;
  return `${Math.max(0, total - used)} left`;
}

function statusBadgeClass(status: string | null): string {
  switch (status) {
    case "active":        return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
    case "expiring_soon": return "bg-amber-500/15 text-amber-400 border-amber-500/25";
    case "pending":       return "bg-amber-500/15 text-amber-400 border-amber-500/25";
    case "frozen":        return "bg-sky-500/15 text-sky-400 border-sky-500/25";
    default:              return "bg-white/5 text-muted-foreground/60 border-white/10";
  }
}

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

// ─── Avatar ───────────────────────────────────────────────────────────────────

function ClientAvatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase();

  const sz = { width: AVATAR_PX, height: AVATAR_PX, minWidth: AVATAR_PX };
  const base = "shrink-0 rounded-full overflow-hidden flex items-center justify-center";

  if (photoUrl && !failed) {
    return (
      <span className={cn(base, "bg-primary/10")} style={sz} data-testid="client-avatar-photo">
        <img
          src={photoUrl}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover object-center"
          data-testid="client-avatar-img"
        />
      </span>
    );
  }
  return (
    <span
      className={cn(base, "bg-primary/10 text-primary font-semibold text-[13px]")}
      style={sz}
      data-testid="client-avatar-fallback"
    >
      {initials || <Users size={16} />}
    </span>
  );
}

// ─── Client card ──────────────────────────────────────────────────────────────
// Fixed-grid layout: avatar (fixed col) + text column. Identical structure for
// every row → consistent height, no shifting.

function ClientCard({ c, q }: { c: ClientResult; q: string }) {
  const rem = remainingLabel(c.pkgTotal, c.pkgUsed);
  const contact = c.email || c.phone;

  return (
    <span className="flex min-w-0 w-full items-center gap-3">
      <ClientAvatar photoUrl={c.profilePictureUrl} name={c.fullName} />

      <span className="flex min-w-0 flex-col gap-0.5 flex-1 overflow-hidden">

        {/* Row 1: Name + VIP */}
        <span className="flex items-center gap-1.5 min-w-0 overflow-hidden">
          <span
            className="text-[13px] font-medium leading-tight truncate"
            data-testid={`client-name-${c.id}`}
          >
            <Highlight text={c.fullName} q={q} />
          </span>
          {c.vipTier && c.vipTier !== "foundation" && (
            <span className="shrink-0 rounded-full bg-amber-500/15 border border-amber-500/25 px-1.5 text-[9px] uppercase tracking-wider text-amber-400 leading-[14px]">
              {toTitle(c.vipTier)}
            </span>
          )}
        </span>

        {/* Row 2: Package + status + sessions */}
        <span className="flex items-center gap-1 min-w-0 overflow-hidden flex-wrap">
          {c.pkgName && (
            <span
              className="shrink-0 rounded-full border border-primary/25 bg-primary/8 px-1.5 text-[9px] text-primary leading-[14px] font-medium max-w-[110px] truncate"
              data-testid={`client-pkg-badge-${c.id}`}
            >
              <Highlight text={c.pkgName} q={q} />
            </span>
          )}
          {c.clientStatus && (
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 text-[9px] uppercase tracking-wider leading-[14px]",
                statusBadgeClass(c.clientStatus),
              )}
              data-testid={`client-status-${c.id}`}
            >
              {toTitle(c.clientStatus)}
            </span>
          )}
          {rem && (
            <span className="text-[9px] text-muted-foreground/45 leading-[14px] shrink-0">{rem}</span>
          )}
        </span>

        {/* Row 3: Contact — single line, ellipsis */}
        {contact && (
          <span className="text-[11px] text-muted-foreground/60 truncate leading-tight w-full overflow-hidden">
            <Highlight text={contact} q={q} />
          </span>
        )}
      </span>
    </span>
  );
}

// ─── Group heading class ──────────────────────────────────────────────────────

const GROUP_CLS =
  "[&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/45 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:select-none";

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const [, navigate] = useLocation();
  const [query, setQuery] = useState("");
  const [activeFilters, setActiveFilters] = useState<FilterId[]>([]);
  const debounced = useDebounced(query.trim(), 20);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isMobile, setIsMobile] = useState(false);
  const [listMaxH, setListMaxH] = useState<string>("58vh");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    setIsMobile(mq.matches);
    const h = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mq.addEventListener("change", h);
    return () => mq.removeEventListener("change", h);
  }, []);

  // Visual viewport listener — shrinks results list when mobile keyboard opens
  useEffect(() => {
    if (!open) return;
    const vv = window.visualViewport;
    if (!vv) return;

    const recalc = () => {
      const available = vv.height;
      // header padding + capsule + chips row + footer + spacing
      const reserved = isMobile ? 180 : 200;
      const px = Math.max(160, available - reserved);
      setListMaxH(`${px}px`);
    };

    recalc();
    vv.addEventListener("resize", recalc);
    vv.addEventListener("scroll", recalc);
    return () => {
      vv.removeEventListener("resize", recalc);
      vv.removeEventListener("scroll", recalc);
    };
  }, [open, isMobile]);

  // Reset query + filters when dialog closes
  useEffect(() => {
    if (!open) {
      const id = setTimeout(() => { setQuery(""); setActiveFilters([]); }, 200);
      return () => clearTimeout(id);
    }
  }, [open]);

  const limit = isMobile ? 8 : 12;

  const { data } = useQuery<SearchResponse>({
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
    placeholderData: (prev) => prev,
  });

  const go = (path: string) => {
    onOpenChange(false);
    setTimeout(() => navigate(path), 50);
  };

  const toggleFilter = (id: FilterId) =>
    setActiveFilters((prev) =>
      prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id],
    );

  const hasQuery = debounced.length > 0;
  const raw = data?.clients ?? [];

  // ── Client-side filter (AND across active chips) ──────────────────────────────
  const activeDefs = FILTERS.filter((f) => activeFilters.includes(f.id));
  const all = activeDefs.length
    ? raw.filter((c) => activeDefs.every((f) => f.predicate(c)))
    : raw;

  const bestMatches = all.filter((c) => c.matchRank <= BEST_RANK_MAX);
  const suggestions = all.filter((c) => c.matchRank > BEST_RANK_MAX);
  const showBest = bestMatches.length > 0 ? bestMatches : suggestions;
  const showSugg = bestMatches.length > 0 ? suggestions : [];
  const hasResults = all.length > 0;
  // Distinguish "API returned nothing" from "filters removed everything"
  const filteredOut = hasQuery && raw.length > 0 && all.length === 0;

  const placeholder = isMobile
    ? "Search clients…"
    : "Search clients by name, phone, email, or package…";

  const capsuleH = isMobile ? 48 : 52;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="client-search-dialog"
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          setTimeout(() => inputRef.current?.focus(), 60);
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] sm:max-w-[560px] lg:max-w-[620px]",
          "gap-0 p-0 overflow-hidden",
          "rounded-2xl",
          "border border-border/50",
          "shadow-[0_0_0_1px_hsl(var(--primary)/0.04),0_24px_80px_rgba(0,0,0,0.75)]",
          // Spotlight position — top-anchored, not centered
          "!top-3 sm:!top-[8%] !translate-y-0",
          // Mobile keyboard safety — dvh shrinks when keyboard opens
          "!max-h-[calc(100dvh-24px)]",
          // Hide Radix auto-close button (no aria-label, only sr-only span)
          "[&>button]:hidden",
        )}
      >
        <CmdkRoot
          shouldFilter={false}
          className="flex flex-col w-full bg-background"
          data-testid="client-search-command"
        >

          {/* ── HEADER: capsule search bar with breathing room ───────────────────
            Capsule (rounded-[20px]) sits inside a padded header so its border is
            never clipped by the modal edge. Soft cyan glow on focus-within only.
            Layout: [search icon] [input] [clear X]  — all vertically centered.
          */}
          <div className="px-3 pt-3 pb-2">
            <div
              className={cn(
                "flex items-center gap-2 rounded-[20px] border bg-white/[0.03] px-3.5",
                "border-border/60 transition-all duration-200",
                "focus-within:border-primary/45 focus-within:bg-white/[0.05]",
                "focus-within:shadow-[0_0_0_3px_hsl(var(--primary)/0.08)]",
              )}
              style={{ height: capsuleH }}
              data-testid="client-search-input-wrapper"
            >
              <Search
                size={16}
                className="shrink-0 text-muted-foreground/50 pointer-events-none"
                aria-hidden
              />

              <CmdkRoot.Input
                ref={inputRef}
                value={query}
                onValueChange={setQuery}
                placeholder={placeholder}
                className={cn(
                  "flex-1 h-full bg-transparent text-[13px] sm:text-sm outline-none",
                  "placeholder:text-muted-foreground/50",
                  "[&::-webkit-search-cancel-button]:hidden [&::-ms-clear]:hidden",
                  "pr-1",
                )}
                data-testid="input-client-search"
              />

              {/* Single X — clears text. 40×40 tap target, flex sibling, no overlap */}
              {query.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear search"
                  data-testid="button-clear-search"
                  onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                  className={cn(
                    "shrink-0 flex items-center justify-center",
                    "h-9 w-9 -mr-1.5",
                    "rounded-full text-muted-foreground/60",
                    "hover:text-foreground hover:bg-white/8",
                    "active:bg-white/10 transition-colors touch-manipulation",
                  )}
                >
                  <X size={14} />
                </button>
              )}
            </div>
          </div>

          {/* ── QUICK FILTER CHIPS ───────────────────────────────────────────────
            Always visible while open (incl. empty query). Horizontal scroll keeps
            them compact — never wraps or breaks layout. Tap toggles instantly.
          */}
          <div className="border-b border-border/40 px-3 pb-2">
            <div
              className="flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              data-testid="quick-filter-chips"
            >
              {FILTERS.map((f) => {
                const on = activeFilters.includes(f.id);
                return (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => toggleFilter(f.id)}
                    data-testid={`chip-filter-${f.id}`}
                    data-active={on ? "true" : "false"}
                    aria-pressed={on}
                    className={cn(
                      "shrink-0 rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap",
                      "transition-colors touch-manipulation",
                      on
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-white/[0.03] border-border/50 text-muted-foreground/70 hover:text-foreground hover:bg-white/[0.06]",
                    )}
                  >
                    {f.label}
                  </button>
                );
              })}

              {activeFilters.length > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilters([])}
                  data-testid="chip-clear-filters"
                  className="shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium text-muted-foreground/60 hover:text-foreground transition-colors touch-manipulation"
                >
                  <X size={11} />
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* ── RESULTS LIST ─────────────────────────────────────────────────────
            min-h prevents modal collapse between states. max-h (viewport-driven)
            forces internal scroll — content never hides behind keyboard.
          */}
          <CommandList
            style={{ maxHeight: listMaxH }}
            className="min-h-[180px] overflow-y-auto overflow-x-hidden"
            data-testid="client-search-results"
          >

            {/* Empty state — first open (compact, balanced) */}
            {!hasQuery && (
              <div
                className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center"
                data-testid="client-search-empty-state"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Search size={16} />
                </span>
                <p className="text-sm font-medium">Search Clients</p>
                <p className="text-[12px] text-muted-foreground/60 leading-relaxed max-w-[210px]">
                  Type a name, phone, email or package.
                </p>
              </div>
            )}

            {/* Filters removed all matches */}
            {filteredOut && (
              <div
                className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center"
                data-testid="client-search-no-filter-matches"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
                  <Users size={16} />
                </span>
                <p className="text-sm font-medium">No clients match these filters</p>
                <button
                  type="button"
                  onClick={() => setActiveFilters([])}
                  data-testid="button-clear-filters-empty"
                  className="mt-0.5 text-[12px] font-medium text-primary hover:underline"
                >
                  Clear filters
                </button>
              </div>
            )}

            {/* No results from API */}
            {hasQuery && raw.length === 0 && (
              <div
                className="flex flex-col items-center justify-center gap-2 py-8 px-4 text-center"
                data-testid="client-search-no-results"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
                  <Users size={16} />
                </span>
                <p className="text-sm font-medium">No clients found</p>
                <p className="text-[12px] text-muted-foreground/60 max-w-[200px]">
                  Try a different name, phone, or package.
                </p>
                <button
                  type="button"
                  onClick={() => go("/admin/clients?new=1")}
                  data-testid="button-create-client-no-results"
                  className="mt-1 flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary hover:bg-primary/15 transition-colors touch-manipulation"
                >
                  <UserPlus size={12} />
                  Create client
                </button>
              </div>
            )}

            {/* Best Matches */}
            {hasQuery && showBest.length > 0 && (
              <CommandGroup
                heading="Best Matches"
                className={GROUP_CLS}
                data-testid="section-best-matches"
              >
                {showBest.map((c) => (
                  <CommandItem
                    key={`best-${c.id}`}
                    value={`${c.fullName} ${c.email ?? ""} ${c.phone ?? ""} ${c.pkgName ?? ""}`}
                    onSelect={() => go(`/admin/clients/${c.id}`)}
                    data-testid={`client-result-${c.id}`}
                    className="flex items-center px-3 py-2 rounded-lg cursor-pointer min-h-[58px] hover:bg-accent/60 active:bg-accent/80"
                  >
                    <ClientCard c={c} q={debounced} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* More Suggestions */}
            {hasQuery && showSugg.length > 0 && (
              <CommandGroup
                heading="More Suggestions"
                className={GROUP_CLS}
                data-testid="section-more-suggestions"
              >
                {showSugg.map((c) => (
                  <CommandItem
                    key={`sugg-${c.id}`}
                    value={`${c.fullName} ${c.email ?? ""} ${c.phone ?? ""} ${c.pkgName ?? ""}`}
                    onSelect={() => go(`/admin/clients/${c.id}`)}
                    data-testid={`client-result-${c.id}`}
                    className="flex items-center px-3 py-2 rounded-lg cursor-pointer min-h-[58px] hover:bg-accent/60 active:bg-accent/80"
                  >
                    <ClientCard c={c} q={debounced} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

          </CommandList>

          {/* ── FOOTER ─────────────────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between gap-2 border-t border-border/50 px-4 py-[6px]"
            data-testid="client-search-footer"
          >
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 hidden sm:flex items-center gap-1.5">
              <Search size={9} aria-hidden />
              Enter to open · Esc to close
            </span>
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground/40 sm:hidden">
              Client search
            </span>
            <span className="text-[9px] font-mono text-muted-foreground/35 hidden md:inline">⌘K</span>
          </div>

        </CmdkRoot>
      </DialogContent>
    </Dialog>
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
