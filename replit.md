# Youssef Ahmed Personal Training Service

Premium dark-luxury (AMOLED + Tron-cyan) training platform for Youssef Ahmed — client booking, InBody tracking, progress photos, admin management. Installable PWA, RTL-ready, AED currency, Asia/Dubai timezone.

## Run & Operate

- **Run:** `npm run dev`
- **Build:** `npm run build`
- **Typecheck:** `npm run typecheck`
- **Codegen (Drizzle):** `npm run db:codegen`
- **DB Push (Drizzle):** `npm run db:push`

## Required Environment Variables

- `DATABASE_URL` — PostgreSQL connection string (Neon in prod).
- `JWT_SECRET` — JWT/session signing.
- `SESSION_SECRET` — express-session cookie signing.
- `RESEND_API_KEY` — transactional email (password reset).
- `PUBLIC_APP_URL` — base URL used in emails (reset links, etc.).
- `OPENAI_API_KEY` — OpenAI Vision (gpt-5) for InBody scan extraction.
- `CRON_SECRET` — bearer token for `/api/cron/*` external scheduler.

## Stack

- **Frontend:** React + Vite, Wouter, TanStack Query v5, react-hook-form + Zod, Tailwind, shadcn/ui, Framer Motion, lucide-react / react-icons.
- **Backend:** Express, Passport.js (local strategy), express-session (PostgreSQL store), scrypt, Multer.
- **Database:** PostgreSQL (Drizzle ORM, drizzle-zod).
- **AI/Image:** OpenAI Vision, `sharp`.
- **Hosting:** Vercel (serverless via `api/index.ts`) + Neon Postgres.

## Where things live

- `client/` — React app
  - `client/src/index.css` — global styles, hero animations, Tron utilities.
  - `client/src/components/Navigation.tsx` — main nav + auth UI.
  - `client/src/pages/HomePage.tsx` — public homepage + hero slider.
  - `client/src/lib/whatsapp.ts` — WhatsApp message builder.
  - `client/src/lib/pwa.ts` — install prompt + standalone detection.
- `server/` — Express app
  - `server/app.ts` — Express factory (Replit + Vercel).
  - `server/index.ts` — Replit-specific entry.
  - `server/db/schema.ts` — Drizzle schema.
  - `server/ensureSchema.ts` — idempotent schema migration / self-heal.
  - `server/services/notifications.ts` — single notification dispatcher (`notifyUser` / `notifyUserOnce`).
- `api/index.ts` — Vercel serverless entry.
- `client/public/sw.js` — service worker (destination-allowlist cache).
- `client/public/manifest.webmanifest` — PWA manifest.
- `vercel.json` — Vercel deployment config.

## Architecture decisions

