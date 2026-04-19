ALTER TABLE "tickets" ADD COLUMN "dependencies" uuid[] DEFAULT '{}' NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "claude_conversation_id" varchar(255);--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "claude_message_count" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "tickets" ADD COLUMN "claude_cost" integer DEFAULT 0 NOT NULL;