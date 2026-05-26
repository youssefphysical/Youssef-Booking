---
name: TypeScript regex dotAll flag
description: The /s (dotAll) regex flag causes a TS error when tsconfig target is below es2018.
---

## Rule
The `/s` dotAll flag (`/pattern/s`) is only valid when `tsconfig.json` has `"target": "es2018"` or later.

**Why:** The project's tsconfig targets an earlier ES version, so the compiler rejects `/s` with error TS1501.

## How to apply
Replace `/s` patterns with `[\s\S]` to match any character including newlines, e.g.:

```ts
// ❌ fails below es2018
dataUrl.match(/^data:(.+);base64,(.+)$/s)

// ✓ safe at any target
dataUrl.match(/^data:(.+);base64,([\s\S]+)$/)
```
