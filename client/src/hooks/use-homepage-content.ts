import { useQuery } from "@tanstack/react-query";

/**
 * Public homepage CMS content. Returns a key→section map. Missing keys
 * are normal — components should always render premium fallback copy
 * when their key is absent.
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
};

export type HomepageContentMap = Record<string, HomepageSectionContent>;

export function useHomepageContent() {
  return useQuery<HomepageContentMap>({
    queryKey: ["/api/homepage-content"],
    staleTime: 60_000,
  });
}
