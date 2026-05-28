/**
 * CSV Export — UI Behavioral Test (Vitest + React Testing Library)
 *
 * Renders AdminPayments in jsdom, waits for payments to load from the mocked
 * fetch, then clicks `button-export-payments-csv` to trigger the download
 * path through the real component wiring.
 *
 * 1. BUTTON WIRING: clicking Export CSV triggers URL.createObjectURL with a
 *    Blob and sets the anchor's `download` attribute to the correct filename.
 * 2. FILTER PASS-THROUGH: after applying a status filter the exported CSV
 *    contains only the rows returned by the (filtered) fetch — confirming the
 *    component passes the live payments array, not a stale/unfiltered one.
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
    data: [{ id: 10, fullName: "Ali Hassan", email: "ali@example.com" }],
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
    createdAt: "2026-05-01T10:00:00.000Z",
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
    createdAt: "2026-05-15T09:30:00.000Z",
    user: { id: 11, fullName: "Sara Al-Rashed", email: null },
    package: null,
  },
];

const PENDING_ONLY = ALL_PAYMENTS.filter((p) => p.status === "pending");

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AdminPayments — Export CSV button", () => {
  let capturedBlob: Blob | null = null;
  let capturedDownload: string | null = null;

  beforeEach(() => {
    capturedBlob = null;
    capturedDownload = null;

    vi.stubGlobal("URL", {
      createObjectURL: vi.fn((blob: Blob) => {
        capturedBlob = blob;
        return "blob:mock-url";
      }),
      revokeObjectURL: vi.fn(),
    });

    // Capture download attribute from the anchor created by exportPaymentsToCSV;
    // prevent real navigation in jsdom
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

    // Mock fetch: return ALL_PAYMENTS for unfiltered, PENDING_ONLY when
    // status=pending is in the URL
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const urlStr = String(url);
        const data = urlStr.includes("status=pending") ? PENDING_ONLY : ALL_PAYMENTS;
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
  });

  it("clicking Export CSV creates a Blob and sets the download filename to payments_YYYY-MM-DD.csv", async () => {
    const user = userEvent.setup();
    render(<AdminPayments />, { wrapper: Wrapper });

    // Wait until the Export CSV button is enabled (payments loaded)
    const exportBtn = await screen.findByTestId("button-export-payments-csv");
    await waitFor(() => expect(exportBtn).not.toBeDisabled());

    await user.click(exportBtn);

    // A Blob must have been handed to createObjectURL
    expect(capturedBlob).not.toBeNull();

    // Download filename must match payments_YYYY-MM-DD.csv
    expect(capturedDownload).toMatch(/^payments_\d{4}-\d{2}-\d{2}\.csv$/);
    const today = new Date().toISOString().slice(0, 10);
    expect(capturedDownload).toBe(`payments_${today}.csv`);
  });

  it("the exported blob contains exactly the rows currently in the payments list", async () => {
    const user = userEvent.setup();
    render(<AdminPayments />, { wrapper: Wrapper });

    const exportBtn = await screen.findByTestId("button-export-payments-csv");
    await waitFor(() => expect(exportBtn).not.toBeDisabled());

    await user.click(exportBtn);

    const csv = await capturedBlob!.text();
    const lines = csv.split("\n");

    // header + 2 data rows
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Ali Hassan");
    expect(lines[2]).toContain("Sara Al-Rashed");
  });

  it("when component starts with status=pending filter the exported CSV contains only pending rows", async () => {
    // AdminPayments reads initial filter state from window.location.search,
    // so pre-setting ?status=pending means the component mounts with that filter
    // applied — fetch returns PENDING_ONLY and Export CSV exports exactly that.
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, search: "?status=pending" },
    });

    const user = userEvent.setup();
    render(<AdminPayments />, { wrapper: Wrapper });

    const exportBtn = await screen.findByTestId("button-export-payments-csv");
    await waitFor(() => expect(exportBtn).not.toBeDisabled());

    await user.click(exportBtn);

    const csv = await capturedBlob!.text();
    const lines = csv.split("\n");

    // header + 1 pending row only — "Ali Hassan" (received) must be absent
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain("Sara Al-Rashed");
    expect(lines[1]).not.toContain("Ali Hassan");

    // Restore search to avoid leaking state into other tests
    Object.defineProperty(window, "location", {
      writable: true,
      value: { ...window.location, search: "" },
    });
  });
});
