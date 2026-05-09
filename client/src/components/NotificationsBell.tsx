import { useState } from "react";
import { Link } from "wouter";
import { Bell, Check, CheckCheck, Calendar, AlertTriangle, Sparkles, Pill, Apple, MessageCircle, CreditCard, Trophy, Info } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkAllNotificationsRead,
  useMarkNotificationRead,
} from "@/hooks/use-notifications";
import type { ClientNotification, NotificationKind } from "@shared/schema";

const ICONS: Record<NotificationKind, typeof Bell> = {
  session_reminder: Calendar,
  package_expiring: AlertTriangle,
  missed_checkin: AlertTriangle,
  nutrition_update: Apple,
  supplement_reminder: Pill,
  coach_message: MessageCircle,
  payment_reminder: CreditCard,
  milestone: Trophy,
  system: Info,
};

const ACCENT: Record<NotificationKind, string> = {
  session_reminder: "text-blue-300",
  package_expiring: "text-amber-300",
  missed_checkin: "text-amber-300",
  nutrition_update: "text-emerald-300",
  supplement_reminder: "text-purple-300",
  coach_message: "text-blue-300",
  payment_reminder: "text-rose-300",
  milestone: "text-yellow-300",
  system: "text-white/70",
};

function timeAgo(iso: string | Date | null): string {
  if (!iso) return "";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}

function NotificationRow({
  notif,
  onRead,
  onClose,
}: {
  notif: ClientNotification;
  onRead: (id: number) => void;
  onClose: () => void;
}) {
  const Icon = ICONS[notif.kind as NotificationKind] ?? Info;
  const accent = ACCENT[notif.kind as NotificationKind] ?? "text-white/70";
  const unread = !notif.readAt;

  const body = (
    <div
      className={cn(
        "flex gap-3 px-4 py-3 border-b border-white/5 hover:bg-white/[0.04] transition-colors",
        unread && "bg-white/[0.025]",
      )}
      data-testid={`notification-row-${notif.id}`}
    >
      <div className={cn("shrink-0 mt-0.5", accent)}>
        <Icon size={16} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <p className={cn("text-sm font-medium truncate flex-1", unread ? "text-white" : "text-white/70")}>
            {notif.title}
          </p>
          {unread && (
            <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-blue-400 shrink-0" aria-label="unread" />
          )}
        </div>
        {notif.body && (
          <p className="text-xs text-white/60 mt-0.5 line-clamp-2 whitespace-pre-wrap">{notif.body}</p>
        )}
        <p className="text-[10px] uppercase tracking-wider text-white/40 mt-1">
          {timeAgo(notif.createdAt)}
        </p>
      </div>
    </div>
  );

  const handleClick = () => {
    if (unread) onRead(notif.id);
    onClose();
  };

  if (notif.link) {
    return (
      <Link
        href={notif.link}
        onClick={handleClick}
        className="block focus:outline-none focus:bg-white/[0.06]"
      >
        {body}
      </Link>
    );
  }
  return (
    <button
      type="button"
      onClick={handleClick}
      className="block w-full text-left focus:outline-none focus:bg-white/[0.06]"
    >
      {body}
    </button>
  );
}

export function NotificationsBell({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);
  const { data: countData } = useUnreadNotificationCount();
  const { data: list = [], isLoading } = useNotifications({ limit: 30 });
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();
  const count = countData?.count ?? 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          data-testid="button-notifications-bell"
          className={cn(
            "relative inline-flex items-center justify-center h-9 w-9 rounded-full border border-white/10 hover:bg-white/5 hover:border-white/20 transition-colors btn-soft",
            className,
          )}
        >
          <Bell size={16} className="text-white/80" />
          {count > 0 && (
            <span
              data-testid="badge-notifications-unread"
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center border-2 border-background"
            >
              {count > 99 ? "99+" : count}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        sideOffset={10}
        className="w-[min(380px,calc(100vw-1.5rem))] p-0 bg-background/95 backdrop-blur-xl border-white/10 shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Bell size={14} className="text-white/70" />
            <h3 className="text-sm font-semibold text-white">Notifications</h3>
            {count > 0 && (
              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-medium">
                {count} new
              </span>
            )}
          </div>
          {count > 0 && (
            <button
              type="button"
              data-testid="button-notifications-mark-all-read"
              onClick={() => markAll.mutate()}
              disabled={markAll.isPending}
              className="text-[11px] text-blue-300 hover:text-blue-200 inline-flex items-center gap-1 disabled:opacity-50"
            >
              <CheckCheck size={12} /> Mark all read
            </button>
          )}
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {isLoading && (
            <div className="px-4 py-8 text-center text-xs text-white/50" data-testid="notifications-loading">
              Loading…
            </div>
          )}
          {!isLoading && list.length === 0 && (
            <div className="px-6 py-10 text-center" data-testid="notifications-empty">
              <div className="mx-auto w-12 h-12 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-3">
                <Sparkles size={18} className="text-white/40" />
              </div>
              <p className="text-sm font-medium text-white/80">You're all caught up</p>
              <p className="text-xs text-white/50 mt-1">
                Reminders, milestones, and coach messages will appear here.
              </p>
            </div>
          )}
          {!isLoading &&
            list.map((n) => (
              <NotificationRow
                key={n.id}
                notif={n}
                onRead={(id) => markRead.mutate(id)}
                onClose={() => setOpen(false)}
              />
            ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
