// pages/Calendar.tsx
import { useState, useEffect } from 'react'
import { View } from 'react-big-calendar'
import { startOfMonth, endOfMonth } from 'date-fns'
import PageHeader from '@/components/ui/PageHeader'
import Button from '@/components/ui/Button'
import { CalendarView, EventFormModal, EventDetailsModal, CalendarSkeleton } from '@/components/calendar'
import { useCalendarStore } from '@/stores/calendarStore'
import { useSquadStore } from '@/stores/squadStore'
import { getAllCalendarEvents, createCalendarEvent, updateCalendarEvent, deleteCalendarEvent } from '@/services/calendarService'
import type { CalendarEvent, CreateCalendarEvent } from '@/types/calendar'

export default function CalendarPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [currentView, setCurrentView] = useState<View>('month')
  const [clickedDate, setClickedDate] = useState<Date | undefined>(undefined)
  
  const {
    events,
    setEvents,
    addEvent,
    updateEvent: updateEventInStore,
    removeEvent,
    selectedEvent,
    setSelectedEvent,
    isFormOpen,
    setFormOpen,
    isDetailsOpen,
    setDetailsOpen
  } = useCalendarStore()

  const { selectedSquadId, getAllSquads } = useSquadStore()
  // Resolve squad ID: prefer the user's selected squad, fall back to first squad
  const activeSquadId = selectedSquadId ?? getAllSquads()[0]?.id ?? ''
  
  // Load events for current month
  useEffect(() => {
    loadEvents()
  }, [currentDate, currentView])
  
  const loadEvents = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const fromDate = startOfMonth(currentDate)
      const toDate = endOfMonth(currentDate)
      
      const data = await getAllCalendarEvents(
        fromDate.toISOString(),
        toDate.toISOString()
      )
      
      setEvents(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load events')
      console.error('Error loading events:', err)
    } finally {
      setLoading(false)
    }
  }
  
  const handleCreateEvent = async (eventData: CreateCalendarEvent) => {
    try {
      const newEvent = await createCalendarEvent(eventData)
      addEvent(newEvent)
    } catch (err) {
      console.error('Error creating event:', err)
      throw err
    }
  }
  
  const handleUpdateEvent = async (eventData: CreateCalendarEvent) => {
    if (!selectedEvent) return
    
    try {
      const updatedEvent = await updateCalendarEvent(selectedEvent.id, eventData)
      updateEventInStore(selectedEvent.id, updatedEvent)
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
      removeEvent(selectedEvent.id)
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
      <div className="min-h-screen bg-[#0A0B0F] p-6">
        <PageHeader title="Calendar" />
        <div className="flex flex-col items-center justify-center py-16">
          <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg max-w-md">
            <p className="text-red-400">{error}</p>
          </div>
          <Button onClick={loadEvents} variant="primary" className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-[#0A0B0F] p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <PageHeader 
          title="Calendar" 
        />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mt-4">
          <div className="flex flex-wrap items-center gap-3 sm:gap-4">
            <span className="text-sm text-gray-400 font-semibold">Legend:</span>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm">
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-md bg-gradient-to-br from-teal-500 to-teal-600 shadow-lg shadow-teal-500/30"></div>
                <span className="text-gray-300 font-medium">Practice</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-md bg-gradient-to-br from-pink-500 to-rose-500 shadow-lg shadow-pink-500/30"></div>
                <span className="text-gray-300 font-medium">Meet</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-4 rounded-md bg-gradient-to-br from-fuchsia-500 to-purple-500 shadow-lg shadow-fuchsia-500/30"></div>
                <span className="text-gray-300 font-medium">Other</span>
              </div>
            </div>
          </div>
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
        </div>
      </div>
      
      {/* Calendar */}
      {loading ? (
        <CalendarSkeleton />
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
      <EventFormModal
        isOpen={isFormOpen}
        onClose={() => {
          setFormOpen(false)
          setSelectedEvent(null)
          setClickedDate(undefined)
        }}
        onSubmit={selectedEvent ? handleUpdateEvent : handleCreateEvent}
        event={selectedEvent}
        squadId={activeSquadId}
        initialDate={clickedDate}
      />
      
      {/* Event Details Modal */}
      <EventDetailsModal
        isOpen={isDetailsOpen}
        onClose={() => {
          setDetailsOpen(false)
          setSelectedEvent(null)
        }}
        event={selectedEvent}
        onEdit={handleEditClick}
        onDelete={handleDeleteEvent}
      />
    </div>
  )
}
