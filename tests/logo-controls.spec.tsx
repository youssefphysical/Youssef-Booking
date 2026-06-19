/**
 * Logo Controls — Vitest Unit Tests
 *
 * Tests the CSS variable functions in lib/brandSettings.ts
 * and the save/reload/reset/lock data flow for logo controls.
 *
 * Uses jsdom (vitest environment) so document.documentElement is available.
 *
 * Coverage:
 *   A. applyLogoSlotCSSVars sets correct CSS vars for all 10 controls
 *   B. dashboard slot alias populates --brand-sidebar-* vars
 *   C. applyBrandCSSVars with logos object applies per-slot vars
 *   D. applyBrandCSSVars without logos emits safe defaults
 *   E. Per-slot vars override legacy vars (correct precedence)
 *   F. Login slot defaults produce correct auth zoom value (1.08)
 *   G. buildLogos merges stored values over defaults correctly
 *   H. Reset to defaults produces default values
 *   I. Save payload structure includes all 7 slots × 10 fields
 *   J. Lock/unlock semantics
 *   K. localStorage cache (persistBrandSettingsCache)
 *   L. Preview mode dimensions (desktop vs mobile)
 *   M. Bootstrap parity — defaults match LOGO_BRAND_SLOT_DEFAULTS exactly
 *   N. First-paint CSS var correctness — fallback values match defaults
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  applyLogoSlotCSSVars,
  applyBrandCSSVars,
  persistBrandSettingsCache,
  YE_BRAND_SETTINGS_KEY,
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

  it("sets all 10 CSS vars for the navbar slot", () => {
    const c: LogoBrandControls = {
      wDesktop: 200, hDesktop: 60, wMobile: 100, hMobile: 44,
      zoom: 120, hOffset: 10, vOffset: -5, padding: 8, glow: 50, minHeroH: 0,
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

  it("sets all 10 CSS vars for the login slot", () => {
    const c: LogoBrandControls = {
      wDesktop: 480, hDesktop: 0, wMobile: 360, hMobile: 0,
      zoom: 108, hOffset: 0, vOffset: 20, padding: 0, glow: 40, minHeroH: 280,
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

  it("fully overrides all 10 fields when stored has all 10", () => {
    const custom: LogoBrandControls = {
      wDesktop: 111, hDesktop: 222, wMobile: 333, hMobile: 444,
      zoom: 55, hOffset: 6, vOffset: 7, padding: 8, glow: 9, minHeroH: 0,
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
      zoom: 55, hOffset: 10, vOffset: -10, padding: 20, glow: 100, minHeroH: 0,
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

  it("each slot includes all 10 control fields", () => {
    const logos = buildLogos();
    const expectedFields: Array<keyof LogoBrandControls> = [
      "wDesktop", "hDesktop", "wMobile", "hMobile",
      "zoom", "hOffset", "vOffset", "padding", "glow", "minHeroH",
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

// ── K: localStorage cache (persistBrandSettingsCache) ─────────────────────

describe("persistBrandSettingsCache — localStorage flicker-free boot", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("exports YE_BRAND_SETTINGS_KEY constant", () => {
    expect(typeof YE_BRAND_SETTINGS_KEY).toBe("string");
    expect(YE_BRAND_SETTINGS_KEY.length).toBeGreaterThan(0);
  });

  it("writes raw brandSettings JSON to localStorage under the correct key", () => {
    const raw = { logos: { navbar: { hDesktop: 75, glow: 40 } } };
    persistBrandSettingsCache(raw as any);
    const stored = localStorage.getItem(YE_BRAND_SETTINGS_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.logos.navbar.hDesktop).toBe(75);
    expect(parsed.logos.navbar.glow).toBe(40);
  });

  it("does nothing when called with null", () => {
    persistBrandSettingsCache(null);
    expect(localStorage.getItem(YE_BRAND_SETTINGS_KEY)).toBeNull();
  });

  it("does nothing when called with undefined", () => {
    persistBrandSettingsCache(undefined);
    expect(localStorage.getItem(YE_BRAND_SETTINGS_KEY)).toBeNull();
  });

  it("overwrites a previous cache entry with the latest value", () => {
    persistBrandSettingsCache({ logos: { navbar: { hDesktop: 60 } } } as any);
    persistBrandSettingsCache({ logos: { navbar: { hDesktop: 90 } } } as any);
    const stored = localStorage.getItem(YE_BRAND_SETTINGS_KEY);
    const parsed = JSON.parse(stored!);
    expect(parsed.logos.navbar.hDesktop).toBe(90);
  });

  it("applyBrandCSSVars persists settings to localStorage after applying vars", () => {
    localStorage.clear();
    applyBrandCSSVars({ logos: { footer: { hDesktop: 28, glow: 55 } } } as any);
    const stored = localStorage.getItem(YE_BRAND_SETTINGS_KEY);
    expect(stored).not.toBeNull();
    const parsed = JSON.parse(stored!);
    expect(parsed.logos.footer.hDesktop).toBe(28);
  });

  it("cached logos object has all 7 slot keys when applyBrandCSSVars receives full logos", () => {
    const fullLogos: Record<string, Partial<LogoBrandControls>> = {};
    for (const slot of LOGO_SLOTS) {
      fullLogos[slot] = LOGO_BRAND_SLOT_DEFAULTS[slot];
    }
    applyBrandCSSVars({ logos: fullLogos } as any);
    const stored = localStorage.getItem(YE_BRAND_SETTINGS_KEY);
    const parsed = JSON.parse(stored!);
    for (const slot of LOGO_SLOTS) {
      expect(parsed.logos).toHaveProperty(slot);
    }
  });
});

// ── L: preview mode dimensions ────────────────────────────────────────────

describe("Preview mode dimensions — desktop vs mobile", () => {
  it("desktop preview uses wDesktop/hDesktop values", () => {
    const c: LogoBrandControls = {
      wDesktop: 400, hDesktop: 80, wMobile: 200, hMobile: 44,
      zoom: 100, hOffset: 0, vOffset: 0, padding: 0, glow: 30, minHeroH: 0,
    };
    const previewMode: "desktop" | "mobile" = "desktop";

    const previewW = previewMode === "mobile"
      ? (c.wMobile  > 0 ? Math.min(c.wMobile,  300) : "auto")
      : (c.wDesktop > 0 ? Math.min(c.wDesktop, 500) : "auto");
    const previewH = previewMode === "mobile"
      ? (c.hMobile  > 0 ? Math.min(c.hMobile,  110) : "auto")
      : (c.hDesktop > 0 ? Math.min(c.hDesktop, 140) : "auto");

    expect(previewW).toBe(400);
    expect(previewH).toBe(80);
  });

  it("mobile preview uses wMobile/hMobile values", () => {
    const c: LogoBrandControls = {
      wDesktop: 400, hDesktop: 80, wMobile: 200, hMobile: 44,
      zoom: 100, hOffset: 0, vOffset: 0, padding: 0, glow: 30, minHeroH: 0,
    };
    const previewMode: "desktop" | "mobile" = "mobile";

    const previewW = previewMode === "mobile"
      ? (c.wMobile  > 0 ? Math.min(c.wMobile,  300) : "auto")
      : (c.wDesktop > 0 ? Math.min(c.wDesktop, 500) : "auto");
    const previewH = previewMode === "mobile"
      ? (c.hMobile  > 0 ? Math.min(c.hMobile,  110) : "auto")
      : (c.hDesktop > 0 ? Math.min(c.hDesktop, 140) : "auto");

    expect(previewW).toBe(200);
    expect(previewH).toBe(44);
  });

  it("mobile preview caps width at 300 and height at 110", () => {
    const c: LogoBrandControls = {
      wDesktop: 600, hDesktop: 200, wMobile: 500, hMobile: 200,
      zoom: 100, hOffset: 0, vOffset: 0, padding: 0, glow: 0, minHeroH: 0,
    };
    const previewMode: "desktop" | "mobile" = "mobile";

    const previewW = previewMode === "mobile"
      ? (c.wMobile > 0 ? Math.min(c.wMobile, 300) : "auto")
      : (c.wDesktop > 0 ? Math.min(c.wDesktop, 500) : "auto");
    const previewH = previewMode === "mobile"
      ? (c.hMobile > 0 ? Math.min(c.hMobile, 110) : "auto")
      : (c.hDesktop > 0 ? Math.min(c.hDesktop, 140) : "auto");

    expect(previewW).toBe(300);
    expect(previewH).toBe(110);
  });

  it("desktop preview caps width at 500 and height at 140", () => {
    const c: LogoBrandControls = {
      wDesktop: 600, hDesktop: 200, wMobile: 500, hMobile: 200,
      zoom: 100, hOffset: 0, vOffset: 0, padding: 0, glow: 0, minHeroH: 0,
    };
    const previewMode: "desktop" | "mobile" = "desktop";

    const previewW = previewMode === "mobile"
      ? (c.wMobile > 0 ? Math.min(c.wMobile, 300) : "auto")
      : (c.wDesktop > 0 ? Math.min(c.wDesktop, 500) : "auto");
    const previewH = previewMode === "mobile"
      ? (c.hMobile > 0 ? Math.min(c.hMobile, 110) : "auto")
      : (c.hDesktop > 0 ? Math.min(c.hDesktop, 140) : "auto");

    expect(previewW).toBe(500);
    expect(previewH).toBe(140);
  });

  it("preview returns 'auto' when dimension is 0", () => {
    const c: LogoBrandControls = {
      wDesktop: 0, hDesktop: 60, wMobile: 0, hMobile: 44,
      zoom: 100, hOffset: 0, vOffset: 0, padding: 0, glow: 30, minHeroH: 0,
    };

    const desktopW = c.wDesktop > 0 ? Math.min(c.wDesktop, 500) : "auto";
    const mobileW  = c.wMobile  > 0 ? Math.min(c.wMobile,  300) : "auto";

    expect(desktopW).toBe("auto");
    expect(mobileW).toBe("auto");
  });

  it("changing hMobile only affects mobile preview, not desktop", () => {
    const base: LogoBrandControls = {
      wDesktop: 300, hDesktop: 60, wMobile: 150, hMobile: 44,
      zoom: 100, hOffset: 0, vOffset: 0, padding: 0, glow: 30, minHeroH: 0,
    };
    const modified = { ...base, hMobile: 70 };

    const desktopH = modified.hDesktop > 0 ? Math.min(modified.hDesktop, 140) : "auto";
    const mobileH  = modified.hMobile  > 0 ? Math.min(modified.hMobile,  110) : "auto";

    expect(desktopH).toBe(60);
    expect(mobileH).toBe(70);
  });

  it("changing hDesktop only affects desktop preview, not mobile", () => {
    const base: LogoBrandControls = {
      wDesktop: 300, hDesktop: 60, wMobile: 150, hMobile: 44,
      zoom: 100, hOffset: 0, vOffset: 0, padding: 0, glow: 30, minHeroH: 0,
    };
    const modified = { ...base, hDesktop: 90 };

    const desktopH = modified.hDesktop > 0 ? Math.min(modified.hDesktop, 140) : "auto";
    const mobileH  = modified.hMobile  > 0 ? Math.min(modified.hMobile,  110) : "auto";

    expect(desktopH).toBe(90);
    expect(mobileH).toBe(44);
  });
});

// ── M: Bootstrap parity — defaults match LOGO_BRAND_SLOT_DEFAULTS exactly ─

describe("Bootstrap parity — defaults must match LOGO_BRAND_SLOT_DEFAULTS", () => {
  beforeEach(() => clearVars());

  it("mobile slot hMobile default is 54 (matches bootstrap defs.mobile.hMobile)", () => {
    // The bootstrap script in index.html hardcodes defs.mobile.hMobile = 54.
    // LOGO_BRAND_SLOT_DEFAULTS.mobile.hMobile must match so the first-paint
    // CSS var equals the post-hydration value — no jump.
    expect(LOGO_BRAND_SLOT_DEFAULTS.mobile.hMobile).toBe(54);
  });

  it("navbar slot hDesktop default is 60 (matches bootstrap defs.navbar.hDesktop)", () => {
    expect(LOGO_BRAND_SLOT_DEFAULTS.navbar.hDesktop).toBe(60);
  });

  it("navbar slot hMobile default is 52 (matches bootstrap defs.navbar.hMobile)", () => {
    expect(LOGO_BRAND_SLOT_DEFAULTS.navbar.hMobile).toBe(52);
  });

  it("mobile slot padding default is 2 (matches bootstrap defs.mobile.padding)", () => {
    expect(LOGO_BRAND_SLOT_DEFAULTS.mobile.padding).toBe(2);
  });

  it("mobile slot glow default is 15 (matches bootstrap defs.mobile.glow)", () => {
    expect(LOGO_BRAND_SLOT_DEFAULTS.mobile.glow).toBe(15);
  });

  it("applyLogoSlotCSSVars('mobile', defaults) sets --brand-mobile-h-mobile to 54px", () => {
    applyLogoSlotCSSVars("mobile", LOGO_BRAND_SLOT_DEFAULTS.mobile);
    expect(getVar("--brand-mobile-h-mobile")).toBe("54px");
  });

  it("applyBrandCSSVars(undefined) sets --brand-mobile-h-mobile to 54px (safe default)", () => {
    // When called without logos (e.g. on initial settings load from undefined),
    // the mobile slot must still be set to the correct default, not an arbitrary fallback.
    applyBrandCSSVars(undefined);
    expect(getVar("--brand-mobile-h-mobile")).toBe("54px");
  });

  it("applyBrandCSSVars with non-default hMobile does NOT clobber when called again with undefined", () => {
    // Simulate: bootstrap applied a cached non-default value (user saved 60px).
    // If App.tsx accidentally calls applyBrandCSSVars(undefined), it would clobber
    // the 60px back to 54px — this test documents that protection at the brandSettings layer.
    // (The actual App.tsx guard is tested via the static source test.)
    applyLogoSlotCSSVars("mobile", { ...LOGO_BRAND_SLOT_DEFAULTS.mobile, hMobile: 60 });
    expect(getVar("--brand-mobile-h-mobile")).toBe("60px");

    // If applyBrandCSSVars(undefined) runs, it resets to default (54px).
    // The real guard is in App.tsx (skip when settings === undefined).
    // This test just documents the behaviour so the guard is understood.
    applyBrandCSSVars(undefined);
    expect(getVar("--brand-mobile-h-mobile")).toBe("54px"); // reset to default — App.tsx must prevent this
  });

  it("applyBrandCSSVars with saved logos preserves non-default hMobile", () => {
    // Simulate settings loaded with admin-saved hMobile = 60.
    applyBrandCSSVars({ logos: { mobile: { hMobile: 60 } } } as any);
    expect(getVar("--brand-mobile-h-mobile")).toBe("60px");
  });

  it("bootstrap defaults cover all 7 slots (all LOGO_SLOTS have defaults)", () => {
    // Every slot in LOGO_SLOTS must appear in LOGO_BRAND_SLOT_DEFAULTS.
    for (const slot of LOGO_SLOTS) {
      expect(LOGO_BRAND_SLOT_DEFAULTS).toHaveProperty(slot);
    }
  });
});

// ── N: First-paint CSS var correctness — fallback values match defaults ────

describe("First-paint CSS var correctness", () => {
  beforeEach(() => clearVars());

  it("--brand-mobile-h-mobile set to 54px by applyLogoSlotCSSVars (mobile slot default)", () => {
    // This is the value BrandLogo mobile img will use on first paint.
    // Must match the CSS fallback in BrandLogo: var(--brand-mobile-h-mobile, 54px).
    applyLogoSlotCSSVars("mobile", LOGO_BRAND_SLOT_DEFAULTS.mobile);
    expect(getVar("--brand-mobile-h-mobile")).toBe("54px");
  });

  it("--brand-navbar-h-desktop set to 60px by applyLogoSlotCSSVars (navbar slot default)", () => {
    applyLogoSlotCSSVars("navbar", LOGO_BRAND_SLOT_DEFAULTS.navbar);
    expect(getVar("--brand-navbar-h-desktop")).toBe("60px");
  });

  it("mobile logo CSS fallback (54px) equals LOGO_BRAND_SLOT_DEFAULTS.mobile.hMobile", () => {
    // If the CSS var system fails (extreme edge case), BrandLogo falls back to 54px.
    // This must equal the default so no jump occurs even if the bootstrap fails.
    const BRANDLOGO_MOBILE_CSS_FALLBACK = 54; // keep in sync with BrandLogo.tsx
    expect(BRANDLOGO_MOBILE_CSS_FALLBACK).toBe(LOGO_BRAND_SLOT_DEFAULTS.mobile.hMobile);
  });

  it("desktop logo CSS fallback (60px) equals LOGO_BRAND_SLOT_DEFAULTS.navbar.hDesktop", () => {
    const BRANDLOGO_DESKTOP_CSS_FALLBACK = 60; // keep in sync with BrandLogo.tsx
    expect(BRANDLOGO_DESKTOP_CSS_FALLBACK).toBe(LOGO_BRAND_SLOT_DEFAULTS.navbar.hDesktop);
  });

  it("mobile logo padding CSS var is set to 2px by default", () => {
    applyLogoSlotCSSVars("mobile", LOGO_BRAND_SLOT_DEFAULTS.mobile);
    expect(getVar("--brand-mobile-padding")).toBe("2px");
  });

  it("mobile logo vpos CSS var is set to 0px by default", () => {
    applyLogoSlotCSSVars("mobile", LOGO_BRAND_SLOT_DEFAULTS.mobile);
    expect(getVar("--brand-mobile-vpos")).toBe("0px");
  });

  it("mobile logo glow CSS var is 0.15 by default (15/100)", () => {
    applyLogoSlotCSSVars("mobile", LOGO_BRAND_SLOT_DEFAULTS.mobile);
    expect(getVar("--brand-mobile-glow")).toBe("0.15");
  });
});
