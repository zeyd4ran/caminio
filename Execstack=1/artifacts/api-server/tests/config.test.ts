import { describe, expect, it } from "vitest";
import { assertProductionConfig } from "../src/lib/config";

describe("assertProductionConfig", () => {
  it("allows incomplete configuration outside production", () => {
    expect(() => assertProductionConfig({ NODE_ENV: "test" })).not.toThrow();
  });

  it("requires a database URL and Clerk configuration in production", () => {
    expect(() => assertProductionConfig({ NODE_ENV: "production" })).toThrow(
      "DATABASE_URL or SUPABASE_DATABASE_URL, CLERK_SECRET_KEY",
    );
    expect(() =>
      assertProductionConfig({
        NODE_ENV: "production",
        DATABASE_URL: "postgres://example",
      }),
    ).toThrow("CLERK_SECRET_KEY");
    expect(() =>
      assertProductionConfig({
        NODE_ENV: "production",
        CLERK_SECRET_KEY: "clerk-test-placeholder",
      }),
    ).toThrow("DATABASE_URL or SUPABASE_DATABASE_URL");
  });

  it("accepts either supported database URL with Clerk configuration", () => {
    for (const databaseVariable of ["DATABASE_URL", "SUPABASE_DATABASE_URL"] as const) {
      expect(() =>
        assertProductionConfig({
        NODE_ENV: "production",
        [databaseVariable]: "postgres://example",
        CLERK_SECRET_KEY: "clerk-test-placeholder",
        }),
      ).not.toThrow();
    }
  });

  it("rejects blank production values", () => {
    expect(() =>
      assertProductionConfig({
        NODE_ENV: "production",
        SUPABASE_DATABASE_URL: "  ",
        CLERK_SECRET_KEY: "\t",
      }),
    ).toThrow("DATABASE_URL or SUPABASE_DATABASE_URL, CLERK_SECRET_KEY");
  });
});
