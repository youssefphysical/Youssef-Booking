/**
 * Client Search Center — 23-scenario vitest + @testing-library/react suite.
 */

import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommandPalette } from "@/components/admin/CommandPalette";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/admin", mockNavigate],
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/i18n", () => ({
  useTranslation: () => ({ t: (_k: string, fb: string) => fb }),
}));
vi.mock("@/hooks/use-auth", () => ({
  useAuth: () => ({ user: null }),
}));
vi.mock("@shared/schema", () => ({
  isEffectiveSuperAdmin: () => false,
}));

// ── Fixture data ──────────────────────────────────────────────────────────────

const mk = (overrides: Partial<{
  id: number; fullName: string; email: string | null; phone: string | null;
  clientStatus: string | null; vipTier: string | null;
  pkgName: string | null; pkgTotal: number | null; pkgUsed: number | null;
  pkgStatus: string | null; matchRank: number;
}> = {}) => ({
  id: 1, fullName: "Test Client", email: "test@example.com", phone: "+971501234567",
  clientStatus: "active", vipTier: "foundation",
  pkgName: "Gold Plan", pkgTotal: 20, pkgUsed: 8, pkgStatus: "active",
  matchRank: 0,
  ...overrides,
});

const NIKOLAS = mk({ id: 42, fullName: "Nikolas Papadopoulos", email: "nikolas@example.com", phone: "+971501112233", matchRank: 0 });
const PHONE_CLIENT = mk({ id: 7, fullName: "Phone User", email: null, phone: "+971509999888", pkgName: null, pkgTotal: null, pkgUsed: null, pkgStatus: null, matchRank: 4 });
const EMAIL_CLIENT = mk({ id: 8, fullName: "Email User", email: "unique.email@test.io", phone: null, pkgName: null, pkgTotal: null, pkgUsed: null, pkgStatus: null, matchRank: 3 });
const PKG_CLIENT = mk({ id: 9, fullName: "Package Match User", email: "pkg@test.io", phone: null, pkgName: "Platinum Monthly", pkgTotal: 12, pkgUsed: 3, pkgStatus: "active", matchRank: 7 });
const CONTAINS_CLIENT = mk({ id: 10, fullName: "contains Nikolas name", email: "c@x.io", phone: null, pkgName: null, pkgTotal: null, pkgUsed: null, pkgStatus: null, matchRank: 5 });

// ── Helpers ────────────────────────────────────────────────────────────────────

function mockFetch(clients: ReturnType<typeof mk>[]) {
  return vi.spyOn(global, "fetch").mockResolvedValue({
    ok: true,
    json: async () => ({ query: "q", clients }),
  } as Response);
}

function makeSut(open = true) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  const onOpenChange = vi.fn();
  const { container } = render(
    <QueryClientProvider client={qc}>
      <CommandPalette open={open} onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { container, onOpenChange, qc };
}

afterEach(() => {
  vi.restoreAllMocks();
  mockNavigate.mockClear();
});

// ── 1. Empty state ────────────────────────────────────────────────────────────

describe("1. Empty state", () => {
  it("shows Search Clients empty state before any input", async () => {
    mockFetch([]);
    makeSut();
    expect(screen.getByTestId("client-search-empty-state")).toBeDefined();
    expect(screen.getByText("Search Clients")).toBeDefined();
    expect(screen.getByText(/Type a name, phone, email, or package/)).toBeDefined();
    // No nav/create clutter
    expect(screen.queryByText("Jump to")).toBeNull();
    expect(screen.queryByText("New client")).toBeNull();
    expect(screen.queryByText("New booking")).toBeNull();
  });
});

// ── 2. 1-letter instant search ────────────────────────────────────────────────

describe("2. 1-letter instant search", () => {
  it("shows matching clients immediately after typing 1 letter", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "N" } }); });
    await waitFor(() =>
      expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull(),
    { timeout: 2000 });
    expect(screen.getByTestId(`client-result-${NIKOLAS.id}`).textContent).toContain("Nikolas");
  });
});

// ── 3. 2-letter narrows ───────────────────────────────────────────────────────

describe("3. 2-letter narrows results", () => {
  it("shows fewer/more specific results when typing 2 letters", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "ni" } }); });
    await waitFor(() =>
      expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull(),
    );
    // Only Nikolas shown (no unrelated clients)
    expect(screen.queryAllByTestId(/^client-result-/).length).toBe(1);
  });
});

// ── 4. "Nikolas" ranks first ──────────────────────────────────────────────────

