/* eslint-disable no-console */
/**
 * VERCEL BUILD ORCHESTRATOR
 * =========================
 * Vercel's `buildCommand` field has a 256-char hard limit. We chain
 * the four required build steps here so vercel.json can stay short.
 *
 * Steps (must run in this exact order, fail-fast on the first three):
 *   1. esbuild → dist/server.mjs        (serverless function bundle)
 *   2. vite build                       (client SPA → dist/public)
 *   3. inject-hero.mjs                  (refresh dist/public/hero-initial.webp from Neon)
 *   4. generate-og-hero.mjs             (build dist/public/og-hero-current.jpg
 *                                        from same hero + stamp ?v=<hash> into HTML)
 *
 * Steps 3 and 4 are designed to always exit 0 — they never break the deploy.
 */

import { spawnSync } from "node:child_process";

function run(cmd, args, { allowFail = false } = {}) {
  console.log(`\n[vercel-build] $ ${cmd} ${args.join(" ")}`);
  const r = spawnSync(cmd, args, { stdio: "inherit", shell: false });
  if (r.status !== 0 && !allowFail) {
    console.error(`[vercel-build] step failed (exit ${r.status})`);
    process.exit(r.status || 1);
  }
}

run("npx", [
  "esbuild", "server/app.ts",
  "--bundle", "--format=esm", "--platform=node", "--target=node20",
  "--packages=external", "--alias:@shared=./shared",
  "--tsconfig=tsconfig.json", "--outfile=dist/server.mjs",
]);
run("npx", ["vite", "build"]);
run("node", ["scripts/inject-hero.mjs"], { allowFail: true });
run("node", ["scripts/generate-og-hero.mjs"], { allowFail: true });

console.log("\n[vercel-build] OK");
