import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2, Plus, Image as ImageIcon, MessageSquare, CreditCard, Eye, EyeOff, ArrowUp, ArrowDown, UploadCloud, Pencil, X, Check, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useHeroImages,
  useUploadHeroImage,
  useUpdateHeroImage,
  useUpdateHeroImageOrder,
  useDeleteHeroImage,
} from "@/hooks/use-hero-images";
import {
  useAdminTransformations,
  useCreateTransformation,
  useUpdateTransformation,
  useDeleteTransformation,
} from "@/hooks/use-transformations";
import type { Transformation } from "@shared/schema";
import { Switch } from "@/components/ui/switch";
import {
  useSettings,
  useUpdateSettings,
} from "@/hooks/use-settings";
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
import { formatTime12 } from "@/lib/time-format";
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
  "off-day": "bg-amber-500/10 text-amber-300 border-amber-500/20",
  emergency: "bg-red-500/10 text-red-300 border-red-500/20",
  "fully-booked": "bg-blue-500/10 text-blue-300 border-blue-500/20",
};

export default function AdminSettings() {
  const { t } = useTranslation();
  return (
    <div className="md:pl-64 p-6 pt-20 md:pt-8 min-h-screen max-w-4xl">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-[0.25em] text-primary mb-2">{t("admin.settingsPage.kicker")}</p>
        <h1 className="text-3xl font-display font-bold" data-testid="text-settings-title">
          {t("admin.settingsPage.title")}
        </h1>
        <p className="text-muted-foreground text-sm">{t("admin.settingsPage.subtitle")}</p>
      </div>

      <div className="space-y-6">
        <GeneralSettingsSection />
        <BankDetailsSection />
        <ProfileContentSection />
        <HeroImagesSection />
        <TransformationsSection />
        <BlockedSlotsSection />
      </div>
    </div>
  );
}

