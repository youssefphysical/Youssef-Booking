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
