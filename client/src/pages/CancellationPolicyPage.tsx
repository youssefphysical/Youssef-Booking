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
          title={`More than ${cutoff} hours`}
          body="Free cancellation or reschedule. No charge."
        />
        <PolicyCard
          icon={<AlertTriangle />}
          tone="danger"
          title={`Less than ${cutoff} hours`}
          body="Booking is locked. The session is counted and charged."
        />
      </div>

      <LegalSection title="1. Why this policy exists">
        <p>
          Personal training relies on protected one-on-one time. Late cancellations make it almost
          impossible to fill the slot with another client. This policy is applied to protect
          scheduling availability and ensure fairness for all clients.
        </p>
      </LegalSection>

      <LegalSection title="2. How to cancel or reschedule">
        <p>
          Open your client dashboard and use the cancel option on the booking, or message Youssef
          on WhatsApp before the cutoff window. Within the cutoff window the booking is locked
          inside the dashboard and only Youssef can change it.
        </p>
      </LegalSection>

      <LegalSection title="3. Genuine emergencies">
        <p>
          We understand emergencies happen. If something serious is going on (medical issue,
          family emergency, accident), reach out to Youssef directly on WhatsApp. He may, at his
          discretion, mark the cancellation as free.
        </p>
      </LegalSection>

      <LegalSection title="4. Late arrivals & no-shows">
        <p>
          Sessions end at the originally scheduled time, even if you arrive late. A complete
          no-show is treated the same as a late cancellation and counts as a used session.
        </p>
      </LegalSection>

      <div className="rounded-2xl border border-white/10 bg-card/60 p-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-bold">Have an emergency?</p>
          <p className="text-sm text-muted-foreground">Talk to Youssef directly on WhatsApp.</p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/book"
            data-testid="link-policy-book"
            className="inline-flex items-center h-11 px-4 rounded-xl border border-white/10 hover:bg-white/5 text-sm font-semibold"
          >
            Book a Session
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
