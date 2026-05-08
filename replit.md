# Youssef Ahmed Personal Training Service

Premium dark-luxury platform for Youssef Ahmed, offering client booking, InBody tracking, progress photos, and comprehensive admin management.

## Run & Operate

- **Run:** `npm run dev`
- **Build:** `npm run build`
- **Typecheck:** `npm run typecheck`
- **Codegen (Drizzle):** `npm run db:codegen`
- **DB Push (Drizzle):** `npm run db:push`

**Required Environment Variables:**
- `DATABASE_URL`: PostgreSQL connection string.
- `JWT_SECRET`: Secret for JWTs.
- `RESEND_API_KEY`: API key for email notifications (e.g., password reset).
- `PUBLIC_APP_URL`: Public URL of the application for password reset links.
- `OPENAI_API_KEY`: For OpenAI Vision API.

## Stack

- **Frontend:** React + Vite, Wouter, TanStack Query v5, react-hook-form + Zod, Tailwind CSS, shadcn/ui, Framer Motion, lucide-react / react-icons.
- **Backend:** Express.js, Passport.js (local strategy), express-session (PostgreSQL store), scrypt, Multer.
- **Database:** PostgreSQL (Drizzle ORM, drizzle-zod).
- **AI/Image Processing:** OpenAI Vision (gpt-5), `sharp`.
- **Build Tool:** Vite

## Where things live

- `client/`: Frontend React application.
  - `client/src/index.css`: Global styles, including homepage shell and hero animations.
  - `client/src/components/Navigation.tsx`: Main navigation and authentication UI.
  - `client/src/pages/HomePage.tsx`: Public homepage content and hero slider.
  - `client/src/pages/ResetPassword.tsx`: Password reset UI.
  - `client/src/lib/whatsapp.ts`: WhatsApp message builder.
- `server/`: Backend Express application.
  - `server/app.ts`: Express app creation (for Replit and Vercel).
  - `server/index.ts`: Replit-specific server entry point.
  - `server/db/schema.ts`: Drizzle ORM database schema definition.
  - `server/db/ensureSchema.ts`: Database schema migration/self-heal script.
- `api/index.ts`: Vercel serverless function entry point.
- `scripts/inject-hero.mjs`: Build-time script for hero image preloading.
- `public/hero-initial.webp`: Static default hero image for first paint.
- `vercel.json`: Vercel deployment configuration.

## Architecture decisions

- **No online payments:** All package renewals and extensions are manually confirmed by Youssef Ahmed via WhatsApp after client requests.
- **Base64 profile pictures:** Profile pictures are stored directly as base64 data URLs in the database, avoiding filesystem dependencies for Vercel deployments.
- **Consent audit trail:** Detailed consent records (T&Cs, medical, InBody/progress photo upload) are stored server-side for compliance, even if UI shows a combined checkbox.
- **Dedicated admin panel:** A separate, permissioned admin portal (`/admin-access`) provides comprehensive control over clients, bookings, packages, and system settings.
- **Package catalogue with snapshots:** Admins manage a `package_templates` catalogue via `/admin/package-builder`. When a template is assigned to a client, every field (name, paid/bonus sessions, pricing, expiry) is **snapshotted** onto the `packages` row, so editing/deleting a template never mutates historical client data. Active templates are also rendered publicly on the homepage.
- **AI for InBody:** OpenAI Vision API extracts metrics from InBody scans, ensuring data entry efficiency. Failures are gracefully handled to ensure uploads persist.

## Product

- **Public Website:** Hero section with rotating images, about section, certifications, transformations, and contact options.
- **Client Area:**
    - Streamlined 2-step registration.
    - Dashboard with upcoming/past bookings, package progress, InBody records, and progress photos.
    - Booking calendar with real-time slot availability.
    - Profile management with avatar upload/cropping, training preferences, and password change.
    - Client-initiated renewal and extension requests via WhatsApp.
