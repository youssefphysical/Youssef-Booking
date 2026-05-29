import { Link } from "wouter";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { RepairExpiredSessions } from "@/components/admin/RepairExpiredSessions";

interface HubItem {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  testId: string;
}

interface HubGroup {
  id: string;
  label: string;
  items?: HubItem[];
  custom?: React.ReactNode;
}

const GROUPS: HubGroup[] = [
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
      },
    ],
  },
];

export default function AdminMore() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-6 space-y-8" data-testid="page-admin-more">
      <div>
        <h1 className="text-xl font-bold tracking-tight">More</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Tools, system settings, and advanced operations.
        </p>
      </div>

      {GROUPS.map((group) => (
        <section key={group.id} data-testid={`more-group-${group.id}`}>
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70 mb-2 px-1">
            {group.label}
          </h2>

          <div className="rounded-2xl border border-white/[0.07] bg-card/60 overflow-hidden divide-y divide-white/[0.05]">
            {group.items?.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                data-testid={item.testId}
                className={cn(
                  "flex items-center gap-4 px-4 py-3.5",
                  "hover:bg-white/[0.04] active:bg-white/[0.06] transition-colors",
                )}
              >
                <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary">
                  {item.icon}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold leading-tight">{item.title}</p>
                  <p className="text-[11.5px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">
                    {item.description}
                  </p>
                </div>
                <ChevronRight size={15} className="shrink-0 text-muted-foreground/50 rtl:rotate-180" />
              </Link>
            ))}

            {group.id === "advanced" && (
              <div className="px-4 py-4" data-testid="more-repair-expired-sessions">
                <div className="flex items-start gap-4 mb-3">
                  <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 text-primary mt-0.5">
                    <Wrench size={18} />
                  </span>
                  <div>
                    <p className="text-sm font-semibold leading-tight">Repair Expired Sessions</p>
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
    </div>
  );
}
