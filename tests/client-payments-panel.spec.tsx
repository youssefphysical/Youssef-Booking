/**
 * Client Payments Panel — Vitest / React Testing Library Behavioral Test
 *
 * Verifies runtime behavior of ClientPaymentsPanel inside AdminClientDetail:
 *
 * 1. NAVIGATION:  The "Payments" tab appears in the tab rail with the correct
 *                 data-testid (tab-detail-payments).
 * 2. API PARAM:   When the Payments tab is clicked, a fetch is made to
 *                 /api/admin/payments that includes ?userId=42.
 * 3. PANEL UI:    panel-client-payments, button-add-payment-for-client, and
 *                 text-payments-received-total are present after tab click.
 * 4. PREFILL:     Clicking "Add Payment" opens a dialog whose client field
 *                 is locked (data-testid=select-payment-client-prefilled),
 *                 confirming the current client is pre-filled.
 *
 * Run: npx vitest run tests/client-payments-panel.spec.tsx
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import AdminClientDetail from "../client/src/pages/AdminClientDetail";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Router: pretend we're viewing client id 42
vi.mock("wouter", () => ({
  useParams: () => ({ id: "42" }),
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
  useLocation: () => ["/admin/clients/42", vi.fn()],
}));

// i18n: return the fallback string for every key
vi.mock("../client/src/i18n", () => ({
  useTranslation: () => ({
    t: (_key: string, fallback?: string) => fallback ?? _key,
    lang: "en",
    setLang: vi.fn(),
    dir: "ltr",
  }),
}));

// Clients hook: expose a single mock client with id 42
const MOCK_CLIENT = {
  id: 42,
  fullName: "Test Client",
  email: "test@example.com",
  role: "client",
  isVerified: false,
  clientStatus: "active",
  vipTier: null,
  primaryGoal: null,
  fitnessGoal: null,
  phone: null,
  area: null,
  profilePictureUrl: null,
  health: null,
  medicalFlags: [],
};

vi.mock("../client/src/hooks/use-clients", () => ({
  useClients: () => ({ data: [MOCK_CLIENT], isLoading: false }),
}));

vi.mock("../client/src/hooks/use-settings", () => ({
  useSettings: () => ({ data: {}, isLoading: false }),
  useUpdateSettings: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../client/src/hooks/use-packages", () => ({
  usePackages: () => ({ data: [], isLoading: false }),
  useCreatePackage: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdatePackage: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePackage: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../client/src/hooks/use-bookings", () => ({
  useBookings: () => ({ data: [], isLoading: false }),
  useCreateBooking: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateBooking: () => ({ mutate: vi.fn(), isPending: false }),
  useCancelBooking: () => ({ mutate: vi.fn(), isPending: false }),
  useSameDayAdjust: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteBooking: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../client/src/hooks/use-progress", () => ({
  useProgressPhotos: () => ({ data: [], isLoading: false }),
  useUploadProgressPhoto: () => ({ mutate: vi.fn(), isPending: false }),
  useDeleteProgressPhoto: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../client/src/hooks/use-package-templates", () => ({
  usePackageTemplates: () => ({ data: [], isLoading: false }),
  useCreatePackageTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdatePackageTemplate: () => ({ mutate: vi.fn(), isPending: false }),
  useDeletePackageTemplate: () => ({ mutate: vi.fn(), isPending: false }),
}));

vi.mock("../client/src/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("../client/src/lib/queryClient", () => ({
  apiRequest: vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) }),
  queryClient: {
    invalidateQueries: vi.fn(),
    setQueryData: vi.fn(),
    getQueryData: vi.fn(),
  },
}));

// Heavy complex components that would crash in jsdom or slow tests down
vi.mock("../client/src/components/admin/ClientCommandCenter", () => ({
  ClientCommandCenter: () => null,
}));

vi.mock("../client/src/components/admin/QuickActionsPanel", () => ({
  QuickActionsPanel: () => null,
}));

vi.mock("../client/src/components/ActivityFeed", () => ({
  ActivityFeed: () => null,
}));

vi.mock("../client/src/components/UserAvatar", () => ({
  UserAvatar: () => <div data-testid="mock-user-avatar" />,
}));

vi.mock("../client/src/components/BeforeAfterCompare", () => ({
  default: () => null,
}));

vi.mock("../client/src/components/CoachNotesDialog", () => ({
  default: () => null,
}));

vi.mock("../client/src/components/VerifiedBadge", () => ({
  VerifiedBadge: () => null,
}));

vi.mock("../client/src/components/HealthBadge", () => ({
  HealthBadge: () => null,
}));

vi.mock("../client/src/components/ImageCropper", () => ({
  ImageCropper: () => null,
  dataUrlToFile: vi.fn(),
}));

// ── Test helpers ──────────────────────────────────────────────────────────────

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

describe("ClientPaymentsPanel inside AdminClientDetail", () => {
  let fetchedUrls: string[] = [];

  beforeEach(() => {
    fetchedUrls = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        const urlStr = String(url);
        fetchedUrls.push(urlStr);
        return {
          ok: true,
          status: 200,
          json: async () => [],
          text: async () => "[]",
          headers: new Headers({ "content-type": "application/json" }),
        } as unknown as Response;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('renders the "Payments" tab in the CLIENT_TABS tab rail', async () => {
    render(<AdminClientDetail />, { wrapper: Wrapper });

    const paymentsTab = await screen.findByTestId("tab-detail-payments");
    expect(paymentsTab).toBeInTheDocument();
    expect(paymentsTab.textContent).toContain("Payments");
  });

  it("passes ?userId=42 to GET /api/admin/payments when the Payments tab is activated", async () => {
    const user = userEvent.setup();
    render(<AdminClientDetail />, { wrapper: Wrapper });

    const paymentsTab = await screen.findByTestId("tab-detail-payments");
    await user.click(paymentsTab);

    // Wait for the panel to mount (proof the tab content rendered)
    await screen.findByTestId("panel-client-payments");

    // The fetch to the payments endpoint must include the userId param
    await waitFor(() => {
      const hit = fetchedUrls.find((u) => u.includes("/api/admin/payments"));
      expect(hit).toBeDefined();
      expect(hit).toContain("userId=42");
    });
  });

  it("renders panel-client-payments, Add Payment button, and received total after clicking the tab", async () => {
    const user = userEvent.setup();
    render(<AdminClientDetail />, { wrapper: Wrapper });

    const paymentsTab = await screen.findByTestId("tab-detail-payments");
    await user.click(paymentsTab);

    expect(await screen.findByTestId("panel-client-payments")).toBeInTheDocument();
    expect(screen.getByTestId("button-add-payment-for-client")).toBeInTheDocument();
    expect(screen.getByTestId("text-payments-received-total")).toBeInTheDocument();
  });

  it("opens a pre-filled dialog (select-payment-client-prefilled) when Add Payment is clicked", async () => {
    const user = userEvent.setup();
    render(<AdminClientDetail />, { wrapper: Wrapper });

    // Navigate to the Payments tab
    const paymentsTab = await screen.findByTestId("tab-detail-payments");
    await user.click(paymentsTab);

    // Click Add Payment
    const addBtn = await screen.findByTestId("button-add-payment-for-client");
    await user.click(addBtn);

    // The dialog should lock the client field (prefilled) instead of showing a picker
    expect(await screen.findByTestId("select-payment-client-prefilled")).toBeInTheDocument();
  });
});
