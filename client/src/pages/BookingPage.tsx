import { useState, useMemo, useEffect, useRef } from "react";
import { useDraft } from "@/lib/useDraft";
import { enqueue as enqueueOffline, isOfflineError } from "@/lib/offlineQueue";
import { ToastAction } from "@/components/ui/toast";
import { useQuery } from "@tanstack/react-query";
import type { TrainingLocation } from "@shared/schema";
import { DayPicker } from "react-day-picker";
import "react-day-picker/dist/style.css";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation, Link, Redirect } from "wouter";
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
import { BookingBlockedBanner } from "@/pages/ClientDashboard";
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
import { CoachAvailabilityChip } from "@/components/CoachAvailabilityChip";
import { useTranslation } from "@/i18n";
import { ShieldCheck, ChevronDown } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { buildGoogleCalendarUrl, downloadIcs } from "@/lib/calendar";
import { getDeviceFingerprint } from "@/lib/device-fingerprint";
import type { Booking, Waitlist } from "@shared/schema";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { CalendarPlus, Download } from "lucide-react";
import { cn } from "@/lib/utils";

type SessionTypeChoice = "package" | "single" | "trial" | "duo";
type SessionFocus = (typeof SESSION_FOCUS_GROUPS)["upper"][number] | (typeof SESSION_FOCUS_GROUPS)["lower"][number] | (typeof SESSION_FOCUS_GROUPS)["conditioning"][number];
type TrainingGoal = (typeof BOOKING_TRAINING_GOALS)[number];

