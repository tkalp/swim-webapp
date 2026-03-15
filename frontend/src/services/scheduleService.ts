// services/scheduleService.ts
import { apiClient } from '@/lib/apiClient'

export type TrainingSchedule = {
  id: string
  squad_id: string
  day_of_week: number // 0=Sunday, 1=Monday, ..., 6=Saturday (JS convention)
  start_time: string
  end_time: string
  training_type: string
  active: boolean
  until?: string | null
  created_at?: string
}

export type CreateScheduleData = {
  squad_id: string
  day_of_week: number // 0=Sunday, 1=Monday, ..., 6=Saturday
  start_time: string
  end_time: string
  training_type: string
  active?: boolean
  until?: string | null
}

export type UpdateScheduleData = Partial<Omit<CreateScheduleData, 'squad_id'>>

/**
 * Create a new training schedule
 */
export async function createSchedule(data: CreateScheduleData): Promise<TrainingSchedule> {
  return apiClient.post<TrainingSchedule>('/training-schedules', { active: true, ...data })
}

/**
 * Update an existing training schedule
 */
export async function updateSchedule(
  scheduleId: string,
  updates: UpdateScheduleData
): Promise<TrainingSchedule> {
  return apiClient.put<TrainingSchedule>(`/training-schedules/${scheduleId}`, updates)
}

/**
 * Delete a training schedule
 */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  await apiClient.delete(`/training-schedules/${scheduleId}`)
}

/**
 * Deactivate a schedule (soft delete)
 */
export async function deactivateSchedule(scheduleId: string): Promise<TrainingSchedule> {
  return updateSchedule(scheduleId, { active: false })
}
