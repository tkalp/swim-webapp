import { describe, it, expect, beforeEach, vi } from 'vitest'
import { searchSwimRankings, linkSwimmer, getSwimmerLinks } from '../swimRankingsService'
import { supabase } from '@/lib/supabase'

// Mock global fetch
global.fetch = vi.fn()

describe('swimRankingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Mock getAuthToken
    vi.mocked(supabase.auth.getSession).mockResolvedValue({
      data: { session: { access_token: 'mock-token' } as any },
      error: null
    })
  })

  describe('searchSwimRankings', () => {
    it('should search for athletes by name', async () => {
      const mockResults = [
        {
          athlete_id: 'athlete-1',
          name: 'John Doe',
          birth_year: '2005',
          nation: 'USA'
        }
      ]

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResults
      } as any)

      const result = await searchSwimRankings('John', 'Doe')

      expect(result).toEqual(mockResults)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should throw error when search fails', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        statusText: 'Server Error'
      } as any)

      await expect(searchSwimRankings('John', 'Doe')).rejects.toThrow()
    })
  })

  describe('linkSwimmer', () => {
    it('should link swimmer to SwimRankings athlete', async () => {
      const linkRequest = {
        swimmer_id: 'swimmer-1',
        swimrankings_athlete_id: 'athlete-1',
        swimrankings_name: 'John Doe',
        verified: true
      }

      const mockResponse = {
        success: true,
        message: 'Linked successfully',
        link: { id: 'link-1', ...linkRequest }
      }

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as any)

      const result = await linkSwimmer(linkRequest)

      expect(result.success).toBe(true)
      expect(global.fetch).toHaveBeenCalled()
    })

    it('should throw error when linking fails', async () => {
      vi.mocked(global.fetch).mockResolvedValue({
        ok: false,
        json: async () => ({ detail: 'Link failed' })
      } as any)

      await expect(linkSwimmer({} as any)).rejects.toThrow()
    })
  })

  describe('getSwimmerLinks', () => {
    it('should get external links for a swimmer', async () => {
      const mockLinks = [
        {
          id: 'link-1',
          swimmer_id: 'swimmer-1',
          platform: 'swimrankings',
          external_id: 'athlete-1'
        }
      ]

      vi.mocked(global.fetch).mockResolvedValue({
        ok: true,
        json: async () => mockLinks
      } as any)

      const result = await getSwimmerLinks('swimmer-1')

      expect(result).toEqual(mockLinks)
    })
  })
})
