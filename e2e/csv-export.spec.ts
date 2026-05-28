/**
 * CSV Export — Playwright E2E Test
 *
 * Exercises the Export CSV button on /admin/payments in a real browser:
 *
 *  1. BUTTON STATE    – button is visible and enabled when payments exist.
 *  2. FILENAME        – clicking Export CSV triggers a download whose filename
 *                       matches payments_YYYY-MM-DD.csv (today's date).
 *  3. CSV HEADERS     – downloaded file contains the correct header row.
 *  4. ROW COUNT       – CSV data row count matches the count shown on screen.
 *  5. FILTERED ROWS   – after applying "Received" status filter every data
 *                       row in the CSV has Status = "Received" and the count
 *                       matches the table rows on screen.
 *  6. FILTERED EXPORT – after applying a status filter the same button still
 *                       triggers a download with the correct filename pattern.
 *
 * Prerequisites
 *   • App must be running on http://localhost:5000
 *   • Admin account: username="admin", password="change-this-password"
 *
 * Run: npx playwright test e2e/csv-export.spec.ts
 */

import { test, expect, type Download, type Page, type APIRequestContext } from "@playwright/test";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

const BASE = process.env.E2E_BASE_URL ?? "http://localhost:5000";
const ADMIN_USERNAME = process.env.E2E_ADMIN_USERNAME ?? "admin";
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD ?? "change-this-password";

// ── Auth ─────────────────────────────────────────────────────────────────────

async function adminLogin(page: Page) {
  await page.goto(`${BASE}/admin-access`);
  await page.waitForSelector('[data-testid="input-admin-username"]');

  // Dismiss cookie banner if present — it sits fixed at the bottom and
  // intercepts pointer events on the login submit button.
  const cookieBanner = page.getByTestId("cookie-banner");
  if (await cookieBanner.isVisible()) {
    await page.getByTestId("button-cookie-accept").click();
    await cookieBanner.waitFor({ state: "hidden", timeout: 3_000 }).catch(() => {});
  }

  await page.fill('[data-testid="input-admin-username"]', ADMIN_USERNAME);
  await page.fill('[data-testid="input-admin-password"]', ADMIN_PASSWORD);
  await page.click('[data-testid="button-submit-admin-login"]');
  await page.waitForURL(/\/admin(?!-access)/, { timeout: 10_000 });
}

// ── API helpers ───────────────────────────────────────────────────────────────

/**
 * Fetch a user ID to use as the target of seeded payments.
 * Uses the session cookie already established by adminLogin().
 */
async function getFirstUserId(request: APIRequestContext): Promise<number | null> {
  const res = await request.get(`${BASE}/api/users`);
  if (!res.ok()) return null;
  const users: Array<{ id: number; role?: string }> = await res.json();
  const client = users.find((u) => u.role !== "admin");
  return client?.id ?? users[0]?.id ?? null;
}

/**
 * Create a payment via the admin API and return its id so it can be cleaned up.
 */
async function createReceivedPayment(request: APIRequestContext, userId: number): Promise<number | null> {
  const res = await request.post(`${BASE}/api/admin/payments`, {
    data: {
      userId,
      amount: 999,
      status: "received",
      method: "cash",
      receiptReference: "E2E-TEST-RECEIVED",
      notes: null,
      packageId: null,
    },
  });
  if (!res.ok()) return null;
  const p: { id: number } = await res.json();
  return p.id ?? null;
}

async function deletePayment(request: APIRequestContext, id: number) {
  await request.delete(`${BASE}/api/admin/payments/${id}`);
}

// ── Setup helpers ─────────────────────────────────────────────────────────────

async function ensurePaymentExists(page: Page) {
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
  await page
    .waitForSelector('[role="dialog"]', { state: "hidden", timeout: 8_000 })
    .catch(() => {});
  await page.waitForLoadState("networkidle");
}

// ── CSV utilities ─────────────────────────────────────────────────────────────

/**
 * Save a Playwright Download to a temp file and return its UTF-8 text.
 */
async function readDownloadText(download: Download): Promise<string> {
  const tmpPath = path.join(os.tmpdir(), `pw-csv-${Date.now()}.csv`);
  await download.saveAs(tmpPath);
  const text = fs.readFileSync(tmpPath, "utf-8");
  fs.unlinkSync(tmpPath);
  return text;
}

