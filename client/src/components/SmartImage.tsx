import { useState } from "react";
import type { MediaAssetManifest } from "@shared/schema";

/**
 * Responsive media renderer for the May-2026 media architecture.
 *
 * Renders a `<picture>` with AVIF + WebP `<source>` elements at
 * mobile (≤768px) and desktop breakpoints. The browser picks the
 * smallest format/width that fits the viewport, so we serve a
 * 480px AVIF on a phone and a 1280px WebP on a laptop — never the
 * full 1920px master.
 *
 * Anti-CLS:
 *   - When `fill` is false (default), the wrapper carries an
 *     explicit `aspect-ratio` so the box is correct before any
 *     pixel arrives.
 *   - When `fill` is true, the parent owns the aspect ratio and
 *     SmartImage just absolute-fills it. Use this when embedding
 *     in a designed pane (Hero / Philosophy / FinalCTA) so the
 *     existing dark-luxury frame keeps its shape.
 *   - The fallback `<img>` carries width/height attributes for the
 *     intrinsic-size hint on first paint.
 *
 * LQIP: a 24px blurred JPEG (~500 bytes) is set as background-image
 * on a sibling div and faded out once the real image fires `onLoad`.
 * Looks like frosted glass during the few hundred ms before bytes
 * arrive — never a flash of empty space.
 *
 * Priority: when `priority` is true (above-the-fold hero only) the
 * image uses `loading="eager"` + `fetchpriority="high"` and the
 * fallback `<img>` decodes synchronously so it paints with the
 * first frame. Otherwise: `loading="lazy"` + `decoding="async"`.
 *
 * Cache: every URL carries `?v={asset.version}` (the asset's
 * updatedAt epoch). When the admin re-crops, version bumps and
 * the browser refetches automatically — variants themselves are
 * served with `Cache-Control: immutable, max-age=1y`.
 */

const DESKTOP_WIDTHS = [768, 1280, 1920] as const;
const MOBILE_WIDTHS = [480, 768] as const;
const MOBILE_BP = 768;

export interface SmartImageProps {
  asset: MediaAssetManifest;
  className?: string;
  /**
   * When true, SmartImage renders absolute-fill and the parent
   * controls width/height/aspect-ratio. When false (default),
   * SmartImage carries its own aspect-ratio (desktop aspect).
   */
  fill?: boolean;
  /** Eager + fetchpriority high — set on hero only. */
  priority?: boolean;
  /** Tailwind sizes hint for desktop (default tuned for max 1280). */
  sizesDesktop?: string;
  /** Inline style passthrough (e.g. for borders, glow). */
  style?: React.CSSProperties;
  /** data-testid forwarded to the wrapper. */
  testId?: string;
}

function srcset(id: number, bp: "d" | "m", fmt: "a" | "w", widths: readonly number[], v: number) {
  return widths.map((w) => `/api/media/${id}/v/${bp}/${fmt}/${w}?v=${v} ${w}w`).join(", ");
}

function aspectRatioCss(s: string): string {
  return /^\d+\/\d+$/.test(s) ? s : "16 / 9";
}

function aspectToWHpair(s: string, baseWidth: number): { w: number; h: number } {
  const m = s.match(/^(\d+)\/(\d+)$/);
  if (!m) return { w: baseWidth, h: Math.round(baseWidth * 0.5625) };
  const aw = Number(m[1]);
  const ah = Number(m[2]);
  return { w: baseWidth, h: Math.round((baseWidth * ah) / aw) };
}

export function SmartImage({
  asset,
  className,
  fill = false,
  priority = false,
  sizesDesktop = "(min-width: 1280px) 1280px, 100vw",
  style,
  testId = "smart-image",
}: SmartImageProps) {
  const [loaded, setLoaded] = useState(false);
  const v = asset.version || 0;
  const id = asset.id;
  const desktopAR = aspectRatioCss(asset.desktopAspect);
  const wh = aspectToWHpair(asset.desktopAspect, 1280);

  // Wrapper geometry: fill mode = absolute inset 0 inside a
  // parent that already controls aspect; non-fill = relative box
  // that owns its own aspect-ratio (CLS-safe).
  const rootStyle: React.CSSProperties = fill
    ? { position: "absolute", inset: 0, overflow: "hidden", ...style }
    : { position: "relative", overflow: "hidden", aspectRatio: desktopAR, ...style };

  return (
    <div className={className} style={rootStyle} data-testid={testId} data-loaded={loaded}>
      {/* LQIP layer — blurred 24px jpeg as background, fades out
          once the real image fires `onLoad`. Sits behind the img
          with no pointer events. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: `url("${asset.lqip}")`,
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(20px)",
          transform: "scale(1.1)", // hide blur edges
          opacity: loaded ? 0 : 1,
          transition: "opacity 350ms ease-out",
        }}
      />
      <picture>
        {/* Mobile sources first — `<source>` elements are evaluated
            top-to-bottom and the first matching one wins. */}
        <source
          media={`(max-width: ${MOBILE_BP}px)`}
          type="image/avif"
          srcSet={srcset(id, "m", "a", MOBILE_WIDTHS, v)}
          sizes="100vw"
        />
        <source
          media={`(max-width: ${MOBILE_BP}px)`}
          type="image/webp"
          srcSet={srcset(id, "m", "w", MOBILE_WIDTHS, v)}
          sizes="100vw"
        />
        {/* Desktop sources */}
        <source
          type="image/avif"
          srcSet={srcset(id, "d", "a", DESKTOP_WIDTHS, v)}
          sizes={sizesDesktop}
        />
        <source
          type="image/webp"
          srcSet={srcset(id, "d", "w", DESKTOP_WIDTHS, v)}
          sizes={sizesDesktop}
        />
        {/* Fallback `<img>` — last-resort 1280px WebP (every browser
            we support has WebP since Safari 14, mid-2020). The
            crop is already focal-pointed by sharp, so object-position
            stays centered. */}
        <img
          src={`/api/media/${id}/v/d/w/1280?v=${v}`}
          alt={asset.altText || ""}
          width={wh.w}
          height={wh.h}
          loading={priority ? "eager" : "lazy"}
          // @ts-expect-error fetchpriority is a valid HTML attribute, not yet typed in lib.dom
          fetchpriority={priority ? "high" : "auto"}
          decoding={priority ? "sync" : "async"}
          onLoad={() => setLoaded(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: "center center",
            opacity: loaded ? 1 : 0,
            transition: "opacity 350ms ease-out",
          }}
        />
      </picture>
    </div>
  );
}
