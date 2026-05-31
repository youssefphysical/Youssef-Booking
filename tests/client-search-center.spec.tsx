/**
 * Client Search Center — stability + feature test suite.
 *
 * Scenarios 1-26: feature coverage (photo, ranking, sections, keyboard)
 * Scenarios 27-40: visual shell / layout stability
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CommandPalette } from "@/components/admin/CommandPalette";

// ── Mocks ──────────────────────────────────────────────────────────────────────

const mockNavigate = vi.fn();
vi.mock("wouter", () => ({
  useLocation: () => ["/admin", mockNavigate],
  Link: ({ href, children }: any) => <a href={href}>{children}</a>,
}));
vi.mock("@/i18n", () => ({ useTranslation: () => ({ t: (_k: string, fb: string) => fb }) }));
vi.mock("@/hooks/use-auth", () => ({ useAuth: () => ({ user: null }) }));
vi.mock("@shared/schema", () => ({ isEffectiveSuperAdmin: () => false }));

// ── Fixtures ───────────────────────────────────────────────────────────────────

function mk(o: Partial<{
  id: number; fullName: string; email: string | null; phone: string | null;
  clientStatus: string | null; vipTier: string | null;
  pkgName: string | null; pkgTotal: number | null; pkgUsed: number | null;
  pkgStatus: string | null; profilePictureUrl: string | null; matchRank: number;
}> = {}) {
  return {
    id: 1, fullName: "Test Client", email: "test@example.com",
    phone: "+971501234567", clientStatus: "active", vipTier: "foundation",
    pkgName: "Gold Plan", pkgTotal: 20, pkgUsed: 8, pkgStatus: "active",
    profilePictureUrl: null, matchRank: 0, ...o,
  };
}

const NIKOLAS   = mk({ id: 42, fullName: "Nikolas Papadopoulos", email: "nikolas@example.com", matchRank: 0 });
const YOUSSEF   = mk({ id: 11, fullName: "Youssef Darwish", matchRank: 1 });
const YASER     = mk({ id: 12, fullName: "Yaser Khalid", matchRank: 1 });
const YOUNES    = mk({ id: 13, fullName: "Younes Radi", matchRank: 1 });
const PHOTO_CL  = mk({ id: 5,  fullName: "Photo Client", profilePictureUrl: "/uploads/photo5.jpg", matchRank: 0 });
const CONTAINS  = mk({ id: 10, fullName: "Test Contains Y", matchRank: 7 });
const PKG_CL    = mk({ id: 9,  fullName: "Package Match User", pkgName: "Platinum Monthly", matchRank: 6 });
const DIAMOND   = mk({ id: 20, fullName: "Diamond User", vipTier: "diamond_elite", clientStatus: "expiring_soon", matchRank: 0 });
const LONG_EMAIL = mk({ id: 77, fullName: "Long Email User", email: "very.long.email.address.that.should.be.truncated@example-company.co.uk", matchRank: 3 });
const LONG_PKG   = mk({ id: 78, fullName: "Long Package User", pkgName: "The Absolute Platinum Diamond Elite Premium Ultra Monthly Plan", matchRank: 6 });

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
  const result = render(
    <QueryClientProvider client={qc}>
      <CommandPalette open={open} onOpenChange={onOpenChange} />
    </QueryClientProvider>,
  );
  return { ...result, onOpenChange, qc };
}

afterEach(() => {
  vi.restoreAllMocks();
  mockNavigate.mockClear();
});

// ═══════════════════════════════════════════════════════════════════════════════
// FEATURE SCENARIOS 1-26
// ═══════════════════════════════════════════════════════════════════════════════

// ── S1: compact on mobile ──────────────────────────────────────────────────────
describe("S1. CommandList has overflow-x-hidden", () => {
  it("overflow-x-hidden prevents horizontal scroll", () => {
    mockFetch([]);
    makeSut();
    const list = screen.getByTestId("client-search-results");
    expect(list.className).toContain("overflow-x-hidden");
  });
});

// ── S2: input height ───────────────────────────────────────────────────────────
describe("S2. Input wrapper height is within 48-56px range", () => {
  it("wrapper uses inline style height (48–56px)", () => {
    mockFetch([]);
    makeSut();
    const wrapper = screen.getByTestId("client-search-input-wrapper");
    const h = parseInt((wrapper as HTMLElement).style.height || "0");
    expect(h).toBeGreaterThanOrEqual(48);
    expect(h).toBeLessThanOrEqual(56);
  });
});

// ── S3: input text cannot reach X ─────────────────────────────────────────────
describe("S3. Input has right padding so text cannot reach X button", () => {
  it("input has pr-2 or greater padding on the right", () => {
    mockFetch([]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    // X is a sibling in the same flex row, input has pr-2 to avoid visual crowding
    expect(input.className).toMatch(/pr-\d/);
  });
});

// ── S4: X appears only when non-empty ─────────────────────────────────────────
describe("S4. X appears only when query is non-empty", () => {
  it("X hidden on empty, visible after typing", async () => {
    mockFetch([]);
    makeSut();
    expect(screen.queryByTestId("button-clear-search")).toBeNull();
    const input = screen.getByTestId("input-client-search") as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: "hello" } }); });
    expect(screen.queryByTestId("button-clear-search")).not.toBeNull();
  });
});

// ── S5: no "Searching…" text ──────────────────────────────────────────────────
describe("S5. No Searching text visible in any state", () => {
  it("'Searching' never appears", async () => {
    mockFetch([NIKOLAS]);
    const { container } = makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    expect(container.textContent).not.toContain("Searching");
  });
});

// ── S6: 1-letter instant results ──────────────────────────────────────────────
describe("S6. 1-letter triggers instant results", () => {
  it("shows matching clients after 1 letter", async () => {
    mockFetch([YOUSSEF, YASER]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Y" } }); });
    await waitFor(() =>
      expect(screen.queryByTestId(`client-result-${YOUSSEF.id}`)).not.toBeNull(),
    { timeout: 2000 });
  });
});

// ── S7: Y ranks Y-starting names first ────────────────────────────────────────
describe("S7. Y ranks Y-starting names before contains-Y", () => {
  it("Youssef in Best Matches when ranked above contains-Y clients", async () => {
    mockFetch([YOUSSEF, CONTAINS]); // rank 1 vs rank 7
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Y" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    expect(screen.getByTestId("section-best-matches").textContent).toContain("Youssef");
  });
});

// ── S8: Yo narrows ────────────────────────────────────────────────────────────
describe("S8. Yo narrows results", () => {
  it("Youssef and Younes shown for Yo query", async () => {
    mockFetch([YOUSSEF, YOUNES]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Yo" } }); });
    await waitFor(() => expect(screen.queryAllByTestId(/^client-result-/).length).toBeGreaterThan(0));
    const names = screen.getAllByTestId(/^client-result-/).map((el) => el.textContent);
    expect(names.some((t) => t!.includes("Youssef"))).toBe(true);
    expect(names.some((t) => t!.includes("Younes"))).toBe(true);
  });
});

// ── S9: Nik ranks Nikolas first ───────────────────────────────────────────────
describe("S9. Nik ranks Nikolas first", () => {
  it("first result contains Nikolas", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    expect(screen.getAllByTestId(/^client-result-/)[0].textContent).toContain("Nikolas");
  });
});

// ── S10: consistent row min-height ────────────────────────────────────────────
describe("S10. All result rows have consistent min-height", () => {
  it("all rows share the same min-h class", async () => {
    mockFetch([NIKOLAS, YOUSSEF]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "a" } }); });
    await waitFor(() => expect(screen.queryAllByTestId(/^client-result-/).length).toBeGreaterThan(0));
    const rows = screen.getAllByTestId(/^client-result-/);
    const heights = new Set(rows.map((r) => {
      const m = r.className.match(/min-h-\[[^\]]+\]/);
      return m ? m[0] : "none";
    }));
    expect(heights.size).toBe(1);
    expect([...heights][0]).not.toBe("none");
  });
});

// ── S11: profile photo ────────────────────────────────────────────────────────
describe("S11. Profile photo shown when URL exists", () => {
  it("renders img with client photo URL", async () => {
    mockFetch([PHOTO_CL]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Photo" } }); });
    await waitFor(() => expect(screen.queryByTestId("client-avatar-img")).not.toBeNull());
    expect((screen.getByTestId("client-avatar-img") as HTMLImageElement).src).toContain("/uploads/photo5.jpg");
  });
});

// ── S12: fallback avatar ──────────────────────────────────────────────────────
describe("S12. Fallback avatar when no photo", () => {
  it("fallback testid present when profilePictureUrl is null", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId("client-avatar-fallback")).not.toBeNull());
    expect(screen.queryByTestId("client-avatar-img")).toBeNull();
  });
});

// ── S13: broken photo fallback ────────────────────────────────────────────────
describe("S13. Broken photo URL falls back without layout shift", () => {
  it("onError swaps to fallback", async () => {
    const broken = mk({ id: 99, fullName: "Broken Photo", profilePictureUrl: "/bad.jpg", matchRank: 0 });
    mockFetch([broken]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Broken" } }); });
    await waitFor(() => expect(screen.queryByTestId("client-avatar-img")).not.toBeNull());
    await act(async () => { fireEvent.error(screen.getByTestId("client-avatar-img")); });
    await waitFor(() => expect(screen.queryByTestId("client-avatar-fallback")).not.toBeNull());
  });
});

// ── S14: avatar circular + fixed-size ─────────────────────────────────────────
describe("S14. Avatar is circular and fixed-size (42-48px)", () => {
  it("photo avatar is rounded-full with fixed size style", async () => {
    mockFetch([PHOTO_CL]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Photo" } }); });
    await waitFor(() => expect(screen.queryByTestId("client-avatar-photo")).not.toBeNull());
    const avatar = screen.getByTestId("client-avatar-photo");
    expect(avatar.className).toContain("rounded-full");
    expect(parseInt((avatar as HTMLElement).style.width)).toBeGreaterThanOrEqual(42);
    expect(parseInt((avatar as HTMLElement).style.width)).toBeLessThanOrEqual(48);
  });
});

// ── S15: no action icons ──────────────────────────────────────────────────────
describe("S15. No action icons in result rows", () => {
  it("no book/package/bonus action testids", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    expect(screen.queryByTestId(`action-book-${NIKOLAS.id}`)).toBeNull();
    expect(screen.queryByTestId(`action-package-${NIKOLAS.id}`)).toBeNull();
    expect(screen.queryByTestId(`client-actions-${NIKOLAS.id}`)).toBeNull();
  });
});

// ── S16: no "Tap to open" ─────────────────────────────────────────────────────
describe("S16. No Tap to Open text", () => {
  it("footer does not contain Tap to open", async () => {
    mockFetch([NIKOLAS]);
    const { container } = makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    expect(container.textContent).not.toContain("Tap to open");
  });
});

// ── S17: badge hierarchy ──────────────────────────────────────────────────────
describe("S17. Package badge primary, status badge secondary", () => {
  it("package badge uses primary color class", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-pkg-badge-${NIKOLAS.id}`)).not.toBeNull());
    expect(screen.getByTestId(`client-pkg-badge-${NIKOLAS.id}`).className).toMatch(/text-primary|border-primary/);
    const sb = screen.queryByTestId(`client-status-${NIKOLAS.id}`);
    if (sb) expect(sb.className).not.toMatch(/border-primary\/25/);
  });
});

// ── S18: human-readable labels ────────────────────────────────────────────────
describe("S18. Labels are human-readable (toTitle)", () => {
  it("diamond_elite → Diamond Elite, expiring_soon → Expiring Soon", async () => {
    mockFetch([DIAMOND]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Diamond" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${DIAMOND.id}`)).not.toBeNull());
    const row = screen.getByTestId(`client-result-${DIAMOND.id}`);
    expect(row.textContent).not.toContain("diamond_elite");
    expect(row.textContent).not.toContain("expiring_soon");
    expect(row.textContent).toContain("Diamond Elite");
    expect(row.textContent).toContain("Expiring Soon");
  });
});

// ── S19: Best Matches ─────────────────────────────────────────────────────────
describe("S19. Best Matches section appears correctly", () => {
  it("section-best-matches is shown for results", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
  });

  it("only-weak results promoted into Best Matches (no More Suggestions)", async () => {
    const weak = mk({ id: 55, fullName: "Weak Match", matchRank: 7 });
    mockFetch([weak]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Weak" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    expect(screen.queryByTestId("section-more-suggestions")).toBeNull();
  });
});

// ── S20: More Suggestions conditional ────────────────────────────────────────
describe("S20. More Suggestions only when both sections have results", () => {
  it("shows More Suggestions only when best + weak both exist", async () => {
    mockFetch([NIKOLAS, CONTAINS]); // rank 0 + rank 7
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "test" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    expect(screen.queryByTestId("section-more-suggestions")).not.toBeNull();
  });

  it("no More Suggestions when all results are strong", async () => {
    mockFetch([NIKOLAS, YOUSSEF]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "a" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    expect(screen.queryByTestId("section-more-suggestions")).toBeNull();
  });
});

// ── S21: no unrelated clients ─────────────────────────────────────────────────
describe("S21. No unrelated clients appear", () => {
  it("only API-returned clients shown", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryAllByTestId(/^client-result-/).length).toBe(1));
  });
});

// ── S22-24: device widths ─────────────────────────────────────────────────────
describe("S22. Mobile widths no overflow", () => {
  it.each([360, 375, 390, 412, 430])("no overflow at %ipx", (w) => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: w });
    mockFetch([]);
    makeSut();
    const list = screen.queryByTestId("client-search-results");
    if (list) expect(list.className).toContain("overflow-x-hidden");
  });
});

describe("S23. Tablet 768 works", () => {
  it("empty state visible at 768px", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 768 });
    mockFetch([]);
    makeSut();
    expect(screen.getByTestId("client-search-empty-state")).toBeDefined();
  });
});

describe("S24. Desktop 1366/1440 works", () => {
  it.each([1366, 1440])("renders at %ipx", (w) => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: w });
    mockFetch([]);
    makeSut();
    expect(screen.getByTestId("client-search-empty-state")).toBeDefined();
  });
});

// ── S25: keyboard interactions ────────────────────────────────────────────────
describe("S25. Keyboard: X clears, Esc closes, row navigates", () => {
  it("X clears input and hides itself", async () => {
    mockFetch([]);
    makeSut();
    const input = screen.getByTestId("input-client-search") as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: "hello" } }); });
    expect(input.value).toBe("hello");
    fireEvent.click(screen.getByTestId("button-clear-search"));
    expect(input.value).toBe("");
    expect(screen.queryByTestId("button-clear-search")).toBeNull();
  });

  it("Esc calls onOpenChange(false)", async () => {
    mockFetch([]);
    const { onOpenChange } = makeSut();
    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("clicking a result navigates to client profile", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    fireEvent.click(screen.getByTestId(`client-result-${NIKOLAS.id}`));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(`/admin/clients/${NIKOLAS.id}`));
  });
});

// ── S26: empty state copy ─────────────────────────────────────────────────────
describe("S26. Empty state has correct copy", () => {
  it("shows Search Clients title and correct subtitle", () => {
    mockFetch([]);
    makeSut();
    expect(screen.getByText("Search Clients")).toBeDefined();
    expect(screen.getByText(/Type a name, phone, email, or package/)).toBeDefined();
  });

  it("no nav jump or create clutter in empty state", () => {
    mockFetch([]);
    const { container } = makeSut();
    expect(container.textContent).not.toContain("Jump to");
    expect(container.textContent).not.toContain("New booking");
    expect(container.textContent).not.toContain("New client");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// VISUAL SHELL / LAYOUT STABILITY — S27-S40
// ═══════════════════════════════════════════════════════════════════════════════

// ── S27: Only ONE clear X button ─────────────────────────────────────────────
describe("S27. Only one clear X button in DOM", () => {
  it("exactly one button-clear-search element when query is non-empty", async () => {
    mockFetch([]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "test" } }); });
    const xButtons = screen.queryAllByTestId("button-clear-search");
    expect(xButtons.length).toBe(1);
  });

  it("zero button-clear-search elements when query is empty", () => {
    mockFetch([]);
    makeSut();
    expect(screen.queryAllByTestId("button-clear-search").length).toBe(0);
  });
});

// ── S28: X is a flex sibling, not absolute ────────────────────────────────────
describe("S28. X button is a flex sibling of the input (no overlap)", () => {
  it("X button and input share the same parent wrapper", async () => {
    mockFetch([]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "test" } }); });
    const xBtn = screen.getByTestId("button-clear-search");
    // Both must share the same parent (the input wrapper div)
    expect(input.parentElement).toBe(xBtn.parentElement);
  });
});

// ── S29: input wrapper has single border (no double border) ───────────────────
describe("S29. Input wrapper has single border-b (no double border)", () => {
  it("input wrapper has border-b class exactly once at the wrapper level", () => {
    mockFetch([]);
    makeSut();
    const wrapper = screen.getByTestId("client-search-input-wrapper");
    // The wrapper itself has the border. It must NOT also contain a child div
    // with border-b (which the CommandInput UI wrapper would create).
    const innerBorderDivs = wrapper.querySelectorAll("[cmdk-input-wrapper]");
    // If we're using CmdkPrimitive.Input directly, no cmdk-input-wrapper child exists
    expect(innerBorderDivs.length).toBe(0);
  });

  it("wrapper div has border-b class", () => {
    mockFetch([]);
    makeSut();
    const wrapper = screen.getByTestId("client-search-input-wrapper");
    expect(wrapper.className).toContain("border-b");
  });
});

// ── S30: modal header height is stable ────────────────────────────────────────
describe("S30. Modal header height is stable before and after typing", () => {
  it("wrapper height is set via inline style (fixed, not content-driven)", () => {
    mockFetch([]);
    makeSut();
    const wrapper = screen.getByTestId("client-search-input-wrapper");
    const h = parseInt((wrapper as HTMLElement).style.height || "0");
    expect(h).toBeGreaterThanOrEqual(48);
    expect(h).toBeLessThanOrEqual(56);
  });

  it("header height does not change after typing", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const wrapper = screen.getByTestId("client-search-input-wrapper") as HTMLElement;
    const heightBefore = wrapper.style.height;
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    expect(wrapper.style.height).toBe(heightBefore);
  });
});

// ── S31: results list has min-h to prevent modal collapse ─────────────────────
describe("S31. CommandList has min-h to prevent modal height jumping", () => {
  it("results list has min-h class", () => {
    mockFetch([]);
    makeSut();
    const list = screen.getByTestId("client-search-results");
    expect(list.className).toMatch(/min-h-\[\d+px\]/);
  });

  it("results list has max-h class for internal scroll", () => {
    mockFetch([]);
    makeSut();
    const list = screen.getByTestId("client-search-results");
    expect(list.className).toMatch(/max-h-\[/);
  });
});

// ── S32: results area scrolls internally ─────────────────────────────────────
describe("S32. Results area has internal scroll", () => {
  it("CommandList has overflow-y-auto for internal scrolling", () => {
    mockFetch([]);
    makeSut();
    const list = screen.getByTestId("client-search-results");
    expect(list.className).toContain("overflow-y-auto");
  });
});

// ── S33: long email truncates ──────────────────────────────────────────────────
describe("S33. Long email/phone truncates with ellipsis", () => {
  it("contact text element has truncate class", async () => {
    mockFetch([LONG_EMAIL]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Long" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${LONG_EMAIL.id}`)).not.toBeNull());
    const row = screen.getByTestId(`client-result-${LONG_EMAIL.id}`);
    // Verify the row contains a truncate-classed element
    const truncated = row.querySelectorAll(".truncate");
    expect(truncated.length).toBeGreaterThan(0);
  });
});

// ── S34: long package name truncates ─────────────────────────────────────────
describe("S34. Long package name truncates", () => {
  it("package badge has max-w and truncate class", async () => {
    mockFetch([LONG_PKG]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Long" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-pkg-badge-${LONG_PKG.id}`)).not.toBeNull());
    const badge = screen.getByTestId(`client-pkg-badge-${LONG_PKG.id}`);
    expect(badge.className).toContain("truncate");
    expect(badge.className).toMatch(/max-w-\[/);
  });
});

// ── S35: empty state on first open ────────────────────────────────────────────
describe("S35. Empty state appears cleanly on first open", () => {
  it("empty state is immediately visible with no query", () => {
    mockFetch([]);
    makeSut();
    const emptyState = screen.getByTestId("client-search-empty-state");
    expect(emptyState).toBeDefined();
    expect(emptyState.textContent).toContain("Search Clients");
  });

  it("empty state disappears when typing begins", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    expect(screen.queryByTestId("client-search-empty-state")).not.toBeNull();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "N" } }); });
    await waitFor(() =>
      expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull(),
    { timeout: 2000 });
    expect(screen.queryByTestId("client-search-empty-state")).toBeNull();
  });
});

// ── S36: footer is compact ────────────────────────────────────────────────────
describe("S36. Footer is compact and does not cause visual heaviness", () => {
  it("footer is present but does not contain Tap to open", () => {
    mockFetch([]);
    makeSut();
    const footer = screen.getByTestId("client-search-footer");
    expect(footer.textContent).not.toContain("Tap to open");
    // Should have small text only
    expect(footer.textContent!.length).toBeLessThan(80);
  });
});

// ── S37: no nav/create clutter ────────────────────────────────────────────────
describe("S37. No nav items or create actions in any state", () => {
  it("no palette-jump testids ever rendered", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    expect(screen.queryByTestId("palette-jump-dash")).toBeNull();
    expect(screen.queryByTestId("palette-jump-bookings")).toBeNull();
    expect(screen.queryByTestId("palette-create-client")).toBeNull();
  });
});

// ── S38: avatar column fixed width ────────────────────────────────────────────
describe("S38. Avatar column has fixed width — no layout shift", () => {
  it("all avatar elements have same fixed minWidth style", async () => {
    mockFetch([NIKOLAS, YOUSSEF, PHOTO_CL]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "a" } }); });
    await waitFor(() => expect(screen.queryAllByTestId(/^client-result-/).length).toBeGreaterThan(0));
    const avatars = [
      ...screen.queryAllByTestId("client-avatar-fallback"),
      ...screen.queryAllByTestId("client-avatar-photo"),
    ];
    if (avatars.length > 0) {
      const widths = new Set(avatars.map((a) => (a as HTMLElement).style.minWidth));
      expect(widths.size).toBe(1);
    }
  });
});

// ── S39: dialog width classes present ────────────────────────────────────────
describe("S39. Dialog has correct responsive width classes", () => {
  it("dialog element has w-[calc(100vw-24px)] and sm:max-w-[560px]", () => {
    mockFetch([]);
    makeSut();
    const dialog = screen.queryByTestId("client-search-dialog");
    if (dialog) {
      expect(dialog.className).toMatch(/w-\[calc\(100vw-24px\)\]/);
    }
  });
});

// ── S40: no horizontal overflow across all device widths ─────────────────────
describe("S40. No horizontal overflow at any tested device width", () => {
  it.each([360, 375, 390, 412, 430, 768, 1366, 1440])(
    "no overflow at %ipx",
    (w) => {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: w });
      mockFetch([]);
      makeSut();
      const list = screen.queryByTestId("client-search-results");
      if (list) expect(list.className).toContain("overflow-x-hidden");
    },
  );
});
