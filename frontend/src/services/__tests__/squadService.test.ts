import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSquadsForCoach,
  getSquadById,
  createSquad,
  updateSquad,
  deleteSquad
} from '../squadService'
import { supabase } from '@/lib/supabase'

describe('squadService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSquadsForCoach', () => {
    it('should fetch squads with swimmer counts', async () => {
      const mockMemberships = [
        {
          squad_id: 'squad-1',
          role: 'owner',
          squads: {
            id: 'squad-1',
            name: 'Squad A',
            description: 'Test squad',
            created_at: '2024-01-01'
          }
        }
      ]

      const mockSwimmerCounts = [
        { squad_id: 'squad-1' },
        { squad_id: 'squad-1' },
        { squad_id: 'squad-1' }
      ]

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'coach_squads') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockMemberships, error: null })
          } as any
        } else if (table === 'swimmers') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: mockSwimmerCounts, error: null })
          } as any
        }
        return {} as any
      })

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
    })

    it('should return empty array when no memberships', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: [], error: null })
      } as any)

      const result = await getSquadsForCoach('coach-1')

      expect(result).toEqual([])
    })

    it('should throw error on membership fetch failure', async () => {
      const mockError = { message: 'Database error', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(getSquadsForCoach('coach-1')).rejects.toThrow('Failed to fetch squads')
    })

    it('should handle swimmer count error', async () => {
      const mockMemberships = [
        {
          squad_id: 'squad-1',
          role: 'owner',
          squads: { id: 'squad-1', name: 'Squad A', description: null, created_at: '2024-01-01' }
        }
      ]

      const mockError = { message: 'Count error', code: '500' }

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'coach_squads') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockMemberships, error: null })
          } as any
        } else if (table === 'swimmers') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockResolvedValue({ data: null, error: mockError })
          } as any
        }
        return {} as any
      })

      await expect(getSquadsForCoach('coach-1')).rejects.toThrow('Failed to count swimmers')
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

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSquad, error: null })
      } as any)

      const result = await getSquadById('squad-1')

      expect(result).toEqual(mockSquad)
    })

    it('should return null when squad not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      } as any)

      const result = await getSquadById('non-existent')

      expect(result).toBeNull()
    })

    it('should throw error on database failure', async () => {
      const mockError = { message: 'Database error', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(getSquadById('squad-1')).rejects.toThrow('Failed to fetch squad')
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

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'squads') {
          return {
            insert: vi.fn().mockReturnThis(),
            select: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockSquad, error: null })
          } as any
        } else if (table === 'coach_squads') {
          return {
            insert: vi.fn().mockResolvedValue({ error: null })
          } as any
        }
        return {} as any
      })

      const result = await createSquad('coach-1', createData)

      expect(result).toEqual(mockSquad)
    })

    it('should throw error on squad creation failure', async () => {
      const createData = { name: 'New Squad' }
      const mockError = { message: 'Creation failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(createSquad('coach-1', createData)).rejects.toThrow('Failed to create squad')
    })

    it('should throw error on coach assignment failure', async () => {
      const createData = { name: 'New Squad' }
      const mockSquad = { id: 'squad-1', name: 'New Squad', description: null, created_at: '2024-01-01' }
      const mockError = { message: 'Assignment failed', code: '500' }

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'squads') {
          callCount++
          if (callCount === 1) {
            // First call: creating the squad
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockSquad, error: null })
            } as any
          } else {
            // Second call: rollback delete
            return {
              delete: vi.fn().mockReturnThis(),
              eq: vi.fn().mockResolvedValue({ error: null })
            } as any
          }
        } else if (table === 'coach_squads') {
          return {
            insert: vi.fn().mockResolvedValue({ error: mockError })
          } as any
        }
        return {} as any
      })

      await expect(createSquad('coach-1', createData)).rejects.toThrow('Failed to create squad membership')
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

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedSquad, error: null })
      } as any)

      const result = await updateSquad('squad-1', updates)

      expect(result).toEqual(mockUpdatedSquad)
    })

    it('should throw error on update failure', async () => {
      const mockError = { message: 'Update failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(updateSquad('squad-1', { name: 'Updated' })).rejects.toThrow('Failed to update squad')
    })
  })

  describe('deleteSquad', () => {
    it('should delete a squad', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      } as any)

      await expect(deleteSquad('squad-1')).resolves.toBeUndefined()
    })

    it('should throw error on deletion failure', async () => {
      const mockError = { message: 'Delete failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: mockError })
      } as any)

      await expect(deleteSquad('squad-1')).rejects.toThrow('Failed to delete squad')
    })
  })
})