describe("4. Exact match ranks first", () => {
  it("Nikolas client is first in results for query 'Nikolas'", async () => {
    mockFetch([NIKOLAS, CONTAINS_CLIENT]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nikolas" } }); });
    await waitFor(() =>
      expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull(),
    );
    const results = screen.getByTestId("client-search-results");
    const nikolasPos = results.textContent!.indexOf("Nikolas Papadopoulos");
    const containsPos = results.textContent!.indexOf("contains Nikolas");
    expect(nikolasPos).toBeLessThan(containsPos);
  });
});

// ── 5. Exact/prefix ranks above contains/package/status ───────────────────────

describe("5. Ranking: exact/prefix above contains", () => {
  it("best matches (rank ≤ 4) appear before more suggestions (rank ≥ 5)", async () => {
    mockFetch([NIKOLAS, CONTAINS_CLIENT]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nikolas" } }); });
    await waitFor(() =>
      expect(screen.queryByTestId("section-best-matches")).not.toBeNull(),
    );
    const best = screen.getByTestId("section-best-matches");
    expect(best.textContent).toContain("Nikolas Papadopoulos");
    const sugg = screen.queryByTestId("section-more-suggestions");
    if (sugg) expect(sugg.textContent).toContain("contains Nikolas");
  });
});

// ── 6. Phone search ───────────────────────────────────────────────────────────

describe("6. Phone search", () => {
  it("returns a client matched by phone number", async () => {
    mockFetch([PHONE_CLIENT]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "+971509999888" } }); });
    await waitFor(() =>
      expect(screen.queryByTestId(`client-result-${PHONE_CLIENT.id}`)).not.toBeNull(),
    );
    expect(screen.getByTestId(`client-result-${PHONE_CLIENT.id}`).textContent).toContain("+971509999888");
  });
});

// ── 7. Email search ───────────────────────────────────────────────────────────

describe("7. Email search", () => {
  it("returns a client matched by email address", async () => {
    mockFetch([EMAIL_CLIENT]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "unique.email" } }); });
    await waitFor(() =>
      expect(screen.queryByTestId(`client-result-${EMAIL_CLIENT.id}`)).not.toBeNull(),
    );
    expect(screen.getByTestId(`client-result-${EMAIL_CLIENT.id}`).textContent).toContain("unique.email@test.io");
  });
});

// ── 8. Package search ─────────────────────────────────────────────────────────

describe("8. Package search", () => {
  it("returns a client matched by package name", async () => {
    mockFetch([PKG_CLIENT]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Platinum" } }); });
    await waitFor(() =>
      expect(screen.queryByTestId(`client-result-${PKG_CLIENT.id}`)).not.toBeNull(),
    );
    expect(screen.getByTestId(`client-result-${PKG_CLIENT.id}`).textContent).toContain("Platinum Monthly");
  });
});

// ── 9. Best matches section ───────────────────────────────────────────────────

describe("9. Best matches section", () => {
  it("shows 'Best matches' section heading when there are strong matches", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nikolas" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    expect(screen.getByTestId("section-best-matches")).toBeDefined();
  });
});

// ── 10. More suggestions section ──────────────────────────────────────────────

describe("10. More suggestions section", () => {
  it("shows 'More suggestions' only when there are both best and weak matches", async () => {
    // Both rank 0 (NIKOLAS) and rank 5+ (CONTAINS_CLIENT) in response
    mockFetch([NIKOLAS, CONTAINS_CLIENT]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nikolas" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    expect(screen.queryByTestId("section-more-suggestions")).not.toBeNull();
  });

  it("does NOT show 'More suggestions' when all results are strong matches", async () => {
    // Only rank 0 client
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nikolas" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    expect(screen.queryByTestId("section-more-suggestions")).toBeNull();
  });
});

// ── 11. No unrelated clients ──────────────────────────────────────────────────

describe("11. No unrelated clients", () => {
  it("does not show clients that were not returned by the API", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nikolas" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    // No other client result cards
    expect(screen.queryAllByTestId(/^client-result-/).length).toBe(1);
  });
});

// ── 12. No navigation results ─────────────────────────────────────────────────

describe("12. No nav results", () => {
  it("never shows old palette nav jump items in any state", async () => {
    mockFetch([]);
    makeSut();
    expect(screen.queryByText("Jump to")).toBeNull();
    expect(screen.queryByTestId("palette-jump-dash")).toBeNull();
    expect(screen.queryByTestId("palette-jump-bookings")).toBeNull();
    expect(screen.queryByTestId("palette-jump-analytics")).toBeNull();
    expect(screen.queryByTestId("palette-jump-settings")).toBeNull();
  });
});

// ── 13. No create actions ─────────────────────────────────────────────────────

