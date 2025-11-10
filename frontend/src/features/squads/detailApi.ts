import { supabase } from "../../lib/supabase"

export async function getSquad(squadId: string) {
  const { data, error } = await supabase
    .from('squads')
    .select('id,name,description,created_at')
    .eq('id', squadId)
    .single()
  if (error) throw error
  return data
}

export async function listSwimmers(squadId: string) {
  const { data, error } = await supabase
    .from('swimmers')
    .select('id, first_name, last_name, date_of_birth, sex, created_at')
    .eq('squad_id', squadId)
    .order('last_name', { ascending: true })
  if (error) throw error
  return data ?? []
}

export async function listSchedules(squadId: string) {
  const { data, error } = await supabase
    .from('training_schedules')
    .select('id, day_of_week, start_time, end_time, active, training_type')
    .eq('squad_id', squadId)
    .eq('active', true)
    .order('day_of_week')
  if (error) throw error
  return data ?? []
}

export async function listSessions(squadId: string, fromISO?: string, toISO?: string) {
  const from = fromISO ?? new Date(Date.now() - 1000*60*60*24*30).toISOString()
  const to = toISO ?? new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString();
  const { data, error } = await supabase
    .from('training_sessions')
    .select('id, start_date, end_date, training_type, workout_id, created_at')
    .eq('squad_id', squadId)
    .gte('start_date', from)
    .lte('start_date', to)
    .order('start_date', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function listCalendarEvents(squadId: string, fromISO?: string, toISO?: string) {
  const from = fromISO ?? new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString()
  const to   = toISO   ?? new Date(new Date().getFullYear(), new Date().getMonth()+1, 0, 23,59,59).toISOString()
  const { data, error } = await supabase
    .from('calendar_event')
    .select('id, name, start_date, end_date, event_type')
    .eq('squad_id', squadId)
    .gte('start_date', from)
    .lte('start_date', to)
    .order('start_date')
  if (error) throw error
  return data ?? []
}