import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatWeekdayShortDate, dubaiTodayYMD } from "@shared/dates";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2, Plus, CreditCard, Eye, EyeOff, ExternalLink, Palette } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { useFeatureFlags } from "@/lib/featureFlags";
import { Slider } from "@/components/ui/slider";
import type { Settings } from "@shared/schema";
import {
  useSettings,
  useUpdateSettings,
} from "@/hooks/use-settings";
import { BRAND_DEFAULTS, applyBrandCSSVars, type BrandSettings } from "@/lib/brandSettings";
import {
  useBlockedSlots,
  useCreateBlockedSlot,
  useDeleteBlockedSlot,
} from "@/hooks/use-blocked-slots";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { ALL_TIME_SLOTS } from "@/lib/booking-utils";
import { formatTime12, formatTimeDual } from "@/lib/time-format";
import { useTranslation } from "@/i18n";

const generalSchema = z.object({
  cancellationCutoffHours: z.coerce.number().int().min(0).max(168),
  whatsappNumber: z.string().min(7, "Phone number required"),
  profilePhotoUrl: z.string().optional(),
  profileBio: z.string().optional(),
});

const blockSchema = z.object({
  date: z.string().min(1, "Date required"),
  scope: z.enum(["whole-day", "specific-hour"]),
  timeSlot: z.string().optional(),
  blockType: z.enum(["off-day", "emergency", "fully-booked"]).optional(),
  reason: z.string().optional(),
});

const BLOCK_TYPE_LABELS: Record<string, string> = {
  "off-day": "Off Day",
  emergency: "Emergency",
  "fully-booked": "Fully Booked",
};

const BLOCK_TYPE_COLORS: Record<string, string> = {
  "off-day": "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
  emergency: "bg-red-500/10 text-red-300 border-red-500/20",
  "fully-booked": "bg-blue-500/10 text-blue-300 border-blue-500/20",
};

export default function AdminSettings() {
  const { t } = useTranslation();
  return (
    <div className="admin-shell">
      <div className="admin-container">
        <div className="mb-8">
          <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">{t("admin.settingsPage.kicker")}</p>
          <h1 className="text-3xl font-display font-bold" data-testid="text-settings-title">
            {t("admin.settingsPage.title")}
          </h1>
          <p className="text-muted-foreground text-sm leading-relaxed">{t("admin.settingsPage.subtitle")}</p>
        </div>

        <div className="admin-stack">
          <FeatureFlagsSection />
          <BrandSettingsSection />
          <GeneralSettingsSection />
          <BankDetailsSection />
          <ProfileContentSection />
          <ServiceCardImagesSection />
          <HeroImagesSection />
          <TransformationsSection />
          <BlockedSlotsSection />
        </div>
      </div>
    </div>
  );
}

