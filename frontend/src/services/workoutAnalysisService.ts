// services/workoutAnalysisService.ts
import { authenticatedFetch } from '../lib/apiClient'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export interface WorkoutAnalysis {
  workout_id: string;
  total_meters: number;
  total_sets: number;
  estimated_duration_minutes: number;
  swim_time_minutes: number;
  rest_time_minutes: number;
  estimated_calories: number;
  stroke_breakdown: Record<string, number>;
  stroke_percentages: Record<string, number>;
  activity_breakdown: Record<string, number>;
  activity_percentages: Record<string, number>;
  energy_zone_breakdown: Record<string, number>;
  energy_zone_percentages: Record<string, number>;
  sets_details: Array<{
    distance: number;
    reps: number;
    stroke: string;
    activity: string;
    total_distance: number;
    energy_zone?: string;
    interval_time?: number | null;
    breakdown_components?: Array<{
      reps: number;
      distance: number;
      total_distance: number;
      stroke: string;
      activity: string;
      description: string;
    }>;
  }>;
  classification?: string;
}

export interface QuickStats {
  total_meters: number;
  estimated_duration_minutes: number;
  swim_time_minutes: number;
  rest_time_minutes: number;
  total_sets: number;
  classification: string;
}

/**
 * Analyze workout text and get complete breakdown
 */
export async function analyzeWorkout(workoutText: string, workoutId: string = "CUSTOM"): Promise<WorkoutAnalysis> {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/workout-analysis/analyze`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workout_text: workoutText,
      workout_id: workoutId
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to analyze workout: ${response.statusText}`);
  }
  
  const data = await response.json();
  
  if (!data.success) {
    throw new Error(data.error || 'Analysis failed');
  }
  
  return data.data;
}

/**
 * Get quick stats for form display (lighter analysis)
 */
export async function getQuickWorkoutStats(workoutText: string, workoutId: string = "CUSTOM"): Promise<QuickStats> {
  const response = await authenticatedFetch(`${API_BASE_URL}/api/workout-analysis/quick-stats`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      workout_text: workoutText,
      workout_id: workoutId
    })
  });
  
  if (!response.ok) {
    throw new Error(`Failed to get workout stats: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data; // Return data even if success is false, for graceful degradation
}