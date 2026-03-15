// services/sessionService.ts
import { apiClient } from '@/lib/apiClient'

export type TrainingSession = {
  id: string
  squad_id: string
  start_date: string
  end_date: string
  training_type: string
  workout_id?: string | null
  created_at?: string
  created_by?: string | null
  is_virtual?: boolean
}

export type VirtualSessionsResponse = {
  sessions: TrainingSession[]
  materialized_count: number
  virtual_count: number
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
  day_of_week: number // 0=Sunday, 1=Monday, ..., 6=Saturday (integer from DB)
  start_time: string
  end_time: string
  training_type: string
  active: boolean
}

/**
 * Get virtual + materialized sessions for a squad from the virtual sessions endpoint.
 * Virtual sessions have IDs like "virtual_{squad_id}_{timestamp}" and is_virtual=true.
 */
export async function getVirtualSessions(
  squadId: string,
  fromDate?: string,
  toDate?: string
): Promise<VirtualSessionsResponse> {
  const params = new URLSearchParams({ squad_id: squadId })
  if (fromDate) params.append('from_date', fromDate)
  if (toDate) params.append('to_date', toDate)
  return apiClient.get<VirtualSessionsResponse>(`/training-sessions/virtual?${params}`)
}

/**
 * Create a new training session
 */
export async function createSession(data: CreateSessionData): Promise<TrainingSession> {
  console.log('Creating session with payload:', data)
  return apiClient.post<TrainingSession>('/training-sessions/sessions', data)
}

/**
 * Update an existing training session
 */
export async function updateSession(
  sessionId: string,
  updates: UpdateSessionData
): Promise<TrainingSession> {
  return apiClient.put<TrainingSession>(`/training-sessions/sessions/${sessionId}`, updates)
}

/**
 * Delete a training session
 */
export async function deleteSession(sessionId: string): Promise<void> {
  await apiClient.delete(`/training-sessions/sessions/${sessionId}`)
}

/**
 * Get training schedules for a squad
 */
export async function getTrainingSchedules(squadId: string): Promise<TrainingSchedule[]> {
  return apiClient.get<TrainingSchedule[]>(`/training-schedules?squad_id=${squadId}&active_only=true`)
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
  const created: TrainingSession[] = []
  const errors: Array<{ schedule: TrainingSchedule, date: Date, error: any }> = []

  // For each day in the period
  for (let dayOffset = 0; dayOffset < daysToCreate; dayOffset++) {
    const currentDate = new Date(startDate)
    currentDate.setDate(currentDate.getDate() + dayOffset)
    const dayOfWeekNumber = currentDate.getDay() // 0=Sunday, 1=Monday, ..., 6=Saturday

    // Find schedules for this day (DB stores day_of_week as integer)
    const daySchedules = schedules.filter(s => s.day_of_week === dayOfWeekNumber)

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
