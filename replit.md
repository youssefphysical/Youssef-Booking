# Youssef Ahmed Personal Training Service

Premium dark-luxury platform for Coach Youssef Ahmed (Dubai, UAE), offering client booking, InBody tracking, progress photos, coach-curated nutrition + supplement protocols, and comprehensive admin management.

> Historical phase notes (P4*, P5*, OI*, UX*, Mobile UX Polish, Coach-Curated Protocols) live in [`docs/CHANGELOG.md`](./docs/CHANGELOG.md). Keep this file scannable.

## Run & Operate

- **Run:** `npm run dev`
- **Build:** `npm run build`
- **Typecheck:** `npm run check`
- **Codegen (Drizzle):** `npm run db:codegen`
- **DB Push (Drizzle):** `npm run db:push`

**Required Environment Variables:**
- `DATABASE_URL` — PostgreSQL (Neon).
- `JWT_SECRET` / `SESSION_SECRET` — auth secrets.
- `RESEND_API_KEY` — transactional email (password reset, reminders).
- `PUBLIC_APP_URL` — public URL for password-reset and OG links.
- `OPENAI_API_KEY` — InBody Vision extraction.
- `CRON_SECRET` — bearer token for `/api/cron/reminders` external scheduler.

## Stack

- **Frontend:** React + Vite, Wouter, TanStack Query v5, react-hook-form + Zod, Tailwind CSS, shadcn/ui, Framer Motion, lucide-react / react-icons.
- **Backend:** Express.js, Passport.js (local strategy), express-session (PostgreSQL store), scrypt, Multer.
- **Database:** PostgreSQL (Drizzle ORM, drizzle-zod). Schema self-heals on boot via `server/ensureSchema.ts`.
- **AI/Image Processing:** OpenAI Vision (gpt-5), `sharp`.
- **Hosting:** Vercel (serverless via `api/index.ts`) + Replit dev.

## Where things live

- `client/` — Frontend React application.
  - `client/src/index.css` — Global styles, homepage shell, hero animations, admin shimmer.
  - `client/src/pages/HomePage.tsx` — Public homepage.
  - `client/src/components/CoachProtocols.tsx` — Coach-Curated Protocols (homepage teaser + dashboard locked-state).
  - `client/src/lib/whatsapp.ts` — All WhatsApp message builders (renewals, extensions, contact, protocol requests).
- `server/` — Backend Express application.
  - `server/app.ts` — Express app creation (Replit + Vercel).
  - `server/index.ts` — Replit entry point.
  - `server/ensureSchema.ts` — Schema self-heal (additive only).
  - `server/services/` — Pure business logic (notifications, clientHealth, clientIntelligence, activityFeed).
  - `shared/schema.ts` — Single source of truth for Drizzle tables, zod insert schemas, and shared types.
- `api/index.ts` — Vercel serverless entry.
- `vercel.json` — Vercel deployment config.

## Architecture decisions

- **No online payments.** All package renewals/extensions are manually confirmed by Coach Youssef via WhatsApp after a client-initiated request.
- **Coach-led, not marketplace.** Supplement and nutrition systems are framed as **Coach-Curated Protocols** (Essentials / Performance / Concierge). Public surface never exposes brands, dosages, or items — only tier philosophy + WhatsApp request CTA. Activation is manual by Coach.
- **Base64 profile pictures.** Stored as data URLs in the database — no filesystem dependency on Vercel.
- **Consent audit trail.** Detailed consent records (T&Cs, medical, InBody/photo upload) stored server-side even if UI shows a combined checkbox.
- **Dedicated admin panel.** Separate, permissioned admin portal at `/admin-access` → `/admin/*`.
- **Package catalogue with snapshots.** Templates managed at `/admin/package-builder`. When a template is assigned to a client, every field is **snapshotted** onto the `packages` row, so editing/deleting a template never mutates historical client data.
- **AI for InBody only.** OpenAI Vision extracts metrics from InBody scans. Failures are graceful — uploads always persist.
- **Schema self-heal.** `server/ensureSchema.ts` runs `CREATE TABLE IF NOT EXISTS` + `ADD COLUMN IF NOT EXISTS` on boot, so additive schema changes deploy without manual `db:push` on Vercel.

