ALTER TABLE "agent_sessions" ADD COLUMN "retry_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "agent_sessions" ADD COLUMN "max_retries" integer DEFAULT 2 NOT NULL;
