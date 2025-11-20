// services/workoutTemplateService.ts
import { supabase } from '@/lib/supabase';

/**
 * Workout template type matching the database schema
 */
export type WorkoutTemplate = {
  id: string;
  name: string;
  description: string;
  total_meters: number;
  estimated_time_minutes: number;
  estimated_calories: number;
  effort_level: number;
  raw_description: string;
  json_description: any;
  created_at: string;
  create_by_coach: string;
};

/**
 * Input type for creating a workout
 */
export type CreateWorkoutInput = {
  name: string;
  description: string;
  raw_description?: string;
  total_meters: number;
  estimated_time_minutes: number;
  estimated_calories: number;
  effort_level: number;
  create_by_coach: string;
  json_description?: any;
};

/**
 * Input type for updating a workout
 */
export type UpdateWorkoutInput = Partial<{
  name: string;
  description: string;
  raw_description: string;
  total_meters: number;
  estimated_time_minutes: number;
  estimated_calories: number;
  effort_level: number;
  json_description: any;
}>;

/**
 * Get a single workout template by ID
 */
export async function getWorkoutTemplate(workoutId: string): Promise<WorkoutTemplate> {
  const { data, error } = await supabase
    .from("workout_template")
    .select(
      "id, name, description, total_meters, estimated_time_minutes, estimated_calories, effort_level, raw_description, json_description, created_at, create_by_coach"
    )
    .eq("id", workoutId)
    .single();

  if (error) {
    console.error('Error fetching workout template:', error);
    throw new Error(`Failed to fetch workout: ${error.message}`);
  }

  return data;
}

/**
 * Create a new workout template
 */
export async function createWorkoutTemplate(
  workout: CreateWorkoutInput
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("workout_template")
    .insert({
      name: workout.name,
      description: workout.description,
      raw_description: workout.raw_description || workout.description,
      total_meters: workout.total_meters,
      estimated_time_minutes: workout.estimated_time_minutes,
      estimated_calories: workout.estimated_calories,
      effort_level: workout.effort_level,
      create_by_coach: workout.create_by_coach,
      json_description: workout.json_description || null,
    })
    .select("id")
    .single();

  if (error) {
    console.error('Error creating workout template:', error);
    throw new Error(`Failed to create workout: ${error.message}`);
  }

  return data;
}

/**
 * Create a workout template and immediately assign it to a session
 */
export async function createWorkoutForSession(
  workout: CreateWorkoutInput,
  sessionId: string
): Promise<{ id: string }> {
  const newWorkout = await createWorkoutTemplate(workout);
  
  if (sessionId) {
    await assignWorkoutToSession(newWorkout.id, sessionId);
  }
  
  return newWorkout;
}

/**
 * Assign a workout to a training session
 */
export async function assignWorkoutToSession(
  workoutId: string,
  sessionId: string
): Promise<void> {
  const { error } = await supabase
    .from("training_sessions")
    .update({ workout_id: workoutId })
    .eq("id", sessionId);

  if (error) {
    console.error('Error assigning workout to session:', error);
    throw new Error(`Failed to assign workout to session: ${error.message}`);
  }
}

/**
 * Update an existing workout template
 */
export async function updateWorkoutTemplate(
  workoutId: string,
  updates: UpdateWorkoutInput
): Promise<WorkoutTemplate> {
  const { data, error } = await supabase
    .from("workout_template")
    .update(updates)
    .eq("id", workoutId)
    .select()
    .single();

  if (error) {
    console.error('Error updating workout template:', error);
    throw new Error(`Failed to update workout: ${error.message}`);
  }

  return data;
}

/**
 * Delete a workout template
 */
export async function deleteWorkoutTemplate(workoutId: string): Promise<void> {
  const { error } = await supabase
    .from("workout_template")
    .delete()
    .eq("id", workoutId);

  if (error) {
    console.error('Error deleting workout template:', error);
    throw new Error(`Failed to delete workout: ${error.message}`);
  }
}
