// services/workoutAnalysisService.ts
import { authenticatedFetch } from '@/lib/apiClient'
import { API_BASE_URL } from '@/lib/api';

export interface BreakdownEntry {
  meters: number;
  percentage: number;
}

export interface WorkoutAnalysis {
  parser_used: 'llm' | 'regex';
  total_meters: number;
  total_sets: number;
  estimated_duration_minutes: number;
  rest_time_minutes: number;
  stroke_breakdown: Record<string, BreakdownEntry>;
  activity_breakdown: Record<string, BreakdownEntry>;
  energy_zone_breakdown: Record<string, BreakdownEntry>;
  sections: Array<{
    name: string;
    sets: Array<{
      reps: number;
      distance: number;
      stroke: string;
      activity: string;
      interval?: string;
      energy_zone: string;
      equipment?: string[];
      notes?: string;
    }>;
  }>;
}

export interface QuickStats {
  total_meters: number;
  total_sets: number;
}

/**
 * Analyze workout text and get complete breakdown
 */
export async function analyzeWorkout(workoutText: string): Promise<WorkoutAnalysis> {
  const response = await authenticatedFetch(`${API_BASE_URL}/workout-analysis/analyze`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workout_text: workoutText })
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
export async function getQuickWorkoutStats(workoutText: string): Promise<QuickStats> {
  const response = await authenticatedFetch(`${API_BASE_URL}/workout-analysis/quick-stats`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workout_text: workoutText })
  });

  if (!response.ok) {
    throw new Error(`Failed to get workout stats: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data; // Return data even if success is false, for graceful degradation
}