- **Admin Portal:**
    - Dashboard with key performance indicators (KPIs) and quick actions.
    - Management of bookings (reschedule, cancel, manual booking).
    - Comprehensive client list with detailed client pages for data management, package assignment, and progress tracking.
    - Staff management with role-based access control.
    - System settings for cutoff times, WhatsApp number, and blocked slots.
- **Premium Business Workflow:** Explicit package lifecycles (start/expiry dates, status), attendance tracking, and admin notes for clients.
- **Password Reset:** Secure forgot/reset password flow with email notification and token invalidation.

## Transformation Ecosystem (Phase 4 — shipped May 2026)

- **P4a Body Metrics + Trend Charts** — `body_metrics` table, admin/self routes, recharts trend on Body tab.
- **P4b Weekly Check-ins + Adherence** — `weekly_checkins` (energy/sleep/training/cardio adherence + coach response), unique per user/week.
- **P4c Before/After Comparison Slider** — `view_angle` on `progress_photos`, `BeforeAfterCompare` clip-path component, Compare/Gallery toggle.
- **P4d Per-Session Coach Notes** — 9 nullable cols on `bookings` (energy/performance/sleep/adherence sliders + cardio/painInjury/private+clientVisible notes + `coachNotesUpdatedAt`). PATCH guard rejects coach fields for non-admin. Centralized `sanitizeBookingForUser(me, b)` strips `privateCoachNotes` from every booking response (list, create, cancel, same-day-adjust, patch).
- **P4e Activity Timeline** — `buildActivityFeed(userId, limit)` aggregator unions bookings (explicit BOOKING_STATUSES → booked/completed/cancelled), packages (adminApproved), bodyMetrics, weeklyCheckins, inbody, progress photos, and coach_note (any `coachNotesUpdatedAt`, subtitle from `clientVisibleCoachNotes` only). Endpoints: `GET /api/me/activity`, `GET /api/admin/clients/:id/activity`. New `ActivityFeed.tsx` vertical timeline mounted as Activity tab on both client + admin.
- **P4f Today Hero Card** — `GET /api/me/today` returns nextSession (date+timeSlot epoch, strictly > now), supplementsToday (active client_supplements within window), waterTargetMl (active nutrition plan), streakWeeks (consecutive Mon-anchored ISO weeks with ≥1 check-in OR ≥1 completed booking), goal (primaryGoal + first/latest body-metric weight delta). `TodayHero.tsx` luxury 4-stat card mounted at top of dashboard, streak flame badge at ≥4 weeks.

## Operational Intelligence Layer (May 2026 — in progress)

Lightweight, non-AI smart-surfacing for admin. Calm premium UI (no noisy red flood), single batched query per signal (no N+1), admin-only enrichment.

- **OI1 Client Health Score** — pure `server/services/clientHealth.ts → computeClientHealth(s)` derives status (`healthy|watch|at_risk|inactive|new|frozen|ended`) + 0-100 score from batched signals. `storage.getHealthSignalsForUsers(userIds)` runs 5 grouped queries, `Map<userId, signals>` regardless of N. `sanitizeAndEnrich(Many)` accepts `{withHealth?}`; only `/api/users` admin list + `/api/users/:id` when admin set true — never leaks via `BookingWithUser`/`PackageWithUser`. `<HealthBadge>` (`client/src/components/HealthBadge.tsx`) — dot+pill, tooltip with top signal, `xs|sm`. Mounted in AdminClients row+mobile card + AdminClientDetail header.

