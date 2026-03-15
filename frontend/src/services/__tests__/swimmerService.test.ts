import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSwimmersBySquad,
  getSwimmerById,
  createSwimmer,
  updateSwimmer,
  deleteSwimmer,
} from '../swimmerService'
import { apiClient } from '@/lib/apiClient'

describe('swimmerService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSwimmersBySquad', () => {
    it('should fetch swimmers for a squad', async () => {
      const mockSwimmers = [
        { id: '1', first_name: 'John', last_name: 'Doe', squad_id: 'squad-1' },
        { id: '2', first_name: 'Jane', last_name: 'Smith', squad_id: 'squad-1' }
      ]

      vi.mocked(apiClient.get).mockResolvedValue(mockSwimmers)

      const result = await getSwimmersBySquad('squad-1')

      expect(result).toEqual(mockSwimmers)
      expect(apiClient.get).toHaveBeenCalledWith('/api/squads/squad-1/swimmers')
    })

    it('should throw error on failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch swimmers'))

      await expect(getSwimmersBySquad('squad-1')).rejects.toThrow('Failed to fetch swimmers')
    })

    it('should return empty array when no swimmers found', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([])

      const result = await getSwimmersBySquad('squad-1')

      expect(result).toEqual([])
    })
  })

  describe('getSwimmerById', () => {
    it('should fetch a single swimmer', async () => {
      const mockSwimmer = { id: '1', first_name: 'John', last_name: 'Doe' }

      vi.mocked(apiClient.get).mockResolvedValue(mockSwimmer)

      const result = await getSwimmerById('1')

      expect(result).toEqual(mockSwimmer)
      expect(apiClient.get).toHaveBeenCalledWith('/swimmers/1/basic-info')
    })

    it('should return null when swimmer not found', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Not found'))

      const result = await getSwimmerById('non-existent')

      expect(result).toBeNull()
    })
  })

  describe('createSwimmer', () => {
    it('should create a new swimmer', async () => {
      const createData = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-01-01',
        sex: 'Male' as const,
        squad_id: 'squad-1'
      }

      const mockCreatedSwimmer = { id: '1', ...createData, created_at: '2024-01-01' }

      vi.mocked(apiClient.post).mockResolvedValue(mockCreatedSwimmer)

      const result = await createSwimmer(createData)

      expect(result).toEqual(mockCreatedSwimmer)
      expect(apiClient.post).toHaveBeenCalledWith('/swimmers/create', createData)
    })

    it('should throw error on creation failure', async () => {
      const createData = {
        first_name: 'John',
        last_name: 'Doe',
        squad_id: 'squad-1'
      }

      vi.mocked(apiClient.post).mockRejectedValue(new Error('Failed to create swimmer'))

      await expect(createSwimmer(createData)).rejects.toThrow('Failed to create swimmer')
    })
  })

  describe('updateSwimmer', () => {
    it('should update a swimmer', async () => {
      const updates = { first_name: 'Jane' }
      const mockUpdatedSwimmer = {
        id: '1',
        first_name: 'Jane',
        last_name: 'Doe',
        squad_id: 'squad-1'
      }

      vi.mocked(apiClient.put).mockResolvedValue(mockUpdatedSwimmer)

      const result = await updateSwimmer('1', updates)

      expect(result).toEqual(mockUpdatedSwimmer)
      expect(apiClient.put).toHaveBeenCalledWith('/swimmers/1/update', updates)
    })

    it('should throw error on update failure', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('Failed to update swimmer'))

      await expect(updateSwimmer('1', { first_name: 'Jane' })).rejects.toThrow('Failed to update swimmer')
    })
  })

  describe('deleteSwimmer', () => {
    it('should delete a swimmer', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      await expect(deleteSwimmer('1')).resolves.toBeUndefined()
      expect(apiClient.delete).toHaveBeenCalledWith('/swimmers/1/delete')
    })

    it('should throw error on deletion failure', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('Failed to delete swimmer'))

      await expect(deleteSwimmer('1')).rejects.toThrow('Failed to delete swimmer')
    })
  })
})
