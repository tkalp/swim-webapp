// services/workoutResultService.ts
import { apiClient, authenticatedFetch } from '@/lib/apiClient'
import { getApiUrl } from '@/lib/api'

export type StrokeType = 'free' | 'back' | 'breast' | 'fly' | 'im'
export type ActivityType = 'swim' | 'kick' | 'pull' | 'drill'

export type WorkoutResult = {
  id: string
  swimmer_id: string
  training_session_id: string
  stroke: StrokeType | null
  activity: ActivityType | null
  distance: number | null
  time_result: any // interval type from postgres
  equipment: string | null
  units: 'meters' | 'yards' | null
  created_at: string
  created_by: string | null
}

export type SwimmerRanking = {
  swimmer_id: string
  swimmer_name: string
  best_time: number // in seconds
  distance: number
  stroke: StrokeType
  activity: ActivityType
  pace: number // seconds per 100m/y
  result_count: number
  date_of_birth?: string
  sex?: string
  result_units: string
}

export type OverallRanking = {
  swimmer_id: string
  swimmer_name: string
  date_of_birth?: string
  sex?: string
  fifty_fly?: number
  hundred_back?: number
  hundred_breast?: number
  two_hundred_free?: number
  two_hundred_im?: number
  total_time?: number
  events_completed: number
  has_all_events: boolean
}

/**
 * Get rankings for a squad based on stroke, activity, distance, and result_units
 */
export async function getSquadRankings(
  squadId: string,
  stroke: StrokeType,
  activity: ActivityType,
  distance: number,
  resultUnits: string
): Promise<SwimmerRanking[]> {
  const params = new URLSearchParams()
  params.append('stroke', stroke)
  params.append('activity', activity)
  params.append('distance', distance.toString())
  params.append('result_units', resultUnits)

  return apiClient.get<SwimmerRanking[]>(`/workout-results/squad/${squadId}/rankings?${params.toString()}`)
}

/**
 * Get available distances for a squad, stroke, activity, and result_units
 */
export async function getAvailableDistances(
  squadId: string,
  stroke: StrokeType,
  activity: ActivityType,
  resultUnits: string
): Promise<number[]> {
  const params = new URLSearchParams()
  params.append('stroke', stroke)
  params.append('activity', activity)
  params.append('result_units', resultUnits)

  return apiClient.get<number[]>(`/workout-results/squad/${squadId}/available-distances?${params.toString()}`)
}

// ============================================
// BEST TIMES FUNCTIONS
// ============================================

export type ResultRow = {
  id: string
  swimmer_id: string
  distance: number | null
  stroke: string | null
  activity: string | null
  equipment: string | null
  units: string | null
  time_result: string | null
  performed_on: string | null
  result_units: string | null
  training_session_id: string | null
}

export type BestTimeResult = {
  id: string
  eventKey: string
  distance: number
  stroke: string
  activity: string
  equipment: string
  units: string
  timeResult: string
  timeSeconds: number
  numberOfResults: number
  resultUnits: string
  performedOn?: string | null
  recentTrend?: {
    improving: boolean
    declining: boolean
    stable: boolean
    delta: number
    count: number
    percentage: number
  } | null
  // Conversion fields
  isConverted?: boolean
  convertedFrom?: 'SCM' | 'LCM'
  originalTimeSeconds?: number
  convertedTimeSeconds?: number
}

export type EventQuery = {
  swimmerId: string
  distance: number
  stroke: string
  activity: string
  equipment: string
  units: string
  resultUnits: string
}

export type RaceSplit = {
  id: string
  split_distance: number
  split_time: string
  cumulative_time: string
  split_order: number
  reaction_time: number | null
}

export type BestSplit = {
  split_distance: number
  best_cumulative_time: string
  best_seconds: number
  from_attempt_id: string
  from_attempt_date: string | null
}

export type BestSplitsResponse = {
  distance: number
  stroke: string
  activity: string
  equipment: string
  result_units: string
  best_splits: BestSplit[]
  total_attempts_analyzed: number
}

/**
 * Get ALL workout_result rows for a swimmer
 */
export async function listSwimmerResults(swimmerId: string): Promise<ResultRow[]> {
  return apiClient.get<ResultRow[]>(`/workout-results/swimmer/${swimmerId}`)
}

/**
 * Group by exact event and take best time with trend analysis.
 * Now uses the backend API which includes automatic course conversions.
 */
