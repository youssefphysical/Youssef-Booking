import { useState, useMemo, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useDraft } from "@/lib/useDraft";
import { ToastAction } from "@/components/ui/toast";
import { enqueue as enqueueOffline, isOfflineError } from "@/lib/offlineQueue";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, MapPin, Home, Dumbbell, Building2, ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "@/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { TrainingLocation, Package as PackageRow } from "@shared/schema";

type Branch = "fitness_zone" | "home" | "other_gym" | null;
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
type WizardFlow = "fz_existing" | "fz_trial" | "home" | "other_gym";
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
  const { user } = useAuth();
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
  const [homeKind, setHomeKind] = useState<"home" | "building" | "hotel">("home");

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

  // Phase 5 — draft recovery. Onboarding is the most expensive form
  // to lose, so we persist every field to localStorage and restore
  // on reload behind a toast with a Discard action.
  const draftKey = user?.id ? `wizard:${user.id}` : "wizard:anon";
  const draftValue = {
    step, branch, fzPath,
    homeLabel, homeAddress, homeBuilding, homeRoom, homeParking, homeEquip, homeKind,
    gymName, gymAddress, gymGuest, gymNotes,
    reqType, verifNotes,
  };
  const wizardDraft = useDraft({
    key: draftKey,
    value: draftValue,
  });
  const draftHandledRef = useRef(false);
  useEffect(() => {
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
            setHomeParking(""); setHomeEquip(""); setHomeKind("home");
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
    if (d.homeKind) setHomeKind(d.homeKind);
    if (typeof d.gymName === "string") setGymName(d.gymName);
    if (typeof d.gymAddress === "string") setGymAddress(d.gymAddress);
    if (typeof d.gymGuest === "string") setGymGuest(d.gymGuest);
    if (typeof d.gymNotes === "string") setGymNotes(d.gymNotes);
    if (d.reqType) setReqType(d.reqType);
    if (typeof d.verifNotes === "string") setVerifNotes(d.verifNotes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wizardDraft.hasDraft]);

  const { data: locations = [] } = useQuery<TrainingLocation[]>({
    queryKey: ["/api/training-locations"],
    enabled: !!user,
  });
  const { data: pkgs = [] } = useQuery<PackageRow[]>({
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
        key: "home" as const,
        icon: <Home size={22} className="text-primary" />,
        title: t("wizard.home.title", "Home, building or hotel"),
        body: t("wizard.home.body", "Youssef trains me at my place."),
      },
      {
        key: "other_gym" as const,
        icon: <Building2 size={22} className="text-primary" />,
        title: t("wizard.other.title", "Another gym"),
        body: t("wizard.other.body", "I train at a different gym."),
      },
    ],
    [t],
  );

  async function finish() {
    // Task #66 follow-up — single-flight guard. Returns immediately on
    // a fast double-click so we never fire two saveLocation /
    // submitVerification mutations in parallel.
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      await finishInner();
    } catch (err: any) {
      // Belt-and-suspenders: finishInner already handles known errors
      // via its inner try/catch blocks. Anything that escapes here is
      // unexpected (parse error, programmer mistake, etc.) — surface a
      // professional, user-facing message instead of failing silently.
      console.error("[wizard:finish] unhandled error", err);
      toast({
        title: t(
          "wizard.unexpectedError",
          "We couldn't submit your request. Please try again.",
        ),
        description: err?.message ? String(err.message).slice(0, 200) : undefined,
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
        enqueueOffline("wizard_location", "/api/training-locations", locationPayload);
        if (activationPayload) {
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
        navigate("/dashboard");
        return;
      }

      try {
        await saveLocation.mutateAsync(locationPayload);
      } catch (e: any) {
        if (isOfflineError(e)) {
          enqueueOffline("wizard_location", "/api/training-locations", locationPayload);
          if (activationPayload) {
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
          navigate("/dashboard");
          return;
        }
        toast({ title: e?.message || "Failed", variant: "destructive" });
        return;
      }
      if (fzPath === "existing" && activationPayload) {
        // Online path — saveLocation already succeeded above. Submit
        // the activation request and, on confirmed server success,
        // toast the user, clear the draft, and redirect to the
        // dashboard via the centralised helper (no more dead-end
        // success panel — Task #66 follow-up).
        try {
          await submitVerification.mutateAsync(activationPayload);
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
          navigate(
            decideNextRoute({
              flow: "fz_existing",
              hasActivePackage,
              hasPendingActivation: true,
              justSubmittedActivation: true,
            }),
          );
          return;
        } catch (e: any) {
          if (isOfflineError(e)) {
            enqueueOffline(
              "wizard_activation",
              "/api/package-verification-requests",
              activationPayload,
            );
            queuedToast(
              "queuedDropped",
              "Connection dropped. Your activation request is queued and will send when you're back online. Your answers stay saved on this device until it's accepted.",
            );
            navigate("/dashboard");
            return;
          }
          toast({ title: e?.message || "Failed", variant: "destructive" });
          return;
        }
      }
      wizardDraft.clear();
      navigate(
        decideNextRoute({
          flow: fzPath === "trial" ? "fz_trial" : "fz_existing",
          hasActivePackage,
          hasPendingActivation: hasPendingVerif,
        }),
      );
      return;
    }

    if (branch === "home") {
      if (!homeAddress.trim()) {
        toast({ title: t("wizard.home.needAddress", "Address is required."), variant: "destructive" });
        return;
      }
      const homePayload = {
        kind: homeKind,
        label: homeLabel || t("wizard.home.defaultLabel", "Home"),
        address: homeAddress,
        buildingName: homeBuilding || undefined,
        roomNumber: homeRoom || undefined,
        parkingNotes: homeParking || undefined,
        equipmentNotes: homeEquip || undefined,
        isDefault: locations.length === 0,
      };
      const homeNext = decideNextRoute({
        flow: "home",
        locationKind: homeKind,
        hasActivePackage,
        hasPendingActivation: hasPendingVerif,
      });
      if (isOffline) {
        enqueueOffline("wizard_location", "/api/training-locations", homePayload);
        queuedToast(
          "queuedOffline",
          "You're offline. Your location is queued and will send when you reconnect.",
        );
        navigate(homeNext);
        return;
      }
      try {
        await saveLocation.mutateAsync(homePayload);
      } catch (e: any) {
        if (isOfflineError(e)) {
          enqueueOffline("wizard_location", "/api/training-locations", homePayload);
          queuedToast(
            "queuedDropped",
            "Connection dropped. Your location is queued and will send when you're back online.",
          );
          navigate(homeNext);
          return;
        }
        toast({ title: e?.message || "Failed", variant: "destructive" });
        return;
      }
      toast({ title: t("wizard.home.savedTitle", "Location saved") });
      wizardDraft.clear();
      navigate(homeNext);
      return;
    }

    if (branch === "other_gym") {
      if (!gymName.trim()) {
        toast({ title: t("wizard.other.needName", "Gym name is required."), variant: "destructive" });
        return;
      }
      const gymPayload = {
        kind: "other_gym" as const,
        label: gymName,
        gymName,
        address: gymAddress || undefined,
        guestAccess: gymGuest || undefined,
        accessNotes: gymNotes || undefined,
        isDefault: locations.length === 0,
      };
      const gymNext = decideNextRoute({
        flow: "other_gym",
        hasActivePackage,
        hasPendingActivation: hasPendingVerif,
      });
      if (isOffline) {
        enqueueOffline("wizard_location", "/api/training-locations", gymPayload);
        queuedToast(
          "queuedOffline",
          "You're offline. Your location is queued and will send when you reconnect.",
        );
        navigate(gymNext);
        return;
      }
      try {
        await saveLocation.mutateAsync(gymPayload);
      } catch (e: any) {
        if (isOfflineError(e)) {
          enqueueOffline("wizard_location", "/api/training-locations", gymPayload);
          queuedToast(
            "queuedDropped",
            "Connection dropped. Your location is queued and will send when you're back online.",
          );
          navigate(gymNext);
          return;
        }
        toast({ title: e?.message || "Failed", variant: "destructive" });
        return;
      }
      toast({ title: t("wizard.other.savedTitle", "Location saved") });
      wizardDraft.clear();
      navigate(gymNext);
    }
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
              : branch === "home"
                ? t("wizard.home.stepTitle", "Where should Youssef meet you?")
                : t("wizard.other.stepTitle", "Tell us about your gym")}
        </h1>
        <p className="text-sm text-muted-foreground mb-6">
          {step === 1
            ? t("wizard.subtitle", "Pick the option that matches your training setup. You can change it later.")
            : t("wizard.subtitle2", "We use this for every booking so you don't have to re-enter it.")}
        </p>

        {step === 1 && (
          <div className="grid grid-cols-1 gap-3" data-testid="grid-wizard-branches">
            {cards.map((c) => (
              <button
                key={c.key}
                type="button"
                onClick={() => {
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

        {step === 2 && branch === "home" && (
          <div className="space-y-3" data-testid="form-home-location">
            <div>
              <Label className="text-xs">{t("wizard.home.kind", "Type")}</Label>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {(["home", "building", "hotel"] as const).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => setHomeKind(k)}
                    data-testid={`button-home-kind-${k}`}
                    className={`rounded-lg border px-2 py-2 text-xs min-h-[44px] ${
                      homeKind === k ? "border-primary bg-primary/10 text-primary" : "border-white/10 bg-white/[0.03]"
                    }`}
                  >
                    {t(`wizard.home.kind.${k}`, k)}
                  </button>
                ))}
              </div>
            </div>
            <Field label={t("wizard.home.label", "Nickname (optional)")}
              value={homeLabel} onChange={setHomeLabel} testId="input-home-label" />
            <Field label={t("wizard.home.address", "Address")} value={homeAddress} onChange={setHomeAddress} testId="input-home-address" required />
            <Field label={t("wizard.home.building", "Building / community")} value={homeBuilding} onChange={setHomeBuilding} testId="input-home-building" />
            <Field label={t("wizard.home.room", "Unit / room")} value={homeRoom} onChange={setHomeRoom} testId="input-home-room" />
            <FieldArea label={t("wizard.home.parking", "Parking notes")} value={homeParking} onChange={setHomeParking} testId="input-home-parking" />
            <FieldArea label={t("wizard.home.equipment", "Equipment available")} value={homeEquip} onChange={setHomeEquip} testId="input-home-equipment" />
          </div>
        )}

        {step === 2 && branch === "other_gym" && (
          <div className="space-y-3" data-testid="form-other-gym">
            <Field label={t("wizard.other.name", "Gym name")} value={gymName} onChange={setGymName} testId="input-gym-name" required />
            <Field label={t("wizard.other.address", "Location / area")} value={gymAddress} onChange={setGymAddress} testId="input-gym-address" />
            <Field label={t("wizard.other.guest", "Guest access policy")} value={gymGuest} onChange={setGymGuest} testId="input-gym-guest" />
            <FieldArea label={t("wizard.other.notes", "Entry / parking notes")} value={gymNotes} onChange={setGymNotes} testId="input-gym-notes" />
          </div>
        )}

        {step === 2 && (
          <div className="flex gap-2 pt-6">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setStep(1);
                setFzPath(null);
              }}
              className="flex-1 h-12 rounded-xl"
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
              className="flex-1 h-12 rounded-xl font-bold"
              data-testid="button-wizard-finish"
            >
              {(saveLocation.isPending || submitVerification.isPending) && (
                <Loader2 size={14} className="animate-spin mr-2" />
              )}
              {branch === "fitness_zone" && fzPath === "existing"
                ? t("wizard.fz.submitCta", "Submit for approval")
                : branch === "fitness_zone" && (hasPendingVerif || fzPath === "trial")
                  ? t("common.continue", "Continue")
                  : t("wizard.saveCta", "Save location")}
              <ArrowRight size={14} className="ml-2" />
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

function Field({ label, value, onChange, testId, required }: {
  label: string; value: string; onChange: (v: string) => void; testId: string; required?: boolean;
}) {
  return (
    <div>
      <Label className="text-xs">{label}{required ? " *" : ""}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} className="bg-white/5 border-white/10 h-11 mt-1" data-testid={testId} />
    </div>
  );
}
function FieldArea({ label, value, onChange, testId }: {
  label: string; value: string; onChange: (v: string) => void; testId: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} className="bg-white/5 border-white/10 mt-1" data-testid={testId} />
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
