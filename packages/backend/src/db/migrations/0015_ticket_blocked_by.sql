-- Add blocked_by column to tickets for dependency tracking
ALTER TABLE "tickets" ADD COLUMN "blocked_by" uuid REFERENCES "tickets"("id") ON DELETE SET NULL;
