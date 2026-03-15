import { useCallback } from 'react'
import {
  getSquadById,
  getSquadSwimmers,
  getSquadSchedules,
  getSquadCalendarEvents
} from '@/services/squadService'
import { getVirtualSessions } from '@/services/sessionService'
import { useSquadStore } from '@/stores/squadStore'
import { useSwimmerStore } from '@/stores/swimmerStore'
import { useUIStore } from '@/stores/uiStore'

/**
 * Training data API hooks with automatic store synchronization
 * Uses existing backend API services
 */
export const useTrainingApi = () => {
  const { setSchedules, setSessions, setEvents, setSquadDetails } = useSquadStore()
  const { setSwimmers } = useSwimmerStore()
  const { addToast } = useUIStore()

  /**
   * Fetch all squad data (squad, swimmers, schedules, sessions, events) and update stores
   */
  const fetchSquadData = useCallback(async (squadId: string, fromISO?: string, toISO?: string) => {
    try {
      const [squad, swimmers, schedules, virtualSessionsResponse, events] = await Promise.all([
        getSquadById(squadId),
        getSquadSwimmers(squadId),
        getSquadSchedules(squadId),
        getVirtualSessions(squadId, fromISO, toISO),
        getSquadCalendarEvents(squadId, fromISO, toISO),
      ])

      const sessions = virtualSessionsResponse.sessions

      // Update stores
      if (squad) {
        setSquadDetails(squadId, {
          ...squad,
          role: 'member', // Default role, will be overridden by actual role
          swimmers_count: swimmers.length
        })
      }

      if (swimmers && Array.isArray(swimmers)) {
        setSwimmers(swimmers, squadId)
      }

      if (schedules) setSchedules(squadId, schedules)
      if (sessions) setSessions(squadId, sessions)
      if (events) setEvents(squadId, events)

      return { squad, swimmers, schedules, sessions, events }
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to fetch squad data', type: 'error' })
      throw error
    }
  }, [setSquadDetails, setSwimmers, setSchedules, setSessions, setEvents, addToast])

  /**
   * Fetch schedules for a squad and update store
   */
  const fetchSchedules = useCallback(async (squadId: string) => {
    try {
      const schedules = await getSquadSchedules(squadId)
      setSchedules(squadId, schedules)
      return schedules
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to fetch schedules', type: 'error' })
      throw error
    }
  }, [setSchedules, addToast])

  /**
   * Fetch sessions for a squad and update store
   */
  const fetchSessions = useCallback(async (squadId: string, fromISO?: string, toISO?: string) => {
    try {
      const response = await getVirtualSessions(squadId, fromISO, toISO)
      setSessions(squadId, response.sessions)
      return response.sessions
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to fetch sessions', type: 'error' })
      throw error
    }
  }, [setSessions, addToast])

  /**
   * Fetch events for a squad and update store
   */
  const fetchEvents = useCallback(async (squadId: string, fromISO?: string, toISO?: string) => {
    try {
      const events = await getSquadCalendarEvents(squadId, fromISO, toISO)
      setEvents(squadId, events)
      return events
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to fetch events', type: 'error' })
      throw error
    }
  }, [setEvents, addToast])

  return {
    fetchSquadData,
    fetchSchedules,
    fetchSessions,
    fetchEvents,
  }
}
