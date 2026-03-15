// services/workoutTemplateService.ts
import { apiClient } from '@/lib/apiClient';

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
  visibility?: 'private' | 'network' | 'public';
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
  visibility?: 'private' | 'network' | 'public';
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
  visibility: 'private' | 'network' | 'public';
}>;

/**
 * Get a single workout template by ID
 */
export async function getWorkoutTemplate(workoutId: string): Promise<WorkoutTemplate> {
  return apiClient.get<WorkoutTemplate>(`/workouts/${workoutId}`);
}

/**
 * Create a new workout template
 */
export async function createWorkoutTemplate(
  workout: CreateWorkoutInput
): Promise<{ id: string }> {
  return apiClient.post<{ id: string }>('/workouts', workout);
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
  await apiClient.post('/workouts/assign-session', {
    workout_id: workoutId,
    session_id: sessionId,
  });
}

/**
 * Update an existing workout template
 */
export async function updateWorkoutTemplate(
  workoutId: string,
  updates: UpdateWorkoutInput
): Promise<WorkoutTemplate> {
  return apiClient.put<WorkoutTemplate>(`/workouts/${workoutId}`, updates);
}

/**
 * Delete a workout template
 */
export async function deleteWorkoutTemplate(workoutId: string): Promise<void> {
  await apiClient.delete(`/workouts/${workoutId}`);
}
