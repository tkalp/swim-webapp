// services/scheduleService.ts
import { supabase } from '@/lib/supabase'

export type TrainingSchedule = {
  id: string
  squad_id: string
  day_of_week: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'
  start_time: string
  end_time: string
  training_type: 'Swim' | 'Dryland'
  active: boolean
  until?: string | null
  created_at?: string
}

export type CreateScheduleData = {
  squad_id: string
  day_of_week: 'Sunday' | 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday'
  start_time: string
  end_time: string
  training_type: 'Swim' | 'Dryland'
  active?: boolean
  until?: string | null
}

export type UpdateScheduleData = Partial<Omit<CreateScheduleData, 'squad_id'>>

/**
 * Create a new training schedule
 */
export async function createSchedule(data: CreateScheduleData): Promise<TrainingSchedule> {
  const { data: schedule, error } = await supabase
    .from('training_schedules')
    .insert([{ active: true, ...data }])
    .select()
    .single()

  if (error) throw error
  return schedule
}

/**
 * Update an existing training schedule
 */
export async function updateSchedule(
  scheduleId: string,
  updates: UpdateScheduleData
): Promise<TrainingSchedule> {
  const { data: schedule, error } = await supabase
    .from('training_schedules')
    .update(updates)
    .eq('id', scheduleId)
    .select()
    .single()

  if (error) throw error
  return schedule
}

/**
 * Delete a training schedule
 */
export async function deleteSchedule(scheduleId: string): Promise<void> {
  const { error } = await supabase
    .from('training_schedules')
    .delete()
    .eq('id', scheduleId)

  if (error) throw error
}

/**
 * Deactivate a schedule (soft delete)
 */
export async function deactivateSchedule(scheduleId: string): Promise<TrainingSchedule> {
  return updateSchedule(scheduleId, { active: false })
}
