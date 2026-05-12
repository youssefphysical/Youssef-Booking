import { Link } from "wouter";
import { motion } from "framer-motion";
import { Calendar, ClipboardCheck, TrendingUp, MessageCircle } from "lucide-react";
import { whatsappUrl, DEFAULT_WHATSAPP_NUMBER } from "@/lib/whatsapp";
import { useTranslation } from "@/i18n";

// Phase 1 luxury Quick Actions tile grid (May 2026 client profile redesign).
// 4 large touch-friendly tiles immediately under the hero — replaces the
// single "New Booking" button that used to live in the header.
// All onJump targets are existing dashboard tabs, so no new routes.

type Action = {
  testId: string;
  icon: typeof Calendar;
  label: string;
  sub: string;
  href?: string;
  external?: boolean;
  onClick?: () => void;
  glow: string; // tailwind gradient for the soft tile background
  ringGlow: string; // hover ring tone
};

export function QuickActionsGrid({ onJump }: { onJump: (tab: string) => void }) {
  const { t } = useTranslation();

  const actions: Action[] = [
    {
      testId: "quick-action-book",
      icon: Calendar,
      label: t("dashboard.quick.book", "Book Session"),
      sub: t("dashboard.quick.bookSub", "Reserve your next slot"),
      href: "/book",
      glow: "from-primary/25 via-primary/[0.08] to-transparent",
      ringGlow: "group-hover:ring-primary/45 group-hover:text-primary",
    },
    {
      testId: "quick-action-checkin",
      icon: ClipboardCheck,
      label: t("dashboard.quick.checkin", "Weekly Check-In"),
      sub: t("dashboard.quick.checkinSub", "Log how the week went"),
      onClick: () => onJump("checkins"),
      glow: "from-emerald-500/25 via-emerald-500/[0.06] to-transparent",
      ringGlow: "group-hover:ring-emerald-400/45 group-hover:text-emerald-300",
    },
    {
      testId: "quick-action-progress",
      icon: TrendingUp,
      label: t("dashboard.quick.progress", "View Progress"),
      sub: t("dashboard.quick.progressSub", "Photos, body, trends"),
      onClick: () => onJump("progress"),
      glow: "from-violet-500/25 via-violet-500/[0.06] to-transparent",
      ringGlow: "group-hover:ring-violet-400/45 group-hover:text-violet-300",
    },
    {
      testId: "quick-action-coach",
      icon: MessageCircle,
      label: t("dashboard.quick.coach", "Message Coach"),
      sub: t("dashboard.quick.coachSub", "Direct line on WhatsApp"),
      href: whatsappUrl(DEFAULT_WHATSAPP_NUMBER),
      external: true,
      glow: "from-cyan-500/25 via-cyan-500/[0.06] to-transparent",
      ringGlow: "group-hover:ring-cyan-400/45 group-hover:text-cyan-300",
    },
  ];

  return (
    <section
      className="mb-6 grid grid-cols-2 lg:grid-cols-4 gap-3"
      data-testid="quick-actions-grid"
    >
      {actions.map((a, i) => {
        const Icon = a.icon;
        const tile = (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay: 0.05 + i * 0.05 }}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={`group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br ${a.glow} bg-card/30 p-4 sm:p-5 h-full min-h-[120px] sm:min-h-[136px] transition-colors hover:border-white/20`}
          >
            {/* Hover-only corner halo to sell the "luxury button" feel */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-12 -right-12 h-28 w-28 rounded-full opacity-0 transition-opacity duration-500 group-hover:opacity-70"
              style={{
                background:
                  "radial-gradient(circle, hsl(183 100% 60% / 0.22), transparent 70%)",
              }}
            />
            <span
              className={`relative grid h-11 w-11 sm:h-12 sm:w-12 place-items-center rounded-xl bg-white/[0.06] ring-1 ring-white/15 text-foreground transition-colors ${a.ringGlow}`}
            >
              <Icon size={20} className="sm:[&]:size-[22px]" />
            </span>
            <p className="relative mt-3 text-sm sm:text-base font-display font-semibold leading-tight">
              {a.label}
            </p>
            <p className="relative mt-1 text-[11px] sm:text-xs text-muted-foreground/90 line-clamp-2">
              {a.sub}
            </p>
          </motion.div>
        );

        if (a.external && a.href) {
          return (
            <a
              key={a.testId}
              href={a.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
              data-testid={a.testId}
            >
              {tile}
            </a>
          );
        }
        if (a.onClick) {
          return (
            <button
              key={a.testId}
              type="button"
              onClick={a.onClick}
              className="text-left"
              data-testid={a.testId}
            >
              {tile}
            </button>
          );
        }
        return (
          <Link
            key={a.testId}
            href={a.href ?? "#"}
            className="block"
            data-testid={a.testId}
          >
            {tile}
          </Link>
        );
      })}
    </section>
  );
}
