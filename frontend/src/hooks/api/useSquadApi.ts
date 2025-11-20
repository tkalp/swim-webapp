import { useCallback } from 'react'
import {
  getSquadsForCoach,
  getSquadById,
  createSquad as createSquadService,
  updateSquad as updateSquadService,
  deleteSquad as deleteSquadService,
  type CreateSquadData,
  type UpdateSquadData
} from '../../services/squadService'
import { useSquadStore } from '../../stores/squadStore'
import { useUIStore } from '../../stores/uiStore'

/**
 * Squad API hooks with automatic store synchronization
 * Uses Supabase services with Zustand store updates
 */
export const useSquadApi = () => {
  const { setSquads, addSquad, updateSquad: updateSquadInStore, removeSquad, setSquadDetails } = useSquadStore()
  const { addToast } = useUIStore()

  /**
   * Fetch squads for coach and update store
   */
  const fetchSquadsForCoach = useCallback(async (coachId: string) => {
    try {
      const squads = await getSquadsForCoach(coachId)
      setSquads(squads)
      return squads
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to fetch squads', type: 'error' })
      throw error
    }
  }, [setSquads, addToast])

  /**
   * Fetch a single squad and update store
   */
  const fetchSquad = useCallback(async (squadId: string) => {
    try {
      const squad = await getSquadById(squadId)
      if (squad) {
        setSquadDetails(squadId, squad)
      }
      return squad
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to fetch squad', type: 'error' })
      throw error
    }
  }, [setSquadDetails, addToast])

  /**
   * Create a new squad and add to store
   */
  const createSquad = useCallback(async (coachId: string, data: CreateSquadData) => {
    try {
      const newSquad = await createSquadService(coachId, data)
      addSquad({
        ...newSquad,
        role: 'owner',
        swimmers_count: 0
      })
      addToast({ message: 'Squad created successfully', type: 'success' })
      return newSquad
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to create squad', type: 'error' })
      throw error
    }
  }, [addSquad, addToast])

  /**
   * Update a squad and sync with store
   */
  const updateSquad = useCallback(async (squadId: string, data: UpdateSquadData) => {
    try {
      const updated = await updateSquadService(squadId, data)
      updateSquadInStore(squadId, updated)
      addToast({ message: 'Squad updated successfully', type: 'success' })
      return updated
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to update squad', type: 'error' })
      throw error
    }
  }, [updateSquadInStore, addToast])

  /**
   * Delete a squad and remove from store
   */
  const deleteSquad = useCallback(async (squadId: string) => {
    try {
      await deleteSquadService(squadId)
      removeSquad(squadId)
      addToast({ message: 'Squad deleted successfully', type: 'success' })
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to delete squad', type: 'error' })
      throw error
    }
  }, [removeSquad, addToast])

  return {
    fetchSquadsForCoach,
    fetchSquad,
    createSquad,
    updateSquad,
    deleteSquad,
  }
}
