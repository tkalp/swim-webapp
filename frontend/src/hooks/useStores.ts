/**
 * Custom hooks for accessing store state in components.
 * These hooks provide optimized selectors to prevent unnecessary re-renders.
 */

import { useAuthStore } from '@/stores/authStore'
import { useSwimmerStore } from '@/stores/swimmerStore'
import { useSquadStore } from '@/stores/squadStore'
import { useUIStore } from '@/stores/uiStore'
import { useMemo } from 'react'

// ============ Auth Hooks ============

export function useCurrentUser() {
  return useAuthStore(state => state.user)
}

export function useSession() {
  return useAuthStore(state => state.session)
}

export function useAuthLoading() {
  return useAuthStore(state => state.loading)
}

export function useAuthActions() {
  return {
    signIn: useAuthStore(state => state.signIn),
    signOut: useAuthStore(state => state.signOut),
    sendPasswordResetEmail: useAuthStore(state => state.sendPasswordResetEmail),
    updatePassword: useAuthStore(state => state.updatePassword),
  }
}

// ============ Swimmer Hooks ============

export function useSwimmer(swimmerId: string | null) {
  return useSwimmerStore(state => 
    swimmerId ? state.getSwimmer(swimmerId) : undefined
  )
}

export function useSwimmersBySquad(squadId: string | null) {
  const swimmerIds = useSwimmerStore(state => 
    squadId ? state.swimmersBySquad.get(squadId) : undefined
  )
  const swimmers = useSwimmerStore(state => state.swimmers)
  
  return useMemo(() => {
    if (!swimmerIds) return []
    return swimmerIds
      .map(id => swimmers.get(id))
      .filter((swimmer): swimmer is import('../services/swimmerService').Swimmer => swimmer !== undefined)
  }, [swimmerIds, swimmers])
}

export function useSelectedSwimmer() {
  const selectedId = useSwimmerStore(state => state.selectedSwimmerId)
  return useSwimmerStore(state => 
    selectedId ? state.getSwimmer(selectedId) : undefined
  )
}

export function useSwimmerActions() {
  return {
    setSwimmers: useSwimmerStore(state => state.setSwimmers),
    addSwimmer: useSwimmerStore(state => state.addSwimmer),
    updateSwimmer: useSwimmerStore(state => state.updateSwimmer),
    removeSwimmer: useSwimmerStore(state => state.removeSwimmer),
    setSelectedSwimmer: useSwimmerStore(state => state.setSelectedSwimmer),
  }
}

// ============ Squad Hooks ============

export function useSquad(squadId: string | null) {
  return useSquadStore(state => 
    squadId ? state.getSquad(squadId) : undefined
  )
}

export function useAllSquads() {
  const squadsMap = useSquadStore(state => state.squads)
  // Convert Map to array, memoized to prevent infinite re-renders
  return useMemo(() => Array.from(squadsMap.values()), [squadsMap])
}

export function useSelectedSquad() {
  const selectedId = useSquadStore(state => state.selectedSquadId)
  return useSquadStore(state => 
    selectedId ? state.getSquad(selectedId) : undefined
  )
}

export function useSquadDetails(squadId: string | null) {
  return useSquadStore(state => 
    squadId ? state.getSquadDetails(squadId) : undefined
  )
}

export function useSquadSchedules(squadId: string | null) {
  return useSquadStore(state => 
    squadId ? state.squadDetails.get(squadId)?.schedules : undefined
  )
}

export function useSquadSessions(squadId: string | null) {
  return useSquadStore(state => 
    squadId ? state.squadDetails.get(squadId)?.sessions : undefined
  )
}

export function useSquadEvents(squadId: string | null) {
  return useSquadStore(state => 
    squadId ? state.squadDetails.get(squadId)?.events : undefined
  )
}

export function useSquadActions() {
  return {
    setSquads: useSquadStore(state => state.setSquads),
    addSquad: useSquadStore(state => state.addSquad),
    updateSquad: useSquadStore(state => state.updateSquad),
    removeSquad: useSquadStore(state => state.removeSquad),
    setSelectedSquad: useSquadStore(state => state.setSelectedSquad),
    setSquadDetails: useSquadStore(state => state.setSquadDetails),
    setSchedules: useSquadStore(state => state.setSchedules),
    setSessions: useSquadStore(state => state.setSessions),
    setEvents: useSquadStore(state => state.setEvents),
  }
}

// ============ UI Hooks ============

export function useModal(modalId: string) {
  const isOpen = useUIStore(state => state.isModalOpen(modalId))
  const data = useUIStore(state => state.getModalData(modalId))
  const open = useUIStore(state => state.openModal)
  const close = useUIStore(state => state.closeModal)
  
  return {
    isOpen,
    data,
    open: (data?: any) => open(modalId, data),
    close: () => close(modalId),
  }
}

export function useToast() {
  return {
    addToast: useUIStore(state => state.addToast),
    removeToast: useUIStore(state => state.removeToast),
    success: (message: string) => useUIStore.getState().addToast({ message, type: 'success' }),
    error: (message: string) => useUIStore.getState().addToast({ message, type: 'error' }),
    info: (message: string) => useUIStore.getState().addToast({ message, type: 'info' }),
    warning: (message: string) => useUIStore.getState().addToast({ message, type: 'warning' }),
  }
}

export function useLoading(key?: string) {
  const globalLoading = useUIStore(state => state.globalLoading)
  const isLoading = useUIStore(state => key ? state.isLoading(key) : false)
  const setLoading = useUIStore(state => state.setLoading)
  
  return {
    loading: key ? isLoading : globalLoading,
    setLoading: key ? (loading: boolean) => setLoading(key, loading) : useUIStore.getState().setGlobalLoading,
  }
}

export function useSearch() {
  const query = useUIStore(state => state.searchQuery)
  const setQuery = useUIStore(state => state.setSearchQuery)
  
  return { query, setQuery }
}

export function useFilters() {
  return {
    setFilter: useUIStore(state => state.setFilter),
    removeFilter: useUIStore(state => state.removeFilter),
    clearFilters: useUIStore(state => state.clearFilters),
    getFilter: useUIStore(state => state.getFilter),
  }
}

export function useSidebar() {
  const isOpen = useUIStore(state => state.sidebarOpen)
  const toggle = useUIStore(state => state.toggleSidebar)
  const setOpen = useUIStore(state => state.setSidebarOpen)
  
  return { isOpen, toggle, setOpen }
}
