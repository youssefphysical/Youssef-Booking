import { useEffect, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { formatWeekdayShortDate, dubaiTodayYMD } from "@shared/dates";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2, Plus, Image as ImageIcon, MessageSquare, CreditCard, Eye, EyeOff, UploadCloud, X, Check, Sparkles, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useAdminTransformations,
  useCreateTransformation,
  useUpdateTransformation,
  useDeleteTransformation,
} from "@/hooks/use-transformations";
import type { Transformation } from "@shared/schema";
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
import { Textarea } from "@/components/ui/textarea";
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
import { ImageCropper, type AspectPreset } from "@/components/ImageCropper";

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
    updateSettings.mutate({ brandSettings: vals as unknown as Record<string, number> }, {
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
// TRANSFORMATIONS — admin manager for premium before/after gallery
// =====================================================================
const TRANSFORMATION_ASPECTS: AspectPreset[] = [
  { key: "4x5", label: "4:5", ratio: 4 / 5 },
  { key: "3x4", label: "3:4", ratio: 3 / 4 },
  { key: "1x1", label: "1:1", ratio: 1 / 1 },
];

function TransformationsSection() {
  const { t } = useTranslation();
  const { data: rows = [], isLoading } = useAdminTransformations();
  const createMutation = useCreateTransformation();
  // "Add" UI is a single staging card; only one at a time to keep things calm.
  const [adding, setAdding] = useState(false);

  return (
    <section
      className="admin-card"
      data-testid="section-transformations"
    >
      <div className="admin-card-header">
        <h2 className="admin-card-title font-display font-bold text-lg flex items-center gap-2">
          <Sparkles size={18} className="text-primary shrink-0" />
          <span className="truncate">{t("admin.transformations.title")}</span>
        </h2>
        {!adding && (
          <Button
            type="button"
            onClick={() => setAdding(true)}
            data-testid="button-add-transformation"
            className="admin-card-action rounded-xl"
          >
            <Plus size={14} className="mr-1.5" />
            {t("admin.transformations.add")}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
        {t("admin.transformations.desc")}
      </p>

      {/* New (staging) card */}
      {adding && (
        <TransformationCard
          mode="create"
          onCancel={() => setAdding(false)}
          onSave={async (payload) => {
            await createMutation.mutateAsync(payload);
            setAdding(false);
          }}
          saving={createMutation.isPending}
        />
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin mr-2" />
          {t("admin.transformations.loading")}
        </div>
      ) : rows.length === 0 && !adding ? (
        <p
          className="text-sm text-muted-foreground py-6 text-center border border-dashed border-white/10 rounded-xl"
          data-testid="text-no-transformations"
        >
          {t("admin.transformations.empty")}
        </p>
      ) : (
        <div className="space-y-4 mt-4">
          {rows.map((row) => (
            <TransformationCard key={row.id} mode="edit" row={row} />
          ))}
        </div>
      )}
    </section>
  );
}

// Re-used for both create (staged) and edit (existing) flows. Internal
// state mirrors the row's fields so users see Save become a no-op only
// when they actually changed something. Image data URLs replace on
// successful crop and are sent to the server which re-pipes them.
type TransformationCardProps =
  | {
      mode: "create";
      onCancel: () => void;
      onSave: (payload: {
        beforeImageDataUrl: string;
        afterImageDataUrl: string;
        displayName: string | null;
        goal: string | null;
        duration: string | null;
        result: string | null;
        testimonial: string | null;
      }) => Promise<void>;
      saving: boolean;
    }
  | { mode: "edit"; row: Transformation };

function TransformationCard(props: TransformationCardProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const updateMutation = useUpdateTransformation();
  const deleteMutation = useDeleteTransformation();

  const initial: Transformation | null = props.mode === "edit" ? props.row : null;

  const [beforeUrl, setBeforeUrl] = useState<string>(initial?.beforeImageDataUrl ?? "");
  const [afterUrl, setAfterUrl] = useState<string>(initial?.afterImageDataUrl ?? "");
  const [displayName, setDisplayName] = useState(initial?.displayName ?? "");
  const [goal, setGoal] = useState(initial?.goal ?? "");
  const [duration, setDuration] = useState(initial?.duration ?? "");
  const [result, setResult] = useState(initial?.result ?? "");
  const [testimonial, setTestimonial] = useState(initial?.testimonial ?? "");
  const [isActive, setIsActive] = useState(initial?.isActive ?? true);
  const [beforeCropOpen, setBeforeCropOpen] = useState(false);
  const [afterCropOpen, setAfterCropOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const id = initial?.id ?? null;
  const saving =
    busy ||
    (props.mode === "create" && props.saving) ||
    (props.mode === "edit" && updateMutation.isPending);

  async function handleSave() {
    if (!beforeUrl || !afterUrl) {
      toast({
        title: t("admin.transformations.needBothImages"),
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const norm = (v: string) => (v.trim() ? v.trim() : null);
      if (props.mode === "create") {
        await props.onSave({
          beforeImageDataUrl: beforeUrl,
          afterImageDataUrl: afterUrl,
          displayName: norm(displayName),
          goal: norm(goal),
          duration: norm(duration),
          result: norm(result),
          testimonial: norm(testimonial),
        });
        toast({ title: t("admin.transformations.savedToast") });
      } else if (id !== null) {
        // Send only fields that change vs row state to keep payloads small.
        const updates: Record<string, unknown> = {
          displayName: norm(displayName),
          goal: norm(goal),
          duration: norm(duration),
          result: norm(result),
          testimonial: norm(testimonial),
          isActive,
        };
        // Only include image URLs if they differ from the saved row, since
        // re-sending the same WebP would force the server to re-pipe it.
        if (beforeUrl !== initial?.beforeImageDataUrl) {
          updates.beforeImageDataUrl = beforeUrl;
        }
        if (afterUrl !== initial?.afterImageDataUrl) {
          updates.afterImageDataUrl = afterUrl;
        }
        await updateMutation.mutateAsync({ id, updates });
        toast({ title: t("admin.transformations.savedToast") });
      }
    } catch (e: any) {
      toast({
        title: t("admin.transformations.saveFailedToast"),
        description: e?.message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="rounded-2xl border border-white/10 bg-black/20 p-4"
      data-testid={
        props.mode === "create"
          ? "transformation-card-new"
          : `transformation-admin-card-${id}`
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_2fr] gap-4">
        {/* BEFORE slot */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
            {t("admin.transformations.beforeImage")}
          </p>
          <div className="aspect-[4/5] rounded-xl border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center">
            {beforeUrl ? (
              <img
                src={beforeUrl}
                alt="before"
                className="w-full h-full object-cover"
                data-testid={`img-admin-before-${id ?? "new"}`}
              />
            ) : (
              <ImageIcon size={28} className="text-muted-foreground/40" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-xl"
            onClick={() => setBeforeCropOpen(true)}
            data-testid={`button-crop-before-${id ?? "new"}`}
          >
            <UploadCloud size={14} className="mr-1.5" />
            {beforeUrl
              ? t("admin.transformations.changeBefore")
              : t("admin.transformations.uploadBefore")}
          </Button>
        </div>

        {/* AFTER slot */}
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">
            {t("admin.transformations.afterImage")}
          </p>
          <div className="aspect-[4/5] rounded-xl border border-white/10 bg-black/40 overflow-hidden flex items-center justify-center">
            {afterUrl ? (
              <img
                src={afterUrl}
                alt="after"
                className="w-full h-full object-cover"
                data-testid={`img-admin-after-${id ?? "new"}`}
              />
            ) : (
              <ImageIcon size={28} className="text-muted-foreground/40" />
            )}
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-full rounded-xl"
            onClick={() => setAfterCropOpen(true)}
            data-testid={`button-crop-after-${id ?? "new"}`}
          >
            <UploadCloud size={14} className="mr-1.5" />
            {afterUrl
              ? t("admin.transformations.changeAfter")
              : t("admin.transformations.uploadAfter")}
          </Button>
        </div>

        {/* Metadata */}
        <div className="space-y-3">
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
              {t("admin.transformations.displayName")}
            </label>
            <Input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={80}
              className="bg-white/5 border-white/10"
              data-testid={`input-display-name-${id ?? "new"}`}
            />
            <p className="text-[11px] text-muted-foreground mt-1">
              {t("admin.transformations.displayNameHint")}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                {t("admin.transformations.goalLabel")}
              </label>
              <Input
                value={goal}
                onChange={(e) => setGoal(e.target.value)}
                maxLength={120}
                placeholder={t("admin.transformations.goalPlaceholder")}
                className="bg-white/5 border-white/10"
                data-testid={`input-goal-${id ?? "new"}`}
              />
            </div>
            <div>
              <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
                {t("admin.transformations.durationLabel")}
              </label>
              <Input
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
                maxLength={60}
                placeholder={t("admin.transformations.durationPlaceholder")}
                className="bg-white/5 border-white/10"
                data-testid={`input-duration-${id ?? "new"}`}
              />
            </div>
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
              {t("admin.transformations.resultLabel")}
            </label>
            <Input
              value={result}
              onChange={(e) => setResult(e.target.value)}
              maxLength={160}
              placeholder={t("admin.transformations.resultPlaceholder")}
              className="bg-white/5 border-white/10"
              data-testid={`input-result-${id ?? "new"}`}
            />
          </div>
          <div>
            <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
              {t("admin.transformations.testimonialLabel")}
            </label>
            <Textarea
              value={testimonial}
              onChange={(e) => setTestimonial(e.target.value)}
              maxLength={600}
              rows={3}
              placeholder={t("admin.transformations.testimonialPlaceholder")}
              className="bg-white/5 border-white/10"
              data-testid={`input-testimonial-${id ?? "new"}`}
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 mt-4 pt-4 border-t border-white/5">
        {props.mode === "edit" ? (
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              data-testid={`switch-transformation-active-${id}`}
            />
            {t("admin.transformations.active")}
          </label>
        ) : (
          <Button
            type="button"
            variant="ghost"
            onClick={() => "onCancel" in props && props.onCancel()}
            data-testid="button-cancel-new-transformation"
          >
            <X size={14} className="mr-1.5" />
            {t("admin.transformations.cancel")}
          </Button>
        )}

        <div className="flex items-center gap-2">
          {props.mode === "edit" && id !== null && (
            <Button
              type="button"
              variant="outline"
              className="text-red-300 border-red-500/30 hover:bg-red-500/10 hover:text-red-200"
              onClick={() => {
                if (confirm(t("admin.transformations.deleteConfirm"))) {
                  deleteMutation.mutate(id);
                }
              }}
              disabled={deleteMutation.isPending}
              data-testid={`button-delete-transformation-${id}`}
            >
              <Trash2 size={14} className="mr-1.5" />
              {t("admin.transformations.delete")}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-testid={`button-save-transformation-${id ?? "new"}`}
            className="rounded-xl"
          >
            {saving ? (
              <Loader2 size={14} className="mr-2 animate-spin" />
            ) : (
              <Check size={14} className="mr-1.5" />
            )}
            {saving
              ? t("admin.transformations.saving")
              : t("admin.transformations.save")}
          </Button>
        </div>
      </div>

      {/* Croppers — same component as profile/hero, just different aspects/help text. */}
      <ImageCropper
        open={beforeCropOpen}
        onOpenChange={setBeforeCropOpen}
        saving={false}
        onCropped={(url) => {
          setBeforeUrl(url);
          setBeforeCropOpen(false);
        }}
        aspects={TRANSFORMATION_ASPECTS}
        outputLongEdgePx={1600}
        title={t("cropper.transformationBeforeTitle")}
        description={t("cropper.transformationBeforeDescription")}
      />
      <ImageCropper
        open={afterCropOpen}
        onOpenChange={setAfterCropOpen}
        saving={false}
        onCropped={(url) => {
          setAfterUrl(url);
          setAfterCropOpen(false);
        }}
        aspects={TRANSFORMATION_ASPECTS}
        outputLongEdgePx={1600}
        title={t("cropper.transformationAfterTitle")}
        description={t("cropper.transformationAfterDescription")}
      />
    </div>
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

/**
 * Profile photo + bio admin section (v9.1, May-2026).
 *
 * Replaces the previous "paste a public image URL" workflow with a real
 * file upload. Admin selects an image (JPG/PNG/WebP, ≤5MB), gets an
 * instant local preview, and the file is automatically compressed
 * server-side (sharp → 1200x1500 cover WebP @ q90) and stored inline
 * on settings.profilePhotoUrl as a base64 data URL — same architecture
 * as the existing client profile-picture and hero-image flows, so it
 * works on Vercel's read-only filesystem without external object
 * storage.
 *
 * The bio field is its own form with its own save button so saving
 * one never touches the other (e.g. saving the bio doesn't re-submit
 * the photo).
 */
function ProfileContentSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: settings } = useSettings();
  const updateMutation = useUpdateSettings();

  const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
  const ALLOWED_PHOTO_MIME = ["image/jpeg", "image/jpg", "image/png", "image/webp"];

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Local preview shown immediately after the user picks a file, before
  // the server returns the optimized version. Falls back to the
  // currently-saved photo when no upload is in flight.
  const [pendingPreview, setPendingPreview] = useState<string | null>(null);
  const [imgErrored, setImgErrored] = useState(false);

  const savedPhoto = settings?.profilePhotoUrl?.trim() || "";
  const displayPhoto = pendingPreview || (savedPhoto && !imgErrored ? savedPhoto : "");

  // Reset broken-image state when the saved photo changes (new upload
  // succeeded, or admin removed it elsewhere).
  useEffect(() => {
    setImgErrored(false);
  }, [savedPhoto]);

  const uploadMutation = useMutation({
    mutationFn: async (dataUrl: string) => {
      const res = await apiRequest("POST", "/api/admin/profile-photo", {
        imageDataUrl: dataUrl,
      });
      return (await res.json()) as Settings;
    },
    onSuccess: () => {
      // Refresh both the settings cache (admin) and any consumers
      // (HomePage) so the new photo appears everywhere instantly.
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      setPendingPreview(null);
      toast({
        title: t("admin.settingsPage.photoUploadSuccess"),
      });
    },
    onError: (err: any) => {
      // On failure: discard the preview so the previously-saved photo
      // remains visible. The homepage is never broken because the saved
      // URL on the settings row was never overwritten.
      setPendingPreview(null);
      toast({
        title: t("admin.settingsPage.photoUploadError"),
        description: err?.message || "Upload failed. Please try again.",
        variant: "destructive",
      });
    },
  });

  const handleFileSelected = (file: File | undefined) => {
    if (!file) return;

    if (!ALLOWED_PHOTO_MIME.includes(file.type.toLowerCase())) {
      toast({
        title: t("admin.settingsPage.photoTypeError"),
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      toast({
        title: t("admin.settingsPage.photoSizeError"),
        variant: "destructive",
      });
      return;
    }

    // Read as data URL for both instant preview and the upload payload.
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      if (!result) {
        toast({
          title: t("admin.settingsPage.photoUploadError"),
          variant: "destructive",
        });
        return;
      }
      setPendingPreview(result);
      uploadMutation.mutate(result);
    };
    reader.onerror = () => {
      toast({
        title: t("admin.settingsPage.photoUploadError"),
        variant: "destructive",
      });
    };
    reader.readAsDataURL(file);
  };

  // Bio form — independent of the photo upload so each save is atomic.
  const bioForm = useForm<{ profileBio: string }>({
    defaultValues: { profileBio: "" },
  });

  useEffect(() => {
    if (settings) {
      bioForm.reset({
        profileBio: settings.profileBio ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings?.profileBio]);

  return (
    <section className="admin-card">
      <h2 className="font-display font-bold text-lg mb-1">{t("admin.settingsPage.homepageTitle")}</h2>
      <p className="text-sm text-muted-foreground mb-5">{t("admin.settingsPage.homepageDesc")}</p>

      <div className="space-y-6">
        {/* PROFILE PHOTO UPLOADER. Premium dark-luxury panel matching
            the rest of the admin theme: blue/black gradient ring, 4:5
            preview matching the homepage hero card aspect ratio so the
            admin sees exactly what the visitor will see. */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-sm font-medium">
            <ImageIcon size={14} /> {t("admin.settingsPage.photoUrl")}
          </label>

          <div className="flex flex-col sm:flex-row gap-5">
            {/* Preview tile — fixed 4:5 aspect, identical object-fit
                contract as the public homepage so the admin sees the
                final framing live. */}
            <div className="relative w-32 sm:w-36 aspect-[4/5] flex-shrink-0 rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-primary/10 to-black/40">
              {displayPhoto ? (
                <img
                  src={displayPhoto}
                  alt="Profile preview"
                  className="w-full h-full"
                  style={{ objectFit: "cover", objectPosition: "center top" }}
                  onError={() => {
                    // Saved photo is broken — flip to placeholder. Never
                    // show the broken-image icon to the admin.
                    if (!pendingPreview) setImgErrored(true);
                  }}
                  data-testid="img-profile-preview"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/60 p-2 text-center">
                  <ImageIcon size={28} className="mb-2 opacity-50" />
                  <span className="text-[10px] uppercase tracking-widest">
                    {t("admin.settingsPage.photoEmpty")}
                  </span>
                </div>
              )}
              {uploadMutation.isPending && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center">
                  <Loader2 className="animate-spin text-primary" size={22} />
                  <span className="mt-2 text-[10px] uppercase tracking-widest text-white/80">
                    {t("admin.settingsPage.photoUploading")}
                  </span>
                </div>
              )}
            </div>

            <div className="flex-1 flex flex-col gap-3 justify-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  handleFileSelected(e.target.files?.[0]);
                  // Allow re-selecting the same file (browser caches
                  // the input value otherwise and the change event
                  // won't fire on identical re-pick).
                  e.target.value = "";
                }}
                data-testid="input-photo-file"
              />
              <Button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadMutation.isPending}
                className="rounded-xl w-full sm:w-auto"
                data-testid="button-upload-photo"
              >
                {uploadMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 animate-spin" size={14} />
                    {t("admin.settingsPage.photoUploading")}
                  </>
                ) : (
                  <>
                    <UploadCloud className="mr-2" size={14} />
                    {savedPhoto
                      ? t("admin.settingsPage.photoReplace")
                      : t("admin.settingsPage.photoUpload")}
                  </>
                )}
              </Button>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("admin.settingsPage.photoUrlNote")}
              </p>
            </div>
          </div>
        </div>

        {/* BIO — separate form, separate save button. */}
        <Form {...bioForm}>
          <form
            onSubmit={bioForm.handleSubmit((d) =>
              updateMutation.mutate({
                profileBio: d.profileBio || null,
              }),
            )}
            className="space-y-4"
          >
            <FormField
              control={bioForm.control}
              name="profileBio"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="flex items-center gap-2">
                    <MessageSquare size={14} /> {t("admin.settingsPage.profileBio")}
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={5}
                      className="bg-white/5 border-white/10"
                      data-testid="input-bio"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <Button
              type="submit"
              disabled={updateMutation.isPending}
              className="rounded-xl"
              data-testid="button-save-profile-content"
            >
              {updateMutation.isPending && <Loader2 className="mr-2 animate-spin" size={14} />}
              {t("admin.settingsPage.saveProfile")}
            </Button>
          </form>
        </Form>
      </div>
    </section>
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
}: {
  testId?: string;
  title: string;
  description: string;
}) {
  return (
    <section className="admin-card" data-testid={testId}>
      <h2 className="font-display font-bold text-lg mb-1">{title}</h2>
      <p className="text-sm text-muted-foreground mb-5">{description}</p>
      <a href="/admin/media" data-testid={testId ? `link-${testId}-media` : undefined}>
        <Button type="button" className="rounded-xl gap-2">
          <ExternalLink size={14} />
          Manage in Media Center
        </Button>
      </a>
    </section>
  );
}
