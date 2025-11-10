// services/workoutResultService.ts
import { supabase } from '../lib/supabase'

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
  // First get all swimmers in the squad
  const { data: swimmers, error: swimmersError } = await supabase
    .from('swimmers')
    .select('id, first_name, last_name')
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
        result_count: data.count
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
 * Format seconds to display time
 */
export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = (seconds % 60).toFixed(2)
  return `${mins}:${secs.padStart(5, '0')}`
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
