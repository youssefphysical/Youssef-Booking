import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Image as ImageIcon,
  Save,
  Upload,
  Eye,
  EyeOff,
  ExternalLink,
  Trash2,
} from "lucide-react";
import { useTranslation } from "@/i18n";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  AdminCard,
  AdminPageHeader,
  AdminEmptyState,
  AdminSectionTitle,
} from "@/components/admin/primitives";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import type { HomepageSection } from "@shared/schema";

// =====================================================================
// HOMEPAGE CMS — single source of truth for the cinematic homepage copy
// + imagery. Three editable sections (hero / philosophy / final_cta)
// matching the seed in server/ensureSchema.ts.
// =====================================================================

const SECTION_KEYS = ["hero", "philosophy", "final_cta"] as const;
type SectionKey = (typeof SECTION_KEYS)[number];

const SECTION_LABELS: Record<SectionKey, { title: string; description: string }> = {
  hero: {
    title: "Hero",
    description:
      "The first thing every visitor sees. Full-bleed image, oversized headline, and the primary call to action.",
  },
  philosophy: {
    title: "Philosophy",
    description:
      "Editorial mid-page section. Asymmetric layout, no image. Sets the brand voice between trust and proof.",
  },
  final_cta: {
    title: "Final CTA",
    description:
      "Last cinematic beat before the footer. Centered headline + 2 CTAs in pure black void.",
  },
};

const OBJECT_POSITION_PRESETS = [
  "center center",
  "center top",
  "center bottom",
  "left center",
  "right center",
  "left top",
  "right top",
  "left bottom",
  "right bottom",
] as const;

// Form schema — every field optional. The server PUT route uses
// insertHomepageSectionSchema.partial() with the same allowlist of keys,
// so an empty form save is a no-op (preserves existing values via the
// undefined-strip in storage.upsertHomepageSection).
const sectionFormSchema = z.object({
  eyebrow: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  subtitle: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  imageDataUrl: z.string().nullable().optional(),
  imageAlt: z.string().nullable().optional(),
  objectPositionDesktop: z.string().nullable().optional(),
  objectPositionMobile: z.string().nullable().optional(),
  overlayOpacity: z.number().int().min(0).max(100).nullable().optional(),
  blurIntensity: z.number().int().min(0).max(20).nullable().optional(),
  ctaPrimaryLabel: z.string().nullable().optional(),
  ctaPrimaryHref: z.string().nullable().optional(),
  ctaSecondaryLabel: z.string().nullable().optional(),
  ctaSecondaryHref: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});
type SectionFormValues = z.infer<typeof sectionFormSchema>;

// 5 MB cap matches the server body limit. Above that the JSON payload
// would be rejected with 413.
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

