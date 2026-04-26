# Youssef Tarek — Personal Trainer Booking Platform

A premium dark-luxury website for **Youssef Tarek Hashim Ahmed**, a certified personal trainer in Dubai, UAE. The site combines a public profile/portfolio with a private client booking system and a full admin dashboard.

## Features

### Public
- Hero, about, and certifications timeline (REPs UAE, EREPS Level 6, IATD, etc.)
- Transformations gallery placeholder
- WhatsApp contact button (fixed `https://wa.me/971505394754` by default; configurable)
- Cancellation policy page (default 6 hours, editable in admin settings)

### Client Area (after register/login)
- Dashboard listing upcoming and past sessions with cancel button
- Booking page with calendar, hourly slot grid (06:00–22:00), notes, and policy acceptance checkbox
- Profile page (update info, change password, contact Youssef on WhatsApp)
- Cancellations within the cutoff window are locked; clients are directed to WhatsApp for emergencies

### Admin Portal (separate login at `/auth` → "Admin login")
- Dashboard with KPIs (clients, upcoming, today, completed-this-month) and quick actions
- Bookings management: filter by status/date, change status (incl. `late_cancelled` for late charges), reschedule, delete, manually add bookings on behalf of clients
- Clients list with search, contact actions, and per-client booking history
- Settings: cancellation cutoff hours, WhatsApp number, profile photo URL, profile bio, blocked time slots (whole day or specific hour)

## Tech Stack
- **Frontend**: React + Vite, Wouter (routing), TanStack Query, react-hook-form + Zod, Tailwind, shadcn/ui, Framer Motion, lucide-react / react-icons
- **Backend**: Express, Passport (local strategy with email-or-username), express-session (PG store), scrypt password hashing
- **Database**: PostgreSQL via Drizzle ORM (drizzle-zod for schemas)

## Data Model (`shared/schema.ts`)
- `users` — id, username, password (hashed), fullName, email, phone, role (`client` | `admin`), fitnessGoal, notes, createdAt
- `bookings` — id, userId, date, timeSlot, status (`upcoming` | `confirmed` | `completed` | `cancelled` | `free_cancelled` | `late_cancelled`), notes, createdAt, cancelledAt
- `blocked_slots` — id, date, timeSlot (nullable = whole day), reason, createdAt
- `settings` — id, cancellationCutoffHours (default 6), profilePhotoUrl, profileBio, whatsappNumber

## Default Credentials (seeded on first start)
- **Admin** — username: `admin` / password: `change-this-password`
  - Change immediately in production via the profile/settings flow.

## Routes
- `/` Public homepage
- `/auth` Combined client/admin auth
- `/policy` Cancellation policy
- `/book` Booking (requires login)
- `/dashboard`, `/profile` Client area
- `/admin`, `/admin/bookings`, `/admin/clients`, `/admin/settings` Admin area

## Booking Rules
- Slots: every hour from 06:00 to 22:00 (17 slots/day)
- A slot is **taken** if any non-cancelled booking exists for that date+time
- A slot is **blocked** if `blocked_slots` has either a matching `(date, timeSlot)` row or a whole-day row (`timeSlot IS NULL`)
- Clients can cancel only if the session start is at least `cancellationCutoffHours` away (default 6h). Admins can override using the status select on the booking row.

## Running
- `npm run dev` (workflow `Start application`) — runs Express + Vite on port 5000
- `npm run db:push -- --force` — sync schema after `shared/schema.ts` changes

## Notes
- All API contracts live in `shared/routes.ts` and are used by both server and client
- Frontend hooks: `use-auth`, `use-bookings`, `use-settings`, `use-blocked-slots`, `use-clients`
- Booking utilities (slot list, status formatting, cutoff math): `client/src/lib/booking-utils.ts`
- WhatsApp helper: `client/src/lib/whatsapp.ts`
