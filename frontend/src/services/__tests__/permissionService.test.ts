import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  getCoachPermissions,
  getSquadCoaches,
  updateCoachPermissions,
  removeCoachFromSquad,
  inviteCoachToSquad,
} from '../permissionService'
import { apiClient } from '@/lib/apiClient'

describe('permissionService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getCoachPermissions', () => {
    it('should get owner permissions from database', async () => {
      const mockMemberships = [
        {
          id: 'membership-1',
          coach_id: 'coach-1',
          squad_id: 'squad-1',
          role: 'owner',
          can_manage_swimmers: true,
          can_manage_workouts: true,
          can_manage_results: true,
          can_manage_attendance: true,
          can_manage_schedules: true,
          can_manage_notes: true,
          can_view_analytics: true,
          can_manage_squad_settings: true,
        },
      ]

      vi.mocked(apiClient.get).mockResolvedValue(mockMemberships)

      const result = await getCoachPermissions('squad-1', 'coach-1')

      expect(result).toEqual({
        role: 'owner',
        can_manage_swimmers: true,
        can_manage_workouts: true,
        can_manage_results: true,
        can_manage_attendance: true,
        can_manage_schedules: true,
        can_manage_notes: true,
        can_view_analytics: true,
        can_manage_squad_settings: true,
      })
      expect(apiClient.get).toHaveBeenCalledWith('/permissions/squad/squad-1/coaches')
    })

    it('should get admin permissions from database', async () => {
      const mockMemberships = [
        {
          id: 'membership-1',
          coach_id: 'coach-1',
          squad_id: 'squad-1',
          role: 'admin',
          can_manage_swimmers: true,
          can_manage_workouts: true,
          can_manage_results: true,
          can_manage_attendance: true,
          can_manage_schedules: true,
          can_manage_notes: true,
          can_view_analytics: true,
          can_manage_squad_settings: false,
        },
      ]

      vi.mocked(apiClient.get).mockResolvedValue(mockMemberships)

      const result = await getCoachPermissions('squad-1', 'coach-1')

      expect(result?.role).toBe('admin')
      expect(result?.can_manage_squad_settings).toBe(false)
    })

    it('should get member permissions from database', async () => {
      const mockMemberships = [
        {
          id: 'membership-1',
          coach_id: 'coach-1',
          squad_id: 'squad-1',
          role: 'member',
          can_manage_swimmers: false,
          can_manage_workouts: false,
          can_manage_results: false,
          can_manage_attendance: false,
          can_manage_schedules: false,
          can_manage_notes: true,
          can_view_analytics: false,
          can_manage_squad_settings: false,
        },
      ]

      vi.mocked(apiClient.get).mockResolvedValue(mockMemberships)

      const result = await getCoachPermissions('squad-1', 'coach-1')

      expect(result?.role).toBe('member')
      expect(result?.can_manage_swimmers).toBe(false)
      expect(result?.can_manage_notes).toBe(true)
    })

    it('should return null when no membership found', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([])

      const result = await getCoachPermissions('squad-1', 'coach-1')

      expect(result).toBeNull()
    })

    it('should throw error on fetch failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch permissions'))

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
          can_manage_notes: true,
          can_view_analytics: true,
          can_manage_squad_settings: true,
          coach: { id: 'coach-1', first_name: 'John', last_name: 'Doe' },
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
          can_manage_notes: true,
          can_view_analytics: false,
          can_manage_squad_settings: false,
          coach: { id: 'coach-2', first_name: 'Jane', last_name: 'Smith' },
        },
      ]

      vi.mocked(apiClient.get).mockResolvedValue(mockMemberships)

      const result = await getSquadCoaches('squad-1')

      expect(result).toHaveLength(2)
      expect(result[0].coach?.first_name).toBe('John')
      expect(result[1].coach?.first_name).toBe('Jane')
      expect(result[0].permissions.role).toBe('owner')
      expect(result[1].permissions.role).toBe('member')
      expect(apiClient.get).toHaveBeenCalledWith('/permissions/squad/squad-1/coaches')
    })

    it('should return empty array when no memberships found', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([])

      const result = await getSquadCoaches('squad-1')

      expect(result).toEqual([])
    })

    it('should return empty array when memberships is null', async () => {
      vi.mocked(apiClient.get).mockResolvedValue(null)

      const result = await getSquadCoaches('squad-1')

      expect(result).toEqual([])
    })

    it('should throw error on fetch failure', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch coaches'))

      await expect(getSquadCoaches('squad-1')).rejects.toThrow()
    })
  })

  describe('updateCoachPermissions', () => {
    it('should update permissions successfully', async () => {
      vi.mocked(apiClient.put).mockResolvedValue(undefined)

      const permissions = { can_manage_swimmers: true }
      await expect(updateCoachPermissions('membership-1', permissions, 'coach-1')).resolves.toBeUndefined()

      expect(apiClient.put).toHaveBeenCalledWith('/permissions/squad-coach/membership-1', {
        can_manage_swimmers: true,
        updated_by: 'coach-1',
      })
    })

    it('should throw error on update failure', async () => {
      vi.mocked(apiClient.put).mockRejectedValue(new Error('Update failed'))

      await expect(updateCoachPermissions('membership-1', {}, 'coach-1')).rejects.toThrow()
    })
  })

  describe('removeCoachFromSquad', () => {
    it('should remove coach successfully', async () => {
      vi.mocked(apiClient.delete).mockResolvedValue(undefined)

      await expect(removeCoachFromSquad('membership-1')).resolves.toBeUndefined()

      expect(apiClient.delete).toHaveBeenCalledWith('/permissions/squad-coach/membership-1')
    })

    it('should throw error on deletion failure', async () => {
      vi.mocked(apiClient.delete).mockRejectedValue(new Error('Delete failed'))

      await expect(removeCoachFromSquad('membership-1')).rejects.toThrow()
    })
  })

  describe('inviteCoachToSquad', () => {
    it('should send invitation successfully', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined)

      await expect(
        inviteCoachToSquad('squad-1', 'coach-1', 'newcoach@example.com', 'member', 'Welcome!')
      ).resolves.toBeUndefined()

      expect(apiClient.post).toHaveBeenCalledWith('/permissions/invitations', {
        squad_id: 'squad-1',
        email: 'newcoach@example.com',
        role: 'member',
      })
    })

    it('should use default role when not specified', async () => {
      vi.mocked(apiClient.post).mockResolvedValue(undefined)

      await inviteCoachToSquad('squad-1', 'coach-1', 'newcoach@example.com')

      expect(apiClient.post).toHaveBeenCalledWith('/permissions/invitations', {
        squad_id: 'squad-1',
        email: 'newcoach@example.com',
        role: 'member',
      })
    })

    it('should throw error on invitation failure', async () => {
      vi.mocked(apiClient.post).mockRejectedValue(new Error('Invitation failed'))

      await expect(
        inviteCoachToSquad('squad-1', 'coach-1', 'newcoach@example.com')
      ).rejects.toThrow()
    })
  })
})
