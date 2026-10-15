ALTER TABLE "conversations" ADD COLUMN "user_id" text;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "source" text DEFAULT 'agent_lab' NOT NULL;--> statement-breakpoint
ALTER TABLE "conversations" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
CREATE INDEX "conversations_user_updated_idx" ON "conversations" USING btree ("user_id","updated_at");