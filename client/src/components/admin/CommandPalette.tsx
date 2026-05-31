import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
// Use cmdk primitives directly to avoid double-border/double-X from the UI wrapper
import { Command as CmdkPrimitive } from "cmdk";
import { Command, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Search, X, Users, Package as PackageIcon, UserPlus } from "lucide-react";
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
const AVATAR_PX = 44; // fixed size, prevents layout shift on all devices

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
    case "frozen":        return "bg-sky-500/15 text-sky-400 border-sky-500/25";
    default:              return "bg-white/5 text-muted-foreground/60 border-white/10";
  }
}

/** Highlight the first occurrence of `q` in Tron-cyan. */
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

function ClientCard({ c, q }: { c: ClientResult; q: string }) {
  const rem = remainingLabel(c.pkgTotal, c.pkgUsed);
  const contact = c.email || c.phone;

  return (
    <span className="flex min-w-0 w-full items-center gap-3">
      {/* Fixed-width avatar — no layout shift */}
      <ClientAvatar photoUrl={c.profilePictureUrl} name={c.fullName} />

      {/* Text column — min-w-0 required for truncate to work */}
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

        {/* Row 2: Package badge (primary) + status badge (secondary) + sessions */}
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

        {/* Row 3: Email / phone — single line, ellipsis */}
        {contact && (
          <span className="text-[11px] text-muted-foreground/60 truncate leading-tight w-full overflow-hidden">
            <Highlight text={contact} q={q} />
          </span>
        )}
      </span>
    </span>
  );
}

// ─── Section heading ──────────────────────────────────────────────────────────

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
  const debounced = useDebounced(query.trim(), 20);
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
      const id = setTimeout(() => setQuery(""), 200);
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
    // Show stale results while re-fetching → zero "Searching…" flicker
    placeholderData: (prev) => prev,
  });

  const go = (path: string) => {
    onOpenChange(false);
    setTimeout(() => navigate(path), 50);
  };

  const hasQuery = debounced.length > 0;
  const all = data?.clients ?? [];
  const bestMatches = all.filter((c) => c.matchRank <= BEST_RANK_MAX);
  const suggestions = all.filter((c) => c.matchRank > BEST_RANK_MAX);
  const showBest = bestMatches.length > 0 ? bestMatches : suggestions;
  const showSugg = bestMatches.length > 0 ? suggestions : [];
  const hasResults = all.length > 0;

  const placeholder = isMobile
    ? "Search clients…"
    : "Search clients by name, phone, email, or package…";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        data-testid="client-search-dialog"
        className={cn(
          // Width — fills mobile edge-to-edge (minus 12px each side)
          "w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] sm:max-w-[560px] lg:max-w-[620px]",
          // Layout — no default gap/padding, no close button
          "gap-0 p-0 overflow-hidden",
          // Shape
          "rounded-xl sm:rounded-2xl",
          // Border — 1px subtle, no harsh glow
          "border border-border/50",
          // Shadow — premium dark depth, very faint cyan outline
          "shadow-[0_0_0_1px_hsl(var(--primary)/0.05),0_20px_70px_rgba(0,0,0,0.72)]",
          // Hide the auto-generated Radix close button
          "[&>button[aria-label='Close']]:hidden",
        )}
      >
        {/*
          Use Command as the cmdk root (shouldFilter=false = server filters).
          No overflow-hidden / rounded here — the DialogContent clips everything.
        */}
        <Command
          shouldFilter={false}
          className="flex flex-col w-full bg-background"
          data-testid="client-search-command"
        >

          {/* ── INPUT ROW ──────────────────────────────────────────────────
            Build this ourselves with CmdkPrimitive.Input to ensure:
            - Single border-b (CommandInput UI wrapper would add its own)
            - Single X button (no native browser clear + our custom)
            - Exact height control
            - Correct icon spacing
          */}
          <div
            className="flex items-center gap-0 border-b border-border/50 px-4"
            style={{ height: isMobile ? 50 : 54 }}
            data-testid="client-search-input-wrapper"
          >
            <Search
              size={15}
              className="shrink-0 text-muted-foreground/50 mr-3 pointer-events-none"
              aria-hidden
            />

            {/* Raw cmdk input — suppresses native browser clear button */}
            <CmdkPrimitive.Input
              ref={inputRef}
              value={query}
              onValueChange={setQuery}
              placeholder={placeholder}
              className={cn(
                "flex-1 h-full bg-transparent text-[13px] sm:text-sm outline-none",
                "placeholder:text-muted-foreground/50",
                // Suppress native clear buttons (Safari, IE, Chrome on some inputs)
                "[&::-webkit-search-cancel-button]:hidden [&::-ms-clear]:hidden",
                // Right space so text never touches the X button area
                "pr-2",
              )}
              data-testid="input-client-search"
            />

            {/* Custom X — only ours, no duplicates, fixed 40px tap target */}
            {query.length > 0 && (
              <button
                type="button"
                aria-label="Clear search"
                data-testid="button-clear-search"
                onClick={() => { setQuery(""); inputRef.current?.focus(); }}
                className={cn(
                  "shrink-0 flex items-center justify-center",
                  "h-10 w-10 -mr-1",   // 40px tap target, negative margin to align with edge
                  "rounded-lg text-muted-foreground/60 hover:text-foreground",
                  "hover:bg-white/5 active:bg-white/8 transition-colors touch-manipulation",
                )}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* ── RESULTS LIST ───────────────────────────────────────────────
            min-h prevents the modal from collapsing on empty state vs results.
            max-h forces internal scroll instead of page jump.
          */}
          <CommandList
            className={cn(
              "overflow-y-auto overflow-x-hidden",
              // min-h keeps modal height stable regardless of result count
              "min-h-[200px]",
              // max-h with internal scroll — never grows the page
              "max-h-[62vh] md:max-h-[65vh] lg:max-h-[70vh]",
            )}
            data-testid="client-search-results"
          >

            {/* Empty state */}
            {!hasQuery && (
              <div
                className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center"
                data-testid="client-search-empty-state"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <Search size={18} />
                </span>
                <p className="text-sm font-medium">Search Clients</p>
                <p className="text-[12px] text-muted-foreground/70 leading-relaxed max-w-[220px]">
                  Type a name, phone, email, or package.
                </p>
              </div>
            )}

            {/* No results */}
            {hasQuery && !hasResults && (
              <div
                className="flex flex-col items-center justify-center gap-2 py-10 px-4 text-center"
                data-testid="client-search-no-results"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white/5 text-muted-foreground">
                  <Users size={18} />
                </span>
                <p className="text-sm font-medium">No clients found</p>
                <p className="text-[12px] text-muted-foreground/70 leading-relaxed max-w-[220px]">
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
                    className={cn(
                      "flex items-center px-3 py-2 rounded-lg cursor-pointer",
                      "min-h-[58px]",
                      "hover:bg-accent/60 active:bg-accent/80",
                    )}
                  >
                    <ClientCard c={c} q={debounced} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* More Suggestions — only when best also exist */}
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
                    className={cn(
                      "flex items-center px-3 py-2 rounded-lg cursor-pointer",
                      "min-h-[58px]",
                      "hover:bg-accent/60 active:bg-accent/80",
                    )}
                  >
                    <ClientCard c={c} q={debounced} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

          </CommandList>

          {/* ── FOOTER ─────────────────────────────────────────────────── */}
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

        </Command>
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
