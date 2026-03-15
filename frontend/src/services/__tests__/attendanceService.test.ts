import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getAttendanceBySession,
  getAttendanceBySwimmer,
  upsertAttendance,
  bulkUpsertAttendance,
  deleteAttendance,
  getSessionAttendanceWithSwimmers,
  type AttendanceStatus
} from '../attendanceService'
import { apiClient } from '@/lib/apiClient'

describe('attendanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getAttendanceBySession', () => {
    it('should return attendance records for a session', async () => {
      const mockAttendance = [
        {
          id: 'att-1',
          training_session_id: 'session-1',
          swimmer_id: 'swimmer-1',
          status: 'present',
          created_at: '2024-01-15'
        }
      ]

      vi.mocked(apiClient.get).mockResolvedValue(mockAttendance)

      const result = await getAttendanceBySession('session-1')

      expect(result).toEqual(mockAttendance)
      expect(apiClient.get).toHaveBeenCalledWith('/attendance/session/session-1')
    })

    it('should return empty array when no attendance found', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([])

      const result = await getAttendanceBySession('session-1')

      expect(result).toEqual([])
    })

    it('should throw error on fetch failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch attendance'))

      await expect(getAttendanceBySession('session-1')).rejects.toThrow('Failed to fetch attendance')
    })
  })

  describe('getAttendanceBySwimmer', () => {
    it('should return attendance records for a swimmer', async () => {
      const mockAttendance = [
        {
          id: 'att-1',
          training_session_id: 'session-1',
          swimmer_id: 'swimmer-1',
          status: 'present',
          created_at: '2024-01-15'
        }
      ]

      vi.mocked(apiClient.get).mockResolvedValue(mockAttendance)

      const result = await getAttendanceBySwimmer('swimmer-1')

      expect(result).toEqual(mockAttendance)
      expect(apiClient.get).toHaveBeenCalledWith('/attendance/swimmer/swimmer-1')
    })

    it('should filter by date range when provided', async () => {
      const mockAttendance = [
        {
          id: 'att-1',
          training_session_id: 'session-1',
          swimmer_id: 'swimmer-1',
          status: 'present',
          created_at: '2024-01-15'
        }
      ]

      vi.mocked(apiClient.get).mockResolvedValue(mockAttendance)

      const result = await getAttendanceBySwimmer('swimmer-1', {
        from: '2024-01-01',
        to: '2024-01-31'
      })

      expect(result).toEqual(mockAttendance)
      expect(apiClient.get).toHaveBeenCalledWith(
        '/attendance/swimmer/swimmer-1?from_date=2024-01-01&to_date=2024-01-31'
      )
    })

    it('should throw error on fetch failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch swimmer attendance'))

      await expect(getAttendanceBySwimmer('swimmer-1')).rejects.toThrow('Failed to fetch swimmer attendance')
    })
  })

  describe('upsertAttendance', () => {
    it('should create or update an attendance record', async () => {
      const mockAttendance = {
        id: 'att-1',
        training_session_id: 'session-1',
        swimmer_id: 'swimmer-1',
        status: 'present' as AttendanceStatus,
        notes: 'Good session',
        created_at: '2024-01-15'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockAttendance)

      const result = await upsertAttendance('session-1', 'swimmer-1', 'present', 'Good session')

      expect(result).toEqual(mockAttendance)
      expect(apiClient.post).toHaveBeenCalledWith('/attendance/upsert', {
        training_session_id: 'session-1',
        swimmer_id: 'swimmer-1',
        status: 'present',
        notes: 'Good session',
      })
    })

    it('should throw error on upsert failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Failed to save attendance'))

      await expect(upsertAttendance('session-1', 'swimmer-1', 'present')).rejects.toThrow('Failed to save attendance')
    })
  })

  describe('bulkUpsertAttendance', () => {
    it('should bulk upsert multiple attendance records', async () => {
      const records = [
        { swimmer_id: 'swimmer-1', status: 'present' as AttendanceStatus },
        { swimmer_id: 'swimmer-2', status: 'late' as AttendanceStatus }
      ]

      const mockAttendance = [
        {
          id: 'att-1',
          training_session_id: 'session-1',
          swimmer_id: 'swimmer-1',
          status: 'present',
          created_at: '2024-01-15'
        },
        {
          id: 'att-2',
          training_session_id: 'session-1',
          swimmer_id: 'swimmer-2',
          status: 'late',
          created_at: '2024-01-15'
        }
      ]

      vi.mocked(apiClient.post).mockResolvedValue(mockAttendance)

      const result = await bulkUpsertAttendance('session-1', records)

      expect(result).toHaveLength(2)
      expect(result).toEqual(mockAttendance)
      expect(apiClient.post).toHaveBeenCalledWith('/attendance/bulk-upsert', {
        session_id: 'session-1',
        records,
      })
    })

    it('should throw error on bulk upsert failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Failed to save attendance records'))

      await expect(bulkUpsertAttendance('session-1', [])).rejects.toThrow('Failed to save attendance records')
    })
  })

  describe('deleteAttendance', () => {
    it('should delete an attendance record', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      await expect(deleteAttendance('att-1')).resolves.toBeUndefined()
      expect(apiClient.delete).toHaveBeenCalledWith('/attendance/att-1')
    })

    it('should throw error on deletion failure', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('Failed to delete attendance'))

      await expect(deleteAttendance('att-1')).rejects.toThrow()
    })
  })

  describe('getSessionAttendanceWithSwimmers', () => {
    it('should return swimmers with attendance data', async () => {
      const mockResult = {
        swimmers: [
          { id: 'swimmer-1', first_name: 'John', last_name: 'Doe', status: 'present' },
          { id: 'swimmer-2', first_name: 'Jane', last_name: 'Smith', status: null }
        ],
        summary: { total: 2, present: 1, late: 0, absent: 0, not_recorded: 1 }
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockResult)

      const result = await getSessionAttendanceWithSwimmers('session-1', 'squad-1')

      expect(result.swimmers).toHaveLength(2)
      expect(apiClient.get).toHaveBeenCalledWith(
        '/attendance/session/session-1/with-swimmers?squad_id=squad-1'
      )
    })

    it('should throw error when fetching fails', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch swimmers'))

      await expect(getSessionAttendanceWithSwimmers('session-1', 'squad-1')).rejects.toThrow('Failed to fetch swimmers')
    })
  })
})
