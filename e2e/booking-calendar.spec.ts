/**
 * Booking Calendar — Playwright E2E Test
 *
 * Exercises the core client booking flow end-to-end in a real browser:
 *
 *  1. PAGE LOADS     – /book renders the calendar and time-slot grid once
 *                      the client has an active package.
 *  2. DATE SELECTION – clicking a future date reveals selectable time slots.
 *  3. FULL BOOKING   – selecting a date + slot + session focus + training goal
 *                      then confirming creates a booking and shows the success
 *                      card.
 *  4. DASHBOARD      – after a successful booking the confirmation appears on
 *                      the client's /dashboard.
 *
 * Prerequisites
 *   • App must be running on http://localhost:5000
 *   • Admin account: username="admin", password="change-this-password"
 *
 * Test data is seeded before the suite and torn down after.
 *
 * Run: npx playwright test e2e/booking-calendar.spec.ts
 */

import {
  test,
  expect,
  type Page,
  type APIRequestContext,
  type Browser,
} from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5000";
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "change-this-password";

// ── Test-client credentials (generated fresh each suite run) ─────────────────
const TS = Date.now();
const CLIENT_EMAIL = `e2e-booking-${TS}@test.invalid`;
const CLIENT_PASSWORD = "E2eBooking!2026";
const CLIENT_FULLNAME = "E2E Booking Client";

// ── Shared state (set in beforeAll) ──────────────────────────────────────────
let clientId = -1;
let packageId = -1;
let createdBookingId = -1;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function dismissCookieBanner(page: Page) {
  const banner = page.getByTestId("cookie-banner");
  if (await banner.isVisible().catch(() => false)) {
    await page.getByTestId("button-cookie-accept").click();
    await banner.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
  }
}

async function adminLogin(page: Page) {
  await page.goto(`${BASE}/admin-access`);
  await page.waitForSelector('[data-testid="input-admin-username"]', {
    timeout: 15_000,
  });
  await dismissCookieBanner(page);
  await page.fill('[data-testid="input-admin-username"]', ADMIN_USERNAME);
  await page.fill('[data-testid="input-admin-password"]', ADMIN_PASSWORD);
  await page.click('[data-testid="button-submit-admin-login"]');
  await page.waitForURL(/\/admin(?!-access)/, { timeout: 10_000 });
}

async function clientLogin(page: Page) {
  await page.goto(`${BASE}/auth`);
  await page.waitForSelector('[data-testid="input-email"]', { timeout: 10_000 });
  await dismissCookieBanner(page);
  await page.fill('[data-testid="input-email"]', CLIENT_EMAIL);
  await page.fill('[data-testid="input-password"]', CLIENT_PASSWORD);
  await page.click('[data-testid="button-submit-login"]');
  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), { timeout: 12_000 });
}

/**
 * Register the test client via the REST API.
 * Returns the new user's id, or -1 on failure.
 */
async function registerTestClient(
  request: APIRequestContext,
): Promise<number> {
  const today = new Date();
  const expiry = new Date(today);
  expiry.setFullYear(expiry.getFullYear() + 1);

  const res = await request.post(`${BASE}/api/auth/register`, {
    data: {
      email: CLIENT_EMAIL,
      password: CLIENT_PASSWORD,
      fullName: CLIENT_FULLNAME,
      phone: "+971 50 000 0001",
      area: "Dubai Marina",
      primaryGoal: "fat_loss",
      weeklyFrequency: 3,
      consents: {
        info_accurate: true,
        cancellation_policy: true,
        terms_conditions: true,
        medical_fitness: true,
        data_storage: true,
      },
    },
  });

  if (!res.ok()) {
    console.warn("[booking-calendar] register failed:", await res.text());
    return -1;
  }

  const body: { id?: number; user?: { id: number } } = await res.json();
  return body.id ?? body.user?.id ?? -1;
}

/**
 * Find the newly registered client by email via admin API.
 * Falls back to -1 if not found.
 */
async function findClientId(
  request: APIRequestContext,
  email: string,
): Promise<number> {
  const res = await request.get(`${BASE}/api/users`);
  if (!res.ok()) return -1;
  const users: Array<{ id: number; email?: string; role?: string }> =
    await res.json();
  const match = users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return match?.id ?? -1;
}

