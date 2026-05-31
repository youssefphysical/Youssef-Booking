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

// ── 5. AdminMedia.tsx: LogoControlsPanel saves to brandSettings.logos ─────
console.log("\n[5] AdminMedia.tsx — LogoControlsPanel save payload structure");

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

// ── 6. brandSettings.ts: applyBrandCSSVars handles logos object ───────────
console.log("\n[6] brandSettings.ts — applyBrandCSSVars handles per-slot logos object");

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

// ── Summary ───────────────────────────────────────────────────────────────
console.log("\n" + "─".repeat(60));
if (failed > 0) {
  console.error(`\n❌  ${failed} assertion(s) failed.\n`);
  process.exit(1);
} else {
  console.log(`\n✅  ${passed} assertion(s) passed.\n`);
}
