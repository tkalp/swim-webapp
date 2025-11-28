// components/calendar/EventFormModal.tsx
import { useState, useEffect } from 'react'
import { Calendar, Clock, Type, Users, Trophy, Waves, CalendarDays } from 'lucide-react'
import { Modal } from '../ui'
import DateInput from '../ui/DateInput'
import CustomSelect, { type Option } from '../ui/CustomSelect'
import { useCalendarStore } from '@/stores/calendarStore'
import type { CalendarEvent, CalendarEventType, CreateCalendarEvent } from '@/types/calendar'

interface EventFormModalProps {
  isOpen: boolean
  onClose: () => void
  onSubmit: (event: CreateCalendarEvent) => Promise<void>
  event?: CalendarEvent | null
  squadId?: string
  initialDate?: Date
}

const EVENT_TYPE_OPTIONS: Option[] = [
  { value: 'practice', label: 'Practice' },
  { value: 'meet', label: 'Meet' },
  { value: 'other', label: 'Other' },
]

// Generate time options in 15-minute intervals
const generateTimeOptions = (): Option[] => {
  const options: Option[] = []
  for (let hour = 0; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 15) {
      const timeValue = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`
      const period = hour >= 12 ? 'PM' : 'AM'
      const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour
      const displayTime = `${displayHour}:${minute.toString().padStart(2, '0')} ${period}`
      options.push({ value: timeValue, label: displayTime })
    }
  }
  return options
}

const TIME_OPTIONS = generateTimeOptions()

export function EventFormModal({
  isOpen,
  onClose,
  onSubmit,
  event,
  squadId,
  initialDate
}: EventFormModalProps) {
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [startTime, setStartTime] = useState('16:00')
  const [endTime, setEndTime] = useState('18:00')
  const [eventType, setEventType] = useState<CalendarEventType>('practice')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Initialize form when modal opens or event/initialDate changes
  useEffect(() => {
    console.log('EventFormModal useEffect:', { 
      isOpen, 
      event: !!event, 
      initialDate
    })
    if (!isOpen) return
    
    if (event) {
      // Edit mode
      console.log('Edit mode - using event date')
      setName(event.name || '')
      if (event.start_date) {
        const start = new Date(event.start_date)
        
        // Format date in local timezone
        const year = start.getFullYear()
        const month = String(start.getMonth() + 1).padStart(2, '0')
        const day = String(start.getDate()).padStart(2, '0')
        setStartDate(`${year}-${month}-${day}`)
        setStartTime(start.toTimeString().slice(0, 5))
      }
      if (event.end_date) {
        const end = new Date(event.end_date)
        setEndTime(end.toTimeString().slice(0, 5))
      }
      setEventType(event.event_type || 'practice')
    } else if (initialDate) {
      // Create mode with initial date from calendar click
      console.log('Create mode - using initialDate:', initialDate)
      
      // Format date in local timezone to avoid timezone conversion issues
      const year = initialDate.getFullYear()
      const month = String(initialDate.getMonth() + 1).padStart(2, '0')
      const day = String(initialDate.getDate()).padStart(2, '0')

      setStartDate(`${year}-${month}-${day}`)
      setStartTime('16:00')
      setEndTime('18:00')
      setEventType('practice')
      setName('')
    } else {
      // Create mode - default to today
      console.log('Create mode - defaulting to today')
      const today = new Date()
      const year = today.getFullYear()
      const month = String(today.getMonth() + 1).padStart(2, '0')
      const day = String(today.getDate()).padStart(2, '0')
      setStartDate(`${year}-${month}-${day}`)
      setStartTime('16:00')
      setEndTime('18:00')
      setEventType('practice')
      setName('')
    }
    setError(null)
  }, [event, initialDate, isOpen])
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    if (!name.trim()) {
      setError('Event name is required')
      return
    }
    
    if (!startDate) {
      setError('Start date is required')
      return
    }
    
    if (!squadId && !event?.squad_id) {
      setError('Squad ID is required')
      return
    }
    
    try {
      setIsSubmitting(true)
      
      // Combine date and time
      const startDateTime = new Date(`${startDate}T${startTime}:00`)
      const endDateTime = new Date(`${startDate}T${endTime}:00`)
      
      if (endDateTime <= startDateTime) {
        setError('End time must be after start time')
        return
      }
      
      const eventData: CreateCalendarEvent = {
        name: name.trim(),
        start_date: startDateTime.toISOString(),
        end_date: endDateTime.toISOString(),
        event_type: eventType,
        squad_id: squadId || event?.squad_id || ''
      }
      
      await onSubmit(eventData)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save event')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  const handleClose = () => {
    setError(null)
    onClose()
  }
  
  return (
    <Modal 
      title={event ? 'Edit Event' : 'Create Event'} 
      isOpen={isOpen} 
      onClose={handleClose}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-sm backdrop-blur-sm animate-in fade-in slide-in-from-top-2 duration-300">
            <div className="flex items-center gap-2 font-semibold">
              <span className="text-red-500">⚠</span>
              {error}
            </div>
          </div>
        )}

        {/* Event Name */}
        <div className="space-y-2.5">
          <label className="text-xs font-bold text-cyan-400/80 uppercase tracking-wider flex items-center gap-2">
            <Type size={14} className="text-cyan-400" />
            Event Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-800/40 border border-gray-700/50 rounded-xl px-4 py-3 text-slate-100 placeholder:text-gray-500 focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 focus:bg-gray-800/60 outline-none transition-all duration-200 backdrop-blur-sm"
            placeholder="Enter event name"
            required
          />
        </div>

        {/* Date and Time Section */}
        <div className="space-y-4 p-4 bg-gradient-to-br from-cyan-500/5 to-teal-500/5 rounded-xl border border-cyan-500/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-cyan-500/10 rounded-lg">
              <Calendar size={18} className="text-cyan-400" />
            </div>
            <h3 className="text-slate-100 font-bold text-sm">Date & Time</h3>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Start Date */}
            <div className="sm:col-span-3">
              <DateInput
                label="Date"
                value={startDate}
                onChange={setStartDate}
                placeholder="Select date"
              />
            </div>

            {/* Start Time */}
            <CustomSelect
              label="Start Time"
              value={startTime}
              onChange={setStartTime}
              options={TIME_OPTIONS}
            />

            {/* End Time */}
            <CustomSelect
              label="End Time"
              value={endTime}
              onChange={setEndTime}
              options={TIME_OPTIONS}
            />
          </div>
        </div>

        {/* Event Type */}
        <div className="space-y-4 p-4 bg-gradient-to-br from-purple-500/5 to-pink-500/5 rounded-xl border border-purple-500/10">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <Users size={18} className="text-purple-400" />
            </div>
            <h3 className="text-slate-100 font-bold text-sm">Event Details</h3>
          </div>

          <CustomSelect
            label="Event Type"
            value={eventType}
            onChange={(v) => setEventType(v as CalendarEventType)}
            options={EVENT_TYPE_OPTIONS}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-4 border-t border-gray-800/50">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 bg-gray-800/40 text-slate-300 rounded-xl font-semibold border border-gray-700/50 hover:bg-gray-800/60 hover:text-white hover:border-gray-600/50 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-teal-500 text-white rounded-xl font-bold hover:from-cyan-400 hover:to-teal-400 hover:shadow-xl hover:shadow-cyan-500/30 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none transform hover:scale-[1.02] active:scale-[0.98]"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">⏳</span>
                Saving...
              </span>
            ) : event ? 'Update Event' : 'Create Event'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
