import { useMemo, useState } from "react";
import { CyanHairline } from "@/components/ui/CyanHairline";
import {
  Pill,
  AlertTriangle,
  Sparkles,
  Sun,
  Sunrise,
  Moon,
  Dumbbell,
  Flame,
  Coffee,
  Utensils,
  Droplets,
  Zap,
  Leaf,
  Heart,
  Shield,
  Atom,
  Fish,
  Wheat,
  ShieldCheck,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Badge } from "@/components/ui/badge";
import { useMySupplements } from "@/hooks/use-supplements";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import {
  SUPPLEMENT_TIMING_LABELS_EN,
  SUPPLEMENT_TIMING_ORDER,
  SUPPLEMENT_CATEGORY_LABELS_EN,
  type ClientSupplement,
  type SupplementTiming,
  type SupplementCategory,
} from "@shared/schema";
import { whatsappUrl, buildSupplementsWhatsApp } from "@/lib/whatsapp";
import { useTranslation } from "@/i18n";

// Client-facing "Today" + "Full" view of the supplement protocol.
// May-2026 Tron-Legacy design pass: rebuilt as a cinematic protocol HUD —
// timing-rail timeline, dark-glass supplement cards, cyan-tinted category
// glyphs, amber warnings, educational (non-medical) disclaimer.
//
// Data model untouched. The timing slots, training/rest filtering, and
// status semantics all come from `@shared/schema` exactly as before — no
// route, hook, or storage change is required for this pass.

type DayMode = "training" | "rest";

