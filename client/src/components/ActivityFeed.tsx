import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNow } from "date-fns";
import {
  Activity as ActivityIcon,
  CalendarCheck,
  CalendarPlus,
  CalendarX,
  Camera,
  ClipboardCheck,
  LineChart as LineChartIcon,
  Package as PackageIcon,
  Scale,
  StickyNote,
} from "lucide-react";

export type ActivityKind =
  | "session_completed"
  | "session_booked"
  | "session_cancelled"
  | "package_activated"
  | "body_metric"
  | "weekly_checkin"
  | "inbody"
  | "progress_photo"
  | "coach_note";

export type ActivityEvent = {
  id: string;
  kind: ActivityKind;
  at: string;
  title: string;
  subtitle?: string | null;
};

const KIND_META: Record<
  ActivityKind,
  { Icon: typeof ActivityIcon; tone: string; ring: string }
> = {
  session_completed: { Icon: CalendarCheck, tone: "text-emerald-300", ring: "ring-emerald-400/30" },
  session_booked: { Icon: CalendarPlus, tone: "text-sky-300", ring: "ring-sky-400/30" },
  session_cancelled: { Icon: CalendarX, tone: "text-rose-300", ring: "ring-rose-400/30" },
  package_activated: { Icon: PackageIcon, tone: "text-amber-300", ring: "ring-amber-400/30" },
  body_metric: { Icon: Scale, tone: "text-indigo-300", ring: "ring-indigo-400/30" },
  weekly_checkin: { Icon: ClipboardCheck, tone: "text-violet-300", ring: "ring-violet-400/30" },
  inbody: { Icon: ActivityIcon, tone: "text-cyan-300", ring: "ring-cyan-400/30" },
  progress_photo: { Icon: Camera, tone: "text-fuchsia-300", ring: "ring-fuchsia-400/30" },
  coach_note: { Icon: StickyNote, tone: "text-yellow-300", ring: "ring-yellow-400/30" },
};

export function ActivityFeed({
  endpoint,
  emptyLabel = "No activity yet",
  title = "Activity",
}: {
  endpoint: string;
  emptyLabel?: string;
  title?: string;
}) {
  const { data, isLoading, isError } = useQuery<ActivityEvent[]>({
    queryKey: [endpoint],
  });

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-white/60" data-testid="activity-loading">
        <LineChartIcon className="mr-2 inline" size={16} /> Loading activity…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="rounded-2xl border border-rose-400/20 bg-rose-500/10 p-6 text-rose-200" data-testid="activity-error">
        Failed to load activity.
      </div>
    );
  }
  const events = data ?? [];
  if (!events.length) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-8 text-center text-white/60" data-testid="activity-empty">
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className="space-y-3" data-testid="activity-feed">
      <h3 className="text-sm font-medium uppercase tracking-wider text-white/50">{title}</h3>
      <ol className="relative ml-3 border-l border-white/10 pl-5">
        {events.map((e) => {
          const meta = KIND_META[e.kind] ?? KIND_META.session_booked;
          const Icon = meta.Icon;
          let when = "";
          try {
            const d = new Date(e.at);
            when = `${formatDistanceToNow(d, { addSuffix: true })} · ${format(d, "PPp")}`;
          } catch {
            when = e.at;
          }
          return (
            <li
              key={e.id}
              className="relative mb-5 last:mb-0"
              data-testid={`activity-event-${e.id}`}
            >
              <span
                className={`absolute -left-[34px] top-1 grid h-7 w-7 place-items-center rounded-full bg-black ring-2 ${meta.ring}`}
                aria-hidden
              >
                <Icon size={14} className={meta.tone} />
              </span>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 hover:bg-white/[0.06] transition">
                <p className="text-sm font-medium text-white" data-testid={`activity-title-${e.id}`}>
                  {e.title}
                </p>
                {e.subtitle ? (
                  <p className="mt-0.5 text-xs text-white/60" data-testid={`activity-subtitle-${e.id}`}>
                    {e.subtitle}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] uppercase tracking-wider text-white/40">{when}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
