// services/aiWorkoutService.ts
import { authenticatedFetch } from '../lib/apiClient'

export interface SquadPerformanceAnalysis {
  squad_id: string;
  analysis_period_days: number;
  total_swimmers: number;
  swimmers_analyzed: number;
  team_performance_trends: {
    [stroke: string]: {
      improving_percentage: number;
      declining_percentage: number;
      stable_percentage: number;
      needs_attention: boolean;
    };
  };
  individual_alerts: Array<{
    swimmer_id: string;
    swimmer_name: string;
    alert_type: 'warning' | 'alert';
    message: string;
    recommendation: string;
    stroke?: string;
    priority: 'high' | 'medium';
  }>;
  coaching_recommendations: string[];
  workout_analysis: {
    sessions_found: number;
    sessions_with_workouts: number;
    workouts_analyzed: number;
    time_period_days: number;
    training_load_analysis: {
      total_meters: number;
      average_meters_per_session: number;
      total_estimated_minutes: number;
      average_minutes_per_session: number;
      average_effort_level: number;
      sessions_per_week: number;
    };
    stroke_distribution: {
      raw_meters: Record<string, number>;
      percentages: Record<string, number>;
      dominant_stroke: string;
    };
    activity_distribution: {
      raw_meters: Record<string, number>;
      percentages: Record<string, number>;
      dominant_activity: string;
    };
    intensity_analysis: {
      distribution: Record<string, number>;
      total_workouts_with_intensity: number;
      average_intensity: string;
    };
    recommendations: Array<{
      type: string;
      priority: 'high' | 'medium' | 'low';
      message: string;
      suggestion: string;
    }>;
    data_quality: {
      workouts_with_detailed_analysis: number;
      total_workouts: number;
      analysis_coverage_percentage: number;
    };
  };
  generated_at: string;
}

export interface CoachingSuggestion {
  title: string;
  type: 'technique_focus' | 'activity_focus' | 'general_fitness' | 'custom_focus';
  duration_weeks: number;
  description: string;
  weekly_structure?: any;
  approach?: {
    assessment: string;
    progression: string;
    adaptation: string;
  };
  weekly_template?: {
    session_structure: string;
    intensity_distribution: string;
    volume_progression: string;
  };
  coaching_priorities?: string[];
  success_indicators?: string[];
  progression_notes?: string;
  success_metrics?: string[];
  equipment_needed?: string[];
}

export interface SquadWorkoutSuggestions {
  squad_id: string;
  target_stroke?: string;
  training_focus?: string;
  focus_areas: Array<{
    type: string;
    stroke?: string;
    activity?: string;
    priority: number;
    reasoning: string;
  }>;
  coaching_suggestions: CoachingSuggestion[];
  squad_context: {
    swimmers_analyzed: number;
    total_alerts: number;
    team_trends: any;
  };
  generated_at: string;
}

const API_BASE_URL = 'http://127.0.0.1:8000';

export class AIWorkoutService {
  private static readonly BASE_URL = `${API_BASE_URL}/ai-enhancement`;

  private static async fetchJSON(url: string, options?: RequestInit) {
    const response = await authenticatedFetch(url, {
      headers: {
        'Content-Type': 'application/json',
        ...options?.headers,
      },
      ...options,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return response.json();
  }

  /**
   * Get AI-powered squad performance analysis
   */
  static async getSquadPerformanceAnalysis(
    squadId: string,
    daysBack: number = 30
  ): Promise<SquadPerformanceAnalysis> {
    const url = `${this.BASE_URL}/squad/${squadId}/performance-analysis?days_back=${daysBack}`;
    return this.fetchJSON(url);
  }

  /**
   * Get AI-generated workout suggestions for a squad
   */
  static async getSquadWorkoutSuggestions(
    squadId: string,
    targetStroke?: string,
    trainingFocus?: string
  ): Promise<SquadWorkoutSuggestions> {
    const params = new URLSearchParams();
    if (targetStroke) params.append('target_stroke', targetStroke);
    if (trainingFocus) params.append('training_focus', trainingFocus);

    const url = `${this.BASE_URL}/squad/${squadId}/workout-suggestions?${params.toString()}`;
    return this.fetchJSON(url);
  }

  /**
   * Search for similar workouts using AI
   */
  static async findSimilarWorkouts(
    query: string,
    limit: number = 5
  ): Promise<Array<{ workout_text: string; similarity_score: number }>> {
    const params = new URLSearchParams();
    params.append('workout_description', query);
    params.append('limit', limit.toString());
    
    const url = `${this.BASE_URL}/workouts/find-similar?${params.toString()}`;
    const response = await this.fetchJSON(url, {
      method: 'POST',
    });
    return response.similar_workouts || [];
  }
}