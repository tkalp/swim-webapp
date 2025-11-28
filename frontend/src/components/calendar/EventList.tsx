// components/calendar/EventList.tsx
import type { CalendarEvent } from '@/types/calendar'
import { EventCard } from './EventCard'

interface EventListProps {
  events: CalendarEvent[]
  title?: string
  emptyMessage?: string
  onEventClick?: (event: CalendarEvent) => void
  onEventEdit?: (event: CalendarEvent) => void
  onEventDelete?: (event: CalendarEvent) => void
}

export function EventList({
  events,
  title = 'Events',
  emptyMessage = 'No events scheduled',
  onEventClick,
  onEventEdit,
  onEventDelete
}: EventListProps) {
  
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-20 h-20 rounded-full bg-[#3197a7]/10 border-2 border-[#3197a7]/30 flex items-center justify-center mb-4">
          <svg className="w-10 h-10 text-[#3197a7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-[#F8FAFC] mb-2">
          {emptyMessage}
        </h3>
        <p className="text-sm text-[#9CA3AF] text-center max-w-sm">
          Create your first event by clicking on a date in the calendar or using the "Add Event" button.
        </p>
      </div>
    )
  }
  
  return (
    <div className="space-y-4">
      {title && (
        <h2 className="text-xl font-bold text-[#F8FAFC] mb-4">{title}</h2>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            onClick={() => onEventClick?.(event)}
            onEdit={() => onEventEdit?.(event)}
            onDelete={() => onEventDelete?.(event)}
          />
        ))}
      </div>
    </div>
  )
}
