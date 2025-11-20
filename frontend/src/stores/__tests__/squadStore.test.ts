import { describe, it, expect, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useSquadStore } from '../squadStore'
import { mockSquad, mockSquadCard, mockSession, mockSchedule } from '@/__tests__/testUtils'

describe('squadStore', () => {
  beforeEach(() => {
    // Reset store
    useSquadStore.setState({
      squads: new Map(),
      squadDetails: new Map(),
      loading: false,
      error: null,
      selectedSquadId: null,
    })
  })

  describe('initial state', () => {
    it('should have empty maps initially', () => {
      const { result } = renderHook(() => useSquadStore())
      expect(result.current.squads.size).toBe(0)
      expect(result.current.squadDetails.size).toBe(0)
      expect(result.current.loading).toBe(false)
      expect(result.current.error).toBeNull()
      expect(result.current.selectedSquadId).toBeNull()
    })
  })

  describe('setSquads', () => {
    it('should set squads by ID', () => {
      const { result } = renderHook(() => useSquadStore())
      const squads = [mockSquadCard, { ...mockSquadCard, id: 'squad-2' }]

      act(() => {
        result.current.setSquads(squads)
      })

      expect(result.current.squads.size).toBe(2)
      expect(result.current.squads.get('squad-1')).toEqual(mockSquadCard)
    })

    it('should replace existing squads', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.setSquads([mockSquadCard])
      })

      expect(result.current.squads.size).toBe(1)

      act(() => {
        result.current.setSquads([{ ...mockSquadCard, id: 'squad-2' }])
      })

      expect(result.current.squads.size).toBe(1)
      expect(result.current.squads.has('squad-1')).toBe(false)
    })
  })

  describe('addSquad', () => {
    it('should add a squad by ID', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
      })

      expect(result.current.squads.get('squad-1')).toEqual(mockSquadCard)
    })

    it('should add to existing squads', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.addSquad({ ...mockSquadCard, id: 'squad-2' })
      })

      expect(result.current.squads.size).toBe(2)
    })
  })

  describe('updateSquad', () => {
    it('should update a squad by ID', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
      })

      act(() => {
        result.current.updateSquad('squad-1', { name: 'Updated Squad' })
      })

      const updated = result.current.squads.get('squad-1')
      expect(updated?.name).toBe('Updated Squad')
      expect(updated?.description).toBe('Test squad description')
    })

    it('should update squad in details if it exists', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.setSquadDetails('squad-1', { schedules: [] })
      })

      act(() => {
        result.current.updateSquad('squad-1', { name: 'Updated Squad' })
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.name).toBe('Updated Squad')
    })

    it('should do nothing if squad not found', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.updateSquad('non-existent', { name: 'Updated' })
      })

      expect(result.current.squads.size).toBe(0)
    })
  })

  describe('removeSquad', () => {
    it('should remove a squad by ID', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
      })

      act(() => {
        result.current.removeSquad('squad-1')
      })

      expect(result.current.squads.has('squad-1')).toBe(false)
    })

    it('should remove squad details too', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.setSquadDetails('squad-1', { schedules: [] })
      })

      act(() => {
        result.current.removeSquad('squad-1')
      })

      expect(result.current.squadDetails.has('squad-1')).toBe(false)
    })
  })

  describe('getSquad', () => {
    it('should get a specific squad', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
      })

      const squad = result.current.getSquad('squad-1')
      expect(squad).toEqual(mockSquadCard)
    })

    it('should return undefined if not found', () => {
      const { result } = renderHook(() => useSquadStore())

      const squad = result.current.getSquad('non-existent')
      expect(squad).toBeUndefined()
    })
  })

  describe('getAllSquads', () => {
    it('should get all squads as array', () => {
      const { result } = renderHook(() => useSquadStore())
      const squads = [mockSquadCard, { ...mockSquadCard, id: 'squad-2' }]

      act(() => {
        result.current.setSquads(squads)
      })

      const allSquads = result.current.getAllSquads()
      expect(allSquads.length).toBe(2)
    })

    it('should return empty array if no squads', () => {
      const { result } = renderHook(() => useSquadStore())

      const allSquads = result.current.getAllSquads()
      expect(allSquads).toEqual([])
    })
  })

  describe('setSquadDetails', () => {
    it('should set squad details', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.setSquadDetails('squad-1', { schedules: [mockSchedule] })
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.schedules).toEqual([mockSchedule])
    })

    it('should create details even if squad not in squads map', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.setSquadDetails('squad-1', { schedules: [mockSchedule] })
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.schedules).toEqual([mockSchedule])
    })

    it('should merge with existing details', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.setSquadDetails('squad-1', { schedules: [] })
        result.current.setSquadDetails('squad-1', { sessions: [] })
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.schedules).toEqual([])
      expect(details?.sessions).toEqual([])
    })
  })

  describe('getSquadDetails', () => {
    it('should get squad details if they exist', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.setSquadDetails('squad-1', { schedules: [] })
      })

      const details = result.current.getSquadDetails('squad-1')
      expect(details?.schedules).toEqual([])
    })

    it('should fall back to squad if details not set', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
      })

      const details = result.current.getSquadDetails('squad-1')
      expect(details).toEqual(mockSquadCard)
    })
  })

  describe('setSchedules', () => {
    it('should set schedules for a squad', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.setSchedules('squad-1', [mockSchedule])
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.schedules).toEqual([mockSchedule])
    })

    it('should create squad details if not exist', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.setSchedules('squad-1', [mockSchedule])
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.schedules).toEqual([mockSchedule])
    })
  })

  describe('setSessions', () => {
    it('should set sessions for a squad', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.setSessions('squad-1', [mockSession])
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.sessions).toEqual([mockSession])
    })

    it('should create squad details if not exist', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.setSessions('squad-1', [mockSession])
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.sessions).toEqual([mockSession])
    })
  })

  describe('setEvents', () => {
    it('should set events for a squad', () => {
      const { result } = renderHook(() => useSquadStore())
      const mockEvent = { id: 'event-1', name: 'Test Event' }

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.setEvents('squad-1', [mockEvent])
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.events).toEqual([mockEvent])
    })
  })

  describe('addSession', () => {
    it('should add a session to squad', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.addSession('squad-1', mockSession)
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.sessions).toContain(mockSession)
    })

    it('should create sessions array if not exist', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSession('squad-1', mockSession)
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.sessions).toEqual([mockSession])
    })

    it('should add to existing sessions', () => {
      const { result } = renderHook(() => useSquadStore())
      const session2 = { ...mockSession, id: 'session-2' }

      act(() => {
        result.current.addSession('squad-1', mockSession)
        result.current.addSession('squad-1', session2)
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.sessions?.length).toBe(2)
    })
  })

  describe('updateSessionInStore', () => {
    it('should update a session by ID', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSession('squad-1', mockSession)
      })

      act(() => {
        result.current.updateSessionInStore('squad-1', 'session-1', { title: 'Updated Session' })
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.sessions?.[0]?.title).toBe('Updated Session')
    })

    it('should preserve other fields', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSession('squad-1', mockSession)
        result.current.updateSessionInStore('squad-1', 'session-1', { training_type: 'Technique' })
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.sessions?.[0]?.start_date).toBe('2024-01-15T17:00:00Z')
    })
  })

  describe('removeSession', () => {
    it('should remove a session by ID', () => {
      const { result } = renderHook(() => useSquadStore())
      const session2 = { ...mockSession, id: 'session-2' }

      act(() => {
        result.current.addSession('squad-1', mockSession)
        result.current.addSession('squad-1', session2)
      })

      act(() => {
        result.current.removeSession('squad-1', 'session-1')
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.sessions?.length).toBe(1)
      expect(details?.sessions?.[0]?.id).toBe('session-2')
    })
  })

  describe('addSchedule', () => {
    it('should add a schedule to squad', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.addSchedule('squad-1', mockSchedule)
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.schedules).toContain(mockSchedule)
    })

    it('should create schedules array if not exist', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSchedule('squad-1', mockSchedule)
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.schedules).toEqual([mockSchedule])
    })
  })

  describe('updateScheduleInStore', () => {
    it('should update a schedule by ID', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSchedule('squad-1', mockSchedule)
      })

      act(() => {
        result.current.updateScheduleInStore('squad-1', 'schedule-1', { day_of_week: 2 })
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.schedules?.[0]?.day_of_week).toBe(2)
    })
  })

  describe('removeSchedule', () => {
    it('should remove a schedule by ID', () => {
      const { result } = renderHook(() => useSquadStore())
      const schedule2 = { ...mockSchedule, id: 'schedule-2' }

      act(() => {
        result.current.addSchedule('squad-1', mockSchedule)
        result.current.addSchedule('squad-1', schedule2)
      })

      act(() => {
        result.current.removeSchedule('squad-1', 'schedule-1')
      })

      const details = result.current.squadDetails.get('squad-1')
      expect(details?.schedules?.length).toBe(1)
      expect(details?.schedules?.[0]?.id).toBe('schedule-2')
    })
  })

  describe('setSelectedSquad', () => {
    it('should set selected squad ID', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.setSelectedSquad('squad-1')
      })

      expect(result.current.selectedSquadId).toBe('squad-1')
    })

    it('should clear selected squad', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.setSelectedSquad('squad-1')
        result.current.setSelectedSquad(null)
      })

      expect(result.current.selectedSquadId).toBeNull()
    })
  })

  describe('setLoading', () => {
    it('should set loading state', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.setLoading(true)
      })

      expect(result.current.loading).toBe(true)
    })
  })

  describe('setError', () => {
    it('should set error message', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.setError('Test error')
      })

      expect(result.current.error).toBe('Test error')
    })
  })

  describe('clearError', () => {
    it('should clear error message', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.setError('Test error')
        result.current.clearError()
      })

      expect(result.current.error).toBeNull()
    })
  })

  describe('reset', () => {
    it('should reset store to initial state', () => {
      const { result } = renderHook(() => useSquadStore())

      act(() => {
        result.current.addSquad(mockSquadCard)
        result.current.setSquadDetails('squad-1', { schedules: [] })
        result.current.setError('Test error')
        result.current.setLoading(true)
        result.current.setSelectedSquad('squad-1')
        result.current.reset()
      })

      expect(result.current.squads.size).toBe(0)
      expect(result.current.squadDetails.size).toBe(0)
      expect(result.current.error).toBeNull()
      expect(result.current.loading).toBe(false)
      expect(result.current.selectedSquadId).toBeNull()
    })
  })
})
