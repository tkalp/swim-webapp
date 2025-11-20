import apiClient from '../apiClient'

export interface CalendarEvent {
  id: string
  squad_id: string
  name: string
  start_date: string
  end_date: string
  event_type?: string | null
}

export interface CreateEventData {
  squad_id: string
  name: string
  start_date: string
  end_date: string
  event_type?: string | null
}

export interface UpdateEventData {
  name?: string
  start_date?: string
  end_date?: string
  event_type?: string | null
}

/**
 * Standardized Calendar Event API Service
 */
export const eventsApi = {
  /**
   * Get all calendar events for a squad
   */
  async getBySquad(squadId: string, fromISO?: string, toISO?: string): Promise<CalendarEvent[]> {
    const params = new URLSearchParams()
    if (fromISO) params.append('from', fromISO)
    if (toISO) params.append('to', toISO)
    
    const response = await apiClient.get(`/squads/${squadId}/events?${params.toString()}`)
    return response.data
  },

  /**
   * Get a single event by ID
   */
  async getById(id: string): Promise<CalendarEvent> {
    const response = await apiClient.get(`/events/${id}`)
    return response.data
  },

  /**
   * Create a new calendar event
   */
  async create(data: CreateEventData): Promise<CalendarEvent> {
    const response = await apiClient.post('/events', data)
    return response.data
  },

  /**
   * Update a calendar event
   */
  async update(id: string, data: UpdateEventData): Promise<CalendarEvent> {
    const response = await apiClient.patch(`/events/${id}`, data)
    return response.data
  },

  /**
   * Delete a calendar event
   */
  async delete(id: string): Promise<void> {
    await apiClient.delete(`/events/${id}`)
  },
}
