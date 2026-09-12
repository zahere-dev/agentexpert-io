import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

// Pooled connection for app queries -- migrations use the unpooled URL
// directly via drizzle.config.ts instead.
const pool = new Pool({ connectionString: import.meta.env.DATABASE_URL });

export const db = drizzle(pool, { schema });
