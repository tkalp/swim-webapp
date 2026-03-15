import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('@/stores/calendarStore', () => ({
  useCalendarStore: vi.fn(() => ({
    events: [],
    setEvents: vi.fn(),
    addEvent: vi.fn(),
    updateEvent: vi.fn(),
    removeEvent: vi.fn(),
    selectedEvent: null,
    setSelectedEvent: vi.fn(),
    isFormOpen: false,
    setFormOpen: vi.fn(),
    isDetailsOpen: false,
    setDetailsOpen: vi.fn(),
  })),
}))

vi.mock('@/stores/squadStore', () => ({
  useSquadStore: Object.assign(
    vi.fn((selector: any) => {
      const state = { selectedSquadId: null, getAllSquads: () => [] }
      return selector ? selector(state) : state
    }),
    { getState: () => ({ selectedSquadId: null, getAllSquads: () => [] }) }
  ),
}))

vi.mock('@/services/calendarService', () => ({
  getAllCalendarEvents: vi.fn().mockResolvedValue([]),
  createCalendarEvent: vi.fn(),
  updateCalendarEvent: vi.fn(),
  deleteCalendarEvent: vi.fn(),
}))

vi.mock('@/components/ui/PageHeader', () => ({
  default: ({ title }: any) => <div data-testid="page-header">{title}</div>,
}))

vi.mock('@/components/ui/Button', () => ({
  default: ({ children, onClick }: any) => (
    <button onClick={onClick}>{children}</button>
  ),
}))

vi.mock('@/components/calendar', () => ({
  CalendarView: () => <div data-testid="calendar-view" />,
  EventFormModal: () => null,
  EventDetailsModal: () => null,
  CalendarSkeleton: () => <div data-testid="calendar-skeleton" />,
}))

import CalendarPage from '../Calendar'

describe('CalendarPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page header with Calendar title', () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    )
    expect(screen.getByTestId('page-header')).toBeInTheDocument()
    expect(screen.getByText('Calendar')).toBeInTheDocument()
  })

  it('renders loading skeleton initially', () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    )
    expect(screen.getByTestId('calendar-skeleton')).toBeInTheDocument()
  })

  it('renders Add Event button', () => {
    render(
      <MemoryRouter>
        <CalendarPage />
      </MemoryRouter>
    )
    expect(screen.getByRole('button', { name: /add event/i })).toBeInTheDocument()
  })
})
