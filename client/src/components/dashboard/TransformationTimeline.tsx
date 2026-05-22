import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  Map as MapIcon,
  Sparkles,
  Flame,
  Dumbbell,
  TrendingUp,
  Trophy,
  Check,
  Circle,
  Dot,
} from "lucide-react";
import { CyanHairline } from "@/components/ui/CyanHairline";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBookings } from "@/hooks/use-bookings";
import { useInbodyRecords } from "@/hooks/use-inbody";
import { useProgressPhotos } from "@/hooks/use-progress";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/i18n";
import type {
  Booking,
  BookingWithUser,
  InbodyRecord,
  ProgressPhoto,
} from "@shared/schema";

type AnyBooking = Booking | BookingWithUser;

export interface Milestone {
  week: number;
  focusKey: string;
  focusFallback: string;
  iconKey: "foundation" | "form" | "strength" | "composition" | "transformation";
}

export const TIMELINE_MILESTONES: Milestone[] = [
  { week: 1, focusKey: "dashboard.timeline.focus.foundation", focusFallback: "Foundation", iconKey: "foundation" },
  { week: 4, focusKey: "dashboard.timeline.focus.form", focusFallback: "Form mastery", iconKey: "form" },
  { week: 8, focusKey: "dashboard.timeline.focus.strength", focusFallback: "Strength jumps", iconKey: "strength" },
  { week: 12, focusKey: "dashboard.timeline.focus.composition", focusFallback: "Composition shift", iconKey: "composition" },
  { week: 24, focusKey: "dashboard.timeline.focus.transformation", focusFallback: "Transformation", iconKey: "transformation" },
];

const ICONS = {
  foundation: Sparkles,
  form: Dumbbell,
  strength: Flame,
  composition: TrendingUp,
  transformation: Trophy,
} as const;

// ---------------------------------------------------------------------
// Pure helpers (exported for testability).
// ---------------------------------------------------------------------

/**
 * Compute current week index (1-based) given the anchor date.
 * Anchor = firstSession date if any completed sessions exist, else
 * account creation date. Returns 0 when no anchor (brand-new client).
 */
export function computeCurrentWeek(
  anchor: Date | null,
  now: Date = new Date(),
): number {
  if (!anchor) return 0;
  const ms = now.getTime() - anchor.getTime();
  if (ms < 0) return 1;
  return Math.floor(ms / (7 * 86400_000)) + 1;
}

/**
 * Resolve the journey anchor: first completed session date, else account
 * creation date, else null.
 */
