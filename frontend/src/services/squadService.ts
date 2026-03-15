// services/squadService.ts
import { apiClient, authenticatedFetch } from '@/lib/apiClient'
import { API_BASE_URL } from '@/lib/api'

export type Squad = {
  id: string
  name: string | null
  description: string | null
  created_at: string
}

export type SquadCard = {
  id: string
  name: string | null
  description: string | null
  created_at: string
  role: 'owner' | 'admin' | 'member'
  swimmers_count: number
}

export type CreateSquadData = {
  name: string
  description?: string | null
}

export type UpdateSquadData = Partial<{
  name: string | null
  description: string | null
}>

/**
 * Returns all squads for a coach (coach_id === auth user id).
 */
export async function getSquadsForCoach(coachId: string): Promise<SquadCard[]> {
  return apiClient.get<SquadCard[]>('/squads')
}

/**
 * Get a single squad by ID
 */
export async function getSquadById(squadId: string): Promise<Squad | null> {
  try {
    return await apiClient.get<Squad>(`/squads/${squadId}`)
  } catch {
    return null
  }
}

/**
 * Create a new squad
 */
export async function createSquad(coachId: string, squadData: CreateSquadData): Promise<Squad> {
  return apiClient.post<Squad>('/squads', { ...squadData, coach_id: coachId })
}

/**
 * Update an existing squad
 */
export async function updateSquad(squadId: string, updates: UpdateSquadData): Promise<Squad> {
  return apiClient.put<Squad>(`/squads/${squadId}`, updates)
}

/**
 * Delete a squad
 */
export async function deleteSquad(squadId: string): Promise<void> {
  await apiClient.delete(`/squads/${squadId}`)
}

/**
 * Check if a squad exists
 */
export async function squadExists(squadId: string): Promise<boolean> {
  try {
    await apiClient.get(`/squads/${squadId}`)
    return true
  } catch {
    return false
  }
}

/**
 * Get total squads count for a coach
 */
export async function getSquadsCountForCoach(coachId: string): Promise<number> {
  const squads = await apiClient.get<SquadCard[]>('/squads')
  return squads.length
}

/**
 * Get swimmers for a squad
 */
export async function getSquadSwimmers(squadId: string): Promise<any[]> {
  return apiClient.get<any[]>(`/squads/${squadId}/swimmers`)
}

/**
 * Get training schedules for a squad
 */
export async function getSquadSchedules(squadId: string): Promise<any[]> {
  return apiClient.get<any[]>(`/squads/${squadId}/schedules`)
}

/**
 * Get training sessions for a squad
 */
export async function getSquadSessions(squadId: string, fromISO?: string, toISO?: string): Promise<any[]> {
  const from = fromISO ?? new Date(Date.now() - 1000*60*60*24*30).toISOString()
  const to = toISO ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()

  return apiClient.get<any[]>(`/squads/${squadId}/sessions?from_date=${from}&to_date=${to}`)
}

/**
 * Get calendar events for a squad
 */
export async function getSquadCalendarEvents(squadId: string, fromISO?: string, toISO?: string): Promise<any[]> {
  const from = fromISO ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const to = toISO ?? new Date(new Date().getFullYear(), new Date().getMonth()+1, 0, 23,59,59).toISOString()

  return apiClient.get<any[]>(`/squads/${squadId}/calendar-events?from_date=${from}&to_date=${to}`)
}

// ============================================
// SQUAD SYNC
// ============================================

export interface SquadSyncResponse {
  success: boolean
  job_id?: string
  total_swimmers?: number
  message: string
}

export interface SquadSyncStatus {
  id: string
  status: string
  total_swimmers: number
  swimmers_processed: number
  swimmers_succeeded: number
  swimmers_failed: number
  started_at?: string
  completed_at?: string
  error_message?: string
}

/**
 * Trigger a SwimRankings sync for all linked swimmers in a squad
 */
export async function triggerSquadSync(squadId: string): Promise<SquadSyncResponse> {
  return apiClient.post<SquadSyncResponse>(`/squads/${squadId}/sync`)
}

/**
 * Get the status of a squad sync job
 */
export async function getSquadSyncStatus(squadId: string, jobId: string): Promise<SquadSyncStatus> {
  return apiClient.get<SquadSyncStatus>(`/squads/${squadId}/sync/status/${jobId}`)
}

// ============================================
// EVENT STATISTICS
// ============================================

export interface EventStatistics {
  squad: {
    id: string
    name: string
  }
  event: string
  distance: number
  stroke: string
  result_units: string
  activity: string
  sample_size: number
  avg_time: number | null
  median_time: number | null
  top_quartile_time: number | null
  bottom_quartile_time: number | null
}

