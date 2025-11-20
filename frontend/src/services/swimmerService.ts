// services/swimmerService.ts
import { supabase } from '@/lib/supabase'
import { API_BASE_URL } from '@/lib/api'
import { authenticatedFetch } from '@/lib/apiClient'

// Sync status types
export type SyncStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled'

export interface SwimmerSyncStatus {
  sync_status: SyncStatus
  results_count?: number
  sync_error?: string
  last_sync_started_at?: string
  last_sync_completed_at?: string
  sync_progress?: number
  sync_total?: number
}

export type Swimmer = {
  id: string
  first_name: string | null
  last_name: string | null
  date_of_birth?: string | null
  sex?: 'Male' | 'Female' | 'Other' | null
  squad_id?: string | null
  created_at?: string
}

export type CreateSwimmerData = Omit<Swimmer, 'id' | 'created_at'>
export type UpdateSwimmerData = Partial<Omit<Swimmer, 'id' | 'created_at'>>

/**
 * Get all swimmers for a specific squad
 */
export async function getSwimmersBySquad(squadId: string): Promise<Swimmer[]> {
  const { data, error } = await supabase
    .from('swimmers')
    .select('*')
    .eq('squad_id', squadId)
    .order('last_name', { ascending: true })

  if (error) {
    console.error('Error fetching swimmers:', error)
    throw new Error(`Failed to fetch swimmers: ${error.message}`)
  }

  return data || []
}

/**
 * Get a single swimmer by ID
 */
export async function getSwimmerById(id: string): Promise<Swimmer | null> {
  const { data, error } = await supabase
    .from('swimmers')
    .select('*')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No rows returned
      return null
    }
    console.error('Error fetching swimmer:', error)
    throw new Error(`Failed to fetch swimmer: ${error.message}`)
  }

  return data
}

/**
 * Create a new swimmer
 */
export async function createSwimmer(swimmerData: CreateSwimmerData): Promise<Swimmer> {
  const { data, error } = await supabase
    .from('swimmers')
    .insert([swimmerData])
    .select()
    .single()

  if (error) {
    console.error('Error creating swimmer:', error)
    throw new Error(`Failed to create swimmer: ${error.message}`)
  }

  return data
}

/**
 * Update an existing swimmer
 */
export async function updateSwimmer(id: string, updates: UpdateSwimmerData): Promise<Swimmer> {
  const { data, error } = await supabase
    .from('swimmers')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    console.error('Error updating swimmer:', error)
    throw new Error(`Failed to update swimmer: ${error.message}`)
  }

  return data
}

/**
 * Create a swimmer with an external link
 * This triggers automatic background import of historical results
 */
export async function createSwimmerWithExternalLink(
  swimmerData: CreateSwimmerData,
  externalLink: {
    platform: string
    external_id: string
    external_url?: string
    external_name?: string
    birth_year?: number
    nation_code?: string
    club_name?: string
    gender?: 'M' | 'F'
  }
): Promise<{ swimmer: Swimmer; external_link_id: string; sync_started: boolean }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/swimmers/with-external-link`, {
    method: 'POST',
    body: JSON.stringify({
      swimmer: swimmerData,
      external_link: externalLink,
      auto_sync: true  // Enable automatic background sync
    })
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to create swimmer with external link')
  }

  const result = await response.json()
  
  // Return the created swimmer by fetching it
  const swimmer = await getSwimmerById(result.swimmer_id)
  if (!swimmer) {
    throw new Error('Failed to fetch created swimmer')
  }
  
  return {
    swimmer,
    external_link_id: result.external_link_id,
    sync_started: result.sync_started
  }
}

/**
 * Get sync status for a swimmer's external link
 */
export async function getSwimmerSyncStatus(externalLinkId: string): Promise<SwimmerSyncStatus> {
  const { data, error } = await supabase
    .from('swimmer_external_links')
    .select('sync_status, results_count, sync_error, last_sync_started_at, last_sync_completed_at, sync_progress, sync_total')
    .eq('id', externalLinkId)
    .single()

  if (error) {
    throw error
  }

  return data
}

/**
 * Trigger manual sync for a swimmer's external data
 */
export async function triggerSwimmerSync(swimmerId: string): Promise<{ success: boolean; message: string; external_link_id?: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/swimmers/${swimmerId}/sync-external-data`, {
    method: 'POST'
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to trigger sync')
  }

  return await response.json()
}

/**
 * Cancel an in-progress sync for a swimmer
 */
export async function cancelSwimmerSync(swimmerId: string): Promise<{ success: boolean; message: string }> {
  const response = await authenticatedFetch(`${API_BASE_URL}/swimmers/${swimmerId}/cancel-sync`, {
    method: 'POST'
  })

  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.detail || 'Failed to cancel sync')
  }

  return await response.json()
}
/**
 * Delete a swimmer
 */
export async function deleteSwimmer(swimmerId: string): Promise<void> {
  const { error } = await supabase
    .from('swimmers')
    .delete()
    .eq('id', swimmerId)

  if (error) {
    console.error('Error deleting swimmer:', error)
    throw new Error(`Failed to delete swimmer: ${error.message}`)
  }
}

