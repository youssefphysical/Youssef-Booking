/**
 * Wizard Onboarding — Playwright E2E Test
 *
 * Exercises the post-registration training-location wizard (/wizard):
 *
 *  1. REDIRECT     – after registration, /dashboard bounces a new client
 *                    with no training location to /wizard (guard in
 *                    ClientDashboard.tsx, Task #28).
 *  2. STEP 1+2     – picks "Building Gym", fills the required Maps link,
 *                    clicks Finish → app navigates to /book.
 *  3. ONE-CLICK    – picks "Fitness Zone" (no step 2) → app navigates
 *                    to /book immediately.
 *  4. CLEANUP      – deletes every test account created in this run via
 *                    the admin API in afterAll.
 *
 * Each test registers a **fresh unique account** so they are fully
 * independent and can run in any order without uniqueness conflicts.
 *
 * Prerequisites
 *   • App must be running on http://localhost:5000
 *   • Admin account: username="admin", password="change-this-password"
 *
 * Run: npx playwright test e2e/wizard-onboarding.spec.ts
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
const CLIENT_PASSWORD = "E2eWiz!2026";

// Collect every email created across all tests so afterAll can purge them.
const createdEmails: string[] = [];

// ── Credential factory ────────────────────────────────────────────────────────

/** Returns a fresh set of credentials unique to this invocation. */
function makeCredentials(tag: string) {
  const ts = Date.now();
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return {
    email: `e2e-wizard-${tag}-${ts}@test.invalid`,
    fullname: `E2E Wizard ${tag}`,
    // UAE local phone — 9 digits starting with 5. Combine tag hash, ts tail, rand.
    phone: `5${String(tag.length)}${String(ts).slice(-5)}${rand}`.slice(0, 9),
  };
}

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

async function findClientId(
  request: APIRequestContext,
  email: string,
): Promise<number> {
  const res = await request.get(`${BASE}/api/users`);
  if (!res.ok()) return -1;
  const users: Array<{ id: number; email?: string }> = await res.json();
  const match = users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );
  return match?.id ?? -1;
}

async function deleteClient(
  request: APIRequestContext,
  userId: number,
): Promise<void> {
  if (userId < 0) return;
  await request.delete(`${BASE}/api/users/${userId}`);
}

async function fillAreaField(page: Page, prefix: string) {
  await page.fill('[data-testid="input-area"]', prefix);
  const firstOption = page.getByTestId("option-area-0");
  await firstOption.waitFor({ timeout: 6_000 });
  await firstOption.click();
}

async function selectOption(
  page: Page,
  triggerTestId: string,
  textPattern: RegExp,
) {
  await page.getByTestId(triggerTestId).click();
  const option = page
    .locator('[role="option"]')
    .filter({ hasText: textPattern })
    .first();
  await option.waitFor({ timeout: 6_000 });
  await option.click();
}

/**
 * Register a brand-new client, wait for the post-registration redirect,
 * and return the email used (so the caller can track it for cleanup).
 */
async function registerClient(
  page: Page,
  creds: { email: string; fullname: string; phone: string },
): Promise<void> {
  await page.goto(`${BASE}/auth`);
  await page.waitForLoadState("networkidle");
  await dismissCookieBanner(page);

  const registerTab = page.getByTestId("tab-register");
  await registerTab.waitFor({ timeout: 10_000 });
  await registerTab.click();

  await page.fill('[data-testid="input-fullname"]', creds.fullname);
  await page.fill('[data-testid="input-register-email"]', creds.email);
  await page.fill('[data-testid="input-register-password"]', CLIENT_PASSWORD);
  await page.getByTestId("input-register-phone").fill(creds.phone);

  await fillAreaField(page, "Dubai");
  await selectOption(page, "select-weekly-frequency", /Momentum/i);

  await page.getByTestId("button-next-step").click();

  const submitBtn = page.getByTestId("button-submit-register");
  await submitBtn.waitFor({ timeout: 10_000 });

  await selectOption(page, "select-primary-goal", /fat.?loss/i);

  const consentCheckbox = page.getByTestId("checkbox-consent-agree_all");
  await consentCheckbox.check();
  await expect(consentCheckbox).toBeChecked();

  await expect(submitBtn).toBeEnabled({ timeout: 5_000 });
  await submitBtn.click();

  await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
    timeout: 20_000,
  });
}

// ── Teardown ──────────────────────────────────────────────────────────────────

