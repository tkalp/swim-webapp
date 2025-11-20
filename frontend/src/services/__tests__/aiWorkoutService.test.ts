import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AIWorkoutService } from '../aiWorkoutService'
import { authenticatedFetch } from '../../lib/apiClient'

vi.mock('../../lib/apiClient', () => ({
  authenticatedFetch: vi.fn()
}))

describe('aiWorkoutService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSquadPerformanceAnalysis', () => {
    it('should get squad performance analysis', async () => {
      const mockAnalysis = {
        squad_id: 'squad-1',
        analysis_period_days: 30,
        total_swimmers: 10
      }

      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: true,
        json: async () => mockAnalysis
      } as any)

      const result = await AIWorkoutService.getSquadPerformanceAnalysis('squad-1', 30)

      expect(result).toEqual(mockAnalysis)
      expect(authenticatedFetch).toHaveBeenCalled()
    })

    it('should throw error when request fails', async () => {
      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: false,
        status: 500
      } as any)

      await expect(AIWorkoutService.getSquadPerformanceAnalysis('squad-1')).rejects.toThrow()
    })
  })

  describe('getSquadWorkoutSuggestions', () => {
    it('should get workout suggestions for squad', async () => {
      const mockSuggestions = {
        squad_id: 'squad-1',
        suggestions: []
      }

      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: true,
        json: async () => mockSuggestions
      } as any)

      const result = await AIWorkoutService.getSquadWorkoutSuggestions('squad-1')

      expect(result).toEqual(mockSuggestions)
    })
  })
})
