import apiClient from '../apiClient'
import type { Swimmer, CreateSwimmerData, UpdateSwimmerData, SwimmerSyncStatus } from '../swimmerService'

/**
 * Standardized Swimmer API Service
 * All methods use axios client with auto token injection
 */
export const swimmersApi = {
  /**
   * Get all swimmers for a specific squad
   */
  async getBySquad(squadId: string): Promise<Swimmer[]> {
    const response = await apiClient.get(`/swimmers/squad/${squadId}`)
    return response.data
  },

  /**
   * Get a single swimmer by ID
   */
  async getById(id: string): Promise<Swimmer> {
    const response = await apiClient.get(`/swimmers/${id}`)
    return response.data
  },

  /**
   * Create a new swimmer
   */
  async create(data: CreateSwimmerData): Promise<Swimmer> {
    const response = await apiClient.post('/swimmers', data)
    return response.data
  },

  /**
   * Update an existing swimmer
   */
  async update(id: string, data: UpdateSwimmerData): Promise<Swimmer> {
    const response = await apiClient.patch(`/swimmers/${id}`, data)
    return response.data
  },

  /**
   * Delete a swimmer
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/swimmers/${id}`)
  },

  /**
   * Create a swimmer with an external link
   * Triggers automatic background import
   */
  async createWithExternalLink(
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
  ): Promise<{ swimmer_id: string; external_link_id: string; sync_started: boolean }> {
    const response = await apiClient.post('/swimmers/with-external-link', {
      swimmer: swimmerData,
      external_link: externalLink,
      auto_sync: true
    })
    return response.data
  },

  /**
   * Trigger manual sync for a swimmer's external data
   */
  async triggerSync(swimmerId: string): Promise<{ success: boolean; message: string; external_link_id?: string }> {
    const response = await apiClient.post(`/swimmers/${swimmerId}/sync-external-data`)
    return response.data
  },

  /**
   * Cancel an in-progress sync
   */
  async cancelSync(swimmerId: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post(`/swimmers/${swimmerId}/cancel-sync`)
    return response.data
  },

  /**
   * Get sync status for a swimmer's external link
   */
  async getSyncStatus(externalLinkId: string): Promise<SwimmerSyncStatus> {
    const response = await apiClient.get(`/swimmers/external-links/${externalLinkId}/sync-status`)
    return response.data
  },
}
