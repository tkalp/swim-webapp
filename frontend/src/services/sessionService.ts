// services/sessionService.ts
import { supabase } from '../lib/supabase'

export type TrainingSession = {
  id: string
  squad_id: string
  start_date: string
  end_date: string
  training_type: string
  workout_id?: string | null
  created_at?: string
  created_by?: string | null
}

export type CreateSessionData = {
  squad_id: string
  start_date: string
  end_date: string
  training_type: string
  workout_id?: string | null
}

export type UpdateSessionData = Partial<Omit<CreateSessionData, 'squad_id'>>

export type TrainingSchedule = {
  id: string
  squad_id: string
  day_of_week: string // 'Sunday', 'Monday', 'Tuesday', etc.
  start_time: string
  end_time: string
  training_type: string
  active: boolean
}

/**
 * Create a new training session
 */
export async function createSession(data: CreateSessionData): Promise<TrainingSession> {
  console.log('Creating session with payload:', data)
  
  const { data: session, error } = await supabase
    .from('training_sessions')
    .upsert(data, {
      onConflict: 'squad_id, start_date',
      ignoreDuplicates: false,
    })
    .select()
    .single()

  if (error) {
    console.error('Error creating training session:', error)
    console.error('Failed payload was:', data)
    throw error
  }
  return session
}

/**
 * Update an existing training session
 */
export async function updateSession(
  sessionId: string,
  updates: UpdateSessionData
): Promise<TrainingSession> {
  const { data: session, error } = await supabase
    .from('training_sessions')
    .update(updates)
    .eq('id', sessionId)
    .select()
    .single()

  if (error) throw error
  return session
}

/**
 * Delete a training session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from('training_sessions')
    .delete()
    .eq('id', sessionId)

  if (error) throw error
}

/**
 * Get training schedules for a squad
 */
export async function getTrainingSchedules(squadId: string): Promise<TrainingSchedule[]> {
  const { data, error } = await supabase
    .from('training_schedules')
    .select('id, squad_id, day_of_week, start_time, end_time, training_type, active')
    .eq('squad_id', squadId)
    .eq('active', true)
    .order('day_of_week')

  if (error) throw error
  return data ?? []
}

/**
 * Create sessions from a training schedule for a specific date
 */
export async function createSessionFromSchedule(
  schedule: TrainingSchedule,
  date: Date,
  squadId: string
): Promise<TrainingSession> {
  // Combine date with time from schedule
  const startDateTime = new Date(date)
  const [startHours, startMinutes] = schedule.start_time.split(':').map(Number)
  startDateTime.setHours(startHours, startMinutes, 0, 0)

  const endDateTime = new Date(date)
  const [endHours, endMinutes] = schedule.end_time.split(':').map(Number)
  endDateTime.setHours(endHours, endMinutes, 0, 0)

  const sessionData = {
    squad_id: squadId,
    start_date: startDateTime.toISOString(),
    end_date: endDateTime.toISOString(),
    training_type: schedule.training_type,
  }

  console.log('Creating session with data:', sessionData)
  return createSession(sessionData)
}

/**
 * Create sessions for all schedules over the next period (default 7 days)
 */
export async function createSessionsFromSchedules(
  schedules: TrainingSchedule[],
  startDate: Date = new Date(),
  daysToCreate: number = 7,
  squadId: string
): Promise<{ created: TrainingSession[], errors: Array<{ schedule: TrainingSchedule, date: Date, error: any }> }> {
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
  const created: TrainingSession[] = []
  const errors: Array<{ schedule: TrainingSchedule, date: Date, error: any }> = []

  // For each day in the period
  for (let dayOffset = 0; dayOffset < daysToCreate; dayOffset++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayOffset)
    const dayOfWeekNumber = currentDate.getDay()
    const dayOfWeekString = DAY_NAMES[dayOfWeekNumber]

    // Find schedules for this day
    const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeekString)

    // Create session for each schedule on this day
    for (const schedule of daySchedules) {
      try {
        const session = await createSessionFromSchedule(schedule, currentDate, squadId)
        console.log(session)
        created.push(session)
      } catch (error) {
        errors.push({ schedule, date: currentDate, error })
      }
    }
  }

  return { created, errors }
}
