import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSquadWorkouts,
  getCoachWorkouts,
  createWorkout,
  deleteWorkout,
  duplicateWorkout
} from '../workoutLibraryService'
import { apiClient } from '@/lib/apiClient'

describe('workoutLibraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSquadWorkouts', () => {
    it('should return workouts for a squad with pagination', async () => {
      const mockResult = {
        workouts: [
          {
            id: 'workout-1',
            name: 'Test Workout',
            total_meters: 3000,
            estimated_time_minutes: 60,
            created_at: '2024-01-01',
            create_by_coach: 'coach-1'
          }
        ],
        hasMore: false,
        total: 1
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockResult)

      const result = await getSquadWorkouts('squad-1')

      expect(result).toBeDefined()
      expect(result.workouts).toBeDefined()
      expect(result.workouts).toHaveLength(1)
      expect(apiClient.get).toHaveBeenCalledWith('/workouts/squad/squad-1?limit=20&offset=0')
    })

    it('should pass custom pagination options', async () => {
      const mockResult = { workouts: [], hasMore: false, total: 0 }

      vi.mocked(apiClient.get).mockResolvedValue(mockResult)

      await getSquadWorkouts('squad-1', { limit: 10, offset: 20 })

      expect(apiClient.get).toHaveBeenCalledWith('/workouts/squad/squad-1?limit=10&offset=20')
    })

    it('should throw error when fetch fails', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch workouts'))

      await expect(getSquadWorkouts('invalid-squad')).rejects.toThrow()
    })
  })

  describe('getCoachWorkouts', () => {
    it('should return workouts for a coach with usage stats', async () => {
      const mockResult = {
        workouts: [
          {
            id: 'workout-1',
            name: 'Workout 1',
            total_meters: 3000,
            estimated_time_minutes: 60,
            created_at: '2024-01-01',
            create_by_coach: 'coach-1'
          }
        ],
        hasMore: false,
        total: 1
      }

      vi.mocked(apiClient.get).mockResolvedValue(mockResult)

      const result = await getCoachWorkouts('coach-1')

      expect(result.workouts).toBeDefined()
      expect(result.total).toBe(1)
      expect(apiClient.get).toHaveBeenCalledWith('/workouts/coach/coach-1?limit=20&offset=0')
    })
  })

  describe('createWorkout', () => {
    it('should create a new workout', async () => {
      const createData = {
        name: 'New Workout',
        description: 'Test description',
        total_meters: 4000,
        estimated_time_minutes: 70,
        estimated_calories: 500,
        effort_level: 7,
        raw_description: 'Test workout',
        json_description: {},
        create_by_coach: 'coach-1'
      }

      const mockWorkout = {
        id: 'workout-1',
        ...createData,
        created_at: '2024-01-01'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockWorkout)

      const result = await createWorkout(createData)

      expect(result).toEqual(mockWorkout)
      expect(apiClient.post).toHaveBeenCalledWith('/workouts', createData)
    })

    it('should throw error on creation failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Creation failed'))

      await expect(createWorkout({} as any)).rejects.toThrow()
    })
  })

  describe('deleteWorkout', () => {
    it('should delete a workout', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      await expect(deleteWorkout('workout-1')).resolves.toBeUndefined()
      expect(apiClient.delete).toHaveBeenCalledWith('/workouts/workout-1')
    })

    it('should throw error on deletion failure', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('Failed to delete workout'))

      await expect(deleteWorkout('workout-1')).rejects.toThrow('Failed to delete workout')
    })
  })

  describe('duplicateWorkout', () => {
    it('should duplicate a workout', async () => {
      const mockDuplicate = {
        id: 'workout-2',
        name: 'Original (Copy)',
        description: 'Test',
        total_meters: 3000,
        estimated_time_minutes: 60,
        estimated_calories: 400,
        effort_level: 5,
        raw_description: 'Test',
        json_description: {},
        create_by_coach: 'coach-1',
        created_at: '2024-01-01'
      }

      vi.mocked(apiClient.post).mockResolvedValue(mockDuplicate)

      const result = await duplicateWorkout('workout-1')

      expect(result.name).toBe('Original (Copy)')
      expect(result.id).toBe('workout-2')
      expect(apiClient.post).toHaveBeenCalledWith('/workouts/workout-1/duplicate')
    })
  })
})
