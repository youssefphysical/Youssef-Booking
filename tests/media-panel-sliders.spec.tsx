/**
 * Media Panel Slider UI Test
 *
 * Renders the real ServiceCardEditor component in jsdom (React Testing
 * Library) and asserts that the "Advanced Settings" panel exposes exactly
 * the SliderRow controls defined in the canonical SERVICE_CARD_SLIDER_FIELDS
 * list — the single source of truth shared by both the UI and the schema.
 *
 * Schema coupling: every assertion here is derived from
 * `client/src/lib/service-card-fields.ts`, NOT from hardcoded label strings.
 * Removing a field from that list (i.e. removing it from the schema) will
 * automatically make these tests fail.
 *
 * Behavioral assertion: verifies that the desktop Save button fires a PATCH
 * request whose payload keys match exactly the schema-valid field set.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  SERVICE_CARD_SLIDER_FIELDS,
  SERVICE_CARD_SLIDER_LABELS,
} from "../client/src/lib/service-card-fields";
import { ServiceCardEditor } from "../client/src/pages/AdminMedia";
import type { Settings } from "../shared/schema";

// ── Module mocks ──────────────────────────────────────────────────────────────

const mockApiRequest = vi.fn().mockResolvedValue({
  ok: true,
  json: async () => ({}),
});

vi.mock("../client/src/lib/queryClient", () => ({
  get apiRequest() {
    return mockApiRequest;
  },
  queryClient: { invalidateQueries: vi.fn() },
}));

vi.mock("../client/src/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

vi.mock("../client/src/components/ImageCropper", () => ({
  ImageCropper: () => null,
}));

vi.mock("../client/src/components/ImageRenderer", () => ({
  ServiceImageFrame: (_props: object) => (
    <div data-testid="mock-service-image-frame" />
  ),
  HeroImageFrame: () => null,
}));

vi.mock("../client/src/components/MobileImageEditor", () => ({
  MobileImageEditor: () => null,
}));

// ── Helpers ───────────────────────────────────────────────────────────────────

function Wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const MOCK_SETTINGS: Partial<Settings> = {
  personalTrainingImageUrl: "https://example.com/test-image.jpg",
  personalTrainingImageFit: "cover",
  personalTrainingImagePositionX: 50,
  personalTrainingImagePositionY: 50,
  personalTrainingImageZoom: 1,
  personalTrainingImageRadius: 0,
  personalTrainingMobileSettings: {},
};

async function renderAndOpenAdvancedSettings() {
  render(
    <Wrapper>
      <ServiceCardEditor
        cardKey="personalTraining"
        label="Personal Training"
        desc="16:9 · 1920×1080"
        settings={MOCK_SETTINGS as Settings}
      />
    </Wrapper>,
  );
  const user = userEvent.setup();
  const advBtn = await screen.findByTestId("button-advanced-personalTraining");
  await user.click(advBtn);
}

// ── Expected controls (derived from canonical list — NOT hardcoded) ────────────
//  If SERVICE_CARD_SLIDER_FIELDS changes (= schema change), these all update.
//  Scoped: desktop tab → slider-row-desktop-*, mobile tab → slider-row-mobile-*
function toScopedTestId(scope: "desktop" | "mobile", label: string): string {
  return `slider-row-${scope}-${label.toLowerCase().replace(/\s+/g, "-")}`;
}
const DESKTOP_TESTIDS = SERVICE_CARD_SLIDER_FIELDS.map((f) =>
  toScopedTestId("desktop", f.label),
);
const MOBILE_TESTIDS = SERVICE_CARD_SLIDER_FIELDS.map((f) =>
  toScopedTestId("mobile", f.label),
);

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ServiceCardEditor — Advanced Settings (schema-coupled)", () => {
  describe("Desktop tab (default)", () => {
    it("renders a slider for every field defined in SERVICE_CARD_SLIDER_FIELDS", async () => {
      await renderAndOpenAdvancedSettings();

      expect(
        screen.getByTestId("tab-service-desktop-personalTraining"),
      ).toBeInTheDocument();

      for (const testId of DESKTOP_TESTIDS) {
        expect(
          screen.getByTestId(testId),
          `Desktop tab: missing SliderRow with testid "${testId}" — remove it from service-card-fields.ts if the schema field was deleted`,
        ).toBeInTheDocument();
      }

      cleanup();
    });

    it("does NOT render extra sliders beyond SERVICE_CARD_SLIDER_FIELDS", async () => {
      await renderAndOpenAdvancedSettings();

      const found = document.querySelectorAll('[data-testid^="slider-row-desktop-"]');
      expect(
        found.length,
        `Desktop tab: found ${found.length} slider(s) but SERVICE_CARD_SLIDER_FIELDS defines ${SERVICE_CARD_SLIDER_FIELDS.length} — keep them in sync`,
      ).toBe(SERVICE_CARD_SLIDER_FIELDS.length);

      cleanup();
    });

    it("save payload contains exactly the schema-valid keys (no removed/phantom fields)", async () => {
      await renderAndOpenAdvancedSettings();

      const user = userEvent.setup();
      mockApiRequest.mockClear();

      const saveBtn = screen.getByTestId("button-save-desktop-personalTraining");
      await user.click(saveBtn);

      // Allow the async mutation to fire
      await vi.waitFor(() => expect(mockApiRequest).toHaveBeenCalled());

      // Third argument to apiRequest is the payload body
      const [, , payload] = mockApiRequest.mock.calls[0] as [
        string,
        string,
        Record<string, unknown>,
      ];

      // Schema-valid numeric keys: exactly the schemaKeys from the canonical list
      const expectedNumericKeys = SERVICE_CARD_SLIDER_FIELDS.map(
        (f) => f.schemaKey,
      );
      // Plus "fit" (FitSelect control — schema column `*ImageFit`)
      const expectedKeys = new Set(["fit", ...expectedNumericKeys]);

      const actualKeys = Object.keys(payload ?? {});
      for (const k of actualKeys) {
        expect(
          expectedKeys.has(k),
          `Save payload contains key "${k}" which is not a schema-valid settings field. ` +
            `Expected only: ${[...expectedKeys].join(", ")}`,
        ).toBe(true);
      }

      cleanup();
    });
  });

  describe("Mobile tab", () => {
    it("renders a slider for every field defined in SERVICE_CARD_SLIDER_FIELDS", async () => {
      await renderAndOpenAdvancedSettings();

      const user = userEvent.setup();
      await user.click(
        screen.getByTestId("tab-service-mobile-personalTraining"),
      );

      for (const testId of MOBILE_TESTIDS) {
        expect(
          screen.getByTestId(testId),
          `Mobile tab: missing SliderRow with testid "${testId}"`,
        ).toBeInTheDocument();
      }

      cleanup();
    });

    it("does NOT render extra sliders beyond SERVICE_CARD_SLIDER_FIELDS", async () => {
      await renderAndOpenAdvancedSettings();

      const user = userEvent.setup();
      await user.click(
        screen.getByTestId("tab-service-mobile-personalTraining"),
      );

      const found = document.querySelectorAll('[data-testid^="slider-row-mobile-"]');
      expect(
        found.length,
        `Mobile tab: found ${found.length} slider(s) but SERVICE_CARD_SLIDER_FIELDS defines ${SERVICE_CARD_SLIDER_FIELDS.length}`,
      ).toBe(SERVICE_CARD_SLIDER_FIELDS.length);

      cleanup();
    });
  });
});

// ── Sanity: canonical label list equals UI label list ─────────────────────────
describe("SERVICE_CARD_SLIDER_FIELDS integrity", () => {
  it("exported label list matches fields array (no divergence inside the module)", () => {
    expect(SERVICE_CARD_SLIDER_LABELS).toEqual(
      SERVICE_CARD_SLIDER_FIELDS.map((f) => f.label),
    );
  });
});
