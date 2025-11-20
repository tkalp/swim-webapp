import { useCallback, useEffect, useState } from 'react'
import { 
  getSquadById, 
  getSquadSwimmers, 
  getSquadSchedules, 
  getSquadSessions, 
  getSquadCalendarEvents 
} from '@/services/squadService'
import { useSquadDetails, useSwimmersBySquad, useSquadSchedules, useSquadSessions, useSquadEvents } from '@/hooks/useStores'
import { useSquadStore } from '@/stores/squadStore'
import { useSwimmerStore } from '@/stores/swimmerStore'

export type TabKey = 'overview' | 'team' | 'training' | 'workouts' | 'coaches'
export type TrainingSubTab = 'schedule' | 'sessions' | 'calendar'

/**
 * @deprecated Use useSquadApi instead. This hook will be removed in future versions.
 * Legacy hook for loading squad data. Prefer using the new useSquadApi pattern.
 */
export function useSquadData(squadId?: string) {
  // Get all data from stores
  const squad = useSquadDetails(squadId ?? null)
  const swimmers = useSwimmersBySquad(squadId ?? null)
  const schedules = useSquadSchedules(squadId ?? null)
  const sessions = useSquadSessions(squadId ?? null)
  const events = useSquadEvents(squadId ?? null)
  
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    if (!squadId) return
    let mounted = true
    setLoading(true)
    ;(async () => {
      try {
        const [sq, sw, sc, ss, ev] = await Promise.all([
          getSquadById(squadId),
          getSquadSwimmers(squadId),
          getSquadSchedules(squadId),
          getSquadSessions(squadId),
          getSquadCalendarEvents(squadId),
        ])
        if (!mounted) return
        
        // Update stores
        const { setSquadDetails, setSchedules, setSessions, setEvents } = useSquadStore.getState()
        const { setSwimmers } = useSwimmerStore.getState()
        
        if (sq) {
          setSquadDetails(squadId, {
            ...sq,
            swimmers_count: sw.length
          })
        }
        
        // Update swimmers in store
        if (sw && Array.isArray(sw)) {
          setSwimmers(sw, squadId)
        }
        
        // Update schedules, sessions, events in store
        if (sc) setSchedules(squadId, sc)
        if (ss) setSessions(squadId, ss)
        if (ev) setEvents(squadId, ev)
        
        setErr('')
      } catch (e: any) {
        if (mounted) setErr(e.message ?? 'Failed to load squad')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [squadId])

  const refetch = useCallback(async () => {
    if (!squadId) return
    setLoading(true)
    try {
      const [sq, sw, sc, ss, ev] = await Promise.all([
        getSquadById(squadId),
        getSquadSwimmers(squadId),
        getSquadSchedules(squadId),
        getSquadSessions(squadId),
        getSquadCalendarEvents(squadId),
      ])
      
      // Update stores
      const { setSquadDetails, setSchedules, setSessions, setEvents } = useSquadStore.getState()
      const { setSwimmers } = useSwimmerStore.getState()
      
      if (sq) {
        setSquadDetails(squadId, {
          ...sq,
          swimmers_count: sw.length
        })
      }
      
      if (sw && Array.isArray(sw)) {
        setSwimmers(sw, squadId)
      }
      
      if (sc) setSchedules(squadId, sc)
      if (ss) setSessions(squadId, ss)
      if (ev) setEvents(squadId, ev)
      
      setErr('')
    }
    catch (e: any) {
      setErr(e.message ?? 'Failed to load squad')
    }
    finally {
      setLoading(false)
    }
  }, [squadId])
  
  // Return data from stores
  return { squad, swimmers, schedules, sessions, events, loading, err, refetch }
}