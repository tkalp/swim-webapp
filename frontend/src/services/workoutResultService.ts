// services/workoutResultService.ts
import { supabase } from '@/lib/supabase'
import { getApiUrl } from '@/lib/api'
import { authenticatedFetch } from '@/lib/apiClient'

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
  // First get all swimmers in the squad with demographics for standards
  const { data: swimmers, error: swimmersError } = await supabase
    .from('swimmers')
    .select('id, first_name, last_name, date_of_birth, sex')
    .eq('squad_id', squadId)

  if (swimmersError) {
    console.error('Error fetching swimmers:', swimmersError)
    throw new Error(`Failed to fetch swimmers: ${swimmersError.message}`)
  }

  if (!swimmers || swimmers.length === 0) {
    return []
  }

  const swimmerIds = swimmers.map(s => s.id)

  // Get workout results for these swimmers with the specified criteria
  const { data: results, error: resultsError } = await supabase
    .from('workout_result')
    .select('*')
    .in('swimmer_id', swimmerIds)
    .eq('stroke', stroke)
    .eq('activity', activity)
    .eq('distance', distance)
    .eq('result_units', resultUnits)
    .not('time_result', 'is', null)

  if (resultsError) {
    console.error('Error fetching workout results:', resultsError)
    throw new Error(`Failed to fetch workout results: ${resultsError.message}`)
  }

  if (!results || results.length === 0) {
    return []
  }

  // Process results to get best time per swimmer
  const swimmerBestTimes = new Map<string, { time: number; count: number }>()

  results.forEach((result: any) => {
    // Convert interval to seconds (assuming format like '00:01:30' or similar)
    const timeInSeconds = parseIntervalToSeconds(result.time_result)
    
    if (timeInSeconds > 0) {
      const existing = swimmerBestTimes.get(result.swimmer_id)
      if (!existing || timeInSeconds < existing.time) {
        swimmerBestTimes.set(result.swimmer_id, {
          time: timeInSeconds,
          count: (existing?.count || 0) + 1
        })
      } else {
        swimmerBestTimes.set(result.swimmer_id, {
          time: existing.time,
          count: existing.count + 1
        })
      }
    }
  })

  // Build rankings
  const rankings: SwimmerRanking[] = []
  
  swimmerBestTimes.forEach((data, swimmerId) => {
    const swimmer = swimmers.find(s => s.id === swimmerId)
    if (swimmer) {
      const pace = (data.time / distance) * 100 // per 100m/y
      
      rankings.push({
        swimmer_id: swimmerId,
        swimmer_name: `${swimmer.first_name || ''} ${swimmer.last_name || ''}`.trim(),
        best_time: data.time,
        distance,
        stroke,
        activity,
        pace,
        result_count: data.count,
        date_of_birth: swimmer.date_of_birth,
        sex: swimmer.sex,
        result_units: resultUnits
      })
    }
  })

  // Sort by best time (ascending)
  rankings.sort((a, b) => a.best_time - b.best_time)

  return rankings
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
 * Get available distances for a squad, stroke, activity, and result_units
 */
export async function getAvailableDistances(
  squadId: string,
  stroke: StrokeType,
  activity: ActivityType,
  resultUnits: string
): Promise<number[]> {
  const { data: swimmers, error: swimmersError } = await supabase
    .from('swimmers')
    .select('id')
    .eq('squad_id', squadId)

  if (swimmersError || !swimmers) {
    return []
  }

  const swimmerIds = swimmers.map(s => s.id)

  const { data: results, error } = await supabase
    .from('workout_result')
    .select('distance')
    .in('swimmer_id', swimmerIds)
    .eq('stroke', stroke)
    .eq('activity', activity)
    .eq('result_units', resultUnits)
    .not('distance', 'is', null)
    .not('time_result', 'is', null)

  if (error || !results) {
    return []
  }

  // Get unique distances and sort
  const distances = [...new Set(results.map(r => r.distance as number))]
  distances.sort((a, b) => a - b)

  return distances
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
  const { data, error } = await supabase
    .from('workout_result')
    .select('id, swimmer_id, distance, stroke, activity, equipment, units, time_result, performed_on, training_session_id, result_units')
    .eq('swimmer_id', swimmerId)
    .order('performed_on', { ascending: false })
  
  if (error) {
    console.error('Error fetching swimmer results:', error)
    throw error
  }
  
  return data ?? []
}

/**
 * Group by exact event and take best time with trend analysis
 */
