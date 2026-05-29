---
name: Brand file storage architecture
description: How logo and hero image assets are stored — file URLs in uploads/, not base64 in DB. Boot migration converts legacy rows.
---

## Rule
All brand logo uploads (icon/navbar/auth slots) and hero images write to disk under `uploads/brand/` and `uploads/heroes/` respectively. Only the `/uploads/…` file URL is stored in the DB column. No base64 data URLs are ever written for new assets.

**Why:** Base64 blobs bloat every Neon row read. A 1 MB logo stored as base64 is ~1.37 MB of text transferred from Neon on every `getSettings()` call. File URLs are < 50 chars.

## How to apply
- Logo upload route (`POST /api/admin/media/logo/:slot`): write `sharp`-processed buffer to `uploads/brand/logo-${slot}-${Date.now()}.webp`, store `/uploads/brand/…` URL in settings, delete previous file.
- Logo delete route (`DELETE /api/admin/media/logo/:slot`): unlink disk file before nulling the DB column.
- Hero upload route (`POST /api/admin/media/hero`): write desktop + mobile WebP buffers to `uploads/heroes/`, pass `imageUrl`/`mobileUrl` to `createHeroImage()`.
- `GET /api/hero-images` (public): strips `imageDataUrl/mobileDataUrl/originalDataUrl/thumbnailDataUrl` from response for slides that have a file URL; falls back to base64 for slides still pending migration.
- `runBrandFileMigration()` runs on every boot via `setImmediate` — idempotent, skips rows already migrated, no-op if files exist.

## Schema
- `hero_images.image_url` text nullable — desktop file URL
- `hero_images.mobile_url` text nullable — mobile file URL
- Both added via `ALTER TABLE IF EXISTS hero_images ADD COLUMN IF NOT EXISTS …` in `ensureSchema.ts`.

## Client side
- `BrandLogo.tsx`: navbar variant uses `logoNavbarUrl || logoIconUrl || "/ye-logo.png"` (fixes the prior column mismatch where navbar read from icon slot only).
- `HeroSlider.tsx`: `src = isMobile ? (slide.mobileUrl || slide.imageUrl || slide.imageDataUrl) : (slide.imageUrl || slide.imageDataUrl)`. Mobile shows `slides.slice(0,1)` (not empty array).
- `App.tsx`: `useEffect` syncs `<link rel="icon">` and `<link rel="apple-touch-icon">` to `settings.logoIconUrl` on change.
- `AuthPage.tsx`: `logoSrc` derived from `useSettings()` hook — not a static `@assets/` import.
