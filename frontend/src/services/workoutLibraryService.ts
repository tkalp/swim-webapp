// services/workoutLibraryService.ts
import { supabase } from "../lib/supabase";

export type WorkoutTemplate = {
  id: string;
  name: string;
  total_meters: number;
  estimated_time_minutes: number;
  estimated_calories: number;
  effort_level: number;
  raw_description: string;
  json_description: any;
  created_at: string;
  create_by_coach: string;
  last_used_at?: string;
  usage_count?: number;
};

export async function getSquadWorkouts(
  squadId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ workouts: WorkoutTemplate[]; hasMore: boolean; total: number }> {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  // Get the squad's coach ID
  const { data: squad, error: squadError } = await supabase
    .from('squads')
    .select('coach_id')
    .eq('id', squadId)
    .single();

  if (squadError) throw squadError;

  // Get all training sessions for this squad with their workout_ids
  const { data: sessions, error: sessionsError } = await supabase
    .from('training_sessions')
    .select('workout_id')
    .eq('squad_id', squadId)
    .not('workout_id', 'is', null);

  if (sessionsError) throw sessionsError;

  // Get unique workout IDs from sessions
  const sessionWorkoutIds = [...new Set(sessions?.map(s => s.workout_id).filter(Boolean) as string[])];

  // Fetch ALL workouts created by this coach (both assigned to sessions and standalone)
  const { data: allWorkouts, error: workoutsError } = await supabase
    .from('workout_template')
    .select('*')
    .eq('create_by_coach', squad.coach_id)
    .order('created_at', { ascending: false });

  if (workoutsError) throw workoutsError;

  // Apply pagination
  const totalWorkouts = allWorkouts?.length || 0;
  const workouts = allWorkouts?.slice(offset, offset + limit) || [];

  // For each workout, get usage stats
  const workoutsWithStats = await Promise.all(
    (workouts || []).map(async (workout) => {
      const { data: usageData, error: usageError } = await supabase
        .from('training_sessions')
        .select('start_date')
        .eq('workout_id', workout.id)
        .eq('squad_id', squadId)
        .order('start_date', { ascending: false })
        .limit(1);

      const { count } = await supabase
        .from('training_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('workout_id', workout.id)
        .eq('squad_id', squadId);

      return {
        ...workout,
        last_used_at: usageData?.[0]?.start_date || null,
        usage_count: count || 0,
      };
    })
  );

  return {
    workouts: workoutsWithStats,
    hasMore: offset + workouts.length < totalWorkouts,
    total: totalWorkouts,
  };
}

export async function createWorkout(workout: {
  name: string;
  raw_description: string;
  total_meters: number;
  estimated_time_minutes: number;
  estimated_calories: number;
  effort_level: number;
  create_by_coach: string;
  json_description?: any;
}): Promise<WorkoutTemplate> {
  const { data, error } = await supabase
    .from('workout_template')
    .insert({
      name: workout.name,
      raw_description: workout.raw_description,
      total_meters: workout.total_meters,
      estimated_time_minutes: workout.estimated_time_minutes,
      estimated_calories: workout.estimated_calories,
      effort_level: workout.effort_level,
      create_by_coach: workout.create_by_coach,
      json_description: workout.json_description || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  // Check if workout is being used in any sessions
  const { data: sessions, error: checkError } = await supabase
    .from('training_sessions')
    .select('id')
    .eq('workout_id', workoutId)
    .limit(1);

  if (checkError) throw checkError;

  if (sessions && sessions.length > 0) {
    throw new Error('Cannot delete workout that is assigned to training sessions');
  }

  const { error } = await supabase
    .from('workout_template')
    .delete()
    .eq('id', workoutId);

  if (error) throw error;
}

export async function duplicateWorkout(workoutId: string): Promise<WorkoutTemplate> {
  // Fetch the original workout
  const { data: original, error: fetchError } = await supabase
    .from('workout_template')
    .select('*')
    .eq('id', workoutId)
    .single();

  if (fetchError) throw fetchError;

  // Create a copy
  const { data, error } = await supabase
    .from('workout_template')
    .insert({
      name: `${original.name} (Copy)`,
      raw_description: original.raw_description,
      total_meters: original.total_meters,
      estimated_time_minutes: original.estimated_time_minutes,
      estimated_calories: original.estimated_calories,
      effort_level: original.effort_level,
      create_by_coach: original.create_by_coach,
      json_description: original.json_description,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}
