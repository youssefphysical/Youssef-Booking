---
name: Logo Manager schema columns
description: Custom logo URLs added to settings table; wired up in BrandLogo + PremiumPageLoader
---

Three columns added to `settings` table (+ ensureSchema):
- `logo_icon_url` / `logoIconUrl` — icon-only logo (navbar, sidebar, footer, page loader)
- `logo_navbar_url` / `logoNavbarUrl` — horizontal icon+text logo (admin brand preview)
- `logo_auth_url` / `logoAuthUrl` — auth hero / onboarding logo

**Why:** Youssef needs to upload custom logo variants without touching static public files.
Stored as base64 WebP data URLs (same pattern as hero/service images — Vercel-safe, no filesystem dep).

**How to apply:** When adding new logo slots, follow same pattern: add text column to schema.ts,
ADD COLUMN IF NOT EXISTS to ensureSchema.ts, add POST + DELETE routes in routes.ts,
update BrandLogo.tsx / any rendering component to check the new field first.
