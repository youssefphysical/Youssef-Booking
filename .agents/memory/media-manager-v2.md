---
name: Media Manager v2 architecture
description: Design decisions for the professional image management system — multi-res processing, desktop/mobile independence, security.
---

## Desktop / Mobile independence
Mobile settings are stored as JSONB (`mobileSettings` on hero_images, `{prefix}MobileSettings` on settings). This means:
- Adding a new mobile-specific key never requires an ALTER TABLE.
- Desktop flat columns (focalX, positionX, zoom…) are **never** touched when saving mobile settings.
- The frontend reads `img.mobileSettings` as `Record<string, number | string>` and merges with defaults.

**Why:** The old flat-column approach would have required 7+ new columns per service card (21 total) just for mobile display tuning — unmaintainable and risky in production.

## Multi-resolution pipeline
`processImageMultiRes()` in `server/routes.ts` does one sharp decode then runs three `.clone()` pipelines in parallel via `Promise.all`:
- Desktop: 1920×1080 cover crop (hero) or 1200×800 cover (services), WebP quality 92
- Mobile: 768px max-edge, WebP quality 88
- Thumbnail: 400px max-edge, WebP quality 75
- Original: the incoming data URL stored as-is (client-side crop at full quality)

**Why:** Single decode is fastest and avoids re-decoding compressed data three times. The original is preserved so re-processing at different sizes is always possible without re-upload.

## Security
- **Rate limiting:** in-memory Map per IP, 30 uploads / 5 min window. Resets on cold start (Vercel serverless) — acceptable for abuse deterrence, not strict enforcement.
- **Magic bytes:** binary JPEG (FF D8 FF), PNG (89 50 4E 47), WebP (RIFF....WEBP) checked on the raw buffer before sharp runs. Guards against polyglot files where MIME doesn't match content.
- **Max size:** 25 MB decoded, 40 MB data-URL string.

## Route surface
New routes live at `/api/admin/media/*` alongside existing `/api/admin/hero-images` and `/api/admin/service-images/:card` which are kept intact for backward compat.

## How to apply
- Any new "per-image mobile setting" → add a key to the existing jsonb; no schema change needed.
- Any new image type → add `processImageMultiRes()` call in the upload route; all four variants come back automatically.
- Jsonb defaults in ensureSchema.ts must use `'{}'::jsonb`, not `'{}'` (plain string won't cast).
