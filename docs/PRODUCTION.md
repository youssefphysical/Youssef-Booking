# Production Operations Notes

Concise runbook for the booking-automation surface. Read this before touching cron, timezones, or deployment config.

## How auto-complete works

1. A booking has `date` (YYYY-MM-DD), `timeSlot` (HH:MM), and `durationMinutes` (default 60). Its end-time is computed as `Date(${date}T${timeSlot}:00+04:00) + durationMinutes`.
2. `runAutoCompleteBookings(source)` in `server/services/autoCompleteBookings.ts`:
   - Pulls all bookings (current dataset is small enough for an in-memory scan).
   - Filters to `status in ('upcoming','confirmed')` AND `completedAt IS NULL` AND `endTime <= now`.
   - Atomically claims each row with `UPDATE bookings SET status='completed', completed_at=now(), auto_completed_at=now() WHERE id=$1 AND status IN ('upcoming','confirmed') AND completed_at IS NULL RETURNING id` — first writer wins, exactly once.
   - For each claimed row with a `packageId` AND `packageSessionDeductedAt IS NULL`: increments package usage and stamps `package_session_deducted_at = now()`.
   - Sends ONE in-app notification per booking via `notifyUserOnce(userId, "system", `auto-complete-${id}`, …)` — dedupe key prevents duplicates across cron retries.
   - Updates an in-memory `lastRun = {at, source, result}` for `/api/admin/auto-complete-status`.
   - Always emits `[auto-complete:summary] {…}` as a single JSON line.

## Three trigger sources

| Source | Path | Fires |
|--------|------|-------|
| `cron` | GH Actions → `/api/cron/reminders` (and `/api/cron/auto-complete`) | Every 15 min |
| `backstop` | `GET /api/bookings` | Throttled to 60s, fire-and-forget on every authenticated read |
| `admin-manual` | Dashboard "Repair expired sessions now" button → `POST /api/admin/bookings/auto-complete-now` | On demand |

The backstop is the fail-safe: even if the cron is down for hours, the next time *anyone* loads their dashboard or admin loads the bookings list, the pass runs.

## Cron requirements (production / Vercel)

Two GitHub repository secrets are required for the scheduled cron to authenticate against the Vercel deployment:

- `PUBLIC_APP_URL` = `https://youssef-booking.vercel.app`
- `CRON_SECRET` = same value as the Vercel env var of the same name

Set them at: GitHub repo → Settings → Secrets and variables → Actions → New repository secret.

The workflow `.github/workflows/auto-complete.yml` runs every 15 minutes and posts to `/api/cron/reminders` with `Authorization: Bearer ${CRON_SECRET}`.

## Boot-time env validation

`server/app.ts → validateBootEnv()` runs on cold start and logs:

- `[boot] env OK (NODE_ENV=…)` on success
- `[boot:env-missing] <NAME> — <reason>` for each missing required var

Required (always): `DATABASE_URL`, `JWT_SECRET`. Production-only: `CRON_SECRET`, `PUBLIC_APP_URL`, `RESEND_API_KEY`.

## Timezone assumptions

- All bookings are anchored to **Asia/Dubai (UTC+4, no DST)**.
- The constant `+04:00` literal in `buildSessionDate` (server/routes.ts) and `buildSessionEndDate` (server/services/autoCompleteBookings.ts) is the single source of truth.
- Server clocks are in UTC. The `dubaiNow` field in `/api/admin/auto-complete-status` lets you visually confirm the offset.
- Do **NOT** convert to/from local time anywhere in booking code — always anchor to `+04:00`.

## Recovery procedure if cron stops

1. Check GitHub Actions tab → look at recent runs of "Booking auto-complete + reminders cron". Red? Click the run, check the curl error.
2. If GH Actions are green but the admin dashboard's "Last auto-complete" line still says "never" or hours ago:
   - Open Vercel dashboard → Logs → grep `[auto-complete:summary]`. If absent, requests aren't reaching the function.
   - Check `cronSecretSet` and `publicAppUrlSet` in `/api/admin/auto-complete-status` JSON response. Both must be `true`.
   - **Note:** `cronStale` is computed from `lastCronRunAt` only — backstop and admin-manual triggers do NOT reset it. This is intentional so a green button-click can't hide a broken external scheduler.
3. **Immediate stopgap:** as admin, click the "Repair expired sessions now" button on the dashboard. This runs the same pass synchronously and clears the backlog while you debug.
4. **Worst case:** the on-read backstop in `GET /api/bookings` will catch any expired booking the next time *anyone* loads the bookings list (admin or client). The system degrades gracefully — it never silently leaves a session stuck Forever.

## Anomaly logs to watch

Single-line JSON, prefixed for grep:

- `[booking:anomaly] {"kind":"past_slot",…}` — stale tab or curl bypass
- `[booking:anomaly] {"kind":"lead_time_too_short",…}` — within 6h of session
- `[booking:anomaly] {"kind":"slot_race",…}` — two clients booked the same slot, one lost. If frequent, consider pessimistic locking.
- `[auto-complete:summary] {…}` — every pass, always
- `[auto-complete:inspect] {…}` — first 5 rows per pass (or all rows if `AUTO_COMPLETE_DEBUG=1`)
- `[auto-complete:backstop] {…}` — only when the backstop actually completed something

## Safe admin workflow

- **Re-completing a session** is safe: `packageSessionDeductedAt` ensures the package credit only deducts once per booking, no matter how many times status flips.
- **Refunding a session** (admin marks completed → upcoming): the same stamp lets the system know whether to *return* a credit. Don't bypass `storage.updateBooking` or `storage.incrementPackageUsage` with raw SQL — you'll desync the deduction stamp.
- **Manual booking creation** (admin behalf-of-client): the partial UNIQUE INDEX `uniq_booking_active_slot` will reject a double-book even from admin. If you genuinely need to override, cancel the existing one first.
- **Auto-completed bookings** preserve `autoCompletedAt` — never null this field. The cyan "Auto" pill in the admin booking row reads from it.

## Data integrity guarantees

- `completedAt` and `autoCompletedAt` are stamped exactly once and intended to be immutable. The codebase never sets them back to NULL.
- `packageSessionDeductedAt` is the idempotency key for package-credit math. All four deduction sites check it before incrementing.
- The partial UNIQUE INDEX `uniq_booking_active_slot ON bookings(date, time_slot) WHERE status NOT IN ('cancelled','free_cancelled','late_cancelled','emergency_cancelled')` prevents two active bookings from existing for the same slot, even under simultaneous requests.

## Vercel redeploy checklist

1. Confirm `CRON_SECRET` and `PUBLIC_APP_URL` are still set in Project → Settings → Environment Variables for the Production environment.
2. After deploy, hit `/api/admin/auto-complete-status` (logged in as admin) and verify `env.cronSecretSet === true` and `env.publicAppUrlSet === true`.
3. Wait one cron tick (≤15 min) and confirm `lastRun.source === "cron"` and `cronStale !== true`.
4. If `lastRun` stays `null`: trigger the GH Actions workflow manually (Actions → Run workflow). If still null, the GH secrets are wrong.
