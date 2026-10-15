import { defineConfig } from "drizzle-kit";

const url = process.env.DATABASE_URL ?? process.env.SUPABASE_DATABASE_URL;

if (!url) {
  throw new Error("SUPABASE_DATABASE_URL or DATABASE_URL must be set. Ensure the database is provisioned.");
}

export default defineConfig({
  schema: "./src/schema/tables.ts",
  dialect: "postgresql",
  dbCredentials: { url },
  verbose: true,
});
