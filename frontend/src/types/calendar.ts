// types/calendar.ts
export type CalendarEventType = 'practice' | 'meet' | 'other'

export interface CalendarEvent {
  id: string
  name: string | null
  start_date: string | null
  end_date: string | null
  event_type: CalendarEventType | null
  squad_id: string | null
  created_at?: string
}

export interface CreateCalendarEvent {
  name: string
  start_date: string
  end_date: string
  event_type: CalendarEventType
  squad_id: string
}

export interface UpdateCalendarEvent {
  name?: string
  start_date?: string
  end_date?: string
  event_type?: CalendarEventType
}
