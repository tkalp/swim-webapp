import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  createSession,
  updateSession,
  deleteSession,
  createSessionFromSchedule
} from '../sessionService'
import { apiClient } from '@/lib/apiClient'

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

      vi.mocked(apiClient.post).mockResolvedValue(mockSession)

      const result = await createSession(createData)

      expect(result).toEqual(mockSession)
      expect(apiClient.post).toHaveBeenCalledWith('/training-sessions/sessions', createData)
    })

    it('should throw error on creation failure', async () => {
      const createData = {
        squad_id: 'squad-1',
        start_date: '2024-01-15T17:00:00Z',
        end_date: '2024-01-15T18:00:00Z',
        training_type: 'Swim'
      }

      vi.mocked(apiClient.post).mockRejectedValue(new Error('Creation failed'))

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

      vi.mocked(apiClient.put).mockResolvedValue(mockUpdatedSession)

      const result = await updateSession('session-1', updates)

      expect(result).toEqual(mockUpdatedSession)
      expect(apiClient.put).toHaveBeenCalledWith('/training-sessions/sessions/session-1', updates)
    })

    it('should throw error on update failure', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('Update failed'))

      await expect(updateSession('session-1', { training_type: 'Technique' })).rejects.toThrow()
    })
  })

  describe('deleteSession', () => {
    it('should delete a session', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      await expect(deleteSession('session-1')).resolves.toBeUndefined()
      expect(apiClient.delete).toHaveBeenCalledWith('/training-sessions/sessions/session-1')
    })

    it('should throw error on deletion failure', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('Delete failed'))

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

      vi.mocked(apiClient.post).mockResolvedValue(mockSession)

      const result = await createSessionFromSchedule(mockSchedule, date, squadId)

      expect(result).toBeDefined()
      expect(result.training_type).toBe('Swim')
      expect(apiClient.post).toHaveBeenCalledWith('/training-sessions/sessions', expect.objectContaining({
        squad_id: 'squad-1',
        training_type: 'Swim',
      }))
    })
  })
})
