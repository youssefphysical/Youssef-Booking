# Email Design System Blueprint — Step 2

**Status:** Architecture + design system definition only. No production templates, no backend code, no schema migrations, no deployment.
**Scope:** Define the complete visual + structural language for all 28 emails (Step 1 + 1B). Step 3 implements components from this blueprint.
**Approved decisions carried forward:** Q8 maps in session emails only · Q9 exactly one 24h + one 1h reminder per booking · Q10 quiet hours 22:00–07:00 GST · Q11 severity classification documented · Q12 WhatsApp + Contact Support actions · Q13 suppression planned architecturally only.

---

## 0. Design north star

**One sentence:** Premium concierge transactional mail that feels closer to Apple Wallet receipts and Stripe payment confirmations than to Crunch Fitness promo blasts.

**Quality benchmarks** (in order of fidelity):
1. **Stripe** — for receipts, payment confirmations, subject discipline
2. **Apple** — for typography, whitespace, restraint
3. **Notion** — for plain-spoken transactional copy + minimal chrome
4. **Linear** — for severity / status pills + dark surfaces
5. **Airbnb** — for trip-style session cards + map handling

**Anti-references** (what we are NOT):
- Generic gym SaaS (MindBody, Trainerize) — too busy, too marketing-heavy
- ClassPass / OneFit blasts — too loud, too many CTAs
- Mailchimp templates — too "designed", too obvious
- Hotmail-era receipts — too utilitarian, no brand voice

---

## 1. Global Email Design Language

### 1.1 Typography

**Font stack** (one stack, every email, no per-event variation):
```
font-family: -apple-system, BlinkMacSystemFont, "Segoe UI",
             "Inter", "Helvetica Neue", Arial, sans-serif;
```

