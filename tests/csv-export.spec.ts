/**
 * CSV Export — Vitest Unit Test
 *
 * Directly tests `exportPaymentsToCSV` (exported from AdminPayments.tsx).
 *
 * 1. FILENAME:  The anchor's `download` attribute is payments_YYYY-MM-DD.csv
 *               where the date matches today in ISO format.
 * 2. COLUMNS:   The header row contains exactly the eight canonical columns.
 * 3. ROWS:      Data rows reflect the payments array passed in, so active
 *               filters (handled upstream by the component) are represented.
 * 4. ESCAPING:  Values containing commas, double-quotes, or newlines are
 *               wrapped in double-quotes with internal quotes doubled.
 *
 * Run: npx vitest run tests/csv-export.spec.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exportPaymentsToCSV } from "../client/src/pages/AdminPayments";
import {
  PAYMENT_RECORD_METHOD_LABELS,
  PAYMENT_RECORD_STATUS_LABELS,
} from "../shared/schema";

// ── Types mirroring AdminPayments.tsx ────────────────────────────────────────

type PaymentWithUser = {
  id: number;
  userId: number;
  packageId: number | null;
  amount: number;
  method: string;
  status: string;
  receiptReference: string | null;
  notes: string | null;
  paidAt: string | null;
  createdAt: string | null;
  user: { id: number; fullName: string; email: string | null } | null;
  package: { id: number; name: string | null; type: string | null } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a CSV string into rows of cells.
 * Handles RFC-4180 quoted fields, including embedded commas, quotes, and
 * newlines (fields that span multiple lines).
 */
