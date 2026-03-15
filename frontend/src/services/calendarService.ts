// services/calendarService.ts
import { apiClient } from '@/lib/apiClient'
import type { CalendarEvent, CreateCalendarEvent, UpdateCalendarEvent } from '@/types/calendar'

export async function getSquadCalendarEvents(
  squadId: string,
  fromISO?: string,
  toISO?: string
): Promise<CalendarEvent[]> {
  const from = fromISO ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const to = toISO ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString()

  return apiClient.get<CalendarEvent[]>(`/calendar-events?squad_id=${squadId}&from_date=${from}&to_date=${to}`)
}

export async function getAllCalendarEvents(
  fromISO?: string,
  toISO?: string
): Promise<CalendarEvent[]> {
  const from = fromISO ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const to = toISO ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString()

  return apiClient.get<CalendarEvent[]>(`/calendar-events?from_date=${from}&to_date=${to}`)
}

export async function getCalendarEventById(eventId: string): Promise<CalendarEvent | null> {
  try {
    return await apiClient.get<CalendarEvent>(`/calendar-events/${eventId}`)
  } catch {
    return null
  }
}

export async function createCalendarEvent(event: CreateCalendarEvent): Promise<CalendarEvent> {
  return apiClient.post<CalendarEvent>('/calendar-events', event)
}

export async function updateCalendarEvent(
  eventId: string,
  updates: UpdateCalendarEvent
): Promise<CalendarEvent> {
  return apiClient.put<CalendarEvent>(`/calendar-events/${eventId}`, updates)
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  await apiClient.delete(`/calendar-events/${eventId}`)
}
