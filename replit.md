# Personal Training Service — Youssef Ahmed Booking Platform

### Overview
This project is a premium dark-luxury website for Youssef Ahmed Personal Training Service, a certified personal trainer in Dubai, UAE. It features a public profile, a private client booking system, and a comprehensive admin dashboard. The platform supports various training packages, InBody body-composition tracking with hybrid AI, progress photo uploads, and holiday/off-day management. The system aims to streamline operations for Youssef Ahmed, enhance client experience, and provide robust administrative control over bookings, client data, and content. The platform also includes extensive legal and consent mechanisms, ensuring compliance and data privacy.

### User Preferences
No explicit user preferences were provided in the original `replit.md` file.

### System Architecture

**UI/UX Decisions:**
- **Design:** Premium dark-luxury theme.
- **Branding:** Public-facing brand is "Personal Training Service" with "Youssef Ahmed" as the hero name and "Certified Personal Trainer | Physical Education Teacher | Movement & Kinesiology Specialist" as the subtitle.
- **Legal & Consent:** Dedicated pages for Privacy Policy, Terms & Conditions, Cancellation Policy, Medical Disclaimer, and Cookie Policy. Site-wide cookie consent banner with essential/analytics/marketing options. Registration uses ONE combined "I agree to Terms, Cancellation Policy, Privacy & Medical Disclaimer" checkbox — the underlying audit trail still writes all five consent records server-side. Per-upload InBody/progress consent records are stored and visible in the admin dashboard.
- **Premium Business Workflow (May 2026):** Packages now have explicit `startDate`, `expiryDate`, and computed `status` (active | expiring_soon | expired | completed). Bookings are blocked when the active package is expired or completed. Clients can submit Renewal Requests (pick a package type) and Extension Requests (extra days + reason) from the dashboard; both flows pop a prefilled WhatsApp message to Youssef Ahmed via `client/src/lib/whatsapp.ts`'s `buildWhatsappMessage()` helper. Admin endpoints exist at `/api/renewal-requests`, `/api/extension-requests`, and `POST /api/admin/{type}/:id/decision` for approve/reject; admin can also `POST /api/admin/packages/:id/extend`. Attendance is tracked via `PATCH /api/bookings/:id/attendance` with `attended | no_show | late_cancel`, automatically incrementing `users.noShowCount` for repeat offenders. Trainer-only `users.adminNotes` is editable via `PATCH /api/admin/clients/:id/admin-notes` and is **never** returned to non-admin clients (`sanitizeUser` strips it). Dashboard stats now also expose `expiringPackages`, `expiredPackages`, `pendingRenewals`, `pendingExtensions`, `lowSessionClients`. The platform does **not** include any Stripe/Tap/online checkout — every renewal/extension is confirmed manually by Youssef Ahmed after WhatsApp/payment.
- **Auth Flow:** Split into client login/create account and a hidden admin login (`/admin-access`). Auth inputs include explicit `name`, `id`, and `autoComplete` attributes for security.
- **Admin UI:** New `/admin/staff` page for staff management with role badges and permission grids. Admin client detail pages now include "Add manual session" and "Bulk add" buttons.

**Technical Implementations:**
- **Frontend:** React + Vite, Wouter for routing, TanStack Query v5 for data fetching, react-hook-form + Zod for form management, Tailwind CSS for styling, shadcn/ui for UI components, Framer Motion for animations, and lucide-react / react-icons for icons.
- **Backend:** Express.js for the API, Passport.js (local strategy with email-or-username) for authentication, express-session with a PostgreSQL store, and scrypt for password hashing. Multer is used for file uploads.
- **Database:** PostgreSQL managed with Drizzle ORM, using drizzle-zod for schema validation.
- **AI/Image Processing:** OpenAI Vision (gpt-5) for InBody metric extraction from images. `sharp` is used for image optimization (converting uploads to webp + thumbnail). AI extraction and image optimization are wrapped in `try/catch` to ensure uploads persist even if these processes fail.
- **Staff Management:** Role-based access control with Super Admin, Manager, and Viewer roles. Permissions are granular (23 keys across groups). Security guards (`requireSuperAdmin`, `requirePermission`) are implemented for API routes.
- **Membership Tiers:** Six tiers (Foundation, Starter, Momentum, Elite, Pro Elite, Diamond Elite) based on weekly training frequency, with associated benefits like protected cancellations, same-day adjustments, and priority booking. Tiers can be manually overridden.
- **Booking Rules:** Slots are hourly from 06:00 to 22:00. Slots can be taken by existing bookings or explicitly blocked (`blocked_slots` table) for whole days or specific times.
- **Package Lifecycle:** Bookings auto-link to active packages. Package usage (`usedSessions`) is atomically updated upon session completion or late cancellation.

