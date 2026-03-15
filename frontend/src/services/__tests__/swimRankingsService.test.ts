import { describe, it, expect, beforeEach, vi } from 'vitest'
import { searchSwimRankings, linkSwimmer, getSwimmerLinks } from '../swimRankingsService'
import { authenticatedFetch } from '@/lib/apiClient'

describe('swimRankingsService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: true,
        json: async () => mockResults
      } as Response)

      const result = await searchSwimRankings('John', 'Doe')

      expect(result).toEqual(mockResults)
      expect(authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/swimrankings/search?firstname=John&lastname=Doe')
      )
    })

    it('should throw error when search fails', async () => {
      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: false,
        statusText: 'Server Error'
      } as Response)

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

      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: true,
        json: async () => mockResponse
      } as Response)

      const result = await linkSwimmer(linkRequest)

      expect(result.success).toBe(true)
      expect(authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/swimrankings/link'),
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify(linkRequest),
        })
      )
    })

    it('should throw error when linking fails', async () => {
      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: false,
        json: async () => ({ detail: 'Link failed' })
      } as Response)

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

      vi.mocked(authenticatedFetch).mockResolvedValue({
        ok: true,
        json: async () => mockLinks
      } as Response)

      const result = await getSwimmerLinks('swimmer-1')

      expect(result).toEqual(mockLinks)
      expect(authenticatedFetch).toHaveBeenCalledWith(
        expect.stringContaining('/swimrankings/swimmer/swimmer-1/links')
      )
    })
  })
})
