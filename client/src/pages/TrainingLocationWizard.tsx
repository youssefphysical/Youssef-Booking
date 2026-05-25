import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useDraft } from "@/lib/useDraft";
import { ToastAction } from "@/components/ui/toast";
import { enqueue as enqueueOffline, isOfflineError } from "@/lib/offlineQueue";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, MapPin, Home, Dumbbell, Building2, ArrowLeft, ArrowRight, ShieldCheck, AlertTriangle, Activity, MonitorPlay, Warehouse, BedDouble, ArrowUpDown, Car, DoorOpen, KeyRound, Navigation } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { resetAllCachesAndSW } from "@/lib/registerSW";
import { whatsappUrl } from "@/lib/whatsapp";
import type { TrainingLocation, Package as PackageRow } from "@shared/schema";

// Task #66 follow-up — visible build stamp so a real-mobile user can
// confirm they're on the latest JS bundle and not a stale SW-cached
// chunk. Bump this string in EVERY meaningful wizard edit. If the user
// sees an older value, the bundle is stale and they need to hard-reload
// (or hit the "Diagnostic Reset" button below the form).
// Build marker — bumped on every wizard edit. Combined with the git
// commit hash injected by scripts/vercel-build.mjs (VITE_GIT_HASH)
// this renders as "Build: 2026-05-22-diag-v3 · <git-hash>" in the
// wizard footer so a real-mobile user can confirm which exact
// production bundle they're running.
const WIZARD_BUILD = "2026-05-22-ux-phase1";
const WIZARD_GIT_HASH =
  (import.meta as any).env?.VITE_GIT_HASH || "local-dev";

type Branch = "fitness_zone" | "home" | "hotel" | "building" | "online_coaching" | "other_location" | null;
type FzPath = "existing" | "trial" | null;

// Task #66 follow-up — centralised post-wizard navigation. Every
// successful wizard completion routes through this helper so we
// never leave the user stuck on the wizard screen and every branch
// behaves consistently. The decision tree:
//   - Just submitted a package-activation request  → /dashboard
//     (booking stays locked until Youssef approves)
//   - Already has a pending activation request    → /dashboard
//   - Explicitly chose the "brand new" trial path → /book?type=free_trial
//   - Has an active package                       → /book
//   - Otherwise (lead w/ no package, location set)→ /book?type=free_trial
// `locationKind` is appended for the free-trial branch so the
// booking page can pre-fill the location chip.
type WizardFlow = "fz_existing" | "fz_trial" | "home" | "hotel" | "building" | "online_coaching" | "other_location";
function decideNextRoute(opts: {
  flow: WizardFlow;
  locationKind?: string;
  hasActivePackage: boolean;
  hasPendingActivation: boolean;
  justSubmittedActivation?: boolean;
}): string {
  if (opts.flow === "fz_existing" || opts.justSubmittedActivation) {
    return "/dashboard";
  }
  if (opts.hasPendingActivation) return "/dashboard";
  if (opts.flow === "fz_trial") return "/book?type=free_trial";
  if (opts.hasActivePackage) return "/book";
  const locQ = opts.locationKind ? `&location=${opts.locationKind}` : "";
  return `/book?type=free_trial${locQ}`;
}

