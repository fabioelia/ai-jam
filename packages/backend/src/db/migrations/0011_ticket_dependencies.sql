-- Add dependencies column to tickets table
-- Stores array of ticket IDs that this ticket depends on
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS dependencies UUID[] DEFAULT ARRAY[]::UUID[] NOT NULL;

-- Add index for faster dependency lookups
CREATE INDEX IF NOT EXISTS idx_tickets_dependencies ON tickets USING GIN(dependencies);
