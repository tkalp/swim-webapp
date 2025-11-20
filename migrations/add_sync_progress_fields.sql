-- Add progress tracking fields to swimmer_external_links table

ALTER TABLE swimmer_external_links
ADD COLUMN IF NOT EXISTS sync_progress INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS sync_total INTEGER DEFAULT 0;

-- Add comment to explain the columns
COMMENT ON COLUMN swimmer_external_links.sync_progress IS 'Number of events processed during current/last sync';
COMMENT ON COLUMN swimmer_external_links.sync_total IS 'Total number of events to process during current/last sync';
