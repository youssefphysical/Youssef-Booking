import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, MapPin, Home, Dumbbell, Building2, ArrowLeft, ArrowRight, CheckCircle2, ShieldCheck } from "lucide-react";
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
  const [activationSubmitted, setActivationSubmitted] = useState(false);

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

  async function finish(targetPath: string = "/dashboard") {
    if (branch === "fitness_zone") {
      // Save the location stub
      await saveLocation.mutateAsync({
        kind: "fitness_zone",
        label: "Fitness Zone",
        isDefault: locations.length === 0,
      });
      if (fzPath === "existing") {
        try {
          await submitVerification.mutateAsync({
            requestedType: reqType,
            notes: verifNotes || undefined,
          });
          setActivationSubmitted(true);
          return;
        } catch (e: any) {
          toast({ title: e?.message || "Failed", variant: "destructive" });
          return;
        }
      }
      navigate(fzPath === "trial" ? "/book" : "/dashboard");
      return;
    }
    if (branch === "home") {
      if (!homeAddress.trim()) {
        toast({ title: t("wizard.home.needAddress", "Address is required."), variant: "destructive" });
        return;
      }
      await saveLocation.mutateAsync({
        kind: homeKind,
        label: homeLabel || t("wizard.home.defaultLabel", "Home"),
        address: homeAddress,
        buildingName: homeBuilding || undefined,
        roomNumber: homeRoom || undefined,
        parkingNotes: homeParking || undefined,
        equipmentNotes: homeEquip || undefined,
        isDefault: locations.length === 0,
      });
      toast({ title: t("wizard.home.savedTitle", "Location saved") });
      navigate(targetPath);
      return;
    }
    if (branch === "other_gym") {
      if (!gymName.trim()) {
        toast({ title: t("wizard.other.needName", "Gym name is required."), variant: "destructive" });
        return;
      }
      await saveLocation.mutateAsync({
        kind: "other_gym",
        label: gymName,
        gymName,
        address: gymAddress || undefined,
        guestAccess: gymGuest || undefined,
        accessNotes: gymNotes || undefined,
        isDefault: locations.length === 0,
      });
      toast({ title: t("wizard.other.savedTitle", "Location saved") });
      navigate(targetPath);
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

        {activationSubmitted && (
          <div
            className="rounded-2xl border border-cyan-500/40 bg-cyan-500/[0.08] p-5 sm:p-6"
            data-testid="panel-activation-submitted"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center shrink-0">
                <CheckCircle2 size={20} className="text-cyan-300" />
              </div>
              <div className="min-w-0">
                <h2 className="font-display text-lg font-semibold text-cyan-50" data-testid="text-activation-title">
                  {t("wizard.fz.submittedTitle", "Your package activation request has been received.")}
                </h2>
                <p className="text-sm text-cyan-100/85 mt-2 leading-relaxed">
                  {t(
                    "wizard.fz.submittedBody",
                    "Your coach will verify your payment and activate your package shortly. Once approved, your booking access will open automatically.",
                  )}
                </p>
              </div>
            </div>
            <Button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="mt-6 w-full h-12 rounded-xl font-bold"
              data-testid="button-activation-go-dashboard"
            >
              {t("wizard.fz.goDashboard", "Go to dashboard")}
              <ArrowRight size={14} className="ml-2" />
            </Button>
          </div>
        )}

        {!activationSubmitted && step === 2 && branch === "fitness_zone" && (
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
                          "Youssef will verify your payment with the Fitness Zone team and activate your package — no receipt upload needed.",
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

        {!activationSubmitted && step === 2 && (
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
