import { Link, useLocation } from "wouter";
import { useState } from "react";
import {
  Home,
  CalendarDays,
  Plus,
  TrendingUp,
  MoreHorizontal,
  Package,
  History,
  Heart,
  Settings,
  LogOut,
  X,
  MessageCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/i18n";
import { whatsappUrl, DEFAULT_WHATSAPP_NUMBER } from "@/lib/whatsapp";

export function ClientBottomNav() {
  const { user, logoutMutation } = useAuth();
  const { t } = useTranslation();
  const [location] = useLocation();
  const [moreOpen, setMoreOpen] = useState(false);

  if (!user || user.role !== "client") return null;

  const moreItems = [
    { icon: Package, label: t("nav.myPackage", "My Package"), href: "/dashboard#packages" },
    { icon: History, label: t("nav.history", "History"), href: "/dashboard#activity" },
    { icon: Heart, label: t("nav.recovery", "Recovery"), href: "/recovery" },
    { icon: Settings, label: t("nav.settings", "Settings"), href: "/profile" },
    {
      icon: MessageCircle,
      label: t("nav.messageCoach", "Message Coach"),
      href: whatsappUrl(DEFAULT_WHATSAPP_NUMBER),
      external: true,
    },
  ];

  return (
    <>
      <AnimatePresence>
        {moreOpen && (
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {moreOpen && (
          <motion.div
            key="sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 32, stiffness: 320 }}
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl border-t border-white/[0.08] bg-[#080808] overflow-y-auto"
            style={{
              maxHeight: "70dvh",
              paddingBottom: "max(env(safe-area-inset-bottom, 0px), 24px)",
            }}
            data-testid="client-more-sheet"
          >
            <div className="px-5 pt-5">
              <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-white/20" />
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[10px] font-semibold text-white/50 uppercase tracking-[0.2em]">
                  {t("nav.more", "More")}
                </h3>
                <button
                  type="button"
                  onClick={() => setMoreOpen(false)}
                  className="grid h-7 w-7 place-items-center rounded-full bg-white/[0.06] text-muted-foreground hover:bg-white/10 transition-colors"
                  data-testid="button-close-more-sheet"
                >
                  <X size={14} />
                </button>
              </div>

              <nav className="space-y-0.5 pb-2">
                {moreItems.map(({ icon: Icon, label, href, external }) =>
                  external ? (
                    <a
                      key={label}
                      href={href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm text-foreground/75 hover:bg-white/[0.05] hover:text-foreground transition-colors"
                    >
                      <Icon size={16} className="shrink-0 text-muted-foreground/60" />
                      <span>{label}</span>
                    </a>
                  ) : (
                    <Link
                      key={label}
                      href={href}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm text-foreground/75 hover:bg-white/[0.05] hover:text-foreground transition-colors"
                    >
                      <Icon size={16} className="shrink-0 text-muted-foreground/60" />
                      <span>{label}</span>
                    </Link>
                  )
                )}

                <div className="my-2 border-t border-white/[0.06]" />

                <button
                  type="button"
                  onClick={() => {
                    setMoreOpen(false);
                    logoutMutation.mutate();
                  }}
                  disabled={logoutMutation.isPending}
                  data-testid="button-bottom-nav-logout"
                  className="flex w-full items-center gap-3.5 rounded-2xl px-4 py-3.5 text-sm text-red-400/80 hover:bg-red-500/[0.08] hover:text-red-400 transition-colors disabled:opacity-50"
                >
                  <LogOut size={16} className="shrink-0" />
                  <span>{t("nav.logout", "Log out")}</span>
                </button>
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav
        className="fixed bottom-0 left-0 right-0 z-30 border-t border-white/[0.07] bg-[#050505]/95 backdrop-blur-xl md:hidden"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 8px)" }}
        data-testid="client-bottom-nav"
      >
        <div className="mx-auto flex max-w-lg items-end justify-around px-2 pt-2">
          <BottomNavItem
            icon={Home}
            label={t("nav.home", "Home")}
            href="/dashboard"
            active={location === "/dashboard"}
            testId="nav-home"
          />

          <BottomNavItem
            icon={CalendarDays}
            label={t("nav.training", "Training")}
            href="/dashboard?tab=bookings"
            active={false}
            testId="nav-training"
          />

          <Link href="/book" data-testid="nav-book" className="flex flex-col items-center -mt-5">
            <span
              className="h-[54px] w-[54px] rounded-full bg-primary grid place-items-center border border-primary/30 transition-transform active:scale-95"
              style={{ boxShadow: "0 0 18px -2px hsl(183 100% 60% / 0.5)" }}
            >
              <Plus size={22} className="text-black" strokeWidth={2.5} />
            </span>
            <span className="mt-1.5 text-[10px] font-semibold text-primary leading-none">
              {t("nav.book", "Book")}
            </span>
          </Link>

          <BottomNavItem
            icon={TrendingUp}
            label={t("nav.progress", "Progress")}
            href="/dashboard?tab=progress"
            active={false}
            testId="nav-progress"
          />

          <button
            type="button"
            onClick={() => setMoreOpen(true)}
            data-testid="nav-more"
            className="flex flex-col items-center gap-1 px-3 pb-1 min-w-[48px]"
          >
            <MoreHorizontal size={22} className="text-muted-foreground/60" />
            <span className="text-[10px] text-muted-foreground/60 leading-none">
              {t("nav.more", "More")}
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}

function BottomNavItem({
  icon: Icon,
  label,
  href,
  active,
  testId,
}: {
  icon: typeof Home;
  label: string;
  href: string;
  active: boolean;
  testId: string;
}) {
  return (
    <Link
      href={href}
      data-testid={testId}
      className="flex flex-col items-center gap-1 px-3 pb-1 min-w-[48px]"
    >
      <Icon
        size={22}
        className={active ? "text-primary" : "text-muted-foreground/60"}
      />
      <span
        className={`text-[10px] leading-none ${
          active ? "text-primary font-semibold" : "text-muted-foreground/60"
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
