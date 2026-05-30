/**
 * Admin Login — Playwright E2E Test
 *
 * Exercises the /admin-access login flow and key post-login guards:
 *
 *  1. LOGIN PAGE     – /admin-access renders the username + password fields.
 *  2. BAD CREDS      – wrong password shows an error and stays on /admin-access.
 *  3. GOOD CREDS     – correct credentials redirect to /admin (dashboard).
 *  4. AUTH GUARD     – /admin/* is inaccessible without a session (redirects to
 *                      /admin-access or returns a non-200 status).
 *  5. LOGOUT         – after logout the session is destroyed and /admin redirects
 *                      away (or the admin nav is gone).
 *
 * Prerequisites
 *   • App must be running on http://localhost:5000
 *   • Admin account: username="admin", password="change-this-password"
 *
 * Run: npx playwright test e2e/admin-login.spec.ts
 */

import { test, expect, type Page } from "@playwright/test";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5000";
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "change-this-password";
const WRONG_PASSWORD = "definitely-wrong-password-xyz";

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function dismissCookieBanner(page: Page) {
  const banner = page.getByTestId("cookie-banner");
  if (await banner.isVisible()) {
    await page.getByTestId("button-cookie-accept").click();
    await banner.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
  }
}

async function goToLogin(page: Page) {
  await page.goto(`${BASE}/admin-access`);
  await page.waitForSelector('[data-testid="input-admin-username"]', { timeout: 10_000 });
  await dismissCookieBanner(page);
}

