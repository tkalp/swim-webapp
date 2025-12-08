import { getApiUrl } from '@/lib/api';
import { authenticatedFetch } from '@/lib/apiClient';

export interface WorkoutRating {
  id: string;
  training_session_id: string;
  workout_id: string;
  coach_id: string;
  rating: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkoutRatingStats {
  workout_id: string;
  effectiveness_rating: number | null;
  rating_count: number;
  times_used: number;
  recent_ratings: WorkoutRating[];
}

export interface CreateRatingRequest {
  training_session_id: string;
  workout_id: string;
  rating: number;
  notes?: string;
}

export async function createWorkoutRating(
  request: CreateRatingRequest
): Promise<WorkoutRating> {
  const url = getApiUrl('workout-ratings/');
  const response = await authenticatedFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.detail || 'Failed to create rating');
  }

  return response.json();
}

export async function updateWorkoutRating(
  ratingId: string,
  rating: number,
  notes?: string
): Promise<WorkoutRating> {
  const url = getApiUrl(`workout-ratings/${ratingId}`);
  const response = await authenticatedFetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating, notes }),
  });

  if (!response.ok) {
    throw new Error('Failed to update rating');
  }

  return response.json();
}

export async function deleteWorkoutRating(ratingId: string): Promise<void> {
  const url = getApiUrl(`workout-ratings/${ratingId}`);
  const response = await authenticatedFetch(url, { method: 'DELETE' });

  if (!response.ok) {
    throw new Error('Failed to delete rating');
  }
}

export async function getWorkoutRatings(
  workoutId: string
): Promise<WorkoutRatingStats> {
  const url = getApiUrl(`workout-ratings/workout/${workoutId}`);
  const response = await authenticatedFetch(url);

  if (!response.ok) {
    throw new Error('Failed to fetch workout ratings');
  }

  return response.json();
}

export async function getSessionRating(
  sessionId: string
): Promise<WorkoutRating | null> {
  const url = getApiUrl(`workout-ratings/session/${sessionId}`);
  const response = await authenticatedFetch(url);

  if (!response.ok) {
    return null;
  }

  return response.json();
}