## Product

- **Public Website:** Hero with rotating images, about, certifications, packages, **Coach-Curated Protocols teaser**, transformations, contact.
- **Client Area:** Streamlined 2-step registration · dashboard with TodayHero / upcoming bookings / package progress / InBody / progress photos / activity timeline · booking calendar · profile + avatar · client-initiated renewal/extension via WhatsApp · in-app notifications bell.
- **Admin Portal:** TodayHero KPI dashboard · ⌘K command palette · clients with health badges + Command Center · bookings scheduler with calendar strip · packages catalogue · nutrition + supplement stacks · analytics dashboard · staff management · system settings.
- **Premium Business Workflow:** Explicit package lifecycles (start/expiry/status), attendance tracking, per-session coach notes (private + client-visible), weekly check-ins, body-metric trends.

## User preferences

- **Currency:** AED (United Arab Emirates Dirham). All money values render as `AED 0`, `AED 2,500`, `AED 12,000`. No EGP anywhere in the product.
- **Tier names:** Essentials / Performance / Concierge. Avoid "VIP", "Foundation", "Elite" (collisions with old labels).
- **Tone:** Coach-led, calm, premium. Never marketplace. Never noisy.

## Email reminders cron (external trigger)

The endpoint `/api/cron/reminders` dispatches the 24h + 1h booking reminder emails. Vercel Hobby crons are limited to once per day, so it must be invoked externally every ~15 min:

- **GitHub Actions** (`.github/workflows/reminders.yml` with `cron: '*/15 * * * *'`) — preferred.
- **cron-job.org** or **EasyCron** — free fallback.
- **Vercel Pro** — re-enable the `crons` array in `vercel.json`.

Send `Authorization: Bearer ${CRON_SECRET}`. The endpoint is idempotent (atomic SQL claim on `reminder_*_sent_at`), safe to invoke as often as desired.

## Gotchas

- **Schema changes:** edit `shared/schema.ts` AND add the `ADD COLUMN IF NOT EXISTS` / `CREATE INDEX IF NOT EXISTS` lines to `server/ensureSchema.ts` so Vercel boot heals automatically. Run `npm run db:push` for local Replit DB.
- **Image uploads on Vercel:** InBody and progress photo uploads (Multer) write to `/uploads`, which is ephemeral on Vercel. Profile pictures are base64-in-DB and exempt; everything else needs object storage for prod.
- **Hero Image Preload:** `scripts/inject-hero.mjs` is critical for homepage LCP on Vercel. `DATABASE_URL` must be available at Vercel build time.
- **Auth flow:** mobile auth pill in the header is auth-state-aware. After client login/register → `/`; admins → `/admin`.
- **Onboarding:** register form has an optional `packageTemplateId`. Server snapshots the template, sets `clientStatus='active'`, and notifies the trainer. **Booking is NOT gated on payment** — clients can book immediately. `evaluateBookingEligibility` only blocks for incomplete profile, frozen/cancelled/expired client, or frozen/inactive package.
- **Translation strings:** new UI uses `t(key, fallback)` so adding strings never requires editing per-language JSON for any of the 14+ supported languages.

## Pointers

- [Drizzle ORM](https://orm.drizzle.team/docs/overview) · [TanStack Query](https://tanstack.com/query/latest/docs/react/overview) · [Tailwind CSS](https://tailwindcss.com/docs) · [Framer Motion](https://www.framer.com/motion/) · [PostgreSQL](https://www.postgresql.org/docs/) · [OpenAI API](https://platform.openai.com/docs/overview)