/**
 * RFC-4180-compliant CSV parser.
 *
 * Processes the raw text character-by-character so that quoted newlines and
 * embedded commas are handled correctly, matching the escaping done by
 * exportPaymentsToCSV() in AdminPayments.tsx.
 */
function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current);
        current = "";
      } else if (ch === "\r" && text[i + 1] === "\n") {
        row.push(current);
        current = "";
        rows.push(row);
        row = [];
        i++;
      } else if (ch === "\n") {
        row.push(current);
        current = "";
        rows.push(row);
        row = [];
      } else {
        current += ch;
      }
    }
  }

  if (current !== "" || row.length > 0) {
    row.push(current);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell !== ""));
}

// ── Date helper ───────────────────────────────────────────────────────────────

function todayPattern() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return new RegExp(`payments_${y}-${m}-${day}\\.csv`);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

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

  test("downloaded CSV contains the correct header row", async ({ page }) => {
    await ensurePaymentExists(page);
    await page.goto(`${BASE}/admin/payments`);
    await page.waitForLoadState("networkidle");

    const exportBtn = page.getByTestId("button-export-payments-csv");
    await expect(exportBtn).toBeEnabled();

    const [download]: [Download] = await Promise.all([
      page.waitForEvent("download"),
      exportBtn.click(),
    ]);

    const text = await readDownloadText(download);
    const rows = parseCSV(text);

    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0]).toEqual([
      "Date",
      "Client",
      "Package",
      "Amount (AED)",
      "Method",
      "Status",
      "Reference",
      "Notes",
    ]);
  });

  test("CSV data row count matches the records count shown on screen", async ({
    page,
  }) => {
    await ensurePaymentExists(page);
    await page.goto(`${BASE}/admin/payments`);
    await page.waitForLoadState("networkidle");

    const exportBtn = page.getByTestId("button-export-payments-csv");
    await expect(exportBtn).toBeEnabled();

    const visibleRows = page.locator('[data-testid^="row-payment-"]');
    const visibleCount = await visibleRows.count();
    expect(visibleCount).toBeGreaterThan(0);

    const [download]: [Download] = await Promise.all([
      page.waitForEvent("download"),
      exportBtn.click(),
    ]);

    const text = await readDownloadText(download);
    const rows = parseCSV(text);
    const dataRows = rows.slice(1);
    expect(dataRows.length).toBe(visibleCount);
  });

  test("after applying 'Received' status filter every CSV data row has Status = Received", async ({
    page,
  }) => {
    await ensurePaymentExists(page);

    // Seed a guaranteed "received" payment via page.request so the session
    // cookie established by adminLogin() is included automatically.
    const userId = await getFirstUserId(page.request);
    let seededId: number | null = null;
    if (userId !== null) {
      seededId = await createReceivedPayment(page.request, userId);
    }

    try {
      await page.goto(`${BASE}/admin/payments`);
      await page.waitForLoadState("networkidle");

      const statusSelect = page.getByTestId("select-payment-status");
      await statusSelect.click();
      const receivedOption = page
        .locator('[role="option"]')
        .filter({ hasText: /^received$/i })
        .first();
      await receivedOption.waitFor({ timeout: 5_000 });
      await receivedOption.click();
      await page.waitForLoadState("networkidle");

      const exportBtn = page.getByTestId("button-export-payments-csv");
      await expect(exportBtn).toBeEnabled({ timeout: 5_000 });

      const visibleRows = page.locator('[data-testid^="row-payment-"]');
      const visibleCount = await visibleRows.count();
      expect(visibleCount).toBeGreaterThan(0);

      const [download]: [Download] = await Promise.all([
        page.waitForEvent("download"),
        exportBtn.click(),
      ]);

      const text = await readDownloadText(download);
      const rows = parseCSV(text);
      const header = rows[0];
      const statusColIndex = header.indexOf("Status");
      expect(statusColIndex).not.toBe(-1);

      const dataRows = rows.slice(1);
      expect(dataRows.length).toBe(visibleCount);

      for (const row of dataRows) {
        expect(row[statusColIndex]).toBe("Received");
      }
    } finally {
      if (seededId !== null) {
        await deletePayment(page.request, seededId);
      }
    }
  });

  test("after applying a status filter Export CSV still downloads with correct filename", async ({
    page,
  }) => {
    await ensurePaymentExists(page);
    await page.goto(`${BASE}/admin/payments`);
    await page.waitForLoadState("networkidle");

    const statusTrigger = page.getByTestId("select-payment-status");
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
