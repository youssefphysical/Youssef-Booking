/**
 * Client Registration — Playwright E2E Test
 *
 * Exercises the 2-step client registration flow in a real browser:
 *
 *  1. VALIDATION  – required-field errors keep the form on step 1 when the
 *                   "Next" button is clicked with no data entered.
 *  2. FULL FLOW   – fills personal info (name, email, phone, password, area,
 *                   weekly frequency), advances to step 2, selects a primary
 *                   goal, accepts the unified consent checkbox, and submits.
 *  3. REDIRECT    – after successful registration the app redirects away from
 *                   /auth (to the public homepage at /).
 *  4. CLEANUP     – the test account is deleted via the admin API in afterAll.
 *
 * Prerequisites
 *   • App must be running on http://localhost:5000
 *   • Admin account: username="admin", password="change-this-password"
 *
 * Run: npx playwright test e2e/client-registration.spec.ts
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

// ── Test-client credentials (unique per run) ──────────────────────────────────
// Both email AND phone are timestamped so no uniqueness conflicts across runs.
const TS = Date.now();
const CLIENT_EMAIL = `e2e-reg-${TS}@test.invalid`;
const CLIENT_PASSWORD = "E2eReg!2026";
const CLIENT_FULLNAME = "E2E Reg Client";
// UAE mobile local number: 9 digits starting with 5. Use last 8 digits of TS.
const CLIENT_PHONE_LOCAL = `5${String(TS).slice(-8)}`;

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

/**
 * Fill the AreaAutocomplete by typing a prefix and clicking the first
 * suggestion that appears in the dropdown.
 */
async function fillAreaField(page: Page, prefix: string) {
  await page.fill('[data-testid="input-area"]', prefix);
  const firstOption = page.getByTestId("option-area-0");
  await firstOption.waitFor({ timeout: 6_000 });
  await firstOption.click();
}

/**
 * Select a value from a shadcn <Select> by clicking its trigger, then
 * clicking the option whose text matches the given regex.
 */
async function selectOption(
  page: Page,
  triggerTestId: string,
  textPattern: RegExp,
) {
  await page.getByTestId(triggerTestId).click();
  const option = page.locator('[role="option"]').filter({ hasText: textPattern }).first();
  await option.waitFor({ timeout: 6_000 });
  await option.click();
}

// ── Teardown ──────────────────────────────────────────────────────────────────

test.afterAll(async ({ browser }: { browser: Browser }) => {
  const adminCtx = await browser.newContext();
  const adminPage = await adminCtx.newPage();
  try {
    await adminLogin(adminPage);
    const req = adminPage.context().request;
    const userId = await findClientId(req, CLIENT_EMAIL);
    if (userId > 0) await deleteClient(req, userId);
  } catch {
    // best-effort cleanup — don't fail the suite over teardown
  } finally {
    await adminCtx.close();
  }
});

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Client Registration", () => {
  test("step 1 keeps the form in place when required fields are empty", async ({
    page,
  }) => {
    await page.goto(`${BASE}/auth`);
    await page.waitForLoadState("networkidle");
    await dismissCookieBanner(page);

    const registerTab = page.getByTestId("tab-register");
    await registerTab.waitFor({ timeout: 10_000 });
    await registerTab.click();

    // Click Next without filling anything — form should stay on step 1
    const nextBtn = page.getByTestId("button-next-step");
    await nextBtn.waitFor({ timeout: 5_000 });
    await nextBtn.click();

    // Still on step 1 — Next button visible, Submit button absent
    await expect(nextBtn).toBeVisible();
    await expect(page.getByTestId("button-submit-register")).not.toBeVisible();
  });

  test("completes 2-step registration and redirects away from the auth page", async ({
    page,
  }) => {
    await page.goto(`${BASE}/auth`);
    await page.waitForLoadState("networkidle");
    await dismissCookieBanner(page);

    // ── Switch to Register tab ────────────────────────────────────────────────
    const registerTab = page.getByTestId("tab-register");
    await registerTab.waitFor({ timeout: 10_000 });
    await registerTab.click();

    // ── Step 1: Personal Info ─────────────────────────────────────────────────
    await page.fill('[data-testid="input-fullname"]', CLIENT_FULLNAME);
    await page.fill('[data-testid="input-register-email"]', CLIENT_EMAIL);
    await page.fill('[data-testid="input-register-password"]', CLIENT_PASSWORD);

    // PhoneInput: `input-register-phone` is the local-number field only.
    // UAE (+971) is the default country — fill subscriber digits only.
    // CLIENT_PHONE_LOCAL is unique per run to avoid DB uniqueness conflicts.
    await page.getByTestId("input-register-phone").fill(CLIENT_PHONE_LOCAL);

    // Area autocomplete — type prefix, pick first suggestion
    await fillAreaField(page, "Dubai");

    // Weekly frequency — "3 sessions / week — Momentum" (value="3")
    await selectOption(page, "select-weekly-frequency", /Momentum/i);

    // Advance to step 2
    await page.getByTestId("button-next-step").click();

    // ── Step 2: Goals & Consent ───────────────────────────────────────────────
    const submitBtn = page.getByTestId("button-submit-register");
    await submitBtn.waitFor({ timeout: 10_000 });

    // Primary goal
    await selectOption(page, "select-primary-goal", /fat.?loss/i);

    // Unified consent checkbox — must be checked to enable the submit button
    const consentCheckbox = page.getByTestId("checkbox-consent-agree_all");
    await consentCheckbox.check();
    await expect(consentCheckbox).toBeChecked();

    // Submit should now be enabled
    await expect(submitBtn).toBeEnabled({ timeout: 5_000 });

    // ── Submit ────────────────────────────────────────────────────────────────
    await submitBtn.click();

    // Registration succeeds → the app calls setLocation("/") so the URL
    // changes away from /auth. Accept any non-/auth destination.
    await page.waitForURL((url) => !url.pathname.startsWith("/auth"), {
      timeout: 20_000,
    });

    // The auth form must no longer be visible (we've navigated away from /auth)
    await expect(page.getByTestId("button-submit-register")).not.toBeVisible();

    // ── Verify dashboard access ───────────────────────────────────────────────
    // Navigate to /dashboard to confirm the newly registered user is
    // authenticated and can reach their protected client area.
    // New clients with no training location are redirected to /wizard by the
    // app — both URLs confirm successful authentication.
    await page.goto(`${BASE}/dashboard`);
    await page.waitForURL(/\/(dashboard|wizard)/, { timeout: 15_000 });
    expect(page.url()).toMatch(/\/(dashboard|wizard)/);
  });
});