async function fillAndSubmit(page: Page, username: string, password: string) {
  await page.fill('[data-testid="input-admin-username"]', username);
  await page.fill('[data-testid="input-admin-password"]', password);
  await page.click('[data-testid="button-submit-admin-login"]');
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe("Admin Login", () => {
  test("login page renders username and password fields", async ({ page }) => {
    await goToLogin(page);

    await expect(page.getByTestId("input-admin-username")).toBeVisible();
    await expect(page.getByTestId("input-admin-password")).toBeVisible();
    await expect(page.getByTestId("button-submit-admin-login")).toBeVisible();
  });

  test("wrong credentials stay on /admin-access and show an error", async ({ page }) => {
    await goToLogin(page);
    await fillAndSubmit(page, ADMIN_USERNAME, WRONG_PASSWORD);

    // Should not navigate away from the login page
    await page.waitForTimeout(2_000);
    expect(page.url()).toContain("/admin-access");

    // An error indicator should be visible (toast, alert, or inline message)
    const errorLocators = [
      page.locator('[role="alert"]'),
      page.locator(".text-destructive, .text-red-500, .text-red-400"),
      page.locator('[data-testid*="error"], [data-testid*="toast"]'),
    ];
    let foundError = false;
    for (const loc of errorLocators) {
      if (await loc.first().isVisible()) {
        foundError = true;
        break;
      }
    }
    expect(foundError).toBe(true);
  });

  test("correct credentials redirect to /admin dashboard", async ({ page }) => {
    await goToLogin(page);
    await fillAndSubmit(page, ADMIN_USERNAME, ADMIN_PASSWORD);

    await page.waitForURL(/\/admin(?!-access)/, { timeout: 10_000 });
    expect(page.url()).toMatch(/\/admin(?!-access)/);

    // Dashboard should have some recognisable admin chrome
    const adminIndicators = [
      page.getByTestId("admin-dashboard"),
      page.locator("nav").filter({ hasText: /clients|bookings|packages/i }),
      page.locator("h1, h2").filter({ hasText: /dashboard|overview|admin/i }),
    ];
    let foundIndicator = false;
    for (const loc of adminIndicators) {
      if (await loc.first().isVisible().catch(() => false)) {
        foundIndicator = true;
        break;
      }
    }
    expect(foundIndicator).toBe(true);
  });

  test("unauthenticated request to /admin is redirected or blocked", async ({ page }) => {
    // Navigate directly without logging in — a fresh browser context has no session.
    const response = await page.goto(`${BASE}/admin`, { waitUntil: "load" });

    // The redirect is client-side (React ProtectedRoute), so wait up to 5s
    // for the URL to leave /admin before checking where it landed.
    await page.waitForURL(/\/auth|\/admin-access/, { timeout: 5_000 }).catch(() => {});

    const redirectedToLogin =
      page.url().includes("/admin-access") || page.url().includes("/auth");

    const blockedByServer = response !== null && response.status() >= 400;

    // At least one of the two guards must fire
    expect(redirectedToLogin || blockedByServer).toBe(true);
  });

  test("logging out destroys the admin session", async ({ page }) => {
    // Step 1 — log in
    await goToLogin(page);
    await fillAndSubmit(page, ADMIN_USERNAME, ADMIN_PASSWORD);
    await page.waitForURL(/\/admin(?!-access)/, { timeout: 10_000 });

    // DailyBriefModal auto-opens on fresh sessions (no localStorage dismissed key).
    // Press Escape to close it before interacting with the nav; wait for the
    // dialog overlay to fully disappear so it can't intercept pointer events.
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    await page
      .locator('[data-testid="dialog-daily-brief"]')
      .waitFor({ state: "hidden", timeout: 2_000 })
      .catch(() => {});

    // Step 2 — find and click a logout trigger
    // Common patterns: a button/link with text "logout" / "sign out", or a
    // data-testid containing "logout".
    const logoutSelectors = [
      page.getByTestId("button-logout"),
      page.getByTestId("link-logout"),
      page.getByRole("button", { name: /logout|sign out|log out/i }),
      page.getByRole("link", { name: /logout|sign out|log out/i }),
    ];

    let clicked = false;
    for (const loc of logoutSelectors) {
      if (await loc.isVisible().catch(() => false)) {
        await loc.click();
        clicked = true;
        break;
      }
    }

    if (!clicked) {
      // Some UIs nest logout inside a dropdown/menu — try opening it first
      const menuTriggers = [
        page.getByTestId("button-user-menu"),
        page.getByTestId("button-admin-menu"),
        page.locator('[aria-label*="menu" i], [aria-label*="account" i]').first(),
      ];
      for (const trigger of menuTriggers) {
        if (await trigger.isVisible().catch(() => false)) {
          await trigger.click();
          await page.waitForTimeout(400);
          for (const loc of logoutSelectors) {
            if (await loc.isVisible().catch(() => false)) {
              await loc.click();
              clicked = true;
              break;
            }
          }
          if (clicked) break;
        }
      }
    }

    if (!clicked) {
      // If no logout UI found, hit the endpoint directly
      await page.goto(`${BASE}/api/logout`, { waitUntil: "load" }).catch(() => {});
      await page.goto(`${BASE}/auth/logout`, { waitUntil: "load" }).catch(() => {});
    }

    // The logout button may open a confirmation dialog — click the confirm
    // button if it appears (e.g. data-testid="button-logout-confirm").
    // Use force:true because AlertDialog's overlay can block Playwright's
    // pointer-event interception check in headless mode.
    if (clicked) {
      await page.waitForTimeout(600);
      const confirmBtn = page.getByTestId("button-logout-confirm");
      if (await confirmBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await confirmBtn.click({ force: true });
      }
    }

    await page.waitForTimeout(1_000);

    // Step 3 — verify session is gone: /admin should redirect away from admin
    await page.goto(`${BASE}/admin`, { waitUntil: "load" });
    await page.waitForTimeout(1_000);

    const loggedOut =
      page.url().includes("/admin-access") ||
      page.url().includes("/auth") ||
      !(await page
        .locator("nav")
        .filter({ hasText: /clients|bookings/i })
        .first()
        .isVisible()
        .catch(() => false));

    expect(loggedOut).toBe(true);
  });
});