export default function AdminMarketingHomepage() {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<SectionKey>("hero");

  const sectionsQuery = useQuery<HomepageSection[]>({
    queryKey: ["/api/admin/homepage-content"],
    staleTime: 30_000,
  });

  // Build a map for lookup. Sections seeded by ensureSchema are always
  // present, so this should always have all three keys after the first
  // successful fetch — but we still guard with optional chaining
  // everywhere downstream in case the fetch races with the boot.
  const sectionsByKey = useMemo<Record<string, HomepageSection>>(() => {
    const m: Record<string, HomepageSection> = {};
    for (const s of sectionsQuery.data ?? []) m[s.key] = s;
    return m;
  }, [sectionsQuery.data]);

  return (
    <div className="admin-shell">
      <div className="admin-stack">
        <AdminPageHeader
          eyebrow={t("admin.marketing.eyebrow", "MARKETING")}
          title={t("admin.marketing.title", "Homepage Content")}
          subtitle={t(
            "admin.marketing.subtitle",
            "Edit the cinematic copy and imagery that appears on the public homepage. Changes go live the next time visitors load the site.",
          )}
          right={
            <a
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-primary/85 hover:text-primary transition-colors"
              data-testid="link-view-homepage"
            >
              {t("admin.marketing.viewLive", "View live site")}
              <ExternalLink size={14} />
            </a>
          }
        />

        {sectionsQuery.isLoading ? (
          <AdminCard>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full admin-shimmer" />
              <Skeleton className="h-64 w-full admin-shimmer" />
            </div>
          </AdminCard>
        ) : sectionsQuery.isError ? (
          <AdminCard>
            <AdminEmptyState
              icon={<ImageIcon size={32} />}
              title={t("admin.marketing.errorTitle", "Could not load sections")}
              body={t(
                "admin.marketing.errorDescription",
                "Please refresh the page. If the problem persists, the homepage_sections table may need to be re-seeded.",
              )}
            />
          </AdminCard>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as SectionKey)}
            className="w-full"
          >
            <TabsList className="bg-card/50 border border-white/[0.06] mb-5">
              {SECTION_KEYS.map((k) => {
                const s = sectionsByKey[k];
                const isActive = s?.isActive ?? true;
                return (
                  <TabsTrigger
                    key={k}
                    value={k}
                    className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary data-[state=active]:ring-1 data-[state=active]:ring-primary/30 rounded-xl px-3.5"
                    data-testid={`tab-section-${k}`}
                  >
                    <span className="font-display font-semibold">
                      {SECTION_LABELS[k].title}
                    </span>
                    {!isActive && (
                      <span className="ms-2 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-amber-400/80">
                        <EyeOff size={10} />
                        {t("admin.marketing.hidden", "Hidden")}
                      </span>
                    )}
                  </TabsTrigger>
                );
              })}
            </TabsList>

            {SECTION_KEYS.map((k) => (
              <TabsContent key={k} value={k} className="mt-0">
                <SectionEditor
                  sectionKey={k}
                  section={sectionsByKey[k]}
                />
              </TabsContent>
            ))}
          </Tabs>
        )}
      </div>
    </div>
  );
}

