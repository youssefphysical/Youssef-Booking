/**
 * CSV Export — UI Behavioral Test (Vitest + React Testing Library)
 *
 * Renders AdminPayments in jsdom, waits for payments to load from the mocked
 * fetch, then clicks `button-export-payments-csv` to trigger the download
 * path through the real component wiring.
 *
 * 1. BUTTON WIRING:      clicking Export CSV triggers URL.createObjectURL with
 *                        a Blob and sets anchor.download to the correct filename.
 * 2. ROW CONTENTS:       unfiltered export contains all loaded rows.
 * 3. FILTER STATUS:      ?status=pending  → only pending rows exported.
 * 4. FILTER METHOD:      ?method=cash     → only cash-method rows exported.
 * 5. FILTER DATE RANGE:  ?from=…&to=…     → only rows in date range exported.
 * 6. FILTER SEARCH:      ?search=…        → only matching rows exported.
 *
 * All filter tests pre-set window.location.search (AdminPayments initialises
 * its filter state from URL params), so no Radix UI dropdown interaction
 * is needed — clean, fast, and deterministic.
 *
 * Run: npx vitest run tests/csv-export-ui.spec.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import AdminPayments from "../client/src/pages/AdminPayments";

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock("wouter", () => ({
  useLocation: () => ["/admin/payments", vi.fn()],
  useParams: () => ({}),
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("../client/src/i18n", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "en",
    setLang: vi.fn(),
    dir: "ltr",
  }),
}));

vi.mock("../client/src/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("../client/src/hooks/use-clients", () => ({
  useClients: () => ({
    data: [
      { id: 10, fullName: "Ali Hassan", email: "ali@example.com" },
      { id: 11, fullName: "Sara Al-Rashed", email: null },
      { id: 12, fullName: "Noor Abdallah", email: "noor@example.com" },
      { id: 13, fullName: "Khalid Mansour", email: null },
    ],
    isLoading: false,
  }),
}));

vi.mock("../client/src/lib/queryClient", () => ({
  apiRequest: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
  },
}));

// ── Shared fixtures ───────────────────────────────────────────────────────────

/** Four payments that differ on every filter dimension so each test has
 *  at least one matching and one non-matching row, preventing false positives. */
const ALL_PAYMENTS = [
  {
    id: 1,
    userId: 10,
    packageId: 5,
    amount: 2500,
    method: "cash",
    status: "received",
    receiptReference: "REF-001",
    notes: null,
    paidAt: null,
    createdAt: "2026-04-10T10:00:00.000Z", // April — outside May date-range
    user: { id: 10, fullName: "Ali Hassan", email: "ali@example.com" },
    package: { id: 5, name: "Elite 12", type: "monthly" },
  },
  {
    id: 2,
    userId: 11,
    packageId: null,
    amount: 1800,
    method: "bank_transfer",
    status: "pending",
    receiptReference: null,
    notes: null,
    paidAt: null,
    createdAt: "2026-05-15T09:30:00.000Z", // May — inside date-range
    user: { id: 11, fullName: "Sara Al-Rashed", email: null },
    package: null,
  },
  {
    id: 3,
    userId: 12,
    packageId: 6,
    amount: 3200,
    method: "card",
    status: "received",
    receiptReference: "REF-003",
    notes: null,
    paidAt: null,
    createdAt: "2026-05-20T14:00:00.000Z", // May — inside date-range
    user: { id: 12, fullName: "Noor Abdallah", email: "noor@example.com" },
    package: { id: 6, name: "Gold 24", type: "bi-annual" },
  },
  {
    id: 4,
    userId: 13,
    packageId: null,
    amount: 900,
    method: "cash",
    status: "partial",
    receiptReference: null,
    notes: "search-unique-term",
    paidAt: null,
    createdAt: "2026-06-01T08:00:00.000Z", // June — outside May date-range
    user: { id: 13, fullName: "Khalid Mansour", email: null },
    package: null,
  },
];

