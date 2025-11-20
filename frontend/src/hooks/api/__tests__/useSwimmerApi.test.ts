import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useSwimmerApi } from '../useSwimmerApi'
import { useSwimmerStore } from '../../../stores/swimmerStore'
import { useUIStore } from '../../../stores/uiStore'
import * as swimmerService from '../../../services/swimmerService'
import { mockSwimmer } from '../../../__tests__/testUtils'

// Mock the services
vi.mock('../../../services/swimmerService', () => ({
  getSwimmersBySquad: vi.fn(),
  getSwimmerById: vi.fn(),
  createSwimmer: vi.fn(),
  updateSwimmer: vi.fn(),
  deleteSwimmer: vi.fn(),
  createSwimmerWithExternalLink: vi.fn(),
  triggerSwimmerSync: vi.fn(),
  cancelSwimmerSync: vi.fn(),
}))

describe('useSwimmerApi', () => {
  beforeEach(() => {
    // Reset stores
    useSwimmerStore.setState({
      swimmers: new Map(),
      swimmersBySquad: new Map(),
      loading: false,
      error: null,
      selectedSwimmerId: null,
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

  describe('fetchSwimmersBySquad', () => {
    it('should fetch swimmers and update store', async () => {
      const swimmers = [mockSwimmer, { ...mockSwimmer, id: 'swimmer-2' }]
      vi.mocked(swimmerService.getSwimmersBySquad).mockResolvedValue(swimmers)

      const { result } = renderHook(() => useSwimmerApi())

      let returnedSwimmers: any
      await act(async () => {
        returnedSwimmers = await result.current.fetchSwimmersBySquad('squad-1')
      })

      expect(swimmerService.getSwimmersBySquad).toHaveBeenCalledWith('squad-1')
      expect(returnedSwimmers).toEqual(swimmers)
      
      // Check store was updated
      const store = useSwimmerStore.getState()
      expect(store.swimmers.size).toBe(2)
      expect(store.swimmersBySquad.get('squad-1')?.length).toBe(2)
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Failed to fetch')
      vi.mocked(swimmerService.getSwimmersBySquad).mockRejectedValue(error)

      const { result } = renderHook(() => useSwimmerApi())

      await act(async () => {
        try {
          await result.current.fetchSwimmersBySquad('squad-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts.length).toBe(1)
      expect(uiStore.toasts[0].type).toBe('error')
      expect(uiStore.toasts[0].message).toBe('Failed to fetch')
    })
  })

  describe('fetchSwimmer', () => {
    it('should fetch single swimmer and add to store', async () => {
      vi.mocked(swimmerService.getSwimmerById).mockResolvedValue(mockSwimmer)

      const { result } = renderHook(() => useSwimmerApi())

      let returnedSwimmer: any
      await act(async () => {
        returnedSwimmer = await result.current.fetchSwimmer('swimmer-1')
      })

      expect(swimmerService.getSwimmerById).toHaveBeenCalledWith('swimmer-1')
      expect(returnedSwimmer).toEqual(mockSwimmer)
      
      const store = useSwimmerStore.getState()
      expect(store.swimmers.get('swimmer-1')).toEqual(mockSwimmer)
    })

    it('should handle null swimmer', async () => {
      vi.mocked(swimmerService.getSwimmerById).mockResolvedValue(null)

      const { result } = renderHook(() => useSwimmerApi())

      let returnedSwimmer: any
      await act(async () => {
        returnedSwimmer = await result.current.fetchSwimmer('swimmer-1')
      })

      expect(returnedSwimmer).toBeNull()
      
      const store = useSwimmerStore.getState()
      expect(store.swimmers.size).toBe(0)
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Swimmer not found')
      vi.mocked(swimmerService.getSwimmerById).mockRejectedValue(error)

      const { result } = renderHook(() => useSwimmerApi())

      await act(async () => {
        try {
          await result.current.fetchSwimmer('swimmer-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
    })
  })

  describe('createSwimmer', () => {
    it('should create swimmer and add to store', async () => {
      const createData = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-01-01',
        sex: 'Male' as const,
        squad_id: 'squad-1',
      }
      
      vi.mocked(swimmerService.createSwimmer).mockResolvedValue(mockSwimmer)

      const { result } = renderHook(() => useSwimmerApi())

      let newSwimmer: any
      await act(async () => {
        newSwimmer = await result.current.createSwimmer(createData)
      })

      expect(swimmerService.createSwimmer).toHaveBeenCalledWith(createData)
      expect(newSwimmer).toEqual(mockSwimmer)
      
      const store = useSwimmerStore.getState()
      expect(store.swimmers.get('swimmer-1')).toEqual(mockSwimmer)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Swimmer created successfully')
    })

    it('should show error toast on failure', async () => {
      const createData = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-01-01',
        sex: 'Male' as const,
        squad_id: 'squad-1',
      }
      
      const error = new Error('Database error')
      vi.mocked(swimmerService.createSwimmer).mockRejectedValue(error)

      const { result } = renderHook(() => useSwimmerApi())

      await act(async () => {
        try {
          await result.current.createSwimmer(createData)
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
      expect(uiStore.toasts[0].message).toBe('Database error')
    })
  })

  describe('updateSwimmer', () => {
    it('should update swimmer and sync store', async () => {
      const updates = { first_name: 'Jane' }
      const updatedSwimmer = { ...mockSwimmer, first_name: 'Jane' }
      
      vi.mocked(swimmerService.updateSwimmer).mockResolvedValue(updatedSwimmer)

      // Add swimmer to store first
      useSwimmerStore.getState().addSwimmer(mockSwimmer)

      const { result } = renderHook(() => useSwimmerApi())

      let updated: any
      await act(async () => {
        updated = await result.current.updateSwimmer('swimmer-1', updates)
      })

      expect(swimmerService.updateSwimmer).toHaveBeenCalledWith('swimmer-1', updates)
      expect(updated).toEqual(updatedSwimmer)
      
      const store = useSwimmerStore.getState()
      expect(store.swimmers.get('swimmer-1')?.first_name).toBe('Jane')
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Swimmer updated successfully')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Update failed')
      vi.mocked(swimmerService.updateSwimmer).mockRejectedValue(error)

      const { result } = renderHook(() => useSwimmerApi())

      await act(async () => {
        try {
          await result.current.updateSwimmer('swimmer-1', { first_name: 'Jane' })
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
    })
  })

  describe('deleteSwimmer', () => {
    it('should delete swimmer and remove from store', async () => {
      vi.mocked(swimmerService.deleteSwimmer).mockResolvedValue(undefined)

      // Add swimmer to store first
      useSwimmerStore.getState().addSwimmer(mockSwimmer)

      const { result } = renderHook(() => useSwimmerApi())

      await act(async () => {
        await result.current.deleteSwimmer('swimmer-1')
      })

      expect(swimmerService.deleteSwimmer).toHaveBeenCalledWith('swimmer-1')
      
      const store = useSwimmerStore.getState()
      expect(store.swimmers.has('swimmer-1')).toBe(false)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Swimmer deleted successfully')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Delete failed')
      vi.mocked(swimmerService.deleteSwimmer).mockRejectedValue(error)

      const { result } = renderHook(() => useSwimmerApi())

      await act(async () => {
        try {
          await result.current.deleteSwimmer('swimmer-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
      expect(uiStore.toasts[0].message).toBe('Delete failed')
    })
  })

  describe('createSwimmerWithExternalLink', () => {
    it('should create swimmer with external link', async () => {
      const swimmerData = {
        first_name: 'John',
        last_name: 'Doe',
        date_of_birth: '2005-01-01',
        sex: 'Male' as const,
        squad_id: 'squad-1',
      }
      const externalLink = { 
        platform: 'swimrankings',
        external_id: '123',
        external_url: 'https://example.com'
      }
      
      const result = {
        swimmer: mockSwimmer,
        external_link: { id: 'link-1', swimmer_id: 'swimmer-1', ...externalLink }
      }
      
      vi.mocked(swimmerService.createSwimmerWithExternalLink).mockResolvedValue(result)

      const { result: hookResult } = renderHook(() => useSwimmerApi())

      let returnedResult: any
      await act(async () => {
        returnedResult = await hookResult.current.createSwimmerWithExternalLink(swimmerData, externalLink)
      })

      expect(swimmerService.createSwimmerWithExternalLink).toHaveBeenCalledWith(swimmerData, externalLink)
      expect(returnedResult).toEqual(result)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
    })
  })

  describe('triggerSync', () => {
    it('should trigger sync for swimmer', async () => {
      const syncResult = { message: 'Sync started', status: 'pending' }
      vi.mocked(swimmerService.triggerSwimmerSync).mockResolvedValue(syncResult)

      const { result } = renderHook(() => useSwimmerApi())

      let returnedResult: any
      await act(async () => {
        returnedResult = await result.current.triggerSync('swimmer-1')
      })

      expect(swimmerService.triggerSwimmerSync).toHaveBeenCalledWith('swimmer-1')
      expect(returnedResult).toEqual(syncResult)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('info')
    })
  })

  describe('cancelSync', () => {
    it('should cancel sync for swimmer', async () => {
      const cancelResult = { message: 'Sync cancelled', status: 'cancelled' }
      vi.mocked(swimmerService.cancelSwimmerSync).mockResolvedValue(cancelResult)

      const { result } = renderHook(() => useSwimmerApi())

      let returnedResult: any
      await act(async () => {
        returnedResult = await result.current.cancelSync('swimmer-1')
      })

      expect(swimmerService.cancelSwimmerSync).toHaveBeenCalledWith('swimmer-1')
      expect(returnedResult).toEqual(cancelResult)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('info')
    })
  })
})