- **OI2 Client Command Center** — premium unified intelligence at top of admin client Overview tab, replaces tab-switching with one operational story. New `GET /api/admin/clients/:id/intelligence` (`requireAdmin`) returns `{snapshot, momentum, attentionItems, recentChanges}` computed by pure `server/services/clientIntelligence.ts → computeClientIntelligence(input)` from `storage.getClientIntelligenceData(userId)` (5 bounded queries: active package, last 60d bookings limit 200, last 12 check-ins, last 5 body metrics, pending renewal/extension counts). **Snapshot strip** (6 chips, calm tone shifts): sessions left, expires in (red <0d, amber ≤7d), attendance30d (green ≥85, amber ≥65, rose <65), check-in adherence 4w, weight + 30d delta (older metric must be ≥21d old or delta=null — avoids misfire), next session. **Momentum pill** (`improving|stable|slowing|inactive|inconsistent`) — transparent rules: inactive (no session 14d+), inconsistent (≥2 no-shows 30d), slowing (completed30d < prev30d × 0.6 with prev≥3), improving (count up 20% OR weight delta toward primaryGoal OR ≥90% attendance). **Attention list** (max 6, severity-sorted critical→info): no_package, pkg_expired/expiring, sessions_low, payment pending, renewal/extension pending, inactive_long, noshow_recent, no/stale checkin, no/stale body, weight off goal-track — each clickable to jump to corresponding tab. **Recent changes** (last 14d, max 8): completed/missed sessions, check-ins, body metrics, coach notes — relative timestamps. New `client/src/components/admin/ClientCommandCenter.tsx` mounted at top of OverviewTab; existing 4 detail mini-cards preserved as deep-link entry points. TanStack Query `staleTime: 60_000`. Architect PASS first try.

## Automation + Intelligence Ecosystem (Phase 5 — in progress May 2026)

- **P5b Notification Triggers** — wired via `notifyUserOnce` (atomic dedupe) into: booking confirmation (`dispatchBookingNotifications`), admin cancel of someone else's booking, admin reschedule of date/time, attendance milestone on transition into `completed` for thresholds [5,10,25,50,100,200,365,500], 24h/1h cron in-app reminders (decoupled from email so users without email still get the in-app post), package expiry (7/3/1-day windows), missed weekly check-in (Mon-anchored ISO week, skip Mon). Atomicity: `client_notifications.dedupe_key` text column + partial `UNIQUE INDEX (user_id, kind, dedupe_key) WHERE dedupe_key IS NOT NULL`; `createClientNotificationOnce` uses raw SQL `ON CONFLICT (user_id, kind, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING ...` — Drizzle's `onConflictDoNothing({target:[...]})` doesn't emit the predicate so the arbiter wouldn't match the partial index. Schema parity: indexes also declared inline in `shared/schema.ts`.

- **P5c Premium Analytics Dashboard** — `GET /api/admin/analytics` returns snapshot KPIs (clients active/frozen/new30d, sessions completed30/90d + attendanceRate30d + noShowRate30d + upcomingNext7d, packages active/expiringSoon/expired/frozen + renewals30d, revenue total/paid30d/outstanding, retention multiPackageClients + churn30/60/90d, weekly check-in adherence) and 12-month trend buckets (revenueByMonth paid+total, completedByMonth, signupsByMonth, bookingsByDow). DOW counts ALL non-cancelled bookings (upcoming/confirmed/completed/no_show/late_cancelled) so demand shape isn't skewed by attendance. Adherence uses single bulk SQL `SELECT COUNT(*) FROM weekly_checkins WHERE user_id = ANY($1::int[]) AND week_start >= $2::date` (no N+1). New `AdminAnalytics.tsx` page mounted at `/admin/analytics` with recharts (Line/Bar/Pie), animated count-up KPI cards, circular adherence ring, churn signals card. New 'Analytics' tab added to `ADMIN_TABS`.

- **P5a Centralized Notifications** — `client_notifications` table (separate from `admin_notifications` trainer inbox). Channel-ready architecture: in-app active today; `channel_push` / `channel_email` + `push_sent_at` / `email_sent_at` columns scaffolded so future dispatchers can plug in without schema churn. Composite index `(user_id, read_at, created_at DESC)` for unread queries. Single dispatcher `server/services/notifications.ts → notifyUser(userId, kind, title, body, opts)` is the only entry point — best-effort, swallows errors so triggers can't block originating actions. Self-scoped routes `GET /api/me/notifications`, `GET /api/me/notifications/unread-count`, `POST /api/me/notifications/:id/read`, `POST /api/me/notifications/read-all` (userId always read from `req.user`, never from client input). Premium `NotificationsBell.tsx` mounted in `Navigation` for clients only — unread badge with 60s poll, mobile-first popover, deep-link support, optimistic mark-read + segmented `[LIST_PREFIX, params]` query keys so prefix invalidation works under `staleTime: Infinity`.

