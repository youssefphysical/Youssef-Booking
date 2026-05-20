import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { CheckCircle2, ShieldAlert, Loader2 } from "lucide-react";
import { useTranslation } from "@/i18n";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";

type AgreementRow = {
  id: number;
  agreementType: string;
  version: string;
  acceptedAt: string;
};

type VersionsResp = {
  types: string[];
  versions: Record<string, string>;
};

export default function AgreementsPage() {
  const { t, dir } = useTranslation();
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);

  const { data: versions } = useQuery<VersionsResp>({ queryKey: ["/api/agreements/versions"] });
  const { data: rows } = useQuery<AgreementRow[]>({ queryKey: ["/api/agreements"] });

  const latestByType = useMemo(() => {
    const map = new Map<string, AgreementRow>();
    for (const r of rows ?? []) {
      const cur = map.get(r.agreementType);
      if (!cur || new Date(r.acceptedAt).getTime() > new Date(cur.acceptedAt).getTime()) {
        map.set(r.agreementType, r);
      }
    }
    return map;
  }, [rows]);

  const accept = useMutation({
    mutationFn: async ({ type, version }: { type: string; version: string }) => {
      setBusy(type);
      try {
        const res = await apiRequest("POST", "/api/agreements", { agreementType: type, version });
        return res.json();
      } finally {
        setBusy(null);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/agreements"] });
      toast({
        title: t("agreements.toast.accepted", "Accepted"),
        description: t("agreements.toast.acceptedDesc", "Your acceptance has been recorded."),
      });
    },
  });

  const TYPES = versions?.types ?? [];

  return (
    <div className="max-w-3xl mx-auto px-5 pt-24 pb-20" dir={dir} data-testid="page-agreements">
      <header className="space-y-2 mb-8">
        <p className="text-primary text-[11px] tracking-[0.18em] uppercase font-semibold">
          {t("agreements.eyebrow", "Agreements")}
        </p>
        <h1 className="text-3xl font-display font-bold">{t("agreements.title", "Your agreements")}</h1>
        <p className="text-foreground/70">
          {t("agreements.subtitle", "Review the policies you've accepted and re-accept if a new version is published.")}
        </p>
      </header>

      <div className="space-y-3" data-testid="agreements-current">
        {TYPES.map((type) => {
          const currentVersion = versions?.versions[type] ?? "1";
          const accepted = latestByType.get(type);
          const upToDate = accepted && accepted.version === currentVersion;
          return (
            <div
              key={type}
              className="rounded-2xl border border-white/[0.06] bg-card/60 p-4 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3"
              data-testid={`agreement-row-${type}`}
            >
              <div className="space-y-1 min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  {upToDate ? (
                    <CheckCircle2 className="text-emerald-300" size={16} />
                  ) : (
                    <ShieldAlert className="text-amber-300" size={16} />
                  )}
                  <h2 className="font-display text-base font-semibold">
                    {t(`agreements.types.${type}`, type)}
                  </h2>
                  <span className="text-[10px] uppercase tracking-wide text-foreground/50">
                    v{currentVersion}
                  </span>
                </div>
                <p className="text-sm text-foreground/70 leading-relaxed">
                  {t(`agreements.text.${type}`, "")}
                </p>
                {accepted && (
                  <p className="text-xs text-foreground/50">
                    {t("agreements.acceptedAt", "Accepted")}:{" "}
                    {new Date(accepted.acceptedAt).toLocaleString()} — v{accepted.version}
                  </p>
                )}
              </div>
              <div className="shrink-0">
                {!upToDate && (
                  <Button
                    onClick={() => accept.mutate({ type, version: currentVersion })}
                    disabled={busy === type}
                    data-testid={`button-accept-${type}`}
                  >
                    {busy === type && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {accepted
                      ? t("agreements.reaccept", "Re-accept")
                      : t("agreements.accept", "I agree")}
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {(rows?.length ?? 0) > 0 && (
        <section className="mt-10" data-testid="agreements-history">
          <h2 className="text-sm uppercase tracking-[0.18em] text-foreground/60 font-semibold mb-3">
            {t("agreements.historyTitle", "Acceptance history")}
          </h2>
          <ol className="space-y-2">
            {[...(rows ?? [])]
              .sort(
                (a, b) =>
                  new Date(b.acceptedAt).getTime() - new Date(a.acceptedAt).getTime(),
              )
              .map((r) => (
                <li
                  key={r.id}
                  className="rounded-xl border border-white/[0.05] bg-card/40 px-3 py-2 text-xs flex items-center justify-between gap-3"
                  data-testid={`history-row-${r.id}`}
                >
                  <span className="text-foreground/80">
                    {t(`agreements.types.${r.agreementType}`, r.agreementType)}{" "}
                    <span className="text-foreground/40">· v{r.version}</span>
                  </span>
                  <span className="text-foreground/50">
                    {new Date(r.acceptedAt).toLocaleString()}
                  </span>
                </li>
              ))}
          </ol>
        </section>
      )}
    </div>
  );
}
