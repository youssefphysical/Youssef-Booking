# Personal Training Service — Youssef Ahmed Booking Platform

A premium dark-luxury website for **Youssef Ahmed Personal Training Service**, a certified personal trainer in Dubai, UAE. Public profile + private client booking system + full admin dashboard, with packages, InBody body-composition tracking (hybrid AI), progress photos, and holiday/off-day management.

Legal & consent: dedicated Privacy Policy, Terms & Conditions, Cancellation Policy, Medical Disclaimer, and Cookie Policy pages; site-wide cookie consent banner (essential/analytics/marketing); 5 required registration consents + per-upload InBody/progress consent; consent records stored in `consent_records` and visible per client in the admin dashboard.

Public-facing brand: **Personal Training Service** (top nav) · Hero name: **Youssef Ahmed** · Subtitle: **Certified Personal Trainer | Physical Education Teacher | Movement & Kinesiology Specialist**

The legal name "Youssef Tarek Hashim Ahmed" appears only on the bank-transfer details inside the private direct-payment flow (it is the actual account holder for IBAN AE230260001015917468101) — never on public pages.

## Recent stability fixes (Apr 2026)
- Registration + InBody upload no longer crashes / kicks the user out mid-flow. The auth page now suppresses its auto-redirect via a `submitting` flag and shows a staged status indicator (Creating account → Uploading InBody → Finalizing) before navigating to `/dashboard`.
- AI extraction (OpenAI Vision) and image optimization (sharp → webp) on InBody and progress uploads are wrapped in try/catch — registration and uploads always persist even when AI/sharp fail.
- `seedDatabase` now force-cleans the legacy seeded `profile_bio` (only when it still starts with one of the known legacy prefixes) without clobbering an admin-customized bio.
- `PhoneInput` ships with the full ITU country list (~240 entries) with paste detection (`+44 7700…` / `00`-prefixed numbers), default UAE +971.
- Auth page split into Client Login / Create Account / Admin login with smaller inline error styling.
- Single primary WhatsApp button on the home page (hero + CTA), removed duplicate ContactRow blocks.
- Admin login: `admin` / `change-this-password`. Set `RESEED_ADMIN=1` env var to force-reset the admin password on next startup if it was accidentally changed.

## Features

### Public
- Hero, about, certifications timeline (REPs UAE, EREPS Level 6, IATD, etc.)
- Transformations gallery placeholder
- WhatsApp contact button (fixed `https://wa.me/971505394754` by default; configurable)
- Cancellation policy page (default 6 hours, editable in admin settings)

### Client Area (after register/login)
- **2-step registration**: Account info (name/email/phone/password/area/emergency contact) → Health info (REQUIRED InBody upload + OPTIONAL progress photo + goal + notes)
- **Dashboard with tabs**:
  - **Bookings** — upcoming + past sessions, in-window cancel button
  - **Sessions** — all session packages with remaining/used progress bar (Duo packages flagged)
  - **InBody** — latest scan card with metrics + history; upload new scans (image or PDF)
  - **Progress** — chronological photo grid; upload new photos
- Booking page with calendar, hourly slot grid (06:00–22:00), notes, policy acceptance
  - Friendly whole-day "unavailable" notice with type-specific copy (off-day / emergency / fully-booked)
  - Active package balance shown before submission; admin sees override notice
- Profile page (update info, change password, contact Youssef on WhatsApp)
- Cancellations within the cutoff window are locked; clients are directed to WhatsApp for emergencies

### Admin Portal (`/auth` → "Admin login")
- Dashboard with KPIs (clients, upcoming, today, completed-this-month, active packages) and quick actions
- Bookings management: filter, status changes (incl. `late_cancelled`), reschedule, delete, manual booking on behalf of client
- Clients list with search, contact actions; each card links to a full client detail page
- **`/admin/clients/:id`** — Tabs: Overview / Bookings / Packages / InBody / Progress
  - Add/remove session packages (with Duo partner picker)
  - Upload InBody scans for the client; edit any extracted metric inline
  - Upload/delete progress photos
- **`/admin/packages`** — global view of every active/closed package across clients, with search and filter
- Settings: cancellation cutoff hours, WhatsApp number, profile photo URL, profile bio
  - **Blocked time slots** with `blockType` selector for whole-day blocks (off-day / emergency / fully-booked); type-colored badges in the list

### AI / Uploads
- Multer disk storage in `uploads/inbody/` and `uploads/photos/`; Express serves `/uploads`
- OpenAI Vision (gpt-5) extracts InBody metrics from uploaded images
  - Graceful fallback if `OPENAI_API_KEY` is missing or extraction fails — record is still created so Youssef can fill numbers manually
  - PDFs are stored as-is and require manual entry

### Package Lifecycle
- Booking POST auto-links the user's active package (admin can `override`)
- Booking PATCH transitioning into `completed` or `late_cancelled` increments `usedSessions`; transitioning out decrements

