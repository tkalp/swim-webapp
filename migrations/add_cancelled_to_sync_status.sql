-- Add 'cancelled' value to sync_status enum
-- This allows users to cancel in-progress sync operations

-- First, add the new enum value
ALTER TYPE sync_status ADD VALUE IF NOT EXISTS 'cancelled';

-- Drop the old check constraint if it exists
ALTER TABLE public.swimmer_external_links 
DROP CONSTRAINT IF EXISTS swimmer_external_links_sync_status_check;

-- Note: The enum type itself now allows 'cancelled', so no additional constraint is needed
-- PostgreSQL will automatically validate against the enum type
