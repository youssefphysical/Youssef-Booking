/**
 * CSV Export — Playwright E2E Test
 *
 * Exercises the Export CSV button on /admin/payments in a real browser:
 *
 *  1. BUTTON STATE    – button is visible and enabled when payments exist.
 *  2. FILENAME        – clicking Export CSV triggers a download whose filename
 *                       matches payments_YYYY-MM-DD.csv (today's date).
 *  3. FILTERED EXPORT – after applying a status filter the same button still
 *                       triggers a download with the correct filename pattern.
 *
 * Prerequisites
 *   • App must be running on http://localhost:5000
 *   • Admin account: username="admin", password="change-this-password"
 *
 * Run: npx playwright test e2e/csv-export.spec.ts
 */

import { test, expect, type Download } from "@playwright/test";

const BASE = "http://localhost:5000";

async function adminLogin(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/admin-access`);
  await page.waitForSelector('[data-testid="input-admin-username"]');
  await page.fill('[data-testid="input-admin-username"]', "admin");
  await page.fill('[data-testid="input-admin-password"]', "change-this-password");
  await page.click('[data-testid="button-submit-admin-login"]');
  await page.waitForURL(/\/admin(?!-access)/, { timeout: 10_000 });
}

async function ensurePaymentExists(page: import("@playwright/test").Page) {
  await page.goto(`${BASE}/admin/payments`);
  await page.waitForLoadState("networkidle");

  const exportBtn = page.getByTestId("button-export-payments-csv");
  const isDisabled = await exportBtn.evaluate(
    (el) => (el as HTMLButtonElement).disabled,
  );
  if (!isDisabled) return;

  await page.getByTestId("button-new-payment").click();
  await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });

  const popoverTrigger = page
    .locator('[role="dialog"]')
    .locator('[role="combobox"], button')
    .first();
  await popoverTrigger.click();
  const firstOption = page.locator('[role="option"]').first();
  await firstOption.waitFor({ timeout: 5_000 });
  await firstOption.click();

  const amountInput = page
    .locator('[role="dialog"]')
    .locator('input[type="number"], input[inputmode="decimal"], input[placeholder*="0"]')
    .first();
  await amountInput.fill("1500");

  const submitBtn = page
    .locator('[role="dialog"]')
    .getByRole("button", { name: /save|create|add/i })
    .first();
  await submitBtn.click();
  await page.waitForSelector('[role="dialog"]', { state: "hidden", timeout: 8_000 }).catch(() => {});
  await page.waitForLoadState("networkidle");
}

function todayPattern() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return new RegExp(`payments_${y}-${m}-${day}\\.csv`);
}

test.describe("Admin Payments — Export CSV", () => {
  test.beforeEach(async ({ page }) => {
    await adminLogin(page);
  });

  test("Export CSV button is visible and enabled when payments exist", async ({
    page,
  }) => {
    await ensurePaymentExists(page);
    await page.goto(`${BASE}/admin/payments`);
    await page.waitForLoadState("networkidle");

    const exportBtn = page.getByTestId("button-export-payments-csv");
    await expect(exportBtn).toBeVisible();
    await expect(exportBtn).toBeEnabled();
  });

  test("clicking Export CSV triggers a download with filename payments_YYYY-MM-DD.csv", async ({
    page,
  }) => {
    await ensurePaymentExists(page);
    await page.goto(`${BASE}/admin/payments`);
    await page.waitForLoadState("networkidle");

    const exportBtn = page.getByTestId("button-export-payments-csv");
    await expect(exportBtn).toBeEnabled();

    const [download]: [Download] = await Promise.all([
      page.waitForEvent("download"),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(todayPattern());
  });

  test("after applying a status filter Export CSV still downloads with correct filename", async ({
    page,
  }) => {
    await ensurePaymentExists(page);
    await page.goto(`${BASE}/admin/payments`);
    await page.waitForLoadState("networkidle");

    const statusTrigger = page
      .locator('[data-testid="select-status-filter"], [role="combobox"]')
      .first();
    await statusTrigger.click();

    const pendingOption = page.locator('[role="option"]').filter({ hasText: /pending/i }).first();
    const receivedOption = page.locator('[role="option"]').filter({ hasText: /received/i }).first();

    if (await pendingOption.isVisible()) {
      await pendingOption.click();
    } else if (await receivedOption.isVisible()) {
      await receivedOption.click();
    } else {
      const firstOption = page.locator('[role="option"]').first();
      await firstOption.click();
    }

    await page.waitForLoadState("networkidle");

    const exportBtn = page.getByTestId("button-export-payments-csv");
    if (await exportBtn.isDisabled()) {
      await statusTrigger.click();
      const allOption = page.locator('[role="option"]').filter({ hasText: /all/i }).first();
      if (await allOption.isVisible()) await allOption.click();
      await page.waitForLoadState("networkidle");
      await expect(exportBtn).toBeEnabled();
    }

    const [download]: [Download] = await Promise.all([
      page.waitForEvent("download"),
      exportBtn.click(),
    ]);

    expect(download.suggestedFilename()).toMatch(todayPattern());
  });
});
