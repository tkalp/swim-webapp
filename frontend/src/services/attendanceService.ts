// services/attendanceService.ts
import { apiClient, authenticatedFetch } from '@/lib/apiClient'
import { getApiUrl } from '@/lib/api'

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
  return apiClient.get<TrainingAttendance[]>(`/attendance/session/${sessionId}`)
}

/**
 * Get attendance records for a specific swimmer
 */
export async function getAttendanceBySwimmer(
  swimmerId: string,
  dateRange?: { from?: string; to?: string }
): Promise<TrainingAttendance[]> {
  const params = new URLSearchParams()
  if (dateRange?.from) params.append('from_date', dateRange.from)
  if (dateRange?.to) params.append('to_date', dateRange.to)
  const qs = params.toString()

  return apiClient.get<TrainingAttendance[]>(`/attendance/swimmer/${swimmerId}${qs ? `?${qs}` : ''}`)
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
  return apiClient.post<TrainingAttendance>('/attendance/upsert', {
    training_session_id: sessionId,
    swimmer_id: swimmerId,
    status,
    notes,
  })
}

/**
 * Bulk upsert attendance records for multiple swimmers in a session
 */
export async function bulkUpsertAttendance(
  sessionId: string,
  attendanceRecords: Array<{ swimmer_id: string; status: AttendanceStatus; notes?: string | null }>
): Promise<TrainingAttendance[]> {
  return apiClient.post<TrainingAttendance[]>('/attendance/bulk-upsert', {
    session_id: sessionId,
    records: attendanceRecords,
  })
}

/**
 * Delete an attendance record
 */
export async function deleteAttendance(attendanceId: string): Promise<void> {
  await apiClient.delete(`/attendance/${attendanceId}`)
}

/**
 * Get attendance summary for a session with swimmer details
 */
export async function getSessionAttendanceWithSwimmers(sessionId: string, squadId: string): Promise<any> {
  return apiClient.get<any>(`/attendance/session/${sessionId}/with-swimmers?squad_id=${squadId}`)
}

/**
 * Mark all swimmers with no attendance record as absent for a session
 */
export async function markRemainingAsAbsent(sessionId: string, squadId: string): Promise<void> {
  await apiClient.post('/attendance/mark-remaining-absent', {
    session_id: sessionId,
    squad_id: squadId,
  })
}

// ============================================
// SQUAD ATTENDANCE RANKINGS (Backend API)
// ============================================

export interface SwimmerAttendance {
  swimmer_id: string
  swimmer_name: string
  total_sessions: number
  present: number
  late: number
  absent: number
  present_percentage: number
  late_percentage: number
  absent_percentage: number
}

export interface AttendanceStats {
  total_sessions: number
  avg_present_percentage: number
  avg_late_percentage: number
  avg_absent_percentage: number
  total_swimmers: number
}

export interface SquadAttendanceData {
  squad: {
    id: string
    name: string
  }
  date_range: {
    start: string
    end: string
  }
  swimmers: SwimmerAttendance[]
  stats: AttendanceStats
}

export async function getSquadAttendanceRankings(
  squadId: string,
  startDate?: string,
  endDate?: string
): Promise<SquadAttendanceData> {
  const params = new URLSearchParams()
  if (startDate) params.append('start_date', startDate)
  if (endDate) params.append('end_date', endDate)

  const url = getApiUrl(`squads/${squadId}/attendance?${params.toString()}`)

  const response = await authenticatedFetch(url)

  if (!response.ok) {
    throw new Error(`Failed to fetch squad attendance: ${response.statusText}`)
  }

  return response.json()
}
