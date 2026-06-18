---
name: Brand file storage architecture
description: How logo and hero image assets are stored — file URLs in uploads/, not base64 in DB. Boot migration converts legacy rows. Static canonical logos live in client/public/brand/.
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

## Static canonical logos (client/public/brand/)
These are the FALLBACK assets when no MM slot is uploaded. All are now the YE mark (angular cyan YE on transparent bg, background-removed).
- `logo-icon.png` — compact YE mark. CANONICAL_ICON in BrandLogo: footer, sidebar, icon variants.
- `logo-navbar.png` — same YE mark. CANONICAL_NAVBAR in BrandLogo: navbar fallback.
- `logo-auth.png` — same YE mark. CANONICAL auth hero fallback in AuthPage.tsx.
- `logo-master.png` — same YE mark. PremiumPageLoader fallback.
- `logo-og.png` — same YE mark. OG card fallback.

**Old mascot/brain logo was removed from ALL brand files (June 2026).** Do NOT restore old logos.

## BRAND_ASSETS split (client/src/config/brandAssets.ts)
- `logoIcon` → `/brand/logo-icon.png` — small placements (footer, sidebar, icon)
- `logoNavbar` → `/brand/logo-navbar.png` — horizontal brand / navbar
- `logoMaster/logoAuth/logoOg` → other canonical files
- BRAND_VERSION bumped to `ye-icon-2026-06-18` to bust caches after logo swap.

## BrandLogo.tsx canonical fallback split
- `CANONICAL_NAVBAR = BRAND_ASSETS.logoNavbar` — navbar loading + empty states
- `CANONICAL_ICON = BRAND_ASSETS.logoIcon` — footer/sidebar/icon loading + empty states

**Why:** Before this split, all variants fell back to `logoNavbar` (the old mascot). Now footer/icon/sidebar correctly fall back to the compact YE mark.

## Schema
- `hero_images.image_url` text nullable — desktop file URL
- `hero_images.mobile_url` text nullable — mobile file URL
- Both added via `ALTER TABLE IF EXISTS hero_images ADD COLUMN IF NOT EXISTS …` in `ensureSchema.ts`.

## Client side
- `BrandLogo.tsx`: CANONICAL_NAVBAR for navbar, CANONICAL_ICON for footer/sidebar/icon.
- `HeroSlider.tsx`: `src = isMobile ? (slide.mobileUrl || slide.imageUrl || slide.imageDataUrl) : (slide.imageUrl || slide.imageDataUrl)`. Mobile shows `slides.slice(0,1)` (not empty array).
- `App.tsx`: `useEffect` syncs `<link rel="icon">` and `<link rel="apple-touch-icon">` to `settings.logoIconUrl` on change.
- `AuthPage.tsx`: `logoSrc` derived from `useSettings()` hook — not a static `@assets/` import.
