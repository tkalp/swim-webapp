// services/intelligenceService.ts
import { authenticatedFetch } from '../lib/apiClient'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

export interface PerformanceTimeline {
  swimmer_id: string;
  analysis_period_days: number;
  stroke_trends: Record<string, {
    trend_direction: string;
    improvement_rate_percent: number;
    data_points: number;
    current_form: string;
  }>;
  plateau_analysis: Record<string, {
    stroke: string;
    distance: number;
    plateau_duration_sessions: number;
    confidence: number;
  }>;
  recommendations: string[];
}

export interface CoachingPatterns {
  swimmer_id: string;
  coaching_focus_areas: {
    technique_focus_frequency: number;
    endurance_focus_frequency: number;
    speed_focus_frequency: number;
    positive_feedback_frequency: number;
  };
  sessions_with_feedback: number;
  primary_coaching_theme: string;
  feedback_coverage: number;
  session_quality_trend?: {
    direction: string;
    average: number;
    recent_average: number;
    trend_change: number;
  };
  session_effort_trend?: {
    direction: string;
    average: number;
    recent_average: number;
    trend_change: number;
  };
  session_technique_trend?: {
    direction: string;
    average: number;
    recent_average: number;
    trend_change: number;
  };
  total_sessions_analyzed: number;
  average_session_quality: number;
  quality_consistency: number;
  attendance_patterns?: {
    total_sessions_attended: number;
    sessions_per_week: number;
    average_gap_between_sessions: number;
    attendance_consistency_score: number;
    most_recent_session: string;
    attendance_span_days: number;
    attendance_trend: string;
    recent_sessions_count: number;
    previous_sessions_count: number;
  };
  key_insights: string[];
  overall_assessment: string;
  recommendations: string[];
}

export interface WorkoutEffectiveness {
  workout_id: string;
  effectiveness_score: number;
  performance_impact: {
    avg_improvement_percent: number;
    positive_impact_rate: number;
    sample_size: number;
  };
  coach_satisfaction: {
    avg_overall_rating: number;
    high_satisfaction_rate: number;
    sample_size: number;
  };
  recommendations: string[];
}

/**
 * Get intelligent performance timeline analysis for a swimmer
 */
export async function getSwimmerPerformanceTimeline(
  swimmerId: string, 
  daysBack: number = 90
): Promise<PerformanceTimeline> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/swimmer-analytics/swimmer/${swimmerId}/performance-timeline?days_back=${daysBack}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch performance timeline: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Get coaching feedback patterns and predictions for a swimmer
 */
export async function getCoachingFeedbackPatterns(swimmerId: string): Promise<CoachingPatterns> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/swimmer-analytics/swimmer/${swimmerId}/coaching-feedback-patterns`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch coaching patterns: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Get workout effectiveness analysis
 */
export async function getWorkoutEffectiveness(workoutId: string): Promise<WorkoutEffectiveness> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/swimmer-analytics/workout/${workoutId}/effectiveness`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch workout effectiveness: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data.data;
}

/**
 * Get comprehensive analysis combining all intelligence streams
 */
export async function getComprehensiveAnalysis(
  swimmerId: string, 
  daysBack: number = 90
): Promise<{
  performance_timeline: PerformanceTimeline;
  feedback_patterns: CoachingPatterns;
  meta_insights: any;
  breakthrough_recommendations: string[];
}> {
  const response = await authenticatedFetch(
    `${API_BASE_URL}/api/swimmer-analytics/swimmer/${swimmerId}/comprehensive-analysis?days_back=${daysBack}`
  );
  
  if (!response.ok) {
    throw new Error(`Failed to fetch comprehensive analysis: ${response.statusText}`);
  }
  
  const data = await response.json();
  return data;
}