import { useEffect, useState } from "react";
import { format } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Trash2, Plus, Image as ImageIcon, MessageSquare, CreditCard, Eye, EyeOff, ArrowUp, ArrowDown, UploadCloud } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  useHeroImages,
  useUploadHeroImage,
  useUpdateHeroImageOrder,
  useDeleteHeroImage,
} from "@/hooks/use-hero-images";
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
  const deleteMutation = useDeleteHeroImage();
  const { toast } = useToast();
  const MAX_IMAGES = 12;

  async function handleFile(file: File) {
    if (!file.type.startsWith("image/")) {
      toast({ title: "Please choose an image file", variant: "destructive" });
      return;
    }
    if (file.size > 12 * 1024 * 1024) {
      toast({ title: "Image is too large (max 12 MB)", variant: "destructive" });
      return;
    }
    const dataUrl: string = await new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result as string);
      r.onerror = () => reject(r.error);
      r.readAsDataURL(file);
    });
    try {
      await uploadMutation.mutateAsync(dataUrl);
      toast({ title: "Hero image uploaded" });
    } catch (e: any) {
      toast({
        title: "Upload failed",
        description: e?.message || "Try a smaller or different image.",
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

      <label
        htmlFor="hero-image-upload"
        className="flex flex-col items-center justify-center gap-2 w-full p-6 rounded-2xl border-2 border-dashed border-white/10 hover:border-primary/40 hover:bg-white/[0.02] transition-colors cursor-pointer mb-5"
        data-testid="label-hero-upload"
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
        <input
          id="hero-image-upload"
          type="file"
          accept="image/*"
          className="hidden"
          data-testid="input-hero-image"
          disabled={uploadMutation.isPending || images.length >= MAX_IMAGES}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) {
              handleFile(f);
              // Reset so re-uploading the same file still triggers change.
              e.target.value = "";
            }
          }}
        />
      </label>

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
              <div className="absolute inset-x-0 bottom-0 p-2 flex items-center justify-between bg-gradient-to-t from-black/80 to-transparent">
                <span className="text-[10px] uppercase tracking-wider text-white/80 font-bold">
                  #{i + 1}
                </span>
                <div className="flex items-center gap-1">
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
    </section>
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
