# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: csv-export.spec.ts >> Admin Payments — Export CSV >> Export CSV button is visible and enabled when payments exist
- Location: e2e/csv-export.spec.ts:209:3

# Error details

```
Test timeout of 30000ms exceeded while running "beforeEach" hook.
```

```
Error: page.click: Test timeout of 30000ms exceeded.
Call log:
  - waiting for locator('[data-testid="button-submit-admin-login"]')
    - locator resolved to <button type="submit" data-component-name="Comp" data-testid="button-submit-admin-login" data-replit-metadata="client/src/components/ui/button.tsx:52:6" class="inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 hover-elevate active-elevate-2 border border-primary-border min-h-9 px-4 py-2 w-full h-12 rou…>Admin Sign In</button>
  - attempting click action
    2 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <p data-component-name="p" data-replit-metadata="client/src/components/CookieBanner.tsx:70:16" class="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">…</p> from <div data-component-name="div" data-testid="cookie-banner" class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6" data-replit-metadata="client/src/components/CookieBanner.tsx:57:4">…</div> subtree intercepts pointer events
    - retrying click action
    - waiting 20ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <p data-component-name="p" data-replit-metadata="client/src/components/CookieBanner.tsx:70:16" class="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">…</p> from <div data-component-name="div" data-testid="cookie-banner" class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6" data-replit-metadata="client/src/components/CookieBanner.tsx:57:4">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 100ms
    - waiting for element to be visible, enabled and stable
    - element is not stable
  - retrying click action
    - waiting 100ms
    3 × waiting for element to be visible, enabled and stable
      - element is visible, enabled and stable
      - scrolling into view if needed
      - done scrolling
      - <div data-component-name="div" data-testid="cookie-banner" class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6" data-replit-metadata="client/src/components/CookieBanner.tsx:57:4">…</div> intercepts pointer events
    - retrying click action
      - waiting 500ms
    10 × waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <p data-component-name="p" data-replit-metadata="client/src/components/CookieBanner.tsx:70:16" class="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">…</p> from <div data-component-name="div" data-testid="cookie-banner" class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6" data-replit-metadata="client/src/components/CookieBanner.tsx:57:4">…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <p data-component-name="p" data-replit-metadata="client/src/components/CookieBanner.tsx:70:16" class="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">…</p> from <div data-component-name="div" data-testid="cookie-banner" class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6" data-replit-metadata="client/src/components/CookieBanner.tsx:57:4">…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <p data-component-name="p" data-replit-metadata="client/src/components/CookieBanner.tsx:70:16" class="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">…</p> from <div data-component-name="div" data-testid="cookie-banner" class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6" data-replit-metadata="client/src/components/CookieBanner.tsx:57:4">…</div> subtree intercepts pointer events
     - retrying click action
       - waiting 500ms
       - waiting for element to be visible, enabled and stable
       - element is visible, enabled and stable
       - scrolling into view if needed
       - done scrolling
       - <div data-component-name="div" data-testid="cookie-banner" class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6" data-replit-metadata="client/src/components/CookieBanner.tsx:57:4">…</div> intercepts pointer events
     - retrying click action
       - waiting 500ms
    - waiting for element to be visible, enabled and stable
    - element is visible, enabled and stable
    - scrolling into view if needed
    - done scrolling
    - <p data-component-name="p" data-replit-metadata="client/src/components/CookieBanner.tsx:70:16" class="text-xs sm:text-sm text-muted-foreground mt-1 leading-relaxed">…</p> from <div data-component-name="div" data-testid="cookie-banner" class="fixed inset-x-0 bottom-0 z-50 px-4 pb-4 sm:px-6 sm:pb-6" data-replit-metadata="client/src/components/CookieBanner.tsx:57:4">…</div> subtree intercepts pointer events
  - retrying click action
    - waiting 500ms

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - generic [ref=e3]:
    - banner [ref=e4]:
      - generic [ref=e5]:
        - link "Youssef Elite" [ref=e6] [cursor=pointer]:
          - /url: /
          - generic "Youssef Elite" [ref=e7]:
            - img [ref=e8]
        - navigation [ref=e9]:
          - link "Home" [ref=e10] [cursor=pointer]:
            - /url: /
            - generic [ref=e11]: Home
          - link "Book" [ref=e12] [cursor=pointer]:
            - /url: /book
            - generic [ref=e13]: Book
          - link "How it Works" [ref=e14] [cursor=pointer]:
            - /url: /how-it-works
            - generic [ref=e15]: How it Works
          - link "Recovery" [ref=e16] [cursor=pointer]:
            - /url: /recovery
            - generic [ref=e17]: Recovery
          - link "FAQ" [ref=e18] [cursor=pointer]:
            - /url: /faq
            - generic [ref=e19]: FAQ
          - link "Policy" [ref=e20] [cursor=pointer]:
            - /url: /policy
            - generic [ref=e21]: Policy
        - generic [ref=e22]:
          - button "Language" [ref=e23] [cursor=pointer]:
            - img [ref=e24]
            - img "English flag" [ref=e27]
            - generic [ref=e28]: en
            - img [ref=e29]
          - link "Sign in" [ref=e31] [cursor=pointer]:
            - /url: /auth
            - img [ref=e32]
            - generic [ref=e35]: Sign in
    - generic [ref=e38]:
      - generic [ref=e39]:
        - img [ref=e41]
        - generic [ref=e43]:
          - paragraph [ref=e44]: We use cookies
          - paragraph [ref=e45]:
            - text: We use essential cookies to keep your session and the site working. With your permission we may also use analytics & marketing cookies to improve the experience. Read our
            - link "Cookie Policy" [ref=e46] [cursor=pointer]:
              - /url: /cookies
            - text: .
      - generic [ref=e47]:
        - button "Accept all" [ref=e48] [cursor=pointer]
        - button "Manage" [ref=e49] [cursor=pointer]
        - button "Essential only" [ref=e50] [cursor=pointer]
    - generic [ref=e51]:
      - img
      - generic [ref=e52]:
        - link "Back to home" [ref=e53] [cursor=pointer]:
          - /url: /
          - img [ref=e54]
          - text: Back to home
        - generic [ref=e56]:
          - generic [ref=e57]:
            - img [ref=e59]
            - paragraph [ref=e60]: Admin Access
          - generic [ref=e62]:
            - generic [ref=e63]: "Admin access only. Username: admin"
            - generic [ref=e64]:
              - text: Username
              - textbox "admin" [ref=e65]
            - generic [ref=e66]:
              - text: Password
              - textbox "••••••••" [active] [ref=e67]: change-this-password
            - button "Admin Sign In" [ref=e68] [cursor=pointer]
  - region "Notifications (F8)":
    - list
```