function parseCSV(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuote = false;

  for (let i = 0; i < csv.length; i++) {
    const ch = csv[i];
    if (inQuote) {
      if (ch === '"' && csv[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuote = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuote = true;
      } else if (ch === ",") {
        row.push(current);
        current = "";
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
  if (current || row.length > 0) {
    row.push(current);
    rows.push(row);
  }
  return rows;
}

function makePayment(overrides: Partial<PaymentWithUser> = {}): PaymentWithUser {
  return {
    id: 1,
    userId: 10,
    packageId: null,
    amount: 2500,
    method: "cash",
    status: "received",
    receiptReference: null,
    notes: null,
    paidAt: null,
    createdAt: "2026-05-01T10:00:00.000Z",
    user: { id: 10, fullName: "Ali Hassan", email: "ali@example.com" },
    package: { id: 5, name: "Elite 12", type: "monthly" },
    ...overrides,
  };
}

// ── DOM mocks ─────────────────────────────────────────────────────────────────

let capturedBlob: Blob | null = null;
let capturedDownload: string | null = null;
const capturedAnchors: HTMLAnchorElement[] = [];

beforeEach(() => {
  capturedBlob = null;
  capturedDownload = null;
  capturedAnchors.length = 0;

  // Capture the blob that gets turned into an object URL
  vi.stubGlobal("URL", {
    createObjectURL: vi.fn((blob: Blob) => {
      capturedBlob = blob;
      return "blob:mock-url";
    }),
    revokeObjectURL: vi.fn(),
  });

  // Capture anchor download attribute; prevent real navigation
  const orig = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
    const el = orig(tag);
    if (tag === "a") {
      const anchor = el as HTMLAnchorElement;
      capturedAnchors.push(anchor);
      vi.spyOn(anchor, "click").mockImplementation(() => {
        capturedDownload = anchor.download;
      });
    }
    return el;
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Read the captured blob as a UTF-8 string. */
async function csvText(): Promise<string> {
  if (!capturedBlob) throw new Error("No blob was created — was exportPaymentsToCSV called?");
  return capturedBlob.text();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("exportPaymentsToCSV", () => {
  describe("filename", () => {
    it("uses payments_YYYY-MM-DD.csv matching today's ISO date", () => {
      exportPaymentsToCSV([makePayment()]);
      const today = new Date().toISOString().slice(0, 10); // e.g. 2026-05-28
      expect(capturedDownload).toBe(`payments_${today}.csv`);
    });

    it("matches the pattern payments_NNNN-NN-NN.csv", () => {
      exportPaymentsToCSV([makePayment()]);
      expect(capturedDownload).toMatch(/^payments_\d{4}-\d{2}-\d{2}\.csv$/);
    });
  });

  describe("header row", () => {
    it("contains exactly the eight canonical columns in order", async () => {
      exportPaymentsToCSV([makePayment()]);
      const rows = parseCSV(await csvText());
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
  });

  describe("data rows", () => {
    it("produces one data row per payment in the array", async () => {
      const payments = [makePayment({ id: 1 }), makePayment({ id: 2 }), makePayment({ id: 3 })];
      exportPaymentsToCSV(payments);
      const rows = parseCSV(await csvText());
      expect(rows).toHaveLength(1 + payments.length); // header + data
    });

    it("maps client fullName to the Client column", async () => {
      exportPaymentsToCSV([makePayment({ user: { id: 10, fullName: "Sara Al-Rashed", email: null } })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][1]).toBe("Sara Al-Rashed");
    });

    it("maps package name to the Package column", async () => {
      exportPaymentsToCSV([makePayment({ package: { id: 5, name: "Platinum 24", type: null } })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][2]).toBe("Platinum 24");
    });

    it("falls back to package type when name is null", async () => {
      exportPaymentsToCSV([makePayment({ package: { id: 5, name: null, type: "monthly" } })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][2]).toBe("monthly");
    });

    it("writes empty string for Package when package is null", async () => {
      exportPaymentsToCSV([makePayment({ package: null })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][2]).toBe("");
    });

    it("maps amount as a plain number to the Amount (AED) column", async () => {
      exportPaymentsToCSV([makePayment({ amount: 3600 })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][3]).toBe("3600");
    });

    it("maps method to its human label via PAYMENT_RECORD_METHOD_LABELS", async () => {
      exportPaymentsToCSV([makePayment({ method: "bank_transfer" })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][4]).toBe(PAYMENT_RECORD_METHOD_LABELS["bank_transfer"]);
    });

    it("maps status to its human label via PAYMENT_RECORD_STATUS_LABELS", async () => {
      exportPaymentsToCSV([makePayment({ status: "pending" })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][5]).toBe(PAYMENT_RECORD_STATUS_LABELS["pending"]);
    });

    it("maps receiptReference to the Reference column", async () => {
      exportPaymentsToCSV([makePayment({ receiptReference: "REF-2026-001" })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][6]).toBe("REF-2026-001");
    });

    it("writes empty string for Reference when null", async () => {
      exportPaymentsToCSV([makePayment({ receiptReference: null })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][6]).toBe("");
    });

    it("maps notes to the Notes column", async () => {
      exportPaymentsToCSV([makePayment({ notes: "Paid in installments" })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][7]).toBe("Paid in installments");
    });

    it("falls back to 'Unknown' for Client when user is null", async () => {
      exportPaymentsToCSV([makePayment({ user: null })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][1]).toBe("Unknown");
    });

    it("exports only the rows passed in, mirroring active filter state", async () => {
      // Simulate server-side filtering: component passes only matching rows
      const filtered = [
        makePayment({ id: 3, status: "pending", user: { id: 11, fullName: "Layla Malik", email: null } }),
      ];
      exportPaymentsToCSV(filtered);
      const rows = parseCSV(await csvText());
      expect(rows).toHaveLength(2); // header + 1 filtered row
      expect(rows[1][1]).toBe("Layla Malik");
      expect(rows[1][5]).toBe(PAYMENT_RECORD_STATUS_LABELS["pending"]);
    });
  });

  describe("CSV escaping", () => {
    it("wraps values containing commas in double-quotes", async () => {
      exportPaymentsToCSV([makePayment({ notes: "First, Second, Third" })]);
      const text = await csvText();
      const rows = parseCSV(text);
      // After parsing, the unescaped value should be intact
      expect(rows[1][7]).toBe("First, Second, Third");
      // The raw CSV line must contain the quoted form
      const dataLine = text.split("\n")[1];
      expect(dataLine).toContain('"First, Second, Third"');
    });

    it("escapes double-quotes by doubling them", async () => {
      exportPaymentsToCSV([makePayment({ notes: 'He said "great package"' })]);
      const text = await csvText();
      const rows = parseCSV(text);
      expect(rows[1][7]).toBe('He said "great package"');
      const dataLine = text.split("\n")[1];
      expect(dataLine).toContain('"He said ""great package"""');
    });

    it("wraps values containing newlines in double-quotes", async () => {
      exportPaymentsToCSV([makePayment({ notes: "Line 1\nLine 2" })]);
      const text = await csvText();
      const rows = parseCSV(text);
      expect(rows[1][7]).toBe("Line 1\nLine 2");
      const rawCSV = text;
      expect(rawCSV).toContain('"Line 1\nLine 2"');
    });

    it("handles a value with both commas and quotes", async () => {
      const tricky = 'Package "Gold", monthly';
      exportPaymentsToCSV([makePayment({ notes: tricky })]);
      const rows = parseCSV(await csvText());
      expect(rows[1][7]).toBe(tricky);
    });
  });

  describe("empty input", () => {
    it("produces only the header row when passed an empty array", async () => {
      exportPaymentsToCSV([]);
      const rows = parseCSV(await csvText());
      expect(rows).toHaveLength(1);
      expect(rows[0][0]).toBe("Date");
    });
  });
});
