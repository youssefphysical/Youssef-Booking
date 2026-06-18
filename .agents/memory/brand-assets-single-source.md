---
name: Brand assets single-source + canonical-path mapping
description: How logo display surfaces resolve to one source while keeping the Media Manager upload feature intact
---

# Brand assets — one source, no post-hydration swap

`client/src/config/brandAssets.ts` (`BRAND_ASSETS`, `BRAND_VERSION`) is the single
source for every logo/icon. Navbar renders a static `<img src={BRAND_ASSETS.logoNavbar}>`
with no settings dependency, no loading/onLoad state, no fade — it paints on frame 0.

## The canonical-path mapping rule
Every settings-driven logo consumer (AuthPage, BrandLogo sidebar/footer/icon,
PremiumPageLoader, App.tsx FaviconSync) treats the **default DB paths**
(`/brand-logo.png`, `/ye-logo.png`, `/ye-logo-horizontal.png`, `/ye-logo-primary.png`)
as "use the single source": they resolve to a `BRAND_ASSETS.*` URL. Only a genuine
admin upload (a `/uploads/…` path) overrides the canonical logo.

**Why:** the user repeatedly reported the logo "swapping after refresh." Root cause was
not the file — it was display surfaces reading the raw DB path with an `updatedAt`
cache token *after* settings hydrate, producing a different URL than the boot/preload
URL. Mapping defaults → `BRAND_ASSETS` makes the URL identical across cold boot and
post-hydration, so nothing re-fetches or swaps. All 9 DB slots currently hold
`/brand-logo.png`, so in practice every surface resolves to the single source.

**How to apply:** when adding any new logo render path, do NOT use the raw settings
URL directly. Run it through the canonical-path check first (default → `BRAND_ASSETS`,
`/uploads/…` → bust with `updatedAt`). Keep the static test contract: `BrandLogo.tsx`
must not contain literal `/ye-logo*.png` strings and must keep the `bustUrl` helper +
MM source chain — so harden the *default→source* mapping rather than ripping out the
Media Manager settings system (that would break ~20 enforcing tests and the admin
upload feature).

## Asset regeneration
`scripts/gen-logos.mjs` regenerates every variant from the transparent master
(`client/public/brand/logo-master.png`) via sharp: transparent display logos
(navbar/auth + brand-logo/ye-logo aliases), AMOLED `#050505` app icons/maskable/OG,
and a PNG-in-ICO favicon. Bump `BRAND_VERSION` when the master changes.
