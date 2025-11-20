import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCoachPermissions,
  getSquadCoaches,
  updateCoachPermissions,
  removeCoachFromSquad,
  inviteCoachToSquad,
  DEFAULT_PERMISSIONS,
} from '../permissionService'
import { supabase } from '@/lib/supabase'

vi.mock('../../lib/supabase', () => ({
  supabase: {
    from: vi.fn(),
  },
}))

describe('permissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCoachPermissions', () => {
    it('should get owner permissions with defaults', async () => {
      const mockData = {
        id: 'membership-1',
        coach_id: 'coach-1',
        squad_id: 'squad-1',
        role: 'owner',
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as any)

      const result = await getCoachPermissions('squad-1', 'coach-1')

      expect(result).toEqual({
        role: 'owner',
        ...DEFAULT_PERMISSIONS.owner,
      })
    })

    it('should get admin permissions with defaults', async () => {
      const mockData = {
        id: 'membership-1',
        coach_id: 'coach-1',
        squad_id: 'squad-1',
        role: 'admin',
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as any)

      const result = await getCoachPermissions('squad-1', 'coach-1')

      expect(result).toEqual({
        role: 'admin',
        ...DEFAULT_PERMISSIONS.admin,
      })
    })

    it('should get member permissions from database', async () => {
      const mockData = {
        id: 'membership-1',
        coach_id: 'coach-1',
        squad_id: 'squad-1',
        role: 'member',
        can_manage_swimmers: false,
        can_manage_workouts: false,
        can_manage_results: false,
        can_manage_attendance: false,
        can_manage_schedules: false,
        can_view_analytics: false,
        can_manage_squad_settings: false,
        can_manage_coaches: false,
        can_manage_sessions: false,
        can_manage_notes: true,
        can_view_notes: true,
      }

      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
      } as any)

      const result = await getCoachPermissions('squad-1', 'coach-1')

      expect(result?.role).toBe('member')
      expect(result?.can_manage_swimmers).toBe(false)
      expect(result?.can_manage_notes).toBe(true)
      expect(result?.can_view_notes).toBe(true)
    })

    it('should return null when no membership found (PGRST116)', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { code: 'PGRST116', message: 'Not found' } 
        }),
      } as any)

      const result = await getCoachPermissions('squad-1', 'coach-1')

      expect(result).toBeNull()
    })

    it('should return null when data is null', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any)

      const result = await getCoachPermissions('squad-1', 'coach-1')

      expect(result).toBeNull()
    })

    it('should throw error on database failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { code: '500', message: 'Database error' } 
        }),
      } as any)

      await expect(getCoachPermissions('squad-1', 'coach-1')).rejects.toThrow()
    })
  })

  describe('getSquadCoaches', () => {
    it('should get all coaches for a squad with coach details', async () => {
      const mockMemberships = [
        {
          id: 'membership-1',
          coach_id: 'coach-1',
          squad_id: 'squad-1',
          role: 'owner',
          created_at: '2024-01-01',
          created_by: null,
          updated_at: null,
          updated_by: null,
          can_manage_swimmers: true,
          can_manage_workouts: true,
          can_manage_results: true,
          can_manage_attendance: true,
          can_manage_schedules: true,
          can_view_analytics: true,
          can_manage_squad_settings: true,
          can_manage_coaches: true,
          can_manage_sessions: true,
          can_manage_notes: true,
          can_view_notes: true,
        },
        {
          id: 'membership-2',
          coach_id: 'coach-2',
          squad_id: 'squad-1',
          role: 'member',
          created_at: '2024-01-02',
          created_by: 'coach-1',
          updated_at: null,
          updated_by: null,
          can_manage_swimmers: false,
          can_manage_workouts: false,
          can_manage_results: false,
          can_manage_attendance: false,
          can_manage_schedules: false,
          can_view_analytics: false,
          can_manage_squad_settings: false,
          can_manage_coaches: false,
          can_manage_sessions: false,
          can_manage_notes: true,
          can_view_notes: true,
        },
      ]

      const mockCoaches = [
        { id: 'coach-1', first_name: 'John', last_name: 'Doe' },
        { id: 'coach-2', first_name: 'Jane', last_name: 'Smith' },
      ]

      const fromMock = vi.fn()
      
      // First call for memberships
      fromMock.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: mockMemberships, error: null }),
      })

      // Second call for coaches
      fromMock.mockReturnValueOnce({
        select: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({ data: mockCoaches, error: null }),
      })

      vi.mocked(supabase.from).mockImplementation(fromMock as any)

      const result = await getSquadCoaches('squad-1')

      expect(result).toHaveLength(2)
      expect(result[0].coach?.first_name).toBe('John')
      expect(result[1].coach?.first_name).toBe('Jane')
      expect(result[0].permissions.role).toBe('owner')
      expect(result[1].permissions.role).toBe('member')
    })

    it('should return empty array when no memberships found', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: [], error: null }),
      } as any)

      const result = await getSquadCoaches('squad-1')

      expect(result).toEqual([])
    })

    it('should return empty array when memberships is null', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ data: null, error: null }),
      } as any)

      const result = await getSquadCoaches('squad-1')

      expect(result).toEqual([])
    })

    it('should throw error on database failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockResolvedValue({ 
          data: null, 
          error: { message: 'Database error' } 
        }),
      } as any)

      await expect(getSquadCoaches('squad-1')).rejects.toThrow()
    })
  })

  describe('updateCoachPermissions', () => {
    it('should update permissions successfully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      } as any)

      const permissions = { can_manage_swimmers: true }
      await expect(updateCoachPermissions('membership-1', permissions, 'coach-1')).resolves.toBeUndefined()

      expect(supabase.from).toHaveBeenCalledWith('coach_squads')
    })

    it('should throw error on update failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        update: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ 
          error: { message: 'Update failed' } 
        }),
      } as any)

      await expect(updateCoachPermissions('membership-1', {}, 'coach-1')).rejects.toThrow()
    })
  })

  describe('removeCoachFromSquad', () => {
    it('should remove coach successfully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      } as any)

      await expect(removeCoachFromSquad('membership-1')).resolves.toBeUndefined()

      expect(supabase.from).toHaveBeenCalledWith('coach_squads')
    })

    it('should throw error on deletion failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ 
          error: { message: 'Delete failed' } 
        }),
      } as any)

      await expect(removeCoachFromSquad('membership-1')).rejects.toThrow()
    })
  })

  describe('inviteCoachToSquad', () => {
    it('should send invitation successfully', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      } as any)

      await expect(
        inviteCoachToSquad('squad-1', 'coach-1', 'newcoach@example.com', 'member', 'Welcome!')
      ).resolves.toBeUndefined()

      expect(supabase.from).toHaveBeenCalledWith('squad_invitations')
    })

    it('should use default role when not specified', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null })
      
      vi.mocked(supabase.from).mockReturnValue({
        insert: insertMock,
      } as any)

      await inviteCoachToSquad('squad-1', 'coach-1', 'newcoach@example.com')

      expect(insertMock).toHaveBeenCalledWith(
        expect.objectContaining({ role: 'member' })
      )
    })

    it('should throw error on invitation failure', async () => {
      vi.mocked(supabase.from).mockReturnValue({
        insert: vi.fn().mockResolvedValue({ 
          error: { message: 'Invitation failed' } 
        }),
      } as any)

      await expect(
        inviteCoachToSquad('squad-1', 'coach-1', 'newcoach@example.com')
      ).rejects.toThrow()
    })
  })
})
