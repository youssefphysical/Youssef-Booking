import { useEffect, useMemo, useState } from "react";
import { CyanHairline } from "@/components/ui/CyanHairline";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { api, buildUrl } from "@shared/routes";
import {
  Loader2,
  Camera,
  Activity,
  Trash2,
  ArrowRight,
} from "lucide-react";
import { WhatsAppButton } from "@/components/WhatsAppButton";
import { useMutation } from "@tanstack/react-query";
import { UserAvatar } from "@/components/UserAvatar";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { ProfilePictureCropper } from "@/components/ProfilePictureCropper";
import {
  TRAINING_LEVELS,
  TRAINING_LEVEL_LABELS,
  TRAINING_LEVEL_DESCRIPTIONS,
  TRAINING_GOALS,
  TRAINING_GOAL_LABELS,
  TRAINING_GOAL_DESCRIPTIONS,
  type TrainingLevel,
  type TrainingGoal,
} from "@shared/schema";
import { cn } from "@/lib/utils";
import { PRIMARY_CTA_CLASS } from "@/lib/ui-tokens";
import { useTranslation } from "@/i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AchievementsSection } from "@/components/profile/AchievementsSection";
import { Trophy } from "lucide-react";

type T = (key: string, fallback?: string) => string;

const makeProfileSchema = (t: T) =>
  z.object({
    fullName: z.string().min(2, t("profile.errors.required")),
    phone: z.string().min(7, t("profile.errors.required")),
    email: z.string().email(t("profile.errors.emailValid")),
    fitnessGoal: z.string().optional(),
    notes: z.string().optional(),
    password: z
      .string()
      .optional()
      .refine((v) => !v || v.length >= 6, { message: t("profile.errors.passwordMin") }),
  });

type ProfileValues = z.infer<ReturnType<typeof makeProfileSchema>>;

