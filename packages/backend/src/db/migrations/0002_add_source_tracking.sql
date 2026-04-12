-- Add source tracking columns to distinguish human vs agent-originated actions.
-- Values: 'human' (default, UI), 'mcp' (agent MCP tools), 'api' (direct API call)

ALTER TABLE "tickets" ADD COLUMN "source" varchar(20) DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_proposals" ADD COLUMN "source" varchar(20) DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "comments" ADD COLUMN "source" varchar(20) DEFAULT 'human' NOT NULL;--> statement-breakpoint
ALTER TABLE "ticket_notes" ADD COLUMN "source" varchar(20) DEFAULT 'human' NOT NULL;
