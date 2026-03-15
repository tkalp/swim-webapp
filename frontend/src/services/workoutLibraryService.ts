// services/workoutLibraryService.ts
import { apiClient } from '@/lib/apiClient';
import type { WorkoutTag } from '@/types/workoutTags';

export type WorkoutVisibility = 'private' | 'network' | 'public';

export type WorkoutTemplate = {
  id: string;
  name: string;
  description?: string;
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
  tags?: WorkoutTag[];
  // Ratings & Sharing fields
  effectiveness_rating?: number | null;
  rating_count?: number;
  times_used?: number;
  visibility?: WorkoutVisibility;
  clone_count?: number;
  cloned_from_id?: string | null;
  original_creator_id?: string | null;
};

export async function getSquadWorkouts(
  squadId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ workouts: WorkoutTemplate[]; hasMore: boolean; total: number }> {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  return apiClient.get(`/workouts/squad/${squadId}?limit=${limit}&offset=${offset}`);
}

export async function getCoachWorkouts(
  coachId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ workouts: WorkoutTemplate[]; hasMore: boolean; total: number }> {
  const limit = options?.limit || 20;
  const offset = options?.offset || 0;

  return apiClient.get(`/workouts/coach/${coachId}?limit=${limit}&offset=${offset}`);
}

export async function createWorkout(workout: {
  name: string;
  description?: string;
  raw_description: string;
  total_meters: number;
  estimated_time_minutes: number;
  estimated_calories: number;
  effort_level: number;
  create_by_coach: string;
  json_description?: any;
}): Promise<WorkoutTemplate> {
  return apiClient.post('/workouts', workout);
}

export async function deleteWorkout(workoutId: string): Promise<void> {
  await apiClient.delete(`/workouts/${workoutId}`);
}

export async function duplicateWorkout(workoutId: string): Promise<WorkoutTemplate> {
  return apiClient.post(`/workouts/${workoutId}/duplicate`);
}
