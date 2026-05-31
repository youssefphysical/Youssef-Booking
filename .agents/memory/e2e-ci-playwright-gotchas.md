---
name: E2E CI Playwright gotchas
description: Lessons from getting all 37 Playwright tests green in GitHub Actions headless Chromium.
---

## DailyBriefModal blocks admin interactions

**Rule:** Before any admin-page interaction in E2E tests, wait for `dialog-daily-brief` to appear, then dismiss it with Escape.

**Why:** `DailyBriefModal` auto-opens on fresh admin sessions (localStorage empty in CI). Its data arrives via async fetch ~1–2 s after the page URL lands. Pressing Escape immediately after `waitForURL` fires BEFORE the modal opens; the modal then opens afterward and its `Dialog` overlay (z-50, `fixed inset-0`) blocks all subsequent pointer events.

**How to apply:**
```ts
try {
  const dailyBrief = page.locator('[data-testid="dialog-daily-brief"]');
  await dailyBrief.waitFor({ state: "visible", timeout: 5_000 });
  await page.keyboard.press("Escape");
  await dailyBrief.waitFor({ state: "hidden", timeout: 2_000 });
} catch { /* Modal didn't open — proceed normally */ }
```

## AlertDialog / Radix overlay intercepts clicks in headless mode

**Rule:** Use `{ force: true }` when clicking buttons inside or near Radix AlertDialog/Dialog in headless CI.

**Why:** Playwright's pointer-event interception check fails when an AlertDialog overlay (z-50) is in the DOM in `data-state="open"` even when the content is visually on top. Two known cases:
- `AlertDialogAction` (confirm button) — `{ force: true }` bypasses the overlay
- Any button visible through a Dialog backdrop

## react-day-picker v8.10.1 caption selector

**Rule:** Use `.rdp-caption_label` (not `h2` or `[class*="caption"] span`) to read the displayed month.

**Why:** rdp v8 renders: `<div class="rdp-caption_label" role="status" aria-live="polite">June 2026</div>`. Old generic selectors (`[role="presentation"] h2`, `[class*="caption"] span`) don't match.

Next-button: `.rdp-nav_button_next` or `button[aria-label*="next" i]`.

## Dual button-logout elements

**Why:** The Navigation renders two `data-testid="button-logout"` elements — one in the desktop navbar (`hidden sm:inline-flex`) and one in the admin sidebar (`flex w-full`). The sidebar one is always in the DOM at desktop viewport. Use `{ force: true }` on all logout clicks in tests to avoid pointer-interception from any residual overlay.
