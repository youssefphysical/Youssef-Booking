import { createServer } from "http";
import { createApp, log } from "./app";

// Replit dev/prod entry point. On Vercel the request lifecycle is owned by
// `api/index.ts` instead — this file is never imported there.
(async () => {
  const httpServer = createServer();
  const app = await createApp(httpServer);
  httpServer.on("request", app);

  if (process.env.NODE_ENV === "production") {
    const { serveStatic } = await import("./static");
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || "5000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
      reusePort: true,
    },
    () => {
      log(`serving on port ${port}`);
    },
  );
})();

// Re-export so older modules importing `log` from `./index` still work.
export { log };
