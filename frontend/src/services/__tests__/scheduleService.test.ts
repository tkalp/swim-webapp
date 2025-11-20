import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createSchedule,
  updateSchedule,
  deleteSchedule,
  deactivateSchedule,
  type CreateScheduleData
} from '../scheduleService'
import { supabase } from '@/lib/supabase'

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

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSchedule, error: null })
      } as any)

      const result = await createSchedule(createData)

      expect(result).toEqual(mockSchedule)
      expect(supabase.from).toHaveBeenCalledWith('training_schedules')
    })

    it('should throw error on creation failure', async () => {
      const createData: CreateScheduleData = {
        squad_id: 'squad-1',
        day_of_week: 'Tuesday',
        start_time: '18:00',
        end_time: '19:00',
        training_type: 'Dryland'
      }

      const mockError = { message: 'Creation failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

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

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedSchedule, error: null })
      } as any)

      const result = await updateSchedule('schedule-1', updates)

      expect(result).toEqual(mockUpdatedSchedule)
    })

    it('should throw error on update failure', async () => {
      const mockError = { message: 'Update failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(updateSchedule('schedule-1', { start_time: '17:30' })).rejects.toThrow()
    })
  })

  describe('deleteSchedule', () => {
    it('should delete a schedule', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      } as any)

      await expect(deleteSchedule('schedule-1')).resolves.toBeUndefined()
    })

    it('should throw error on deletion failure', async () => {
      const mockError = { message: 'Delete failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: mockError })
      } as any)

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

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockDeactivatedSchedule, error: null })
      } as any)

      const result = await deactivateSchedule('schedule-1')

      expect(result).toEqual(mockDeactivatedSchedule)
      expect(result.active).toBe(false)
    })
  })
})
