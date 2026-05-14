# Email System Rebuild — Step 1: Data + Logic Architecture

**Status:** Planning only. No code, no design, no schema changes.
**Scope:** Define data + triggers + logic for every email. Design comes in Step 2 after your approval.

---

## 0. Reality check (read this first)

Two assumptions in your brief don't match the current product:

### A. "Gym name / city / view on map" — does not exist
Youssef is a **solo personal trainer** training 1-on-1. The schema reflects this:
- `users.area` exists (e.g. "Dubai Marina", "JLT") — used to know which client lives where
- **No** `gym_name`, **no** `gym_city`, **no** `full_location_label`, **no** `map_link`, **no** `lat/lng` columns anywhere
- Sessions don't carry a venue field — the venue is implicitly "wherever Youssef and the client agreed" (usually the client's home gym or Youssef's preferred facility)

**Recommendation:** Either (a) drop "gym/location" from session emails entirely and just send date/time/focus, or (b) add a single `meetingLocation` text field to the bookings table (Step 1.5 — schema change, requires your approval) that Youssef fills in per-booking. The brief's "city / area / gym name / full location / View on Map" structure assumes a multi-gym marketplace which this isn't.

For the rest of this report I will flag every "gym/location" line as **[GATE]** so you can decide later. The default plan is **Option A** (omit it), since most of Youssef's clients already know where to meet.

### B. "Account Verified" — already computed, no separate event
There is no email-verification flow. `UserResponse.isVerified` is derived from profile completeness (PARQ, waiver, etc.). I'll redefine "Account Verified" below as **"Profile Completed / Onboarding Done"** to match what actually triggers.

### C. Other fields the brief assumed but don't exist
| Brief assumed | Reality |
|---|---|
| `payment_method` | Not stored. All payments are manual (WhatsApp / bank transfer). Can be inferred from `packages.paymentNote` if Youssef typed it there. |
| `payment_reference_id` | Not stored. `packages.paymentNote` is the only free-text field. |
| `booking_reference` | Not stored as a human code. `bookings.id` is a UUID — too long for an email subject. **Recommend** adding short ref (e.g. `B-3F7K2`) only if Youssef wants to quote it on WhatsApp. **[GATE]** |
| Inactive-client flag | Computed at request time from `ClientIntelligence.momentum`, not stored. Today there's no cron that finds inactives and emails — would need new service. **[GATE]** |
| Payment failed / pending separate event | No "failed" payment state in schema. `paymentStatus` is `unpaid` / `partial` / `paid`. "Failed" doesn't exist because there's no payment gateway. |
| Free-Trial Claimed event | `users.hasUsedFreeTrial` is set, but no email currently fires on first-booking-of-trial. **New event** to wire. |

Where the brief's email exists today but with different data, I list the **gap** in section 5.

---

## 1. Master event list (28 emails)

### CLIENT (13)
| # | Event | Status today |
|---|---|---|
| C1 | Welcome / Account Created | ✅ live (`buildWelcomeEmail`) |
| C2 | Free Session Activated | ❌ missing — new |
| C3 | Session Confirmed | ✅ live (`buildClientBookingConfirmationEmail`) |
| C4 | Session Reminder (24h + 1h) | ✅ live (`buildSessionReminderEmail` via cron) |
| C5 | Session Completed | ❌ missing — new (auto-complete cron will trigger) |
| C6 | Progress / InBody Update | ❌ missing for client (only admin gets it today) |
| C7 | Package Running Low | ✅ live (`buildPackageExpiringEmail`) |
| C8 | Package Completed | ✅ live (`buildPackageFinishedEmail`) |
| C9 | Payment Confirmed | ❌ missing for client (only admin gets it today) |
| C10 | Session Cancelled | ❌ missing for client (only admin gets it today) |
| C11 | Session Rescheduled | ❌ missing for client (only admin gets it today) |
| C12 | Password Reset | ✅ live (`buildPasswordResetEmail`) |
| C13 | Profile Completed *(redefined from "Account Verified")* | ❌ missing — new |

