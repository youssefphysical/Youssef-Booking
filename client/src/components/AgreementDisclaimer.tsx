import { Link } from "wouter";
import { Info } from "lucide-react";
import { useTranslation } from "@/i18n";

interface AgreementDisclaimerProps {
  type: string;
  className?: string;
}

/**
 * Inline disclaimer banner used on nutrition / recovery / emergency-cancel
 * flows. Always visible (not hidden in a tooltip) and links to the full
 * agreements log so the user can review or re-accept later.
 */
export function AgreementDisclaimer({ type, className }: AgreementDisclaimerProps) {
  const { t } = useTranslation();
  return (
    <div
      className={`flex gap-3 p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs leading-relaxed ${className ?? ""}`}
      data-testid={`disclaimer-${type}`}
    >
      <Info className="text-cyan-400 shrink-0 mt-0.5" size={14} />
      <div className="text-cyan-100/80 space-y-1">
        <p>{t(`agreements.text.${type}`, "")}</p>
        <Link href="/agreements" className="text-cyan-300 underline-offset-2 hover:underline" data-testid={`link-disclaimer-${type}`}>
          {t("agreements.viewFullPolicy", "View full policy")}
        </Link>
      </div>
    </div>
  );
}
