import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSquadsForCoach,
  getSquadById,
  createSquad,
  updateSquad,
  deleteSquad
} from '../squadService'
import { apiClient } from '@/lib/apiClient'

describe('squadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSquadsForCoach', () => {
    it('should fetch squads with swimmer counts', async () => {
      const mockSquads = [
        {
          id: 'squad-1',
          name: 'Squad A',
          description: 'Test squad',
          created_at: '2024-01-01',
          role: 'owner',
          swimmers_count: 3
        }
      ]

      vi.mocked(apiClient.get).mockResolvedValue(mockSquads)

      const result = await getSquadsForCoach('coach-1')

      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        id: 'squad-1',
        name: 'Squad A',
        description: 'Test squad',
        created_at: '2024-01-01',
        role: 'owner',
        swimmers_count: 3
      })
      expect(apiClient.get).toHaveBeenCalledWith('/api/squads')
    })

    it('should return empty array when no squads', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([])

      const result = await getSquadsForCoach('coach-1')

      expect(result).toEqual([])
    })

    it('should throw error on fetch failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch squads'))

      await expect(getSquadsForCoach('coach-1')).rejects.toThrow('Failed to fetch squads')
    })
  })

  describe('getSquadById', () => {
    it('should fetch a single squad', async () => {
      const mockSquad = {
        id: 'squad-1',
        name: 'Squad A',
        description: 'Test squad',
        created_at: '2024-01-01'
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockSquad)

      const result = await getSquadById('squad-1')

      expect(result).toEqual(mockSquad)
      expect(apiClient.get).toHaveBeenCalledWith('/api/squads/squad-1')
    })

    it('should return null when squad not found', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Not found'))

      const result = await getSquadById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('createSquad', () => {
    it('should create a new squad with coach assignment', async () => {
      const createData = {
        name: 'New Squad',
        description: 'Test description'
      }

      const mockSquad = {
        id: 'squad-1',
        name: 'New Squad',
        description: 'Test description',
        created_at: '2024-01-01'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockSquad)

      const result = await createSquad('coach-1', createData)

      expect(result).toEqual(mockSquad)
      expect(apiClient.post).toHaveBeenCalledWith('/api/squads', {
        ...createData,
        coach_id: 'coach-1'
      })
    })

    it('should throw error on squad creation failure', async () => {
      const createData = { name: 'New Squad' }

      vi.mocked(apiClient.post).mockRejectedValue(new Error('Failed to create squad'))

      await expect(createSquad('coach-1', createData)).rejects.toThrow('Failed to create squad')
    })
  })

  describe('updateSquad', () => {
    it('should update a squad', async () => {
      const updates = { name: 'Updated Squad' }
      const mockUpdatedSquad = {
        id: 'squad-1',
        name: 'Updated Squad',
        description: 'Test',
        created_at: '2024-01-01'
      }

      vi.mocked(apiClient.put).mockResolvedValue(mockUpdatedSquad)

      const result = await updateSquad('squad-1', updates)

      expect(result).toEqual(mockUpdatedSquad)
      expect(apiClient.put).toHaveBeenCalledWith('/api/squads/squad-1', updates)
    })

    it('should throw error on update failure', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('Failed to update squad'))

      await expect(updateSquad('squad-1', { name: 'Updated' })).rejects.toThrow('Failed to update squad')
    })
  })

  describe('deleteSquad', () => {
    it('should delete a squad', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      await expect(deleteSquad('squad-1')).resolves.toBeUndefined()
      expect(apiClient.delete).toHaveBeenCalledWith('/api/squads/squad-1')
    })

    it('should throw error on deletion failure', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('Failed to delete squad'))

      await expect(deleteSquad('squad-1')).rejects.toThrow('Failed to delete squad')
    })
  })
})
