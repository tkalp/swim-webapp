import { useCallback } from 'react'
import { 
  getSwimmersBySquad,
  getSwimmerById,
  createSwimmer as createSwimmerService,
  updateSwimmer as updateSwimmerService,
  deleteSwimmer as deleteSwimmerService,
  createSwimmerWithExternalLink as createSwimmerWithExternalLinkService,
  triggerSwimmerSync as triggerSwimmerSyncService,
  cancelSwimmerSync as cancelSwimmerSyncService,
  type CreateSwimmerData,
  type UpdateSwimmerData
} from '@/services/swimmerService'
import { useSwimmerStore } from '@/stores/swimmerStore'
import { useUIStore } from '@/stores/uiStore'

/**
 * Swimmer API hooks with automatic store synchronization
 * Uses backend API services with Zustand store updates
 */
export const useSwimmerApi = () => {
  const { addSwimmer, updateSwimmer: updateSwimmerInStore, removeSwimmer, setSwimmers } = useSwimmerStore()
  const { addToast } = useUIStore()

  /**
   * Fetch swimmers by squad and update store
   */
  const fetchSwimmersBySquad = useCallback(async (squadId: string) => {
    try {
      const swimmers = await getSwimmersBySquad(squadId)
      setSwimmers(swimmers, squadId)
      return swimmers
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to fetch swimmers', type: 'error' })
      throw error
    }
  }, [setSwimmers, addToast])

  /**
   * Fetch a single swimmer and update store
   */
  const fetchSwimmer = useCallback(async (id: string) => {
    try {
      const swimmer = await getSwimmerById(id)
      if (swimmer) {
        addSwimmer(swimmer)
      }
      return swimmer
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to fetch swimmer', type: 'error' })
      throw error
    }
  }, [addSwimmer, addToast])

  /**
   * Create a new swimmer and add to store
   */
  const createSwimmer = useCallback(async (data: CreateSwimmerData) => {
    try {
      const newSwimmer = await createSwimmerService(data)
      addSwimmer(newSwimmer)
      addToast({ message: 'Swimmer created successfully', type: 'success' })
      return newSwimmer
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to create swimmer', type: 'error' })
      throw error
    }
  }, [addSwimmer, addToast])

  /**
   * Update a swimmer and sync with store
   */
  const updateSwimmer = useCallback(async (id: string, data: UpdateSwimmerData) => {
    try {
      const updated = await updateSwimmerService(id, data)
      updateSwimmerInStore(id, updated)
      addToast({ message: 'Swimmer updated successfully', type: 'success' })
      return updated
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to update swimmer', type: 'error' })
      throw error
    }
  }, [updateSwimmerInStore, addToast])

  /**
   * Delete a swimmer and remove from store
   */
  const deleteSwimmer = useCallback(async (id: string) => {
    try {
      await deleteSwimmerService(id)
      removeSwimmer(id)
      addToast({ message: 'Swimmer deleted successfully', type: 'success' })
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to delete swimmer', type: 'error' })
      throw error
    }
  }, [removeSwimmer, addToast])

  /**
   * Create swimmer with external link
   */
  const createSwimmerWithExternalLink = useCallback(async (
    swimmerData: CreateSwimmerData,
    externalLink: {
      platform: string
      external_id: string
      external_url?: string
      external_name?: string
      birth_year?: number
      nation_code?: string
      club_name?: string
      gender?: 'M' | 'F'
    }
  ) => {
    try {
      const result = await createSwimmerWithExternalLinkService(swimmerData, externalLink)
      addSwimmer(result.swimmer)
      addToast({ message: 'Swimmer created and sync started', type: 'success' })
      return result
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to create swimmer with external link', type: 'error' })
      throw error
    }
  }, [addSwimmer, addToast])

  /**
   * Trigger sync for swimmer
   */
  const triggerSync = useCallback(async (swimmerId: string) => {
    try {
      const result = await triggerSwimmerSyncService(swimmerId)
      addToast({ message: result.message || 'Sync started', type: 'info' })
      return result
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to trigger sync', type: 'error' })
      throw error
    }
  }, [addToast])

  /**
   * Cancel sync for swimmer
   */
  const cancelSync = useCallback(async (swimmerId: string) => {
    try {
      const result = await cancelSwimmerSyncService(swimmerId)
      addToast({ message: result.message || 'Sync cancelled', type: 'info' })
      return result
    } catch (error: any) {
      addToast({ message: error.message || 'Failed to cancel sync', type: 'error' })
      throw error
    }
  }, [addToast])

  return {
    fetchSwimmersBySquad,
    fetchSwimmer,
    createSwimmer,
    updateSwimmer,
    deleteSwimmer,
    createSwimmerWithExternalLink,
    triggerSync,
    cancelSync,
  }
}
