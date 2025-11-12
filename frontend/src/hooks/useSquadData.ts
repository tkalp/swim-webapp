import { useCallback, useEffect, useState } from 'react'
import { getSquad, listSwimmers, listSchedules, listSessions, listCalendarEvents } from '../features/squads/detailApi'

export type TabKey = 'swimmers' | 'schedule' | 'sessions' | 'calendar' | 'metrics' | 'rankings'

export function useSquadData(squadId?: string) {
  const [squad, setSquad] = useState<any>(null)
  const [swimmers, setSwimmers] = useState<any[]>([])
  const [schedules, setSchedules] = useState<any[]>([])
  const [sessions, setSessions] = useState<any[]>([])
  const [events, setEvents] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState<string>('')

  useEffect(() => {
    if (!squadId) return
    let mounted = true
    setLoading(true)
    ;(async () => {
      try {
        const [sq, sw, sc, ss, ev] = await Promise.all([
          getSquad(squadId),
          listSwimmers(squadId),
          listSchedules(squadId),
          listSessions(squadId),
          listCalendarEvents(squadId),
        ])
        if (!mounted) return
        setSquad(sq); setSwimmers(sw); setSchedules(sc); setSessions(ss); setEvents(ev)
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
        getSquad(squadId),
        listSwimmers(squadId),
        listSchedules(squadId),
        listSessions(squadId),
        listCalendarEvents(squadId),
      ])
      setSquad(sq); setSwimmers(sw); setSchedules(sc); setSessions(ss); setEvents(ev)
      setErr('')
    }
    catch (e: any) {
      setErr(e.message ?? 'Failed to load squad')
    }
    finally {
      setLoading(false)
    }
  }, [squadId])
  
  return { squad, swimmers, schedules, sessions, events, loading, err, refetch }
}