export default function BookingPage() {
  const { t } = useTranslation();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [, navigate] = useLocation();

  // Task #66 follow-up — query-param-aware page chrome. The wizard
  // hands off via `/book?type=free_trial[&location=X]` (new clients)
  // or `/book?location=X` (active package). The user must know exactly
  // which surface they landed on, so we override the header copy and
  // the success-card copy based on these params. Falls back to the
  // generic labels for direct `/book` access.
  const bookingFlow = (() => {
    if (typeof window === "undefined") {
      return { isTrial: false, location: null as string | null };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      isTrial: params.get("type") === "free_trial",
      location: params.get("location"),
    };
  })();
  const LOCATION_HEADERS: Record<string, { title: string; subtitle: string }> = {
    home: {
      title: bookingFlow.isTrial
        ? t("booking.flow.homeTrial.title", "Book Your Home Training Trial")
        : t("booking.flow.home.title", "Book Your Home Training Session"),
      subtitle: t(
        "booking.flow.home.subtitle",
        "Choose a time for your first session. Youssef Elite will review your location details before confirming availability if needed.",
      ),
    },
    building: {
      title: t("booking.flow.building.title", "Book Your Building Gym Session"),
      subtitle: t(
        "booking.flow.building.subtitle",
        "Choose your preferred time. Please make sure gym access is available for your trainer.",
      ),
    },
    hotel: {
      title: t("booking.flow.hotel.title", "Book Your Hotel Training Session"),
      subtitle: t(
        "booking.flow.hotel.subtitle",
        "Choose your preferred time. Youssef Elite may review hotel access details before final confirmation if needed.",
      ),
    },
    other_gym: {
      title: t("booking.flow.otherGym.title", "Book Your Training Session"),
      subtitle: t(
        "booking.flow.otherGym.subtitle",
        "Choose your preferred time. Please make sure trainer access is allowed at the selected gym.",
      ),
    },
    fitness_zone: {
      title: t("booking.flow.fz.title", "Book Your Fitness Zone Session"),
      subtitle: t(
        "booking.flow.fz.subtitle",
        "Choose your preferred time at Fitness Zone with Coach Youssef.",
      ),
    },
  };
  const flowHeader =
    bookingFlow.location && LOCATION_HEADERS[bookingFlow.location]
      ? LOCATION_HEADERS[bookingFlow.location]
      : bookingFlow.isTrial
        ? {
            title: t("booking.flow.trial.title", "Book Your Free Trial Session"),
            subtitle: t(
              "booking.flow.trial.subtitle",
              "Choose a convenient time for your first Youssef Elite assessment session.",
            ),
          }
        : null;

  // Booking-safety: anonymous visitors are redirected to /wizard via
  // /auth (deep-link back to /wizard after sign-in) so the very first
  // step is always location selection — never the booking grid. The
  // synchronous <Redirect> below replaces the previous useEffect-based
  // navigation that caused a one-frame flash of booking UI.
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
  // Task #55: capture the created booking so the success screen can
  // build a stable .ics URL (`/api/bookings/:id/calendar.ics`).
  const [lastBooking, setLastBooking] = useState<Booking | null>(null);
  // Lazily computed device fingerprint — best-effort, ~5 ms. Used only
  // server-side for trial-abuse detection; never sent for non-trial
  // bookings. `null` when crypto.subtle isn't available (very old
  // browsers) — server tolerates this gracefully.
  const [deviceFingerprint, setDeviceFingerprint] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getDeviceFingerprint().then((fp) => {
      if (alive) setDeviceFingerprint(fp);
    });
    return () => {
      alive = false;
    };
  }, []);
  const { toast: showToast } = useToast();
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

  // Draft recovery (Phase 5). Persist the in-progress booking selection
  // to localStorage so a hard refresh, PWA cold start, or accidental
  // tab-close never costs the user their work. Restored once on mount
  // behind a confirmation toast — never silently overwrites whatever
  // they'd already started typing.
  const draftKey = user?.id ? `book:${user.id}` : "book:anon";
  const draftValue = {
    dateStr: date ? date.toISOString().slice(0, 10) : null,
    selectedSlot,
    notes,
    sessionType,
    sessionFocus,
    trainingGoal,
  };
  const bookingDraft = useDraft({ key: draftKey, value: draftValue, enabled: !submitted });
  const draftHandledRef = useRef(false);
  useEffect(() => {
    if (draftHandledRef.current) return;
    if (!bookingDraft.hasDraft || !bookingDraft.draft) return;
    draftHandledRef.current = true;
    const d = bookingDraft.draft;
    showToast({
      title: t("booking.draftRestoredTitle", "Draft restored"),
      description: t(
        "booking.draftRestoredDesc",
        "We brought back the booking you were filling out.",
      ),
      action: (
        <ToastAction
          altText="Discard draft"
          data-testid="button-draft-discard"
          onClick={() => {
            bookingDraft.clear();
            setDate(dubaiTodayAsLocalDate());
            setSelectedSlot(null);
            setNotes("");
            setSessionType("package");
            setSessionFocus(null);
            setTrainingGoal(null);
          }}
        >
          {t("booking.draftDiscard", "Discard")}
        </ToastAction>
      ),
    });
    if (d.dateStr) {
      const parsed = new Date(`${d.dateStr}T00:00:00`);
      if (!isNaN(parsed.getTime())) setDate(parsed);
    }
    if (d.selectedSlot) setSelectedSlot(d.selectedSlot);
    if (typeof d.notes === "string") setNotes(d.notes);
    if (d.sessionType) setSessionType(d.sessionType);
    if (d.sessionFocus) setSessionFocus(d.sessionFocus);
    if (d.trainingGoal) setTrainingGoal(d.trainingGoal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookingDraft.hasDraft]);
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
  const { data: packages = [], isLoading: pkgsLoading } = usePackages({ userId: user?.id });
  // Task #28: route brand-new clients (no active package + no saved
  // training-location row) through the post-signup wizard before they
  // can see the booking grid. Legacy users with an active package or a
  // saved location bypass this gate.
  const { data: trainingLocations = [], isLoading: locLoading } = useQuery<TrainingLocation[]>({
    queryKey: ["/api/training-locations"],
    enabled: !!user && user.role === "client",
  });
  const anyActivePkg = (packages as Package[]).some((p) => p.isActive && p.usedSessions < p.totalSessions);
  // A Fitness Zone existing-PT-client request lives as a package row
  // with status='pending_verification' and adminApproved=false until
  // the admin activates it. While that's outstanding (and the client
  // has no other active package) we block the booking surface entirely
  // and redirect to /dashboard, which already shows the awaiting-
  // approval banner. This satisfies the "no booking calendar, no
  // skeleton, no flicker" requirement.
  const hasPendingActivation =
    !anyActivePkg &&
    (packages as Package[]).some(
      (p) => p.status === "pending_verification" && !p.adminApproved,
    );
  // Resolve wizard eligibility *before* any booking UI renders. For clients
  // we wait for both training-locations and packages queries to settle so
  // the booking calendar / package cards never flash for first-time users
  // who actually need the wizard.
  const isClient = !!user && user.role === "client";
  const wizardChecksLoading = isClient && (locLoading || pkgsLoading);
  const needsWizard =
    isClient && !wizardChecksLoading && trainingLocations.length === 0 && !anyActivePkg;
  // Wizard redirect is handled synchronously via <Redirect> below — no
  // useEffect, so the booking surface never paints a single frame for
  // first-time clients.

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
    // Consent is captured inline in the unified confirm dialog. The server-side
    // POST /api/bookings handler writes a consent record (consentType: "booking",
    // acceptedItems: ["cancellation_policy"]) on every successful booking, so
    // the audit trail is created transactionally with the booking row itself.
    if (!isAdmin) {
      try {
        if (typeof window !== "undefined") {
          localStorage.setItem("policyAccepted", "true");
        }
      } catch {
        // ignore
      }
    }
    const isDuo = sessionType === "duo";
    const payload = {
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
      partnerFullName: isDuo ? partnerName.trim() : undefined,
      partnerPhone: isDuo && partnerPhone.trim() ? partnerPhone.trim() : undefined,
      partnerEmail: isDuo && partnerEmail.trim() ? partnerEmail.trim() : undefined,
      ...(sessionType === "trial" && deviceFingerprint
        ? { deviceFingerprint }
        : {}),
      ...(isAdmin ? { override: true } : {}),
    };

    // Phase 5 — offline-first guard. If the browser is offline at submit
    // time, enqueue the booking payload to localStorage and surface a
    // friendly toast instead of letting fetch throw silently. The
    // OfflineQueueBanner + reconnect handler replay the request once
    // the network is back.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      // Phase 5 review fix — do NOT clear the draft on enqueue. The
      // queued job may eventually fail server-side (401 expired session,
      // 400 validation, 429 rate-limit) and we don't want the user to
      // have to retype everything from scratch. The draft is cleared
      // only after a *confirmed* server-side success.
      enqueueOffline("booking", "/api/bookings", payload);
      setIsConfirmOpen(false);
      showToast({
        title: "Saved for later",
        description:
          "You're offline. Your booking is queued and will send the moment you reconnect — your draft stays saved until it's accepted.",
      });
      return;
    }

    createBooking.mutate(payload as any, {
      onSuccess: (booking) => {
        setIsConfirmOpen(false);
        setLastBooking(booking ?? null);
        setSubmitted(true);
        // Booking succeeded — drop the recovery draft so the next
        // visit starts clean instead of restoring the now-stale form.
        bookingDraft.clear();
      },
      onError: (err) => {
        if (isOfflineError(err)) {
          // Same rule as the pre-submit branch — keep the draft so the
          // user can retry/edit if the queued job is parked.
          enqueueOffline("booking", "/api/bookings", payload);
          setIsConfirmOpen(false);
          showToast({
            title: "Saved for later",
            description:
              "Connection dropped. Your booking is queued and will send when you're back online — your draft stays saved until it's accepted.",
          });
        }
      },
    });
  };

  // Task #55 — Waitlist mutations + my-waitlist query.
  const { data: myWaitlist = [] } = useQuery<Waitlist[]>({
    queryKey: ["/api/waitlist/mine"],
    enabled: !!user && user.role === "client",
  });
  const myWaitlistKeys = useMemo(
    () => new Set(myWaitlist.map((w) => `${w.date}|${w.timeSlot}`)),
    [myWaitlist],
  );
  const joinWaitlist = useMutation({
    mutationFn: async (slot: string) => {
      const res = await apiRequest("POST", "/api/waitlist", {
        date: dateStr,
        timeSlot: slot,
      });
      return (await res.json()) as Waitlist;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waitlist/mine"] });
      showToast({
        title: "You're on the waitlist",
        description: "We'll notify you the moment that slot opens up.",
      });
    },
    onError: (err: Error) => {
      showToast({
        title: "Couldn't join the waitlist",
        description: err.message,
        variant: "destructive",
      });
    },
  });
  const leaveWaitlist = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/waitlist/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waitlist/mine"] });
      showToast({ title: "Removed from waitlist" });
    },
  });

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

  // -------- Synchronous gating (no booking UI is ever painted while
  // any of these conditions hold) --------
  //
  // 1. Anonymous visitors → /auth, then back to /wizard. The wizard is
  //    the mandatory first step for new clients per product policy.
  // 2. First-time clients who haven't picked a training location AND
  //    have no active package → /wizard.
  // 3. While the prechecks (auth, training-locations, packages) are
  //    still loading, render a minimal neutral spinner — no calendar,
  //    no skeleton cards, no booking iconography — so there is zero
  //    visual hint of the booking surface before we know where to go.
  if (!submitted) {
    if (!isAuthLoading && !user) {
      return <Redirect to="/auth?redirect=/wizard" />;
    }
    if (needsWizard) {
      return <Redirect to="/wizard" />;
    }
    if (isClient && hasPendingActivation) {
      return <Redirect to="/dashboard" />;
    }
    if (isAuthLoading || wizardChecksLoading) {
      return (
        <div
          className="min-h-[60vh] flex items-center justify-center"
          data-testid="booking-precheck-loading"
        >
          <Loader2 className="h-6 w-6 text-primary/70 animate-spin" />
        </div>
      );
    }
  }

  if (submitted) {
    // Task #55 — Add-to-Calendar (Google + .ics) shown right next to the
    // WhatsApp confirmation so clients lock the session into their own
    // calendar before they navigate away. Falls back to a generic event
    // payload if the server didn't return the booking (defensive).
    const focusLabel = (lastBooking?.sessionFocus as string | null) || "Training session";
    const calendarEvent = {
      date: lastBooking?.date ?? dateStr,
      timeSlot: lastBooking?.timeSlot ?? (selectedSlot ?? "08:00"),
      title: `Training with Coach Youssef — ${focusLabel}`,
      description: `Session focus: ${focusLabel}\nBooked via youssefahmed.com`,
      location: "Coach Youssef's studio, Dubai Marina",
      uid: lastBooking ? `booking-${lastBooking.id}@youssefahmed` : undefined,
    };
    const googleHref = buildGoogleCalendarUrl(calendarEvent);
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
            {bookingFlow.isTrial
              ? t("booking.flow.trial.successTitle", "Your free trial session is confirmed.")
              : t("booking.successTitle")}
          </h2>
          <p className="text-muted-foreground text-sm mb-6">
            {bookingFlow.isTrial
              ? t(
                  "booking.flow.trial.successBody",
                  "Youssef will see you at the time you picked. Check your dashboard for the full details.",
                )
              : t("booking.successBody")}
          </p>
          <div className="flex flex-col gap-3">
            <WhatsAppButton
              label={t("booking.successConfirmWa")}
              message={t("booking.successWaMessage").replace("{date}", dateStr).replace("{time}", formatTime12(selectedSlot ?? ""))}
              size="lg"
              testId="button-confirm-whatsapp"
            />
            <div className="grid grid-cols-2 gap-2">
              <a
                href={googleHref}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-add-google-calendar"
                className="h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center gap-2 text-sm font-semibold"
              >
                <CalendarPlus size={16} className="text-primary" />
                Google Calendar
              </a>
              <button
                type="button"
                onClick={() => downloadIcs(calendarEvent, `session-${lastBooking?.id ?? "youssef"}.ics`)}
                data-testid="button-download-ics"
                className="h-11 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 transition flex items-center justify-center gap-2 text-sm font-semibold"
              >
                <Download size={16} className="text-primary" />
                Apple / .ics
              </button>
            </div>
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
            {flowHeader?.title ?? t("booking.pageTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {flowHeader?.subtitle ?? t("booking.pageSubtitle")}
          </p>
        </div>
      </div>

      {!eligibility.ok && (
        <BookingBlockedBanner
          code={eligibility.code}
          fallback={eligibility.message}
          testIdSuffix="booking"
        />
      )}

      <div className="space-y-6">
        {/* Task #76 — Coach availability chip surfaces whether today
            has free slots before the user starts hunting for one. */}
        <div className="flex justify-center">
          <CoachAvailabilityChip />
        </div>
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
                // Task #55: compute waitlist state for "taken" slots so the
                // waitlist control can be rendered as a SIBLING of the
                // disabled slot button (a disabled <button> swallows pointer
                // events from any descendants — nested controls don't work).
                const wlKey = `${dateStr}|${slot}`;
                const myWlEntry =
                  state === "taken" && !isAdmin
                    ? myWaitlist.find(
                        (w) => `${w.date}|${w.timeSlot}` === wlKey,
                      )
                    : undefined;
                const queued = !!myWlEntry;
                const wlPending =
                  joinWaitlist.isPending && joinWaitlist.variables === slot;
                return (
                  <div key={slot} className="relative">
                    <button
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
                      className={`relative h-12 w-full rounded-xl text-sm font-semibold transition-all border ${
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
                    {/* Task #55: Waitlist join/leave pill rendered as a
                        sibling so it's not blocked by the disabled slot
                        button. Absolutely positioned over the bottom of
                        the slot tile. */}
                    {state === "taken" && !isAdmin && (
                      <button
                        type="button"
                        data-testid={
                          queued
                            ? `button-leave-waitlist-${slot}`
                            : `button-join-waitlist-${slot}`
                        }
                        disabled={wlPending}
                        onClick={() => {
                          if (wlPending) return;
                          if (queued) leaveWaitlist.mutate(myWlEntry!.id);
                          else joinWaitlist.mutate(slot);
                        }}
                        className={`absolute left-1 right-1 bottom-1 text-[9px] font-bold uppercase tracking-wider px-1 py-0.5 rounded transition ${
                          queued
                            ? "bg-primary/25 text-primary hover:bg-primary/35"
                            : "bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/25"
                        }`}
                      >
                        {wlPending ? "…" : queued ? "On list" : "Waitlist"}
                      </button>
                    )}
                  </div>
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

      {/* Unified booking confirmation + consent gate.
          One modal only — booking details + training waiver + cancellation
          policy + a single required checkbox + the Confirm CTA. The audit
          trail is preserved server-side via fire-and-forget /api/agreements
          POSTs inside handleBook(). */}
      <Dialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <DialogContent
          className={cn(
            "ag-sheet-in",
            "bg-[#06080A]",
            "border border-white/[0.055]",
            "rounded-[20px] sm:rounded-[24px]",
            "w-[calc(100vw-1rem)] sm:w-full max-w-[460px]",
            "p-0 gap-0",
            "flex flex-col overflow-hidden",
            "max-h-[92dvh] sm:max-h-[85vh]",
            "will-change-transform",
            "shadow-[0_1px_0_0_rgba(255,255,255,0.045)_inset,0_0_0_1px_rgba(94,231,255,0.045),0_50px_140px_-30px_rgba(0,0,0,0.96),0_12px_30px_-14px_rgba(94,231,255,0.1)]"
          )}
          data-testid="dialog-confirm-booking"
        >
          {/* Layer 1 — Ambient radial cyan wash */}
          <div
            aria-hidden
            className="pointer-events-none absolute -top-28 start-1/2 -translate-x-1/2 h-56 w-[130%] rounded-full bg-primary/[0.055] blur-3xl"
          />
          {/* Layer 2 — Top hairline glow */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent"
          />
          {/* Layer 3 — Inner luxury double-stroke */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-px rounded-[19px] sm:rounded-[23px] ring-1 ring-inset ring-white/[0.022]"
          />
          {/* Layer 4 — Bottom soft vignette */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-black/40 to-transparent"
          />

          {/* Header (sticky, never scrolls). Compact on mobile so the
              full confirmation flow fits above the fold. */}
          <div className="relative shrink-0 px-4 pt-3.5 pb-2.5 xs:px-5 xs:pt-4 xs:pb-3 sm:px-7 sm:pt-6 sm:pb-4 pe-11 sm:pe-14">
            <DialogHeader className="space-y-0.5 sm:space-y-2 text-start">
              <div className="flex items-center gap-2.5 sm:gap-3">
                <span
                  aria-hidden
                  className="
                    relative inline-flex h-7 w-7 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full
                    bg-gradient-to-b from-primary/[0.16] to-primary/[0.04]
                    ring-1 ring-inset ring-primary/25 text-primary
                    shadow-[0_0_26px_-6px_rgba(94,231,255,0.55),0_1px_0_0_rgba(255,255,255,0.07)_inset,0_-1px_0_0_rgba(0,0,0,0.3)_inset]
                  "
                >
                  <ShieldCheck size={13} strokeWidth={2.1} className="sm:hidden" />
                  <ShieldCheck size={16} strokeWidth={2.1} className="hidden sm:block" />
                </span>
                <DialogTitle className="text-[15.5px] xs:text-[16.5px] sm:text-[20px] leading-tight font-display font-semibold tracking-[-0.018em] text-foreground break-words">
                  {t("booking.confirmTitle", "Confirm your booking")}
                </DialogTitle>
              </div>
              <DialogDescription className="hidden sm:block text-[12.5px] sm:text-[13.5px] leading-[1.55] text-foreground/55 tracking-[-0.005em] ps-[3.25rem]">
                {t(
                  "booking.confirmReview",
                  "Please review the details and accept the policies below.",
                )}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div
            aria-hidden
            className="shrink-0 mx-4 xs:mx-5 sm:mx-7 h-px bg-gradient-to-r from-transparent via-white/[0.055] to-transparent"
          />

          {/* Scrollable body — only this region scrolls.
              min-h-0 is critical: it lets flexbox shrink this region when
              the modal is near the max-height limit, so the footer stays
              pinned and the middle content scrolls instead of pushing
              the modal off-screen. */}
          <div className="relative flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 xs:px-5 sm:px-7 pt-2.5 sm:pt-4 pb-2.5 sm:pb-3 space-y-2.5 sm:space-y-3.5 [-webkit-overflow-scrolling:touch]">
            {/* Booking details — compact 2-col grid on mobile, list on >=sm */}
            <div
              className="
                relative overflow-hidden rounded-[14px] sm:rounded-[18px]
                border border-white/[0.05]
                bg-gradient-to-b from-white/[0.032] to-white/[0.008]
                backdrop-blur-[8px]
                px-3 py-2.5 xs:px-[14px] xs:py-3 sm:px-5 sm:py-3
              "
              data-testid="card-booking-summary"
            >
              <div className="grid grid-cols-2 gap-x-3 gap-y-2 sm:hidden">
                <GridCell label={t("booking.dateLabel")} value={date && format(date, "MMM d, yyyy")} />
                <GridCell
                  label={t("booking.timeLabel")}
                  value={
                    <span className="text-primary font-semibold tracking-[-0.005em]">
                      {formatTime12(selectedSlot)}
                    </span>
                  }
                />
                {sessionFocus && (
                  <GridCell label={t("booking.sessionFocusLabel")} value={t(`booking.focus.${sessionFocus}`)} />
                )}
                {trainingGoal && (
                  <GridCell label={t("booking.trainingGoalLabel")} value={t(`booking.goal.${trainingGoal}`)} />
                )}
                {sessionType === "duo" && partnerName.trim() && (
                  <GridCell
                    label={t("booking.partnerLabel", "Training partner")}
                    value={<span data-testid="text-confirm-partner">{partnerName.trim()}</span>}
                  />
                )}
                {notes && (
                  <div className="col-span-2">
                    <GridCell label={t("booking.notesLabel")} value={notes} />
                  </div>
                )}
              </div>

              <div className="hidden sm:block">
                <Row label={t("booking.dateLabel")} value={date && format(date, "PPPP")} />
                <Row
                  label={t("booking.timeLabel")}
                  value={
                    <span className="text-primary font-semibold tracking-[-0.005em]">
                      {formatTime12(selectedSlot)}
                    </span>
                  }
                />
                {sessionFocus && (
                  <Row label={t("booking.sessionFocusLabel")} value={t(`booking.focus.${sessionFocus}`)} />
                )}
                {trainingGoal && (
                  <Row label={t("booking.trainingGoalLabel")} value={t(`booking.goal.${trainingGoal}`)} />
                )}
                {sessionType === "duo" && partnerName.trim() && (
                  <Row
                    label={t("booking.partnerLabel", "Training partner")}
                    value={<span data-testid="text-confirm-partner">{partnerName.trim()}</span>}
                  />
                )}
                {notes && <Row label={t("booking.notesLabel")} value={notes} />}
              </div>
            </div>

            {/* Policies — collapsible accordions (collapsed by default) */}
            <Accordion
              type="multiple"
              className="
                relative overflow-hidden rounded-[14px] sm:rounded-[18px]
                border border-white/[0.05]
                bg-gradient-to-b from-white/[0.028] to-white/[0.008]
                backdrop-blur-[8px]
                divide-y divide-white/[0.045]
              "
            >
              <AccordionItem value="waiver" className="border-b-0" data-testid="agreement-text-training_waiver">
                <AccordionTrigger
                  className="
                    px-3.5 py-2.5 xs:px-4 xs:py-3 sm:px-5 sm:py-3.5
                    hover:no-underline gap-3
                    [&[data-state=open]>svg]:rotate-180
                  "
                >
                  <div className="flex flex-col items-start gap-0.5 min-w-0 text-start">
                    <span className="text-primary/95 text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-[0.16em]">
                      {t("agreements.types.training_waiver", "Training Waiver")}
                    </span>
                    <span className="text-[11.5px] sm:text-[12.5px] text-foreground/55 tracking-[-0.003em] truncate max-w-full">
                      {t("booking.waiverPreview", "Acknowledge training risks. Tap to read.")}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-3 xs:px-4 sm:px-5 sm:pb-4">
                  <p className="text-[12px] sm:text-[13.5px] leading-[1.6] text-foreground/72 tracking-[-0.003em] break-words">
                    {t("agreements.text.training_waiver", "")}
                  </p>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="cancellation" className="border-b-0" data-testid="agreement-text-cancellation_policy">
                <AccordionTrigger
                  className="
                    px-3.5 py-2.5 xs:px-4 xs:py-3 sm:px-5 sm:py-3.5
                    hover:no-underline gap-3
                    [&[data-state=open]>svg]:rotate-180
                  "
                >
                  <div className="flex flex-col items-start gap-0.5 min-w-0 text-start">
                    <span className="text-primary/95 text-[9.5px] sm:text-[10px] font-semibold uppercase tracking-[0.16em]">
                      {t("agreements.types.cancellation_policy", "Cancellation Policy")}
                    </span>
                    <span className="text-[11.5px] sm:text-[12.5px] text-foreground/55 tracking-[-0.003em] truncate max-w-full">
                      {t("booking.cancellationPreview", "Cancel at least {hours} before.").replace(
                        "{hours}",
                        t("booking.cancellationWarningHours").replace(
                          "{hours}",
                          String(settings?.cancellationCutoffHours ?? 3),
                        ),
                      )}
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-3.5 pb-3 xs:px-4 sm:px-5 sm:pb-4">
                  <p className="text-[12px] sm:text-[13.5px] leading-[1.6] text-foreground/72 tracking-[-0.003em] break-words">
                    {t("booking.cancellationWarningBefore")}{" "}
                    <span className="text-foreground/90 font-semibold">
                      {t("booking.cancellationWarningHours").replace(
                        "{hours}",
                        String(settings?.cancellationCutoffHours ?? 3),
                      )}
                    </span>{" "}
                    {t("booking.cancellationWarningAfter")}
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>

          {/* Footer — sticky consent + actions, always reachable.
              pb-[calc(1rem+env(safe-area-inset-bottom))] keeps the CTA
              above the home-indicator on iPhone X-class devices. */}
          <div className="relative shrink-0 px-4 xs:px-5 sm:px-7 pt-3.5 sm:pt-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-6 border-t border-white/[0.04] bg-[#06080A]/85 backdrop-blur-md">
            <label
              className="
                group flex items-start gap-3
                rounded-[14px] sm:rounded-[16px]
                border border-white/[0.05]
                bg-gradient-to-b from-white/[0.032] to-white/[0.01]
                backdrop-blur-[8px]
                px-3.5 py-3 xs:px-4 xs:py-3.5
                min-h-[48px]
                cursor-pointer select-none
                transition-all duration-[160ms] ease-out
                hover:border-primary/25
                hover:bg-gradient-to-b hover:from-primary/[0.045] hover:to-white/[0.01]
                hover:-translate-y-[1px]
                has-[[data-state=checked]]:border-primary/35
                has-[[data-state=checked]]:shadow-[0_0_0_1px_rgba(94,231,255,0.08),0_12px_28px_-14px_rgba(94,231,255,0.25)]
              "
            >
              <Checkbox
                checked={accepted}
                onCheckedChange={(v) => setAccepted(v === true)}
                data-testid="checkbox-accept-policy"
                className="mt-[2px] h-[18px] w-[18px] shrink-0 rounded-[5px] border-white/25 transition-colors duration-[140ms] data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
              />
              <span className="text-[12.5px] sm:text-[13px] leading-[1.55] text-foreground/85 tracking-[-0.003em] break-words">
                {t(
                  "booking.acceptWaiverAndCancellation",
                  "I have read and agree to the training waiver and cancellation policy.",
                )}
              </span>
            </label>

            <div className="mt-3.5 sm:mt-4 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-end gap-2 sm:gap-3">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsConfirmOpen(false)}
                data-testid="button-cancel-confirm"
                className="
                  h-11 sm:h-10 px-4
                  text-[13px] sm:text-[13.5px] font-medium tracking-[-0.005em]
                  text-foreground/55 hover:text-foreground/90
                  bg-transparent hover:bg-white/[0.035]
                  rounded-[11px]
                  transition-colors duration-[160ms] ease-out
                "
              >
                {t("common.cancel")}
              </Button>
              <Button
                onClick={handleBook}
                disabled={createBooking.isPending || !accepted}
                data-testid="button-confirm-booking"
                className="
                  ag-cta-sheen
                  relative overflow-hidden
                  h-11 sm:h-10 px-5 sm:px-6
                  text-[13.5px] sm:text-[14px] font-semibold tracking-[-0.005em]
                  rounded-[11px]
                  text-[#001218]
                  bg-gradient-to-b from-[#7defff] to-[#39d3f0]
                  hover:from-[#8df3ff] hover:to-[#4adcf6]
                  border border-primary/40
                  disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:from-[#7defff] disabled:hover:to-[#39d3f0]
                  shadow-[0_1px_0_0_rgba(255,255,255,0.4)_inset,0_-1px_0_0_rgba(0,30,40,0.22)_inset,0_0_24px_-6px_rgba(94,231,255,0.55),0_10px_24px_-12px_rgba(94,231,255,0.5)]
                  hover:shadow-[0_1px_0_0_rgba(255,255,255,0.5)_inset,0_-1px_0_0_rgba(0,30,40,0.22)_inset,0_0_32px_-4px_rgba(94,231,255,0.72),0_14px_30px_-12px_rgba(94,231,255,0.62)]
                  active:scale-[0.985]
                  disabled:opacity-35 disabled:cursor-not-allowed disabled:shadow-none disabled:from-primary/40 disabled:to-primary/30 disabled:active:scale-100
                  transition-[transform,box-shadow,background-color] duration-[180ms] ease-out
                  will-change-transform
                "
              >
                <span
                  aria-hidden
                  className="pointer-events-none absolute inset-x-3 top-0 h-px bg-gradient-to-r from-transparent via-white/70 to-transparent"
                />
                <span className="relative z-[1] inline-flex items-center gap-2">
                  {createBooking.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {t("booking.confirmBooking")}
                </span>
              </Button>
            </div>
          </div>
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

function GridCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0 flex flex-col gap-0.5">
      <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-foreground/45">
        {label}
      </span>
      <span className="text-[12.5px] font-semibold text-foreground/95 tracking-[-0.005em] break-words leading-[1.3]">
        {value}
      </span>
    </div>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      className="
        flex items-start justify-between gap-3
        py-2.5 sm:py-3 min-h-[40px] sm:min-h-[44px]
        text-[12.5px] sm:text-[13.5px]
        border-b border-white/[0.045] last:border-b-0
      "
    >
      <span className="shrink-0 text-foreground/55 tracking-[-0.003em]">{label}</span>
      <span className="min-w-0 font-semibold text-foreground/95 text-end break-words tracking-[-0.005em]">
        {value}
      </span>
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

