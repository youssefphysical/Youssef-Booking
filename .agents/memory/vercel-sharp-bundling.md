---
name: Vercel sharp bundling
description: How to safely import sharp in serverless functions (Vercel) without crashing cold-start
---

## The rule
Never use a static `import sharp from "sharp"` in any file that gets bundled for Vercel.
Use a lazy `void import("sharp").then(…).catch(…)` pattern instead.

**Why:** Vercel's `@vercel/node` runtime uses `nft` (Node File Tracing) to detect dependencies
from the handler entry file (`api/index.ts`). Files listed in `includeFiles` (like `dist/server.mjs`)
are copied as-is — their imports are NOT traced. So if `dist/server.mjs` has a static
`import sharp from "sharp"` and `@img/sharp-linux-x64` is not in node_modules at the function root,
the entire module fails to load → every request returns "Server failed to start".

**How to apply:**
1. Replace `import sharp from "sharp"` with:
   ```ts
   import type SharpType from "sharp";
   let _sharp: typeof SharpType | null = null;
   void import("sharp")
     .then((m) => { _sharp = (m.default ?? m) as typeof SharpType; })
     .catch((e: unknown) => { console.warn("[boot] sharp unavailable:", (e as Error)?.message ?? e); });
   ```
2. At each call site: `if (!_sharp) throw new Error("sharp_unavailable");` then use `_sharp(…)`.
3. In `vercel.json` functions.includeFiles: add `node_modules/@img/**,node_modules/sharp/**`.
4. All sharp call sites should remain inside try/catch so `sharp_unavailable` surfaces as a 4xx.