test.afterAll(async ({ browser }: { browser: Browser }) => {
  if (createdEmails.length === 0) return;
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  try {
    await adminLogin(adminPage);
    const req = adminPage.context().request;
    for (const email of createdEmails) {
      const userId = await findClientId(req, email);
      if (userId > 0) await deleteClient(req, userId);
    }
  } catch {
    // best-effort cleanup — don't fail the suite over teardown
  } finally {
    await adminCtx.close();
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Wizard Onboarding", () => {
  test("new client is bounced to /wizard when navigating to /dashboard", async ({
    page,
  }) => {
    const creds = makeCredentials("redirect");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    // ClientDashboard.tsx has a wizard gate (Task #28): any authenticated
    // client with no training location and no active package is immediately
    // redirected to /wizard. Navigating to /dashboard triggers this guard.
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL(/\/wizard/, { timeout: 15_000 });

    // The URL must be /wizard — allowing /dashboard would let the guard
    // regression pass silently, which is exactly what this test prevents.
    expect(new URL(page.url()).pathname).toBe("/wizard");

    // The wizard UI itself should render correctly.
    await expect(page.getByTestId("wizard-training-location")).toBeVisible();
    await expect(page.getByTestId("text-wizard-title")).toBeVisible();
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible();
  });

  test("completes the building-gym wizard path (step 1 + step 2) and reaches /book", async ({
    page,
  }) => {
    const creds = makeCredentials("building");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    // Navigate to the wizard directly.
    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // ── Step 1: branch picker ─────────────────────────────────────────────────
    await expect(page.getByTestId("text-wizard-title")).toBeVisible();
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible();

    // Select "Building Gym" — advances to step 2.
    const buildingBranchBtn = page.getByTestId("button-branch-building");
    await buildingBranchBtn.waitFor({ timeout: 8_000 });
    await buildingBranchBtn.click();

    // ── Step 2: building-location form ───────────────────────────────────────
    const buildingForm = page.getByTestId("form-building-location");
    await buildingForm.waitFor({ timeout: 8_000 });

    // Google Maps link is the only required field for building-gym training.
    await page.fill(
      '[data-testid="input-building-maps-link"]',
      "https://maps.google.com/?q=Dubai+Marina",
    );

    // ── Finish ────────────────────────────────────────────────────────────────
    const finishBtn = page.getByTestId("button-wizard-finish");
    await expect(finishBtn).toBeVisible();
    await expect(finishBtn).toBeEnabled();
    await finishBtn.click();

    // ── Verify redirect to /book ──────────────────────────────────────────────
    // decideNextRoute resolves to /book?type=free_trial for a client with no
    // package. Accept any /book path (query string varies).
    await page.waitForURL((url) => url.pathname.startsWith("/book"), {
      timeout: 20_000,
    });
    expect(new URL(page.url()).pathname).toBe("/book");

    // No inline submission error should have appeared.
    await expect(page.getByTestId("text-wizard-inline-error")).not.toBeVisible();
  });

  test("stays on /wizard and shows an error when Finish is clicked with blank required fields", async ({
    page,
  }) => {
    const creds = makeCredentials("blank");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // ── Step 1: pick "Building Gym" (requires a Maps link in step 2) ──────────
    const buildingBranchBtn = page.getByTestId("button-branch-building");
    await buildingBranchBtn.waitFor({ timeout: 8_000 });
    await buildingBranchBtn.click();

    // ── Step 2: form visible but leave Maps link blank ────────────────────────
    const buildingForm = page.getByTestId("form-building-location");
    await buildingForm.waitFor({ timeout: 8_000 });

    // Confirm the Maps link input exists and is indeed empty.
    const mapsInput = page.getByTestId("input-building-maps-link");
    await expect(mapsInput).toBeVisible();
    await expect(mapsInput).toHaveValue("");

    // ── Click Finish with no Maps link filled ─────────────────────────────────
    const finishBtn = page.getByTestId("button-wizard-finish");
    await expect(finishBtn).toBeVisible();
    await expect(finishBtn).toBeEnabled();
    await finishBtn.click();

    // ── URL must still be /wizard — no navigation should have occurred ─────────
    await page.waitForTimeout(1_500);
    expect(new URL(page.url()).pathname).toBe("/wizard");

    // ── Inline error must appear under the submit button ──────────────────────
    await expect(page.getByTestId("text-wizard-inline-error")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("stays on /wizard and shows an error when Hotel Finish is clicked with blank Maps link", async ({
    page,
  }) => {
    const creds = makeCredentials("blank-hotel");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // ── Step 1: pick "Hotel Training" (requires a Maps link in step 2) ────────
    const hotelBranchBtn = page.getByTestId("button-branch-hotel");
    await hotelBranchBtn.waitFor({ timeout: 8_000 });
    await hotelBranchBtn.click();

    // ── Step 2: form visible but leave Maps link blank ────────────────────────
    const hotelForm = page.getByTestId("form-hotel-location");
    await hotelForm.waitFor({ timeout: 8_000 });

    // Confirm the Maps link input exists and is indeed empty.
    const mapsInput = page.getByTestId("input-hotel-maps-link");
    await expect(mapsInput).toBeVisible();
    await expect(mapsInput).toHaveValue("");

    // ── Click Finish with no Maps link filled ─────────────────────────────────
    const finishBtn = page.getByTestId("button-wizard-finish");
    await expect(finishBtn).toBeVisible();
    await expect(finishBtn).toBeEnabled();
    await finishBtn.click();

    // ── URL must still be /wizard — no navigation should have occurred ─────────
    await page.waitForTimeout(1_500);
    expect(new URL(page.url()).pathname).toBe("/wizard");

    // ── Inline error must appear under the submit button ──────────────────────
    await expect(page.getByTestId("text-wizard-inline-error")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("stays on /wizard and shows an error when Home Finish is clicked with blank Address", async ({
    page,
  }) => {
    const creds = makeCredentials("blank-home");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // ── Step 1: pick "Home" (requires an address in step 2) ───────────────────
    const homeBranchBtn = page.getByTestId("button-branch-home");
    await homeBranchBtn.waitFor({ timeout: 8_000 });
    await homeBranchBtn.click();

    // ── Step 2: form visible but leave Address blank ──────────────────────────
    const homeForm = page.getByTestId("form-home-location");
    await homeForm.waitFor({ timeout: 8_000 });

    // Confirm the address input exists and is indeed empty.
    const addressInput = page.getByTestId("input-home-address");
    await expect(addressInput).toBeVisible();
    await expect(addressInput).toHaveValue("");

    // ── Click Finish with no address filled ───────────────────────────────────
    const finishBtn = page.getByTestId("button-wizard-finish");
    await expect(finishBtn).toBeVisible();
    await expect(finishBtn).toBeEnabled();
    await finishBtn.click();

    // ── URL must still be /wizard — no navigation should have occurred ─────────
    await page.waitForTimeout(1_500);
    expect(new URL(page.url()).pathname).toBe("/wizard");

    // ── Inline error must appear under the submit button ──────────────────────
    await expect(page.getByTestId("text-wizard-inline-error")).toBeVisible({
      timeout: 5_000,
    });
  });

  test("Back button on step 2 returns to the branch picker (step 1)", async ({
    page,
  }) => {
    const creds = makeCredentials("back");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // ── Step 1: branch picker should be visible ───────────────────────────────
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible();

    // Click "Building Gym" to advance to step 2.
    const buildingBranchBtn = page.getByTestId("button-branch-building");
    await buildingBranchBtn.waitFor({ timeout: 8_000 });
    await buildingBranchBtn.click();

    // ── Step 2: building-location form should now be visible ──────────────────
    const buildingForm = page.getByTestId("form-building-location");
    await buildingForm.waitFor({ timeout: 8_000 });

    // Branch picker grid must be gone at this point.
    await expect(page.getByTestId("grid-wizard-branches")).not.toBeVisible();

    // ── Click the Back button ─────────────────────────────────────────────────
    const backBtn = page.getByTestId("button-wizard-back");
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // ── Verify we are back on step 1 ─────────────────────────────────────────
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible({
      timeout: 5_000,
    });

    // Step 2 form must no longer be visible.
    await expect(page.getByTestId("form-building-location")).not.toBeVisible();

    // URL should still be /wizard — no navigation away.
    expect(new URL(page.url()).pathname).toBe("/wizard");
  });

  test("Back button on step 2 (Hotel) returns to the branch picker", async ({
    page,
  }) => {
    const creds = makeCredentials("back-hotel");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // ── Step 1: branch picker should be visible ───────────────────────────────
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible();

    // Click "Hotel Training" to advance to step 2.
    const hotelBranchBtn = page.getByTestId("button-branch-hotel");
    await hotelBranchBtn.waitFor({ timeout: 8_000 });
    await hotelBranchBtn.click();

    // ── Step 2: hotel-location form should now be visible ─────────────────────
    const hotelForm = page.getByTestId("form-hotel-location");
    await hotelForm.waitFor({ timeout: 8_000 });

    // Branch picker grid must be gone at this point.
    await expect(page.getByTestId("grid-wizard-branches")).not.toBeVisible();

    // ── Click the Back button ─────────────────────────────────────────────────
    const backBtn = page.getByTestId("button-wizard-back");
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // ── Verify we are back on step 1 ─────────────────────────────────────────
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible({
      timeout: 5_000,
    });

    // Step 2 form must no longer be visible.
    await expect(page.getByTestId("form-hotel-location")).not.toBeVisible();

    // URL should still be /wizard — no navigation away.
    expect(new URL(page.url()).pathname).toBe("/wizard");
  });

  test("Back button on step 2 (Other Location) returns to the branch picker", async ({
    page,
  }) => {
    const creds = makeCredentials("back-other");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // ── Step 1: branch picker should be visible ───────────────────────────────
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible();

    // Click "Outdoor / Custom Workout" to advance to step 2.
    const otherBranchBtn = page.getByTestId("button-branch-other_location");
    await otherBranchBtn.waitFor({ timeout: 8_000 });
    await otherBranchBtn.click();

    // ── Step 2: other-location form should now be visible ─────────────────────
    const otherForm = page.getByTestId("form-other-location");
    await otherForm.waitFor({ timeout: 8_000 });

    // Branch picker grid must be gone at this point.
    await expect(page.getByTestId("grid-wizard-branches")).not.toBeVisible();

    // ── Click the Back button ─────────────────────────────────────────────────
    const backBtn = page.getByTestId("button-wizard-back");
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // ── Verify we are back on step 1 ─────────────────────────────────────────
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible({
      timeout: 5_000,
    });

    // Step 2 form must no longer be visible.
    await expect(page.getByTestId("form-other-location")).not.toBeVisible();

    // URL should still be /wizard — no navigation away.
    expect(new URL(page.url()).pathname).toBe("/wizard");
  });

  test("Back button on step 2 (Online Coaching) returns to the branch picker", async ({
    page,
  }) => {
    const creds = makeCredentials("back-online");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // ── Step 1: branch picker should be visible ───────────────────────────────
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible();

    // Click "Online Coaching" to advance to step 2.
    const onlineBranchBtn = page.getByTestId("button-branch-online_coaching");
    await onlineBranchBtn.waitFor({ timeout: 8_000 });
    await onlineBranchBtn.click();

    // ── Step 2: online-coaching form should now be visible ────────────────────
    const onlineForm = page.getByTestId("form-online-coaching");
    await onlineForm.waitFor({ timeout: 8_000 });

    // Branch picker grid must be gone at this point.
    await expect(page.getByTestId("grid-wizard-branches")).not.toBeVisible();

    // ── Click the Back button ─────────────────────────────────────────────────
    const backBtn = page.getByTestId("button-wizard-back");
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // ── Verify we are back on step 1 ─────────────────────────────────────────
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible({
      timeout: 5_000,
    });

    // Step 2 form must no longer be visible.
    await expect(page.getByTestId("form-online-coaching")).not.toBeVisible();

    // URL should still be /wizard — no navigation away.
    expect(new URL(page.url()).pathname).toBe("/wizard");
  });

  test("Back button on step 2 (Home) returns to the branch picker", async ({
    page,
  }) => {
    const creds = makeCredentials("back-home");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // ── Step 1: branch picker should be visible ───────────────────────────────
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible();

    // Click "Home" to advance to step 2.
    const homeBranchBtn = page.getByTestId("button-branch-home");
    await homeBranchBtn.waitFor({ timeout: 8_000 });
    await homeBranchBtn.click();

    // ── Step 2: home-location form should now be visible ─────────────────────
    const homeForm = page.getByTestId("form-home-location");
    await homeForm.waitFor({ timeout: 8_000 });

    // Branch picker grid must be gone at this point.
    await expect(page.getByTestId("grid-wizard-branches")).not.toBeVisible();

    // ── Click the Back button ─────────────────────────────────────────────────
    const backBtn = page.getByTestId("button-wizard-back");
    await expect(backBtn).toBeVisible();
    await backBtn.click();

    // ── Verify we are back on step 1 ─────────────────────────────────────────
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible({
      timeout: 5_000,
    });

    // Step 2 form must no longer be visible.
    await expect(page.getByTestId("form-home-location")).not.toBeVisible();

    // URL should still be /wizard — no navigation away.
    expect(new URL(page.url()).pathname).toBe("/wizard");
  });

  test("completes the hotel wizard path (step 1 + step 2) and reaches /book", async ({
    page,
  }) => {
    const creds = makeCredentials("hotel");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // ── Step 1: branch picker ─────────────────────────────────────────────────
    await expect(page.getByTestId("text-wizard-title")).toBeVisible();
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible();

    // Select "Hotel Training" — advances to step 2.
    const hotelBranchBtn = page.getByTestId("button-branch-hotel");
    await hotelBranchBtn.waitFor({ timeout: 8_000 });
    await hotelBranchBtn.click();

    // ── Step 2: hotel-location form ───────────────────────────────────────────
    const hotelForm = page.getByTestId("form-hotel-location");
    await hotelForm.waitFor({ timeout: 8_000 });

    // Google Maps link is the only required field for hotel training.
    await page.fill(
      '[data-testid="input-hotel-maps-link"]',
      "https://maps.google.com/?q=Marriott+Dubai+Marina",
    );

    // ── Finish ────────────────────────────────────────────────────────────────
    const finishBtn = page.getByTestId("button-wizard-finish");
    await expect(finishBtn).toBeVisible();
    await expect(finishBtn).toBeEnabled();
    await finishBtn.click();

    // ── Verify redirect to /book ──────────────────────────────────────────────
    await page.waitForURL((url) => url.pathname.startsWith("/book"), {
      timeout: 20_000,
    });
    expect(new URL(page.url()).pathname).toBe("/book");

    // No inline submission error should have appeared.
    await expect(page.getByTestId("text-wizard-inline-error")).not.toBeVisible();
  });

  test("completes the home wizard path (step 1 + step 2) and reaches /book", async ({
    page,
  }) => {
    const creds = makeCredentials("home");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // ── Step 1: branch picker ─────────────────────────────────────────────────
    await expect(page.getByTestId("text-wizard-title")).toBeVisible();
    await expect(page.getByTestId("grid-wizard-branches")).toBeVisible();

    // Select "Home" — advances to step 2.
    const homeBranchBtn = page.getByTestId("button-branch-home");
    await homeBranchBtn.waitFor({ timeout: 8_000 });
    await homeBranchBtn.click();

    // ── Step 2: home-location form ────────────────────────────────────────────
    const homeForm = page.getByTestId("form-home-location");
    await homeForm.waitFor({ timeout: 8_000 });

    // Address is the only required field for home training.
    await page.fill(
      '[data-testid="input-home-address"]',
      "Villa 12, Palm Jumeirah, Dubai",
    );

    // ── Finish ────────────────────────────────────────────────────────────────
    const finishBtn = page.getByTestId("button-wizard-finish");
    await expect(finishBtn).toBeVisible();
    await expect(finishBtn).toBeEnabled();
    await finishBtn.click();

    // ── Verify redirect to /book ──────────────────────────────────────────────
    await page.waitForURL((url) => url.pathname.startsWith("/book"), {
      timeout: 20_000,
    });
    expect(new URL(page.url()).pathname).toBe("/book");

    // No inline submission error should have appeared.
    await expect(page.getByTestId("text-wizard-inline-error")).not.toBeVisible();
  });

  test("fitness-zone card completes the wizard in one click and reaches /book", async ({
    page,
  }) => {
    const creds = makeCredentials("fz");
    createdEmails.push(creds.email);

    await registerClient(page, creds);

    await page.goto(`${BASE}/wizard`);
    await page.waitForSelector('[data-testid="wizard-training-location"]', {
      timeout: 15_000,
    });

    // Clicking the Fitness Zone card immediately saves the location and
    // navigates to /book (or /book?type=free_trial) without a step 2 form.
    const fzBtn = page.getByTestId("button-branch-fitness_zone");
    await fzBtn.waitFor({ timeout: 8_000 });
    await fzBtn.click();

    await page.waitForURL((url) => url.pathname.startsWith("/book"), {
      timeout: 20_000,
    });
    expect(new URL(page.url()).pathname).toBe("/book");
  });
});