/**
 * Get aggregated statistics for a specific event
 */
export async function getSquadEventStatistics(
  squadId: string,
  distance: number,
  stroke: string,
  activity?: string,
  resultUnits?: string
): Promise<EventStatistics> {
  const params = new URLSearchParams()
  params.append('distance', distance.toString())
  params.append('stroke', stroke)
  if (activity) params.append('activity', activity)
  if (resultUnits) params.append('result_units', resultUnits)

  const url = `${API_BASE_URL}/squads/${squadId}/event-statistics?${params.toString()}`
  const response = await authenticatedFetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch event statistics: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Swimmer comparison types
 */

export interface TrendAnalysis {
  improvement_per_year: number  // Seconds per year (negative = improving)
  velocity_category: 'rapid' | 'moderate' | 'slow' | 'plateaued' | 'declining'
  consistency_score: number  // 0-100
  data_points: number
  predicted_next_year: number | null
}

export interface EventTrend {
  event: string
  swimmer_a: TrendAnalysis
  swimmer_b: TrendAnalysis
  comparison: {
    relative_velocity: number
    velocity_advantage: 'swimmer_a' | 'swimmer_b' | 'similar'
  }
}

export interface HeadToHeadEvent {
  event_key: string
  event: string
  swimmer_a: {
    time: string
    time_seconds: number
    age: number
    date: string
  } | null
  swimmer_b: {
    time: string
    time_seconds: number
    age: number
    date: string
  } | null
  differential: number | null  // Positive = A slower, negative = A faster
  percentage_faster: number | null
  faster_swimmer: 'swimmer_a' | 'swimmer_b' | null
}

export interface RacePrediction {
  event: string
  swimmer_a_probability: number
  swimmer_b_probability: number
  confidence_level: 'high' | 'medium' | 'low'
  predicted_differential: number
  predicted_time_a: number | null
  predicted_time_b: number | null
  factors: Record<string, number>
}

export interface PredictionAnalysis {
  events: RacePrediction[]
  overall_favorite: 'swimmer_a' | 'swimmer_b' | 'even'
  average_confidence: number
}

export interface SwimmerComparisonResult {
  swimmer_a: {
    id: string
    name: string
    age: number
    squad: string
    total_results: number
  }
  swimmer_b: {
    id: string
    name: string
    age: number
    squad: string
    total_results: number
  }
  comparison_settings: {
    normalize_by_age: boolean
    target_age: number | null
    events_filter: string[] | null
  }
  summary: {
    total_events_compared: number
    total_unique_events: number
    swimmer_a_faster_count: number
    swimmer_b_faster_count: number
    average_time_differential: number | null
    stroke_breakdown: Record<string, {
      a_faster_count: number
      b_faster_count: number
      total: number
    }>
  }
  head_to_head: HeadToHeadEvent[]
  trend_analysis: {
    by_event: Record<string, EventTrend>
    overall: {
      swimmer_a: TrendAnalysis
      swimmer_b: TrendAnalysis
      comparison: {
        relative_velocity: number
        velocity_advantage: 'swimmer_a' | 'swimmer_b' | 'similar'
      }
    } | null
    events_analyzed: number
  }
  predictions: PredictionAnalysis
}

/**
 * Compare two swimmers with comprehensive analysis
 */
export async function compareSwimmers(
  squadId: string,
  swimmerAId: string,
  swimmerBId: string,
  options?: {
    normalizeByAge?: boolean
    targetAge?: number
    events?: string[]
    dateFrom?: string
    dateTo?: string
  }
): Promise<SwimmerComparisonResult> {
  const params = new URLSearchParams()
  params.append('swimmer_a_id', swimmerAId)
  params.append('swimmer_b_id', swimmerBId)

  if (options?.normalizeByAge) {
    params.append('normalize_by_age', 'true')
  }
  if (options?.targetAge !== undefined) {
    params.append('target_age', options.targetAge.toString())
  }
  if (options?.events && options.events.length > 0) {
    params.append('events', options.events.join(','))
  }
  if (options?.dateFrom) {
    params.append('date_from', options.dateFrom)
  }
  if (options?.dateTo) {
    params.append('date_to', options.dateTo)
  }

  const url = `${API_BASE_URL}/squads/${squadId}/compare-swimmers?${params.toString()}`
  const response = await authenticatedFetch(url)

  if (!response.ok) {
    throw new Error(`Failed to compare swimmers: ${response.statusText}`)
  }

  return response.json()
}
