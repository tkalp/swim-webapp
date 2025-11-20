import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCoachTags,
  createTag,
  updateTag,
  deleteTag,
  getWorkoutTags,
  addTagToWorkout,
  removeTagFromWorkout,
  setWorkoutTags
} from '../workoutTagService'
import { supabase } from '../../lib/supabase'

describe('workoutTagService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCoachTags', () => {
    it('should return all tags for a coach', async () => {
      const mockTags = [
        { id: 'tag-1', coach_id: 'coach-1', name: 'Endurance', color: '#FF0000' },
        { id: 'tag-2', coach_id: 'coach-1', name: 'Sprint', color: '#00FF00' }
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockTags, error: null })
      } as any)

      const result = await getCoachTags('coach-1')

      expect(result).toEqual(mockTags)
      expect(supabase.from).toHaveBeenCalledWith('workout_tags')
    })

    it('should throw error on fetch failure', async () => {
      const mockError = { message: 'Fetch failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(getCoachTags('coach-1')).rejects.toThrow()
    })
  })

  describe('createTag', () => {
    it('should create a new tag', async () => {
      const tagData = { name: 'Technique', color: '#0000FF' }
      const mockTag = { id: 'tag-1', coach_id: 'coach-1', ...tagData, created_at: '2024-01-01' }

      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call: check for existing
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
          } as any
        }
        // Second call: insert new tag
        return {
          insert: vi.fn().mockReturnThis(),
          select: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: mockTag, error: null })
        } as any
      })

      const result = await createTag('coach-1', tagData)

      expect(result).toEqual(mockTag)
    })

    it('should throw error when tag name already exists', async () => {
      const tagData = { name: 'Existing', color: '#FF0000' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'tag-1' }, error: null })
      } as any)

      await expect(createTag('coach-1', tagData)).rejects.toThrow('Tag with this name already exists')
    })
  })

  describe('updateTag', () => {
    it('should update a tag', async () => {
      const updates = { name: 'Updated Tag', color: '#FFFF00' }
      const mockUpdated = { id: 'tag-1', coach_id: 'coach-1', ...updates, updated_at: '2024-01-01' }

      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockUpdated, error: null })
      } as any)

      const result = await updateTag('tag-1', updates)

      expect(result).toEqual(mockUpdated)
    })
  })

  describe('deleteTag', () => {
    it('should delete a tag', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null })
      } as any)

      await expect(deleteTag('tag-1')).resolves.toBeUndefined()
    })
  })

  describe('getWorkoutTags', () => {
    it('should return tags for a workout', async () => {
      const mockData = [
        { workout_tags: { id: 'tag-1', name: 'Endurance', color: '#FF0000' } },
        { workout_tags: { id: 'tag-2', name: 'Sprint', color: '#00FF00' } }
      ]

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ data: mockData, error: null })
      } as any)

      const result = await getWorkoutTags('workout-1')

      expect(result).toHaveLength(2)
    })
  })

  describe('addTagToWorkout', () => {
    it('should add a tag to a workout', async () => {
      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call: check existing
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } })
          } as any
        }
        // Second call: insert
        return {
          insert: vi.fn().mockResolvedValue({ error: null })
        } as any
      })

      await expect(addTagToWorkout('workout-1', 'tag-1')).resolves.toBeUndefined()
    })
  })

  describe('removeTagFromWorkout', () => {
    it('should remove a tag from a workout', async () => {
      const eqChain = {
        eq: vi.fn().mockResolvedValue({ error: null })
      }
      
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnValue(eqChain)
      } as any)

      await expect(removeTagFromWorkout('workout-1', 'tag-1')).resolves.toBeUndefined()
    })
  })

  describe('setWorkoutTags', () => {
    it('should replace all workout tags', async () => {
      let callCount = 0
      vi.mocked(supabase.from).mockImplementation(() => {
        callCount++
        if (callCount === 1) {
          // First call: delete existing
          return {
            delete: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ error: null })
          } as any
        }
        // Second call: insert new
        return {
          insert: vi.fn().mockResolvedValue({ error: null })
        } as any
      })

      await expect(setWorkoutTags('workout-1', ['tag-1', 'tag-2'])).resolves.toBeUndefined()
    })
  })
})
