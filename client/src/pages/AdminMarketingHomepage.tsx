import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Image as ImageIcon, Check, Upload, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card } from "@/components/ui/card";
import { useTranslation } from "@/i18n";
import type { HomepageSectionContent } from "@/hooks/use-homepage-content";

/**
 * /admin/marketing/homepage — admin CMS for the public homepage.
 *
 * Edits the rows in `homepage_sections`. Each canonical key (hero,
 * philosophy, final_cta) gets a dedicated card with image upload,
 * mobile/desktop object-position, overlay opacity, blur intensity,
 * copy fields, and CTA labels/hrefs.
 *
 * Image is read as base64 client-side (matches existing profile
 * picture pattern), capped at 8 MB before upload. Server pipes it
 * through sharp at 1920px so storage stays small.
 *
 * Power, not flash — minimal visual chrome. Form-first.
 */

type Section = HomepageSectionContent & { updatedAt?: string | Date | null };

const CANONICAL_KEYS = [
  { key: "hero", label: "Hero (top of page)" },
  { key: "philosophy", label: "Philosophy section" },
  { key: "final_cta", label: "Final CTA" },
] as const;

const MAX_BYTES = 8 * 1024 * 1024;

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export default function AdminMarketingHomepage() {
  const { t } = useTranslation();
  const { data: rows, isLoading } = useQuery<Section[]>({
    queryKey: ["/api/admin/homepage-content"],
  });

  const byKey = useMemo(() => {
    const m: Record<string, Section | undefined> = {};
    for (const r of rows || []) m[r.key] = r;
    return m;
  }, [rows]);

  return (
    <div className="min-h-screen pt-20 pb-16 px-4 md:px-8 max-w-5xl mx-auto" data-testid="admin-marketing-homepage">
      <div className="mb-8">
        <h1 className="font-display font-bold text-2xl md:text-3xl">
          {t("admin.marketing.title", "Homepage CMS")}
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          {t(
            "admin.marketing.subtitle",
            "Edit the public homepage hero, philosophy, and final CTA. Images are uploaded as base64 and processed at 1920px.",
          )}
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="animate-spin" size={18} />
          Loading…
        </div>
      )}

      <div className="space-y-6">
        {CANONICAL_KEYS.map((c) => (
          <SectionEditor key={c.key} sectionKey={c.key} label={c.label} initial={byKey[c.key]} />
        ))}
      </div>
    </div>
  );
}

