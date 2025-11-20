import apiClient from '../apiClient'
import type { Squad, SquadCard, CreateSquadData, UpdateSquadData } from '../squadService'

/**
 * Standardized Squad API Service
 * All methods use axios client with auto token injection
 */
export const squadsApi = {
  /**
   * Get all squads for the current coach
   */
  async getForCoach(coachId: string): Promise<SquadCard[]> {
    const response = await apiClient.get(`/squads/coach/${coachId}`)
    return response.data
  },

  /**
   * Get a single squad by ID
   */
  async getById(squadId: string): Promise<Squad> {
    const response = await apiClient.get(`/squads/${squadId}`)
    return response.data
  },

  /**
   * Create a new squad
   */
  async create(coachId: string, data: CreateSquadData): Promise<Squad> {
    const response = await apiClient.post('/squads', {
      ...data,
      coach_id: coachId
    })
    return response.data
  },

  /**
   * Update an existing squad
   */
  async update(squadId: string, data: UpdateSquadData): Promise<Squad> {
    const response = await apiClient.patch(`/squads/${squadId}`, data)
    return response.data
  },

  /**
   * Delete a squad
   */
  async delete(squadId: string): Promise<void> {
    await apiClient.delete(`/squads/${squadId}`)
  },
}
