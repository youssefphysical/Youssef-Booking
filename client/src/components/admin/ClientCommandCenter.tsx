import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Minus,
  PauseCircle,
  Scale,
  Sparkles,
  TrendingDown,
  TrendingUp,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AdminCard,
  AdminEmptyState,
  AdminSectionTitle,
} from "@/components/admin/primitives";
import type {
  AttentionItem,
  ClientIntelligence,
  MomentumState,
  RecentChangeKind,
} from "@shared/schema";

const MOMENTUM_META: Record<
  MomentumState,
  { label: string; tone: string; bg: string; icon: React.ReactNode }
> = {
  improving: {
    label: "Improving",
    tone: "text-emerald-300",
    bg: "bg-emerald-400/10 border-emerald-300/20",
    icon: <TrendingUp size={13} />,
  },
  stable: {
    label: "Stable",
    tone: "text-sky-300",
    bg: "bg-sky-400/10 border-sky-300/20",
    icon: <Minus size={13} />,
  },
  slowing: {
    label: "Slowing",
    tone: "text-cyan-300",
    bg: "bg-cyan-400/10 border-cyan-300/20",
    icon: <TrendingDown size={13} />,
  },
  inactive: {
    label: "Inactive",
    tone: "text-zinc-300",
    bg: "bg-zinc-400/10 border-zinc-300/20",
    icon: <PauseCircle size={13} />,
  },
  inconsistent: {
    label: "Inconsistent",
    tone: "text-rose-300",
    bg: "bg-rose-400/10 border-rose-300/20",
    icon: <Activity size={13} />,
  },
};

const SEVERITY_META: Record<
  AttentionItem["severity"],
  { dot: string; ring: string; tone: string }
> = {
  critical: { dot: "bg-rose-400", ring: "ring-rose-400/30", tone: "text-rose-200" },
  warning: { dot: "bg-cyan-400", ring: "ring-cyan-400/30", tone: "text-cyan-200" },
  watch: { dot: "bg-sky-400", ring: "ring-sky-400/30", tone: "text-sky-200" },
  info: { dot: "bg-zinc-400", ring: "ring-zinc-400/30", tone: "text-zinc-200" },
};

const CHANGE_META: Record<RecentChangeKind, { icon: React.ReactNode; tone: string }> = {
  session_completed: { icon: <CheckCircle2 size={12} />, tone: "text-emerald-300" },
  session_missed: { icon: <XCircle size={12} />, tone: "text-rose-300" },
  checkin: { icon: <ClipboardList size={12} />, tone: "text-sky-300" },
  body_metric: { icon: <Scale size={12} />, tone: "text-cyan-300" },
  package: { icon: <Sparkles size={12} />, tone: "text-cyan-300" },
  coach_note: { icon: <Activity size={12} />, tone: "text-violet-300" },
  renewal: { icon: <Sparkles size={12} />, tone: "text-cyan-300" },
};

function SnapshotChip({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: React.ReactNode;
  tone?: "default" | "good" | "warn" | "bad" | "muted";
}) {
  const toneCls =
    tone === "good"
      ? "text-emerald-200"
      : tone === "warn"
        ? "text-cyan-200"
        : tone === "bad"
          ? "text-rose-200"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-foreground";
  return (
    <div className="rounded-lg border border-white/5 bg-white/[0.02] px-2.5 py-2 min-w-0">
      <div className="flex items-center gap-1 text-[9.5px] uppercase tracking-wide text-muted-foreground/80">
        {icon}
        <span className="truncate">{label}</span>
      </div>
      <div className={cn("font-display font-bold text-[15px] tabular-nums leading-tight mt-0.5", toneCls)}>
        {value}
      </div>
      {hint && (
        <div className="text-[10px] text-muted-foreground/70 mt-0.5 truncate">{hint}</div>
      )}
    </div>
  );
}