/**
 * Check if a swimmer exists
 */
export async function swimmerExists(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('swimmers')
    .select('id')
    .eq('id', id)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      return false
    }
    console.error('Error checking swimmer existence:', error)
    throw new Error(`Failed to check swimmer existence: ${error.message}`)
  }

  return !!data
}

/**
 * Get swimmers count for a squad
 */
export async function getSwimmersCount(squadId: string): Promise<number> {
  const { count, error } = await supabase
    .from('swimmers')
    .select('id', { count: 'exact', head: true })
    .eq('squad_id', squadId)

  if (error) {
    console.error('Error getting swimmers count:', error)
    throw new Error(`Failed to get swimmers count: ${error.message}`)
  }

  return count || 0
}

/**
 * Get swimmer basic info with external links
 */
export async function getSwimmerBasicInfo(swimmerId: string) {
  const { data, error } = await supabase
    .from('swimmers')
    .select(`
      id, 
      first_name, 
      last_name, 
      date_of_birth, 
      sex, 
      squad_id,
      external_links:swimmer_external_links(
        id,
        platform,
        sync_status,
        results_count,
        sync_error,
        last_sync_started_at,
        last_sync_completed_at
      )
    `)
    .eq('id', swimmerId)
    .single()
  
  if (error) {
    console.error('Error fetching swimmer basic info:', error)
    throw error
  }
  
  return data
}

/**
 * Get attendance stats for a swimmer
 */
export async function getAttendanceStats(
  swimmerId: string,
  range?: { from?: string; to?: string }
) {
  let q = supabase
    .from('training_attendance')
    .select('status, created_at')
    .eq('swimmer_id', swimmerId)

  if (range?.from) q = q.gte('created_at', range.from)
  if (range?.to) q = q.lte('created_at', range.to)

  const { data, error } = await q
  if (error) {
    console.error('Error fetching attendance stats:', error)
    throw error
  }

  const counts = { present: 0, late: 0, absent: 0 }
  data?.forEach(a => {
    const key = String(a.status ?? '').toLowerCase()
    if (key === 'present') counts.present++
    else if (key === 'late') counts.late++
    else counts.absent++
  })
  
  return counts
}

/**
 * Get sessions per week for a swimmer
 */
export async function getSessionsPerWeek(
  swimmerId: string,
  range?: { from?: string; to?: string }
): Promise<{ week: string; sessions: number; start: string; end: string }[]> {
  let q = supabase
    .from('training_attendance')
    .select('training_session_id, created_at, status')
    .eq('swimmer_id', swimmerId)

  if (range?.from) q = q.gte('created_at', range.from)
  if (range?.to) q = q.lte('created_at', range.to)

  const { data, error } = await q
  if (error) {
    console.error('Error fetching sessions per week:', error)
    throw error
  }
  
  if (!data?.length) return []

  const byWeek = new Map<string, number>()
  data.forEach(row => {
    if (!row.status || row.status.toLowerCase() === 'absent') return
    const d = new Date(row.created_at)
    const key = getWeekKey(d)
    byWeek.set(key, (byWeek.get(key) ?? 0) + 1)
  })

  return Array.from(byWeek.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([weekKey, sessions]) => {
      const { start, end, label } = parseWeekKey(weekKey)
      return { week: label, sessions, start: start.toISOString(), end: end.toISOString() }
    })
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function getWeekKey(d: Date) {
  const w = getWeekNumber(d)
  return `${d.getFullYear()}-W${String(w).padStart(2, '0')}`
}

function getWeekNumber(d: Date) {
  const onejan = new Date(d.getFullYear(), 0, 1)
  const dayMs = 86400000
  return Math.ceil((((d.getTime() - onejan.getTime()) / dayMs) + onejan.getDay() + 1) / 7)
}

function parseWeekKey(key: string) {
  const [yearStr, weekStr] = key.split('-W')
  const year = parseInt(yearStr, 10)
  const week = parseInt(weekStr, 10)

  const approx = new Date(year, 0, 1 + (week - 1) * 7)
  const day = approx.getDay()
  const start = new Date(approx)
  start.setDate(approx.getDate() - ((day + 6) % 7))
  start.setHours(0, 0, 0, 0)

  const end = new Date(start)
  end.setDate(start.getDate() + 6)
  end.setHours(23, 59, 59, 999)

  const label = formatRange(start, end)
  return { start, end, label }
}

function formatRange(start: Date, end: Date) {
  const sameMonth = start.getMonth() === end.getMonth()
  const monthShort = (d: Date) => d.toLocaleString('en-US', { month: 'short' })

  if (sameMonth) {
    return `${monthShort(start)} ${start.getDate()}–${end.getDate()}, ${start.getFullYear()}`
  }
  return `${monthShort(start)} ${start.getDate()} – ${monthShort(end)} ${end.getDate()}, ${end.getFullYear()}`
}