export async function getSwimmerBestTimes(swimmerId: string): Promise<BestTimeResult[]> {
  // Use the API endpoint which includes course conversions
  const apiUrl = getApiUrl(`swimmers/${swimmerId}/best-times`)
  const response = await authenticatedFetch(apiUrl)

  if (!response.ok) {
    throw new Error(`Failed to fetch best times: ${response.statusText}`)
  }

  const apiResults = await response.json()

  // Map API results to BestTimeResult format
  const resultMap = new Map<string, BestTimeResult[]>()

  for (const result of apiResults) {
    const distance = result.distance ?? 0
    const stroke = (result.stroke ?? 'free').toLowerCase()
    const activity = (result.activity ?? 'swim').toLowerCase()
    const equipment = (result.equipment ?? 'none').toLowerCase()
    const resultUnits = (result.result_units ?? 'SCM').toUpperCase()
    const eventKey = `${distance}-${stroke}-${activity}-${equipment}-${resultUnits}`

    // For converted times, use the converted_time_seconds directly from backend
    // For actual times, parse the time_result
    const timeSeconds = result.is_converted
      ? (result.converted_time_seconds ?? 0)
      : (result.time_result ? intervalToSeconds(result.time_result) : 0)

    const bestTime: BestTimeResult = {
      id: result.id,
      eventKey,
      distance,
      stroke,
      activity,
      equipment,
      units: result.units ?? 'meters',
      timeResult: result.time_result ?? '',
      timeSeconds,
      numberOfResults: 1, // Backend returns best per event
      resultUnits,
      performedOn: result.performed_on,
      recentTrend: null,
      isConverted: result.is_converted ?? false,
      convertedFrom: result.converted_from,
      originalTimeSeconds: result.original_time_seconds,
      convertedTimeSeconds: result.converted_time_seconds
    }

    if (!resultMap.has(eventKey)) {
      resultMap.set(eventKey, [])
    }
    resultMap.get(eventKey)!.push(bestTime)
  }

  // Flatten and sort
  const out: BestTimeResult[] = []
  resultMap.forEach(times => {
    out.push(...times)
  })

  out.sort((a, b) => a.timeSeconds - b.timeSeconds || a.distance - b.distance)
  return out
}

/**
 * Get attempts for a single event, oldest->newest
 */
export async function getEventAttempts(q: EventQuery): Promise<Array<{
  id: string
  performedOn: string | null
  timeResult: string
  timeSeconds: number
  reactionTime: number | null
  splits: RaceSplit[]
}>> {
  const params = new URLSearchParams()
  params.append('distance', q.distance.toString())
  params.append('stroke', q.stroke)
  params.append('activity', q.activity)
  params.append('equipment', q.equipment)
  params.append('result_units', q.resultUnits)

  const raw = await apiClient.get<any[]>(`/workout-results/swimmer/${q.swimmerId}/event-attempts?${params.toString()}`)

  return raw.map(r => ({
    id: r.id,
    performedOn: r.performed_on ?? null,
    timeResult: r.time_result ?? '',
    timeSeconds: r.time_result ? intervalToSeconds(r.time_result) : 0,
    reactionTime: r.reaction_time ?? null,
    splits: (r.race_splits ?? []).map((s: any) => ({
      id: s.id,
      split_distance: s.split_distance,
      split_time: s.split_time,
      cumulative_time: s.cumulative_time,
      split_order: s.split_order,
      reaction_time: s.reaction_time ?? null,
    })),
  }))
}

/**
 * Get best splits for an event (from backend API)
 */
export async function getBestSplits(query: EventQuery): Promise<BestSplitsResponse> {
  const url = getApiUrl(
    `swimmers/${query.swimmerId}/best-splits/${query.distance}/${query.stroke}?` +
    `activity=${query.activity}&equipment=${query.equipment}&result_units=${query.resultUnits}`
  )

  const response = await authenticatedFetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch best splits: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Parse PostgreSQL interval to seconds
 */
function parseIntervalToSeconds(interval: any): number {
  if (!interval) return 0

  // Handle different interval formats
  if (typeof interval === 'string') {
    // Format: "HH:MM:SS" or "MM:SS.mmm"
    const parts = interval.split(':')
    if (parts.length === 3) {
      const hours = parseFloat(parts[0])
      const minutes = parseFloat(parts[1])
      const seconds = parseFloat(parts[2])
      return hours * 3600 + minutes * 60 + seconds
    } else if (parts.length === 2) {
      const minutes = parseFloat(parts[0])
      const seconds = parseFloat(parts[1])
      return minutes * 60 + seconds
    }
  }

  return 0
}

/**
 * Format seconds to display time (MM:SS.ms or H:MM:SS.ms)
 */
export function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const ss = s.toFixed(2).padStart(5, '0')
  if (h > 0) return `${String(h)}:${String(m).padStart(2, '0')}:${ss}`
  return `${String(m)}:${ss}`
}