export default function ProfilePage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [cropperOpen, setCropperOpen] = useState(false);
  // Task #74 — Tabs (Profile / Achievements). Hash sync so a deep link
  // like /profile#achievements (used by the badge_earned notification)
  // lands directly on the Achievements tab.
  const [profileTab, setProfileTab] = useState<string>(() => {
    if (typeof window === "undefined") return "details";
    return window.location.hash.replace(/^#/, "") === "achievements" ? "achievements" : "details";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onHash = () => {
      const h = window.location.hash.replace(/^#/, "");
      if (h === "achievements" || h === "details") setProfileTab(h);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const schema = useMemo(() => makeProfileSchema(t), [t]);
  const form = useForm<ProfileValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      fullName: user?.fullName ?? "",
      phone: user?.phone ?? "",
      email: user?.email ?? "",
      fitnessGoal: user?.fitnessGoal ?? "",
      notes: user?.notes ?? "",
      password: "",
    },
  });

  useEffect(() => {
    if (!user) return;
    form.reset({
      fullName: user.fullName ?? "",
      phone: user.phone ?? "",
      email: user.email ?? "",
      fitnessGoal: user.fitnessGoal ?? "",
      notes: user.notes ?? "",
      password: "",
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.fullName, user?.phone, user?.email, user?.fitnessGoal, user?.notes]);

  const updateMutation = useMutation({
    mutationFn: async (data: ProfileValues) => {
      if (!user) throw new Error("Not signed in");
      const url = buildUrl(api.users.update.path, { id: user.id });
      const payload: Record<string, unknown> = {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email,
        fitnessGoal: data.fitnessGoal || null,
        notes: data.notes || null,
      };
      if (data.password) payload.password = data.password;
      const res = await apiRequest("PATCH", url, payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      toast({ title: t("profile.profileUpdated") });
      form.setValue("password", "");
    },
    onError: (e: Error) => {
      toast({ title: t("profile.updateFailed"), description: e.message, variant: "destructive" });
    },
  });

  const trainingMutation = useMutation({
    mutationFn: async (patch: { trainingLevel?: TrainingLevel | null; trainingGoal?: TrainingGoal | null }) => {
      if (!user) throw new Error("Not signed in");
      const url = buildUrl(api.users.update.path, { id: user.id });
      const res = await apiRequest("PATCH", url, patch);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
    },
    onError: (e: Error) => {
      toast({ title: t("profile.couldNotSave"), description: e.message, variant: "destructive" });
    },
  });

  const uploadPictureMutation = useMutation({
    mutationFn: async (imageDataUrl: string) => {
      if (!user) throw new Error("Not signed in");
      const res = await apiRequest("POST", `/api/users/${user.id}/profile-picture`, {
        imageDataUrl,
      });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
      toast({ title: t("profile.pictureUpdated") });
      setCropperOpen(false);
    },
    onError: (e: Error) => {
      toast({ title: t("profile.uploadFailed"), description: e.message, variant: "destructive" });
    },
  });

  const removePictureMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not signed in");
      const res = await apiRequest("DELETE", `/api/users/${user.id}/profile-picture`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.auth.me.path] });
      queryClient.invalidateQueries({ queryKey: [api.users.list.path] });
      toast({ title: t("profile.pictureRemoved") });
    },
  });

  if (!user) return null;

  const isVerified = user.isVerified === true;

  return (
    <div className="max-w-2xl mx-auto px-5 pt-24 pb-20 sm:pt-28">
      <div className="flex items-center gap-5 sm:gap-6 mb-8 flex-wrap">
        <div className="relative">
          <UserAvatar
            src={user.profilePictureUrl}
            name={user.fullName}
            size={88}
            testId="img-profile-picture"
          />
          <button
            type="button"
            onClick={() => setCropperOpen(true)}
            data-testid="button-edit-profile-picture"
            className="absolute -bottom-1 -right-1 w-9 h-9 rounded-full bg-primary text-primary-foreground border-2 border-background flex items-center justify-center shadow-lg hover:bg-primary/90 transition-colors"
            aria-label={t("profile.editPhoto")}
          >
            <Camera size={15} />
          </button>
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1
              className="text-2xl font-display font-bold leading-tight"
              data-testid="text-profile-name"
            >
              {user.fullName}
            </h1>
            {isVerified && <VerifiedBadge size="md" />}
          </div>
          <p className="text-sm text-muted-foreground">{t("profile.manageAccount")}</p>
          {user.profilePictureUrl && (
            <button
              type="button"
              onClick={() => removePictureMutation.mutate()}
              disabled={removePictureMutation.isPending}
              data-testid="button-remove-profile-picture"
              className="inline-flex items-center gap-1.5 mt-1.5 text-xs text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash2 size={11} /> {t("profile.removePhoto")}
            </button>
          )}
        </div>
      </div>

      <Tabs value={profileTab} onValueChange={setProfileTab} className="w-full">
        <TabsList className="grid grid-cols-2 w-full bg-white/5 mb-6 h-auto sm:h-11 gap-1 p-1">
          <TabsTrigger value="details" data-testid="tab-profile-details">
            {t("profile.tabDetails", "Profile")}
          </TabsTrigger>
          <TabsTrigger value="achievements" data-testid="tab-achievements">
            <Trophy size={14} className="mr-1.5" /> {t("profile.tabAchievements", "Achievements")}
          </TabsTrigger>
        </TabsList>
        <TabsContent value="achievements" className="mt-0">
          <AchievementsSection />
        </TabsContent>
        <TabsContent value="details" className="mt-0 space-y-6">
      <div className="rounded-3xl border border-white/5 bg-card/60 p-6">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.22em] text-primary mb-1">
              {t("profile.trainingEyebrow")}
            </p>
            <h2 className="text-base font-semibold">{t("profile.trainingTitle")}</h2>
            <p className="text-xs text-muted-foreground mt-1">{t("profile.trainingHelp")}</p>
          </div>
          {trainingMutation.isPending && (
            <Loader2 size={14} className="animate-spin text-primary" />
          )}
        </div>

        <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
          {t("profile.levelLabel")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mb-5">
          {TRAINING_LEVELS.map((lvl) => (
            <PillButton
              key={lvl}
              active={user.trainingLevel === lvl}
              onClick={() =>
                trainingMutation.mutate({
                  trainingLevel: user.trainingLevel === lvl ? null : lvl,
                })
              }
              testId={`button-training-level-${lvl}`}
              title={TRAINING_LEVEL_LABELS[lvl]}
              description={TRAINING_LEVEL_DESCRIPTIONS[lvl]}
            />
          ))}
        </div>

        <p className="text-[11px] uppercase tracking-widest text-muted-foreground mb-2">
          {t("profile.goalLabel")}
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {TRAINING_GOALS.map((g) => (
            <PillButton
              key={g}
              active={user.trainingGoal === g}
              onClick={() =>
                trainingMutation.mutate({
                  trainingGoal: user.trainingGoal === g ? null : g,
                })
              }
              testId={`button-training-goal-${g}`}
              title={TRAINING_GOAL_LABELS[g]}
              description={TRAINING_GOAL_DESCRIPTIONS[g]}
            />
          ))}
        </div>
      </div>

      <div className="rounded-3xl border border-white/5 bg-card/60 p-6">
        <p className="text-xs uppercase tracking-[0.22em] text-primary mb-1">
          {t("profile.accountEyebrow")}
        </p>
        <h2 className="text-base font-semibold mb-4">{t("profile.personalInfo")}</h2>
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit((d) => updateMutation.mutate(d))}
            className="space-y-4"
          >
            <Field form={form} name="fullName" label={t("profile.fieldFullName")} testId="input-profile-fullname" />
            <Field form={form} name="email" label={t("profile.fieldEmail")} testId="input-profile-email" type="email" />
            <Field form={form} name="phone" label={t("profile.fieldPhone")} testId="input-profile-phone" />
            <Field form={form} name="fitnessGoal" label={t("profile.fieldFitnessGoal")} testId="input-profile-goal" />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("profile.fieldNotes")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      data-testid="input-profile-notes"
                      className="bg-white/5 border-white/10"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Field
              form={form}
              name="password"
              label={t("profile.fieldPassword")}
              testId="input-profile-password"
              type="password"
              placeholder="••••••••"
            />

            <Button
              type="submit"
              className={`w-full h-12 rounded-xl ${PRIMARY_CTA_CLASS}`}
              disabled={updateMutation.isPending}
              data-testid="button-save-profile"
            >
              {updateMutation.isPending && <Loader2 className="mr-2 animate-spin" size={16} />}
              {t("profile.saveChanges")}
            </Button>
          </form>
        </Form>
      </div>

      <div className="mt-6 rounded-3xl border border-white/5 bg-card/60 p-5 sm:p-6 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <p className="font-bold">{t("profile.talkYoussef")}</p>
          <p className="text-sm text-muted-foreground">{t("profile.reachOutWa")}</p>
        </div>
        <WhatsAppButton
          message={t("profile.waMessage").replace("{name}", user.fullName)}
          testId="button-profile-whatsapp"
        />
      </div>
        </TabsContent>
      </Tabs>

      <ProfilePictureCropper
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        saving={uploadPictureMutation.isPending}
        onCropped={async (dataUrl) => {
          await uploadPictureMutation.mutateAsync(dataUrl);
        }}
      />
    </div>
  );
}

function PillButton({
  active,
  onClick,
  testId,
  title,
  description,
}: {
  active: boolean;
  onClick: () => void;
  testId: string;
  title: string;
  description: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={testId}
      aria-pressed={active}
      className={cn(
        "text-left rounded-2xl border px-3 py-3 transition-all",
        active
          ? "bg-primary/15 border-primary/40 text-foreground shadow-[0_0_14px_-8px_hsl(183_100%_55%_/_0.35)]"
          : "bg-white/[0.02] border-white/10 hover:bg-white/5 text-muted-foreground hover:text-foreground hover:border-white/20",
      )}
    >
      <p className={cn("text-sm font-semibold", active ? "text-primary" : "text-foreground")}>
        {title}
      </p>
      <p className="text-[11px] leading-snug mt-0.5">{description}</p>
    </button>
  );
}

function Field({
  form,
  name,
  label,
  type = "text",
  placeholder,
  testId,
}: {
  form: any;
  name: string;
  label: string;
  type?: string;
  placeholder?: string;
  testId?: string;
}) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              {...field}
              type={type}
              placeholder={placeholder}
              data-testid={testId}
              className="bg-white/5 border-white/10 h-11"
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}
