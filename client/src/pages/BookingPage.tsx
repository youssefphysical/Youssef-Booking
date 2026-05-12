import { useState, useMemo, useEffect } from "react";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, Link } from "wouter";
import {
  Loader2,
  Calendar as CalendarIcon,
  Clock,
  Lock,
  CheckCircle2,
  ShieldAlert,
  Coffee,
  AlertTriangle,
  Users,
  Package as PackageIcon,
  Sparkles,
  Gift,
  Wallet,
  CreditCard,
  Dumbbell,
  Target,
  UserPlus,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { useCreateBooking, useBookings } from "@/hooks/use-bookings";
import { useBlockedSlots } from "@/hooks/use-blocked-slots";
import { useSettings } from "@/hooks/use-settings";
import { useAuth } from "@/hooks/use-auth";
import { usePackages } from "@/hooks/use-packages";
import {
  type Package,
  SESSION_FOCUS_GROUPS,
  BOOKING_TRAINING_GOALS,
  evaluateBookingEligibility,
} from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ALL_TIME_SLOTS,
  buildSessionDate,
  bookingCutoffMs,
  dubaiTodayYMD,
  dubaiTodayAsLocalDate,
  formatYMDInDubai,
} from "@/lib/booking-utils";
import { formatTime12 } from "@/lib/time-format";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useTranslation } from "@/i18n";

type SessionTypeChoice = "package" | "single" | "trial" | "duo";
type SessionFocus = (typeof SESSION_FOCUS_GROUPS)["upper"][number] | (typeof SESSION_FOCUS_GROUPS)["lower"][number] | (typeof SESSION_FOCUS_GROUPS)["conditioning"][number];
type TrainingGoal = (typeof BOOKING_TRAINING_GOALS)[number];

