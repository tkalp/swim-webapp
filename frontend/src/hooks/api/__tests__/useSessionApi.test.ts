import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSessionApi } from '../useSessionApi'
import { useSquadStore } from '../../../stores/squadStore'
import { useUIStore } from '../../../stores/uiStore'
import * as sessionService from '../../../services/sessionService'
import * as detailApi from '../../../features/squads/detailApi'
import { mockSession, mockSchedule } from '../../../__tests__/testUtils'

// Mock the services
vi.mock('../../../services/sessionService', () => ({
  createSession: vi.fn(),
  updateSession: vi.fn(),
  deleteSession: vi.fn(),
  createSessionFromSchedule: vi.fn(),
}))

vi.mock('../../../features/squads/detailApi', () => ({
  listSessions: vi.fn(),
}))

describe('useSessionApi', () => {
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

  describe('fetchSessions', () => {
    it('should fetch sessions and update store', async () => {
      const sessions = [mockSession, { ...mockSession, id: 'session-2' }]
      vi.mocked(detailApi.listSessions).mockResolvedValue(sessions)

      const { result } = renderHook(() => useSessionApi())

      let returnedSessions: any
      await act(async () => {
        returnedSessions = await result.current.fetchSessions('squad-1')
      })

      expect(detailApi.listSessions).toHaveBeenCalledWith('squad-1', undefined, undefined)
      expect(returnedSessions).toEqual(sessions)
      
      // Check store was updated
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.sessions).toEqual(sessions)
    })

    it('should fetch sessions with date range', async () => {
      const sessions = [mockSession]
      vi.mocked(detailApi.listSessions).mockResolvedValue(sessions)

      const { result } = renderHook(() => useSessionApi())

      await act(async () => {
        await result.current.fetchSessions('squad-1', '2024-01-01', '2024-01-31')
      })

      expect(detailApi.listSessions).toHaveBeenCalledWith('squad-1', '2024-01-01', '2024-01-31')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Failed to fetch sessions')
      vi.mocked(detailApi.listSessions).mockRejectedValue(error)

      const { result } = renderHook(() => useSessionApi())

      await act(async () => {
        try {
          await result.current.fetchSessions('squad-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts.length).toBe(1)
      expect(uiStore.toasts[0].type).toBe('error')
      expect(uiStore.toasts[0].message).toBe('Failed to fetch sessions')
    })
  })

  describe('createSession', () => {
    it('should create session and add to store', async () => {
      const createData = {
        squad_id: 'squad-1',
        start_date: '2024-01-15T17:00:00Z',
        end_date: '2024-01-15T18:00:00Z',
        training_type: 'Swim' as const,
      }
      
      vi.mocked(sessionService.createSession).mockResolvedValue(mockSession)

      const { result } = renderHook(() => useSessionApi())

      let newSession: any
      await act(async () => {
        newSession = await result.current.createSession(createData)
      })

      expect(sessionService.createSession).toHaveBeenCalledWith(createData)
      expect(newSession).toEqual(mockSession)
      
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.sessions).toContainEqual(mockSession)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Session created successfully')
    })

    it('should show error toast on failure', async () => {
      const createData = {
        squad_id: 'squad-1',
        start_date: '2024-01-15T17:00:00Z',
        end_date: '2024-01-15T18:00:00Z',
        training_type: 'Swim' as const,
      }
      
      const error = new Error('Database error')
      vi.mocked(sessionService.createSession).mockRejectedValue(error)

      const { result } = renderHook(() => useSessionApi())

      await act(async () => {
        try {
          await result.current.createSession(createData)
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
      expect(uiStore.toasts[0].message).toBe('Database error')
    })
  })

  describe('createSessionFromSchedule', () => {
    it('should create session from schedule', async () => {
      const date = new Date('2024-01-15')
      
      vi.mocked(sessionService.createSessionFromSchedule).mockResolvedValue(mockSession)

      const { result } = renderHook(() => useSessionApi())

      let newSession: any
      await act(async () => {
        newSession = await result.current.createSessionFromSchedule(mockSchedule, date, 'squad-1')
      })

      expect(sessionService.createSessionFromSchedule).toHaveBeenCalledWith(mockSchedule, date, 'squad-1')
      expect(newSession).toEqual(mockSession)
      
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.sessions).toContainEqual(mockSession)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Session created from schedule')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Failed to create from schedule')
      vi.mocked(sessionService.createSessionFromSchedule).mockRejectedValue(error)

      const { result } = renderHook(() => useSessionApi())

      await act(async () => {
        try {
          await result.current.createSessionFromSchedule(mockSchedule, new Date(), 'squad-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
    })
  })

  describe('updateSession', () => {
    it('should update session and sync store', async () => {
      const updates = { training_type: 'Technique' as const }
      const updatedSession = { ...mockSession, training_type: 'Technique' }
      
      vi.mocked(sessionService.updateSession).mockResolvedValue(updatedSession)

      // Add session to store first
      useSquadStore.getState().addSession('squad-1', mockSession)

      const { result } = renderHook(() => useSessionApi())

      let updated: any
      await act(async () => {
        updated = await result.current.updateSession('session-1', 'squad-1', updates)
      })

      expect(sessionService.updateSession).toHaveBeenCalledWith('session-1', updates)
      expect(updated).toEqual(updatedSession)
      
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.sessions?.[0]?.training_type).toBe('Technique')
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Session updated successfully')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Update failed')
      vi.mocked(sessionService.updateSession).mockRejectedValue(error)

      const { result } = renderHook(() => useSessionApi())

      await act(async () => {
        try {
          await result.current.updateSession('session-1', 'squad-1', { training_type: 'Technique' })
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
    })
  })

  describe('deleteSession', () => {
    it('should delete session and remove from store', async () => {
      vi.mocked(sessionService.deleteSession).mockResolvedValue(undefined)

      // Add session to store first
      useSquadStore.getState().addSession('squad-1', mockSession)

      const { result } = renderHook(() => useSessionApi())

      await act(async () => {
        await result.current.deleteSession('session-1', 'squad-1')
      })

      expect(sessionService.deleteSession).toHaveBeenCalledWith('session-1')
      
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.sessions).not.toContainEqual(mockSession)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Session deleted successfully')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Delete failed')
      vi.mocked(sessionService.deleteSession).mockRejectedValue(error)

      const { result } = renderHook(() => useSessionApi())

      await act(async () => {
        try {
          await result.current.deleteSession('session-1', 'squad-1')
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
