import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSquadRankings,
  getAvailableDistances,
  formatTime,
  type StrokeType,
  type ActivityType
} from '../workoutResultService'
import { supabase } from '../../lib/supabase'

describe('workoutResultService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSquadRankings', () => {
    it('should return rankings for a squad', async () => {
      const mockSwimmers = [
        { id: 'swimmer-1', first_name: 'John', last_name: 'Doe' },
        { id: 'swimmer-2', first_name: 'Jane', last_name: 'Smith' }
      ]

      const mockResults = [
        {
          id: 'result-1',
          swimmer_id: 'swimmer-1',
          training_session_id: 'session-1',
          stroke: 'free',
          activity: 'swim',
          distance: 100,
          time_result: '00:01:15',
          result_units: 'meters',
          created_at: '2024-01-15'
        }
      ]

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'swimmers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockSwimmers, error: null })
          } as any
        }
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({ data: mockResults, error: null })
        } as any
      })

      const result = await getSquadRankings('squad-1', 'free', 'swim', 100, 'meters')

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
    })

    it('should return empty array when no swimmers in squad', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null })
      } as any)

      const result = await getSquadRankings('squad-1', 'free', 'swim', 100, 'meters')

      expect(result).toEqual([])
    })

    it('should throw error when fetching swimmers fails', async () => {
      const mockError = { message: 'Failed to fetch swimmers', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(getSquadRankings('squad-1', 'free', 'swim', 100, 'meters')).rejects.toThrow('Failed to fetch swimmers')
    })

    it('should return empty array when no results found', async () => {
      const mockSwimmers = [
        { id: 'swimmer-1', first_name: 'John', last_name: 'Doe' }
      ]

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'swimmers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockSwimmers, error: null })
          } as any
        }
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: vi.fn().mockResolvedValue({ data: [], error: null })
        } as any
      })

      const result = await getSquadRankings('squad-1', 'free', 'swim', 100, 'meters')

      expect(result).toEqual([])
    })
  })

  describe('getAvailableDistances', () => {
    it('should return unique sorted distances', async () => {
      const mockSwimmers = [
        { id: 'swimmer-1' },
        { id: 'swimmer-2' }
      ]

      const mockResults = [
        { distance: 100 },
        { distance: 200 },
        { distance: 100 },
        { distance: 50 }
      ]

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'swimmers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockSwimmers, error: null })
          } as any
        }
        // workout_result table - needs multiple .not() calls in chain
        const notMock = vi.fn().mockReturnThis()
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: notMock.mockImplementation(() => ({
            not: vi.fn().mockResolvedValue({ data: mockResults, error: null })
          }))
        } as any
      })

      const result = await getAvailableDistances('squad-1', 'free', 'swim', 'meters')

      expect(result).toEqual([50, 100, 200])
    })

    it('should return empty array when no swimmers found', async () => {
      // When no swimmers, the function returns early before querying workout_result
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'No swimmers' } })
      } as any)

      const result = await getAvailableDistances('squad-1', 'free', 'swim', 'meters')

      expect(result).toEqual([])
    })

    it('should return empty array on swimmer fetch error', async () => {
      const mockError = { message: 'Fetch failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      const result = await getAvailableDistances('squad-1', 'free', 'swim', 'meters')

      expect(result).toEqual([])
    })

    it('should return empty array when workout results fetch fails', async () => {
      const mockSwimmers = [{ id: 'swimmer-1' }]
      const mockError = { message: 'Results fetch failed', code: '500' }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'swimmers') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockSwimmers, error: null })
          } as any
        }
        // workout_result query fails
        const notMock = vi.fn().mockReturnThis()
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          not: notMock.mockImplementation(() => ({
            not: vi.fn().mockResolvedValue({ data: null, error: mockError })
          }))
        } as any
      })

      const result = await getAvailableDistances('squad-1', 'free', 'swim', 'meters')

      expect(result).toEqual([])
    })
  })

  describe('formatTime', () => {
    it('should format seconds to MM:SS.ms', () => {
      expect(formatTime(75.5)).toBe('1:15.50')
      expect(formatTime(125)).toBe('2:05.00')
      expect(formatTime(59.99)).toBe('0:59.99')
    })

    it('should handle zero seconds', () => {
      expect(formatTime(0)).toBe('0:00.00')
    })

    it('should handle very large times', () => {
      // Times over an hour show H:MM:SS format (1 hour 1 minute 5 seconds)
      expect(formatTime(3665)).toBe('1:01:05.00')
    })
  })
})
