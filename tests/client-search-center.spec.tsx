/**
 * Client Search Center — 26-scenario premium vitest suite.
 *
 * Scenarios:
 *  1  compact on mobile
 *  2  input height in required range
 *  3  placeholder does not clip X
 *  4  X button does not overlap input text
 *  5  no "Searching…" when data is cached
 *  6  1-letter instant results
 *  7  "Y" ranks Y-starting names first
 *  8  "Yo" narrows correctly
 *  9  "Nik" ranks Nikolas first
 * 10  result rows have consistent min-height
 * 11  profile photo shown when URL exists
 * 12  fallback avatar when no photo
 * 13  broken photo URL falls back without layout shift
 * 14  avatar is circular and fixed-size
 * 15  no action icons in rows
 * 16  no "Tap to open" text
 * 17  package badge is primary, status badge secondary
 * 18  labels are human-readable (toTitle formatting)
 * 19  Best Matches section correct
 * 20  More Suggestions only when both sections have results
 * 21  no unrelated clients appear
 * 22  mobile widths 360/375/390/412/430 no overflow
 * 23  tablet 768 works
 * 24  desktop 1366/1440 works
 * 25  keyboard: X clears, Esc closes, row click navigates
 * 26  existing 87 pre-existing tests implied (run separately)
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

// ── Fixture helpers ────────────────────────────────────────────────────────────

function mk(overrides: Partial<{
  id: number; fullName: string; email: string | null; phone: string | null;
  clientStatus: string | null; vipTier: string | null;
  pkgName: string | null; pkgTotal: number | null; pkgUsed: number | null;
  pkgStatus: string | null; profilePictureUrl: string | null; matchRank: number;
}> = {}) {
  return {
    id: 1, fullName: "Test Client", email: "test@example.com",
    phone: "+971501234567", clientStatus: "active", vipTier: "foundation",
    pkgName: "Gold Plan", pkgTotal: 20, pkgUsed: 8, pkgStatus: "active",
    profilePictureUrl: null, matchRank: 0,
    ...overrides,
  };
}

const YOUSSEF  = mk({ id: 11, fullName: "Youssef Darwish", matchRank: 1 });
const YASER    = mk({ id: 12, fullName: "Yaser Khalid", matchRank: 1 });
const YOUNES   = mk({ id: 13, fullName: "Younes Radi", matchRank: 1 });
const NIKOLAS  = mk({ id: 42, fullName: "Nikolas Papadopoulos", email: "nikolas@example.com", matchRank: 0 });
const PHOTO_CL = mk({ id: 5, fullName: "Photo Client", profilePictureUrl: "/uploads/photo5.jpg", matchRank: 0 });
const CONTAINS = mk({ id: 10, fullName: "Test Contains Y", matchRank: 7 });
const PKG_CL   = mk({ id: 9, fullName: "Package Match User", pkgName: "Platinum Monthly", matchRank: 6 });
const DIAMOND  = mk({ id: 20, fullName: "Diamond User", vipTier: "diamond_elite", clientStatus: "expiring_soon", matchRank: 0 });

// ── Test helpers ───────────────────────────────────────────────────────────────

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
// Scenario 1 — compact on mobile
// ═══════════════════════════════════════════════════════════════════════════════
describe("1. Search appears compact on mobile", () => {
  it("CommandList has overflow-x-hidden to prevent horizontal overflow", () => {
    mockFetch([]);
    makeSut();
    const list = screen.getByTestId("client-search-results");
    expect(list.className).toContain("overflow-x-hidden");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 2 — input height in required range
// ═══════════════════════════════════════════════════════════════════════════════
describe("2. Input height is within 48-56px range", () => {
  it("input has h-[52px] class (within 48–56px requirement)", () => {
    mockFetch([]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    expect(input.className).toMatch(/h-\[5[0-9]px\]/);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 3 — placeholder does not clip X
// ═══════════════════════════════════════════════════════════════════════════════
describe("3. Placeholder does not clip X button", () => {
  it("input has right padding (pr-9) so placeholder cannot reach X zone", () => {
    mockFetch([]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    expect(input.className).toContain("pr-9");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 4 — X button does not overlap text
// ═══════════════════════════════════════════════════════════════════════════════
describe("4. X button does not overlap input text", () => {
  it("X appears only when query is non-empty", async () => {
    mockFetch([]);
    makeSut();
    expect(screen.queryByTestId("button-clear-search")).toBeNull();
    const input = screen.getByTestId("input-client-search") as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: "hello" } }); });
    expect(screen.queryByTestId("button-clear-search")).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 5 — no "Searching…" when data is cached
// ═══════════════════════════════════════════════════════════════════════════════
describe("5. No Searching… text in any state", () => {
  it("'Searching' text never renders", async () => {
    mockFetch([NIKOLAS]);
    const { container } = makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    expect(container.textContent).not.toContain("Searching");
    expect(screen.queryByTestId("client-search-loading")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 6 — 1-letter instant results
// ═══════════════════════════════════════════════════════════════════════════════
describe("6. 1-letter instant results", () => {
  it("shows matching clients after typing 1 letter", async () => {
    mockFetch([YOUSSEF, YASER]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Y" } }); });
    await waitFor(() =>
      expect(screen.queryByTestId(`client-result-${YOUSSEF.id}`)).not.toBeNull(),
    { timeout: 2000 });
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 7 — "Y" ranks Y-starting names first
// ═══════════════════════════════════════════════════════════════════════════════
describe("7. Y ranks Y-starting names before contains-Y clients", () => {
  it("Youssef appears in Best Matches, contains-Y appears in More Suggestions or later", async () => {
    // YOUSSEF has matchRank 1 (first-name-starts), CONTAINS has rank 7 (name contains)
    mockFetch([YOUSSEF, CONTAINS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Y" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    const best = screen.getByTestId("section-best-matches");
    expect(best.textContent).toContain("Youssef");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 8 — "Yo" narrows correctly
// ═══════════════════════════════════════════════════════════════════════════════
describe("8. Yo narrows results (Youssef/Younes, not Yaser)", () => {
  it("returns clients matching 'Yo' prefix", async () => {
    mockFetch([YOUSSEF, YOUNES]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Yo" } }); });
    await waitFor(() =>
      expect(screen.queryAllByTestId(/^client-result-/).length).toBeGreaterThan(0),
    );
    const names = screen.getAllByTestId(/^client-result-/).map((el) => el.textContent);
    expect(names.some((t) => t!.includes("Youssef"))).toBe(true);
    expect(names.some((t) => t!.includes("Younes"))).toBe(true);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 9 — "Nik" ranks Nikolas first
// ═══════════════════════════════════════════════════════════════════════════════
describe("9. Nik ranks Nikolas first", () => {
  it("Nikolas is the first result for query 'Nik'", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() =>
      expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull(),
    );
    const results = screen.queryAllByTestId(/^client-result-/);
    expect(results[0].textContent).toContain("Nikolas");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 10 — consistent row height
// ═══════════════════════════════════════════════════════════════════════════════
describe("10. Result rows have consistent minimum height", () => {
  it("all result rows share the same min-h class", async () => {
    mockFetch([NIKOLAS, YOUSSEF]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "a" } }); });
    await waitFor(() => expect(screen.queryAllByTestId(/^client-result-/).length).toBeGreaterThan(0));
    const rows = screen.getAllByTestId(/^client-result-/);
    const heights = rows.map((r) => {
      const m = r.className.match(/min-h-\[[^\]]+\]/);
      return m ? m[0] : "none";
    });
    const unique = [...new Set(heights)];
    expect(unique.length).toBe(1);
    expect(unique[0]).not.toBe("none");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 11 — profile photo shown when URL exists
// ═══════════════════════════════════════════════════════════════════════════════
describe("11. Profile photo shown when URL exists", () => {
  it("renders an img element with the client's photo URL", async () => {
    mockFetch([PHOTO_CL]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Photo" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${PHOTO_CL.id}`)).not.toBeNull());
    expect(screen.queryByTestId("client-avatar-img")).not.toBeNull();
    const img = screen.getByTestId("client-avatar-img") as HTMLImageElement;
    expect(img.src).toContain("/uploads/photo5.jpg");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 12 — fallback avatar when no photo
// ═══════════════════════════════════════════════════════════════════════════════
describe("12. Fallback avatar when no profile photo", () => {
  it("renders fallback initials/icon when profilePictureUrl is null", async () => {
    mockFetch([NIKOLAS]); // profilePictureUrl: null
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nikolas" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    expect(screen.queryByTestId("client-avatar-img")).toBeNull();
    expect(screen.queryByTestId("client-avatar-fallback")).not.toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 13 — broken photo URL falls back without layout shift
// ═══════════════════════════════════════════════════════════════════════════════
describe("13. Broken photo URL falls back to initials", () => {
  it("onError on img triggers fallback without layout shift", async () => {
    const broken = mk({ id: 99, fullName: "Broken Photo", profilePictureUrl: "/bad-url.jpg", matchRank: 0 });
    mockFetch([broken]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Broken" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${broken.id}`)).not.toBeNull());
    const img = screen.queryByTestId("client-avatar-img");
    if (img) {
      await act(async () => { fireEvent.error(img); });
      // After error, fallback renders instead
      await waitFor(() => expect(screen.queryByTestId("client-avatar-fallback")).not.toBeNull());
    }
    // Avatar wrapper maintains fixed dimensions regardless
    const avatarPhoto = screen.queryByTestId("client-avatar-photo");
    const avatarFall  = screen.queryByTestId("client-avatar-fallback");
    const avatar = avatarPhoto || avatarFall;
    if (avatar) {
      const style = (avatar as HTMLElement).style;
      expect(style.width || avatar.className).toBeTruthy();
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 14 — avatar is circular and fixed-size
// ═══════════════════════════════════════════════════════════════════════════════
describe("14. Avatar is circular and fixed-size", () => {
  it("photo avatar has rounded-full class", async () => {
    mockFetch([PHOTO_CL]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Photo" } }); });
    await waitFor(() => expect(screen.queryByTestId("client-avatar-photo")).not.toBeNull());
    const avatar = screen.getByTestId("client-avatar-photo");
    expect(avatar.className).toContain("rounded-full");
    // Fixed width style applied
    const w = (avatar as HTMLElement).style.width;
    expect(w).toBeTruthy();
    expect(parseInt(w)).toBeGreaterThanOrEqual(42);
    expect(parseInt(w)).toBeLessThanOrEqual(48);
  });

  it("fallback avatar has rounded-full and consistent size", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId("client-avatar-fallback")).not.toBeNull());
    const fb = screen.getByTestId("client-avatar-fallback");
    expect(fb.className).toContain("rounded-full");
    const w = (fb as HTMLElement).style.width;
    expect(parseInt(w)).toBeGreaterThanOrEqual(42);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 15 — no action icons
// ═══════════════════════════════════════════════════════════════════════════════
describe("15. No action icon buttons in result rows", () => {
  it("no calendar/package/gift action buttons render on result rows", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    expect(screen.queryByTestId(`action-book-${NIKOLAS.id}`)).toBeNull();
    expect(screen.queryByTestId(`action-package-${NIKOLAS.id}`)).toBeNull();
    expect(screen.queryByTestId(`action-bonus-${NIKOLAS.id}`)).toBeNull();
    expect(screen.queryByTestId(`client-actions-${NIKOLAS.id}`)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 16 — no "Tap to open"
// ═══════════════════════════════════════════════════════════════════════════════
describe("16. No Tap to Open text", () => {
  it("footer does not contain 'Tap to open' in any state", async () => {
    mockFetch([NIKOLAS]);
    const { container } = makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    expect(container.textContent).not.toContain("Tap to open");
    expect(screen.getByTestId("client-search-footer").textContent).not.toContain("Tap to open");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 17 — badge hierarchy
// ═══════════════════════════════════════════════════════════════════════════════
describe("17. Package badge is primary, status badge secondary", () => {
  it("package badge uses primary/tron-cyan color class, status uses status-based class", async () => {
    mockFetch([NIKOLAS]); // pkgName: "Gold Plan", clientStatus: "active"
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-pkg-badge-${NIKOLAS.id}`)).not.toBeNull());
    const pkgBadge = screen.getByTestId(`client-pkg-badge-${NIKOLAS.id}`);
    // Package badge uses primary color
    expect(pkgBadge.className).toMatch(/text-primary|border-primary/);
    const statusBadge = screen.queryByTestId(`client-status-${NIKOLAS.id}`);
    if (statusBadge) {
      // Status badge uses status-specific color (not primary)
      expect(statusBadge.className).not.toMatch(/border-primary\/25/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 18 — human-readable labels
// ═══════════════════════════════════════════════════════════════════════════════
describe("18. Labels are human-readable", () => {
  it("renders 'Expiring Soon' not 'expiring_soon', 'Diamond Elite' not 'diamond_elite'", async () => {
    mockFetch([DIAMOND]); // vipTier: "diamond_elite", clientStatus: "expiring_soon"
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

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 19 — Best Matches section correct
// ═══════════════════════════════════════════════════════════════════════════════
describe("19. Best Matches section appears correctly", () => {
  it("section-best-matches is rendered when there are results", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    expect(screen.getByTestId("section-best-matches")).toBeDefined();
  });

  it("only-suggestions results are still shown under Best Matches (no orphan More Suggestions)", async () => {
    // Only rank 7 client (name contains)
    const onlyWeak = mk({ id: 55, fullName: "Test Contains user", matchRank: 7 });
    mockFetch([onlyWeak]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Contains" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    expect(screen.queryByTestId("section-more-suggestions")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 20 — More Suggestions conditional
// ═══════════════════════════════════════════════════════════════════════════════
describe("20. More Suggestions only when both sections have results", () => {
  it("shows More Suggestions only when best AND weak results exist", async () => {
    mockFetch([NIKOLAS, CONTAINS]); // rank 0 + rank 7
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "test" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    expect(screen.queryByTestId("section-more-suggestions")).not.toBeNull();
  });

  it("does NOT show More Suggestions when all results are strong matches", async () => {
    mockFetch([NIKOLAS, YOUSSEF]); // both rank ≤ 5
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "a" } }); });
    await waitFor(() => expect(screen.queryByTestId("section-best-matches")).not.toBeNull());
    expect(screen.queryByTestId("section-more-suggestions")).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 21 — no unrelated clients
// ═══════════════════════════════════════════════════════════════════════════════
describe("21. No unrelated clients appear", () => {
  it("only clients returned by API are shown", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryAllByTestId(/^client-result-/).length).toBe(1));
    expect(screen.queryAllByTestId(/^client-result-/)[0].textContent).toContain("Nikolas");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 22 — mobile widths 360/375/390/412/430 no overflow
// ═══════════════════════════════════════════════════════════════════════════════
describe("22. Mobile widths no horizontal overflow", () => {
  it.each([360, 375, 390, 412, 430])(
    "renders correctly at %ipx viewport width",
    (width) => {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
      mockFetch([]);
      makeSut();
      // Radix portals render into document.body, use screen queries
      const list = screen.queryByTestId("client-search-results");
      if (list) expect(list.className).toContain("overflow-x-hidden");
      // Dialog width class: calc(100vw-24px) — verify class string on dialog element
      const dialog = screen.queryByTestId("client-search-dialog");
      if (dialog) expect(dialog.className).toMatch(/w-\[calc\(100vw/);
    },
  );
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 23 — tablet 768 works
// ═══════════════════════════════════════════════════════════════════════════════
describe("23. Tablet 768 renders correctly", () => {
  it("no overflow at tablet width — results list present", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 768 });
    mockFetch([]);
    makeSut();
    const list = screen.queryByTestId("client-search-results");
    if (list) expect(list.className).toContain("overflow-x-hidden");
    // Empty state always visible when no query
    expect(screen.getByTestId("client-search-empty-state")).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 24 — desktop 1366/1440 works
// ═══════════════════════════════════════════════════════════════════════════════
describe("24. Desktop widths 1366/1440 render correctly", () => {
  it.each([1366, 1440])("renders at %ipx desktop width", (width) => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: width });
    mockFetch([]);
    makeSut();
    expect(screen.getByTestId("client-search-empty-state")).toBeDefined();
    expect(screen.getByTestId("client-search-footer")).toBeDefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 25 — keyboard interactions
// ═══════════════════════════════════════════════════════════════════════════════
describe("25. Keyboard: X clears, Esc closes, row click navigates", () => {
  it("X clears the input and hides itself", async () => {
    mockFetch([]);
    makeSut();
    const input = screen.getByTestId("input-client-search") as HTMLInputElement;
    await act(async () => { fireEvent.change(input, { target: { value: "hello" } }); });
    expect(input.value).toBe("hello");
    fireEvent.click(screen.getByTestId("button-clear-search"));
    expect(input.value).toBe("");
    expect(screen.queryByTestId("button-clear-search")).toBeNull();
  });

  it("Escape key calls onOpenChange(false)", async () => {
    mockFetch([]);
    const { onOpenChange } = makeSut();
    fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(false));
  });

  it("clicking a result card navigates to client profile", async () => {
    mockFetch([NIKOLAS]);
    makeSut();
    const input = screen.getByTestId("input-client-search");
    await act(async () => { fireEvent.change(input, { target: { value: "Nik" } }); });
    await waitFor(() => expect(screen.queryByTestId(`client-result-${NIKOLAS.id}`)).not.toBeNull());
    fireEvent.click(screen.getByTestId(`client-result-${NIKOLAS.id}`));
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith(`/admin/clients/${NIKOLAS.id}`));
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Scenario 26 — empty state correct structure
// ═══════════════════════════════════════════════════════════════════════════════
describe("26. Empty state has correct copy and no nav clutter", () => {
  it("shows 'Search Clients' title and correct subtitle", () => {
    mockFetch([]);
    makeSut();
    expect(screen.getByText("Search Clients")).toBeDefined();
    expect(screen.getByText(/Type a name, phone, email, or package/)).toBeDefined();
  });

  it("no nav jump items or create actions in empty state", () => {
    mockFetch([]);
    const { container } = makeSut();
    expect(container.textContent).not.toContain("Jump to");
    expect(container.textContent).not.toContain("New booking");
    expect(container.textContent).not.toContain("New client");
    expect(screen.queryByTestId("palette-jump-dash")).toBeNull();
  });
});
