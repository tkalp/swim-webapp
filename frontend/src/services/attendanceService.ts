// services/attendanceService.ts
import { supabase } from '../lib/supabase'

export type AttendanceStatus = 'present' | 'late' | 'absent'

export type TrainingAttendance = {
  id: string
  training_session_id: string
  swimmer_id: string
  status: AttendanceStatus
  notes?: string | null
  created_at: string
}

export type CreateAttendanceData = {
  training_session_id: string
  swimmer_id: string
  status: AttendanceStatus
  notes?: string | null
}

export type UpdateAttendanceData = {
  status?: AttendanceStatus
  notes?: string | null
}

export type SessionAttendanceSummary = {
  session_id: string
  total_swimmers: number
  present: number
  late: number
  absent: number
  not_recorded: number
}

/**
 * Get attendance records for a specific training session
 */
export async function getAttendanceBySession(sessionId: string): Promise<TrainingAttendance[]> {
  const { data, error } = await supabase
    .from('training_attendance')
    .select('*')
    .eq('training_session_id', sessionId)
    .order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching attendance:', error)
    throw new Error(`Failed to fetch attendance: ${error.message}`)
  }

  return data || []
}

/**
 * Get attendance records for a specific swimmer
 */
export async function getAttendanceBySwimmer(
  swimmerId: string,
  dateRange?: { from?: string; to?: string }
): Promise<TrainingAttendance[]> {
  let query = supabase
    .from('training_attendance')
    .select('*')
    .eq('swimmer_id', swimmerId)

  if (dateRange?.from) {
    query = query.gte('created_at', dateRange.from)
  }
  if (dateRange?.to) {
    query = query.lte('created_at', dateRange.to)
  }

  const { data, error } = await query.order('created_at', { ascending: false })

  if (error) {
    console.error('Error fetching swimmer attendance:', error)
    throw new Error(`Failed to fetch swimmer attendance: ${error.message}`)
  }

  return data || []
}

/**
 * Create or update attendance record for a swimmer in a session
 * Uses upsert to handle both create and update scenarios
 */
export async function upsertAttendance(
  sessionId: string,
  swimmerId: string,
  status: AttendanceStatus,
  notes?: string | null
): Promise<TrainingAttendance> {
  const { data, error } = await supabase
    .from('training_attendance')
    .upsert(
      {
        training_session_id: sessionId,
        swimmer_id: swimmerId,
        status,
        notes,
      },
      {
        onConflict: 'training_session_id,swimmer_id',
        ignoreDuplicates: false,
      }
    )
    .select()
    .single()

  if (error) {
    console.error('Error upserting attendance:', error)
    throw new Error(`Failed to save attendance: ${error.message}`)
  }

  return data
}

/**
 * Bulk upsert attendance records for multiple swimmers in a session
 */
export async function bulkUpsertAttendance(
  sessionId: string,
  attendanceRecords: Array<{ swimmer_id: string; status: AttendanceStatus; notes?: string | null }>
): Promise<TrainingAttendance[]> {
  const records = attendanceRecords.map(record => ({
    training_session_id: sessionId,
    swimmer_id: record.swimmer_id,
    status: record.status,
    notes: record.notes,
  }))

  const { data, error } = await supabase
    .from('training_attendance')
    .upsert(records, {
      onConflict: 'training_session_id,swimmer_id',
      ignoreDuplicates: false,
    })
    .select()

  if (error) {
    console.error('Error bulk upserting attendance:', error)
    throw new Error(`Failed to save attendance records: ${error.message}`)
  }

  return data || []
}

/**
 * Delete an attendance record
 */
export async function deleteAttendance(attendanceId: string): Promise<void> {
  const { error } = await supabase
    .from('training_attendance')
    .delete()
    .eq('id', attendanceId)

  if (error) {
    console.error('Error deleting attendance:', error)
    throw new Error(`Failed to delete attendance: ${error.message}`)
  }
}

/**
 * Get attendance summary for a session with swimmer details
 */
export async function getSessionAttendanceWithSwimmers(sessionId: string, squadId: string) {
  // Get all swimmers in the squad
  const { data: swimmers, error: swimmersError } = await supabase
    .from('swimmers')
    .select('id, first_name, last_name')
    .eq('squad_id', squadId)
    .order('last_name', { ascending: true })

  if (swimmersError) {
    console.error('Error fetching swimmers:', swimmersError)
    throw new Error(`Failed to fetch swimmers: ${swimmersError.message}`)
  }

  // Get attendance records for this session
  const { data: attendance, error: attendanceError } = await supabase
    .from('training_attendance')
    .select('*')
    .eq('training_session_id', sessionId)

  if (attendanceError) {
    console.error('Error fetching attendance:', attendanceError)
    throw new Error(`Failed to fetch attendance: ${attendanceError.message}`)
  }

  // Map attendance to swimmers
  const attendanceMap = new Map(
    (attendance || []).map(a => [a.swimmer_id, a])
  )

  const swimmersWithAttendance = (swimmers || []).map(swimmer => ({
    ...swimmer,
    attendance: attendanceMap.get(swimmer.id) || null,
  }))

  // Calculate summary
  const summary = {
    total: swimmersWithAttendance.length,
    present: attendance?.filter(a => a.status === 'present').length || 0,
    late: attendance?.filter(a => a.status === 'late').length || 0,
    absent: attendance?.filter(a => a.status === 'absent').length || 0,
    not_recorded: swimmersWithAttendance.filter(s => !s.attendance).length,
  }

  return {
    swimmers: swimmersWithAttendance,
    summary,
  }
}

/**
 * Mark all swimmers with no attendance record as absent for a session
 */
export async function markRemainingAsAbsent(sessionId: string, squadId: string): Promise<void> {
  const { swimmers } = await getSessionAttendanceWithSwimmers(sessionId, squadId)
  
  const recordsToCreate = swimmers
    .filter(s => !s.attendance)
    .map(s => ({
      swimmer_id: s.id,
      status: 'Absent' as AttendanceStatus,
    }))

  if (recordsToCreate.length > 0) {
    await bulkUpsertAttendance(sessionId, recordsToCreate)
  }
}