**Feature Specifications:**
- **Public Website:** Hero section, about, certifications timeline, transformations gallery placeholder, WhatsApp contact button, editable cancellation policy page.
- **Client Area:**
    - **2-step registration (simplified):** Step 1 = account info (name/email/phone/password/area/weekly frequency). Step 2 = primary goal + optional notes + five required consent checkboxes. **No InBody or photo uploads at registration** — they were intentionally moved to the dashboard/profile so signup is friction-free.
    - **Dashboard:** Tabs for Bookings (upcoming/past, in-window cancel), Sessions (package progress), InBody (scans, history, new uploads), Progress (photo grid, new uploads). Header shows the user's avatar (`UserAvatar`) and a `VerifiedBadge` when applicable.
    - **Booking Page:** Calendar, hourly slot grid, notes, policy acceptance. Displays package balance.
    - **Profile Page (rewritten):** Instagram-style avatar with crop+pan editor, training-level pill buttons (beginner/intermediate/advanced), training-goal pill buttons (hypertrophy/strength/endurance), info form (name/phone/area), change-password card, and a link card pointing to the InBody section of the dashboard.
    - **Verified blue-check badge:** Shown next to a client's name across Navigation, ClientDashboard, AdminClients list and AdminClientDetail. A client is verified iff `profilePictureUrl` is set AND (≥1 InBody record OR ≥1 completed booking).
- **Admin Portal:**
    - **Dashboard:** KPIs (clients, bookings, packages), quick actions.
    - **Bookings Management:** Filter, status changes, reschedule, delete, manual booking.
    - **Clients List:** Search, contact, detailed client pages.
    - **Client Detail Page:** Tabs for Overview, Bookings, Packages, InBody, Progress. Add/remove packages, upload InBody/progress photos, edit extracted metrics.
    - **Packages:** Global view of active/closed packages.
    - **Settings:** Cancellation cutoff, WhatsApp number, profile photo/bio, blocked time slots with `blockType` (off-day, emergency, fully-booked).
- **Session Types & Payment:** Supports `package`, `single`, `trial`, and `duo` sessions. Payment statuses include `paid`, `unpaid`, `pending`, `direct_payment_requested`, `free`.
- **Emergency Cancel:** One free late cancellation per month per client, overriding cutoff window, recorded as `emergency_cancelled`.

### External Dependencies
- **OpenAI:** Used for InBody Vision extraction (gpt-5).
- **PostgreSQL:** Primary database for all application data.
- **WhatsApp:** Integrated for client communication and direct payment confirmations.

### Profile Picture Pipeline (works on Replit and Vercel)
- Endpoint: `POST /api/users/:id/profile-picture { imageDataUrl }`. Owner-or-admin only.
- Server decodes the base64 data URL, enforces a 6 MB decoded ceiling, then runs `sharp` with `limitInputPixels: 24_000_000` (anti pixel-bomb), auto-rotates from EXIF, resizes to a 256x256 cover-cropped square, and re-encodes as WebP (quality 75).
- The resulting `data:image/webp;base64,...` string is stored directly in `users.profile_picture_url`. **No filesystem dependency** — this is what lets profile pictures keep working on Vercel's read-only filesystem (unlike `/uploads` which requires object storage).
- `DELETE /api/users/:id/profile-picture` clears the column, which also drops the `isVerified` flag.
- Client-side cropping happens in `ProfilePictureCropper` (canvas + drag-to-pan + zoom slider, no extra deps) before the data URL is sent. The same picture is rendered everywhere via the shared `UserAvatar` component.

