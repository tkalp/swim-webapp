import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSquadRankings,
  getAvailableDistances,
  formatTime,
  type StrokeType,
  type ActivityType
} from '../workoutResultService'
import { apiClient } from '@/lib/apiClient'

describe('workoutResultService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSquadRankings', () => {
    it('should return rankings for a squad', async () => {
      const mockRankings = [
        {
          swimmer_id: 'swimmer-1',
          swimmer_name: 'John Doe',
          best_time: 75,
          distance: 100,
          stroke: 'free',
          activity: 'swim',
          pace: 75,
          result_count: 5,
          result_units: 'meters'
        }
      ]

      vi.mocked(apiClient.get).mockResolvedValue(mockRankings)

      const result = await getSquadRankings('squad-1', 'free', 'swim', 100, 'meters')

      expect(result).toBeDefined()
      expect(Array.isArray(result)).toBe(true)
      expect(result).toEqual(mockRankings)
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/workout-results/squad/squad-1/rankings?stroke=free&activity=swim&distance=100&result_units=meters'
      )
    })

    it('should return empty array when no rankings', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([])

      const result = await getSquadRankings('squad-1', 'free', 'swim', 100, 'meters')

      expect(result).toEqual([])
    })

    it('should throw error when fetching rankings fails', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch rankings'))

      await expect(getSquadRankings('squad-1', 'free', 'swim', 100, 'meters')).rejects.toThrow('Failed to fetch rankings')
    })
  })

  describe('getAvailableDistances', () => {
    it('should return available distances', async () => {
      const mockDistances = [50, 100, 200]

      vi.mocked(apiClient.get).mockResolvedValue(mockDistances)

      const result = await getAvailableDistances('squad-1', 'free', 'swim', 'meters')

      expect(result).toEqual([50, 100, 200])
      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/workout-results/squad/squad-1/available-distances?stroke=free&activity=swim&result_units=meters'
      )
    })

    it('should return empty array when no distances available', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([])

      const result = await getAvailableDistances('squad-1', 'free', 'swim', 'meters')

      expect(result).toEqual([])
    })

    it('should throw error on fetch failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch distances'))

      await expect(getAvailableDistances('squad-1', 'free', 'swim', 'meters')).rejects.toThrow('Failed to fetch distances')
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
