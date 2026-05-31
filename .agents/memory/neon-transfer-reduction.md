---
name: Neon transfer reduction
description: Techniques applied to cut Neon DB network transfer; what was done and why, so future work stays consistent.
---

## getBookings() filter discipline (highest-impact rule)
Never call `storage.getBookings({})` or `storage.getBookings()` without a `from` filter in any route that is called frequently (cron, admin polling). Always scope to the minimum date window needed.

**Why:** `getBookings()` with no filter does a full table scan. A gym with 12 months of history has 3,000-6,000 rows at ~1.5KB each = 4.5-9MB per call. The cron runs every 15 min (96 calls/day) — that alone was the single largest Neon transfer source (~1.5-3 GB/month).

**Approved filter windows (as of May 2026):**
- **`/api/cron/reminders`** → `{ from: todayIso }` — reminder windows are 22-26h and 30-90min; today+tomorrow only (~10-30 rows)
- **`/api/admin/analytics`** → `{ from: cutoff180d }` — covers deepest churn window (churn90d) with buffer
- **`/api/admin/dashboard-stats`** → `{ from: monthStartStr }` — all stats are within-month calculations
- **`/api/admin/auto-complete-status`** → `{ from: thirtyDaysAgo }` — pendingExpired can't be older than 30d in practice
- **Client bookings** → always has `{ userId }` filter already

**Rule for new endpoints:** pick the narrowest `from` date that satisfies the endpoint's queries. Document the window in a comment next to the call.

## GET /api/settings blob strip
Three columns are stripped from the GET /api/settings response in the route handler: `nutritionOriginalUrl`, `nutritionMobileUrl`, `nutritionThumbnailUrl`. They are pipeline intermediates written by the media processor but never rendered anywhere in the front-end. In production these can total 1.75 MB per call.

**Why:** The settings row is fetched by 20+ components. nutritionOriginalUrl alone was 1.65 MB of uncompressed base64. Stripping just these three columns drops the response from ~2.7 MB to ~957 KB without breaking any rendered UI.

**How to apply:** If a new media pipeline column is added to the settings table and is never rendered in the front-end, add it to the destructure-strip list in the GET /api/settings handler in routes.ts. Do NOT strip columns that are rendered by the homepage (profilePhotoUrl, personalTrainingImageUrl, nutritionImageUrl, supplementImageUrl, logoIconUrl).

## Production-safe response size alert
`server/app.ts` fires `console.warn([perf-alert])` for any API response ≥ 1 MB in any environment (path + size only, no content). Dev threshold is still 200 KB.

## GET /api/settings is still ~957 KB
Remaining base64 blobs: profilePhotoUrl (316 KB), nutritionImageUrl (199 KB), supplementImageUrl (187 KB), personalTrainingImageUrl (144 KB), logoIconUrl (108 KB). These ARE rendered by the homepage and cannot be stripped without breaking those images. The long-term fix is to run the brand migration and store them as file URLs — but Vercel serverless has a read-only filesystem so `runBrandFileMigration()` via `setImmediate` never completes. Until images are moved to external storage (S3/Cloudinary), the ~957 KB per cold-start settings fetch is unavoidable.

## getAllClientsLight() rule
getAllClientsLight() must be used for every bulk admin route that does NOT need to render profile pictures or auth fields.

**Why:** The `users.profilePictureUrl` column holds base64-encoded JPEG/WebP (up to ~900KB each). When `/api/admin/analytics`, `/api/dashboard/stats`, `/api/admin/daily-brief`, `/api/admin/broadcast`, and similar routes called `getAllClients()`, every client's photo was transferred from Neon on every request — easily 5-50MB per page load for a real user base.

**How to apply:**
- `getAllClientsLight()` in `server/storage.ts` uses Drizzle's `getTableColumns` to destructure and omit `profilePictureUrl`, `password`, `passwordResetToken`, `passwordResetExpires`.
- Use it for: analytics, stats, daily-brief, broadcast, missed-checkin, command-center, any "list all clients" route where photos are not rendered.
- Keep `getAllClients()` only for: `/api/users` (admin edit panel, needs all fields) and `/api/admin/clients/pending`.
- When adding a new bulk admin endpoint, default to `getAllClientsLight()` unless you specifically need the omitted fields.

## Server-side stats cache
`routes.ts` has a module-level `_statsCache` (Map) with 60s TTL helpers `_getCached`/`_setCached`/`invalidateStatsCache`. Both `/api/dashboard/stats` and `/api/admin/analytics` check the cache before running DB queries.

**Why:** Both endpoints scan bookings + packages + users. Repeated navigation between admin pages caused redundant full-table scans per page load.

**How to apply:**
- Cache key `"dashboard-stats"` for `/api/dashboard/stats`, `"admin-analytics"` for `/api/admin/analytics`.
- TTL is 60 seconds (matches client staleTime).
- If a future mutation should bust the cache immediately, call `invalidateStatsCache()` (exported from `routes.ts`).

## Polling reductions applied (client-side)
- featureFlags: 5min (was 30s), staleTime 60s
- useBookings: 3min (was 60s), no refetchOnWindowFocus
- AdminPackages: 5min (was 30s), staleTime 30s, no refetchOnWindowFocus
- SmartAlertsPanel: polls at 60s ONLY on /admin, /admin/business-health, /admin/analytics; disabled elsewhere
- AdminCommandCenter: 5min (was 60s)
- AdminDashboard auto-complete: 2min (was 30s)
- StreakStrip + AchievementsSection: removed refetchOnWindowFocus

## DB indexes added (ensureSchema.ts)
`users_role_idx`, `users_client_status_idx`, `packages_status_sessions_idx` — already-present: `bookings_user_id_idx`, `packages_user_id_idx`, `client_notifications_user_unread_idx`.

## Dev logging
`server/app.ts` request logger warns (dev only) when any API response exceeds 200KB, to surface remaining blob leaks early.
