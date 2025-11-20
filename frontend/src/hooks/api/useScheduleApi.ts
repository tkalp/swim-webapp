import { useCallback } from 'react'
import { 
  createSchedule, 
  updateSchedule, 
  deleteSchedule,
  type CreateScheduleData,
  type UpdateScheduleData,
  type TrainingSchedule
} from '@/services/scheduleService'
import { getSquadSchedules } from '@/services/squadService'
import { useSquadStore } from '@/stores/squadStore'
import { useUIStore } from '@/stores/uiStore'

/**
 * Schedule API hooks with automatic store synchronization
 * Wraps existing Supabase service calls with store updates and toast notifications
 */
export const useScheduleApi = () => {
  const { setSchedules, addSchedule: addScheduleToStore, updateScheduleInStore, removeSchedule: removeScheduleFromStore } = useSquadStore()
  const { addToast } = useUIStore()

  /**
   * Fetch schedules for a squad and update store
   */
  const fetchSchedules = useCallback(async (squadId: string) => {
    try {
      const schedules = await getSquadSchedules(squadId)
      setSchedules(squadId, schedules)
      return schedules
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to fetch schedules', type: 'error' })
      throw error
    }
  }, [setSchedules, addToast])

  /**
   * Create a new schedule and update store
   */
  const createNewSchedule = useCallback(async (data: CreateScheduleData) => {
    try {
      const schedule = await createSchedule(data)
      
      // Add to store
      addScheduleToStore(data.squad_id, schedule)
      
      addToast({ message: 'Schedule created successfully', type: 'success' })
      return schedule
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to create schedule', type: 'error' })
      throw error
    }
  }, [addScheduleToStore, addToast])

  /**
   * Update an existing schedule and update store
   */
  const updateExistingSchedule = useCallback(async (scheduleId: string, squadId: string, updates: UpdateScheduleData) => {
    try {
      const schedule = await updateSchedule(scheduleId, updates)
      
      // Update in store
      updateScheduleInStore(squadId, scheduleId, schedule)
      
      addToast({ message: 'Schedule updated successfully', type: 'success' })
      return schedule
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to update schedule', type: 'error' })
      throw error
    }
  }, [updateScheduleInStore, addToast])

  /**
   * Delete a schedule and update store
   */
  const deleteExistingSchedule = useCallback(async (scheduleId: string, squadId: string) => {
    try {
      await deleteSchedule(scheduleId)
      
      // Remove from store
      removeScheduleFromStore(squadId, scheduleId)
      
      addToast({ message: 'Schedule deleted successfully', type: 'success' })
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to delete schedule', type: 'error' })
      throw error
    }
  }, [removeScheduleFromStore, addToast])

  return {
    fetchSchedules,
    createSchedule: createNewSchedule,
    updateSchedule: updateExistingSchedule,
    deleteSchedule: deleteExistingSchedule,
  }
}