// =====================================================================
// PER-SECTION EDITOR — one react-hook-form per tab so switching
// tabs preserves dirty state per section without leaking values.
// =====================================================================
function SectionEditor({
  sectionKey,
  section,
}: {
  sectionKey: SectionKey;
  section?: HomepageSection;
}) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Default values are derived from the existing section (if loaded).
  // re-resets when the underlying section changes (e.g. after a save
  // refetches the list).
  const defaultValues: SectionFormValues = useMemo(
    () => ({
      eyebrow: section?.eyebrow ?? "",
      title: section?.title ?? "",
      subtitle: section?.subtitle ?? "",
      body: section?.body ?? "",
      imageDataUrl: section?.imageDataUrl ?? null,
      imageAlt: section?.imageAlt ?? "",
      objectPositionDesktop: section?.objectPositionDesktop ?? "center center",
      objectPositionMobile: section?.objectPositionMobile ?? "center center",
      overlayOpacity: section?.overlayOpacity ?? 45,
      blurIntensity: section?.blurIntensity ?? 0,
      ctaPrimaryLabel: section?.ctaPrimaryLabel ?? "",
      ctaPrimaryHref: section?.ctaPrimaryHref ?? "",
      ctaSecondaryLabel: section?.ctaSecondaryLabel ?? "",
      ctaSecondaryHref: section?.ctaSecondaryHref ?? "",
      isActive: section?.isActive ?? true,
    }),
    [section],
  );

  const form = useForm<SectionFormValues>({
    resolver: zodResolver(sectionFormSchema),
    defaultValues,
  });

  // Reset whenever the underlying section data refetches with new values
  // (e.g. after a successful save invalidates the query).
  useEffect(() => {
    form.reset(defaultValues);
  }, [defaultValues, form]);

  const saveMutation = useMutation({
    mutationFn: async (values: SectionFormValues) => {
      // Convert empty strings to null so the storage layer doesn't write
      // empty strings into otherwise-nullable columns. Booleans and
      // numbers passed through as-is.
      const cleaned: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(values)) {
        if (typeof v === "string" && v.trim() === "") cleaned[k] = null;
        else cleaned[k] = v;
      }
      return apiRequest(
        "PUT",
        `/api/admin/homepage-content/${sectionKey}`,
        cleaned,
      );
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: ["/api/admin/homepage-content"],
      });
      // Also bust the public cache so the live site re-renders without
      // a manual refresh on the trainer's end.
      await queryClient.invalidateQueries({
        queryKey: ["/api/homepage-content"],
      });
      toast({
        title: t("admin.marketing.saved", "Saved"),
        description: t(
          "admin.marketing.savedDescription",
          "Your changes are now live on the homepage.",
        ),
      });
    },
    onError: (err: Error) => {
      toast({
        variant: "destructive",
        title: t("admin.marketing.saveFailed", "Save failed"),
        description: err.message || "Please try again.",
      });
    },
  });

  // Image upload — FileReader.readAsDataURL converts to base64 inline.
  // Validates size client-side BEFORE the read so we never spend cycles
  // encoding a file we know will be rejected by the server body limit.
  const handleFileSelect = (file: File) => {
    if (file.size > MAX_IMAGE_BYTES) {
      toast({
        variant: "destructive",
        title: t("admin.marketing.fileTooLarge", "Image too large"),
        description: t(
          "admin.marketing.fileTooLargeDescription",
          "Maximum size is 5 MB. Please compress the image and try again.",
        ),
      });
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === "string") {
        form.setValue("imageDataUrl", result, { shouldDirty: true });
      }
    };
    reader.onerror = () => {
      toast({
        variant: "destructive",
        title: t("admin.marketing.fileReadFailed", "Could not read file"),
      });
    };
    reader.readAsDataURL(file);
  };

  const meta = SECTION_LABELS[sectionKey];
  const showImageFields = sectionKey === "hero"; // philosophy + final_cta are pure void
  const watchedImage = form.watch("imageDataUrl");
  const watchedOverlay = form.watch("overlayOpacity") ?? 45;
  const watchedBlur = form.watch("blurIntensity") ?? 0;

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit((values) => saveMutation.mutate(values))}
        className="space-y-5"
      >
        {/* SECTION META + ACTIVE TOGGLE */}
        <AdminCard>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <p className="text-[10px] tracking-[0.32em] uppercase text-primary/70 font-semibold mb-2">
                {t("admin.marketing.section", "SECTION")}
              </p>
              <AdminSectionTitle title={meta.title} />
              <p className="text-sm text-muted-foreground mt-2 max-w-2xl leading-relaxed">
                {meta.description}
              </p>
            </div>
            <FormField
              control={form.control}
              name="isActive"
              render={({ field }) => (
                <FormItem className="flex items-center gap-3 shrink-0">
                  <FormLabel className="text-sm flex items-center gap-2 cursor-pointer">
                    {field.value ? <Eye size={14} /> : <EyeOff size={14} />}
                    {field.value
                      ? t("admin.marketing.visible", "Visible on homepage")
                      : t("admin.marketing.hiddenLong", "Hidden from homepage")}
                  </FormLabel>
                  <FormControl>
                    <Switch
                      checked={field.value ?? true}
                      onCheckedChange={field.onChange}
                      data-testid={`switch-active-${sectionKey}`}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>
        </AdminCard>

        {/* COPY */}
        <AdminCard>
          <p className="text-[10px] tracking-[0.32em] uppercase text-primary/70 font-semibold mb-2">
            {t("admin.marketing.copy", "EDITORIAL COPY")}
          </p>
          <AdminSectionTitle title={t("admin.marketing.copyTitle", "Headline & body")} />
          <div className="grid grid-cols-1 gap-4 mt-5">
            <FormField
              control={form.control}
              name="eyebrow"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.marketing.eyebrowLabel", "Eyebrow (small uppercase line)")}</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      value={field.value ?? ""}
                      placeholder="e.g. PREMIUM PERSONAL TRAINING · DUBAI"
                      data-testid="input-eyebrow"
                    />
                  </FormControl>
                  <FormDescription>
                    {t("admin.marketing.eyebrowHint", "Short, all caps. Sits above the headline with a thin amber leading line.")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.marketing.titleLabel", "Headline")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={2}
                      placeholder="The cinematic headline."
                      data-testid="input-title"
                    />
                  </FormControl>
                  <FormDescription>
                    {t("admin.marketing.titleHint", "The largest typography on the section. Keep it short — 4 to 9 words reads best.")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="subtitle"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.marketing.subtitleLabel", "Subhead")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={2}
                      placeholder="One sentence below the headline."
                      data-testid="input-subtitle"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="body"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.marketing.bodyLabel", "Body paragraph")}</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      value={field.value ?? ""}
                      rows={5}
                      placeholder="Used by sections that include a body paragraph (e.g. Philosophy)."
                      data-testid="input-body"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </AdminCard>

        {/* CTAs */}
        <AdminCard>
          <p className="text-[10px] tracking-[0.32em] uppercase text-primary/70 font-semibold mb-2">
            {t("admin.marketing.ctas", "CALLS TO ACTION")}
          </p>
          <AdminSectionTitle title={t("admin.marketing.ctasTitle", "Buttons")} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
            <FormField
              control={form.control}
              name="ctaPrimaryLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.marketing.ctaPrimaryLabel", "Primary button label")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Start your transformation" data-testid="input-cta-primary-label" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ctaPrimaryHref"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.marketing.ctaPrimaryHref", "Primary button link")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="/book" data-testid="input-cta-primary-href" />
                  </FormControl>
                  <FormDescription className="text-xs">
                    {t("admin.marketing.hrefHint", "Use /book or /how-it-works for internal pages, full URL for external.")}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ctaSecondaryLabel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.marketing.ctaSecondaryLabel", "Secondary button label (optional)")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="Leave empty to default to WhatsApp" data-testid="input-cta-secondary-label" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="ctaSecondaryHref"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("admin.marketing.ctaSecondaryHref", "Secondary button link (optional)")}</FormLabel>
                  <FormControl>
                    <Input {...field} value={field.value ?? ""} placeholder="/how-it-works" data-testid="input-cta-secondary-href" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </AdminCard>

        {/* IMAGE — only shown for the Hero section. Philosophy and Final CTA
            are intentionally void-only. */}
        {showImageFields && (
          <AdminCard>
            <p className="text-[10px] tracking-[0.32em] uppercase text-primary/70 font-semibold mb-2">
              {t("admin.marketing.imagery", "IMAGERY")}
            </p>
            <AdminSectionTitle title={t("admin.marketing.imageryTitle", "Hero background image")} />
            <div className="mt-5 space-y-5">
              {/* PREVIEW */}
              {watchedImage ? (
                <div className="relative aspect-[16/9] w-full max-w-2xl mx-auto rounded-2xl overflow-hidden border border-white/[0.06] bg-black">
                  <img
                    src={watchedImage}
                    alt="preview"
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{
                      objectPosition: form.watch("objectPositionDesktop") ?? "center center",
                      filter: watchedBlur ? `blur(${watchedBlur}px)` : undefined,
                    }}
                    data-testid="img-preview"
                  />
                  <div
                    className="absolute inset-0 bg-black pointer-events-none"
                    style={{ opacity: watchedOverlay / 100 }}
                  />
                  <button
                    type="button"
                    onClick={() => form.setValue("imageDataUrl", null, { shouldDirty: true })}
                    className="absolute top-3 end-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/70 backdrop-blur-md border border-white/10 text-white text-xs hover:bg-rose-500/30 transition-colors"
                    data-testid="button-clear-image"
                  >
                    <Trash2 size={12} />
                    {t("admin.marketing.removeImage", "Remove")}
                  </button>
                </div>
              ) : (
                <div className="aspect-[16/9] w-full max-w-2xl mx-auto rounded-2xl border border-dashed border-white/10 bg-white/[0.02] flex flex-col items-center justify-center text-muted-foreground gap-2">
                  <ImageIcon size={36} className="opacity-40" />
                  <p className="text-sm">{t("admin.marketing.noImage", "No image uploaded")}</p>
                  <p className="text-xs text-muted-foreground/70">
                    {t("admin.marketing.willFallback", "The homepage will use the default hero image.")}
                  </p>
                </div>
              )}

              {/* UPLOAD */}
              <div className="flex flex-wrap items-center gap-3">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(file);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  data-testid="input-file-image"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-image"
                >
                  <Upload size={14} className="me-2" />
                  {watchedImage
                    ? t("admin.marketing.replaceImage", "Replace image")
                    : t("admin.marketing.uploadImage", "Upload image")}
                </Button>
                <p className="text-xs text-muted-foreground">
                  {t("admin.marketing.imageHint", "JPEG / PNG / WebP, up to 5 MB. Stored inline as base64 (no external storage required).")}
                </p>
              </div>

              <FormField
                control={form.control}
                name="imageAlt"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("admin.marketing.altLabel", "Alt text (accessibility + SEO)")}</FormLabel>
                    <FormControl>
                      <Input {...field} value={field.value ?? ""} placeholder="Premium personal training in Dubai" data-testid="input-alt" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* RENDER TUNING */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-white/[0.05]">
                <FormField
                  control={form.control}
                  name="objectPositionDesktop"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.marketing.posDesktop", "Image position (desktop)")}</FormLabel>
                      <Select
                        value={field.value ?? "center center"}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-pos-desktop">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OBJECT_POSITION_PRESETS.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="objectPositionMobile"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("admin.marketing.posMobile", "Image position (mobile)")}</FormLabel>
                      <Select
                        value={field.value ?? "center center"}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-pos-mobile">
                            <SelectValue />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {OBJECT_POSITION_PRESETS.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="overlayOpacity"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t("admin.marketing.overlay", "Cinematic veil opacity")}</FormLabel>
                      <span className="text-sm text-muted-foreground tabular-nums">{watchedOverlay}%</span>
                    </div>
                    <FormControl>
                      <Slider
                        min={0}
                        max={100}
                        step={5}
                        value={[field.value ?? 45]}
                        onValueChange={(v) => field.onChange(v[0])}
                        data-testid="slider-overlay"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      {t("admin.marketing.overlayHint", "Higher = darker veil over the image. 45% is the editorial default.")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="blurIntensity"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center justify-between">
                      <FormLabel>{t("admin.marketing.blur", "Background blur")}</FormLabel>
                      <span className="text-sm text-muted-foreground tabular-nums">{watchedBlur}px</span>
                    </div>
                    <FormControl>
                      <Slider
                        min={0}
                        max={20}
                        step={1}
                        value={[field.value ?? 0]}
                        onValueChange={(v) => field.onChange(v[0])}
                        data-testid="slider-blur"
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      {t("admin.marketing.blurHint", "Subtle atmospheric blur. 0 = sharp. Use sparingly.")}
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </AdminCard>
        )}

        {/* SAVE BAR */}
        <div className="sticky bottom-4 z-20">
          <AdminCard className="flex items-center justify-between gap-4 shadow-2xl shadow-black/40 backdrop-blur-md">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {form.formState.isDirty ? (
                <span className="text-amber-400/80">
                  {t("admin.marketing.unsaved", "You have unsaved changes")}
                </span>
              ) : (
                <span>{t("admin.marketing.allSaved", "All changes saved")}</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {form.formState.isDirty && (
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => form.reset(defaultValues)}
                  data-testid="button-discard"
                >
                  {t("admin.marketing.discard", "Discard")}
                </Button>
              )}
              <Button
                type="submit"
                disabled={saveMutation.isPending || !form.formState.isDirty}
                data-testid="button-save"
              >
                <Save size={14} className="me-2" />
                {saveMutation.isPending
                  ? t("admin.marketing.saving", "Saving…")
                  : t("admin.marketing.save", "Save changes")}
              </Button>
            </div>
          </AdminCard>
        </div>
      </form>
    </Form>
  );
}
