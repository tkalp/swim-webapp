// services/swimmerService.ts
import { supabase } from '../lib/supabase'

// API base URL
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

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
  // Get the current session for authentication
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  // Call new backend endpoint that handles both creation and sync
  const response = await fetch(`${import.meta.env.VITE_API_URL}/swimmers/with-external-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
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
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_BASE_URL}/swimmers/${swimmerId}/sync-external-data`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    }
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
  const { data: { session } } = await supabase.auth.getSession()
  
  if (!session) {
    throw new Error('Not authenticated')
  }

  const response = await fetch(`${API_BASE_URL}/swimmers/${swimmerId}/cancel-sync`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    }
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