import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  UserPlus,
  Package as PackageIcon,
  Gauge,
  HeartPulse,
  Settings as SettingsIcon,
  ScrollText,
  ShieldAlert,
  Merge,
  ChevronRight,
  Wrench,
  Activity,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { AdminPageHeader } from "@/components/admin/primitives";
import { RepairExpiredSessions } from "@/components/admin/RepairExpiredSessions";
import { useAuth } from "@/hooks/use-auth";
import { isEffectiveSuperAdmin } from "@shared/schema";

// Minimal shape — only the badge-relevant fields from /api/admin/command-center.
// The full type lives in AdminCommandCenter.tsx; we only need counts here.
type CcBadgeData = {
  leadsNeedingFollowUp: number;
  integrityWarnings: number;
};

interface HubItem {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  testId: string;
  /** Badge shown when value > 0. Pass null/undefined to hide. */
  badge?: number | string | null;
  /** Colour of the badge dot. Defaults to amber (attention). */
  badgeTone?: "amber" | "red" | "cyan" | "muted";
  /** If true, item is hidden for non-super-admins. */
  superAdminOnly?: boolean;
}

interface HubGroup {
  id: string;
  label: string;
  items?: HubItem[];
  custom?: React.ReactNode;
}

function buildGroups(cc: CcBadgeData | undefined, ccError: boolean): HubGroup[] {
  return [
    {
      id: "business",
      label: "Business",
      items: [
        {
          href: "/admin/analytics",
          icon: <BarChart3 size={18} />,
          title: "Analytics",
          description: "Revenue trends, session volume, and client growth charts.",
          testId: "more-analytics",
        },
        {
          href: "/admin/leads",
          icon: <UserPlus size={18} />,
          title: "Leads",
          description: "Track and convert prospective clients.",
          testId: "more-leads",
          badge: cc?.leadsNeedingFollowUp || null,
          badgeTone: "amber",
        },
        {
          href: "/admin/packages",
          icon: <PackageIcon size={18} />,
          title: "Sessions & Packages",
          description: "Manage client packages and session credits.",
          testId: "more-sessions-packages",
        },
      ],
    },
    {
      id: "operations",
      label: "Operations",
      items: [
        {
          href: "/admin/command-center",
          icon: <Gauge size={18} />,
          title: "Command Center",
          description: "Live overview of all active client sessions and status.",
          testId: "more-command-center",
          badge: ccError ? "Unavailable" : null,
          badgeTone: "muted",
        },
        {
          href: "/admin/recovery",
          icon: <HeartPulse size={18} />,
          title: "Recovery Center",
          description: "Monitor client recovery scores and readiness trends.",
          testId: "more-recovery",
        },
      ],
    },
    {
      id: "system",
      label: "System",
      items: [
        {
          href: "/admin/settings",
          icon: <SettingsIcon size={18} />,
          title: "Settings",
          description: "Platform configuration, brand assets, and integrations.",
          testId: "more-settings",
        },
        {
          href: "/admin/audit-log",
          icon: <ScrollText size={18} />,
          title: "Audit Log",
          description: "Full history of admin actions and system events.",
          testId: "more-audit-log",
        },
        {
          href: "/admin/integrity",
          icon: <ShieldAlert size={18} />,
          title: "Integrity Checker",
          description: "Detect and resolve data inconsistencies in the platform.",
          testId: "more-integrity",
          badge: cc?.integrityWarnings || null,
          badgeTone: "red",
          superAdminOnly: true,
        },
        {
          href: "/admin/business-health",
          icon: <Activity size={18} />,
          title: "System Health",
          description: "Business health KPIs, trends, and operational alerts.",
          testId: "more-system-health",
        },
      ],
    },
    {
      id: "advanced",
      label: "Advanced Tools",
      items: [
        {
          href: "/admin/merge-clients",
          icon: <Merge size={18} />,
          title: "Merge Duplicate Clients",
          description: "Combine two client accounts into one, preserving all data.",
          testId: "more-merge-clients",
          superAdminOnly: true,
        },
      ],
    },
  ];
}