## Tech Stack
- **Frontend**: React + Vite, Wouter, TanStack Query v5, react-hook-form + Zod, Tailwind, shadcn/ui, Framer Motion, lucide-react / react-icons
- **Backend**: Express, Passport (local strategy with email-or-username), express-session (PG store), scrypt password hashing, multer
- **AI**: OpenAI (gpt-5) for InBody Vision extraction
- **Database**: PostgreSQL via Drizzle ORM (drizzle-zod for schemas)

## Data Model (`shared/schema.ts`)
- `users` — id, username, password (hashed), fullName, email, phone, role, **area**, **emergencyContactName**, **emergencyContactPhone**, fitnessGoal, notes, createdAt
- `packages` — id, userId, **partnerUserId** (Duo), type (`10`|`20`|`25`|`duo30`), totalSessions, usedSessions, isActive, notes, purchasedAt
- `bookings` — id, userId, **packageId**, date, timeSlot, status (`upcoming`|`confirmed`|`completed`|`cancelled`|`free_cancelled`|`late_cancelled`), notes, createdAt, cancelledAt
- `blocked_slots` — id, date, timeSlot (nullable = whole day), **blockType** (`off-day`|`emergency`|`fully-booked`), reason, createdAt
- `inbody_records` — id, userId, fileUrl, fileName, mimeType, weight, bodyFat, muscleMass, bmi, visceralFat, bmr, water, score, aiExtracted, notes, recordedAt
- `progress_photos` — id, userId, photoUrl, type (`before`|`current`|`after`), notes, recordedAt
- `settings` — id, cancellationCutoffHours (default 6), profilePhotoUrl, profileBio, whatsappNumber

## Default Credentials (seeded on first start)
- **Admin** — username: `admin` / password: `change-this-password`
  - Change immediately in production via the profile/settings flow.

## Routes
- `/` Public homepage
- `/auth` Combined client/admin auth (2-step register for clients, primaryGoal Select)
- `/policy` Cancellation policy
- `/direct-payment` Bank account details + WhatsApp confirmation (gated when admin disables public visibility)
- `/book` Booking (with Session Type selector: Package / Single / Free Trial / Duo)
- `/dashboard`, `/profile` Client area
- `/admin`, `/admin/bookings`, `/admin/clients`, `/admin/clients/:id`, `/admin/packages`, `/admin/settings` Admin area

## Session Types & Payment
- `package` — auto-paid, deducts a session on completion
- `single` — pay-per-session, defaults to `unpaid`; clients see Direct Payment link
- `trial` — free trial, one-per-lifetime via `users.hasUsedFreeTrial`; admin can reset
- `duo` — paid, requires admin to assign duo package
- Payment statuses: `paid`, `unpaid`, `pending`, `direct_payment_requested`, `free`

## Emergency Cancel
- One free late-cancellation per calendar month per client (`users.emergencyCancelLastMonth = "YYYY-MM"`)
- Overrides the cancellation cutoff window; status saved as `emergency_cancelled` (no package deduction)
- Admin can reset via Client Detail → Privileges card

## Booking Rules
- Slots: every hour from 06:00 to 22:00 (17 slots/day)
- A slot is **taken** if a non-cancelled booking exists for that date+time
- A slot is **blocked** if `blocked_slots` matches `(date, timeSlot)` or has a whole-day row (`timeSlot IS NULL`)
- Whole-day blocks cause the booking POST to return `400` with `{ message, blockType, code: "WHOLE_DAY_BLOCKED" }`; the UI surfaces a friendly type-specific notice
- Clients can cancel only if the session start is at least `cancellationCutoffHours` away. Admins can override.

## Running
- `npm run dev` (workflow `Start application`) — runs Express + Vite on port 5000
- `npm run db:push -- --force` — sync schema after `shared/schema.ts` changes (drop `session` table first if shape changes)

## Environment
- `DATABASE_URL` — Postgres connection (provided)
- `SESSION_SECRET` — session signing secret (provided)
- `OPENAI_API_KEY` — optional; enables InBody auto-extraction. Without it, scans are saved and manual entry is used.

## Notes
- All API contracts live in `shared/routes.ts`
- Frontend hooks: `use-auth`, `use-bookings`, `use-settings`, `use-blocked-slots`, `use-clients`, `use-packages`, `use-inbody`, `use-progress`
- Booking utilities: `client/src/lib/booking-utils.ts`
- WhatsApp helper: `client/src/lib/whatsapp.ts`
- AI extraction logic: `server/ai/inbody-extract.ts` (returns `null` when key missing or parse fails)
- Image optimization: `server/image-utils.ts` uses `sharp` to convert InBody/photo uploads to webp + thumbnail
- Workout log: bookings carry `workoutCategory`, `adminNotes`, `clientNotes`; admin manages via the Log dialog in `/admin/bookings`
- Bank settings: `settings.bankAccountName` / `bankIban` / `showBankDetailsPublicly` defaults to Youssef's IBAN, hidden from logged-out visitors by default
