import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Pooled connection for app queries -- migrations use the unpooled URL
// directly via drizzle.config.ts instead. Falls back to process.env so this
// also works from plain Node scripts (e.g. db/seed-questions.ts run via
// tsx), which don't have Astro/Vite's import.meta.env.
const connectionString = import.meta.env?.DATABASE_URL ?? process.env.DATABASE_URL;
const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });
