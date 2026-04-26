import { ShieldAlert, Clock, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { useSettings } from "@/hooks/use-settings";
import { WhatsAppButton } from "@/components/WhatsAppButton";

export default function CancellationPolicyPage() {
  const { data: settings } = useSettings();
  const cutoff = settings?.cancellationCutoffHours ?? 6;

  return (
    <div className="max-w-3xl mx-auto px-5 pt-24 pb-20">
      <div className="flex items-center gap-4 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
          <ShieldAlert size={24} />
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-1">Policy</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-policy-title">
            Cancellation Policy
          </h1>
        </div>
      </div>

      <div className="rounded-3xl border border-amber-500/20 bg-amber-500/5 p-6 mb-6">
        <p className="text-base leading-relaxed text-amber-50/90" data-testid="text-policy-body">
          All cancellations or rescheduling requests must be made at least{" "}
          <span className="font-bold text-amber-300">{cutoff} hours</span> before the scheduled
          session time. If a client cancels or requests to reschedule within less than {cutoff}{" "}
          hours before the session, the session will be counted as used and charged. This policy is
          applied to protect scheduling availability and ensure fairness for all clients. By booking
          a session, the client confirms that they understand and accept this policy.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 mb-8">
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
          body="Booking is locked. Session is counted and charged."
        />
      </div>

      <div className="rounded-2xl border border-white/5 bg-card/60 p-6 flex items-center justify-between gap-4 flex-wrap">
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
    </div>
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
      ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-200"
      : "bg-red-500/5 border-red-500/20 text-red-200";
  const iconWrap =
    tone === "success"
      ? "bg-emerald-500/15 text-emerald-400"
      : "bg-red-500/15 text-red-400";

  return (
    <div className={`rounded-2xl border p-5 ${styles}`}>
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${iconWrap}`}>
          {tone === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
        </div>
        <p className="font-display font-bold">{title}</p>
      </div>
      <p className="text-sm opacity-80">{body}</p>
    </div>
  );
}