export function SupplementsTab() {
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const { lang } = useTranslation();
  const { data: items = [], isLoading } = useMySupplements();
  const [mode, setMode] = useState<DayMode>("training");

  // Behavior parity with the pre-redesign component:
  //   - Empty state triggers ONLY when there are zero supplements at all
  //     (clients with paused/stopped supplements still see Full Protocol).
  //   - Warnings banner counts EVERY item with a warning, including
  //     non-active rows, since the warnings list shows the full protocol.
  //   - Today timeline filters by both status='active' AND day-mode (this
  //     is what `filterForDay` does — it owns both filters internally so
  //     the helper contract is identical to the prior version).
  const todays = useMemo(() => filterForDay(items, mode), [items, mode]);
  const grouped = useMemo(() => groupByTiming(todays), [todays]);
  const warningCount = useMemo(
    () => items.reduce((n, i) => n + (i.warnings?.trim() ? 1 : 0), 0),
    [items],
  );

  const shareUrl = useMemo(() => {
    if (items.length === 0) return null;
    const msg = buildSupplementsWhatsApp(items, {
      lang,
      clientName: user?.fullName,
      mode,
    });
    return whatsappUrl(settings?.whatsappNumber, msg);
  }, [items, settings?.whatsappNumber, user?.fullName, mode, lang]);

  if (isLoading) {
    return <SupplementsSkeleton />;
  }

  if (items.length === 0) {
    return <EmptyProtocol />;
  }

  return (
    <div className="space-y-6">
      {/* ── HUD HEADER ─────────────────────────────────── */}
      <header
        className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/[0.08] via-background/40 to-transparent p-5 sm:p-6"
        data-testid="card-supplements-header"
      >
        {/* Cyan corner halo */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 -right-24 h-64 w-64 rounded-full opacity-60"
          style={{
            background:
              "radial-gradient(circle, hsl(183 100% 60% / 0.18), transparent 70%)",
          }}
        />
        {/* Hairline top rule */}
        <CyanHairline intensity="strong" inset="inset-x-6" />

        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="tron-eyebrow text-[10px] font-semibold inline-flex items-center gap-1.5">
              <Sparkles size={11} /> Protocol
            </p>
            <h2 className="font-display text-2xl sm:text-[26px] font-semibold leading-tight mt-1.5">
              Today&rsquo;s Stack
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              <span className="text-foreground font-medium">{todays.length}</span>{" "}
              {todays.length === 1 ? "supplement" : "supplements"} for a{" "}
              <span className="text-primary">{mode === "training" ? "training" : "rest"} day</span>
            </p>
          </div>

          {/* Day-mode segmented HUD */}
          <div
            className="inline-flex rounded-xl border border-primary/20 bg-background/60 p-1 backdrop-blur-sm"
            role="tablist"
            aria-label="Day mode"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "training"}
              onClick={() => setMode("training")}
              className={`text-xs px-3 h-8 rounded-lg inline-flex items-center gap-1.5 transition-all ${
                mode === "training"
                  ? "bg-primary text-primary-foreground shadow-[0_0_18px_-4px_hsl(183_100%_55%_/_0.55)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="toggle-training-day"
            >
              <Dumbbell size={12} /> Training
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "rest"}
              onClick={() => setMode("rest")}
              className={`text-xs px-3 h-8 rounded-lg inline-flex items-center gap-1.5 transition-all ${
                mode === "rest"
                  ? "bg-primary text-primary-foreground shadow-[0_0_18px_-4px_hsl(183_100%_55%_/_0.55)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="toggle-rest-day"
            >
              <Moon size={12} /> Rest
            </button>
          </div>
        </div>

        {/* Stats strip */}
        <div className="relative mt-5 grid grid-cols-3 gap-2 sm:gap-3">
          <StatCell label="In stack" value={items.length} />
          <StatCell label="Today" value={todays.length} accent />
          <StatCell label="Warnings" value={warningCount} amber={warningCount > 0} />
        </div>
      </header>

      {/* ── TIMELINE ─────────────────────────────────── */}
      {todays.length === 0 ? (
        <div
          className="rounded-2xl border border-dashed border-white/10 bg-card/30 p-8 text-center"
          data-testid="text-no-todays-supplements"
        >
          <p className="text-sm text-muted-foreground">
            Nothing to take on a {mode === "training" ? "training" : "rest"} day.
            Switch the toggle to see the other.
          </p>
        </div>
      ) : (
        <ProtocolTimeline grouped={grouped} />
      )}

      {/* ── WARNINGS BANNER ─────────────────────────── */}
      {warningCount > 0 && (
        <div
          className="rounded-2xl border border-cyan-500/25 bg-cyan-500/[0.06] p-4"
          data-testid="banner-supplement-warnings"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-cyan-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-cyan-200">
                {warningCount} {warningCount === 1 ? "item has" : "items have"} safety notes
              </p>
              <p className="text-xs text-cyan-200/80 mt-0.5">
                Read them in the full protocol below before taking.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── WHATSAPP SHARE ───────────────────────────── */}
      {shareUrl && (
        <a
          href={shareUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-4 h-11 rounded-xl bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 text-sm font-semibold transition-colors"
          data-testid="link-share-supplements-whatsapp"
        >
          <SiWhatsapp size={15} /> Share my protocol on WhatsApp
        </a>
      )}

      {/* ── FULL PROTOCOL ────────────────────────────── */}
      <section
        className="rounded-3xl border border-white/[0.06] bg-card/40 p-5 sm:p-6"
        data-testid="section-full-protocol"
      >
        <div className="flex items-center justify-between gap-3 mb-4">
          <h3 className="font-display text-lg font-semibold inline-flex items-center gap-2">
            <Pill size={16} className="text-primary" /> Full Protocol
          </h3>
          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary/90">
            {items.length} {items.length === 1 ? "item" : "items"}
          </Badge>
        </div>
        <ul className="space-y-2.5">
          {items.map((it) => (
            <SupplementCard key={`all-${it.id}`} item={it} expanded />
          ))}
        </ul>
      </section>

      {/* ── EDUCATIONAL DISCLAIMER ───────────────────── */}
      <div
        className="rounded-2xl border border-white/[0.05] bg-white/[0.015] p-4"
        data-testid="text-supplement-disclaimer"
      >
        <div className="flex items-start gap-2.5">
          <ShieldCheck size={14} className="text-primary/70 shrink-0 mt-0.5" />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            <span className="text-foreground/80 font-medium">Educational coaching guidance.</span>{" "}
            This protocol is part of your personal training plan and is not medical advice.
            Consult your physician before starting, changing, or stopping any supplement —
            especially if you have a medical condition, take prescription medication, or are
            pregnant or nursing.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   TIMELINE
   ════════════════════════════════════════════════════════════════ */

function ProtocolTimeline({
  grouped,
}: {
  grouped: Map<SupplementTiming, ClientSupplement[]>;
}) {
  const slots = Array.from(grouped.keys()) as SupplementTiming[];
  return (
    <div className="relative">
      {/* Vertical cyan rail — sits ~14px from inline-start so it pierces
          through the timing-node centre. RTL-safe via inset-inline-start. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-2 bottom-2 w-px"
        style={{
          insetInlineStart: "14px",
          background:
            "linear-gradient(180deg, transparent, hsl(183 100% 70% / 0.35) 8%, hsl(183 100% 70% / 0.35) 92%, transparent)",
        }}
      />
      <ol className="space-y-5">
        {slots.map((slot) => (
          <li key={slot} className="relative ps-10">
            {/* Glowing timing node */}
            <span
              aria-hidden
              className="absolute top-0.5 inline-flex size-7 items-center justify-center rounded-full border border-primary/40 bg-background text-primary shadow-[0_0_14px_-2px_hsl(183_100%_55%_/_0.55)]"
              style={{ insetInlineStart: 0 }}
            >
              <SlotIcon slot={slot} />
            </span>
            <p className="tron-eyebrow text-[10px] font-semibold mb-2.5">
              {SUPPLEMENT_TIMING_LABELS_EN[slot]}
            </p>
            <ul className="space-y-2">
              {grouped.get(slot)!.map((it) => (
                <SupplementCard key={`${slot}-${it.id}`} item={it} />
              ))}
            </ul>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   SUPPLEMENT CARD
   ════════════════════════════════════════════════════════════════ */

function SupplementCard({
  item,
  expanded = false,
}: {
  item: ClientSupplement;
  expanded?: boolean;
}) {
  const cat = (item.category || "other") as SupplementCategory;
  return (
    <li
      className="group relative overflow-hidden rounded-2xl border border-white/[0.06] bg-gradient-to-br from-white/[0.025] to-transparent p-3.5 transition-colors hover:border-primary/20"
      data-testid={`row-my-supp-${item.id}`}
    >
      <div className="flex items-start gap-3">
        {/* Category glyph — cyan tint, all categories share the same
            cool-side palette so the layout never goes rainbow. */}
        <div className="relative size-10 shrink-0 rounded-xl border border-primary/20 bg-primary/[0.08] text-primary inline-flex items-center justify-center">
          <CategoryIcon category={cat} />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="font-semibold leading-tight truncate" data-testid={`text-supp-name-${item.id}`}>
                {item.name}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5 inline-flex items-center gap-1.5">
                <span>{SUPPLEMENT_CATEGORY_LABELS_EN[cat] ?? "Other"}</span>
                {item.brand && (
                  <>
                    <span className="text-white/20">·</span>
                    <span className="truncate">{item.brand}</span>
                  </>
                )}
              </p>
            </div>
            {/* Dosage HUD pill */}
            <span
              className="shrink-0 inline-flex items-center rounded-md border border-primary/25 bg-primary/[0.06] px-2 h-6 text-[11px] font-mono font-semibold text-primary"
              data-testid={`badge-supp-dose-${item.id}`}
            >
              {formatDose(item.dosage)} {item.unit}
            </span>
          </div>

          {expanded && item.timings.length > 0 && (
            <p className="text-[11px] text-muted-foreground/90 mt-1.5">
              {item.timings
                .map(
                  (t) =>
                    SUPPLEMENT_TIMING_LABELS_EN[t as keyof typeof SUPPLEMENT_TIMING_LABELS_EN] || t,
                )
                .join(" · ")}
            </p>
          )}

          {(item.trainingDayOnly || item.restDayOnly) && (
            <span className="mt-1.5 inline-flex items-center gap-1 rounded-md border border-primary/25 bg-primary/[0.05] px-1.5 h-5 text-[9px] uppercase tracking-wider text-primary/90">
              {item.trainingDayOnly ? (
                <>
                  <Dumbbell size={9} /> Training days
                </>
              ) : (
                <>
                  <Moon size={9} /> Rest days
                </>
              )}
            </span>
          )}

          {item.notes && (
            <p className="text-[11px] text-muted-foreground mt-1.5 leading-relaxed">{item.notes}</p>
          )}

          {item.warnings && (
            <p className="text-[11px] text-cyan-300/95 mt-1.5 inline-flex items-start gap-1.5 leading-relaxed">
              <AlertTriangle size={11} className="shrink-0 mt-0.5" />
              <span>{item.warnings}</span>
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

/* ════════════════════════════════════════════════════════════════
   STATS / SKELETON / EMPTY
   ════════════════════════════════════════════════════════════════ */

function StatCell({
  label,
  value,
  accent,
  amber,
}: {
  label: string;
  value: number;
  accent?: boolean;
  amber?: boolean;
}) {
  const tone = amber
    ? "border-cyan-500/25 text-cyan-200"
    : accent
      ? "border-primary/25 text-primary"
      : "border-white/[0.08] text-foreground";
  return (
    <div
      className={`rounded-xl border ${tone} bg-background/40 backdrop-blur-sm px-3 py-2.5 text-center`}
    >
      <p className="font-display text-xl font-semibold tabular-nums leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">{label}</p>
    </div>
  );
}

function SupplementsSkeleton() {
  return (
    <div className="space-y-5" data-testid="skeleton-supplements">
      <div className="rounded-3xl border border-white/[0.06] bg-card/30 p-5 admin-shimmer h-[148px]" />
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-white/[0.05] bg-card/30 admin-shimmer h-16"
          />
        ))}
      </div>
    </div>
  );
}

function EmptyProtocol() {
  return (
    <div
      className="relative overflow-hidden rounded-3xl border border-white/[0.08] bg-card/30 p-12 text-center"
      data-testid="empty-supplement-protocol"
    >
      <CyanHairline />
      <div className="mx-auto mb-4 inline-flex size-14 items-center justify-center rounded-2xl border border-primary/25 bg-primary/[0.06] text-primary">
        <Pill size={24} />
      </div>
      <h3 className="font-display text-lg mb-1">No supplement protocol yet</h3>
      <p className="text-sm text-muted-foreground max-w-sm mx-auto">
        Coach Youssef will design and prescribe your personalised protocol after your
        consultation and InBody review.
      </p>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════
   ICONS / ROUTING
   ════════════════════════════════════════════════════════════════ */

function SlotIcon({ slot }: { slot: SupplementTiming }) {
  switch (slot) {
    case "morning":
      return <Sunrise size={13} />;
    case "with_breakfast":
      return <Coffee size={13} />;
    case "pre_workout":
      return <Flame size={13} />;
    case "intra_workout":
      return <Droplets size={13} />;
    case "post_workout":
      return <Dumbbell size={13} />;
    case "with_lunch":
    case "with_dinner":
      return <Utensils size={13} />;
    case "before_bed":
      return <Moon size={13} />;
    default:
      return <Sun size={13} />;
  }
}

function CategoryIcon({ category }: { category: SupplementCategory }) {
  const Icon = CATEGORY_ICONS[category] ?? Pill;
  return <Icon size={16} />;
}

const CATEGORY_ICONS: Record<SupplementCategory, typeof Pill> = {
  vitamin: Sun,
  mineral: Droplets,
  protein: Zap,
  creatine: Zap,
  amino: Atom,
  pre_workout: Flame,
  fat_burner: Flame,
  omega: Fish,
  probiotic: Wheat,
  herbal: Leaf,
  recovery: Heart,
  hormone_support: Shield,
  electrolyte: Droplets,
  other: Pill,
};

/* ════════════════════════════════════════════════════════════════
   PURE HELPERS
   ════════════════════════════════════════════════════════════════ */

// Restricts the protocol to "what to take TODAY":
//   - status must be 'active' (paused/stopped never show on the timeline)
//   - day-mode flags must match the current toggle
// This contract matches the pre-redesign helper so any caller relying on
// the prior behaviour (today-only filtering, status-aware) is unchanged.
function filterForDay(items: ClientSupplement[], mode: DayMode): ClientSupplement[] {
  return items
    .filter((i) => i.status === "active")
    .filter((i) => {
      if (mode === "training" && i.restDayOnly) return false;
      if (mode === "rest" && i.trainingDayOnly) return false;
      return true;
    });
}

function groupByTiming(
  items: ClientSupplement[],
): Map<SupplementTiming, ClientSupplement[]> {
  const out = new Map<SupplementTiming, ClientSupplement[]>();
  for (const it of items) {
    const slots = (it.timings.length > 0 ? it.timings : ["anytime"]) as SupplementTiming[];
    for (const slot of slots) {
      const arr = out.get(slot) ?? [];
      arr.push(it);
      out.set(slot, arr);
    }
  }
  // Stable sort by canonical slot order from schema.
  const order = SUPPLEMENT_TIMING_ORDER as Record<string, number>;
  return new Map(
    Array.from(out.entries()).sort(
      (a, b) => (order[a[0]] ?? 99) - (order[b[0]] ?? 99),
    ),
  );
}

// Render dosage without trailing zeros — "2" not "2.0", "0.5" stays "0.5".
function formatDose(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return Number(n.toFixed(2)).toString();
}
