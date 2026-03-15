// services/workoutTagService.ts
import { apiClient } from '@/lib/apiClient';
import type { WorkoutTag, CreateTagData, UpdateTagData } from '@/types/workoutTags';

/**
 * Get all tags for a coach
 */
export async function getCoachTags(coachId: string): Promise<WorkoutTag[]> {
  return apiClient.get<WorkoutTag[]>(`/coaches/${coachId}/tags`);
}

/**
 * Create a new tag
 */
export async function createTag(coachId: string, tagData: CreateTagData): Promise<WorkoutTag> {
  return apiClient.post<WorkoutTag>(`/coaches/${coachId}/tags`, tagData);
}

/**
 * Update a tag
 */
export async function updateTag(tagId: string, updates: UpdateTagData): Promise<WorkoutTag> {
  return apiClient.put<WorkoutTag>(`/tags/${tagId}`, updates);
}

/**
 * Delete a tag
 */
export async function deleteTag(tagId: string): Promise<void> {
  await apiClient.delete(`/tags/${tagId}`);
}

/**
 * Get all tags for a specific workout
 */
export async function getWorkoutTags(workoutId: string): Promise<WorkoutTag[]> {
  return apiClient.get<WorkoutTag[]>(`/workouts/${workoutId}/tags`);
}

/**
 * Add a tag to a workout
 */
export async function addTagToWorkout(workoutId: string, tagId: string): Promise<void> {
  await apiClient.post(`/workouts/${workoutId}/tags/${tagId}`);
}

/**
 * Remove a tag from a workout
 */
export async function removeTagFromWorkout(workoutId: string, tagId: string): Promise<void> {
  await apiClient.delete(`/workouts/${workoutId}/tags/${tagId}`);
}

/**
 * Set all tags for a workout (replace existing)
 */
export async function setWorkoutTags(workoutId: string, tagIds: string[]): Promise<void> {
  await apiClient.post(`/workouts/${workoutId}/tags/set`, { tag_ids: tagIds });
}