function SectionEditor({
  sectionKey,
  label,
  initial,
}: {
  sectionKey: string;
  label: string;
  initial?: Section;
}) {
  const { toast } = useToast();
  const [eyebrow, setEyebrow] = useState(initial?.eyebrow || "");
  const [title, setTitle] = useState(initial?.title || "");
  const [body, setBody] = useState(initial?.body || "");
  const [ctaPrimaryLabel, setCtaPrimaryLabel] = useState(initial?.ctaPrimaryLabel || "");
  const [ctaPrimaryHref, setCtaPrimaryHref] = useState(initial?.ctaPrimaryHref || "");
  const [ctaSecondaryLabel, setCtaSecondaryLabel] = useState(initial?.ctaSecondaryLabel || "");
  const [ctaSecondaryHref, setCtaSecondaryHref] = useState(initial?.ctaSecondaryHref || "");
  const [imageAlt, setImageAlt] = useState(initial?.imageAlt || "");
  const [imageDataUrl, setImageDataUrl] = useState<string>(initial?.imageDataUrl || "");
  const [objectPositionDesktop, setObjectPositionDesktop] = useState(
    initial?.objectPositionDesktop || "center center",
  );
  const [objectPositionMobile, setObjectPositionMobile] = useState(
    initial?.objectPositionMobile || "center center",
  );
  const [overlayOpacity, setOverlayOpacity] = useState<number>(initial?.overlayOpacity ?? 45);
  const [blurIntensity, setBlurIntensity] = useState<number>(initial?.blurIntensity ?? 0);
  const [isActive, setIsActive] = useState<boolean>(initial?.isActive ?? true);

  // Hydrate from server when initial arrives later
  useEffect(() => {
    if (!initial) return;
    setEyebrow(initial.eyebrow || "");
    setTitle(initial.title || "");
    setBody(initial.body || "");
    setCtaPrimaryLabel(initial.ctaPrimaryLabel || "");
    setCtaPrimaryHref(initial.ctaPrimaryHref || "");
    setCtaSecondaryLabel(initial.ctaSecondaryLabel || "");
    setCtaSecondaryHref(initial.ctaSecondaryHref || "");
    setImageAlt(initial.imageAlt || "");
    setImageDataUrl(initial.imageDataUrl || "");
    setObjectPositionDesktop(initial.objectPositionDesktop || "center center");
    setObjectPositionMobile(initial.objectPositionMobile || "center center");
    setOverlayOpacity(initial.overlayOpacity ?? 45);
    setBlurIntensity(initial.blurIntensity ?? 0);
    setIsActive(initial.isActive ?? true);
  }, [initial]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        eyebrow: eyebrow || null,
        title: title || null,
        body: body || null,
        ctaPrimaryLabel: ctaPrimaryLabel || null,
        ctaPrimaryHref: ctaPrimaryHref || null,
        ctaSecondaryLabel: ctaSecondaryLabel || null,
        ctaSecondaryHref: ctaSecondaryHref || null,
        imageAlt: imageAlt || null,
        objectPositionDesktop,
        objectPositionMobile,
        overlayOpacity,
        blurIntensity,
        isActive,
      };
      // Only send imageDataUrl if it changed (starts with "data:" — fresh
      // upload). Sending the existing webp data URL back triggers a needless
      // re-encode on the server.
      if (imageDataUrl && imageDataUrl.startsWith("data:")) {
        payload.imageDataUrl = imageDataUrl;
      } else if (!imageDataUrl) {
        // Empty string clears the image.
        payload.imageDataUrl = null;
      }
      return apiRequest("PUT", `/api/admin/homepage-content/${sectionKey}`, payload);
    },
    onSuccess: () => {
      toast({ title: "Saved", description: `${label} updated.` });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage-content"] });
      queryClient.invalidateQueries({ queryKey: ["/api/homepage-content"] });
    },
    onError: (e: any) => {
      toast({ variant: "destructive", title: "Save failed", description: e?.message || "Try again." });
    },
  });

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BYTES) {
      toast({ variant: "destructive", title: "Image too large", description: "Max 8 MB." });
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(f);
      setImageDataUrl(dataUrl);
    } catch {
      toast({ variant: "destructive", title: "Could not read file" });
    } finally {
      e.target.value = "";
    }
  }

  return (
    <Card className="p-5 md:p-6 space-y-5" data-testid={`section-editor-${sectionKey}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg">{label}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">key: <code>{sectionKey}</code></p>
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={isActive}
            onCheckedChange={setIsActive}
            data-testid={`switch-active-${sectionKey}`}
          />
          <Label className="text-xs text-muted-foreground">{isActive ? "Active" : "Hidden"}</Label>
        </div>
      </div>

      {/* Image */}
      <div className="grid md:grid-cols-2 gap-5">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wider">Image</Label>
          <div className="relative aspect-[4/5] rounded-xl border border-white/10 bg-black/40 overflow-hidden">
            {imageDataUrl ? (
              <img
                src={imageDataUrl}
                alt="preview"
                className="w-full h-full object-cover"
                style={{
                  objectPosition: objectPositionDesktop,
                  filter: blurIntensity > 0 ? `blur(${blurIntensity}px)` : undefined,
                }}
                data-testid={`img-preview-${sectionKey}`}
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-muted-foreground/50">
                <ImageIcon size={36} />
                <p className="mt-2 text-[10px] uppercase tracking-widest">No image</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <label className="flex-1">
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onPickFile}
                data-testid={`input-image-${sectionKey}`}
              />
              <span className="inline-flex items-center justify-center gap-2 w-full h-9 rounded-md border border-input bg-background hover:bg-accent text-sm cursor-pointer">
                <Upload size={14} />
                {imageDataUrl ? "Replace" : "Upload"}
              </span>
            </label>
            {imageDataUrl && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setImageDataUrl("")}
                data-testid={`btn-clear-image-${sectionKey}`}
              >
                <Trash2 size={14} />
              </Button>
            )}
          </div>
          <Input
            placeholder="Image alt text"
            value={imageAlt}
            onChange={(e) => setImageAlt(e.target.value)}
            data-testid={`input-alt-${sectionKey}`}
          />
        </div>

        {/* Image controls */}
        <div className="space-y-3">
          <div>
            <Label className="text-xs uppercase tracking-wider">Object position — Desktop</Label>
            <Input
              placeholder="center center"
              value={objectPositionDesktop}
              onChange={(e) => setObjectPositionDesktop(e.target.value)}
              data-testid={`input-pos-desktop-${sectionKey}`}
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              CSS values e.g. <code>center center</code>, <code>50% 30%</code>, <code>top right</code>.
            </p>
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider">Object position — Mobile</Label>
            <Input
              placeholder="center top"
              value={objectPositionMobile}
              onChange={(e) => setObjectPositionMobile(e.target.value)}
              data-testid={`input-pos-mobile-${sectionKey}`}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider">
              Overlay opacity: {overlayOpacity}%
            </Label>
            <input
              type="range"
              min={0}
              max={100}
              value={overlayOpacity}
              onChange={(e) => setOverlayOpacity(Number(e.target.value))}
              className="w-full"
              data-testid={`input-overlay-${sectionKey}`}
            />
          </div>
          <div>
            <Label className="text-xs uppercase tracking-wider">
              Blur intensity: {blurIntensity}px
            </Label>
            <input
              type="range"
              min={0}
              max={20}
              value={blurIntensity}
              onChange={(e) => setBlurIntensity(Number(e.target.value))}
              className="w-full"
              data-testid={`input-blur-${sectionKey}`}
            />
          </div>
        </div>
      </div>

      {/* Copy */}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider">Eyebrow</Label>
          <Input
            value={eyebrow}
            onChange={(e) => setEyebrow(e.target.value)}
            placeholder="PREMIUM COACHING • REAL RESULTS"
            data-testid={`input-eyebrow-${sectionKey}`}
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider">Title</Label>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Built for Real Transformation."
            data-testid={`input-title-${sectionKey}`}
          />
        </div>
      </div>
      <div>
        <Label className="text-xs uppercase tracking-wider">Body</Label>
        <Textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={3}
          placeholder="Supporting copy…"
          data-testid={`input-body-${sectionKey}`}
        />
      </div>

      {/* CTAs */}
      <div className="grid md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs uppercase tracking-wider">Primary CTA label</Label>
          <Input
            value={ctaPrimaryLabel}
            onChange={(e) => setCtaPrimaryLabel(e.target.value)}
            placeholder="Book Your Session"
            data-testid={`input-cta1-label-${sectionKey}`}
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider">Primary CTA href</Label>
          <Input
            value={ctaPrimaryHref}
            onChange={(e) => setCtaPrimaryHref(e.target.value)}
            placeholder="/book"
            data-testid={`input-cta1-href-${sectionKey}`}
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider">Secondary CTA label</Label>
          <Input
            value={ctaSecondaryLabel}
            onChange={(e) => setCtaSecondaryLabel(e.target.value)}
            placeholder="Message Coach on WhatsApp"
            data-testid={`input-cta2-label-${sectionKey}`}
          />
        </div>
        <div>
          <Label className="text-xs uppercase tracking-wider">Secondary CTA href</Label>
          <Input
            value={ctaSecondaryHref}
            onChange={(e) => setCtaSecondaryHref(e.target.value)}
            placeholder="(WhatsApp button is built-in — leave blank)"
            data-testid={`input-cta2-href-${sectionKey}`}
          />
        </div>
      </div>

      <div className="flex justify-end pt-2">
        <Button onClick={() => save.mutate()} disabled={save.isPending} data-testid={`btn-save-${sectionKey}`}>
          {save.isPending ? <Loader2 className="animate-spin me-2" size={14} /> : <Check size={14} className="me-2" />}
          Save changes
        </Button>
      </div>
    </Card>
  );
}
