import { getApiUrl } from '@/lib/api'
import { authenticatedFetch } from '@/lib/apiClient'

// ============================================
// TYPES
// ============================================

export type SquadAttendance = { present: number; late: number; absent: number }
export type WeekDistance = { week: string; meters: number }
export type DayDistance = { day: string; meters: number }
export type StrokeBreakdown = { stroke: string; meters: number; color: string }
export type ActivityBreakdown = { activity: string; meters: number; color: string }

export interface EventTimeline {
  date: string
  time: number
}

export interface EventSummary {
  event: string
  attempts: number
  first_time: number
  best_time: number
  latest_time: number
  improvement_pct: number
  personal_records: number
  activity?: string
  stroke?: string
  result_units?: string
  consistency_score?: number
  weighted_improvement_pct?: number
  trend_velocity_per_day?: number
  timeline: EventTimeline[]
}

export interface SwimmerPerformance {
  swimmer_id: string
  swimmer_name: string
  total_workouts: number
  events_analyzed: number
  personal_records: number
  avg_improvement_pct: number
  best_improvement_pct: number
  consistency_score?: number
  weighted_improvement_pct?: number
  trend_velocity_per_day?: number
  events: EventSummary[]
}

export interface SquadSummary {
  total_swimmers: number
  avg_improvement: number
  avg_consistency_score?: number
  // NEW: Robust weighted improvement metrics
  median_weighted_improvement?: number
  swimmers_improving_count?: number
  swimmers_stable_count?: number
  swimmers_regressing_count?: number
  percent_improving?: number
  // DEPRECATED: Use median_weighted_improvement instead
  avg_weighted_improvement?: number
  avg_trend_velocity_per_day?: number
  total_prs: number
  most_improved: {
    swimmer_id: string
    swimmer_name: string
    improvement_pct: number
    consistency_score?: number
  } | null
}

export interface SquadPerformanceData {
  squad: {
    id: string
    name: string
  }
  date_range: {
    start: string
    end: string
  }
  swimmers: SwimmerPerformance[]
  summary: SquadSummary
}

// ============================================
// SQUAD METRICS FUNCTIONS (Backend API)
// ============================================

export async function getSquadSessionCount(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<number> {
  try {
    const params = new URLSearchParams()
    if (range?.from) params.append('start_date', range.from)
    if (range?.to) params.append('end_date', range.to)

    const url = getApiUrl(`squads/${squadId}/metrics/session-count?${params.toString()}`)
    const response = await authenticatedFetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch session count: ${response.statusText}`)
    }

    const data = await response.json()
    return data.count || 0
  } catch (error) {
    console.error('Error fetching session count:', error)
    return 0
  }
}

export async function getSquadTotalMeters(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<number> {
  try {
    const params = new URLSearchParams()
    if (range?.from) params.append('start_date', range.from)
    if (range?.to) params.append('end_date', range.to)

    const url = getApiUrl(`squads/${squadId}/metrics/total-meters?${params.toString()}`)
    const response = await authenticatedFetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch total meters: ${response.statusText}`)
    }

    const data = await response.json()
    return data.total_meters || 0
  } catch (error) {
    console.error('Error fetching total meters:', error)
    return 0
  }
}

export async function getSquadAttendanceStats(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<SquadAttendance> {
  try {
    const params = new URLSearchParams()
    if (range?.from) params.append('start_date', range.from)
    if (range?.to) params.append('end_date', range.to)

    const url = getApiUrl(`squads/${squadId}/metrics/attendance-stats?${params.toString()}`)
    const response = await authenticatedFetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch attendance stats: ${response.statusText}`)
    }

    const data = await response.json()
    return {
      present: data.present || 0,
      late: data.late || 0,
      absent: data.absent || 0
    }
  } catch (error) {
    console.error('Error fetching attendance stats:', error)
    return { present: 0, late: 0, absent: 0 }
  }
}

export async function getSquadDistancePerWeek(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<WeekDistance[]> {
  try {
    const params = new URLSearchParams()
    if (range?.from) params.append('start_date', range.from)
    if (range?.to) params.append('end_date', range.to)

    const url = getApiUrl(`squads/${squadId}/metrics/distance-per-week?${params.toString()}`)
    const response = await authenticatedFetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch distance per week: ${response.statusText}`)
    }

    const data = await response.json()
    return data.weeks || []
  } catch (error) {
    console.error('Error fetching distance per week:', error)
    return []
  }
}