/**
 * Create an active package for the test client so they can book.
 */
async function createPackage(
  request: APIRequestContext,
  userId: number,
): Promise<number> {
  const today = new Date().toISOString().split("T")[0];
  const expiry = new Date();
  expiry.setFullYear(expiry.getFullYear() + 1);
  const expiryStr = expiry.toISOString().split("T")[0];

  const res = await request.post(`${BASE}/api/packages`, {
    data: {
      userId,
      name: "E2E Test Package",
      type: "solo",
      totalSessions: 20,
      usedSessions: 0,
      status: "active",
      isActive: true,
      startDate: today,
      expiryDate: expiryStr,
      paidSessions: 20,
      bonusSessions: 0,
      totalPrice: 2500,
      amountPaid: 2500,
    },
  });

  if (!res.ok()) {
    console.warn("[booking-calendar] createPackage failed:", await res.text());
    return -1;
  }

  const pkg: { id: number } = await res.json();
  return pkg.id ?? -1;
}

/**
 * Create a training location for the test client.
 * Must be called with the CLIENT's session (not admin).
 */
async function createTrainingLocation(
  request: APIRequestContext,
): Promise<void> {
  const res = await request.post(`${BASE}/api/training-locations`, {
    data: {
      kind: "home",
      label: "E2E Test Home",
      address: "123 Test Street, Dubai",
      isDefault: true,
    },
  });

  if (!res.ok()) {
    console.warn(
      "[booking-calendar] createTrainingLocation failed:",
      await res.text(),
    );
  }
}

/**
 * Cancel + hard-delete a booking via admin DELETE endpoint.
 */
async function deleteBooking(
  request: APIRequestContext,
  bookingId: number,
): Promise<void> {
  if (bookingId < 0) return;
  // Cancel first so sessions are restored
  await request.post(`${BASE}/api/bookings/${bookingId}/cancel`, { data: {} });
  // Then hard-delete via admin endpoint
  await request.delete(`${BASE}/api/bookings/${bookingId}`);
}

/**
 * Delete the test package.
 */
async function deletePackage(
  request: APIRequestContext,
  pkgId: number,
): Promise<void> {
  if (pkgId < 0) return;
  await request.delete(`${BASE}/api/packages/${pkgId}`);
}

/**
 * Soft-delete the test client.
 */
async function deleteClient(
  request: APIRequestContext,
  userId: number,
): Promise<void> {
  if (userId < 0) return;
  await request.delete(`${BASE}/api/users/${userId}`);
}

/**
 * Build a future date string (YYYY-MM-DD) that is `daysAhead` days from today.
 * Guaranteed to be well beyond the 3-hour advance-booking cutoff.
 */
function futureDateStr(daysAhead = 14): string {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
}

/**
 * Click the correct day cell in the shadcn Calendar.
 *
 * The Calendar renders a grid of <button> day cells. We navigate forward
 * month-by-month until the target date is in view, then click its cell.
 */
async function selectCalendarDate(page: Page, dateStr: string): Promise<void> {
  const [year, month, day] = dateStr.split("-").map(Number);
  const calendarEl = page.locator('[data-testid="calendar-booking"]');
  await calendarEl.waitFor({ timeout: 10_000 });

  // Navigate forward months until the target month/year is displayed.
  // The Calendar's header shows e.g. "May 2026" or "June 2026".
  const MONTHS = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  const targetMonthName = MONTHS[month - 1];
  const targetLabel = `${targetMonthName} ${year}`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const headerText = await calendarEl
      .locator('[role="presentation"] h2, [class*="caption"] span, [class*="month"] span, h2')
      .first()
      .textContent()
      .catch(() => "");

    if (headerText && headerText.includes(targetLabel)) break;

    // Try clicking the "next month" navigation button
    const nextBtn = calendarEl
      .locator('button[name="next-month"], button[aria-label*="next" i], button[aria-label*="Next" i]')
      .first();

    if (await nextBtn.isVisible().catch(() => false)) {
      await nextBtn.click();
      await page.waitForTimeout(300);
    } else {
      break;
    }
  }

  // Click the day cell — match the day number as a standalone word, enabled only.
  const dayCells = calendarEl
    .locator(`button:not([disabled]):not([aria-disabled="true"])`)
    .filter({ hasText: new RegExp(`^${day}$`) });

  await dayCells.first().click({ timeout: 8_000 });
}

