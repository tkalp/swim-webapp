import { supabase } from "../../lib/supabase"

export type ResultRow = {
  id: string
  swimmer_id: string
  distance: number | null
  stroke: string | null
  activity: string | null
  equipment: string | null
  units: string | null
  time_result: string | null // Postgres interval as string
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

/** Get ALL workout_result rows for a swimmer, client aggregates bests */
export async function listSwimmerResults(swimmerId: string): Promise<ResultRow[]> {
  const { data, error } = await supabase
    .from('workout_result')
    .select('id, swimmer_id, distance, stroke, activity, equipment, units, time_result, performed_on, training_session_id, result_units')
    .eq('swimmer_id', swimmerId)
    .order('performed_on', { ascending: false })
  if (error) throw error
  return data ?? []
}

/** Group by exact event (distance/stroke/activity/equipment/result_units) and take best time */
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
  // sort: best (lowest time), then distance asc
  out.sort((a, b) => a.timeSeconds - b.timeSeconds || a.distance - b.distance)
  return out
}

export type RaceSplit = {
  id: string
  split_distance: number
  split_time: string
  cumulative_time: string
  split_order: number
  reaction_time: number | null
}

/** Attempts for a single event, oldest→newest */
export async function getEventAttempts(q: EventQuery): Promise<Array<{
  id: string
  performedOn: string | null
  timeResult: string
  timeSeconds: number
  reactionTime: number | null
  splits: RaceSplit[]
}>> {

  console.log('getEventAttempts', q); 

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

  console.log(data);

  if (error) throw error
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

/** --- helpers --- */

// Accepts formats like "00:31:12.45", "31:12", "00:31:12"
export function intervalToSeconds(intervalStr: string | null): number {
  if (!intervalStr) return Number.POSITIVE_INFINITY
  // try HH:MM:SS(.ms) or MM:SS(.ms)
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

export function formatTime(seconds: number): string {
  if (!isFinite(seconds)) return '—'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const ss = s.toFixed(2).padStart(5, '0') // "05.23"
  if (h > 0) return `${String(h)}:${String(m).padStart(2,'0')}:${ss}`
  return `${String(m)}:${ss}`
}

// New API for best splits
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

export async function getBestSplits(query: EventQuery): Promise<BestSplitsResponse> {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8000'
  const url = new URL(
    `/api/swimmers/${query.swimmerId}/best-splits/${query.distance}/${query.stroke}`,
    apiUrl
  )
  
  url.searchParams.set('activity', query.activity)
  url.searchParams.set('equipment', query.equipment)
  url.searchParams.set('result_units', query.resultUnits)
  
  const response = await fetch(url.toString())
  
  if (!response.ok) {
    throw new Error(`Failed to fetch best splits: ${response.statusText}`)
  }
  
  return response.json()
}
