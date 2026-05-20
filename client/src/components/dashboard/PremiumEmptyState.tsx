import type { ReactNode } from "react";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

interface PremiumEmptyStateProps {
  icon?: ReactNode;
  title: string;
  body?: string;
  ctaLabel?: string;
  ctaHref?: string;
  ctaOnClick?: () => void;
  /** Custom CTA node (e.g. a WhatsAppButton). Replaces ctaLabel/ctaHref. */
  cta?: ReactNode;
  className?: string;
  testId?: string;
}

/**
 * Shared empty-state shell (Task #32, brief §36).
 * Premium dark-luxury look — tron-card with subtle cyan hairline, no heavy
 * animation. Used everywhere a section has no data yet (no bookings, no
 * InBody scan, nutrition inactive, etc.) so the language stays consistent.
 */
export function PremiumEmptyState({
  icon,
  title,
  body,
  ctaLabel,
  ctaHref,
  ctaOnClick,
  cta,
  className,
  testId,
}: PremiumEmptyStateProps) {
  const renderedCta = cta ?? (
    ctaLabel && (ctaHref || ctaOnClick) ? (
      ctaHref ? (
        <Link
          href={ctaHref}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          data-testid={testId ? `${testId}-cta` : undefined}
        >
          {ctaLabel}
        </Link>
      ) : (
        <button
          type="button"
          onClick={ctaOnClick}
          className="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          data-testid={testId ? `${testId}-cta` : undefined}
        >
          {ctaLabel}
        </button>
      )
    ) : null
  );

  return (
    <div
      className={cn(
        "tron-card rounded-2xl p-6 sm:p-8 text-center flex flex-col items-center gap-3",
        className,
      )}
      data-testid={testId}
    >
      {icon && (
        <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center">
          {icon}
        </div>
      )}
      <h3 className="font-display font-bold text-lg sm:text-xl text-foreground">
        {title}
      </h3>
      {body && (
        <p className="text-sm text-muted-foreground max-w-prose">{body}</p>
      )}
      {renderedCta && <div className="mt-1.5">{renderedCta}</div>}
    </div>
  );
}

export default PremiumEmptyState;
