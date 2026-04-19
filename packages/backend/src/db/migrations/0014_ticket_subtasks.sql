-- Add parentTicketId and subtasks columns to tickets table
ALTER TABLE "tickets" ADD COLUMN "parent_ticket_id" uuid REFERENCES "tickets"("id") ON DELETE SET NULL;
ALTER TABLE "tickets" ADD COLUMN "subtasks" jsonb DEFAULT '[]' NOT NULL;
