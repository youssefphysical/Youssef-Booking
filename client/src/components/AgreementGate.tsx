import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ShieldCheck } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";

type AgreementRow = {
  id: number;
  userId: number;
  agreementType: string;
  version: string;
  acceptedAt: string;
};

const LS_POLICY_KEY = "policyAccepted";

export function useAgreements() {
  const { user } = useAuth();
  return useQuery<AgreementRow[]>({
    queryKey: ["/api/agreements"],
    enabled: !!user,
  });
}

export function hasAccepted(
  rows: AgreementRow[] | undefined,
  type: string,
  version: string,
): boolean {
  if (!rows) return false;
  return rows.some((r) => r.agreementType === type && r.version === version);
}

interface AgreementGateProps {
  types: string[];
  version: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAccepted: () => void;
}

/**
 * Modal that blocks the caller's action until the user accepts the specified
 * agreement types at the given version.
 *
 * Behaviour:
 * - Closes immediately on confirm, sets `localStorage.policyAccepted = "true"`
 *   as a fast-path so the modal stays hidden across refreshes.
 * - Fires the server POST in the background to preserve the consent audit
 *   trail (one /api/agreements row per type). Network failure does not block
 *   the UX — the modal still closes.
 * - If `localStorage.policyAccepted` is already set when the gate is asked to
 *   open, it auto-dismisses and fires `onAccepted` so the booking flow can
 *   continue uninterrupted.
 */
export function AgreementGate({
  types,
  version,
  open,
  onOpenChange,
  onAccepted,
}: AgreementGateProps) {
  const { t } = useTranslation();
  const { data: rows } = useAgreements();
  const [checked, setChecked] = useState(false);

  const missing = useMemo(
    () => types.filter((tp) => !hasAccepted(rows, tp, version)),
    [types, version, rows],
  );

  // Fast-path: if user has already accepted (localStorage flag), auto-close
  // and signal acceptance to the parent. Defensive guard against the modal
  // ever re-appearing after a previous acceptance.
  useEffect(() => {
    if (!open) return;
    try {
      if (typeof window !== "undefined" && localStorage.getItem(LS_POLICY_KEY) === "true") {
        onOpenChange(false);
        onAccepted();
      }
    } catch {
      // ignore localStorage access errors (private mode, etc.)
    }
  }, [open, onOpenChange, onAccepted]);

  // Reset checkbox state every time the modal is opened.
  useEffect(() => {
    if (open) setChecked(false);
  }, [open]);

  const accept = useMutation({
    mutationFn: async () => {
      for (const tp of missing) {
        await apiRequest("POST", "/api/agreements", { agreementType: tp, version });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
    },
  });

  const handleConfirm = () => {
    if (!checked) return;
    // 1. Persist client-side flag so the modal never re-opens after refresh.
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(LS_POLICY_KEY, "true");
      }
    } catch {
      // ignore
    }
    // 2. Close immediately — do not wait on the network.
    onOpenChange(false);
    onAccepted();
    // 3. Fire-and-forget the server audit-trail write.
    if (missing.length > 0) {
      accept.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          bg-[#070808] border border-white/[0.08]
          sm:rounded-2xl rounded-2xl
          w-[calc(100vw-1.5rem)] sm:w-full max-w-md
          p-5 sm:p-6 gap-0
          shadow-[0_0_0_1px_rgba(94,231,255,0.06),0_30px_80px_-20px_rgba(0,0,0,0.9)]
        "
        data-testid="dialog-agreement-gate"
      >
        {/* Subtle cyan top hairline accent */}
        <div
          aria-hidden
          className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent"
        />

        <DialogHeader className="space-y-2 text-start">
          <div className="flex items-center gap-2.5">
            <span
              aria-hidden
              className="
                inline-flex h-8 w-8 items-center justify-center
                rounded-full border border-primary/30
                bg-primary/10 text-primary
                shadow-[0_0_18px_-6px_rgba(94,231,255,0.6)]
              "
            >
              <ShieldCheck size={15} strokeWidth={2.2} />
            </span>
            <DialogTitle className="text-[17px] sm:text-lg font-display font-semibold tracking-tight text-foreground">
              {t("agreements.gate.title", "Before you continue")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-[13px] leading-relaxed text-foreground/60">
            {t(
              "agreements.gate.subtitle",
              "Please review and accept the policies below to proceed.",
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Policy cards — compact, scrollable on overflow */}
        <div
          className="mt-4 space-y-2 max-h-[42vh] overflow-y-auto pr-1 -mr-1"
          data-testid="list-agreement-policies"
        >
          {missing.map((tp) => (
            <div
              key={tp}
              className="
                rounded-xl border border-white/[0.06]
                bg-white/[0.015]
                px-3.5 py-2.5
                transition-colors hover:border-primary/15
              "
              data-testid={`agreement-text-${tp}`}
            >
              <div className="text-primary/90 text-[10px] font-medium uppercase tracking-[0.12em] mb-1">
                {t(`agreements.types.${tp}`, tp)}
              </div>
              <p className="text-[12.5px] leading-[1.55] text-foreground/75">
                {t(`agreements.text.${tp}`, "")}
              </p>
            </div>
          ))}
        </div>

        {/* Consent checkbox */}
        <label
          className="
            flex items-start gap-3 mt-4
            rounded-xl border border-white/[0.06]
            bg-white/[0.02] px-3.5 py-3
            cursor-pointer select-none
            transition-colors hover:border-primary/20
          "
        >
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
            data-testid="checkbox-agreement-accept"
            className="mt-0.5 h-4 w-4 rounded-[5px]"
          />
          <span className="text-[13px] leading-relaxed text-foreground/85">
            {t(
              "agreements.gate.acceptAll",
              "I have read and agree to the policies above.",
            )}
          </span>
        </label>

        {/* Actions — primary right (LTR) / start (RTL) handled by flex-row-reverse from RTL parent if any.
            Using a simple row with gap; on mobile they stack as full-width buttons for tap comfort. */}
        <div className="mt-5 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            data-testid="button-agreement-cancel"
            className="
              h-9 px-4 text-[13px]
              text-foreground/55 hover:text-foreground/85
              hover:bg-white/[0.04]
            "
          >
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!checked}
            data-testid="button-agreement-confirm"
            className="
              h-9 px-5 text-[13px] font-medium
              bg-primary text-primary-foreground
              hover:bg-primary/90
              disabled:opacity-40 disabled:cursor-not-allowed
              shadow-[0_0_22px_-8px_rgba(94,231,255,0.7)]
              transition-all
            "
          >
            {t("agreements.gate.confirm", "I agree")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
