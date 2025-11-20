// hooks/usePermissions.ts
import { useEffect, useCallback } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { usePermissionStore } from '../stores/permissionStore'
import type { SquadPermissions } from '../services/permissionService'

/**
 * Hook to manage squad permissions for the current user
 * Replaces the old useSquadPermissions hook with a cleaner, store-based approach
 * 
 * @param squadId - The ID of the squad to check permissions for
 * @returns Permission state and helper functions
 */
export function usePermissions(squadId: string | undefined) {
  const { user } = useAuth()
  const loadPermissions = usePermissionStore((state) => state.loadPermissions)
  const getPermissions = usePermissionStore((state) => state.getPermissions)
  const hasPermissionFn = usePermissionStore((state) => state.hasPermission)
  const isOwnerFn = usePermissionStore((state) => state.isOwner)
  const isAdminFn = usePermissionStore((state) => state.isAdmin)
  
  // Get state for this specific squad
  const permissions = squadId ? getPermissions(squadId) : null
  const loading = usePermissionStore((state) => 
    squadId ? state.loading.get(squadId) ?? false : false
  )
  const error = usePermissionStore((state) => 
    squadId ? state.errors.get(squadId) ?? null : null
  )

  // Load permissions on mount or when dependencies change
  useEffect(() => {
    if (!squadId || !user?.id) {
      return
    }

    // Only load if we don't have permissions yet and not currently loading
    if (!permissions && !loading) {
      loadPermissions(squadId, user.id)
    }
  }, [squadId, user?.id, permissions, loading, loadPermissions])

  // Helper to check a specific permission
  const hasPermission = useCallback(
    (permission: keyof Omit<SquadPermissions, 'role'>): boolean => {
      if (!squadId) return false
      return hasPermissionFn(squadId, permission)
    },
    [squadId, hasPermissionFn]
  )

  // Helper to check if user is owner
  const isOwner = useCallback((): boolean => {
    if (!squadId) return false
    return isOwnerFn(squadId)
  }, [squadId, isOwnerFn])

  // Helper to check if user is admin (includes owner)
  const isAdmin = useCallback((): boolean => {
    if (!squadId) return false
    return isAdminFn(squadId)
  }, [squadId, isAdminFn])

  // Reload permissions manually
  const reload = useCallback(() => {
    if (squadId && user?.id) {
      loadPermissions(squadId, user.id)
    }
  }, [squadId, user?.id, loadPermissions])

  return {
    permissions,
    loading,
    error,
    hasPermission,
    isOwner,
    isAdmin,
    reload,
  }
}
