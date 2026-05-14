// Local cron repro — exercises the same /api/cron/reminders code path as
// production by hitting the running dev server with the local CRON_SECRET.
//
//   npx tsx scripts/cron-test.ts
//
// Pre-flights env via the SAME validator the runner uses, so misconfigured
// envs surface here before the HTTP call. Exits non-zero on failure so it
// can be wired into a CI smoke check later if desired.

import { validateCronEnvironment } from "../server/cron/runner";

const APP_URL = process.env.APP_URL || process.env.PUBLIC_APP_URL || "http://localhost:5000";
const SECRET = process.env.CRON_SECRET;

async function main() {
  console.log(`[cron-test] target=${APP_URL}`);

  // Pre-flight env — same validator as the production runner.
  const v = validateCronEnvironment();
  if (!v.ok) {
    console.error(`[cron-test] env validation FAILED:`);
    for (const e of v.errors) console.error(`  - ${e.field}: ${e.reason}`);
    console.error(
      `\nFix the missing/invalid env vars (Replit: Tools → Secrets) and re-run.`,
    );
    process.exit(2);
  }
  console.log(`[cron-test] env OK`);

  if (!SECRET) {
    // Validator catches this above; defensive guard.
    console.error(`[cron-test] CRON_SECRET is required to make the HTTP call`);
    process.exit(2);
  }

  console.log(`[cron-test] POST ${APP_URL}/api/cron/reminders`);
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(`${APP_URL.replace(/\/$/, "")}/api/cron/reminders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${SECRET}` },
    });
  } catch (e: any) {
    console.error(`[cron-test] network error after ${Date.now() - t0}ms: ${e?.message || e}`);
    console.error(`[cron-test] is the dev server running? (npm run dev)`);
    process.exit(3);
  }
  const text = await res.text();
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  console.log(`[cron-test] HTTP ${res.status} in ${Date.now() - t0}ms`);
  console.log(JSON.stringify(body, null, 2));

  if (!res.ok) {
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`[cron-test] unexpected error:`, e);
  process.exit(99);
});