### ADMIN (15)
| # | Event | Status today |
|---|---|---|
| A1 | New Client Registered | ✅ live (`buildAdminNewClientEmail`) |
| A2 | New Session Booking | ✅ live (`buildAdminBookingEmail`) |
| A3 | Session Cancelled | ✅ live (`buildAdminBookingChangeEmail` kind=cancellation) |
| A4 | Session Rescheduled | ✅ live (`buildAdminBookingChangeEmail` kind=reschedule) |
| A5 | Payment Confirmed | ✅ live (`buildAdminPaymentEmail`) |
| A6 | Progress / InBody Update | ✅ live (`buildAdminInbodyEmail`) |
| A7 | Package Completed (sessions exhausted) | ✅ live (`buildAdminPackageExpiredEmail` reason=sessions_exhausted) |
| A8 | Package Running Low | ❌ admin variant missing (client-only today) |
| A9 | Client No-Show | ❌ missing — new |
| A10 | Emergency Cancellation Used | ❌ missing — new |
| A11 | Profile Completed *(redefined from "Verification")* | ✅ partially via `buildAdminProfileUpdateEmail` (any change, not completion) |
| A12 | Free Trial Claimed | ❌ missing — new |
| A13 | Payment Pending | ❌ missing — new (re-uses `buildAdminPaymentEmail` with status=partial/unpaid?) |
| A14 | Package Expired (date-based) | ✅ live (`buildAdminPackageExpiredEmail` reason=date) |
| A15 | Inactive Client Alert | ❌ missing — new (needs cron + heuristic) |

