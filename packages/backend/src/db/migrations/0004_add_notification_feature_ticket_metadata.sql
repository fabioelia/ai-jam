-- No-op: this migration was authored before 0005 existed, but its idx
-- runs before 0005 (which CREATEs the notifications table). The columns
-- and FKs originally added here (feature_id, ticket_id, metadata) are
-- now part of 0005's CREATE TABLE, so this migration intentionally does
-- nothing. Kept as a placeholder to preserve drizzle journal idx order.
SELECT 1;
