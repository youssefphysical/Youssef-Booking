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

---

# STEP 1B — Architecture refinements

Following Step 1 approval. Adds 10 architectural layers before any design work begins. Still no code, no styling, no schema migrations — pure architecture.

---

## 1B.1 Booking Location Model (session emails only)

### Scope rule (locked)
Location data appears **exclusively** in these 6 email events:
- C3 Session Confirmed
- C4 Session Reminder (24h + 1h)
- C10 Session Cancelled
- C11 Session Rescheduled
- A2 New Session Booking (admin)
- A9 Client No-Show (admin)

It must **never** appear in: welcome, payment, password reset, progress/InBody, profile completed, package running low, package completed, payment overdue, inactive client, free trial claimed (admin notification — the corresponding *client* free-trial activation email C2 IS session-related and DOES carry location).

### Logical fields (proposed shape — not yet a schema)
```
BookingLocation {
  city: string                  // "Dubai"
  area: string                  // "Dubai Marina"
  gymName: string               // "Fitness First Marina Walk"
  fullLabel: string             // "Fitness First, Marina Walk, Dubai Marina"
  mapUrl?: string               // optional Google Maps URL
}
```

### Where this lives logically
Two acceptable architectures — Step 2 picks one:

**Option A — Per-booking inline (recommended):** A single denormalised `meetingLocation` JSON column on `bookings` populated at booking time. Pros: no joins; historical bookings keep their original location even if the gym closes. Cons: typed-once-per-booking duplication.

**Option B — Location catalog + FK:** A `training_locations` table + `bookings.locationId`. Pros: dropdown UX, edit-once. Cons: extra table, deletion semantics for past bookings.

> **Recommendation:** Option A for v1. Migrate to Option B only when Youssef has 5+ recurring venues.

### Behavior when location is missing
| Field absent | Email behavior |
|---|---|
| Whole `meetingLocation` object null | Hide the entire location section. No "TBD", no "Location pending". The email simply omits the block. |
| `gymName` present but no `mapUrl` | Render gym + area as text. Hide the "Open Directions" CTA. |
| `mapUrl` present but no `gymName` | Render the map link with the area as label. Skip the gym row. |
| Only `area` present | Render area only. No card border, no header — single line of text. |

### "Open Directions" CTA gate
- Only rendered when `mapUrl` is non-empty AND email is C4 (1h reminder), C3 (confirmed), or A2 (admin booking).
- Never rendered for cancellations, reschedules, or no-show emails (the location is moot).

### Geographic scope
Solo trainer, Dubai-only. The `city` field exists for future-proofing (Abu Dhabi expansion), but emails should not show city when it equals the trainer's home city — assume Dubai unless explicitly different. Strips noise.

---

## 1B.2 Split Session Reminders — 24h vs 1h

The two reminders share the same trigger (`/api/cron/reminders`) but are now distinct emails with different priority orders, content density, and CTAs.

### 24h Reminder — preparation-oriented
**Tone:** calm, anticipatory, briefing-style.
**Reading time target:** ~25 seconds.
**Weight:** medium-heavy (allows preparation card).

**Data priority order:**
1. Session date + time (Dubai)
2. Session focus + duration
3. Preparation card — what to bring / wear / eat-window
4. Cancellation / reschedule policy snippet
5. Add-to-calendar link (`.ics` attachment or Google Calendar URL)
6. CTA: "Manage Booking" → `/dashboard/bookings/{id}`

**Subject:** `Reminder — your session is tomorrow at {time}`
**Why "Manage" not "View":** at 24h-out the user might still need to cancel cleanly within the policy window.

**Optional sections (hide if empty):**
- Coach pre-session note (`bookings.clientVisibleCoachNotes`)
- Partner reminder (duo bookings) — "{partnerName} is also booked for this session"
- Last InBody quick-glance (only if scan exists from past 30d)

### 1h Reminder — operational
**Tone:** concise, "see you soon".
**Reading time target:** ~7 seconds.
**Weight:** lightweight (no hero, no extras).

