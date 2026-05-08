# Changelog

Historical phase notes for the Youssef Ahmed PT platform. Moved out of
`replit.md` (May 2026) to keep the project README scannable. Each entry
is org-only documentation — none of these notes affect runtime behavior.

---

## Coach-Curated Protocols (Phase A — May 2026)

Premium concierge nutrition + supplement system. Replaces the marketplace
feel ("buy supplements") with a coach-led system ("request a protocol —
every protocol is reviewed before activation").

- **Phase A (shipped)** — schema + public surface + locked-state cards.
  - `supplement_stacks` extended with 7 additive columns: `tier`
    (`essentials`|`performance`|`concierge`|`custom`, default `custom`),
    `public_title`, `public_subtitle`, `public_description`, `ideal_for`
    text[], `philosophy`, `is_public` (default false). Existing rows are
    untouched. `ensureSchema.ts` uses `ADD COLUMN IF NOT EXISTS`. Partial
    index `(is_public) WHERE is_public = true` keeps the public list
    query fast even at scale.
  - `shared/schema.ts` — `PROTOCOL_TIERS` const, `ProtocolTier` type,
    `PublicProtocol` type, `DEFAULT_COACH_PROTOCOLS` (3-tier fallback so
    the homepage and dashboard always render even before admin authors
    real rows).
  - `storage.listPublicProtocols()` — single-query, hand-mapped to the
    sanitized `PublicProtocol` shape. **Never reads `supplement_stack_items`,
    `notes`, `description`** — defense in depth so the public route can't
    leak product/brand/dosage data even if the route layer forgets to
    whitelist. Falls back to `DEFAULT_COACH_PROTOCOLS` on empty.
  - `GET /api/protocols/public` — no auth, `Cache-Control: public,
    max-age=60, s-maxage=300`. Used by both homepage teaser + dashboard
    locked state.
  - `client/src/components/CoachProtocols.tsx` — single component, two
    modes (`homepage` | `dashboard`). Per-tier visual identity (Leaf /
    Flame / Crown icons, soft accent ring scaling with tier), `Lock`
    badge, ideal-for bullets, single primary CTA (WhatsApp request),
    "every protocol is reviewed before activation" tertiary copy.
    Custom-tier rows are filtered out client-side as a second defense.
  - `client/src/lib/whatsapp.ts → buildProtocolRequestWhatsApp({tierLabel,
    lang, clientName})` — self-contained mini-phrasebook for 7 languages
    (en/ar/fa/ur/de/fr/ru), graceful EN fallback for any other locale.
    Doesn't extend the main `Phrasebook` type so a new locale shipping
    without these strings can never become a build break.
  - Homepage: `<CoachProtocols mode="homepage" />` mounted between
    `<PublicPackages />` and `<Transformations />`.
  - Dashboard `SupplementsTab`: empty state replaced with
    `<CoachProtocols mode="dashboard" />`. Once the admin activates a
    real protocol, the regular protocol view takes over and this branch
    disappears.
- **Phase B (planned)** — intake form + admin inbox + statuses.
- **Phase C (planned)** — notification triggers + nutrition crosslink.

---

## Transformation Ecosystem (Phase 4 — shipped May 2026)

- **P4a Body Metrics + Trend Charts** — `body_metrics` table, admin/self routes, recharts trend on Body tab.
- **P4b Weekly Check-ins + Adherence** — `weekly_checkins` (energy/sleep/training/cardio adherence + coach response), unique per user/week.
- **P4c Before/After Comparison Slider** — `view_angle` on `progress_photos`, `BeforeAfterCompare` clip-path component, Compare/Gallery toggle.
- **P4d Per-Session Coach Notes** — 9 nullable cols on `bookings` (energy/performance/sleep/adherence sliders + cardio/painInjury/private+clientVisible notes + `coachNotesUpdatedAt`). PATCH guard rejects coach fields for non-admin. Centralized `sanitizeBookingForUser(me, b)` strips `privateCoachNotes` from every booking response (list, create, cancel, same-day-adjust, patch).
- **P4e Activity Timeline** — `buildActivityFeed(userId, limit)` aggregator unions bookings (explicit BOOKING_STATUSES → booked/completed/cancelled), packages (adminApproved), bodyMetrics, weeklyCheckins, inbody, progress photos, and coach_note (any `coachNotesUpdatedAt`, subtitle from `clientVisibleCoachNotes` only). Endpoints: `GET /api/me/activity`, `GET /api/admin/clients/:id/activity`. New `ActivityFeed.tsx` vertical timeline mounted as Activity tab on both client + admin.
- **P4f Today Hero Card** — `GET /api/me/today` returns nextSession (date+timeSlot epoch, strictly > now), supplementsToday (active client_supplements within window), waterTargetMl (active nutrition plan), streakWeeks (consecutive Mon-anchored ISO weeks with ≥1 check-in OR ≥1 completed booking), goal (primaryGoal + first/latest body-metric weight delta). `TodayHero.tsx` luxury 4-stat card mounted at top of dashboard, streak flame badge at ≥4 weeks. Coach-led labels: Streak→Consistency, Water→Hydration, tap-to-explain ⓘ tooltips, warmer empty copy.

---

## Operational Intelligence Layer (May 2026)

Lightweight, non-AI smart-surfacing for admin. Calm premium UI, single batched query per signal (no N+1), admin-only enrichment.

- **OI1 Client Health Score** — pure `server/services/clientHealth.ts → computeClientHealth(s)` derives status (`healthy|watch|at_risk|inactive|new|frozen|ended`) + 0-100 score from batched signals. `storage.getHealthSignalsForUsers(userIds)` runs 5 grouped queries, `Map<userId, signals>` regardless of N. `sanitizeAndEnrich(Many)` accepts `{withHealth?}`; only `/api/users` admin list + `/api/users/:id` when admin set true — never leaks via `BookingWithUser`/`PackageWithUser`. `<HealthBadge>` (`client/src/components/HealthBadge.tsx`) — dot+pill, tooltip with top signal, `xs|sm`. Mounted in AdminClients row+mobile card + AdminClientDetail header.

- **OI2 Client Command Center** — premium unified intelligence at top of admin client Overview tab, replaces tab-switching with one operational story. New `GET /api/admin/clients/:id/intelligence` (`requireAdmin`) returns `{snapshot, momentum, attentionItems, recentChanges}` computed by pure `server/services/clientIntelligence.ts → computeClientIntelligence(input)` from `storage.getClientIntelligenceData(userId)` (5 bounded queries: active package, last 60d bookings limit 200, last 12 check-ins, last 5 body metrics, pending renewal/extension counts). **Snapshot strip** (6 chips, calm tone shifts): sessions left, expires in (red <0d, amber ≤7d), attendance30d (green ≥85, amber ≥65, rose <65), check-in adherence 4w, weight + 30d delta (older metric must be ≥21d old or delta=null — avoids misfire), next session. **Momentum pill** (`improving|stable|slowing|inactive|inconsistent`) — transparent rules: inactive (no session 14d+), inconsistent (≥2 no-shows 30d), slowing (completed30d < prev30d × 0.6 with prev≥3), improving (count up 20% OR weight delta toward primaryGoal OR ≥90% attendance). **Attention list** (max 6, severity-sorted critical→info): no_package, pkg_expired/expiring, sessions_low, payment pending, renewal/extension pending, inactive_long, noshow_recent, no/stale checkin, no/stale body, weight off goal-track — each clickable to jump to corresponding tab. **Recent changes** (last 14d, max 8): completed/missed sessions, check-ins, body metrics, coach notes — relative timestamps. New `client/src/components/admin/ClientCommandCenter.tsx` mounted at top of OverviewTab; existing 4 detail mini-cards preserved as deep-link entry points. TanStack Query `staleTime: 60_000`.

---

## Automation + Intelligence Ecosystem (Phase 5 — May 2026)

- **P5a Centralized Notifications** — `client_notifications` table (separate from `admin_notifications` trainer inbox). Channel-ready architecture: in-app active today; `channel_push` / `channel_email` + `push_sent_at` / `email_sent_at` columns scaffolded so future dispatchers can plug in without schema churn. Composite index `(user_id, read_at, created_at DESC)` for unread queries. Single dispatcher `server/services/notifications.ts → notifyUser(userId, kind, title, body, opts)` is the only entry point — best-effort, swallows errors so triggers can't block originating actions. Self-scoped routes `GET /api/me/notifications`, `GET /api/me/notifications/unread-count`, `POST /api/me/notifications/:id/read`, `POST /api/me/notifications/read-all` (userId always read from `req.user`, never from client input). Premium `NotificationsBell.tsx` mounted in `Navigation` for clients only — unread badge with 60s poll, mobile-first popover, deep-link support, optimistic mark-read + segmented `[LIST_PREFIX, params]` query keys so prefix invalidation works under `staleTime: Infinity`.

- **P5b Notification Triggers** — wired via `notifyUserOnce` (atomic dedupe) into: booking confirmation (`dispatchBookingNotifications`), admin cancel of someone else's booking, admin reschedule of date/time, attendance milestone on transition into `completed` for thresholds [5,10,25,50,100,200,365,500], 24h/1h cron in-app reminders (decoupled from email so users without email still get the in-app post), package expiry (7/3/1-day windows), missed weekly check-in (Mon-anchored ISO week, skip Mon). Atomicity: `client_notifications.dedupe_key` text column + partial `UNIQUE INDEX (user_id, kind, dedupe_key) WHERE dedupe_key IS NOT NULL`; `createClientNotificationOnce` uses raw SQL `ON CONFLICT (user_id, kind, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING RETURNING ...` — Drizzle's `onConflictDoNothing({target:[...]})` doesn't emit the predicate so the arbiter wouldn't match the partial index. Schema parity: indexes also declared inline in `shared/schema.ts`.

- **P5c Premium Analytics Dashboard** — `GET /api/admin/analytics` returns snapshot KPIs (clients active/frozen/new30d, sessions completed30/90d + attendanceRate30d + noShowRate30d + upcomingNext7d, packages active/expiringSoon/expired/frozen + renewals30d, revenue total/paid30d/outstanding, retention multiPackageClients + churn30/60/90d, weekly check-in adherence) and 12-month trend buckets (revenueByMonth paid+total, completedByMonth, signupsByMonth, bookingsByDow). DOW counts ALL non-cancelled bookings (upcoming/confirmed/completed/no_show/late_cancelled) so demand shape isn't skewed by attendance. Adherence uses single bulk SQL `SELECT COUNT(*) FROM weekly_checkins WHERE user_id = ANY($1::int[]) AND week_start >= $2::date` (no N+1). New `AdminAnalytics.tsx` page mounted at `/admin/analytics` with recharts (Line/Bar/Pie), animated count-up KPI cards, circular adherence ring, churn signals card. New 'Analytics' tab added to `ADMIN_TABS`.

- **P5e Premium Transformation Gallery (May 2026)** — new public page at `/transformations` (`client/src/pages/TransformationsGallery.tsx`, route added to `App.tsx`). Reuses existing `transformations` table + `/api/transformations` endpoint + `useTransformations` hook — **zero schema/route changes**. Self-contained `PublicCompareSlider` (pointer events: mouse + touch + pen, ARIA `role=slider` with valuemin/valuemax/valuenow, keyboard arrow nudge ±5%, `clip-path: inset(0 X% 0 0)` overlay) embedded in every `GalleryCard`. Goal filter chips auto-derived from data (only render when ≥2 distinct goals). `FullscreenModal` with body-scroll lock + Esc-to-close + click-outside dismiss + framer-motion enter/exit. Loading state uses the UX8 `.admin-shimmer` skeleton. Document.title updated for SEO. Homepage `<Transformations>` section now shows first 3 cards as teaser with "View gallery" pill in header + primary "View all N transformations" CTA at bottom when `data.length > 3`. All new strings use `t(key, fallback)` so no translation-file edits required for any of the 14+ supported languages.

- **P5g Performance Sprint (May 2026)** — two safe, measurable batches.
  **Batch 1 — route-level code splitting:** `client/src/App.tsx` converted from 30 eager `import`s to `React.lazy()` + `<Suspense fallback={<Loader/>}>`. Eager kept for critical path: `HomePage` (LCP for guests), `AuthPage` (auth funnel), `NotFound` (fallback). 28 other pages ship as on-demand chunks. **Initial JS: 3.6MB → 1.9MB (-47%)**. Per-page chunks: ClientDashboard 635K (recharts-heavy), LineChart vendor split 385K, AdminClientDetail 101K, most <50K. `vite.config.ts` untouched.
  **Batch 2 — fonts diet:** `client/index.html` was requesting **24 Google Font families**. Audit (`rg` across `client/src`) confirmed only `DM Sans` (--font-body) and `Plus Jakarta Sans` (--font-display) are actually used; `Inter` is a fallback string, `Outfit` was a HERO v6 leftover. Trimmed `<link>` to those 2 families with the weights actually used (400-700 / 400-800). Also removed the duplicate `@import` at the top of `index.css` that was pulling DM Sans + Outfit again as a second render-blocking CSS request. Result: ~150KB+ less woff2 on first paint, one font-CSS request instead of two, `display=swap` preserved (no FOIT, no CLS). HTML payload 13.17KB → 12.50KB.

---

## Admin UX Rebuild (May 2026)

Phased premium operating-system rebuild — Apple/Stripe/Notion clarity, mobile-first, no logic changes to auth/booking/packages/nutrition/supplements/notifications/analytics endpoints.

- **UX1 Design system primitives** — `client/src/components/admin/primitives.tsx` is the single source for the dark-luxury card pattern. Exports: `AdminCard`, `AdminPageHeader`, `AdminSectionTitle`, `AdminStatCard` (animated count-up via `useAdminCountUp`, format = int|percent|currencyAED|raw, hoisted `Intl.NumberFormat` instances to avoid per-frame allocations), `AdminAlertRow` (priority-tone tile with chevron), `AdminEmptyState`, `AdminChartCard` (consistent recharts wrapper). Tone tokens: `info | success | warning | danger | schedule | muted | default`. RTL-safe chevrons (`rtl:rotate-180`).

- **UX2 Home rebuild** — `AdminDashboard.tsx` anchored by `TodayHero` (large today-session count + date + 3 chips: upcoming/urgent/revenue30d). `revenue30d` from `/api/admin/analytics` (lazy `useQuery`, `staleTime: 60_000`, silent on fail — no extra round-trip beyond what existing pages do). Urgent-alerts strip (5 `AdminAlertRow` tiles: expiring/expired/pendingRenewals/pendingExtensions/lowSessionClients) only renders when `urgentCount>0`. KPI grid + upcoming-sessions list (with `AdminEmptyState` fallback) + tightened `QuickAction` rail (added Analytics quick-action). `AdminAnalytics.tsx` consumes the same primitives (StatCard + ChartCard + PageHeader + SectionTitle), eliminating duplicate count-up/StatCard/ChartCard implementations.

- **UX3 Global Search + Quick Add (⌘K palette)** — `client/src/components/admin/CommandPalette.tsx` built on shadcn `cmdk` Command/CommandDialog. Debounced (200ms) `useQuery(['/api/admin/search', q])` with `staleTime: 30s`, `enabled: open`. Always-visible **Create** group (5 quick adds linking `/admin/<route>?new=1` for client/booking/package/nutrition plan/supplement stack) sits above conditional **Search Results** groups (Clients/Bookings/Packages/Nutrition Plans/Supplement Stacks) which only render when `hasQuery && data.<group>.length > 0`, with always-visible **Jump to** nav at bottom. RTL-safe chevrons. Backend `GET /api/admin/search` (admin-only via `requireAdmin`) → `storage.searchAdmin(q, perCategory)` federated ILIKE across `users` (clients only — name/email/phone/username), `bookings` (date::text/timeSlot/notes/adminNotes), `packages` (name/type/notes), `nutritionPlans` (name/publicNotes), `supplementStacks` (name/description). Pattern is `%query%` with `%`/`_` escaped, query truncated 200 chars, `perCategory` clamped 1-20. Route batches client-name resolution via `Promise.all(storage.getUser(id))` over the union of userIds (no N+1 in storage). Response is field-sanitized (no password/token leakage). `useCommandPaletteShortcut(setOpen)` hook listens for ⌘K/⌃K (+ ⌘J/⌃J backup), wired in `Navigation.tsx` only when `user?.role === "admin"`. Visible ⌘K trigger button at top of admin sidebar (Linear/Stripe/Raycast pattern).

- **UX4 Navigation Overhaul (sidebar + mobile dock)** — `client/src/components/admin/AdminNavigation.tsx` exports `AdminSidebar`, `AdminMobileBottomNav`, `AdminMobileBottomSpacer`, and `buildAdminNavGroups(t)`. Sidebar reorganized into 7 collapsible groups (Overview · Clients · Coaching · Nutrition · Supplements · Financial · System) with localStorage persistence (`admin.sidebar.collapsed.v1`); a group force-expands when a child route is active so users always see where they are. Adds previously-missing `/admin/analytics` (under Overview) and `/admin/supplement-stacks` (under Supplements) to the sidebar. Premium active state: 2px primary `start-0` accent bar (RTL-safe) + soft `bg-primary/10` tint, `aria-current="page"`. Mobile bottom dock is a 5-slot fixed dock with a center elevated FAB that opens the ⌘K palette in create mode, "More" opens the sidebar in a slide-in drawer, `safe-area-inset-bottom` padding for iOS, and `AdminMobileBottomSpacer` reserves 64px so content never hides behind the dock.

- **UX5 Client Profile rebuild** — `AdminClientDetail.tsx` surgically refactored (sub-components preserved). New sticky `ClientHeader` (z-30 backdrop-blur, avatar + name + verified + status badge + 4 vital chips: goal/active package/sessions left/tier + horizontal-scroll quick-action pills row that jumps to tabs + `ClientStatusControl` in border-t section). `CLIENT_TABS` array drives a single horizontal-scroll TabsList in priority-of-use order: **Overview · Sessions · Nutrition · Supplements · Progress · Body Metrics · Check-ins · Notes · Documents · Payments · Health · Activity · Alerts**. Tabs is now controlled (`useState`) so quick-action pills can deep-link. `OverviewTab` rebuilt as command center: 4 mini-cards (Upcoming Sessions top-3 from `useBookings`, Active Package with progress bar/expiry/frozen badge, Latest Body Metric with weight delta vs prev/bf%/waist, Latest Weekly Check-in with 3 scale-aware `CheckinChip`s) — all clickable to jump to detail tabs. `CheckinChip` takes `max`+`suffix` props so `trainingAdherence` (0..100%) uses ratio-based thresholds (≥80% green, ≥50% amber) instead of false-flagging 75% as red. `activePackageOf` prefers status `active`/`expiring_soon` && !frozen, falls back to `isActive`.

- **UX6 Bookings/Calendar rebuild** — `AdminBookings.tsx` rebuilt as a premium scheduler. Subcomponents (`WorkoutLogButton`, `RescheduleButton`, `CreateBookingButton`) preserved. New: `AdminPageHeader` + 4 `AdminStatCard` KPIs (today / this-week / upcoming / completion-rate-30d, animated, single O(n) pass over bookings, `NON_CANCELLED_STATUSES` set so cancellations don't inflate density). New `CalendarWeekStrip` — Monday-anchored 7-day picker with per-day count badges (tone-shifts at ≥5), prev/next/Today buttons (Today only visible when today not in current week), `aria-pressed`, RTL-safe chevrons, click-to-toggle (re-selecting clears `dateFilter`). New `parseBookingDate(s)` helper parses `YYYY-MM-DD` as a LOCAL calendar day (avoids `new Date("…")` UTC shift). Filter bar adds search input (name/email/notes) alongside status/payment/workout selects + clear-all. List is now day-grouped (`DaySection`) with sticky headers + relative labels (Today/Tomorrow/Yesterday) + counts. Each `BookingRow` uses `AdminCard padded={false}` + internal padding, time tile splits AM/PM, RTL `ms-`/`me-`. `AdminEmptyState` for empty results. Mutations + override flags unchanged.

- **UX7 Tables/Lists rebuild** — Three admin list pages converted to the shared design system. **AdminClients.tsx**: `AdminPageHeader` + 4 `AdminStatCard` KPIs (total/verified/active-plan/sessions-remaining), filter bar in `AdminCard` with search + new `statusFilter` (clientStatus: active/frozen/cancelled/expired/completed/incomplete) + verified + package-type + clear-all (only when active) + inline `count / total` badge, desktop table wrapped in `AdminCard padded={false}` with `sticky top-0 z-10 backdrop-blur-md` header, new `SortHeader` subcomponent — sortBy=name|remaining|joined, sortDir asc|desc, click toggles dir / switches field (remaining defaults desc, others asc), `AdminEmptyState` for no-results, ms/me/start/end RTL classes throughout. **AdminPackages.tsx**: `AdminPageHeader` + 4 `AdminStatCard` KPIs + filter bar + `AdminEmptyState`. **AdminStaffPage.tsx**: `AdminPageHeader` with `right=Add admin Button` + 4 `AdminStatCard` KPIs + table wrapped in `AdminCard padded={false}` + `AdminEmptyState`. All mutations + AlertDialog confirm + full Dialog form preserved unchanged.

- **UX8 Premium polish pass** — unified loading experience across the admin surface. Added `AdminSkeleton` + `AdminSkeletonStack` primitives backed by a new `.admin-shimmer` utility (subtle diagonal cyan→white sweep via `::after` pseudo, `220% 100%` background, 1.6s `cubic-bezier(0.4,0,0.2,1)` infinite, `isolation:isolate` so it never repaints siblings). `prefers-reduced-motion` gated → animation off, opacity 0.4 fallback. Replaced 5 ad-hoc `bg-white/5 animate-pulse` skeletons (AdminClients, AdminPackages, AdminBookings, AdminAnalytics, AdminClientDetail) with the new system — same layout footprint, premium feel.

---

## Mobile UX Polish (May 2026)

Surgical responsive pass — no logic changes, no schema changes.

- **Mobile Layout System (root-cause fix)** — replaced ad-hoc admin-shell mobile padding + per-page `AdminMobileBottomSpacer` with a single-source-of-truth CSS layout system. New `:root` vars `--admin-top-h: 4rem` (top bar h-16), `--admin-dock-h: 3.5rem` (mobile dock h-14), `--admin-section-gap-mobile: 0.875rem`, `--admin-section-gap-tablet: 1.25rem`. `.admin-shell` mobile now `min-height: 100dvh` (dynamic viewport, avoids iOS URL-bar jank), `padding-top: calc(var(--admin-top-h) + env(safe-area-inset-top) + 0.25rem)` (notch + dynamic-island safe), `padding-bottom: calc(var(--admin-dock-h) + env(safe-area-inset-bottom) + 1.25rem)` (guarantees dock never overlaps content). `.admin-stack` rewritten to consume the section-gap vars at the `sm:640px` breakpoint. `AdminMobileBottomSpacer` deprecated to no-op (returns null) since `.admin-shell` reserves the room natively.
- **Premium AdminTabs segmentation** — active state went from solid bg-primary + heavy shadow to calmer `bg-primary/15 text-primary ring-1 ring-primary/30` segmented-control look. `rounded-lg → rounded-xl`, `px-3 → px-3.5`, removed `min-w-[84px]` equal-width forcing so tabs size to label. Container `mb-4 sm:mb-6 → mb-3 sm:mb-5`, border tone softened to `white/[0.06]`.
- **Currency switch EGP → AED** — three formatters (`AdminDashboard`, `AdminAnalytics`, `primitives`) renamed `FMT_EGP → FMT_AED` with `currency: "AED"`. `AdminStatCard` `format` prop now accepts `"currencyAED"` (preferred) and keeps `"currencyEGP"` as a deprecated alias mapping to the same AED formatter so any future stragglers don't break.
- **Tighter top spacing** — `.admin-shell` mobile `padding-top: 5rem → 4rem`, desktop `2rem → 1.5rem`, bottom `3rem → 2.25rem`. `AdminPageHeader` `mb-4 sm:mb-5 → mb-3 sm:mb-4`, eyebrow tracking softened, h1 `22→20px / 30→26px` with leading-[1.15], subtitle `12.5→12px / 14→13px`. Visual hierarchy now starts ~24-32px higher on mobile.
- **Calmer mobile bottom dock** — `h-16 → h-14` (56px). FAB `h-12 w-12, shadow-lg/30, -translate-y-3 → h-10 w-10, shadow-md/20, -translate-y-2.5` plus `ring-4 ring-card/95`. Dock icons `size 20 → 18`, label `text-[10px] → text-[9.5px]`. `AdminMobileBottomSpacer h-16 → h-14`.
- **AdminStatCard rebalance** — `min-h 92→84 / 108→100`, padding `p-3 sm:p-5 → p-3 sm:p-4`, value font `22→20 / 28→26` with `truncate` so long AED amounts never overflow the chip, label `text-xs → text-[11px]` with `min-w-0` parent so word-break works inside the tightened tile.