### Vercel Deployment Scaffolding (additive — Replit still primary)
- `server/app.ts` exposes `createApp()` which builds the Express app **without** calling `listen`. `server/index.ts` (Replit) wraps it and starts the listener; `api/index.ts` (Vercel) wraps it as a serverless handler.
- `vercel.json` rewrites `/api/*` → `/api/index.ts` and everything else → `/index.html`; build command is `vite build`, output `dist/public`.
- `GET /api/health` returns `{ ok: true, env: "replit" | "vercel" }` — easy environment probe.
- **Database (Vercel):** A separate Neon Postgres project (eu-central-1, pooled endpoint `ep-curly-dream-ali5mvn2-pooler`) is wired in via `DATABASE_URL` on Vercel (production + preview, marked Sensitive). Schema is pushed with `DATABASE_URL=<neon> npm run db:push -- --force`. Replit continues to use its built-in `helium` Postgres for development; the two databases are independent. Tables verified on Neon: `users`, `bookings`, `inbody_records`, `consent_records`, `packages`, `blocked_slots`, `progress_photos`, `settings`.
- **Production live URL:** `https://youssef-booking.vercel.app` — `/api/health`, registration (`POST /api/auth/register`), login (`POST /api/auth/login`) and `/api/auth/me` all verified end-to-end against Neon.
- **Caveat:** InBody and progress-photo uploads still write to local `/uploads`. Those will require object storage (Replit Object Storage, S3, R2, etc.) before Vercel can serve them. Profile pictures are unaffected (base64 in DB).

### Verified-Badge Performance
- `/api/users` (admin client list) uses `sanitizeAndEnrichMany` which calls `storage.getVerificationFlagsForUsers(ids)`. That helper issues exactly two grouped `SELECT ... GROUP BY user_id` queries (one against `inbody_records`, one against completed `bookings`) instead of 2*N per-user fetches. Empirically the full list (11 clients) returns in ~10ms.
### TRON-Quiet Polish Pass (May 2026, latest)
- **Glow intensity dialled down ~30 % globally** so the homepage reads as premium-quiet instead of arcade-flashy:
  - `.tron-cta` resting glow: `0 0 28px / 0.55` → `0 0 20px / 0.40`. Hover glow: `0 0 56px / 0.85` → `0 0 40px / 0.60` (mid layer), `0 0 100px / 0.45` → `0 0 70px / 0.30` (outer bloom).
  - `@keyframes tronPulse` peak: `0 0 22px / 0.7` → `0 0 16px / 0.50` (Apple-notification feel, not marquee).
  - `@keyframes tronCtaBreathe` peak: `0 0 42px / 0.82` → `0 0 30px / 0.55` to match the new quieter `.tron-cta` baseline. Mobile still gated off so scroll stays silky.
- **Apple/Tesla hover micro-interaction**: `.tron-cta:hover` now does `translateY(-1px) scale(1.03) translateZ(0)`. translateZ(0) added to the resting state too so the GPU layer is established up-front and the scale is silky. Transitions tightened (box-shadow 360 → 320 ms, filter 220 → 200 ms).
- **Hero copy reveal snappier**: HeroSlider stagger duration `0.55s → 0.4s` per spec. Reads as alive without dragging.
- **Profile photo on HomePage**: `<img>` now has `decoding="async"` so the decode runs off the main thread. NOTE: deliberately did NOT add `loading="lazy"` — this image sits in the second-screen "About Youssef" grid that can be partially visible on tall desktops, so lazy could regress LCP. Bottom overlay reduced ~35 % (`from-black/85` → `from-black/55`) so the photo reads brighter while the certification badges still have enough contrast.
- **Auth UI is intentionally untouched** — the permanent static Sign-In link from commit `015eed5a` (rendered unconditionally with `zIndex: 9999, opacity: 1, pointerEvents: auto`) remains the single source of truth for auth entry.

