import { supabase } from "../../lib/supabase";

export async function getWorkout(workoutId: string) {
  const { data, error } = await supabase
    .from("workout_template")
    .select(
      "id, name, total_meters, estimated_time_minutes, estimated_calories, effort_level, raw_description, json_description, created_at, create_by_coach"
    )
    .eq("id", workoutId)
    .single();
  if (error) throw error;
  return data;
}

export async function createWorkoutForSession(
  workout: {
    name: string;
    description: string;
    total_meters: number;
    estimated_time_minutes: number;
    estimated_calories: number;
    effort_level: number;
    create_by_coach: string;
    json_description?: any;
  },
  sessionId: string
) {
  const { data, error } = await supabase

    .from("workout_template")
    .insert({
      name: workout.name,
      raw_description: workout.description,
      total_meters: workout.total_meters,
      estimated_time_minutes: workout.estimated_time_minutes,
      estimated_calories: workout.estimated_calories,
      effort_level: workout.effort_level,
      create_by_coach: workout.create_by_coach,
      json_description: workout.json_description || null,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (sessionId)
    await addWorkoutToSession(data.id, sessionId);
  return data;
}

export async function addWorkoutToSession(
  workoutId: string,
  sessionId: string
) {
  const { data, error } = await supabase

    .from("training_sessions")
    .update({ workout_id: workoutId })
    .eq("id", sessionId);
  if (error) throw error;
  return data;
}

export async function updateWorkout(
  workoutId: string,
  patch: Partial<{
    name: string;
    raw_description: string;
    total_meters: number;
    estimated_time_minutes: number;
    estimated_calories: number;
    effort_level: number;
    json_description: any;
  }>
) {
  const { data, error } = await supabase
    .from("workout_template")
    .update({
      ...(patch as any),
    })
    .eq("id", workoutId)
    .select()
    .single();
  if (error) throw error;
  return data;
}