// =====================================================================
// HERO IMAGES — admin slider on the homepage
// =====================================================================
function HeroImagesSection() {
  const { t } = useTranslation();
  const { data: images = [], isLoading } = useHeroImages();
  const uploadMutation = useUploadHeroImage();
  const reorderMutation = useUpdateHeroImageOrder();
  const updateMetadataMutation = useUpdateHeroImage();
  const deleteMutation = useDeleteHeroImage();
  const { toast } = useToast();
  const MAX_IMAGES = 12;
  const [cropperOpen, setCropperOpen] = useState(false);
  // Single-tile expand-to-edit pattern. Holds the id of the currently
  // edited slide; null = no editor open. Avoids polluting the grid with
  // inline forms and keeps the edit panel full-width below the grid.
  const [editingId, setEditingId] = useState<number | null>(null);

  // Hero slider is rendered as a full-width banner. 16:9 is the editorial
  // default; 21:9 gives a cinematic ultra-wide alternative for landscape
  // photos. The server still resizes to 1920×1080 cover, so the crop here
  // controls *composition* (what's in frame) rather than final pixels.
  const heroAspects: AspectPreset[] = [
    { key: "16x9", label: "16:9", ratio: 16 / 9 },
    { key: "21x9", label: "21:9", ratio: 21 / 9 },
  ];

  async function handleCropped(dataUrl: string) {
    try {
      await uploadMutation.mutateAsync({ imageDataUrl: dataUrl });
      setCropperOpen(false);
      toast({ title: t("admin.settingsPage.heroUploaded") });
    } catch (e: any) {
      toast({
        title: t("admin.settingsPage.heroUploadFailed"),
        description: e?.message || t("admin.settingsPage.heroUploadFailedHint"),
        variant: "destructive",
      });
    }
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const a = images[index];
    const b = images[target];
    // Swap their sortOrder values.
    reorderMutation.mutate({ id: a.id, sortOrder: b.sortOrder });
    reorderMutation.mutate({ id: b.id, sortOrder: a.sortOrder });
  }

  return (
    <section
      className="rounded-3xl border border-white/5 bg-card/60 p-6"
      data-testid="section-hero-images"
    >
      <h2 className="font-display font-bold text-lg mb-1">{t("admin.settingsPage.heroTitle")}</h2>
      <p className="text-sm text-muted-foreground mb-5">
        {t(
          "admin.settingsPage.heroDesc",
          "Up to {max} images. They auto-advance every 3 seconds with a fade transition on the homepage. Recommended size: 1920×1080.",
        ).replace("{max}", String(MAX_IMAGES))}
      </p>

      <button
        type="button"
        onClick={() => setCropperOpen(true)}
        disabled={uploadMutation.isPending || images.length >= MAX_IMAGES}
        className="flex flex-col items-center justify-center gap-2 w-full p-6 rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/40 hover:bg-white/[0.02] transition-colors cursor-pointer mb-5 disabled:opacity-50 disabled:cursor-not-allowed"
        data-testid="button-hero-open-cropper"
      >
        {uploadMutation.isPending ? (
          <Loader2 size={22} className="animate-spin text-primary" />
        ) : (
          <UploadCloud size={22} className="text-primary" />
        )}
        <p className="text-sm font-medium">
          {uploadMutation.isPending
            ? t("admin.settingsPage.heroUploading")
            : t("admin.settingsPage.heroClick")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t("admin.settingsPage.heroFormats")}
        </p>
      </button>
      <ImageCropper
        open={cropperOpen}
        onOpenChange={setCropperOpen}
        saving={uploadMutation.isPending}
        onCropped={handleCropped}
        aspects={heroAspects}
        outputLongEdgePx={1920}
        title={t("cropper.heroTitle")}
        description={t("cropper.heroDescription")}
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-8 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin mr-2" /> {t("admin.settingsPage.heroLoading")}
        </div>
      ) : images.length === 0 ? (
        <p
          className="text-sm text-muted-foreground py-6 text-center border border-dashed border-white/10 rounded-xl"
          data-testid="text-no-hero-images"
        >
          {t("admin.settingsPage.heroEmpty")}
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {images.map((img, i) => (
            <div
              key={img.id}
              className="relative group rounded-2xl overflow-hidden border border-white/10 bg-black/40 aspect-video"
              data-testid={`hero-image-tile-${img.id}`}
            >
              <img
                src={img.imageDataUrl}
                alt=""
                className="w-full h-full object-cover"
              />
              {/* Inactive overlay so admin sees what visitors won't. */}
              {img.isActive === false && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                  <span className="px-2 py-1 rounded-md bg-black/70 text-[10px] uppercase tracking-widest font-bold text-white/90">
                    <EyeOff size={10} className="inline mr-1" />
                    {t("admin.settingsPage.heroFieldActive")}: ✗
                  </span>
                </div>
              )}
              <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent">
                <span className="text-[10px] uppercase tracking-wider text-white/80 font-bold">
                  #{i + 1}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingId((cur) => (cur === img.id ? null : img.id))
                    }
                    aria-label={t("admin.settingsPage.heroEdit")}
                    data-testid={`button-hero-edit-${img.id}`}
                    className={`w-7 h-7 rounded-md flex items-center justify-center ${
                      editingId === img.id
                        ? "bg-primary/30 text-primary"
                        : "bg-white/10 hover:bg-white/20"
                    }`}
                  >
                    <Pencil size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, -1)}
                    disabled={i === 0 || reorderMutation.isPending}
                    aria-label="Move up"
                    data-testid={`button-hero-up-${img.id}`}
                    className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"
                  >
                    <ArrowUp size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => move(i, 1)}
                    disabled={i === images.length - 1 || reorderMutation.isPending}
                    aria-label="Move down"
                    data-testid={`button-hero-down-${img.id}`}
                    className="w-7 h-7 rounded-md bg-white/10 hover:bg-white/20 disabled:opacity-30 flex items-center justify-center"
                  >
                    <ArrowDown size={12} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(t("admin.settingsPage.heroDeleteConfirm"))) {
                        if (editingId === img.id) setEditingId(null);
                        deleteMutation.mutate(img.id);
                      }
                    }}
                    aria-label="Delete"
                    data-testid={`button-hero-delete-${img.id}`}
                    className="w-7 h-7 rounded-md bg-red-500/20 hover:bg-red-500/40 text-red-200 flex items-center justify-center"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline editor for whichever slide is currently being edited. */}
      {editingId !== null && images.find((i) => i.id === editingId) && (
        <HeroSlideEditor
          key={editingId}
          slide={images.find((i) => i.id === editingId)!}
          onClose={() => setEditingId(null)}
          onSave={async (updates) => {
            try {
              await updateMetadataMutation.mutateAsync({
                id: editingId,
                updates,
              });
              toast({ title: t("admin.settingsPage.heroSaved") });
              setEditingId(null);
            } catch (e: any) {
              toast({
                title: t("admin.settingsPage.heroSaveFailed"),
                description: e?.message,
                variant: "destructive",
              });
            }
          }}
          saving={updateMetadataMutation.isPending}
        />
      )}
    </section>
  );
}

