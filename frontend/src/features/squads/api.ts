import { supabase } from "../../lib/supabase"

export type SquadCard = {
  id: string
  name: string | null
  description: string | null
  created_at: string
  role: 'owner' | 'admin' | 'member'
  swimmers_count: number
}

/**
 * Returns all squads for a coach (coach_id === auth user id).
 * Joins coach_squads to get the coach's role and counts swimmers.
 */
export async function listSquadsForCoach(coachId: string): Promise<SquadCard[]> {
  // Get the squad memberships w/ roles
  const { data: memberships, error: mErr } = await supabase
    .from('coach_squads')
    .select('squad_id, role, squads!inner(id, name, description, created_at)')
    .eq('coach_id', coachId)

  if (mErr) throw mErr
  if (!memberships?.length) return []

  // Flatten result
  const base: SquadCard[] = memberships.map((m: any) => ({
    id: m.squads.id,
    name: m.squads.name,
    description: m.squads.description,
    created_at: m.squads.created_at,
    role: m.role,
    swimmers_count: 0,
  }))

  // Count swimmers per squad (single round-trip using IN + head=false for count)
  const squadIds = base.map(s => s.id)
  const { data: counts, error: cErr } = await supabase
    .from('swimmers')
    .select('squad_id', { count: 'exact', head: false })
    .in('squad_id', squadIds)

  if (cErr) throw cErr

  // PostgREST returns one row per swimmer; we’ll aggregate quickly
  // Faster: group with a single query via RPC; but this keeps it simple.
  const map = new Map<string, number>()
  counts?.forEach((row: any) => {
    const k = row.squad_id as string
    map.set(k, (map.get(k) ?? 0) + 1)
  })

  return base.map(s => ({ ...s, swimmers_count: map.get(s.id) ?? 0 }))
}

export async function updateSquad(squadId: string, patch: Partial<{ name: string | null; description: string | null }>) {
  const { data, error } = await supabase
    .from('squads')
    .update(patch)
    .eq('id', squadId)
    .select('id, name, description, created_at')
    .single()
  if (error) throw error
  return data
}

export async function deleteSquad(squadId: string) {
  const { data, error } = await supabase
    .from('squads')
    .delete()
    .eq('id', squadId)
  if (error) throw error
  return data
}
