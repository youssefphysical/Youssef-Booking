import { useQuery } from "@tanstack/react-query";
import type { MediaAssetManifest } from "@shared/schema";

/**
 * Public homepage CMS content. Returns a key→section map. Missing keys
 * are normal — components should always render premium fallback copy
 * when their key is absent.
 *
 * `mediaAsset` is the optimised media pipeline output (May-2026). When
 * present, components render <SmartImage> with focal-cropped responsive
 * variants. When absent, they fall back to the legacy `imageDataUrl`
 * (a single base64 webp) so old data keeps rendering.
 */
export type HomepageSectionContent = {
  key: string;
  eyebrow: string | null;
  title: string | null;
  subtitle: string | null;
  body: string | null;
  imageDataUrl: string | null;
  imageAlt: string | null;
  objectPositionDesktop: string | null;
  objectPositionMobile: string | null;
  overlayOpacity: number | null;
  blurIntensity: number | null;
  ctaPrimaryLabel: string | null;
  ctaPrimaryHref: string | null;
  ctaSecondaryLabel: string | null;
  ctaSecondaryHref: string | null;
  isActive: boolean;
  sortOrder: number;
  mediaAsset: MediaAssetManifest | null;
};

export type HomepageContentMap = Record<string, HomepageSectionContent>;

export function useHomepageContent() {
  return useQuery<HomepageContentMap>({
    queryKey: ["/api/homepage-content"],
    staleTime: 60_000,
  });
}
