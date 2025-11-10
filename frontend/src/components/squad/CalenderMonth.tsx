// components/squad/CalendarMonth.tsx
import { useMemo } from 'react'
import { Calendar as CalendarIcon } from 'lucide-react'

type Event = {
  id: string
  name?: string
  event_type?: string
  start_date: string
}

export default function CalendarMonth({ events }: { events: Event[] }) {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const start = new Date(y, m, 1)
  const end = new Date(y, m + 1, 0)
  const firstDow = start.getDay()
  const days = end.getDate()

  const cells = useMemo(() => {
    const arr: { day?: number; items?: Event[] }[] = Array(firstDow).fill({})
    for (let d = 1; d <= days; d++) arr.push({ day: d, items: [] })
    
    const byDay = new Map<number, Event[]>()
    events.forEach(e => {
      const eventDate = new Date(e.start_date)
      // Only include events from this month
      if (eventDate.getMonth() === m && eventDate.getFullYear() === y) {
        const d = eventDate.getDate()
        byDay.set(d, [...(byDay.get(d) ?? []), e])
      }
    })
    
    arr.forEach(c => { 
      if (c.day) c.items = byDay.get(c.day) ?? [] 
    })
    return arr
  }, [events, firstDow, days, m, y])

  const monthLabel = useMemo(
    () => now.toLocaleString(undefined, { month: 'long', year: 'numeric' }),
    [now]
  )

  const today = now.getDate()

  if (!events.length) {
    return (
      <div className="empty">
        <CalendarIcon size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
        <p>No events scheduled this month.</p>
      </div>
    )
  }

  return (
    <section className="calendar">
      <div className="calendar-header">
        <CalendarIcon size={20} style={{ display: 'inline', marginRight: '0.5rem', verticalAlign: 'middle' }} />
        {monthLabel}
      </div>
      
      <div className="month-grid">
        {/* Day headers */}
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(h => (
          <div key={h} className="dow">{h}</div>
        ))}
        
        {/* Calendar cells */}
        {cells.map((c, i) => (
          <div 
            key={i} 
            className={`day ${c.day ? '' : 'empty'} ${c.day === today ? 'today' : ''}`}
          >
            {c.day && (
              <>
                <div className="num">{c.day}</div>
                {c.items?.map((e, idx) => (
                  <div key={idx} className="evt" title={e.name || e.event_type || 'Event'}>
                    <div style={{ fontWeight: 600, marginBottom: '0.125rem' }}>
                      {new Date(e.start_date).toLocaleTimeString([], { 
                        hour: '2-digit', 
                        minute: '2-digit' 
                      })}
                    </div>
                    <div>{e.name || e.event_type || 'Event'}</div>
                  </div>
                ))}
              </>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}