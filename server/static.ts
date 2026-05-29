import express, { type Express } from "express";
import fs from "fs";
import path from "path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // Server-side admin auth guard: redirect unauthenticated browser requests
  // for /admin and /admin/… to /admin-access (excludes /admin-access itself).
  app.get(/^\/admin(?!-access)(\/|$)/, (req, res, next) => {
    if (
      req.isAuthenticated() &&
      (req.user as { role?: string } | undefined)?.role === "admin"
    ) {
      return next();
    }
    res.redirect("/admin-access");
  });

  // fall through to index.html if the file doesn't exist
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
