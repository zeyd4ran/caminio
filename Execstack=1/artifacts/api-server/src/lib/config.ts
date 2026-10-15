type ServerEnvironment = {
  NODE_ENV?: string;
  DATABASE_URL?: string;
  SUPABASE_DATABASE_URL?: string;
  CLERK_SECRET_KEY?: string;
};

export function assertProductionConfig(env: ServerEnvironment): void {
  if (env.NODE_ENV !== "production") {
    return;
  }

  const missing: string[] = [];
  if (!env.DATABASE_URL?.trim() && !env.SUPABASE_DATABASE_URL?.trim()) {
    missing.push("DATABASE_URL or SUPABASE_DATABASE_URL");
  }
  if (!env.CLERK_SECRET_KEY?.trim()) {
    missing.push("CLERK_SECRET_KEY");
  }

  if (missing.length > 0) {
    throw new Error(
      `Production startup requires the following environment variables: ${missing.join(", ")}`,
    );
  }
}