- **No online payments.** All package renewals/extensions are confirmed manually by Youssef via WhatsApp after client request.
- **Base64 profile pictures.** Stored as data URLs in the DB (no filesystem dep — Vercel-safe).
- **Consent audit trail.** Detailed consent records stored server-side even when UI shows a combined checkbox.
- **Dedicated admin portal.** `/admin-access` login → permissioned `/admin/*` routes.
- **Package catalogue with snapshots.** `package_templates` is the catalogue. Assigning a template **snapshots** every field onto the `packages` row, so editing/deleting a template never mutates historical client data.
- **AI for InBody.** OpenAI Vision extracts metrics; failures are swallowed so uploads always persist.
- **Centralised notifications.** All triggers funnel through `notifyUser*()`; channels (`inApp` active, `push`/`email` scaffolded) live as flags on the same row.
- **Atomic dedupe.** `client_notifications.dedupe_key` + partial unique index `(user_id, kind, dedupe_key) WHERE dedupe_key IS NOT NULL`. Storage uses raw SQL `ON CONFLICT … WHERE … DO NOTHING` (Drizzle's helper omits the predicate).
- **Coach-notes privacy.** `sanitizeBookingForUser(me, b)` strips `privateCoachNotes` from every non-admin booking response (list, create, cancel, patch, same-day-adjust).
- **Admin enrichment isolation.** Health-score / intelligence enrichment is opt-in (`{withHealth?:true}` on `sanitizeAndEnrich(Many)`) and only triggered by admin list/detail routes — never by `BookingWithUser` / `PackageWithUser` shapes.
- **Idempotent crons.** `/api/cron/reminders` uses atomic SQL claim (`UPDATE … WHERE … IS NULL RETURNING id`) so it's safe to invoke as often as desired.

## Product surface

- **Public:** hero slider, about, certifications, transformations gallery (`/transformations`), contact.
- **Client area:** 2-step register, dashboard (today hero, bookings, package, body, check-ins, photos, activity timeline), booking calendar with real-time availability, profile + avatar cropper, WhatsApp-driven renewal/extension requests.
- **Admin:** dashboard with KPIs + urgent alerts, bookings/calendar scheduler, clients (with health badge, command center, full detail tabs), packages, package builder, nutrition plans, supplement stacks, staff/permissions, analytics (`/admin/analytics`), system settings, ⌘K command palette.
- **PWA:** custom install prompt (14d dismiss TTL), standalone-mode polish (no pull-to-refresh, AMOLED bg lock), offline page with auto-reload on reconnect.
- **Password reset:** Resend-powered email + token invalidation.

## User preferences

- **Currency:** AED (United Arab Emirates Dirham). Render as `AED 0`, `AED 2,500`, `AED 12,000`. **No EGP anywhere.**
- **Aesthetic:** AMOLED black `#050505`, Tron cyan `hsl(183 100% 74%)` / `#5ee7ff`. Premium, restrained, no over-animation.
- **replit.md hygiene:** keep this file concise — active architecture decisions, deployment notes, production rules, env requirements only. Phase notes / audit history live in git history.

## Email reminders cron (external trigger)

`/api/cron/reminders` dispatches 24h + 1h booking reminder emails. **Not** scheduled by `vercel.json` because Vercel Hobby caps crons at once/day and this needs ~15-minute cadence.

In production, point any external scheduler at the URL with `Authorization: Bearer ${CRON_SECRET}`. Recommended:

- **GitHub Actions** (`.github/workflows/reminders.yml`, `cron: '*/15 * * * *'`).
- **cron-job.org** / **EasyCron** (free, web UI).
- **Vercel Pro** — re-enable the `crons` array in `vercel.json`.

The endpoint is idempotent (atomic SQL claim).

## PWA notes

- `client/public/sw.js` uses a **destination-allowlist** cache (`script` / `style` / `image` / `font` / `manifest` / `worker`). Bypasses `/api/`, `/uploads/`, `/auth/`, `/admin`, `/dashboard`, `/profile`, `/book` and any request with an `Authorization` header. **Do not introduce aggressive caching** — auth/API responses must always go to network.
- Standalone detection in `client/src/lib/pwa.ts` covers both `matchMedia('(display-mode: standalone)')` and iOS `navigator.standalone`. `main.tsx` sets `html.is-standalone` before first paint so CSS standalone rules activate on frame 0.
- Inline `<body style="background:#050505">` in `client/index.html` kills white flash on cold start.

## Performance rules

- Continuous infinite CSS animations are **gated to `(min-width: 768px) and (prefers-reduced-motion: no-preference)`** — keeps mobile/Samsung Internet smooth.
- Route-level code splitting in `client/src/App.tsx` via `React.lazy` (only `HomePage`, `AuthPage`, `NotFound` are eager).
- Fonts: only `DM Sans` + `Plus Jakarta Sans` from Google Fonts (one render-blocking CSS request, `display=swap`).
- Skeletons use the shared `.admin-shimmer` utility — same shimmer, same height as final content (zero CLS).

## Gotchas

- **Schema changes:** edit `shared/schema.ts`, then `npm run db:codegen` and `npm run db:push`. For Vercel prod, `db:push` against the prod `DATABASE_URL` is usually required.
- **Drizzle `onConflictDoNothing` + partial indexes:** the helper omits the `WHERE` predicate so the partial unique index won't match. Use raw SQL for partial-index upserts (see `createClientNotificationOnce`).
- **Booking timezone:** Dubai is fixed UTC+4 (no DST). Times are stored as `date` + `time_slot` strings; build `Date` objects with `+04:00` anchor when comparing to `now()` to avoid server-local drift.
- **Currency formatters:** `FMT_AED` (`primitives.tsx`, `AdminDashboard.tsx`, `AdminAnalytics.tsx`). `AdminStatCard format` accepts `"currencyAED"` (preferred); `"currencyEGP"` is a deprecated alias mapping to AED.
