import { useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

interface InfoTipProps {
  title?: string;
  body: string;
  size?: number;
  className?: string;
  testId?: string;
  ariaLabel?: string;
}

/**
 * Premium tap-friendly tooltip (Task #71).
 * Used to demystify nuanced surfaces (Emergency Cancel quota, Elite Score,
 * Package Expiry, Recovery Score, InBody Progress). Wraps Radix Tooltip but
 * uses a controlled `open` state so taps on touch devices toggle the bubble —
 * desktop hover/focus also works via Radix defaults.
 */
export function InfoTip({
  title,
  body,
  size = 12,
  className,
  testId,
  ariaLabel,
}: InfoTipProps) {
  const [open, setOpen] = useState(false);

  // Relies on the app-level <TooltipProvider /> mounted in App.tsx — avoids
  // double-providers nested inside other tooltips (would cause inconsistent
  // delay behavior). Tap-to-toggle via controlled `open` still works.
  return (
    <TooltipPrimitive.Root open={open} onOpenChange={setOpen} delayDuration={120}>
        <TooltipPrimitive.Trigger asChild>
          <button
            type="button"
            aria-label={ariaLabel ?? title ?? "More info"}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setOpen((v) => !v);
            }}
            className={cn(
              "inline-flex items-center justify-center rounded-full text-cyan-300/70 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/40 transition-colors align-middle",
              className,
            )}
            data-testid={testId}
          >
            <Info size={size} />
          </button>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            side="top"
            align="center"
            sideOffset={6}
            collisionPadding={12}
            className="z-50 max-w-[260px] rounded-xl border border-cyan-400/25 bg-[#080808]/95 backdrop-blur px-3 py-2.5 text-xs leading-relaxed text-white/85 shadow-[0_8px_28px_-10px_rgba(94,231,255,0.45)] animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0"
            data-testid={testId ? `${testId}-content` : undefined}
          >
            {title && (
              <div className="text-[10px] uppercase tracking-[0.18em] text-cyan-300 font-semibold mb-1">
                {title}
              </div>
            )}
            <div className="text-white/80">{body}</div>
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
  );
}

export default InfoTip;
