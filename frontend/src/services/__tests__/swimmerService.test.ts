import { describe, it, expect, beforeEach, vi } from 'vitest'
import { 
  getSwimmersBySquad, 
  getSwimmerById, 
  createSwimmer, 
  updateSwimmer,
  deleteSwimmer,
  createSwimmerWithExternalLink,
  triggerSwimmerSync,
  cancelSwimmerSync
} from '../swimmerService'
import { supabase } from '@/lib/supabase'

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

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockSwimmers, error: null })
      } as any)

      const result = await getSwimmersBySquad('squad-1')

      expect(result).toEqual(mockSwimmers)
      expect(supabase.from).toHaveBeenCalledWith('swimmers')
    })

    it('should throw error on failure', async () => {
      const mockError = { message: 'Database error', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(getSwimmersBySquad('squad-1')).rejects.toThrow('Failed to fetch swimmers')
    })

    it('should return empty array when no swimmers found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null })
      } as any)

      const result = await getSwimmersBySquad('squad-1')

      expect(result).toEqual([])
    })
  })

  describe('getSwimmerById', () => {
    it('should fetch a single swimmer', async () => {
      const mockSwimmer = { id: '1', first_name: 'John', last_name: 'Doe' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockSwimmer, error: null })
      } as any)

      const result = await getSwimmerById('1')

      expect(result).toEqual(mockSwimmer)
    })

    it('should return null when swimmer not found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
      } as any)

      const result = await getSwimmerById('non-existent')

      expect(result).toBeNull()
    })

    it('should throw error on database failure', async () => {
      const mockError = { message: 'Database error', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(getSwimmerById('1')).rejects.toThrow('Failed to fetch swimmer')
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

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockCreatedSwimmer, error: null })
      } as any)

      const result = await createSwimmer(createData)

      expect(result).toEqual(mockCreatedSwimmer)
      expect(supabase.from).toHaveBeenCalledWith('swimmers')
    })

    it('should throw error on creation failure', async () => {
      const createData = {
        first_name: 'John',
        last_name: 'Doe',
        squad_id: 'squad-1'
      }

      const mockError = { message: 'Validation error', code: '400' }

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

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

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdatedSwimmer, error: null })
      } as any)

      const result = await updateSwimmer('1', updates)

      expect(result).toEqual(mockUpdatedSwimmer)
    })

    it('should throw error on update failure', async () => {
      const mockError = { message: 'Update failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(updateSwimmer('1', { first_name: 'Jane' })).rejects.toThrow('Failed to update swimmer')
    })
  })

  describe('deleteSwimmer', () => {
    it('should delete a swimmer', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      } as any)

      await expect(deleteSwimmer('1')).resolves.toBeUndefined()
    })

    it('should throw error on deletion failure', async () => {
      const mockError = { message: 'Delete failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: mockError })
      } as any)

      await expect(deleteSwimmer('1')).rejects.toThrow('Failed to delete swimmer')
    })
  })
})
