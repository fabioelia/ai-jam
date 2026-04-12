CREATE TABLE "notification_preferences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"project_id" uuid NOT NULL,
	"notification_type" varchar(50) NOT NULL,
	"enabled" integer DEFAULT 1 NOT NULL,
	CONSTRAINT "notification_preferences_user_project_type" UNIQUE("user_id","project_id","notification_type")
);
--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "context_id" varchar(255);--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE cascade ON UPDATE no action;