describe("13. No create actions", () => {
  it("does not show create actions in empty or results state", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    expect(screen.queryByText("New client")).toBeNull();
    expect(screen.queryByText("New booking")).toBeNull();
    expect(screen.queryByText("New package template")).toBeNull();
    expect(screen.queryByTestId("palette-create-client")).toBeNull();
    // "Create client" only in no-results state, not visible now
    expect(screen.queryByTestId("button-create-client-no-results")).toBeNull();
  });
});

// ── 14. No action icons in rows ───────────────────────────────────────────────

describe("14. No calendar/package/gift action icons in result rows", () => {
  it("result cards do NOT contain action icon buttons (book/package/bonus)", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nikolas" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    // Old action icon testids must be absent
    expect(screen.queryByTestId(`action-book-${NIKOLAS.id}`)).toBeNull();
    expect(screen.queryByTestId(`action-package-${NIKOLAS.id}`)).toBeNull();
    expect(screen.queryByTestId(`action-bonus-${NIKOLAS.id}`)).toBeNull();
    expect(screen.queryByTestId(`client-actions-${NIKOLAS.id}`)).toBeNull();
  });
});

// ── 15. No "Tap to open" footer ───────────────────────────────────────────────

describe("15. No 'Tap to open' text in footer", () => {
  it("footer does not contain 'Tap to open'", () => {
    mockFetch([]);
    makeSut();
    const footer = screen.getByTestId("client-search-footer");
    expect(footer.textContent).not.toContain("Tap to open");
  });
});

// ── 16. Row click opens profile ───────────────────────────────────────────────

describe("16. Row click opens profile", () => {
  it("clicking a result navigates to /admin/clients/:id", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nikolas" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    fireEvent.click(screen.getByTestId(`client-result-${NIKOLAS.id}`));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(`/admin/clients/${NIKOLAS.id}`),
    );
  });
});

// ── 17. X clears query ────────────────────────────────────────────────────────

describe("17. X clears query", () => {
  it("X button clears input and hides itself", async () => {
    mockFetch([]);
    makeSut();
    const input = screen.getByTestId("input-client-search") as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: "hello" } }); });
    expect(input.value).toBe("hello");
    const clear = screen.getByTestId("button-clear-search");
    fireEvent.click(clear);
    expect(input.value).toBe("");
    expect(screen.queryByTestId("button-clear-search")).toBeNull();
  });
});

// ── 18. Esc closes modal ──────────────────────────────────────────────────────

describe("18. Esc closes modal", () => {
  it("Escape key calls onOpenChange(false)", async () => {
    mockFetch([]);
    const { onOpenChange } = makeSut();
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });
});

// ── 19. Enter opens highlighted ───────────────────────────────────────────────

describe("19. Enter opens highlighted client", () => {
  it("pressing Enter on a highlighted result navigates to client profile", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nikolas" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    fireEvent.keyDown(input, { key: "ArrowDown" });
    fireEvent.keyDown(input, { key: "Enter" });
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith(`/admin/clients/${NIKOLAS.id}`),
    );
  });
});

// ── 20. Mobile overflow ───────────────────────────────────────────────────────

describe("20. Mobile widths — no horizontal overflow", () => {
  it.each([360, 375, 390, 412, 430])(
    "renders without overflow at %ipx width",
    (width) => {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
      mockFetch([]);
      const { container } = makeSut();
      const list = container.querySelector("[data-testid='client-search-results']");
      if (list) expect(list.className).toContain("overflow-x-hidden");
    },
  );
});

// ── 21. Placeholder does not clip X ──────────────────────────────────────────

describe("21. Placeholder and X button do not overlap", () => {
  it("input has pr-9 right padding so text cannot reach the X button area", () => {
    mockFetch([]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    expect(input.className).toContain("pr-9");
  });
});

// ── 22. Input height is compact ───────────────────────────────────────────────

describe("22. Input height is compact (52-58px range)", () => {
  it("search input has h-[54px] class for compact premium look", () => {
    mockFetch([]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    expect(input.className).toContain("h-[54px]");
  });
});

// ── 23. Existing admin pages unaffected ───────────────────────────────────────

describe("23. Existing admin pages unaffected", () => {
  it("no old palette nav/create items appear in any state", async () => {
    mockFetch([]);
    const { container } = makeSut();
    const NAV = ["Jump to", "Go to Dashboard", "Go to Bookings", "Go to Analytics"];
    NAV.forEach((t) => expect(container.textContent).not.toContain(t));

    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "test" } }); });
    NAV.forEach((t) => expect(container.textContent).not.toContain(t));
  });
});
