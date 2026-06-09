/**
 * Logo Controls — Static Source-Coupling Guard
 *
 * Verifies that every logo control field saved by LogoControlsPanel in
 * AdminMedia.tsx is correctly wired to the live component that renders it,
 * via the CSS variable naming contract in lib/brandSettings.ts.
 *
 * This is a pure Node.js source-analysis test (no browser, no React).
 * It reads the actual source files and asserts the correct CSS var names
 * are present in each live component.
 *
 * Run: npx tsx tests/logo-controls.test.ts
 *
 * Why static analysis?
 *   The CSS var contract is the source of truth between the admin panel
 *   and the live rendering. If anyone renames a var in brandSettings.ts
 *   without updating BrandLogo.tsx / AuthPage.tsx / PremiumPageLoader.tsx,
 *   these tests fail immediately — before any browser test runs.
 */

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import assert from "assert";
import {
  LOGO_BRAND_SLOT_DEFAULTS,
  LOGO_SLOTS,
} from "../client/src/lib/brandSettings.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

const BRAND_SETTINGS_PATH     = join(__dirname, "../client/src/lib/brandSettings.ts");
const BRAND_LOGO_PATH         = join(__dirname, "../client/src/components/BrandLogo.tsx");
const AUTH_PAGE_PATH          = join(__dirname, "../client/src/pages/AuthPage.tsx");
const PREMIUM_LOADER_PATH     = join(__dirname, "../client/src/components/PremiumPageLoader.tsx");
const ADMIN_MEDIA_PATH        = join(__dirname, "../client/src/pages/AdminMedia.tsx");

const brandSettingsSrc = readFileSync(BRAND_SETTINGS_PATH, "utf-8");
const brandLogoSrc     = readFileSync(BRAND_LOGO_PATH, "utf-8");
const authPageSrc      = readFileSync(AUTH_PAGE_PATH, "utf-8");
const premiumLoaderSrc = readFileSync(PREMIUM_LOADER_PATH, "utf-8");
const adminMediaSrc    = readFileSync(ADMIN_MEDIA_PATH, "utf-8");

let passed = 0;
let failed = 0;

function check(name: string, fn: () => void) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`  ✗  ${name}\n     ${msg}`);
    failed++;
  }
}

console.log("\nLogo Controls — static source-coupling guard");
console.log("─".repeat(60));

// ── 1. brandSettings.ts: per-slot CSS var names ───────────────────────────
console.log("\n[1] brandSettings.ts — applyLogoSlotCSSVars sets correct var names");

check("sets --brand-{slot}-h-desktop for every slot", () => {
  assert(
    brandSettingsSrc.includes("`${p}-h-desktop`"),
    'applyLogoSlotCSSVars must set `${p}-h-desktop` (where p = `--brand-${slot}`)',
  );
});

check("sets --brand-{slot}-glow for every slot", () => {
  assert(
    brandSettingsSrc.includes("`${p}-glow`"),
    'applyLogoSlotCSSVars must set `${p}-glow` per slot',
  );
});

check("sets --brand-{slot}-vpos for every slot", () => {
  assert(
    brandSettingsSrc.includes("`${p}-vpos`"),
    'applyLogoSlotCSSVars must set `${p}-vpos` per slot',
  );
});

check("sets --brand-{slot}-padding for every slot", () => {
  assert(
    brandSettingsSrc.includes("`${p}-padding`"),
    'applyLogoSlotCSSVars must set `${p}-padding` per slot',
  );
});

check("dashboard slot aliases to --brand-sidebar-h-desktop", () => {
  assert(
    brandSettingsSrc.includes("--brand-sidebar-h-desktop"),
    'applyLogoSlotCSSVars must set --brand-sidebar-h-desktop when slot === "dashboard" ' +
    '(BrandLogo variant="sidebar" reads this var)',
  );
});

