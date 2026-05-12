import { cn } from "@/lib/utils";
import type { ClientHealth, ClientHealthStatus } from "@shared/schema";

const HEALTH_TONE: Record<
  ClientHealthStatus,
  { dot: string; text: string; bg: string; border: string; label: string }
> = {
  healthy: {
    dot: "bg-emerald-400",
    text: "text-emerald-200",
    bg: "bg-emerald-400/10",
    border: "border-emerald-400/20",
    label: "Healthy",
  },
  watch: {
    dot: "bg-cyan-300",
    text: "text-cyan-200",
    bg: "bg-cyan-300/10",
    border: "border-cyan-300/20",
    label: "Watch",
  },
  at_risk: {
    dot: "bg-rose-300",
    text: "text-rose-200",
    bg: "bg-rose-300/10",
    border: "border-rose-300/25",
    label: "Needs attention",
  },
  inactive: {
    dot: "bg-slate-400",
    text: "text-slate-300",
    bg: "bg-slate-400/10",
    border: "border-slate-400/20",
    label: "Inactive",
  },
  new: {
    dot: "bg-sky-300",
    text: "text-sky-200",
    bg: "bg-sky-300/10",
    border: "border-sky-300/20",
    label: "New",
  },
  frozen: {
    dot: "bg-cyan-300",
    text: "text-cyan-200",
    bg: "bg-cyan-300/10",
    border: "border-cyan-300/20",
    label: "Frozen",
  },
  ended: {
    dot: "bg-zinc-500",
    text: "text-zinc-400",
    bg: "bg-zinc-500/10",
    border: "border-zinc-500/20",
    label: "Ended",
  },
};

export function HealthBadge({
  health,
  size = "sm",
  showLabel = true,
}: {
  health?: ClientHealth | null;
  size?: "xs" | "sm";
  showLabel?: boolean;
}) {
  if (!health) return null;
  const tone = HEALTH_TONE[health.status];
  const tooltip = health.signals.length > 0 ? health.signals.join(" · ") : tone.label;
  const dotSize = size === "xs" ? "w-1.5 h-1.5" : "w-2 h-2";
  const padding = size === "xs" ? "px-1.5 h-5 text-[10px]" : "px-2 h-6 text-[11px]";
  return (
    <span
      title={tooltip}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border font-medium whitespace-nowrap",
        tone.bg,
        tone.border,
        tone.text,
        padding,
      )}
      data-testid={`badge-health-${health.status}`}
    >
      <span className={cn("rounded-full", tone.dot, dotSize)} />
      {showLabel && <span>{tone.label}</span>}
    </span>
  );
}
