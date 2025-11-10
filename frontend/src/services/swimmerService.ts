// services/swimmerService.ts
import { supabase } from '../lib/supabase'

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
 * Delete a swimmer
 */
export async function deleteSwimmer(id: string): Promise<void> {
  const { error } = await supabase
    .from('swimmers')
    .delete()
    .eq('id', id)

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