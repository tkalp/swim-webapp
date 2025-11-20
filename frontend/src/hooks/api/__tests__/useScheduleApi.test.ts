import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useScheduleApi } from '../useScheduleApi'
import { useSquadStore } from '../../../stores/squadStore'
import { useUIStore } from '../../../stores/uiStore'
import * as scheduleService from '../../../services/scheduleService'
import * as detailApi from '../../../features/squads/detailApi'
import { mockSchedule } from '../../../__tests__/testUtils'

// Mock the services
vi.mock('../../../services/scheduleService', () => ({
  createSchedule: vi.fn(),
  updateSchedule: vi.fn(),
  deleteSchedule: vi.fn(),
}))

vi.mock('../../../features/squads/detailApi', () => ({
  listSchedules: vi.fn(),
}))

describe('useScheduleApi', () => {
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

  describe('fetchSchedules', () => {
    it('should fetch schedules and update store', async () => {
      const schedules = [mockSchedule, { ...mockSchedule, id: 'schedule-2' }]
      vi.mocked(detailApi.listSchedules).mockResolvedValue(schedules)

      const { result } = renderHook(() => useScheduleApi())

      let returnedSchedules: any
      await act(async () => {
        returnedSchedules = await result.current.fetchSchedules('squad-1')
      })

      expect(detailApi.listSchedules).toHaveBeenCalledWith('squad-1')
      expect(returnedSchedules).toEqual(schedules)
      
      // Check store was updated
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.schedules).toEqual(schedules)
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Failed to fetch schedules')
      vi.mocked(detailApi.listSchedules).mockRejectedValue(error)

      const { result } = renderHook(() => useScheduleApi())

      await act(async () => {
        try {
          await result.current.fetchSchedules('squad-1')
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts.length).toBe(1)
      expect(uiStore.toasts[0].type).toBe('error')
      expect(uiStore.toasts[0].message).toBe('Failed to fetch schedules')
    })
  })

  describe('createSchedule', () => {
    it('should create schedule and add to store', async () => {
      const createData = {
        squad_id: 'squad-1',
        day_of_week: 'Monday' as const,
        start_time: '17:00',
        end_time: '18:00',
        training_type: 'Swim' as const,
      }
      
      vi.mocked(scheduleService.createSchedule).mockResolvedValue(mockSchedule)

      const { result } = renderHook(() => useScheduleApi())

      let newSchedule: any
      await act(async () => {
        newSchedule = await result.current.createSchedule(createData)
      })

      expect(scheduleService.createSchedule).toHaveBeenCalledWith(createData)
      expect(newSchedule).toEqual(mockSchedule)
      
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.schedules).toContainEqual(mockSchedule)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Schedule created successfully')
    })

    it('should show error toast on failure', async () => {
      const createData = {
        squad_id: 'squad-1',
        day_of_week: 'Monday' as const,
        start_time: '17:00',
        end_time: '18:00',
        training_type: 'Swim' as const,
      }
      
      const error = new Error('Database error')
      vi.mocked(scheduleService.createSchedule).mockRejectedValue(error)

      const { result } = renderHook(() => useScheduleApi())

      await act(async () => {
        try {
          await result.current.createSchedule(createData)
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
      expect(uiStore.toasts[0].message).toBe('Database error')
    })
  })

  describe('updateSchedule', () => {
    it('should update schedule and sync store', async () => {
      const updates = { start_time: '18:00' }
      const updatedSchedule = { ...mockSchedule, start_time: '18:00' }
      
      vi.mocked(scheduleService.updateSchedule).mockResolvedValue(updatedSchedule)

      // Add schedule to store first
      useSquadStore.getState().addSchedule('squad-1', mockSchedule)

      const { result } = renderHook(() => useScheduleApi())

      let updated: any
      await act(async () => {
        updated = await result.current.updateSchedule('schedule-1', 'squad-1', updates)
      })

      expect(scheduleService.updateSchedule).toHaveBeenCalledWith('schedule-1', updates)
      expect(updated).toEqual(updatedSchedule)
      
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.schedules?.[0]?.start_time).toBe('18:00')
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Schedule updated successfully')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Update failed')
      vi.mocked(scheduleService.updateSchedule).mockRejectedValue(error)

      const { result } = renderHook(() => useScheduleApi())

      await act(async () => {
        try {
          await result.current.updateSchedule('schedule-1', 'squad-1', { start_time: '18:00' })
        } catch (e) {
          // Expected to throw
        }
      })

      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('error')
    })
  })

  describe('deleteSchedule', () => {
    it('should delete schedule and remove from store', async () => {
      vi.mocked(scheduleService.deleteSchedule).mockResolvedValue(undefined)

      // Add schedule to store first
      useSquadStore.getState().addSchedule('squad-1', mockSchedule)

      const { result } = renderHook(() => useScheduleApi())

      await act(async () => {
        await result.current.deleteSchedule('schedule-1', 'squad-1')
      })

      expect(scheduleService.deleteSchedule).toHaveBeenCalledWith('schedule-1')
      
      const store = useSquadStore.getState()
      const details = store.squadDetails.get('squad-1')
      expect(details?.schedules).not.toContainEqual(mockSchedule)
      
      const uiStore = useUIStore.getState()
      expect(uiStore.toasts[0].type).toBe('success')
      expect(uiStore.toasts[0].message).toBe('Schedule deleted successfully')
    })

    it('should show error toast on failure', async () => {
      const error = new Error('Delete failed')
      vi.mocked(scheduleService.deleteSchedule).mockRejectedValue(error)

      const { result } = renderHook(() => useScheduleApi())

      await act(async () => {
        try {
          await result.current.deleteSchedule('schedule-1', 'squad-1')
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
