import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getSquadWorkouts,
  getCoachWorkouts,
  createWorkout,
  deleteWorkout,
  duplicateWorkout
} from '../workoutLibraryService'
import { supabase } from '../../lib/supabase'

describe('workoutLibraryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getSquadWorkouts', () => {
    it('should return workouts for a squad with pagination', async () => {
      const mockSquad = { coach_id: 'coach-1' }
      const mockSessions = [
        { workout_id: 'workout-1' },
        { workout_id: 'workout-2' }
      ]
      const mockWorkouts = [
        {
          id: 'workout-1',
          name: 'Test Workout',
          total_meters: 3000,
          estimated_time_minutes: 60,
          created_at: '2024-01-01',
          create_by_coach: 'coach-1'
        }
      ]

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'squads') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockSquad, error: null })
          } as any
        }
        if (table === 'training_sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            not: vi.fn().mockReturnThis(),
            order: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null, count: 0 })
          } as any
        }
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          order: vi.fn().mockResolvedValue({ data: mockWorkouts, error: null })
        } as any
      })

      const result = await getSquadWorkouts('squad-1')

      expect(result).toBeDefined()
      expect(result.workouts).toBeDefined()
    })

    it('should throw error when squad not found', async () => {
      const mockError = { message: 'Squad not found', code: 'PGRST116' }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(getSquadWorkouts('invalid-squad')).rejects.toThrow()
    })
  })

  describe('getCoachWorkouts', () => {
    it('should return workouts for a coach with usage stats', async () => {
      const mockWorkouts = [
        {
          id: 'workout-1',
          name: 'Workout 1',
          total_meters: 3000,
          estimated_time_minutes: 60,
          created_at: '2024-01-01',
          create_by_coach: 'coach-1'
        }
      ]

      const mockSessions = [
        { workout_id: 'workout-1', start_date: '2024-01-15' }
      ]

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workout_template') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockWorkouts, error: null })
          } as any
        }
        if (table === 'training_sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            in: vi.fn().mockReturnThis(),
            order: vi.fn().mockResolvedValue({ data: mockSessions, error: null })
          } as any
        }
        return {
          select: vi.fn().mockReturnThis(),
          in: vi.fn().mockResolvedValue({ data: [], error: null })
        } as any
      })

      const result = await getCoachWorkouts('coach-1')

      expect(result.workouts).toBeDefined()
      expect(result.total).toBe(1)
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

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockWorkout, error: null })
      } as any)

      const result = await createWorkout(createData)

      expect(result).toEqual(mockWorkout)
      expect(supabase.from).toHaveBeenCalledWith('workout_template')
    })

    it('should throw error on creation failure', async () => {
      const mockError = { message: 'Creation failed', code: '500' }

      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockReturnThis(),
        select: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: mockError })
      } as any)

      await expect(createWorkout({} as any)).rejects.toThrow()
    })
  })

  describe('deleteWorkout', () => {
    it('should delete a workout when not in use', async () => {
      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'training_sessions') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            limit: vi.fn().mockResolvedValue({ data: [], error: null })
          } as any
        }
        return {
          delete: vi.fn().mockReturnThis(),
          eq: vi.fn().mockResolvedValue({ error: null })
        } as any
      })

      await expect(deleteWorkout('workout-1')).resolves.toBeUndefined()
    })

    it('should throw error when workout is in use', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: 'session-1' }], error: null })
      } as any)

      await expect(deleteWorkout('workout-1')).rejects.toThrow('Cannot delete workout that is assigned')
    })
  })

  describe('duplicateWorkout', () => {
    it('should duplicate a workout with tags', async () => {
      const mockOriginal = {
        id: 'workout-1',
        name: 'Original',
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

      const mockDuplicate = {
        ...mockOriginal,
        id: 'workout-2',
        name: 'Original (Copy)'
      }

      const mockTags = [{ tag_id: 'tag-1' }]

      let workoutTemplateCallCount = 0

      vi.mocked(supabase.from).mockImplementation((table: string) => {
        if (table === 'workout_template') {
          workoutTemplateCallCount++
          if (workoutTemplateCallCount === 1) {
            // First call: fetch original
            return {
              select: vi.fn().mockReturnThis(),
              eq: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockOriginal, error: null })
            } as any
          } else {
            // Second call: insert duplicate
            return {
              insert: vi.fn().mockReturnThis(),
              select: vi.fn().mockReturnThis(),
              single: vi.fn().mockResolvedValue({ data: mockDuplicate, error: null })
            } as any
          }
        }
        if (table === 'workout_template_tags') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockResolvedValue({ data: mockTags, error: null }),
            insert: vi.fn().mockResolvedValue({ error: null })
          } as any
        }
        return {} as any
      })

      const result = await duplicateWorkout('workout-1')

      expect(result.name).toBe('Original (Copy)')
      expect(result.id).toBe('workout-2')
    })
  })
})
