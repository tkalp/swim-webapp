import { describe, it, expect, beforeEach, vi } from 'vitest'
import { analyzeWorkout, getQuickWorkoutStats } from '../workoutAnalysisService'
import { authenticatedFetch } from '../../lib/apiClient'

vi.mock('../../lib/apiClient', () => ({
  authenticatedFetch: vi.fn()
}))

describe('workoutAnalysisService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('analyzeWorkout', () => {
    it('should analyze workout and return complete breakdown', async () => {
      const mockAnalysis = {
        workout_id: 'workout-1',
        total_meters: 3000,
        total_sets: 5,
        estimated_duration_minutes: 60,
        classification: 'Endurance'
      }

      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: true, data: mockAnalysis })
      } as any)

      const result = await analyzeWorkout('Test workout text', 'workout-1')

      expect(result).toEqual(mockAnalysis)
      expect(authenticatedFetch).toHaveBeenCalled()
    })

    it('should throw error when analysis fails', async () => {
      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: false,
        statusText: 'Bad Request'
      } as any)

      await expect(analyzeWorkout('Invalid workout')).rejects.toThrow('Failed to analyze workout')
    })

    it('should throw error when API returns error', async () => {
      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: true,
        json: async () => ({ success: false, error: 'Analysis failed' })
      } as any)

      await expect(analyzeWorkout('Test workout')).rejects.toThrow('Analysis failed')
    })
  })

  describe('getQuickWorkoutStats', () => {
    it('should return quick stats for workout', async () => {
      const mockStats = {
        total_meters: 3000,
        estimated_duration_minutes: 60,
        swim_time_minutes: 45,
        rest_time_minutes: 15,
        total_sets: 5,
        classification: 'Endurance'
      }

      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: true,
        json: async () => ({ data: mockStats })
      } as any)

      const result = await getQuickWorkoutStats('Test workout text')

      expect(result).toEqual(mockStats)
    })

    it('should throw error when request fails', async () => {
      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: false,
        statusText: 'Server Error'
      } as any)

      await expect(getQuickWorkoutStats('Test')).rejects.toThrow('Failed to get workout stats')
    })
  })
})