**Already-live emails not in your brief** (keep, don't lose):
- Booking attendance logged (admin) — `buildAdminAttendanceEmail`
- Profile updated (admin) — `buildAdminProfileUpdateEmail`
- Package activated (admin) — `buildAdminPackageActivatedEmail`

---

## 2. Per-email specification

> Format for each: **Trigger · Recipient · Required · Optional · Conditional · CTA · Subject · Priority order · Gaps**
> All times shown in **Asia/Dubai (GST, UTC+4)**. All currency in **AED**.

---

### C1. Welcome / Account Created
- **Trigger:** Immediately after `POST /api/register` succeeds
- **Recipient:** Client
- **Required:** `clientName`
- **Optional:** `lang`, `websiteUrl`
- **Conditional sections:** none (pure greeting)
- **CTA (single):** "Book Your First Session" → `/book`
- **Subject:** `Welcome to Youssef Ahmed Coaching, {firstName}`
- **Priority order:** Greeting → 3 quick orientation lines (book / track / message coach) → CTA → quick rules → signoff
- **Gaps:** none

---

### C2. Free Session Activated *(NEW)*
- **Trigger:** When `users.hasUsedFreeTrial` flips false→true AND a free-trial booking is created (typically same request). Fires once per user.
- **Recipient:** Client
- **Required:** `clientName`, `date`, `time12`, `sessionFocusLabel`, `durationMinutes`
- **Optional:** `meetingLocation` **[GATE]**, `coachWhatsApp`
- **Conditional:** Show "Bring with you" checklist only if first-ever booking
- **CTA (single):** "View Session Details" → `/dashboard/bookings/{id}`
- **Subject:** `Your free trial session is locked in — {date} at {time}`
- **Priority order:** Confirmation banner → Session card (date/time/focus/duration) → What to bring → Cancellation policy snippet → CTA → Signoff
- **Gaps:** No `freeTrialBooked` event today — needs wiring inside `dispatchBookingNotifications` when `paymentStatus === 'free'` (or when `bookings.sessionType === 'free_trial'` if we add that — **[GATE]**)

---

### C3. Session Confirmed
- **Trigger:** Successful `POST /api/bookings` (paid sessions only — free trial uses C2)
- **Recipient:** Client
- **Required:** `clientName`, `date`, `time12`, `durationMinutes`, `sessionFocusLabel`, `trainingGoalLabel`, `packageName`, `remainingSessionsAfter`, `currentSessionNumber`, `totalSessions`
- **Optional:** `meetingLocation` **[GATE]**, `partnerFullName` (duo bookings)
- **Conditional:**
  - Partner card → only if `sessionType === 'duo'` and `partnerFullName` present
  - Package progress bar → only if `packageName` present (not for ad-hoc free sessions)
- **CTA (single):** "View Session" → `/dashboard/bookings/{id}`
- **Subject:** `Session confirmed — {date} at {time} (Dubai)`
- **Priority order:** Confirmation → Session card → Partner card (if duo) → Package status → Cancellation rules → CTA → Signoff
- **Gaps:** None — all data already in `BookingDetails`

---

### C4. Session Reminder (24h + 1h)
- **Trigger:** `/api/cron/reminders` — atomic-claim per booking; 24h-before window and 1h-before window separately
- **Recipient:** Client (and linked partner if duo, separately)
- **Required:** `clientName`, `date`, `time12`, `durationMinutes`, `kind` (`24h` | `1h`)
- **Optional:** `meetingLocation` **[GATE]**, `sessionFocusLabel`
- **Conditional:**
  - "Don't forget X" tip → only on 24h variant
  - Urgency banner ("Starts in 1 hour") → only on 1h variant
- **CTA (single):**
  - 24h: "Manage Booking" → `/dashboard/bookings/{id}` (lets them cancel cleanly)
  - 1h: "Open Directions" *(only if meetingLocation set)* OR "View Session" otherwise
- **Subject:**
  - 24h: `Reminder — your session is tomorrow at {time}`
  - 1h: `Starting in 1 hour — {time} (Dubai)`
- **Priority order:** Urgency line → Session card → Tip / directions → CTA → Signoff
- **Gaps:** Reminder cron already fires; only Step-2 design refresh needed

---

### C5. Session Completed *(NEW)*
- **Trigger:** Either (a) Youssef marks attendance via admin attendance endpoint, OR (b) auto-complete cron flips status to `completed` after `endTime < now`
- **Recipient:** Client
- **Required:** `clientName`, `date`, `time12`, `sessionFocusLabel`, `remainingSessionsAfter`, `packageName`
- **Optional:** `clientVisibleCoachNotes` (Youssef can write a public note for the client)
- **Conditional:**
  - Coach note card → only if `clientVisibleCoachNotes` is non-empty
  - "Renew package" CTA → only if `remainingSessionsAfter <= 3`
- **CTA (single, dynamic):**
  - If `remainingSessionsAfter <= 3` → "Renew Package" → opens WhatsApp with renewal message
  - Else → "Book Next Session" → `/book`
- **Subject:** `Session completed — {sessionsRemainingAfter} remaining`
- **Priority order:** Completion confirmation → Session summary → Coach note (if any) → Package status → Conditional CTA → Signoff
- **Gaps:** Auto-complete cron not yet built (queued in dormant booking-hardening plan). For Step 2 we can build the email; the trigger wires up later.

---

### C6. Progress / InBody Update *(NEW for client)*
- **Trigger:** `POST /api/inbody` succeeds AND OpenAI extraction returns at least one numeric field
- **Recipient:** Client
- **Required:** `clientName`, `recordedDate`, at least one of [`weight`, `bodyFat`, `muscleMass`]
- **Optional:** `bmi`, `visceralFat`, `score`, `previous` snapshot (to compute deltas)
- **Conditional:**
  - Delta arrows (▲/▼) per metric → only if previous scan exists for same user
  - "Next focus" line → only if Youssef has typed `inbody_records.notes`
- **CTA (single):** "View Full Report" → `/dashboard/progress`
- **Subject:** `Your new InBody scan is ready — {date}`
- **Priority order:** Headline → Metric grid (weight / fat / muscle) → Deltas → Coach note (if any) → CTA → Signoff
- **Gaps:** No previous-scan lookup helper today — **needs storage method** `getPreviousInbody(userId, beforeDate)` (read-only, no schema change). **[GATE]** for new helper.

---

### C7. Package Running Low
- **Trigger:** Daily cron at 7 / 3 / 1 days before `packages.expiryDate` OR when `remainingSessions <= 2`
- **Recipient:** Client
- **Required:** `clientName`, `packageName`, `remainingSessions`, either `daysUntilExpiry` or `sessionsRunningOut: true`
- **Optional:** `pricePerSession`, `renewalQuoteAed` (if Youssef has set one)
- **Conditional:**
  - Days-until-expiry banner → only when triggered by date proximity
  - Sessions-remaining banner → only when triggered by usage
- **CTA (single):** "Renew Package" → WhatsApp deeplink with prefilled renewal message
- **Subject:**
  - Date-trigger: `Your package expires in {N} days`
  - Usage-trigger: `Only {N} sessions left in your package`
- **Priority order:** Headline (date or usage) → Package card → Renewal benefit (1 line) → CTA → Signoff
- **Gaps:** Today the email triggers only on date, not on usage threshold. Adding usage trigger needs a new cron pass — **[GATE]**

---

### C8. Package Completed
- **Trigger:** When `packages.usedSessions >= packages.totalSessions` OR when `packages.expiryDate < now` AND not already notified (`finishedNotifiedAt IS NULL`)
- **Recipient:** Client
- **Required:** `clientName`, `packageName`, `totalSessions`, `completedAt`
- **Optional:** `nextStepHint` (Youssef's recommendation)
- **Conditional:** none — pure summary + renewal CTA
- **CTA (single):** "Continue Your Journey" → WhatsApp deeplink with renewal message
- **Subject:** `Your {packageName} is complete — what's next?`
- **Priority order:** Congrats line → Package recap (X sessions over Y weeks) → Renewal CTA → Signoff
- **Gaps:** none

---

### C9. Payment Confirmed *(NEW for client)*
- **Trigger:** When admin sets `packages.paymentStatus = 'paid'` (full payment) OR `paymentStatus = 'partial'` with new amount logged
- **Recipient:** Client
- **Required:** `clientName`, `packageName`, `amountAed`, `paymentStatus` (`paid` | `partial`), `totalPriceAed`, `sessionsTotal`, `expiryDate`
- **Optional:** `amountPaidToDate`, `outstandingAed` (only if partial)
- **Conditional:**
  - "Outstanding balance" line → only if `paymentStatus === 'partial'`
  - "Package activated" badge → only if this is the first payment that activates the package
- **CTA (single):** "View My Package" → `/dashboard/package`
- **Subject:**
  - Full: `Payment received — {packageName} is active`
  - Partial: `We received your payment of AED {amount}`
- **Priority order:** Confirmation → Payment summary → Package status (sessions / expiry) → Outstanding (if any) → CTA → Signoff
- **Gaps:** No payment_method or reference_id columns. Email won't show those — that's fine since Youssef doesn't track them.

---

### C10. Session Cancelled *(NEW for client)*
- **Trigger:** Client cancels via `POST /api/bookings/:id/cancel` OR Youssef cancels via admin route
- **Recipient:** Client
- **Required:** `clientName`, `date`, `time12`, `cancelType` (`free` | `late` | `emergency` | `protected` | `admin`)
- **Optional:** `reason` (Youssef-side cancellations), `refundedToPackage: boolean`
- **Conditional:**
  - "Session refunded to your package" line → only if `refundedToPackage === true`
  - "This counted as a late cancellation" line → only if `cancelType === 'late'`
  - "Emergency cancellation used" line → only if `cancelType === 'emergency'`
- **CTA (single):** "Book Another Session" → `/book`
- **Subject:** `Your session on {date} at {time} was cancelled`
- **Priority order:** Cancellation confirmation → What happened (which type) → Package impact → CTA → Signoff
- **Gaps:** `cancelType` not stored as a single enum today — derived from `bookings.status` + `isEmergencyCancel` + `protectedCancellation`. Helper function needed in builder.

---

### C11. Session Rescheduled *(NEW for client)*
- **Trigger:** `PATCH /api/bookings/:id` where `date` or `timeSlot` changed
- **Recipient:** Client
- **Required:** `clientName`, `fromDate`, `fromTime12`, `toDate`, `toTime12`, `durationMinutes`
- **Optional:** `sessionFocusLabel`, `meetingLocation` **[GATE]**, `reason` (Youssef-side reschedules)
- **Conditional:**
  - "Reason" card → only if `reason` is non-empty (i.e. Youssef-initiated)
- **CTA (single):** "View Updated Session" → `/dashboard/bookings/{id}`
- **Subject:** `Your session moved to {toDate} at {toTime}`
- **Priority order:** Reschedule confirmation → Old → New (visual diff) → Reason (if any) → CTA → Signoff
- **Gaps:** `bookings.rescheduledFrom` exists but is just the previous booking ID — need to fetch its date/time to populate `fromDate`. Storage method `getRescheduleSource(bookingId)` needed.

---

### C12. Password Reset
- **Trigger:** `POST /api/forgot-password`
- **Recipient:** Client
- **Required:** `resetUrl`, `expiryMinutes` (= 30)
- **Optional:** `clientName` (currently NOT passed — would improve personalization)
- **Conditional:** none
- **CTA (single):** "Reset Password" → `resetUrl`
- **Subject:** `Reset your password — Youssef Ahmed Coaching`
- **Priority order:** Action prompt → CTA button → Expiry note → Plain-text link fallback → "Didn't request this?" footer
- **Gaps:** `clientName` is available at trigger site but not passed to builder — easy fix in Step 2.

---

### C13. Profile Completed *(redefined from "Account Verified")*
- **Trigger:** When the user's `isVerified` computed flag flips false→true (PARQ + waiver + medical clearance + profile picture all present). Detect via diff in `PATCH /api/me/profile` handler.
- **Recipient:** Client
- **Required:** `clientName`
- **Optional:** none
- **Conditional:** none
- **CTA (single):** "Book Your First Session" → `/book` (if no bookings yet) OR "Open Dashboard" → `/dashboard`
- **Subject:** `You're all set — your profile is complete`
- **Priority order:** Confirmation → 1-line "what this unlocks" → CTA → Signoff
- **Gaps:** No "previously was incomplete" tracking today — need to compute `isVerified` before-and-after the patch and only fire on transition. Helper needed.

---

### A1. New Client Registered
- **Trigger:** Immediately after `POST /api/register` succeeds (parallel with C1)
- **Recipient:** Admin
- **Required:** `clientName`, `email`, `phone`
- **Optional:** `area`, `primaryGoal`, `weeklyFrequency`, `packageName`, `packagePrice`
- **Conditional:**
  - Package row → only if user picked a package during registration
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `New client registered — {clientName}`
- **Priority order:** Identity (name/email/phone) → Goals → Package interest → CTA
- **Gaps:** none

---

### A2. New Session Booking
- **Trigger:** `dispatchBookingNotifications` after booking insert
- **Recipient:** Admin
- **Required:** `clientName`, `clientPhone`, `date`, `time12`, `durationMinutes`, `sessionFocusLabel`, `trainingGoalLabel`, `sessionTypeLabel`, `packageName`, `currentSessionNumber`, `totalSessions`, `paymentStatus`
- **Optional:** `partnerFullName`, `partnerPhone`, `clientNotes`
- **Conditional:**
  - Partner block → only `sessionType === 'duo'`
  - Client notes block → only if `clientNotes` non-empty
  - Payment status pill → always shown (paid / partial / unpaid)
- **CTA (single):** "Open Admin Bookings" → `/admin/bookings`
- **Subject:** `[New booking] {clientName} — {date} at {time}`
- **Priority order:** Booking facts (compact table) → Partner / notes (if any) → CTA
- **Gaps:** none

---

### A3. Session Cancelled (admin)
- **Trigger:** `POST /api/bookings/:id/cancel` OR client used emergency cancel
- **Recipient:** Admin
- **Required:** `clientName`, `date`, `time12`, `cancelType`, `cancelledByRole` (`client` | `admin`)
- **Optional:** `reason`, `emergencyCancelCount` (this month)
- **Conditional:**
  - "⚠️ This client has used N emergency cancels this month" → only if `cancelType === 'emergency'`
  - "Late cancellation — session counted" → only if `cancelType === 'late'`
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `[Cancelled] {clientName} — {date} {time} ({cancelType})`
- **Priority order:** Who/when/what → Type badge → Counter context → CTA
- **Gaps:** `cancelledByRole` not stored — derive from session: who hit the route. Easy.

---

### A4. Session Rescheduled (admin)
- **Trigger:** `PATCH /api/bookings/:id` with date/time delta
- **Recipient:** Admin
- **Required:** `clientName`, `fromDate`, `fromTime12`, `toDate`, `toTime12`, `rescheduledByRole`
- **Optional:** `reason`, `sameDayAdjustCount` (this month, for clients who keep moving sessions)
- **Conditional:**
  - "⚠️ Same-day adjustment #N this month" → only if `sameDayAdjustCount > 0` AND from-date == today
- **CTA (single):** "Open Admin Bookings" → `/admin/bookings`
- **Subject:** `[Rescheduled] {clientName} — {fromDate}→{toDate}`
- **Priority order:** Diff line → Counter context → CTA
- **Gaps:** none (all fields exist)

---

### A5. Payment Confirmed (admin)
- **Trigger:** `POST /api/admin/packages/:id/payments`
- **Recipient:** Admin (Youssef logs it himself, but the email gives him an audit trail)
- **Required:** `clientName`, `packageName`, `amountReceived`, `amountPaidTotal`, `packageTotal`, `paymentStatus`
- **Optional:** `paymentNote` (free text), `loggedByAdminName`
- **Conditional:**
  - "Package now fully paid" badge → only if `amountPaidTotal === packageTotal`
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `[Payment {paid|partial}] {clientName} — AED {amount}`
- **Priority order:** Amount → Total paid / package total → Status badge → Note → CTA
- **Gaps:** none

---

### A6. Progress / InBody Update (admin)
- **Trigger:** `POST /api/inbody`
- **Recipient:** Admin
- **Required:** `clientName`, `recordedDate`
- **Optional:** `weight`, `bodyFat`, `muscleMass`, `aiExtracted: boolean`
- **Conditional:**
  - "AI extracted ✓" pill → only if `aiExtracted === true`
  - Metric grid → only if at least one numeric field present
- **CTA (single):** "Review Scan" → `/admin/clients/{userId}#progress`
- **Subject:** `[InBody] {clientName} — new scan {date}`
- **Priority order:** Identity → Metrics → CTA
- **Gaps:** none

---

### A7. Package Completed (admin)
- **Trigger:** When `packages.usedSessions >= totalSessions` (sessions exhausted) OR `expiryDate < now` (date-based)
- **Recipient:** Admin
- **Required:** `clientName`, `packageName`, `reason` (`sessions_exhausted` | `date`), `totalSessions`, `expiryDate`
- **Optional:** `noShowCount` (sessions consumed via no-show)
- **Conditional:**
  - "Last booking was {N} days ago" → if data available
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `[Package done] {clientName} — {packageName} ({reason})`
- **Priority order:** Identity → Reason → Stats → CTA
- **Gaps:** none

---

### A8. Package Running Low (admin) *(NEW)*
- **Trigger:** Same cron as C7, sends parallel admin email
- **Recipient:** Admin
- **Required:** `clientName`, `packageName`, `remainingSessions`, `daysUntilExpiry`
- **Optional:** `lastSessionDate`, `clientVipTier`
- **Conditional:** none
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `[Renewal due] {clientName} — {N} sessions left`
- **Priority order:** Identity → Status numbers → Last activity → CTA
- **Gaps:** Cron exists for client; just need to add admin variant alongside.

---

### A9. Client No-Show *(NEW)*
- **Trigger:** Youssef marks attendance as `no_show` via admin attendance endpoint
- **Recipient:** Admin (audit log) — also worth considering client variant later
- **Required:** `clientName`, `date`, `time12`, `noShowCountTotal` (after this one), `packageName`, `remainingSessionsAfter`
- **Optional:** `clientNotes`, `consecutiveNoShows` (count of recent in a row)
- **Conditional:**
  - "⚠️ {N}-th no-show this month" warning → only if count > 1 in 30d
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `[No-show] {clientName} — {date} {time}`
- **Priority order:** Identity → Counter → Package impact → CTA
- **Gaps:** none — `noShowCount` already on users table

---

### A10. Emergency Cancellation Used *(NEW)*
- **Trigger:** When client uses emergency-cancel path (`bookings.isEmergencyCancel = true`, `users.emergencyCancelLastUsedAt` set)
- **Recipient:** Admin
- **Required:** `clientName`, `date`, `time12`, `usedThisMonth`
- **Optional:** `reason`, `vipTier` (some tiers get more allowances)
- **Conditional:**
  - "Quota exhausted" badge → only if `usedThisMonth >= allowedThisMonth(vipTier)`
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `[Emergency cancel] {clientName} — {date} {time}`
- **Priority order:** Identity → Counter → Quota status → CTA
- **Gaps:** Allowed-per-tier rule lives in business logic, not schema. Need helper to compute.

---

### A11. Profile Completed (admin) *(redefined)*
- **Trigger:** Same trigger as C13 — fires admin variant in parallel
- **Recipient:** Admin
- **Required:** `clientName`, `completedAt`
- **Optional:** `medicalClearanceNote` (highlight if there are flagged medical concerns)
- **Conditional:**
  - "⚠️ Medical note flagged" → only if `medicalClearanceNote` non-empty
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `[Profile complete] {clientName}`
- **Priority order:** Identity → Medical flag (if any) → CTA
- **Gaps:** Same diff-detect as C13.

---

### A12. Free Trial Claimed *(NEW)*
- **Trigger:** When `users.hasUsedFreeTrial` flips false→true (i.e. first free-trial booking)
- **Recipient:** Admin
- **Required:** `clientName`, `clientPhone`, `date`, `time12`
- **Optional:** `area`, `primaryGoal`
- **Conditional:** none
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `[Free trial booked] {clientName} — {date} {time}`
- **Priority order:** Identity → Trial session details → CTA
- **Gaps:** Trigger needs wiring inside booking creation flow.

---

### A13. Payment Pending *(NEW)*
- **Trigger:** Daily cron — finds active packages where `paymentStatus IN ('unpaid','partial')` and `purchasedAt > 7 days ago`
- **Recipient:** Admin
- **Required:** `clientName`, `packageName`, `amountOutstanding`, `daysSinceCreated`
- **Optional:** `lastPaymentDate`, `paymentNote`
- **Conditional:**
  - "{N} reminders sent already" → only if we add a reminder counter
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `[Payment overdue] {clientName} — AED {outstanding}`
- **Priority order:** Identity → Outstanding amount → Days overdue → CTA
- **Gaps:** No daily-overdue cron exists. **[GATE]** to build it.

---

### A14. Package Expired (date-based) (admin)
- **Trigger:** Daily cron — when `packages.expiryDate < now` AND not already notified
- **Recipient:** Admin
- **Required:** `clientName`, `packageName`, `expiryDate`, `unusedSessions`
- **Optional:** `lastSessionDate`
- **Conditional:**
  - "{N} sessions left unused" → only if `unusedSessions > 0`
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `[Expired] {clientName} — {packageName}`
- **Priority order:** Identity → Expiry → Unused sessions → CTA
- **Gaps:** none

---

### A15. Inactive Client Alert *(NEW)*
- **Trigger:** Weekly cron — finds active-package clients whose last booking was > 14 days ago
- **Recipient:** Admin
- **Required:** `clientName`, `daysSinceLastSession`, `packageName`, `remainingSessions`
- **Optional:** `lastBookingDate`, `clientNotes`
- **Conditional:** none
- **CTA (single):** "Open Client Profile" → `/admin/clients/{userId}`
- **Subject:** `[Inactive {N} days] {clientName} — {N} sessions unused`
- **Priority order:** Identity → Days inactive → Package status → CTA
- **Gaps:** No "last booking date" computed today. Easy storage method `getLastBookingDate(userId)`. **[GATE]** for new weekly cron job.

---

## 3. Cross-cutting rules (apply to all emails)

### Tone
- **Client:** premium concierge — warm but spare. No exclamation marks. No emojis. Speak as Youssef, not as "the team".
- **Admin:** operational telegram — facts first, prose second. No marketing copy. Subject lines lead with `[Bracketed Type]` so Youssef can scan the inbox.

### CTA discipline
- **One CTA per email.** Period. No secondary buttons that compete.
- CTA label is event-specific, never "Open Dashboard" as default.
- CTA links go to deep destinations, not landing pages.

### Conditional sections
- Default: hide. Only render a card/row/line if its required-for-relevance fields are non-null and meaningful.
- Never render `N/A`. Never render a label with empty value.
- Cards collapse from layout — no empty placeholders.

### Time + locale
- All times in client emails: rendered in **Asia/Dubai (GST, UTC+4)**, e.g. `Tuesday, 12 May 2026 · 5:00 PM`.
- All times in admin emails: same Dubai TZ. Optionally include `(in 4h)` relative hint.
- Dates ISO `2026-05-12` are forbidden in user-visible text — always full `12 May 2026`.

### Currency
- AED only. Format `AED 2,500` (no decimals unless < 1).
- Never show EGP / USD anywhere.

### Subject conventions
- **Client subjects:** sentence case, no brackets, lead with the thing that happened.
- **Admin subjects:** `[Type]` prefix in brackets, then identity, then key value.

### Plaintext fallback
- Every email must have a `text:` plaintext rendition for spam-filter compliance.
- Plaintext is not a stripped-tags HTML — it's hand-curated short text with the same priority order.

### Idempotency
- Every email send goes through `notifyUserOnce(userId, kind, dedupeKey)` — no duplicates per logical event.
- Dedupe keys per email type listed in §6.

### Localization (lang)
- `lang` accepted: `en` (default) and `ar` (RTL).
- Step 1 spec is English. Arabic copy is a Step 3 concern.

---

## 4. CTA → destination map

| CTA label | Destination | Used by |
|---|---|---|
| Book Your First Session | `/book` | C1, C13 |
| View Session | `/dashboard/bookings/{id}` | C2, C3, C4 (1h), C11 |
| Manage Booking | `/dashboard/bookings/{id}` | C4 (24h) |
| Open Directions | external map URL | C4 (1h) **[GATE]** |
| Book Another Session | `/book` | C10 |
| Book Next Session | `/book` | C5 (high remaining) |
| Renew Package | WhatsApp deeplink with renewal text | C5 (low remaining), C7, C8 |
| View My Package | `/dashboard/package` | C9 |
| View Full Report | `/dashboard/progress` | C6 |
| Reset Password | `resetUrl` token | C12 |
| Open Dashboard | `/dashboard` | C13 (if has bookings) |
| Open Client Profile | `/admin/clients/{userId}` | A1, A3, A5, A7, A8, A9, A10, A11, A12, A13, A14, A15 |
| Open Admin Bookings | `/admin/bookings` | A2, A4 |
| Review Scan | `/admin/clients/{userId}#progress` | A6 |

---

## 5. Data gaps summary (what we don't have today)

### A. Schema additions you may want — **none required for Step 2**, but discuss for Step 3+:
| Field | Table | Why | Decision needed |
|---|---|---|---|
| `meetingLocation` text | `bookings` | If you want session emails to show where to meet | **[GATE]** A/B/C below |
| `humanRef` short text (e.g. `B-3F7K2`) | `bookings` | If you want short refs for WhatsApp context | **[GATE]** |
| `paymentMethod` text | `package_payments` (would need a new table) | Only if you want to record cash/transfer per payment | **[GATE]** |
| `cancelType` text/enum | `bookings` | To avoid deriving cancel-type from 3 booleans | nice-to-have, not required |

### B. Storage methods needed (no schema change, just code):
- `getPreviousInbody(userId, beforeDate)` — for C6 deltas
- `getRescheduleSource(bookingId)` — for C11 from-date/time
- `getLastBookingDate(userId)` — for A15 inactive detection
- `getEmergencyCancelAllowance(vipTier)` — for A10 quota check
- `wasProfileIncomplete(userId, before patch)` — for C13 / A11 transition detect

### C. Crons needed (new jobs):
- Auto-complete bookings → triggers C5 (already in dormant booking-hardening plan)
- Usage-threshold renewal nudge → triggers C7 second variant
- Daily payment-overdue scan → triggers A13
- Weekly inactive-client scan → triggers A15

### D. Triggers needing wiring inside existing routes:
- Free-trial-booked detection inside `dispatchBookingNotifications` → C2, A12
- Profile-completion transition detection inside `PATCH /api/me/profile` → C13, A11
- Client variant of session cancel/reschedule (today only admin gets these) → C10, C11
- Client variant of payment confirmed (today only admin gets it) → C9
- Client variant of inbody (today only admin gets it) → C6

---

## 6. Dedupe keys (idempotency)

| Email | Dedupe key pattern | Notes |
|---|---|---|
| C1 / A1 | `welcome-{userId}` / `new-client-{userId}` | once per user lifetime |
| C2 / A12 | `free-trial-{userId}` | once per user lifetime |
| C3 / A2 | `booking-confirmed-{bookingId}` | once per booking |
| C4 24h | `reminder-24h-{bookingId}` | already implemented |
| C4 1h | `reminder-1h-{bookingId}` | already implemented |
| C5 | `session-completed-{bookingId}` | once per booking |
| C6 / A6 | `inbody-{recordId}` | once per scan |
| C7 / A8 | `pkg-low-{packageId}-{milestone}` | milestone = `7d`, `3d`, `1d`, `2sess`, `0sess` |
| C8 / A7 | `pkg-done-{packageId}` | once per package |
| C9 / A5 | `payment-{paymentLogId}` | once per payment record |
| C10 / A3 | `cancel-{bookingId}` | once per booking |
| C11 / A4 | `reschedule-{bookingId}-{newDate}-{newTime}` | refires if rescheduled again |
| C12 | `pwd-reset-{tokenId}` | once per token |
| C13 / A11 | `profile-complete-{userId}` | once per user lifetime |
| A9 | `no-show-{bookingId}` | once per booking |
| A10 | `emerg-cancel-{bookingId}` | once per booking |
| A13 | `payment-overdue-{packageId}-{weekIso}` | re-fires weekly |
| A14 | `pkg-expired-{packageId}` | once per package |
| A15 | `inactive-{userId}-{weekIso}` | re-fires weekly |

---

## 7. Decisions I need from you before Step 2

| ID | Question | My recommendation |
|---|---|---|
| Q1 | Add `meetingLocation` field to bookings? Or omit gym/location entirely from emails? | **Omit.** You and the client always agree on WhatsApp. Adds complexity for no benefit. |
| Q2 | Add short human booking ref (`B-3F7K2`)? | **Skip for now.** Add later if you start needing it on WhatsApp. |
| Q3 | Add `cancelType` enum to bookings, or derive in builder? | **Derive in builder.** Less migration, same result. |
| Q4 | Build C6 client-side InBody email with previous-vs-current deltas? | **Yes** — high client perceived value, no schema work. |
| Q5 | Build A13 payment-overdue cron and A15 inactive-client cron? | **Yes for A13**, defer A15 until you've seen real inactive-client data. |
| Q6 | A8 admin "package running low" — fire on every milestone (7d/3d/1d) like client, or just 3d? | **Just 3d for admin.** You don't need 3 emails per client per week. |
| Q7 | C13/A11 profile-completion — fire as new email, or fold into A11 generic profile-update? | **Fire as separate event.** The "now fully verified" milestone is meaningful. |

---

## 8. What Step 2 will deliver (not today)

After your approval of this report:
1. **Builder refactor** — every existing builder gets its input shape updated to match this spec; new builders for the 13 missing emails get created (bare HTML for now, no styling).
2. **Trigger wiring** — all the `dispatch*` calls in `routes.ts` get extended for the new client-variant emails (C9, C10, C11, C6).
3. **Storage helpers** — the 5 helpers in §5B get added.
4. **Crons** — A13 (and optionally A15) cron pass added to `/api/cron/reminders`.
5. **Dedupe keys** — every send goes through `notifyUserOnce` per §6.

**Not included in Step 2:** visual design, brand styling, TRON theming, layout system. That's Step 3, after Step 2 ships and we can verify the data is right end-to-end with plain HTML.

---

## 9. What Step 3 will deliver (much later)

After Step 2 is verified:
- Cinematic dark/cyan visual system
- Mobile-first responsive shell
- Reusable card / divider / metric / CTA components
- Dark-mode default with light-mode fallback for clients on Outlook
- Per-event hero treatments (e.g. session card, payment card, progress card)
- Arabic RTL parity

---

**End of Step 1 report. Awaiting your approval and answers to §7 questions before starting Step 2.**