**Data priority order:**
1. Urgency line: "Starting in 1 hour"
2. Time + duration (no need for date — it's today)
3. Location card (gym + map) **only if location set**
4. CTA: "Open Directions" if `mapUrl` set, otherwise "View Session"

**Subject:** `Starting in 1 hour — {time}`

**Forbidden sections at 1h:**
- Cancellation policy (too late — same-day rules already triggered)
- Add-to-calendar (irrelevant)
- Preparation card (should have prepared already)
- Coach notes (open the app to read)

**Edge case:** If user has already opened/read the 24h reminder (tracked via dedupe key existence — not engagement), still send the 1h. They are independent reminders, not a series.

### Shared rules
- Both use **single CTA** (no secondary buttons).
- Both pull from the same `BookingDetails` shape — only the renderer differs.
- Both gated by `notifyUserOnce` per the dedupe keys in §6.

---

## 1B.3 WhatsApp CTA Strategy

WhatsApp is Youssef's primary support channel. For some emails, sending the user to the dashboard is friction — they need a human, not a UI.

### Classification

**WhatsApp-primary emails** (CTA opens WhatsApp with prefilled message):
| Email | Prefilled message template |
|---|---|
| C5 Session Completed (when remaining ≤ 3) | `Hi Youssef, my package is almost done — can you send me renewal options?` |
| C7 Package Running Low | `Hi Youssef, I'd like to renew my {packageName} — can you confirm pricing?` |
| C8 Package Completed | `Hi Youssef, I've finished my {packageName} — what's the next step?` |
| C10 Session Cancelled (emergency) | `Hi Youssef, I had to use my emergency cancellation for the {date} session — can we discuss?` |
| A13 Payment Overdue (admin → client follow-up flow, future) | n/a — admin uses WhatsApp directly |

**Dashboard-primary emails** (CTA goes to in-app destination):
| Email | Destination |
|---|---|
| C1 Welcome | `/book` |
| C2 Free Session Activated | `/dashboard/bookings/{id}` |
| C3 Session Confirmed | `/dashboard/bookings/{id}` |
| C4 24h Reminder | `/dashboard/bookings/{id}` |
| C4 1h Reminder | map URL (if set) or `/dashboard/bookings/{id}` |
| C5 Session Completed (when remaining > 3) | `/book` |
| C6 InBody Update | `/dashboard/progress` |
| C9 Payment Confirmed | `/dashboard/package` |
| C11 Session Rescheduled | `/dashboard/bookings/{id}` |
| C12 Password Reset | `resetUrl` |
| C13 Profile Completed | `/dashboard` or `/book` |

### WhatsApp deeplink format
```
https://wa.me/{INTL_NUMBER_NO_PLUS}?text={URL_ENCODED_MESSAGE}
```
The trainer phone lives in env (`BRAND.whatsapp` constant — already exists in code).

### Fallback behavior — WhatsApp unavailable
If `BRAND.whatsapp` is empty or malformed at render time:
- WhatsApp-primary emails fall back to a `mailto:{trainerEmail}` CTA with a draft subject like `Renewal request — {clientName}`.
- Never render a broken `wa.me` link.
- Never render an empty CTA.
- Log a warning server-side so the env misconfiguration gets noticed.

### Why WhatsApp wins for these specific events
The dashboard can show package status — but only Youssef can quote AED prices, accept payment, and confirm renewal terms. Routing the user to the dashboard for a renewal nudge wastes a click. Routing them straight to a prefilled chat closes the loop in one tap.

---

## 1B.4 Email Severity Classification

Every email carries a `severity` flag. Step 3 will use this to drive accent color, glow intensity, icon style, and CTA emphasis. Today it just lives as a metadata tag.

### Categories

| Severity | Meaning | Visual treatment (Step 3) |
|---|---|---|
| `success` | Positive event, no action needed | Cyan accent, subtle glow, checkmark icon |
| `informational` | Neutral update, optional engagement | Muted accent, no glow, info icon |
| `warning` | Action recommended within a window | Amber accent, medium glow, alert icon |
| `critical` | Urgent action required or problem reported | Red/orange accent, strong glow, warning icon |

### Per-email severity assignment

**Client emails:**
| Email | Severity |
|---|---|
| C1 Welcome | informational |
| C2 Free Session Activated | success |
| C3 Session Confirmed | success |
| C4 24h Reminder | informational |
| C4 1h Reminder | warning |
| C5 Session Completed | success |
| C6 InBody Update | informational |
| C7 Package Running Low | warning |
| C8 Package Completed | warning |
| C9 Payment Confirmed | success |
| C10 Session Cancelled (free) | informational |
| C10 Session Cancelled (late / emergency) | warning |
| C11 Session Rescheduled | informational |
| C12 Password Reset | critical |
| C13 Profile Completed | success |

**Admin emails:**
| Email | Severity |
|---|---|
| A1 New Client Registered | informational |
| A2 New Session Booking | informational |
| A3 Session Cancelled | warning |
| A4 Session Rescheduled | informational |
| A5 Payment Confirmed | success |
| A6 InBody Upload | informational |
| A7 Package Completed | informational |
| A8 Package Running Low | warning |
| A9 Client No-Show | critical |
| A10 Emergency Cancellation Used | warning |
| A11 Profile Completed | informational |
| A12 Free Trial Claimed | success |
| A13 Payment Overdue | critical |
| A14 Package Expired | warning |
| A15 Inactive Client Alert | warning |

### Rules
- Severity is **always known at trigger time** — never determined by the renderer.
- Severity is part of the builder input shape (`{ severity: 'success' | ... }`), never inferred from the email subject.
- A single email always has one severity. No "this is success-but-warning" hybrids.
- Critical severity emails get a small "Open WhatsApp" secondary link in the footer (the **only** exception to the single-CTA rule).

---

## 1B.5 Image Intent Mapping (visual direction only)

Every email type is paired with a **visual mood**, not a specific image. Step 3 will source/generate actual images.

| Email | Visual mood | Image category | Cinematic intent |
|---|---|---|---|
| C1 Welcome | Arrival, beginnings | Empty floor / fresh towel / dark gym at dawn | "Day one" — open horizon |
| C2 Free Trial Activated | Anticipation | Equipment close-up, single barbell | "First rep" |
| C3 Session Confirmed | Lock-in, commitment | Stopwatch / planner | "Locked in" |
| C4 24h Reminder | Preparation | Folded kit, water bottle, headphones | "Tomorrow" |
| C4 1h Reminder | Approach | Hand on door, stairs to gym | "Almost there" |
| C5 Session Completed | Achievement, exhaustion | Towel on bench / weight rack at rest | "Done" |
| C6 InBody Update | Data, science | Body-scan analytics, futuristic readout | "Measured" |
| C7 Package Running Low | Caution, depletion | Last few plates on rack | "Final reps" |
| C8 Package Completed | Achievement, transition | Sunset over Dubai skyline | "Next chapter" |
| C9 Payment Confirmed | Trust, transaction | Minimal receipt-style icon | "Confirmed" |
| C10 Session Cancelled | Reset, neutrality | Empty calendar slot | "Cleared" |
| C11 Session Rescheduled | Movement | Calendar arrow, time shift | "Moved" |
| C12 Password Reset | Security, minimal | Lock icon on dark UI | "Secured" |
| C13 Profile Completed | Unlock | Verified badge, clean dashboard | "Ready" |
| A1 New Client Registered | Roster | Profile silhouette | "+1" |
| A2 New Session Booking | Schedule | Calendar slot filling | "Booked" |
| A3-A4 Cancel/Reschedule (admin) | Operational | Calendar diff | "Updated" |
| A5 Payment Confirmed (admin) | Ledger | Stack of receipts | "Logged" |
| A6 InBody Upload (admin) | Review | Scan tablet | "Review" |
| A7-A8, A14 Package events (admin) | Status | Package tile | "Status" |
| A9 No-Show | Empty | Dark empty session room | "Absent" |
| A10 Emergency Cancel | Alert | Red flag icon | "Flagged" |
| A11 Profile Complete (admin) | Ready | Green checkmark | "Onboarded" |
| A12 Free Trial Claimed (admin) | Funnel | Lead icon | "New lead" |
| A13 Payment Overdue (admin) | Caution | Hourglass | "Overdue" |
| A15 Inactive Client (admin) | Drift | Greyed silhouette | "Drifting" |

### Rules
- One image per email. No image carousels.
- Images are **mood-setters**, not decoration. If a mood image would feel forced, omit it (especially for lightweight emails — see §1B.7).
- Lightweight emails (password reset, 1h reminder) get **no image**, only an icon.
- Admin emails get **no images** — only icons. Operational tone.

---

## 1B.6 Notification Timing Matrix

Trigger logic per email. Each row defines: when to fire, what counts as "fired", how to suppress duplicates.

### Multi-trigger emails

| Email | Trigger conditions (OR-joined) | Suppression rule |
|---|---|---|
| C7 Package Running Low | (a) `expiryDate - now <= 7 days` AND not already sent for `7d` milestone<br>(b) Same for `3d`, `1d` milestones<br>(c) `remainingSessions <= 3` AND not already sent for `3sess` milestone<br>(d) `remainingSessions <= 1` AND not already sent for `1sess` milestone<br>(e) `usedSessions / totalSessions >= 0.80` (80% used) AND not already sent for `80pct` milestone | Each milestone fires at most once per package (dedupe key includes milestone) |
| A8 Package Running Low (admin) | Single trigger: any of C7's conditions firing → admin gets one consolidated email per day per client | Daily digest, not per-trigger |
| A13 Payment Overdue | (a) `paymentStatus IN ('unpaid','partial')` AND `purchasedAt > 7d ago` AND not already sent this week<br>(b) `paymentStatus IN ('unpaid','partial')` AND `purchasedAt > 14d ago` (escalation tier) | Weekly cadence; ISO-week dedupe |
| A15 Inactive Client | (a) `lastBookingDate < now - 14d` AND has active package<br>(b) `lastLoginDate < now - 14d` AND has active package<br>(c) Both (a) AND (b) → severity bumps to `critical` | Weekly; ISO-week dedupe |

### Threshold types
1. **Fixed threshold:** absolute count (`remainingSessions <= 3`)
2. **Percentage threshold:** ratio (`usedSessions / totalSessions >= 0.80`)
3. **Time proximity:** date-based (`expiryDate - now <= 3d`)
4. **Activity gap:** since-last (`lastBookingDate < now - 14d`)
5. **Engagement gap:** no logins / no app opens (`lastLoginDate < now - 14d`)

A single email type can use multiple threshold types simultaneously — the OR-joined trigger above is the canonical pattern.

### Anti-spam rules

**Per-user daily cap:** No client receives more than **3 transactional emails in 24h** (excluding password reset, which is always allowed). Excess emails are dropped silently and logged. Order of priority for the cap: critical > warning > success > informational.

**Per-event-type cooldown:** Same email type cannot fire to same user within these windows:
- Reminders: 0 cooldown (each booking is independent)
- Package nudges: 24h cooldown between any two milestones for same package
- Payment overdue: 7d cooldown
- Inactive client: 7d cooldown

**Quiet hours (Dubai TZ):**
- No transactional emails sent between 22:00 and 07:00 GST. Queued for 07:00.
- **Exceptions:** password reset (instant), 1h reminder (always — operational urgency), critical-severity admin alerts (always).

### Suppression rules

User can be suppressed from a category via `users.notes` flags (future schema flag, not built yet):
- `email_suppressed_marketing` — package nudges, inactivity
- `email_suppressed_reminders` — 24h + 1h
- Transactional emails (confirmation, reset, payment) cannot be suppressed.

**Bounced address suppression:** If Resend reports a hard bounce, that user's email field is flagged and only critical / transactional sends are attempted again.

### Edge cases
| Case | Behavior |
|---|---|
| Booking confirmed → cancelled before reminder fires | Reminder cron's status filter excludes cancelled — no reminder sent |
| Booking rescheduled | Reminder dedupe key keyed to `bookingId` — surviving reminder fires for the new time |
| Package renewed before expiry email fires | New package row inserted, old marked `finishedAt` — expiry cron sees fresh remaining sessions, no email |
| Two scans uploaded same day | Each gets its own C6/A6 (dedupe by recordId) |
| Payment logged in two parts same day | Each logged payment fires its own C9/A5 (dedupe by paymentLogId) |
| Profile completed via partial-then-full updates | C13/A11 fires once on transition (false→true) — subsequent profile edits use A11-generic, not the milestone email |

---

## 1B.7 Email Weight Classification

Defines **content density**, not visual weight. Drives how much can fit before the user disengages.

### Heavyweight (allowed: hero image, multiple cards, richer layout)
Target: **300–500 visible words**. Rich card stack. Hero image OK. Up to 2 collapsible info sections. Reading speed assumption: 60s scan.

| Email | Why heavy |
|---|---|
| C1 Welcome | First touch — needs orientation, brand setup |
| C2 Free Session Activated | First-ever session — preparation matters |
| C5 Session Completed | Recap + coach note + package status + next-step CTA |
| C6 InBody Update | Metric grid + deltas + coach note |
| C8 Package Completed | Journey recap + congratulations + renewal angle |
| C13 Profile Completed | Welcome-level milestone — set expectations |

### Mediumweight (single hero, 1–2 cards)
Target: **120–250 words**. One card max + CTA. Reading speed: 25s.

| Email | Why medium |
|---|---|
| C3 Session Confirmed | Single session card + CTA |
| C4 24h Reminder | Session card + preparation card |
| C7 Package Running Low | Status card + renewal CTA |
| C9 Payment Confirmed | Receipt card + package status |
| C10 Session Cancelled | What happened + impact + next-step |
| C11 Session Rescheduled | Diff card + CTA |
| All admin emails (A1–A15) | Operational — one card, one CTA |

### Lightweight (minimal, no hero, icon only)
Target: **40–90 words**. No card. Just heading + paragraph + CTA. Reading speed: 7s.

| Email | Why light |
|---|---|
| C4 1h Reminder | Pure operational urgency |
| C12 Password Reset | Security primitive — fewer words = more trust |

### Mobile attention rules
- All emails are mobile-first. Heavyweight emails must still be **scannable in 15s** on a phone — long-form is for the dashboard, not the inbox.
- The first 3 lines (above the fold on iPhone Mail preview) must contain: action that happened + key value + CTA hint.
- Hero images on heavyweight emails must be **decorative only** — no text-in-image, no info that's only visible if image loads.

---

## 1B.8 Fallback Behavior — never break

Universal rule: **hide gracefully, never show empty/broken UI.**

### Per data source

| Missing data | Behavior |
|---|---|
| Hero image URL 404s / unloadable | Render the hero with solid AMOLED background. No alt-text label visible. Email body still works. |
| Map URL invalid / not provided | Drop the "Open Directions" CTA. If location text exists, show it as plain text. If not, drop the entire location card. |
| WhatsApp number missing from env | Replace `wa.me` CTA with `mailto:` to trainer email. If trainer email also missing, drop CTA entirely and surface support text: "Reply to this email to get in touch." |
| Optional field empty (e.g. `clientNotes`) | Hide the row. No "—", no "N/A", no empty `<div>`. |
| `meetingLocation` null | Hide entire location card. Reminder/confirmation still sent. |
| `paymentMethod` / `paymentRef` unknown | Don't render those rows. Receipt card still shows amount + status. |
| `previous` InBody scan absent (first scan) | C6 hides the deltas column. Metric grid still renders. Subject changes from "Your new InBody scan is ready" to "Your first InBody scan is in." |
| `partnerFullName` empty on duo booking | Drop partner card. Email is otherwise unchanged. |
| `clientName` empty | Use `"there"` as greeting fallback. Never render `Hi ,`. |
| `lang` missing or unknown | Default to `en`. |

### Per CTA

| CTA URL absent / invalid | Behavior |
|---|---|
| Primary CTA URL empty | Hide the button entirely. Show a plain-text instruction below the body: "Open the Youssef Ahmed app to continue." |
| Secondary CTA in critical emails (WhatsApp footer link) absent | Drop silently — primary CTA still works. |

### Per render

| Failure mode | Behavior |
|---|---|
| Builder throws | Notification dispatcher catches, logs to admin, does NOT retry, does NOT crash the parent route. |
| Email send (Resend) fails | Logged in `recentEmailSends`, retried by cron once at +30min. After 2nd failure, dropped silently. |
| Plaintext fallback missing | Generated by stripping HTML tags as last-resort fallback. Logged as "missing plaintext" warning. |

### Empty-state copy library
For the rare cases where we must say something rather than hide:
- "Coach will be in touch shortly." — used when admin contact CTA fails
- "Open the Youssef Ahmed app to continue." — used when primary CTA fails
- "Reply to this email if you need help." — used in critical-severity emails when all CTAs fail

These are **last resorts**. Default behavior is always to hide.

---

## 1B.9 Subject Line Philosophy

### Core rules
1. **Sentence case** for client emails. `[Bracketed Type]` prefix for admin emails.
2. **Length:** 35–60 characters preferred (mobile inbox shows ~40 chars on iPhone). Hard max 78 chars.
3. **No emojis.** Period. Exception: ONE leading icon allowed for critical-severity admin emails (e.g. ⚠ A9 No-Show, A13 Payment Overdue).
4. **No ALL CAPS.** Even for urgency. Caps trigger spam filters and look unprofessional.
5. **No clickbait.** No "You won't believe...", no "Don't miss this...", no "Last chance!!!"
6. **No gym-bro language.** Never "Crush it", "Beast mode", "Let's gooo", "💪", etc.
7. **Lead with the event**, not with greeting. "Session confirmed" beats "Hi Youssef, your session is confirmed".
8. **Specific values in subject** when they help the user pre-decide whether to open: amount, date, time, count.
9. **No URLs in subjects.** Ever.
10. **No "Re:" or "Fwd:" prefixes** — these are spam-filter red flags on transactional mail.

### Tone
- Client: factual + warm. Like a hotel concierge confirming a reservation.
- Admin: telegram-style. Like a flight manifest update.

### Urgency handling
- **Time-bound urgency** is implied by the event, not added with words. "Starting in 1 hour" is enough — don't add "URGENT" or "!!".
- **Severity** is conveyed by leading bracket type for admin (`[Cancelled]` vs `[No-show]`), not by punctuation.

### Mobile inbox readability
- The most important word goes in chars 1–25. iPhone Mail truncates at ~40 chars.
- Avoid front-loading the brand name — the inbox already shows "Youssef Ahmed" as the sender.

### Examples — good
| Type | Subject |
|---|---|
| C3 | `Session confirmed — 12 May at 5:00 PM` |
| C4 24h | `Reminder — your session is tomorrow at 5:00 PM` |
| C4 1h | `Starting in 1 hour — 5:00 PM (Dubai)` |
| C7 | `Only 2 sessions left in your package` |
| C9 (full) | `Payment received — Elite 25-Session is active` |
| C9 (partial) | `We received your payment of AED 2,500` |
| C12 | `Reset your password — Youssef Ahmed Coaching` |
| A2 | `[New booking] Youssef — 12 May at 5:00 PM` |
| A9 | `⚠ [No-show] Sara Khan — 12 May 5:00 PM` |
| A13 | `⚠ [Payment overdue] Sara Khan — AED 4,500` |

### Examples — bad
| Bad | Why |
|---|---|
| `🔥🔥 SESSION CONFIRMED!!! 🔥🔥` | Caps, emojis, exclamation spam |
| `Hi Youssef, just confirming your session for tomorrow!` | Buried lede, too long, exclamation |
| `URGENT: Action required` | Vague, alarmist, spam-filter trigger |
| `Re: Your booking` | Fake reply prefix |
| `Don't miss your training session 💪` | Clickbait + gym-bro emoji |
| `Open me to see your progress!` | Manipulative, no information |
| `Update` | Too vague, looks like spam |
| `Booking confirmation #B-3F7K2-2026-05-12-1700` | Machine-readable garbage |

---

## 1B.10 Reusable Component Strategy

Step 3's design system will be assembled from a small library of named blocks. Every email is a composition of these blocks — no email gets bespoke layout code.

### Globally shared components (used by both client + admin)

| Component | Purpose | Used by |
|---|---|---|
| `EmailShell` | Outer `<html>`/`<body>` wrapper. Sets language, RTL, AMOLED background, base font stack, viewport meta. | All emails |
| `Header` | Brand wordmark only (no logo image — text-only "Youssef Ahmed"). | All emails |
| `Heading` | H1 / H2 with consistent sizing + severity color. | All emails |
| `Paragraph` | Body text with consistent line-height + max-width. | All emails |
| `CTAButton` | Single CTA — full-width on mobile. Severity-tinted. | All emails |
| `WhatsAppButton` | Variant of CTAButton with WA icon + green tint. | WA-primary emails |
| `Divider` | Horizontal rule, low-contrast. | Most emails |
| `Footer` | Plain "Youssef Ahmed · WhatsApp · Reply for help" + unsubscribe. No marketing. | All emails |
| `PreviewText` | Hidden preheader text for inbox preview. | All emails |
| `Icon` | Single inline SVG (severity-colored). | All emails |

### Client-only components

| Component | Purpose | Used by |
|---|---|---|
| `Hero` | Big visual section with image + title overlay. Decorative only. | Heavyweight client emails |
| `SessionCard` | Date / time / focus / duration / package row. | C2, C3, C4, C5, C10, C11 |
| `LocationCard` | Gym + area + map link (gated by §1B.1). | C3, C4, C10, C11 |
| `PackageStatusCard` | Remaining / total / expiry / progress bar. | C3, C5, C7, C8, C9 |
| `MetricGrid` | Weight / fat / muscle tiles with optional deltas. | C6 |
| `ReceiptCard` | Amount + status + outstanding row. | C9 |
| `PreparationCard` | "Bring with you" checklist. | C2, C4 (24h) |
| `CoachNoteCard` | Quoted note from Youssef. | C5 (when present), C4 (24h, when present) |
| `RescheduleDiff` | Old → new visual. | C11 |
| `CancellationImpact` | Refunded-to-package / counted-as-late explainer. | C10 |
| `QuickActionRow` | Renewal hint + WA shortcut. | C5 (low remaining), C7, C8 |

### Admin-only components

| Component | Purpose | Used by |
|---|---|---|
| `AdminFactTable` | Compact key/value table — no card chrome. | All admin emails |
| `SeverityBanner` | Single colored bar at top with severity label. | A3, A9, A10, A13 |
| `ClientIdentityRow` | Name + phone + email + WhatsApp shortcut. | All admin emails |
| `CounterBadge` | "3rd no-show this month" style pill. | A9, A10 |
| `AdminCTAButton` | CTA always going to `/admin/...`. | All admin emails |

### Composition rule
Every email is built as:
```
EmailShell {
  PreviewText
  Header
  [Hero]            // optional, heavyweight only
  Heading
  Paragraph
  [Card stack...]   // 0..N cards in priority order
  CTAButton
  Footer
}
```

Builders are pure functions: `(data, severity, lang) → html`. No business logic in builders. No data fetching in builders.

### Why this matters for Step 3
- Visual changes happen in **one place per component**.
- New email types are written by composing existing blocks — no design tax.
- A/B testing a component (e.g. CTA button color) cascades automatically to every email.
- Locale flips (en/ar) only require RTL rules in the shell + per-component direction handling.

### Things explicitly NOT components
- Per-email custom CSS — there isn't any. Every visual decision lives in a component.
- Inline `<style>` blocks per email — forbidden. All styling in shared design tokens.
- Per-email font choices — one font stack site-wide.

---

## 1B.11 Updated decision questions for Step 2 kickoff

Adds to §7. New decisions needed:

| ID | Question | My recommendation |
|---|---|---|
| Q8 | Adopt Option A (denormalised `meetingLocation` JSON on bookings) for location? | **Yes.** Schema is one column, future-flexible. |
| Q9 | Daily cap of 3 transactional client emails per 24h — too tight, too loose, just right? | **Just right** for premium concierge tone. Revisit if you ever run promo campaigns. |
| Q10 | Quiet hours 22:00–07:00 GST — exception list correct? | **Add `payment_confirmed` to exceptions** if you want clients to see their payment landed instantly. Otherwise leave as-is. |
| Q11 | Severity-driven visual treatment in Step 3 (success=cyan, warning=amber, critical=red) — agree on palette range? | **Defer to Step 3 mockups.** Severity is decided here; colors are decided then. |
| Q12 | Hero images — sourced (stock cinematic) or AI-generated per event? | **Stock + curated.** AI-generated images at email scale = legal/quality risk. |
| Q13 | Suppression flags (`email_suppressed_marketing`, etc.) — add to schema in Step 2 or Step 3? | **Step 3.** No live user complaint yet; don't pre-build. |

---

## 1B.12 What Step 1B does NOT change

- The 28-email master list is unchanged.
- The Step 1 `§7 decisions` (Q1–Q7) are unchanged and still need answering.
- All triggers and dedupe keys from Step 1 remain canonical.
- No schema fields are added today.
- No code is written today.

Step 1B is **purely additive architectural depth** — you can read it standalone or alongside Step 1.

---

**End of Step 1B addendum. Awaiting your approval and answers to §7 (Q1–Q7) + §1B.11 (Q8–Q13) before starting Step 2 (builder refactor + trigger wiring, still no visual design).**
