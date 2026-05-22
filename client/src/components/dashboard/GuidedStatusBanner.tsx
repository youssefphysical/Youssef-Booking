import type { ReactNode } from "react";
import { ArrowRight, Clock } from "lucide-react";
import { Link } from "wouter";
import { whatsappUrl, DEFAULT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { useTranslation } from "@/i18n";

export type GuidedStatusStep = {
  key: string;
  label: string;
  state: "done" | "current" | "todo";
};

export type GuidedStatusAction =
  | { kind: "link"; href: string; label: string; testId?: string }
  | { kind: "button"; onClick: () => void; label: string; testId?: string };

export interface GuidedStatusBannerProps {
  eyebrow: string;
  title: string;
  body?: string;
  icon: ReactNode;
  steps?: GuidedStatusStep[];
  etaText?: string;
  primaryAction?: GuidedStatusAction;
  /** Custom help link target. Defaults to trainer WhatsApp. */
  helpHref?: string;
  helpLabel?: string;
  helpTestId?: string;
  /** Visual tone. Cyan = info/progress (default). Amber = warning. */
  tone?: "cyan" | "amber";
  testId?: string;
}

/**
 * Phase 1 UX coordination — shared "guided status" banner shell.
 *
 * Extracted from the verification banner in ClientDashboard so every
 * waiting / blocked / expired surface follows the same
 * Explain → Guide → Action → Confirmation pattern. Always renders a
 * "Message Coach" fallback so a client can never hit a dead end.
 */
export function GuidedStatusBanner({
  eyebrow,
  title,
  body,
  icon,
  steps,
  etaText,
  primaryAction,
  helpHref,
  helpLabel,
  helpTestId,
  tone = "cyan",
  testId,
}: GuidedStatusBannerProps) {
  const { t } = useTranslation();

  const isAmber = tone === "amber";
  const shellClasses = isAmber
    ? "border-amber-400/40 bg-gradient-to-br from-amber-400/[0.10] via-amber-400/[0.04] to-transparent"
    : "border-cyan-500/40 bg-gradient-to-br from-cyan-500/[0.10] via-cyan-500/[0.04] to-transparent";
  const eyebrowClasses = isAmber ? "text-amber-300/90" : "text-cyan-300/90";
  const titleClasses = isAmber ? "text-amber-50" : "text-cyan-50";
  const bodyClasses = isAmber ? "text-amber-100/80" : "text-cyan-100/80";
  const iconWrapClasses = isAmber
    ? "bg-amber-400/15 text-amber-200"
    : "bg-cyan-500/15 text-cyan-300";
  const linkClasses = isAmber
    ? "text-amber-200 hover:text-amber-100"
    : "text-cyan-200 hover:text-cyan-100";
  const etaClasses = isAmber ? "text-amber-100/70" : "text-cyan-100/70";
  const primaryBtnClasses = isAmber
    ? "bg-amber-400/15 border-amber-400/40 text-amber-100 hover:bg-amber-400/25"
    : "bg-cyan-500/15 border-cyan-400/40 text-cyan-100 hover:bg-cyan-500/25";

  const helpTarget = helpHref ?? whatsappUrl(DEFAULT_WHATSAPP_NUMBER);
  const helpText =
    helpLabel ?? t("dashboard.verification.help", "Need help? Message Coach");

  return (
    <div
      className={`mb-6 rounded-2xl border p-5 sm:p-6 ${shellClasses}`}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <div
          className={`size-10 shrink-0 rounded-xl grid place-items-center ${iconWrapClasses}`}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={`text-[10px] uppercase tracking-[0.18em] font-semibold ${eyebrowClasses}`}
          >
            {eyebrow}
          </p>
          <h3
            className={`mt-1 font-display font-bold text-base sm:text-lg leading-snug ${titleClasses}`}
          >
            {title}
          </h3>
          {body && (
            <p
              className={`text-xs sm:text-sm mt-1.5 leading-relaxed ${bodyClasses}`}
            >
              {body}
            </p>
          )}
        </div>
      </div>

      {steps && steps.length > 0 && (
        <ol
          className="mt-5 space-y-2.5"
          aria-label={t("dashboard.verification.progressLabel", "Progress")}
        >
          {steps.map((s) => {
            const isDone = s.state === "done";
            const isCurrent = s.state === "current";
            return (
              <li
                key={s.key}
                className="flex items-center gap-3"
                data-testid={`progress-step-${s.key}`}
                data-state={s.state}
              >
                <span
                  className={[
                    "size-5 shrink-0 grid place-items-center rounded-full border text-[10px] font-bold",
                    isDone
                      ? "bg-cyan-400/20 border-cyan-400/70 text-cyan-200"
                      : isCurrent
                        ? "bg-cyan-400/10 border-cyan-300 text-cyan-200 ring-2 ring-cyan-400/30"
                        : "bg-transparent border-cyan-100/20 text-cyan-100/30",
                  ].join(" ")}
                  aria-hidden="true"
                >
                  {isDone ? "✓" : isCurrent ? "·" : ""}
                </span>
                <span
                  className={[
                    "text-xs sm:text-sm",
                    isDone
                      ? "text-cyan-100/90"
                      : isCurrent
                        ? "text-cyan-50 font-semibold"
                        : "text-cyan-100/40",
                  ].join(" ")}
                >
                  {s.label}
                </span>
                {isCurrent && (
                  <span className="ms-auto text-[10px] uppercase tracking-[0.14em] text-cyan-200/90 font-semibold">
                    {t(
                      "dashboard.verification.progress.currentTag",
                      "In progress",
                    )}
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {etaText && (
        <div className={`mt-4 flex items-center gap-2 text-[11px] ${etaClasses}`}>
          <Clock size={12} className="shrink-0" aria-hidden="true" />
          <span>{etaText}</span>
        </div>
      )}

      {(primaryAction || helpTarget) && (
        <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
          {primaryAction &&
            (primaryAction.kind === "link" ? (
              primaryAction.href.startsWith("http") ? (
                <a
                  href={primaryAction.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${primaryBtnClasses}`}
                  data-testid={primaryAction.testId}
                >
                  {primaryAction.label}
                  <ArrowRight size={12} aria-hidden="true" />
                </a>
              ) : (
                <Link
                  href={primaryAction.href}
                  className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${primaryBtnClasses}`}
                  data-testid={primaryAction.testId}
                >
                  {primaryAction.label}
                  <ArrowRight size={12} aria-hidden="true" />
                </Link>
              )
            ) : (
              <button
                type="button"
                onClick={primaryAction.onClick}
                className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition-colors ${primaryBtnClasses}`}
                data-testid={primaryAction.testId}
              >
                {primaryAction.label}
                <ArrowRight size={12} aria-hidden="true" />
              </button>
            ))}

          <a
            href={helpTarget}
            target="_blank"
            rel="noopener noreferrer"
            className={`inline-flex items-center gap-1.5 text-xs font-semibold transition-colors ${linkClasses}`}
            data-testid={helpTestId ?? "link-guided-banner-help"}
          >
            {helpText}
            <ArrowRight size={12} aria-hidden="true" />
          </a>
        </div>
      )}
    </div>
  );
}

export default GuidedStatusBanner;