export function ClientCommandCenter({
  clientId,
  onJump,
}: {
  clientId: number;
  onJump: (tab: string) => void;
}) {
  const { data, isLoading } = useQuery<ClientIntelligence>({
    queryKey: ["/api/admin/clients", clientId, "intelligence"],
    staleTime: 60_000,
  });

  if (isLoading || !data) {
    return (
      <AdminCard testId="cmd-center-loading">
        <div className="h-32 admin-shimmer rounded-lg" />
      </AdminCard>
    );
  }

  const { snapshot, momentum, attentionItems, recentChanges } = data;
  const m = MOMENTUM_META[momentum.state];

  const sessionsValue =
    snapshot.sessionsLeft != null
      ? `${snapshot.sessionsLeft}${snapshot.sessionsTotal != null ? `/${snapshot.sessionsTotal}` : ""}`
      : "—";
  const sessionsTone =
    snapshot.sessionsLeft == null
      ? "muted"
      : snapshot.sessionsLeft === 0
        ? "bad"
        : snapshot.sessionsLeft <= 2
          ? "warn"
          : "default";

  const expiryValue =
    snapshot.packageDaysLeft == null
      ? "—"
      : snapshot.packageDaysLeft < 0
        ? `${-snapshot.packageDaysLeft}d ago`
        : `${snapshot.packageDaysLeft}d`;
  const expiryTone =
    snapshot.packageDaysLeft == null
      ? "muted"
      : snapshot.packageDaysLeft < 0
        ? "bad"
        : snapshot.packageDaysLeft <= 7
          ? "warn"
          : "default";

  const attendanceValue =
    snapshot.attendanceRate30d != null ? `${snapshot.attendanceRate30d}%` : "—";
  const attendanceTone =
    snapshot.attendanceRate30d == null
      ? "muted"
      : snapshot.attendanceRate30d >= 85
        ? "good"
        : snapshot.attendanceRate30d >= 65
          ? "warn"
          : "bad";

  const adherenceValue = `${snapshot.checkinAdherence4w ?? 0}%`;
  const adherenceTone =
    snapshot.checkinAdherence4w == null
      ? "muted"
      : snapshot.checkinAdherence4w >= 75
        ? "good"
        : snapshot.checkinAdherence4w >= 50
          ? "warn"
          : "bad";

  const weightValue = snapshot.weightLatest != null ? `${snapshot.weightLatest}` : "—";
  const weightHint =
    snapshot.weightDelta30d != null
      ? `${snapshot.weightDelta30d > 0 ? "+" : ""}${snapshot.weightDelta30d}kg / 30d`
      : "kg";

  const nextValue = snapshot.nextBookingDate
    ? format(new Date(snapshot.nextBookingDate), "MMM d")
    : "—";
  const nextHint = snapshot.nextBookingTimeSlot ?? "Not scheduled";

  return (
    <div className="space-y-3" data-testid="client-command-center">
      {/* Snapshot strip + momentum */}
      <AdminCard testId="cmd-snapshot">
        <div className="flex items-center justify-between mb-2 gap-2">
          <AdminSectionTitle title="Snapshot" />
          <motion.span
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-medium",
              m.bg,
              m.tone,
            )}
            data-testid={`momentum-${momentum.state}`}
            title={momentum.reason}
          >
            {m.icon}
            <span>{m.label}</span>
          </motion.span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <SnapshotChip
            label="Sessions left"
            value={sessionsValue}
            icon={<Activity size={10} />}
            tone={sessionsTone as any}
          />
          <SnapshotChip
            label="Expires in"
            value={expiryValue}
            icon={<Calendar size={10} />}
            tone={expiryTone as any}
          />
          <SnapshotChip
            label="Attendance 30d"
            value={attendanceValue}
            icon={<CheckCircle2 size={10} />}
            tone={attendanceTone as any}
          />
          <SnapshotChip
            label="Check-ins 4w"
            value={adherenceValue}
            icon={<ClipboardList size={10} />}
            tone={adherenceTone as any}
          />
          <SnapshotChip
            label="Weight"
            value={weightValue}
            hint={weightHint}
            icon={<Scale size={10} />}
            tone={
              snapshot.weightDelta30d == null
                ? "default"
                : snapshot.weightDelta30d < 0
                  ? "good"
                  : "warn"
            }
          />
          <SnapshotChip
            label="Next session"
            value={nextValue}
            hint={nextHint}
            icon={<Calendar size={10} />}
          />
        </div>
        <p className="text-[10.5px] text-muted-foreground/80 mt-2 leading-relaxed">
          <span className="text-foreground/80">Momentum:</span> {momentum.reason}
        </p>
      </AdminCard>

      {/* Attention + Recent changes side-by-side on lg, stacked on mobile */}
      <div className="grid lg:grid-cols-2 gap-3">
        <AdminCard testId="cmd-attention">
          <div className="flex items-center justify-between mb-3 sm:mb-4 gap-3">
            <h3 className="font-display font-bold text-[15px] sm:text-lg truncate">
              Attention needed
            </h3>
            {attentionItems.length > 0 && (
              <span className="text-[10.5px] px-2 py-0.5 rounded-full bg-white/5 text-muted-foreground tabular-nums shrink-0">
                {attentionItems.length}
              </span>
            )}
          </div>
          {attentionItems.length === 0 ? (
            <AdminEmptyState
              icon={<CheckCircle2 size={18} />}
              title="All clear"
              body="No urgent items right now."
            />
          ) : (
            <ul className="space-y-1.5">
              {attentionItems.map((item) => {
                const sm = SEVERITY_META[item.severity];
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => onJump(item.tab)}
                      className={cn(
                        "w-full text-start flex items-start gap-2.5 px-2.5 py-2 rounded-lg border border-white/5 bg-white/[0.02]",
                        "hover-elevate active-elevate-2 transition-colors",
                      )}
                      data-testid={`attention-${item.id}`}
                    >
                      <span
                        className={cn(
                          "mt-1 w-1.5 h-1.5 rounded-full ring-2 shrink-0",
                          sm.dot,
                          sm.ring,
                        )}
                      />
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-[12.5px] font-medium leading-tight", sm.tone)}>
                          {item.title}
                        </p>
                        <p className="text-[10.5px] text-muted-foreground mt-0.5 line-clamp-1">
                          {item.body}
                        </p>
                      </div>
                      <ChevronRight
                        size={14}
                        className="text-muted-foreground/60 mt-0.5 shrink-0 rtl:rotate-180"
                      />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </AdminCard>

        <AdminCard testId="cmd-recent">
          <AdminSectionTitle title="Recent changes" />
          {recentChanges.length === 0 ? (
            <AdminEmptyState
              icon={<Activity size={18} />}
              title="No recent activity"
              body="Last 14 days will appear here."
            />
          ) : (
            <ul className="space-y-1">
              {recentChanges.map((c) => {
                const cm = CHANGE_META[c.kind];
                return (
                  <li
                    key={c.id}
                    className="flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-white/[0.03]"
                    data-testid={`change-${c.id}`}
                  >
                    <span className={cn("shrink-0", cm.tone)}>{cm.icon}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[12px] leading-tight truncate">
                        {c.label}
                        {c.sublabel && (
                          <span className="text-muted-foreground"> · {c.sublabel}</span>
                        )}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground/70 tabular-nums shrink-0">
                      {formatDistanceToNow(new Date(c.when), { addSuffix: true })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </AdminCard>
      </div>
    </div>
  );
}
