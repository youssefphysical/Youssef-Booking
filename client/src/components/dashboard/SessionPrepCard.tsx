import { useMemo, useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Droplet, Footprints, Timer, X } from "lucide-react";
import { useBookings } from "@/hooks/use-bookings";
import type { Booking } from "@shared/schema";
import { useTranslation } from "@/i18n";

const DISMISS_KEY_PREFIX = "sessionPrepDismissed:";

function readDismissed(bookingId: number): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(`${DISMISS_KEY_PREFIX}${bookingId}`) === "1";
  } catch {
    return false;
  }
}

function persistDismissed(bookingId: number) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(`${DISMISS_KEY_PREFIX}${bookingId}`, "1");
  } catch {/* swallow quota errors */}
}

/**
 * Task #56 — Session preparation card.
 * Shows three quick "before your session" bullets when the client's
 * next session is within the next 24 hours. Dismissible per booking
 * (state persisted in localStorage so it doesn't bounce on refresh).
 * Pure read from `useBookings`; renders nothing when there's no
 * imminent session, or once dismissed.
 */
export function SessionPrepCard({ userId }: { userId: number }) {
  const { t } = useTranslation();
  const { data: bookings = [] } = useBookings({ userId });

  // Task #56: surface prep guidance for the next upcoming session — no
  // time-gate so the card is informative ahead of every booking, not
  // just last-24h. Dismissal is per-booking so it auto-resets when the
  // next session rolls in.
  const nextSoon = useMemo(() => {
    const now = Date.now();
    return (bookings as Booking[])
      .filter((b) => {
        const s = (b.status ?? "").toLowerCase();
        if (!["upcoming", "confirmed"].includes(s)) return false;
        if (!b.date || !b.timeSlot) return false;
        const ts = new Date(`${b.date}T${b.timeSlot}:00+04:00`).getTime();
        return ts >= now;
      })
      .sort((a, b) => (a.date + a.timeSlot).localeCompare(b.date + b.timeSlot))[0];
  }, [bookings]);

  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(nextSoon ? readDismissed(nextSoon.id) : false);
  }, [nextSoon?.id]);

  if (!nextSoon || dismissed) return null;

  const bullets = [
    {
      icon: <Timer size={14} />,
      label: t(
        "dashboard.prepArrive",
        "Arrive 5 minutes early to warm up.",
      ),
    },
    {
      icon: <Droplet size={14} />,
      label: t(
        "dashboard.prepHydrate",
        "Hydrate well — 500 ml of water in the hour before.",
      ),
    },
    {
      icon: <Footprints size={14} />,
      label: t(
        "dashboard.prepShoes",
        "Bring training shoes and a small towel.",
      ),
    },
  ];

  return (
    <AnimatePresence>
      <motion.section
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="relative mb-6 overflow-hidden rounded-2xl border border-cyan-400/20 bg-gradient-to-br from-cyan-500/[0.07] via-cyan-500/[0.02] to-transparent p-4 sm:p-5"
        data-testid="session-prep-card"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-300/80 font-semibold mb-2">
              {t("dashboard.prepEyebrow", "Prep for your next session")}
            </p>
            <ul className="space-y-2">
              {bullets.map((b, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2.5 text-sm text-foreground/85 leading-snug"
                >
                  <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full bg-cyan-500/10 text-cyan-300">
                    {b.icon}
                  </span>
                  <span>{b.label}</span>
                </li>
              ))}
            </ul>
          </div>
          <button
            type="button"
            onClick={() => {
              persistDismissed(nextSoon.id);
              setDismissed(true);
            }}
            className="shrink-0 -mr-1 -mt-1 grid h-8 w-8 place-items-center rounded-full text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
            aria-label={t("dashboard.dismiss", "Dismiss")}
            data-testid="button-prep-dismiss"
          >
            <X size={14} />
          </button>
        </div>
      </motion.section>
    </AnimatePresence>
  );
}

export default SessionPrepCard;