const BADGE_TONE_CLASSES: Record<NonNullable<HubItem["badgeTone"]>, string> = {
  amber: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  red: "bg-red-500/15 text-red-300 border-red-500/25",
  cyan: "bg-primary/15 text-primary border-primary/25",
  muted: "bg-white/[0.06] text-muted-foreground border-white/10",
};

export default function AdminMore() {
  const { user } = useAuth();
  const isSuperAdmin = isEffectiveSuperAdmin(user as any);

  // Fetch command-center data once on mount (server caches for 60s, no extra polling).
  // Used only for badge counts — reads are cheap.
  const { data: ccData, isError: ccError } = useQuery<CcBadgeData>({
    queryKey: ["/api/admin/command-center"],
    staleTime: 5 * 60_000,
    // No refetchInterval — badge counts update on next page visit, not continuously.
  });

  const groups = buildGroups(ccData, ccError);

  return (
    <div className="admin-shell" data-testid="page-admin-more">
      <div className="max-w-2xl mx-auto px-4 sm:px-5 space-y-7">
        <AdminPageHeader
          eyebrow="Admin"
          title="More"
          subtitle="Tools, system settings, and advanced operations."
        />

        {groups.map((group) => (
          <section key={group.id} data-testid={`more-group-${group.id}`}>
            {/* Group eyebrow */}
            <h2 className="text-[10.5px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60 mb-2 px-1">
              {group.label}
            </h2>

            {/* Group card */}
            <div className="rounded-2xl border border-white/[0.07] bg-card/60 overflow-hidden divide-y divide-white/[0.05]">
              {group.items?.filter((item) => !item.superAdminOnly || isSuperAdmin).map((item) => {
                const hasBadge = item.badge !== null && item.badge !== undefined;
                const badgeClasses = BADGE_TONE_CLASSES[item.badgeTone ?? "amber"];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    data-testid={item.testId}
                    className={cn(
                      "flex items-center gap-4 px-4 py-3.5 min-h-[64px]",
                      "hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors",
                    )}
                  >
                    {/* Icon */}
                    <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
                      {item.icon}
                    </span>

                    {/* Text */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold leading-tight">{item.title}</p>
                        {hasBadge && (
                          <span
                            className={cn(
                              "inline-flex items-center h-5 px-1.5 rounded-md border text-[10px] font-semibold leading-none",
                              badgeClasses,
                            )}
                            data-testid={`badge-${item.testId}`}
                          >
                            {typeof item.badge === "number"
                              ? item.badge > 99 ? "99+" : String(item.badge)
                              : item.badge}
                          </span>
                        )}
                      </div>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                        {item.description}
                      </p>
                    </div>

                    {/* Chevron */}
                    <ChevronRight
                      size={15}
                      className="shrink-0 text-muted-foreground/50 rtl:rotate-180"
                    />
                  </Link>
                );
              })}

              {/* Advanced: inline Repair tool — super-admin only */}
              {group.id === "advanced" && isSuperAdmin && (
                <div className="px-4 py-4" data-testid="more-repair-expired-sessions">
                  <div className="flex items-start gap-4 mb-3">
                    <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary mt-0.5">
                      <Wrench size={18} />
                    </span>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold leading-tight">Repair Expired Sessions</p>
                        <span className="inline-flex items-center h-5 px-1.5 rounded-md border bg-red-500/10 text-red-400 border-red-500/20 text-[10px] font-semibold leading-none">
                          Destructive
                        </span>
                      </div>
                      <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug">
                        Force-complete past sessions still showing as Upcoming.
                      </p>
                    </div>
                  </div>
                  <RepairExpiredSessions />
                </div>
              )}
            </div>
          </section>
        ))}

        {/* Scalability note — future tools dropped into a group above auto-fit here */}
        <p className="text-[11px] text-muted-foreground/50 text-center pb-2">
          New tools are added under Business · Operations · System · Advanced.
        </p>
      </div>
    </div>
  );
}
