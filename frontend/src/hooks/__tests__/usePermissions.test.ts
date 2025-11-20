import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { usePermissions } from '../usePermissions'
import { usePermissionStore } from '../../stores/permissionStore'
import { useAuth } from '../../contexts/AuthContext'
import type { SquadPermissions } from '../../services/permissionService'

// Mock the dependencies
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('../../stores/permissionStore', () => ({
  usePermissionStore: vi.fn(),
}))

describe('usePermissions', () => {
  const mockUser = { id: 'coach-1', email: 'coach@example.com' }
  const mockPermissions: SquadPermissions = {
    role: 'owner',
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

  let mockLoadPermissions: any
  let mockGetPermissions: any
  let mockHasPermission: any
  let mockIsOwner: any
  let mockIsAdmin: any
  let mockLoadingMap: Map<string, boolean>
  let mockErrorsMap: Map<string, string | null>

  beforeEach(() => {
    vi.clearAllMocks()

    mockLoadPermissions = vi.fn()
    mockGetPermissions = vi.fn()
    mockHasPermission = vi.fn()
    mockIsOwner = vi.fn()
    mockIsAdmin = vi.fn()
    mockLoadingMap = new Map()
    mockErrorsMap = new Map()

    // Setup default mocks
    vi.mocked(useAuth).mockReturnValue({
      user: mockUser,
      session: null,
      loading: false,
      signIn: vi.fn(),
      signOut: vi.fn(),
      sendPasswordResetEmail: vi.fn(),
      updatePassword: vi.fn(),
    } as any)

    // Setup permission store mock with selector pattern
    let callCount = 0
    vi.mocked(usePermissionStore).mockImplementation((selector: any) => {
      if (!selector) return {} as any
      
      const state = {
        permissions: new Map(),
        loading: mockLoadingMap,
        errors: mockErrorsMap,
        loadPermissions: mockLoadPermissions,
        getPermissions: mockGetPermissions,
        hasPermission: mockHasPermission,
        isOwner: mockIsOwner,
        isAdmin: mockIsAdmin,
        clearPermissions: vi.fn(),
        clearAllPermissions: vi.fn(),
      }
      
      return selector(state)
    }) as any
  })

  it('should return null permissions when squadId is undefined', () => {
    const { result } = renderHook(() => usePermissions(undefined))

    expect(result.current.permissions).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should return null permissions when user is not authenticated', () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      session: null,
      loading: false,
    } as any)

    mockGetPermissions.mockReturnValue(null)
    mockLoadingMap.set('squad-1', false)

    const { result } = renderHook(() => usePermissions('squad-1'))

    expect(result.current.permissions).toBeNull()
    expect(result.current.loading).toBe(false)
    expect(mockLoadPermissions).not.toHaveBeenCalled()
  })

  it('should load permissions on mount', async () => {
    mockGetPermissions.mockReturnValue(null)
    mockLoadingMap.set('squad-1', false)

    const { result } = renderHook(() => usePermissions('squad-1'))

    await waitFor(() => {
      expect(mockLoadPermissions).toHaveBeenCalledWith('squad-1', 'coach-1')
    })
  })

  it('should not reload if permissions already exist', () => {
    mockGetPermissions.mockReturnValue(mockPermissions)
    mockLoadingMap.set('squad-1', false)

    renderHook(() => usePermissions('squad-1'))

    expect(mockLoadPermissions).not.toHaveBeenCalled()
  })

  it('should return permissions from store', () => {
    mockGetPermissions.mockReturnValue(mockPermissions)
    mockLoadingMap.set('squad-1', false)
    mockErrorsMap.set('squad-1', null)

    const { result } = renderHook(() => usePermissions('squad-1'))

    expect(result.current.permissions).toEqual(mockPermissions)
    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBeNull()
  })

  it('should check permissions correctly', () => {
    mockGetPermissions.mockReturnValue(mockPermissions)
    mockHasPermission.mockReturnValue(true)

    const { result } = renderHook(() => usePermissions('squad-1'))

    const canManage = result.current.hasPermission('can_manage_swimmers')
    
    expect(mockHasPermission).toHaveBeenCalledWith('squad-1', 'can_manage_swimmers')
    expect(canManage).toBe(true)
  })

  it('should check if user is owner', () => {
    mockGetPermissions.mockReturnValue(mockPermissions)
    mockIsOwner.mockReturnValue(true)

    const { result } = renderHook(() => usePermissions('squad-1'))

    const owner = result.current.isOwner()
    
    expect(mockIsOwner).toHaveBeenCalledWith('squad-1')
    expect(owner).toBe(true)
  })

  it('should check if user is admin', () => {
    mockGetPermissions.mockReturnValue(mockPermissions)
    mockIsAdmin.mockReturnValue(true)

    const { result } = renderHook(() => usePermissions('squad-1'))

    const admin = result.current.isAdmin()
    
    expect(mockIsAdmin).toHaveBeenCalledWith('squad-1')
    expect(admin).toBe(true)
  })

  it('should allow manual reload of permissions', () => {
    mockGetPermissions.mockReturnValue(mockPermissions)

    const { result } = renderHook(() => usePermissions('squad-1'))

    result.current.reload()

    expect(mockLoadPermissions).toHaveBeenCalledWith('squad-1', 'coach-1')
  })

  it('should return false for permission checks when squadId is undefined', () => {
    const { result } = renderHook(() => usePermissions(undefined))

    expect(result.current.hasPermission('can_manage_swimmers')).toBe(false)
    expect(result.current.isOwner()).toBe(false)
    expect(result.current.isAdmin()).toBe(false)
  })
})
