import { Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useSettings } from "@/hooks/use-settings";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { LegalPage, LegalSection } from "@/components/LegalPage";
import { useTranslation } from "@/i18n";

export default function CancellationPolicyPage() {
  const { data: settings } = useSettings();
  const cutoff = settings?.cancellationCutoffHours ?? 6;
  const { t } = useTranslation();

  return (
    <LegalPage
      eyebrow={t("legal.policyEyebrow")}
      title={t("legal.cancellationTitle")}
      lastUpdated={t("legal.aprilDate")}
      summary={t("legal.cancelSummary").replace(/\{cutoff\}/g, String(cutoff))}
    >
      <div className="grid sm:grid-cols-2 gap-4">
        <PolicyCard
          icon={<Clock />}
          tone="success"
          title={t("legal.cancel.cardMoreTitle").replace("{h}", String(cutoff))}
          body={t("legal.cancel.cardMoreBody")}
        />
        <PolicyCard
          icon={<AlertTriangle />}
          tone="danger"
          title={t("legal.cancel.cardLessTitle").replace("{h}", String(cutoff))}
          body={t("legal.cancel.cardLessBody")}
        />
      </div>

      <LegalSection title={t("legal.cancel.sec1Title")}>
        <p>{t("legal.cancel.sec1Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.cancel.sec2Title")}>
        <p>{t("legal.cancel.sec2Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.cancel.sec3Title")}>
        <p>{t("legal.cancel.sec3Body")}</p>
      </LegalSection>

      <LegalSection title={t("legal.cancel.sec4Title")}>
        <p>{t("legal.cancel.sec4Body")}</p>
      </LegalSection>

      <div className="rounded-2xl border border-white/10 bg-card/60 p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">{t("legal.cancel.emergencyTitle")}</p>
          <p className="text-sm text-muted-foreground">{t("legal.cancel.emergencyBody")}</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/book"
            data-testid="link-policy-book"
            className="inline-flex items-center h-11 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold whitespace-nowrap"
          >
            {t("hero.bookSession")}
          </Link>
          <WhatsAppButton testId="button-policy-whatsapp" />
        </div>
      </div>
    </LegalPage>
  );
}

function PolicyCard({
  icon,
  tone,
  title,
  body,
}: {
  icon: React.ReactNode;
  tone: "success" | "danger";
  title: string;
  body: string;
}) {
  const styles =
    tone === "success"
      ? "bg-primary/5 border-primary/20 text-foreground/90"
      : "bg-red-500/5 border-red-500/20 text-foreground/90";
  const iconWrap =
    tone === "success"
      ? "bg-primary/15 border border-primary/25 text-primary"
      : "bg-red-500/15 border border-red-500/25 text-red-300";

  return (
    <div className={`rounded-2xl border p-5 ${styles}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconWrap}`}>
          {tone === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        </div>
        <p className="font-display font-bold">{title}</p>
      </div>
      <p className="text-sm opacity-85">{body}</p>
    </div>
  );
}
