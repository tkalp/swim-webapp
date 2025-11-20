-- Migration: Add SwimRankings meet data fields to workout_result table
-- Created: 2024-11-10
-- Description: Adds fields for storing SwimRankings competition results including meet name, location, and points
-- Note: Run add_race_splits_table.sql migration after this one to add split times support

-- Add new columns for SwimRankings meet data
ALTER TABLE workout_result
ADD COLUMN IF NOT EXISTS meet_name TEXT,
ADD COLUMN IF NOT EXISTS meet_city TEXT,
ADD COLUMN IF NOT EXISTS meet_nation TEXT,
ADD COLUMN IF NOT EXISTS meet_points INTEGER,
ADD COLUMN IF NOT EXISTS result_units TEXT CHECK (result_units IN ('LCM', 'SCM', 'SCY')),
ADD COLUMN IF NOT EXISTS performed_on DATE,
ADD COLUMN IF NOT EXISTS source TEXT CHECK (source IN ('manual', 'swimrankings', 'import')),
ADD COLUMN IF NOT EXISTS reaction_time DECIMAL(4, 2),
ADD COLUMN IF NOT EXISTS swimrankings_result_id TEXT;

-- Add comments to document the new fields
COMMENT ON COLUMN workout_result.meet_name IS 'Name of the swim meet or competition where this result was achieved';
COMMENT ON COLUMN workout_result.meet_city IS 'City where the meet took place';
COMMENT ON COLUMN workout_result.meet_nation IS 'Nation/country where the meet took place (e.g., USA, CAN, GBR)';
COMMENT ON COLUMN workout_result.meet_points IS 'FINA/World Aquatics points for this result';
COMMENT ON COLUMN workout_result.result_units IS 'Course type: LCM (50m pool), SCM (25m pool), or SCY (25yd pool)';
COMMENT ON COLUMN workout_result.performed_on IS 'Date when the result was achieved (for meet results from SwimRankings)';
COMMENT ON COLUMN workout_result.source IS 'Source of the result: manual (entered by coach), swimrankings (imported from SwimRankings.net), or import (bulk import)';
COMMENT ON COLUMN workout_result.reaction_time IS 'Reaction time off the blocks in seconds (positive for individual starts, can be negative for relay exchanges)';
COMMENT ON COLUMN workout_result.swimrankings_result_id IS 'SwimRankings result ID for linking back to source (e.g., 198608285)';

-- Set default source for existing records
UPDATE workout_result 
SET source = 'manual' 
WHERE source IS NULL;

-- Create index on source for filtering
CREATE INDEX IF NOT EXISTS idx_workout_result_source ON workout_result(source);

-- Create index on performed_on for date-based queries
CREATE INDEX IF NOT EXISTS idx_workout_result_performed_on ON workout_result(performed_on);

-- Create composite index for best times queries (commonly filtered together)
CREATE INDEX IF NOT EXISTS idx_workout_result_swimmer_stroke_distance 
ON workout_result(swimmer_id, stroke, distance, result_units) 
WHERE time_result IS NOT NULL;

-- Create index for meet-based queries
CREATE INDEX IF NOT EXISTS idx_workout_result_meet 
ON workout_result(meet_name, performed_on) 
WHERE meet_name IS NOT NULL;

-- Add constraint to ensure result_units is set for competition results
ALTER TABLE workout_result
ADD CONSTRAINT check_result_units_with_meet 
CHECK (
  (meet_name IS NULL) OR 
  (meet_name IS NOT NULL AND result_units IS NOT NULL)
);

-- Update RLS policies if needed (assuming they exist)
-- Note: Adjust based on your existing RLS setup

-- Create a view for best times that includes meet information
CREATE OR REPLACE VIEW swimmer_best_times AS
SELECT 
  wr.swimmer_id,
  wr.stroke,
  wr.activity,
  wr.distance,
  wr.result_units,
  MIN(wr.time_result) as best_time,
  COUNT(*) as result_count,
  -- Get meet info from the best time result
  (
    SELECT json_build_object(
      'meet_name', meet_name,
      'meet_city', meet_city,
      'meet_nation', meet_nation,
      'meet_points', meet_points,
      'performed_on', performed_on,
      'source', source
    )
    FROM workout_result wr2
    WHERE wr2.swimmer_id = wr.swimmer_id
      AND wr2.stroke = wr.stroke
      AND wr2.activity = wr.activity
      AND wr2.distance = wr.distance
      AND wr2.result_units = wr.result_units
      AND wr2.time_result = MIN(wr.time_result)
    LIMIT 1
  ) as best_result_info
FROM workout_result wr
WHERE wr.time_result IS NOT NULL
  AND wr.stroke IS NOT NULL
  AND wr.activity IS NOT NULL
  AND wr.distance IS NOT NULL
GROUP BY 
  wr.swimmer_id,
  wr.stroke,
  wr.activity,
  wr.distance,
  wr.result_units;

-- Grant permissions (adjust based on your roles)
-- GRANT SELECT ON swimmer_best_times TO authenticated;

COMMENT ON VIEW swimmer_best_times IS 'Aggregated view of swimmer best times with meet information for the best result';

-- Create index on swimrankings_result_id to prevent duplicate imports
CREATE INDEX IF NOT EXISTS idx_workout_result_swimrankings_id 
ON workout_result(swimrankings_result_id) 
WHERE swimrankings_result_id IS NOT NULL;

-- Add unique constraint to prevent duplicate SwimRankings imports
ALTER TABLE workout_result
ADD CONSTRAINT unique_swimrankings_result 
UNIQUE (swimrankings_result_id);

