import express, { type Express, type Request, type Response, type NextFunction } from "express";
import { createServer, type Server } from "http";
import { registerRoutes } from "./routes";
import { ensureSchema } from "./ensureSchema";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Build the Express application: body parsers, request logging, all API
 * routes, and a JSON error handler. Does NOT bind to a port — call
 * `setupListen()` separately for the long-running Replit dev/prod servers.
 *
 * The same factory is reused by the Vercel serverless wrapper at
 * `api/index.ts`, where the function is invoked once per cold start and
 * cached. Routes are attached exactly the same way in both environments.
 *
 * Pass `httpServer` if you want to wire it through to `registerRoutes` for
 * websocket bootstrapping (Replit only). When omitted, an internal http
 * server is created that's never bound — adequate for serverless platforms.
 */
export async function createApp(httpServer?: Server): Promise<Express> {
  // Self-heal additive schema before any route can call into the DB.
  // Idempotent — runs once per cold start, then never executes DDL again.
  // See server/ensureSchema.ts for the full rationale.
  await ensureSchema();

  const app = express();

  // Profile pictures are sent as base64 data URLs in JSON bodies. After sharp
  // resizes them down to ~10–25KB the request stays small, but the legacy
  // 100KB Express default still rejects unoptimized first uploads — bump to
  // 5MB so the server can compress them itself before persisting.
  app.use(
    express.json({
      limit: "5mb",
      verify: (req, _res, buf) => {
        req.rawBody = buf;
      },
    }),
  );

  app.use(express.urlencoded({ extended: false }));

  // Request logging — concise one-line per /api/* request, with response body
  // captured for easier debugging in the workflow console.
  app.use((req, res, next) => {
    const start = Date.now();
    const path = req.path;
    let capturedJsonResponse: Record<string, any> | undefined = undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (path.startsWith("/api")) {
        let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          // Avoid dumping huge base64 blobs (profile pictures) into the logs
          const safe = JSON.stringify(capturedJsonResponse);
          logLine += ` :: ${safe.length > 400 ? safe.slice(0, 400) + "…" : safe}`;
        }
        log(logLine);
      }
    });

    next();
  });

  // Bind the actual API surface. `registerRoutes` may be a no-op for httpServer
  // on serverless — only the dev Vite middleware really needs the http instance.
  const server = httpServer ?? createServer(app);
  await registerRoutes(server, app);

  // JSON error handler — keep it last so it sees errors thrown by routes/middleware.
  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    console.error("Internal Server Error:", err);

    if (res.headersSent) {
      return next(err);
    }

    return res.status(status).json({ message });
  });

  return app;
}
