import apiClient from '../apiClient'

export interface TrainingSchedule {
  id: string
  squad_id: string
  day_of_week: number
  start_time: string
  end_time: string
  active: boolean
  training_type?: string | null
}

export interface CreateScheduleData {
  squad_id: string
  day_of_week: number
  start_time: string
  end_time: string
  active?: boolean
  training_type?: string | null
}

export interface UpdateScheduleData {
  day_of_week?: number
  start_time?: string
  end_time?: string
  active?: boolean
  training_type?: string | null
}

/**
 * Standardized Training Schedule API Service
 */
export const schedulesApi = {
  /**
   * Get all schedules for a squad
   */
  async getBySquad(squadId: string): Promise<TrainingSchedule[]> {
    const response = await apiClient.get(`/squads/${squadId}/schedules`)
    return response.data
  },

  /**
   * Create a new training schedule
   */
  async create(data: CreateScheduleData): Promise<TrainingSchedule> {
    const response = await apiClient.post('/schedules', data)
    return response.data
  },

  /**
   * Update a training schedule
   */
  async update(id: string, data: UpdateScheduleData): Promise<TrainingSchedule> {
    const response = await apiClient.patch(`/schedules/${id}`, data)
    return response.data
  },

  /**
   * Delete a training schedule
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/schedules/${id}`)
  },
}
