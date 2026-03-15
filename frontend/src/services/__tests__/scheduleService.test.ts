import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  deactivateSchedule,
  type CreateScheduleData
} from '../scheduleService'
import { apiClient } from '@/lib/apiClient'

describe('scheduleService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSchedule', () => {
    it('should create a new schedule with active: true default', async () => {
      const createData: CreateScheduleData = {
        squad_id: 'squad-1',
        day_of_week: 'Monday',
        start_time: '17:00',
        end_time: '18:00',
        training_type: 'Swim'
      }

      const mockSchedule = {
        id: 'schedule-1',
        ...createData,
        active: true,
        created_at: '2024-01-01'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockSchedule)

      const result = await createSchedule(createData)

      expect(result).toEqual(mockSchedule)
      expect(apiClient.post).toHaveBeenCalledWith('/training-schedules', {
        active: true,
        ...createData,
      })
    })

    it('should throw error on creation failure', async () => {
      const createData: CreateScheduleData = {
        squad_id: 'squad-1',
        day_of_week: 'Tuesday',
        start_time: '18:00',
        end_time: '19:00',
        training_type: 'Dryland'
      }

      vi.mocked(apiClient.post).mockRejectedValue(new Error('Creation failed'))

      await expect(createSchedule(createData)).rejects.toThrow()
    })
  })

  describe('updateSchedule', () => {
    it('should update a schedule', async () => {
      const updates = { start_time: '17:30', training_type: 'Dryland' as const }
      const mockUpdatedSchedule = {
        id: 'schedule-1',
        squad_id: 'squad-1',
        day_of_week: 'Monday',
        start_time: '17:30',
        end_time: '18:00',
        training_type: 'Dryland',
        active: true
      }

      vi.mocked(apiClient.put).mockResolvedValue(mockUpdatedSchedule)

      const result = await updateSchedule('schedule-1', updates)

      expect(result).toEqual(mockUpdatedSchedule)
      expect(apiClient.put).toHaveBeenCalledWith('/training-schedules/schedule-1', updates)
    })

    it('should throw error on update failure', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('Update failed'))

      await expect(updateSchedule('schedule-1', { start_time: '17:30' })).rejects.toThrow()
    })
  })

  describe('deleteSchedule', () => {
    it('should delete a schedule', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      await expect(deleteSchedule('schedule-1')).resolves.toBeUndefined()
      expect(apiClient.delete).toHaveBeenCalledWith('/training-schedules/schedule-1')
    })

    it('should throw error on deletion failure', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('Delete failed'))

      await expect(deleteSchedule('schedule-1')).rejects.toThrow()
    })
  })

  describe('deactivateSchedule', () => {
    it('should deactivate a schedule by calling updateSchedule', async () => {
      const mockDeactivatedSchedule = {
        id: 'schedule-1',
        squad_id: 'squad-1',
        day_of_week: 'Monday',
        start_time: '17:00',
        end_time: '18:00',
        training_type: 'Swim',
        active: false
      }

      vi.mocked(apiClient.put).mockResolvedValue(mockDeactivatedSchedule)

      const result = await deactivateSchedule('schedule-1')

      expect(result).toEqual(mockDeactivatedSchedule)
      expect(result.active).toBe(false)
      expect(apiClient.put).toHaveBeenCalledWith('/training-schedules/schedule-1', { active: false })
    })
  })
})