// Inline editor for a single hero slide's overlay metadata. Lives below
// the grid so we don't disrupt the responsive tile layout.
function HeroSlideEditor({
  slide,
  onClose,
  onSave,
  saving,
}: {
  slide: { id: number; title: string | null; subtitle: string | null; badge: string | null; isActive: boolean };
  onClose: () => void;
  onSave: (updates: { title: string | null; subtitle: string | null; badge: string | null; isActive: boolean }) => void;
  saving: boolean;
}) {
  const { t } = useTranslation();
  const [title, setTitle] = useState(slide.title ?? "");
  const [subtitle, setSubtitle] = useState(slide.subtitle ?? "");
  const [badge, setBadge] = useState(slide.badge ?? "");
  const [isActive, setIsActive] = useState(slide.isActive ?? true);

  return (
    <div
      className="mt-5 rounded-2xl border border-primary/30 bg-primary/[0.04] p-5"
      data-testid={`hero-editor-${slide.id}`}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-display font-bold text-sm">
          #{slide.id} — {t("admin.settingsPage.heroEdit")}
        </h3>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("admin.settingsPage.heroEditClose")}
          data-testid={`button-hero-editor-close-${slide.id}`}
          className="w-8 h-8 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center"
        >
          <X size={14} />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
            {t("admin.settingsPage.heroFieldBadge")}
          </label>
          <Input
            value={badge}
            onChange={(e) => setBadge(e.target.value)}
            maxLength={60}
            className="bg-white/5 border-white/10"
            data-testid={`input-hero-badge-${slide.id}`}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
            {t("admin.settingsPage.heroFieldTitle")}
          </label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={140}
            className="bg-white/5 border-white/10"
            data-testid={`input-hero-title-${slide.id}`}
          />
        </div>
        <div>
          <label className="text-xs uppercase tracking-wider text-muted-foreground mb-1 block">
            {t("admin.settingsPage.heroFieldSubtitle")}
          </label>
          <Textarea
            value={subtitle}
            onChange={(e) => setSubtitle(e.target.value)}
            maxLength={240}
            rows={2}
            className="bg-white/5 border-white/10"
            data-testid={`input-hero-subtitle-${slide.id}`}
          />
        </div>
        <div className="flex items-center justify-between pt-2 border-t border-white/5">
          <label className="flex items-center gap-2 text-sm">
            <Switch
              checked={isActive}
              onCheckedChange={setIsActive}
              data-testid={`switch-hero-active-${slide.id}`}
            />
            {t("admin.settingsPage.heroFieldActive")}
          </label>
          <Button
            type="button"
            onClick={() =>
              onSave({
                title: title.trim() ? title.trim() : null,
                subtitle: subtitle.trim() ? subtitle.trim() : null,
                badge: badge.trim() ? badge.trim() : null,
                isActive,
              })
            }
            disabled={saving}
            data-testid={`button-hero-save-${slide.id}`}
          >
            {saving && <Loader2 size={14} className="mr-2 animate-spin" />}
            {t("admin.settingsPage.heroSave")}
          </Button>
        </div>
      </div>
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
      className="rounded-3xl border border-white/5 bg-card/60 p-6"
      data-testid="section-transformations"
    >
      <div className="flex items-start justify-between mb-1 gap-3">
        <h2 className="font-display font-bold text-lg flex items-center gap-2">
          <Sparkles size={18} className="text-primary" />
          {t("admin.transformations.title")}
        </h2>
        {!adding && (
          <Button
            type="button"
            onClick={() => setAdding(true)}
            data-testid="button-add-transformation"
            className="rounded-xl"
          >
            <Plus size={14} className="mr-1.5" />
            {t("admin.transformations.add")}
          </Button>
        )}
      </div>
      <p className="text-sm text-muted-foreground mb-5">
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
            {t("admin.transformations.delete")}
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
      cancellationCutoffHours: 6,
      whatsappNumber: "",
      profilePhotoUrl: "",
      profileBio: "",
    },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        cancellationCutoffHours: settings.cancellationCutoffHours ?? 6,
        whatsappNumber: settings.whatsappNumber ?? "",
        profilePhotoUrl: settings.profilePhotoUrl ?? "",
        profileBio: settings.profileBio ?? "",
      });
    }
  }, [settings]);

  return (
    <section className="rounded-3xl border border-white/5 bg-card/60 p-6">
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
    <section className="rounded-3xl border border-white/5 bg-card/60 p-6">
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
                    <EyeOff size={16} className="text-amber-400 mt-0.5 shrink-0" />
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

function ProfileContentSection() {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const updateMutation = useUpdateSettings();

  const form = useForm<{ profilePhotoUrl: string; profileBio: string }>({
    defaultValues: { profilePhotoUrl: "", profileBio: "" },
  });

  useEffect(() => {
    if (settings) {
      form.reset({
        profilePhotoUrl: settings.profilePhotoUrl ?? "",
        profileBio: settings.profileBio ?? "",
      });
    }
  }, [settings]);

  return (
    <section className="rounded-3xl border border-white/5 bg-card/60 p-6">
      <h2 className="font-display font-bold text-lg mb-1">{t("admin.settingsPage.homepageTitle")}</h2>
      <p className="text-sm text-muted-foreground mb-5">{t("admin.settingsPage.homepageDesc")}</p>

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit((d) =>
            updateMutation.mutate({
              profilePhotoUrl: d.profilePhotoUrl || null,
              profileBio: d.profileBio || null,
            }),
          )}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="profilePhotoUrl"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="flex items-center gap-2">
                  <ImageIcon size={14} /> {t("admin.settingsPage.photoUrl")}
                </FormLabel>
                <FormControl>
                  <Input
                    {...field}
                    placeholder="https://..."
                    className="bg-white/5 border-white/10"
                    data-testid="input-photo-url"
                  />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  {t("admin.settingsPage.photoUrlNote")}
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
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
      date: new Date().toISOString().slice(0, 10),
      scope: "whole-day",
      timeSlot: "",
      blockType: "off-day",
      reason: "",
    },
  });
  const scope = form.watch("scope");

  return (
    <section className="rounded-3xl border border-white/5 bg-card/60 p-6">
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
                <span className="font-semibold">{format(new Date(b.date), "EEE, MMM d")}</span>
                <span className="text-muted-foreground">{b.timeSlot ?? t("admin.settingsPage.wholeDayLabel")}</span>
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
