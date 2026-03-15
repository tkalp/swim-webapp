// stores/calendarStore.ts
import { create } from 'zustand'
import type { CalendarEvent } from '@/types/calendar'

interface CalendarState {
  // Events data
  events: CalendarEvent[]
  eventsBySquad: Record<string, CalendarEvent[]>
  selectedEvent: CalendarEvent | null
  
  // UI state
  selectedDate: Date | null
  initialFormDate: Date | null  // New: store the date for form initialization
  viewMode: 'month' | 'week' | 'day' | 'agenda'
  isFormOpen: boolean
  isDetailsOpen: boolean
  
  // Actions
  setEvents: (events: CalendarEvent[]) => void
  addEvent: (event: CalendarEvent) => void
  updateEvent: (eventId: string, event: CalendarEvent) => void
  removeEvent: (eventId: string) => void
  setSquadEvents: (squadId: string, events: CalendarEvent[]) => void
  setSelectedEvent: (event: CalendarEvent | null) => void
  setSelectedDate: (date: Date | null) => void
  setViewMode: (mode: 'month' | 'week' | 'day' | 'agenda') => void
  setFormOpen: (isOpen: boolean) => void
  setDetailsOpen: (isOpen: boolean) => void
  openFormWithDate: (date: Date) => void
  clearFormState: () => void
  clearEvents: () => void
}

export const useCalendarStore = create<CalendarState>((set) => ({
  // Initial state
  events: [],
  eventsBySquad: {},
  selectedEvent: null,
  selectedDate: null,
  initialFormDate: null,
  viewMode: 'month',
  isFormOpen: false,
  isDetailsOpen: false,
  
  // Actions
  setEvents: (events) => set({ events }),
  
  addEvent: (event) => set((state) => ({
    events: [...state.events, event]
  })),
  
  updateEvent: (eventId, event) => set((state) => ({
    events: state.events.map(e => e.id === eventId ? event : e)
  })),
  
  removeEvent: (eventId) => set((state) => ({
    events: state.events.filter(e => e.id !== eventId)
  })),
  
  setSquadEvents: (squadId, events) => set((state) => ({
    eventsBySquad: {
      ...state.eventsBySquad,
      [squadId]: events
    }
  })),
  
  setSelectedEvent: (event) => set({ selectedEvent: event }),
  
  setSelectedDate: (date) => set({ selectedDate: date }),
  
  setViewMode: (mode) => set({ viewMode: mode }),
  
  setFormOpen: (isOpen) => set({ isFormOpen: isOpen }),
  
  setDetailsOpen: (isOpen) => set({ isDetailsOpen: isOpen }),
  
  openFormWithDate: (date) => set({
    initialFormDate: date,
    selectedDate: date,
    selectedEvent: null,
    isFormOpen: true,
  }),
  
  clearFormState: () => set({
    isFormOpen: false,
    selectedEvent: null,
    selectedDate: null,
    initialFormDate: null
  }),
  
  clearEvents: () => set({ 
    events: [], 
    eventsBySquad: {},
    selectedEvent: null 
  })
}))