export async function getSquadDistancePerDay(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<DayDistance[]> {
  try {
    const params = new URLSearchParams()
    if (range?.from) params.append('start_date', range.from)
    if (range?.to) params.append('end_date', range.to)
    
    // Add timezone offset so backend can group by local date
    const timezoneOffset = new Date().getTimezoneOffset()
    params.append('timezone_offset', timezoneOffset.toString())

    const url = getApiUrl(`squads/${squadId}/metrics/distance-per-day?${params.toString()}`)
    const response = await authenticatedFetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch distance per day: ${response.statusText}`)
    }

    const data = await response.json()
    return data.days || []
  } catch (error) {
    console.error('Error fetching distance per day:', error)
    return []
  }
}

export async function getSquadStrokeBreakdown(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<StrokeBreakdown[]> {
  try {
    const params = new URLSearchParams()
    if (range?.from) params.append('start_date', range.from)
    if (range?.to) params.append('end_date', range.to)

    const url = getApiUrl(`squads/${squadId}/metrics/stroke-breakdown?${params.toString()}`)
    const response = await authenticatedFetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch stroke breakdown: ${response.statusText}`)
    }

    const data = await response.json()
    return data.strokes || []
  } catch (error) {
    console.error('Error fetching stroke breakdown:', error)
    return []
  }
}

export async function getSquadActivityBreakdown(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<ActivityBreakdown[]> {
  try {
    const params = new URLSearchParams()
    if (range?.from) params.append('start_date', range.from)
    if (range?.to) params.append('end_date', range.to)

    const url = getApiUrl(`squads/${squadId}/metrics/activity-breakdown?${params.toString()}`)
    const response = await authenticatedFetch(url)

    if (!response.ok) {
      throw new Error(`Failed to fetch activity breakdown: ${response.statusText}`)
    }

    const data = await response.json()
    return data.activities || []
  } catch (error) {
    console.error('Error fetching activity breakdown:', error)
    return []
  }
}

// ============================================
// SQUAD PERFORMANCE ANALYTICS (Backend API)
// ============================================

export async function getSquadPerformance(
  squadId: string,
  startDate?: string,
  endDate?: string
): Promise<SquadPerformanceData> {
  const params = new URLSearchParams()
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)

  const url = getApiUrl(`squads/${squadId}/performance?${params.toString()}`)

  const response = await authenticatedFetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch squad performance: ${response.statusText}`)
  }

  return response.json()
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

export function formatTimeFromSeconds(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60)
    const secs = (seconds % 60).toFixed(2)
    return `${mins}:${secs.padStart(5, '0')}`
  }
  return seconds.toFixed(2)
}

export function parseEventKey(eventKey: string): {
  distance: string
  stroke: string
  activity: string
  equipment?: string
} {
  // Format: "100Y_freestyle_swim" or "50M_freestyle_swim_fins"
  const parts = eventKey.split('_')
  const distance = parts[0]
  const stroke = parts[1]
  const activity = parts[2]
  const equipment = parts[3]

  return { distance, stroke, activity, equipment }
}

/** YYYY-Wxx (ISO 8601 week) */
function getWeekKey(d: Date) {
  const { year, week } = getISOWeek(d)
  return `${year}-W${String(week).padStart(2, '0')}`
}

function getISOWeek(date: Date): { year: number; week: number } {
  // Create a copy to avoid mutating the original date
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  
  // Set to nearest Thursday: current date + 4 - current day number
  // Make Sunday's day number 7
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  
  // Get first day of year
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  
  // Calculate full weeks to nearest Thursday
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7)
  
  // Return ISO week year and week number
  return {
    year: d.getUTCFullYear(),
    week: weekNo
  }
}

// Keep old function for backwards compatibility if needed elsewhere
function getWeekNumber(d: Date) {
  return getISOWeek(d).week
}

/** Converts 2025-W02 → { start: Date, end: Date, label: 'Jan 6–12, 2025' } */
function parseWeekKey(key: string) {
  const [yearStr, weekStr] = key.split('-W')
  const year = parseInt(yearStr, 10)
  const week = parseInt(weekStr, 10)

  // ISO 8601: Week 1 is the week containing the first Thursday
  // Find January 4th (always in week 1), then find that week's Monday
  const jan4 = new Date(year, 0, 4)
  const jan4Day = jan4.getDay() || 7 // Make Sunday = 7
  
  // Get Monday of week 1
  const week1Monday = new Date(year, 0, 4 - jan4Day + 1)
  
  // Add (week - 1) weeks to get to our target week's Monday
  const ISOStart = new Date(week1Monday)
  ISOStart.setDate(week1Monday.getDate() + (week - 1) * 7)
  
  // End is 6 days later (Sunday)
  const ISOEnd = new Date(ISOStart)
  ISOEnd.setDate(ISOStart.getDate() + 6)

  const label = formatRange(ISOStart, ISOEnd)
  return { start: ISOStart, end: ISOEnd, label }
}

/** "Jan 6–12, 2025" style */
function formatRange(start: Date, end: Date) {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const year = start.getFullYear()
  const sameMonth = start.getMonth() === end.getMonth()
  const range =
    sameMonth
      ? `${fmt(start).split(' ')[1]}–${end.getDate()}, ${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      : `${fmt(start)} – ${fmt(end)}, ${year}`
  return range
}
