---
name: Vercel production deploy flow
description: How code reaches youssefelite.com production, and the gotchas that cause "deploy failed" / "changes not live"
---

# Production = Vercel, fed from GitHub (NOT Replit publish)

Production `youssefelite.com` / `www.youssefelite.com` is hosted on **Vercel**
(team `youssefs-projects`, project `youssef-booking`), auto-deployed from the
GitHub repo **`youssefphysical/Youssef-Booking`** branch `main`. Replit's own
publish/deploy is NOT what serves the live site.

## The #1 gotcha: Replit checkpoints are NOT auto-pushed to GitHub
A Replit checkpoint commit stays local (`origin/main` falls behind `HEAD`).
Nothing reaches production until someone runs a real push to the GitHub remote.
So "I finished the work / tests pass" ≠ "it's live." Always check
`git rev-list --left-right --count origin/main...HEAD` — if `HEAD` is ahead,
the latest work is NOT on production.

**To deploy:** `git push "https://x-access-token:${GITHUB_PAT}@github.com/youssefphysical/Youssef-Booking.git" HEAD:main`
(redact the token in any echoed output). The push triggers a Vercel build
automatically; poll the Vercel API for the new deployment's `readyState`.

## The #2 gotcha: Vercel build command ≠ `npm run build`
- `package.json` `build` = `tsx script/build.ts`  (singular `script/`)
- `vercel.json` `buildCommand` = `node scripts/vercel-build.mjs` (plural `scripts/`), output `dist/public`

**To truly reproduce a Vercel BUILD_FAILED locally, run the exact Vercel command:**
`node scripts/vercel-build.mjs`. A green `npm run build` is NOT proof the Vercel
build passes. `vercel-build.mjs` also runs Vercel-only post-build steps
(`inject-hero.mjs`, `generate-og-hero.mjs`, `inject-brand-logos.mjs`) that never
run in dev — so logo/hero behavior can differ between dev and prod.

## inject-brand-logos.mjs — Vercel-only DB rewrite
After `vite build`, it points `settings.logo_login_url` (auth/login hero) at the
CDN file `/brand/logo-login.png`, but only if the column is NULL/empty/`/uploads/…`.
It skips values already on `/brand/…` or `data:`. Invisible in dev. If the auth
logo looks wrong on prod but right in dev, suspect this script + the
`client/public/brand/logo-login.png` file.

## Verifying the live site
Apex `youssefelite.com` 307-redirects to `www` — `curl` needs `-L` or it returns
a 15-byte redirect body. Confirm assets by matching live `content-length` against
the committed file byte sizes; the alias list on the READY Vercel deployment
(`youssefelite.com` present) proves which commit is actually serving.