### Hero Decorative-Strip + Header Z-Lock (May 2026, latest)
- **Root cause for "Sign In looks hidden / image looks dull"**: the hero used to stack EIGHT pointer-events:none decorative layers on top of the photo (`.tron-spotlight`, `.tron-shaft`, `.tron-grid`, `.tron-vignette`, two animated `.tron-beam` dividers, `.hero-subject-glow` radial, `.hero-isolate::after` rim light) plus a left-side horizontal navy hold gradient. Each painted on every scroll + Ken-Burns frame, and collectively (a) made the photo read as hazy/washed-out and (b) raised the visual density near the top-right corner enough that the Sign-In CTA blended into the gradient pad on mobile.
- **Fix**: deleted all 8 decorative layers + the horizontal hold. The hero now stacks: bokeh background image + sharp foreground image + ONE single linear bottom-up overlay `linear-gradient(to top, hsl(220 60% 4% / α) 0%, transparent 55%)` where α scales with the admin `overlayOpacity` slider (0..60 % darkness budget). Upper 45 % of every photo is completely untouched.
- **Cinematic grade dialled UP** (now possible because there are no dimming layers stacked on top): `.hero-img` filter is `contrast(1.12) brightness(1.08) saturate(1.10) hue-rotate(-5deg)`; HeroSlider `sharpStyle` re-aligned to multiply admin brightness/contrast onto the same 1.12/1.08 baseline.
- **Header always-on-top**: z-index 50 → `z-[100]`, new `relative z-[110]` wrapper around the auth area (LanguageSelector + Sign-In) as belt-and-braces, `padding-top: env(safe-area-inset-top)` so the iOS notch/Dynamic Island never overlaps the brand.
- **Body scroll**: `overscroll-behavior-y: none` → `overscroll-behavior: contain` per spec — preserves pull-to-refresh, still prevents propagation to browser chrome.
- **Net perf win**: 8 fewer compositor layers per hero slide. First hero img already had `loading="eager"` + `fetchpriority="high"`, others lazy.

