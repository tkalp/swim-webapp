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
import { apiClient } from '@/lib/apiClient'

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

      vi.mocked(apiClient.get).mockResolvedValue(mockTags)

      const result = await getCoachTags('coach-1')

      expect(result).toEqual(mockTags)
      expect(apiClient.get).toHaveBeenCalledWith('/coaches/coach-1/tags')
    })

    it('should throw error on fetch failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Fetch failed'))

      await expect(getCoachTags('coach-1')).rejects.toThrow()
    })
  })

  describe('createTag', () => {
    it('should create a new tag', async () => {
      const tagData = { name: 'Technique', color: '#0000FF' }
      const mockTag = { id: 'tag-1', coach_id: 'coach-1', ...tagData, created_at: '2024-01-01' }

      vi.mocked(apiClient.post).mockResolvedValue(mockTag)

      const result = await createTag('coach-1', tagData)

      expect(result).toEqual(mockTag)
      expect(apiClient.post).toHaveBeenCalledWith('/coaches/coach-1/tags', tagData)
    })

    it('should throw error on creation failure', async () => {
      const tagData = { name: 'Existing', color: '#FF0000' }

      vi.mocked(apiClient.post).mockRejectedValue(new Error('Tag with this name already exists'))

      await expect(createTag('coach-1', tagData)).rejects.toThrow('Tag with this name already exists')
    })
  })

  describe('updateTag', () => {
    it('should update a tag', async () => {
      const updates = { name: 'Updated Tag', color: '#FFFF00' }
      const mockUpdated = { id: 'tag-1', coach_id: 'coach-1', ...updates, updated_at: '2024-01-01' }

      vi.mocked(apiClient.put).mockResolvedValue(mockUpdated)

      const result = await updateTag('tag-1', updates)

      expect(result).toEqual(mockUpdated)
      expect(apiClient.put).toHaveBeenCalledWith('/tags/tag-1', updates)
    })
  })

  describe('deleteTag', () => {
    it('should delete a tag', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      await expect(deleteTag('tag-1')).resolves.toBeUndefined()
      expect(apiClient.delete).toHaveBeenCalledWith('/tags/tag-1')
    })
  })

  describe('getWorkoutTags', () => {
    it('should return tags for a workout', async () => {
      const mockTags = [
        { id: 'tag-1', name: 'Endurance', color: '#FF0000' },
        { id: 'tag-2', name: 'Sprint', color: '#00FF00' }
      ]

      vi.mocked(apiClient.get).mockResolvedValue(mockTags)

      const result = await getWorkoutTags('workout-1')

      expect(result).toHaveLength(2)
      expect(apiClient.get).toHaveBeenCalledWith('/workouts/workout-1/tags')
    })
  })

  describe('addTagToWorkout', () => {
    it('should add a tag to a workout', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined)

      await expect(addTagToWorkout('workout-1', 'tag-1')).resolves.toBeUndefined()
      expect(apiClient.post).toHaveBeenCalledWith('/workouts/workout-1/tags/tag-1')
    })
  })

  describe('removeTagFromWorkout', () => {
    it('should remove a tag from a workout', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      await expect(removeTagFromWorkout('workout-1', 'tag-1')).resolves.toBeUndefined()
      expect(apiClient.delete).toHaveBeenCalledWith('/workouts/workout-1/tags/tag-1')
    })
  })

  describe('setWorkoutTags', () => {
    it('should replace all workout tags', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined)

      await expect(setWorkoutTags('workout-1', ['tag-1', 'tag-2'])).resolves.toBeUndefined()
      expect(apiClient.post).toHaveBeenCalledWith('/api/workouts/workout-1/tags/set', {
        tag_ids: ['tag-1', 'tag-2']
      })
    })
  })
})
