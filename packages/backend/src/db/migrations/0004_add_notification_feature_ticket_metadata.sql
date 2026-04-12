-- Add feature/ticket linking and metadata to notifications table.
-- featureId: scope notifications to a feature
-- ticketId: link notification to a specific ticket
-- metadata: extra context (rejection count, persona name, etc.)

ALTER TABLE "notifications" ADD COLUMN "feature_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "ticket_id" uuid;--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "metadata" jsonb;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_feature_id_features_id_fk" FOREIGN KEY ("feature_id") REFERENCES "public"."features"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_ticket_id_tickets_id_fk" FOREIGN KEY ("ticket_id") REFERENCES "public"."tickets"("id") ON DELETE set null ON UPDATE no action;