### Hero Clarity + Perf Pass (May 2026)
- Cinematic baseline filter on `.hero-img` softened from `contrast(1.12) brightness(1.08) saturate(1.12) hue-rotate(-6deg)` to `contrast(1.08) brightness(1.05) saturate(1.10) hue-rotate(-5deg)` so the photo's own micro-contrast carries the image instead of being crushed by the grade. The HeroSlider inline filter chain (`sharpStyle`) restates the same baseline so admin tuning still multiplies onto it.
- `.hero-img-blur` blur dropped 14px → 10px and grade eased so masked edges read as "soft" not "smeared". `.hero-img-mask` radial widened from 32%/55%/92% to 40%/62%/95% so the subject area stays razor-sharp for noticeably longer before the bokeh takes over.
- Bottom navy gradient multipliers re-tuned from (2.45 / 1.57 / 0.51) to (1.85 / 0.92 / 0.20) so the default `overlayOpacity=35` now maps to ~0.65 alpha at the bottom edge and effectively transparent above 50%, keeping the upper half of the photo (where the subject lives) clear.
- Explicit `transform: translateZ(0)` on `.hero-img` and appended `translateZ(0)` to both inline transforms in HeroSlider so admin slider updates can never accidentally drop the GPU layer.
- Header (`Navigation.tsx`): z-index 40 → 50 (auth area always wins stacking), mobile backdrop-blur removed entirely (real paint cost on mid-range Android), kept lighter desktop-only blur. Mobile bg opacity raised 85% → 95% so the header stays readable without blur.
- `body` now sets `-webkit-overflow-scrolling: touch` (rescues older in-app browsers that strip Safari's default) and `overscroll-behavior-y: none` (kills the rubber-band layout shift at the top of the page on Chrome Android — desirable on a public marketing site).
- Auth UI in `Navigation.tsx` is intentionally unchanged from Part 1: `isAuthenticated = Boolean(user)` and `shouldShowSignIn = !isAuthenticated`, no early return null, no dependency on loading/status. `ProtectedRoute` in `App.tsx` is intentionally preserved — it's page-level authorization for `/admin` and `/dashboard`, NOT auth UI; removing its early return would expose admin pages to anonymous visitors.

### Per-Image Hero Display Tuning (May 2026)
- `hero_images` has 7 nullable display-tuning columns (`focal_x`/`focal_y` -200..200 px, `zoom` 0.8..2.0, `rotate` -10..10 deg, `brightness` 0.9..1.2, `contrast` 0.95..1.2, `overlay_opacity` 0..60). Added additively in `server/ensureSchema.ts` with identity defaults so existing rows backfill safely. Zod ranges in `updateHeroImageSchema` (shared/schema.ts) match the slider min/max in AdminSettings → HeroSlideEditor exactly so the homepage cannot be visually broken.
- `HeroSlider.tsx` applies tuning at render time as a single composed inline `transform` (translate/scale/rotate) + `filter` (multiplied against the cinematic baseline `contrast(1.12) brightness(1.08) saturate(1.12) hue-rotate(-6deg)`) on **both** the sharp foreground and the blurred bokeh copy, so the depth-of-field seam tracks the subject. The bottom navy gradient stops scale by `overlay_opacity / 35` so 35 = original look, 0 = clear, 60 = much darker.
- Admin UI: HeroSlideEditor has a live preview tile + 7 sliders + "Reset to defaults" link. 10 new `admin.settingsPage.heroTuning*` keys translated across all 10 supported languages.
- `.hero-img` and `.hero-img-blur` get `image-rendering: auto` + `backface-visibility: hidden` + `will-change: transform` so the slide stays on a stable GPU compositor layer through Ken Burns + per-image tuning + cross-fade.

### Schema Self-Heal on Boot (May 2026 emergency recovery)
- `server/ensureSchema.ts` runs ONCE per cold start (cached promise) before any route is registered. Pure additive `IF NOT EXISTS` DDL — safe to re-run forever, idempotent on every boot. Never destructive.
- Why: prod Neon and dev's `helium` Postgres are independent. The May-2026 premium-business migration (`no_show_count`, `admin_notes`, `start_date`/`expiry_date`/`status`, attendance audit fields, `renewal_requests`, `extension_requests`, `password_reset_token`/`password_reset_expires`) was pushed to dev only; prod cold-started with `bootstrapError: column "no_show_count" does not exist`. ensureSchema fixes that automatically on first request after deploy.
- `/api/_debug` exposes `bootstrapError` so this class of failure is one curl away.

### Forgot-Password Reset Flow
- `POST /api/auth/forgot-password` — generates a 32-byte random token, stores its sha256 hash + 30-min expiry on the user, emails a reset link via Resend (`sendPasswordResetNotification`). Always returns the same friendly message regardless of whether the email exists (no enumeration). Reset URL origin comes from `PUBLIC_APP_URL` env (or hardcoded `youssef-booking.vercel.app` in production) — host headers are NOT trusted, blocking host-header poisoning phishing.
- `POST /api/auth/reset-password { token, password }` — atomic `UPDATE ... WHERE token=hash AND expires>now() RETURNING id` via `storage.consumePasswordResetToken`, so concurrent requests cannot double-consume a token. Min password length 6.
- `client/src/pages/ResetPassword.tsx` (route `/reset-password?token=...`) — reads the token once on mount, immediately scrubs it from the URL via `history.replaceState`, then submits new password + confirm.
- Sanitizers (`sanitizeUser`, `sanitizeUserAdminView`) strip `passwordResetToken`/`passwordResetExpires` so they can never leak through `/api/auth/me` or admin user lists.
- Rate limiter prefers Express's resolved `req.ip` (with `trust proxy: 1` set in production) over the raw `X-Forwarded-For` header to make spoofing harder.
