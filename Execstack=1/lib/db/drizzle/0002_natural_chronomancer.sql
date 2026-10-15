CREATE TABLE IF NOT EXISTS "agent_runs" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"goal" text NOT NULL,
	"status" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"current_agent" text,
	"logs" jsonb DEFAULT '[]'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "jarvis_sessions" (
	"session_id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"goal" text NOT NULL,
	"status" text NOT NULL,
	"steps" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"audit_log" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"failure_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "agent_artifacts" ADD COLUMN IF NOT EXISTS "user_id" text;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_artifacts_user_created_idx" ON "agent_artifacts" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "agent_runs_user_updated_idx" ON "agent_runs" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "jarvis_sessions_user_started_idx" ON "jarvis_sessions" USING btree ("user_id","started_at");--> statement-breakpoint
DO $migration$
BEGIN
  IF EXISTS (SELECT 1 FROM "conversations" WHERE "user_id" IS NULL) THEN
    RAISE EXCEPTION 'Cannot make conversations.user_id required: legacy conversations have no owner. Assign ownership before retrying this migration.';
  END IF;
  ALTER TABLE "conversations" ALTER COLUMN "user_id" SET NOT NULL;
END
$migration$;