import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Loader2, Check } from "lucide-react";
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
import { MediaAssetEditor, type AssetSummary } from "@/components/admin/MediaAssetEditor";

/**
 * /admin/marketing/homepage — admin CMS for the public homepage.
 *
 * The image surface for each section is now powered by the May-2026
 * media pipeline: <MediaAssetEditor> uploads through sharp, generates
 * the full responsive variant matrix, and serves every preview from
 * server-processed bytes — the admin NEVER sees the raw upload, and
 * neither does the public site.
 *
 * Section copy + CTAs remain managed here. The legacy
 * `imageDataUrl` / `objectPositionDesktop|Mobile` / `overlayOpacity`
 * fields stay on the server for backward compat but are no longer
 * surfaced in the UI — once an admin uploads through the new
 * pipeline, the bound `mediaAssetId` takes over rendering.
 */

// Section editor needs `mediaAsset` (the embedded asset summary
// from /api/admin/homepage-content). Existing HomepageSectionContent
// already includes it via the May-2026 hook update.
type Section = HomepageSectionContent & {
  updatedAt?: string | Date | null;
  mediaAssetId?: number | null;
};

const CANONICAL_KEYS = [
  { key: "hero", label: "Hero (top of page)", priorityHint: true },
  { key: "philosophy", label: "Philosophy section", priorityHint: false },
  { key: "final_cta", label: "Final CTA", priorityHint: false },
] as const;

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
            "Edit hero, philosophy, and final CTA. Images use the optimised media pipeline — uploads generate AVIF + WebP variants for mobile and desktop, with focal-point cropping and lazy loading.",
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
          <SectionEditor
            key={c.key}
            sectionKey={c.key}
            label={c.label}
            initial={byKey[c.key]}
          />
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
  const [isActive, setIsActive] = useState<boolean>(initial?.isActive ?? true);
  // The bound media asset (if any). Updated optimistically by
  // MediaAssetEditor — when its id changes, we persist the binding.
  const [mediaAsset, setMediaAsset] = useState<AssetSummary | null>(
    (initial?.mediaAsset as AssetSummary | null) ?? null,
  );

  // Hydrate from server when initial arrives later (first paint
  // before query resolves).
  useEffect(() => {
    if (!initial) return;
    setEyebrow(initial.eyebrow || "");
    setTitle(initial.title || "");
    setBody(initial.body || "");
    setCtaPrimaryLabel(initial.ctaPrimaryLabel || "");
    setCtaPrimaryHref(initial.ctaPrimaryHref || "");
    setCtaSecondaryLabel(initial.ctaSecondaryLabel || "");
    setCtaSecondaryHref(initial.ctaSecondaryHref || "");
    setIsActive(initial.isActive ?? true);
    setMediaAsset((initial.mediaAsset as AssetSummary | null) ?? null);
  }, [initial]);

  // Persist the section (copy, CTAs, active, mediaAssetId binding).
  const save = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        eyebrow: eyebrow || null,
        title: title || null,
        body: body || null,
        ctaPrimaryLabel: ctaPrimaryLabel || null,
        ctaPrimaryHref: ctaPrimaryHref || null,
        ctaSecondaryLabel: ctaSecondaryLabel || null,
        ctaSecondaryHref: ctaSecondaryHref || null,
        isActive,
        mediaAssetId: mediaAsset ? mediaAsset.id : null,
      };
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

  // When the asset id changes (upload, delete) we auto-persist the
  // binding — the rest of the form stays in pending state until the
  // admin clicks "Save changes". This gives them control over copy
  // edits while making the image binding feel instant.
  function handleAssetChange(next: AssetSummary | null) {
    const prevId = mediaAsset?.id ?? null;
    const nextId = next?.id ?? null;
    setMediaAsset(next);
    if (prevId !== nextId) {
      // Auto-persist the binding via a focused PUT.
      apiRequest("PUT", `/api/admin/homepage-content/${sectionKey}`, {
        mediaAssetId: nextId,
      })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage-content"] });
          queryClient.invalidateQueries({ queryKey: ["/api/homepage-content"] });
        })
        .catch((e) => {
          toast({
            variant: "destructive",
            title: "Could not bind image",
            description: e?.message || "Try again.",
          });
        });
    } else {
      // Same id, only metadata changed — refresh public cache so
      // SmartImage picks up the new version (?v=updatedAt) on next
      // homepage load.
      queryClient.invalidateQueries({ queryKey: ["/api/homepage-content"] });
    }
  }

  return (
    <Card className="p-5 md:p-6 space-y-6" data-testid={`section-editor-${sectionKey}`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display font-bold text-lg">{label}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            key: <code>{sectionKey}</code>
          </p>
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

      <div className="grid md:grid-cols-2 gap-6">
        {/* Image — managed entirely by MediaAssetEditor (focal point,
            aspect, alt, priority, visibility, replace, delete). */}
        <MediaAssetEditor
          asset={mediaAsset}
          onAssetChange={handleAssetChange}
          testIdPrefix={`media-${sectionKey}`}
        />

        {/* Copy */}
        <div className="space-y-3">
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
          <div>
            <Label className="text-xs uppercase tracking-wider">Body</Label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Supporting copy…"
              data-testid={`input-body-${sectionKey}`}
            />
          </div>
        </div>
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
        <Button
          onClick={() => save.mutate()}
          disabled={save.isPending}
          data-testid={`btn-save-${sectionKey}`}
        >
          {save.isPending ? (
            <Loader2 className="animate-spin me-2" size={14} />
          ) : (
            <Check size={14} className="me-2" />
          )}
          Save changes
        </Button>
      </div>
    </Card>
  );
}
