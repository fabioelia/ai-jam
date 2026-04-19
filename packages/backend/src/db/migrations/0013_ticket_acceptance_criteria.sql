-- Add acceptance_criteria column to tickets table
ALTER TABLE "tickets" ADD COLUMN "acceptance_criteria" jsonb DEFAULT '[]' NOT NULL;
