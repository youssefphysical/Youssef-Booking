import type { IncomingMessage, ServerResponse } from "http";
import type { Express } from "express";

console.log("[api/index] STAGE 1 module-load", new Date().toISOString(), "node", process.version);

let appPromise: Promise<Express> | null = null;
let bootstrapError: unknown = null;

function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = (async () => {
      console.log("[api/index] STAGE 2 importing dist/server.mjs");
      // The server is pre-bundled at build time by esbuild — see vercel.json
      // buildCommand. This avoids @vercel/node failing to ship server/* and
      // shared/* alongside the function.
      // @ts-ignore — file is generated at build time, not in the TS project
      const mod = await import("../dist/server.mjs");
      console.log("[api/index] STAGE 3 createApp imported, invoking");
      const app = await mod.createApp();
      console.log("[api/index] STAGE 4 createApp returned");
      return app;
    })().catch((err) => {
      bootstrapError = err;
      appPromise = null;
      console.error("[api/index] BOOTSTRAP FAILED:", err && (err as any).stack ? (err as any).stack : err);
      throw err;
    });
  }
  return appPromise;
}

/** ms to wait before a single retry when the first bootstrap attempt fails.
 *  Neon serverless databases can take 2–5 s to wake from compute suspension;
 *  a short pause lets the DB come up before we give up and return a 503. */
const RETRY_DELAY_MS = 3_000;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  console.log("[api/index] HANDLER", (req as any).method, (req as any).url);

  if (req.url === "/api/_debug" || req.url === "/api/_debug/") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        ok: true,
        env: {
          NODE_VERSION: process.version,
          PLATFORM: process.platform,
          ARCH: process.arch,
          hasDB: !!process.env.DATABASE_URL,
          hasSession: !!process.env.SESSION_SECRET,
          hasOpenAI: !!process.env.OPENAI_API_KEY,
          hasOpenAIIntegration: !!process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        },
        bootstrapError: bootstrapError ? String((bootstrapError as any)?.message || bootstrapError) : null,
      }),
    );
    return;
  }

  // First attempt — resolves immediately when the app is already warm.
  try {
    const app = await getApp();
    return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
  } catch (firstErr) {
    console.warn(
      "[api/index] first bootstrap attempt failed, retrying in",
      RETRY_DELAY_MS,
      "ms —",
      (firstErr as any)?.message ?? firstErr,
    );
  }

  // One retry after a short delay.  Covers the common case where Neon was
  // in compute-suspension mode and needed a moment to accept connections.
  // The Vercel function maxDuration is 30 s, so we still have ~25 s left.
  await new Promise<void>((r) => setTimeout(r, RETRY_DELAY_MS));

  try {
    const app = await getApp();
    return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
  } catch (err) {
    console.error("[api/index] bootstrap failed after retry:", err);
    if (!res.headersSent) {
      res.statusCode = 503;
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Retry-After", "5");
      // Server-side log retains the full stack; the client only sees a generic
      // message so we don't leak internals (database column names, paths, etc.)
      // in production.
      res.end(
        JSON.stringify({
          error: "ServerUnavailable",
          message: "Server is starting up — please retry in a moment",
        }),
      );
    }
  }
}
