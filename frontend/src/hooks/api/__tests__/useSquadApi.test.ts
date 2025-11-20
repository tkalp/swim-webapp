import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSquadApi } from '../useSquadApi'
import { useSquadStore } from '../../../stores/squadStore'
import { useUIStore } from '../../../stores/uiStore'
import * as squadService from '../../../services/squadService'
import { mockSquad, mockSquadCard } from '../../../__tests__/testUtils'

// Mock the services
vi.mock('../../../services/squadService', () => ({
  getSquadsForCoach: vi.fn(),
  getSquadById: vi.fn(),
  createSquad: vi.fn(),
  updateSquad: vi.fn(),
  deleteSquad: vi.fn(),
}))

describe('useSquadApi', () => {
  beforeEach(() => {
    // Reset stores
    useSquadStore.setState({
      squads: new Map(),
      squadDetails: new Map(),
      loading: false,
      error: null,
      selectedSquadId: null,
    })
    
    useUIStore.setState({
      toasts: [],
      modals: new Map(),
      globalLoading: false,
      loadingStates: new Map(),
      searchQuery: '',
      filters: new Map(),
      sidebarOpen: true,
    })

    // Clear all mocks
    vi.clearAllMocks()
  })

  describe('fetchSquadsForCoach', () => {
    it('should fetch squads and update store', async () => {
      const squads = [mockSquadCard, { ...mockSquadCard, id: 'squad-2' }]
      vi.mocked(squadService.getSquadsForCoach).mockResolvedValue(squads)

      const { result } = renderHook(() => useSquadApi())

      let returnedSquads: any
      await act(async () => {
        returnedSquads = await result.current.fetchSquadsForCoach('coach-1')
      })

      expect(squadService.getSquadsForCoach).toHaveBeenCalledWith('coach-1')
      expect(returnedSquads).toEqual(squads)
      
      // Check store was updated
      const store = useSquadStore.getState()
      expect(store.squads.size).toBe(2)
      expect(store.squads.get('squad-1')).toEqual(mockSquadCard)
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Failed to fetch squads')
      vi.mocked(squadService.getSquadsForCoach).mockRejectedValue(error)

      const { result } = renderHook(() => useSquadApi())

      await act(async () => {
        try {
          await result.current.fetchSquadsForCoach('coach-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts.length).toBe(1)
      expect(uiStore.toasts[0].type).toBe('error')
      expect(uiStore.toasts[0].message).toBe('Failed to fetch squads')
    })
  })

  describe('fetchSquad', () => {
    it('should fetch single squad and update details', async () => {
      vi.mocked(squadService.getSquadById).mockResolvedValue(mockSquad)

      const { result } = renderHook(() => useSquadApi())

      let returnedSquad: any
      await act(async () => {
        returnedSquad = await result.current.fetchSquad('squad-1')
      })

      expect(squadService.getSquadById).toHaveBeenCalledWith('squad-1')
      expect(returnedSquad).toEqual(mockSquad)
      
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details).toBeDefined()
    })

    it('should handle null squad', async () => {
      vi.mocked(squadService.getSquadById).mockResolvedValue(null)

      const { result } = renderHook(() => useSquadApi())

      let returnedSquad: any
      await act(async () => {
        returnedSquad = await result.current.fetchSquad('squad-1')
      })

      expect(returnedSquad).toBeNull()
      
      const store = useSquadStore.getState()
      expect(store.squadDetails.size).toBe(0)
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Squad not found')
      vi.mocked(squadService.getSquadById).mockRejectedValue(error)

      const { result } = renderHook(() => useSquadApi())

      await act(async () => {
        try {
          await result.current.fetchSquad('squad-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
    })
  })

  describe('createSquad', () => {
    it('should create squad and add to store', async () => {
      const createData = {
        name: 'New Squad',
        description: 'Test description',
      }
      
      vi.mocked(squadService.createSquad).mockResolvedValue(mockSquad)

      const { result } = renderHook(() => useSquadApi())

      let newSquad: any
      await act(async () => {
        newSquad = await result.current.createSquad('coach-1', createData)
      })

      expect(squadService.createSquad).toHaveBeenCalledWith('coach-1', createData)
      expect(newSquad).toEqual(mockSquad)
      
      const store = useSquadStore.getState()
      const squad = store.squads.get('squad-1')
      expect(squad).toBeDefined()
      expect(squad?.role).toBe('owner')
      expect(squad?.swimmers_count).toBe(0)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Squad created successfully')
    })

    it('should show error toast on failure', async () => {
      const createData = {
        name: 'New Squad',
        description: 'Test description',
      }
      
      const error = new Error('Database error')
      vi.mocked(squadService.createSquad).mockRejectedValue(error)

      const { result } = renderHook(() => useSquadApi())

      await act(async () => {
        try {
          await result.current.createSquad('coach-1', createData)
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
      expect(uiStore.toasts[0].message).toBe('Database error')
    })
  })

  describe('updateSquad', () => {
    it('should update squad and sync store', async () => {
      const updates = { name: 'Updated Squad' }
      const updatedSquad = { ...mockSquad, name: 'Updated Squad' }
      
      vi.mocked(squadService.updateSquad).mockResolvedValue(updatedSquad)

      // Add squad to store first
      useSquadStore.getState().addSquad(mockSquadCard)

      const { result } = renderHook(() => useSquadApi())

      let updated: any
      await act(async () => {
        updated = await result.current.updateSquad('squad-1', updates)
      })

      expect(squadService.updateSquad).toHaveBeenCalledWith('squad-1', updates)
      expect(updated).toEqual(updatedSquad)
      
      const store = useSquadStore.getState()
      expect(store.squads.get('squad-1')?.name).toBe('Updated Squad')
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Squad updated successfully')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Update failed')
      vi.mocked(squadService.updateSquad).mockRejectedValue(error)

      const { result } = renderHook(() => useSquadApi())

      await act(async () => {
        try {
          await result.current.updateSquad('squad-1', { name: 'Updated' })
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
    })
  })

  describe('deleteSquad', () => {
    it('should delete squad and remove from store', async () => {
      vi.mocked(squadService.deleteSquad).mockResolvedValue(undefined)

      // Add squad to store first
      useSquadStore.getState().addSquad(mockSquadCard)

      const { result } = renderHook(() => useSquadApi())

      await act(async () => {
        await result.current.deleteSquad('squad-1')
      })

      expect(squadService.deleteSquad).toHaveBeenCalledWith('squad-1')
      
      const store = useSquadStore.getState()
      expect(store.squads.has('squad-1')).toBe(false)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Squad deleted successfully')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Delete failed')
      vi.mocked(squadService.deleteSquad).mockRejectedValue(error)

      const { result } = renderHook(() => useSquadApi())

      await act(async () => {
        try {
          await result.current.deleteSquad('squad-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
      expect(uiStore.toasts[0].message).toBe('Delete failed')
    })
  })
})