/**
 * Get overall rankings for a squad (pentathlon-style)
 */
export async function getSquadOverallRankings(
  squadId: string,
  resultUnits: string
): Promise<OverallRanking[]> {
  const url = getApiUrl(`squads/${squadId}/overall-rankings?result_units=${resultUnits}`)
  const response = await authenticatedFetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch overall rankings: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Convert PostgreSQL interval to seconds
 */
export function intervalToSeconds(intervalStr: string | null): number {
  if (!intervalStr) return Number.POSITIVE_INFINITY
  // Handle HH:MM:SS(.ms) or MM:SS(.ms)
  const parts = intervalStr.split(':')
  let h = 0, m = 0, s = 0
  if (parts.length === 3) {
    h = parseInt(parts[0], 10) || 0
    m = parseInt(parts[1], 10) || 0
    s = parseFloat(parts[2]) || 0
  } else if (parts.length === 2) {
    m = parseInt(parts[0], 10) || 0
    s = parseFloat(parts[1]) || 0
  } else {
    const n = parseFloat(intervalStr)
    return isNaN(n) ? Number.POSITIVE_INFINITY : n
  }
  return h * 3600 + m * 60 + s
}

export type PredictionFactors = {
  attempts_analyzed: number
  improvement_rate: number
  consistency: number
  recent_form: number
}

export type GapAnalysisCause = {
  factor: string
  swimmer_value: number | null
  squad_average: number | null
  impact: 'high' | 'medium' | 'low'
  description: string
}

export type GapAnalysisAction = {
  priority: 'high' | 'medium'
  action: string
  category: string
}

export type GapAnalysis = {
  status: 'on_track' | 'needs_attention' | 'intervention_required' | 'insufficient_data'
  status_label: string
  severity: 'none' | 'warning' | 'critical'
  likely_causes: GapAnalysisCause[]
  recommended_actions: GapAnalysisAction[]
  achievement_rate?: number
  predictions_tested?: number
}

export type SwimmerPrediction = {
  event_key: string
  event: string
  current_best: number
  current_best_is_converted?: boolean
  current_best_converted_from?: string
  predicted_time: number
  confidence_level: 'high' | 'medium' | 'low'
  improvement_expected: number
  factors: PredictionFactors
  achievement_rate?: number
  achievement_confidence?: string
  avg_attempts_to_achieve?: number
  predictions_tested?: number
  gap_analysis?: GapAnalysis
}

export type SwimmerPredictionsResponse = {
  swimmer_id: string
  swimmer_name: string
  predictions: SwimmerPrediction[]
  total_events: number
  high_confidence_count: number
  medium_confidence_count: number
  low_confidence_count: number
  metadata: {
    attempts_until_target: number
    min_attempts: number
    total_results_analyzed: number
  }
}

export type SquadPredictionsResponse = {
  squad_id: string
  predictions: {
    [swimmer_id: string]: {
      swimmer_id: string
      swimmer_name: string
      predictions: SwimmerPrediction[]
      total_events: number
      attendance_rate: number | null
    }
  }
  total_swimmers: number
  swimmers_with_predictions: number
  total_predictions: number
  attempts_until_target: number
}

/**
 * Get improvement predictions for a swimmer
 */
export async function getSwimmerPredictions(
  swimmerId: string,
  attemptsUntilTarget: number = 3,
  minAttempts: number = 3
): Promise<SwimmerPredictionsResponse> {
  const url = getApiUrl(
    `swimmers/${swimmerId}/predictions?attempts_until_target=${attemptsUntilTarget}&min_attempts=${minAttempts}`
  )

  const response = await authenticatedFetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch predictions: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Get improvement predictions for all swimmers in a squad
 */
export async function getSquadPredictions(
  squadId: string,
  attemptsUntilTarget: number = 5,
  minAttempts: number = 5
): Promise<SquadPredictionsResponse> {
  const url = getApiUrl(
    `squads/${squadId}/predictions?attempts_until_target=${attemptsUntilTarget}&min_attempts=${minAttempts}`
  )

  const response = await authenticatedFetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch squad predictions: ${response.statusText}`)
  }

  return response.json()
}
