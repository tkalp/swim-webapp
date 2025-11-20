import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { usePermissionStore } from '../permissionStore'
import * as permissionService from '@/services/permissionService'

vi.mock('../../services/permissionService', () => ({
  getCoachPermissions: vi.fn(),
  DEFAULT_PERMISSIONS: {
    owner: {
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
  },
}))

describe('permissionStore', () => {
  beforeEach(() => {
    // Reset store before each test
    usePermissionStore.setState({
      permissions: new Map(),
      loading: new Map(),
      errors: new Map(),
    })
    vi.clearAllMocks()
  })

  describe('initial state', () => {
    it('should have empty maps initially', () => {
      const { result } = renderHook(() => usePermissionStore())
      expect(result.current.permissions.size).toBe(0)
      expect(result.current.loading.size).toBe(0)
      expect(result.current.errors.size).toBe(0)
    })
  })

  describe('loadPermissions', () => {
    it('should load permissions successfully', async () => {
      const mockPermissions = {
        role: 'owner' as const,
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
      }

      vi.mocked(permissionService.getCoachPermissions).mockResolvedValue(mockPermissions)

      const { result } = renderHook(() => usePermissionStore())

      await act(async () => {
        await result.current.loadPermissions('squad-1', 'coach-1')
      })

      expect(result.current.permissions.get('squad-1')).toEqual(mockPermissions)
      expect(result.current.loading.get('squad-1')).toBe(false)
      expect(result.current.errors.get('squad-1')).toBeNull()
    })

    it('should set loading state while fetching', async () => {
      let resolvePromise: any
      const promise = new Promise((resolve) => {
        resolvePromise = resolve
      })

      vi.mocked(permissionService.getCoachPermissions).mockReturnValue(promise as any)

      const { result } = renderHook(() => usePermissionStore())

      act(() => {
        result.current.loadPermissions('squad-1', 'coach-1')
      })

      // Should be loading
      expect(result.current.loading.get('squad-1')).toBe(true)

      // Resolve the promise
      await act(async () => {
        resolvePromise({ role: 'owner' })
      })

      expect(result.current.loading.get('squad-1')).toBe(false)
    })

    it('should handle errors and set error state', async () => {
      const errorMessage = 'Failed to fetch permissions'
      vi.mocked(permissionService.getCoachPermissions).mockRejectedValue(new Error(errorMessage))

      const { result } = renderHook(() => usePermissionStore())

      await act(async () => {
        await result.current.loadPermissions('squad-1', 'coach-1')
      })

      expect(result.current.errors.get('squad-1')).toBe(errorMessage)
      expect(result.current.loading.get('squad-1')).toBe(false)
    })

    it('should handle null permissions', async () => {
      vi.mocked(permissionService.getCoachPermissions).mockResolvedValue(null)

      const { result } = renderHook(() => usePermissionStore())

      await act(async () => {
        await result.current.loadPermissions('squad-1', 'coach-1')
      })

      expect(result.current.permissions.get('squad-1')).toBeNull()
      expect(result.current.errors.get('squad-1')).toBeNull()
    })
  })

  describe('hasPermission', () => {
    it('should return true when permission exists', async () => {
      const mockPermissions = {
        role: 'owner' as const,
        can_manage_swimmers: true,
        can_manage_workouts: false,
      } as any

      const { result } = renderHook(() => usePermissionStore())

      act(() => {
        const newPerms = new Map()
        newPerms.set('squad-1', mockPermissions)
        usePermissionStore.setState({ permissions: newPerms })
      })

      expect(result.current.hasPermission('squad-1', 'can_manage_swimmers')).toBe(true)
      expect(result.current.hasPermission('squad-1', 'can_manage_workouts')).toBe(false)
    })

    it('should return false when no permissions loaded', () => {
      const { result } = renderHook(() => usePermissionStore())
      expect(result.current.hasPermission('squad-1', 'can_manage_swimmers')).toBe(false)
    })
  })

  describe('isOwner', () => {
    it('should return true for owner role', () => {
      const { result } = renderHook(() => usePermissionStore())

      act(() => {
        const newPerms = new Map()
        newPerms.set('squad-1', { role: 'owner' } as any)
        usePermissionStore.setState({ permissions: newPerms })
      })

      expect(result.current.isOwner('squad-1')).toBe(true)
    })

    it('should return false for non-owner roles', () => {
      const { result } = renderHook(() => usePermissionStore())

      act(() => {
        const newPerms = new Map()
        newPerms.set('squad-1', { role: 'admin' } as any)
        usePermissionStore.setState({ permissions: newPerms })
      })

      expect(result.current.isOwner('squad-1')).toBe(false)
    })
  })

  describe('isAdmin', () => {
    it('should return true for admin role', () => {
      const { result } = renderHook(() => usePermissionStore())

      act(() => {
        const newPerms = new Map()
        newPerms.set('squad-1', { role: 'admin' } as any)
        usePermissionStore.setState({ permissions: newPerms })
      })

      expect(result.current.isAdmin('squad-1')).toBe(true)
    })

    it('should return true for owner role', () => {
      const { result } = renderHook(() => usePermissionStore())

      act(() => {
        const newPerms = new Map()
        newPerms.set('squad-1', { role: 'owner' } as any)
        usePermissionStore.setState({ permissions: newPerms })
      })

      expect(result.current.isAdmin('squad-1')).toBe(true)
    })

    it('should return false for member role', () => {
      const { result } = renderHook(() => usePermissionStore())

      act(() => {
        const newPerms = new Map()
        newPerms.set('squad-1', { role: 'member' } as any)
        usePermissionStore.setState({ permissions: newPerms })
      })

      expect(result.current.isAdmin('squad-1')).toBe(false)
    })
  })

  describe('clearPermissions', () => {
    it('should clear permissions for specific squad', () => {
      const { result } = renderHook(() => usePermissionStore())

      act(() => {
        const newPerms = new Map()
        newPerms.set('squad-1', { role: 'owner' } as any)
        newPerms.set('squad-2', { role: 'admin' } as any)
        usePermissionStore.setState({ permissions: newPerms })
      })

      act(() => {
        result.current.clearPermissions('squad-1')
      })

      expect(result.current.permissions.has('squad-1')).toBe(false)
      expect(result.current.permissions.has('squad-2')).toBe(true)
    })
  })

  describe('clearAllPermissions', () => {
    it('should clear all permissions', () => {
      const { result } = renderHook(() => usePermissionStore())

      act(() => {
        const newPerms = new Map()
        newPerms.set('squad-1', { role: 'owner' } as any)
        newPerms.set('squad-2', { role: 'admin' } as any)
        usePermissionStore.setState({ permissions: newPerms })
      })

      act(() => {
        result.current.clearAllPermissions()
      })

      expect(result.current.permissions.size).toBe(0)
      expect(result.current.loading.size).toBe(0)
      expect(result.current.errors.size).toBe(0)
    })
  })

  describe('getPermissions', () => {
    it('should return permissions for squad', () => {
      const mockPermissions = { role: 'owner' as const } as any
      const { result } = renderHook(() => usePermissionStore())

      act(() => {
        const newPerms = new Map()
        newPerms.set('squad-1', mockPermissions)
        usePermissionStore.setState({ permissions: newPerms })
      })

      expect(result.current.getPermissions('squad-1')).toEqual(mockPermissions)
    })

    it('should return null for non-existent squad', () => {
      const { result } = renderHook(() => usePermissionStore())
      expect(result.current.getPermissions('squad-999')).toBeNull()
    })
  })
})
