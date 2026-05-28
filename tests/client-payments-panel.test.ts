/**
 * Client Payments Panel — Static Structural Guard
 *
 * Verifies key contracts of the ClientPaymentsPanel without a browser:
 *
 * 1. NAVIGATION CONTRACT: The "payments" tab exists in CLIENT_TABS so the tab
 *    renders on the client detail page.
 *
 * 2. API CONTRACT: ClientPaymentsPanel passes the userId query param when
 *    fetching payments from /api/admin/payments.
 *
 * 3. PREFILL CONTRACT: CreatePaymentDialog receives prefillUserId so the
 *    "Add Payment" dialog is pre-filled with the current client.
 *
 * 4. EDIT/DELETE CONTRACT: Every payment row exposes edit and delete action
 *    buttons (data-testid patterns button-edit-payment- and
 *    button-delete-payment-) and a full-field edit dialog.
 *
 * 5. DELETE CONFIRM CONTRACT: A confirmation dialog exists before removing a
 *    payment (data-testid="button-confirm-delete-payment").
 *
 * Run: npx tsx tests/client-payments-panel.test.ts
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import assert from "assert";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const CLIENT_DETAIL_PATH = join(__dirname, "../client/src/pages/AdminClientDetail.tsx");
const src = readFileSync(CLIENT_DETAIL_PATH, "utf-8");

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗  ${name}\n     ${msg}`);
    failed++;
  }
}

console.log("\nClient Payments Panel — structural guard");
console.log("─".repeat(55));

// ── 1. Navigation contract ────────────────────────────────────────────────────
console.log("\n[1] Payments tab in CLIENT_TABS");

check('CLIENT_TABS contains value="payments"', () => {
  assert(
    src.includes('value: "payments"'),
    'The "payments" tab is missing from CLIENT_TABS in AdminClientDetail.tsx.\n' +
      '     Add { value: "payments", ... } to the CLIENT_TABS array.',
  );
});

check('TabsContent with value="payments" is rendered', () => {
  assert(
    src.includes('value="payments"') && src.includes('TabsContent'),
    'TabsContent value="payments" is missing — the Payments tab will not render its content.',
  );
});

check('"Payments" fallback label is set', () => {
  assert(
    src.includes('fallback: "Payments"'),
    'The payments tab in CLIENT_TABS is missing its fallback label string.',
  );
});

// ── 2. API contract — userId query param ────────────────────────────────────
console.log("\n[2] userId query param passed to /api/admin/payments");

check("`userId=${client.id}` used in payments fetch URL", () => {
  assert(
    src.includes("userId=${client.id}"),
    "ClientPaymentsPanel does not include `userId=${client.id}` in its fetch URL.\n" +
      "     Without this, all clients share the same payment list instead of per-client filtering.",
  );
});

check("/api/admin/payments endpoint is fetched with userId", () => {
  assert(
    src.includes("/api/admin/payments?userId="),
    "The payments fetch URL does not include '?userId=' — server-side filtering will not work.",
  );
});

check("queryKey includes userId segment", () => {
  assert(
    src.includes('"userId=') || src.includes("`userId="),
    "The TanStack Query queryKey for payments does not include a userId segment.\n" +
      "     This means cache entries for different clients will collide.",
  );
});

// ── 3. Prefill contract — CreatePaymentDialog ─────────────────────────────────
console.log("\n[3] CreatePaymentDialog prefilled with client");

check("CreatePaymentDialog is imported from AdminPayments", () => {
  assert(
    src.includes('CreatePaymentDialog') && src.includes('AdminPayments'),
    "CreatePaymentDialog is not imported from AdminPayments.tsx in AdminClientDetail.tsx.",
  );
});

check("prefillUserId prop is passed to CreatePaymentDialog", () => {
  assert(
    src.includes("prefillUserId={client.id}"),
    "CreatePaymentDialog does not receive prefillUserId={client.id}.\n" +
      '     Without this the "Add Payment" dialog will not pre-fill the client field.',
  );
});

check("prefillUserName prop is passed to CreatePaymentDialog", () => {
  assert(
    src.includes("prefillUserName={clientName}"),
    "CreatePaymentDialog does not receive prefillUserName — client name will be missing in the dialog.",
  );
});

check('data-testid="button-add-payment-for-client" is present', () => {
  assert(
    src.includes('data-testid="button-add-payment-for-client"'),
    'Add Payment button is missing data-testid="button-add-payment-for-client".',
  );
});

check('select-payment-client-prefilled testid is referenced', () => {
  assert(
    src.includes('select-payment-client-prefilled') ||
      readFileSync(
        join(__dirname, "../client/src/pages/AdminPayments.tsx"),
        "utf-8",
      ).includes("select-payment-client-prefilled"),
    'data-testid="select-payment-client-prefilled" is missing from the pre-filled client display in CreatePaymentDialog.',
  );
});

// ── 4. Edit / delete action buttons ──────────────────────────────────────────
console.log("\n[4] Edit and delete action buttons on payment rows");

check('"button-edit-payment-" pattern exists in desktop table rows', () => {
  assert(
    src.includes("button-edit-payment-"),
    'Desktop table rows are missing data-testid="button-edit-payment-{id}" action buttons.\n' +
      "     Add a pencil button with this testid pattern to each payment row.",
  );
});

check('"button-delete-payment-" pattern exists in desktop table rows', () => {
  assert(
    src.includes("button-delete-payment-"),
    'Desktop table rows are missing data-testid="button-delete-payment-{id}" action buttons.\n' +
      "     Add a trash button with this testid pattern to each payment row.",
  );
});

check('"button-edit-payment-mobile-" pattern exists on mobile cards', () => {
  assert(
    src.includes("button-edit-payment-mobile-"),
    'Mobile payment cards are missing data-testid="button-edit-payment-mobile-{id}" action buttons.',
  );
});

check('"button-delete-payment-mobile-" pattern exists on mobile cards', () => {
  assert(
    src.includes("button-delete-payment-mobile-"),
    'Mobile payment cards are missing data-testid="button-delete-payment-mobile-{id}" action buttons.',
  );
});

check("EditPaymentDialog component is defined", () => {
  assert(
    src.includes("function EditPaymentDialog("),
    "EditPaymentDialog component is not defined in AdminClientDetail.tsx.",
  );
});

check("EditPaymentDialog is rendered inside ClientPaymentsPanel", () => {
  assert(
    src.includes("<EditPaymentDialog"),
    "EditPaymentDialog is not rendered in the payments panel.",
  );
});

check('"form-edit-payment" testid exists in EditPaymentDialog', () => {
  assert(
    src.includes('data-testid="form-edit-payment"'),
    'The edit payment form is missing data-testid="form-edit-payment".',
  );
});

check('"button-save-edit-payment" testid exists', () => {
  assert(
    src.includes('data-testid="button-save-edit-payment"'),
    'The save button in EditPaymentDialog is missing data-testid="button-save-edit-payment".',
  );
});

check("PATCH /api/admin/payments/:id is used for editing", () => {
  assert(
    src.includes('apiRequest("PATCH", `/api/admin/payments/${'),
    "EditPaymentDialog does not call PATCH /api/admin/payments/:id — edits will not be saved.",
  );
});

// ── 5. Delete confirmation contract ──────────────────────────────────────────
console.log("\n[5] Delete confirmation dialog");

check("AlertDialog is used for delete confirmation", () => {
  assert(
    src.includes("AlertDialog") && src.includes("deleteTarget"),
    "No AlertDialog using a deleteTarget state was found — deleting a payment has no confirmation step.",
  );
});

check('"button-confirm-delete-payment" testid exists', () => {
  assert(
    src.includes('data-testid="button-confirm-delete-payment"'),
    'The confirm-delete button is missing data-testid="button-confirm-delete-payment".',
  );
});

check('"button-cancel-delete-payment" testid exists', () => {
  assert(
    src.includes('data-testid="button-cancel-delete-payment"'),
    'The cancel-delete button is missing data-testid="button-cancel-delete-payment".',
  );
});

check("DELETE /api/admin/payments/:id is used for deletion", () => {
  assert(
    src.includes('apiRequest("DELETE", `/api/admin/payments/'),
    "ClientPaymentsPanel does not call DELETE /api/admin/payments/:id — delete button won't work.",
  );
});

// ── 6. Summary panel testid ────────────────────────────────────────────────────
console.log("\n[6] Panel and summary testids");

check('"panel-client-payments" data-testid present', () => {
  assert(
    src.includes('data-testid="panel-client-payments"'),
    'The payments panel root element is missing data-testid="panel-client-payments".',
  );
});

check('"text-payments-received-total" testid present', () => {
  assert(
    src.includes('data-testid="text-payments-received-total"'),
    'The received-total display is missing data-testid="text-payments-received-total".',
  );
});

check('"row-client-payment-" pattern testid present in desktop rows', () => {
  assert(
    src.includes("row-client-payment-"),
    'Desktop payment rows are missing data-testid="row-client-payment-{id}".',
  );
});

check('"card-client-payment-" pattern testid present on mobile cards', () => {
  assert(
    src.includes("card-client-payment-"),
    'Mobile payment cards are missing data-testid="card-client-payment-{id}".',
  );
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(55));
if (failed > 0) {
  console.error(`\n❌  ${failed} assertion(s) failed.\n`);
  process.exit(1);
} else {
  console.log(`\n✅  ${passed} assertion(s) passed.\n`);
}
