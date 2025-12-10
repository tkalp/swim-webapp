// services/squadService.ts
import { supabase } from '@/lib/supabase'
import { API_BASE_URL } from '@/lib/api'
import { authenticatedFetch } from '@/lib/apiClient'

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
 * Joins coach_squads to get the coach's role and counts swimmers.
 */
export async function getSquadsForCoach(coachId: string): Promise<SquadCard[]> {
  // Get the squad memberships w/ roles
  const { data: memberships, error: mErr } = await supabase
    .from('coach_squads')
    .select('squad_id, role, squads!inner(id, name, description, created_at)')
    .eq('coach_id', coachId)

  if (mErr) {
    console.error('Error fetching squad memberships:', mErr)
    throw new Error(`Failed to fetch squads: ${mErr.message}`)
  }
  
  if (!memberships?.length) return []

  // Flatten result
  const base: SquadCard[] = memberships.map((m: any) => ({
    id: m.squads.id,
    name: m.squads.name,
    description: m.squads.description,
    created_at: m.squads.created_at,
    role: m.role,
    swimmers_count: 0,
  }))

  // Count swimmers per squad
  const squadIds = base.map(s => s.id)
  const { data: counts, error: cErr } = await supabase
    .from('swimmers')
    .select('squad_id', { count: 'exact', head: false })
    .in('squad_id', squadIds)

  if (cErr) {
    console.error('Error counting swimmers:', cErr)
    throw new Error(`Failed to count swimmers: ${cErr.message}`)
  }

  // Aggregate swimmer counts
  const map = new Map<string, number>()
  counts?.forEach((row: any) => {
    const k = row.squad_id as string
    map.set(k, (map.get(k) ?? 0) + 1)
  })

  return base.map(s => ({ ...s, swimmers_count: map.get(s.id) ?? 0 }))
}

/**
 * Get a single squad by ID
 */
export async function getSquadById(squadId: string): Promise<Squad | null> {
  const { data, error } = await supabase
    .from('squads')
    .select('*')
    .eq('id', squadId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('Error fetching squad:', error)
    throw new Error(`Failed to fetch squad: ${error.message}`)
  }

  return data
}

/**
 * Create a new squad
 */
export async function createSquad(coachId: string, squadData: CreateSquadData): Promise<Squad> {
  console.log('Creating squad with coachId:', coachId, 'data:', squadData)
  
  // Include coach_id in the squad data for the database trigger
  const { data: squad, error: squadError } = await supabase
    .from('squads')
    .insert([{ ...squadData, coach_id: coachId }])
    .select()
    .single()

  if (squadError) {
    console.error('Error creating squad:', squadError)
    throw new Error(`Failed to create squad: ${squadError.message}`)
  }

  console.log('Squad created successfully:', squad)
  
  return squad
}

/**
 * Update an existing squad
 */
export async function updateSquad(squadId: string, updates: UpdateSquadData): Promise<Squad> {
  const { data, error } = await supabase
    .from('squads')
    .update(updates)
    .eq('id', squadId)
    .select()
    .single()

  if (error) {
    console.error('Error updating squad:', error)
    throw new Error(`Failed to update squad: ${error.message}`)
  }

  return data
}

/**
 * Delete a squad
 */
export async function deleteSquad(squadId: string): Promise<void> {
  // First delete all coach_squads memberships
  const { error: membershipError } = await supabase
    .from('coach_squads')
    .delete()
    .eq('squad_id', squadId)

  if (membershipError) {
    console.error('Error deleting squad memberships:', membershipError)
    throw new Error(`Failed to delete squad memberships: ${membershipError.message}`)
  }

  // Then delete the squad itself
  const { error: squadError } = await supabase
    .from('squads')
    .delete()
    .eq('id', squadId)

  if (squadError) {
    console.error('Error deleting squad:', squadError)
    throw new Error(`Failed to delete squad: ${squadError.message}`)
  }
}

/**
 * Check if a squad exists
 */
export async function squadExists(squadId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('squads')
    .select('id')
    .eq('id', squadId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return false
    }
    console.error('Error checking squad existence:', error)
    throw new Error(`Failed to check squad existence: ${error.message}`)
  }

  return !!data
}

/**
 * Get total squads count for a coach
 */
export async function getSquadsCountForCoach(coachId: string): Promise<number> {
  const { count, error } = await supabase
    .from('coach_squads')
    .select('*', { count: 'exact', head: true })
    .eq('coach_id', coachId)

  if (error) {
    console.error('Error getting squads count:', error)
    throw new Error(`Failed to get squads count: ${error.message}`)
  }

  return count || 0
}

/**
 * Get swimmers for a squad
 */
export async function getSquadSwimmers(squadId: string) {
  const { data, error } = await supabase
    .from('swimmers')
    .select('*')
    .eq('squad_id', squadId)
    .order('last_name', { ascending: true })
  
  if (error) throw error
  return data || []
}

/**
 * Get training schedules for a squad
 */
export async function getSquadSchedules(squadId: string) {
  const { data, error } = await supabase
    .from('training_schedules')
    .select('id, day_of_week, start_time, end_time, active, training_type')
    .eq('squad_id', squadId)
    .eq('active', true)
    .order('day_of_week')
  
  if (error) throw error
  return data ?? []
}

/**
 * Get training sessions for a squad
 */
export async function getSquadSessions(squadId: string, fromISO?: string, toISO?: string) {
  const from = fromISO ?? new Date(Date.now() - 1000*60*60*24*30).toISOString()
  const to = toISO ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString()
  
  const { data, error } = await supabase
    .from('training_sessions')
    .select('id, start_date, end_date, training_type, workout_id, created_at, workout_template(name)')
    .eq('squad_id', squadId)
    .gte('start_date', from)
    .lte('start_date', to)
    .order('start_date', { ascending: false })
  
  if (error) throw error
  return data ?? []
}

/**
 * Get calendar events for a squad
 */
export async function getSquadCalendarEvents(squadId: string, fromISO?: string, toISO?: string) {
  const from = fromISO ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const to = toISO ?? new Date(new Date().getFullYear(), new Date().getMonth()+1, 0, 23,59,59).toISOString()
  
  const { data, error } = await supabase
    .from('calendar_event')
    .select('id, name, start_date, end_date, event_type')
    .eq('squad_id', squadId)
    .gte('start_date', from)
    .lte('start_date', to)
    .order('start_date')
  
  if (error) throw error
  return data ?? []
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

