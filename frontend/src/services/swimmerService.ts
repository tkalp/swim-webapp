// services/swimmerService.ts
import { apiClient, authenticatedFetch } from '@/lib/apiClient'
import { API_BASE_URL } from '@/lib/api'

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
  // Enhanced stats (optional - only from enhanced endpoint)
  last_activity?: string | null
  recent_pr_count?: number
  attendance_rate?: number
  has_external_tracking?: boolean
}

export type CreateSwimmerData = Omit<Swimmer, 'id' | 'created_at'>
export type UpdateSwimmerData = Partial<Omit<Swimmer, 'id' | 'created_at'>>

/**
 * Get all swimmers for a specific squad
 */
export async function getSwimmersBySquad(squadId: string): Promise<Swimmer[]> {
  return apiClient.get<Swimmer[]>(`/squads/${squadId}/swimmers`)
}

/**
 * Get a single swimmer by ID
 */
export async function getSwimmerById(id: string): Promise<Swimmer | null> {
  try {
    return await apiClient.get<Swimmer>(`/swimmers/${id}/basic-info`)
  } catch {
    return null
  }
}

/**
 * Create a new swimmer
 */
export async function createSwimmer(swimmerData: CreateSwimmerData): Promise<Swimmer> {
  return apiClient.post<Swimmer>('/swimmers/create', swimmerData)
}

/**
 * Update an existing swimmer
 */
export async function updateSwimmer(id: string, updates: UpdateSwimmerData): Promise<Swimmer> {
  return apiClient.put<Swimmer>(`/swimmers/${id}/update`, updates)
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
  return apiClient.get<SwimmerSyncStatus>(`/swimmers/sync-status/${externalLinkId}`)
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
  await apiClient.delete(`/swimmers/${swimmerId}/delete`)
}

/**
 * Check if a swimmer exists
 */
export async function swimmerExists(id: string): Promise<boolean> {
  try {
    await apiClient.get(`/swimmers/${id}/basic-info`)
    return true
  } catch {
    return false
  }
}

/**
 * Get swimmers count for a squad
 */
export async function getSwimmersCount(squadId: string): Promise<number> {
  return apiClient.get<number>(`/swimmers/count?squad_id=${squadId}`)
}

/**
 * Get swimmer basic info with external links
 */
export async function getSwimmerBasicInfo(swimmerId: string): Promise<any> {
  return apiClient.get<any>(`/swimmers/${swimmerId}/basic-info`)
}

/**
 * Get attendance stats for a swimmer
 */
export async function getAttendanceStats(
  swimmerId: string,
  range?: { from?: string; to?: string }
): Promise<any> {
  const params = new URLSearchParams()
  if (range?.from) params.append('from_date', range.from)
  if (range?.to) params.append('to_date', range.to)
  const qs = params.toString()
  return apiClient.get<any>(`/swimmers/${swimmerId}/attendance-stats${qs ? `?${qs}` : ''}`)
}

/**
 * Get sessions per week for a swimmer
 */
export async function getSessionsPerWeek(
  swimmerId: string,
  range?: { from?: string; to?: string }
): Promise<{ week: string; sessions: number; start: string; end: string }[]> {
  const params = new URLSearchParams()
  if (range?.from) params.append('from_date', range.from)
  if (range?.to) params.append('to_date', range.to)
  const qs = params.toString()
  return apiClient.get(`/swimmers/${swimmerId}/sessions-per-week${qs ? `?${qs}` : ''}`)
}