# Test source

```ts
  1   | /**
  2   |  * CSV Export — Playwright E2E Test
  3   |  *
  4   |  * Exercises the Export CSV button on /admin/payments in a real browser:
  5   |  *
  6   |  *  1. BUTTON STATE    – button is visible and enabled when payments exist.
  7   |  *  2. FILENAME        – clicking Export CSV triggers a download whose filename
  8   |  *                       matches payments_YYYY-MM-DD.csv (today's date).
  9   |  *  3. CSV HEADERS     – downloaded file contains the correct header row.
  10  |  *  4. ROW COUNT       – CSV data row count matches the count shown on screen.
  11  |  *  5. FILTERED ROWS   – after applying "Received" status filter every data
  12  |  *                       row in the CSV has Status = "Received" and the count
  13  |  *                       matches the table rows on screen.
  14  |  *  6. FILTERED EXPORT – after applying a status filter the same button still
  15  |  *                       triggers a download with the correct filename pattern.
  16  |  *
  17  |  * Prerequisites
  18  |  *   • App must be running on http://localhost:5000
  19  |  *   • Admin account: username="admin", password="change-this-password"
  20  |  *
  21  |  * Run: npx playwright test e2e/csv-export.spec.ts
  22  |  */
  23  | 
  24  | import { test, expect, type Download, type Page, type APIRequestContext } from "@playwright/test";
  25  | import * as fs from "fs";
  26  | import * as os from "os";
  27  | import * as path from "path";
  28  | 
  29  | const BASE = "http://localhost:5000";
  30  | 
  31  | // ── Auth ─────────────────────────────────────────────────────────────────────
  32  | 
  33  | async function adminLogin(page: Page) {
  34  |   await page.goto(`${BASE}/admin-access`);
  35  |   await page.waitForSelector('[data-testid="input-admin-username"]');
  36  |   await page.fill('[data-testid="input-admin-username"]', "admin");
  37  |   await page.fill('[data-testid="input-admin-password"]', "change-this-password");
> 38  |   await page.click('[data-testid="button-submit-admin-login"]');
      |              ^ Error: page.click: Test timeout of 30000ms exceeded.
  39  |   await page.waitForURL(/\/admin(?!-access)/, { timeout: 10_000 });
  40  | }
  41  | 
  42  | // ── API helpers ───────────────────────────────────────────────────────────────
  43  | 
  44  | /**
  45  |  * Fetch a user ID to use as the target of seeded payments.
  46  |  * Uses the session cookie already established by adminLogin().
  47  |  */
  48  | async function getFirstUserId(request: APIRequestContext): Promise<number | null> {
  49  |   const res = await request.get(`${BASE}/api/users`);
  50  |   if (!res.ok()) return null;
  51  |   const users: Array<{ id: number; role?: string }> = await res.json();
  52  |   const client = users.find((u) => u.role !== "admin");
  53  |   return client?.id ?? users[0]?.id ?? null;
  54  | }
  55  | 
  56  | /**
  57  |  * Create a payment via the admin API and return its id so it can be cleaned up.
  58  |  */
  59  | async function createReceivedPayment(request: APIRequestContext, userId: number): Promise<number | null> {
  60  |   const res = await request.post(`${BASE}/api/admin/payments`, {
  61  |     data: {
  62  |       userId,
  63  |       amount: 999,
  64  |       status: "received",
  65  |       method: "cash",
  66  |       receiptReference: "E2E-TEST-RECEIVED",
  67  |       notes: null,
  68  |       packageId: null,
  69  |     },
  70  |   });
  71  |   if (!res.ok()) return null;
  72  |   const p: { id: number } = await res.json();
  73  |   return p.id ?? null;
  74  | }
  75  | 
  76  | async function deletePayment(request: APIRequestContext, id: number) {
  77  |   await request.delete(`${BASE}/api/admin/payments/${id}`);
  78  | }
  79  | 
  80  | // ── Setup helpers ─────────────────────────────────────────────────────────────
  81  | 
  82  | async function ensurePaymentExists(page: Page) {
  83  |   await page.goto(`${BASE}/admin/payments`);
  84  |   await page.waitForLoadState("networkidle");
  85  | 
  86  |   const exportBtn = page.getByTestId("button-export-payments-csv");
  87  |   const isDisabled = await exportBtn.evaluate(
  88  |     (el) => (el as HTMLButtonElement).disabled,
  89  |   );
  90  |   if (!isDisabled) return;
  91  | 
  92  |   await page.getByTestId("button-new-payment").click();
  93  |   await page.waitForSelector('[role="dialog"]', { timeout: 5_000 });
  94  | 
  95  |   const popoverTrigger = page
  96  |     .locator('[role="dialog"]')
  97  |     .locator('[role="combobox"], button')
  98  |     .first();
  99  |   await popoverTrigger.click();
  100 |   const firstOption = page.locator('[role="option"]').first();
  101 |   await firstOption.waitFor({ timeout: 5_000 });
  102 |   await firstOption.click();
  103 | 
  104 |   const amountInput = page
  105 |     .locator('[role="dialog"]')
  106 |     .locator('input[type="number"], input[inputmode="decimal"], input[placeholder*="0"]')
  107 |     .first();
  108 |   await amountInput.fill("1500");
  109 | 
  110 |   const submitBtn = page
  111 |     .locator('[role="dialog"]')
  112 |     .getByRole("button", { name: /save|create|add/i })
  113 |     .first();
  114 |   await submitBtn.click();
  115 |   await page
  116 |     .waitForSelector('[role="dialog"]', { state: "hidden", timeout: 8_000 })
  117 |     .catch(() => {});
  118 |   await page.waitForLoadState("networkidle");
  119 | }
  120 | 
  121 | // ── CSV utilities ─────────────────────────────────────────────────────────────
  122 | 
  123 | /**
  124 |  * Save a Playwright Download to a temp file and return its UTF-8 text.
  125 |  */
  126 | async function readDownloadText(download: Download): Promise<string> {
  127 |   const tmpPath = path.join(os.tmpdir(), `pw-csv-${Date.now()}.csv`);
  128 |   await download.saveAs(tmpPath);
  129 |   const text = fs.readFileSync(tmpPath, "utf-8");
  130 |   fs.unlinkSync(tmpPath);
  131 |   return text;
  132 | }
  133 | 
  134 | /**
  135 |  * RFC-4180-compliant CSV parser.
  136 |  *
  137 |  * Processes the raw text character-by-character so that quoted newlines and
  138 |  * embedded commas are handled correctly, matching the escaping done by
```