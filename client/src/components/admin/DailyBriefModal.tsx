import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Sun,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wallet,
  Sparkles,
  ChevronRight,
  X,
  Heart,
  Activity,
} from "lucide-react";
import type { AdminDailyBrief } from "@shared/schema";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

const STORAGE_PREFIX = "daily-brief-dismissed-";

function todayKey() {
  // Match the server's Dubai date to avoid late-night drift on the client.
  const d = new Date(Date.now() + 4 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}

export function DailyBriefModal({ enabled = true }: { enabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const today = todayKey();
  const storageKey = STORAGE_PREFIX + today;

  const { data } = useQuery<AdminDailyBrief>({
    queryKey: ["/api/admin/daily-brief"],
    queryFn: async () => {
      const r = await fetch("/api/admin/daily-brief", { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load daily brief");
      return r.json();
    },
    enabled,
    staleTime: 60_000,
  });

  // Auto-open once per day on first paint after data arrives.
  useEffect(() => {
    if (!enabled || !data) return;
    try {
      if (localStorage.getItem(storageKey) === "1") return;
    } catch {}
    setOpen(true);
  }, [enabled, data, storageKey]);

  function dismiss() {
    try {
      localStorage.setItem(storageKey, "1");
    } catch {}
    setOpen(false);
  }

  if (!data) return null;

  const dateLabel = format(new Date(data.date + "T12:00:00"), "EEEE, MMM d");
  const totalPending =
    data.pending.renewals + data.pending.extensions + data.pending.paymentApprovals;

  return (
    <>
      {/* Manual open button for re-opening within the day */}
      <Button
        variant="outline"
        size="sm"
        className="rounded-xl border-primary/30 bg-primary/5 hover:bg-primary/10"
        onClick={() => setOpen(true)}
        data-testid="button-open-daily-brief"
      >
        <Sun size={14} className="mr-1.5 text-primary" />
        Daily Brief
        {data.alerts.critical > 0 && (
          <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-red-500/90 text-white text-[10px] font-bold w-4 h-4">
            {data.alerts.critical}
          </span>
        )}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="bg-card border-white/10 sm:rounded-3xl max-w-2xl max-h-[90vh] overflow-y-auto"
          data-testid="dialog-daily-brief"
        >
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <p className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.25em] text-primary font-semibold">
                  <Sparkles size={12} /> Daily Brief
                </p>
                <DialogTitle className="text-2xl font-display mt-1">
                  {dateLabel}
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {data.today.totalSessions} {data.today.totalSessions === 1 ? "session" : "sessions"} ·
                  {" "}{totalPending} pending action{totalPending === 1 ? "" : "s"}
                </p>
              </div>
              {data.systemHealth.degraded && (
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 border border-red-500/30 text-red-300 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider">
                  <Activity size={10} /> Degraded
                </span>
              )}
            </div>
          </DialogHeader>

          {/* Top metrics */}
          <div className="grid grid-cols-3 gap-2 mt-1">
            <BriefStat
              icon={<Clock size={14} />}
              label="Upcoming"
              value={data.today.upcoming}
              tone="info"
            />
            <BriefStat
              icon={<CheckCircle2 size={14} />}
              label="Completed"
              value={data.today.completed}
              tone="success"
            />
            <BriefStat
              icon={<AlertTriangle size={14} />}
              label="Open alerts"
              value={data.alerts.open}
              tone={data.alerts.critical > 0 ? "danger" : data.alerts.open > 0 ? "warning" : "muted"}
            />
          </div>

          {/* Today's sessions */}
          <Section title="Today's sessions">
            {data.today.sessions.length === 0 ? (
              <Empty body="No sessions today — clear deck." />
            ) : (
              <ul className="divide-y divide-white/5 rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
                {data.today.sessions.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-3 py-2.5"
                    data-testid={`brief-session-${s.id}`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-[12px] text-primary tabular-nums w-12 shrink-0">
                        {s.time}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{s.userName}</p>
                        <p className="text-[10.5px] text-muted-foreground truncate">
                          {s.isTrial && "Trial · "}
                          {s.sessionFocus ?? s.status}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {s.vipTier && (
                        <span className="text-[9px] font-bold uppercase tracking-wider text-amber-300/90">
                          {s.vipTier.replace("_", " ")}
                        </span>
                      )}
                      {s.isTrial && (
                        <Heart size={12} className="text-rose-300" />
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Pending */}
          <Section title="Pending approvals">
            <div className="grid grid-cols-3 gap-2">
              <PendingChip label="Renewals" value={data.pending.renewals} href="/admin/packages" />
              <PendingChip label="Extensions" value={data.pending.extensions} href="/admin/packages" />
              <PendingChip
                label="Payments"
                value={data.pending.paymentApprovals}
                href="/admin/packages"
                icon={<Wallet size={11} />}
              />
            </div>
          </Section>

          {/* Expiring */}
          {data.expiries.next7dPackages > 0 && (
            <Section title={`Expiring this week (${data.expiries.next7dPackages})`}>
              <ul className="divide-y divide-white/5 rounded-xl bg-white/[0.02] border border-white/5 overflow-hidden">
                {data.expiries.next7dClients.slice(0, 6).map((c) => (
                  <li key={c.userId} className="px-3 py-2 flex items-center justify-between">
                    <Link
                      href={`/admin/clients/${c.userId}`}
                      className="text-sm hover:text-primary flex items-center gap-2 min-w-0"
                      data-testid={`brief-expiring-${c.userId}`}
                    >
                      <span className="truncate">{c.userName}</span>
                      <ChevronRight size={12} className="text-muted-foreground shrink-0" />
                    </Link>
                    <span className="text-[11px] text-amber-300/90 tabular-nums shrink-0">
                      {c.expiryDate}
                    </span>
                  </li>
                ))}
              </ul>
            </Section>
          )}

          {data.systemHealth.degraded && (
            <Section title="System health">
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                Degraded subsystems: {data.systemHealth.failureKinds.join(", ")} —
                {" "}
                <Link href="/admin/business-health" className="underline">
                  inspect
                </Link>
              </div>
            </Section>
          )}

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setOpen(false)}
              className="rounded-xl"
              data-testid="button-brief-close"
            >
              <X size={14} className="mr-1.5" />
              Close
            </Button>
            <Button
              onClick={dismiss}
              className="rounded-xl"
              data-testid="button-brief-dismiss-today"
            >
              Got it — don't show again today
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-4">
      <h3 className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground font-semibold mb-2">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Empty({ body }: { body: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-white/[0.02] p-3 text-xs text-muted-foreground italic">
      {body}
    </div>
  );
}

function BriefStat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  tone: "info" | "success" | "warning" | "danger" | "muted";
}) {
  const text =
    tone === "danger"
      ? "text-red-300"
      : tone === "warning"
        ? "text-amber-300"
        : tone === "success"
          ? "text-emerald-300"
          : tone === "muted"
            ? "text-muted-foreground"
            : "text-sky-300";
  return (
    <div className="rounded-xl border border-white/8 bg-white/[0.03] p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        <span className={text}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <p className={"font-display font-bold tabular-nums leading-none mt-1.5 text-xl " + text}>
        {value}
      </p>
    </div>
  );
}

function PendingChip({
  label,
  value,
  href,
  icon,
}: {
  label: string;
  value: number;
  href: string;
  icon?: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="rounded-xl border border-white/8 bg-white/[0.03] hover:bg-white/[0.06] transition-colors p-2.5 block"
      data-testid={`brief-pending-${label.toLowerCase()}`}
    >
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <p
        className={
          "font-display font-bold tabular-nums leading-none mt-1.5 text-xl " +
          (value > 0 ? "text-primary" : "text-muted-foreground")
        }
      >
        {value}
      </p>
    </Link>
  );
}
