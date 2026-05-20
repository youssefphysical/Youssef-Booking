import { useState } from "react";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Activity, Sparkles, HeartPulse, MessageCircle, Loader2, ShieldAlert } from "lucide-react";
import { useTranslation } from "@/i18n";
import { useAuth } from "@/hooks/use-auth";
import { useFeatureFlag } from "@/lib/featureFlags";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AgreementDisclaimer } from "@/components/AgreementDisclaimer";
import { DEFAULT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import NotFound from "@/pages/not-found";

type ServiceKey = "stretching" | "mobility" | "movement_recovery";

const SERVICES: Array<{ key: ServiceKey; icon: typeof Activity }> = [
  { key: "stretching", icon: Sparkles },
  { key: "mobility", icon: Activity },
  { key: "movement_recovery", icon: HeartPulse },
];

const RECOVERY_WHATSAPP_EN = "Hello Coach Youssef, I would like information about Recovery and Mobility sessions.";

type RecoveryRow = {
  id: number;
  serviceType: string;
  status: string;
  notes: string | null;
  scheduledFor: string | null;
  createdAt: string;
};

export default function RecoveryPage() {
  const { t, dir } = useTranslation();
  const { user } = useAuth();
  const enabled = useFeatureFlag("recovery_enabled", true);
  const { toast } = useToast();
  const [picked, setPicked] = useState<ServiceKey | null>(null);
  const [notes, setNotes] = useState("");

  const { data: myRequests } = useQuery<RecoveryRow[]>({
    queryKey: ["/api/recovery-requests"],
    enabled: !!user && enabled,
  });

  const createReq = useMutation({
    mutationFn: async () => {
      if (!picked) throw new Error("Pick a service");
      const res = await apiRequest("POST", "/api/recovery-requests", {
        serviceType: picked,
        notes: notes.trim() || null,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/recovery-requests"] });
      toast({
        title: t("recovery.toast.created", "Request sent"),
        description: t("recovery.toast.createdDesc", "Coach Youssef will follow up shortly."),
      });
      setPicked(null);
      setNotes("");
    },
    onError: (err: any) => {
      toast({
        title: t("common.error", "Something went wrong"),
        description: err?.message ?? "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!enabled) return <NotFound />;

  const waHref = `https://wa.me/${DEFAULT_WHATSAPP_NUMBER}?text=${encodeURIComponent(RECOVERY_WHATSAPP_EN)}`;

  return (
    <div className="max-w-5xl mx-auto px-5 pt-24 pb-20" dir={dir} data-testid="page-recovery">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3 mb-8">
        <p className="text-primary text-[11px] tracking-[0.18em] uppercase font-semibold">
          {t("recovery.eyebrow", "Recovery & Mobility")}
        </p>
        <h1 className="text-3xl sm:text-4xl font-display font-bold leading-tight">
          {t("recovery.title", "Move better. Recover faster.")}
        </h1>
        <p className="text-foreground/70 max-w-2xl">
          {t("recovery.subtitle", "Coach-led sessions for tightness, restricted ranges, and post-training recovery.")}
        </p>
      </motion.div>

      {/* Pinned disclaimer — always visible, never collapsed */}
      <div
        className="flex gap-3 p-4 rounded-2xl bg-amber-500/5 border border-amber-500/30 text-sm leading-relaxed mb-8"
        data-testid="banner-recovery-disclaimer"
      >
        <ShieldAlert className="text-amber-300 shrink-0 mt-0.5" size={18} />
        <div className="text-amber-100/90">
          <p className="font-semibold mb-1">{t("recovery.disclaimerTitle", "Important")}</p>
          <p>{t("agreements.text.recovery_disclaimer", "Movement support only. Not medical diagnosis, treatment, or physiotherapy replacement.")}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
        {SERVICES.map(({ key, icon: Icon }) => (
          <div
            key={key}
            className="rounded-2xl border border-white/[0.06] bg-card/60 p-5 flex flex-col gap-3"
            data-testid={`card-recovery-${key}`}
          >
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <Icon size={20} />
            </div>
            <div>
              <h3 className="font-display text-lg font-semibold">{t(`recovery.services.${key}.name`, key)}</h3>
              <p className="text-sm text-foreground/70 mt-1">{t(`recovery.services.${key}.desc`, "")}</p>
            </div>
            <div className="flex flex-col gap-2 mt-auto pt-2">
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 h-10 px-3 rounded-xl bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/25 text-sm font-semibold"
                data-testid={`button-recovery-wa-${key}`}
              >
                <MessageCircle size={14} />
                {t("recovery.askWhatsapp", "Ask on WhatsApp")}
              </a>
              {user ? (
                <Button
                  variant="secondary"
                  onClick={() => setPicked(key)}
                  data-testid={`button-recovery-request-${key}`}
                >
                  {t("recovery.requestInApp", "Request in app")}
                </Button>
              ) : (
                <a
                  href="/auth"
                  className="inline-flex items-center justify-center h-10 px-3 rounded-xl bg-white/[0.04] text-foreground/70 text-sm font-semibold hover:bg-white/[0.08]"
                  data-testid={`link-recovery-signin-${key}`}
                >
                  {t("recovery.signInToRequest", "Sign in to request")}
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      {user && myRequests && myRequests.length > 0 && (
        <div className="rounded-2xl border border-white/[0.06] bg-card/60 p-5">
          <h2 className="font-display text-lg font-semibold mb-3">
            {t("recovery.myRequests", "Your recovery requests")}
          </h2>
          <ul className="divide-y divide-white/[0.06]">
            {myRequests.map((r) => (
              <li key={r.id} className="py-2 flex items-center justify-between text-sm" data-testid={`row-myrecovery-${r.id}`}>
                <span>{t(`recovery.services.${r.serviceType}.name`, r.serviceType)}</span>
                <span className="text-primary text-[11px] uppercase tracking-wide">
                  {t(`recovery.status.${r.status}`, r.status)}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <Dialog open={!!picked} onOpenChange={(o) => !o && setPicked(null)}>
        <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {t("recovery.dialog.title", "Request a recovery session")}
            </DialogTitle>
            <DialogDescription>
              {picked && t(`recovery.services.${picked}.name`, picked)}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <AgreementDisclaimer type="recovery_disclaimer" />
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("recovery.dialog.notesPlaceholder", "Anything Coach Youssef should know? (optional)")}
              data-testid="input-recovery-notes"
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setPicked(null)} data-testid="button-recovery-cancel">
              {t("common.cancel", "Cancel")}
            </Button>
            <Button onClick={() => createReq.mutate()} disabled={createReq.isPending} data-testid="button-recovery-submit">
              {createReq.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("recovery.dialog.submit", "Send request")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
