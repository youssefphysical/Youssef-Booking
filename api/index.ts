import type { IncomingMessage, ServerResponse } from "http";
import type { Express } from "express";
import { createApp } from "../server/app";

// Cache the configured Express app across invocations on the same warm
// instance. Vercel cold-starts spin up a fresh module, so this initialiser
// runs once per container — subsequent requests reuse the same app.
let appPromise: Promise<Express> | null = null;

function getApp(): Promise<Express> {
  if (!appPromise) {
    appPromise = createApp().catch((err) => {
      // Reset so the next request retries instead of caching a broken app.
      appPromise = null;
      throw err;
    });
  }
  return appPromise;
}

export default async function handler(
  req: IncomingMessage,
  res: ServerResponse,
) {
  try {
    const app = await getApp();
    return (app as unknown as (
      req: IncomingMessage,
      res: ServerResponse,
    ) => void)(req, res);
  } catch (err) {
    // Fail loudly — Vercel logs surface this in the function logs panel.
    // eslint-disable-next-line no-console
    console.error("[api] handler bootstrap failed:", err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader("Content-Type", "application/json");
      res.end(JSON.stringify({ message: "Server failed to start" }));
    }
  }
}

// Vercel's Node runtime needs the bodyParser disabled here so Express's
// own express.json() middleware sees the raw stream (it would otherwise
// double-buffer and break our 5MB profile-picture uploads).
export const config = {
  api: { bodyParser: false },
};
