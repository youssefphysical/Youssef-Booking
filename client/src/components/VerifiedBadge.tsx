import { CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type VerifiedBadgeProps = {
  size?: "xs" | "sm" | "md" | "lg";
  showTooltip?: boolean;
  className?: string;
  testId?: string;
};

const SIZE_PX: Record<NonNullable<VerifiedBadgeProps["size"]>, number> = {
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
  const px = SIZE_PX[size];
  const node = (
    <span
      data-testid={testId}
      aria-label="Verified profile"
      className={cn(
        "inline-flex items-center justify-center text-sky-400 drop-shadow-[0_0_4px_rgba(56,189,248,0.55)]",
        className,
      )}
    >
      <CheckCircle2 size={px} strokeWidth={2.5} fill="currentColor" stroke="#0b1220" />
    </span>
  );

  if (!showTooltip) return node;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{node}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-[220px] text-xs leading-relaxed">
          Verified profile — picture uploaded and InBody / completed session on file.
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
