// components/calendar/EventCard.tsx
import { format } from 'date-fns'
import type { CalendarEvent } from '@/types/calendar'

interface EventCardProps {
  event: CalendarEvent
  onClick?: () => void
  onEdit?: () => void
  onDelete?: () => void
}

export function EventCard({ event, onClick, onEdit, onDelete }: EventCardProps) {
  const startDate = event.start_date ? new Date(event.start_date) : null
  const endDate = event.end_date ? new Date(event.end_date) : null
  
  const getEventTypeColor = (type: string | null) => {
    switch (type) {
      case 'practice':
        return 'bg-gradient-to-br from-cyan-500/20 to-cyan-600/20 border-cyan-500/30'
      case 'meet':
        return 'bg-gradient-to-br from-red-500/20 to-red-600/20 border-red-500/30'
      case 'other':
        return 'bg-gradient-to-br from-purple-500/20 to-purple-600/20 border-purple-500/30'
      default:
        return 'bg-gradient-to-br from-[#265D74]/20 to-[#3197a7]/20 border-[#3197a7]/30'
    }
  }
  
  const getEventTypeBadge = (type: string | null) => {
    switch (type) {
      case 'practice':
        return 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50'
      case 'meet':
        return 'bg-red-500/20 text-red-400 border-red-500/50'
      case 'other':
        return 'bg-purple-500/20 text-purple-400 border-purple-500/50'
      default:
        return 'bg-[#3197a7]/20 text-[#22D3EE] border-[#3197a7]/50'
    }
  }
  
  return (
    <div
      className={`relative group rounded-lg border backdrop-blur-sm p-4 transition-all duration-200 hover:scale-[1.02] cursor-pointer ${getEventTypeColor(event.event_type)}`}
      onClick={onClick}
    >
      {/* Event Type Badge */}
      <div className="flex items-center justify-between mb-3">
        <span className={`px-2.5 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${getEventTypeBadge(event.event_type)}`}>
          {event.event_type || 'Event'}
        </span>
        
        {/* Action Buttons */}
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onEdit()
              }}
              className="p-1.5 rounded-md bg-[#1F2937] hover:bg-[#374151] text-[#F8FAFC] transition-colors"
              title="Edit event"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          {onDelete && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDelete()
              }}
              className="p-1.5 rounded-md bg-[#1F2937] hover:bg-red-500/20 text-red-400 transition-colors"
              title="Delete event"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          )}
        </div>
      </div>
      
      {/* Event Name */}
      <h3 className="text-[#F8FAFC] font-semibold text-base mb-2 line-clamp-2">
        {event.name || 'Untitled Event'}
      </h3>
      
      {/* Date/Time */}
      <div className="flex flex-col gap-1 text-sm text-[#cbd5e1]">
        {startDate && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{format(startDate, 'MMM dd, yyyy')}</span>
          </div>
        )}
        {startDate && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>
              {format(startDate, 'h:mm a')}
              {endDate && ` - ${format(endDate, 'h:mm a')}`}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
