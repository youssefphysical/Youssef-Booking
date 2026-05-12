import { CheckCircle2, Crown, Gem } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useTranslation } from "@/i18n";
import { VIP_TIER_LABELS, normaliseTier } from "@shared/schema";

type Size = "xs" | "sm" | "md" | "lg";

type VerifiedBadgeProps = {
  size?: Size;
  showTooltip?: boolean;
  className?: string;
  testId?: string;
};

const SIZE_PX: Record<Size, number> = {
  xs: 12,
  sm: 14,
  md: 18,
  lg: 22,
};

/**
 * Premium blue verified check, styled like the well-known social-network
 * marks. Use next to a client name to indicate the profile is verified
 * (profile picture set + InBody on file or completed sessions tracked).
 */
export function VerifiedBadge({
  size = "sm",
  showTooltip = true,
  className,
  testId = "badge-verified",
}: VerifiedBadgeProps) {
  const { t } = useTranslation();
  const px = SIZE_PX[size];
  const node = (
    <span
      data-testid={testId}
      aria-label={t("verified.label")}
      className={cn(
        "inline-flex items-center justify-center text-sky-400 drop-shadow-[0_0_6px_rgba(56,189,248,0.65)] transition-transform hover:scale-110",
        className,
      )}
    >
      {/* Stroke uses the theme background HSL so the verified badge always
          reads as "punched out" of the surface regardless of future theme tweaks. */}
      <CheckCircle2 size={px} strokeWidth={2.5} fill="currentColor" stroke="hsl(var(--background))" />
    </span>
  );

  if (!showTooltip) return node;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs leading-relaxed">
          {t("verified.tooltip")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================================================
// TIER BADGE — premium pill with glow for Elite / Pro Elite / Diamond Elite
// ============================================================================

type TierBadgeProps = {
  tier: string | null | undefined;
  size?: "xs" | "sm" | "md";
  className?: string;
  testId?: string;
};

const TIER_STYLES: Record<
  string,
  { ring: string; bg: string; text: string; glow: string; icon: typeof Crown }
> = {
  elite: {
    ring: "ring-1 ring-cyan-300/40",
    bg: "bg-gradient-to-br from-cyan-400/20 via-cyan-300/10 to-transparent",
    text: "text-cyan-200",
    glow: "shadow-[0_0_18px_-6px_rgba(94,231,255,0.45)]",
    icon: Crown,
  },
  pro_elite: {
    ring: "ring-1 ring-fuchsia-300/40",
    bg: "bg-gradient-to-br from-fuchsia-400/20 via-fuchsia-300/10 to-transparent",
    text: "text-fuchsia-200",
    glow: "shadow-[0_0_20px_-6px_rgba(232,121,249,0.6)]",
    icon: Gem,
  },
  diamond_elite: {
    ring: "ring-1 ring-cyan-300/50",
    bg: "bg-gradient-to-br from-cyan-300/25 via-sky-300/10 to-transparent",
    text: "text-cyan-100",
    glow: "shadow-[0_0_24px_-6px_rgba(103,232,249,0.7)]",
    icon: Gem,
  },
  vip: {
    ring: "ring-1 ring-cyan-300/40",
    bg: "bg-gradient-to-br from-cyan-400/20 via-cyan-300/10 to-transparent",
    text: "text-cyan-200",
    glow: "shadow-[0_0_18px_-6px_rgba(94,231,255,0.45)]",
    icon: Crown,
  },
};

const TIER_SIZE: Record<NonNullable<TierBadgeProps["size"]>, { pad: string; icon: number; text: string }> = {
  xs: { pad: "px-1.5 py-0.5", icon: 9, text: "text-[9px]" },
  sm: { pad: "px-2 py-0.5", icon: 11, text: "text-[10px]" },
  md: { pad: "px-2.5 py-1", icon: 13, text: "text-[11px]" },
};

/**
 * Premium tier pill — only renders for Elite / Pro Elite / Diamond Elite.
 * Lower tiers return null to avoid visual noise.
 */
export function TierBadge({ tier, size = "sm", className, testId = "badge-tier" }: TierBadgeProps) {
  const t = normaliseTier(tier);
  const style = TIER_STYLES[t];
  if (!style) return null;
  const sz = TIER_SIZE[size];
  const Icon = style.icon;
  return (
    <span
      data-testid={testId}
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-bold uppercase tracking-wider",
        style.ring,
        style.bg,
        style.text,
        style.glow,
        sz.pad,
        sz.text,
        className,
      )}
      title={`${VIP_TIER_LABELS[t]} tier`}
    >
      <Icon size={sz.icon} strokeWidth={2.5} />
      {VIP_TIER_LABELS[t]}
    </span>
  );
}