export async function getSwimmerBestTimes(swimmerId: string): Promise<BestTimeResult[]> {
  const rows = await listSwimmerResults(swimmerId)
  const map = new Map<string, { best: ResultRow & { seconds: number }, count: number, allTimes: Array<{ seconds: number, date: string | null }> }>()
  
  rows.forEach(r => {
    const distance = r.distance ?? 0
    const stroke = (r.stroke ?? 'free').toLowerCase()
    const activity = (r.activity ?? 'swim').toLowerCase()
    const equipment = (r.equipment ?? 'none').toLowerCase()
    const units = (r.units ?? 'meters').toLowerCase()
    const resultUnits = (r.result_units ?? 'SCM').toUpperCase()
    const eventKey = `${distance}-${stroke}-${activity}-${equipment}-${resultUnits}`
    const sec = intervalToSeconds(r.time_result)

    const candidate = { ...r, seconds: sec }
    const existing = map.get(eventKey)
    
    if (!existing) {
      map.set(eventKey, { best: candidate, count: 1, allTimes: [{ seconds: sec, date: r.performed_on }] })
    } else {
      existing.count += 1
      existing.allTimes.push({ seconds: sec, date: r.performed_on })
      if (sec < existing.best.seconds) existing.best = candidate
    }
  })

  const out: BestTimeResult[] = []
  map.forEach((v, k) => {
    const b = v.best
    
    // Calculate recent trend from last 2-5 attempts
    let recentTrend = null
    if (v.allTimes.length >= 2) {
      // Sort by date to get chronological order
      const sortedTimes = [...v.allTimes].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0
        const dateB = b.date ? new Date(b.date).getTime() : 0
        return dateA - dateB
      })
      
      const recentCount = Math.min(5, sortedTimes.length)
      const recentResults = sortedTimes.slice(-recentCount)
      
      if (recentResults.length >= 2) {
        const oldestRecent = recentResults[0].seconds
        const newestRecent = recentResults[recentResults.length - 1].seconds
        const trendDelta = newestRecent - oldestRecent
        const percentage = oldestRecent > 0 ? Math.round((trendDelta / oldestRecent) * 100) : 0
        
        recentTrend = {
          improving: trendDelta < -0.5,
          declining: trendDelta > 0.5,
          stable: Math.abs(trendDelta) <= 0.5,
          delta: trendDelta,
          count: recentResults.length,
          percentage
        }
      }
    }
    
    out.push({
      id: b.id,
      eventKey: k,
      distance: b.distance ?? 0,
      stroke: (b.stroke ?? 'free').toLowerCase(),
      activity: (b.activity ?? 'swim').toLowerCase(),
      equipment: (b.equipment ?? 'none').toLowerCase(),
      units: (b.units ?? 'meters').toLowerCase(),
      timeResult: b.time_result ?? '',
      timeSeconds: b.seconds,
      numberOfResults: v.count,
      performedOn: b.performed_on,
      resultUnits: (b.result_units ?? 'SCM').toUpperCase(),
      recentTrend
    })
  })
  
  // Sort: best (lowest time), then distance asc
  out.sort((a, b) => a.timeSeconds - b.timeSeconds || a.distance - b.distance)
  return out
}

/**
 * Get attempts for a single event, oldest→newest
 */
export async function getEventAttempts(q: EventQuery): Promise<Array<{
  id: string
  performedOn: string | null
  timeResult: string
  timeSeconds: number
  reactionTime: number | null
  splits: RaceSplit[]
}>> {
  console.log('getEventAttempts', q)

  const { data, error } = await supabase
    .from('workout_result')
    .select(`
      id, 
      performed_on, 
      time_result,
      reaction_time,
      race_splits (
        id,
        split_distance,
        split_time,
        cumulative_time,
        split_order,
        reaction_time
      )
    `)
    .eq('swimmer_id', q.swimmerId)
    .eq('distance', q.distance)
    .eq('stroke', q.stroke)
    .eq('activity', q.activity)
    .eq('equipment', q.equipment)
    .eq('result_units', q.resultUnits)
    .order('performed_on', { ascending: true })

  console.log(data)

  if (error) {
    console.error('Error fetching event attempts:', error)
    throw error
  }
  
  const rows = (data ?? []).filter(r => r.time_result)
  return rows.map(r => ({
    id: r.id,
    performedOn: r.performed_on,
    timeResult: r.time_result!,
    timeSeconds: intervalToSeconds(r.time_result),
    reactionTime: r.reaction_time,
    splits: (r.race_splits || []).sort((a: any, b: any) => a.split_distance - b.split_distance) as RaceSplit[]
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

export type SwimmerPrediction = {
  event_key: string
  event: string
  current_best: number
  predicted_time: number
  confidence_level: 'high' | 'medium' | 'low'
  improvement_expected: number
  factors: PredictionFactors
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
