import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem } from "@/components/ui/command";
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

// Ranks 0-5: identity matches (name/email/phone). Ranks 6-10: weaker matches.
const BEST_RANK_MAX = 5;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delay = 20): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setV(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return v;
}

/** Convert snake_case / SCREAMING_SNAKE to "Title Case". */
function toTitle(s: string | null): string {
  if (!s) return "";
  return s
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function remainingLabel(total: number | null, used: number | null): string | null {
  if (total == null || used == null) return null;
  const rem = Math.max(0, total - used);
  return `${rem} left`;
}

function statusBadgeClass(status: string | null): string {
  switch (status) {
    case "active":       return "bg-emerald-500/15 text-emerald-400 border-emerald-500/25";
    case "expiring_soon":return "bg-amber-500/15 text-amber-400 border-amber-500/25";
    case "frozen":       return "bg-sky-500/15 text-sky-400 border-sky-500/25";
    default:             return "bg-white/5 text-muted-foreground/70 border-white/10";
  }
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

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_SIZE = 44; // px — fixed to prevent layout shift on all devices

function ClientAvatar({ photoUrl, name }: { photoUrl: string | null; name: string }) {
  const [failed, setFailed] = useState(false);
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const base = `shrink-0 rounded-full overflow-hidden flex items-center justify-center`;
  const sz = { width: AVATAR_SIZE, height: AVATAR_SIZE, minWidth: AVATAR_SIZE };

  if (photoUrl && !failed) {
    return (
      <span
        className={cn(base, "bg-primary/10")}
        style={sz}
        data-testid="client-avatar-photo"
      >
        <img
          src={photoUrl}
          alt={name}
          loading="lazy"
          onError={() => setFailed(true)}
          className="w-full h-full object-cover object-center"
          style={sz}
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

// ─── Client result card ───────────────────────────────────────────────────────

function ClientCard({ c, q }: { c: ClientResult; q: string }) {
  const rem = remainingLabel(c.pkgTotal, c.pkgUsed);
  const contact = c.email || c.phone;

  return (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      {/* Avatar — fixed size prevents layout shift */}
      <ClientAvatar photoUrl={c.profilePictureUrl} name={c.fullName} />

      {/* Text column */}
      <span className="flex min-w-0 flex-col gap-[3px] flex-1">
        {/* Row 1: name + VIP badge */}
        <span className="flex flex-wrap items-center gap-1.5 min-w-0">
          <span
            className="text-[13px] font-medium leading-tight truncate"
            data-testid={`client-name-${c.id}`}
          >
            <Highlight text={c.fullName} q={q} />
          </span>
          {c.vipTier && c.vipTier !== "foundation" && (
            <span className="shrink-0 rounded-full bg-amber-500/15 border border-amber-500/25 px-1.5 text-[9px] uppercase tracking-wider text-amber-400 leading-[15px]">
              {toTitle(c.vipTier)}
            </span>
          )}
        </span>

        {/* Row 2: package (primary badge) + status (secondary badge) */}
        <span className="flex flex-wrap items-center gap-1.5 min-w-0">
          {c.pkgName && (
            <span
              className="shrink-0 rounded-full border border-primary/25 bg-primary/8 px-1.5 text-[9px] text-primary leading-[15px] font-medium truncate max-w-[130px]"
              data-testid={`client-pkg-badge-${c.id}`}
            >
              <Highlight text={c.pkgName} q={q} />
            </span>
          )}
          {c.clientStatus && (
            <span
              className={cn(
                "shrink-0 rounded-full border px-1.5 text-[9px] uppercase tracking-wider leading-[15px]",
                statusBadgeClass(c.clientStatus),
              )}
              data-testid={`client-status-${c.id}`}
            >
              {toTitle(c.clientStatus)}
            </span>
          )}
          {rem && (
            <span className="text-[9px] text-muted-foreground/50 leading-[15px]">
              {rem}
            </span>
          )}
        </span>

        {/* Row 3: contact (email or phone) */}
        {contact && (
          <span className="text-[11px] text-muted-foreground/70 truncate leading-tight">
            <Highlight text={contact} q={q} />
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

  // Clear query after dialog closes
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
    // Keep previous results visible while loading — no "Searching..." flicker
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

  // If only weak matches exist, promote them into the "Best matches" section
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
          // Width: fills mobile, capped at 560/620 on larger screens
          "w-[calc(100vw-24px)] max-w-[calc(100vw-24px)] sm:max-w-[560px] lg:max-w-[620px]",
          // Layout
          "gap-0 p-0 overflow-hidden",
          // Shape
          "rounded-xl sm:rounded-2xl",
          // Border: 1px cyan-tinted, very subtle
          "border border-border/50",
          // Shadow: no harsh cyan glow, premium depth
          "shadow-[0_0_0_1px_hsl(var(--primary)/0.06),0_24px_80px_rgba(0,0,0,0.72)]",
          // Hide the default Radix close button — we use X on the input
          "[&>button[aria-label='Close']]:hidden",
        )}
      >
        <Command
          shouldFilter={false}
          className="flex flex-col overflow-hidden rounded-xl sm:rounded-2xl bg-background"
          data-testid="client-search-command"
        >
          {/* ── Input row ──────────────────────────────────────────────── */}
          <div
            className="relative flex items-center border-b border-border/50"
            data-testid="client-search-input-wrapper"
          >
            <CommandInput
              ref={inputRef as any}
              value={query}
              onValueChange={setQuery}
              placeholder={placeholder}
              // h-[52px] mobile, h-[54px] desktop (via responsive class)
              className="h-[52px] sm:h-[54px] pr-9 text-[13px] sm:text-sm"
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
                className="absolute right-3 flex h-5 w-5 shrink-0 items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors touch-manipulation"
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* ── Results list ───────────────────────────────────────────── */}
          <CommandList
            className="max-h-[60vh] md:max-h-[65vh] lg:max-h-[70vh] overflow-y-auto overflow-x-hidden"
            data-testid="client-search-results"
          >
            {/* Empty state — no query yet */}
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

            {/* No results — query returned nothing */}
            {hasQuery && !hasResults && (
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
                  className="mt-1 flex items-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary hover:bg-primary/15 transition-colors touch-manipulation"
                >
                  <UserPlus size={12} />
                  Create client
                </button>
              </div>
            )}

            {/* Best matches */}
            {hasQuery && showBest.length > 0 && (
              <CommandGroup
                heading="Best Matches"
                className="[&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/50 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5"
                data-testid="section-best-matches"
              >
                {showBest.map((c) => (
                  <CommandItem
                    key={`best-${c.id}`}
                    value={`${c.fullName} ${c.email ?? ""} ${c.phone ?? ""} ${c.pkgName ?? ""}`}
                    onSelect={() => go(`/admin/clients/${c.id}`)}
                    data-testid={`client-result-${c.id}`}
                    className="flex items-center gap-0 py-2 px-3 rounded-lg cursor-pointer min-h-[58px] hover:bg-accent/60 active:bg-accent/80"
                  >
                    <ClientCard c={c} q={debounced} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}

            {/* More suggestions — only when best matches also exist */}
            {hasQuery && showSugg.length > 0 && (
              <CommandGroup
                heading="More Suggestions"
                className="[&_[cmdk-group-heading]]:text-[9px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-muted-foreground/50 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5"
                data-testid="section-more-suggestions"
              >
                {showSugg.map((c) => (
                  <CommandItem
                    key={`sugg-${c.id}`}
                    value={`${c.fullName} ${c.email ?? ""} ${c.phone ?? ""} ${c.pkgName ?? ""}`}
                    onSelect={() => go(`/admin/clients/${c.id}`)}
                    data-testid={`client-result-${c.id}`}
                    className="flex items-center gap-0 py-2 px-3 rounded-lg cursor-pointer min-h-[58px] hover:bg-accent/60 active:bg-accent/80"
                  >
                    <ClientCard c={c} q={debounced} />
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>

          {/* ── Footer ─────────────────────────────────────────────────── */}
          <div
            className="flex items-center justify-between gap-2 border-t border-border/50 px-3 py-[7px] text-[9px] uppercase tracking-widest text-muted-foreground/50"
            data-testid="client-search-footer"
          >
            <span className="hidden sm:flex items-center gap-1.5">
              <Search size={9} />
              Enter to open · Esc to close
            </span>
            <span className="sm:hidden">Client search</span>
            <span className="font-mono hidden md:inline">⌘K</span>
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
