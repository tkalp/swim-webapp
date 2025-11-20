import apiClient from '../apiClient'

export interface TrainingSession {
  id: string
  squad_id: string
  start_date: string
  end_date: string
  training_type?: string | null
  workout_id?: string | null
  created_at: string
}

export interface CreateSessionData {
  squad_id: string
  start_date: string
  end_date: string
  training_type?: string | null
  workout_id?: string | null
}

export interface UpdateSessionData {
  start_date?: string
  end_date?: string
  training_type?: string | null
  workout_id?: string | null
}

/**
 * Standardized Training Session API Service
 */
export const sessionsApi = {
  /**
   * Get all sessions for a squad
   */
  async getBySquad(squadId: string, fromISO?: string, toISO?: string): Promise<TrainingSession[]> {
    const params = new URLSearchParams()
    if (fromISO) params.append('from', fromISO)
    if (toISO) params.append('to', toISO)
    
    const response = await apiClient.get(`/squads/${squadId}/sessions?${params.toString()}`)
    return response.data
  },

  /**
   * Get a single session by ID
   */
  async getById(id: string): Promise<TrainingSession> {
    const response = await apiClient.get(`/sessions/${id}`)
    return response.data
  },

  /**
   * Create a new training session
   */
  async create(data: CreateSessionData): Promise<TrainingSession> {
    const response = await apiClient.post('/sessions', data)
    return response.data
  },

  /**
   * Update a training session
   */
  async update(id: string, data: UpdateSessionData): Promise<TrainingSession> {
    const response = await apiClient.patch(`/sessions/${id}`, data)
    return response.data
  },

  /**
   * Delete a training session
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/sessions/${id}`)
  },
}
