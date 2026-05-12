/* Youssef Ahmed PWA — service worker.
 *
 * Goals (per user spec):
 *  - Cache STATIC assets only (JS, CSS, fonts, images) — never API data,
 *    never auth/session responses.
 *  - Provide a premium AMOLED offline fallback page when navigation fails.
 *  - Be invisible / safe: a buggy SW must never lock users out of the
 *    real app. Update flow uses skipWaiting + clients.claim so users get
 *    fixes on the next reload, not stuck behind a stale worker.
 *
 * Strategy summary:
 *   /api/*       → NETWORK ONLY (never touched by cache)
 *   navigations  → NETWORK FIRST, fallback to cached /offline.html
 *   same-origin
 *   static GET   → STALE-WHILE-REVALIDATE (fast paint, fresh next time)
 *   cross-origin → pass-through (let browser handle)
 *   non-GET      → pass-through
 *
 * Bumping CACHE_VERSION invalidates ALL caches → safe escape hatch.
 */

// Bumped 2026-05-11 (v17) to force-evict stale package-card / payment-badge
// chunks after the payment-tracking refinement (amount_paid + last_payment_date
// + premium status badges). The activate handler deletes any cache key not
// matching the current STATIC/RUNTIME names, so bumping this is the safest
// escape hatch for "old code stuck on user devices" reports.
const CACHE_VERSION = "v19-2026-05-12-session-preferences";
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const RUNTIME_CACHE = `runtime-${CACHE_VERSION}`;

// Files we explicitly want available offline. Keep this list small —
// the runtime cache picks up everything else as the user browses.
const PRECACHE_URLS = [
  "/offline.html",
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/favicon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Drop any old-version caches from previous deploys.
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((k) => k !== STATIC_CACHE && k !== RUNTIME_CACHE)
          .map((k) => caches.delete(k))
      );
      await self.clients.claim();
    })()
  );
});

// Allow the page to ask the SW to activate immediately (used by the
// in-page "new version available" flow if we ever add one).
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

/**
 * Decide whether a request must NEVER be touched by the cache.
 * We skip aggressively — when in doubt, pass through to the network.
 *
 * Skipped:
 *  - Anything not GET (POST/PATCH/DELETE/etc are always live).
 *  - Cross-origin requests (avoids opaque-response cache bloat + leaks).
 *  - Backend-served paths: /api/*, /uploads/* (per vercel.json
 *    /uploads/(.*) → /api/index, so this is dynamic backend output,
 *    not a static asset), /auth/*.
 *  - Personalized HTML routes: /admin*, /dashboard*, /profile*,
 *    /book* — defense-in-depth in case a future change adds
 *    server-rendered HTML on these paths.
 *  - Vite HMR + dev-only paths (the SW also only registers in
 *    production, but defensive).
 *  - Requests carrying an explicit Authorization header.
 */
function shouldBypass(request, url) {
  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  if (request.headers.has("authorization")) return true;
  const p = url.pathname;
  if (p.startsWith("/api/")) return true;
  if (p.startsWith("/uploads/")) return true;     // vercel rewrites → backend
  if (p.startsWith("/auth/")) return true;
  if (p.startsWith("/admin")) return true;        // personalized
  if (p.startsWith("/dashboard")) return true;    // personalized
  if (p.startsWith("/profile")) return true;      // personalized
  if (p.startsWith("/book")) return true;         // auth-gated
  if (p.startsWith("/__")) return true;           // dev/internal
  if (p.startsWith("/@")) return true;            // vite-internal
  if (p.startsWith("/src/")) return true;         // vite dev source
  if (p.startsWith("/node_modules/")) return true;
  if (p.startsWith("/ws") || p.startsWith("/socket")) return true;
  return false;
}

/**
 * Whether a successful response is safe to cache.
 *
 * Policy is destination-allowlist based — NOT header-sniffing — because
 * forbidden response headers (Set-Cookie, etc.) are NOT readable from
 * within a service worker, so any guard built on them is dead code.
 *
 * Only cache true static assets:
 *   request.destination ∈ {script, style, image, font, manifest, worker}
 *   plus a small extension allowlist for the few requests that arrive
 *   with destination="" (manifest fetches in some browsers, hero webp).
 *
 * Anything else (HTML documents, JSON, opaque/cors, error responses) is
 * passed through to the network unchanged with no cache write.
 */
const CACHEABLE_DESTINATIONS = new Set([
  "script",
  "style",
  "image",
  "font",
  "manifest",
  "worker",
]);
const CACHEABLE_EXTENSIONS = /\.(?:js|mjs|css|woff2?|ttf|otf|png|jpg|jpeg|webp|avif|gif|svg|ico|webmanifest)$/i;

function isCacheable(request, response) {
  if (!response || !response.ok) return false;
  if (response.type !== "basic") return false;     // skip opaque/cors
  if (response.status !== 200) return false;
  if (CACHEABLE_DESTINATIONS.has(request.destination)) return true;
  // Fallback for browsers that report destination="" — only allow if
  // the URL ends in a known static-asset extension.
  const path = new URL(request.url).pathname;
  return CACHEABLE_EXTENSIONS.test(path);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (shouldBypass(request, url)) {
    return; // let the browser handle it normally — no caching, no offline
  }

  // Navigations (HTML page loads) → network-first with offline fallback.
  // We deliberately don't cache the HTML response itself: index.html is
  // tiny and always wants the freshest <script> tags from the latest
  // build. Cached HTML is the single biggest cause of "white screen
  // after deploy" PWAs.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match("/offline.html");
        return (
          offline ||
          new Response("Offline", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          })
        );
      })
    );
    return;
  }

  // Static assets → stale-while-revalidate.
  // Serve cache instantly if present, refresh in the background.
  event.respondWith(
    (async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      const cached = await cache.match(request);
      const network = fetch(request)
        .then((response) => {
          if (isCacheable(request, response)) {
            // Clone before put — body can only be read once.
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        })
        .catch(() => null);
      return cached || (await network) || Response.error();
    })()
  );
});