export function resolveJourneyAnchor(
  bookings: AnyBooking[],
  accountCreatedAt: string | Date | null | undefined,
): Date | null {
  const completed = bookings
    .filter((b) => (b.status ?? "").toLowerCase() === "completed" && b.date)
    .map((b) => new Date(`${b.date}T${b.timeSlot || "00:00"}:00+04:00`))
    .filter((d) => !Number.isNaN(d.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  if (completed.length > 0) return completed[0];
  if (accountCreatedAt) {
    const d = new Date(accountCreatedAt);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/**
 * Per-milestone data: status + counts of what's been logged in
 * [milestone.week, nextMilestone.week) window from the anchor.
 */
export interface MilestoneNode {
  milestone: Milestone;
  status: "completed" | "now" | "upcoming";
  sessions: number;
  inbodyCount: number;
  photoCount: number;
}

export function buildTimelineNodes(args: {
  anchor: Date | null;
  currentWeek: number;
  bookings: AnyBooking[];
  inbody: InbodyRecord[];
  photos: ProgressPhoto[];
}): MilestoneNode[] {
  const { anchor, currentWeek, bookings, inbody, photos } = args;
  return TIMELINE_MILESTONES.map((m, i) => {
    const next = TIMELINE_MILESTONES[i + 1];
    const startWeek = m.week;
    const endWeek = next ? next.week : Number.POSITIVE_INFINITY;

    let status: MilestoneNode["status"];
    if (!anchor || currentWeek === 0) {
      status = "upcoming";
    } else if (currentWeek >= startWeek && currentWeek < endWeek) {
      status = "now";
    } else if (currentWeek >= endWeek) {
      status = "completed";
    } else {
      status = "upcoming";
    }

    let sessions = 0;
    let inbodyCount = 0;
    let photoCount = 0;

    if (anchor) {
      const startMs = anchor.getTime() + (startWeek - 1) * 7 * 86400_000;
      const endMs = Number.isFinite(endWeek)
        ? anchor.getTime() + (endWeek - 1) * 7 * 86400_000
        : Number.POSITIVE_INFINITY;

      for (const b of bookings) {
        if ((b.status ?? "").toLowerCase() !== "completed" || !b.date) continue;
        const t = new Date(`${b.date}T${b.timeSlot || "00:00"}:00+04:00`).getTime();
        if (t >= startMs && t < endMs) sessions += 1;
      }
      for (const r of inbody) {
        const ts = r.recordedAt ? new Date(r.recordedAt).getTime() : 0;
        if (ts >= startMs && ts < endMs) inbodyCount += 1;
      }
      for (const p of photos) {
        const ts = p.recordedAt ? new Date(p.recordedAt).getTime() : 0;
        if (ts >= startMs && ts < endMs) photoCount += 1;
      }
    }

    return { milestone: m, status, sessions, inbodyCount, photoCount };
  });
}

// ---------------------------------------------------------------------
// UI
// ---------------------------------------------------------------------

export function TransformationTimeline({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [open, setOpen] = useState(false);

  const { data: bookings = [] } = useBookings({ userId });
  const { data: inbody = [] } = useInbodyRecords({ userId });
  const { data: photos = [] } = useProgressPhotos({ userId });

  const { anchor, currentWeek, nodes, isPreSession } = useMemo(() => {
    const anchor = resolveJourneyAnchor(
      bookings as AnyBooking[],
      user?.createdAt ?? null,
    );
    const currentWeek = computeCurrentWeek(anchor);
    const nodes = buildTimelineNodes({
      anchor,
      currentWeek,
      bookings: bookings as AnyBooking[],
      inbody: inbody as InbodyRecord[],
      photos: photos as ProgressPhoto[],
    });
    const hasCompleted = (bookings as AnyBooking[]).some(
      (b) => (b.status ?? "").toLowerCase() === "completed",
    );
    return { anchor, currentWeek, nodes, isPreSession: !hasCompleted };
  }, [bookings, inbody, photos, user?.createdAt]);

  return (
    <section
      className="mb-6"
      data-testid="section-transformation-timeline"
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-3 rounded-2xl border border-white/[0.08] bg-card/40 px-4 py-3 text-sm font-semibold text-foreground/85 hover:border-cyan-400/30 transition-colors"
        aria-expanded={open}
        data-testid="button-timeline-toggle"
      >
        <span className="flex items-center gap-2">
          <MapIcon size={14} className="text-cyan-300" />
          {t("dashboard.timeline.title", "Your Journey")}
          {!isPreSession && currentWeek > 0 && (
            <span
              className="ml-1 inline-flex items-center rounded-full bg-cyan-500/10 text-cyan-200 text-[10px] uppercase tracking-wider px-2 py-0.5 border border-cyan-400/25"
              data-testid="badge-timeline-week"
            >
              {t("dashboard.timeline.weekBadge", "Week {n}").replace(
                "{n}",
                String(currentWeek),
              )}
            </span>
          )}
        </span>
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>

      {open && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="relative mt-3 overflow-hidden rounded-3xl border border-white/[0.08] bg-card/40 p-5"
        >
          <CyanHairline />
          {isPreSession ? (
            <div className="rounded-2xl border border-dashed border-cyan-400/20 bg-cyan-500/[0.04] p-5 text-sm text-foreground/80">
              {t(
                "dashboard.timeline.empty",
                "Your transformation starts after your first session — book one today.",
              )}
            </div>
          ) : (
            <TimelineRail nodes={nodes} t={t} />
          )}
        </motion.div>
      )}
    </section>
  );
}

function TimelineRail({
  nodes,
  t,
}: {
  nodes: MilestoneNode[];
  t: (key: string, fb?: string) => string;
}) {
  return (
    <>
      {/* Mobile: vertical rail */}
      <div className="sm:hidden" data-testid="timeline-rail-mobile">
        <ol className="relative pl-6 space-y-5">
          <span
            aria-hidden
            className="absolute left-2 top-1 bottom-1 w-px bg-gradient-to-b from-cyan-400/40 via-cyan-400/15 to-transparent"
          />
          {nodes.map((n) => (
            <TimelineNodeVertical key={n.milestone.week} node={n} t={t} />
          ))}
        </ol>
      </div>
      {/* sm+ : horizontal rail */}
      <div
        className="hidden sm:block"
        data-testid="timeline-rail"
      >
        <div className="relative">
          <span
            aria-hidden
            className="absolute left-3 right-3 top-4 h-px bg-gradient-to-r from-cyan-400/15 via-cyan-400/40 to-cyan-400/15"
          />
          <ol className="relative grid grid-cols-5 gap-2">
            {nodes.map((n) => (
              <TimelineNodeHorizontal key={n.milestone.week} node={n} t={t} />
            ))}
          </ol>
        </div>
      </div>
    </>
  );
}

function NodeBadge({ status }: { status: MilestoneNode["status"] }) {
  if (status === "completed") {
    return (
      <span
        className="grid h-8 w-8 place-items-center rounded-full border border-cyan-400/60 bg-cyan-500/15 text-cyan-200 shadow-[0_0_12px_-2px_hsl(183_100%_60%/0.6)]"
        aria-label="completed"
      >
        <Check size={14} />
      </span>
    );
  }
  if (status === "now") {
    return (
      <span
        className="grid h-8 w-8 place-items-center rounded-full border-2 border-cyan-300 bg-cyan-500/20 text-cyan-100 animate-pulse"
        aria-label="now"
      >
        <Dot size={20} />
      </span>
    );
  }
  return (
    <span
      className="grid h-8 w-8 place-items-center rounded-full border border-white/15 bg-white/[0.03] text-white/40"
      aria-label="upcoming"
    >
      <Circle size={10} />
    </span>
  );
}

function TimelineNodeHorizontal({
  node,
  t,
}: {
  node: MilestoneNode;
  t: (key: string, fb?: string) => string;
}) {
  const Icon = ICONS[node.milestone.iconKey];
  return (
    <li className="flex flex-col items-center text-center" data-testid={`timeline-node-${node.milestone.week}`}>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="group flex flex-col items-center gap-1.5 outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 rounded-2xl px-1 py-2"
            data-testid={`button-timeline-node-${node.milestone.week}`}
          >
            <NodeBadge status={node.status} />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t("dashboard.timeline.weekShort", "Wk {n}").replace(
                "{n}",
                String(node.milestone.week),
              )}
            </span>
            <span className="text-[11px] leading-tight text-foreground/80 flex items-center gap-1">
              <Icon size={10} className="text-cyan-300/70" />
              <span className="truncate max-w-[80px]">
                {t(node.milestone.focusKey, node.milestone.focusFallback)}
              </span>
            </span>
          </button>
        </PopoverTrigger>
        <NodePopoverContent node={node} t={t} />
      </Popover>
    </li>
  );
}

function TimelineNodeVertical({
  node,
  t,
}: {
  node: MilestoneNode;
  t: (key: string, fb?: string) => string;
}) {
  const Icon = ICONS[node.milestone.iconKey];
  return (
    <li className="relative" data-testid={`timeline-node-${node.milestone.week}`}>
      <span className="absolute -left-6 top-0">
        <NodeBadge status={node.status} />
      </span>
      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="w-full text-left rounded-2xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 hover:border-cyan-400/30 transition-colors"
            data-testid={`button-timeline-node-${node.milestone.week}`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {t("dashboard.timeline.weekShort", "Wk {n}").replace(
                  "{n}",
                  String(node.milestone.week),
                )}
              </p>
              {node.status === "now" && (
                <span className="text-[9px] uppercase tracking-wider text-cyan-300 font-semibold">
                  {t("dashboard.timeline.now", "Now")}
                </span>
              )}
            </div>
            <p className="mt-0.5 text-sm font-medium text-foreground/90 flex items-center gap-1.5">
              <Icon size={12} className="text-cyan-300" />
              {t(node.milestone.focusKey, node.milestone.focusFallback)}
            </p>
          </button>
        </PopoverTrigger>
        <NodePopoverContent node={node} t={t} />
      </Popover>
    </li>
  );
}

function NodePopoverContent({
  node,
  t,
}: {
  node: MilestoneNode;
  t: (key: string, fb?: string) => string;
}) {
  return (
    <PopoverContent
      side="top"
      align="center"
      className="w-60 border-cyan-400/20 bg-black/85 backdrop-blur"
      data-testid={`popover-timeline-node-${node.milestone.week}`}
    >
      <p className="text-[10px] uppercase tracking-wider text-cyan-200/80 font-semibold mb-1">
        {t("dashboard.timeline.weekBadge", "Week {n}").replace(
          "{n}",
          String(node.milestone.week),
        )}
      </p>
      <p className="text-sm font-display font-semibold text-foreground mb-3">
        {t(node.milestone.focusKey, node.milestone.focusFallback)}
      </p>
      {node.status === "upcoming" ? (
        <p className="text-xs text-muted-foreground">
          {t(
            "dashboard.timeline.popoverUpcoming",
            "Stay consistent — you'll unlock this milestone soon.",
          )}
        </p>
      ) : (
        <ul className="space-y-1.5 text-xs text-foreground/80">
          <li className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {t("dashboard.timeline.popoverSessions", "Sessions done")}
            </span>
            <span className="tabular-nums font-semibold text-foreground">
              {node.sessions}
            </span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {t("dashboard.timeline.popoverInbody", "InBody scans")}
            </span>
            <span className="tabular-nums font-semibold text-foreground">
              {node.inbodyCount}
            </span>
          </li>
          <li className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">
              {t("dashboard.timeline.popoverPhotos", "Progress photos")}
            </span>
            <span className="tabular-nums font-semibold text-foreground">
              {node.photoCount}
            </span>
          </li>
        </ul>
      )}
    </PopoverContent>
  );
}
