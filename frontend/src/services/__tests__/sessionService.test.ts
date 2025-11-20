import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createSession,
  updateSession,
  deleteSession,
  createSessionFromSchedule
} from '../sessionService'
import { supabase } from '../../lib/supabase'

describe('sessionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('createSession', () => {
    it('should create a new session', async () => {
      const createData = {
        squad_id: 'squad-1',
        start_date: '2024-01-15T17:00:00Z',
        end_date: '2024-01-15T18:00:00Z',
        training_type: 'Swim'
      }

      const mockSession = {
        id: 'session-1',
        ...createData,
        created_at: '2024-01-01'
      }

      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSession, error: null })
      } as any)

      const result = await createSession(createData)

      expect(result).toEqual(mockSession)
      expect(supabase.from).toHaveBeenCalledWith('training_sessions')
    })

    it('should throw error on creation failure', async () => {
      const createData = {
        squad_id: 'squad-1',
        start_date: '2024-01-15T17:00:00Z',
        end_date: '2024-01-15T18:00:00Z',
        training_type: 'Swim'
      }

      const mockError = { message: 'Creation failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(createSession(createData)).rejects.toThrow()
    })
  })

  describe('updateSession', () => {
    it('should update a session', async () => {
      const updates = { training_type: 'Technique' }
      const mockUpdatedSession = {
        id: 'session-1',
        squad_id: 'squad-1',
        start_date: '2024-01-15T17:00:00Z',
        end_date: '2024-01-15T18:00:00Z',
        training_type: 'Technique'
      }

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedSession, error: null })
      } as any)

      const result = await updateSession('session-1', updates)

      expect(result).toEqual(mockUpdatedSession)
    })

    it('should throw error on update failure', async () => {
      const mockError = { message: 'Update failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(updateSession('session-1', { training_type: 'Technique' })).rejects.toThrow()
    })
  })

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      } as any)

      await expect(deleteSession('session-1')).resolves.toBeUndefined()
    })

    it('should throw error on deletion failure', async () => {
      const mockError = { message: 'Delete failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: mockError })
      } as any)

      await expect(deleteSession('session-1')).rejects.toThrow()
    })
  })

  describe('createSessionFromSchedule', () => {
    it('should create session from schedule', async () => {
      const mockSchedule = {
        id: 'schedule-1',
        squad_id: 'squad-1',
        day_of_week: 'Monday',
        start_time: '17:00',
        end_time: '18:00',
        training_type: 'Swim',
        active: true
      }

      const date = new Date('2024-01-15')
      const squadId = 'squad-1'

      const mockSession = {
        id: 'session-1',
        squad_id: 'squad-1',
        start_date: '2024-01-15T17:00:00Z',
        end_date: '2024-01-15T18:00:00Z',
        training_type: 'Swim'
      }

      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSession, error: null })
      } as any)

      const result = await createSessionFromSchedule(mockSchedule, date, squadId)

      expect(result).toBeDefined()
      expect(result.training_type).toBe('Swim')
    })
  })
})