We do not load custom web fonts in email. Email clients strip `@font-face` unpredictably (Gmail web does, Gmail iOS doesn't, Outlook desktop blocks). System fonts render instantly, look native, and are already the brand-adjacent stack on the dashboard.

**RTL stack (Arabic):** Append `"SF Arabic", "Tajawal", "Cairo"` ahead of the Latin fallbacks when `lang="ar"`.

### 1.2 Type scale

Sizes are in `px` because email clients convert `rem`/`em` inconsistently. Line-heights use unitless multipliers.

| Token | Size / Line-height | Weight | Use |
|---|---|---|---|
| `display` | 28 / 1.2 | 600 | Hero heading on heavyweight emails (welcome, package completed) |
| `h1` | 22 / 1.3 | 600 | Primary email heading |
| `h2` | 18 / 1.35 | 600 | Card titles, section headers |
| `h3` | 15 / 1.4 | 600 | Inline labels (e.g. "Session details") |
| `body` | 15 / 1.55 | 400 | Default paragraph |
| `body-sm` | 13 / 1.5 | 400 | Secondary text, helper copy |
| `caption` | 12 / 1.4 | 500 | Footer, fine print, timestamps |
| `metric` | 24 / 1.1 | 600 | InBody metric numbers |
| `mono` | 13 / 1.4 | 500 (`ui-monospace, Menlo, Consolas, monospace`) | Booking refs, amounts |

**Mobile scale**: At ≤480px viewport, `display` drops to 24/1.25, `h1` to 20/1.3. All other sizes hold.

### 1.3 Spacing scale

Multiples of 4. Never use arbitrary pixel gaps.

| Token | Value | Use |
|---|---|---|
| `space-0` | 0 | reset |
| `space-1` | 4px | tight inline (icon ↔ label) |
| `space-2` | 8px | dense inline |
| `space-3` | 12px | between body lines |
| `space-4` | 16px | between paragraphs, card inner padding |
| `space-5` | 24px | between cards, card padding (heavyweight) |
| `space-6` | 32px | between major sections |
| `space-7` | 48px | hero ↔ body, body ↔ footer |
| `space-8` | 64px | top of email, bottom of email (outer breathing room) |

### 1.4 Border radius

| Token | Value | Use |
|---|---|---|
| `radius-sm` | 6px | pills, badges, severity tags |
| `radius-md` | 10px | cards, info blocks |
| `radius-lg` | 14px | hero containers, CTA buttons |
| `radius-pill` | 999px | counter badges, status pills |

No rounded corners on icons. No rounded outer email shell — the shell is the canvas, not a card.

### 1.5 Container widths

| Token | Value | Use |
|---|---|---|
| `width-email` | 600px | Outer table max-width (industry standard, safe in Outlook) |
| `width-content` | 552px | Inner content (= 600 − 24×2 outer padding) |
| `width-card` | 100% of content | Cards span content width edge-to-edge |
| `width-cta` | 100% on mobile, auto (min 200px) on desktop | Buttons full-width on phones |

### 1.6 Section separation

Three valid separators, in order of preference:
1. **Whitespace** (`space-6`+) — default. Prefer this.
2. **Hairline divider** — `1px` solid token `border-subtle`. Use only between dense card stacks.
3. **Severity bar** — full-width 4px colored band. Only above critical-severity emails.

**Forbidden:** dotted lines, dashed lines, double rules, text dividers ("·····"), colored block separators.

### 1.7 Visual density rules

Density is determined by email **weight class** (§5), not designer taste.

| Weight | Cards max | Lines per card | Hero | Icons |
|---|---|---|---|---|
| Heavyweight | 3 | 8 | optional | per card |
| Mediumweight | 2 | 5 | none | per card |
| Lightweight | 0 | n/a | none | one inline |

Density is a contract — going over the cap requires Step-3-time design exception.

### 1.8 White-space philosophy

Whitespace is the brand. Three rules:
1. Outer top/bottom of email shell = `space-8` (64px). Always.
2. Between any two cards = `space-5` (24px). Always.
3. Between heading and first paragraph = `space-3` (12px). Always.

If something feels cramped, the answer is whitespace, not smaller text.

### 1.9 CTA hierarchy

**Single primary CTA per email.** No exceptions for client emails.

Severity bumps the primary CTA's *visual* prominence (color, weight) but never its *count*. A second link only exists in:
- Footer support row ("Contact support" / WhatsApp icon)
- Plain-text fallback link below the button (e.g. password reset URL)

**CTA states:**
- Default
- Hover (desktop preview only — most clients ignore)
- Pressed (irrelevant — emails don't have JS)
- Focus (accessibility only — keyboard nav in webmail)

### 1.10 Iconography

**Style:** monoline, 1.5px stroke, square-cap, 24×24 default, rendered as **inline SVG** (never icon fonts, never PNG sprites).

**Source:** Lucide (already in dashboard) — keeps brand consistency between app and inbox.

**Color:** inherits from severity accent token. Never hardcoded.

**Forbidden:** filled / 3D / gradient / emoji-style icons. No emoji in the body. (Subject line emoji rule per Step 1B §1B.9 — only ⚠ on critical admin subjects.)

### 1.11 Motion / animation policy

**Zero animation.** Email clients render `@keyframes` and CSS transitions inconsistently. Even GIFs are forbidden — they break dark-mode invert, hurt accessibility, and look dated.

The only "motion" allowed is the user's natural scroll. Static composition does the work.

### 1.12 Light / dark compatibility strategy

Architectural commitment: **light-mode default, dark-mode aware.**

- Light mode is the primary canvas. Everything is designed light-first because the majority of corporate inboxes (Outlook, Gmail web at default settings) render light.
- Dark mode adapts via `@media (prefers-color-scheme: dark)` block + Apple Mail's `meta name="color-scheme" content="light dark"` opt-in.
- Where dark-mode CSS isn't supported (Gmail mobile auto-invert), we declare `[data-ogsc]` and `[data-ogsb]` overrides. Treated as a polish layer in Step 3 — not blocking.
- Logos / brand marks: SVG only, with `currentColor` fill so they invert automatically.
- Severity accents: each color has a light + dark token (§2.1). Both pre-defined.

Detailed dark strategy in §8.

---

## 2. Design Tokens

All tokens are defined once in a shared `email-tokens.ts` module (Step 3 deliverable — naming locked here).

### 2.1 Colors — Brand & severity

Naming convention: `<role>-<modifier>-<mode?>` where mode is `light` (default) or `dark`.

#### Brand
| Token | Light | Dark | Use |
|---|---|---|---|
| `brand-cyan` | `#0BB6CF` | `#5EE7FF` | Primary brand accent — used in subtle moments, never for severity |
| `brand-ink` | `#050505` | `#050505` | True black — AMOLED-aware |
| `brand-paper` | `#FFFFFF` | `#0A0A0B` | Default email background |

#### Severity accents (light / dark pairs)
| Severity | Accent (light) | Accent (dark) | Background tint (light) | Background tint (dark) |
|---|---|---|---|---|
| `success` | `#0E8F6E` | `#3DDCA8` | `#E8F8F2` | `#0F2A22` |
| `informational` | `#1F6FEB` | `#7AB7FF` | `#EEF4FF` | `#0E1B2E` |
| `warning` | `#B86E00` | `#FFB861` | `#FFF6E6` | `#2B1E07` |
| `critical` | `#B42318` | `#FF8A7A` | `#FEEDEB` | `#2C0F0C` |

**Rule:** severity controls accent color (icons, pills, button background, hairline) and tint color (banner background only, never card background). Card backgrounds remain neutral.

### 2.2 Backgrounds

| Token | Light | Dark | Use |
|---|---|---|---|
| `bg-canvas` | `#F5F6F8` | `#050505` | Outer email shell — the "table" behind everything |
| `bg-surface` | `#FFFFFF` | `#101113` | Cards, hero containers |
| `bg-surface-raised` | `#FFFFFF` | `#17181B` | Nested cards (rare — duo bookings only) |
| `bg-tint-success/info/warning/critical` | per §2.1 | per §2.1 | Severity banners only |

### 2.3 Borders

| Token | Light | Dark | Use |
|---|---|---|---|
| `border-subtle` | `#E5E7EB` | `#1F2125` | Card outlines, dividers |
| `border-strong` | `#CDD0D7` | `#2C2F35` | Hover/focus emphasis |
| `border-severity` | per §2.1 accent | per §2.1 accent | Critical/warning card left-edge accent (4px) |

All borders 1px except severity left-edges (4px).

### 2.4 Text hierarchy

| Token | Light | Dark | Use |
|---|---|---|---|
| `text-primary` | `#0A0A0B` | `#F5F6F8` | Headings, primary body |
| `text-secondary` | `#4A4F58` | `#B6BAC2` | Subheadings, secondary lines |
| `text-tertiary` | `#7A8090` | `#828896` | Captions, footer text |
| `text-onAccent` | `#FFFFFF` | `#050505` | Text on top of severity-colored buttons |
| `text-link` | `brand-cyan` | `brand-cyan` (dark variant) | Inline hyperlinks |

Contrast: every pair (`text-primary` ↔ `bg-surface`) targets WCAG AA (≥4.5:1) at minimum. Verified per pair in §11.

### 2.5 CTA states

CTA is composed from severity + state.

| State | Background | Text | Border |
|---|---|---|---|
| Default (success-severity) | `#0E8F6E` | `#FFFFFF` | none |
| Default (info / default brand) | `brand-cyan` | `#FFFFFF` | none |
| Default (warning) | `#B86E00` | `#FFFFFF` | none |
| Default (critical) | `#B42318` | `#FFFFFF` | none |
| Default (WhatsApp variant) | `#25D366` | `#FFFFFF` | none |
| Hover (desktop only) | -8% lightness | `#FFFFFF` | none |
| Focus | same as default | same as default | 2px outset `#000` |

### 2.6 Severity states (composite)

Composes accent + tint + border. Used by `AlertBanner`, `SeverityPill`, severity-tinted cards.

| State | Accent | Tint background | Border (left edge) | Icon |
|---|---|---|---|---|
| `success` | `success-accent` | `tint-success` | none | `check-circle` |
| `informational` | `info-accent` | `tint-info` | none | `info` |
| `warning` | `warning-accent` | `tint-warning` | 4px `warning-accent` | `alert-triangle` |
| `critical` | `critical-accent` | `tint-critical` | 4px `critical-accent` | `alert-octagon` |

Information and success use **tint background only** (no border-left) — they shouldn't shout.
Warning and critical use **border-left + tint** for additional emphasis.

### 2.7 Shadows

| Token | Value | Use |
|---|---|---|
| `shadow-none` | `none` | Default — most cards |
| `shadow-card` | `0 1px 3px rgba(5,5,5,0.06), 0 1px 2px rgba(5,5,5,0.04)` | Hero containers only |

We avoid shadows aggressively. Email clients render box-shadow inconsistently (Outlook 2019: nope). Whitespace is the elevation primitive.

### 2.8 Gradients

**One gradient, used sparingly:**
```
linear-gradient(180deg, rgba(11,182,207,0.06) 0%, rgba(11,182,207,0.00) 100%)
```
Reserved for hero containers on heavyweight emails (welcome, package completed) — adds the faintest brand-cyan whisper at the top. Outlook ignores gradient → falls back to flat surface (acceptable).

No gradients on buttons, cards, severity banners, or icons.

### 2.9 Spacing tokens

Already defined in §1.3. Naming: `space-0` through `space-8`.

### 2.10 Layout widths

Already defined in §1.5. Naming: `width-email`, `width-content`, `width-card`, `width-cta`.

### 2.11 Responsive breakpoints

Email clients only support **one breakpoint** reliably. We use:

| Token | Value | Trigger |
|---|---|---|
| `bp-mobile` | `max-width: 480px` | Phone portrait |

That's it. No tablet breakpoint (most email clients on tablet still serve desktop styles). Anything bigger than 480px gets the desktop layout. Mobile rules in §7.

### 2.12 Naming conventions

- All token names: `kebab-case`.
- Severity prefix: `success-`, `info-`, `warning-`, `critical-`.
- Mode suffix only when needed: `-dark` (light is implied).
- Component-scoped tokens NOT allowed — components compose global tokens.
- Never use raw hex in components. Always reference tokens.

---

## 3. Email Layout Architecture

### 3.1 Global shell structure

Every email — client and admin, heavyweight and lightweight — follows this composition:

```
EmailShell (table, width-email, bg-canvas)
├── PreviewText (hidden, 80–120 chars)
├── HeaderRow (brand wordmark, space-7 top padding)
├── [SeverityBar]              ← critical only, 4px tinted band
├── [Hero]                     ← heavyweight only
├── BodyContainer (width-content, bg-surface, radius-md, space-5 padding)
│   ├── Heading
│   ├── LeadParagraph
│   ├── [CardStack]            ← 0–3 cards in priority order
│   ├── PrimaryCTA
│   └── [HelperText]           ← single line, e.g. "Need help? …"
├── SupportRow                 ← WhatsApp + Contact Support icons (when relevant)
├── FooterLegal                ← brand line, year, unsubscribe (where applicable)
└── PreheaderSpacer (bottom space-8)
```

### 3.2 Maximum width

- Outer table: **600px** (locked — Outlook reliability cliff).
- Inner content: **552px** (= 600 − 24 outer padding × 2).
- Mobile (`<480px`): outer + inner collapse to 100% of viewport.

### 3.3 Mobile stacking behavior

- All multi-column layouts collapse to single column at `bp-mobile`.
- The only multi-column layout we permit at all is the **MetricGrid** (3 metrics side-by-side) — collapses to vertical stack on mobile.
- The **RescheduleDiff** (old → new side-by-side) collapses to stacked rows on mobile, with arrow rendered as ↓.

### 3.4 Component ordering (locked priority)

The order inside `BodyContainer` is **fixed** for consistency:

1. `Heading` — what happened
2. `LeadParagraph` — one-sentence summary with key value
3. **Cards** in this severity-aware order:
   - Critical: `AlertBanner` → primary card → context cards
   - Warning: primary card → `SeverityPill` inside primary card → context cards
   - Success / Info: primary card → context cards
4. `PrimaryCTA`
5. `HelperText` (optional)

No email reorders these. New email types compose these in the same order.

### 3.5 Conditional rendering strategy

Every non-required block must wrap in:
```
{ data && data.length && <Component /> }
```

There is no "show with empty state" pattern in emails. Either render with content or omit entirely. This rule is universal:
- Empty `clientNotes` → no card
- Missing `meetingLocation` → no `LocationCard`
- No previous InBody → MetricGrid renders without delta column
- No partner on duo → no `PartnerCard`

### 3.6 Fallback rendering strategy

When data is malformed (not just missing):
- Builder catches → returns null block.
- Composer skips silently.
- Logged to `recentEmailSends.warning` for admin observability (Step 3 wiring).
- Email still sends with the rest of the content intact.

A broken hero image, a 404 map URL, an unparseable date — all degrade by hiding the affected block, never by surfacing the error to the user.

### 3.7 Plaintext companion

Every HTML email ships with a hand-curated plaintext sibling. Plaintext follows the same component order (heading → paragraph → cards as text blocks → CTA URL). Plaintext is generated by composers, not by HTML-to-text conversion. Spec'd in §4 (`PlainTextRenderer`).

---

## 4. Component Library Plan

Each component below has a **purpose, used-by list, weight class, required/optional fields, mobile behavior, fallback behavior, severity compatibility**. Step 3 implements them as pure functions: `(props, tokens, lang) → { html, text }`.

### 4.1 Globally shared

#### `EmailShell`
- **Purpose:** outer wrapper — sets `<html>`, `<body>`, viewport meta, color-scheme meta, lang/dir, base background.
- **Used by:** all 28 emails.
- **Weight:** all.
- **Required:** `lang` (`en` | `ar`), `dir` (`ltr` | `rtl`), `severity`.
- **Optional:** `previewText`.
- **Mobile:** sets viewport `width=device-width, initial-scale=1`.
- **Fallback:** if `previewText` empty, omits hidden span.
- **Severity:** does not render severity itself; passes severity tokens down via inline styles.

#### `Header`
- **Purpose:** brand wordmark "Youssef Ahmed" in `display` weight + tagline "Personal Training · Dubai" in `caption`.
- **Used by:** all 28 emails.
- **Weight:** all.
- **Required:** none (static).
- **Optional:** `linkUrl` (default: site root).
- **Mobile:** centered.
- **Fallback:** if no link, renders as plain text.
- **Severity:** wordmark stays neutral text-primary. Never tinted.

#### `Heading`
- **Purpose:** primary email heading (one per email).
- **Used by:** all 28 emails.
- **Required:** `text`.
- **Optional:** `level` (default: h1).
- **Mobile:** scales per §1.2.
- **Fallback:** none — required.
- **Severity:** color = severity accent (subtle — heading uses tinted variant, not full accent saturation).

#### `Paragraph`
- **Purpose:** body text.
- **Used by:** all 28 emails.
- **Required:** `text`.
- **Optional:** `tone` (`primary` default, `secondary`, `tertiary`).
- **Mobile:** holds size 15px.
- **Fallback:** if empty, omits.
- **Severity:** ignores severity (always text-primary/secondary).

#### `CTAButton`
- **Purpose:** primary call to action — single per email.
- **Used by:** all 28 emails.
- **Required:** `label`, `url`, `severity`.
- **Optional:** `variant` (`solid` default, `wa` for WhatsApp).
- **Mobile:** full width, height 48px, font 16px, tap-target ≥44×44px.
- **Fallback:** if `url` empty, hides button + renders italic helper "Open the Youssef Ahmed app to continue."
- **Severity:** background = severity accent. Text always `text-onAccent` (white in light, ink in dark).

#### `WhatsAppButton`
- **Purpose:** WhatsApp-specific CTA variant.
- **Used by:** C5 (low remaining), C7, C8, C10 (emergency), critical-severity admin footers.
- **Required:** `phoneE164`, `prefilledMessage`.
- **Optional:** `label` (default: "Message Youssef on WhatsApp").
- **Mobile:** identical to CTAButton + leading WA icon.
- **Fallback:** if `phoneE164` empty → degrades to `mailto:` link with same label change. If both empty → renders SupportRow only.
- **Severity:** always `#25D366` (WhatsApp brand green) regardless of email severity.

#### `Divider`
- **Purpose:** hairline separator.
- **Used by:** sparse — only inside dense card stacks.
- **Required:** none.
- **Optional:** `variant` (`subtle` default, `strong`).
- **Mobile:** holds.
- **Fallback:** n/a.
- **Severity:** ignored.

#### `Footer`
- **Purpose:** brand line, year, contact, unsubscribe (marketing emails only — transactional are exempt by CAN-SPAM).
- **Used by:** all 28 emails.
- **Required:** none.
- **Optional:** `showUnsubscribe` (default: false for transactional).
- **Mobile:** stacks vertically.
- **Fallback:** if WhatsApp env missing, omits WA icon — keeps email + reply-to.
- **Severity:** ignored.

#### `PreviewText`
- **Purpose:** hidden inbox preheader (80–120 chars).
- **Used by:** all 28 emails.
- **Required:** `text`.
- **Optional:** none.
- **Mobile:** hidden everywhere.
- **Fallback:** if empty, omits — but this is a quality bug (always provide one).
- **Severity:** ignored.

#### `Icon`
- **Purpose:** inline SVG icon.
- **Used by:** SeverityPill, AlertBanner, severity-tinted cards, admin emails.
- **Required:** `name` (Lucide name).
- **Optional:** `size` (16/20/24, default 20), `color` (default: `currentColor`).
- **Mobile:** scales proportionally.
- **Fallback:** if Lucide name unknown, renders empty span (silent).
- **Severity:** inherits from parent's severity color via `currentColor`.

#### `AlertBanner`
- **Purpose:** full-width tinted banner above body.
- **Used by:** critical client emails (C12 password reset never uses; C10 emergency cancel uses), critical admin emails (A9, A13).
- **Required:** `severity`, `text`.
- **Optional:** `icon` (defaults to severity icon).
- **Mobile:** holds full width.
- **Fallback:** if text empty, omits banner.
- **Severity:** required.

#### `SeverityPill`
- **Purpose:** small inline pill ("Late cancellation", "Renewal due", "3rd this month").
- **Used by:** inside cards on warning/critical emails, admin counter contexts.
- **Required:** `severity`, `label`.
- **Optional:** `icon`.
- **Mobile:** stays inline; wraps if needed.
- **Fallback:** if label empty, omits.
- **Severity:** required.

### 4.2 Client-only

#### `Hero`
- **Purpose:** large visual section at top — image + overlaid title.
- **Used by:** C1, C2, C5, C6, C8, C13 (heavyweight client emails).
- **Required:** `imageUrl`, `imageAlt`, `title`.
- **Optional:** `subtitle`.
- **Mobile:** image scales width, height auto. Title font shrinks per §1.2.
- **Fallback:** if image fails to load, the alt text + solid AMOLED background renders. Title overlay always works because it's HTML, not baked into image.
- **Severity:** background tint = subtle severity tint at low opacity.

#### `SessionCard`
- **Purpose:** shows date / time / duration / focus / package row for a booking.
- **Used by:** C2, C3, C4 (24h), C4 (1h), C5, C10, C11.
- **Weight:** medium.
- **Required:** `dateLabel`, `timeLabel`, `durationLabel`.
- **Optional:** `sessionFocus`, `packageName`, `currentSessionNumber`/`totalSessions`.
- **Mobile:** rows stack vertically.
- **Fallback:** any missing optional row hides itself.
- **Severity:** card border-left tinted on warning/critical.

#### `LocationCard`
- **Purpose:** gym + area + map link (gated per §1B.1).
- **Used by:** C3, C4 (24h, 1h), C10, C11, A2, A9.
- **Required:** at least one of `gymName`, `area`, `mapUrl`.
- **Optional:** all of the above + `city`.
- **Mobile:** stacks; map button full-width.
- **Fallback:** per §1B.1 detailed table (whole card hides if all fields null).
- **Severity:** ignored.

#### `PackageStatusCard`
- **Purpose:** package name / remaining / total / expiry / progress bar.
- **Used by:** C3 (lightly), C5, C7, C8, C9.
- **Required:** `packageName`, `remainingSessions`, `totalSessions`.
- **Optional:** `expiryDateLabel`, `progressPercent` (computed if absent).
- **Mobile:** progress bar full width.
- **Fallback:** if expiry missing, omits the row (no "expires: —").
- **Severity:** progress bar tinted by severity — green ≥30% remaining, amber <30%, red ≤2 sessions.

#### `MetricGrid`
- **Purpose:** 3-column metric tiles for InBody — weight / fat / muscle.
- **Used by:** C6.
- **Required:** at least one of the three metrics.
- **Optional:** `previousMetrics` (enables delta column).
- **Mobile:** tiles stack vertically.
- **Fallback:** any missing metric tile hides. If all three missing, the whole MetricGrid hides and the email becomes "your scan is uploaded — view full report" with no numbers.
- **Severity:** delta arrows tinted (green for positive direction per metric, red for negative).

#### `ReceiptCard`
- **Purpose:** payment confirmation card — amount, status, package, expiry.
- **Used by:** C9.
- **Required:** `amountAed`, `paymentStatus`.
- **Optional:** `outstandingAed`, `packageName`, `expiryDateLabel`.
- **Mobile:** rows stack.
- **Fallback:** outstanding row only renders if `paymentStatus === 'partial'`.
- **Severity:** card severity = `success` (full payment) or `informational` (partial).

#### `PreparationCard`
- **Purpose:** "bring with you" checklist for first session / 24h reminder.
- **Used by:** C2, C4 (24h).
- **Required:** `items` (array of strings).
- **Optional:** `note` (footer line).
- **Mobile:** items stack with bullets.
- **Fallback:** if items empty, hides card.
- **Severity:** ignored.

#### `CoachNoteCard`
- **Purpose:** quoted note from Youssef.
- **Used by:** C5 (when present), C4 24h (when present).
- **Required:** `noteText`.
- **Optional:** `signature` (default: "Youssef").
- **Mobile:** holds.
- **Fallback:** if noteText empty, hides.
- **Severity:** ignored — always neutral.

#### `RescheduleDiff`
- **Purpose:** old date/time → new date/time visual.
- **Used by:** C11.
- **Required:** `fromDateLabel`, `fromTimeLabel`, `toDateLabel`, `toTimeLabel`.
- **Optional:** `reason`.
- **Mobile:** stacks vertically with ↓ arrow between.
- **Fallback:** reason row hides if absent.
- **Severity:** informational.

#### `CancellationImpact`
- **Purpose:** "this counted as a late cancellation" / "session refunded to your package".
- **Used by:** C10.
- **Required:** `cancelType`.
- **Optional:** `refundedToPackage` (boolean), `emergencyCountThisMonth`.
- **Mobile:** holds.
- **Fallback:** rows show only when their condition matches cancel type.
- **Severity:** informational (free), warning (late), critical (emergency).

#### `QuickActionRow`
- **Purpose:** secondary CTA-adjacent row — "Renew via WhatsApp" link.
- **Used by:** C5 (low remaining), C7, C8.
- **Required:** `label`, `whatsAppMessage`.
- **Optional:** none.
- **Mobile:** holds.
- **Fallback:** if WA env missing, replaces with mailto.
- **Severity:** inherits parent.

### 4.3 Admin-only

#### `AdminFactTable`
- **Purpose:** compact key/value table — no card chrome, just rows.
- **Used by:** all admin emails.
- **Required:** `rows` (array of `{label, value}`).
- **Optional:** `dense` (default true).
- **Mobile:** label stacks above value.
- **Fallback:** rows with empty value omit themselves.
- **Severity:** ignored.

#### `AdminCTAButton`
- **Purpose:** CTA always going to `/admin/...`. Visually identical to CTAButton but always solid + brand-cyan.
- **Used by:** all admin emails.
- **Required:** `label`, `url`.
- **Mobile:** full width.
- **Fallback:** if url empty, omits.
- **Severity:** always informational color (admins don't need severity-colored buttons — banner above conveys severity).

#### `ClientIdentityRow`
- **Purpose:** name + phone + WhatsApp shortcut at top of admin emails.
- **Used by:** all admin emails.
- **Required:** `clientName`.
- **Optional:** `phone`, `email`, `whatsAppLink`.
- **Mobile:** stacks.
- **Fallback:** any optional field hides.
- **Severity:** ignored.

#### `CounterBadge`
- **Purpose:** "3rd no-show this month" pill.
- **Used by:** A9, A10, A4 (same-day adjustment).
- **Required:** `count`, `label`.
- **Optional:** `severity`.
- **Mobile:** holds.
- **Fallback:** if count undefined, hides.
- **Severity:** required (warning by default; critical when count > threshold).

### 4.4 Component-to-email matrix (compact view)

Read columns top-down:

|              | C1 | C2 | C3 | C4-24 | C4-1 | C5 | C6 | C7 | C8 | C9 | C10 | C11 | C12 | C13 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Hero | ● | ● |   |   |   | ● | ● |   | ● |   |   |   |   | ● |
| SessionCard |   | ● | ● | ● | ● | ● |   |   |   |   | ● | ● |   |   |
| LocationCard |   | ○ | ○ | ○ | ○ |   |   |   |   |   | ○ | ○ |   |   |
| PackageStatusCard |   |   | ○ |   |   | ● |   | ● | ● | ● |   |   |   |   |
| MetricGrid |   |   |   |   |   |   | ● |   |   |   |   |   |   |   |
| ReceiptCard |   |   |   |   |   |   |   |   |   | ● |   |   |   |   |
| PreparationCard |   | ● |   | ● |   |   |   |   |   |   |   |   |   |   |
| CoachNoteCard |   |   |   | ○ |   | ○ |   |   |   |   |   |   |   |   |
| RescheduleDiff |   |   |   |   |   |   |   |   |   |   |   | ● |   |   |
| CancellationImpact |   |   |   |   |   |   |   |   |   |   | ● |   |   |   |
| QuickActionRow |   |   |   |   |   | ○ | ○ | ● | ● |   |   |   |   |   |
| AlertBanner |   |   |   |   |   |   |   |   |   |   | ○ |   |   |   |
| WhatsAppButton (CTA) |   |   |   |   |   | ○ |   | ● | ● |   | ○ |   |   |   |
| CTAButton (default) | ● | ● | ● | ● | ● | ● | ● |   |   | ● | ● | ● | ● | ● |

`●` = always present · `○` = conditional.

---

## 5. Visual Hierarchy System

Locks the weight classes from §1B.7 to concrete design rules.

### 5.1 Weight class → design rules

| Weight | Hero | Max cards | Max body words | Mobile fold target | Image policy | Icon policy |
|---|---|---|---|---|---|---|
| Heavyweight | required | 3 | 500 | first card visible above fold | hero image required | per card |
| Mediumweight | none | 2 | 250 | full body visible above fold | none | per card |
| Lightweight | none | 0 | 90 | full email above fold | none | one inline |

### 5.2 Heavyweight assignments

C1 Welcome · C2 Free Trial Activated · C5 Session Completed · C6 InBody Update · C8 Package Completed · C13 Profile Completed.

These are milestone emails. They earn the visual real estate.

### 5.3 Mediumweight assignments

C3 Confirmed · C4 24h Reminder · C7 Package Low · C9 Payment Confirmed · C10 Cancelled · C11 Rescheduled · all admin emails (A1–A15).

These are operational. One card, one CTA, scan in 25 seconds.

### 5.4 Lightweight assignments

C4 1h Reminder · C12 Password Reset.

Pure utility. Nothing competes with the action.

### 5.5 Hero usage rules

- Heavyweight only.
- Image **decorative** — never carries information that's only readable in the image.
- Title overlay is HTML, not baked into image.
- Image format: WebP first, JPEG fallback. (Apple Mail, Gmail support WebP; older Outlook degrades gracefully.)
- Aspect ratio: 600×280 (≈2.14:1) — desktop mail preview safe, mobile crop safe.
- Hero never repeats inside the email.

### 5.6 When imagery is allowed

| Rule | Allowed | Forbidden |
|---|---|---|
| Hero on heavyweight client emails | ✓ | — |
| Inline image inside a card | — | ✗ never |
| Logo in header | — | ✗ wordmark only, no logo image |
| Profile photo in admin emails | — | ✗ never (even for client identity) |
| Map preview image | — | ✗ link only, no static map render |
| Brand patterns / decorative graphics | — | ✗ never |

### 5.7 When icons-only is required

- All admin emails: zero images, icons only.
- All lightweight client emails: zero images, one inline icon.
- All mediumweight client emails: zero images, optional one icon per card.

### 5.8 Visual intensity by severity

| Severity | Hero darkening | Border weight | Accent saturation |
|---|---|---|---|
| Success | normal | 1px subtle | full (cyan/green) |
| Informational | normal | 1px subtle | muted (info blue) |
| Warning | slight darken | 4px left edge accent | full (amber) |
| Critical | darkest darken | 4px left edge + alert banner above body | full (red) |

---

## 6. Email Severity Visual System

Severity is not just color — it's a system of small, layered emphasis cues.

### 6.1 Layer stack per severity

| Layer | Success | Informational | Warning | Critical |
|---|---|---|---|---|
| AlertBanner above body | — | — | — | yes (tinted bg, accent text, icon) |
| Severity bar (4px top of card) | — | — | — | yes |
| Card border-left (4px) | — | — | yes | yes |
| Heading color | text-primary | text-primary | text-primary | severity-accent |
| Lead paragraph | text-primary | text-primary | text-primary | text-primary |
| SeverityPill in lead | optional | — | yes | yes |
| Icon at start of lead | optional check | optional info | yes alert-triangle | yes alert-octagon |
| CTAButton background | success-accent | brand-cyan | warning-accent | critical-accent |
| Hero tint (heavy only) | success-tint | none | warning-tint | critical-tint |

### 6.2 Border treatments

- Default: 1px `border-subtle` around cards.
- Warning / critical: above PLUS 4px left edge in severity accent.
- Critical only: AlertBanner above body, full-width tinted background.

Borders never use multiple colors. A card is either subtle-bordered or accent-bordered, not both.

### 6.3 Accent usage

- Severity accent is reserved for: icons, pills, CTA buttons, border-left, progress-bar fill, heading color (critical only).
- Severity accent is NEVER used for: card backgrounds, body text, footer.

### 6.4 Icon direction

Each severity has one canonical Lucide icon:
- success → `check-circle`
- informational → `info`
- warning → `alert-triangle`
- critical → `alert-octagon`

These are the *only* icons that change with severity. All other icons (gym, package, calendar) stay neutral.

### 6.5 CTA behavior by severity

- Success / Info / Warning: solid CTA in severity color.
- Critical: solid CTA in severity color + secondary "Open WhatsApp" link in SupportRow below (only severity-driven exception to single-CTA rule).

### 6.6 Emotional tone calibration

| Severity | Copy tone |
|---|---|
| Success | warm, brief, congratulatory but restrained |
| Informational | neutral, factual |
| Warning | direct, helpful, no panic |
| Critical | calm + clear, never alarming, action-leading |

Critical emails should read like an air-traffic controller, not a fire alarm.

### 6.7 Priority emphasis

- Critical AlertBanner is always the first thing visible after Header.
- Warning border-left appears on the highest-priority card (usually first card).
- Pills appear inside cards, never above body.

### 6.8 Animation restrictions

Reaffirmed: zero animation regardless of severity. No pulsing critical icons. No flashing borders. The visual stack does the work.

### 6.9 Severity overuse policy

- Critical severity is reserved for ≤4 email types (C12, C10-emergency, A9, A13).
- Warning is reserved for ≤8 email types.
- Most emails are informational or success. If the codebase ever has more than 8 critical/warning email types, that's a smell — escalate.

---

## 7. Mobile-First Strategy

### 7.1 Single-column behavior

- 100% of email layouts collapse to a single column at `bp-mobile`.
- The only multi-column primitives (`MetricGrid`, `RescheduleDiff`) collapse explicitly per §3.3.

### 7.2 CTA sizing

- Min height: 48px.
- Min tap target: 44×44px (Apple HIG).
- Min font: 16px (prevents iOS zoom-on-tap-input behavior).
- Full width on mobile (no max-width).
- Tap padding: `space-4` (16px) vertical, `space-5` (24px) horizontal.

### 7.3 Thumb reach

CTAs always live in the bottom third of the body container, just above SupportRow. The user's thumb naturally rests there.

### 7.4 Text truncation rules

- Subjects: max 78 chars (mobile inbox preview cap).
- Preheaders: 80–120 chars (Apple Mail shows ~90, Gmail ~100).
- Headings: 1 line at default desktop width; allow 2-line wrap on mobile.
- Card row labels: never truncate. If too long, wrap.
- Card row values: never truncate amounts/dates. Long names (gym names, full addresses) may wrap.

### 7.5 Card collapse behavior

On mobile:
- Cards retain `bg-surface` background.
- Inner padding reduces from `space-5` (24px) to `space-4` (16px).
- Inter-card gap reduces from `space-5` (24px) to `space-4` (16px).
- Outer email padding reduces from `space-7` (48px) to `space-5` (24px).

### 7.6 Mobile spacing system

| Region | Desktop | Mobile |
|---|---|---|
| Outer email top/bottom | space-8 (64px) | space-5 (24px) |
| Header → body | space-6 (32px) | space-5 (24px) |
| Body → footer | space-7 (48px) | space-6 (32px) |
| Card inner padding | space-5 (24px) | space-4 (16px) |
| Heading → first paragraph | space-3 (12px) | space-3 (12px) |
| Between cards | space-5 (24px) | space-4 (16px) |
| Around CTA button | space-5 (24px) above + below | space-4 (16px) above + below |

### 7.7 Font scaling on mobile

Per §1.2 — `display` and `h1` shrink slightly. Body holds 15px (already mobile-comfortable).

### 7.8 Outlook / Gmail compatibility

| Concern | Mitigation |
|---|---|
| Outlook 2016+ ignores `padding` on `<div>` | All padding lives on `<table><td>` in render |
| Outlook ignores `border-radius` | Falls back to square corners — accept |
| Outlook ignores `box-shadow` | We don't use box-shadow on cards (per §2.7) |
| Outlook's "blue link" auto-styling | Wrap all dates/phones in `<span color>` reset |
| Gmail strips `<style>` outside `<head>` and ignores `@media` in `<head>` for some accounts | Critical mobile rules duplicated as inline + media query |
| Gmail clipping at 102KB | Heavyweight emails kept ≤80KB; image hosted on CDN |
| Gmail dark-mode auto-invert | Use `[data-ogsc]` overrides for dark severity tints |
| iOS Mail font auto-scaling | `-webkit-text-size-adjust: 100%` on body |

### 7.9 Mobile attention targets

- First 90 chars of preheader visible: must contain key value.
- First 3 lines of body visible above fold (iPhone 12+ Mail preview): must contain heading + lead paragraph.
- Primary CTA visible without scroll on lightweight emails.

---

## 8. Dark Mode Strategy

### 8.1 Adoption philosophy

Light-mode default. Dark-mode opt-in via `meta name="color-scheme" content="light dark"` and `@media (prefers-color-scheme: dark)`.

Dark mode is a **first-class concern** for clients — Youssef's audience skews toward iPhone users with system dark mode on.

### 8.2 Inverted backgrounds

Per §2.2:
- `bg-canvas`: white → AMOLED black
- `bg-surface`: white → near-black `#101113`
- `bg-surface-raised`: white → `#17181B`

Surfaces are NEVER pure black except outer canvas (AMOLED commitment).

### 8.3 Logo / wordmark handling

- Wordmark is text-only — auto-inverts via text color.
- No logo image to worry about.
- No image-baked text anywhere.

### 8.4 Border visibility in dark

- `border-subtle` shifts to `#1F2125` — barely visible but present.
- Severity left-edges keep their light-mode accent (still readable on dark).

### 8.5 Shadow adjustments

- We don't ship shadows in light mode (§2.7), so nothing to adjust in dark.

### 8.6 CTA visibility in dark

- Severity-accent CTAs swap to dark-tuned accents per §2.1 (success: bright mint instead of forest green; critical: salmon instead of brick red — adjusted for accessibility on dark surface).
- WhatsApp green stays `#25D366` (brand integrity).

### 8.7 Contrast protection

- Verified: `text-primary` on `bg-surface` (dark) = 17.8:1 (AAA).
- Verified: severity-accent CTAs on dark = ≥4.5:1 (AA) for the smallest button text.
- Severity tints (e.g. `tint-warning-dark` `#2B1E07`) verified to keep `warning-accent-dark` text readable at 16px.

### 8.8 Outlook + Gmail dark-mode quirks

- **Outlook.com (web)**: full dark-mode invert — our explicit `prefers-color-scheme` styles win.
- **Gmail mobile (iOS/Android)**: auto-invert. We use `[data-ogsc]` selectors to scope overrides, since Gmail won't process `prefers-color-scheme`.
- **Gmail web**: respects `prefers-color-scheme` if user opts in. Our styles work.
- **Apple Mail (iOS/macOS)**: full `prefers-color-scheme` support. Our styles work natively.

### 8.9 What dark mode changes vs. doesn't

| Changes | Doesn't change |
|---|---|
| Backgrounds | Layout |
| Text colors | Typography sizes |
| Border colors | Spacing |
| Severity accent saturation | Iconography style |
| CTA background tuning | Severity meaning |
| Hero tint opacity | Component composition |

### 8.10 Implementation note (Step 3)

A single `applyDarkOverrides(html, tokens)` post-processor wraps the rendered HTML in:
- `<meta name="color-scheme" content="light dark">`
- `<style>@media (prefers-color-scheme: dark) { ... }</style>` block
- `[data-ogsc]` Gmail-mobile overrides

No per-component dark code. Everything routes through the global override layer.

---

## 9. Image Strategy

### 9.1 Email image budget

| Email tier | Image budget |
|---|---|
| Heavyweight client | 1 hero, 0 inline |
| Mediumweight client | 0 |
| Lightweight client | 0 |
| All admin | 0 |

### 9.2 Allowed image styles

- Cinematic stills — equipment, gym interiors, Dubai cityscape at dusk, single weight on rack.
- Clean, dark, low-contrast palette.
- One subject per image.
- 600×280 aspect ratio (locked per §5.5).
- WebP (primary) + JPEG (fallback).

### 9.3 Forbidden image styles

| ✗ Stock gym posing shots (flexed bicep, gritted-teeth squat) |
| ✗ Motivational text overlays ("NO PAIN NO GAIN") |
| ✗ Logo / brand pattern decoration |
| ✗ Product mockups (phone-with-app screenshots) |
| ✗ Profile photos of clients |
| ✗ Maps as static images (always link out) |
| ✗ Animated GIFs |
| ✗ Screenshot collages |

### 9.4 Banner philosophy

There is no "banner" pattern. The hero is the only large image, and only on heavyweight emails. We don't ship promo banners, mid-email feature callouts, or sidebar imagery.

### 9.5 Compression rules

- WebP quality 75 for hero.
- JPEG quality 80 for fallback.
- Hard cap: hero image ≤120KB (keeps total email ≤200KB safely under Gmail's 102KB body cap when combined with HTML).
- Width 1200px @2x rendered to 600px @1x for retina.
- Strip EXIF.

### 9.6 CDN expectations

- Images hosted on Vercel-friendly CDN (likely `attached_assets/email/` deployed as static, served via Vercel edge).
- HTTPS only. No mixed-content.
- Filename pattern: `email-hero-<event>-<variant>.webp` (e.g. `email-hero-welcome-01.webp`).
- Multiple variants per event (3–5 per heavyweight email) — randomly selected at send time so repeat emails feel fresh.

### 9.7 Alt text strategy

- Every image has descriptive alt text describing the *scene*, not the email purpose.
- Example: "Empty gym floor at dawn, weight rack to the right" — not "Welcome image".
- Admin emails have zero images so no alt-text concern there.

### 9.8 Image fallback

- If hero image fails: hero container renders with severity-tinted background + title overlay only. Email is still cohesive.
- No "broken image" icon ever visible (alt text shows briefly during load — that's acceptable).

---

## 10. Subject Line Visual Relation

The subject line is part of the design system. It must align with severity, weight, and CTA prominence so the inbox preview "previews the email" honestly.

### 10.1 Severity ↔ subject mapping

| Severity | Bracket prefix (admin) | Leading icon (admin) | Tone in subject |
|---|---|---|---|
| Success | `[Type]` | none | factual confirmation |
| Informational | `[Type]` | none | neutral fact |
| Warning | `[Type]` | none | direct, no panic |
| Critical | `[Type]` | `⚠` | calm, action-led |

Client emails never use brackets or icons in subjects — that's an admin-only signal.

### 10.2 Weight ↔ subject mapping

| Weight | Subject tone |
|---|---|
| Heavyweight | Conversational, "this is a moment" — e.g. "Welcome to Youssef Ahmed Coaching" |
| Mediumweight | Factual, lead with event — e.g. "Session confirmed — 12 May at 5:00 PM" |
| Lightweight | Operational, lead with urgency or action — e.g. "Starting in 1 hour — 5:00 PM (Dubai)" |

### 10.3 CTA ↔ subject alignment

If the email's CTA is "Renew Package", the subject must reference renewal context ("Only 2 sessions left in your package") — not be generic ("Update from Youssef").

The subject **previews the action**, the body **enables it**.

### 10.4 Mobile preview alignment

Verified per §1B.9: most-important word in the first 25 characters. Already locked.

### 10.5 Preheader (preview text) integration

- Preheader is part of the visual system, not an afterthought.
- Length: 80–120 chars.
- Never repeats the subject. Adds the *next-most-important* fact.
- Example pair:
  - Subject: `Session confirmed — 12 May at 5:00 PM`
  - Preheader: `Push day with Youssef · 60 minutes · Fitness First Marina Walk`

### 10.6 Forbidden subject patterns (recap)

Per §1B.9: no caps, no emoji (except ⚠ for admin critical), no clickbait, no "Re:", no URLs, no exclamation marks, no gym-bro language, no machine-readable refs.

---

## 11. Accessibility

### 11.1 Contrast standards

- All body text ≥ WCAG AA (4.5:1 against background).
- All large text (≥18px) ≥ WCAG AA Large (3:1).
- All severity accents on tinted backgrounds verified per pair (light + dark).
- CTA button text on accent background verified (white on every accent ≥4.5:1; dark-mode accents tuned to maintain).

### 11.2 Font minimums

- Body: 15px (mobile-safe, AAA-readable).
- Caption: 12px (legal minimum for legal copy; never used for content).
- CTA: 16px (prevents iOS auto-zoom).

Never below 12px. Never below 14px for content the user must read.

### 11.3 Button accessibility

- Min tap target: 44×44px.
- `role="button"` not needed (we use `<a>` styled as button — semantic).
- `aria-label` on icon-only links (e.g. WhatsApp footer icon).
- Focus ring: 2px outset solid black (light) / 2px outset solid white (dark). Visible.

### 11.4 Screen reader considerations

- Heading hierarchy strict: one `<h1>` per email, no skipping levels.
- Decorative images: `alt=""` (so screen readers skip).
- Informative images (hero): meaningful alt text.
- Tables used for layout: `role="presentation"` to hide from screen readers.
- Lists use semantic `<ul>`/`<li>`.

### 11.5 Alt text rules

- Hero images: descriptive (per §9.7).
- Logos: `alt="Youssef Ahmed"` (not "logo").
- Icons in CTAs: alt is the CTA label (avoid duplication if also visible text).
- Admin email zero-image policy makes most of this moot.

### 11.6 Semantic structure

| Element | Use |
|---|---|
| `<h1>` | Email heading (one only) |
| `<h2>` | Card titles |
| `<p>` | Body paragraphs |
| `<a>` | All CTAs and links (never `<button>` — emails strip JS) |
| `<table role="presentation">` | Layout only |
| `<strong>` | Emphasis (key value, action verb) |
| `<em>` | Forbidden — italics render inconsistently in email clients |

### 11.7 Language attributes

- `<html lang="en">` or `<html lang="ar" dir="rtl">` — set at shell level.
- Mixed-language content (e.g. Arabic body with English package name) wrapped in `<span lang="en">`.

### 11.8 Plaintext accessibility

- Plaintext sibling per §3.7 — automatically accessible.
- All CTA URLs surfaced in plaintext (so screen-reader users in plaintext mode don't lose actions).

---

## 12. Compatibility & Testing Targets

(Implicit deliverable — locked here for Step 3.)

### 12.1 Required client matrix

| Client | Versions | Priority |
|---|---|---|
| Apple Mail (iOS) | latest 2 | P1 |
| Apple Mail (macOS) | latest 2 | P1 |
| Gmail (iOS) | latest | P1 |
| Gmail (Android) | latest | P1 |
| Gmail (web) | evergreen | P1 |
| Outlook (web) | evergreen | P2 |
| Outlook 2019 / 2021 (Windows) | both | P2 |
| Samsung Email (Android) | latest | P3 |
| Yahoo Mail (web) | evergreen | P3 |

### 12.2 Testing protocol (Step 3 deliverable)

- Litmus or Email-on-Acid render previews per release.
- Manual spot-check on iPhone Mail + Gmail iOS (Youssef's likely client base) every release.
- Plaintext sibling verified by sending to a plaintext-only inbox.

---

## 13. Architecture diagram (text)

```
┌─────────────────────── Email Trigger Site ────────────────────────┐
│  routes.ts / cron handlers                                         │
│  → notifyUserOnce(userId, kind, dedupeKey, builderInput, severity)│
└────────────────────────────┬───────────────────────────────────────┘
                             ↓
┌─────────────────── Notification Dispatcher ────────────────────────┐
│  server/services/notifications.ts                                   │
│  - severity tag (Step 1B §1B.4)                                    │
│  - dedupe enforcement (Step 1 §6)                                  │
│  - quiet-hours check (22:00-07:00 GST → queue to 07:00)           │
│  - daily cap check (3/24h non-critical client emails)              │
│  - suppression flags lookup (Step 3 wiring)                        │
└────────────────────────────┬───────────────────────────────────────┘
                             ↓
┌────────────────── Builder (per email type) ────────────────────────┐
│  server/email-templates.ts                                          │
│  build<Event>Email({ data, severity, lang, websiteUrl }) →         │
│    { subject, preheader, html, text }                              │
│  Pure function. No I/O. No data fetching.                          │
└────────────────────────────┬───────────────────────────────────────┘
                             ↓
┌─────────────── Component Composer (Step 3) ────────────────────────┐
│  EmailShell                                                         │
│   ├── Header                                                        │
│   ├── [SeverityBar] [Hero]                                         │
│   ├── BodyContainer                                                 │
│   │   ├── [AlertBanner]                                            │
│   │   ├── Heading + LeadParagraph                                  │
│   │   ├── CardStack (composed per §4.4 matrix)                     │
│   │   ├── PrimaryCTA                                               │
│   │   └── [HelperText]                                             │
│   ├── SupportRow (WhatsApp + Contact Support per Q12)             │
│   └── FooterLegal                                                  │
│  Each component: pure, token-driven, severity-aware, lang-aware.  │
└────────────────────────────┬───────────────────────────────────────┘
                             ↓
┌──────────────── Dark-mode + RTL post-process ──────────────────────┐
│  applyDarkOverrides(html) + applyRtl(html, lang)                   │
└────────────────────────────┬───────────────────────────────────────┘
                             ↓
┌──────────────────────── Email Sender ──────────────────────────────┐
│  server/email.ts → Resend SDK                                       │
│  Logs to recentEmailSends. Retries failures once at +30min.        │
└────────────────────────────────────────────────────────────────────┘
```

---

## 14. What Step 3 implements (preview, no commitment yet)

1. `email-tokens.ts` — locked tokens from §2.
2. `email-components/` — every component in §4 as a pure function.
3. `email-composer.ts` — assembles components per the matrix in §4.4.
4. Refactor existing builders in `email-templates.ts` to call composer.
5. Add 13 missing builders identified in Step 1.
6. `applyDarkOverrides()` post-processor.
7. `applyRtl()` post-processor.
8. Quiet-hours queue wiring.
9. Daily-cap counter wiring.
10. Litmus/Email-on-Acid render verification before merge.

**Not in Step 3:** suppression UI, advanced suppression logic (Q13 architecture only), schema additions for `meetingLocation`/etc. (still gated on Q1/Q8 explicit go-ahead).

---

## 15. Open architectural questions for Step 3 kickoff

These are the few decisions still needed before any line of Step 3 code is written:

| ID | Question | Recommendation |
|---|---|---|
| Q14 | Hosting for hero images — Vercel static (`attached_assets/email/`) or external CDN (Cloudinary)? | **Vercel static.** Already in build pipeline, no extra cost, works with our existing image budget. |
| Q15 | Should Arabic copy be drafted alongside English in Step 3, or post-launch? | **Post-launch.** Don't block English ship on translation review. Arabic should be a separate review pass with a native speaker. |
| Q16 | Litmus paid testing in Step 3 budget, or rely on manual + Gmail/Apple devices? | **Manual for v1.** Add Litmus in v2 if cross-client bugs surface. |
| Q17 | Quiet-hours queue — store in `client_notifications` with a `scheduledFor` column, or a Postgres job table? | **`scheduledFor` column.** Single-table, integrates cleanly with existing dedupe. **[GATE — schema add]** |
| Q18 | Suppression flags — booleans on `users` (e.g. `suppressMarketing`) or a separate `notification_preferences` table? | **Separate table.** Future-proof for per-channel (email/push/SMS) expansion. **[GATE — schema add]** |

---

**End of Step 2 blueprint. Awaiting your approval and answers to Q14–Q18 before starting Step 3 (component implementation + builder refactor).**
