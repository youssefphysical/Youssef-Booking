---
name: ensureSchema discipline
description: Any new column in shared/schema.ts must have a matching ADD COLUMN IF NOT EXISTS in server/ensureSchema.ts or the production Neon DB will crash on cold-start.
---

## Rule
Every column added to `shared/schema.ts` must also be added to `server/ensureSchema.ts` as:
```sql
ALTER TABLE IF EXISTS <table>
  ADD COLUMN IF NOT EXISTS <col> <type> DEFAULT <val>;
```
**Why:** Drizzle ORM generates explicit column lists in SELECT queries. If a column exists in the schema but not in the production DB, every query against that table fails with "column does not exist" → `createApp()` throws → `bootstrapError` is set → all requests return 500 "Server failed to start".

**How to apply:** After every `shared/schema.ts` edit, search `ensureSchema.ts` for the new column names. If any are missing, add `ALTER TABLE … ADD COLUMN IF NOT EXISTS` blocks before committing.

The tables most prone to this: `settings` (frequently extended with tuning columns), `users`, `bookings`.
