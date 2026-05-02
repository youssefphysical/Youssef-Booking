import type { IncomingMessage, ServerResponse } from "http";
import type { Express } from "express";

console.log("[api/index] STAGE 1 module-load", new Date().toISOString(), "node", process.version);

let appPromise: Promise<Express> | null = null;
let bootstrapError: unknown = null;

function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = (async () => {
      console.log("[api/index] STAGE 2 importing server/app");
      const mod = await import("../server/app");
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

  try {
    const app = await getApp();
    return (app as unknown as (req: IncomingMessage, res: ServerResponse) => void)(req, res);
  } catch (err) {
    console.error("[api] handler bootstrap failed:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(
        JSON.stringify({
          message: "Server failed to start",
          error: String((err as any)?.message || err),
          stack: String((err as any)?.stack || "").split("\n").slice(0, 8).join("\n"),
        }),
      );
    }
  }
}

export const config = { runtime: "nodejs20.x" };
