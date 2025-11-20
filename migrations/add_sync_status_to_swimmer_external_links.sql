-- Migration: Add sync status tracking to swimmer_external_links
-- This enables tracking of background job progress when importing SwimRankings data

-- Add sync status enum type
DO $$ BEGIN
    CREATE TYPE sync_status AS ENUM ('pending', 'in_progress', 'completed', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Add new columns to swimmer_external_links
ALTER TABLE public.swimmer_external_links
ADD COLUMN IF NOT EXISTS sync_status sync_status DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS sync_error text,
ADD COLUMN IF NOT EXISTS results_count integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_sync_started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_sync_completed_at timestamp with time zone;

-- Add index on sync_status for efficient querying
CREATE INDEX IF NOT EXISTS idx_swimmer_external_links_sync_status 
ON public.swimmer_external_links(sync_status);

-- Add index on platform for efficient querying
CREATE INDEX IF NOT EXISTS idx_swimmer_external_links_platform 
ON public.swimmer_external_links(platform);

-- Add index for finding swimmers to sync
CREATE INDEX IF NOT EXISTS idx_swimmer_external_links_auto_import 
ON public.swimmer_external_links(auto_import_enabled, last_sync_at) 
WHERE auto_import_enabled = true;

-- Comment on new columns
COMMENT ON COLUMN public.swimmer_external_links.sync_status IS 'Current status of background data sync job';
COMMENT ON COLUMN public.swimmer_external_links.sync_error IS 'Error message if sync failed';
COMMENT ON COLUMN public.swimmer_external_links.results_count IS 'Number of results imported in last sync';
COMMENT ON COLUMN public.swimmer_external_links.last_sync_started_at IS 'When the most recent sync job started';
COMMENT ON COLUMN public.swimmer_external_links.last_sync_completed_at IS 'When the most recent sync job completed';