## Admin UX Rebuild (in progress May 2026)

Phased premium operating-system rebuild — Apple/Stripe/Notion clarity, mobile-first, no logic changes to auth/booking/packages/nutrition/supplements/notifications/analytics endpoints.

- **UX1 Design system primitives** — `client/src/components/admin/primitives.tsx` is the single source for the dark-luxury card pattern. Exports: `AdminCard`, `AdminPageHeader`, `AdminSectionTitle`, `AdminStatCard` (animated count-up via `useAdminCountUp`, format = int|percent|currencyEGP|raw, hoisted `Intl.NumberFormat` instances to avoid per-frame allocations), `AdminAlertRow` (priority-tone tile with chevron), `AdminEmptyState`, `AdminChartCard` (consistent recharts wrapper). Tone tokens: `info | success | warning | danger | schedule | muted | default`. RTL-safe chevrons (`rtl:rotate-180`).

- **UX2 Home rebuild** — `AdminDashboard.tsx` anchored by `TodayHero` (large today-session count + date + 3 chips: upcoming/urgent/revenue30d). `revenue30d` from `/api/admin/analytics` (lazy `useQuery`, `staleTime: 60_000`, silent on fail — no extra round-trip beyond what existing pages do). Urgent-alerts strip (5 `AdminAlertRow` tiles: expiring/expired/pendingRenewals/pendingExtensions/lowSessionClients) only renders when `urgentCount>0`. KPI grid + upcoming-sessions list (with `AdminEmptyState` fallback) + tightened `QuickAction` rail (added Analytics quick-action). `AdminAnalytics.tsx` consumes the same primitives (StatCard + ChartCard + PageHeader + SectionTitle), eliminating duplicate count-up/StatCard/ChartCard implementations.

- **P5g Performance Sprint (May 2026)** — two safe, measurable batches.
  **Batch 1 — route-level code splitting:** `client/src/App.tsx` converted from 30 eager `import`s to `React.lazy()` + `<Suspense fallback={<Loader/>}>`. Eager kept for critical path: `HomePage` (LCP for guests), `AuthPage` (auth funnel), `NotFound` (fallback). 28 other pages ship as on-demand chunks. **Initial JS: 3.6MB → 1.9MB (-47%)**. Per-page chunks: ClientDashboard 635K (recharts-heavy), LineChart vendor split 385K, AdminClientDetail 101K, most <50K. `vite.config.ts` untouched.
  **Batch 2 — fonts diet:** `client/index.html` was requesting **24 Google Font families**. Audit (`rg` across `client/src`) confirmed only `DM Sans` (--font-body) and `Plus Jakarta Sans` (--font-display) are actually used; `Inter` is a fallback string, `Outfit` was a HERO v6 leftover. Trimmed `<link>` to those 2 families with the weights actually used (400-700 / 400-800). Also removed the duplicate `@import` at the top of `index.css` that was pulling DM Sans + Outfit again as a second render-blocking CSS request. Result: ~150KB+ less woff2 on first paint, one font-CSS request instead of two, `display=swap` preserved (no FOIT, no CLS). HTML payload 13.17KB → 12.50KB.

- **P5e Premium Transformation Gallery (May 2026)** — new public page at `/transformations` (`client/src/pages/TransformationsGallery.tsx`, route added to `App.tsx`). Reuses existing `transformations` table + `/api/transformations` endpoint + `useTransformations` hook — **zero schema/route changes**. Self-contained `PublicCompareSlider` (pointer events: mouse + touch + pen, ARIA `role=slider` with valuemin/valuemax/valuenow, keyboard arrow nudge ±5%, `clip-path: inset(0 X% 0 0)` overlay) embedded in every `GalleryCard`. Goal filter chips auto-derived from data (only render when ≥2 distinct goals). `FullscreenModal` with body-scroll lock + Esc-to-close + click-outside dismiss + framer-motion enter/exit. Loading state uses the UX8 `.admin-shimmer` skeleton. Document.title updated for SEO. Homepage `<Transformations>` section now shows first 3 cards as teaser with "View gallery" pill in header + primary "View all N transformations" CTA at bottom when `data.length > 3`. All new strings use `t(key, fallback)` so no translation-file edits required for any of the 14+ supported languages.

