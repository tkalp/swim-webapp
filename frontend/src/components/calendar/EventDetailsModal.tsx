// components/calendar/EventDetailsModal.tsx
import { format } from 'date-fns'
import { Modal, Button } from '../ui'
import type { CalendarEvent } from '@/types/calendar'

interface EventDetailsModalProps {
  isOpen: boolean
  onClose: () => void
  event: CalendarEvent | null
  onEdit?: () => void
  onDelete?: () => void
}

export function EventDetailsModal({
  isOpen,
  onClose,
  event,
  onEdit,
  onDelete
}: EventDetailsModalProps) {
  if (!event) return null
  
  const startDate = event.start_date ? new Date(event.start_date) : null
  const endDate = event.end_date ? new Date(event.end_date) : null
  
  const getEventTypeStyles = (type: string | null) => {
    switch (type) {
      case 'practice':
        return {
          bg: 'bg-cyan-500/20',
          text: 'text-cyan-400',
          border: 'border-cyan-500/50',
          icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z'
        }
      case 'meet':
        return {
          bg: 'bg-red-500/20',
          text: 'text-red-400',
          border: 'border-red-500/50',
          icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'
        }
      case 'other':
        return {
          bg: 'bg-purple-500/20',
          text: 'text-purple-400',
          border: 'border-purple-500/50',
          icon: 'M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z'
        }
      default:
        return {
          bg: 'bg-primary/20',
          text: 'text-primary',
          border: 'border-primary/50',
          icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z'
        }
    }
  }
  
  const typeStyles = getEventTypeStyles(event.event_type)
  
  return (
    <Modal title="Event Details" isOpen={isOpen} onClose={onClose}>
      <div className="bg-[#111827] rounded-xl border border-[#374151] p-6 max-w-lg w-full mx-4">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <div className={`p-3 rounded-full ${typeStyles.bg} border ${typeStyles.border}`}>
                <svg className={`w-6 h-6 ${typeStyles.text}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={typeStyles.icon} />
                </svg>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${typeStyles.bg} ${typeStyles.text} ${typeStyles.border}`}>
                {event.event_type || 'Event'}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-[#F8FAFC]">
              {event.name || 'Untitled Event'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-[#1F2937] text-[#9CA3AF] hover:text-[#F8FAFC] transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        
        {/* Event Details */}
        <div className="space-y-4 mb-6">
          {/* Date */}
          {startDate && (
            <div className="flex items-start gap-3 p-4 bg-[#1F2937] rounded-lg border border-[#374151]">
              <div className="p-2 bg-[#0A0B0F] rounded-lg">
                <svg className="w-5 h-5 text-[#3197a7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#9CA3AF] mb-1">Date</p>
                <p className="text-base font-semibold text-[#F8FAFC]">
                  {format(startDate, 'EEEE, MMMM dd, yyyy')}
                </p>
              </div>
            </div>
          )}
          
          {/* Time */}
          {startDate && endDate && (
            <div className="flex items-start gap-3 p-4 bg-[#1F2937] rounded-lg border border-[#374151]">
              <div className="p-2 bg-[#0A0B0F] rounded-lg">
                <svg className="w-5 h-5 text-[#3197a7]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-[#9CA3AF] mb-1">Time</p>
                <p className="text-base font-semibold text-[#F8FAFC]">
                  {format(startDate, 'h:mm a')} - {format(endDate, 'h:mm a')}
                </p>
              </div>
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex gap-3">
          {onDelete && (
            <Button
              onClick={onDelete}
              variant="secondary"
              className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30"
            >
              Delete Event
            </Button>
          )}
          {onEdit && (
            <Button
              onClick={onEdit}
              variant="primary"
              className="flex-1"
            >
              Edit Event
            </Button>
          )}
        </div>
      </div>
    </Modal>
  )
}