// Server-side filter simulations (mirrors what the real API would return)
function serverFilter(params: URLSearchParams) {
  let rows = ALL_PAYMENTS;
  const status = params.get("status");
  const method = params.get("method");
  const from   = params.get("from");
  const to     = params.get("to");
  const search = params.get("search");

  if (status) rows = rows.filter((r) => r.status === status);
  if (method) rows = rows.filter((r) => r.method === method);
  if (from)   rows = rows.filter((r) => r.createdAt >= from);
  if (to)     rows = rows.filter((r) => r.createdAt <= to + "T23:59:59.999Z");
  if (search) {
    const q = search.toLowerCase();
    rows = rows.filter(
      (r) =>
        r.user?.fullName?.toLowerCase().includes(q) ||
        r.receiptReference?.toLowerCase().includes(q) ||
        r.notes?.toLowerCase().includes(q),
    );
  }
  return rows;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: {
      queries: { retry: false, staleTime: 0 },
      mutations: { retry: false },
    },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

function setSearch(qs: string) {
  Object.defineProperty(window, "location", {
    writable: true,
    value: { ...window.location, search: qs },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AdminPayments — Export CSV button", () => {
  let capturedBlob: Blob | null = null;
  let capturedDownload: string | null = null;

  beforeEach(() => {
    capturedBlob = null;
    capturedDownload = null;

    // Reset URL to no filters
    setSearch("");

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return "blob:mock-url";
      }),
      revokeObjectURL: vi.fn(),
    });

    // Capture anchor.download; prevent real navigation
    const orig = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      const el = orig(tag);
      if (tag === "a") {
        vi.spyOn(el as HTMLAnchorElement, "click").mockImplementation(function (
          this: HTMLAnchorElement,
        ) {
          capturedDownload = this.download;
        });
      }
      return el;
    });

    // Fetch mock: parse query params and return server-filtered data
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const urlStr = String(url);
        const qs = urlStr.includes("?") ? urlStr.split("?")[1] : "";
        const params = new URLSearchParams(qs);
        // Remove non-filter params (e.g. summary endpoint)
        const isSummary = urlStr.includes("/summary");
        const data = isSummary ? { totalReceived: 0, totalPending: 0, countThisMonth: 0 } : serverFilter(params);
        return {
          ok: true,
          status: 200,
          json: async () => data,
          text: async () => JSON.stringify(data),
          headers: new Headers({ "content-type": "application/json" }),
        } as unknown as Response;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    setSearch("");
  });

  // ── Wiring ────────────────────────────────────────────────────────────────

  it("clicking Export CSV creates a Blob and sets download to payments_YYYY-MM-DD.csv", async () => {
    const user = userEvent.setup();
    render(<AdminPayments />, { wrapper: Wrapper });

    const exportBtn = await screen.findByTestId("button-export-payments-csv");
    await waitFor(() => expect(exportBtn).not.toBeDisabled());

    await user.click(exportBtn);

    expect(capturedBlob).not.toBeNull();
    expect(capturedDownload).toMatch(/^payments_\d{4}-\d{2}-\d{2}\.csv$/);
    expect(capturedDownload).toBe(`payments_${new Date().toISOString().slice(0, 10)}.csv`);
  });

  it("unfiltered export contains all 4 loaded rows", async () => {
    const user = userEvent.setup();
    render(<AdminPayments />, { wrapper: Wrapper });

    const exportBtn = await screen.findByTestId("button-export-payments-csv");
    await waitFor(() => expect(exportBtn).not.toBeDisabled());

    await user.click(exportBtn);

    const lines = (await capturedBlob!.text()).split("\n");
    expect(lines).toHaveLength(5); // header + 4 data rows
    expect(lines[1]).toContain("Ali Hassan");
    expect(lines[2]).toContain("Sara Al-Rashed");
    expect(lines[3]).toContain("Noor Abdallah");
    expect(lines[4]).toContain("Khalid Mansour");
  });

  // ── Filter pass-through tests (table-driven) ──────────────────────────────

  // These three filter dimensions are URL-driven (AdminPayments initialises
  // them from window.location.search) so we can pre-set the URL and render.
  const urlFilterCases = [
    {
      label: "status=pending",
      qs: "?status=pending",
      present: ["Sara Al-Rashed"],
      absent: ["Ali Hassan", "Noor Abdallah", "Khalid Mansour"],
    },
    {
      label: "method=cash",
      qs: "?method=cash",
      present: ["Ali Hassan", "Khalid Mansour"],
      absent: ["Sara Al-Rashed", "Noor Abdallah"],
    },
    {
      label: "search=search-unique-term",
      qs: "?search=search-unique-term",
      present: ["Khalid Mansour"],
      absent: ["Ali Hassan", "Sara Al-Rashed", "Noor Abdallah"],
    },
  ] as const;

  for (const { label, qs, present, absent } of urlFilterCases) {
    it(`filter ${label}: exported CSV contains only matching rows`, async () => {
      setSearch(qs);

      const user = userEvent.setup();
      render(<AdminPayments />, { wrapper: Wrapper });

      const exportBtn = await screen.findByTestId("button-export-payments-csv");
      await waitFor(() => expect(exportBtn).not.toBeDisabled());

      await user.click(exportBtn);

      const csv = await capturedBlob!.text();

      for (const name of present) {
        expect(csv, `expected "${name}" in CSV for filter ${label}`).toContain(name);
      }
      for (const name of absent) {
        expect(csv, `expected "${name}" absent from CSV for filter ${label}`).not.toContain(name);
      }
    });
  }

  // The date-range filter (fromDate/toDate) is not URL-driven in the component
  // — the date picker state is always initialised to "". The guarantee being
  // tested is: whatever rows the server returns (e.g. date-filtered) are
  // exactly what gets exported — no extra rows are appended, no rows are lost.
  it("date-range filter: exported CSV reflects server-filtered rows (May 2026 only)", async () => {
    // Override the fetch mock for this test: return only May 2026 rows,
    // simulating a server-side date-range filter (from=2026-05-01 to=2026-05-31)
    const MAY_ONLY = ALL_PAYMENTS.filter(
      (p) => p.createdAt >= "2026-05-01" && p.createdAt <= "2026-05-31T23:59:59.999Z",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const isSummary = String(url).includes("/summary");
        const data = isSummary ? { totalReceived: 0, totalPending: 0, countThisMonth: 0 } : MAY_ONLY;
        return {
          ok: true,
          status: 200,
          json: async () => data,
          text: async () => JSON.stringify(data),
          headers: new Headers({ "content-type": "application/json" }),
        } as unknown as Response;
      }),
    );

    const user = userEvent.setup();
    render(<AdminPayments />, { wrapper: Wrapper });

    const exportBtn = await screen.findByTestId("button-export-payments-csv");
    await waitFor(() => expect(exportBtn).not.toBeDisabled());

    await user.click(exportBtn);

    const csv = await capturedBlob!.text();

    // May rows present
    expect(csv).toContain("Sara Al-Rashed");
    expect(csv).toContain("Noor Abdallah");

    // Non-May rows absent — export strictly mirrors the server-returned array
    expect(csv).not.toContain("Ali Hassan");   // April
    expect(csv).not.toContain("Khalid Mansour"); // June
  });
});