- **UX8 Premium polish pass** — unified loading experience across the admin surface. Added `AdminSkeleton` + `AdminSkeletonStack` primitives backed by a new `.admin-shimmer` utility (subtle diagonal cyan→white sweep via `::after` pseudo, `220% 100%` background, 1.6s `cubic-bezier(0.4,0,0.2,1)` infinite, `isolation:isolate` so it never repaints siblings). `prefers-reduced-motion` gated → animation off, opacity 0.4 fallback. Replaced 5 ad-hoc `bg-white/5 animate-pulse` skeletons (AdminClients, AdminPackages, AdminBookings, AdminAnalytics, AdminClientDetail) with the new system — same layout footprint, premium feel.

- **UX7 Tables/Lists rebuild** — Three admin list pages converted to the shared design system. **AdminClients.tsx**: `AdminPageHeader` + 4 `AdminStatCard` KPIs (total/verified/active-plan/sessions-remaining), filter bar in `AdminCard` with search + new `statusFilter` (clientStatus: active/frozen/cancelled/expired/completed/incomplete) + verified + package-type + clear-all (only when active) + inline `count / total` badge, desktop table wrapped in `AdminCard padded={false}` with `sticky top-0 z-10 backdrop-blur-md` header, new `SortHeader` subcomponent — sortBy=name|remaining|joined, sortDir asc|desc, click toggles dir / switches field (remaining defaults desc, others asc), `AdminEmptyState` for no-results, ms/me/start/end RTL classes throughout. `ClientRow` + `MobileCard` preserved. **AdminPackages.tsx**: `AdminPageHeader` + 4 `AdminStatCard` KPIs (active/sessions-left/sessions-delivered/closed) + filter bar in `AdminCard` (search + status + clear-all + count badge) + `AdminEmptyState`. Package card grid + `PackageStat` + progress bar animation preserved 1:1. **AdminStaffPage.tsx**: `AdminPageHeader` with `right=Add admin Button` + 4 `AdminStatCard` KPIs (total/active/super/disabled) + table wrapped in `AdminCard padded={false}` + `overflow-x-auto` + `AdminEmptyState`. All mutations (create/update/delete) + AlertDialog confirm + full Dialog form (Form/Select/Switch + permission grid by `ADMIN_PERMISSION_GROUPS`) preserved unchanged.