// ── Global setup / teardown ───────────────────────────────────────────────────

test.describe("Booking Calendar", () => {
  // We use a fresh browser context per describe block so cookie state
  // does not bleed between admin and client sessions.

  test.beforeAll(async ({ browser }: { browser: Browser }) => {
    // ── Step 1: Register the test client ──────────────────────────────────────
    const unauthCtx = await browser.newContext();
    const unauthReq = unauthCtx.request;
    clientId = await registerTestClient(unauthReq);
    await unauthCtx.close();

    // ── Step 2: Admin context — look up client + create package ───────────────
    // Use direct API login (not browser-based) so the session cookie is carried
    // by the APIRequestContext on subsequent admin API calls.
    const adminCtx = await browser.newContext();
    const adminRequest = adminCtx.request;
    const adminLoginRes = await adminRequest.post(`${BASE}/api/auth/login`, {
      data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    });
    if (!adminLoginRes.ok()) {
      console.warn("[booking-calendar] admin API login failed:", await adminLoginRes.text());
    }

    // If register returned -1 (rate-limited or duplicate), try to find by email
    if (clientId < 0) {
      clientId = await findClientId(adminRequest, CLIENT_EMAIL);
    }

    if (clientId > 0) {
      packageId = await createPackage(adminRequest, clientId);
    }

    await adminCtx.close();

    // ── Step 3: Client context — add a training location ──────────────────────
    // Use direct API login so the session cookie is carried on API calls.
    if (clientId > 0) {
      const clientCtx = await browser.newContext();
      const clientRequest = clientCtx.request;
      // LocalStrategy tries by username first, then by email — sending the
      // email as the username field works because it falls through to email lookup.
      await clientRequest.post(`${BASE}/api/auth/login`, {
        data: { username: CLIENT_EMAIL, password: CLIENT_PASSWORD },
      });
      await createTrainingLocation(clientRequest);
      await clientCtx.close();
    }
  });

  test.afterAll(async ({ browser }: { browser: Browser }) => {
    const adminCtx = await browser.newContext();
    const adminReq = adminCtx.request;
    await adminReq.post(`${BASE}/api/auth/login`, {
      data: { username: ADMIN_USERNAME, password: ADMIN_PASSWORD },
    });
    await deleteBooking(adminReq, createdBookingId);
    await deletePackage(adminReq, packageId);
    await deleteClient(adminReq, clientId);
    await adminCtx.close();
  });

  // ── Test 1: Page loads ─────────────────────────────────────────────────────
  test("booking page renders the calendar and page title", async ({
    page,
  }) => {
    await clientLogin(page);
    await page.goto(`${BASE}/book`);
    await page.waitForLoadState("networkidle");

    // The page should land on /book, not redirect to /wizard
    expect(page.url()).toContain("/book");

    await expect(page.getByTestId("text-page-title")).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("calendar-booking")).toBeVisible({
      timeout: 10_000,
    });
  });

  // ── Test 2: Selecting a date shows time slots ──────────────────────────────
  test("selecting a future date reveals time slots", async ({ page }) => {
    await clientLogin(page);
    await page.goto(`${BASE}/book`);
    await page.waitForLoadState("networkidle");

    await selectCalendarDate(page, futureDateStr(14));

    // At least one slot button should be visible after date selection
    const anySlot = page
      .locator('[data-testid^="slot-"]')
      .first();
    await expect(anySlot).toBeVisible({ timeout: 10_000 });
  });

  // ── Test 3: Full booking flow → success card ───────────────────────────────
  test("client can book a session: date → slot → preferences → confirm → success", async ({
    page,
  }) => {
    test.slow(); // Allocate extra time for the multi-step flow

    await clientLogin(page);
    await page.goto(`${BASE}/book`);
    await page.waitForLoadState("networkidle");

    // Pick a date 14 days out
    const targetDate = futureDateStr(14);
    await selectCalendarDate(page, targetDate);

    // Wait for slots to load
    await page.waitForSelector('[data-testid^="slot-"]', { timeout: 10_000 });

    // Click the first available (non-disabled) slot
    const availableSlot = page
      .locator('[data-testid^="slot-"]:not([disabled])')
      .first();

    const slotCount = await availableSlot.count();
    if (slotCount === 0) {
      test.skip(true, "No available slots on the chosen date — skipping");
      return;
    }

    await availableSlot.click();

    // Fill session focus — pick the first focus pill in any category tab
    const firstFocusTab = page
      .locator('[data-testid^="tab-focus-category-"]')
      .first();
    if (await firstFocusTab.isVisible({ timeout: 3_000 }).catch(() => false)) {
      await firstFocusTab.click();
    }

    const firstFocusPill = page
      .locator('[data-testid^="pill-focus-"]')
      .first();
    await expect(firstFocusPill).toBeVisible({ timeout: 6_000 });
    await firstFocusPill.click();

    // Fill training goal
    const firstGoalPill = page
      .locator('[data-testid^="pill-goal-"]')
      .first();
    await expect(firstGoalPill).toBeVisible({ timeout: 6_000 });
    await firstGoalPill.click();

    // Open confirm dialog — the sticky CTA at the bottom
    const openConfirmBtn = page.getByTestId("button-open-confirm");
    await expect(openConfirmBtn).toBeVisible({ timeout: 8_000 });
    await openConfirmBtn.click();

    // Confirm dialog should appear
    const dialog = page.getByTestId("dialog-confirm-booking");
    await expect(dialog).toBeVisible({ timeout: 8_000 });

    // Accept the policy checkbox
    const policyCheckbox = page.getByTestId("checkbox-accept-policy");
    await expect(policyCheckbox).toBeVisible({ timeout: 6_000 });
    await policyCheckbox.click();

    // Submit the booking
    const confirmBtn = page.getByTestId("button-confirm-booking");
    await expect(confirmBtn).toBeEnabled({ timeout: 5_000 });
    await confirmBtn.click();

    // Success card or title should appear
    const successTitle = page.getByTestId("text-success-title");
    await expect(successTitle).toBeVisible({ timeout: 15_000 });

    // Capture the booking id for cleanup — it's embedded in the "go to dashboard"
    // button which navigates to /dashboard (booking id surfaced via API later)
    const goToDash = page.getByTestId("button-go-dashboard");
    await expect(goToDash).toBeVisible({ timeout: 5_000 });

    // Retrieve created booking id via API for teardown
    const bookingsRes = await page.request.get(`${BASE}/api/bookings`);
    if (bookingsRes.ok()) {
      const bookings: Array<{ id: number; date?: string }> =
        await bookingsRes.json();
      const match = bookings.find((b) => b.date === targetDate);
      if (match) createdBookingId = match.id;
    }
  });

  // ── Test 4: Booking appears on the dashboard ───────────────────────────────
  test("confirmed booking appears on the client dashboard", async ({
    page,
  }) => {
    // This test depends on test 3 having created a booking.
    // If no booking was created (e.g. no available slots), skip gracefully.
    if (createdBookingId < 0) {
      test.skip(true, "No booking was created in the previous test — skipping dashboard check");
      return;
    }

    await clientLogin(page);
    await page.goto(`${BASE}/dashboard`);
    await page.waitForLoadState("networkidle");

    // The booking cards live inside the "DashboardShowMore" secondary section,
    // which is collapsed by default. Expand it first.
    const showMoreBtn = page.getByTestId("btn-dashboard-show-more");
    if (await showMoreBtn.isVisible({ timeout: 5_000 }).catch(() => false)) {
      const isExpanded = await showMoreBtn.getAttribute("aria-expanded");
      if (isExpanded !== "true") {
        await showMoreBtn.click();
        await page.waitForTimeout(400); // let the animation settle
      }
    }

    // Navigate to the "My Training" (bookings) tab
    const bookingsTab = page.getByTestId("tab-bookings");
    if (await bookingsTab.isVisible({ timeout: 5_000 }).catch(() => false)) {
      await bookingsTab.click();
      await page.waitForTimeout(300);
    }

    // The booking card for the created booking should now be visible
    const bookingCard = page.getByTestId(`booking-card-${createdBookingId}`);
    await expect(bookingCard).toBeVisible({ timeout: 12_000 });
  });
});
