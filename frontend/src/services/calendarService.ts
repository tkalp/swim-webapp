// services/calendarService.ts
import { supabase } from '@/lib/supabase'
import type { CalendarEvent, CreateCalendarEvent, UpdateCalendarEvent } from '@/types/calendar'

export async function getSquadCalendarEvents(
  squadId: string,
  fromISO?: string,
  toISO?: string
): Promise<CalendarEvent[]> {
  const from = fromISO ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const to = toISO ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString()
  
  const { data, error } = await supabase
    .from('calendar_event')
    .select('*')
    .eq('squad_id', squadId)
    .gte('start_date', from)
    .lte('start_date', to)
    .order('start_date')
  
  if (error) throw error
  return data ?? []
}

export async function getAllCalendarEvents(
  fromISO?: string,
  toISO?: string
): Promise<CalendarEvent[]> {
  const from = fromISO ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const to = toISO ?? new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59).toISOString()
  
  const { data, error } = await supabase
    .from('calendar_event')
    .select('*')
    .gte('start_date', from)
    .lte('start_date', to)
    .order('start_date')
  
  if (error) throw error
  return data ?? []
}

export async function getCalendarEventById(eventId: string): Promise<CalendarEvent | null> {
  const { data, error } = await supabase
    .from('calendar_event')
    .select('*')
    .eq('id', eventId)
    .single()
  
  if (error) throw error
  return data
}

export async function createCalendarEvent(event: CreateCalendarEvent): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('calendar_event')
    .insert(event)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function updateCalendarEvent(
  eventId: string,
  updates: UpdateCalendarEvent
): Promise<CalendarEvent> {
  const { data, error } = await supabase
    .from('calendar_event')
    .update(updates)
    .eq('id', eventId)
    .select()
    .single()
  
  if (error) throw error
  return data
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  const { error } = await supabase
    .from('calendar_event')
    .delete()
    .eq('id', eventId)
  
  if (error) throw error
}
