import { getApiUrl } from '@/lib/api';
import { authenticatedFetch } from '@/lib/apiClient';

export type WorkoutVisibility = 'private' | 'network' | 'public';

export interface SharedWorkout {
  id: string;
  name: string;
  coach_name: string;
  effectiveness_rating: number | null;
  rating_count: number;
  clone_count: number;
  times_used: number;
  visibility: WorkoutVisibility;
}

export async function updateWorkoutVisibility(
  workoutId: string,
  visibility: WorkoutVisibility
): Promise<void> {
  const url = getApiUrl(`workout-sharing/visibility/${workoutId}`);
  const response = await authenticatedFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ visibility }),
  });

  if (!response.ok) {
    throw new Error('Failed to update visibility');
  }
}

export async function cloneWorkout(
  workoutId: string,
  newName?: string
): Promise<any> {
  const url = getApiUrl('workout-sharing/clone');
  const response = await authenticatedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workout_id: workoutId, new_name: newName }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to clone workout');
  }

  return response.json();
}

export async function discoverWorkouts(
  visibility: WorkoutVisibility = 'public',
  sortBy: 'rating' | 'popular' | 'recent' = 'rating',
  limit: number = 20
): Promise<SharedWorkout[]> {
  const params = new URLSearchParams({
    visibility,
    sort_by: sortBy,
    limit: limit.toString(),
  });

  const url = getApiUrl(`workout-sharing/discover?${params}`);
  const response = await authenticatedFetch(url);

  if (!response.ok) {
    throw new Error('Failed to discover workouts');
  }

  return response.json();
}
