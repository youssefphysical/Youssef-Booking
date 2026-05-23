import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Printer, Activity, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminAnalytics, AdminDailyBrief } from "@shared/schema";

const FMT_AED = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "AED",
  maximumFractionDigits: 0,
});

type Health = {
  degraded: boolean;
  failureKinds: string[];
  rows: Array<{
    kind: string;
    consecutiveFailures: number;
    lastFailureAt: string | null;
    lastSuccessAt: string | null;
    detail: string | null;
  }>;
};

type OpenAlert = {
  id: number;
  kind: string;
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
  createdAt: string;
};

export default function AdminBusinessHealth() {
  useEffect(() => {
    const t = document.title;
    document.title = "Business Health — Youssef Ahmed PT";
    return () => {
      document.title = t;
    };
  }, []);

  const { data: analytics } = useQuery<AdminAnalytics>({
    queryKey: ["/api/admin/analytics"],
  });
  const { data: brief } = useQuery<AdminDailyBrief>({
    queryKey: ["/api/admin/daily-brief"],
    queryFn: async () => {
      const r = await fetch("/api/admin/daily-brief", { credentials: "include" });
      if (!r.ok) throw new Error("fail");
      return r.json();
    },
  });
  const { data: health } = useQuery<Health>({
    queryKey: ["/api/admin/system-health"],
    queryFn: async () => {
      const r = await fetch("/api/admin/system-health", { credentials: "include" });
      if (!r.ok) throw new Error("fail");
      return r.json();
    },
  });
  const { data: alerts = [] } = useQuery<OpenAlert[]>({
    queryKey: ["/api/admin/alerts"],
    queryFn: async () => {
      const r = await fetch("/api/admin/alerts", { credentials: "include" });
      if (!r.ok) throw new Error("fail");
      return r.json();
    },
  });

  const today = new Date(Date.now() + 4 * 60 * 60 * 1000).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="admin-shell print:bg-white print:text-black">
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body, html { background: white !important; }
          .print-card { border: 1px solid #ddd !important; background: white !important; box-shadow: none !important; }
          .print-text { color: #111 !important; }
          .print-muted { color: #555 !important; }
          .print-section { break-inside: avoid; }
        }
      `}</style>

      <div className="admin-container max-w-4xl">
        <div className="flex items-center justify-between mb-6 no-print">
          <div>
            <p className="text-[10px] uppercase tracking-[0.25em] text-primary font-bold">
              Business Health
            </p>
            <h1 className="text-2xl sm:text-3xl font-display font-bold mt-1">
              Operational snapshot
            </h1>
            <p className="text-xs text-muted-foreground mt-1">{today}</p>
          </div>
          <Button
            onClick={() => window.print()}
            className="rounded-xl"
            data-testid="button-print-health"
          >
            <Printer size={14} className="mr-1.5" /> Print / PDF
          </Button>
        </div>

        <div className="hidden print:block mb-6">
          <h1 className="text-3xl font-bold print-text">Business Health</h1>
          <p className="text-sm print-muted">{today} — Youssef Ahmed PT</p>
        </div>

        {analytics && (
          <Section title="At a glance">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiBox label="Active clients" value={String(analytics.clients.active)} />
              <KpiBox
                label="Revenue (30d)"
                value={FMT_AED.format(analytics.revenue.paid30d)}
              />
              <KpiBox
                label="Sessions (30d)"
                value={String(analytics.sessions.completed30d)}
              />
              <KpiBox
                label="Attendance"
                value={`${Math.round(analytics.sessions.attendanceRate30d * 100)}%`}
              />
              <KpiBox label="Frozen pkgs" value={String(analytics.packages.frozen)} />
              <KpiBox
                label="Expiring soon"
                value={String(analytics.packages.expiringSoon)}
              />
              <KpiBox
                label="Outstanding"
                value={FMT_AED.format(analytics.revenue.outstanding)}
              />
              <KpiBox
                label="Repeat clients"
                value={String(analytics.retention.multiPackageClients)}
              />
            </div>
          </Section>
        )}

        {brief && (
          <Section title={`Today — ${brief.date}`}>
            <ul className="rounded-xl border border-white/10 bg-white/[0.02] divide-y divide-white/5 print-card">
              <Row label="Sessions">{brief.today.totalSessions}</Row>
              <Row label="Upcoming">{brief.today.upcoming}</Row>
              <Row label="Completed">{brief.today.completed}</Row>
              <Row label="Pending renewals">{brief.pending.renewals}</Row>
              <Row label="Pending extensions">{brief.pending.extensions}</Row>
              <Row label="Payment approvals">{brief.pending.paymentApprovals}</Row>
              <Row label="Expiring in 7 days">{brief.expiries.next7dPackages}</Row>
            </ul>
          </Section>
        )}

        <Section title={`System health${health?.degraded ? " — degraded" : ""}`}>
          {health && health.rows.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-muted-foreground print-card">
              No subsystems tracked yet — emit a `track()` event from server code to register one.
            </div>
          ) : (
            <ul className="rounded-xl border border-white/10 bg-white/[0.02] divide-y divide-white/5 print-card">
              {(health?.rows ?? []).map((r) => {
                const ok = r.consecutiveFailures === 0;
                return (
                  <li
                    key={r.kind}
                    className="flex items-start gap-3 px-3 py-2.5"
                    data-testid={`health-row-${r.kind}`}
                  >
                    {ok ? (
                      <CheckCircle2 size={14} className="text-emerald-300 mt-0.5 shrink-0" />
                    ) : (
                      <AlertCircle size={14} className="text-red-300 mt-0.5 shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-mono print-text">{r.kind}</p>
                      <p className="text-[11px] print-muted">
                        {ok
                          ? `Last success ${r.lastSuccessAt ? new Date(r.lastSuccessAt).toLocaleString() : "—"}`
                          : `${r.consecutiveFailures} consecutive failure${r.consecutiveFailures === 1 ? "" : "s"} · ${r.detail ?? "no detail"}`}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Section>

        <Section title={`Open alerts (${alerts.length})`}>
          {alerts.length === 0 ? (
            <div className="rounded-xl border border-white/10 bg-white/[0.02] p-4 text-sm text-muted-foreground print-card">
              No open alerts.
            </div>
          ) : (
            <ul className="rounded-xl border border-white/10 bg-white/[0.02] divide-y divide-white/5 print-card">
              {alerts.map((a) => (
                <li key={a.id} className="px-3 py-2.5" data-testid={`health-alert-${a.id}`}>
                  <p className="text-[13px] font-semibold print-text">
                    <span
                      className={
                        "uppercase text-[10px] tracking-wider mr-2 " +
                        (a.severity === "critical"
                          ? "text-red-300"
                          : a.severity === "warning"
                            ? "text-amber-300"
                            : "text-sky-300")
                      }
                    >
                      [{a.severity}]
                    </span>
                    {a.title}
                  </p>
                  <p className="text-[11px] print-muted mt-0.5">{a.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <p className="text-[10px] text-muted-foreground mt-8 print-muted text-center">
          Generated {new Date(Date.now() + 4 * 60 * 60 * 1000).toLocaleString("en-GB", { timeZone: "UTC" })} — Youssef Ahmed Personal Training
        </p>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 print-section">
      <h2 className="text-[11px] uppercase tracking-[0.22em] font-bold text-primary mb-2 print-text">
        {title}
      </h2>
      {children}
    </section>
  );
}

function KpiBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-3 print-card">
      <p className="text-[9.5px] uppercase tracking-[0.18em] font-bold text-muted-foreground print-muted">
        {label}
      </p>
      <p className="text-lg font-display font-bold mt-1 tabular-nums print-text">{value}</p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="flex items-center justify-between px-3 py-2 text-[13px]">
      <span className="print-muted text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums print-text">{children}</span>
    </li>
  );
}
