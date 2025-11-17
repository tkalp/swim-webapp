import { supabase } from "../../lib/supabase";

export type SquadAttendance = { present: number; late: number; absent: number }
export type WeekDistance = { week: string; meters: number }
export type StrokeBreakdown = { stroke: string; meters: number; color: string }
export type ActivityBreakdown = { activity: string; meters: number; color: string }

export async function getSquadSessionCount(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<number> {
  let q = supabase
    .from('training_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('squad_id', squadId)

  if (range?.from) q = q.gte('start_date', range.from)
  if (range?.to)   q = q.lte('start_date', range.to)

  const { count, error } = await q
  if (error) throw error
  return count ?? 0
}

export async function getSquadTotalMeters(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<number> {
  // 1) Get sessions for squad within range
  let sQ = supabase
    .from('training_sessions')
    .select('id, start_date, workout_id')
    .eq('squad_id', squadId)

  if (range?.from) sQ = sQ.gte('start_date', range.from)
  if (range?.to)   sQ = sQ.lte('start_date', range.to)

  const { data: sessions, error: sErr } = await sQ
  if (sErr) throw sErr
  if (!sessions?.length) return 0

  // 2) Fetch total_meters for referenced workouts
  const workoutIds = Array.from(new Set((sessions.map(s => s.workout_id).filter(Boolean) as string[])))
  if (!workoutIds.length) return 0

  const { data: workouts, error: wErr } = await supabase
    .from('workout_template')
    .select('total_meters')
    .in('id', workoutIds)
  if (wErr) throw wErr

  // 3) Sum up total_meters
  return workouts.reduce((sum, w) => sum + (Number(w.total_meters) || 0), 0)
}

export async function getSquadAttendanceStats(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<SquadAttendance> {
  // Filter attendance rows to sessions in this squad (via inner join)
  let q = supabase
    .from('training_attendance')
    .select('status, training_sessions!inner(squad_id, start_date)')
    .eq('training_sessions.squad_id', squadId)

  if (range?.from) q = q.gte('training_sessions.start_date', range.from)
  if (range?.to)   q = q.lte('training_sessions.start_date', range.to)

  const { data, error } = await q
  if (error) throw error

  const counts: SquadAttendance = { present: 0, late: 0, absent: 0 }
  data?.forEach((row: any) => {
    const key = String(row.status ?? '').toLowerCase()
    if (key === 'present') counts.present++
    else if (key === 'late') counts.late++
    else counts.absent++
  })
  return counts
}

export async function getSquadDistancePerWeek(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<WeekDistance[]> {
  // 1) pull sessions for squad within range
  let sQ = supabase
    .from('training_sessions')
    .select('id, start_date, workout_id')
    .eq('squad_id', squadId)

  if (range?.from) sQ = sQ.gte('start_date', range.from)
  if (range?.to)   sQ = sQ.lte('start_date', range.to)

  const { data: sessions, error: sErr } = await sQ
  if (sErr) throw sErr
  if (!sessions?.length) return []

  // 2) fetch totals for referenced workouts
  const workoutIds = Array.from(new Set((sessions.map(s => s.workout_id).filter(Boolean) as string[])))
  let totals = new Map<string, number>()
  if (workoutIds.length) {
    const { data: workouts, error: wErr } = await supabase
      .from('workout_template')
      .select('id, total_meters')
      .in('id', workoutIds)
    if (wErr) throw wErr
    totals = new Map(workouts.map(w => [w.id as string, Number(w.total_meters) || 0]))
  }

  // 3) aggregate by ISO week key
  const byWeek = new Map<string, number>()
  sessions.forEach(s => {
    const meters = totals.get(s.workout_id as string) ?? 0
    const d = new Date(s.start_date)
    const key = getWeekKey(d)
    byWeek.set(key, (byWeek.get(key) ?? 0) + meters)
  })

  // 4) convert to display label
  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekKey, meters]) => {
      const { label } = parseWeekKey(weekKey)
      return { week: label, meters }
    })
}


/** YYYY-Wxx */
function getWeekKey(d: Date) {
  const w = getWeekNumber(d)
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`
}

function getWeekNumber(d: Date) {
  const onejan = new Date(d.getFullYear(), 0, 1)
  const dayMs = 86400000
  return Math.ceil((((d.getTime() - onejan.getTime()) / dayMs) + onejan.getDay() + 1) / 7)
}

/** Converts 2025-W02 → { start: Date, end: Date, label: 'Jan 6–12, 2025' } */
function parseWeekKey(key: string) {
  const [yearStr, weekStr] = key.split('-W')
  const year = parseInt(yearStr, 10)
  const week = parseInt(weekStr, 10)

  // ISO week start = Monday
  const start = new Date(year, 0, 1 + (week - 1) * 7)
  const dayOfWeek = start.getDay()
  const ISOStart = new Date(start)
  ISOStart.setDate(start.getDate() - ((dayOfWeek + 6) % 7))
  const ISOEnd = new Date(ISOStart)
  ISOEnd.setDate(ISOStart.getDate() + 6)

  const label = formatRange(ISOStart, ISOEnd)
  return { start: ISOStart, end: ISOEnd, label }
}

/** "Jan 6–12, 2025" style */
function formatRange(start: Date, end: Date) {
  const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const year = start.getFullYear()
  const sameMonth = start.getMonth() === end.getMonth()
  const range =
    sameMonth
      ? `${fmt(start).split(' ')[1]}–${end.getDate()}, ${start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}`
      : `${fmt(start)} – ${fmt(end)}, ${year}`
  return range
}

const STROKE_COLORS: Record<string, string> = {
  freestyle: '#22D3EE',
  backstroke: '#8B5CF6',
  breaststroke: '#10B981',
  butterfly: '#F59E0B',
  individualMedley: '#EF4444',
  choice: '#6B7280'
}

const ACTIVITY_COLORS: Record<string, string> = {
  swim: '#22D3EE',
  kick: '#EF4444',
  pull: '#10B981',
  drill: '#F59E0B'
}

export async function getSquadStrokeBreakdown(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<StrokeBreakdown[]> {
  // 1) Get sessions for squad within range
  let sQ = supabase
    .from('training_sessions')
    .select('workout_id')
    .eq('squad_id', squadId)
    .not('workout_id', 'is', null)

  if (range?.from) sQ = sQ.gte('start_date', range.from)
  if (range?.to) sQ = sQ.lte('start_date', range.to)

  const { data: sessions, error: sErr } = await sQ
  if (sErr) throw sErr
  if (!sessions?.length) return []

  // 2) Get workout breakdown data
  const workoutIds = Array.from(new Set(sessions.map(s => s.workout_id).filter(Boolean) as string[]))
  
  const { data: workouts, error: wErr } = await supabase
    .from('workout_template')
    .select('json_description')
    .in('id', workoutIds)
  if (wErr) throw wErr

  // 3) Aggregate stroke breakdown
  const strokeTotals: Record<string, number> = {}
  
  workouts?.forEach(workout => {
    const breakdown = workout.json_description?.estimate?.strokeBreakdown
    if (breakdown) {
      Object.entries(breakdown).forEach(([stroke, meters]) => {
        strokeTotals[stroke] = (strokeTotals[stroke] || 0) + (meters as number)
      })
    }
  })

  return Object.entries(strokeTotals)
    .filter(([_, meters]) => meters > 0)
    .map(([stroke, meters]) => ({
      stroke: stroke.charAt(0).toUpperCase() + stroke.slice(1),
      meters,
      color: STROKE_COLORS[stroke] || '#6B7280'
    }))
    .sort((a, b) => b.meters - a.meters)
}

export async function getSquadActivityBreakdown(
  squadId: string,
  range?: { from?: string; to?: string }
): Promise<ActivityBreakdown[]> {
  // 1) Get sessions for squad within range
  let sQ = supabase
    .from('training_sessions')
    .select('workout_id')
    .eq('squad_id', squadId)
    .not('workout_id', 'is', null)

  if (range?.from) sQ = sQ.gte('start_date', range.from)
  if (range?.to) sQ = sQ.lte('start_date', range.to)

  const { data: sessions, error: sErr } = await sQ
  if (sErr) throw sErr
  if (!sessions?.length) return []

  // 2) Get workout breakdown data
  const workoutIds = Array.from(new Set(sessions.map(s => s.workout_id).filter(Boolean) as string[]))
  
  const { data: workouts, error: wErr } = await supabase
    .from('workout_template')
    .select('json_description')
    .in('id', workoutIds)
  if (wErr) throw wErr

  // 3) Aggregate activity breakdown
  const activityTotals: Record<string, number> = {}
  
  workouts?.forEach(workout => {
    const breakdown = workout.json_description?.estimate?.activityBreakdown
    if (breakdown) {
      Object.entries(breakdown).forEach(([activity, meters]) => {
        activityTotals[activity] = (activityTotals[activity] || 0) + (meters as number)
      })
    }
  })

  return Object.entries(activityTotals)
    .filter(([_, meters]) => meters > 0)
    .map(([activity, meters]) => ({
      activity: activity.charAt(0).toUpperCase() + activity.slice(1),
      meters,
      color: ACTIVITY_COLORS[activity] || '#6B7280'
    }))
    .sort((a, b) => b.meters - a.meters)
}


// ============================================
// SQUAD PERFORMANCE ANALYTICS
// ============================================

import { getApiUrl } from '../../lib/api';

export interface EventTimeline {
  date: string;
  time: number;
}

export interface EventSummary {
  event: string;
  attempts: number;
  first_time: number;
  best_time: number;
  latest_time: number;
  improvement_pct: number;
  personal_records: number;
  activity?: string;
  stroke?: string;
  result_units?: string;
  timeline: EventTimeline[];
}

export interface SwimmerPerformance {
  swimmer_id: string;
  swimmer_name: string;
  total_workouts: number;
  events_analyzed: number;
  personal_records: number;
  avg_improvement_pct: number;
  best_improvement_pct: number;
  events: EventSummary[];
}

export interface SquadSummary {
  total_swimmers: number;
  avg_improvement: number;
  total_prs: number;
  most_improved: {
    swimmer_id: string;
    swimmer_name: string;
    improvement_pct: number;
  } | null;
}

export interface SquadPerformanceData {
  squad: {
    id: string;
    name: string;
  };
  date_range: {
    start: string;
    end: string;
  };
  swimmers: SwimmerPerformance[];
  summary: SquadSummary;
}

export async function getSquadPerformance(
  squadId: string,
  startDate?: string,
  endDate?: string
): Promise<SquadPerformanceData> {
  const params = new URLSearchParams();
  if (startDate) params.append('start_date', startDate);
  if (endDate) params.append('end_date', endDate);

  const url = getApiUrl(`squads/${squadId}/performance?${params.toString()}`);
  
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch squad performance: ${response.statusText}`);
  }

  return response.json();
}

export function formatTimeFromSeconds(seconds: number): string {
  if (seconds >= 60) {
    const mins = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(2);
    return `${mins}:${secs.padStart(5, '0')}`;
  }
  return seconds.toFixed(2);
}

export function parseEventKey(eventKey: string): {
  distance: string;
  stroke: string;
  activity: string;
  equipment?: string;
} {
  // Format: "100Y_freestyle_swim" or "50M_freestyle_swim_fins"
  const parts = eventKey.split('_');
  const distance = parts[0];
  const stroke = parts[1];
  const activity = parts[2];
  const equipment = parts[3];

  return { distance, stroke, activity, equipment };
}
