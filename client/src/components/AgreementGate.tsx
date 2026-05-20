import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, ShieldCheck } from "lucide-react";
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
 * Modal that blocks the caller's action until the user accepts all the
 * specified agreement types at the given version. POSTs one /api/agreements
 * row per type on confirm. Server captures IP + UA automatically.
 */
export function AgreementGate({ types, version, open, onOpenChange, onAccepted }: AgreementGateProps) {
  const { t } = useTranslation();
  const { data: rows } = useAgreements();
  const [checked, setChecked] = useState(false);

  const missing = useMemo(
    () => types.filter((tp) => !hasAccepted(rows, tp, version)),
    [types, version, rows],
  );

  const accept = useMutation({
    mutationFn: async () => {
      for (const tp of missing) {
        await apiRequest("POST", "/api/agreements", { agreementType: tp, version });
      }
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      setChecked(false);
      onOpenChange(false);
      onAccepted();
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-md" data-testid="dialog-agreement-gate">
        <DialogHeader>
          <DialogTitle className="text-xl font-display flex items-center gap-2">
            <ShieldCheck size={18} className="text-primary" />
            {t("agreements.gate.title", "Before you continue")}
          </DialogTitle>
          <DialogDescription>
            {t("agreements.gate.subtitle", "Please review and accept the policies below to proceed.")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2 max-h-[50vh] overflow-y-auto">
          {missing.map((tp) => (
            <div key={tp} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-sm" data-testid={`agreement-text-${tp}`}>
              <div className="text-primary text-[11px] uppercase tracking-wide mb-1">
                {t(`agreements.types.${tp}`, tp)}
              </div>
              <p className="text-foreground/80 leading-relaxed">
                {t(`agreements.text.${tp}`, "")}
              </p>
            </div>
          ))}
        </div>

        <label className="flex items-start gap-3 mt-2 cursor-pointer">
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => setChecked(v === true)}
            data-testid="checkbox-agreement-accept"
            className="mt-0.5"
          />
          <span className="text-sm">
            {t("agreements.gate.acceptAll", "I have read and agree to the policies above.")}
          </span>
        </label>

        <DialogFooter className="mt-3">
          <Button variant="ghost" onClick={() => onOpenChange(false)} data-testid="button-agreement-cancel">
            {t("common.cancel", "Cancel")}
          </Button>
          <Button
            onClick={() => accept.mutate()}
            disabled={!checked || accept.isPending || missing.length === 0}
            data-testid="button-agreement-confirm"
          >
            {accept.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t("agreements.gate.confirm", "I agree")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