check("dashboard slot aliases to --brand-sidebar-glow", () => {
  assert(
    brandSettingsSrc.includes("--brand-sidebar-glow"),
    'applyLogoSlotCSSVars must set --brand-sidebar-glow when slot === "dashboard"',
  );
});

check("login slot zoom default is 108 (matches AuthPage scale(1.08))", () => {
  const loginDefault = LOGO_BRAND_SLOT_DEFAULTS.login;
  assert(
    loginDefault.zoom === 108,
    `LOGO_BRAND_SLOT_DEFAULTS.login.zoom must be 108 to match AuthPage default scale(1.08). ` +
    `Got: ${loginDefault.zoom}`,
  );
});

check("all 7 slots are defined in LOGO_SLOTS", () => {
  const expected = ["navbar", "mobile", "login", "dashboard", "footer", "favicon", "splash"];
  for (const slot of expected) {
    assert(
      LOGO_SLOTS.includes(slot as any),
      `LOGO_SLOTS is missing slot "${slot}"`,
    );
  }
  assert(
    LOGO_SLOTS.length === expected.length,
    `LOGO_SLOTS has ${LOGO_SLOTS.length} entries, expected ${expected.length}`,
  );
});

// ── 2. BrandLogo.tsx: per-slot CSS vars consumed ─────────────────────────
console.log("\n[2] BrandLogo.tsx — reads per-slot CSS vars (not just legacy globals)");

check("desktop navbar reads --brand-navbar-glow (per-slot, not just --brand-logo-glow)", () => {
  assert(
    brandLogoSrc.includes("--brand-navbar-glow"),
    'BrandLogo.tsx desktop navbar must read --brand-navbar-glow. ' +
    'Using only --brand-logo-glow means per-slot glow controls have no effect.',
  );
});

check("desktop navbar reads --brand-navbar-vpos (per-slot)", () => {
  assert(
    brandLogoSrc.includes("--brand-navbar-vpos"),
    'BrandLogo.tsx desktop navbar must read --brand-navbar-vpos. ' +
    'Using only --brand-logo-voffset means per-slot vOffset controls have no effect.',
  );
});

check("desktop navbar reads --brand-navbar-padding (per-slot)", () => {
  assert(
    brandLogoSrc.includes("--brand-navbar-padding"),
    'BrandLogo.tsx desktop navbar must read --brand-navbar-padding. ' +
    'Reading only bs.logoDesktopPadding means per-slot padding controls have no effect.',
  );
});

check("mobile navbar reads --brand-mobile-h-mobile (mobile slot, not just navbar slot)", () => {
  assert(
    brandLogoSrc.includes("--brand-mobile-h-mobile"),
    'BrandLogo.tsx mobile navbar img must read --brand-mobile-h-mobile. ' +
    'Without this, the "mobile" logo slot height control has no effect.',
  );
});

check("mobile navbar reads --brand-mobile-glow (per-slot)", () => {
  assert(
    brandLogoSrc.includes("--brand-mobile-glow"),
    'BrandLogo.tsx mobile navbar img must read --brand-mobile-glow.',
  );
});

check("mobile navbar reads --brand-mobile-vpos (per-slot)", () => {
  assert(
    brandLogoSrc.includes("--brand-mobile-vpos"),
    'BrandLogo.tsx mobile navbar img must read --brand-mobile-vpos.',
  );
});

check("mobile navbar reads --brand-mobile-padding (per-slot)", () => {
  assert(
    brandLogoSrc.includes("--brand-mobile-padding"),
    'BrandLogo.tsx mobile navbar img must read --brand-mobile-padding.',
  );
});

check("sidebar/footer/icon use per-slot glow (--brand-${variant}-glow)", () => {
  assert(
    brandLogoSrc.includes("--brand-${variant}-glow"),
    'BrandLogo.tsx sidebar/footer/icon must use `--brand-${variant}-glow` ' +
    'so each placement has independent glow control.',
  );
});

