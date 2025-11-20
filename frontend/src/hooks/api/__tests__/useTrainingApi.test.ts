import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useTrainingApi } from '../useTrainingApi'
import { useSquadStore } from '../../../stores/squadStore'
import { useSwimmerStore } from '../../../stores/swimmerStore'
import { useUIStore } from '../../../stores/uiStore'
import * as detailApi from '../../../features/squads/detailApi'
import { mockSquad, mockSwimmer, mockSchedule, mockSession } from '../../../__tests__/testUtils'

// Mock the detail API
vi.mock('../../../features/squads/detailApi', () => ({
  getSquad: vi.fn(),
  listSwimmers: vi.fn(),
  listSchedules: vi.fn(),
  listSessions: vi.fn(),
  listCalendarEvents: vi.fn(),
}))

describe('useTrainingApi', () => {
  beforeEach(() => {
    // Reset stores
    useSquadStore.setState({
      squads: new Map(),
      squadDetails: new Map(),
      loading: false,
      error: null,
      selectedSquadId: null,
    })
    
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

  describe('fetchSquadData', () => {
    it('should fetch all squad data and update stores', async () => {
      const swimmers = [mockSwimmer, { ...mockSwimmer, id: 'swimmer-2' }]
      const schedules = [mockSchedule]
      const sessions = [mockSession]
      const events = [{ 
        id: 'event-1', 
        name: 'Test Event',
        start_date: '2024-01-15T10:00:00Z',
        end_date: '2024-01-15T12:00:00Z',
        event_type: 'Competition'
      }]

      vi.mocked(detailApi.getSquad).mockResolvedValue(mockSquad)
      vi.mocked(detailApi.listSwimmers).mockResolvedValue(swimmers)
      vi.mocked(detailApi.listSchedules).mockResolvedValue(schedules)
      vi.mocked(detailApi.listSessions).mockResolvedValue(sessions)
      vi.mocked(detailApi.listCalendarEvents).mockResolvedValue(events)

      const { result } = renderHook(() => useTrainingApi())

      let returnedData: any
      await act(async () => {
        returnedData = await result.current.fetchSquadData('squad-1')
      })

      expect(detailApi.getSquad).toHaveBeenCalledWith('squad-1')
      expect(detailApi.listSwimmers).toHaveBeenCalledWith('squad-1')
      expect(detailApi.listSchedules).toHaveBeenCalledWith('squad-1')
      expect(detailApi.listSessions).toHaveBeenCalledWith('squad-1', undefined, undefined)
      expect(detailApi.listCalendarEvents).toHaveBeenCalledWith('squad-1', undefined, undefined)

      expect(returnedData).toEqual({
        squad: mockSquad,
        swimmers,
        schedules,
        sessions,
        events,
      })
      
      // Check squad store was updated
      const squadStore = useSquadStore.getState()
      const details = squadStore.squadDetails.get('squad-1')
      expect(details).toBeDefined()
      expect(details?.schedules).toEqual(schedules)
      expect(details?.sessions).toEqual(sessions)
      expect(details?.events).toEqual(events)
      
      // Check swimmer store was updated
      const swimmerStore = useSwimmerStore.getState()
      expect(swimmerStore.swimmers.size).toBe(2)
      expect(swimmerStore.swimmersBySquad.get('squad-1')?.length).toBe(2)
    })

    it('should fetch with date range', async () => {
      vi.mocked(detailApi.getSquad).mockResolvedValue(mockSquad)
      vi.mocked(detailApi.listSwimmers).mockResolvedValue([])
      vi.mocked(detailApi.listSchedules).mockResolvedValue([])
      vi.mocked(detailApi.listSessions).mockResolvedValue([])
      vi.mocked(detailApi.listCalendarEvents).mockResolvedValue([])

      const { result } = renderHook(() => useTrainingApi())

      await act(async () => {
        await result.current.fetchSquadData('squad-1', '2024-01-01', '2024-01-31')
      })

      expect(detailApi.listSessions).toHaveBeenCalledWith('squad-1', '2024-01-01', '2024-01-31')
      expect(detailApi.listCalendarEvents).toHaveBeenCalledWith('squad-1', '2024-01-01', '2024-01-31')
    })

    it('should handle null squad', async () => {
      vi.mocked(detailApi.getSquad).mockResolvedValue(null as any)
      vi.mocked(detailApi.listSwimmers).mockResolvedValue([])
      vi.mocked(detailApi.listSchedules).mockResolvedValue([])
      vi.mocked(detailApi.listSessions).mockResolvedValue([])
      vi.mocked(detailApi.listCalendarEvents).mockResolvedValue([])

      const { result } = renderHook(() => useTrainingApi())

      let returnedData: any
      await act(async () => {
        returnedData = await result.current.fetchSquadData('squad-1')
      })

      expect(returnedData.squad).toBeNull()
      
      // Store should still have empty arrays for other data
      const squadStore = useSquadStore.getState()
      const details = squadStore.squadDetails.get('squad-1')
      expect(details?.schedules).toEqual([])
      expect(details?.sessions).toEqual([])
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Failed to fetch squad data')
      vi.mocked(detailApi.getSquad).mockRejectedValue(error)

      const { result } = renderHook(() => useTrainingApi())

      await act(async () => {
        try {
          await result.current.fetchSquadData('squad-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts.length).toBe(1)
      expect(uiStore.toasts[0].type).toBe('error')
      expect(uiStore.toasts[0].message).toBe('Failed to fetch squad data')
    })
  })

  describe('fetchSchedules', () => {
    it('should fetch schedules and update store', async () => {
      const schedules = [mockSchedule, { ...mockSchedule, id: 'schedule-2' }]
      vi.mocked(detailApi.listSchedules).mockResolvedValue(schedules)

      const { result } = renderHook(() => useTrainingApi())

      let returnedSchedules: any
      await act(async () => {
        returnedSchedules = await result.current.fetchSchedules('squad-1')
      })

      expect(detailApi.listSchedules).toHaveBeenCalledWith('squad-1')
      expect(returnedSchedules).toEqual(schedules)
      
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.schedules).toEqual(schedules)
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Failed to fetch schedules')
      vi.mocked(detailApi.listSchedules).mockRejectedValue(error)

      const { result } = renderHook(() => useTrainingApi())

      await act(async () => {
        try {
          await result.current.fetchSchedules('squad-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
    })
  })

  describe('fetchSessions', () => {
    it('should fetch sessions and update store', async () => {
      const sessions = [mockSession, { ...mockSession, id: 'session-2' }]
      vi.mocked(detailApi.listSessions).mockResolvedValue(sessions)

      const { result } = renderHook(() => useTrainingApi())

      let returnedSessions: any
      await act(async () => {
        returnedSessions = await result.current.fetchSessions('squad-1')
      })

      expect(detailApi.listSessions).toHaveBeenCalledWith('squad-1', undefined, undefined)
      expect(returnedSessions).toEqual(sessions)
      
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.sessions).toEqual(sessions)
    })

    it('should fetch sessions with date range', async () => {
      const sessions = [mockSession]
      vi.mocked(detailApi.listSessions).mockResolvedValue(sessions)

      const { result } = renderHook(() => useTrainingApi())

      await act(async () => {
        await result.current.fetchSessions('squad-1', '2024-01-01', '2024-01-31')
      })

      expect(detailApi.listSessions).toHaveBeenCalledWith('squad-1', '2024-01-01', '2024-01-31')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Failed to fetch sessions')
      vi.mocked(detailApi.listSessions).mockRejectedValue(error)

      const { result } = renderHook(() => useTrainingApi())

      await act(async () => {
        try {
          await result.current.fetchSessions('squad-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
    })
  })

  describe('fetchEvents', () => {
    it('should fetch events and update store', async () => {
      const events = [
        { 
          id: 'event-1', 
          name: 'Event 1',
          start_date: '2024-01-15T10:00:00Z',
          end_date: '2024-01-15T12:00:00Z',
          event_type: 'Competition'
        },
        { 
          id: 'event-2', 
          name: 'Event 2',
          start_date: '2024-01-20T10:00:00Z',
          end_date: '2024-01-20T12:00:00Z',
          event_type: 'Training'
        }
      ]
      vi.mocked(detailApi.listCalendarEvents).mockResolvedValue(events)

      const { result } = renderHook(() => useTrainingApi())

      let returnedEvents: any
      await act(async () => {
        returnedEvents = await result.current.fetchEvents('squad-1')
      })

      expect(detailApi.listCalendarEvents).toHaveBeenCalledWith('squad-1', undefined, undefined)
      expect(returnedEvents).toEqual(events)
      
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.events).toEqual(events)
    })

    it('should fetch events with date range', async () => {
      const events = [{ 
        id: 'event-1', 
        name: 'Event 1',
        start_date: '2024-01-15T10:00:00Z',
        end_date: '2024-01-15T12:00:00Z',
        event_type: 'Competition'
      }]
      vi.mocked(detailApi.listCalendarEvents).mockResolvedValue(events)

      const { result } = renderHook(() => useTrainingApi())

      await act(async () => {
        await result.current.fetchEvents('squad-1', '2024-01-01', '2024-01-31')
      })

      expect(detailApi.listCalendarEvents).toHaveBeenCalledWith('squad-1', '2024-01-01', '2024-01-31')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Failed to fetch events')
      vi.mocked(detailApi.listCalendarEvents).mockRejectedValue(error)

      const { result } = renderHook(() => useTrainingApi())

      await act(async () => {
        try {
          await result.current.fetchEvents('squad-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
    })
  })
})
