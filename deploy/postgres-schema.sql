-- The JDBC sink auto-creates github_events from the Avro schema (auto.create=true).
-- This documents the expected shape and adds an index for the dashboard's
-- time-window queries (created_at is BIGINT epoch-millis).
-- Run AFTER the sink has created the table.
CREATE INDEX IF NOT EXISTS github_events_created_at_idx ON github_events (created_at);
