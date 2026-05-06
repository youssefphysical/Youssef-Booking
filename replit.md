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

## User preferences

_Populate as you build_

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