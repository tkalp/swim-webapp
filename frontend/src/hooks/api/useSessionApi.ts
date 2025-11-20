import { useCallback } from 'react'
import { 
  createSession, 
  updateSession, 
  deleteSession,
  createSessionFromSchedule,
  type CreateSessionData,
  type UpdateSessionData,
  type TrainingSession,
  type TrainingSchedule
} from '../../services/sessionService'
import { getSquadSessions } from '../../services/squadService'
import { useSquadStore } from '../../stores/squadStore'
import { useUIStore } from '../../stores/uiStore'

/**
 * Session API hooks with automatic store synchronization
 * Wraps existing Supabase service calls with store updates and toast notifications
 */
export const useSessionApi = () => {
  const { setSessions, addSession: addSessionToStore, updateSessionInStore, removeSession: removeSessionFromStore } = useSquadStore()
  const { addToast } = useUIStore()

  /**
   * Fetch sessions for a squad and update store
   */
  const fetchSessions = useCallback(async (squadId: string, fromISO?: string, toISO?: string) => {
    try {
      const sessions = await getSquadSessions(squadId, fromISO, toISO)
      setSessions(squadId, sessions)
      return sessions
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to fetch sessions', type: 'error' })
      throw error
    }
  }, [setSessions, addToast])

  /**
   * Create a new session and update store
   */
  const createNewSession = useCallback(async (data: CreateSessionData) => {
    try {
      const session = await createSession(data)
      
      // Add to store
      addSessionToStore(data.squad_id, session)
      
      addToast({ message: 'Session created successfully', type: 'success' })
      return session
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to create session', type: 'error' })
      throw error
    }
  }, [addSessionToStore, addToast])

  /**
   * Create session from schedule and update store
   */
  const createFromSchedule = useCallback(async (schedule: TrainingSchedule, date: Date, squadId: string) => {
    try {
      const session = await createSessionFromSchedule(schedule, date, squadId)
      
      // Add to store
      addSessionToStore(squadId, session)
      
      addToast({ message: 'Session created from schedule', type: 'success' })
      return session
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to create session from schedule', type: 'error' })
      throw error
    }
  }, [addSessionToStore, addToast])

  /**
   * Update an existing session and update store
   */
  const updateExistingSession = useCallback(async (sessionId: string, squadId: string, updates: UpdateSessionData) => {
    try {
      const session = await updateSession(sessionId, updates)
      
      // Update in store
      updateSessionInStore(squadId, sessionId, session)
      
      addToast({ message: 'Session updated successfully', type: 'success' })
      return session
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to update session', type: 'error' })
      throw error
    }
  }, [updateSessionInStore, addToast])

  /**
   * Delete a session and update store
   */
  const deleteExistingSession = useCallback(async (sessionId: string, squadId: string) => {
    try {
      await deleteSession(sessionId)
      
      // Remove from store
      removeSessionFromStore(squadId, sessionId)
      
      addToast({ message: 'Session deleted successfully', type: 'success' })
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to delete session', type: 'error' })
      throw error
    }
  }, [removeSessionFromStore, addToast])

  return {
    fetchSessions,
    createSession: createNewSession,
    createSessionFromSchedule: createFromSchedule,
    updateSession: updateExistingSession,
    deleteSession: deleteExistingSession,
  }
}
