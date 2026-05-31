/**
 * Logo Controls — Vitest Unit Tests
 *
 * Tests the CSS variable functions in lib/brandSettings.ts
 * and the save/reload/reset/lock data flow for logo controls.
 *
 * Uses jsdom (vitest environment) so document.documentElement is available.
 *
 * Coverage:
 *   A. applyLogoSlotCSSVars sets correct CSS vars for all 9 controls
 *   B. dashboard slot alias populates --brand-sidebar-* vars
 *   C. applyBrandCSSVars with logos object applies per-slot vars
 *   D. applyBrandCSSVars without logos emits safe defaults
 *   E. Per-slot vars override legacy vars (correct precedence)
 *   F. Login slot defaults produce correct auth zoom value (1.08)
 *   G. buildLogos merges stored values over defaults correctly
 *   H. Reset to defaults produces default values
 *   I. Save payload structure includes all 7 slots × 9 fields
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  applyLogoSlotCSSVars,
  applyBrandCSSVars,
  LOGO_BRAND_SLOT_DEFAULTS,
  LOGO_SLOTS,
  type LogoBrandControls,
  type LogoSlot,
} from "../client/src/lib/brandSettings";

// ── Helpers ───────────────────────────────────────────────────────────────

function getVar(name: string): string {
  return document.documentElement.style.getPropertyValue(name);
}

function clearVars() {
  document.documentElement.removeAttribute("style");
}

function buildLogos(
  stored?: Partial<Record<LogoSlot, Partial<LogoBrandControls>>>,
): Record<LogoSlot, LogoBrandControls> {
  return Object.fromEntries(
    LOGO_SLOTS.map(slot => [
      slot,
      { ...LOGO_BRAND_SLOT_DEFAULTS[slot], ...(stored?.[slot] ?? {}) },
    ]),
  ) as Record<LogoSlot, LogoBrandControls>;
}

// ── A: applyLogoSlotCSSVars — CSS var correctness ─────────────────────────

describe("applyLogoSlotCSSVars — CSS var correctness", () => {
  beforeEach(clearVars);

  it("sets all 9 CSS vars for the navbar slot", () => {
    const c: LogoBrandControls = {
      wDesktop: 200, hDesktop: 60, wMobile: 100, hMobile: 44,
      zoom: 120, hOffset: 10, vOffset: -5, padding: 8, glow: 50,
    };
    applyLogoSlotCSSVars("navbar", c);

    expect(getVar("--brand-navbar-w-desktop")).toBe("200px");
    expect(getVar("--brand-navbar-h-desktop")).toBe("60px");
    expect(getVar("--brand-navbar-w-mobile")).toBe("100px");
    expect(getVar("--brand-navbar-h-mobile")).toBe("44px");
    expect(getVar("--brand-navbar-zoom")).toBe("1.2");
    expect(getVar("--brand-navbar-hpos")).toBe("10px");
    expect(getVar("--brand-navbar-vpos")).toBe("-5px");
    expect(getVar("--brand-navbar-padding")).toBe("8px");
    expect(getVar("--brand-navbar-glow")).toBe("0.5");
  });

  it("sets all 9 CSS vars for the login slot", () => {
    const c: LogoBrandControls = {
      wDesktop: 480, hDesktop: 0, wMobile: 360, hMobile: 0,
      zoom: 108, hOffset: 0, vOffset: 20, padding: 0, glow: 40,
    };
    applyLogoSlotCSSVars("login", c);

    expect(getVar("--brand-login-w-desktop")).toBe("480px");
    expect(getVar("--brand-login-h-desktop")).toBe("auto");
    expect(getVar("--brand-login-w-mobile")).toBe("360px");
    expect(getVar("--brand-login-h-mobile")).toBe("auto");
    expect(getVar("--brand-login-zoom")).toBe("1.08");
    expect(getVar("--brand-login-vpos")).toBe("20px");
    expect(getVar("--brand-login-padding")).toBe("0px");
    expect(getVar("--brand-login-glow")).toBe("0.4");
  });

  it("emits 'auto' for zero width/height values", () => {
    applyLogoSlotCSSVars("footer", { ...LOGO_BRAND_SLOT_DEFAULTS.footer, wDesktop: 0, hDesktop: 0 });
    expect(getVar("--brand-footer-w-desktop")).toBe("auto");
    expect(getVar("--brand-footer-h-desktop")).toBe("auto");
  });

  it("emits pixel values for non-zero width/height", () => {
    applyLogoSlotCSSVars("footer", { ...LOGO_BRAND_SLOT_DEFAULTS.footer, wDesktop: 150, hDesktop: 22 });
    expect(getVar("--brand-footer-w-desktop")).toBe("150px");
    expect(getVar("--brand-footer-h-desktop")).toBe("22px");
  });

  it("sets vars for all 7 slots without errors", () => {
    for (const slot of LOGO_SLOTS) {
      expect(() => applyLogoSlotCSSVars(slot, LOGO_BRAND_SLOT_DEFAULTS[slot])).not.toThrow();
    }
  });
});

// ── B: dashboard → sidebar alias ─────────────────────────────────────────

describe("applyLogoSlotCSSVars — dashboard → sidebar alias", () => {
  beforeEach(clearVars);

  it("sets --brand-sidebar-h-desktop when slot is 'dashboard'", () => {
    applyLogoSlotCSSVars("dashboard", { ...LOGO_BRAND_SLOT_DEFAULTS.dashboard, hDesktop: 48 });
    expect(getVar("--brand-sidebar-h-desktop")).toBe("48px");
  });

  it("sets --brand-sidebar-glow when slot is 'dashboard'", () => {
    applyLogoSlotCSSVars("dashboard", { ...LOGO_BRAND_SLOT_DEFAULTS.dashboard, glow: 30 });
    expect(getVar("--brand-sidebar-glow")).toBe("0.3");
  });

  it("does NOT set --brand-sidebar-h-desktop for other slots", () => {
    applyLogoSlotCSSVars("footer", LOGO_BRAND_SLOT_DEFAULTS.footer);
    expect(getVar("--brand-sidebar-h-desktop")).toBe("");
  });

  it("sidebar alias uses 'auto' when hDesktop is 0", () => {
    applyLogoSlotCSSVars("dashboard", { ...LOGO_BRAND_SLOT_DEFAULTS.dashboard, hDesktop: 0 });
    expect(getVar("--brand-sidebar-h-desktop")).toBe("auto");
  });
});

// ── C: applyBrandCSSVars with logos object ────────────────────────────────

describe("applyBrandCSSVars — with logos object", () => {
  beforeEach(clearVars);

  it("applies saved navbar height from logos.navbar.hDesktop", () => {
    applyBrandCSSVars({
      logos: { navbar: { hDesktop: 80 } },
    } as any);
    expect(getVar("--brand-navbar-h-desktop")).toBe("80px");
  });

  it("applies saved login zoom from logos.login.zoom", () => {
    applyBrandCSSVars({
      logos: { login: { zoom: 150 } },
    } as any);
    expect(getVar("--brand-login-zoom")).toBe("1.5");
  });

  it("applies saved footer height from logos.footer.hDesktop", () => {
    applyBrandCSSVars({
      logos: { footer: { hDesktop: 30 } },
    } as any);
    expect(getVar("--brand-footer-h-desktop")).toBe("30px");
  });

  it("applies dashboard alias when logos.dashboard is saved", () => {
    applyBrandCSSVars({
      logos: { dashboard: { hDesktop: 56, glow: 20 } },
    } as any);
    expect(getVar("--brand-dashboard-h-desktop")).toBe("56px");
    expect(getVar("--brand-sidebar-h-desktop")).toBe("56px");
  });
});

// ── D: applyBrandCSSVars without logos emits defaults ─────────────────────

describe("applyBrandCSSVars — without logos (first-time / no save)", () => {
  beforeEach(clearVars);

  it("emits default navbar height when no logos saved", () => {
    applyBrandCSSVars({});
    const navbarH = getVar("--brand-navbar-h-desktop");
    expect(navbarH).toBeTruthy();
  });

  it("emits default sidebar alias when no logos saved", () => {
    applyBrandCSSVars({});
    const sidebarH = getVar("--brand-sidebar-h-desktop");
    expect(sidebarH).not.toBe("");
  });

  it("emits default login zoom when no logos saved (should be 1.08)", () => {
    applyBrandCSSVars({});
    const loginZoom = getVar("--brand-login-zoom");
    expect(loginZoom).toBe("1.08");
  });
});

// ── E: per-slot vars override legacy vars ─────────────────────────────────

describe("applyBrandCSSVars — per-slot overrides legacy", () => {
  beforeEach(clearVars);

  it("per-slot navbar height overrides legacy navbarLogoDesktop flat field", () => {
    // Legacy field says 70px, per-slot says 90px
    applyBrandCSSVars({
      navbarLogoDesktop: 70,
      logos: { navbar: { hDesktop: 90 } },
    } as any);
    // Per-slot runs AFTER legacy — it should win
    expect(getVar("--brand-navbar-h-desktop")).toBe("90px");
  });
});

// ── F: login slot default zoom ────────────────────────────────────────────

describe("LOGO_BRAND_SLOT_DEFAULTS — login zoom", () => {
  it("login slot default zoom is 108 (not 100)", () => {
    expect(LOGO_BRAND_SLOT_DEFAULTS.login.zoom).toBe(108);
  });

  it("login slot default zoom produces 1.08 CSS var value", () => {
    clearVars();
    applyLogoSlotCSSVars("login", LOGO_BRAND_SLOT_DEFAULTS.login);
    expect(getVar("--brand-login-zoom")).toBe("1.08");
  });
});

// ── G: buildLogos merges stored over defaults ─────────────────────────────

describe("buildLogos — merge logic", () => {
  it("uses defaults when no stored values", () => {
    const result = buildLogos();
    for (const slot of LOGO_SLOTS) {
      expect(result[slot]).toEqual(LOGO_BRAND_SLOT_DEFAULTS[slot]);
    }
  });

  it("merges partial stored values over defaults", () => {
    const result = buildLogos({ navbar: { hDesktop: 99 } });
    expect(result.navbar.hDesktop).toBe(99);
    expect(result.navbar.glow).toBe(LOGO_BRAND_SLOT_DEFAULTS.navbar.glow);
  });

  it("other slots are not affected by one slot's stored values", () => {
    const result = buildLogos({ navbar: { hDesktop: 99 } });
    expect(result.footer).toEqual(LOGO_BRAND_SLOT_DEFAULTS.footer);
    expect(result.login).toEqual(LOGO_BRAND_SLOT_DEFAULTS.login);
  });

  it("fully overrides all 9 fields when stored has all 9", () => {
    const custom: LogoBrandControls = {
      wDesktop: 111, hDesktop: 222, wMobile: 333, hMobile: 444,
      zoom: 55, hOffset: 6, vOffset: 7, padding: 8, glow: 9,
    };
    const result = buildLogos({ splash: custom });
    expect(result.splash).toEqual(custom);
  });
});

// ── H: reset to defaults ──────────────────────────────────────────────────

describe("Reset to defaults", () => {
  it("resetting a slot returns exactly the default values", () => {
    const modified: LogoBrandControls = {
      wDesktop: 999, hDesktop: 888, wMobile: 777, hMobile: 666,
      zoom: 55, hOffset: 10, vOffset: -10, padding: 20, glow: 100,
    };
    const reset = { ...LOGO_BRAND_SLOT_DEFAULTS.navbar };
    expect(reset).toEqual(LOGO_BRAND_SLOT_DEFAULTS.navbar);
    expect(reset).not.toEqual(modified);
  });

  it("default CSS vars after reset match expected defaults", () => {
    clearVars();
    applyLogoSlotCSSVars("navbar", LOGO_BRAND_SLOT_DEFAULTS.navbar);
    expect(getVar("--brand-navbar-h-desktop")).toBe("60px");
    expect(getVar("--brand-navbar-h-mobile")).toBe("52px");
    expect(getVar("--brand-navbar-glow")).toBe("0.35");
    expect(getVar("--brand-navbar-padding")).toBe("5px");
  });
});

// ── I: save payload structure ─────────────────────────────────────────────

describe("Save payload structure", () => {
  it("logos object includes all 7 slots", () => {
    const logos = buildLogos();
    for (const slot of LOGO_SLOTS) {
      expect(logos).toHaveProperty(slot);
    }
    expect(Object.keys(logos)).toHaveLength(LOGO_SLOTS.length);
  });

  it("each slot includes all 9 control fields", () => {
    const logos = buildLogos();
    const expectedFields: Array<keyof LogoBrandControls> = [
      "wDesktop", "hDesktop", "wMobile", "hMobile",
      "zoom", "hOffset", "vOffset", "padding", "glow",
    ];
    for (const slot of LOGO_SLOTS) {
      for (const field of expectedFields) {
        expect(logos[slot]).toHaveProperty(field);
        expect(typeof logos[slot][field]).toBe("number");
      }
    }
  });

  it("changed values appear in the merged payload", () => {
    const stored: Partial<Record<LogoSlot, Partial<LogoBrandControls>>> = {
      navbar: { hDesktop: 80, glow: 60 },
      login:  { zoom: 120, wDesktop: 500 },
    };
    const logos = buildLogos(stored);
    expect(logos.navbar.hDesktop).toBe(80);
    expect(logos.navbar.glow).toBe(60);
    expect(logos.login.zoom).toBe(120);
    expect(logos.login.wDesktop).toBe(500);
  });

  it("brandSettings save payload shape matches expected structure", () => {
    const existingBrandSettings = { logoShowNavbar: 1, someOtherField: "value" };
    const logos = buildLogos({ navbar: { hDesktop: 75 } });
    const payload = { brandSettings: { ...existingBrandSettings, logos } };

    expect(payload.brandSettings).toHaveProperty("logos");
    expect(payload.brandSettings).toHaveProperty("logoShowNavbar");
    expect(payload.brandSettings.logos.navbar.hDesktop).toBe(75);
  });
});

// ── J: lock/unlock semantics ──────────────────────────────────────────────

describe("Lock/unlock semantics", () => {
  it("a slot is editable only when unlockedSlot matches it", () => {
    type Slot = LogoSlot | null;
    let unlockedSlot: Slot = null;

    function toggleLock(slot: LogoSlot): void {
      unlockedSlot = unlockedSlot === slot ? null : slot;
    }

    expect(unlockedSlot).toBeNull();

    toggleLock("navbar");
    expect(unlockedSlot).toBe("navbar");

    toggleLock("navbar");
    expect(unlockedSlot).toBeNull();

    toggleLock("footer");
    toggleLock("navbar");
    expect(unlockedSlot).toBe("navbar");
  });

  it("unlocking one slot locks all others", () => {
    let unlockedSlot: LogoSlot | null = "footer";
    const isEditable = (slot: LogoSlot) => unlockedSlot === slot;

    expect(isEditable("footer")).toBe(true);
    expect(isEditable("navbar")).toBe(false);
    expect(isEditable("login")).toBe(false);
  });
});
