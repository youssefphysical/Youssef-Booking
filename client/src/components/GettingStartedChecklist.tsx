import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  CheckCircle2,
  Circle,
  ArrowRight,
  Calendar,
  Activity,
  Image as ImageIcon,
  Target,
  Sparkles,
} from "lucide-react";
import { useBookings } from "@/hooks/use-bookings";
import { usePackages } from "@/hooks/use-packages";
import { useInbodyRecords } from "@/hooks/use-inbody";
import { useProgressPhotos } from "@/hooks/use-progress";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/i18n";

type Step = {
  key: string;
  done: boolean;
  icon: typeof Calendar;
  title: string;
  desc: string;
  href: string;
  cta: string;
};

export function GettingStartedChecklist() {
  const { user } = useAuth();
  const { t } = useTranslation();
  const { data: bookings = [] } = useBookings();
  const { data: packages = [] } = usePackages();
  const userId = user?.id;
  const { data: inbody = [] } = useInbodyRecords({ userId });
  const { data: photos = [] } = useProgressPhotos({ userId });

  if (!user || user.role !== "client") return null;

  const hasGoal = Boolean(user.primaryGoal);
  const hasPackage = packages.length > 0;
  const hasBooking = bookings.length > 0;
  const hasInbody = inbody.length > 0;
  const hasPhoto = photos.length > 0;

  const steps: Step[] = [
    {
      key: "goal",
      done: hasGoal,
      icon: Target,
      title: t("onboard.goal.title", "Set your primary goal"),
      desc: t("onboard.goal.desc", "Tell your coach what you're training for."),
      href: "/profile",
      cta: t("onboard.goal.cta", "Set goal"),
    },
    {
      key: "booking",
      done: hasBooking,
      icon: Calendar,
      title: t("onboard.booking.title", "Book your first session"),
      desc: t("onboard.booking.desc", "Pick a slot that fits your week."),
      href: "/book",
      cta: t("onboard.booking.cta", "Book now"),
    },
    {
      key: "inbody",
      done: hasInbody,
      icon: Activity,
      title: t("onboard.inbody.title", "Upload your first InBody scan"),
      desc: t("onboard.inbody.desc", "Establish a baseline to track real progress."),
      href: "/dashboard?tab=inbody",
      cta: t("onboard.inbody.cta", "Upload scan"),
    },
    {
      key: "photo",
      done: hasPhoto,
      icon: ImageIcon,
      title: t("onboard.photo.title", "Add a starting progress photo"),
      desc: t("onboard.photo.desc", "Future-you will thank you for the before shot."),
      href: "/dashboard?tab=progress",
      cta: t("onboard.photo.cta", "Add photo"),
    },
  ];

  const completed = steps.filter((s) => s.done).length;
  const total = steps.length;
  const progressPct = Math.round((completed / total) * 100);

  // Hide once everything is done — no point cluttering the dashboard
  // for established clients. Also hide for clients with no package
  // assigned AND no bookings — they need the membership block first.
  if (completed === total) return null;
  if (!hasPackage && completed === 0) {
    // Show only if they have a package OR have made some progress —
    // brand-new pre-package clients are guided by the membership block
    // and the WhatsApp packages CTA on the homepage instead.
    // But if they've already taken any step we still want to celebrate it.
  }

  // Find the next step to highlight as the recommended action
  const nextStep = steps.find((s) => !s.done);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-card/40 p-4 sm:p-6"
      data-testid="getting-started-checklist"
    >

      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <p className="inline-flex items-center gap-1.5 text-[10.5px] uppercase tracking-[0.22em] text-white/55 font-medium">
            <Sparkles size={12} /> {t("onboard.eyebrow", "Getting started")}
          </p>
          <h2 className="mt-1.5 text-lg sm:text-[20px] font-medium text-white/95 tracking-tight">
            {t("onboard.title", "A few quick steps to set you up for results")}
          </h2>
          <p className="mt-1 text-xs sm:text-[13px] text-white/60 max-w-xl">
            {t(
              "onboard.subtitle",
              "Most clients who finish these in week one stay consistent for months. Take them one at a time.",
            )}
          </p>
        </div>
        <div
          className="shrink-0 inline-flex items-center gap-2 rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1 text-[11px] font-medium text-white/70"
          data-testid="onboard-progress-badge"
        >
          {completed} / {total}
        </div>
      </header>

      {/* Progress bar */}
      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-white/5">
        <motion.div
          className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
          initial={{ width: 0 }}
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        />
      </div>

      {/* Steps grid */}
      <ul className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {steps.map((s) => {
          const isNext = s === nextStep;
          const Icon = s.icon;
          return (
            <li key={s.key}>
              <Link
                href={s.href}
                data-testid={`onboard-step-${s.key}`}
                className={[
                  "group flex items-start gap-3 rounded-2xl border p-3.5 transition-all",
                  s.done
                    ? "border-emerald-400/20 bg-emerald-400/[0.04] hover:bg-emerald-400/[0.07]"
                    : isNext
                      ? "border-primary/35 bg-primary/[0.06] hover:bg-primary/[0.10] hover:border-primary/55"
                      : "border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20",
                ].join(" ")}
              >
                <span
                  className={[
                    "mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ring-1 transition-colors",
                    s.done
                      ? "bg-emerald-400/15 ring-emerald-400/30"
                      : isNext
                        ? "bg-primary/15 ring-primary/35"
                        : "bg-white/5 ring-white/10",
                  ].join(" ")}
                >
                  {s.done ? (
                    <CheckCircle2 size={16} className="text-emerald-300" />
                  ) : (
                    <Icon size={15} className={isNext ? "text-primary" : "text-white/70"} />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p
                      className={[
                        "text-sm font-semibold truncate",
                        s.done ? "text-white/55 line-through decoration-white/30" : "text-white",
                      ].join(" ")}
                    >
                      {s.title}
                    </p>
                    {isNext && !s.done && (
                      <span className="inline-flex items-center rounded-full bg-primary/20 px-2 py-0.5 text-[9.5px] uppercase tracking-[0.18em] font-bold text-primary">
                        {t("onboard.next", "Next")}
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-white/55 line-clamp-1">{s.desc}</p>
                </div>
                {!s.done && (
                  <span
                    className="ms-auto inline-flex items-center gap-1 self-center text-xs font-semibold text-primary/90 group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity hidden sm:inline-flex"
                    aria-hidden="true"
                  >
                    {s.cta}
                    <ArrowRight size={12} className="rtl:rotate-180" />
                  </span>
                )}
                {s.done && (
                  <Circle size={0} aria-hidden="true" className="hidden" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </motion.section>
  );
}
