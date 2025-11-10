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
  const map = new Map<string, { best: ResultRow & { seconds: number }, count: number }>()
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
      map.set(eventKey, { best: candidate, count: 1 })
    } else {
      existing.count += 1
      if (sec < existing.best.seconds) existing.best = candidate
    }
  })

  const out: BestTimeResult[] = []
  map.forEach((v, k) => {
    const b = v.best
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
    })
  })
  // sort: best (lowest time), then distance asc
  out.sort((a, b) => a.timeSeconds - b.timeSeconds || a.distance - b.distance)
  return out
}

/** Attempts for a single event, oldest→newest */
export async function getEventAttempts(q: EventQuery): Promise<Array<{
  id: string
  performedOn: string | null
  timeResult: string
  timeSeconds: number
}>> {
  const { data, error } = await supabase
    .from('workout_result')
    .select('id, performed_on, time_result')
    .eq('swimmer_id', q.swimmerId)
    .eq('distance', q.distance)
    .eq('stroke', q.stroke)
    .eq('activity', q.activity)
    .eq('equipment', q.equipment)
    .eq('units', q.units)
    .eq('result_units', q.resultUnits)
    .order('performed_on', { ascending: true })

  if (error) throw error
  const rows = (data ?? []).filter(r => r.time_result)
  return rows.map(r => ({
    id: r.id,
    performedOn: r.performed_on,
    timeResult: r.time_result!,
    timeSeconds: intervalToSeconds(r.time_result)
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