export default function TrainingLocationWizard() {
  const { t } = useTranslation();
  const { user, isLoading: isLoadingAuth } = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [branch, setBranch] = useState<Branch>(null);
  const [fzPath, setFzPath] = useState<FzPath>(null);

  // Home form
  const [homeLabel, setHomeLabel] = useState("");
  const [homeAddress, setHomeAddress] = useState("");
  const [homeBuilding, setHomeBuilding] = useState("");
  const [homeRoom, setHomeRoom] = useState("");
  const [homeParking, setHomeParking] = useState("");
  const [homeEquip, setHomeEquip] = useState("");
  // Shared across physical-location forms (Building, Home, Hotel, Other).
  // Building Gym uses its own focused fields and skips address/room.
  const [mapsLink, setMapsLink] = useState("");
  const [gymFloor, setGymFloor] = useState("");

  // Gym form
  const [gymName, setGymName] = useState("");
  const [gymAddress, setGymAddress] = useState("");
  const [gymGuest, setGymGuest] = useState("");
  const [gymNotes, setGymNotes] = useState("");

  // FZ activation request form — receipt upload and purchase date were
  // removed per product requirement (Nov 2026). Admin verifies payment
  // manually outside the platform and approves via the queue.
  const [reqType, setReqType] = useState<"ten" | "twenty" | "twentyfive" | "duo30" | "not_sure">("not_sure");
  const [verifNotes, setVerifNotes] = useState("");
  // Task #66 follow-up — double-submit guard. The Finish button is
  // already disabled while mutations are pending, but mutationAsync()
  // resolves before React re-renders, so a fast double-click can
  // squeeze two requests through. This ref blocks the second one.
  const isSubmittingRef = useRef(false);

  // Task #66 follow-up — runtime diagnostic state. Renders into a
  // visible panel for admins (and any env where import.meta.env.DEV is
  // truthy) so a stuck "Submit for approval" produces actionable
  // evidence on screen and in console — never a silent return.
  type DebugState = {
    flow?: string;
    selectedPackage?: string;
    submitFired?: boolean;
    locationStatus?: "idle" | "pending" | "success" | "error" | "offline_queued";
    activationStatus?: "idle" | "pending" | "success" | "error" | "offline_queued";
    lastApiResponse?: any;
    lastError?: string;
    navTarget?: string;
    navigateExecuted?: boolean;
  };
  const [dbg, setDbg] = useState<DebugState>({});
  const patchDbg = (p: DebugState) => setDbg((prev) => ({ ...prev, ...p }));
  // Inline error rendered directly beneath the submit button. Toasts
  // can be missed on mobile (off-screen, dismissed by scroll, theme
  // contrast). Inline UI is undeniable.
  const [inlineError, setInlineError] = useState<string | null>(null);
  const showError = (msg: string) => {
    setInlineError(msg);
    patchDbg({ lastError: msg });
  };

  // Wouter's navigate() is a React state setter and CAN no-op if the
  // wizard component is unmounting / suspended / blocked by a parent
  // gate. The hard-redirect fallback guarantees the user never stays
  // on /wizard after a successful submit — if location.pathname is
  // still /wizard 600ms after navigate(), we force a real browser
  // navigation. Logs everything for the diagnostic panel.
  function safeNavigate(target: string) {
    console.log("[wizard-navigation-target]", target);
    patchDbg({ navTarget: target });
    try {
      navigate(target);
      console.log("[wizard-navigate-executed]", target);
      patchDbg({ navigateExecuted: true });
    } catch (err) {
      console.error("[wizard-navigate-throw]", err);
    }
    if (typeof window !== "undefined") {
      window.setTimeout(() => {
        try {
          if (window.location.pathname.startsWith("/wizard")) {
            console.warn(
              "[wizard-navigate-fallback] still on /wizard 600ms after navigate(); forcing hard redirect →",
              target,
            );
            window.location.assign(target);
          }
        } catch {/* defensive */}
      }, 600);
    }
  }

  // Phase 5 — draft recovery. Onboarding is the most expensive form
  // to lose, so we persist every field to localStorage and restore
  // on reload behind a toast with a Discard action.
  const draftKey = user?.id ? `wizard:${user.id}` : "wizard:anon";
  const draftValue = {
    step, branch, fzPath,
    homeLabel, homeAddress, homeBuilding, homeRoom, homeParking, homeEquip,
    mapsLink, gymFloor,
    gymName, gymAddress, gymGuest, gymNotes,
    reqType, verifNotes,
  };
  const wizardDraft = useDraft({
    key: draftKey,
    value: draftValue,
  });

  // Fresh-start: hero CTA passes ?fresh=1. Wipe all drafts, reset state,
  // strip the flag, and suppress the draft-recovery toast on this mount.
  const freshHandledRef = useRef(false);
  useEffect(() => {
    if (freshHandledRef.current) return;
    const isFresh = new URLSearchParams(window.location.search).get("fresh") === "1";
    if (!isFresh) return;
    freshHandledRef.current = true;
    wizardDraft.clear();
    try {
      const uid = user?.id ? String(user.id) : "anon";
      window.localStorage.removeItem("yapt:draft:v1:book:" + uid);
      window.localStorage.removeItem("yapt:draft:v1:book:anon");
    } catch {/* ignore */}
    setStep(1);
    setBranch(null);
    setFzPath(null);
    setHomeLabel(""); setHomeAddress(""); setHomeBuilding(""); setHomeRoom("");
    setHomeParking(""); setHomeEquip("");
    setMapsLink(""); setGymFloor("");
    setGymName(""); setGymAddress(""); setGymGuest(""); setGymNotes("");
    setReqType("not_sure"); setVerifNotes("");
    if (window.history.replaceState) {
      window.history.replaceState({}, "", window.location.pathname);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const draftHandledRef = useRef(false);
  useEffect(() => {
    if (freshHandledRef.current) return; // fresh-start already cleared everything
    if (draftHandledRef.current) return;
    if (!wizardDraft.hasDraft || !wizardDraft.draft) return;
    draftHandledRef.current = true;
    const d = wizardDraft.draft;
    toast({
      title: t("wizard.draftRestoredTitle", "Draft restored"),
      description: t(
        "wizard.draftRestoredDesc",
        "We brought back the onboarding answers you were filling out.",
      ),
      action: (
        <ToastAction
          altText="Discard draft"
          data-testid="button-wizard-draft-discard"
          onClick={() => {
            wizardDraft.clear();
            setStep(1); setBranch(null); setFzPath(null);
            setHomeLabel(""); setHomeAddress(""); setHomeBuilding(""); setHomeRoom("");
            setHomeParking(""); setHomeEquip("");
            setMapsLink(""); setGymFloor("");
            setGymName(""); setGymAddress(""); setGymGuest(""); setGymNotes("");
            setReqType("not_sure"); setVerifNotes("");
          }}
        >
          {t("wizard.draftDiscard", "Discard")}
        </ToastAction>
      ),
    });
    if (d.step) setStep(d.step);
    if (d.branch) setBranch(d.branch);
    if (d.fzPath) setFzPath(d.fzPath);
    if (typeof d.homeLabel === "string") setHomeLabel(d.homeLabel);
    if (typeof d.homeAddress === "string") setHomeAddress(d.homeAddress);
    if (typeof d.homeBuilding === "string") setHomeBuilding(d.homeBuilding);
    if (typeof d.homeRoom === "string") setHomeRoom(d.homeRoom);
    if (typeof d.homeParking === "string") setHomeParking(d.homeParking);
    if (typeof d.homeEquip === "string") setHomeEquip(d.homeEquip);
    if (typeof d.mapsLink === "string") setMapsLink(d.mapsLink);
    if (typeof d.gymFloor === "string") setGymFloor(d.gymFloor);
    if (typeof d.gymName === "string") setGymName(d.gymName);
    if (typeof d.gymAddress === "string") setGymAddress(d.gymAddress);
    if (typeof d.gymGuest === "string") setGymGuest(d.gymGuest);
    if (typeof d.gymNotes === "string") setGymNotes(d.gymNotes);
    if (d.reqType) setReqType(d.reqType);
    if (typeof d.verifNotes === "string") setVerifNotes(d.verifNotes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardDraft.hasDraft]);

  const {
    data: locations = [],
    isLoading: isLoadingLocations,
    isFetched: locationsFetched,
  } = useQuery<TrainingLocation[]>({
    queryKey: ["/api/training-locations"],
    enabled: !!user,
  });
  const {
    data: pkgs = [],
    isLoading: isLoadingPackages,
    isFetched: packagesFetched,
  } = useQuery<PackageRow[]>({
    queryKey: ["/api/packages", { userId: user?.id }],
    queryFn: async () => {
      const r = await fetch(`/api/packages?userId=${user?.id}`, { credentials: "include" });
      if (!r.ok) throw new Error("Failed to load packages");
      return r.json();
    },
    enabled: !!user,
  });
  const hasPendingVerif = (pkgs as any[]).some((p) => p.status === "pending_verification");
  const hasActivePackage = (pkgs as any[]).some((p) => p.status === "active");

  // Hydration gate — true while ANY of auth / locations / packages is
  // still resolving. Until this flips false the wizard renders a
  // full-page loader (NOT the branch picker), so the "Where do you
  // train?" step never flashes for users who already have a pending
  // verification or an active package. This is what eliminates the
  // refresh-flicker on every branch (FZ, Building, Home, Hotel, Other
  // gym) — the gate is universal.
  const isHydrating =
    isLoadingAuth ||
    (!!user && (isLoadingLocations || isLoadingPackages || !locationsFetched || !packagesFetched));

  // Once hydration settles, push the user to the right destination
  // BEFORE we render any wizard UI. Users who already have a pending
  // activation request belong on /dashboard (the "Package awaiting
  // verification" banner lives there); users with an active package
  // belong on /book. The effect runs after queries resolve, so the
  // gate above keeps the loader on-screen during the navigation tick.
  useEffect(() => {
    if (isHydrating) return;
    if (hasPendingVerif || hasActivePackage) {
      navigate(hasActivePackage && !hasPendingVerif ? "/book" : "/dashboard", { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHydrating, hasPendingVerif, hasActivePackage]);

  const saveLocation = useMutation({
    mutationFn: async (payload: any) => {
      const r = await apiRequest("POST", "/api/training-locations", payload);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/training-locations"] });
    },
  });

  const submitVerification = useMutation({
    mutationFn: async (payload: any) => {
      const r = await apiRequest("POST", "/api/package-verification-requests", payload);
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/packages"] });
    },
  });

  const cards = useMemo(
    () => [
      {
        key: "fitness_zone" as const,
        icon: <Dumbbell size={22} className="text-primary" />,
        title: t("wizard.fz.title", "Fitness Zone"),
        body: t("wizard.fz.body", "I train at Fitness Zone with Youssef."),
      },
      {
        key: "building" as const,
        icon: <Warehouse size={22} className="text-primary" />,
        title: t("wizard.building.title", "Building Gym"),
        body: t("wizard.building.body", "Youssef trains me at my building gym."),
      },
      {
        key: "hotel" as const,
        icon: <BedDouble size={22} className="text-primary" />,
        title: t("wizard.hotel.title", "Hotel Training"),
        body: t("wizard.hotel.body", "Youssef trains me at my hotel."),
      },
      {
        key: "online_coaching" as const,
        icon: <MonitorPlay size={22} className="text-primary" />,
        title: t("wizard.online.title", "Online Coaching"),
        body: t("wizard.online.body", "I train online with Youssef."),
      },
      {
        key: "other_location" as const,
        icon: <Activity size={22} className="text-primary" />,
        title: t("wizard.otherLocation.title", "Outdoor / Custom Workout"),
        body: t("wizard.otherLocation.body", "Park, beach, running, stadium, outdoor gym, football field, or custom location."),
      },
    ],
    [t],
  );

  async function finish() {
    // Task #66 follow-up — single-flight guard. Returns immediately on
    // a fast double-click so we never fire two saveLocation /
    // submitVerification mutations in parallel.
    if (isSubmittingRef.current) {
      console.warn("[wizard-submit-clicked] BLOCKED: already submitting (single-flight guard)");
      return;
    }
    isSubmittingRef.current = true;
    setInlineError(null);
    const flowLabel =
      branch === "fitness_zone"
        ? fzPath === "existing"
          ? "fz_existing"
          : fzPath === "trial"
            ? "fz_trial"
            : "fz_unset"
        : branch === "building"
          ? "building"
          : branch === "home"
            ? "home"
            : branch === "hotel"
              ? "hotel"
              : branch === "online_coaching"
                ? "online_coaching"
                : branch === "other_location"
                  ? "other_location"
                  : "unset";
    console.log("[wizard-submit-clicked]", {
      build: WIZARD_BUILD,
      flow: flowLabel,
      reqType,
      hasActivePackage,
      hasPendingVerif,
    });
    patchDbg({
      flow: flowLabel,
      selectedPackage: reqType,
      submitFired: true,
      locationStatus: "idle",
      activationStatus: "idle",
      navigateExecuted: false,
      lastError: undefined,
      navTarget: undefined,
      lastApiResponse: undefined,
    });
    try {
      await finishInner();
    } catch (err: any) {
      // Belt-and-suspenders: finishInner already handles known errors
      // via its inner try/catch blocks. Anything that escapes here is
      // unexpected (parse error, programmer mistake, etc.) — surface a
      // professional, user-facing message instead of failing silently.
      console.error("[wizard:finish] unhandled error", err);
      const msg = err?.message ? String(err.message).slice(0, 200) : "Unknown error";
      showError(msg);
      toast({
        title: t(
          "wizard.unexpectedError",
          "We couldn't submit your request. Please try again.",
        ),
        description: msg,
        variant: "destructive",
      });
    } finally {
      isSubmittingRef.current = false;
    }
  }

  async function finishInner() {
    // Phase 5 review fix — offline-first ordering. Previously
    // `saveLocation.mutateAsync(...)` ran before the offline guard, so
    // when the user was offline the wizard threw at the very first
    // network call and the activation payload (or even the location
    // payload itself) never reached the offline queue. We now check
    // navigator.onLine UP-FRONT for every branch and enqueue the full
    // intent (location + optional activation request) before any
    // mutation fires. Replay drains them in order on reconnect.
    const isOffline = typeof navigator !== "undefined" && navigator.onLine === false;
    const queuedToast = (descKey: string, fallback: string) =>
      toast({
        title: t("wizard.activation.queuedTitle", "Saved for later"),
        description: t(`wizard.activation.${descKey}`, fallback),
      });

    if (branch === "fitness_zone") {
      const locationPayload = {
        kind: "fitness_zone" as const,
        label: "Fitness Zone",
        isDefault: locations.length === 0,
      };
      const activationPayload =
        fzPath === "existing"
          ? { requestedType: reqType, notes: verifNotes || undefined }
          : null;

      if (isOffline) {
        console.warn("[wizard-training-location-start] offline → queueing");
        patchDbg({ locationStatus: "offline_queued" });
        enqueueOffline("wizard_location", "/api/training-locations", locationPayload);
        if (activationPayload) {
          patchDbg({ activationStatus: "offline_queued" });
          enqueueOffline(
            "wizard_activation",
            "/api/package-verification-requests",
            activationPayload,
          );
        }
        queuedToast(
          "queuedOffline",
          "You're offline. Your onboarding is queued and will send when you reconnect. Your answers stay saved on this device until it's accepted.",
        );
        safeNavigate("/dashboard");
        return;
      }

      console.log("[wizard-training-location-start]", locationPayload);
      patchDbg({ locationStatus: "pending" });
      try {
        const locRes = await saveLocation.mutateAsync(locationPayload);
        console.log("[wizard-training-location-success]", locRes);
        patchDbg({ locationStatus: "success", lastApiResponse: locRes });
      } catch (e: any) {
        console.error("[wizard-training-location-error]", e);
        patchDbg({ locationStatus: "error" });
        if (isOfflineError(e)) {
          patchDbg({ locationStatus: "offline_queued" });
          enqueueOffline("wizard_location", "/api/training-locations", locationPayload);
          if (activationPayload) {
            patchDbg({ activationStatus: "offline_queued" });
            enqueueOffline(
              "wizard_activation",
              "/api/package-verification-requests",
              activationPayload,
            );
          }
          queuedToast(
            "queuedDropped",
            "Connection dropped. Your onboarding is queued and will send when you're back online. Your answers stay saved on this device until it's accepted.",
          );
          safeNavigate("/dashboard");
          return;
        }
        const msg = e?.message || "Failed to save training location";
        showError(msg);
        toast({ title: msg, variant: "destructive" });
        return;
      }
      if (fzPath === "existing" && activationPayload) {
        // Online path — saveLocation already succeeded above. Submit
        // the activation request and, on confirmed server success,
        // toast the user, clear the draft, and redirect to the
        // dashboard via the centralised helper (no more dead-end
        // success panel — Task #66 follow-up).
        console.log("[wizard-package-request-start]", activationPayload);
        patchDbg({ activationStatus: "pending" });
        try {
          const verRes = await submitVerification.mutateAsync(activationPayload);
          console.log("[wizard-package-request-success]", verRes);
          patchDbg({ activationStatus: "success", lastApiResponse: verRes });
          wizardDraft.clear();
          toast({
            title: t(
              "wizard.fz.activationToast",
              "Package activation request received.",
            ),
            description: t(
              "wizard.fz.activationToastDesc",
              "We'll notify you once Youssef approves your package.",
            ),
          });
          safeNavigate(
            decideNextRoute({
              flow: "fz_existing",
              hasActivePackage,
              hasPendingActivation: true,
              justSubmittedActivation: true,
            }),
          );
          return;
        } catch (e: any) {
          console.error("[wizard-package-request-error]", e);
          patchDbg({ activationStatus: "error" });
          if (isOfflineError(e)) {
            patchDbg({ activationStatus: "offline_queued" });
            enqueueOffline(
              "wizard_activation",
              "/api/package-verification-requests",
              activationPayload,
            );
            queuedToast(
              "queuedDropped",
              "Connection dropped. Your activation request is queued and will send when you're back online. Your answers stay saved on this device until it's accepted.",
            );
            safeNavigate("/dashboard");
            return;
          }
          const msg = e?.message || "Failed to submit activation request";
          showError(msg);
          toast({ title: msg, variant: "destructive" });
          return;
        }
      }
      // FZ trial path — spec wants a celebratory pre-redirect toast so
      // users know what's about to happen before /book?type=free_trial
      // takes over.
      if (fzPath === "trial") {
        toast({
          title: t("wizard.fz.trialReadyTitle", "Free trial booking is ready."),
          description: t(
            "wizard.fz.trialReadyDesc",
            "Pick a time on the next page for your first Youssef Elite assessment session.",
          ),
        });
      }
      wizardDraft.clear();
      safeNavigate(
        decideNextRoute({
          flow: fzPath === "trial" ? "fz_trial" : "fz_existing",
          hasActivePackage,
          hasPendingActivation: hasPendingVerif,
        }),
      );
      return;
    }

    if (branch === "building") {
      if (!mapsLink.trim()) {
        toast({ title: t("wizard.building.needMaps", "Google Maps link is required."), variant: "destructive" });
        return;
      }
      const payload = {
        kind: "building" as const,
        label: homeLabel || t("wizard.building.defaultLabel", "Building Gym"),
        buildingName: homeBuilding || undefined,
        gymFloor: gymFloor || undefined,
        parkingNotes: homeParking || undefined,
        equipmentNotes: homeEquip || undefined,
        mapsLink: mapsLink || undefined,
        isDefault: locations.length === 0,
      };
      const next = decideNextRoute({
        flow: "building",
        hasActivePackage,
        hasPendingActivation: hasPendingVerif,
      });
      if (isOffline) {
        console.warn("[wizard-training-location-start] offline → queueing (building)");
        patchDbg({ locationStatus: "offline_queued" });
        enqueueOffline("wizard_location", "/api/training-locations", payload);
        queuedToast("queuedOffline", "You're offline. Your location is queued and will send when you reconnect.");
        safeNavigate(next);
        return;
      }
      console.log("[wizard-training-location-start]", payload);
      patchDbg({ locationStatus: "pending" });
      try {
        const res = await saveLocation.mutateAsync(payload);
        console.log("[wizard-training-location-success]", res);
        patchDbg({ locationStatus: "success", lastApiResponse: res });
      } catch (e: any) {
        console.error("[wizard-training-location-error]", e);
        patchDbg({ locationStatus: "error" });
        if (isOfflineError(e)) {
          patchDbg({ locationStatus: "offline_queued" });
          enqueueOffline("wizard_location", "/api/training-locations", payload);
          queuedToast("queuedDropped", "Connection dropped. Your location is queued and will send when you're back online.");
          safeNavigate(next);
          return;
        }
        const msg = e?.message || "Failed to save training location";
        showError(msg);
        toast({ title: msg, variant: "destructive" });
        return;
      }
      toast({ title: t("wizard.building.savedTitle", "Building gym setup saved.") });
      wizardDraft.clear();
      safeNavigate(next);
      return;
    }

    if (branch === "home") {
      if (!homeAddress.trim()) {
        toast({ title: t("wizard.home.needAddress", "Address is required."), variant: "destructive" });
        return;
      }
      const payload = {
        kind: "home" as const,
        label: homeLabel || t("wizard.home.defaultLabel", "Home"),
        address: homeAddress,
        buildingName: homeBuilding || undefined,
        roomNumber: homeRoom || undefined,
        parkingNotes: homeParking || undefined,
        equipmentNotes: homeEquip || undefined,
        mapsLink: mapsLink || undefined,
        isDefault: locations.length === 0,
      };
      const next = decideNextRoute({
        flow: "home",
        hasActivePackage,
        hasPendingActivation: hasPendingVerif,
      });
      if (isOffline) {
        console.warn("[wizard-training-location-start] offline → queueing (home)");
        patchDbg({ locationStatus: "offline_queued" });
        enqueueOffline("wizard_location", "/api/training-locations", payload);
        queuedToast("queuedOffline", "You're offline. Your location is queued and will send when you reconnect.");
        safeNavigate(next);
        return;
      }
      console.log("[wizard-training-location-start]", payload);
      patchDbg({ locationStatus: "pending" });
      try {
        const res = await saveLocation.mutateAsync(payload);
        console.log("[wizard-training-location-success]", res);
        patchDbg({ locationStatus: "success", lastApiResponse: res });
      } catch (e: any) {
        console.error("[wizard-training-location-error]", e);
        patchDbg({ locationStatus: "error" });
        if (isOfflineError(e)) {
          patchDbg({ locationStatus: "offline_queued" });
          enqueueOffline("wizard_location", "/api/training-locations", payload);
          queuedToast("queuedDropped", "Connection dropped. Your location is queued and will send when you're back online.");
          safeNavigate(next);
          return;
        }
        const msg = e?.message || "Failed to save training location";
        showError(msg);
        toast({ title: msg, variant: "destructive" });
        return;
      }
      toast({ title: t("wizard.home.savedTitle", "Training setup saved.") });
      wizardDraft.clear();
      safeNavigate(next);
      return;
    }

    if (branch === "hotel") {
      if (!mapsLink.trim()) {
        toast({ title: t("wizard.hotel.needMaps", "Google Maps link is required."), variant: "destructive" });
        return;
      }
      const payload = {
        kind: "hotel" as const,
        label: homeBuilding || t("wizard.hotel.defaultLabel", "Hotel"),
        buildingName: homeBuilding || undefined,
        gymFloor: gymFloor || undefined,
        roomNumber: homeRoom || undefined,
        parkingNotes: homeParking || undefined,
        mapsLink: mapsLink || undefined,
        isDefault: locations.length === 0,
      };
      const next = decideNextRoute({
        flow: "hotel",
        hasActivePackage,
        hasPendingActivation: hasPendingVerif,
      });
      if (isOffline) {
        console.warn("[wizard-training-location-start] offline → queueing (hotel)");
        patchDbg({ locationStatus: "offline_queued" });
        enqueueOffline("wizard_location", "/api/training-locations", payload);
        queuedToast("queuedOffline", "You're offline. Your location is queued and will send when you reconnect.");
        safeNavigate(next);
        return;
      }
      console.log("[wizard-training-location-start]", payload);
      patchDbg({ locationStatus: "pending" });
      try {
        const res = await saveLocation.mutateAsync(payload);
        console.log("[wizard-training-location-success]", res);
        patchDbg({ locationStatus: "success", lastApiResponse: res });
      } catch (e: any) {
        console.error("[wizard-training-location-error]", e);
        patchDbg({ locationStatus: "error" });
        if (isOfflineError(e)) {
          patchDbg({ locationStatus: "offline_queued" });
          enqueueOffline("wizard_location", "/api/training-locations", payload);
          queuedToast("queuedDropped", "Connection dropped. Your location is queued and will send when you're back online.");
          safeNavigate(next);
          return;
        }
        const msg = e?.message || "Failed to save training location";
        showError(msg);
        toast({ title: msg, variant: "destructive" });
        return;
      }
      toast({ title: t("wizard.hotel.savedTitle", "Hotel training setup saved.") });
      wizardDraft.clear();
      safeNavigate(next);
      return;
    }

    if (branch === "online_coaching") {
      const url = whatsappUrl(
        null,
        "Hi Youssef, I'm interested in online coaching. I'd like to know more about the available plans, nutrition support, supplement guidance, and how we can start.",
      );
      window.open(url, "_blank", "noopener,noreferrer");
      wizardDraft.clear();
      return;
    }

    if (branch === "other_location") {
      if (!mapsLink.trim()) {
        toast({ title: t("wizard.otherLocation.needMaps", "Google Maps link is required."), variant: "destructive" });
        return;
      }
      if (!gymName.trim()) {
        toast({ title: t("wizard.otherLocation.needName", "Location name is required."), variant: "destructive" });
        return;
      }
      const payload = {
        kind: "other_location" as const,
        label: gymName,
        gymName,
        address: gymAddress || undefined,
        accessNotes: gymNotes || undefined,
        mapsLink: mapsLink || undefined,
        isDefault: locations.length === 0,
      };
      const next = decideNextRoute({
        flow: "other_location",
        hasActivePackage,
        hasPendingActivation: hasPendingVerif,
      });
      if (isOffline) {
        console.warn("[wizard-training-location-start] offline → queueing (other_location)");
        patchDbg({ locationStatus: "offline_queued" });
        enqueueOffline("wizard_location", "/api/training-locations", payload);
        queuedToast("queuedOffline", "You're offline. Your location is queued and will send when you reconnect.");
        safeNavigate(next);
        return;
      }
      console.log("[wizard-training-location-start]", payload);
      patchDbg({ locationStatus: "pending" });
      try {
        const res = await saveLocation.mutateAsync(payload);
        console.log("[wizard-training-location-success]", res);
        patchDbg({ locationStatus: "success", lastApiResponse: res });
      } catch (e: any) {
        console.error("[wizard-training-location-error]", e);
        patchDbg({ locationStatus: "error" });
        if (isOfflineError(e)) {
          patchDbg({ locationStatus: "offline_queued" });
          enqueueOffline("wizard_location", "/api/training-locations", payload);
          queuedToast("queuedDropped", "Connection dropped. Your location is queued and will send when you're back online.");
          safeNavigate(next);
          return;
        }
        const msg = e?.message || "Failed to save location details";
        showError(msg);
        toast({ title: msg, variant: "destructive" });
        return;
      }
      toast({ title: t("wizard.otherLocation.savedTitle", "Location details saved.") });
      wizardDraft.clear();
      safeNavigate(next);
      return;
    }
  }

  // Render the premium loader while hydrating OR while the
  // post-hydration redirect (to /dashboard or /book) is in flight.
  // This is the SINGLE source that prevents the wizard from flashing
  // on refresh — it covers Fitness Zone, Building, Home, Hotel, and
  // Other Gym branches uniformly because it gates the entire return
  // tree, not any per-branch sub-render.
  if (isHydrating || hasPendingVerif || hasActivePackage) {
    return (
      <div
        className="min-h-screen w-full flex items-center justify-center px-6"
        data-testid="loader-wizard-hydrating"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <Loader2 size={28} className="text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">
            {t("wizard.loading", "Loading your fitness experience…")}
          </p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen px-4 py-10 pt-24 max-w-2xl mx-auto" data-testid="wizard-training-location">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <div className="flex items-center gap-2 mb-6">
          <MapPin size={18} className="text-primary" />
          <p className="tron-eyebrow text-[10px] font-semibold">{t("wizard.eyebrow", "One last step")}</p>
        </div>
        <h1 className="text-2xl sm:text-3xl font-display font-bold mb-1" data-testid="text-wizard-title">
          {step === 1
            ? t("wizard.title", "Where do you train?")
            : branch === "fitness_zone"
              ? t("wizard.fz.stepTitle", "Tell us about your Fitness Zone setup")
              : branch === "building"
                ? t("wizard.building.stepTitle", "Tell us about your building gym")
                : branch === "home"
                  ? t("wizard.home.stepTitle", "Where should Youssef meet you?")
                  : branch === "hotel"
                    ? t("wizard.hotel.stepTitle", "Tell us about your hotel")
                    : branch === "online_coaching"
                      ? t("wizard.online.stepTitle", "Online coaching setup")
                      : t("wizard.otherLocation.stepTitle", "Tell us about your location")}
        </h1>
        <p className="text-[13px] text-muted-foreground/70 mt-2 mb-6">
          {step === 1
            ? t("wizard.subtitle", "Pick the option that matches your training setup. You can change it later.")
            : t("wizard.subtitle2", "Saved for future bookings.")}
        </p>

        {step === 1 && (
          <div className="grid grid-cols-1 gap-3" data-testid="grid-wizard-branches">
            {cards.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
                  if (c.key === "online_coaching") {
                    const url = whatsappUrl(
                      null,
                      "Hi Youssef, I'm interested in online coaching. I'd like to know more about the available plans, nutrition support, supplement guidance, and how we can start.",
                    );
                    window.open(url, "_blank", "noopener,noreferrer");
                    return;
                  }
                  setBranch(c.key);
                  setStep(2);
                }}
                data-testid={`button-branch-${c.key}`}
                className="text-left rounded-2xl border border-white/10 bg-white/[0.03] p-4 hover:border-primary/40 transition-colors min-h-[64px]"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                    {c.icon}
                  </div>
                  <div className="min-w-0">
                    <p className="font-semibold">{c.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{c.body}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}

        {step === 2 && branch === "fitness_zone" && (
          <div className="space-y-4">
            {hasPendingVerif ? (
              <div className="rounded-2xl border border-cyan-500/40 bg-cyan-500/10 p-4 text-sm" data-testid="text-fz-already-pending">
                {t(
                  "wizard.fz.alreadyPending",
                  "You already have a verification request in review. We'll notify you once Youssef approves it.",
                )}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-2" data-testid="grid-fz-paths">
                  <button
                    type="button"
                    onClick={() => setFzPath("existing")}
                    data-testid="button-fz-existing"
                    className={`text-left rounded-xl border p-3 min-h-[56px] transition-colors ${
                      fzPath === "existing" ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <p className="text-sm font-semibold">
                      {t("wizard.fz.pathExisting", "I'm already a Fitness Zone PT client")}
                    </p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t("wizard.fz.pathExistingHint", "Send your receipt — Youssef will activate your package.")}
                    </p>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFzPath("trial")}
                    data-testid="button-fz-trial"
                    className={`text-left rounded-xl border p-3 min-h-[56px] transition-colors ${
                      fzPath === "trial" ? "border-primary bg-primary/10" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    <p className="text-sm font-semibold">{t("wizard.fz.pathTrial", "I'm brand new")}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t("wizard.fz.pathTrialHint", "Book a free trial session with Youssef.")}
                    </p>
                  </button>
                </div>

                {fzPath === "existing" && (
                  <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4" data-testid="form-fz-verification">
                    <div>
                      <Label className="text-xs">{t("wizard.fz.packageType", "Which package did you buy?")}</Label>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                        {([
                          ["ten", "10"],
                          ["twenty", "20"],
                          ["twentyfive", "25"],
                          ["duo30", "Duo 30"],
                          ["not_sure", t("wizard.fz.notSure", "Not sure")],
                        ] as const).map(([val, label]) => (
                          <button
                            key={val}
                            type="button"
                            onClick={() => setReqType(val as any)}
                            data-testid={`button-req-type-${val}`}
                            className={`rounded-lg border px-2 py-2 text-xs min-h-[44px] ${
                              reqType === val ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/[0.03]"
                            }`}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-xl border border-cyan-500/25 bg-cyan-500/[0.04] p-3 text-xs text-cyan-100/90 flex items-start gap-2">
                      <ShieldCheck size={14} className="text-cyan-300 mt-0.5 shrink-0" />
                      <span>
                        {t(
                          "wizard.fz.noReceiptInfo",
                          "The Youssef Elite team will review your package and unlock your booking access once activation is complete.",
                        )}
                      </span>
                    </div>
                    <div>
                      <Label className="text-xs">{t("wizard.fz.notes", "Notes for Youssef (optional)")}</Label>
                      <Textarea
                        value={verifNotes}
                        onChange={(e) => setVerifNotes(e.target.value)}
                        rows={2}
                        className="bg-white/5 border-white/10 mt-1"
                        data-testid="input-verif-notes"
                      />
                    </div>
                    <NextStepsTimeline />
                  </div>
                )}

                {fzPath === "trial" && (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm" data-testid="text-fz-trial-info">
                    {t(
                      "wizard.fz.trialInfo",
                      "Great — we'll take you to the booking page so you can pick a free trial slot.",
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 2 && branch === "building" && (
          <div className="space-y-5" data-testid="form-building-location">
            <Field
              label={t("wizard.building.maps", "Google Maps Location Link")}
              value={mapsLink}
              onChange={setMapsLink}
              testId="input-building-maps-link"
              placeholder={t("wizard.building.mapsPh", "Paste the building location link here")}
              required
              icon={<MapPin size={11} />}
              hint={t("wizard.mapsHint", "Open Google Maps → Share → Copy link")}
            />
            <Field
              label={t("wizard.building.community", "Building Name")}
              value={homeBuilding}
              onChange={setHomeBuilding}
              testId="input-building-building"
              placeholder={t("wizard.building.communityPh", "Marina Gate Tower, Downtown Views, JVC Residence")}
              icon={<Building2 size={11} />}
            />
            <Field
              label={t("wizard.building.floor", "Gym Floor")}
              value={gymFloor}
              onChange={setGymFloor}
              testId="input-building-floor"
              placeholder={t("wizard.building.floorPh", "3rd Floor, G Floor, Rooftop Gym, Level 2")}
              icon={<ArrowUpDown size={11} />}
            />
            <FieldArea
              label={t("wizard.building.access", "Parking / Access Notes (optional)")}
              value={homeParking}
              onChange={setHomeParking}
              testId="input-building-parking"
              placeholder={t("wizard.building.accessPh", "Visitor parking, Reception access, Gate code")}
              icon={<KeyRound size={11} />}
            />
          </div>
        )}

        {step === 2 && branch === "home" && (
          <div className="space-y-3" data-testid="form-home-location">
            <Field label={t("wizard.home.label", "Nickname (optional)")} value={homeLabel} onChange={setHomeLabel} testId="input-home-label" />
            <Field label={t("wizard.home.address", "Address")} value={homeAddress} onChange={setHomeAddress} testId="input-home-address" required />
            <Field
              label={t("wizard.home.maps", "Google Maps Location Link (optional)")}
              value={mapsLink}
              onChange={setMapsLink}
              testId="input-home-maps-link"
              placeholder={t("wizard.home.mapsPh", "Paste the location link here")}
            />
            <Field label={t("wizard.home.building", "Building / community")} value={homeBuilding} onChange={setHomeBuilding} testId="input-home-building" />
            <Field label={t("wizard.home.room", "Unit / room")} value={homeRoom} onChange={setHomeRoom} testId="input-home-room" />
            <FieldArea label={t("wizard.home.parking", "Parking notes")} value={homeParking} onChange={setHomeParking} testId="input-home-parking" />
            <FieldArea label={t("wizard.home.equipment", "Equipment available")} value={homeEquip} onChange={setHomeEquip} testId="input-home-equipment" />
          </div>
        )}

        {step === 2 && branch === "hotel" && (
          <div className="space-y-4" data-testid="form-hotel-location">
            <Field
              label={t("wizard.hotel.maps", "Google Maps Location Link")}
              value={mapsLink}
              onChange={setMapsLink}
              testId="input-hotel-maps-link"
              placeholder={t("wizard.hotel.mapsPh", "Paste the hotel location link here")}
              required
              icon={<MapPin size={11} />}
              hint={t("wizard.mapsHint", "Open Google Maps → Share → Copy link")}
            />
            <Field
              label={t("wizard.hotel.name", "Hotel Name")}
              value={homeBuilding}
              onChange={setHomeBuilding}
              testId="input-hotel-name"
              placeholder={t("wizard.hotel.namePh", "Example: Marriott, JW Marriott, Jumeirah")}
              icon={<BedDouble size={11} />}
            />
            <Field
              label={t("wizard.building.floor", "Gym Floor")}
              value={gymFloor}
              onChange={setGymFloor}
              testId="input-hotel-floor"
              placeholder={t("wizard.building.floorPh", "3rd Floor, G Floor, Rooftop Gym, Level 2")}
              icon={<ArrowUpDown size={11} />}
            />
            <Field
              label={t("wizard.hotel.room", "Room Number (optional)")}
              value={homeRoom}
              onChange={setHomeRoom}
              testId="input-hotel-room"
              placeholder={t("wizard.hotel.roomPh", "Example: 512")}
              icon={<DoorOpen size={11} />}
            />
            <FieldArea
              label={t("wizard.hotel.access", "Access Notes (optional)")}
              value={homeParking}
              onChange={setHomeParking}
              testId="input-hotel-access"
              placeholder={t("wizard.hotel.accessPh", "Example: Gym on 3rd floor, ask reception for access")}
              icon={<Key size={11} />}
            />
          </div>
        )}

        {step === 2 && branch === "online_coaching" && (
          <div className="space-y-3" data-testid="form-online-coaching">
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground/80 leading-relaxed">
              {t("wizard.online.info", "You will receive a video call link via WhatsApp before each online session. Make sure you have a stable internet connection and enough space to train.")}
            </div>
          </div>
        )}

        {step === 2 && branch === "other_location" && (
          <div className="space-y-4" data-testid="form-other-location">
            <Field
              label={t("wizard.other.maps", "Google Maps Location Link")}
              value={mapsLink}
              onChange={setMapsLink}
              testId="input-other-location-maps-link"
              placeholder={t("wizard.other.mapsPh", "Paste the location link here")}
              required
              icon={<MapPin size={11} />}
              hint={t("wizard.mapsHint", "Open Google Maps → Share → Copy link")}
            />
            <Field
              label={t("wizard.otherLocation.name", "Training Place Name")}
              value={gymName}
              onChange={setGymName}
              testId="input-other-location-name"
              required
              placeholder={t("wizard.otherLocation.namePh", "Example: Kite Beach, Gold's Gym, Running Track")}
              icon={<Dumbbell size={11} />}
            />
            <Field
              label={t("wizard.other.address", "Area / Location")}
              value={gymAddress}
              onChange={setGymAddress}
              testId="input-other-location-address"
              placeholder={t("wizard.other.addressPh", "Example: Dubai Marina, JVC, Downtown")}
              icon={<Navigation size={11} />}
            />
            <FieldArea
              label={t("wizard.other.notes", "Notes (optional)")}
              value={gymNotes}
              onChange={setGymNotes}
              testId="input-other-location-notes"
              placeholder={t("wizard.other.notesPh", "Gate code / parking details / landmark")}
              icon={<ShieldCheck size={11} />}
            />
          </div>
        )}

        {step === 2 && (
          <div className="flex gap-3 pt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setStep(1);
                setFzPath(null);
              }}
              className="h-12 px-5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/5 transition-all duration-150"
              data-testid="button-wizard-back"
            >
              <ArrowLeft size={14} className="mr-2" /> {t("common.back", "Back")}
            </Button>
            <Button
              type="button"
              onClick={() => finish()}
              disabled={
                saveLocation.isPending ||
                submitVerification.isPending ||
                (branch === "fitness_zone" && !hasPendingVerif && !fzPath)
              }
              className="flex-1 h-12 rounded-xl font-bold transition-all duration-150 hover:shadow-[0_0_18px_rgba(94,231,255,0.35)] active:scale-[0.97]"
              data-testid="button-wizard-finish"
            >
              {(saveLocation.isPending || submitVerification.isPending) && (
                <Loader2 size={14} className="animate-spin mr-2" />
              )}
              {/* Per-branch CTA + per-branch loading label. The user
                  must always know what's happening so the button never
                  reverts to a generic "Continue" while a network call
                  is in flight. */}
              {(() => {
                const submitting =
                  saveLocation.isPending || submitVerification.isPending;
                if (branch === "fitness_zone" && fzPath === "existing") {
                  return submitting
                    ? t("wizard.fz.submitCtaLoading", "Sending request…")
                    : t("wizard.fz.submitCta", "Submit for approval");
                }
                if (branch === "fitness_zone" && fzPath === "trial") {
                  return submitting
                    ? t("wizard.fz.trialCtaLoading", "Preparing your free trial…")
                    : t("common.continue", "Continue");
                }
                if (branch === "fitness_zone" && hasPendingVerif) {
                  return t("common.continue", "Continue");
                }
                if (branch === "home") {
                  return submitting
                    ? t("wizard.home.ctaLoadingHome", "Saving your training setup…")
                    : t("common.continue", "Continue");
                }
                if (branch === "other_location") {
                  return submitting
                    ? t("wizard.otherLocation.ctaLoading", "Saving your location details…")
                    : t("common.continue", "Continue");
                }
                return submitting
                  ? t("wizard.saveCtaLoading", "Saving…")
                  : t("wizard.saveCta", "Save location");
              })()}
              <ArrowRight size={14} className="ml-2" />
            </Button>
          </div>
        )}

        {/* Task #66 follow-up — inline error rendered directly beneath
            the submit button. Toasts can be off-screen / dismissed on
            mobile, but an inline block under the CTA is undeniable. */}
        {inlineError && (
          <div
            role="alert"
            data-testid="text-wizard-inline-error"
            className="mt-4 rounded-xl border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-300 flex items-start gap-2"
          >
            <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-semibold">Submission failed</div>
              <div className="opacity-90 break-words">{inlineError}</div>
            </div>
          </div>
        )}

        {/* Always-visible build stamp. Lets a real-mobile user confirm
            they are on the latest JS bundle. If they see an older
            value than what was just shipped, the SW is serving stale
            code — they should hit "Diagnostic reset" below. */}
        <div
          className="mt-6 text-[10px] text-muted-foreground/60 text-center font-mono"
          data-testid="text-wizard-build"
        >
          Build: {WIZARD_BUILD} · {WIZARD_GIT_HASH}
        </div>

        {/* Diagnostic panel — admin OR vite-dev only. Renders every
            piece of state needed to localise where the flow stops:
            which handler fired, mutation statuses, last API response,
            last error, navigation target, whether navigate executed. */}
        {(user?.role === "admin" || import.meta.env.DEV) && (
          <div
            className="mt-4 rounded-xl border border-cyan-400/30 bg-cyan-400/5 p-3 text-[11px] font-mono space-y-1"
            data-testid="panel-wizard-debug"
          >
            <div className="font-bold text-cyan-300 mb-2">Wizard diagnostic ({user?.role === "admin" ? "admin" : "dev"})</div>
            <div><span className="text-cyan-400">flow:</span> {dbg.flow ?? "—"}</div>
            <div><span className="text-cyan-400">selectedPackage:</span> {dbg.selectedPackage ?? "—"}</div>
            <div><span className="text-cyan-400">submitFired:</span> {String(dbg.submitFired ?? false)}</div>
            <div><span className="text-cyan-400">saveLocation.isPending:</span> {String(saveLocation.isPending)}</div>
            <div><span className="text-cyan-400">submitVerification.isPending:</span> {String(submitVerification.isPending)}</div>
            <div><span className="text-cyan-400">locationStatus:</span> {dbg.locationStatus ?? "—"}</div>
            <div><span className="text-cyan-400">activationStatus:</span> {dbg.activationStatus ?? "—"}</div>
            <div><span className="text-cyan-400">lastApiResponse:</span> <span className="break-all">{dbg.lastApiResponse ? JSON.stringify(dbg.lastApiResponse).slice(0, 200) : "—"}</span></div>
            <div><span className="text-cyan-400">lastError:</span> <span className="break-all text-red-300">{dbg.lastError ?? "—"}</span></div>
            <div><span className="text-cyan-400">navTarget:</span> {dbg.navTarget ?? "—"}</div>
            <div><span className="text-cyan-400">navigateExecuted:</span> {String(dbg.navigateExecuted ?? false)}</div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                className="flex-1 px-2 py-1 rounded border border-cyan-400/40 hover:bg-cyan-400/10"
                data-testid="button-wizard-clear-draft"
                onClick={() => {
                  try { wizardDraft.clear(); } catch {/* swallow */}
                  try { localStorage.removeItem("yapt:queue:v1"); } catch {/* swallow */}
                  console.log("[wizard-diag] cleared draft + offline queue");
                  toast({ title: "Draft + offline queue cleared." });
                }}
              >
                Clear draft & queue
              </button>
              <button
                type="button"
                className="flex-1 px-2 py-1 rounded border border-red-400/40 hover:bg-red-400/10 text-red-300"
                data-testid="button-wizard-diag-reset"
                onClick={async () => {
                  console.log("[wizard-diag] hard reset starting");
                  try { wizardDraft.clear(); } catch {/* swallow */}
                  try { localStorage.removeItem("yapt:queue:v1"); } catch {/* swallow */}
                  try { sessionStorage.removeItem("__sw_reloaded__"); } catch {/* swallow */}
                  await resetAllCachesAndSW();
                  console.log("[wizard-diag] hard reset done → reloading");
                  window.location.assign("/wizard?ts=" + Date.now());
                }}
              >
                Diagnostic reset (unregister SW)
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange, testId, required, placeholder, icon, hint }: {
  label: string; value: string; onChange: (v: string) => void; testId: string; required?: boolean; placeholder?: string; icon?: React.ReactNode; hint?: string;
}) {
  return (
    <div>
      <Label className="text-[13px] flex items-center gap-2 mb-1.5">
        {icon && (
          <span className="text-primary" style={{ filter: "drop-shadow(0 0 4px rgba(94,231,255,0.65))" }}>
            {icon}
          </span>
        )}
        {label}{required ? " *" : ""}
      </Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="bg-white/5 border-white/10 h-[50px] text-sm placeholder:text-muted-foreground/60 transition-all duration-150 focus:border-primary/40 focus:ring-1 focus:ring-primary/20" data-testid={testId} />
      {hint && (
        <p className="mt-1.5 flex items-center gap-1 text-[11px] text-primary/50">
          <MapPin size={9} className="shrink-0" />
          {hint}
        </p>
      )}
    </div>
  );
}
function FieldArea({ label, value, onChange, testId, placeholder, icon }: {
  label: string; value: string; onChange: (v: string) => void; testId: string; placeholder?: string; icon?: React.ReactNode;
}) {
  return (
    <div>
      <Label className="text-[13px] flex items-center gap-2 mb-1.5">
        {icon && (
          <span className="text-primary" style={{ filter: "drop-shadow(0 0 4px rgba(94,231,255,0.65))" }}>
            {icon}
          </span>
        )}
        {label}
      </Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} placeholder={placeholder} className="bg-white/5 border-white/10 text-sm placeholder:text-muted-foreground/60 transition-all duration-150 focus:border-primary/40 focus:ring-1 focus:ring-primary/20" data-testid={testId} />
    </div>
  );
}

export function NextStepsTimeline() {
  const { t } = useTranslation();
  const steps = [
    t("wizard.next.review", "Coach review"),
    t("wizard.next.activation", "Package activation"),
    t("wizard.next.book", "Book your sessions"),
  ];
  return (
    <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3" data-testid="banner-next-steps">
      <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-2">
        {t("wizard.next.title", "What happens next")}
      </p>
      <ol className="space-y-1.5">
        {steps.map((s, i) => (
          <li key={s} className="flex items-center gap-2 text-xs">
            <span className="w-5 h-5 rounded-full bg-primary/15 border border-primary/40 text-primary text-[10px] font-bold flex items-center justify-center">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
