import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  Calendar,
  ShieldCheck,
  Salad,
  HeartPulse,
  PackageCheck,
  Hourglass,
  Snowflake,
  MailWarning,
  AlertTriangle,
  UserMinus,
  UserPlus,
  ChevronRight,
} from "lucide-react";
import {
  AdminPageHeader,
  AdminCard,
  AdminSkeleton,
} from "@/components/admin/primitives";
import { cn } from "@/lib/utils";

type CommandCenterPayload = {
  sessionsToday: number;
  pendingFitnessZoneVerifications: number;
  pendingNutritionRequests: number;
  pendingRecoveryRequests: number;
  expiringPackages: number;
  expiringNutritionPlans: number;
  frozenPackages: number;
  failedEmails: number;
  inactiveClients: number;
  leadsNeedingFollowUp: number;
  integrityWarnings: number;
  generatedAt: string;
  cached: boolean;
};

type Widget = {
  key: keyof CommandCenterPayload;
  label: string;
  sub: string;
  href: string;
  icon: React.ReactNode;
  tone: "default" | "info" | "success" | "warning" | "danger" | "muted";
};

const TONE_BG: Record<Widget["tone"], string> = {
  default: "bg-primary/15 text-primary",
  info: "bg-sky-500/15 text-sky-300",
  success: "bg-emerald-500/15 text-emerald-300",
  warning: "bg-cyan-500/15 text-cyan-300",
  danger: "bg-red-500/15 text-red-300",
  muted: "bg-white/[0.06] text-muted-foreground",
};
const TONE_TEXT: Record<Widget["tone"], string> = {
  default: "text-primary",
  info: "text-sky-300",
  success: "text-emerald-300",
  warning: "text-cyan-300",
  danger: "text-red-300",
  muted: "text-muted-foreground",
};

const WIDGETS: Widget[] = [
  { key: "sessionsToday", label: "Sessions today", sub: "Confirmed + completed", href: "/admin/bookings", icon: <Calendar size={18} />, tone: "default" },
  { key: "pendingFitnessZoneVerifications", label: "Pending verifications", sub: "Package activation requests", href: "/admin/packages?status=pending_verification", icon: <ShieldCheck size={18} />, tone: "warning" },
  { key: "pendingNutritionRequests", label: "Nutrition drafts", sub: "Unpublished plans", href: "/admin/nutrition/plans", icon: <Salad size={18} />, tone: "info" },
  { key: "pendingRecoveryRequests", label: "Recovery queue", sub: "Awaiting scheduling", href: "/admin/recovery", icon: <HeartPulse size={18} />, tone: "info" },
  { key: "expiringPackages", label: "Expiring packages", sub: "Next 7 days", href: "/admin/packages?status=expiring_soon", icon: <PackageCheck size={18} />, tone: "warning" },
  { key: "expiringNutritionPlans", label: "Expiring nutrition plans", sub: "Review date in 7 days", href: "/admin/nutrition/plans", icon: <Hourglass size={18} />, tone: "warning" },
  { key: "frozenPackages", label: "Frozen packages", sub: "On hold / vacation", href: "/admin/packages?status=frozen", icon: <Snowflake size={18} />, tone: "info" },
  { key: "failedEmails", label: "Failed emails", sub: "Notifications never sent", href: "/admin/integrity?category=failed-emails", icon: <MailWarning size={18} />, tone: "danger" },
  { key: "inactiveClients", label: "Inactive clients", sub: "No booking in 21 days", href: "/admin/leads?leadStatus=inactive", icon: <UserMinus size={18} />, tone: "danger" },
  { key: "leadsNeedingFollowUp", label: "Leads to follow up", sub: "Pre-PT pipeline", href: "/admin/leads", icon: <UserPlus size={18} />, tone: "default" },
  { key: "integrityWarnings", label: "Integrity warnings", sub: "Open the checker", href: "/admin/integrity", icon: <AlertTriangle size={18} />, tone: "danger" },
];

export default function AdminCommandCenter() {
  const { data, isLoading, error } = useQuery<CommandCenterPayload>({
    queryKey: ["/api/admin/command-center"],
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  return (
    <div className="admin-shell">
    <div className="admin-container space-y-5">
      <AdminPageHeader
        eyebrow="Command Center"
        title="What needs your attention"
        subtitle="One pane for every queue, deadline, and warning. Counts refresh every 30 seconds."
      />

      {error ? (
        <AdminCard>
          <p className="text-sm text-red-300" data-testid="text-command-center-error">
            Failed to load command center.
          </p>
        </AdminCard>
      ) : null}

      <div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4"
        data-testid="grid-command-center"
      >
        {WIDGETS.map((w) => {
          const count = (data?.[w.key] as number | undefined) ?? 0;
          const empty = count === 0;
          return (
            <Link
              key={w.key as string}
              href={w.href}
              data-testid={`widget-${w.key}`}
              className={cn(
                "rounded-2xl border border-white/8 bg-[rgba(8,15,28,0.82)] p-4 flex items-center gap-3 sm:gap-4 transition-colors min-h-[96px]",
                "hover:bg-white/[0.06]",
              )}
            >
              <span
                className={cn(
                  "inline-flex items-center justify-center w-10 h-10 sm:w-11 sm:h-11 rounded-xl shrink-0",
                  empty ? TONE_BG.muted : TONE_BG[w.tone],
                )}
              >
                {w.icon}
              </span>
              <div className="flex-1 min-w-0">
                {isLoading ? (
                  <AdminSkeleton className="h-7 w-16 mb-1" />
                ) : (
                  <p
                    className={cn(
                      "font-display font-bold text-[24px] leading-none tabular-nums",
                      empty ? "text-muted-foreground/70" : TONE_TEXT[w.tone],
                    )}
                    data-testid={`count-${w.key}`}
                  >
                    {count}
                  </p>
                )}
                <p className="text-[11.5px] sm:text-xs text-foreground/85 font-semibold mt-1 leading-snug">
                  {w.label}
                </p>
                <p className="text-[10.5px] text-muted-foreground leading-snug truncate">
                  {w.sub}
                </p>
              </div>
              <ChevronRight
                size={16}
                className="shrink-0 text-muted-foreground/60 rtl:rotate-180"
              />
            </Link>
          );
        })}
      </div>

      {data?.generatedAt ? (
        <p className="text-[11px] text-muted-foreground" data-testid="text-generated-at">
          Updated {new Date(data.generatedAt).toLocaleTimeString()}
          {data.cached ? " · cached" : ""}
        </p>
      ) : null}
    </div>
    </div>
  );
}
