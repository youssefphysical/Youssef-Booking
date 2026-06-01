import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Fail fast on cold-start so the api/index.ts retry handler has time to
  // try again within Vercel's 30 s function limit.  Neon serverless wakes
  // from compute-suspension in 2–5 s; 10 s gives it comfortable headroom
  // while leaving >15 s for the retry attempt.
  connectionTimeoutMillis: 10_000,
});
export const db = drizzle(pool, { schema });
