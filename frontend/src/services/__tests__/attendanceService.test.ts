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
import { supabase } from '../../lib/supabase'

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

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockAttendance, error: null })
      } as any)

      const result = await getAttendanceBySession('session-1')

      expect(result).toEqual(mockAttendance)
      expect(supabase.from).toHaveBeenCalledWith('training_attendance')
    })

    it('should return empty array when no attendance found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null })
      } as any)

      const result = await getAttendanceBySession('session-1')

      expect(result).toEqual([])
    })

    it('should throw error on fetch failure', async () => {
      const mockError = { message: 'Fetch failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

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

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockAttendance, error: null })
      } as any)

      const result = await getAttendanceBySwimmer('swimmer-1')

      expect(result).toEqual(mockAttendance)
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

      const gteMock = vi.fn().mockReturnThis()
      const lteMock = vi.fn().mockReturnThis()

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        gte: gteMock,
        lte: lteMock,
        order: vi.fn().mockResolvedValue({ data: mockAttendance, error: null })
      } as any)

      const result = await getAttendanceBySwimmer('swimmer-1', {
        from: '2024-01-01',
        to: '2024-01-31'
      })

      expect(result).toEqual(mockAttendance)
      expect(gteMock).toHaveBeenCalledWith('created_at', '2024-01-01')
      expect(lteMock).toHaveBeenCalledWith('created_at', '2024-01-31')
    })

    it('should throw error on fetch failure', async () => {
      const mockError = { message: 'Fetch failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

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

      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockAttendance, error: null })
      } as any)

      const result = await upsertAttendance('session-1', 'swimmer-1', 'present', 'Good session')

      expect(result).toEqual(mockAttendance)
    })

    it('should throw error on upsert failure', async () => {
      const mockError = { message: 'Upsert failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

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

      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: mockAttendance, error: null })
      } as any)

      const result = await bulkUpsertAttendance('session-1', records)

      expect(result).toHaveLength(2)
      expect(result).toEqual(mockAttendance)
    })

    it('should return empty array when data is null', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      const result = await bulkUpsertAttendance('session-1', [])

      expect(result).toEqual([])
    })

    it('should throw error on bulk upsert failure', async () => {
      const mockError = { message: 'Bulk upsert failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        upsert: vi.fn().mockReturnThis(),
        select: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(bulkUpsertAttendance('session-1', [])).rejects.toThrow('Failed to save attendance records')
    })
  })

  describe('deleteAttendance', () => {
    it('should delete an attendance record', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      } as any)

      await expect(deleteAttendance('att-1')).resolves.toBeUndefined()
    })

    it('should throw error on deletion failure', async () => {
      const mockError = { message: 'Delete failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: mockError })
      } as any)

      await expect(deleteAttendance('att-1')).rejects.toThrow()
    })
  })

  describe('getSessionAttendanceWithSwimmers', () => {
    it('should return swimmers with attendance and summary', async () => {
      const mockSwimmers = [
        { id: 'swimmer-1', first_name: 'John', last_name: 'Doe' },
        { id: 'swimmer-2', first_name: 'Jane', last_name: 'Smith' }
      ]

      const mockAttendance = [
        {
          id: 'att-1',
          training_session_id: 'session-1',
          swimmer_id: 'swimmer-1',
          status: 'present',
          created_at: '2024-01-15'
        }
      ]

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'swimmers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockSwimmers, error: null })
          } as any
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ data: mockAttendance, error: null })
        } as any
      })

      const result = await getSessionAttendanceWithSwimmers('session-1', 'squad-1')

      expect(result.swimmers).toHaveLength(2)
      expect(result.summary.total).toBe(2)
      expect(result.summary.present).toBe(1)
      expect(result.summary.not_recorded).toBe(1)
    })

    it('should throw error when fetching swimmers fails', async () => {
      const mockError = { message: 'Failed to fetch swimmers', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(getSessionAttendanceWithSwimmers('session-1', 'squad-1')).rejects.toThrow('Failed to fetch swimmers')
    })
  })
})
