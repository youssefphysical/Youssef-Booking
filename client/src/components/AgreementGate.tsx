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
    try {
      if (typeof window !== "undefined") {
        localStorage.setItem(LS_POLICY_KEY, "true");
      }
    } catch {
      // ignore
    }
    onOpenChange(false);
    onAccepted();
    if (missing.length > 0) {
      accept.mutate();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="
          relative overflow-hidden
          bg-[#050607]
          border border-white/[0.06]
          rounded-[20px] sm:rounded-[22px]
          w-[calc(100vw-1.25rem)] sm:w-full max-w-[420px]
          p-0 gap-0
          shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_0_0_1px_rgba(94,231,255,0.05),0_40px_120px_-30px_rgba(0,0,0,0.95),0_8px_24px_-12px_rgba(94,231,255,0.08)]
        "
        data-testid="dialog-agreement-gate"
      >
        {/* Ambient depth — radial cyan wash behind header */}
        <div
          aria-hidden
          className="pointer-events-none absolute -top-24 start-1/2 -translate-x-1/2 h-48 w-[120%] rounded-full bg-primary/[0.06] blur-3xl"
        />
        {/* Top hairline glow */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
        />
        {/* Inner stroke — luxury double-border */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-px rounded-[19px] sm:rounded-[21px] ring-1 ring-inset ring-white/[0.025]"
        />

        <div className="relative px-6 pt-6 pb-5 sm:px-7 sm:pt-7 sm:pb-6">
          <DialogHeader className="space-y-2.5 text-start">
            <div className="flex items-center gap-3">
              <span
                aria-hidden
                className="
                  relative inline-flex h-9 w-9 items-center justify-center
                  rounded-full
                  bg-gradient-to-b from-primary/[0.14] to-primary/[0.04]
                  ring-1 ring-inset ring-primary/25
                  text-primary
                  shadow-[0_0_24px_-6px_rgba(94,231,255,0.55),0_1px_0_0_rgba(255,255,255,0.06)_inset]
                "
              >
                <ShieldCheck size={16} strokeWidth={2.1} />
              </span>
              <div className="min-w-0">
                <DialogTitle
                  className="
                    text-[18px] sm:text-[19px] leading-tight
                    font-display font-semibold
                    tracking-[-0.015em] text-foreground
                  "
                >
                  {t("agreements.gate.title", "Before you continue")}
                </DialogTitle>
              </div>
            </div>
            <DialogDescription
              className="
                text-[13px] leading-[1.6]
                text-foreground/55
                tracking-[-0.005em]
                ps-[3.25rem]
              "
            >
              {t(
                "agreements.gate.subtitle",
                "Please review and accept the policies below to proceed.",
              )}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Divider — barely-there optical separator */}
        <div aria-hidden className="mx-6 sm:mx-7 h-px bg-gradient-to-r from-transparent via-white/[0.06] to-transparent" />

        {/* Policy cards */}
        <div
          className="px-6 sm:px-7 pt-4 pb-2 space-y-2 max-h-[40vh] overflow-y-auto"
          data-testid="list-agreement-policies"
        >
          {missing.map((tp) => (
            <div
              key={tp}
              className="
                group relative overflow-hidden
                rounded-[14px]
                border border-white/[0.05]
                bg-gradient-to-b from-white/[0.025] to-white/[0.008]
                backdrop-blur-[6px]
                px-4 py-3
                transition-all duration-300 ease-out
                hover:border-primary/20
                hover:shadow-[0_0_0_1px_rgba(94,231,255,0.06),0_10px_30px_-15px_rgba(94,231,255,0.18)]
              "
              data-testid={`agreement-text-${tp}`}
            >
              {/* Left edge accent on hover */}
              <span
                aria-hidden
                className="absolute inset-y-2 start-0 w-px bg-gradient-to-b from-transparent via-primary/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              />
              <div className="text-primary/95 text-[10px] font-semibold uppercase tracking-[0.16em] mb-1.5">
                {t(`agreements.types.${tp}`, tp)}
              </div>
              <p className="text-[12.5px] leading-[1.65] text-foreground/72 tracking-[-0.003em]">
                {t(`agreements.text.${tp}`, "")}
              </p>
            </div>
          ))}
        </div>

        {/* Consent + actions block */}
        <div className="px-6 sm:px-7 pt-4 pb-6 sm:pb-7">
          {/* Consent checkbox — premium glass card */}
          <label
            className="
              group flex items-start gap-3
              rounded-[14px]
              border border-white/[0.05]
              bg-gradient-to-b from-white/[0.03] to-white/[0.01]
              backdrop-blur-[6px]
              px-4 py-3.5
              cursor-pointer select-none
              transition-all duration-300 ease-out
              hover:border-primary/25
              hover:bg-gradient-to-b hover:from-primary/[0.04] hover:to-white/[0.01]
              has-[[data-state=checked]]:border-primary/30
              has-[[data-state=checked]]:shadow-[0_0_0_1px_rgba(94,231,255,0.08),0_8px_24px_-12px_rgba(94,231,255,0.2)]
            "
          >
            <Checkbox
              checked={checked}
              onCheckedChange={(v) => setChecked(v === true)}
              data-testid="checkbox-agreement-accept"
              className="mt-[2px] h-4 w-4 rounded-[5px] border-white/20 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
            />
            <span className="text-[13px] leading-[1.55] text-foreground/85 tracking-[-0.003em]">
              {t(
                "agreements.gate.acceptAll",
                "I have read and agree to the policies above.",
              )}
            </span>
          </label>

          {/* Actions */}
          <div className="mt-5 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2.5 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onOpenChange(false)}
              data-testid="button-agreement-cancel"
              className="
                h-10 sm:h-9 px-4
                text-[13px] font-medium tracking-[-0.005em]
                text-foreground/50 hover:text-foreground/90
                bg-transparent hover:bg-white/[0.03]
                rounded-[10px]
                transition-colors duration-200
              "
            >
              {t("common.cancel", "Cancel")}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!checked}
              data-testid="button-agreement-confirm"
              className="
                relative overflow-hidden
                h-10 sm:h-9 px-6
                text-[13px] font-semibold tracking-[-0.005em]
                rounded-[10px]
                text-[#001218]
                bg-gradient-to-b from-[#7defff] to-[#39d3f0]
                hover:from-[#8df3ff] hover:to-[#4adcf6]
                border border-primary/40
                shadow-[0_1px_0_0_rgba(255,255,255,0.35)_inset,0_-1px_0_0_rgba(0,30,40,0.2)_inset,0_0_28px_-6px_rgba(94,231,255,0.65),0_8px_22px_-10px_rgba(94,231,255,0.55)]
                hover:shadow-[0_1px_0_0_rgba(255,255,255,0.45)_inset,0_-1px_0_0_rgba(0,30,40,0.2)_inset,0_0_36px_-4px_rgba(94,231,255,0.8),0_12px_28px_-10px_rgba(94,231,255,0.7)]
                disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none disabled:from-primary/40 disabled:to-primary/30
                transition-all duration-300 ease-out
              "
            >
              {/* Specular highlight */}
              <span
                aria-hidden
                className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
              />
              {t("agreements.gate.confirm", "I agree")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