check("BrandLogo does NOT hardcode logoDesktopPadding flat field read", () => {
  assert(
    !brandLogoSrc.includes("logoDesktopPadding"),
    'BrandLogo.tsx must not read bs.logoDesktopPadding — use --brand-navbar-padding CSS var instead.',
  );
});

check("BrandLogo does NOT hardcode logoMobilePadding flat field read", () => {
  assert(
    !brandLogoSrc.includes("logoMobilePadding"),
    'BrandLogo.tsx must not read bs.logoMobilePadding — use --brand-mobile-padding CSS var instead.',
  );
});

// ── 3. AuthPage.tsx: login slot CSS vars consumed ─────────────────────────
console.log("\n[3] AuthPage.tsx — applies login slot CSS vars");

check("mobile logo maxWidth reads --brand-login-w-mobile", () => {
  assert(
    authPageSrc.includes("--brand-login-w-mobile"),
    'AuthPage.tsx mobile logo wrapper must use maxWidth: "var(--brand-login-w-mobile, ...)" ' +
    'so the login slot wMobile control applies to the live auth logo.',
  );
});

check("desktop logo maxWidth reads --brand-login-w-desktop", () => {
  assert(
    authPageSrc.includes("--brand-login-w-desktop"),
    'AuthPage.tsx desktop logo wrapper must use maxWidth: "var(--brand-login-w-desktop, ...)" ' +
    'so the login slot wDesktop control applies to the live auth logo.',
  );
});

check("logo scale reads --brand-login-zoom", () => {
  assert(
    authPageSrc.includes("--brand-login-zoom"),
    'AuthPage.tsx logo wrapper must use scale(var(--brand-login-zoom, ...)) ' +
    'so the login slot zoom control applies to the live auth logo.',
  );
});

check("logo position reads --brand-login-vpos", () => {
  assert(
    authPageSrc.includes("--brand-login-vpos"),
    'AuthPage.tsx logo wrapper must use translateY(var(--brand-login-vpos, ...)) ' +
    'so the login slot vOffset control applies to the live auth logo.',
  );
});

