// components/squad/ScheduleTab.tsx
import { useState, useEffect } from 'react'
import { View } from 'react-big-calendar'
import { startOfMonth, endOfMonth } from 'date-fns'
import Button from '@/components/ui/Button'
import { CalendarView, EventFormModal, EventDetailsModal } from '@/components/calendar'
import { useCalendarStore } from '@/stores/calendarStore'
import { getSquadCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/services/calendarService'
import type { CalendarEvent, CreateCalendarEvent } from '@/types/calendar'

interface ScheduleTabProps {
  squadId: string
  canManage?: boolean
}

export function ScheduleTab({ squadId, canManage = false }: ScheduleTabProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState<View>('month')
  const [clickedDate, setClickedDate] = useState<Date | undefined>(undefined)
  
  const {
    eventsBySquad,
    setSquadEvents,
    selectedEvent,
    setSelectedEvent,
    isFormOpen,
    setFormOpen,
    isDetailsOpen,
    setDetailsOpen
  } = useCalendarStore()
  
  const events = eventsBySquad[squadId] || []
  
  // Load events for current month
  useEffect(() => {
    loadEvents()
  }, [currentDate, currentView, squadId])
  
  const loadEvents = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const fromDate = startOfMonth(currentDate)
      const toDate = endOfMonth(currentDate)
      
      const data = await getSquadCalendarEvents(
        squadId,
        fromDate.toISOString(),
        toDate.toISOString()
      )
      
      setSquadEvents(squadId, data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
      console.error('Error loading events:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleCreateEvent = async (eventData: CreateCalendarEvent) => {
    try {
      await createCalendarEvent({ ...eventData, squad_id: squadId })
      await loadEvents()
    } catch (err) {
      console.error('Error creating event:', err)
      throw err
    }
  }
  
  const handleUpdateEvent = async (eventData: CreateCalendarEvent) => {
    if (!selectedEvent) return
    
    try {
      await updateCalendarEvent(selectedEvent.id, eventData)
      await loadEvents()
      setSelectedEvent(null)
    } catch (err) {
      console.error('Error updating event:', err)
      throw err
    }
  }
  
  const handleDeleteEvent = async () => {
    if (!selectedEvent) return
    
    if (!confirm('Are you sure you want to delete this event?')) return
    
    try {
      await deleteCalendarEvent(selectedEvent.id)
      await loadEvents()
      setDetailsOpen(false)
      setSelectedEvent(null)
    } catch (err) {
      console.error('Error deleting event:', err)
      alert('Failed to delete event')
    }
  }
  
  const handleEventClick = (event: CalendarEvent) => {
    setSelectedEvent(event)
    setDetailsOpen(true)
  }
  
  const handleSlotSelect = (slotInfo: { start: Date; end: Date }) => {
    if (!canManage) return
    setClickedDate(slotInfo.start)
    setSelectedEvent(null)
    setFormOpen(true)
  }
  
  const handleEditClick = () => {
    setDetailsOpen(false)
    setFormOpen(true)
  }
  
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg max-w-md">
          <p className="text-red-400">{error}</p>
        </div>
        <Button onClick={loadEvents} variant="primary" className="mt-4">
          Retry
        </Button>
      </div>
    )
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Squad Schedule</h2>
          <p className="text-sm text-text-secondary mt-1">
            View and manage practices, meets, and events
          </p>
        </div>
        {canManage && (
          <Button
            onClick={() => {
              setSelectedEvent(null)
              setFormOpen(true)
            }}
            variant="primary"
            className="flex items-center gap-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add Event
          </Button>
        )}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 text-sm p-4 bg-background-secondary rounded-lg border border-border">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-500"></div>
          <span className="text-text-secondary">Practice</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500"></div>
          <span className="text-text-secondary">Meet</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500"></div>
          <span className="text-text-secondary">Other</span>
        </div>
      </div>
      
      {/* Calendar */}
      {loading ? (
        <div className="w-full h-[600px] bg-background-secondary rounded-xl border border-border flex items-center justify-center">
          <div className="shimmer" />
        </div>
      ) : (
        <CalendarView
          events={events}
          onSelectEvent={handleEventClick}
          onSelectSlot={handleSlotSelect}
          view={currentView}
          onViewChange={setCurrentView}
          date={currentDate}
          onNavigate={setCurrentDate}
        />
      )}
      
      {/* Event Form Modal */}
      {canManage && (
        <EventFormModal
          isOpen={isFormOpen}
          onClose={() => {
            setFormOpen(false)
            setSelectedEvent(null)
            setClickedDate(undefined)
          }}
          onSubmit={selectedEvent ? handleUpdateEvent : handleCreateEvent}
          event={selectedEvent}
          squadId={squadId}
          initialDate={clickedDate}
        />
      )}
      
      {/* Event Details Modal */}
      <EventDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setDetailsOpen(false)
          setSelectedEvent(null)
        }}
        event={selectedEvent}
        onEdit={canManage ? handleEditClick : undefined}
        onDelete={canManage ? handleDeleteEvent : undefined}
      />
    </div>
  )
}
