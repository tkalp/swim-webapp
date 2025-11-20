// stores/permissionStore.ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { 
  getCoachPermissions, 
  type SquadPermissions 
} from '../services/permissionService'

interface PermissionState {
  // State - Map of squadId -> permissions
  permissions: Map<string, SquadPermissions | null>
  loading: Map<string, boolean>
  errors: Map<string, string | null>
  
  // Actions
  loadPermissions: (squadId: string, coachId: string) => Promise<void>
  clearPermissions: (squadId: string) => void
  clearAllPermissions: () => void
  hasPermission: (squadId: string, permission: keyof Omit<SquadPermissions, 'role'>) => boolean
  isOwner: (squadId: string) => boolean
  isAdmin: (squadId: string) => boolean
  getPermissions: (squadId: string) => SquadPermissions | null
}

export const usePermissionStore = create<PermissionState>()(
  devtools(
    (set, get) => ({
      // Initial state
      permissions: new Map(),
      loading: new Map(),
      errors: new Map(),

      // Actions
      loadPermissions: async (squadId: string, coachId: string) => {
        // Set loading state
        const { loading } = get()
        const newLoading = new Map(loading)
        newLoading.set(squadId, true)
        set({ loading: newLoading })

        try {
          const permissions = await getCoachPermissions(squadId, coachId)
          
          const { permissions: perms, errors } = get()
          const newPermissions = new Map(perms)
          const newErrors = new Map(errors)
          const newLoadingMap = new Map(get().loading)
          
          newPermissions.set(squadId, permissions)
          newErrors.set(squadId, null)
          newLoadingMap.set(squadId, false)
          
          set({ 
            permissions: newPermissions, 
            errors: newErrors,
            loading: newLoadingMap 
          })
        } catch (error) {
          const { errors } = get()
          const newErrors = new Map(errors)
          const newLoadingMap = new Map(get().loading)
          
          newErrors.set(squadId, error instanceof Error ? error.message : 'Failed to load permissions')
          newLoadingMap.set(squadId, false)
          
          set({ errors: newErrors, loading: newLoadingMap })
        }
      },

      clearPermissions: (squadId: string) => {
        const { permissions, loading, errors } = get()
        const newPermissions = new Map(permissions)
        const newLoading = new Map(loading)
        const newErrors = new Map(errors)
        
        newPermissions.delete(squadId)
        newLoading.delete(squadId)
        newErrors.delete(squadId)
        
        set({ 
          permissions: newPermissions, 
          loading: newLoading, 
          errors: newErrors 
        })
      },

      clearAllPermissions: () => {
        set({ 
          permissions: new Map(), 
          loading: new Map(), 
          errors: new Map() 
        })
      },

      hasPermission: (squadId: string, permission: keyof Omit<SquadPermissions, 'role'>) => {
        const perms = get().permissions.get(squadId)
        if (!perms) return false
        return perms[permission] === true
      },

      isOwner: (squadId: string) => {
        const perms = get().permissions.get(squadId)
        return perms?.role === 'owner'
      },

      isAdmin: (squadId: string) => {
        const perms = get().permissions.get(squadId)
        return perms?.role === 'admin' || perms?.role === 'owner'
      },

      getPermissions: (squadId: string) => {
        return get().permissions.get(squadId) || null
      },
    }),
    { name: 'PermissionStore' }
  )
)
