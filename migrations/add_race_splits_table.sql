-- Migration: Add race_splits table for storing individual split times
-- Created: 2024-11-10
-- Description: Creates race_splits table to store lap/split times from SwimRankings meet results

-- Create race_splits table to store individual split times
CREATE TABLE IF NOT EXISTS race_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_result_id UUID NOT NULL REFERENCES workout_result(id) ON DELETE CASCADE,
  split_distance INTEGER NOT NULL, -- Distance at which split was taken (50, 100, 150, 200, etc.)
  split_time INTERVAL NOT NULL, -- Time for this individual split (e.g., 28.70 for second 50m)
  cumulative_time INTERVAL NOT NULL, -- Cumulative time at this split (e.g., 55.43 at 100m)
  reaction_time DECIMAL(4, 2), -- Reaction time off the blocks (only for first split, can be negative for relay exchanges)
  split_order INTEGER NOT NULL, -- Order of split in the race (1, 2, 3, 4...)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(workout_result_id, split_distance)
);

-- Add comments to race_splits table
COMMENT ON TABLE race_splits IS 'Individual split times for race results from SwimRankings';
COMMENT ON COLUMN race_splits.workout_result_id IS 'Reference to the workout_result this split belongs to';
COMMENT ON COLUMN race_splits.split_distance IS 'Distance in meters/yards at which this split was recorded';
COMMENT ON COLUMN race_splits.split_time IS 'Time for this individual segment (e.g., second 50m of a 200m race)';
COMMENT ON COLUMN race_splits.cumulative_time IS 'Total elapsed time from start to this split point';
COMMENT ON COLUMN race_splits.reaction_time IS 'Reaction time off blocks (positive) or relay exchange (can be negative)';
COMMENT ON COLUMN race_splits.split_order IS 'Sequential order of this split in the race (1=first split, 2=second, etc.)';

-- Create indexes for race_splits
CREATE INDEX IF NOT EXISTS idx_race_splits_workout_result 
ON race_splits(workout_result_id);

CREATE INDEX IF NOT EXISTS idx_race_splits_distance 
ON race_splits(split_distance);

-- Enable RLS on race_splits table
ALTER TABLE race_splits ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Coaches can view splits for their squad's swimmers
CREATE POLICY race_splits_select_policy ON race_splits
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM workout_result wr
    JOIN swimmers s ON wr.swimmer_id = s.id
    JOIN coach_squads cs ON s.squad_id = cs.squad_id
    WHERE wr.id = race_splits.workout_result_id
    AND cs.coach_id = auth.uid()
  )
);

-- RLS Policy: Coaches can insert splits for their squad's swimmers
CREATE POLICY race_splits_insert_policy ON race_splits
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM workout_result wr
    JOIN swimmers s ON wr.swimmer_id = s.id
    JOIN coach_squads cs ON s.squad_id = cs.squad_id
    WHERE wr.id = workout_result_id
    AND cs.coach_id = auth.uid()
  )
);

-- RLS Policy: Coaches can update splits for their squad's swimmers
CREATE POLICY race_splits_update_policy ON race_splits
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM workout_result wr
    JOIN swimmers s ON wr.swimmer_id = s.id
    JOIN coach_squads cs ON s.squad_id = cs.squad_id
    WHERE wr.id = race_splits.workout_result_id
    AND cs.coach_id = auth.uid()
  )
);

-- RLS Policy: Coaches can delete splits for their squad's swimmers
CREATE POLICY race_splits_delete_policy ON race_splits
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM workout_result wr
    JOIN swimmers s ON wr.swimmer_id = s.id
    JOIN coach_squads cs ON s.squad_id = cs.squad_id
    WHERE wr.id = race_splits.workout_result_id
    AND cs.coach_id = auth.uid()
  )
);