export default function BookingPage() {
  const { t } = useTranslation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, navigate] = useLocation();

  // Booking-safety (May 2026): anonymous visitors must authenticate before
  // they can see the slot picker — server already enforces requireAuth on
  // POST /api/bookings, this just gives a graceful UX (no flash of the
  // booking form, deep-link back to /book after sign-in).
  useEffect(() => {
    if (!isAuthLoading && !user) {
      navigate("/auth?redirect=/book");
    }
  }, [isAuthLoading, user, navigate]);
  // Default to *Dubai* today, not browser-local today. A device sitting in a
  // timezone ahead of Dubai (or with a wrong clock) would otherwise default the
  // picker to Dubai-tomorrow, making early-morning slots erroneously appear
  // available because they are >6h away in absolute terms but are not the
  // calendar day the user thinks they are looking at.
  const [date, setDate] = useState<Date | undefined>(() => dubaiTodayAsLocalDate());
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [sessionType, setSessionType] = useState<SessionTypeChoice>("package");
  const [sessionFocus, setSessionFocus] = useState<SessionFocus | null>(null);
  // Premium segmented category selector — only the chips for the active
  // category are shown, eliminating the chip-overcrowding the prior layout
  // suffered from. Defaults to "upper" but auto-syncs to whichever group
  // contains the currently-selected chip so a deep-link / restored selection
  // never lands the user on the wrong tab.
  type FocusCategory = "upper" | "lower" | "conditioning";
  const focusCategoryOf = (f: SessionFocus | null): FocusCategory => {
    if (!f) return "upper";
    if ((SESSION_FOCUS_GROUPS.upper as readonly string[]).includes(f)) return "upper";
    if ((SESSION_FOCUS_GROUPS.lower as readonly string[]).includes(f)) return "lower";
    return "conditioning";
  };
  const [activeFocusCategory, setActiveFocusCategory] = useState<FocusCategory>(() =>
    focusCategoryOf(sessionFocus),
  );
  useEffect(() => {
    if (sessionFocus) setActiveFocusCategory(focusCategoryOf(sessionFocus));
  }, [sessionFocus]);
  const [trainingGoal, setTrainingGoal] = useState<TrainingGoal | null>(null);
  // Surfaces inline "required" hints under the missing field only after the
  // user attempts to continue — keeps the form quiet on first render but
  // explicit on submit.
  const [attemptedContinue, setAttemptedContinue] = useState(false);
  // Duo partner snapshot — only sent when sessionType === "duo".
  // partnerName is REQUIRED for Duo bookings; phone/email are optional.
  const [partnerName, setPartnerName] = useState("");
  const [partnerPhone, setPartnerPhone] = useState("");
  const [partnerEmail, setPartnerEmail] = useState("");

  const createBooking = useCreateBooking();
  const { data: blocked = [] } = useBlockedSlots();
  const { data: settings } = useSettings();
  const { data: existing = [] } = useBookings({ from: dubaiTodayYMD() });
  const { data: packages = [] } = usePackages({ userId: user?.id });

  const isAdmin = user?.role === "admin";
  const hasUsedFreeTrial = !!user?.hasUsedFreeTrial;
  const activePackage = (packages as Package[]).find(
    (p) => p.isActive && p.usedSessions < p.totalSessions,
  );
  const sessionsLeft = activePackage
    ? activePackage.totalSessions - activePackage.usedSessions
    : 0;

  // Format the picker's selected date in Dubai TZ (not browser-local) so the
  // YYYY-MM-DD we send to the slot filter and the booking API matches the
  // visible Dubai civil date the user clicked.
  const dateStr = date ? formatYMDInDubai(date) : "";

  const wholeDayBlock = useMemo(() => {
    return blocked.find((b) => b.date === dateStr && b.timeSlot === null);
  }, [blocked, dateStr]);

  // Recompute slot states every 30s as wall-clock time advances. Without this,
  // `slotState`'s useMemo would only fire when date/blocked/existing changes —
  // a user who opened the page at 09:30 would still see 13:00 as "available"
  // at 10:47 even though `Date.now()` has long since crossed the 6h cutoff.
  const [nowTick, setNowTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setNowTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  // Determine which slots are unavailable on the selected date
  const slotState = useMemo(() => {
    const map: Record<string, "available" | "blocked" | "taken" | "past" | "tooSoon"> = {};
    if (!date) return map;
    void nowTick; // include tick in deps so this recomputes as time passes
    const wholeDayBlocked = blocked.some((b) => b.date === dateStr && b.timeSlot === null);
    for (const slot of ALL_TIME_SLOTS) {
      if (wholeDayBlocked) {
        map[slot] = "blocked";
        continue;
      }
      const slotBlocked = blocked.some((b) => b.date === dateStr && b.timeSlot === slot);
      if (slotBlocked) {
        map[slot] = "blocked";
        continue;
      }
      const taken = (existing as any[]).some(
        (b) =>
          b.date === dateStr &&
          b.timeSlot === slot &&
          !["cancelled", "free_cancelled", "late_cancelled", "emergency_cancelled"].includes(b.status),
      );
      if (taken) {
        map[slot] = "taken";
        continue;
      }
      const sessionAt = buildSessionDate(dateStr, slot).getTime();
      const now = Date.now();
      if (sessionAt < now) {
        map[slot] = "past";
        continue;
      }
      // Business rule: round current Dubai time UP to the next full hour,
      // then require slots to start at or after that ceiling + 6 booking
      // hours. So at 11:10 Dubai the first allowed slot is 18:00, not 14:10.
      // Applies universally — admins included — per explicit product directive.
      if (sessionAt < bookingCutoffMs(now)) {
        map[slot] = "tooSoon";
        continue;
      }
      map[slot] = "available";
    }
    return map;
  }, [date, dateStr, blocked, existing, isAdmin, nowTick]);

  // Use the same storage key as the global I18nProvider so the email language
  // matches the UI language. (Old key "lang" was a stale leftover.)
  const lang = (typeof window !== "undefined" && (localStorage.getItem("youssef.lang") || localStorage.getItem("lang") || "en")) || "en";

  // Defense-in-depth: in addition to slots being disabled in the grid, never
  // allow the bottom CTA / confirmation modal to open if the selected slot is
  // not currently 'available' (e.g. a slot that became too-soon between picks).
  const selectedSlotAvailable =
    !!selectedSlot && (slotState[selectedSlot] ?? "available") === "available";
  // canContinue is computed AFTER the eligibility const below; declare a
  // forward ref via a function so TS sees it. (eligibility is hoisted via let.)
  const eligibilityOk = isAdmin || evaluateBookingEligibility(user as any, activePackage ?? null).ok;
  // Duo bookings require a partner full name (admins can override).
  const duoPartnerOk =
    isAdmin || sessionType !== "duo" || partnerName.trim().length >= 2;
  const canContinue =
    !!date &&
    !!selectedSlot &&
    selectedSlotAvailable &&
    (isAdmin || (!!sessionFocus && !!trainingGoal)) &&
    duoPartnerOk &&
    eligibilityOk;

  const handleBook = () => {
    if (!date || !selectedSlot || !user) {
      if (!user) navigate("/auth");
      return;
    }
    if (!isAdmin && (!sessionFocus || !trainingGoal)) {
      return;
    }
    if (!isAdmin && sessionType === "duo" && partnerName.trim().length < 2) {
      return;
    }
    const isDuo = sessionType === "duo";
    createBooking.mutate(
      {
        userId: user.id,
        date: dateStr,
        timeSlot: selectedSlot,
        sessionType,
        sessionFocus: sessionFocus ?? undefined,
        trainingGoal: trainingGoal ?? undefined,
        clientNotes: notes || undefined,
        notes: notes || undefined,
        acceptedPolicy: true,
        lang,
        // Send partner snapshot only for Duo bookings; server superRefine
        // also enforces this. Empty optional fields are sent as `undefined`
        // so Zod's union(literal(""), email()) can clear them cleanly.
        partnerFullName: isDuo ? partnerName.trim() : undefined,
        partnerPhone: isDuo && partnerPhone.trim() ? partnerPhone.trim() : undefined,
        partnerEmail: isDuo && partnerEmail.trim() ? partnerEmail.trim() : undefined,
        ...(isAdmin ? { override: true } : {}),
      } as any,
      {
        onSuccess: () => {
          setIsConfirmOpen(false);
          setSubmitted(true);
        },
      },
    );
  };

  const sessionTypeOptions: { value: SessionTypeChoice; label: string; disabled?: boolean; hint?: string }[] = [
    {
      value: "package",
      label: t("booking.sessionPackage"),
      disabled: !isAdmin && !activePackage,
      hint: activePackage
        ? t("booking.hintSessionsLeft").replace("{n}", String(sessionsLeft))
        : t("booking.hintNoActivePackage"),
    },
    { value: "single", label: t("booking.sessionSingle"), hint: t("booking.hintPayPerSession") },
    {
      value: "trial",
      label: t("booking.sessionTrial"),
      disabled: !isAdmin && hasUsedFreeTrial,
      hint: hasUsedFreeTrial && !isAdmin ? t("booking.hintAlreadyUsed") : t("booking.hintNewClientsOnly"),
    },
    { value: "duo", label: t("booking.sessionDuo"), hint: t("booking.hintTrainPartner") },
  ];

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-5 pt-32 pb-20 text-center">
        <div className="rounded-3xl border border-white/10 bg-card/80 p-8">
          <CalendarIcon size={32} className="text-primary mx-auto mb-3" />
          <h2 className="text-2xl font-display font-bold mb-2">{t("booking.signInTitle")}</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {t("booking.signInBody")}
          </p>
          <Button
            onClick={() => navigate("/auth")}
            className="w-full h-12 rounded-xl"
            data-testid="button-go-auth"
          >
            {t("booking.signInCta")}
          </Button>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-md mx-auto px-5 pt-32 pb-20 text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-3xl border border-emerald-500/30 bg-emerald-500/5 p-8"
        >
          <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
            <CheckCircle2 size={32} className="text-emerald-400" />
          </div>
          <h2 className="text-2xl font-display font-bold mb-2" data-testid="text-success-title">
            {t("booking.successTitle")}
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            {t("booking.successBody")}
          </p>
          <div className="flex flex-col gap-3">
            <WhatsAppButton
              label={t("booking.successConfirmWa")}
              message={t("booking.successWaMessage").replace("{date}", dateStr).replace("{time}", formatTime12(selectedSlot ?? ""))}
              size="lg"
              testId="button-confirm-whatsapp"
            />
            <Button
              variant="outline"
              onClick={() => navigate("/dashboard")}
              data-testid="button-go-dashboard"
              className="h-12 rounded-xl"
            >
              {t("booking.viewMySessions")}
            </Button>
          </div>
        </motion.div>
      </div>
    );
  }

  // Eligibility gate (clients only — admins always proceed). Mirrors the
  // server-side check so the UI shows a clear reason BEFORE the user fills
  // out the form.
  const eligibility = isAdmin ? { ok: true as const } : evaluateBookingEligibility(user as any, activePackage ?? null);

  return (
    <div className="max-w-3xl mx-auto px-5 pt-24 pb-32">
      <div className="flex items-center gap-4 mb-8">
        <div className="p-3 bg-primary/15 rounded-2xl text-primary">
          <CalendarIcon size={22} />
        </div>
        <div>
          <h1 className="text-3xl font-display font-bold" data-testid="text-page-title">
            {t("booking.pageTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("booking.pageSubtitle")}</p>
        </div>
      </div>

      {!eligibility.ok && (
        <div
          className="mb-6 rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-4 flex items-start gap-3"
          data-testid="banner-booking-blocked"
        >
          <ShieldAlert size={18} className="text-cyan-300 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-cyan-100">Booking unavailable</p>
            <p className="text-xs text-cyan-200/90 mt-1">{eligibility.message}</p>
            {(eligibility.code === "profile_incomplete") && (
              <Link href="/profile" data-testid="link-complete-profile" className="inline-block mt-2 text-xs text-cyan-100 hover:opacity-80">
                Complete profile →
              </Link>
            )}
          </div>
        </div>
      )}

      <div className="space-y-6">
        <div className="bg-card border border-white/5 rounded-3xl p-3 shadow-xl flex justify-center">
          <DayPicker
            mode="single"
            selected={date}
            onSelect={(d) => {
              setDate(d);
              setSelectedSlot(null);
            }}
            disabled={{ before: dubaiTodayAsLocalDate() }}
            className="p-3"
            modifiersClassNames={{
              selected:
                "!bg-cyan-400 !text-black font-extrabold rounded-full ring-2 ring-cyan-300/70 shadow-[0_0_14px_rgba(94,231,255,0.45)]",
              today: "text-primary font-bold ring-1 ring-primary/40 rounded-full",
            }}
            styles={{
              head_cell: { color: "hsl(var(--muted-foreground))" },
              caption: { color: "hsl(var(--primary))" },
            }}
          />
        </div>

        {date && wholeDayBlock && <HolidayNotice block={wholeDayBlock} />}

        {date && !wholeDayBlock && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}>
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Clock size={16} className="text-primary" />
              {t("booking.slotsFor").replace("{date}", format(date, "EEEE, MMM d"))}
            </h3>
            
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5">
              {ALL_TIME_SLOTS.map((slot) => {
                const state = slotState[slot] || "available";
                const isAvailable = state === "available";
                const selected = selectedSlot === slot;
                return (
                  <button
                    key={slot}
                    disabled={!isAvailable}
                    onClick={() => {
                      setSelectedSlot(slot);
                      if (typeof window !== "undefined" && window.innerWidth < 768) {
                        requestAnimationFrame(() => {
                          const panel = document.getElementById("booking-confirm-panel");
                          panel?.scrollIntoView({ behavior: "smooth", block: "start" });
                        });
                      }
                    }}
                    data-testid={`slot-${slot}`}
                    title={state === "tooSoon" ? t("booking.advanceRule") : undefined}
                    className={`relative h-12 rounded-xl text-sm font-semibold transition-all border ${
                      selected
                        ? "bg-primary text-black border-primary scale-[1.02] shadow-lg shadow-primary/20"
                        : isAvailable
                          ? "bg-white/5 border-white/10 hover:bg-white/10"
                          : "bg-white/[0.02] border-white/5 text-muted-foreground/40 cursor-not-allowed"
                    }`}
                  >
                    {formatTime12(slot)}
                    {state === "taken" && (
                      <span className="absolute top-1 right-1 text-[9px] uppercase tracking-wider text-red-400/80">
                        {t("booking.slotTaken")}
                      </span>
                    )}
                    {state === "tooSoon" && (
                      <span className="absolute top-1 right-1 text-[9px] uppercase tracking-wider text-cyan-400/70">
                        {t("booking.slotTooSoon")}
                      </span>
                    )}
                    {state === "blocked" && (
                      <Lock size={10} className="absolute top-1 right-1 text-cyan-400/80" />
                    )}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-3">
              {t("booking.hoursNote")}
            </p>
            <div className="mt-4 grid gap-3">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-muted-foreground leading-relaxed">
                <p className="font-semibold text-foreground/90 mb-1">
                  {t("booking.advanceRule")}
                </p>
                <p>{t("booking.trainerNote")}</p>
              </div>
              <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs text-foreground/80 leading-relaxed">
                {t("booking.sessionDuration")}
              </div>
            </div>
          </motion.div>
        )}

        {selectedSlot && (
          <motion.div id="booking-confirm-panel" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6 scroll-mt-24">
            {/* ============================================================
                SESSION PREFERENCES — single guided card
                Wraps the three required steps (Focus / Goal / Booking Type)
                in one premium AMOLED surface. Each step is numbered, has
                its own subtitle, and surfaces inline validation directly
                under the missing field instead of a floating banner.
                ============================================================ */}
            <section
              className="relative overflow-hidden rounded-3xl border border-white/[0.07] bg-card/60 p-5 sm:p-7"
              data-testid="card-session-preferences"
              aria-labelledby="session-preferences-title"
            >
              {/* Cyan top hairline — same HUD signature used elsewhere */}
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
              />
              <header className="mb-6">
                <p className="text-[10px] uppercase tracking-[0.22em] text-primary font-semibold">
                  {t("booking.preferencesEyebrow", "Required")}
                </p>
                <h2
                  id="session-preferences-title"
                  className="text-xl sm:text-2xl font-display font-bold mt-1"
                  data-testid="text-preferences-title"
                >
                  {t("booking.preferencesTitle", "Session Preferences")}
                </h2>
                <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                  {t(
                    "booking.preferencesSubtitle",
                    "Tell us how you want to train so the session is built around you.",
                  )}
                </p>
              </header>

              {/* ---- STEP 1: TRAINING FOCUS ---- */}
              <PreferenceStep
                step={1}
                icon={<Dumbbell size={14} />}
                title={t("booking.sessionFocusLabel")}
                subtitle={t(
                  "booking.sessionFocusHelp",
                  "Choose the main muscle group or movement pattern.",
                )}
                required={!isAdmin}
                fulfilled={!!sessionFocus}
              >
                <div className="space-y-4">
                  {/* Premium segmented category selector — cyan active pill
                      slides via Framer's shared layoutId. Tap targets are
                      48px tall (mobile-first), full grid distribution so each
                      category is equally weighted visually. */}
                  <div
                    role="tablist"
                    aria-label={t("booking.sessionFocusLabel")}
                    className="relative grid grid-cols-3 gap-1 p-1 rounded-2xl bg-white/[0.03] border border-white/10"
                  >
                    {(["upper", "lower", "conditioning"] as const).map((groupKey) => {
                      const active = activeFocusCategory === groupKey;
                      return (
                        <button
                          key={groupKey}
                          type="button"
                          role="tab"
                          aria-selected={active}
                          onClick={() => setActiveFocusCategory(groupKey)}
                          data-testid={`tab-focus-category-${groupKey}`}
                          className={`relative h-12 px-2 rounded-xl text-[12px] sm:text-sm font-semibold tracking-tight transition-colors duration-200 z-10 ${
                            active
                              ? "text-primary"
                              : "text-foreground/60 hover:text-foreground/85"
                          }`}
                        >
                          {active && (
                            <motion.span
                              layoutId="focus-category-active"
                              transition={{ type: "spring", stiffness: 380, damping: 32 }}
                              className="absolute inset-0 rounded-xl bg-primary/15 border border-primary/45 shadow-[0_0_18px_-6px_hsl(183_100%_60%/0.6)]"
                              aria-hidden
                            />
                          )}
                          <span className="relative">
                            {t(`booking.focusGroup.${groupKey}`)}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Animated chip set — only the active category is rendered.
                      AnimatePresence with mode="wait" gives a smooth fade-in
                      without layout jump between categories. min-h reserves
                      vertical space so the form never grows/shrinks when
                      switching between Upper (8 chips) and Full Body (3 chips). */}
                  <div className="relative min-h-[112px]">
                    <AnimatePresence mode="wait" initial={false}>
                      <motion.div
                        key={activeFocusCategory}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="flex flex-wrap gap-2"
                        role="tabpanel"
                        aria-label={t(`booking.focusGroup.${activeFocusCategory}`)}
                      >
                        {SESSION_FOCUS_GROUPS[activeFocusCategory].map((opt) => {
                          const active = sessionFocus === opt;
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setSessionFocus(opt as SessionFocus)}
                              data-testid={`pill-focus-${opt}`}
                              aria-pressed={active}
                              className={`min-h-11 px-4 py-2 rounded-full text-xs sm:text-[13px] font-semibold transition-all border whitespace-nowrap ${
                                active
                                  ? "bg-primary/20 text-primary border-primary/60 ring-1 ring-primary/40 shadow-[0_0_18px_-4px_hsl(183_100%_60%/0.65)]"
                                  : "bg-white/[0.03] border-white/10 text-foreground/75 hover:bg-white/[0.06] hover:border-white/20 hover:text-foreground"
                              }`}
                            >
                              {t(`booking.focus.${opt}`)}
                            </button>
                          );
                        })}
                      </motion.div>
                    </AnimatePresence>
                  </div>
                </div>
                {attemptedContinue && !isAdmin && !sessionFocus && (
                  <InlineRequiredHint testId="hint-focus-required">
                    {t("booking.errors.pickFocus")}
                  </InlineRequiredHint>
                )}
              </PreferenceStep>

              <StepDivider />

              {/* ---- STEP 2: TRAINING GOAL ---- */}
              <PreferenceStep
                step={2}
                icon={<Target size={14} />}
                title={t("booking.trainingGoalLabel")}
                subtitle={t(
                  "booking.trainingGoalHelp",
                  "Choose the main objective for this session.",
                )}
                required={!isAdmin}
                fulfilled={!!trainingGoal}
              >
                {/* Training Goal chips — sized to match Session Focus chips
                    exactly (same min-h/padding/typography) so the two
                    sections feel like one cohesive premium control surface. */}
                <div className="flex flex-wrap gap-2">
                  {BOOKING_TRAINING_GOALS.map((opt) => {
                    const active = trainingGoal === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() => setTrainingGoal(opt as TrainingGoal)}
                        data-testid={`pill-goal-${opt}`}
                        aria-pressed={active}
                        className={`min-h-11 px-4 py-2 rounded-full text-xs sm:text-[13px] font-semibold transition-all border whitespace-nowrap ${
                          active
                            ? "bg-primary/20 text-primary border-primary/60 ring-1 ring-primary/40 shadow-[0_0_18px_-4px_hsl(183_100%_60%/0.65)]"
                            : "bg-white/[0.03] border-white/10 text-foreground/75 hover:bg-white/[0.06] hover:border-white/20 hover:text-foreground"
                        }`}
                      >
                        {t(`booking.goal.${opt}`)}
                      </button>
                    );
                  })}
                </div>
                {attemptedContinue && !isAdmin && !trainingGoal && (
                  <InlineRequiredHint testId="hint-goal-required">
                    {t("booking.errors.pickGoal")}
                  </InlineRequiredHint>
                )}
              </PreferenceStep>

              <StepDivider />

              {/* ---- STEP 3: BOOKING TYPE ----
                  Card grid replaces the cramped dropdown — no overlay
                  covers other fields, and each option shows title + hint
                  in plain sight. */}
              <PreferenceStep
                step={3}
                icon={<PackageIcon size={14} />}
                title={t("booking.sessionTypeLabel")}
                subtitle={t(
                  "booking.sessionTypeHelp",
                  "Choose how this session will be booked.",
                )}
                required={false}
                fulfilled={!!sessionType}
              >
                <div
                  role="radiogroup"
                  aria-label={t("booking.sessionTypeLabel")}
                  className="grid grid-cols-1 sm:grid-cols-2 gap-2.5"
                >
                  {sessionTypeOptions.map((opt) => {
                    const active = sessionType === opt.value;
                    const Icon = sessionTypeIcon(opt.value);
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        role="radio"
                        aria-checked={active}
                        disabled={opt.disabled}
                        onClick={() => !opt.disabled && setSessionType(opt.value)}
                        data-testid={`option-session-${opt.value}`}
                        className={`relative text-left rounded-2xl border p-3.5 transition-all min-h-[68px] flex items-start gap-3 ${
                          opt.disabled
                            ? "bg-white/[0.02] border-white/5 opacity-50 cursor-not-allowed"
                            : active
                              ? "bg-primary/10 border-primary/50 shadow-[0_0_18px_-8px_hsl(183_100%_60%/0.55)]"
                              : "bg-white/[0.03] border-white/10 hover:bg-white/[0.06] hover:border-white/20"
                        }`}
                      >
                        <span
                          className={`shrink-0 w-9 h-9 rounded-xl flex items-center justify-center border ${
                            active
                              ? "bg-primary/20 border-primary/40 text-primary"
                              : "bg-white/[0.04] border-white/10 text-muted-foreground"
                          }`}
                        >
                          <Icon size={16} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block text-sm font-semibold ${active ? "text-primary" : "text-foreground"}`}
                          >
                            {opt.label}
                          </span>
                          {opt.hint && (
                            <span className="block text-[11px] text-muted-foreground mt-0.5 leading-snug">
                              {opt.hint}
                            </span>
                          )}
                        </span>
                        {active && (
                          <CheckCircle2
                            size={14}
                            className="absolute top-2.5 right-2.5 text-primary"
                          />
                        )}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-4">
                  <SessionTypeNotice
                    sessionType={sessionType}
                    activePackage={activePackage}
                    sessionsLeft={sessionsLeft}
                    isAdmin={!!isAdmin}
                    hasUsedFreeTrial={hasUsedFreeTrial}
                  />
                </div>
              </PreferenceStep>
            </section>

            {sessionType === "duo" && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-5 shadow-[0_0_24px_-12px_hsl(183_100%_74%/0.4)]"
                data-testid="card-duo-partner"
              >
                <div className="flex items-center gap-2 mb-1">
                  <UserPlus className="h-4 w-4 text-primary" />
                  <h3 className="text-sm font-semibold tracking-wide uppercase text-primary">
                    Training Partner Details
                  </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4">
                  Tell us who's training with you. Your partner doesn't need an account —
                  one slot is booked, and one session is deducted from your Duo package.
                </p>
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium block mb-1.5 text-foreground/80">
                      Partner full name <span className="text-primary">*</span>
                    </label>
                    <Input
                      value={partnerName}
                      onChange={(e) => setPartnerName(e.target.value)}
                      placeholder="e.g. Ahmed Khalid"
                      maxLength={120}
                      className="bg-white/5 border-white/10 focus-visible:ring-primary/40"
                      data-testid="input-partner-name"
                    />
                    {partnerName.trim().length > 0 && partnerName.trim().length < 2 && (
                      <p className="text-xs text-destructive mt-1">
                        Please enter your partner's full name.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-medium block mb-1.5 text-foreground/80">
                        Partner phone <span className="text-muted-foreground/70">(optional)</span>
                      </label>
                      <Input
                        value={partnerPhone}
                        onChange={(e) => setPartnerPhone(e.target.value)}
                        placeholder="+971 ..."
                        maxLength={40}
                        inputMode="tel"
                        className="bg-white/5 border-white/10 focus-visible:ring-primary/40"
                        data-testid="input-partner-phone"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium block mb-1.5 text-foreground/80">
                        Partner email <span className="text-muted-foreground/70">(optional)</span>
                      </label>
                      <Input
                        type="email"
                        value={partnerEmail}
                        onChange={(e) => setPartnerEmail(e.target.value)}
                        placeholder="partner@email.com"
                        maxLength={254}
                        className="bg-white/5 border-white/10 focus-visible:ring-primary/40"
                        data-testid="input-partner-email"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

            <div>
              <label className="text-sm font-semibold block mb-2">{t("booking.notesLabel")}</label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder={t("booking.notesPlaceholder")}
                className="bg-white/5 border-white/10"
                data-testid="input-booking-notes"
              />
            </div>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {selectedSlot && date && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-0 left-0 right-0 px-5 pb-5 pt-3 bg-gradient-to-t from-background via-background/95 to-transparent z-40"
          >
            <div className="max-w-3xl mx-auto">
              <Button
                onClick={() => {
                  if (!canContinue) {
                    setAttemptedContinue(true);
                    // Scroll to the first missing field so the user sees the
                    // inline hint instead of staring at a disabled button.
                    requestAnimationFrame(() => {
                      const target =
                        (!isAdmin && !sessionFocus && document.querySelector('[data-testid="hint-focus-required"]')) ||
                        (!isAdmin && !trainingGoal && document.querySelector('[data-testid="hint-goal-required"]')) ||
                        document.getElementById("booking-confirm-panel");
                      (target as HTMLElement | null)?.scrollIntoView({ behavior: "smooth", block: "center" });
                    });
                    return;
                  }
                  setIsConfirmOpen(true);
                }}
                aria-disabled={!canContinue}
                data-testid="button-open-confirm"
                className={`w-full h-14 text-base font-bold rounded-2xl shadow-2xl shadow-primary/20 transition-opacity ${
                  canContinue ? "" : "opacity-60"
                }`}
              >
                {canContinue
                  ? t("booking.continueAt").replace("{date}", format(date, "MMM d")).replace("{time}", formatTime12(selectedSlot ?? ""))
                  : t("booking.completeRequired", "Complete required fields to continue")}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent className="bg-card border-white/10 sm:rounded-3xl max-w-md">
          <DialogHeader>
            <DialogTitle className="text-xl font-display">{t("booking.confirmTitle")}</DialogTitle>
            <DialogDescription>{t("booking.confirmReview")}</DialogDescription>
          </DialogHeader>

          <div className="bg-white/5 p-4 rounded-xl space-y-2 my-2">
            <Row label={t("booking.dateLabel")} value={date && format(date, "PPPP")} />
            <Row label={t("booking.timeLabel")} value={<span className="text-primary font-bold">{formatTime12(selectedSlot)}</span>} />
            {sessionFocus && (
              <Row
                label={t("booking.sessionFocusLabel")}
                value={t(`booking.focus.${sessionFocus}`)}
              />
            )}
            {trainingGoal && (
              <Row
                label={t("booking.trainingGoalLabel")}
                value={t(`booking.goal.${trainingGoal}`)}
              />
            )}
            {sessionType === "duo" && partnerName.trim() && (
              <Row label="Training partner" value={<span data-testid="text-confirm-partner">{partnerName.trim()}</span>} />
            )}
            {notes && <Row label={t("booking.notesLabel")} value={notes} />}
          </div>

          <div className="flex gap-3 p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/20 text-xs leading-relaxed">
            <ShieldAlert className="text-cyan-400 shrink-0 mt-0.5" size={16} />
            <div className="text-cyan-100/80 space-y-1.5">
              <p>{t("booking.advanceRule")}</p>
              <p>
                {t("booking.cancellationWarningBefore")}{" "}
                <span className="font-bold">
                  {t("booking.cancellationWarningHours").replace("{hours}", String(settings?.cancellationCutoffHours ?? 6))}
                </span>{" "}
                {t("booking.cancellationWarningAfter")}
              </p>
            </div>
          </div>

          <label className="flex items-start gap-3 mt-4 cursor-pointer">
            <Checkbox
              checked={accepted}
              onCheckedChange={(v) => setAccepted(v === true)}
              data-testid="checkbox-accept-policy"
              className="mt-0.5"
            />
            <span className="text-sm">{t("booking.acceptPolicy")}</span>
          </label>

          <DialogFooter className="mt-2">
            <Button variant="ghost" onClick={() => setIsConfirmOpen(false)} data-testid="button-cancel-confirm">
              {t("common.cancel")}
            </Button>
            <Button
              onClick={handleBook}
              disabled={createBooking.isPending || !accepted}
              data-testid="button-confirm-booking"
            >
              {createBooking.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t("booking.confirmBooking")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ============================================================================
   Session Preferences building blocks
   ----------------------------------------------------------------------------
   PreferenceStep — numbered step header (badge + icon + title + subtitle +
                    elegant required asterisk + "done" check) wrapping the
                    actual chip / card group as `children`.
   StepDivider     — subtle hairline separator between numbered steps inside
                     the same Session Preferences card.
   InlineRequiredHint — calm but clear "required" message that lives directly
                        under the missing field. Replaces the previous floating
                        validation banner.
   sessionTypeIcon  — lookup mapping each booking-type choice to its icon for
                      the new card-grid selector.
   ========================================================================= */
function PreferenceStep({
  step,
  icon,
  title,
  subtitle,
  required,
  fulfilled,
  children,
}: {
  step: number;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  required: boolean;
  fulfilled: boolean;
  children: React.ReactNode;
}) {
  return (
    <div data-testid={`preference-step-${step}`}>
      <div className="flex items-start gap-3 mb-3">
        <span
          className={`shrink-0 w-7 h-7 rounded-full border flex items-center justify-center text-[11px] font-display font-bold tabular-nums transition-colors ${
            fulfilled
              ? "bg-primary/15 border-primary/40 text-primary"
              : "bg-white/[0.04] border-white/15 text-foreground/70"
          }`}
          aria-hidden
        >
          {fulfilled ? <CheckCircle2 size={14} /> : step}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm sm:text-[15px] font-semibold text-foreground flex items-center gap-1.5 flex-wrap">
            <span className="text-primary/80">{icon}</span>
            <span>{title}</span>
            {required && (
              <span
                className="text-primary/70 text-xs font-normal leading-none"
                aria-label="required"
                title="Required"
              >
                ✦
              </span>
            )}
          </p>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
            {subtitle}
          </p>
        </div>
      </div>
      <div className="ms-10 sm:ms-10">{children}</div>
    </div>
  );
}

function StepDivider() {
  return (
    <div
      aria-hidden
      className="my-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent"
    />
  );
}

function InlineRequiredHint({
  children,
  testId,
}: {
  children: React.ReactNode;
  testId: string;
}) {
  return (
    <p
      role="alert"
      data-testid={testId}
      className="mt-3 text-xs text-cyan-300 inline-flex items-center gap-1.5"
    >
      <AlertTriangle size={12} />
      {children}
    </p>
  );
}

function sessionTypeIcon(value: SessionTypeChoice) {
  switch (value) {
    case "package":
      return PackageIcon;
    case "single":
      return Wallet;
    case "trial":
      return Gift;
    case "duo":
      return Users;
    default:
      return PackageIcon;
  }
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}

function HolidayNotice({ block }: { block: { blockType?: string | null; reason?: string | null } }) {
  const { t } = useTranslation();
  const cfg = {
    "off-day": {
      icon: <Coffee size={20} />,
      title: t("booking.holidayOffTitle"),
      subtitle: t("booking.holidayOffSubtitle"),
      colors: "border-sky-400/30 bg-sky-400/5 text-sky-100",
      iconBg: "bg-sky-400/15 text-sky-300",
    },
    emergency: {
      icon: <AlertTriangle size={20} />,
      title: t("booking.holidayEmergencyTitle"),
      subtitle: t("booking.holidayEmergencySubtitle"),
      colors: "border-red-500/30 bg-red-500/5 text-red-100",
      iconBg: "bg-red-500/15 text-red-300",
    },
    "fully-booked": {
      icon: <Users size={20} />,
      title: t("booking.holidayFullTitle"),
      subtitle: t("booking.holidayFullSubtitle"),
      colors: "border-primary/30 bg-primary/5 text-primary/90",
      iconBg: "bg-primary/15 text-primary",
    },
  } as const;

  const type = (block.blockType || "off-day") as keyof typeof cfg;
  const c = cfg[type] || cfg["off-day"];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-3xl border p-6 flex items-start gap-4 ${c.colors}`}
      data-testid={`holiday-notice-${type}`}
    >
      <div className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 ${c.iconBg}`}>
        {c.icon}
      </div>
      <div className="flex-1">
        <p className="font-display font-bold text-base">{c.title}</p>
        <p className="text-sm opacity-80 mt-0.5">{c.subtitle}</p>
        {block.reason && (
          <p className="text-xs opacity-60 italic mt-2">"{block.reason}"</p>
        )}
      </div>
    </motion.div>
  );
}

function SessionTypeNotice({
  sessionType,
  activePackage,
  sessionsLeft,
  isAdmin,
  hasUsedFreeTrial,
}: {
  sessionType: SessionTypeChoice;
  activePackage?: Package;
  sessionsLeft: number;
  isAdmin: boolean;
  hasUsedFreeTrial: boolean;
}) {
  const { t } = useTranslation();
  if (sessionType === "package" || sessionType === "duo") {
    return <PackageBalance pkg={activePackage} sessionsLeft={sessionsLeft} isAdmin={isAdmin} />;
  }
  if (sessionType === "trial") {
    if (hasUsedFreeTrial && !isAdmin) {
      return (
        <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 flex items-start gap-3">
          <AlertTriangle size={18} className="text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-100/90">
            <p className="font-semibold mb-0.5">{t("booking.trialUsedTitle")}</p>
            <p className="opacity-80">{t("booking.trialUsedBody")}</p>
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 flex items-start gap-3">
        <Gift size={18} className="text-emerald-400 shrink-0 mt-0.5" />
        <div className="text-xs text-emerald-100/90">
          <p className="font-semibold mb-0.5">{t("booking.trialNewTitle")}</p>
          <p className="opacity-80">{t("booking.trialNewBody")}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/5 p-4 space-y-3">
      <div className="flex items-start gap-3">
        <Wallet size={18} className="text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-cyan-100/90 flex-1">
          <p className="font-semibold mb-0.5">{t("booking.singleTitle")}</p>
          <p className="opacity-80">{t("booking.singleBody")}</p>
        </div>
      </div>
      <Link
        href="/direct-payment"
        data-testid="link-direct-payment"
        className="flex items-center justify-center gap-2 h-10 rounded-xl bg-white/10 border border-white/10 hover:bg-white/15 text-xs font-semibold"
      >
        <CreditCard size={13} /> {t("booking.viewPaymentDetails")}
      </Link>
    </div>
  );
}

function PackageBalance({ pkg, sessionsLeft, isAdmin }: { pkg?: Package; sessionsLeft: number; isAdmin: boolean }) {
  const { t } = useTranslation();
  if (isAdmin) {
    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-3 text-xs text-cyan-200/90 inline-flex items-center gap-2">
        <Sparkles size={13} /> {t("booking.adminBypass")}
      </div>
    );
  }

  if (!pkg) {
    return (
      <div className="rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4 flex items-start gap-3">
        <PackageIcon size={18} className="text-cyan-400 shrink-0 mt-0.5" />
        <div className="text-xs text-cyan-100/90">
          <p className="font-semibold mb-0.5">{t("booking.hintNoActivePackage")}</p>
          <p className="opacity-80">{t("booking.noPackageBody")}</p>
        </div>
      </div>
    );
  }

  const lowBalance = sessionsLeft <= 2;
  return (
    <div
      className={`rounded-2xl border p-4 flex items-center gap-3 ${
        lowBalance
          ? "border-cyan-500/30 bg-cyan-500/5"
          : "border-primary/20 bg-primary/5"
      }`}
      data-testid="package-balance"
    >
      <PackageIcon size={18} className={lowBalance ? "text-cyan-400" : "text-primary"} />
      <div className="text-xs flex-1">
        <p className="font-semibold">
          {t("booking.sessionsRemaining").replace("{n}", String(sessionsLeft))}
        </p>
        <p className="text-muted-foreground">{t("booking.deductedNote")}</p>
      </div>
    </div>
  );
}

