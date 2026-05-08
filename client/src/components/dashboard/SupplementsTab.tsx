import { useMemo, useState } from "react";
import { Pill, AlertTriangle, Sparkles, Sun, Moon, Dumbbell, MoreHorizontal } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useMySupplements } from "@/hooks/use-supplements";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import {
  SUPPLEMENT_TIMING_LABELS_EN,
  SUPPLEMENT_TIMING_ORDER,
  type ClientSupplement,
  type SupplementTiming,
} from "@shared/schema";
import { whatsappUrl, buildSupplementsWhatsApp } from "@/lib/whatsapp";
import { useTranslation } from "@/i18n";
import { CoachProtocols } from "@/components/CoachProtocols";

// Client-facing "Today" + "All" view of their supplement protocol.
// We default the day-mode to "training" because most clients open the
// dashboard ON a training day; they can flip the toggle for rest day.
type DayMode = "training" | "rest";

export function SupplementsTab() {
  const { user } = useAuth();
  const { data: settings } = useSettings();
  const { lang } = useTranslation();
  const { data: items = [], isLoading } = useMySupplements();
  const [mode, setMode] = useState<DayMode>("training");

  const todays = useMemo(() => filterForDay(items, mode), [items, mode]);
  const grouped = useMemo(() => groupByTiming(todays), [todays]);
  const hasWarnings = useMemo(() => items.some((i) => !!i.warnings?.trim()), [items]);

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
    return (
      <div className="rounded-3xl border border-dashed border-white/10 p-12 text-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  // Locked state — client has no active assignments. Replaces the old
  // "no supplements assigned" empty card with the 3-tier Coach-Curated
  // Protocols teaser. Single primary action per card (WhatsApp request),
  // calm coach-led copy, no marketplace feel. After admin activation,
  // this entire branch disappears and the regular protocol view renders.
  if (items.length === 0) {
    return <CoachProtocols mode="dashboard" />;
  }

  return (
    <div className="space-y-5">
      {/* Today hero */}
      <div className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/10 to-transparent p-5">
        <div className="flex items-start justify-between flex-wrap gap-3 mb-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary mb-1.5 inline-flex items-center gap-1.5">
              <Sparkles size={11} /> Today
            </p>
            <h3 className="font-display text-xl font-semibold leading-tight">
              {todays.length} supplement{todays.length === 1 ? "" : "s"} for {mode === "training" ? "a training day" : "a rest day"}
            </h3>
          </div>
          <div className="flex bg-white/5 rounded-xl p-1 gap-1">
            <button
              onClick={() => setMode("training")}
              className={`text-xs px-3 h-8 rounded-lg inline-flex items-center gap-1.5 transition ${
                mode === "training" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="toggle-training-day"
            >
              <Dumbbell size={12} /> Training
            </button>
            <button
              onClick={() => setMode("rest")}
              className={`text-xs px-3 h-8 rounded-lg inline-flex items-center gap-1.5 transition ${
                mode === "rest" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
              data-testid="toggle-rest-day"
            >
              <Moon size={12} /> Rest
            </button>
          </div>
        </div>

        {todays.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">
            Nothing to take on a {mode === "training" ? "training" : "rest"} day. Switch the toggle to see the other.
          </p>
        ) : (
          <div className="space-y-4">
            {(Array.from(grouped.keys()) as SupplementTiming[]).map((slot) => (
              <div key={slot}>
                <p className="text-[10px] uppercase tracking-wider text-primary/80 mb-2 inline-flex items-center gap-1.5">
                  <SlotIcon slot={slot} /> {SUPPLEMENT_TIMING_LABELS_EN[slot]}
                </p>
                <ul className="space-y-2">
                  {grouped.get(slot)!.map((it) => (
                    <SupplementRow key={it.id} item={it} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {shareUrl && (
          <div className="pt-4 mt-4 border-t border-white/5">
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 h-10 rounded-xl bg-[#25D366]/15 text-[#25D366] hover:bg-[#25D366]/25 text-sm font-semibold"
              data-testid="link-share-supplements-whatsapp"
            >
              <SiWhatsapp size={14} /> Share my protocol on WhatsApp
            </a>
          </div>
        )}
      </div>

      {/* Warnings banner */}
      {hasWarnings && (
        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={16} className="text-amber-300 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-amber-200">Important warnings</p>
              <p className="text-xs text-amber-200/80 mt-0.5">
                Some of your supplements have safety notes. Read them in the full protocol below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Full protocol */}
      <div className="rounded-3xl border border-white/5 bg-card/40 p-5">
        <h3 className="font-display text-lg font-semibold mb-3 inline-flex items-center gap-2">
          <Pill size={16} className="text-primary" /> Full protocol
          <Badge variant="outline" className="text-[10px]">{items.length}</Badge>
        </h3>
        <ul className="space-y-2">
          {items.map((it) => (
            <SupplementRow key={`all-${it.id}`} item={it} expanded />
          ))}
        </ul>
      </div>
    </div>
  );
}

function SupplementRow({ item, expanded = false }: { item: ClientSupplement; expanded?: boolean }) {
  return (
    <li
      className="rounded-2xl border border-white/5 bg-white/[0.02] p-3"
      data-testid={`row-my-supp-${item.id}`}
    >
      <div className="flex items-start gap-3">
        <div className="size-9 rounded-xl bg-primary/10 text-primary inline-flex items-center justify-center shrink-0">
          <Pill size={15} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <p className="font-semibold leading-tight">{item.name}</p>
              {item.brand && <p className="text-[11px] text-muted-foreground mt-0.5">{item.brand}</p>}
            </div>
            <Badge variant="outline" className="text-[10px] shrink-0">
              {item.dosage}{item.unit}
            </Badge>
          </div>
          {expanded && item.timings.length > 0 && (
            <p className="text-xs text-muted-foreground mt-1.5">
              {item.timings.map((t) => SUPPLEMENT_TIMING_LABELS_EN[t as keyof typeof SUPPLEMENT_TIMING_LABELS_EN] || t).join(" · ")}
            </p>
          )}
          {(item.trainingDayOnly || item.restDayOnly) && (
            <Badge variant="outline" className="text-[9px] mt-1.5">
              {item.trainingDayOnly ? "Training days only" : "Rest days only"}
            </Badge>
          )}
          {item.notes && <p className="text-xs text-muted-foreground mt-1.5">{item.notes}</p>}
          {item.warnings && (
            <p className="text-xs text-amber-300/90 mt-1.5 inline-flex items-start gap-1.5">
              <AlertTriangle size={11} className="shrink-0 mt-0.5" />
              <span>{item.warnings}</span>
            </p>
          )}
        </div>
      </div>
    </li>
  );
}

function SlotIcon({ slot }: { slot: SupplementTiming }) {
  if (slot === "morning" || slot === "with_breakfast") return <Sun size={11} />;
  if (slot === "before_bed") return <Moon size={11} />;
  if (slot === "pre_workout" || slot === "intra_workout" || slot === "post_workout") return <Dumbbell size={11} />;
  return <MoreHorizontal size={11} />;
}

function filterForDay(items: ClientSupplement[], mode: DayMode): ClientSupplement[] {
  return items
    .filter((i) => i.status === "active")
    .filter((i) => {
      if (mode === "training" && i.restDayOnly) return false;
      if (mode === "rest" && i.trainingDayOnly) return false;
      return true;
    });
}

function groupByTiming(items: ClientSupplement[]): Map<SupplementTiming, ClientSupplement[]> {
  const out = new Map<SupplementTiming, ClientSupplement[]>();
  for (const it of items) {
    const slots = (it.timings.length > 0 ? it.timings : ["anytime"]) as SupplementTiming[];
    for (const slot of slots) {
      const arr = out.get(slot) ?? [];
      arr.push(it);
      out.set(slot, arr);
    }
  }
  // Stable sort by canonical slot order.
  const order = SUPPLEMENT_TIMING_ORDER as Record<string, number>;
  return new Map(
    Array.from(out.entries()).sort(
      (a, b) => (order[a[0]] ?? 99) - (order[b[0]] ?? 99),
    ),
  );
}