// =====================================================================
// FEATURE FLAGS — runtime toggles for maintenance mode + module gating.
// Reads from GET /api/feature-flags (public), writes via PATCH
// /api/admin/feature-flags/:key (admin-only + audit-logged).
// Maintenance mode replaces every non-admin surface with a "be right
// back" screen so Youssef can ship database migrations or hot fixes
// without clients seeing half-broken state.
// =====================================================================
function FeatureFlagsSection() {
  const { toast } = useToast();
  const { data: flags, isLoading } = useFeatureFlags();
  const maintenance = !!flags?.maintenance_mode;
  const recovery = flags?.recovery_enabled ?? true;

  const mutate = useMutation({
    mutationFn: async ({ key, enabled }: { key: string; enabled: boolean }) => {
      const r = await apiRequest("PATCH", `/api/admin/feature-flags/${key}`, { enabled });
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/feature-flags"] });
    },
    onError: (e: any) => {
      toast({
        title: "Couldn't update flag",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  return (
    <section className="admin-card" data-testid="section-feature-flags">
      <h2 className="font-display font-bold text-lg mb-1">Platform controls</h2>
      <p className="text-sm text-muted-foreground mb-5">
        Runtime toggles. Changes apply within a minute everywhere — no redeploy needed. Every flip
        is audit-logged.
      </p>

      <div className="space-y-3">
        <FlagRow
          flagKey="maintenance_mode"
          title="Maintenance mode"
          description="Locks the client app behind a 'be right back' screen. Admins still have full access. Use this while pushing schema changes or large data fixes."
          enabled={maintenance}
          loading={isLoading}
          pending={mutate.isPending && mutate.variables?.key === "maintenance_mode"}
          danger
          confirmOn
          onChange={(enabled) => mutate.mutate({ key: "maintenance_mode", enabled })}
        />
        <FlagRow
          flagKey="recovery_enabled"
          title="Recovery module"
          description="Show the recovery surface in client + admin nav. Turn off if you're not ready to support it yet."
          enabled={recovery}
          loading={isLoading}
          pending={mutate.isPending && mutate.variables?.key === "recovery_enabled"}
          onChange={(enabled) => mutate.mutate({ key: "recovery_enabled", enabled })}
        />
      </div>
    </section>
  );
}

function FlagRow({
  flagKey,
  title,
  description,
  enabled,
  loading,
  pending,
  danger,
  confirmOn,
  onChange,
}: {
  flagKey: string;
  title: string;
  description: string;
  enabled: boolean;
  loading: boolean;
  pending: boolean;
  danger?: boolean;
  confirmOn?: boolean;
  onChange: (enabled: boolean) => void;
}) {
  const handleToggle = (next: boolean) => {
    if (confirmOn && next && !enabled) {
      const ok = window.confirm(
        `Turn on "${title}"? Clients will be locked out of the app until you turn it off again.`,
      );
      if (!ok) return;
    }
    onChange(next);
  };

  return (
    <div
      className={`rounded-2xl border p-4 flex items-start justify-between gap-4 ${
        danger && enabled
          ? "border-amber-500/40 bg-amber-500/5"
          : "border-white/10 bg-white/[0.02]"
      }`}
      data-testid={`flag-row-${flagKey}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-sm">{title}</h3>
          {danger && enabled && (
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
              Active
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
      <div className="shrink-0 pt-0.5">
        {pending ? (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        ) : (
          <Switch
            checked={enabled}
            onCheckedChange={handleToggle}
            disabled={loading}
            data-testid={`switch-flag-${flagKey}`}
            aria-label={title}
          />
        )}
      </div>
    </div>
  );
}

// =====================================================================
// HERO IMAGES — managed in Media Center
// =====================================================================
function HeroImagesSection() {
  return (
    <MediaRedirectCard
      testId="section-hero-images"
      title="Hero Slider"
      description="Upload, reorder, and fine-tune homepage hero slides with live desktop and mobile preview."
      section="hero"
    />
  );
}

// =====================================================================
// BRAND SETTINGS — logo sizes, glow, spacing. Controls the CSS vars
// injected globally by BrandSettingsProvider in App.tsx.
// Live preview: changes apply to CSS vars immediately so admin sees
// the navbar logo update in real time before saving.
// =====================================================================
function BrandSettingsSection() {
  const { toast } = useToast();
  const { data: rawSettings, isLoading } = useSettings();
  const updateSettings = useUpdateSettings();

  const stored = (rawSettings?.brandSettings ?? {}) as Partial<BrandSettings>;
  const merged = { ...BRAND_DEFAULTS, ...stored };

  const [vals, setVals] = useState<BrandSettings>(merged);
  const [dirty, setDirty] = useState(false);

  // Sync once settings load for the first time
  const [initialised, setInitialised] = useState(false);
  useEffect(() => {
    if (!isLoading && rawSettings && !initialised) {
      const m = { ...BRAND_DEFAULTS, ...((rawSettings.brandSettings ?? {}) as Partial<BrandSettings>) };
      setVals(m);
      setInitialised(true);
    }
  }, [isLoading, rawSettings, initialised]);

  function set<K extends keyof BrandSettings>(key: K, v: number) {
    const next = { ...vals, [key]: v };
    setVals(next);
    setDirty(true);
    applyBrandCSSVars(next);
  }

  function handleReset() {
    setVals(BRAND_DEFAULTS);
    setDirty(true);
    applyBrandCSSVars(BRAND_DEFAULTS as unknown as Record<string, number>);
  }

  function handleSave() {
    const existing = (rawSettings?.brandSettings ?? {}) as Record<string, unknown>;
    updateSettings.mutate({ brandSettings: { ...existing, ...vals } as unknown as Record<string, number> }, {
      onSuccess: () => {
        toast({ title: "Brand settings saved" });
        setDirty(false);
      },
      onError: () => toast({ title: "Save failed", variant: "destructive" }),
    });
  }

  return (
    <section className="admin-card" data-testid="section-brand-settings">
      <h2 className="font-display font-bold text-lg mb-1">Brand settings</h2>
      <p className="text-sm text-muted-foreground mb-6">
        Adjust logo sizes, glow, and spacing. Changes preview live — save to persist.
      </p>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </div>
      ) : (
        <div className="space-y-6">
          {/* Live preview */}
          <div className="rounded-xl border border-primary/15 bg-background/40 px-4 py-3 flex items-center gap-3">
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground mr-2">Preview</span>
            <img
              src="/ye-logo-horizontal.png"
              alt="Youssef Elite"
              className="object-contain transition-all"
              style={{
                height: vals.navbarLogoDesktop,
                width: "auto",
                maxWidth: 280,
                filter: `drop-shadow(0 0 10px rgba(0,212,255,${vals.logoGlow / 100}))`,
              }}
            />
          </div>

          {/* Navbar logo sizes */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary/70 mb-3 font-semibold">Navbar logo</p>
            <div className="space-y-4">
              <TuningSlider
                testId="slider-brand-navbar-desktop"
                label="Desktop height"
                value={vals.navbarLogoDesktop}
                min={32} max={80} step={2}
                format={(v) => `${v} px`}
                onChange={(v) => set("navbarLogoDesktop", v)}
              />
              <TuningSlider
                testId="slider-brand-navbar-mobile"
                label="Mobile height"
                value={vals.navbarLogoMobile}
                min={28} max={64} step={2}
                format={(v) => `${v} px`}
                onChange={(v) => set("navbarLogoMobile", v)}
              />
              <TuningSlider
                testId="slider-brand-navbar-gap"
                label="Logo gap"
                value={vals.navbarLogoGap}
                min={0} max={24} step={2}
                format={(v) => `${v} px`}
                onChange={(v) => set("navbarLogoGap", v)}
              />
            </div>
          </div>

          {/* Auth hero logo sizes */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary/70 mb-3 font-semibold">Auth hero logo</p>
            <div className="space-y-4">
              <TuningSlider
                testId="slider-brand-auth-desktop"
                label="Desktop width"
                value={vals.authLogoDesktop}
                min={160} max={400} step={10}
                format={(v) => `${v} px`}
                onChange={(v) => set("authLogoDesktop", v)}
              />
              <TuningSlider
                testId="slider-brand-auth-mobile"
                label="Mobile width"
                value={vals.authLogoMobile}
                min={120} max={320} step={10}
                format={(v) => `${v} px`}
                onChange={(v) => set("authLogoMobile", v)}
              />
            </div>
          </div>

          {/* Glow + offset */}
          <div>
            <p className="text-[11px] uppercase tracking-wider text-primary/70 mb-3 font-semibold">Glow & position</p>
            <div className="space-y-4">
              <TuningSlider
                testId="slider-brand-glow"
                label="Glow intensity"
                value={vals.logoGlow}
                min={0} max={80} step={5}
                format={(v) => `${v}%`}
                onChange={(v) => set("logoGlow", v)}
              />
              <TuningSlider
                testId="slider-brand-voffset"
                label="Vertical offset"
                value={vals.logoVerticalOffset}
                min={-12} max={12} step={1}
                format={(v) => `${v > 0 ? "+" : ""}${v} px`}
                onChange={(v) => set("logoVerticalOffset", v)}
              />
              <TuningSlider
                testId="slider-brand-padding"
                label="Padding"
                value={vals.logoPadding}
                min={0} max={16} step={1}
                format={(v) => `${v} px`}
                onChange={(v) => set("logoPadding", v)}
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-2 border-t border-white/5">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleReset}
              data-testid="button-brand-reset"
            >
              Reset defaults
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={!dirty || updateSettings.isPending}
              data-testid="button-brand-save"
            >
              {updateSettings.isPending && <Loader2 size={12} className="mr-1.5 animate-spin" />}
              Save
            </Button>
          </div>

          {/* Theme & Brand Colors redirect */}
          <div className="mt-4 rounded-xl border border-primary/15 bg-primary/[0.04] p-4 flex items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
                <Palette size={16} />
              </div>
              <div>
                <p className="text-sm font-semibold">Theme & brand colors</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Adjust the accent, background, card, border, and muted text color tokens with a live preview.
                </p>
              </div>
            </div>
            <a href="/admin/theme" data-testid="link-theme-manage">
              <Button type="button" variant="outline" size="sm" className="gap-1.5 shrink-0">
                <ExternalLink size={12} />
                Manage
              </Button>
            </a>
          </div>
        </div>
      )}
    </section>
  );
}

function TuningSlider({
  label, value, min, max, step, onChange, format, testId,
}: {
  label: string;
  value: number;
  min: number; max: number; step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  testId: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="text-[11px] uppercase tracking-wider text-muted-foreground">
          {label}
        </label>
        <span className="text-[11px] tabular-nums text-foreground/80">
          {format(value)}
        </span>
      </div>
      <Slider
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(v[0] ?? value)}
        data-testid={testId}
      />
    </div>
  );
}

// =====================================================================
// TRANSFORMATIONS — managed in Media Center
// =====================================================================
function TransformationsSection() {
  return (
    <MediaRedirectCard
      testId="section-transformations"
      title="Transformations Gallery"
      description="Upload and manage before/after photo pairs, labels, and ordering for the public transformations gallery."
      section="transformations"
    />
  );
}

function GeneralSettingsSection() {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const updateMutation = useUpdateSettings();

  const form = useForm<z.infer<typeof generalSchema>>({
    resolver: zodResolver(generalSchema),
    defaultValues: {
      cancellationCutoffHours: 3,
      whatsappNumber: "",
      profilePhotoUrl: "",
      profileBio: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        cancellationCutoffHours: settings.cancellationCutoffHours ?? 3,
        whatsappNumber: settings.whatsappNumber ?? "",
        profilePhotoUrl: settings.profilePhotoUrl ?? "",
        profileBio: settings.profileBio ?? "",
      });
    }
  }, [settings]);

  return (
    <section className="admin-card">
      <h2 className="font-display font-bold text-lg mb-1">{t("admin.settingsPage.bookingRules")}</h2>
      <p className="text-sm text-muted-foreground mb-5">{t("admin.settingsPage.bookingRulesDesc")}</p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) =>
            updateMutation.mutate({
              cancellationCutoffHours: d.cancellationCutoffHours,
              whatsappNumber: d.whatsappNumber,
            }),
          )}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="cancellationCutoffHours"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.settingsPage.cutoff")}</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    min={0}
                    max={168}
                    {...field}
                    className="bg-white/5 border-white/10 max-w-xs"
                    data-testid="input-cutoff-hours"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  {t("admin.settingsPage.cutoffNote")}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="whatsappNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.settingsPage.whatsappLabel")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="971505394754"
                    className="bg-white/5 border-white/10 max-w-md font-mono"
                    data-testid="input-whatsapp"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button
            type="submit"
            disabled={updateMutation.isPending}
            data-testid="button-save-general"
            className="rounded-xl"
          >
            {updateMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
            {t("admin.settingsPage.saveRules")}
          </Button>
        </form>
      </Form>
    </section>
  );
}

const bankSchema = z.object({
  bankAccountName: z.string().min(2, "Account name required"),
  bankIban: z.string().min(5, "IBAN required"),
  showBankDetailsPublicly: z.boolean(),
});

function BankDetailsSection() {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const updateMutation = useUpdateSettings();

  const form = useForm<z.infer<typeof bankSchema>>({
    resolver: zodResolver(bankSchema),
    defaultValues: {
      bankAccountName: "Youssef Tarek Hashim Ahmed",
      bankIban: "AE230260001015917468101",
      showBankDetailsPublicly: false,
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        bankAccountName: settings.bankAccountName || "Youssef Tarek Hashim Ahmed",
        bankIban: settings.bankIban || "AE230260001015917468101",
        showBankDetailsPublicly: settings.showBankDetailsPublicly ?? false,
      });
    }
  }, [settings]);

  const isPublic = form.watch("showBankDetailsPublicly");

  return (
    <section className="admin-card">
      <div className="flex items-start gap-3 mb-5">
        <div className="p-2 rounded-xl bg-primary/15 text-primary">
          <CreditCard size={18} />
        </div>
        <div>
          <h2 className="font-display font-bold text-lg">{t("admin.settingsPage.bankTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("admin.settingsPage.bankDesc")}
          </p>
        </div>
      </div>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) =>
            updateMutation.mutate({
              bankAccountName: d.bankAccountName,
              bankIban: d.bankIban,
              showBankDetailsPublicly: d.showBankDetailsPublicly,
            } as any),
          )}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="bankAccountName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.settingsPage.bankName")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-white/5 border-white/10"
                    data-testid="input-bank-name"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="bankIban"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t("admin.settingsPage.bankIban")}</FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    className="bg-white/5 border-white/10 font-mono tracking-wider"
                    data-testid="input-bank-iban"
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="showBankDetailsPublicly"
            render={({ field }) => (
              <FormItem className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.02] p-4">
                <div className="flex items-start gap-3 flex-1">
                  {field.value ? (
                    <Eye size={16} className="text-emerald-400 mt-0.5 shrink-0" />
                  ) : (
                    <EyeOff size={16} className="text-cyan-400 mt-0.5 shrink-0" />
                  )}
                  <div>
                    <FormLabel className="cursor-pointer">{t("admin.settingsPage.bankShow")}</FormLabel>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isPublic
                        ? t("admin.settingsPage.bankShowOn")
                        : t("admin.settingsPage.bankShowOff")}
                    </p>
                  </div>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                    data-testid="switch-show-bank"
                  />
                </FormControl>
              </FormItem>
            )}
          />
          <Button
            type="submit"
            disabled={updateMutation.isPending}
            data-testid="button-save-bank"
            className="rounded-xl"
          >
            {updateMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
            {t("admin.settingsPage.saveBank")}
          </Button>
        </form>
      </Form>
    </section>
  );
}

// =====================================================================
// PROFILE CONTENT — managed in Media Center
// =====================================================================
function ProfileContentSection() {
  return (
    <MediaRedirectCard
      testId="section-profile-content"
      title="Profile Photo & Bio"
      description="Upload the coach homepage photo and edit the about/bio text shown on the public homepage."
      section="profile"
    />
  );
}

function BlockedSlotsSection() {
  const { t } = useTranslation();
  const { data: blocks = [] } = useBlockedSlots();
  const createMutation = useCreateBlockedSlot();
  const deleteMutation = useDeleteBlockedSlot();

  const form = useForm<z.infer<typeof blockSchema>>({
    resolver: zodResolver(blockSchema),
    defaultValues: {
      date: dubaiTodayYMD(),
      scope: "whole-day",
      timeSlot: "",
      blockType: "off-day",
      reason: "",
    },
  });
  const scope = form.watch("scope");

  return (
    <section className="admin-card">
      <h2 className="font-display font-bold text-lg mb-1">{t("admin.settingsPage.blockedTitle")}</h2>
      <p className="text-sm text-muted-foreground mb-5">
        {t("admin.settingsPage.blockedDesc")}
      </p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) => {
            createMutation.mutate(
              {
                date: d.date,
                timeSlot: d.scope === "whole-day" ? null : d.timeSlot || null,
                blockType: d.scope === "whole-day" ? d.blockType || "off-day" : "off-day",
                reason: d.reason || null,
              } as any,
              { onSuccess: () => form.reset({ ...form.getValues(), reason: "" }) },
            );
          })}
          className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end mb-6"
        >
          <FormField
            control={form.control}
            name="date"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">{t("admin.bookings.date")}</FormLabel>
                <FormControl>
                  <Input type="date" {...field} className="bg-white/5 border-white/10 h-10" data-testid="input-block-date" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="scope"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">{t("admin.settingsPage.scope")}</FormLabel>
                <FormControl>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="bg-white/5 border-white/10 h-10" data-testid="select-block-scope">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="whole-day">{t("admin.settingsPage.wholeDay")}</SelectItem>
                      <SelectItem value="specific-hour">{t("admin.settingsPage.specificHour")}</SelectItem>
                    </SelectContent>
                  </Select>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {scope === "specific-hour" && (
            <FormField
              control={form.control}
              name="timeSlot"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t("admin.bookings.time")}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-10" data-testid="select-block-time">
                        <SelectValue placeholder={t("admin.settingsPage.pickValue")} />
                      </SelectTrigger>
                      <SelectContent>
                        {ALL_TIME_SLOTS.map((s) => (
                          <SelectItem key={s} value={s}>{formatTime12(s)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          {scope === "whole-day" && (
            <FormField
              control={form.control}
              name="blockType"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs">{t("admin.settingsPage.type")}</FormLabel>
                  <FormControl>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="bg-white/5 border-white/10 h-10" data-testid="select-block-type">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="off-day">{t("admin.settingsPage.offDay")}</SelectItem>
                        <SelectItem value="emergency">{t("admin.settingsPage.emergency")}</SelectItem>
                        <SelectItem value="fully-booked">{t("admin.settingsPage.fullyBooked")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          <FormField
            control={form.control}
            name="reason"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-xs">{t("admin.settingsPage.reason")}</FormLabel>
                <FormControl>
                  <Input {...field} placeholder={t("admin.settingsPage.reasonExample")} className="bg-white/5 border-white/10 h-10" data-testid="input-block-reason" />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="rounded-xl h-10 lg:col-start-5" disabled={createMutation.isPending} data-testid="button-add-block">
            {createMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <><Plus size={14} className="mr-1" /> {t("admin.settingsPage.block")}</>}
          </Button>
        </form>
      </Form>

      {blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-white/10 rounded-xl">
          {t("admin.settingsPage.noBlocked")}
        </p>
      ) : (
        <div className="space-y-2">
          {blocks.map((b) => (
            <div
              key={b.id}
              className="flex items-center justify-between p-3 rounded-xl border border-white/5 bg-white/[0.02]"
              data-testid={`block-row-${b.id}`}
            >
              <div className="flex items-center gap-3 text-sm flex-wrap">
                <span className="font-semibold">{formatWeekdayShortDate(b.date)}</span>
                <span className="text-muted-foreground">{b.timeSlot ? formatTimeDual(b.timeSlot) : t("admin.settingsPage.wholeDayLabel")}</span>
                {!b.timeSlot && b.blockType && (
                  <span
                    className={`text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-md border ${BLOCK_TYPE_COLORS[b.blockType] || "bg-white/5 border-white/10"}`}
                  >
                    {BLOCK_TYPE_LABELS[b.blockType] || b.blockType}
                  </span>
                )}
                {b.reason && <span className="text-xs text-muted-foreground italic">"{b.reason}"</span>}
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => deleteMutation.mutate(b.id)}
                className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
                data-testid={`button-unblock-${b.id}`}
              >
                <Trash2 size={14} />
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// =====================================================================
// SERVICE CARD IMAGES — managed in Media Center
// =====================================================================
function ServiceCardImagesSection() {
  return (
    <MediaRedirectCard
      testId="section-service-images"
      title="Service Card Images"
      description="Upload and configure images for the Personal Training, Nutrition Plans, and Supplement Protocol cards."
      section="services"
    />
  );
}

// =====================================================================
// SHARED REDIRECT CARD — used by image sections that now live in the
// Media Center. Shows a description and a direct link to /admin/media.
// =====================================================================
function MediaRedirectCard({
  testId,
  title,
  description,
  section,
}: {
  testId?: string;
  title: string;
  description: string;
  section?: string;
}) {
  const href = section ? `/admin/media?section=${section}` : "/admin/media";
  return (
    <section className="admin-card" data-testid={testId}>
      <h2 className="font-display font-bold text-lg mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground mb-5">{description}</p>
      <a href={href} data-testid={testId ? `link-${testId}-media` : undefined}>
        <Button type="button" className="rounded-xl gap-2">
          <ExternalLink size={14} />
          Manage in Media Center
        </Button>
      </a>
    </section>
  );
}