check("AuthPage does NOT use hardcoded scale(1.08) without a CSS var wrapper", () => {
  const hardcoded = /transform:\s*["']scale\(1\.08\)["']/.test(authPageSrc);
  assert(
    !hardcoded,
    'AuthPage.tsx must not use a hardcoded scale(1.08) string — use scale(var(--brand-login-zoom, 1.08)) ' +
    'so the admin login zoom control takes effect.',
  );
});

// ── 4. PremiumPageLoader.tsx: splash slot CSS var consumed ────────────────
console.log("\n[4] PremiumPageLoader.tsx — reads splash slot CSS var");

check("splash logo reads --brand-splash-w-desktop", () => {
  assert(
    premiumLoaderSrc.includes("--brand-splash-w-desktop"),
    'PremiumPageLoader.tsx must read --brand-splash-w-desktop for the logo width.',
  );
});

// ── 5. AdminMedia.tsx: LogoControlsPanel UI structure ─────────────────────
console.log("\n[5] AdminMedia.tsx — LogoControlsPanel UI structure + save payload");

check("LogoControlsPanel has Desktop section labels (text-desktop-controls-{slot})", () => {
  assert(
    adminMediaSrc.includes("text-desktop-controls-"),
    'LogoControlsPanel must render a desktop controls section with data-testid="text-desktop-controls-{slot}" ' +
    'so desktop and mobile sliders are clearly separated.',
  );
});

check("LogoControlsPanel has Mobile section labels (text-mobile-controls-{slot})", () => {
  assert(
    adminMediaSrc.includes("text-mobile-controls-"),
    'LogoControlsPanel must render a mobile controls section with data-testid="text-mobile-controls-{slot}" ' +
    'so mobile sliders are visually distinct from desktop sliders.',
  );
});

check("LogoControlsPanel has Desktop preview mode button (button-preview-mode-desktop-{slot})", () => {
  assert(
    adminMediaSrc.includes("button-preview-mode-desktop-"),
    'LogoControlsPanel must have a Desktop preview toggle button with data-testid="button-preview-mode-desktop-{slot}".',
  );
});

check("LogoControlsPanel has Mobile preview mode button (button-preview-mode-mobile-{slot})", () => {
  assert(
    adminMediaSrc.includes("button-preview-mode-mobile-"),
    'LogoControlsPanel must have a Mobile preview toggle button with data-testid="button-preview-mode-mobile-{slot}".',
  );
});

check("LogoControlsPanel preview canvas has testid (preview-canvas-{slot})", () => {
  assert(
    adminMediaSrc.includes("preview-canvas-"),
    'LogoControlsPanel preview div must have data-testid="preview-canvas-{slot}" for test targeting.',
  );
});

check("LogoControlsPanel preview img has testid (preview-img-{slot})", () => {
  assert(
    adminMediaSrc.includes("preview-img-"),
    'LogoControlsPanel preview <img> must have data-testid="preview-img-{slot}" for test targeting.',
  );
});

check("Mobile preview uses wMobile/hMobile (not wDesktop/hDesktop)", () => {
  assert(
    adminMediaSrc.includes("c.wMobile") && adminMediaSrc.includes("c.hMobile"),
    'LogoControlsPanel preview must conditionally use c.wMobile / c.hMobile when previewMode === "mobile".',
  );
});

check("LogoControlsPanel resets previewMode to desktop when the open slot changes", () => {
  // A useEffect keyed on activeSlot must call setPreviewMode("desktop") so each
  // slot opens at its desktop dimensions instead of inheriting a stale Mobile view.
  const resetEffect = /useEffect\(\(\)\s*=>\s*\{\s*setPreviewMode\(["']desktop["']\);?\s*\},\s*\[activeSlot\]\)/;
  assert(
    resetEffect.test(adminMediaSrc),
    'LogoControlsPanel must reset previewMode to "desktop" in a useEffect keyed on [activeSlot].',
  );
});

console.log("\n[5b] AdminMedia.tsx — LogoControlsPanel save payload structure");

check("LogoControlsPanel saves to brandSettings.logos", () => {
  assert(
    adminMediaSrc.includes("logos"),
    'LogoControlsPanel.handleSave must include a `logos` key in the brandSettings payload.',
  );
});

check("LogoControlsPanel uses LOGO_SLOTS (not hardcoded slot list)", () => {
  assert(
    adminMediaSrc.includes("LOGO_SLOTS") || adminMediaSrc.includes("BRAND_LOGO_SLOTS"),
    'LogoControlsPanel must iterate LOGO_SLOTS to build the save payload — no hardcoded slot list.',
  );
});

check("AdminMedia imports applyLogoSlotCSSVars for live preview", () => {
  assert(
    adminMediaSrc.includes("applyLogoSlotCSSVars"),
    'AdminMedia.tsx must import and call applyLogoSlotCSSVars for live slider preview.',
  );
});

check("AdminMedia imports LOGO_BRAND_SLOT_DEFAULTS for reset", () => {
  assert(
    adminMediaSrc.includes("LOGO_BRAND_SLOT_DEFAULTS"),
    'AdminMedia.tsx must import LOGO_BRAND_SLOT_DEFAULTS to power the reset-to-defaults action.',
  );
});

check("AdminMedia has admin-shell wrapper (no mobile horizontal overflow)", () => {
  assert(
    adminMediaSrc.includes("admin-shell"),
    'AdminMedia.tsx must wrap its content in div.admin-shell to prevent mobile horizontal overflow.',
  );
});

check("AdminMedia has admin-container wrapper (provides padding-inline)", () => {
  assert(
    adminMediaSrc.includes("admin-container"),
    'AdminMedia.tsx must wrap its content in div.admin-container to provide padding-inline ' +
    'so the -mx-4 mobile pill row does not overflow the viewport.',
  );
});

// ── 6. brandSettings.ts: localStorage cache for flicker-free boot ─────────
console.log("\n[6] brandSettings.ts — localStorage cache (flicker-free boot)");

check("persistBrandSettingsCache function is exported from brandSettings.ts", () => {
  assert(
    brandSettingsSrc.includes("export function persistBrandSettingsCache"),
    'brandSettings.ts must export persistBrandSettingsCache() to allow App.tsx to ' +
    'persist brand settings to localStorage after each successful settings load.',
  );
});

check("YE_BRAND_SETTINGS_KEY constant is exported from brandSettings.ts", () => {
  assert(
    brandSettingsSrc.includes("export const YE_BRAND_SETTINGS_KEY"),
    'brandSettings.ts must export YE_BRAND_SETTINGS_KEY so tests and App.tsx use ' +
    'the same localStorage key without magic strings.',
  );
});

check("applyBrandCSSVars calls persistBrandSettingsCache at the end", () => {
  assert(
    brandSettingsSrc.includes("persistBrandSettingsCache(raw"),
    'applyBrandCSSVars must call persistBrandSettingsCache(raw) at the end so every ' +
    'successful settings load is cached for the next cold-start boot.',
  );
});

const indexHtmlPath = join(__dirname, "../client/index.html");
const indexHtmlSrc = readFileSync(indexHtmlPath, "utf-8");

check("index.html boot script reads ye_brand_settings from localStorage", () => {
  assert(
    indexHtmlSrc.includes("ye_brand_settings"),
    'client/index.html must contain a synchronous <script> that reads the ' +
    '"ye_brand_settings" localStorage key at boot to apply CSS vars before React mounts.',
  );
});

check("index.html boot script applies --brand-{slot}-h-desktop vars", () => {
  assert(
    indexHtmlSrc.includes("h-desktop"),
    'client/index.html boot script must set --brand-*-h-desktop CSS vars from the ' +
    'cached settings so logo heights paint correctly on the very first frame.',
  );
});

check("index.html boot script handles all 7 logo slots", () => {
  const slots = ["navbar", "mobile", "login", "dashboard", "footer", "favicon", "splash"];
  for (const slot of slots) {
    assert(
      indexHtmlSrc.includes(`'${slot}'`),
      `index.html boot script must include the "${slot}" slot in its processing loop.`,
    );
  }
});

// ── 7. brandSettings.ts: applyBrandCSSVars handles logos object ───────────
console.log("\n[7] brandSettings.ts — applyBrandCSSVars handles per-slot logos object");

check("applyBrandCSSVars reads (raw as any)?.logos", () => {
  assert(
    brandSettingsSrc.includes("logos"),
    'applyBrandCSSVars must read the logos object from brandSettings to apply per-slot CSS vars at boot.',
  );
});

check("applyBrandCSSVars emits defaults when logos is undefined", () => {
  assert(
    brandSettingsSrc.includes("LOGO_BRAND_SLOT_DEFAULTS"),
    'applyBrandCSSVars must emit default CSS vars (via LOGO_BRAND_SLOT_DEFAULTS) ' +
    'when no logos have been saved yet.',
  );
});

// ── 8. index.html bootstrap — no early exit, always applies defaults ───────
console.log("\n[8] index.html bootstrap — no early-exit on empty cache");

check("Bootstrap does NOT early-return when localStorage is empty (no 'if (!raw) return')", () => {
  // The old code was: if (!raw) return;
  // This caused BrandLogo to render at CSS fallback (52px) on first visit, then jump to 44px.
  // The fix always applies defaults regardless of cache presence.
  assert(
    !indexHtmlSrc.includes("if (!raw) return"),
    "index.html bootstrap must NOT early-return when localStorage is empty. " +
    "It must always apply defaults (+ cached values when available) so BrandLogo " +
    "never paints at the wrong CSS fallback value.",
  );
});

check("Bootstrap uses logos = null pattern (always runs the slot loop)", () => {
  assert(
    indexHtmlSrc.includes("logos = null"),
    "index.html bootstrap must initialise logos = null and then conditionally " +
    "populate it from the localStorage cache, so the slot loop always runs.",
  );
});

check("Bootstrap default mobile.hMobile is 44 (matches LOGO_BRAND_SLOT_DEFAULTS)", () => {
  assert(
    indexHtmlSrc.includes("hMobile:44"),
    "index.html bootstrap defs.mobile.hMobile must be 44 to match " +
    "LOGO_BRAND_SLOT_DEFAULTS.mobile.hMobile — the two values must be identical " +
    "so the CSS var is the same before and after React hydrates.",
  );
});

check("Bootstrap default navbar.hDesktop is 60 (matches LOGO_BRAND_SLOT_DEFAULTS)", () => {
  assert(
    indexHtmlSrc.includes("hDesktop:60"),
    "index.html bootstrap defs.navbar.hDesktop must be 60 to match " +
    "LOGO_BRAND_SLOT_DEFAULTS.navbar.hDesktop.",
  );
});

// ── 9. App.tsx — hydration guard (no undefined clobber) ────────────────────
console.log("\n[9] App.tsx — applyBrandCSSVars guarded against undefined settings");

const appTsxPath = join(__dirname, "../client/src/App.tsx");
const appTsxSrc  = readFileSync(appTsxPath, "utf-8");

check("App.tsx guards applyBrandCSSVars — skips when settings === undefined", () => {
  assert(
    appTsxSrc.includes("settings === undefined"),
    "App.tsx useEffect must guard with 'if (settings === undefined) return' so it " +
    "does not call applyBrandCSSVars before the /api/settings response arrives. " +
    "Without this guard, applyBrandCSSVars(undefined) resets all CSS vars to defaults, " +
    "clobbering any non-default values the bootstrap applied from the localStorage cache.",
  );
});

check("App.tsx applyBrandCSSVars useEffect depends on [settings] (not [settings?.brandSettings])", () => {
  // The dep must be [settings] so the effect fires exactly once — when settings loads.
  // A dep of [settings?.brandSettings] would fire on mount with undefined AND again
  // when settings loads, causing a double-apply race.
  assert(
    appTsxSrc.includes("}, [settings])"),
    "App.tsx applyBrandCSSVars useEffect dependency must be [settings] (not " +
    "[settings?.brandSettings]) so it fires exactly once when settings loads.",
  );
});

// ── 10. BrandLogo.tsx — mobile CSS fallback matches default ────────────────
console.log("\n[10] BrandLogo.tsx — mobile logo CSS fallback matches LOGO_BRAND_SLOT_DEFAULTS");
// brandLogoSrc is already declared at the top of this file (BRAND_LOGO_PATH)

check("BrandLogo mobile height CSS fallback is 44px (matches mobile slot default)", () => {
  assert(
    brandLogoSrc.includes("var(--brand-mobile-h-mobile, 44px)"),
    "BrandLogo mobile img height must be 'var(--brand-mobile-h-mobile, 44px)'. " +
    "The fallback 44px matches LOGO_BRAND_SLOT_DEFAULTS.mobile.hMobile so even " +
    "if the CSS var system fails, the logo renders at the correct default size.",
  );
});

check("BrandLogo mobile height does NOT use the old 52px CSS fallback", () => {
  assert(
    !brandLogoSrc.includes("var(--brand-navbar-h-mobile, 52px)"),
    "BrandLogo must NOT contain 'var(--brand-navbar-h-mobile, 52px)' as the " +
    "mobile logo fallback. 52px was the legacy navbarLogoMobile default — not " +
    "the mobile slot default (44px). Using 52px caused an 8px jump on first paint.",
  );
});

check("BrandLogo desktop height CSS fallback is 60px (matches navbar slot default)", () => {
  assert(
    brandLogoSrc.includes("var(--brand-navbar-h-desktop, 60px)"),
    "BrandLogo desktop img height must be 'var(--brand-navbar-h-desktop, 60px)'. " +
    "The fallback 60px matches LOGO_BRAND_SLOT_DEFAULTS.navbar.hDesktop.",
  );
});

// ── 11. BrandLogo.tsx — no visibility:hidden / always renders ─────────────
console.log("\n[11] BrandLogo.tsx — never hides logo, always renders an <img>");

check("BrandLogo does NOT use visibility:hidden (removed in flicker fix)", () => {
  assert(
    !brandLogoSrc.includes('visibility: "hidden"') &&
    !brandLogoSrc.includes("visibility:'hidden'") &&
    !brandLogoSrc.includes('visibility: "hidden"'),
    "BrandLogo must NOT set visibility:hidden on any branch. Using " +
    "visibility:hidden when settings is undefined causes the logo to disappear " +
    "whenever TanStack Query replaces initialData with the queryFn result (~1 s " +
    "after mount). Use a static fallback src instead.",
  );
});

check("BrandLogo uses STATIC_FALLBACK constant for /ye-logo.png", () => {
  assert(
    brandLogoSrc.includes('STATIC_FALLBACK') ||
    brandLogoSrc.includes('"/ye-logo.png"'),
    "BrandLogo must define a static fallback URL ('/ye-logo.png') that is " +
    "used when settings is undefined, so the logo is always visible.",
  );
});

check("BrandLogo mobile falls back to navbarSrc (not just iconSrc)", () => {
  assert(
    brandLogoSrc.includes("mobileSrc") &&
    brandLogoSrc.includes("navbarSrc") &&
    // The mobile fallback chain must include navbarSrc (mobile → navbar → icon → static)
    /logoMobileUrl\s*\|\|\s*navbarSrc/.test(brandLogoSrc),
    "BrandLogo mobileSrc must fall back to navbarSrc before iconSrc: " +
    "'settings?.logoMobileUrl || navbarSrc'. This ensures that when only a " +
    "navbar (horizontal) logo is uploaded, mobile shows the same logo instead " +
    "of the smaller icon-only fallback.",
  );
});

check("BrandLogo mobile img always renders (no {mobileSrc && <img>} gate)", () => {
  // The conditional render {mobileSrc && <img>} would hide the mobile logo
  // whenever mobileSrc is falsy. Since we now always compute a non-falsy src,
  // the conditional gate is no longer needed and must be absent.
  assert(
    !brandLogoSrc.includes("{mobileSrc && (") &&
    !brandLogoSrc.includes("{mobileSrc&&("),
    "BrandLogo must NOT conditionally render {mobileSrc && <img>}. " +
    "mobileSrc is always non-empty (static fallback guarantees it), so the " +
    "img must render unconditionally to prevent an empty navbar logo area.",
  );
});

check("BrandLogo navbar img always renders (no {navbarSrc && <img>} gate)", () => {
  assert(
    !brandLogoSrc.includes("{navbarSrc && (") &&
    !brandLogoSrc.includes("{navbarSrc&&("),
    "BrandLogo must NOT conditionally render {navbarSrc && <img>}. " +
    "navbarSrc is always non-empty (falls back to iconSrc → static).",
  );
});

check("BrandLogo sources use optional-chaining on settings (graceful when undefined)", () => {
  assert(
    brandLogoSrc.includes("settings?.logoIconUrl") &&
    brandLogoSrc.includes("settings?.logoNavbarUrl") &&
    brandLogoSrc.includes("settings?.logoMobileUrl"),
    "BrandLogo must access logo URLs via optional-chaining (settings?.logoX) " +
    "so the fallback chain activates when settings is undefined, rather than " +
    "throwing a TypeError that crashes the navbar.",
  );
});

// ── Summary ───────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(60));
if (failed > 0) {
  console.error(`\n❌  ${failed} assertion(s) failed.\n`);
  process.exit(1);
} else {
  console.log(`\n✅  ${passed} assertion(s) passed.\n`);
}
