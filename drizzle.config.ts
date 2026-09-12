import { defineConfig } from "drizzle-kit";

// Migrations run against the direct (unpooled) connection, per Neon's
// guidance -- the pooled URL isn't meant for schema changes.
export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL_UNPOOLED!,
  },
});