- **UX6 Bookings/Calendar rebuild** — `AdminBookings.tsx` rebuilt as a premium scheduler. Subcomponents (`WorkoutLogButton`, `RescheduleButton`, `CreateBookingButton`) preserved. New: `AdminPageHeader` + 4 `AdminStatCard` KPIs (today / this-week / upcoming / completion-rate-30d, animated, single O(n) pass over bookings, `NON_CANCELLED_STATUSES` set so cancellations don't inflate density). New `CalendarWeekStrip` — Monday-anchored 7-day picker with per-day count badges (tone-shifts at ≥5), prev/next/Today buttons (Today only visible when today not in current week), `aria-pressed`, RTL-safe chevrons, click-to-toggle (re-selecting clears `dateFilter`). New `parseBookingDate(s)` helper parses `YYYY-MM-DD` as a LOCAL calendar day (avoids `new Date("…")` UTC shift). Filter bar adds search input (name/email/notes) alongside status/payment/workout selects + clear-all. List is now day-grouped (`DaySection`) with sticky headers + relative labels (Today/Tomorrow/Yesterday) + counts. Each `BookingRow` uses `AdminCard padded={false}` + internal padding, time tile splits AM/PM, RTL `ms-`/`me-`. `AdminEmptyState` for empty results. Mutations + override flags unchanged.

- **UX4 Navigation Overhaul (sidebar + mobile dock)** — `client/src/components/admin/AdminNavigation.tsx` exports `AdminSidebar`, `AdminMobileBottomNav`, `AdminMobileBottomSpacer`, and `buildAdminNavGroups(t)`. Sidebar reorganized into 7 collapsible groups (Overview · Clients · Coaching · Nutrition · Supplements · Financial · System) with localStorage persistence (`admin.sidebar.collapsed.v1`); a group force-expands when a child route is active so users always see where they are. Adds previously-missing `/admin/analytics` (under Overview) and `/admin/supplement-stacks` (under Supplements) to the sidebar. Premium active state: 2px primary `start-0` accent bar (RTL-safe) + soft `bg-primary/10` tint, `aria-current="page"`. Mobile bottom dock is a 5-slot fixed dock with a center elevated FAB that opens the ⌘K palette in create mode, "More" opens the sidebar in a slide-in drawer, `safe-area-inset-bottom` padding for iOS, and `AdminMobileBottomSpacer` reserves 64px so content never hides behind the dock. `Navigation.tsx` admin branch shrinks from ~110 lines (inline groups + SidebarLink) to ~30 lines (AdminSidebar + AdminMobileBottomNav + spacer); Escape closes the mobile drawer; backdrop click dismisses; `aria-hidden` correctly inverted. ⌘K shortcut + LogoutConfirmDialog + CommandPalette wiring preserved.

- **UX3 Global Search + Quick Add (⌘K palette)** — `client/src/components/admin/CommandPalette.tsx` built on shadcn `cmdk` Command/CommandDialog. Debounced (200ms) `useQuery(['/api/admin/search', q])` with `staleTime: 30s`, `enabled: open`. Always-visible **Create** group (5 quick adds linking `/admin/<route>?new=1` for client/booking/package/nutrition plan/supplement stack) sits above conditional **Search Results** groups (Clients/Bookings/Packages/Nutrition Plans/Supplement Stacks) which only render when `hasQuery && data.<group>.length > 0`, with always-visible **Jump to** nav at bottom. RTL-safe chevrons. Backend `GET /api/admin/search` (admin-only via `requireAdmin`) → `storage.searchAdmin(q, perCategory)` federated ILIKE across `users` (clients only — name/email/phone/username), `bookings` (date::text/timeSlot/notes/adminNotes), `packages` (name/type/notes), `nutritionPlans` (name/publicNotes), `supplementStacks` (name/description). Pattern is `%query%` with `%`/`_` escaped, query truncated 200 chars, `perCategory` clamped 1-20. Route batches client-name resolution via `Promise.all(storage.getUser(id))` over the union of userIds (no N+1 in storage). Response is field-sanitized (no password/token leakage). `useCommandPaletteShortcut(setOpen)` hook listens for ⌘K/⌃K (+ ⌘J/⌃J backup), wired in `Navigation.tsx` only when `user?.role === "admin"`. Visible ⌘K trigger button at top of admin sidebar (Linear/Stripe/Raycast pattern). Architect PASS first try.

- **UX5 Client Profile rebuild** — `AdminClientDetail.tsx` surgically refactored (sub-components preserved). New sticky `ClientHeader` (z-30 backdrop-blur, avatar + name + verified + status badge + 4 vital chips: goal/active package/sessions left/tier + horizontal-scroll quick-action pills row that jumps to tabs + `ClientStatusControl` in border-t section). `CLIENT_TABS` array drives a single horizontal-scroll TabsList in priority-of-use order: **Overview · Sessions · Nutrition · Supplements · Progress · Body Metrics · Check-ins · Notes · Documents · Payments · Health · Activity · Alerts**. Tabs is now controlled (`useState`) so quick-action pills can deep-link. `OverviewTab` rebuilt as command center: 4 mini-cards (Upcoming Sessions top-3 from `useBookings`, Active Package with progress bar/expiry/frozen badge, Latest Body Metric with weight delta vs prev/bf%/waist, Latest Weekly Check-in with 3 scale-aware `CheckinChip`s) — **all clickable to jump to detail tabs**. `CheckinChip` takes `max`+`suffix` props so `trainingAdherence` (0..100%) uses ratio-based thresholds (≥80% green, ≥50% amber) instead of false-flagging 75% as red. `activePackageOf` prefers status `active`/`expiring_soon` && !frozen, falls back to `isActive`. Profile snapshot card + `ClientPrivilegesCard` + `ConsentsCard` preserved below the command center.

## User preferences

_Populate as you build_

## Email reminders cron (external trigger)

The endpoint `/api/cron/reminders` dispatches the 24h + 1h booking reminder
emails. It is **not** scheduled by `vercel.json` because Vercel Hobby plans
limit crons to once per day, and this job needs to run every ~15 minutes.

To run it in production, point any external scheduler at the URL with the
`Authorization: Bearer ${CRON_SECRET}` header. Recommended options:

- **GitHub Actions** (`.github/workflows/reminders.yml` with `cron: '*/15 * * * *'`).
- **cron-job.org** or **EasyCron** (free, web UI to set the schedule + header).
- **Vercel Pro plan** — re-enable the `crons` array in `vercel.json`.

The endpoint is idempotent — it uses an atomic SQL claim
(`UPDATE bookings SET reminder_*_sent_at = now() WHERE … IS NULL RETURNING id`),
so it is safe to invoke as often as you like.

## Gotchas

- **Database Schema Mismatches:** If `server/db/schema.ts` changes, run `npm run db:codegen` and `npm run db:push` to update the Drizzle schema and apply migrations. For Vercel, manual `db:push` is often required for production.
- **Image Uploads on Vercel:** InBody and progress photo uploads (which use Multer) currently write to a local `/uploads` directory. This will not persist on Vercel's ephemeral filesystem and requires integration with object storage (e.g., S3, R2) for production. Profile pictures are exempt as they are base64 encoded into the database.
- **Hero Image Preload:** The `scripts/inject-hero.mjs` script is critical for optimal homepage LCP on Vercel. Ensure `DATABASE_URL` is configured for Vercel builds to refresh the static `/hero-default.webp`.
- **Auth Flow (May 2026 update):** The mobile auth pill in the header is now auth-state-aware — shows **Sign In** when guest, **Sign Out** when signed in. After successful client login/register the user is redirected to `/` (homepage), not `/dashboard`; admins still go to `/admin`.
- **Onboarding (May 2026, revised):** Register form has an optional package picker (`packageTemplateId`). Server snapshots the chosen template into a `packages` row with `adminApproved=true` + `paymentStatus='unpaid'`, sets `clientStatus='active'`, and writes an admin notification (`kind='system'`) so the trainer can confirm payment. **Booking is NOT gated on payment or approval** — clients can book immediately after signup. `evaluateBookingEligibility` only blocks for: incomplete profile, frozen/cancelled/completed/expired client, frozen/inactive package. Admin retains full edit control via the admin panel (price, sessions, freeze, payment, package swap). `general_fitness` is now an allowed `primaryGoal`. The legacy `/admin/pending` page + approve/reject endpoints are still mounted (for any leftover pending records) but no new pending records are created.

## Pointers

- **Drizzle ORM Docs:** [https://orm.drizzle.team/docs/overview](https://orm.drizzle.team/docs/overview)
- **TanStack Query Docs:** [https://tanstack.com/query/latest/docs/react/overview](https://tanstack.com/query/latest/docs/react/overview)
- **Tailwind CSS Docs:** [https://tailwindcss.com/docs](https://tailwindcss.com/docs)
- **Framer Motion Docs:** [https://www.framer.com/motion/](https://www.framer.com/motion/)
- **PostgreSQL Docs:** [https://www.postgresql.org/docs/](https://www.postgresql.org/docs/)
- **OpenAI API Docs:** [https://platform.openai.com/docs/overview](https://platform.openai.com/docs/overview)