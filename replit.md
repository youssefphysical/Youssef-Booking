# Personal Training Service — Youssef Ahmed Booking Platform

### Overview
This project is a premium dark-luxury website for Youssef Ahmed Personal Training Service, a certified personal trainer in Dubai, UAE. It features a public profile, a private client booking system, and a comprehensive admin dashboard. The platform supports various training packages, InBody body-composition tracking with hybrid AI, progress photo uploads, and holiday/off-day management. The system aims to streamline operations for Youssef Ahmed, enhance client experience, and provide robust administrative control over bookings, client data, and content. The platform also includes extensive legal and consent mechanisms, ensuring compliance and data privacy.

### User Preferences
No explicit user preferences were provided in the original `replit.md` file.

### System Architecture

**UI/UX Decisions:**
- **Design:** Premium dark-luxury theme.
- **Branding:** Public-facing brand is "Personal Training Service" with "Youssef Ahmed" as the hero name and "Certified Personal Trainer | Physical Education Teacher | Movement & Kinesiology Specialist" as the subtitle.
- **Legal & Consent:** Dedicated pages for Privacy Policy, Terms & Conditions, Cancellation Policy, Medical Disclaimer, and Cookie Policy. Site-wide cookie consent banner with essential/analytics/marketing options. Five required registration consents and per-upload InBody/progress consent, with records stored and visible in the admin dashboard.
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